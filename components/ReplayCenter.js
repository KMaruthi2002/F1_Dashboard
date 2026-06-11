'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Panel from './Panel';
import TrackMap from './TrackMap';

const fetchJson = (url) => fetch(url).then((r) => r.json()).catch(() => null);

const SPEEDS = [5, 15, 30, 60];
const TICK_MS = 1400; // real ms between frame advances

const INCIDENT_RE = /SAFETY CAR|RED FLAG|INCIDENT|COLLISION|CRASH|CONTACT|STOPPED|DEBRIS/i;

function isIncident(m) {
  if (!m) return false;
  if (m.flag === 'RED') return true;
  if ((m.category || '').toLowerCase() === 'safetycar') return true;
  return INCIDENT_RE.test(m.message || '');
}

function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function ReplayCenter() {
  const [meta, setMeta] = useState(null);
  const [track, setTrack] = useState(null);
  const [cursor, setCursor] = useState(0); // ms offset from session start
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(15);
  const [cars, setCars] = useState([]);
  const [incident, setIncident] = useState(null);
  const seenIncidents = useRef(new Set());
  const inFlight = useRef(false);
  const cursorRef = useRef(0);
  cursorRef.current = cursor;

  // load meta + track outline
  useEffect(() => {
    fetchJson('/api/replay').then((d) => {
      if (d?.ok) {
        setMeta(d);
        setCursor(10 * 60e3); // start 10 min in (formation done, racing underway)
      }
    });
    fetchJson('/api/track').then((d) => d?.ok && setTrack(d));
  }, []);

  const start = meta ? new Date(meta.dateStart).getTime() : 0;
  const end = meta ? new Date(meta.dateEnd).getTime() : 0;
  const duration = Math.max(end - start, 1);

  const driverByNum = useMemo(
    () => new Map((meta?.drivers || []).map((d) => [+d.n, d])),
    [meta]
  );

  // fetch a frame of car positions for the current cursor
  const fetchFrame = useCallback(async (atMs) => {
    if (!meta || inFlight.current) return;
    inFlight.current = true;
    const d = await fetchJson(`/api/replay?sk=${meta.sessionKey}&at=${new Date(start + atMs).toISOString().slice(0, 19)}`);
    inFlight.current = false;
    if (d?.ok && d.cars?.length) {
      setCars(d.cars.map((c) => {
        const drv = driverByNum.get(+c.n) || {};
        return { ...c, acr: drv.acr, team: drv.team, colour: drv.colour };
      }));
    }
  }, [meta, start, driverByNum]);

  // playback engine
  useEffect(() => {
    if (!playing || !meta) return;
    const t = setInterval(() => {
      const next = cursorRef.current + speed * TICK_MS;
      if (next >= duration) {
        setPlaying(false);
        setCursor(duration);
        return;
      }
      setCursor(next);
      fetchFrame(next);

      // incident detection at the replay clock
      const nowAbs = start + next;
      const hit = (meta.raceControl || []).find((m) => {
        const mt = new Date(m.date).getTime();
        return mt <= nowAbs && mt > nowAbs - speed * TICK_MS && isIncident(m) && !seenIncidents.current.has(m.date);
      });
      if (hit) {
        seenIncidents.current.add(hit.date);
        setIncident(hit);
        setPlaying(false);
      }
    }, TICK_MS);
    return () => clearInterval(t);
  }, [playing, speed, meta, duration, start, fetchFrame]);

  // initial + scrub frame
  useEffect(() => {
    if (meta) fetchFrame(cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const scrub = (v) => {
    const ms = +v;
    setCursor(ms);
    fetchFrame(ms);
  };

  // race control feed up to the replay clock
  const visibleRc = useMemo(() => {
    if (!meta) return [];
    const nowAbs = start + cursor;
    return (meta.raceControl || [])
      .filter((m) => new Date(m.date).getTime() <= nowAbs)
      .slice(-7)
      .reverse();
  }, [meta, cursor, start]);

  const currentLap = useMemo(() => {
    const withLap = visibleRc.find((m) => m.lap != null);
    return withLap?.lap ?? null;
  }, [visibleRc]);

  const ytQuery = (m) =>
    `https://www.youtube.com/@Formula1/search?query=${encodeURIComponent(
      `${meta?.year || ''} ${meta?.location || meta?.circuit || ''} Grand Prix ${
        m?.flag === 'RED' ? 'red flag' : (m?.category || '').toLowerCase() === 'safetycar' ? 'safety car' : 'highlights'
      }`
    )}`;

  const replayTrack = track && {
    ...track,
    mode: 'REPLAY',
    sourceYear: meta?.year,
    cars,
  };

  return (
    <div className="shell">
      <header className="statusbar">
        <span className="brand">APEX <em>//</em> REPLAY</span>
        <span className="status-pip"><span className="pip" />TIME MACHINE</span>
        <span className="spacer" />
        <span className="truncate" style={{ color: 'var(--accent)', maxWidth: '45vw' }}>
          {meta ? `${meta.sessionName?.toUpperCase()} · ${meta.circuit?.toUpperCase()} · ${meta.year}` : 'SYNCING…'}
        </span>
      </header>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a className="back-link" href="/">‹ COMMAND DECK</a>
        <a className="back-link" href="/live">◉ RACE CENTER</a>
      </div>

      <div className="rc-layout">
        <div className="rc-col">
          <Panel kicker="§ REPLAY" title="Full Race Replay" sub={meta ? `${meta.year} · ${meta.circuit}` : '…'}>
            {!replayTrack?.outline?.length ? (
              <div className="rc-msg skel" style={{ height: 300 }} />
            ) : (
              <TrackMap track={replayTrack} grid={[]} selected={null} onSelect={() => {}} />
            )}

            {/* transport controls */}
            <div className="replay-controls">
              <button className="rp-btn play" onClick={() => setPlaying((p) => !p)} disabled={!meta}>
                {playing ? '❚❚' : '▶'}
              </button>
              <div className="rp-speeds">
                {SPEEDS.map((s) => (
                  <button key={s} className={`tt-btn ${speed === s ? 'on' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>
                ))}
              </div>
              <span className="rp-clock">
                T+{fmtClock(cursor)}{currentLap != null && <span className="rp-lap"> · LAP {currentLap}</span>}
              </span>
            </div>
            <input
              type="range"
              className="rp-slider"
              min={0}
              max={duration}
              step={30000}
              value={cursor}
              onChange={(e) => scrub(e.target.value)}
              aria-label="Replay timeline"
            />
            <div className="rp-timeline-labels">
              <span>LIGHTS OUT</span>
              <span>CHEQUERED FLAG</span>
            </div>
          </Panel>
        </div>

        <div className="rc-col">
          <Panel kicker="§ FIA" title="Race Control · Synced" sub="messages up to replay clock">
            {visibleRc.length === 0 ? (
              <div className="rc-msg">Quiet on the radio… press play.</div>
            ) : (
              <div className="rc-feed" style={{ marginTop: 0 }}>
                {visibleRc.map((m, i) => (
                  <div key={i} className="rc-msg" style={isIncident(m) ? { borderLeftColor: 'var(--red)' } : undefined}>
                    <span className={`flag-${m.flag || 'NONE'}`}>
                      [{m.lap != null ? `L${m.lap} · ` : ''}{m.flag || m.category || 'FIA'}]
                    </span>{' '}
                    {m.message}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel kicker="§ HOW" title="Time Machine">
            <div className="rc-msg">
              Press <b style={{ color: 'var(--accent)' }}>▶</b> to roll the race from real GPS data. Drag the timeline to scrub to any moment. When the FIA calls an incident — safety car, red flag, contact — the replay pauses and links you to the footage on F1&apos;s official channel.
            </div>
          </Panel>
        </div>
      </div>

      {/* ── incident popup ── */}
      {incident && (
        <div className="modal-veil" onClick={() => setIncident(null)}>
          <div className="modal incident-modal" onClick={(e) => e.stopPropagation()}>
            <span className="step-tag" style={{ color: 'var(--red)' }}>
              ⚠ INCIDENT {incident.lap != null ? `· LAP ${incident.lap}` : ''} · {incident.flag || incident.category}
            </span>
            <h2>Race Control</h2>
            <p style={{ color: 'var(--text)', fontSize: 16 }}>{incident.message}</p>
            <a
              className="btn-primary"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
              href={ytQuery(incident)}
              target="_blank"
              rel="noopener noreferrer"
            >
              ▶ Watch on F1&apos;s Official Channel
            </a>
            <button className="btn-ghost" onClick={() => { setIncident(null); setPlaying(true); }}>
              ▶ Resume replay
            </button>
          </div>
        </div>
      )}

      <footer className="footer">
        <span className="brand">APEX <em>//</em> TELEMETRY</span>
        <span>REPLAY · REAL GPS + FIA RACE CONTROL · OPENF1</span>
        <span className="right">UNOFFICIAL FAN PROJECT</span>
      </footer>
    </div>
  );
}

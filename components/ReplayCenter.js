'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Panel from './Panel';
import ReplayMap from './ReplayMap';

const fetchJson = (url) => fetch(url).then((r) => r.json()).catch(() => null);

const SPEEDS = [2, 8, 15, 30];
const CHUNK_S = 90;            // race-seconds per fetch
const PREFETCH_AT = 30e3;      // refill when <30s of buffer left

const INCIDENT_RE = /SAFETY CAR|RED FLAG|INCIDENT|COLLISION|CRASH|CONTACT|STOPPED|DEBRIS/i;
const isIncident = (m) =>
  !!m && (m.flag === 'RED' || (m.category || '').toLowerCase() === 'safetycar' || INCIDENT_RE.test(m.message || ''));

function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function ReplayCenter() {
  const [meta, setMeta] = useState(null);
  const [track, setTrack] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(8);
  const [cursorDisplay, setCursorDisplay] = useState(0);
  const [incident, setIncident] = useState(null);
  const [buffering, setBuffering] = useState(false);

  const mapRef = useRef(null);
  const cursorMs = useRef(10 * 60e3);   // playback position (ms from session start)
  const speedRef = useRef(8);
  const rafRef = useRef(null);
  const buf = useRef({ tracks: new Map(), start: 0, end: 0 });
  const fetching = useRef(false);
  const seenIncidents = useRef(new Set());
  const lastUiUpdate = useRef(0);
  const lastIncidentCheck = useRef(10 * 60e3);
  speedRef.current = speed;

  useEffect(() => {
    fetchJson('/api/replay').then((d) => d?.ok && setMeta(d));
    fetchJson('/api/track').then((d) => d?.ok && setTrack(d));
  }, []);

  const startAbs = meta ? new Date(meta.dateStart).getTime() : 0;
  const duration = meta ? Math.max(new Date(meta.dateEnd).getTime() - startAbs, 1) : 1;

  // ── buffer management ────────────────────────────────────────────
  const loadChunk = useCallback(async (offsetMs, replace = false) => {
    if (!meta || fetching.current) return;
    fetching.current = true;
    if (replace) setBuffering(true);
    const fromIso = new Date(startAbs + offsetMs).toISOString().slice(0, 19);
    const d = await fetchJson(`/api/replay?sk=${meta.sessionKey}&from=${fromIso}&dur=${CHUNK_S}`);
    if (d?.ok) {
      if (replace) buf.current = { tracks: new Map(), start: offsetMs, end: offsetMs };
      for (const [n, samples] of Object.entries(d.tracks || {})) {
        const arr = buf.current.tracks.get(+n) || [];
        const lastT = arr.length ? arr[arr.length - 1][0] : -Infinity;
        for (const [dt, x, y] of samples) {
          const t = offsetMs + dt;
          if (t > lastT) arr.push([t, x, y]);
        }
        buf.current.tracks.set(+n, arr);
      }
      buf.current.end = offsetMs + (d.durMs || CHUNK_S * 1000);
      // trim history we've already played (keep 20s behind cursor)
      for (const arr of buf.current.tracks.values()) {
        while (arr.length > 2 && arr[0][0] < cursorMs.current - 20e3) arr.shift();
      }
    }
    fetching.current = false;
    setBuffering(false);
  }, [meta, startAbs]);

  // ── interpolation: where is every car at time c? ──
  const interpolate = useCallback((c) => {
    const pos = new Map();
    for (const [n, arr] of buf.current.tracks) {
      if (!arr.length) continue;
      // binary search for the segment containing c
      let lo = 0, hi = arr.length - 1;
      if (c <= arr[0][0]) { if (arr[0][0] - c < 5e3) pos.set(n, { x: arr[0][1], y: arr[0][2] }); continue; }
      if (c >= arr[hi][0]) { if (c - arr[hi][0] < 8e3) pos.set(n, { x: arr[hi][1], y: arr[hi][2] }); continue; }
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid][0] <= c) lo = mid; else hi = mid; }
      const [t0, x0, y0] = arr[lo];
      const [t1, x1, y1] = arr[hi];
      const f = (c - t0) / Math.max(t1 - t0, 1);
      pos.set(n, { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f });
    }
    return pos;
  }, []);

  // ── 60fps playback loop ──
  useEffect(() => {
    if (!playing || !meta) return;
    let last = performance.now();
    const step = (now) => {
      const dt = now - last;
      last = now;
      let c = cursorMs.current + dt * speedRef.current;
      if (c >= duration) { c = duration; setPlaying(false); }
      cursorMs.current = c;

      mapRef.current?.setPositions(interpolate(c));

      // refill buffer ahead of the cursor
      if (buf.current.end - c < PREFETCH_AT && buf.current.end < duration && !fetching.current) {
        loadChunk(buf.current.end);
      }

      // throttled UI + incident sweep (4Hz)
      if (now - lastUiUpdate.current > 250) {
        lastUiUpdate.current = now;
        setCursorDisplay(c);
        const fromT = lastIncidentCheck.current;
        lastIncidentCheck.current = c;
        const hit = (meta.raceControl || []).find((m) => {
          const mt = new Date(m.date).getTime() - startAbs;
          return mt > fromT && mt <= c && isIncident(m) && !seenIncidents.current.has(m.date);
        });
        if (hit) {
          seenIncidents.current.add(hit.date);
          setIncident(hit);
          setPlaying(false);
        }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, meta, duration, startAbs, interpolate, loadChunk]);

  // initial buffer + first paint
  useEffect(() => {
    if (!meta) return;
    loadChunk(cursorMs.current, true).then(() => {
      mapRef.current?.setPositions(interpolate(cursorMs.current));
      setCursorDisplay(cursorMs.current);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  const scrub = (v) => {
    const c = +v;
    cursorMs.current = c;
    lastIncidentCheck.current = c;
    setCursorDisplay(c);
    loadChunk(c, true).then(() => mapRef.current?.setPositions(interpolate(c)));
  };

  // race control feed synced to the clock
  const visibleRc = useMemo(() => {
    if (!meta) return [];
    const nowAbs = startAbs + cursorDisplay;
    return (meta.raceControl || [])
      .filter((m) => new Date(m.date).getTime() <= nowAbs)
      .slice(-7)
      .reverse();
  }, [meta, cursorDisplay, startAbs]);

  const currentLap = visibleRc.find((m) => m.lap != null)?.lap ?? null;

  const ytQuery = (m) =>
    `https://www.youtube.com/@Formula1/search?query=${encodeURIComponent(
      `${meta?.year || ''} ${meta?.location || meta?.circuit || ''} Grand Prix ${
        m?.flag === 'RED' ? 'red flag' : (m?.category || '').toLowerCase() === 'safetycar' ? 'safety car' : 'highlights'
      }`
    )}`;

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
        <a className="back-link" href="/paddock">🏆 PADDOCK</a>
      </div>

      <div className="rc-layout">
        <div className="rc-col">
          <Panel kicker="§ REPLAY" title="Full Race Replay" sub={meta ? `${meta.year} · ${meta.circuit} · real GPS` : '…'}>
            <ReplayMap
              ref={mapRef}
              bounds={track?.bounds}
              outline={track?.outline}
              drivers={meta?.drivers}
              sourceYear={meta?.year}
            />

            <div className="replay-controls">
              <button className="rp-btn play" onClick={() => setPlaying((p) => !p)} disabled={!meta || buffering}>
                {buffering ? '…' : playing ? '❚❚' : '▶'}
              </button>
              <div className="rp-speeds">
                {SPEEDS.map((s) => (
                  <button key={s} className={`tt-btn ${speed === s ? 'on' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>
                ))}
              </div>
              <span className="rp-clock">
                T+{fmtClock(cursorDisplay)}{currentLap != null && <span className="rp-lap"> · LAP {currentLap}</span>}
                {buffering && <span className="rp-lap" style={{ color: 'var(--amber)' }}> · BUFFERING</span>}
              </span>
            </div>
            <input
              type="range" className="rp-slider"
              min={0} max={duration} step={15000}
              value={cursorDisplay}
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
              Press <b style={{ color: 'var(--accent)' }}>▶</b> — every car follows its real GPS racing line, interpolated at 60fps. Scrub anywhere on the timeline. Incidents pause the replay and link to the footage on F1&apos;s official channel.
            </div>
          </Panel>
        </div>
      </div>

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
              href={ytQuery(incident)} target="_blank" rel="noopener noreferrer"
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
        <span>REPLAY · REAL GPS TRAJECTORIES · 60FPS INTERPOLATION · OPENF1</span>
        <span className="right">UNOFFICIAL FAN PROJECT</span>
      </footer>
    </div>
  );
}

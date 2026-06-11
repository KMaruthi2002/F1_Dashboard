'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Panel from './Panel';
import TrackMap from './TrackMap';
import { teamByOpenF1Name, compound } from '@/lib/teams';

const fetchJson = (url) => fetch(url).then((r) => r.json()).catch(() => null);

function fmtGap(v) {
  if (v == null) return '—';
  if (typeof v === 'string') return v;
  return `+${v.toFixed(3)}`;
}

export default function RaceCenter() {
  const [live, setLive] = useState(null);
  const [track, setTrack] = useState(null);
  const [times, setTimes] = useState(null);
  const [car, setCar] = useState(null);
  const [selected, setSelected] = useState(null);
  const timers = useRef([]);

  const isLive = !!live?.live;

  const schedule = useCallback((fn, ms) => {
    const t = setInterval(fn, ms);
    timers.current.push(t);
  }, []);

  // primary feeds
  useEffect(() => {
    let cancelled = false;
    const loadLive = async () => { const d = await fetchJson('/api/live'); if (!cancelled && d && !d.error) setLive(d); };
    const loadTrack = async () => { const d = await fetchJson('/api/track'); if (!cancelled && d?.ok) setTrack(d); };
    const loadTimes = async () => { const d = await fetchJson('/api/livetimes'); if (!cancelled && d?.ok) setTimes(d); };

    loadLive(); loadTrack(); loadTimes();
    schedule(loadLive, 30e3);
    schedule(loadTrack, 20e3);
    schedule(loadTimes, 30e3);
    return () => { cancelled = true; timers.current.forEach(clearInterval); timers.current = []; };
  }, [schedule]);

  // default selection = leader
  useEffect(() => {
    if (selected == null && live?.grid?.length) setSelected(live.grid[0].number);
  }, [live, selected]);

  // onboard telemetry for selected car
  useEffect(() => {
    if (selected == null) return;
    let cancelled = false;
    const load = async () => { const d = await fetchJson(`/api/cardata/${selected}`); if (!cancelled) setCar(d?.ok ? d : null); };
    load();
    const t = setInterval(load, isLive ? 12e3 : 60e3);
    return () => { cancelled = true; clearInterval(t); };
  }, [selected, isLive]);

  const grid = live?.grid || [];
  const timesByNum = new Map((times?.drivers || []).map((d) => [+d.number, d]));
  const wx = live?.weather;
  const session = live?.session;
  const selRow = grid.find((g) => +g.number === +selected);
  const selTeam = selRow ? teamByOpenF1Name(selRow.team, selRow.teamColour) : null;

  return (
    <div className="shell">
      <header className="statusbar">
        <span className="brand">APEX <em>//</em> RACE CENTER</span>
        <span className="status-pip">
          <span className={`pip ${isLive ? 'red' : ''}`} />
          {isLive ? 'SESSION LIVE' : 'REPLAY · LAST SESSION'}
        </span>
        <span className="spacer" />
        <span className="truncate" style={{ color: 'var(--accent)', maxWidth: '45vw' }}>
          {session ? `${session.name?.toUpperCase()} · ${session.circuit?.toUpperCase()} · ${session.country?.toUpperCase()}` : 'SYNCING…'}
        </span>
      </header>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a className="back-link" href="/">‹ BACK TO COMMAND DECK</a>
        <a className="back-link" href="/replay">▸ FULL RACE REPLAY</a>
      </div>

      <div className="rc-layout">
        <div className="rc-col">
          <Panel kicker="§ MAP" title="Track Positions" sub={track?.circuit || '…'}>
            <TrackMap track={track} grid={grid} selected={selected} onSelect={setSelected} />
          </Panel>

          <Panel
            kicker="§ ONBOARD"
            title={selRow ? `Car ${selRow.number} · ${selRow.acronym}` : 'Onboard Telemetry'}
            sub={car?.mode === 'LIVE' ? '◉ live channel' : car ? 'replay sample' : 'select a car'}
            style={selTeam ? { borderColor: `color-mix(in srgb, ${selTeam.color} 40%, transparent)` } : undefined}
          >
            {!car ? (
              <div className="rc-msg">No onboard channel for this car right now.</div>
            ) : (
              <div className="gauges">
                <div className="gauge">
                  <div className="g-val">{car.speed ?? '—'}<span className="g-unit"> km/h</span></div>
                  <div className="g-label">Speed</div>
                  <div className="g-bar"><div style={{ width: `${Math.min(100, ((car.speed || 0) / 360) * 100)}%` }} /></div>
                </div>
                <div className="gauge">
                  <div className="g-val">{car.gear || 'N'}</div>
                  <div className="g-label">Gear</div>
                  <div className="g-bar"><div style={{ width: `${((car.gear || 0) / 8) * 100}%` }} /></div>
                </div>
                <div className="gauge">
                  <div className="g-val">{car.rpm ? (car.rpm / 1000).toFixed(1) : '—'}<span className="g-unit">k</span></div>
                  <div className="g-label">RPM</div>
                  <div className="g-bar"><div style={{ width: `${Math.min(100, ((car.rpm || 0) / 13000) * 100)}%` }} /></div>
                </div>
                <div className="gauge">
                  <div className="g-val">{car.throttle ?? '—'}<span className="g-unit">%</span></div>
                  <div className="g-label">Throttle</div>
                  <div className="g-bar"><div style={{ width: `${car.throttle || 0}%`, background: 'var(--green)' }} /></div>
                </div>
                <div className="gauge">
                  <div className="g-val">{car.brake ?? '—'}<span className="g-unit">%</span></div>
                  <div className="g-label">Brake</div>
                  <div className="g-bar"><div style={{ width: `${car.brake || 0}%`, background: 'var(--red)' }} /></div>
                </div>
                <div className={`gauge ${car.drs ? 'drs-on' : ''}`}>
                  <div className="g-val">{car.drs ? 'OPEN' : 'CLOSED'}</div>
                  <div className="g-label">DRS</div>
                </div>
              </div>
            )}
          </Panel>

          {wx && (
            <Panel kicker="§ WX" title="Track Conditions">
              <div className="wx-grid">
                <div className="wx-cell"><div className="wx-value">{wx.airTemp?.toFixed(1)}<span className="unit">°C</span></div><div className="wx-label">Air</div></div>
                <div className="wx-cell"><div className="wx-value">{wx.trackTemp?.toFixed(1)}<span className="unit">°C</span></div><div className="wx-label">Track</div></div>
                <div className="wx-cell"><div className="wx-value">{wx.humidity?.toFixed(0)}<span className="unit">%</span></div><div className="wx-label">Humidity</div></div>
                <div className="wx-cell"><div className="wx-value">{wx.rainfall ? 'WET' : 'DRY'}</div><div className="wx-label">Rain</div></div>
              </div>
            </Panel>
          )}
        </div>

        <div className="rc-col">
          <Panel
            kicker="§ DATA"
            title="Full Telemetry"
            sub={times?.purple ? `◆ fastest: car ${times.purple.number} · ${times.purple.time}` : '…'}
          >
            {grid.length === 0 ? (
              <div className="rc-msg">Timing feed warming up…</div>
            ) : (
              <div className="tt-scroll">
                <table className="tt-table">
                  <thead>
                    <tr>
                      <th>P</th><th>Car</th><th>Tire</th><th>Gap</th><th>Int</th>
                      <th>Lap</th><th>Last</th><th>S1</th><th>S2</th><th>S3</th><th>Best</th><th>Pit</th><th>Trap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((d) => {
                      const team = teamByOpenF1Name(d.team, d.teamColour);
                      const t = timesByNum.get(+d.number) || {};
                      const tire = compound(d.compound);
                      return (
                        <tr
                          key={d.number}
                          className={+d.number === +selected ? 'sel' : ''}
                          style={{ '--row-color': team.color }}
                          onClick={() => setSelected(d.number)}
                        >
                          <td>{d.position}</td>
                          <td className="acr">{d.acronym}</td>
                          <td>
                            {d.compound ? (
                              <span className="tire-dot" style={{ '--tire-color': tire.color }}>{tire.code}</span>
                            ) : '—'}
                            {d.tyreLaps != null && <span style={{ color: 'var(--text-dim)', fontSize: 10 }}> L{d.tyreLaps}</span>}
                          </td>
                          <td>{d.position === 1 ? '—' : fmtGap(d.gapToLeader)}</td>
                          <td>{d.position === 1 ? '—' : fmtGap(d.interval)}</td>
                          <td>{t.lapCount ?? '—'}</td>
                          <td>{t.lastLap ?? '—'}</td>
                          <td>{t.s1 ?? '—'}</td>
                          <td>{t.s2 ?? '—'}</td>
                          <td>{t.s3 ?? '—'}</td>
                          <td className={t.isPurple ? 'purple' : ''}>{t.bestLap ?? '—'}</td>
                          <td>{t.pits || 0}</td>
                          <td>{t.speedTrap ? `${t.speedTrap}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {(live?.raceControl || []).length > 0 && (
            <Panel kicker="§ FIA" title="Race Control">
              <div className="rc-feed" style={{ marginTop: 0 }}>
                {live.raceControl.map((m, i) => (
                  <div key={i} className="rc-msg">
                    <span className={`flag-${m.flag || 'NONE'}`}>[{m.flag || m.category || 'FIA'}]</span> {m.message}
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <footer className="footer">
        <span className="brand">APEX <em>//</em> TELEMETRY</span>
        <span>GPS + TIMING · OPENF1 · {isLive ? 'LIVE REFRESH 20–30s' : 'REPLAY OF LAST SESSION'}</span>
        <span className="right">UNOFFICIAL FAN PROJECT</span>
      </footer>
    </div>
  );
}

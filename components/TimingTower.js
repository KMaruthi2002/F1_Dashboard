'use client';

import { useState } from 'react';
import Panel from './Panel';
import { teamByOpenF1Name, compound } from '@/lib/teams';

function fmtGap(v) {
  if (v == null) return '—';
  if (typeof v === 'string') return v; // e.g. "+1 LAP"
  return `+${v.toFixed(3)}`;
}

export default function TimingTower({ live, favNumbers, onSelectNumber }) {
  const [view, setView] = useState('tower'); // tower | gaps
  const session = live?.session;
  const grid = live?.grid || [];
  const wx = live?.weather;
  const isLive = !!live?.live;

  const maxGap = Math.max(...grid.map((d) => (typeof d.gapToLeader === 'number' ? d.gapToLeader : 0)), 1);

  return (
    <Panel
      kicker="§ 01 · TIMING"
      title={isLive ? 'Live Timing Tower' : 'Timing Tower'}
      sub={
        session
          ? `${session.name} · ${session.circuit} · ${isLive ? '◉ LIVE' : 'LAST SESSION'}`
          : 'awaiting uplink'
      }
    >
      {grid.length > 0 && (
        <div className="tower-toolbar">
          <button className={`tt-btn ${view === 'tower' ? 'on' : ''}`} onClick={() => setView('tower')}>▤ Tower</button>
          <button className={`tt-btn ${view === 'gaps' ? 'on' : ''}`} onClick={() => setView('gaps')}>⇥ Gap Graph</button>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.14em', alignSelf: 'center' }}>
            CLICK A CAR FOR DOSSIER · <span style={{ color: 'var(--green)' }}>DRS</span> = WITHIN 1.0s
          </span>
        </div>
      )}

      {grid.length === 0 ? (
        <div className="rc-msg">No timing data on the wire. The tower lights up when a session runs.</div>
      ) : view === 'tower' ? (
        <div className="tower">
          {grid.map((d) => {
            const team = teamByOpenF1Name(d.team, d.teamColour);
            const tire = compound(d.compound);
            const isFav = favNumbers?.has?.(+d.number);
            const inDRS = typeof d.interval === 'number' && d.interval > 0 && d.interval < 1.0 && d.position > 1;
            return (
              <div
                key={d.number}
                className={`tower-row clickable ${isFav ? 'fav' : ''}`}
                style={{ '--row-color': team.color }}
                onClick={() => onSelectNumber?.(d.number)}
              >
                <span className={`tw-pos ${d.position === 1 ? 'p1' : ''}`}>{d.position}</span>
                <span className="tw-acr">{d.acronym}</span>
                <span className="tw-name">{d.fullName || `Car #${d.number}`} · {team.name}</span>
                <span className="tw-gap">{d.position === 1 ? <b>LEADER</b> : <b>{fmtGap(d.gapToLeader)}</b>}</span>
                <span className="tw-int">
                  {inDRS && <span className="drs-chip">DRS</span>}{' '}
                  {d.position === 1 ? 'INT ·' : `INT ${fmtGap(d.interval)}`}
                </span>
                <span className="tw-tire">
                  {d.compound && (
                    <>
                      <span className="tire-dot" style={{ '--tire-color': tire.color }}>{tire.code}</span>
                      {d.tyreLaps != null && <span className="tw-tirelaps">L{d.tyreLaps}</span>}
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="gap-graph">
          {grid.map((d) => {
            const team = teamByOpenF1Name(d.team, d.teamColour);
            const g = typeof d.gapToLeader === 'number' ? d.gapToLeader : maxGap;
            return (
              <div key={d.number} className="gg-row clickable" style={{ '--row-color': team.color }} onClick={() => onSelectNumber?.(d.number)}>
                <span className={`tw-pos ${d.position === 1 ? 'p1' : ''}`}>{d.position}</span>
                <span className="tw-acr">{d.acronym}</span>
                <div className="gg-track"><div style={{ width: `${Math.max(2, (1 - g / maxGap) * 100)}%` }} /></div>
                <span className="gg-gap">{d.position === 1 ? 'LEADER' : fmtGap(d.gapToLeader)}</span>
              </div>
            );
          })}
        </div>
      )}

      {wx && (
        <div className="wx-grid" style={{ marginTop: 16 }}>
          <div className="wx-cell"><div className="wx-value">{wx.airTemp?.toFixed(1)}<span className="unit">°C</span></div><div className="wx-label">Air</div></div>
          <div className="wx-cell"><div className="wx-value">{wx.trackTemp?.toFixed(1)}<span className="unit">°C</span></div><div className="wx-label">Track</div></div>
          <div className="wx-cell"><div className="wx-value">{wx.humidity?.toFixed(0)}<span className="unit">%</span></div><div className="wx-label">Humidity</div></div>
          <div className="wx-cell"><div className="wx-value">{wx.rainfall ? 'WET' : 'DRY'}</div><div className="wx-label">Rain</div></div>
        </div>
      )}

      {(live?.raceControl || []).length > 0 && (
        <div className="rc-feed">
          {live.raceControl.slice(0, 5).map((m, i) => (
            <div key={i} className="rc-msg">
              <span className={`flag-${m.flag || 'NONE'}`}>[{m.flag || m.category || 'FIA'}]</span> {m.message}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

'use client';

import { Fragment } from 'react';
import Panel from './Panel';
import { teamByConstructorId, compound, COMPOUNDS, flagFor, hiResHeadshot } from '@/lib/teams';

export function Podium({ lastRace }) {
  const top3 = (lastRace?.results || []).slice(0, 3);
  if (top3.length < 3) return null;
  const [p1, p2, p3] = top3;
  const order = [p2, p1, p3]; // visual podium arrangement
  const shotByNum = new Map((lastRace?.openf1Drivers || []).map((d) => [+d.number, d.headshot]));
  return (
    <div className="podium">
      {order.map((r) => {
        const team = teamByConstructorId(r.constructorId);
        const shot = hiResHeadshot(shotByNum.get(+r.number));
        return (
          <div key={r.driverId} className={`pod-step ${r.position === 1 ? 'p1' : ''}`} style={{ '--row-color': team.color }}>
            <div className="pod-rank">P{r.position}</div>
            {shot && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="pod-img" src={shot} alt={r.lastName} loading="lazy" />
            )}
            <div className="pod-driver f1-name"><span className="fn">{r.firstName}</span> <span className="ln">{r.lastName}</span></div>
            <div className="pod-team">{r.constructorName}</div>
            <div className="pod-time">{r.time || r.status}</div>
          </div>
        );
      })}
    </div>
  );
}

export function RaceResults({ lastRace }) {
  const results = lastRace?.results || [];
  return (
    <Panel
      kicker="§ 05 · RESULT"
      title="Last Race Classification"
      sub={lastRace ? `RD ${lastRace.round} · ${flagFor(lastRace.country)} ${lastRace.name}` : '…'}
    >
      <Podium lastRace={lastRace} />
      {results.length === 0 ? (
        <div className="rc-msg skel" style={{ height: 200 }} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="rtable">
            <thead>
              <tr><th>P</th><th>Driver</th><th>Team</th><th className="num">Grid</th><th className="num">Δ</th><th className="num">Time / Status</th><th className="num">Pts</th></tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const team = teamByConstructorId(r.constructorId);
                const delta = r.grid > 0 ? r.grid - r.position : 0;
                return (
                  <tr key={r.driverId} style={{ '--row-color': team.color }}>
                    <td>{r.positionText}</td>
                    <td className="drv">{r.code} {r.fastestLap?.rank === 1 && <span className="fl-badge">◆FL</span>}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{r.constructorName}</td>
                    <td className="num">{r.grid || '—'}</td>
                    <td className={`num ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : ''}`}>
                      {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '—'}
                    </td>
                    <td className="num">{r.time || r.status}</td>
                    <td className="num">{r.points || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

export function RaceConditions({ lastRace }) {
  const w = lastRace?.weather;
  return (
    <Panel kicker="§ 06 · WX" title="Race Conditions" sub={lastRace?.name || '…'}>
      {!w ? (
        <div className="rc-msg">No weather telemetry recorded for this session.</div>
      ) : (
        <div className="wx-grid">
          <div className="wx-cell"><div className="wx-value">{w.airTemp?.toFixed(1)}<span className="unit">°C</span></div><div className="wx-label">Air Temp</div></div>
          <div className="wx-cell"><div className="wx-value">{w.trackTemp?.toFixed(1)}<span className="unit">°C</span></div><div className="wx-label">Track Temp</div></div>
          <div className="wx-cell"><div className="wx-value">{w.humidity?.toFixed(0)}<span className="unit">%</span></div><div className="wx-label">Humidity</div></div>
          <div className="wx-cell"><div className="wx-value" style={{ color: w.rain ? 'var(--cyan)' : undefined }}>{w.rain ? 'WET' : 'DRY'}</div><div className="wx-label">Rain</div></div>
        </div>
      )}
    </Panel>
  );
}

export function TireStrategy({ lastRace }) {
  const stints = lastRace?.stints || [];
  const results = lastRace?.results || [];
  const byNumber = new Map(results.map((r) => [+r.number, r]));
  const totalLaps = Math.max(...stints.map((s) => s.lapEnd || 0), 1);

  // top 10 finishers, in order
  const top = results.slice(0, 10);
  const grouped = top.map((r) => ({
    result: r,
    stints: stints.filter((s) => +s.driverNumber === +r.number).sort((a, b) => a.stint - b.stint),
  })).filter((g) => g.stints.length > 0);

  return (
    <Panel kicker="§ 07 · STRAT" title="Tire Strategy" sub="top finishers · stint by stint">
      {grouped.length === 0 ? (
        <div className="rc-msg">No stint data for this race yet.</div>
      ) : (
        <>
          <div className="stints">
            {grouped.map(({ result, stints: ss }) => {
              const team = teamByConstructorId(result.constructorId);
              return (
                <div key={result.driverId} className="stint-row" style={{ '--row-color': team.color }}>
                  <span className="stint-drv">P{result.position} {result.code}</span>
                  <div className="stint-track">
                    {ss.map((s, i) => {
                      const len = Math.max(1, (s.lapEnd || 0) - (s.lapStart || 0) + 1);
                      const c = compound(s.compound);
                      return (
                        <Fragment key={s.stint}>
                          {i > 0 && <div className="pit-tick" title={`Pit stop · L${s.lapStart}`} />}
                          <div
                            className="stint-seg"
                            title={`${s.compound} · L${s.lapStart}–L${s.lapEnd} (${len} laps)`}
                            style={{ width: `${(len / totalLaps) * 100}%`, '--seg-color': c.color }}
                          >
                            {len > totalLaps * 0.12 ? c.code : ''}
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="stint-legend">
            {['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].map((k) => (
              <span key={k}><span className="dot" style={{ background: COMPOUNDS[k].color }} />{k.toLowerCase()}</span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}

export function QualiRecap({ lastRace }) {
  const quali = lastRace?.qualifying || [];
  const pole = quali[0];
  return (
    <Panel kicker="§ 08 · QUALI" title="Qualifying Recap" sub={lastRace?.name || '…'}>
      {quali.length === 0 ? (
        <div className="rc-msg">No qualifying data yet.</div>
      ) : (
        <>
          {pole && (
            <div className="quali-pole" style={{ '--row-color': teamByConstructorId(pole.constructorId).color }}>
              <span className="pole-tag">◆ POLE</span>
              <span className="pole-name">{pole.firstName} {pole.lastName}</span>
              <span className="pole-time">{pole.q3 || pole.q2 || pole.q1 || '—'}</span>
            </div>
          )}
          <div style={{ overflowX: 'auto' }}>
            <table className="rtable">
              <thead><tr><th>P</th><th>Driver</th><th className="num">Q1</th><th className="num">Q2</th><th className="num">Q3</th></tr></thead>
              <tbody>
                {quali.slice(0, 10).map((q) => {
                  const team = teamByConstructorId(q.constructorId);
                  return (
                    <tr key={q.driverId} style={{ '--row-color': team.color }}>
                      <td>{q.position}</td>
                      <td className="drv">{q.code}</td>
                      <td className="num">{q.q1 || '—'}</td>
                      <td className="num">{q.q2 || '—'}</td>
                      <td className="num" style={{ color: q.q3 ? '#c084fc' : undefined }}>{q.q3 || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

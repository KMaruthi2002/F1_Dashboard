'use client';

import Panel from './Panel';
import { teamByConstructorId } from '@/lib/teams';

export function DriverStandings({ standings, favDriverId, onSelect }) {
  const drivers = standings?.drivers || [];
  const max = drivers[0]?.points || 1;
  return (
    <Panel kicker="§ 02 · WDC" title="Drivers' Championship" sub={standings ? `RD ${standings.round} · ${standings.season}` : '…'}>
      <div className="standings">
        {drivers.length === 0
          ? [...Array(8)].map((_, i) => <div key={i} className="st-row skel" style={{ height: 42 }} />)
          : drivers.map((d) => {
              const team = teamByConstructorId(d.constructorId);
              return (
                <div
                  key={d.driverId}
                  className={`st-row clickable ${d.driverId === favDriverId ? 'fav' : ''}`}
                  style={{ '--row-color': team.color }}
                  onClick={() => onSelect?.(d)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="st-bar" style={{ '--bar-w': `${(d.points / max) * 100}%` }} />
                  <span className="st-pos">{String(d.position).padStart(2, '0')}</span>
                  <span className="st-main">
                    <span className="st-code">{d.code}</span>
                    <span className="st-name">{d.firstName} {d.lastName}</span>
                    <span className="st-team">{d.constructorName}</span>
                  </span>
                  <span className="st-pts">
                    {d.points}
                    <span className="pts-label">PTS{d.wins > 0 ? <span className="st-wins"> · {d.wins}W</span> : ''}</span>
                  </span>
                </div>
              );
            })}
      </div>
    </Panel>
  );
}

export function ConstructorStandings({ standings }) {
  const teams = standings?.constructors || [];
  const max = teams[0]?.points || 1;
  return (
    <Panel kicker="§ 03 · WCC" title="Constructors' Cup" sub={standings ? `RD ${standings.round} · ${standings.season}` : '…'}>
      <div className="standings">
        {teams.length === 0
          ? [...Array(6)].map((_, i) => <div key={i} className="st-row skel" style={{ height: 42 }} />)
          : teams.map((c) => {
              const team = teamByConstructorId(c.constructorId);
              return (
                <div key={c.constructorId} className="st-row" style={{ '--row-color': team.color }}>
                  <div className="st-bar" style={{ '--bar-w': `${(c.points / max) * 100}%` }} />
                  <span className="st-pos">{String(c.position).padStart(2, '0')}</span>
                  <span className="st-main">
                    <span className="st-name">{c.name}</span>
                    <span className="st-team">{c.nationality}</span>
                  </span>
                  <span className="st-pts">
                    {c.points}
                    <span className="pts-label">PTS{c.wins > 0 ? <span className="st-wins"> · {c.wins}W</span> : ''}</span>
                  </span>
                </div>
              );
            })}
      </div>
    </Panel>
  );
}

'use client';

import Panel from './Panel';
import { teamByConstructorId, hiResHeadshot, teamLogoUrl } from '@/lib/teams';

export function DriverStandings({ standings, favDriverId, onSelect, headshots }) {
  const drivers = standings?.drivers || [];
  const max = drivers[0]?.points || 1;
  return (
    <Panel kicker="§ 02 · WDC" title="Drivers' Championship" sub={standings ? `RD ${standings.round} · ${standings.season}` : '…'}>
      <div className="standings">
        {drivers.length === 0
          ? [...Array(8)].map((_, i) => <div key={i} className="st-row skel" style={{ height: 46 }} />)
          : drivers.map((d) => {
              const team = teamByConstructorId(d.constructorId);
              const shot = hiResHeadshot(headshots?.[+d.number]);
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
                  <span className={`pos-plate ${d.position === 1 ? 'gold' : ''}`} style={{ zIndex: 1 }}>{d.position}</span>
                  {shot ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="drv-avatar" src={shot} alt={d.lastName} loading="lazy" style={{ zIndex: 1 }} />
                  ) : (
                    <span className="no-avatar" style={{ zIndex: 1 }}>{d.code}</span>
                  )}
                  <span className="st-main">
                    <span className="st-name f1-name"><span className="fn">{d.firstName}</span> <span className="ln">{d.lastName}</span></span>
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
          ? [...Array(6)].map((_, i) => <div key={i} className="st-row skel" style={{ height: 46 }} />)
          : teams.map((c) => {
              const team = teamByConstructorId(c.constructorId);
              const logo = teamLogoUrl(c.constructorId);
              return (
                <div key={c.constructorId} className="st-row teams" style={{ '--row-color': team.color }}>
                  <div className="st-bar" style={{ '--bar-w': `${(c.points / max) * 100}%` }} />
                  <span className={`pos-plate ${c.position === 1 ? 'gold' : ''}`} style={{ zIndex: 1 }}>{c.position}</span>
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="team-logo" src={logo} alt={c.name} loading="lazy" style={{ zIndex: 1 }} />
                  ) : (
                    <span className="team-logo-badge" style={{ zIndex: 1 }}>{c.name?.[0] || '?'}</span>
                  )}
                  <span className="st-main">
                    <span className="st-name ln" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.name}</span>
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

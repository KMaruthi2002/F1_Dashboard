'use client';

import { useEffect, useState } from 'react';
import Panel from './Panel';
import { teamByConstructorId, hiResHeadshot, teamLogoUrl } from '@/lib/teams';

function DriverCard({ standing, lastRace }) {
  const [career, setCareer] = useState(null);
  useEffect(() => {
    if (!standing?.driverId) return;
    let alive = true;
    fetch(`/api/driver/${standing.driverId}`)
      .then((r) => r.json())
      .then((d) => alive && !d.error && setCareer(d))
      .catch(() => {});
    return () => { alive = false; };
  }, [standing?.driverId]);

  if (!standing) return null;
  const team = teamByConstructorId(standing.constructorId);
  const headshot = hiResHeadshot(
    (lastRace?.openf1Drivers || []).find((d) => +d.number === +standing.number)?.headshot, ''
  );

  return (
    <div className="fav-card" style={{ '--row-color': team.color }}>
      {headshot ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="fav-portrait" src={headshot} alt={standing.lastName} />
      ) : (
        <div className="fav-portrait" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 34, color: team.color }}>
          {standing.code}
        </div>
      )}
      <div>
        <div className="fav-name">{standing.firstName} <em>{standing.lastName}</em></div>
        <div className="fav-team">#{standing.number} · {standing.constructorName} · {standing.nationality}</div>
        <div className="fav-stats">
          <div className="fav-stat"><div className="v">P{standing.position}</div><div className="l">Champ Pos</div></div>
          <div className="fav-stat"><div className="v">{standing.points}</div><div className="l">Points</div></div>
          <div className="fav-stat"><div className="v">{career?.seasonPodiums ?? '—'}</div><div className="l">Podiums</div></div>
          <div className="fav-stat"><div className="v">{career?.careerWins ?? '—'}</div><div className="l">C. Wins</div></div>
          <div className="fav-stat"><div className="v">{career?.careerPoles ?? '—'}</div><div className="l">C. Poles</div></div>
        </div>
        {career?.lastFive?.length > 0 && (
          <div className="fav-form">
            {career.lastFive.map((r) => {
              const pos = parseInt(r.position, 10);
              const cls = pos === 1 ? 'win' : pos <= 3 ? 'podium' : '';
              return (
                <div key={r.round} className={`form-chip ${cls}`} title={`${r.race}: P${r.position}`}>
                  {Number.isNaN(pos) ? r.position : `P${pos}`}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FavDriver({ profile, standings, lastRace, onEdit }) {
  const followed = profile?.drivers || [];
  const teamId = profile?.teamId;

  const teamStanding = (standings?.constructors || []).find((c) => c.constructorId === teamId);
  const team = teamId ? teamByConstructorId(teamId) : null;
  const logo = teamId ? teamLogoUrl(teamId) : null;

  const cards = followed
    .map((id) => (standings?.drivers || []).find((d) => d.driverId === id))
    .filter(Boolean);

  if (!followed.length && !teamId) {
    return (
      <Panel kicker="§ 09 · GARAGE" title="Your Garage">
        <div className="rc-msg">
          Empty garage · no team, no drivers.{' '}
          <button className="btn-ghost" style={{ width: 'auto', display: 'inline-block', marginTop: 0, marginLeft: 8 }} onClick={onEdit}>
            build it →
          </button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel kicker="§ 09 · GARAGE" title="Your Garage" sub={`${teamStanding ? '1 team · ' : ''}${cards.length} driver${cards.length === 1 ? '' : 's'}`}>
      {teamStanding && team && (
        <div className="st-row teams" style={{ '--row-color': team.color, marginBottom: 16 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="team-logo" src={logo} alt={teamStanding.name} />
          ) : (
            <span className="team-logo-badge">{teamStanding.name?.[0]}</span>
          )}
          <span className="st-main">
            <span className="st-name" style={{ fontWeight: 700, textTransform: 'uppercase' }}>{teamStanding.name}</span>
            <span className="st-team">YOUR CONSTRUCTOR · P{teamStanding.position} WCC{teamStanding.wins > 0 ? ` · ${teamStanding.wins} WINS` : ''}</span>
          </span>
          <span className="st-pts">{teamStanding.points}<span className="pts-label">PTS</span></span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {cards.map((s) => <DriverCard key={s.driverId} standing={s} lastRace={lastRace} />)}
      </div>

      <button className="btn-ghost" onClick={onEdit}>⟡ Edit garage · team &amp; drivers</button>
    </Panel>
  );
}

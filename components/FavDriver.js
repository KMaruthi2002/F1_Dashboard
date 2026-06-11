'use client';

import { useEffect, useState } from 'react';
import Panel from './Panel';
import { teamByConstructorId } from '@/lib/teams';

export default function FavDriver({ profile, standings, lastRace, onEdit }) {
  const [career, setCareer] = useState(null);
  const driverId = profile?.driverId;

  const standing = (standings?.drivers || []).find((d) => d.driverId === driverId);

  useEffect(() => {
    if (!driverId) return;
    let alive = true;
    fetch(`/api/driver/${driverId}`)
      .then((r) => r.json())
      .then((d) => alive && !d.error && setCareer(d))
      .catch(() => {});
    return () => { alive = false; };
  }, [driverId]);

  if (!driverId) {
    return (
      <Panel kicker="§ 09 · PILOT" title="Your Driver">
        <div className="rc-msg">
          No driver locked in.{' '}
          <button className="btn-ghost" style={{ width: 'auto', display: 'inline-block', marginTop: 0, marginLeft: 8 }} onClick={onEdit}>
            choose one →
          </button>
        </div>
      </Panel>
    );
  }

  const team = standing ? teamByConstructorId(standing.constructorId) : null;
  const headshot = (lastRace?.openf1Drivers || []).find(
    (d) => standing && +d.number === +standing.number
  )?.headshot;

  return (
    <Panel kicker="§ 09 · PILOT" title="Your Driver" sub="career · form · numbers">
      <div className="fav-card" style={{ '--row-color': team?.color }}>
        {headshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="fav-portrait" src={headshot} alt={standing?.lastName || driverId} />
        ) : (
          <div className="fav-portrait" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontSize: 34, color: team?.color }}>
            {standing?.code || '—'}
          </div>
        )}
        <div>
          <div className="fav-name">
            {standing ? <>{standing.firstName} <em>{standing.lastName}</em></> : driverId}
          </div>
          <div className="fav-team">
            {standing ? `#${standing.number} · ${standing.constructorName} · ${standing.nationality}` : ''}
          </div>
          <div className="fav-stats">
            <div className="fav-stat"><div className="v">{standing ? `P${standing.position}` : '—'}</div><div className="l">Champ Pos</div></div>
            <div className="fav-stat"><div className="v">{standing?.points ?? '—'}</div><div className="l">Points</div></div>
            <div className="fav-stat"><div className="v">{career?.seasonPodiums ?? '—'}</div><div className="l">Podiums '26</div></div>
            <div className="fav-stat"><div className="v">{career?.careerWins ?? '—'}</div><div className="l">Career Wins</div></div>
            <div className="fav-stat"><div className="v">{career?.careerPoles ?? '—'}</div><div className="l">Career Poles</div></div>
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
    </Panel>
  );
}

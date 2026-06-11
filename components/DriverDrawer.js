'use client';

import { useEffect, useState } from 'react';
import { teamByConstructorId } from '@/lib/teams';

export default function DriverDrawer({ driver, lastRace, onClose, onFavourite, isFavourite }) {
  const [career, setCareer] = useState(null);

  useEffect(() => {
    setCareer(null);
    if (!driver?.driverId) return;
    let alive = true;
    fetch(`/api/driver/${driver.driverId}`)
      .then((r) => r.json())
      .then((d) => alive && !d.error && setCareer(d))
      .catch(() => {});
    return () => { alive = false; };
  }, [driver?.driverId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!driver) return null;
  const team = teamByConstructorId(driver.constructorId);
  const headshot = (lastRace?.openf1Drivers || []).find((d) => +d.number === +driver.number)?.headshot;
  const raceResult = (lastRace?.results || []).find((r) => r.driverId === driver.driverId);

  return (
    <>
      <div className="drawer-veil" onClick={onClose} />
      <aside className="drawer" style={{ '--row-color': team.color }}>
        <div className="drawer-top">
          <span className="drawer-num">{driver.number ? `#${driver.number}` : driver.code}</span>
          <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-name">{driver.firstName} <em>{driver.lastName}</em></div>
        <div className="drawer-sub">{driver.constructorName} · {driver.nationality}</div>

        {headshot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="drawer-portrait" src={headshot} alt={driver.lastName} />
        )}

        <div className="drawer-stats">
          <div className="fav-stat"><div className="v">P{driver.position}</div><div className="l">Champ Pos</div></div>
          <div className="fav-stat"><div className="v">{driver.points}</div><div className="l">Points</div></div>
          <div className="fav-stat"><div className="v">{driver.wins}</div><div className="l">Wins '26</div></div>
          <div className="fav-stat"><div className="v">{career?.seasonPodiums ?? '…'}</div><div className="l">Podiums '26</div></div>
          <div className="fav-stat"><div className="v">{career?.careerWins ?? '…'}</div><div className="l">Career Wins</div></div>
          <div className="fav-stat"><div className="v">{career?.careerPoles ?? '…'}</div><div className="l">Career Poles</div></div>
        </div>

        {career?.lastFive?.length > 0 && (
          <div className="drawer-sect">
            <h4>// Last 5 Rounds</h4>
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
          </div>
        )}

        {raceResult && (
          <div className="drawer-sect">
            <h4>// Last Race — {lastRace?.name}</h4>
            <div className="rc-msg" style={{ borderLeftColor: team.color }}>
              Finished <b style={{ color: 'var(--text)' }}>{raceResult.positionText}</b> from grid P{raceResult.grid || '—'}
              {raceResult.fastestLap?.rank === 1 ? ' · ◆ fastest lap' : ''} · {raceResult.time || raceResult.status}
            </div>
          </div>
        )}

        <button className="btn-primary drawer-fav-btn" onClick={() => onFavourite(driver.driverId)}>
          {isFavourite ? '★ Your Driver' : '☆ Make My Driver'}
        </button>
      </aside>
    </>
  );
}

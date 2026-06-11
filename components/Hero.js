'use client';

import { useEffect, useState } from 'react';
import Panel from './Panel';
import { flagFor } from '@/lib/teams';

function pad(n) {
  return String(Math.max(0, n)).padStart(2, '0');
}

function useCountdown(targetIso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - now;
  const d = Math.floor(diff / 86400e3);
  const h = Math.floor((diff % 86400e3) / 3600e3);
  const m = Math.floor((diff % 3600e3) / 60e3);
  const s = Math.floor((diff % 60e3) / 1000);
  return { diff, d, h, m, s };
}

function fmtSession(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SESSION_ORDER = [
  ['fp1', 'Practice 1'],
  ['fp2', 'Practice 2'],
  ['fp3', 'Practice 3'],
  ['sprintQualifying', 'Sprint Quali'],
  ['sprint', 'Sprint'],
  ['qualifying', 'Qualifying'],
  ['race', 'GRAND PRIX'],
];

export default function Hero({ nextRace, profile, season }) {
  const cd = useCountdown(nextRace?.race);
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Night shift';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  const sessions = nextRace
    ? SESSION_ORDER.map(([key, label]) => ({ key, label, time: nextRace[key] })).filter((s) => s.time)
    : [];
  const now = Date.now();
  const nextSessionKey = sessions.find((s) => new Date(s.time).getTime() > now)?.key;

  const seasonOver = !nextRace;

  return (
    <section className="hero fade-in">
      <Panel className="hero-main">
        <div className="hero-speedlines" />
        <div className="hero-greeting">
          {greeting}
          {profile?.name ? <>, <span className="name">{profile.name}</span></> : ''} · telemetry uplink active
        </div>
        {seasonOver ? (
          <>
            <div className="hero-round-badge">SEASON {season || ''} · COMPLETE</div>
            <h1 className="hero-title">Lights out.<br /><span className="thin">See you next season.</span></h1>
          </>
        ) : (
          <>
            <div className="hero-round-badge">
              ◆ ROUND {pad(nextRace.round)} · UP NEXT
            </div>
            <h1 className="hero-title">
              {flagFor(nextRace.country)} {nextRace.name?.replace(' Grand Prix', '')}
              <br />
              <span className="thin">Grand Prix</span>
            </h1>
            <div className="hero-meta">
              <span>CIRCUIT <b>{nextRace.circuit}</b></span>
              <span>LOC <b>{nextRace.locality}, {nextRace.country}</b></span>
              <span>LIGHTS OUT <b>{fmtSession(nextRace.race)}</b></span>
            </div>
            {cd && cd.diff > 0 && (
              <div className="countdown">
                <div className="cd-unit"><div className="cd-value">{pad(cd.d)}</div><div className="cd-label">Days</div></div>
                <div className="cd-unit"><div className="cd-value">{pad(cd.h)}</div><div className="cd-label">Hours</div></div>
                <div className="cd-unit"><div className="cd-value">{pad(cd.m)}</div><div className="cd-label">Mins</div></div>
                <div className="cd-unit"><div className="cd-value">{pad(cd.s)}</div><div className="cd-label">Secs</div></div>
              </div>
            )}
            {cd && cd.diff <= 0 && (
              <div className="countdown">
                <div className="cd-unit" style={{ maxWidth: 'none', flex: 1 }}>
                  <div className="cd-value" style={{ color: 'var(--red)', fontSize: 'clamp(20px,3vw,34px)' }}>
                    LIGHTS OUT &amp; AWAY WE GO
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Panel>

      <div className="hero-side">
        <Panel kicker="§ WKND" title="Session Schedule" sub="local time">
          {sessions.length === 0 ? (
            <div className="session-row"><span className="s-name">No sessions</span></div>
          ) : (
            <div className="session-list">
              {sessions.map((s) => {
                const past = new Date(s.time).getTime() < now;
                return (
                  <div key={s.key} className={`session-row ${s.key === nextSessionKey ? 'next' : ''} ${past ? 'past' : ''}`}>
                    <span className="s-name">{s.label}</span>
                    <span className="s-time">{fmtSession(s.time)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}

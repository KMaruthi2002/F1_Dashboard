'use client';

import { useEffect, useMemo, useState } from 'react';
import Panel from './Panel';
import { teamByConstructorId, teamLogoUrl, flagFor } from '@/lib/teams';

const fetchJson = (url) => fetch(url).then((r) => r.json()).catch(() => null);

export default function RacerProfile({ handle }) {
  const [data, setData] = useState(undefined); // undefined=loading, null=error
  const [standings, setStandings] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchJson(`/api/paddock?racer=${encodeURIComponent(handle)}`).then((d) => setData(d?.ok && d.profile ? d : null));
    fetchJson('/api/standings').then((d) => d && !d.error && setStandings(d));
    fetchJson('/api/schedule').then((d) => d && !d.error && setSchedule(d));
  }, [handle]);

  const racesByRound = useMemo(
    () => new Map((schedule?.races || []).map((r) => [+r.round, r])),
    [schedule]
  );

  const p = data?.profile;
  const team = p?.teamId ? teamByConstructorId(p.teamId) : null;
  const teamStanding = (standings?.constructors || []).find((c) => c.constructorId === p?.teamId);
  const logo = p?.teamId ? teamLogoUrl(p.teamId) : null;
  const followed = (p?.drivers || [])
    .map((id) => (standings?.drivers || []).find((d) => d.driverId === id))
    .filter(Boolean);
  const favCircuit = (schedule?.races || []).find((r) => r.circuitId === p?.circuitId);

  const accent = team?.color || (followed[0] ? teamByConstructorId(followed[0].constructorId).color : null);
  const accentStyle = accent ? { '--accent': accent, '--accent-glow': `color-mix(in srgb, ${accent} 35%, transparent)` } : {};

  const share = () => {
    const url = window.location.href;
    const text = `🏁 @${p.handle} · ${data.total} Paddock Points${data.rank ? ` · P${data.rank} on the global leaderboard` : ''} · APEX // TELEMETRY`;
    if (navigator.share) navigator.share({ title: `@${p.handle}`, text, url }).catch(() => {});
    else { navigator.clipboard?.writeText(`${text} ${url}`); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="shell" style={accentStyle}>
      <header className="statusbar">
        <span className="brand">APEX <em>//</em> RACER</span>
        <span className="status-pip"><span className="pip" />PUBLIC PROFILE</span>
        <span className="spacer" />
        <span style={{ color: 'var(--accent)' }}>@{handle?.toUpperCase()}</span>
      </header>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a className="back-link" href="/">‹ COMMAND DECK</a>
        <a className="back-link" href="/paddock">🏆 THE PADDOCK</a>
      </div>

      {data === undefined && <div className="section"><Panel><div className="rc-msg skel" style={{ height: 120 }} /></Panel></div>}

      {data === null && (
        <div className="section">
          <Panel kicker="§ 404" title="Racer Not Found">
            <div className="rc-msg">No garage registered under <b style={{ color: 'var(--text)' }}>@{handle}</b>. Maybe they&apos;re still on the formation lap.</div>
            <a className="btn-primary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} href="/paddock">⟶ Claim this Paddock ID</a>
          </Panel>
        </div>
      )}

      {p && (
        <>
          <div className="section fade-in">
            <Panel kicker="§ RACER" title={<span>@{p.handle}</span>} sub={`on the grid since ${new Date(p.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`}>
              <div className="id-strip" style={{ marginBottom: 18 }}>
                {p.number && <span className="me-plate">#{p.number}</span>}
                {p.name && <span><b>{p.name}</b></span>}
                {p.country && <span>{flagFor(p.country)} <b>{p.country}</b></span>}
                {p.fanSince && <span>FAN SINCE <b>{p.fanSince}</b></span>}
                {p.goat && <span>GOAT <b>{p.goat}</b></span>}
                {p.motto && <span style={{ color: 'var(--accent)' }}>“{p.motto}”</span>}
              </div>

              <div className="fav-stats" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="fav-stat"><div className="v" style={{ color: 'var(--amber)' }}>{data.total}</div><div className="l">Paddock Points</div></div>
                <div className="fav-stat"><div className="v">{data.rank ? `P${data.rank}` : '—'}</div><div className="l">of {data.racers} racers</div></div>
                <div className="fav-stat"><div className="v">{data.history.length}</div><div className="l">Rounds Scored</div></div>
                <div className="fav-stat"><div className="v">{data.pendingPicks}</div><div className="l">Picks Pending</div></div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button className="btn-primary" style={{ marginTop: 0, flex: 1, minWidth: 180 }} onClick={share}>
                  {copied ? '✓ Link copied' : '⤴ Share this racer'}
                </button>
                <a className="btn-ghost" style={{ marginTop: 0, width: 'auto', padding: '12px 22px', textDecoration: 'none', textAlign: 'center' }} href="/paddock">
                  ⚔ Challenge them
                </a>
              </div>
            </Panel>
          </div>

          <div className="grid-2 fade-in">
            <Panel kicker="§ GARAGE" title="Their Garage">
              {teamStanding && team && (
                <div className="st-row teams" style={{ '--row-color': team.color, marginBottom: 12 }}>
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="team-logo" src={logo} alt={teamStanding.name} />
                  ) : <span className="team-logo-badge">{teamStanding.name?.[0]}</span>}
                  <span className="st-main">
                    <span className="st-name" style={{ fontWeight: 700, textTransform: 'uppercase' }}>{teamStanding.name}</span>
                    <span className="st-team">SUPPORTED TEAM · P{teamStanding.position} WCC</span>
                  </span>
                  <span className="st-pts">{teamStanding.points}<span className="pts-label">PTS</span></span>
                </div>
              )}
              {followed.length > 0 ? (
                <div className="standings">
                  {followed.map((d) => {
                    const t = teamByConstructorId(d.constructorId);
                    return (
                      <div key={d.driverId} className="st-row teams" style={{ '--row-color': t.color }}>
                        <span className="pos-plate">{d.code}</span>
                        <span className="st-main">
                          <span className="st-name f1-name"><span className="fn">{d.firstName}</span> <span className="ln">{d.lastName}</span></span>
                          <span className="st-team">{d.constructorName} · P{d.position} WDC</span>
                        </span>
                        <span className="st-pts">{d.points}<span className="pts-label">PTS</span></span>
                      </div>
                    );
                  })}
                </div>
              ) : !teamStanding && <div className="rc-msg">A garage of mystery · no public allegiances.</div>}
              {favCircuit && (
                <div className="rc-msg" style={{ marginTop: 12, borderLeftColor: 'var(--accent)' }}>
                  ⟡ TEMPLE: <b style={{ color: 'var(--text)' }}>{flagFor(favCircuit.country)} {favCircuit.circuit}</b>
                </div>
              )}
            </Panel>

            <Panel kicker="§ SEASON" title="Prediction History" sub={`${data.total} PP total`}>
              {data.history.length === 0 ? (
                <div className="rc-msg">No settled rounds yet · their picks are still in parc fermé.</div>
              ) : (
                <div className="standings">
                  {data.history.sort((a, b) => b.round - a.round).map((h) => {
                    const race = racesByRound.get(h.round);
                    return (
                      <div key={h.round} className="st-row teams" style={{ '--row-color': h.points > 0 ? 'var(--green)' : 'var(--text-faint)' }}>
                        <span className="st-pos">R{String(h.round).padStart(2, '0')}</span>
                        <span className="st-main">
                          <span className="st-name">{race?.name || `Round ${h.round}`}</span>
                          <span className="st-team">{h.detail.join(' · ') || 'no hits'}</span>
                        </span>
                        <span className="st-pts">+{h.points}<span className="pts-label">PP</span></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      <footer className="footer">
        <span className="brand">APEX <em>//</em> TELEMETRY</span>
        <span>PUBLIC RACER PROFILE · THE PADDOCK</span>
        <span className="right">UNOFFICIAL FAN PROJECT</span>
      </footer>
    </div>
  );
}

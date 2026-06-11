'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Panel from './Panel';
import AccountModal from './AccountModal';
import { useAuth } from './AuthProvider';
import { teamByConstructorId, flagUrl, flagFor } from '@/lib/teams';

const fetchJson = (url) => fetch(url).then((r) => r.json()).catch(() => null);
const GUEST_KEY = 'apex.guestpicks.v1';

const SLOTS = [
  ['race1', '🏆 P1', 'Race Winner'],
  ['race2', '🥈 P2', 'Second'],
  ['race3', '🥉 P3', 'Third'],
];

function CarChip({ driver, team, onDragStart, onClick, selected, small, ghost }) {
  return (
    <div
      className={`car-chip ${selected ? 'sel' : ''} ${small ? 'small' : ''} ${ghost ? 'ghost' : ''}`}
      style={{ '--row-color': team.color }}
      draggable={!ghost}
      onDragStart={onDragStart}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={driver ? `${driver.firstName} ${driver.lastName} · ${team.name}` : ''}
    >
      <span className="car-nose" />
      <span className="car-code">{driver?.code || '?'}</span>
      <span className="car-wing" />
    </div>
  );
}

export default function Paddock() {
  const { ready, account, scored, needsBlob, savePrediction } = useAuth();
  const [standings, setStandings] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [picks, setPicks] = useState({ race: [null, null, null], pole: null, sprint: null });
  const [selectedChip, setSelectedChip] = useState(null);
  const [showAccount, setShowAccount] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [leaderboard, setLeaderboard] = useState(null);
  const [guestScore, setGuestScore] = useState(null);

  useEffect(() => {
    fetchJson('/api/standings').then((d) => d && !d.error && setStandings(d));
    fetchJson('/api/schedule').then((d) => d && !d.error && setSchedule(d));
    fetchJson('/api/paddock').then((d) => d?.ok && setLeaderboard(d.leaderboard));
  }, []);

  const drivers = standings?.drivers || [];
  const byId = useMemo(() => new Map(drivers.map((d) => [d.driverId, d])), [drivers]);

  const nextRace = useMemo(() => {
    const races = schedule?.races || [];
    const now = Date.now();
    return races.find((r) => new Date(r.race).getTime() > now) || null;
  }, [schedule]);
  const round = nextRace?.round;
  const hasSprint = !!nextRace?.sprint;

  const now = Date.now();
  const raceLocked = nextRace && new Date(nextRace.race).getTime() <= now;
  const poleLocked = nextRace?.qualifying && new Date(nextRace.qualifying).getTime() <= now;
  const sprintLocked = nextRace?.sprint && new Date(nextRace.sprint).getTime() <= now;

  // load existing picks: account → server prediction; guest → localStorage
  useEffect(() => {
    if (!round) return;
    if (account?.predictions?.[round]) {
      const p = account.predictions[round];
      setPicks({ race: p.race || [null, null, null], pole: p.pole || null, sprint: p.sprint || null });
    } else if (!account) {
      try {
        const g = JSON.parse(localStorage.getItem(GUEST_KEY) || '{}');
        if (g[round]) setPicks({ race: g[round].race || [null, null, null], pole: g[round].pole || null, sprint: g[round].sprint || null });
      } catch {}
    }
  }, [round, account]);

  // guest: score past local picks statelessly
  useEffect(() => {
    if (account) return;
    try {
      const g = JSON.parse(localStorage.getItem(GUEST_KEY) || '{}');
      if (Object.keys(g).length) {
        fetch('/api/paddock', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'score', predictions: g }),
        }).then((r) => r.json()).then((d) => d.ok && setGuestScore(d)).catch(() => {});
      }
    } catch {}
  }, [account]);

  const place = useCallback((slot, driverId) => {
    setSaveMsg(null);
    setPicks((prev) => {
      const next = { ...prev, race: [...prev.race] };
      if (slot.startsWith('race')) {
        const idx = +slot.slice(4) - 1;
        // a driver can hold only one podium slot
        next.race = next.race.map((d) => (d === driverId ? null : d));
        next.race[idx] = driverId;
      } else {
        next[slot] = driverId;
      }
      return next;
    });
    setSelectedChip(null);
  }, []);

  const clearSlot = (slot) => {
    setPicks((prev) => {
      const next = { ...prev, race: [...prev.race] };
      if (slot.startsWith('race')) next.race[+slot.slice(4) - 1] = null;
      else next[slot] = null;
      return next;
    });
  };

  const onDrop = (slot) => (e) => {
    e.preventDefault();
    const driverId = e.dataTransfer.getData('text/driver');
    if (driverId) place(slot, driverId);
  };

  const submit = async () => {
    if (!round) return;
    setBusy(true); setSaveMsg(null);
    const payload = { race: picks.race, pole: picks.pole };
    if (hasSprint) payload.sprint = picks.sprint;

    if (account) {
      const d = await savePrediction(round, payload);
      setSaveMsg(d.ok ? '✓ Picks locked into your garage' : `✗ ${d.error || 'Save failed'}`);
    } else {
      try {
        const g = JSON.parse(localStorage.getItem(GUEST_KEY) || '{}');
        g[round] = { ...payload, savedAt: new Date().toISOString() };
        localStorage.setItem(GUEST_KEY, JSON.stringify(g));
        setSaveMsg('✓ Saved on this device — create a Paddock ID to join the leaderboard');
      } catch { setSaveMsg('✗ Could not save'); }
    }
    setBusy(false);
  };

  const share = () => {
    const p1 = byId.get(picks.race[0])?.code || '—';
    const p2 = byId.get(picks.race[1])?.code || '—';
    const p3 = byId.get(picks.race[2])?.code || '—';
    const total = account ? (scored?.total ?? 0) : (guestScore?.total ?? 0);
    const text = `🏁 My ${nextRace?.name || 'F1'} call: P1 ${p1} · P2 ${p2} · P3 ${p3}${picks.pole ? ` · Pole ${byId.get(picks.pole)?.code}` : ''} — ${total} Paddock Points and counting. Make your call:`;
    const url = typeof window !== 'undefined' ? window.location.origin + '/paddock' : '';
    if (navigator.share) navigator.share({ title: 'APEX // PADDOCK', text, url }).catch(() => {});
    else {
      navigator.clipboard?.writeText(`${text} ${url}`);
      setSaveMsg('✓ Copied to clipboard — paste it anywhere');
    }
  };

  const myRounds = account ? scored?.rounds : guestScore?.rounds;
  const myTotal = account ? scored?.total ?? 0 : guestScore?.total ?? 0;
  const racesByRound = useMemo(() => new Map((schedule?.races || []).map((r) => [String(r.round), r])), [schedule]);

  const renderSlot = (slotKey, label, sub, value, locked) => {
    const d = value ? byId.get(value) : null;
    const team = d ? teamByConstructorId(d.constructorId) : null;
    return (
      <div
        key={slotKey}
        className={`pod-slot ${d ? 'filled' : ''} ${locked ? 'locked' : ''} ${selectedChip && !locked ? 'ready' : ''}`}
        onDragOver={(e) => !locked && e.preventDefault()}
        onDrop={!locked ? onDrop(slotKey) : undefined}
        onClick={() => {
          if (locked) return;
          if (selectedChip) place(slotKey, selectedChip);
          else if (d) clearSlot(slotKey);
        }}
        style={team ? { '--row-color': team.color } : undefined}
      >
        <span className="ps-label">{label}</span>
        {d ? (
          <>
            <CarChip driver={d} team={team} small ghost />
            <span className="ps-driver">{d.lastName}</span>
          </>
        ) : (
          <span className="ps-hint">{locked ? '🔒 locked' : 'drag a car here'}</span>
        )}
        <span className="ps-sub">{sub}</span>
      </div>
    );
  };

  return (
    <div className="shell">
      <header className="statusbar">
        <span className="brand">APEX <em>//</em> PADDOCK</span>
        <span className="status-pip"><span className="pip" />PREDICTIONS OPEN</span>
        <span className="spacer" />
        <button onClick={() => setShowAccount(true)}>
          {account ? `⟡ ${account.handle} · ${myTotal} PP` : '⟡ Sign in'}
        </button>
      </header>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <a className="back-link" href="/">‹ COMMAND DECK</a>
        <a className="back-link" href="/live">◉ RACE CENTER</a>
        <a className="back-link" href="/replay">⟲ REPLAY</a>
      </div>

      {needsBlob && (
        <div className="rc-msg" style={{ borderLeftColor: 'var(--amber)', marginTop: 16 }}>
          ⚠ Guest mode — picks save on this device only. Add a <b>Vercel Blob</b> store (BLOB_READ_WRITE_TOKEN) to unlock global accounts and the leaderboard.
        </div>
      )}

      <div className="rc-layout">
        <div className="rc-col">
          <Panel
            kicker="§ CALL IT"
            title={nextRace ? `RD ${String(round).padStart(2, '0')} · ${nextRace.name}` : 'Next Round'}
            sub={nextRace ? `${flagFor(nextRace.country)} picks lock at lights out` : '…'}
          >
            {/* podium slots */}
            <div className="pod-slots">
              {renderSlot('race1', '🏆 P1', 'exact +25 · podium +10', picks.race[0], raceLocked)}
              {renderSlot('race2', '🥈 P2', 'exact +18 · podium +10', picks.race[1], raceLocked)}
              {renderSlot('race3', '🥉 P3', 'exact +15 · podium +10', picks.race[2], raceLocked)}
            </div>
            <div className="pod-slots minor">
              {renderSlot('pole', '◆ POLE', '+10', picks.pole, poleLocked)}
              {hasSprint && renderSlot('sprint', '⚡ SPRINT WIN', '+15', picks.sprint, sprintLocked)}
            </div>

            {/* the garage */}
            <div className="garage-head">
              <span className="panel-kicker">§ THE GARAGE</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-dim)', letterSpacing: '0.14em' }}>
                DRAG A CAR · OR TAP CAR THEN SLOT
              </span>
            </div>
            <div className="garage">
              {drivers.length === 0
                ? [...Array(10)].map((_, i) => <div key={i} className="car-chip skel" />)
                : drivers.map((d) => {
                    const team = teamByConstructorId(d.constructorId);
                    const used = picks.race.includes(d.driverId);
                    return (
                      <div key={d.driverId} className={used ? 'chip-used' : ''}>
                        <CarChip
                          driver={d}
                          team={team}
                          selected={selectedChip === d.driverId}
                          onDragStart={(e) => e.dataTransfer.setData('text/driver', d.driverId)}
                          onClick={() => setSelectedChip(selectedChip === d.driverId ? null : d.driverId)}
                        />
                      </div>
                    );
                  })}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ marginTop: 0, flex: 1, minWidth: 200 }} disabled={busy || raceLocked || !picks.race[0]} onClick={submit}>
                {busy ? 'Locking in…' : raceLocked ? '🔒 Lights out — locked' : '⟶ Lock in my picks'}
              </button>
              <button className="btn-ghost" style={{ marginTop: 0, width: 'auto', padding: '10px 20px' }} onClick={share}>
                ⤴ Share my call
              </button>
            </div>
            {saveMsg && <div className="rc-msg" style={{ marginTop: 12, borderLeftColor: saveMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{saveMsg}</div>}
            {!account && ready && (
              <button className="btn-ghost" onClick={() => setShowAccount(true)}>
                ⟡ Create a Paddock ID — sync picks + join the global leaderboard
              </button>
            )}
          </Panel>

          {/* my season */}
          <Panel kicker="§ GARAGE" title="My Season" sub={`${myTotal} Paddock Points`}>
            {!myRounds || Object.keys(myRounds).length === 0 ? (
              <div className="rc-msg">No settled rounds yet — points land when the FIA classification is in.</div>
            ) : (
              <div className="standings">
                {Object.entries(myRounds).sort((a, b) => +b[0] - +a[0]).map(([r, s]) => {
                  const race = racesByRound.get(String(r));
                  return (
                    <div key={r} className="st-row teams" style={{ '--row-color': s.settled ? (s.points > 0 ? 'var(--green)' : 'var(--text-faint)') : 'var(--amber)' }}>
                      <span className="st-pos">R{String(r).padStart(2, '0')}</span>
                      <span className="st-main">
                        <span className="st-name">{race?.name || `Round ${r}`}</span>
                        <span className="st-team">{s.settled ? (s.detail.join(' · ') || 'no hits') : 'awaiting result'}</span>
                      </span>
                      <span className="st-pts">{s.settled ? `+${s.points}` : '…'}<span className="pts-label">PP</span></span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        <div className="rc-col">
          <Panel kicker="§ GLOBAL" title="Paddock Leaderboard" sub={leaderboard ? `${leaderboard.length} racers` : '…'}>
            {!leaderboard || leaderboard.length === 0 ? (
              <div className="rc-msg">
                {needsBlob ? 'Leaderboard goes live once Blob storage is connected.' : 'Empty grid — be the first to lock in picks.'}
              </div>
            ) : (
              <div className="standings">
                {leaderboard.map((u, i) => {
                  const team = u.driverId && standings ? teamByConstructorId(drivers.find((d) => d.driverId === u.driverId)?.constructorId) : null;
                  return (
                    <div key={u.handle} className="st-row teams" style={{ '--row-color': team?.color || 'var(--cyan)' }}>
                      <span className={`pos-plate ${i === 0 ? 'gold' : ''}`}>{i + 1}</span>
                      <span className="st-main">
                        <span className="st-name">@{u.handle}</span>
                        <span className="st-team">{u.name}</span>
                      </span>
                      <span className="st-pts">{u.total}<span className="pts-label">PP</span></span>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel kicker="§ RULES" title="How Points Work">
            <div className="rc-feed" style={{ marginTop: 0 }}>
              <div className="rc-msg">🏆 Exact podium call — <b>P1 +25 · P2 +18 · P3 +15</b></div>
              <div className="rc-msg">🎯 Right driver, wrong step — <b>+10</b></div>
              <div className="rc-msg">◆ Pole sitter — <b>+10</b> (locks at quali)</div>
              <div className="rc-msg">⚡ Sprint winner — <b>+15</b> (sprint weekends)</div>
              <div className="rc-msg">🔒 Race picks lock at lights out. Scored automatically against the FIA classification.</div>
            </div>
          </Panel>
        </div>
      </div>

      <footer className="footer">
        <span className="brand">APEX <em>//</em> TELEMETRY</span>
        <span>THE PADDOCK · PREDICT · SCORE · SHARE</span>
        <span className="right">UNOFFICIAL FAN PROJECT</span>
      </footer>

      {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
    </div>
  );
}

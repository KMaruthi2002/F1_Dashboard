'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import GarageSetup from './GarageSetup';
import LandingFX from './LandingFX';
import { teamByConstructorId, flagFor } from '@/lib/teams';

const GUEST_KEY = 'apex.guest.v1';

const TAGLINES = [
  'LIVE GPS TELEMETRY · 3 SECONDS BEHIND THE CARS',
  'REPLAY ANY RACE · EVERY LINE · 60FPS',
  'CALL THE PODIUM · EARN PADDOCK POINTS',
  'YOUR TEAM · YOUR DRIVERS · YOUR COLORS',
  'LIGHTS OUT AND AWAY WE GO',
];

function useTypewriter(phrases) {
  const [text, setText] = useState('');
  useEffect(() => {
    let i = 0, char = 0, deleting = false, t;
    const tick = () => {
      const target = phrases[i % phrases.length];
      if (!deleting) {
        char++;
        setText(target.slice(0, char));
        if (char >= target.length) { deleting = true; t = setTimeout(tick, 2200); return; }
        t = setTimeout(tick, 38 + Math.random() * 40);
      } else {
        char -= 3;
        setText(target.slice(0, Math.max(0, char)));
        if (char <= 0) { deleting = false; i++; t = setTimeout(tick, 300); return; }
        t = setTimeout(tick, 16);
      }
    };
    t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, [phrases]);
  return text;
}

function useCountdown(targetIso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!targetIso) return null;
  const diff = new Date(targetIso).getTime() - now;
  if (diff <= 0) return { live: true };
  const d = Math.floor(diff / 86400e3);
  const h = Math.floor((diff % 86400e3) / 3600e3);
  const m = Math.floor((diff % 3600e3) / 60e3);
  const s = Math.floor((diff % 60e3) / 1000);
  return { d, h, m, s };
}

const FEATURES = [
  ['📡', 'Live Center', 'Real GPS track map · gaps · tires · onboard telemetry'],
  ['⟲', 'Race Replay', 'Scrub the whole race · 60fps · incident alerts'],
  ['🏆', 'The Paddock', 'Drag your podium call · climb the global leaderboard'],
  ['⟡', 'Your Garage', 'A team + 3 drivers · the whole HUD wears your colors'],
];

export default function Gate({ children }) {
  const pathname = usePathname();
  const { ready, account, needsBlob, register, login, updateProfile } = useAuth();
  const [guest, setGuest] = useState(false);
  const [guestLoaded, setGuestLoaded] = useState(false);
  const [tab, setTab] = useState('create');
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [newCode, setNewCode] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const [standings, setStandings] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const gridRef = useRef(null);
  const tagline = useTypewriter(TAGLINES);

  useEffect(() => {
    try { setGuest(localStorage.getItem(GUEST_KEY) === '1'); } catch {}
    setGuestLoaded(true);
    fetch('/api/standings').then((r) => r.json()).then((d) => !d.error && setStandings(d)).catch(() => {});
    fetch('/api/schedule').then((r) => r.json()).then((d) => !d.error && setSchedule(d)).catch(() => {});
  }, []);

  const nextRace = (schedule?.races || []).find((r) => new Date(r.race).getTime() > Date.now()) || null;
  const cd = useCountdown(nextRace?.race);

  // parallax tilt
  const onMove = (e) => {
    const el = gridRef.current;
    if (!el || window.matchMedia('(pointer: coarse)').matches) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };

  const doRegister = async () => {
    setBusy(true); setMsg(null);
    const d = await register(handle.trim(), name.trim());
    setBusy(false);
    if (d.ok) setNewCode(d.code);
    else setMsg(d.error || (d.needsBlob ? 'Cloud accounts are warming up · continue as guest below.' : 'Failed'));
  };

  const doLogin = async () => {
    setBusy(true); setMsg(null);
    const d = await login(handle.trim(), code.trim().toUpperCase());
    setBusy(false);
    if (!d.ok) setMsg(d.error || (d.needsBlob ? 'Cloud accounts are warming up · continue as guest below.' : 'Failed'));
  };

  const enterAsGuest = () => {
    try { localStorage.setItem(GUEST_KEY, '1'); } catch {}
    setGuest(true);
  };

  // start lights: fill as the form gets ready
  const lights = tab === 'create'
    ? Math.min(5, Math.floor(handle.trim().length / 2) + (handle.trim().length >= 3 ? 2 : 0))
    : Math.min(5, (handle.trim().length >= 3 ? 2 : Math.floor(handle.trim().length)) + Math.min(3, Math.floor(code.trim().length / 3)));
  const armed = tab === 'create' ? handle.trim().length >= 3 : handle.trim().length >= 3 && code.trim().length >= 6;

  // public, shareable routes skip the gate entirely
  if (pathname?.startsWith('/racer')) return children;

  if (!ready || !guestLoaded) {
    return (
      <div className="boot">
        <div className="boot-logo">APEX <em>//</em> TELEMETRY</div>
        <div className="boot-log">▮ CHECKING CREDENTIALS…</div>
      </div>
    );
  }

  // fresh account → full-screen garage build; sign-in skips straight to the app
  if (account && customizing) {
    return (
      <GarageSetup
        handle={account.handle}
        drivers={standings?.drivers || []}
        constructors={standings?.constructors || []}
        circuits={schedule?.races || []}
        initial={account}
        busy={busy}
        onDone={async (p) => { setBusy(true); await updateProfile(p); setBusy(false); setCustomizing(false); }}
      />
    );
  }

  if (account || guest) return children;

  if (newCode) {
    return (
      <div className="landing">
        <LandingFX />
        <div className="landing-panel fade-in" style={{ maxWidth: 560, position: 'relative', zIndex: 2 }}>
          <span className="step-tag" style={{ color: 'var(--green)' }}>✓ GARAGE BUILT</span>
          <h2 className="landing-h2">Save your garage code</h2>
          <p className="landing-p">This is your password · shown <b style={{ color: 'var(--red)' }}>once, ever</b>. Screenshot it.</p>
          <div className="garage-code">{newCode}</div>
          <button className="btn-ghost" onClick={() => { navigator.clipboard?.writeText(newCode); setMsg('Copied!'); }}>⧉ Copy code</button>
          {msg && <p style={{ color: 'var(--green)', marginTop: 8 }}>{msg}</p>}
          <button className="btn-primary" onClick={() => { setNewCode(null); setCustomizing(true); }}>
            I saved it · customise my garage ›
          </button>
        </div>
      </div>
    );
  }

  const top5 = (standings?.drivers || []).slice(0, 5);

  return (
    <div className="landing" onMouseMove={onMove}>
      <LandingFX />
      <div className="landing-grid tilt" ref={gridRef}>
        <div className="landing-hero">
          {nextRace && (
            <div className="landing-next">
              <span className="ln-flag">{flagFor(nextRace.country)}</span>
              <span className="ln-name">RD {String(nextRace.round).padStart(2, '0')} · {nextRace.name?.toUpperCase()}</span>
              <span className="ln-cd">
                {cd?.live ? '◉ RACE WEEKEND LIVE' : cd ? `T–${cd.d}d ${String(cd.h).padStart(2, '0')}h ${String(cd.m).padStart(2, '0')}m ${String(cd.s).padStart(2, '0')}s` : '…'}
              </span>
            </div>
          )}
          <h1 className="landing-title" data-text="APEX // TELEMETRY">
            APEX <em>//</em> TELEMETRY
          </h1>
          <p className="landing-type">{tagline}<span className="caret">▮</span></p>

          <div className="landing-feats">
            {FEATURES.map(([icon, title, desc], i) => (
              <div key={title} className="lf" style={{ animationDelay: `${0.15 * i + 0.3}s` }}>
                <span className="lf-i">{icon}</span>
                <b>{title}</b>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-panel">
          <span className="step-tag">⟡ PADDOCK ID · ONE LOGIN FOR EVERYTHING</span>
          <div className="acct-tabs">
            <button className={`tt-btn ${tab === 'create' ? 'on' : ''}`} onClick={() => setTab('create')}>Create ID</button>
            <button className={`tt-btn ${tab === 'login' ? 'on' : ''}`} onClick={() => setTab('login')}>Sign in</button>
          </div>

          {tab === 'create' ? (
            <>
              <h2 className="landing-h2">Build your garage</h2>
              <p className="landing-p">Pick an ID, get a garage code, choose your team and drivers. Then the pit lane opens.</p>
              <input type="text" placeholder="PADDOCK ID (3–16 chars)" value={handle} maxLength={16}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} />
              <div style={{ height: 10 }} />
              <input type="text" placeholder="DISPLAY NAME (optional)" value={name} maxLength={24}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && armed && doRegister()} />
            </>
          ) : (
            <>
              <h2 className="landing-h2">Welcome back</h2>
              <p className="landing-p">Your picks, points, team and drivers · synced everywhere.</p>
              <input type="text" placeholder="PADDOCK ID" value={handle} maxLength={16}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} />
              <div style={{ height: 10 }} />
              <input type="text" placeholder="GARAGE CODE" value={code} maxLength={8}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
            </>
          )}

          {/* start lights: fill as you type, green when armed */}
          <div className="gate-lights" aria-hidden="true">
            {[...Array(5)].map((_, i) => (
              <span key={i} className={`gl ${armed ? 'green' : i < lights ? 'on' : ''}`} />
            ))}
          </div>

          <button
            className="btn-primary" style={{ marginTop: 10 }}
            disabled={busy || !armed}
            onClick={tab === 'create' ? doRegister : doLogin}
          >
            {busy ? 'On the formation lap…' : armed ? (tab === 'create' ? '🏁 LIGHTS OUT · CREATE MY ID' : '🏁 LIGHTS OUT · SIGN IN') : 'Fill the grid above…'}
          </button>

          {msg && <p style={{ color: 'var(--red)', marginTop: 12, fontSize: 14 }}>{msg}</p>}
          {needsBlob && (
            <div className="rc-msg" style={{ borderLeftColor: 'var(--amber)', marginTop: 14 }}>
              Cloud accounts need the Vercel Blob store + a redeploy.
            </div>
          )}
          <button className="landing-guest" onClick={enterAsGuest}>explore as guest · no account, local picks only ›</button>
        </div>
      </div>

      {/* standings marquee */}
      {top5.length > 0 && (
        <div className="ticker landing-ticker">
          <div className="ticker-inner">
            {[0, 1].map((k) => (
              <span key={k}>
                {top5.map((d) => {
                  const team = teamByConstructorId(d.constructorId);
                  return (
                    <span key={`${k}-${d.driverId}`}>
                      P{d.position} <b style={{ color: team.color }}>{d.code}</b> {d.points} PTS
                    </span>
                  );
                })}
                <span className="rd">◆ {schedule?.season || ''} WORLD CHAMPIONSHIP</span>
                <span className="hl">JOIN THE GRID · CREATE YOUR PADDOCK ID</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="landing-foot">UNOFFICIAL FAN PROJECT · NOT AFFILIATED WITH F1, FIA OR FOM · DATA: JOLPICA + OPENF1</div>
    </div>
  );
}

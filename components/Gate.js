'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import ProfileModal from './ProfileModal';

const GUEST_KEY = 'apex.guest.v1';

export default function Gate({ children }) {
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

  useEffect(() => {
    try { setGuest(localStorage.getItem(GUEST_KEY) === '1'); } catch {}
    setGuestLoaded(true);
    fetch('/api/standings').then((r) => r.json()).then((d) => !d.error && setStandings(d)).catch(() => {});
  }, []);

  const doRegister = async () => {
    setBusy(true); setMsg(null);
    const d = await register(handle.trim(), name.trim());
    setBusy(false);
    if (d.ok) setNewCode(d.code);
    else setMsg(d.error || (d.needsBlob ? 'Cloud accounts are warming up — continue as guest below.' : 'Failed'));
  };

  const doLogin = async () => {
    setBusy(true); setMsg(null);
    const d = await login(handle.trim(), code.trim().toUpperCase());
    setBusy(false);
    if (!d.ok) setMsg(d.error || (d.needsBlob ? 'Cloud accounts are warming up — continue as guest below.' : 'Failed'));
  };

  const enterAsGuest = () => {
    try { localStorage.setItem(GUEST_KEY, '1'); } catch {}
    setGuest(true);
  };

  if (!ready || !guestLoaded) {
    return (
      <div className="boot">
        <div className="boot-logo">APEX <em>//</em> TELEMETRY</div>
        <div className="boot-log">▮ CHECKING CREDENTIALS…</div>
      </div>
    );
  }

  // signed in but mid-customization (fresh account)
  if (account && customizing) {
    return (
      <ProfileModal
        drivers={standings?.drivers || []}
        constructors={standings?.constructors || []}
        initial={{ name: account.name, teamId: account.teamId, drivers: account.drivers }}
        onSave={async (p) => { await updateProfile(p); setCustomizing(false); }}
        onClose={() => setCustomizing(false)}
      />
    );
  }

  if (account || guest) return children;

  // garage code reveal → then customization
  if (newCode) {
    return (
      <div className="landing">
        <div className="landing-panel" style={{ maxWidth: 560 }}>
          <span className="step-tag" style={{ color: 'var(--green)' }}>✓ GARAGE BUILT</span>
          <h2 className="landing-h2">Save your garage code</h2>
          <p className="landing-p">This is your password — shown <b style={{ color: 'var(--red)' }}>once, ever</b>. Screenshot it.</p>
          <div className="garage-code">{newCode}</div>
          <button className="btn-ghost" onClick={() => { navigator.clipboard?.writeText(newCode); setMsg('Copied!'); }}>⧉ Copy code</button>
          {msg && <p style={{ color: 'var(--green)', marginTop: 8 }}>{msg}</p>}
          <button className="btn-primary" onClick={() => { setNewCode(null); setCustomizing(true); }}>
            I saved it — customise my garage ›
          </button>
        </div>
      </div>
    );
  }

  // ── the landing page ──
  return (
    <div className="landing">
      <div className="landing-grid">
        <div className="landing-hero">
          <div className="boot-logo" style={{ animation: 'none', fontSize: 'clamp(28px, 4vw, 46px)', textAlign: 'left' }}>
            APEX <em>//</em> TELEMETRY
          </div>
          <p className="landing-tag">THE F1 COMMAND CENTER · LIVE TIMING · RACE REPLAY · PREDICTIONS</p>
          <div className="landing-feats">
            <div className="lf"><span className="lf-i">📡</span><b>Live Center</b><span>Real GPS track map, gaps, tires, onboard telemetry — every session</span></div>
            <div className="lf"><span className="lf-i">⟲</span><b>Race Replay</b><span>Scrub the whole race at 60fps, incident alerts with official footage</span></div>
            <div className="lf"><span className="lf-i">🏆</span><b>The Paddock</b><span>Drag your podium call, earn Paddock Points, climb the global leaderboard</span></div>
            <div className="lf"><span className="lf-i">⟡</span><b>Your Garage</b><span>Support a team + up to 3 drivers — the whole HUD wears your colors</span></div>
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
              <p className="landing-p">Pick an ID, get a garage code, choose your team and drivers — then the pit lane opens.</p>
              <input type="text" placeholder="PADDOCK ID (3–16 chars)" value={handle} maxLength={16}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} />
              <div style={{ height: 10 }} />
              <input type="text" placeholder="DISPLAY NAME (optional)" value={name} maxLength={24}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handle.trim().length >= 3 && doRegister()} />
              <button className="btn-primary" disabled={busy || handle.trim().length < 3} onClick={doRegister}>
                {busy ? 'Building garage…' : '⟶ Create my Paddock ID'}
              </button>
            </>
          ) : (
            <>
              <h2 className="landing-h2">Welcome back</h2>
              <p className="landing-p">Your picks, points, team and drivers — synced everywhere.</p>
              <input type="text" placeholder="PADDOCK ID" value={handle} maxLength={16}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} />
              <div style={{ height: 10 }} />
              <input type="text" placeholder="GARAGE CODE" value={code} maxLength={8}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
              <button className="btn-primary" disabled={busy || !handle || !code} onClick={doLogin}>
                {busy ? 'Checking…' : '⟶ Open the garage'}
              </button>
            </>
          )}
          {msg && <p style={{ color: 'var(--red)', marginTop: 12, fontSize: 14 }}>{msg}</p>}
          {needsBlob && (
            <div className="rc-msg" style={{ borderLeftColor: 'var(--amber)', marginTop: 14 }}>
              Cloud accounts need the Vercel Blob store + a redeploy.
            </div>
          )}
          <button className="landing-guest" onClick={enterAsGuest}>explore as guest — no account, local picks only ›</button>
        </div>
      </div>
      <div className="landing-foot">UNOFFICIAL FAN PROJECT · NOT AFFILIATED WITH F1, FIA OR FOM · DATA: JOLPICA + OPENF1</div>
    </div>
  );
}

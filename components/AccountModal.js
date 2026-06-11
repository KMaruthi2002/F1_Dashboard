'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';

export default function AccountModal({ onClose, onEditProfile }) {
  const { account, scored, needsBlob, register, login, logout } = useAuth();
  const [tab, setTab] = useState('login');
  const [handle, setHandle] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [newCode, setNewCode] = useState(null);

  const doRegister = async () => {
    setBusy(true); setMsg(null);
    const d = await register(handle.trim(), name.trim());
    setBusy(false);
    if (d.ok) setNewCode(d.code);
    else setMsg(d.error || (d.needsBlob ? 'Cloud accounts not configured yet (Vercel Blob).' : 'Failed'));
  };

  const doLogin = async () => {
    setBusy(true); setMsg(null);
    const d = await login(handle.trim(), code.trim().toUpperCase());
    setBusy(false);
    if (!d.ok) setMsg(d.error || (d.needsBlob ? 'Cloud accounts not configured yet (Vercel Blob).' : 'Failed'));
  };

  // ── signed in view ──
  if (account) {
    return (
      <div className="modal-veil" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <span className="step-tag">⟡ PADDOCK ID</span>
          <h2>@{account.handle}{account.number ? <span style={{ color: 'var(--accent)' }}> #{account.number}</span> : ''}</h2>
          {account.motto && <p style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>“{account.motto}”</p>}
          <p>
            {account.name ? `${account.name} · ` : ''}
            {account.country ? `${account.country} · ` : ''}
            {account.fanSince ? `fan since ${account.fanSince} · ` : ''}
            {account.goat ? `GOAT: ${account.goat} · ` : ''}
            signed in everywhere · picks, points, team and drivers follow this ID.
          </p>
          <div className="fav-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            <div className="fav-stat"><div className="v" style={{ color: 'var(--amber)' }}>{scored?.total ?? 0}</div><div className="l">Paddock Points</div></div>
            <div className="fav-stat"><div className="v">{Object.keys(account.predictions || {}).length}</div><div className="l">Rounds Predicted</div></div>
            <div className="fav-stat"><div className="v">{account.drivers?.length || 0}</div><div className="l">Drivers Followed</div></div>
            <div className="fav-stat"><div className="v">{account.teamId ? '✓' : '—'}</div><div className="l">Team Supported</div></div>
          </div>
          <button className="btn-primary" onClick={() => { onClose(); onEditProfile?.(); }}>⟡ Edit garage · name, team &amp; drivers</button>
          <a className="btn-ghost" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }} href="/paddock">⟶ Go to the Paddock</a>
          <button className="btn-ghost" onClick={() => { logout(); onClose(); }}>Sign out</button>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // ── new garage code reveal ──
  if (newCode) {
    return (
      <div className="modal-veil">
        <div className="modal">
          <span className="step-tag" style={{ color: 'var(--green)' }}>✓ GARAGE BUILT</span>
          <h2>Save your garage code</h2>
          <p>This is your password · it&apos;s shown <b style={{ color: 'var(--red)' }}>once</b>. Screenshot it or write it down.</p>
          <div className="garage-code">{newCode}</div>
          <button
            className="btn-ghost"
            onClick={() => { navigator.clipboard?.writeText(newCode); setMsg('Copied!'); }}
          >⧉ Copy code</button>
          {msg && <p style={{ color: 'var(--green)', marginTop: 8 }}>{msg}</p>}
          <button className="btn-primary" onClick={onClose}>I saved it · let&apos;s race ›</button>
        </div>
      </div>
    );
  }

  // ── signed out: login / register ──
  return (
    <div className="modal-veil" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <span className="step-tag">⟡ PADDOCK ID · GLOBAL SIGN-IN</span>
        <div className="acct-tabs">
          <button className={`tt-btn ${tab === 'login' ? 'on' : ''}`} onClick={() => setTab('login')}>Sign in</button>
          <button className={`tt-btn ${tab === 'register' ? 'on' : ''}`} onClick={() => setTab('register')}>Create ID</button>
        </div>

        {needsBlob && (
          <div className="rc-msg" style={{ borderLeftColor: 'var(--amber)', marginBottom: 14 }}>
            Cloud accounts need Vercel Blob · add a Blob store to the project and set BLOB_READ_WRITE_TOKEN. Until then the app runs in guest mode.
          </div>
        )}

        {tab === 'register' ? (
          <>
            <h2>Create your Paddock ID</h2>
            <p>One ID for everything · predictions, Paddock Points, your driver. You&apos;ll get a garage code as your password.</p>
            <input type="text" placeholder="PADDOCK ID (3–16 chars)" value={handle} maxLength={16}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} />
            <div style={{ height: 10 }} />
            <input type="text" placeholder="DISPLAY NAME (optional)" value={name} maxLength={24}
              onChange={(e) => setName(e.target.value)} />
            <button className="btn-primary" disabled={busy || handle.trim().length < 3} onClick={doRegister}>
              {busy ? 'Building garage…' : 'Create ID ›'}
            </button>
          </>
        ) : (
          <>
            <h2>Sign in</h2>
            <p>Your picks and points sync everywhere you sign in.</p>
            <input type="text" placeholder="PADDOCK ID" value={handle} maxLength={16}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} />
            <div style={{ height: 10 }} />
            <input type="text" placeholder="GARAGE CODE" value={code} maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
            <button className="btn-primary" disabled={busy || !handle || !code} onClick={doLogin}>
              {busy ? 'Checking…' : 'Sign in ›'}
            </button>
          </>
        )}
        {msg && <p style={{ color: 'var(--red)', marginTop: 12 }}>{msg}</p>}
        <button className="btn-ghost" onClick={onClose}>Not now</button>
      </div>
    </div>
  );
}

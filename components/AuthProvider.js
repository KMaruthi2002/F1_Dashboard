'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

const LS_KEY = 'apex.account.v1';
const AuthCtx = createContext(null);

export function useAuth() {
  return useContext(AuthCtx);
}

async function api(payload) {
  const res = await fetch('/api/paddock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json().catch(() => ({ ok: false, error: 'network' }));
}

export default function AuthProvider({ children }) {
  const [creds, setCreds] = useState(null);      // {handle, code}
  const [profile, setProfile] = useState(null);  // server profile
  const [scored, setScored] = useState(null);    // {rounds, total}
  const [needsBlob, setNeedsBlob] = useState(false);
  const [ready, setReady] = useState(false);

  // restore session
  useEffect(() => {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch {}
    if (!stored?.handle) { setReady(true); return; }
    setCreds(stored);
    api({ action: 'me', ...stored }).then((d) => {
      if (d.ok) { setProfile(d.profile); setScored(d.scored); }
      else if (d.needsBlob) setNeedsBlob(true);
      else { localStorage.removeItem(LS_KEY); setCreds(null); }
      setReady(true);
    });
  }, []);

  const persist = (c) => { try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch {} };

  const register = useCallback(async (handle, name, driverId) => {
    const d = await api({ action: 'register', handle, name, driverId });
    if (d.needsBlob) { setNeedsBlob(true); return d; }
    if (d.ok) {
      const c = { handle, code: d.code };
      setCreds(c); persist(c);
      setProfile(d.profile); setScored({ rounds: {}, total: 0 });
    }
    return d;
  }, []);

  const login = useCallback(async (handle, code) => {
    const d = await api({ action: 'login', handle, code });
    if (d.needsBlob) { setNeedsBlob(true); return d; }
    if (d.ok) {
      const c = { handle, code };
      setCreds(c); persist(c);
      setProfile(d.profile); setScored(d.scored);
    }
    return d;
  }, []);

  const logout = useCallback(() => {
    setCreds(null); setProfile(null); setScored(null);
    try { localStorage.removeItem(LS_KEY); } catch {}
  }, []);

  const updateProfile = useCallback(async ({ name, driverId }) => {
    if (!creds) return { ok: false };
    const d = await api({ action: 'profile', ...creds, name, driverId });
    if (d.ok) setProfile(d.profile);
    return d;
  }, [creds]);

  const savePrediction = useCallback(async (round, picks) => {
    if (!creds) return { ok: false, error: 'not signed in' };
    const d = await api({ action: 'predict', ...creds, round, ...picks });
    if (d.ok) { setProfile(d.profile); setScored(d.scored); }
    return d;
  }, [creds]);

  const refresh = useCallback(async () => {
    if (!creds) return;
    const d = await api({ action: 'me', ...creds });
    if (d.ok) { setProfile(d.profile); setScored(d.scored); }
  }, [creds]);

  const value = {
    ready,
    account: profile,         // null when signed out
    creds,
    scored,                   // {rounds: {round: {points, settled, detail}}, total}
    needsBlob,                // true → Blob store not configured yet
    register, login, logout, updateProfile, savePrediction, refresh,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// ── Server-side fetch helpers with Next.js data-cache revalidation ──
const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
const OPENF1 = 'https://api.openf1.org/v1';

export async function jolpica(path, revalidate = 600) {
  const res = await fetch(`${JOLPICA}${path}`, {
    next: { revalidate },
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Jolpica ${path} → ${res.status}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── OpenF1 OAuth2 (Sponsor tier) ──────────────────────────────────────
// Set OPENF1_USERNAME + OPENF1_PASSWORD in your env (Vercel/Netlify env vars,
// or .env.local for dev — both stay server-side, never shipped to the browser).
// Tokens expire after 1 hour; this caches and refreshes them automatically.
let tokenCache = { token: null, expiresAt: 0 };

async function getOpenF1Token(force = false) {
  const username = process.env.OPENF1_USERNAME;
  const password = process.env.OPENF1_PASSWORD;
  if (!username || !password) return null; // unauthenticated mode (historical data only)

  if (!force && tokenCache.token && Date.now() < tokenCache.expiresAt - 5 * 60e3) {
    return tokenCache.token;
  }
  try {
    const res = await fetch('https://api.openf1.org/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (parseInt(data.expires_in, 10) || 3600) * 1000,
    };
    return tokenCache.token;
  } catch {
    return null;
  }
}

export async function openf1(path, revalidate = 30) {
  let token = await getOpenF1Token();

  for (let attempt = 0; attempt < 3; attempt++) {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${OPENF1}${path}`, {
      next: { revalidate },
      headers,
    });
    if (res.ok) return res.json();

    // token expired mid-flight → refresh once and retry
    if (res.status === 401 && token && attempt < 2) {
      token = await getOpenF1Token(true);
      continue;
    }
    // rate-limited → back off and retry
    if (res.status === 429 && attempt < 2) {
      await sleep(1200 * (attempt + 1));
      continue;
    }
    throw new Error(`OpenF1 ${path} → ${res.status}`);
  }
}

// Keep only the most recent record per driver_number
export function latestPerDriver(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const prev = map.get(row.driver_number);
    if (!prev || new Date(row.date) >= new Date(prev.date)) map.set(row.driver_number, row);
  }
  return [...map.values()];
}

export function json(data, sMaxAge = 60) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, s-maxage=${sMaxAge}, stale-while-revalidate=${sMaxAge * 5}`,
    },
  });
}

export function jsonError(message) {
  return new Response(JSON.stringify({ error: message }), {
    status: 502,
    headers: { 'Content-Type': 'application/json' },
  });
}

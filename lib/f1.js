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

// Trim a multi-lap GPS trace to exactly one lap, so closing the path
// doesn't draw a chord across the map. A lap is "closed" when the car
// returns near its starting point AND keeps retracing the opening line.
export function extractLap(pts) {
  if (!Array.isArray(pts) || pts.length < 80) return pts;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY);
  const thresh = diag * 0.02;
  const start = pts[0];

  for (let i = Math.floor(pts.length * 0.35); i < pts.length - 10; i++) {
    if (Math.hypot(pts[i].x - start.x, pts[i].y - start.y) > thresh) continue;
    // confirm it's a real lap closure: the next stretch retraces the opening stretch
    let sum = 0;
    for (let k = 1; k <= 8; k++) sum += Math.hypot(pts[i + k].x - pts[k].x, pts[i + k].y - pts[k].y);
    if (sum / 8 < thresh * 1.6) return pts.slice(0, i + 1);
  }
  return pts; // no clean closure found; better unclosed than a chord
}

const isoSec = (ms) => new Date(ms).toISOString().slice(0, 19);
const nonZeroPts = (rows) => (Array.isArray(rows) ? rows.filter((p) => p.x !== 0 || p.y !== 0) : []);

// Safe min/max — Math.max(...arr) overflows the call stack on large arrays.
export function extent(arr, key) {
  let lo = Infinity, hi = -Infinity;
  for (const v of arr) { const n = key ? v[key] : v; if (n < lo) lo = n; if (n > hi) hi = n; }
  return [lo, hi];
}

// Smooth a closed loop with a light moving average so circuits read clean.
function smoothLoop(pts, win = 2) {
  const n = pts.length;
  if (n < 12) return pts;
  const out = [];
  for (let i = 0; i < n; i++) {
    let sx = 0, sy = 0, c = 0;
    for (let k = -win; k <= win; k++) { const p = pts[(i + k + n) % n]; sx += p[0]; sy += p[1]; c++; }
    out.push([sx / c, sy / c]);
  }
  return out;
}

// ── Bulletproof circuit outline: trace a REAL timed lap ────────────────
// Every timed lap is, by definition, one complete clean loop of the track —
// no pit, no in/out lap, no traffic gap. We pull /laps, pick clean timed
// laps, and trace GPS for exactly that lap window. Works on every circuit.
export async function circuitOutline(sessionKey, drivers, revalidate = 21600) {
  // candidate reference drivers — try a handful so one bad GPS feed can't break it
  const refs = (drivers || []).slice(0, 6).map((d) => d.driver_number);
  if (!refs.length) refs.push(1, 4, 16, 44, 63);

  // use the authenticated wrapper — raw fetch is blocked during live sessions
  let laps = [];
  try { laps = await openf1(`/laps?session_key=${sessionKey}`, revalidate); } catch { laps = []; }
  if (!Array.isArray(laps)) laps = [];

  // group clean, fully-timed laps by driver (exclude out/in laps & safety-car laps)
  const byDriver = new Map();
  if (Array.isArray(laps)) {
    const durs = laps.map((l) => l.lap_duration).filter((d) => typeof d === 'number' && d > 45 && d < 200).sort((a, b) => a - b);
    const fastest = durs[0] || 70;
    for (const l of laps) {
      if (!l.date_start || typeof l.lap_duration !== 'number') continue;
      // a clean racing lap: within 8% of the session's fastest (no SC / cruise laps)
      if (l.lap_duration < 45 || l.lap_duration > fastest * 1.08) continue;
      if (!byDriver.has(l.driver_number)) byDriver.set(l.driver_number, []);
      byDriver.get(l.driver_number).push(l);
    }
  }

  // try each candidate driver's fastest clean lap, then fall back to a time window
  const tryDriver = async (num) => {
    const cand = (byDriver.get(num) || []).sort((a, b) => a.lap_duration - b.lap_duration)[0];
    if (cand) {
      const t0 = new Date(cand.date_start).getTime();
      const t1 = t0 + cand.lap_duration * 1000 + 1500;
      const rows = await openf1(
        `/location?session_key=${sessionKey}&driver_number=${num}&date>${isoSec(t0 - 800)}&date<${isoSec(t1)}`,
        revalidate
      ).catch(() => []);
      const pts = nonZeroPts(rows);
      if (pts.length > 60) return pts;
    }
    return null;
  };

  let best = null;
  for (const num of refs) {
    const pts = await tryDriver(num);
    if (pts) { best = pts; break; }
  }
  if (!best) return null;

  // densify-then-trim: one clean lap, downsample, smooth, return [x,y] pairs
  const lap = extractLap(best);
  const step = Math.max(1, Math.floor(lap.length / 500));
  const raw = lap.filter((_, i) => i % step === 0).map((p) => [p.x, p.y]);
  return smoothLoop(raw, 2);
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

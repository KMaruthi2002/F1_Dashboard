// ── Paddock game: Blob persistence, auth, scoring ──────────────────────
import { createHash } from 'crypto';
import { jolpica } from './f1';

// Vercel names the token BLOB_READ_WRITE_TOKEN by default, but a custom
// prefix at connect time yields <PREFIX>_READ_WRITE_TOKEN — accept both.
export function blobToken() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const key = Object.keys(process.env).find((k) => k.endsWith('_READ_WRITE_TOKEN'));
  return key ? process.env[key] : null;
}
export const hasBlob = () => !!blobToken() || !!process.env.BLOB_STORE_ID;
// pass an explicit token when we have one; otherwise let the SDK resolve
// auth itself (newer store integrations authenticate via the runtime)
const tokenOpt = () => (blobToken() ? { token: blobToken() } : {});

export const sha = (s) => createHash('sha256').update(s).digest('hex');

export function makeGarageCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const userPath = (handle) => `paddock/users/${handle.toLowerCase()}.json`;

export function validHandle(h) {
  return typeof h === 'string' && /^[a-zA-Z0-9_]{3,16}$/.test(h);
}

export async function getUser(handle) {
  if (!hasBlob()) return null;
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: userPath(handle), ...tokenOpt() });
  const blob = blobs.find((b) => b.pathname === userPath(handle));
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export async function putUser(user) {
  const { put } = await import('@vercel/blob');
  await put(userPath(user.handle), JSON.stringify(user), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
    ...tokenOpt(),
  });
}

export async function listUsers() {
  if (!hasBlob()) return [];
  const { list } = await import('@vercel/blob');
  const { blobs } = await list({ prefix: 'paddock/users/', ...tokenOpt() });
  const users = await Promise.all(
    blobs.slice(0, 200).map((b) => fetch(b.url, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  );
  return users.filter(Boolean);
}

// ── results for a round (cached via Next fetch cache) ──
async function roundResults(round) {
  const [resData, qData, sData] = await Promise.all([
    jolpica(`/current/${round}/results.json?limit=3`, 1800).catch(() => null),
    jolpica(`/current/${round}/qualifying.json?limit=1`, 1800).catch(() => null),
    jolpica(`/current/${round}/sprint.json?limit=1`, 1800).catch(() => null),
  ]);
  const podium = (resData?.MRData?.RaceTable?.Races?.[0]?.Results || []).map((r) => r.Driver?.driverId);
  const pole = qData?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults?.[0]?.Driver?.driverId || null;
  const sprintWin = sData?.MRData?.RaceTable?.Races?.[0]?.SprintResults?.[0]?.Driver?.driverId || null;
  return { podium, pole, sprintWin, finished: podium.length === 3 };
}

// Scoring: P1 exact 25 · P2 exact 18 · P3 exact 15 · podium-but-wrong-slot 10 · pole 10 · sprint 15
export function scoreOne(pred, results) {
  if (!results?.finished) return { points: 0, settled: false, detail: [] };
  let points = 0;
  const detail = [];
  const slots = [
    [0, 25, 'P1'],
    [1, 18, 'P2'],
    [2, 15, 'P3'],
  ];
  for (const [i, pts, label] of slots) {
    const guess = pred.race?.[i];
    if (!guess) continue;
    if (results.podium[i] === guess) { points += pts; detail.push(`${label} exact +${pts}`); }
    else if (results.podium.includes(guess)) { points += 10; detail.push(`${label} on podium +10`); }
  }
  if (pred.pole && results.pole && pred.pole === results.pole) { points += 10; detail.push('Pole +10'); }
  if (pred.sprint && results.sprintWin && pred.sprint === results.sprintWin) { points += 15; detail.push('Sprint +15'); }
  return { points, settled: true, detail };
}

export async function scorePredictions(predictions) {
  const out = {};
  let total = 0;
  for (const [round, pred] of Object.entries(predictions || {})) {
    const results = await roundResults(round);
    const s = scoreOne(pred, results);
    out[round] = { ...s, results: results.finished ? results : null };
    total += s.points;
  }
  return { rounds: out, total };
}

// ── lock checks against the real schedule ──
export async function getRoundTimes(round) {
  const data = await jolpica('/current.json?limit=30', 3600);
  const race = (data?.MRData?.RaceTable?.Races || []).find((r) => +r.round === +round);
  if (!race) return null;
  const t = (s) => (s?.date ? new Date(`${s.date}T${s.time || '00:00:00Z'}`).getTime() : null);
  return {
    quali: t(race.Qualifying),
    sprint: t(race.Sprint),
    race: t({ date: race.date, time: race.time }),
    name: race.raceName,
    hasSprint: !!race.Sprint,
  };
}

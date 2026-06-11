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

export async function openf1(path, revalidate = 30) {
  // retry on 429 — OpenF1's free tier rate-limits bursts
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${OPENF1}${path}`, {
      next: { revalidate },
      headers: { Accept: 'application/json' },
    });
    if (res.ok) return res.json();
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

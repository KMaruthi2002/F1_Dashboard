import { openf1, jolpica, json, latestPerDriver } from '@/lib/f1';

export const dynamic = 'force-dynamic';

const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
const nonZero = (rows) => (Array.isArray(rows) ? rows.filter((p) => p.x !== 0 || p.y !== 0) : []);

async function trace(sessionKey, driverNumber, t0, t1) {
  const rows = await openf1(
    `/location?session_key=${sessionKey}&driver_number=${driverNumber}&date>${iso(t0)}&date<${iso(t1)}`,
    21600
  ).catch(() => []);
  return nonZero(rows);
}

async function findOutline(session, drivers) {
  const start = new Date(session.date_start).getTime();
  const ref = drivers?.[0]?.driver_number || 1;
  for (const off of [12, 35]) {
    const pts = await trace(session.session_key, ref, start + off * 60e3, start + (off + 2.5) * 60e3);
    if (pts.length > 50) return pts;
  }
  return null;
}

async function hasGps(session, refDriver) {
  const start = new Date(session.date_start).getTime();
  const pts = await trace(session.session_key, refDriver, start + 15 * 60e3, start + 16 * 60e3);
  return pts.length > 20;
}

// Resolve a replayable session (with working GPS) for a given base race session,
// falling back to the same circuit in previous years.
async function resolveWithFallback(base) {
  const drivers = await openf1(`/drivers?session_key=${base.session_key}`, 86400).catch(() => []);
  if (await hasGps(base, drivers?.[0]?.driver_number || 1)) return { session: base, drivers };
  for (const year of [base.year - 1, base.year - 2]) {
    const prev = await openf1(`/sessions?circuit_key=${base.circuit_key ?? ''}&year=${year}&session_name=Race`, 86400).catch(() => []);
    const cand = (Array.isArray(prev) ? prev : []).find((p) => p.circuit_short_name === base.circuit_short_name) || prev?.[0];
    if (!cand) continue;
    const candDrivers = await openf1(`/drivers?session_key=${cand.session_key}`, 86400).catch(() => []);
    if (await hasGps(cand, candDrivers?.[0]?.driver_number || 1)) return { session: cand, drivers: candDrivers };
  }
  return null;
}

// Find the OpenF1 race session for a given championship round (current season)
async function sessionForRound(round, races) {
  const race = races.find((r) => +r.round === +round);
  if (!race?.date) return null;
  const sessions = await openf1(
    `/sessions?session_name=Race&date_start>=${race.date}T00:00:00&date_start<=${race.date}T23:59:59`, 86400
  ).catch(() => []);
  return sessions?.[0] || null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const sk = searchParams.get('sk');
    const from = searchParams.get('from');
    const roundParam = searchParams.get('round');

    // ── chunk request: GPS tracks for all cars over a time window ──
    if (from && sk) {
      const t0 = new Date(from).getTime();
      if (Number.isNaN(t0)) return json({ ok: false }, 60);
      const durMs = Math.min(180, Math.max(30, +(searchParams.get('dur') || 90))) * 1000;
      const rows = await openf1(
        `/location?session_key=${sk}&date>${iso(t0)}&date<${iso(t0 + durMs)}`, 86400
      ).catch(() => []);

      const byDriver = new Map();
      for (const r of Array.isArray(rows) ? rows : []) {
        if (r.x === 0 && r.y === 0) continue;
        if (!byDriver.has(r.driver_number)) byDriver.set(r.driver_number, []);
        byDriver.get(r.driver_number).push(r);
      }
      const tracks = {};
      for (const [n, samples] of byDriver) {
        samples.sort((a, b) => new Date(a.date) - new Date(b.date));
        const out = [];
        let lastT = -Infinity;
        for (const s of samples) {
          const t = new Date(s.date).getTime();
          if (t - lastT >= 400) { out.push([t - t0, s.x, s.y]); lastT = t; }
        }
        if (out.length) tracks[n] = out;
      }
      return json({ ok: true, from, durMs, tracks }, 86400);
    }

    // ── meta request: pick a race (any completed round) or default to latest ──
    const schedData = await jolpica('/current.json?limit=30', 3600).catch(() => null);
    const races = schedData?.MRData?.RaceTable?.Races || [];
    const now = Date.now();
    const completedRounds = races
      .filter((r) => new Date(`${r.date}T${r.time || '00:00:00Z'}`).getTime() + 4 * 3600e3 < now)
      .map((r) => ({ round: +r.round, name: r.raceName, country: r.Circuit?.Location?.country, date: r.date }));

    let base = null;
    if (roundParam) {
      base = await sessionForRound(roundParam, races);
    } else {
      const sessions = await openf1('/sessions?session_key=latest', 300).catch(() => null);
      base = sessions?.[0] || null;
    }
    if (!base) return json({ ok: false, reason: 'no session found for that round', rounds: completedRounds }, 120);

    const resolved = await resolveWithFallback(base);
    if (!resolved) return json({ ok: false, reason: 'no GPS available for that circuit yet', rounds: completedRounds }, 300);
    const { session, drivers } = resolved;

    // circuit geometry for this exact session
    const outlinePts = await findOutline(session, drivers);
    let outline = [];
    let bounds = null;
    if (outlinePts) {
      const xs = outlinePts.map((p) => p.x); const ys = outlinePts.map((p) => p.y);
      bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
      const step = Math.max(1, Math.floor(outlinePts.length / 420));
      outline = outlinePts.filter((_, i) => i % step === 0).map((p) => [p.x, p.y]);
    }

    const raceControl = await openf1(`/race_control?session_key=${session.session_key}`, 3600).catch(() => []);

    return json({
      ok: true,
      rounds: completedRounds,
      selectedRound: roundParam ? +roundParam : completedRounds[completedRounds.length - 1]?.round ?? null,
      sessionKey: session.session_key,
      year: session.year,
      circuit: session.circuit_short_name,
      country: session.country_name,
      location: session.location,
      sessionName: session.session_name,
      dateStart: session.date_start,
      dateEnd: session.date_end,
      bounds,
      outline,
      drivers: (drivers || []).map((d) => ({
        n: d.driver_number, acr: d.name_acronym, name: d.full_name,
        team: d.team_name, colour: d.team_colour,
      })),
      raceControl: (raceControl || []).map((m) => ({
        date: m.date, lap: m.lap_number ?? null, category: m.category,
        flag: m.flag, message: m.message, scope: m.scope, driverNumber: m.driver_number ?? null,
      })),
    }, 1800);
  } catch (e) {
    return json({ ok: false, degraded: e.message }, 60);
  }
}

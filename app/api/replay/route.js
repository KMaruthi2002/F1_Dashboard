import { openf1, json, latestPerDriver } from '@/lib/f1';

export const dynamic = 'force-dynamic';

const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
const nonZero = (rows) => (Array.isArray(rows) ? rows.filter((p) => p.x !== 0 || p.y !== 0) : []);

// Does this session have real GPS? Sample a small window mid-session.
async function hasGps(session, refDriver) {
  const start = new Date(session.date_start).getTime();
  const pts = await openf1(
    `/location?session_key=${session.session_key}&driver_number=${refDriver}&date>${iso(start + 15 * 60e3)}&date<${iso(start + 16 * 60e3)}`,
    21600
  ).catch(() => []);
  return nonZero(pts).length > 20;
}

// Resolve the session to replay: latest race if its GPS works, else same circuit in prior years
async function resolveReplaySession() {
  const sessions = await openf1('/sessions?session_key=latest', 300).catch(() => null);
  const s = sessions?.[0];
  if (!s) return null;

  const drivers = await openf1(`/drivers?session_key=${s.session_key}`, 3600).catch(() => []);
  if (await hasGps(s, drivers?.[0]?.driver_number || 1)) return { session: s, drivers };

  for (const year of [s.year - 1, s.year - 2]) {
    const prev = await openf1(`/sessions?circuit_key=${s.circuit_key ?? ''}&year=${year}&session_name=Race`, 86400).catch(() => []);
    const cand = (Array.isArray(prev) ? prev : []).find((p) => p.circuit_short_name === s.circuit_short_name) || prev?.[0];
    if (!cand) continue;
    const candDrivers = await openf1(`/drivers?session_key=${cand.session_key}`, 86400).catch(() => []);
    if (await hasGps(cand, candDrivers?.[0]?.driver_number || 1)) return { session: cand, drivers: candDrivers };
  }
  return null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const at = searchParams.get('at');
    const sk = searchParams.get('sk');

    // ── chunk request: GPS *tracks* for all cars over a time window ──
    // Downsampled to ~2.2Hz per car — the client interpolates between
    // samples at 60fps so cars glide along the real racing line.
    const from = searchParams.get('from');
    if (from && sk) {
      const t0 = new Date(from).getTime();
      if (Number.isNaN(t0)) return json({ ok: false }, 60);
      const durMs = Math.min(180, Math.max(30, +(searchParams.get('dur') || 90))) * 1000;
      const rows = await openf1(
        `/location?session_key=${sk}&date>${iso(t0)}&date<${iso(t0 + durMs)}`,
        86400 // historical — cache hard
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
          if (t - lastT >= 400) { // ~2.2Hz
            out.push([t - t0, s.x, s.y]);
            lastT = t;
          }
        }
        if (out.length) tracks[n] = out;
      }
      return json({ ok: true, from, durMs, tracks }, 86400);
    }

    // ── legacy frame request: car positions at a moment in time ──
    if (at && sk) {
      const t = new Date(at).getTime();
      if (Number.isNaN(t)) return json({ ok: false }, 60);
      const rows = await openf1(
        `/location?session_key=${sk}&date>${iso(t)}&date<${iso(t + 8e3)}`,
        86400
      ).catch(() => []);
      const cars = nonZero(latestPerDriver(rows)).map((p) => ({ n: p.driver_number, x: p.x, y: p.y }));
      return json({ ok: true, at, cars }, 86400);
    }

    // ── meta request: which session, its window, drivers, race control timeline ──
    const resolved = await resolveReplaySession();
    if (!resolved) return json({ ok: false, reason: 'no replayable session with GPS' }, 120);
    const { session, drivers } = resolved;

    const raceControl = await openf1(`/race_control?session_key=${session.session_key}`, 3600).catch(() => []);

    return json({
      ok: true,
      sessionKey: session.session_key,
      year: session.year,
      circuit: session.circuit_short_name,
      country: session.country_name,
      location: session.location,
      sessionName: session.session_name,
      dateStart: session.date_start,
      dateEnd: session.date_end,
      drivers: (drivers || []).map((d) => ({
        n: d.driver_number,
        acr: d.name_acronym,
        name: d.full_name,
        team: d.team_name,
        colour: d.team_colour,
      })),
      raceControl: (raceControl || []).map((m) => ({
        date: m.date,
        lap: m.lap_number ?? null,
        category: m.category,
        flag: m.flag,
        message: m.message,
        scope: m.scope,
        driverNumber: m.driver_number ?? null,
      })),
    }, 1800);
  } catch (e) {
    return json({ ok: false, degraded: e.message }, 60);
  }
}

import { openf1, json, latestPerDriver } from '@/lib/f1';

export const dynamic = 'force-dynamic';

const iso = (ms) => new Date(ms).toISOString().slice(0, 19);
const nonZero = (rows) => (Array.isArray(rows) ? rows.filter((p) => p.x !== 0 || p.y !== 0) : []);

async function trace(sessionKey, driverNumber, t0, t1, revalidate) {
  const rows = await openf1(
    `/location?session_key=${sessionKey}&driver_number=${driverNumber}&date>${iso(t0)}&date<${iso(t1)}`,
    revalidate
  ).catch(() => []);
  return nonZero(rows);
}

// Find a usable GPS trace within a session (cars must actually be on track)
async function findOutline(session, drivers) {
  const start = new Date(session.date_start).getTime();
  const ref = drivers?.[0]?.driver_number || 1;
  for (const off of [12, 35]) {
    const pts = await trace(session.session_key, ref, start + off * 60e3, start + (off + 2.5) * 60e3, 21600);
    if (pts.length > 50) return pts;
  }
  return null;
}

export async function GET() {
  try {
    const sessions = await openf1('/sessions?session_key=latest', 60).catch(() => null);
    const s = sessions?.[0];
    if (!s) return json({ ok: false }, 60);

    const now = Date.now();
    const start = new Date(s.date_start).getTime();
    const end = new Date(s.date_end).getTime();
    const live = now >= start - 10 * 60e3 && now <= end + 30 * 60e3;

    const drivers = await openf1(`/drivers?session_key=${s.session_key}`, 3600).catch(() => []);

    // ── 1) outline: current session, else same circuit in previous years ──
    let outlinePts = await findOutline(s, drivers);
    let sourceSession = s;
    let sourceDrivers = drivers;
    if (!outlinePts) {
      for (const year of [s.year - 1, s.year - 2]) {
        const prev = await openf1(
          `/sessions?circuit_key=${s.circuit_key ?? ''}&year=${year}&session_name=Race`, 86400
        ).catch(() => []);
        // circuit_key missing on latest payloads sometimes — match by name
        const cand = (Array.isArray(prev) ? prev : []).find(
          (p) => p.circuit_short_name === s.circuit_short_name
        ) || prev?.[0];
        if (!cand) continue;
        const candDrivers = await openf1(`/drivers?session_key=${cand.session_key}`, 86400).catch(() => []);
        outlinePts = await findOutline(cand, candDrivers);
        if (outlinePts) { sourceSession = cand; sourceDrivers = candDrivers; break; }
      }
    }

    let outline = [];
    let bounds = null;
    if (outlinePts) {
      const xs = outlinePts.map((p) => p.x); const ys = outlinePts.map((p) => p.y);
      bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
      const step = Math.max(1, Math.floor(outlinePts.length / 420));
      outline = outlinePts.filter((_, i) => i % step === 0).map((p) => [p.x, p.y]);
    }

    // ── 2) car dots ──
    // live + current session GPS works → live dots; otherwise replay from the outline source session
    let cars = [];
    let mode = 'REPLAY';
    if (live) {
      const rows = await openf1(
        `/location?session_key=${s.session_key}&date>${iso(now - 20e3)}&date<${iso(now + 5e3)}`, 10
      ).catch(() => []);
      const pts = nonZero(latestPerDriver(rows));
      if (pts.length) { cars = pts; mode = 'LIVE'; }
    }
    if (!cars.length && sourceSession) {
      // sessions often finish before their scheduled end — sample at 75% distance
      const sStart = new Date(sourceSession.date_start).getTime();
      const sEnd = new Date(sourceSession.date_end).getTime();
      const mid = sStart + (sEnd - sStart) * 0.75;
      const rows = await openf1(
        `/location?session_key=${sourceSession.session_key}&date>${iso(mid)}&date<${iso(mid + 20e3)}`,
        3600
      ).catch(() => []);
      cars = nonZero(latestPerDriver(rows));
      mode = 'REPLAY';
    }

    // dot metadata from whichever session the dots came from
    const metaSrc = mode === 'LIVE' ? drivers : sourceDrivers;
    const metaByNum = new Map((metaSrc || []).map((d) => [d.driver_number, d]));
    const dots = cars.map((p) => {
      const m = metaByNum.get(p.driver_number) || {};
      return {
        n: p.driver_number,
        x: p.x,
        y: p.y,
        acr: m.name_acronym || `#${p.driver_number}`,
        team: m.team_name || null,
        colour: m.team_colour || null,
      };
    });

    return json({
      ok: true,
      live,
      mode,
      circuit: s.circuit_short_name,
      sourceYear: sourceSession?.year,
      bounds,
      outline,
      cars: dots,
    }, mode === 'LIVE' ? 10 : 600);
  } catch (e) {
    return json({ ok: false, degraded: e.message }, 30);
  }
}

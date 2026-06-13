import { openf1, json, latestPerDriver, circuitOutline, extent } from '@/lib/f1';

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

// outline from a real timed lap (returns array of [x,y]) — accurate on every track
async function findOutline(session, drivers) {
  const flat = await circuitOutline(session.session_key, drivers, 21600);
  return flat && flat.length > 50 ? flat : null;
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

    // ── 1) outline: the circuit shape never changes between sessions, so prefer
    // a COMPLETED session (lots of clean timed laps) over a live one that has
    // barely run. Search this circuit across recent years + session types.
    let outlinePts = null;
    let sourceSession = null;
    let sourceDrivers = drivers;

    // build candidate sessions: current first ONLY if it's already deep enough,
    // then this circuit's past Races and Qualis going back several years
    const candidates = [];
    if (!live) candidates.push({ session: s, drivers });
    for (const year of [s.year, s.year - 1, s.year - 2, s.year - 3]) {
      for (const type of ['Race', 'Qualifying']) {
        const list = await openf1(
          `/sessions?circuit_short_name=${encodeURIComponent(s.circuit_short_name)}&year=${year}&session_name=${type}`, 86400
        ).catch(() => []);
        const cand = (Array.isArray(list) ? list : [])[0];
        // skip the in-progress session itself
        if (cand && cand.session_key !== s.session_key) candidates.push({ session: cand, drivers: null });
      }
    }
    // finally, the live session itself as a last resort
    candidates.push({ session: s, drivers });

    for (const c of candidates) {
      const cd = c.drivers || await openf1(`/drivers?session_key=${c.session.session_key}`, 86400).catch(() => []);
      const pts = await findOutline(c.session, cd);
      if (pts) { outlinePts = pts; sourceSession = c.session; sourceDrivers = cd; break; }
    }
    if (!sourceSession) sourceSession = s;

    // circuitOutline already returns clean, smoothed [x,y] pairs
    const outline = outlinePts || [];

    // pit lane geometry from a real stop in the outline-source session
    let pitLane = [];
    try {
      const pitsRaw = await openf1(`/pit?session_key=${sourceSession.session_key}`, 21600).catch(() => []);
      for (const p of Array.isArray(pitsRaw) ? pitsRaw : []) {
        if (!p.pit_duration || p.pit_duration > 90) continue;
        const t0 = new Date(p.date).getTime() - 6e3;
        const t1 = new Date(p.date).getTime() + p.pit_duration * 1000 + 14e3;
        const pts = await trace(sourceSession.session_key, p.driver_number, t0, t1, 21600);
        if (pts.length > 15) {
          const step = Math.max(1, Math.floor(pts.length / 90));
          pitLane = pts.filter((_, i) => i % step === 0).map((q) => [q.x, q.y]);
          break;
        }
      }
    } catch { /* best effort */ }

    // bounds cover track + pit lane
    let bounds = null;
    const allPts = [...outline, ...pitLane];
    if (allPts.length) {
      const [minX, maxX] = extent(allPts, 0); const [minY, maxY] = extent(allPts, 1);
      bounds = { minX, maxX, minY, maxY };
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
      // sessions often finish before their scheduled end · sample at 75% distance
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
      pitLane,
      cars: dots,
    }, mode === 'LIVE' ? 10 : 600);
  } catch (e) {
    return json({ ok: false, degraded: e.message }, 30);
  }
}

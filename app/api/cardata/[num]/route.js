import { openf1, json } from '@/lib/f1';

export const dynamic = 'force-dynamic';

const iso = (ms) => new Date(ms).toISOString().slice(0, 19);

// Latest onboard telemetry sample for one car: speed, gear, throttle, brake, RPM, DRS
export async function GET(_req, { params }) {
  const num = params.num;
  try {
    const sessions = await openf1('/sessions?session_key=latest', 60).catch(() => null);
    const s = sessions?.[0];
    if (!s) return json({ ok: false }, 60);

    const now = Date.now();
    const start = new Date(s.date_start).getTime();
    const end = new Date(s.date_end).getTime();
    const live = now >= start - 10 * 60e3 && now <= end + 30 * 60e3;

    let winStart, winEnd;
    if (live) { winStart = now - 15e3; winEnd = now + 5e3; }
    else {
      // sessions often end early — sample 75% of the way through
      const mid = start + (end - start) * 0.75;
      winStart = mid; winEnd = mid + 15e3;
    }

    const rows = await openf1(
      `/car_data?session_key=${s.session_key}&driver_number=${num}&date>${iso(winStart)}&date<${iso(winEnd)}`,
      live ? 8 : 1800
    ).catch(() => []);

    const samples = Array.isArray(rows) ? rows : [];
    // prefer a real moving sample; zeroed channels mean the feed is dead
    const last = [...samples].reverse().find((r) => (r.speed || 0) > 0 || (r.rpm || 0) > 0) || samples[samples.length - 1];
    if (!last || ((last.speed || 0) === 0 && (last.rpm || 0) === 0)) {
      return json({ ok: false, live, reason: 'no onboard channel for this session' }, live ? 10 : 300);
    }

    // DRS decode per OpenF1 docs: 10,12,14 = open
    const drsOpen = [10, 12, 14].includes(last.drs);

    return json({
      ok: true,
      live,
      mode: live ? 'LIVE' : 'REPLAY',
      number: +num,
      speed: last.speed,
      rpm: last.rpm,
      gear: last.n_gear,
      throttle: last.throttle,
      brake: last.brake,
      drs: drsOpen,
    }, live ? 10 : 300);
  } catch (e) {
    return json({ ok: false, degraded: e.message }, 30);
  }
}

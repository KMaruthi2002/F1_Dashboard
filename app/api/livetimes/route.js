import { openf1, json } from '@/lib/f1';

export const dynamic = 'force-dynamic';

function fmtLap(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3).padStart(6, '0');
  return `${m}:${s}`;
}

// Per-driver lap intelligence: lap count, last lap + sectors, best lap, pit stops
export async function GET() {
  try {
    const sessions = await openf1('/sessions?session_key=latest', 60).catch(() => null);
    const s = sessions?.[0];
    if (!s) return json({ ok: false, drivers: [] }, 60);

    const now = Date.now();
    const start = new Date(s.date_start).getTime();
    const end = new Date(s.date_end).getTime();
    const live = now >= start - 10 * 60e3 && now <= end + 30 * 60e3;
    const reval = live ? 20 : 600;

    const [laps, pits] = await Promise.all([
      openf1(`/laps?session_key=${s.session_key}`, reval).catch(() => []),
      openf1(`/pit?session_key=${s.session_key}`, reval).catch(() => []),
    ]);

    const byDriver = new Map();
    for (const lap of laps || []) {
      const cur = byDriver.get(lap.driver_number) || { laps: [], best: null };
      cur.laps.push(lap);
      if (lap.lap_duration && (!cur.best || lap.lap_duration < cur.best.lap_duration)) cur.best = lap;
      byDriver.set(lap.driver_number, cur);
    }
    const pitCount = new Map();
    for (const p of pits || []) pitCount.set(p.driver_number, (pitCount.get(p.driver_number) || 0) + 1);

    // overall fastest (purple) lap
    let purple = null;
    for (const [, v] of byDriver) {
      if (v.best && (!purple || v.best.lap_duration < purple.lap_duration)) purple = v.best;
    }

    const out = [...byDriver.entries()].map(([num, v]) => {
      const sorted = v.laps.sort((a, b) => a.lap_number - b.lap_number);
      const last = sorted[sorted.length - 1];
      return {
        number: num,
        lapCount: last?.lap_number || sorted.length,
        lastLap: fmtLap(last?.lap_duration),
        lastLapRaw: last?.lap_duration ?? null,
        s1: last?.duration_sector_1?.toFixed(3) ?? null,
        s2: last?.duration_sector_2?.toFixed(3) ?? null,
        s3: last?.duration_sector_3?.toFixed(3) ?? null,
        speedTrap: last?.st_speed ?? null,
        bestLap: fmtLap(v.best?.lap_duration),
        bestLapRaw: v.best?.lap_duration ?? null,
        isPurple: purple && v.best && v.best.lap_duration === purple.lap_duration,
        pits: pitCount.get(num) || 0,
      };
    });

    return json({
      ok: true,
      live,
      sessionKey: s.session_key,
      sessionName: s.session_name,
      purple: purple ? { number: purple.driver_number, time: fmtLap(purple.lap_duration) } : null,
      drivers: out,
    }, live ? 20 : 300);
  } catch (e) {
    return json({ ok: false, drivers: [], degraded: e.message }, 30);
  }
}

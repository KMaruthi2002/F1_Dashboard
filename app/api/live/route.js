import { openf1, json, jsonError, latestPerDriver } from '@/lib/f1';

export const dynamic = 'force-dynamic';

const FALLBACK = { live: false, session: null, grid: [], weather: null, raceControl: [] };

export async function GET() {
  try {
    const sessions = await openf1('/sessions?session_key=latest', 25).catch(() => null);
    const s = sessions?.[0];
    if (!s) return json(FALLBACK, 30);

    const now = Date.now();
    const start = new Date(s.date_start).getTime();
    const end = new Date(s.date_end).getTime();
    // treat as live from 10 min before start to 30 min after scheduled end
    const live = now >= start - 10 * 60e3 && now <= end + 30 * 60e3;

    const reval = live ? 15 : 120;
    const safe = (p, r) => openf1(p, r).catch(() => []);
    // two staggered batches — OpenF1's free tier rate-limits bursts
    const [drivers, positions, intervals] = await Promise.all([
      safe(`/drivers?session_key=${s.session_key}`, 600),
      safe(`/position?session_key=${s.session_key}`, reval),
      safe(`/intervals?session_key=${s.session_key}`, reval),
    ]);
    const [weather, stints, raceControl] = await Promise.all([
      safe(`/weather?session_key=${s.session_key}`, reval),
      safe(`/stints?session_key=${s.session_key}`, reval),
      safe(`/race_control?session_key=${s.session_key}`, reval),
    ]);

    const latestPos = latestPerDriver(positions);
    const latestInt = latestPerDriver(intervals);
    const intByNum = new Map(latestInt.map((i) => [i.driver_number, i]));
    const driverByNum = new Map((drivers || []).map((d) => [d.driver_number, d]));

    // current (last) stint per driver
    const stintByNum = new Map();
    for (const st of stints || []) {
      const prev = stintByNum.get(st.driver_number);
      if (!prev || st.stint_number > prev.stint_number) stintByNum.set(st.driver_number, st);
    }

    const grid = latestPos
      .sort((a, b) => a.position - b.position)
      .map((p) => {
        const d = driverByNum.get(p.driver_number) || {};
        const i = intByNum.get(p.driver_number) || {};
        const st = stintByNum.get(p.driver_number);
        return {
          position: p.position,
          number: p.driver_number,
          acronym: d.name_acronym || `#${p.driver_number}`,
          fullName: d.full_name,
          team: d.team_name,
          teamColour: d.team_colour,
          headshot: d.headshot_url,
          gapToLeader: i.gap_to_leader ?? null,
          interval: i.interval ?? null,
          compound: st?.compound || null,
          tyreLaps: st ? (st.lap_end - st.lap_start + (st.tyre_age_at_start || 0)) : null,
          stintNumber: st?.stint_number || null,
        };
      });

    const w = Array.isArray(weather) && weather.length ? weather[weather.length - 1] : null;

    const messages = (raceControl || []).slice(-8).reverse().map((m) => ({
      date: m.date, category: m.category, flag: m.flag, message: m.message, scope: m.scope,
    }));

    return json({
      live,
      session: {
        key: s.session_key,
        name: s.session_name,
        type: s.session_type,
        circuit: s.circuit_short_name,
        country: s.country_name,
        location: s.location,
        dateStart: s.date_start,
        dateEnd: s.date_end,
        year: s.year,
      },
      grid,
      weather: w ? {
        airTemp: w.air_temperature,
        trackTemp: w.track_temperature,
        humidity: w.humidity,
        windSpeed: w.wind_speed,
        rainfall: w.rainfall,
        pressure: w.pressure,
      } : null,
      raceControl: messages,
      fetchedAt: new Date().toISOString(),
    }, live ? 15 : 90);
  } catch (e) {
    // never break the dashboard — serve graceful fallback
    return json({ ...FALLBACK, degraded: e.message }, 30);
  }
}

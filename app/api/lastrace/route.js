import { jolpica, openf1, json, jsonError, latestPerDriver } from '@/lib/f1';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [resultsData, qualiData] = await Promise.all([
      jolpica('/current/last/results.json?limit=30', 600),
      jolpica('/current/last/qualifying.json?limit=30', 600),
    ]);

    const race = resultsData?.MRData?.RaceTable?.Races?.[0] || {};
    const qrace = qualiData?.MRData?.RaceTable?.Races?.[0] || {};

    const results = (race.Results || []).map((r) => ({
      position: +r.position,
      positionText: r.positionText,
      points: +r.points,
      code: r.Driver?.code,
      driverId: r.Driver?.driverId,
      number: r.Driver?.permanentNumber,
      firstName: r.Driver?.givenName,
      lastName: r.Driver?.familyName,
      constructorId: r.Constructor?.constructorId,
      constructorName: r.Constructor?.name,
      grid: +r.grid,
      laps: +r.laps,
      status: r.status,
      time: r.Time?.time || null,
      fastestLap: r.FastestLap ? { rank: +r.FastestLap.rank, lap: +r.FastestLap.lap, time: r.FastestLap.Time?.time } : null,
    }));

    const qualifying = (qrace.QualifyingResults || []).map((q) => ({
      position: +q.position,
      code: q.Driver?.code,
      driverId: q.Driver?.driverId,
      firstName: q.Driver?.givenName,
      lastName: q.Driver?.familyName,
      constructorId: q.Constructor?.constructorId,
      q1: q.Q1 || null,
      q2: q.Q2 || null,
      q3: q.Q3 || null,
    }));

    // OpenF1 enrichment: weather + tire stints for that race session
    let weather = null;
    let stints = [];
    let openf1Drivers = [];
    try {
      const raceDate = race.date;
      const sessions = await openf1(`/sessions?session_name=Race&year=${race.season}&date_start>=${raceDate}T00:00:00&date_start<=${raceDate}T23:59:59`, 600);
      const sk = sessions?.[0]?.session_key;
      if (sk) {
        const [w, st, dr] = await Promise.all([
          openf1(`/weather?session_key=${sk}`, 600),
          openf1(`/stints?session_key=${sk}`, 600),
          openf1(`/drivers?session_key=${sk}`, 600),
        ]);
        if (Array.isArray(w) && w.length) {
          const mid = w[Math.floor(w.length / 2)];
          const rained = w.some((x) => x.rainfall > 0);
          weather = {
            airTemp: mid.air_temperature,
            trackTemp: mid.track_temperature,
            humidity: mid.humidity,
            windSpeed: mid.wind_speed,
            pressure: mid.pressure,
            rain: rained,
          };
        }
        stints = (st || []).map((s) => ({
          driverNumber: s.driver_number,
          stint: s.stint_number,
          compound: s.compound,
          lapStart: s.lap_start,
          lapEnd: s.lap_end,
          tyreAge: s.tyre_age_at_start,
        }));
        openf1Drivers = (dr || []).map((d) => ({
          number: d.driver_number,
          acronym: d.name_acronym,
          team: d.team_name,
          teamColour: d.team_colour,
          headshot: d.headshot_url,
        }));
      }
    } catch { /* OpenF1 enrichment is best-effort */ }

    return json({
      season: race.season,
      round: +race.round,
      name: race.raceName,
      circuit: race.Circuit?.circuitName,
      locality: race.Circuit?.Location?.locality,
      country: race.Circuit?.Location?.country,
      date: race.date,
      results,
      qualifying,
      weather,
      stints,
      openf1Drivers,
    }, 300);
  } catch (e) {
    return jsonError(e.message);
  }
}

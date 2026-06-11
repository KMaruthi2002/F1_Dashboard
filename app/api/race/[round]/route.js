import { jolpica, json, jsonError } from '@/lib/f1';

export const dynamic = 'force-dynamic';

// Per-round mini result: podium + pole, for the expandable calendar
export async function GET(_req, { params }) {
  const round = params.round;
  try {
    const [resultsData, qualiData] = await Promise.all([
      jolpica(`/current/${round}/results.json?limit=3`, 21600),
      jolpica(`/current/${round}/qualifying.json?limit=1`, 21600),
    ]);
    const race = resultsData?.MRData?.RaceTable?.Races?.[0];
    const pole = qualiData?.MRData?.RaceTable?.Races?.[0]?.QualifyingResults?.[0];
    if (!race) return json({ round: +round, finished: false }, 600);

    return json({
      round: +round,
      finished: true,
      name: race.raceName,
      podium: (race.Results || []).slice(0, 3).map((r) => ({
        position: +r.position,
        code: r.Driver?.code,
        name: `${r.Driver?.givenName} ${r.Driver?.familyName}`,
        constructorId: r.Constructor?.constructorId,
        team: r.Constructor?.name,
        time: r.Time?.time || r.status,
      })),
      pole: pole
        ? {
            code: pole.Driver?.code,
            name: `${pole.Driver?.givenName} ${pole.Driver?.familyName}`,
            time: pole.Q3 || pole.Q2 || pole.Q1 || null,
            constructorId: pole.Constructor?.constructorId,
          }
        : null,
    }, 3600);
  } catch (e) {
    return jsonError(e.message);
  }
}

import { jolpica, json, jsonError } from '@/lib/f1';

export const dynamic = 'force-dynamic';

export async function GET(_req, { params }) {
  const id = params.id;
  try {
    const [winsData, polesData, seasonData] = await Promise.all([
      jolpica(`/drivers/${id}/results/1.json?limit=1`, 21600),
      jolpica(`/drivers/${id}/qualifying/1.json?limit=1`, 21600),
      jolpica(`/current/drivers/${id}/results.json?limit=100`, 3600),
    ]);

    const careerWins = +(winsData?.MRData?.total || 0);
    const careerPoles = +(polesData?.MRData?.total || 0);

    const races = seasonData?.MRData?.RaceTable?.Races || [];
    const lastFive = races.slice(-5).map((r) => ({
      round: +r.round,
      race: r.raceName,
      position: r.Results?.[0]?.positionText,
      points: +(r.Results?.[0]?.points || 0),
      grid: +(r.Results?.[0]?.grid || 0),
    }));
    const seasonPoints = races.reduce((acc, r) => acc + (+(r.Results?.[0]?.points || 0)), 0);
    const seasonWins = races.filter((r) => r.Results?.[0]?.position === '1').length;
    const podiums = races.filter((r) => +(r.Results?.[0]?.position || 99) <= 3).length;

    return json({
      driverId: id,
      careerWins,
      careerPoles,
      seasonPoints,
      seasonWins,
      seasonPodiums: podiums,
      lastFive,
    }, 3600);
  } catch (e) {
    return jsonError(e.message);
  }
}

import { jolpica, json, jsonError } from '@/lib/f1';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [drivers, constructors] = await Promise.all([
      jolpica('/current/driverstandings.json', 600),
      jolpica('/current/constructorstandings.json', 600),
    ]);
    const dl = drivers?.MRData?.StandingsTable?.StandingsLists?.[0] || {};
    const cl = constructors?.MRData?.StandingsTable?.StandingsLists?.[0] || {};
    return json({
      season: dl.season,
      round: dl.round,
      drivers: (dl.DriverStandings || []).map((s) => ({
        position: +s.position,
        points: +s.points,
        wins: +s.wins,
        code: s.Driver.code,
        driverId: s.Driver.driverId,
        number: s.Driver.permanentNumber,
        firstName: s.Driver.givenName,
        lastName: s.Driver.familyName,
        nationality: s.Driver.nationality,
        constructorId: s.Constructors?.[0]?.constructorId,
        constructorName: s.Constructors?.[0]?.name,
      })),
      constructors: (cl.ConstructorStandings || []).map((s) => ({
        position: +s.position,
        points: +s.points,
        wins: +s.wins,
        constructorId: s.Constructor.constructorId,
        name: s.Constructor.name,
        nationality: s.Constructor.nationality,
      })),
    }, 300);
  } catch (e) {
    return jsonError(e.message);
  }
}

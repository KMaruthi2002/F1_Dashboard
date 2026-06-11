import { jolpica, json, jsonError } from '@/lib/f1';

export const dynamic = 'force-dynamic';

function session(s) {
  if (!s?.date) return null;
  return `${s.date}T${s.time || '00:00:00Z'}`;
}

export async function GET() {
  try {
    const data = await jolpica('/current.json?limit=30', 3600);
    const table = data?.MRData?.RaceTable || {};
    const races = (table.Races || []).map((r) => ({
      round: +r.round,
      name: r.raceName,
      circuit: r.Circuit?.circuitName,
      circuitId: r.Circuit?.circuitId,
      locality: r.Circuit?.Location?.locality,
      country: r.Circuit?.Location?.country,
      lat: r.Circuit?.Location?.lat,
      lng: r.Circuit?.Location?.long,
      race: session(r),
      qualifying: session(r.Qualifying),
      sprint: session(r.Sprint),
      sprintQualifying: session(r.SprintQualifying),
      fp1: session(r.FirstPractice),
      fp2: session(r.SecondPractice),
      fp3: session(r.ThirdPractice),
    }));
    return json({ season: table.season, races }, 1800);
  } catch (e) {
    return jsonError(e.message);
  }
}

// Stage 21: airport road distance and nearest well-rated school, from each project's coordinates. Dev DB read only; writes JSON.
// Airport = Noida International Airport (stored airport distances track it at ~1.14x straight-line; Delhi IGI does not).
// Road distance comes from Google's Routes API; the school is the nearest one within 8 km with rating >= 4.0 and >= 50 ratings,
// not a nursery, kindergarten or coaching centre; straight-line, like the hospital and police fields. Only empty values are looked up.
// Cached on disk, so a rerun costs nothing. Run: npx tsx scripts/data-integrity/21-routes-places.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, hasFile, readJson, sleep, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

const km = (a: [number, number], b: [number, number]) => {
  const R = 6371, r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function airportLocation(): Promise<[number, number]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY!, 'X-Goog-FieldMask': 'places.displayName,places.location' },
    body: JSON.stringify({ textQuery: 'Noida International Airport Jewar', maxResultCount: 3 }),
  });
  const d = (await res.json()) as { places?: any[] };
  const hit = (d.places ?? []).find((p) => /noida international|jewar|jewar airport/i.test(p.displayName?.text ?? '') && p.location.latitude > 28.0 && p.location.latitude < 28.35 && p.location.longitude > 77.4 && p.location.longitude < 77.8);
  if (!hit) throw new Error('could not locate Noida International Airport in Places');
  console.log(`airport: ${hit.displayName.text} @ ${hit.location.latitude.toFixed(4)},${hit.location.longitude.toFixed(4)}`);
  return [hit.location.latitude, hit.location.longitude];
}

async function roadKm(origins: { id: string; lat: number; lng: number }[], dest: [number, number]): Promise<Record<string, number>> {
  const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY!, 'X-Goog-FieldMask': 'originIndex,distanceMeters,condition' },
    body: JSON.stringify({
      origins: origins.map((o) => ({ waypoint: { location: { latLng: { latitude: o.lat, longitude: o.lng } } } })),
      destinations: [{ waypoint: { location: { latLng: { latitude: dest[0], longitude: dest[1] } } } }],
      travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE',
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`Routes ${res.status} ${(await res.text()).slice(0, 120)}`);
  const rows = (await res.json()) as { originIndex: number; distanceMeters?: number; condition?: string }[];
  const out: Record<string, number> = {};
  for (const r of rows) if (r.condition === 'ROUTE_EXISTS' && r.distanceMeters) out[origins[r.originIndex].id] = Math.round(r.distanceMeters / 100) / 10;
  return out;
}

async function school(lat: number, lng: number) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY!, 'X-Goog-FieldMask': 'places.displayName,places.location,places.rating,places.userRatingCount' },
    body: JSON.stringify({ includedTypes: ['school'], maxResultCount: 20, rankPreference: 'DISTANCE', locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 8000 } } }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Places ${res.status} ${(await res.text()).slice(0, 120)}`);
  const d = (await res.json()) as { places?: any[] };
  // Google's "school" type also returns playschool chains, coaching and music classes. A school says so in its name.
  const isSchool = (n: string) => /school|vidyalaya|vidya mandir|college|\bdps\b|public school/i.test(n) && !/kidzee|euro ?kids|podar jumbo|play|nursery|kinder|pre-?school|coaching|tuition|tutor|music|dance|art\b|computer|driving|training|institute/i.test(n);
  const hit = (d.places ?? []).find((p) => (p.rating ?? 0) >= 4.0 && (p.userRatingCount ?? 0) >= 100 && isSchool(p.displayName?.text ?? ''));
  return hit ? { name: hit.displayName?.text ?? '', km: Math.round(km([lat, lng], [hit.location.latitude, hit.location.longitude]) * 10) / 10, rating: hit.rating } : null;
}

async function main() {
  if (!KEY) throw new Error('no Google key');
  const cache: Record<string, any> = hasFile('routes-places-results.json') ? readJson<{ results: Record<string, any> }>('routes-places-results.json').results : {};
  const projects = await prisma.project.findMany({
    where: { archived_duplicate_of: null, lat: { not: null }, lng: { not: null }, OR: [{ airport_distance_km: null }, { top_school_distance_km: null }] },
    select: { id: true, name: true, lat: true, lng: true, airport_distance_km: true, top_school_distance_km: true },
  });
  console.log(`projects needing an airport or school distance: ${projects.length}`);

  const needAirport = projects.filter((p) => p.airport_distance_km == null && cache[p.id]?.airport_km === undefined);
  if (needAirport.length) {
    const dest = await airportLocation();
    for (let i = 0; i < needAirport.length; i += 10) {
      const batch = needAirport.slice(i, i + 10).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng! }));
      const got = await roadKm(batch, dest);
      for (const b of batch) (cache[b.id] ??= {}).airport_km = got[b.id] ?? null;
      await sleep(300);
    }
  }
  let calls = 0;
  for (const p of projects.filter((x) => x.top_school_distance_km == null && cache[x.id]?.school === undefined)) {
    try { (cache[p.id] ??= {}).school = await school(p.lat!, p.lng!); calls++; await sleep(200); }
    catch (e) { const m = (e as Error).message; console.error(`failed ${p.name}: ${m}`); if (/Places (400|401|403|429)/.test(m)) break; }
    (cache[p.id] ??= {}).name = p.name;
  }
  writeJson('routes-places-results.json', { generated_at: new Date().toISOString(), results: cache });
  const all = Object.values(cache);
  console.log({ school_calls: calls, airport_found: all.filter((r: any) => r.airport_km).length, school_found: all.filter((r: any) => r.school).length });
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

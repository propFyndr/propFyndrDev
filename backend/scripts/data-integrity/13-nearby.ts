// Stage 13: nearest hospital and police station per project, from its coordinates, via Google Places Nearby.
// Dev DB read only; writes JSON. Only projects that lack the value are looked up. Straight-line distance, one decimal.
// A hospital must have at least 10 ratings (filters out clinics and unlisted shells); anything beyond 15 km is left empty.
// Cached on disk, so a rerun costs nothing. Run: npx tsx scripts/data-integrity/13-nearby.ts [--limit N]
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, hasFile, readJson, sleep, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;
const MAX_KM = 15;

const km = (a: [number, number], b: [number, number]) => {
  const R = 6371, rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function nearest(lat: number, lng: number, type: 'hospital' | 'police', minRatings: number) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY!, 'X-Goog-FieldMask': 'places.displayName,places.location,places.userRatingCount' },
    body: JSON.stringify({ includedTypes: [type], maxResultCount: 20, rankPreference: 'DISTANCE', locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: MAX_KM * 1000 } } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Places ${res.status} ${(await res.text()).slice(0, 140)}`);
  const d = (await res.json()) as { places?: any[] };
  // Google's "hospital" type includes diagnostic labs and clinics; an actual hospital says so in its name.
  const isHospital = (n: string) => /hospital|nursing home|medical (college|cent(re|er))/i.test(n) && !/diagnos|scan|x.?ray|\blab\b|dental|clinic|physio|eye care|pharm|pathology/i.test(n);
  const hit = (d.places ?? []).find((p) => (p.userRatingCount ?? 0) >= minRatings && (type === 'police' || isHospital(p.displayName?.text ?? '')));
  if (!hit) return null;
  const dist = km([lat, lng], [hit.location.latitude, hit.location.longitude]);
  return dist <= MAX_KM ? { name: hit.displayName?.text ?? '', km: Math.round(dist * 10) / 10 } : null;
}

async function main() {
  if (!KEY) throw new Error('no Google key');
  const cache: Record<string, any> = hasFile('nearby-results.json') ? readJson<{ results: Record<string, any> }>('nearby-results.json').results : {};
  const projects = await prisma.project.findMany({
    where: { archived_duplicate_of: null, lat: { not: null }, lng: { not: null }, OR: [{ hospital_distance_km: null }, { police_station_distance_km: null }] },
    select: { id: true, name: true, lat: true, lng: true, hospital_distance_km: true, police_station_distance_km: true },
    orderBy: { name: 'asc' },
  });
  console.log(`projects needing a hospital or police distance (with coordinates): ${projects.length}`);
  let calls = 0;
  for (const p of projects) {
    if (calls >= LIMIT) break;
    const c = (cache[p.id] ??= {});
    try {
      if (p.hospital_distance_km == null && c.hospital === undefined) { c.hospital = await nearest(p.lat!, p.lng!, 'hospital', 10); calls++; await sleep(200); }
      if (p.police_station_distance_km == null && c.police === undefined) { c.police = await nearest(p.lat!, p.lng!, 'police', 0); calls++; await sleep(200); }
      c.name = p.name;
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`failed ${p.name}: ${msg}`);
      if (/Places (400|401|403|429)/.test(msg)) break;
    }
  }
  writeJson('nearby-results.json', { generated_at: new Date().toISOString(), results: cache });
  const all = Object.values(cache);
  console.log({ calls, hospital_found: all.filter((r: any) => r.hospital).length, police_found: all.filter((r: any) => r.police).length });
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

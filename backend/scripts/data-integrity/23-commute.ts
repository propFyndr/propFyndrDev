// Stage 23: commute matrix for projects that have none, from real routing data. Dev DB read only; writes JSON.
// Destinations: the nearest metro station (Google Places, within 25 km), Noida International Airport, Delhi IGI Terminal 3, Noida Sector 62.
// Per destination: driving distance, free-flow minutes (staticDuration) and peak minutes (traffic-aware, departing next weekday 09:00 IST).
// Entries match the stored shape {mode, destination, distance_km, travel_time_min, peak_time_min}. Cached on disk.
// Run: npx tsx scripts/data-integrity/23-commute.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, hasFile, readJson, sleep, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY!;
const km = (a: [number, number], b: [number, number]) => { const R = 6371, r = (d: number) => (d * Math.PI) / 180; const h = Math.sin(r(b[0] - a[0]) / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(r(b[1] - a[1]) / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

function nextWeekday9amIst(): string {
  const d = new Date(Date.now() + 2 * 86400000);
  while ([0, 6].includes(new Date(d.getTime() + 5.5 * 3600000).getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(3, 30, 0, 0); // 09:00 IST
  return d.toISOString();
}

async function place(query: string, within?: { box: [number, number, number, number] }) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'places.displayName,places.location' }, body: JSON.stringify({ textQuery: query, maxResultCount: 3, locationBias: { circle: { center: { latitude: 28.55, longitude: 77.4 }, radius: 50000 } } }) });
  const d = (await r.json()) as { places?: any[] };
  return (d.places ?? []).find((p) => !within || (p.location.latitude >= within.box[0] && p.location.latitude <= within.box[1] && p.location.longitude >= within.box[2] && p.location.longitude <= within.box[3]));
}

async function nearestMetro(lat: number, lng: number) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchNearby', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'places.displayName,places.location' }, body: JSON.stringify({ includedTypes: ['subway_station', 'train_station', 'transit_station'], maxResultCount: 20, rankPreference: 'DISTANCE', locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 25000 } } }) });
  const d = (await r.json()) as { places?: any[] };
  const hit = (d.places ?? []).find((p) => /metro/i.test(p.displayName?.text ?? ''));
  return hit ? { name: hit.displayName.text as string, lat: hit.location.latitude as number, lng: hit.location.longitude as number } : null;
}

async function route(o: [number, number], d: [number, number], departure: string) {
  const call = async (traffic: boolean) => {
    const r = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'distanceMeters,duration,staticDuration,condition' }, body: JSON.stringify({ origins: [{ waypoint: { location: { latLng: { latitude: o[0], longitude: o[1] } } } }], destinations: [{ waypoint: { location: { latLng: { latitude: d[0], longitude: d[1] } } } }], travelMode: 'DRIVE', routingPreference: traffic ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE', ...(traffic ? { departureTime: departure } : {}) }) });
    if (!r.ok) throw new Error(`Routes ${r.status}`);
    const row = ((await r.json()) as any[])[0];
    return row?.condition === 'ROUTE_EXISTS' ? row : null;
  };
  const [free, peak] = [await call(false), await call(true)];
  if (!free || !peak) return null;
  const sec = (s: string) => parseInt(String(s).replace('s', ''), 10);
  return { distance_km: Math.round(free.distanceMeters / 100) / 10, travel_time_min: Math.round(sec(free.duration) / 60), peak_time_min: Math.round(sec(peak.duration) / 60) };
}

async function main() {
  const cache: Record<string, any> = hasFile('commute-results.json') ? readJson<{ results: Record<string, any> }>('commute-results.json').results : {};
  const projects = await prisma.project.findMany({ where: { archived_duplicate_of: null, commute_matrix: { equals: undefined as any }, lat: { not: null } }, select: { id: true, name: true, lat: true, lng: true, commute_matrix: true } });
  const need = projects.filter((p) => p.commute_matrix == null && !cache[p.id]);
  console.log(`projects without a commute matrix (with coordinates): ${need.length}`);
  const hubs: { name: string; ll: [number, number] }[] = [];
  const nia = await place('Noida International Airport Jewar', { box: [28.0, 28.35, 77.4, 77.8] });
  const igi = await place('Indira Gandhi International Airport Terminal 3 Delhi', { box: [28.5, 28.6, 77.05, 77.15] });
  const s62 = await place('Sector 62 Noida', { box: [28.6, 28.66, 77.33, 77.4] });
  for (const [label, p] of [['Noida International Airport', nia], ['Delhi IGI Airport (Terminal 3)', igi], ['Sector 62 Noida (IT hub)', s62]] as const) if (p) hubs.push({ name: label, ll: [p.location.latitude, p.location.longitude] });
  console.log('hubs located:', hubs.map((h) => h.name).join(', '));
  const departure = nextWeekday9amIst();
  for (const p of need) {
    const o: [number, number] = [p.lat!, p.lng!], rows: any[] = [];
    try {
      const metro = await nearestMetro(o[0], o[1]);
      const dests = [...(metro ? [{ name: `${metro.name} (nearest metro)`, ll: [metro.lat, metro.lng] as [number, number] }] : []), ...hubs];
      for (const d of dests) { const r = await route(o, d.ll, departure); if (r) rows.push({ mode: 'Drive', destination: d.name, ...r }); await sleep(150); }
    } catch (e) { console.error(`failed ${p.name}: ${(e as Error).message}`); }
    cache[p.id] = { name: p.name, matrix: rows };
  }
  writeJson('commute-results.json', { generated_at: new Date().toISOString(), results: cache });
  const v = Object.values(cache) as any[];
  console.log({ projects: v.length, with_entries: v.filter((x) => x.matrix.length).length, avg_entries: +(v.reduce((a, x) => a + x.matrix.length, 0) / Math.max(1, v.length)).toFixed(1) });
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

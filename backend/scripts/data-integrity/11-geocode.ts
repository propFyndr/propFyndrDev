// Stage 11: coordinates for projects with no lat/lng, via Google Places text search. Dev DB read only; writes JSON.
// A result is kept only if it lies in the Noida / Greater Noida area AND the returned place name resembles the project.
// Every response is cached on disk, so a rerun costs nothing.
// Run: npx tsx scripts/data-integrity/11-geocode.ts [--limit N]
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, hasFile, normName, readJson, sleep, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

// Noida + Greater Noida + Greater Noida West + Yamuna Expressway belt, generously
const IN_AREA = (lat: number, lng: number) => lat >= 28.2 && lat <= 28.8 && lng >= 77.25 && lng <= 77.8;

const toks = (s: string) => new Set(normName(s).split(' ').filter(Boolean));
const jaccard = (a: Set<string>, b: Set<string>) => {
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return a.size && b.size ? i / (a.size + b.size - i) : 0;
};

async function search(query: string): Promise<{ name: string; address: string; lat: number; lng: number }[]> {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY!, 'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location' },
    body: JSON.stringify({ textQuery: query, maxResultCount: 3, locationBias: { circle: { center: { latitude: 28.55, longitude: 77.45 }, radius: 30000 } } }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Places ${res.status} ${(await res.text()).slice(0, 160)}`);
  const d = (await res.json()) as { places?: any[] };
  return (d.places ?? []).map((p) => ({ name: p.displayName?.text ?? '', address: p.formattedAddress ?? '', lat: p.location.latitude, lng: p.location.longitude }));
}

async function main() {
  if (!KEY) throw new Error('GOOGLE_PLACES_API_KEY / GOOGLE_MAPS_API_KEY not set');
  const cache: Record<string, any> = hasFile('geocode-results.json') ? readJson<{ results: Record<string, any> }>('geocode-results.json').results : {};
  const projects = await prisma.project.findMany({
    where: { archived_duplicate_of: null, lat: null },
    select: { id: true, name: true, address: true, sector: true, builder: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  console.log(`projects without coordinates: ${projects.length}`);

  let calls = 0;
  for (const p of projects) {
    if (cache[p.id] || calls >= LIMIT) continue;
    calls++;
    try {
      const hits = await search(`${p.name} ${p.builder.name} ${p.sector} Noida`);
      const mine = toks(p.name);
      const good = hits
        .map((h) => ({ ...h, score: jaccard(mine, toks(h.name)), inArea: IN_AREA(h.lat, h.lng) }))
        .filter((h) => h.inArea && h.score >= 0.5)
        .sort((a, b) => b.score - a.score)[0];
      cache[p.id] = good ? { accepted: true, name: p.name, place: good.name, address: good.address, lat: good.lat, lng: good.lng, score: +good.score.toFixed(2) } : { accepted: false, name: p.name, candidates: hits.map((h) => `${h.name} @ ${h.lat.toFixed(3)},${h.lng.toFixed(3)}`) };
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`failed ${p.name}: ${msg}`);
      if (/Places (400|401|403|429)/.test(msg)) break; // key or quota problem: stop, a rerun resumes from the cache
    }
    await sleep(250);
  }
  const all = Object.values(cache);
  writeJson('geocode-results.json', { generated_at: new Date().toISOString(), results: cache });
  console.log({ called: calls, accepted: all.filter((r: any) => r.accepted).length, rejected: all.filter((r: any) => !r.accepted).length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

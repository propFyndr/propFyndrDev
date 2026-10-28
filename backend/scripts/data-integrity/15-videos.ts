// Stage 15: official project videos. Find candidates with a YouTube-only search, then check the CHANNEL with YouTube's public oEmbed.
// A video is kept only when the title names the project AND the channel belongs to the project's builder (or carries the project's name).
// Stored with verified_at = null: a person has not confirmed it. Insert only; a rerun skips videos already stored.
//   npx tsx scripts/data-integrity/15-videos.ts [--limit N]            search + check, write videos-found.json (dev read only)
//   npx tsx scripts/data-integrity/15-videos.ts --apply --target dev|live [--confirm-live]   insert the found videos
//   npx tsx scripts/data-integrity/15-videos.ts --remove videos-inserted-<target>.json --target ..   delete what an apply inserted
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, hasFile, normName, readJson, sleep, writeJson } from './lib';

const arg = (n: string) => process.argv.includes(`--${n}`);
const val = (n: string) => process.argv[process.argv.indexOf(`--${n}`) + 1];
const TARGET = arg('target') ? val('target') : 'dev';
if (TARGET === 'live') {
  if ((arg('apply') || arg('remove')) && !arg('confirm-live')) throw new Error('live needs --confirm-live');
  if (!process.env.NEON_DB) throw new Error('NEON_DB is not set');
} else if (TARGET === 'dev') assertDevDb();
else throw new Error('--target must be dev or live');
const prisma = TARGET === 'live' ? new PrismaClient({ datasources: { db: { url: process.env.NEON_DB! } } }) : new PrismaClient();
const LIMIT = arg('limit') ? Number(val('limit')) : Infinity;

const flat = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const generic = /group|infra\w*|developers?|builders?|properties|realty|homes|limited|private|pvt|ltd|constructions?|estates?|real|india|the/g;
const nameToks = (s: string) => normName(s).split(' ').filter(Boolean);
const builderToks = (b: string) => b.toLowerCase().replace(/\(.*?\)/g, ' ').replace(generic, ' ').split(/[^a-z0-9]+/).filter((t) => t.length >= 4);

async function search(query: string): Promise<{ url: string; title: string }[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_NEW || process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: 6, include_answer: false, include_domains: ['youtube.com', 'youtu.be'] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const d = (await res.json()) as { results?: { url: string; title: string }[] };
  return (d.results ?? []).map((r) => ({ url: r.url, title: r.title }));
}

// Reviewed by hand 2026-10-28: shares every word with the project's name but is a different project.
const MANUAL_EXCLUDE = [{ project: 'Grand Omaxe', titleHas: 'Grand Woods' }];

const videoId = (u: string) => /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([\w-]{11})/.exec(u)?.[1] ?? null;

/** YouTube's public oEmbed: title and channel name for a video, no key. */
async function oembed(id: string): Promise<{ title: string; author: string } | null> {
  const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) return null;
  const d = (await r.json()) as { title?: string; author_name?: string };
  return d.title && d.author_name ? { title: d.title, author: d.author_name } : null;
}

async function find() {
  assertDevDb();
  const found: Record<string, any> = hasFile('videos-found.json') ? readJson<{ found: Record<string, any> }>('videos-found.json').found : {};
  const projects = await prisma.project.findMany({ where: { archived_duplicate_of: null }, select: { id: true, name: true, builder: { select: { name: true } } }, orderBy: { name: 'asc' } });
  let n = 0;
  for (const p of projects) {
    if (found[p.id] !== undefined || n >= LIMIT) continue;
    n++;
    try {
      const hits = await search(`${p.name} ${p.builder.name} Noida official project video walkthrough`);
      const toks = nameToks(p.name), bToks = builderToks(p.builder.name);
      const kept: any[] = [];
      for (const h of hits) {
        const id = videoId(h.url);
        if (!id) continue;
        const meta = await oembed(id);
        if (!meta) continue;
        const title = flat(meta.title), channel = flat(meta.author);
        // Whole words, 80% of the name: substring matching let "2" match inside "Mar'25" and "greens" half-match a resort.
        const titleWords = new Set(meta.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
        const titleNamesProject = toks.length > 0 && toks.filter((t) => titleWords.has(t)).length / toks.length >= 0.8;
        const channelIsOwner = bToks.some((t) => channel.includes(t)) || (toks.length > 0 && toks.every((t) => channel.includes(t)));
        if (titleNamesProject && channelIsOwner) kept.push({ url: `https://www.youtube.com/watch?v=${id}`, title: meta.title, channel: meta.author });
        await sleep(150);
      }
      found[p.id] = kept.slice(0, 2);
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`failed ${p.name}: ${msg}`);
      if (/\b(432|429|401|403)\b/.test(msg)) { console.error('quota or key problem: stopping; rerun resumes'); break; }
    }
    await sleep(500);
    if (n % 40 === 0) writeJson('videos-found.json', { generated_at: new Date().toISOString(), found });
  }
  writeJson('videos-found.json', { generated_at: new Date().toISOString(), found });
  const vals = Object.values(found);
  console.log({ searched: n, projects_with_a_video: vals.filter((v: any) => v.length).length, videos: vals.reduce((a: number, v: any) => a + v.length, 0) });
}

async function apply() {
  const found = readJson<{ found: Record<string, any[]> }>('videos-found.json').found;
  const out = { inserted: [] as { project_id: string; url: string }[], skipped_existing: 0, skipped_missing_project: 0 };
  for (const [pid, vids] of Object.entries(found)) {
    if (!vids.length) continue;
    const proj = await prisma.project.findUnique({ where: { id: pid }, select: { id: true, videos: { select: { url: true } } } });
    if (!proj) { out.skipped_missing_project++; continue; }
    for (const v of vids) {
      if (proj.videos.some((x) => x.url === v.url)) { out.skipped_existing++; continue; }
      await prisma.projectVideo.create({ data: { project_id: pid, provider: 'youtube', url: v.url, title: v.title, channel: v.channel, source_url: v.url, verified_at: null } });
      out.inserted.push({ project_id: pid, url: v.url });
    }
  }
  writeJson(`videos-inserted-${TARGET}.json`, out);
  console.log({ target: TARGET, inserted: out.inserted.length, skipped_existing: out.skipped_existing, skipped_missing_project: out.skipped_missing_project });
}

async function remove() {
  const ins = readJson<{ inserted: { project_id: string; url: string }[] }>(val('remove')).inserted;
  let n = 0;
  for (const i of ins) n += (await prisma.projectVideo.deleteMany({ where: { project_id: i.project_id, url: i.url, verified_at: null } })).count;
  console.log({ removed: n });
}

(arg('remove') ? remove() : arg('apply') ? apply() : find())
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

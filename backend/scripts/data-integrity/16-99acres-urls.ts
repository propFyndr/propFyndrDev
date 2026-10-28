// Stage 16: find each project's 99acres project page URL. Search API only: no request goes to 99acres here. Dev DB read only.
// A URL is kept only if it is a 99acres project page (".../npxid-r<digits>") whose slug carries most of the project's name tokens.
// URLs already seen in stage 4 are reused (no search). Resumable; stops on a quota or key error.
// Run: npx tsx scripts/data-integrity/16-99acres-urls.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, hasFile, pageIsAbout, readJson, sleep, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const isProjectPage = (u: string) => /^https?:\/\/(www\.)?99acres\.com\/[^?#]*npxid-r\d+/i.test(u);

async function search(query: string): Promise<{ url: string; title: string }[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_NEW || process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: 8, include_answer: false, include_domains: ['99acres.com'] }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const d = (await res.json()) as { results?: { url: string; title: string }[] };
  return (d.results ?? []).map((r) => ({ url: r.url, title: r.title }));
}

async function main() {
  const out: Record<string, any> = hasFile('99acres-urls.json') ? readJson<{ urls: Record<string, any> }>('99acres-urls.json').urls : {};
  const projects = await prisma.project.findMany({ where: { archived_duplicate_of: null }, select: { id: true, name: true, builder: { select: { name: true } } }, orderBy: { name: 'asc' } });
  let searched = 0, reused = 0;
  for (const p of projects) {
    if (out[p.id] !== undefined) continue;
    // 1. a 99acres project page stage 4 already found
    let url: string | null = null;
    if (hasFile(`research/${p.id}.json`)) {
      const r = readJson<any>(`research/${p.id}.json`);
      url = (r.sources ?? []).map((s: any) => s.url).find((u: string) => isProjectPage(u) && pageIsAbout(u, p.name, '')) ?? null;
      if (url) reused++;
    }
    // 2. otherwise search
    if (!url) {
      try {
        const hits = await search(`${p.name} ${p.builder.name} Noida 99acres project`);
        searched++;
        url = hits.map((h) => h.url).find((u) => isProjectPage(u) && pageIsAbout(u, p.name, '')) ?? null;
      } catch (e) {
        const msg = (e as Error).message;
        console.error(`failed ${p.name}: ${msg}`);
        if (/\b(432|429|401|403)\b/.test(msg)) { console.error('quota or key problem: stopping; rerun resumes'); break; }
        continue;
      }
      await sleep(400);
    }
    out[p.id] = { name: p.name, url };
    if (searched % 40 === 0) writeJson('99acres-urls.json', { generated_at: new Date().toISOString(), urls: out });
  }
  writeJson('99acres-urls.json', { generated_at: new Date().toISOString(), urls: out });
  const vals = Object.values(out);
  console.log({ projects: projects.length, decided: vals.length, with_url: vals.filter((v: any) => v.url).length, reused_from_stage4: reused, searched });
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

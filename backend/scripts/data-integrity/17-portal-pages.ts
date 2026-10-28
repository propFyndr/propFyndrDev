// Stage 17: project pages from Square Yards, Proptiger and MagicBricks, fetched with plain, paced, honest requests.
// Only sites whose robots.txt allows project pages (checked 2026-10-28). No spoofed browser identity, no retries around a refusal:
// the first 403/429/406 or a challenge page from a host stops that host. URLs come from a search API, not from crawling.
// Pages are saved in the format stage 4 uses (pages/<sha1(url)>.txt: url line, then text), JSON-LD first, so stage 19 can extract from them.
// Run: npx tsx scripts/data-integrity/17-portal-pages.ts [--limit N] [--delay-ms 3000]
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { assertDevDb, hasFile, pageIsAbout, readJson, sleep, workPath, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const LIMIT = Number(arg('limit', '100000'));
const DELAY = Number(arg('delay-ms', '3000'));
const UA = 'RealtyAsk-data-integrity/1.0 (+furqan.workk@gmail.com)';
// --urls-from discovery: take page URLs from discovery/out-*.json (found by a search outside this script) and make no search call at all.
const DISC = arg('urls-from', '') === 'discovery';

// A project page on each site; listing, locality and search pages are skipped.
const SITES: Record<string, RegExp> = {
  'squareyards.com': /squareyards\.com\/[^?#]*\/\d+\/project/i,
  'proptiger.com': /proptiger\.com\/[a-z-]+\/[^?#/]+\/[^?#/]+-\d{5,}(\/|$)/i,
  'magicbricks.com': /magicbricks\.com\/[^?#]*pdpid-[0-9a-f]+/i,
};
const hostKey = (u: string) => Object.keys(SITES).find((h) => u.includes(h));
const blocked = new Set<string>(); // hosts that refused us: left alone for the rest of the run

async function search(query: string): Promise<string[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_NEW || process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: 8, include_answer: false, include_domains: Object.keys(SITES) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  return ((await res.json()) as { results?: { url: string }[] }).results?.map((r) => r.url) ?? [];
}

const textOf = (html: string) => {
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => 'JSON-LD: ' + m[1].replace(/\s+/g, ' ').trim());
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|td|th)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8377;|&rupee;/g, '₹').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return [...ld, body].join('\n').slice(0, 40000);
};

async function fetchPage(url: string, host: string): Promise<{ ok: boolean; status: number; chars: number; stop?: boolean }> {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  if ([403, 406, 429, 503].includes(res.status)) { blocked.add(host); return { ok: false, status: res.status, chars: 0, stop: true }; }
  if (!res.ok) return { ok: false, status: res.status, chars: 0 };
  const html = await res.text();
  if (/access denied|captcha|verify you are (a )?human|unusual traffic/i.test(html.slice(0, 6000)) && html.length < 20000) { blocked.add(host); return { ok: false, status: res.status, chars: 0, stop: true }; }
  const text = textOf(html);
  const p = workPath(`pages/${createHash('sha1').update(url).digest('hex')}.txt`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${url}\n\n${text}`);
  return { ok: true, status: res.status, chars: text.length };
}

async function main() {
  const out: Record<string, any[]> = hasFile('portal-pages.json') ? readJson<{ pages: Record<string, any[]> }>('portal-pages.json').pages : {};
  const projects = await prisma.project.findMany({ where: { archived_duplicate_of: null }, select: { id: true, name: true, builder: { select: { name: true } } }, orderBy: { name: 'asc' } });
  const disc: Record<string, { squareyards?: string | null; magicbricks?: string | null }> = {};
  if (DISC) for (const f of readdirSync(workPath('discovery')).filter((x) => /^out-d+.json$/.test(x))) Object.assign(disc, readJson<Record<string, any>>(`discovery/${f}`));
  if (DISC) console.log(`discovery URLs for ${Object.keys(disc).length} projects`);
  let n = 0;
  const lastHit: Record<string, number> = {};
  for (const p of projects) {
    if (out[p.id] !== undefined || n >= LIMIT) continue;
    n++;
    const urls = new Set<string>();
    if (DISC) { const d = disc[p.id]; if (!d) continue; for (const u of [d.squareyards, d.magicbricks]) if (u && hostKey(u) && SITES[hostKey(u)!].test(u)) urls.add(u); }
    if (hasFile(`research/${p.id}.json`)) for (const s of readJson<any>(`research/${p.id}.json`).sources ?? []) if (hostKey(s.url) && SITES[hostKey(s.url)!].test(s.url)) urls.add(s.url);
    if (!DISC) try {
      for (const u of await search(`${p.name} ${p.builder.name} Noida`)) if (hostKey(u) && SITES[hostKey(u)!].test(u)) urls.add(u);
    } catch (e) {
      const msg = (e as Error).message;
      console.error(`search failed ${p.name}: ${msg}`);
      if (/\b(432|429|401|403)\b/.test(msg)) { console.error('quota or key problem: stopping; rerun resumes'); break; }
    }
    // one page per site per project, and only a page about this project
    const perSite = new Map<string, string>();
    for (const u of urls) { const h = hostKey(u)!; if (!perSite.has(h) && pageIsAbout(u, p.name, '')) perSite.set(h, u); }

    const rows: any[] = [];
    for (const [host, url] of perSite) {
      if (blocked.has(host)) { rows.push({ url, host, skipped: 'host refused us earlier' }); continue; }
      const wait = DELAY - (Date.now() - (lastHit[host] ?? 0));
      if (wait > 0) await sleep(wait);
      lastHit[host] = Date.now();
      try {
        const r = await fetchPage(url, host);
        rows.push({ url, host, ...r });
        if (r.stop) console.error(`${host} refused (${r.status}): leaving that host alone for this run`);
      } catch (e) { rows.push({ url, host, ok: false, error: (e as Error).message.slice(0, 80) }); }
    }
    out[p.id] = rows;
    if (n % 25 === 0) { writeJson('portal-pages.json', { generated_at: new Date().toISOString(), pages: out }); console.log(`${n} projects`); }
  }
  writeJson('portal-pages.json', { generated_at: new Date().toISOString(), pages: out });
  const rows = Object.values(out).flat();
  console.log({ projects: Object.keys(out).length, pages_saved: rows.filter((r: any) => r.ok).length, by_host: rows.filter((r: any) => r.ok).reduce((m: any, r: any) => ((m[r.host] = (m[r.host] ?? 0) + 1), m), {}), refused_hosts: [...blocked] });
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

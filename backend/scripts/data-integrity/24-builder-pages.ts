// Stage 24: project pages on the builders' own websites. Plain, paced, honest requests; robots.txt first; a refusal stops that site.
// 1. Repair the website on record with simple variants (www / no www, http / https, site root): 50 of 100 did not load as stored.
// 2. Discover project pages: the site's sitemap if it has one, otherwise the links on the home page and on its project-listing pages.
// 3. Match a project only when every token of its name is in one page slug (fewest extra words wins; a tie matches nothing).
// 4. Save the page the way stage 4 does, and record it in portal-pages-4.json flagged builder:true, so stage 19 labels it "builder".
// Run: npx tsx scripts/data-integrity/24-builder-pages.ts [--delay-ms 2500] [--limit-builders N]
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { assertDevDb, hasFile, normName, readJson, sleep, workPath, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const DELAY = Number(arg('delay-ms', '2500'));
const LIMIT_B = Number(arg('limit-builders', '100000'));
const UA = 'RealtyAsk-data-integrity/1.0 (+furqan.workk@gmail.com)';

const get = async (u: string) => {
  try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'text/html,application/xml' }, redirect: 'follow', signal: AbortSignal.timeout(20000) }); return { s: r.status, url: r.url, t: r.ok ? await r.text() : '' }; }
  catch { return { s: 0, url: u, t: '' }; }
};

function variants(site: string): string[] {
  let host = site.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  if (!host) return [];
  const bare = host.replace(/^www\./i, '');
  return [...new Set([`https://${host}`, `https://www.${bare}`, `https://${bare}`, `http://${host}`, `http://www.${bare}`])];
}

async function sitemapUrls(sm: string, depth = 0, out: string[] = []): Promise<string[]> {
  if (out.length > 5000) return out;
  const t = (await get(sm)).t; await sleep(600);
  for (const l of [...t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])) {
    if (/\.xml(\?|$)/i.test(l)) { if (depth < 2 && !/image|video|blog|news|post|category|tag|author/i.test(l)) await sitemapUrls(l, depth + 1, out); }
    else out.push(l);
  }
  return out;
}

const links = (html: string, base: string) => [...new Set([...html.matchAll(/href="([^"#?]+)"/gi)].map((m) => { try { return new URL(m[1], base).href; } catch { return ''; } }).filter(Boolean))];

const textOf = (html: string) => {
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => 'JSON-LD: ' + m[1].replace(/\s+/g, ' ').trim());
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|td|th)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return [...ld, body].join('\n').slice(0, 40000);
};

async function main() {
  const out: Record<string, any[]> = hasFile('portal-pages-4.json') ? readJson<{ pages: Record<string, any[]> }>('portal-pages-4.json').pages : {};
  const builders = (await prisma.builder.findMany({ select: { id: true, name: true, website: true, projects: { where: { archived_duplicate_of: null }, select: { id: true, name: true } } } })).filter((b) => b.website && b.projects.length).slice(0, LIMIT_B);
  // Addresses that stage 26 tested and accepted replace the stored (invented) ones, and those builders' projects are retried.
  const override: Record<string, { website: string }> = hasFile('builder-websites-override.json') ? readJson<{ accepted: Record<string, { website: string }> }>('builder-websites-override.json').accepted : {};
  for (const b of builders) if (override[b.name]) for (const p of b.projects) delete out[p.id];
  const stats = { builders: builders.length, resolved: 0, repaired: 0, robots_blocked: 0, with_pages: 0, projects_matched: 0, pages_saved: 0, unreachable: [] as string[] };
  let idx = 0;
  const worker = async () => {
    while (idx < builders.length) {
      const b = builders[idx++];
      if (b.projects.every((p) => out[p.id] !== undefined)) continue;
      // 1. a working origin
      let home: { s: number; url: string; t: string } | null = null, repaired = false;
      for (const [i, v] of variants(override[b.name]?.website ?? b.website!).entries()) { const h = await get(v); await sleep(400); if (h.s === 200 && h.t) { home = h; repaired = i > 0; break; } }
      if (!home) { stats.unreachable.push(b.name); for (const p of b.projects) out[p.id] = []; continue; }
      stats.resolved++; if (repaired) stats.repaired++;
      const origin = new URL(home.url).origin;
      // 2. robots, then discovery
      const rob = await get(origin + '/robots.txt'); await sleep(500);
      let star = false, all = false; const sms: string[] = [];
      for (const l of rob.t.split(/\r?\n/)) { const x = l.trim(); if (/^user-agent:\s*\*/i.test(x)) star = true; else if (/^user-agent:/i.test(x)) star = false; else if (star && /^disallow:\s*\/\s*$/i.test(x)) all = true; if (/^sitemap:/i.test(x)) sms.push(x.slice(8).trim()); }
      if (all) { stats.robots_blocked++; for (const p of b.projects) out[p.id] = []; continue; }
      let urls: string[] = [];
      for (const c of [...new Set([...sms, origin + '/sitemap.xml', origin + '/sitemap_index.xml'])].slice(0, 4)) { urls = await sitemapUrls(c); if (urls.length) break; }
      if (!urls.length) { // no sitemap: home links, then the project-listing pages they point to
        const first = links(home.t, home.url).filter((u) => u.startsWith(origin));
        urls = [...first];
        for (const lp of first.filter((u) => /project|propert|residential|ongoing|completed|portfolio|our-|upcoming/i.test(new URL(u).pathname)).slice(0, 8)) { const pg = await get(lp); await sleep(DELAY); urls.push(...links(pg.t, lp).filter((u) => u.startsWith(origin))); }
        urls = [...new Set(urls)].slice(0, 1500);
      }
      // 3. match
      const rows: Record<string, any[]> = {};
      for (const pr of b.projects) {
        rows[pr.id] = [];
        const mine = normName(pr.name).split(' ').filter(Boolean);
        if (!mine.length) continue;
        const cands = urls.map((u) => { let segs: string[] = []; try { segs = new URL(u).pathname.toLowerCase().split('/').filter(Boolean); } catch { /* skip */ } const toks = segs.join('-').split(/[^a-z0-9]+/).filter(Boolean); return { u, toks, last: (segs[segs.length - 1] ?? '').replace(/[^a-z0-9]/g, '') }; })
          .filter((c) => (mine.length >= 2 ? mine.every((t) => c.toks.includes(t)) : c.last === mine[0]))
          .map((c) => ({ ...c, extra: c.toks.length - mine.length })).sort((a, z) => a.extra - z.extra);
        if (!cands.length || (cands.length > 1 && cands[0].extra === cands[1].extra && cands[0].u !== cands[1].u)) continue;
        // 4. fetch
        const url = cands[0].u; await sleep(DELAY);
        const res = await get(url);
        if (res.s !== 200 || res.t.length < 500) { rows[pr.id].push({ url, host: new URL(url).host, ok: false, status: res.s }); continue; }
        const text = textOf(res.t);
        const path = workPath(`pages/${createHash('sha1').update(url).digest('hex')}.txt`);
        mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${url}\n\n${text}`);
        rows[pr.id].push({ url, host: new URL(url).host, ok: true, status: 200, chars: text.length, builder: true });
        stats.pages_saved++;
      }
      for (const [id, r] of Object.entries(rows)) { out[id] = r; if (r.some((x) => x.ok)) stats.projects_matched++; }
      if (Object.values(rows).some((r) => r.some((x) => x.ok))) stats.with_pages++;
      writeJson('portal-pages-4.json', { generated_at: new Date().toISOString(), pages: out });
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  writeJson('portal-pages-4.json', { generated_at: new Date().toISOString(), pages: out });
  console.log({ ...stats, unreachable: stats.unreachable.length });
  writeJson('builder-unreachable.json', { builders: stats.unreachable });
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

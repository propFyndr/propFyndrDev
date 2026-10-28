// Stage 18: project pages from Whitehat Realty, Realty Assistant and Investors Clinic, found through each site's own sitemap.
// robots.txt allows them (checked 2026-10-28). Plain, paced, honest requests; the first 403/406/429 or a challenge page stops that host.
// A page is matched only when every token of the project's name is in the page slug; among matches the slug with the fewest extra
// words wins, and a tie matches nothing. Pages are saved the way stage 4 saves them, so stage 19 extracts from them unchanged.
// Run: npx tsx scripts/data-integrity/18-sitemap-pages.ts [--limit N] [--delay-ms 3000]
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { assertDevDb, hasFile, normName, readJson, sleep, workPath, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const arg = (n: string, d: string) => (process.argv.includes(`--${n}`) ? process.argv[process.argv.indexOf(`--${n}`) + 1] : d);
const LIMIT = Number(arg('limit', '100000'));
const DELAY = Number(arg('delay-ms', '3000'));
const UA = 'RealtyAsk-data-integrity/1.0 (+furqan.workk@gmail.com)';

const SITES: Record<string, { sitemap: string; page: RegExp }> = {
  'whitehat.realty': { sitemap: 'https://www.whitehat.realty/sitemap.xml', page: /\/projects\/[^/]+\/?$/ },
  'realtyassistant.in': { sitemap: 'https://realtyassistant.in/sitemap.xml', page: /\/property\/[^/]+\/?$/ },
  'investorsclinic.in': { sitemap: 'https://investorsclinic.in/sitemap.xml', page: /\/project\/[^/]+\/?$/ },
};
const blocked = new Set<string>();

async function getText(u: string): Promise<string> {
  try {
    const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
    return r.ok ? await r.text() : '';
  } catch { return ''; }
}

async function sitemapUrls(sm: string, depth = 0, out: string[] = []): Promise<string[]> {
  const t = await getText(sm);
  for (const l of [...t.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])) {
    if (/\.xml(\?|$)/i.test(l)) { if (depth < 2 && !/image|video|blog|news|post|category|tag|author/i.test(l)) await sitemapUrls(l, depth + 1, out); }
    else out.push(l);
  }
  return out;
}

const textOf = (html: string) => {
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => 'JSON-LD: ' + m[1].replace(/\s+/g, ' ').trim());
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|td|th)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return [...ld, body].join('\n').slice(0, 40000);
};

async function main() {
  // sitemap URL lists, cached
  const pages: Record<string, string[]> = {};
  for (const [host, cfg] of Object.entries(SITES)) {
    const f = `sitemap-${host}.json`;
    pages[host] = hasFile(f) ? readJson<{ urls: string[] }>(f).urls : (await sitemapUrls(cfg.sitemap)).filter((u) => cfg.page.test(new URL(u).pathname));
    if (!hasFile(f)) writeJson(f, { fetched_at: new Date().toISOString(), urls: pages[host] });
    console.log(`${host}: ${pages[host].length} project pages in sitemap`);
  }

  const out: Record<string, any[]> = hasFile('portal-pages-2.json') ? readJson<{ pages: Record<string, any[]> }>('portal-pages-2.json').pages : {};
  const projects = await prisma.project.findMany({ where: { archived_duplicate_of: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const lastHit: Record<string, number> = {};
  let n = 0;
  for (const p of projects) {
    if (out[p.id] !== undefined || n >= LIMIT) continue;
    n++;
    const mine = normName(p.name).split(' ').filter(Boolean);
    const rows: any[] = [];
    for (const [host, urls] of Object.entries(pages)) {
      if (mine.length < 2) continue; // a one-word name matches too many slugs
      const cands = urls
        .map((u) => ({ u, toks: new URL(u).pathname.split('/').filter(Boolean).pop()!.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean) }))
        .filter((c) => mine.every((t) => c.toks.includes(t)))
        .map((c) => ({ ...c, extra: c.toks.length - mine.length }))
        .sort((a, b) => a.extra - b.extra);
      if (!cands.length || (cands.length > 1 && cands[0].extra === cands[1].extra)) continue; // none, or a tie
      const url = cands[0].u;
      if (blocked.has(host)) { rows.push({ url, host, skipped: 'host refused us earlier' }); continue; }
      const wait = DELAY - (Date.now() - (lastHit[host] ?? 0));
      if (wait > 0) await sleep(wait);
      lastHit[host] = Date.now();
      try {
        const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: AbortSignal.timeout(30000) });
        if ([403, 406, 429, 503].includes(res.status)) { blocked.add(host); rows.push({ url, host, ok: false, status: res.status }); console.error(`${host} refused (${res.status}): leaving it alone`); continue; }
        if (!res.ok) { rows.push({ url, host, ok: false, status: res.status }); continue; }
        const html = await res.text();
        const text = textOf(html);
        const path = workPath(`pages/${createHash('sha1').update(url).digest('hex')}.txt`);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${url}\n\n${text}`);
        rows.push({ url, host, ok: true, status: 200, chars: text.length });
      } catch (e) { rows.push({ url, host, ok: false, error: (e as Error).message.slice(0, 80) }); }
    }
    out[p.id] = rows;
    if (n % 25 === 0) { writeJson('portal-pages-2.json', { generated_at: new Date().toISOString(), pages: out }); console.log(`${n} projects`); }
  }
  writeJson('portal-pages-2.json', { generated_at: new Date().toISOString(), pages: out });
  const rows = Object.values(out).flat();
  console.log({ projects: Object.keys(out).length, pages_saved: rows.filter((r: any) => r.ok).length, by_host: rows.filter((r: any) => r.ok).reduce((m: any, r: any) => ((m[r.host] = (m[r.host] ?? 0) + 1), m), {}), projects_with_a_page: Object.values(out).filter((r: any) => r.some((x: any) => x.ok)).length, refused_hosts: [...blocked] });
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

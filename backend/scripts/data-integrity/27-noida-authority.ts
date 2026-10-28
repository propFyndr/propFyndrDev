// Stage 27: Noida Authority "Group Housing Builder Projects Information" (pims.mynoida.org.in), the official list behind the Authority's
// public dashboard. One POST with the page's own paging parameters returns all 115 projects: sanctioned flats, towers sanctioned vs towers
// with OC issued, sub-leases executed, pending dues, defaulter status. Rows are keyed by allottee + plot, so matching to our projects uses
// the builder AND the sector; an ambiguous match is left unmatched. Dev DB read only; writes noida-authority.json and noida-authority-matches.json.
// This covers Noida sectors only: Greater Noida (West) projects belong to the Greater Noida Authority, whose site is unreachable from here.
// Run: npx tsx scripts/data-integrity/27-noida-authority.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, hasFile, readJson, sleep, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const UA = 'RealtyAsk-data-integrity/1.0 (+furqan.workk@gmail.com)';
const BASE = 'https://pims.mynoida.org.in';

async function fetchAll(): Promise<any[]> {
  const body = new URLSearchParams({ sort: 'Id-asc', page: '1', pageSize: '500', group: '', filter: '', take: '500', skip: '0' });
  const r = await fetch(`${BASE}/GroupHousing/GetGroupHousingProject?AppType=1`, { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8', 'x-requested-with': 'XMLHttpRequest' }, body, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`pims ${r.status}`);
  return ((await r.json()) as { Data: any[] }).Data;
}

// A plot number encodes its sector: GH-01/A/74 is Sector 74, GH-05/110 is Sector 110. Our own sector strings read "Sector 74".
const sectorOf = (s: unknown) => {
  const t = String(s ?? '').trim();
  const slash = /\/(\d{1,3})\s*$/.exec(t);
  if (slash) return slash[1];
  const m = /sector[\s-]*(\d{1,3})/i.exec(t);
  return m ? m[1] : null;
};

/** Each detail page shows its values in read-only form fields. */
async function detail(pid: number): Promise<Record<string, string>> {
  const r = await fetch(`${BASE}/GroupHousing/GroupHousingProjectDetail/${pid}`, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(40000) });
  const h = r.ok ? await r.text() : '';
  return Object.fromEntries([...h.matchAll(/<input[^>]*\bid="([^"]+)"[^>]*\bvalue="([^"]*)"/g)].map((m) => [m[1], m[2].trim()]));
}
// Words every builder uses are not evidence of the same builder ("Paras Buildtech" matched "Shubhkamna Buildtech" on one of them).
const generic = /group|infra\w*|developers?|builders?|build\w*|properties|realty|realtors?|homes?|housing|limited|private|pvt|ltd|india|projects?|construction\w*|\(p\)|co\b|company|corp|and|the|towers?|residency|estates?|ventures?|enterprises?|promoters?|township|city|real\b|buildwell|infrawell/g;
const btoks = (s: string) => s.toLowerCase().replace(/[().,&]/g, ' ').replace(generic, ' ').split(/\s+/).filter((t) => t.length >= 3);

async function main() {
  const rows = await fetchAll();
  writeJson('noida-authority.json', { read_at: '2026-10-28', source: `${BASE}/GroupHousing/GroupHousingProject`, rows });
  // detail pages, cached, 2 s apart
  const cache: Record<string, Record<string, string>> = hasFile('noida-authority-detail.json') ? readJson<{ details: Record<string, Record<string, string>> }>('noida-authority-detail.json').details : {};
  for (const r of rows) { if (cache[r.PID]) continue; try { cache[r.PID] = await detail(r.PID); } catch { /* retried next run */ } await sleep(2000); }
  writeJson('noida-authority-detail.json', { read_at: '2026-10-28', details: cache });
  for (const r of rows) Object.assign(r, { d: cache[r.PID] ?? {} });
  console.log(`rows ${rows.length} | details read ${Object.keys(cache).length} | detail field ids:`, Object.keys(rows.find((r) => Object.keys(r.d).length)?.d ?? {}).join(','));

  const projects = await prisma.project.findMany({ where: { archived_duplicate_of: null }, select: { id: true, name: true, sector: true, builder: { select: { name: true } } } });
  const matches: Record<string, any> = {}; let ambiguous = 0;
  for (const r of rows) {
    const rs = sectorOf(r.Location);
    const rt = btoks(String(r.ProjectName ?? ''));
    if (!rs || !rt.length) continue;
    const c = projects.filter((p) => sectorOf(p.sector) === rs && btoks(p.builder.name + ' ' + p.name).some((t) => rt.includes(t)));
    if (c.length === 1) matches[c[0].id] = { ...r, how: `builder + sector ${rs}` };
    else if (c.length > 1) ambiguous++;
  }
  writeJson('noida-authority-matches.json', { read_at: '2026-10-28', matches });
  const m = Object.values(matches) as any[];
  console.log({ authority_rows: rows.length, matched_to_one_of_our_projects: m.length, ambiguous_rows_skipped: ambiguous });
  console.log(m.slice(0, 8).map((x) => `${x.ProjectName.slice(0, 26)} | S${x.Sector} | sanctioned ${x.Sanctioned} | towers ${x.OCIssuedNumberOfTower ?? '-'}/${x.TowerSanctioned ?? '-'} | OC ${x.OCissued ?? '-'} | dues ${x.PendencyOfDues ?? '-'}`).join('\n'));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

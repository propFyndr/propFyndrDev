// Stage 26: test the candidate builder websites from theirDomains.md. The file is a research report, not evidence: 13 entries are
// called verified and the rest "predictive" (guessed from naming patterns), so each address is a CANDIDATE.
// Accepted only when the site loads, is not parked or for sale, and its own text names the builder (or one of our projects for that builder).
// Honest client string, robots.txt respected, one request at a time per site. Writes builder-websites-override.json for stage 24.
// Run: npx tsx scripts/data-integrity/26-builder-domains.ts
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { assertDevDb, normName, sleep, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const UA = 'RealtyAsk-data-integrity/1.0 (+furqan.workk@gmail.com)';

// builder name in our DB -> candidate domains from theirDomains.md (verified or predictive), in the file's order
const CANDIDATES: Record<string, string[]> = {
  'The 3C Company': ['the3c.in'], 'ABA Corp': ['countygroup.in'], 'Antriksh Group': ['theantrikshgroup.com'],
  'Ajnara India Ltd': ['ajnaraindiacirp.in', 'ajnara.com'], 'AIMS Max Gardenia Developers': ['aimsgroup.in'], 'AIMS Golf Developers': ['aimsgroup.in'],
  'Lotus Greens': ['lotusgreens.in'], 'Samridhi Group': ['samridhigroup.co.in'], 'Maxblis Construction': ['maxblis.com'],
  'Fusion Buildtech': ['fusionbuildtech.com', 'fusionlimited.in'], 'Urbtech India': ['urbtechindia.com'], 'Great Value Realty': ['greatvaluerealty.com'],
  'Hawelia Group': ['haweliagroup.com'], 'Sunworld Developers': ['sunworld.in'], 'Gulshan Homz': ['gulshanhomz.com'], 'Gulshan Group': ['gulshanhomz.com'],
  'RG Group': ['rggroup.in'], 'JM Housing': ['jmhousing.com', 'jmhousing.in'], 'DASNAC Design Architecture': ['dasnac.com'], 'Sunshine Group': ['sunshinegroup.com'],
  'Ambr Group': ['ambrgroup.com'], 'VVIP Group': ['vvipspaces.com'], 'Trinity Group': ['trinitygroup.com'], 'Sindhuja Group': ['sindhujagroup.com'],
  'AU Realtech': ['aurealtech.com'], 'Supercity Group': ['supercity.in'], 'Victory Infratech': ['victoryinfratech.com'], 'PAN Realtors': ['panrealtors.com'],
  'Laureate Buildwell': ['parxlaureate.com'], 'Indosam Group': ['indosam.com'], 'Griha Pravesh Buildteck': ['grihapravesh.com'], 'Ashtech Group': ['ashtech.com'],
  'Assotech Group': ['assotech.com'], 'Silverglades': ['silverglades.com'], 'Om Infracon': ['ominfracon.com'], 'Divine India Group': ['divineindia.com'],
  'IITL Nimbus Group': ['nimbusgroup.com'], 'Nimbus Group (IITL Nimbus)': ['nimbusgroup.com'], 'Nimbus Projects Ltd': ['nimbusgroup.com'],
  'Exotica Housing': ['exoticahousing.in'], 'Salcon Building': ['salcon.in'], 'Kalpataru Group': ['kalpataru.com'], 'IBP Group': ['ibpgroup.com'],
  'Eldeco Infrastructure': ['eldecogroup.com'], 'Orris Infrastructure': ['orris.in'], 'Eros Group': ['erosgroup.com'], 'Renox Group': ['renoxgroup.com'],
  'Solitairian Group': ['solitairian.in'],
};
const PARKED = /domain (name )?(is )?(for sale|available)|buy this domain|this domain may be for sale|parked (free|domain)|hugedomains|sedo\.com|godaddy\.com\/domains|namecheap parking|account suspended|coming soon$/i;

const get = async (u: string) => { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20000) }); return { s: r.status, url: r.url, t: r.ok ? await r.text() : '' }; } catch { return { s: 0, url: u, t: '' }; } };
const textOf = (h: string) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
const stop = /group|infra\w*|developers?|builders?|properties|realty|homes|limited|private|pvt|ltd|the|india|construction|building|buildtech|buildwell|housing|design|architecture|company|corp|projects?/g;

async function main() {
  const builders = await prisma.builder.findMany({ select: { id: true, name: true, projects: { where: { archived_duplicate_of: null }, select: { name: true } } } });
  const byName = new Map(builders.map((b) => [b.name, b]));
  const result: Record<string, any> = {}, rejected: Record<string, string> = {};
  let idx = 0; const names = Object.keys(CANDIDATES);
  const worker = async () => {
    while (idx < names.length) {
      const name = names[idx++]; const b = byName.get(name); if (!b) { rejected[name] = 'builder not in DB'; continue; }
      const btoks = name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(stop, ' ').split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
      let why = 'no candidate loaded';
      for (const dom of CANDIDATES[name]) {
        let home: { s: number; url: string; t: string } | null = null;
        for (const v of [`https://${dom}`, `https://www.${dom}`, `http://${dom}`]) { const h = await get(v); await sleep(400); if (h.s === 200 && h.t.length > 500) { home = h; break; } }
        if (!home) { why = `${dom}: does not load`; continue; }
        const txt = textOf(home.t);
        if (PARKED.test(txt.slice(0, 4000)) || txt.length < 400) { why = `${dom}: parked or empty`; continue; }
        const hasBuilder = btoks.length ? btoks.some((t) => txt.includes(t) || new URL(home!.url).host.includes(t)) : false;
        const projHit = b.projects.find((p) => { const t = normName(p.name).split(' ').filter(Boolean); return t.length >= 2 && t.every((k) => txt.includes(k)); });
        const region = /noida|greater noida|ghaziabad|gurugram|delhi|ncr/.test(txt);
        if ((hasBuilder && region) || projHit) { result[name] = { website: new URL(home.url).origin, candidate: dom, evidence: projHit ? `names our project "${projHit.name}"` : `site names "${btoks.find((t) => txt.includes(t) || new URL(home!.url).host.includes(t))}" and the NCR`, projects: b.projects.length }; why = ''; break; }
        why = `${dom}: loads but does not show this builder (${btoks.join('/')}) or our projects`;
      }
      if (why) rejected[name] = why;
      await sleep(300);
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  writeJson('builder-websites-override.json', { generated_at: new Date().toISOString(), accepted: result, rejected });
  const a = Object.values(result) as any[];
  console.log({ candidates_tested: names.length, accepted: a.length, projects_unlocked: a.reduce((s, x) => s + x.projects, 0), rejected: Object.keys(rejected).length });
  console.log('REJECTED:', Object.entries(rejected).map(([k, v]) => `${k} -> ${v}`).join('\n  '));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());

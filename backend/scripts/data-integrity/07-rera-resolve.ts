// Stage 7: find the right RERA number for every project that does not already have a verified one.
// Sources: RERA numbers stated on portal pages we already read (stage 4), then a targeted search.
// Every candidate must exist in the UP-RERA registry (stage 1) and pass a name check there.
// No DB access. Run: npx tsx scripts/data-integrity/07-rera-resolve.ts [--max-searches 300] [--skip-search]
import { ReraRow, normName, pageIsAbout, readJson, sleep, writeJson, hasFile } from './lib';
import { readFileSync } from 'fs';

const arg = (n: string, d: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const MAX_SEARCHES = Number(arg('max-searches', '300'));
const SKIP_SEARCH = process.argv.includes('--skip-search');

const NUM = /UPRERAPRJ\d+(?:\/\d{2}\/\d{4})?/g;
const tokens = (s: string) => new Set(normName(s).split(' ').filter(Boolean));
const jaccard = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i / (a.size + b.size - i);
};

interface Hit { number: string; url: string; quote: string }
interface Match { project_id: string; name: string; builder: string; db_rera: string | null; method: string; registry?: ReraRow; stored_number_belongs_to?: unknown }

// --variant portal: a second pass restricted to the portals that print "RERA ID:UPRERAPRJ…", for projects the first query missed.
const VARIANT = arg('variant', 'default');
const PORTAL_DOMAINS = ['magicbricks.com', '99acres.com', 'squareyards.com', 'housing.com'];

async function tavily(query: string, domains?: string[]): Promise<{ url: string; text: string }[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: process.env.TAVILY_NEW || process.env.TAVILY_API_KEY, query, search_depth: 'basic', max_results: 8, include_answer: false, include_raw_content: true, ...(domains ? { include_domains: domains } : {}) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const d = (await res.json()) as { results?: { url: string; title: string; content?: string; raw_content?: string }[] };
  return (d.results ?? []).map((r) => ({ url: r.url, text: `${r.title}\n${r.content ?? ''}\n${r.raw_content ?? ''}` }));
}

/** Every UPRERAPRJ number in a text, with ~100 chars of context. Context must mention RERA. */
function numbersIn(text: string, url: string): Hit[] {
  const out: Hit[] = [];
  for (const m of text.matchAll(NUM)) {
    const i = m.index ?? 0;
    const quote = text.slice(Math.max(0, i - 80), i + m[0].length + 20).replace(/\s+/g, ' ');
    if (/rera/i.test(quote)) out.push({ number: m[0], url, quote });
  }
  return out;
}

async function main() {
  const idx = readJson<{ rows: ReraRow[] }>('rera-index.json').rows;
  const byReg = new Map(idx.map((r) => [r.rera_number, r]));
  const match = readJson<{ results: Match[] }>('match.json').results;
  const todo = match.filter((m) => m.method !== 'exact');
  console.log(`projects needing a RERA number: ${todo.length}`);

  const hits = new Map<string, Hit[]>(); // project_id -> hits
  const add = (id: string, h: Hit[]) => hits.set(id, [...(hits.get(id) ?? []), ...h]);

  // Resume state: which projects were already searched, and the hits found. Numbers resolved by an earlier run are carried over.
  const STATE = 'rera-search-state.json';
  const searched = new Set<string>();
  if (hasFile(STATE)) {
    const s = readJson<{ searched: string[]; hits: Record<string, Hit[]> }>(STATE);
    s.searched.forEach((x) => searched.add(x));
    for (const [id, h] of Object.entries(s.hits)) add(id, h);
  } else if (arg('seed-from-log', '') && hasFile('rera-resolved.json')) {
    // First resume after a quota stop: every unresolved project except those whose search failed counts as searched.
    const failed = new Set([...readFileSync(arg('seed-from-log', ''), 'utf8').matchAll(/search failed for (.+?): Tavily/g)].map((m) => m[1]));
    const old = readJson<{ unresolved: { project_id: string; name: string }[] }>('rera-resolved.json');
    for (const u of old.unresolved) if (!failed.has(u.name)) searched.add(u.project_id);
    console.log(`seeded from log: ${searched.size} already searched, ${failed.size} to retry`);
  }
  const carried = new Map<string, any>((hasFile('rera-resolved.json') ? readJson<{ resolved: any[] }>('rera-resolved.json').resolved : []).map((r) => [r.project_id, r]));
  const saveState = () => writeJson(STATE, { searched: [...searched], hits: Object.fromEntries(hits) });

  // Step 1: numbers stated on the portal pages stage 4 already read.
  for (const m of todo) {
    if (!hasFile(`research/${m.project_id}.json`)) continue;
    const r = readJson<any>(`research/${m.project_id}.json`);
    for (const c of r.fields?.rera_number_stated?.candidates ?? []) {
      for (const n of String(c.value).match(NUM) ?? []) add(m.project_id, [{ number: n, url: c.source_url, quote: c.quote }]);
    }
  }

  // Judge the hits for one project against the registry.
  const judge = (m: Match) => {
    const mine = tokens(m.name);
    const builderToks = normName(m.builder).split(' ').filter((t) => t.length >= 4 && !/group|infra|developers?|builders?|properties|realty|homes/.test(t));
    const byNum = new Map<string, Hit[]>();
    for (const h of hits.get(m.project_id) ?? []) {
      if (!pageIsAbout(h.url, m.name, h.quote)) continue; // a number on a page about another project
      byNum.set(h.number, [...(byNum.get(h.number) ?? []), h]);
    }
    const cands = [...byNum].flatMap(([number, hs]) => {
      const row = byReg.get(number);
      if (!row || !/gautam buddha|ghaziabad/i.test(row.district)) return [];
      const nameScore = jaccard(mine, tokens(row.project_name));
      const builderOk = builderToks.some((t) => (row.promoter + ' ' + row.project_name).toLowerCase().includes(t));
      const urls = new Set(hs.map((h) => h.url));
      const agreesWithRegistryName = m.registry?.rera_number === number;
      let confidence: 'high' | 'medium' | null = null;
      if (nameScore >= 0.5 && (urls.size >= 2 || agreesWithRegistryName)) confidence = 'high';
      else if (nameScore >= 0.5) confidence = 'medium';
      else if (builderOk && urls.size >= 2) confidence = 'medium';
      return confidence ? [{ number, row, nameScore, confidence, sources: hs.slice(0, 3).map((h) => ({ url: h.url, quote: h.quote })) }] : [];
    });
    cands.sort((a, b) => b.nameScore - a.nameScore || (a.confidence === 'high' ? -1 : 1));
    // Two different numbers with the same name score is a phase/tower split we cannot choose between.
    if (cands.length > 1 && cands[0].nameScore === cands[1].nameScore && cands[0].number !== cands[1].number) return { ambiguous: cands.slice(0, 3) };
    return { best: cands[0] };
  };

  const isResolved = (m: Match) => !!(judge(m) as any).best;

  // Step 2: targeted search for the rest.
  if (!SKIP_SEARCH) {
    let searches = 0;
    const key = (id: string) => (VARIANT === 'portal' ? `${id}:portal` : id); // each query variant is tracked separately
    for (const m of todo.filter((x) => !isResolved(x) && !carried.has(x.project_id) && !searched.has(key(x.project_id)))) {
      if (searches >= MAX_SEARCHES) break;
      searches++;
      try {
        const results = VARIANT === 'portal'
          ? await tavily(`${m.name} ${m.builder} Noida RERA ID`, PORTAL_DOMAINS)
          : await tavily(`"${m.name}" ${m.builder} Noida RERA registration number UPRERAPRJ`);
        for (const r of results) add(m.project_id, numbersIn(r.text, r.url));
        searched.add(key(m.project_id));
      } catch (e) {
        const msg = (e as Error).message;
        console.error(`search failed for ${m.name}: ${msg}`);
        if (/\b(432|429|401|403)\b/.test(msg)) { console.error('quota or key problem: stopping; rerun resumes'); break; }
      }
      if (searches % 25 === 0) { console.log(`searched ${searches}`); saveState(); }
      await sleep(800);
    }
    saveState();
    console.log(`targeted searches: ${searches}`);
  }

  const resolved: any[] = [];
  const unresolved: any[] = [];
  for (const m of todo) {
    const j = judge(m) as any;
    if (!j.best && carried.has(m.project_id)) { resolved.push(carried.get(m.project_id)); continue; } // found by an earlier run
    if (j.best) {
      resolved.push({
        project_id: m.project_id, name: m.name, builder: m.builder, old: m.db_rera, new: j.best.number, confidence: j.best.confidence,
        name_score: +j.best.nameScore.toFixed(2), registry: { name: j.best.row.project_name, promoter: j.best.row.promoter, district: j.best.row.district, summary_path: j.best.row.summary_path },
        sources: j.best.sources, was_wrong_project: !!m.stored_number_belongs_to,
      });
    } else unresolved.push({ project_id: m.project_id, name: m.name, old: m.db_rera, was_wrong_project: !!m.stored_number_belongs_to, reason: j.ambiguous ? 'two valid numbers, cannot choose' : 'no number found that passes the registry check', candidates: j.ambiguous?.map((c: any) => ({ number: c.number, registry_name: c.row.project_name })) });
  }

  const tally = { resolved: resolved.length, high: resolved.filter((r) => r.confidence === 'high').length, medium: resolved.filter((r) => r.confidence === 'medium').length, unresolved: unresolved.length, wrong_project_resolved: resolved.filter((r) => r.was_wrong_project).length, wrong_project_unresolved: unresolved.filter((r) => r.was_wrong_project).length };
  const p = writeJson('rera-resolved.json', { generated_at: new Date().toISOString(), tally, resolved, unresolved });
  console.log(tally, '->', p);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

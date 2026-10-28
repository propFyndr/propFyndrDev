// Stage 3: read each matched project's UP-RERA summary page and stage evidence + proposals.
// Writes nothing to any database. Resumable: rerun skips projects already fetched.
// Run: npx tsx scripts/data-integrity/03-rera-evidence.ts [--limit N]
import { BASE, ReraSession, hasFile, readJson, sleep, writeJson, type ReraRow } from './lib';

interface MatchResult {
  project_id: string;
  name: string;
  db_rera: string | null;
  method: 'exact' | 'name_unique' | 'ambiguous' | 'none';
  registry?: ReraRow;
}

interface Evidence {
  project_id: string;
  match_method: string;
  source_url: string;
  fetched_at: string;
  registry: Record<string, string | null>;
  quote: string; // verbatim text the values were read from
}

/** Page text as lines; a label's value is the next non-empty line. */
function lines(html: string): string[] {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|td|tr|li|h\d)>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function after(ls: string[], label: string, from = 0): string | null {
  const i = ls.findIndex((l, n) => n >= from && l.toLowerCase().replace(/\s*:$/, '') === label.toLowerCase());
  return i >= 0 && ls[i + 1] ? ls[i + 1] : null;
}

export function parseSummary(html: string) {
  const ls = lines(html);
  const start = ls.findIndex((l) => l === 'Project Basic Information');
  const end = ls.findIndex((l) => l.startsWith('VIEW PROJECT IN DETAIL'));
  const block = ls.slice(Math.max(start, 0), end > 0 ? end : undefined);
  const promoterAt = block.findIndex((l) => l === 'Promoter Detail');
  return {
    project_name: after(block, 'Project Name'),
    rera_number: after(block, 'Registration Number'),
    reg_date: after(block, 'Project Registration Date'),
    project_type: after(block, 'Project Type'),
    proposed_period_months: after(block, 'Proposed Period'),
    original_start_date: after(block, 'Original Start Date'),
    modified_start_date: after(block, 'Modified Start Date'),
    declared_completion: after(block, 'Declared Date Of Completion'),
    district: after(block, 'District'),
    promoter_name: promoterAt >= 0 ? after(block, 'Name', promoterAt) : null,
    promoter_type: after(block, 'Applicant Type'),
    promoter_project_count: after(block, 'Number of the projects of the promoter'),
    promoter_complaints_total: after(block, 'Total complaints against the promoter'),
    project_complaints: after(block, 'Total no. of complaints in respect to this Project'),
    quote: block.join(' | ').slice(0, 1500),
  };
}

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : Infinity;

  const match = readJson<{ results: MatchResult[] }>('match.json').results;
  const targets = match.filter((m) => (m.method === 'exact' || m.method === 'name_unique') && m.registry?.summary_path);
  const prior: Evidence[] = hasFile('rera-evidence.json') ? readJson<{ evidence: Evidence[] }>('rera-evidence.json').evidence : [];
  // Evidence gathered under an older match (a different registry row for the project) is dropped, not reused.
  const want = new Map(targets.map((t) => [t.project_id, t.registry!.rera_number]));
  const done = prior.filter((d) => want.get(d.project_id) === d.registry.rera_number);
  const seen = new Set(done.map((d) => d.project_id));

  const session = new ReraSession();
  await session.get(BASE + '/'); // establish the cookie
  const proposals: unknown[] = [];
  let fetched = 0;

  for (const t of targets) {
    if (seen.has(t.project_id) || fetched >= limit) continue;
    const url = `${BASE}/${t.registry!.summary_path}`;
    try {
      const res = await session.get(url);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      const parsed = parseSummary(await res.text());
      done.push({
        project_id: t.project_id,
        match_method: t.method,
        source_url: url,
        fetched_at: new Date().toISOString(),
        registry: parsed as unknown as Record<string, string | null>,
        quote: parsed.quote,
      });
      fetched++;
      console.log(`${fetched}. ${t.name} -> ${parsed.rera_number} (${parsed.promoter_name})`);
    } catch (e) {
      console.error(`FAILED ${t.name}: ${(e as Error).message}`);
    }
    if (fetched % 20 === 0) writeJson('rera-evidence.json', { evidence: done }); // checkpoint
    await sleep(1500);
  }

  // The one DB-column proposal this source can support: the registration number itself.
  for (const e of done) {
    const m = match.find((x) => x.project_id === e.project_id)!;
    const regNo = e.registry.rera_number;
    if (regNo && regNo !== m.db_rera) {
      proposals.push({
        project_id: e.project_id,
        field: 'rera_number',
        old_value: m.db_rera,
        new_value: regNo,
        source_url: e.source_url,
        fetched_at: e.fetched_at,
        quote: `Registration Number | ${regNo}`,
        // A number found by project name alone is a candidate, not a fact: a human confirms the promoter.
        needs_review: e.match_method !== 'exact',
      });
    }
  }

  const path = writeJson('rera-evidence.json', { evidence: done, proposals });
  console.log(`evidence=${done.length} proposals=${proposals.length} -> ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

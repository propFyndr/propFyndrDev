// Stage 28: UP-RERA complaint counts as PENDING drafts. Dev DB only.
//
// Stage 3 already reads "Total no. of complaints in respect to this Project" and "Total complaints
// against the promoter" from each matched project's UP-RERA summary page, but the figures stayed in
// rera-evidence.json and never reached a table. This stages them as pending rows in
// project_field_drafts (field 'rera_complaints') with the page URL and the date it was read.
// Never touches a project column. project_field_drafts is in FORBIDDEN_RELATIONS, so drafts never
// reach a buyer or a prompt until a person approves them.
//
// Dry run by default. Idempotent: replaces only its own pending rows. Backs up before writing.
// Run (from backend/): DI_WORK_DIR=<work dir> npx tsx scripts/data-integrity/28-complaints-drafts.ts [--apply]
import { PrismaClient } from '@prisma/client';
import { assertDevDb, readJson, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

export const FIELD = 'rera_complaints';
export const LABEL = 'UP-RERA project summary, complaints (di-pipeline)';

interface EvidenceRow {
  project_id: string;
  match_method: string;
  source_url: string;
  fetched_at: string;
  registry: Record<string, string | null>;
  quote: string;
}

/** "53" -> 53; "59 (Under Registration - 0 )" -> 59; anything without a leading number -> null. */
export function leadingCount(raw: string | null | undefined): number | null {
  const m = /^\s*(\d[\d,]*)/.exec(raw ?? '');
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

export function toDraft(e: EvidenceRow) {
  const project = leadingCount(e.registry.project_complaints);
  if (project === null) return null;
  return {
    project_id: e.project_id,
    field_name: FIELD,
    proposed_value: {
      project_complaints: project,
      promoter_complaints_total: leadingCount(e.registry.promoter_complaints_total),
      promoter_complaints_text: e.registry.promoter_complaints_total ?? null,
      read_at: e.fetched_at,
      // A name-only registry match is a candidate, never a fact: a person checks the page first.
      needs_review: e.match_method !== 'exact',
      match_method: e.match_method,
      quote: e.quote,
    },
    source_url: e.source_url,
    source_label: LABEL,
    fetched_at: new Date(e.fetched_at),
    status: 'pending',
  };
}

async function main() {
  const evidence = readJson<{ evidence: EvidenceRow[] }>('rera-evidence.json').evidence;
  const known = new Set((await prisma.project.findMany({ select: { id: true } })).map((p) => p.id));
  const rows = evidence.filter((e) => known.has(e.project_id)).map(toDraft).filter((r): r is NonNullable<typeof r> => r !== null);

  const own = await prisma.projectFieldDraft.findMany({ where: { field_name: FIELD, source_label: LABEL, status: 'pending' } });
  const withComplaints = rows.filter((r) => (r.proposed_value.project_complaints as number) > 0).length;
  console.log(`evidence rows=${evidence.length}; on this DB=${rows.length}; with >0 complaints=${withComplaints}; needs_review=${rows.filter((r) => r.proposed_value.needs_review).length}`);
  console.log(`existing own pending rows=${own.length}${APPLY ? '' : ' [dry run: pass --apply to write]'}`);
  if (!APPLY) return;

  writeJson(`backup-complaints-drafts-${Date.now()}.json`, own); // before any change
  await prisma.$transaction([
    prisma.projectFieldDraft.deleteMany({ where: { field_name: FIELD, source_label: LABEL, status: 'pending' } }),
    prisma.projectFieldDraft.createMany({ data: rows as never }),
  ]);
  const after = await prisma.projectFieldDraft.count({ where: { field_name: FIELD, source_label: LABEL, status: 'pending' } });
  console.log(`written. pending complaint drafts now=${after}`);
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}

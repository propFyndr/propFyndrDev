// Stage 6: write every proposal as a PENDING draft in project_field_drafts. Dev DB only.
// Never touches a project column. project_field_drafts is in FORBIDDEN_RELATIONS, so drafts never reach a buyer or a prompt.
// Idempotent: it deletes and rewrites only its own pending rows (source_label ends with "(di-pipeline)").
// Run: npx tsx scripts/data-integrity/06-sync-drafts.ts [--dry-run]
import { PrismaClient } from '@prisma/client';
import { assertDevDb, readJson, writeJson } from './lib';
import type { Item } from './05-review';

assertDevDb();
const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');

const LABEL: Record<string, string> = {
  official: 'UP-RERA registry (di-pipeline)',
  builder: 'builder website, seller claim (di-pipeline)',
  portal: 'listing portal, advertised figure, unverified (di-pipeline)',
};

async function main() {
  const { items } = readJson<{ items: Item[] }>('proposals.json');
  const known = new Set((await prisma.project.findMany({ select: { id: true } })).map((p) => p.id));
  const rows = items
    .filter((i) => known.has(i.project_id))
    .map((i) => ({
      project_id: i.project_id,
      field_name: i.field,
      proposed_value: {
        value: i.proposed ?? null,
        old_value: i.old_value ?? null,
        status: i.status, // differs | new | conflict | wrong_project | ambiguous
        quote: i.quote,
        ...(i.candidates ? { candidates: i.candidates } : {}),
      },
      source_url: i.source_url || null,
      source_label: LABEL[i.tier],
      status: 'pending',
    }));

  const existing = await prisma.projectFieldDraft.findMany();
  const own = existing.filter((d) => d.source_label.endsWith('(di-pipeline)') && d.status === 'pending');
  console.log(`existing drafts=${existing.length} (own pending=${own.length}); new drafts=${rows.length}${DRY ? ' [dry run]' : ''}`);
  if (DRY) return;

  writeJson(`backup-project_field_drafts-${Date.now()}.json`, existing); // before any change
  await prisma.$transaction([
    prisma.projectFieldDraft.deleteMany({ where: { status: 'pending', source_label: { endsWith: '(di-pipeline)' } } }),
    prisma.projectFieldDraft.createMany({ data: rows as any }),
  ]);
  const after = await prisma.projectFieldDraft.count({ where: { source_label: { endsWith: '(di-pipeline)' }, status: 'pending' } });
  console.log(`written. own pending drafts now=${after}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

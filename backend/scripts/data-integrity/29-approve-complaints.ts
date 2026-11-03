// Stage 29: a person approves (or un-approves) UP-RERA complaint drafts. Dev DB only.
//
// Only an approved 'rera_complaints' row is read by the chat (handlers/projectCatch.ts). Approval
// means the reviewer opened source_url and saw the same two numbers. A name-only registry match
// (needs_review) is never approved by --exact; name it with --ids after checking the page.
//
// Dry run by default; lists what would change. Writes one JSON backup first.
//   npx tsx scripts/data-integrity/29-approve-complaints.ts --exact --by "<reviewer>" [--apply]
//   npx tsx scripts/data-integrity/29-approve-complaints.ts --ids <draft-id>,<draft-id> --by "<reviewer>" [--apply]
//   npx tsx scripts/data-integrity/29-approve-complaints.ts --revert --ids <draft-id> [--apply]   # back to pending
import { PrismaClient } from '@prisma/client';
import { assertDevDb, writeJson } from './lib';

assertDevDb();
const prisma = new PrismaClient();
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');
const EXACT = process.argv.includes('--exact');
const ids = (arg('--ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const by = arg('--by');

async function main() {
  if (!REVERT && !by) throw new Error('--by "<reviewer name>" is required: approval is a person, named.');
  if (!EXACT && ids.length === 0) throw new Error('Pass --exact (exact registry matches only) or --ids <draft ids>.');

  const from = REVERT ? 'approved' : 'pending';
  const drafts = await prisma.projectFieldDraft.findMany({
    where: { field_name: 'rera_complaints', status: from, ...(ids.length ? { id: { in: ids } } : {}) },
    include: { project: { select: { name: true } } },
  });
  const picked = drafts.filter((d) => ids.length > 0 || (d.proposed_value as { needs_review?: boolean }).needs_review === false);

  for (const d of picked.slice(0, 12)) {
    const v = d.proposed_value as { project_complaints: number; promoter_complaints_total: number | null };
    console.log(`${REVERT ? 'revert' : 'approve'} ${d.id.slice(0, 8)} ${d.project.name}: project=${v.project_complaints} promoter=${v.promoter_complaints_total} ${d.source_url?.slice(0, 48)}…`);
  }
  console.log(`${picked.length} draft(s) ${REVERT ? 'to return to pending' : 'to approve'}${APPLY ? '' : ' [dry run: pass --apply]'}`);
  if (!APPLY || picked.length === 0) return;

  writeJson(`backup-approve-complaints-${Date.now()}.json`, picked.map(({ project, ...d }) => d));
  await prisma.projectFieldDraft.updateMany({
    where: { id: { in: picked.map((d) => d.id) } },
    data: REVERT ? { status: 'pending', reviewed_by: null, reviewed_at: null } : { status: 'approved', reviewed_by: by, reviewed_at: new Date() },
  });
  console.log('done.');
}

main()
  .catch((e) => {
    console.error(e.message ?? e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

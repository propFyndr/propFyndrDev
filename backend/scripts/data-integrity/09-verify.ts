// Stage 9: read-only invariants after an apply. Run for dev, then for live.
//   npx tsx scripts/data-integrity/09-verify.ts [--target live]
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { isLiveDatabase } from '../../src/lib/liveDatabase'

const live = process.argv.includes('--target') && process.argv[process.argv.indexOf('--target') + 1] === 'live';
if (live && !process.env.NEON_DB) throw new Error('NEON_DB is not set');
if (!live && isLiveDatabase(process.env.DATABASE_URL)) throw new Error('DATABASE_URL is Neon; refusing');
const prisma = live ? new PrismaClient({ datasources: { db: { url: process.env.NEON_DB! } } }) : new PrismaClient();

async function main() {
  console.log(`target: ${live ? 'LIVE (Neon)' : 'dev (Supabase)'}`);
  const projects = await prisma.project.findMany({
    where: { archived_duplicate_of: null },
    select: { id: true, name: true, rera_number: true, rera_url: true, rera_registrations: { select: { rera_number: true, source: true, verified_at: true, verified_by: true } } },
  });
  const stampedRows = projects.flatMap((p) => p.rera_registrations.filter((r) => r.source === 'up_rera_registry'));
  const noMatchingRow = projects.filter((p) => p.rera_number && !p.rera_registrations.some((r) => r.rera_number === p.rera_number));
  const staleRows = projects.filter((p) => p.rera_registrations.some((r) => r.rera_number !== p.rera_number));
  const byNum = new Map<string, string[]>();
  for (const p of projects) if (p.rera_number) byNum.set(p.rera_number, [...(byNum.get(p.rera_number) ?? []), p.name]);
  const shared = [...byNum].filter(([, v]) => v.length > 1);
  const genericUrl = projects.filter((p) => !p.rera_url || /up-rera\.in\/?$/.test(p.rera_url.replace(/^https?:\/\/(www\.)?/, 'https://'))).length;
  const audit = await prisma.auditLog.count({ where: { summary: { startsWith: 'Data-integrity pass 2026-10-28' } } });

  console.log({
    projects: projects.length,
    registry_verified_rows: stampedRows.length,
    verified_with_timestamp: stampedRows.filter((r) => r.verified_at).length,
    project_number_without_matching_registration_row: noMatchingRow.length,
    projects_with_a_registration_row_for_a_different_number: staleRows.length,
    numbers_shared_by_more_than_one_project: shared.length,
    projects_still_on_generic_or_missing_rera_url: genericUrl,
    audit_rows_written: audit,
  });
  if (shared.length) console.log('shared numbers (first 8):', shared.slice(0, 8).map(([n, v]) => `${n}: ${v.join(' + ')}`));
  if (noMatchingRow.length) console.log('no matching row (first 5):', noMatchingRow.slice(0, 5).map((p) => `${p.name} ${p.rera_number}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

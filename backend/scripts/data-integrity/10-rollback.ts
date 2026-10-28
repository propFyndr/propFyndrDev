// Stage 10: undo one apply batch from its backup file. Dry run unless --apply is given.
//   npx tsx scripts/data-integrity/10-rollback.ts --target dev --backup <backup-file.json> --plan apply-plan-2.json [--apply] [--confirm-live]
// Undo batches in reverse order (batch 2 first). A field is restored only if the database still holds the value this
// pass wrote; anything edited since is left alone and reported. Registration rows written by the pass are removed and
// the legacy rows from the backup are put back.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { readJson, writeJson } from './lib';

const arg = (n: string) => process.argv.includes(`--${n}`);
const val = (n: string) => process.argv[process.argv.indexOf(`--${n}`) + 1];
const TARGET = arg('target') ? val('target') : 'dev';
const APPLY = arg('apply');
if (!arg('backup') || !arg('plan')) throw new Error('--backup <file> and --plan <file> are required');
if (TARGET === 'live') {
  if (APPLY && !arg('confirm-live')) throw new Error('rolling back live needs --confirm-live');
  if (!process.env.NEON_DB) throw new Error('NEON_DB is not set');
} else if (TARGET !== 'dev' || (process.env.DATABASE_URL ?? '').includes('neon.tech')) throw new Error('target must be dev (DATABASE_URL must not be Neon) or live');

const prisma = TARGET === 'live' ? new PrismaClient({ datasources: { db: { url: process.env.NEON_DB! } } }) : new PrismaClient();
const eq = (a: unknown, b: unknown) => (a ?? null) === (b ?? null) || String(a ?? '') === String(b ?? '');

async function main() {
  const backup = new Map((JSON.parse(readFileSync(val('backup'), 'utf8')) as any[]).map((b) => [b.id, b]));
  const plans = readJson<{ plans: any[] }>(val('plan')).plans;
  const out = { restored: {} as Record<string, number>, conflicts: [] as string[], registrations_removed: 0, registrations_restored: 0, not_in_backup: 0, errors: [] as string[] };

  for (const plan of plans) {
    const b = backup.get(plan.project_id);
    if (!b) { out.not_in_backup++; continue; }
    const cur: any = await prisma.project.findUnique({ where: { id: plan.project_id }, include: { rera_registrations: true } });
    if (!cur) { out.not_in_backup++; continue; }

    const restore: Record<string, unknown> = {};
    for (const c of plan.changes) {
      // Dates travel as ISO strings in the backup file and the plan; the database wants a Date.
      const asDb = (v: unknown) => (['rera_valid_until', 'possession_date', 'launch_date'].includes(c.field) && typeof v === 'string' ? new Date(v) : v);
      const same = (x: unknown, y: unknown) => String(x instanceof Date ? x.toISOString() : x ?? '') === String(y instanceof Date ? y.toISOString() : y ?? '');
      if (same(cur[c.field], c.new)) restore[c.field] = asDb(c.old); // the plan records the value it replaced; older backup files lack some columns
      else out.conflicts.push(`${plan.name}.${c.field}: now ${JSON.stringify(cur[c.field])}, pass wrote ${JSON.stringify(c.new)}`);
    }
    const reraBack = plan.rera && (!plan.rera.replace_number || restore.rera_number !== undefined);

    if (!APPLY) {
      for (const f of Object.keys(restore)) out.restored[f] = (out.restored[f] ?? 0) + 1;
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        if (Object.keys(restore).length) {
          await tx.project.update({ where: { id: plan.project_id }, data: restore as any });
          await tx.auditLog.create({ data: { entity_type: 'project', entity_id: plan.project_id, entity_name: plan.name, action: 'UPDATE', actor: 'System', summary: `Rollback of data-integrity pass 2026-10-28: ${Object.keys(restore).join(', ')}`, changes: Object.keys(restore).map((f) => ({ field: f, old: cur[f], new: b[f], label: 'rollback from backup' })) as any } });
        }
        if (reraBack) {
          if (plan.rera.replace_number) {
            const del = await tx.projectReraRegistration.deleteMany({ where: { project_id: plan.project_id, rera_number: plan.rera.new, source: 'up_rera_registry' } });
            out.registrations_removed += del.count;
            for (const r of b.rera_registrations as any[]) {
              if (cur.rera_registrations.some((x: any) => x.rera_number === r.rera_number && x.source === r.source)) continue;
              await tx.projectReraRegistration.create({ data: { ...r, verified_at: r.verified_at ? new Date(r.verified_at) : null, created_at: new Date(r.created_at) } });
              out.registrations_restored++;
            }
          } else {
            for (const r of (b.rera_registrations as any[]).filter((x) => x.rera_number === plan.rera.new)) {
              await tx.projectReraRegistration.updateMany({ where: { project_id: plan.project_id, rera_number: r.rera_number }, data: { source: r.source, source_url: r.source_url, rera_url: r.rera_url, verified_at: r.verified_at ? new Date(r.verified_at) : null, verified_by: r.verified_by, format_ok: r.format_ok } });
              out.registrations_restored++;
            }
          }
        }
      });
      for (const f of Object.keys(restore)) out.restored[f] = (out.restored[f] ?? 0) + 1;
    } catch (e) {
      out.errors.push(`${plan.name}: ${(e as Error).message.slice(0, 140)}`);
    }
  }
  console.log(`${TARGET} ${APPLY ? 'ROLLBACK APPLIED' : 'rollback dry run (nothing written)'}:`, { restored: out.restored, conflicts: out.conflicts.length, registrations_removed: out.registrations_removed, registrations_restored: out.registrations_restored, not_in_backup: out.not_in_backup, errors: out.errors.length });
  writeJson(`rollback-${TARGET}-${APPLY ? 'applied' : 'dryrun'}.json`, out);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

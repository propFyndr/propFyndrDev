// Stage 14: stock photos shown as a project's own images.
//   --dry-run                          build stock-images-plan.json from dev, write nothing
//   --target dev | live --confirm-live apply the plan (dev builds it; live replays the same file)
//   --restore <backup.json> --target ..  put back the rows and hero values from a backup
// 1. hero_image_url on a stock URL (unsplash / pexels / pixabay) -> the project's own first real gallery image, else null.
// 2. A stock row in project_images is deleted (full row backed up first). Only rows still on a stock URL are touched.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { assertDevDb, readJson, writeJson } from './lib';

const arg = (n: string) => process.argv.includes(`--${n}`);
const val = (n: string) => process.argv[process.argv.indexOf(`--${n}`) + 1];
const TARGET = arg('target') ? val('target') : 'dev';
const DRY = arg('dry-run');
const BACKUP_DIR = process.env.DI_BACKUP_DIR ?? 'C:/Users/Furqan/Desktop/RealtyPals-data-integrity-2026-10-28';
if (TARGET === 'live') {
  if (!DRY && !arg('confirm-live')) throw new Error('live needs --confirm-live');
  if (!process.env.NEON_DB) throw new Error('NEON_DB is not set');
} else if (TARGET === 'dev') assertDevDb();
else throw new Error('--target must be dev or live');
const prisma = TARGET === 'live' ? new PrismaClient({ datasources: { db: { url: process.env.NEON_DB! } } }) : new PrismaClient();

const isStock = (u: string | null | undefined) => !!u && /unsplash\.com|pexels\.com|pixabay\.com/i.test(u);

interface Plan { project_id: string; slug: string; name: string; hero?: { old: string; new: string | null }; delete_images: string[] }

async function build(): Promise<Plan[]> {
  const rows = await prisma.project.findMany({
    where: { archived_duplicate_of: null },
    select: { id: true, slug: true, name: true, hero_image_url: true, images: { select: { id: true, url: true, type: true, sort_order: true }, orderBy: { sort_order: 'asc' } } },
  });
  const plans: Plan[] = [];
  for (const r of rows) {
    const real = r.images.filter((i) => !isStock(i.url));
    const own = real.find((i) => i.type === 'hero') ?? real[0];
    const plan: Plan = { project_id: r.id, slug: r.slug, name: r.name, delete_images: r.images.filter((i) => isStock(i.url)).map((i) => i.id) };
    if (isStock(r.hero_image_url)) plan.hero = { old: r.hero_image_url!, new: own?.url ?? null };
    if (plan.hero || plan.delete_images.length) plans.push(plan);
  }
  return plans;
}

async function apply(plans: Plan[]) {
  const ids = plans.map((p) => p.project_id);
  const before = await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true, hero_image_url: true, images: true } });
  const bPath = `${BACKUP_DIR}/backup-stock-images-${TARGET}-${Date.now()}.json`;
  mkdirSync(dirname(bPath), { recursive: true });
  writeFileSync(bPath, JSON.stringify(before, null, 2)); // full image rows, so a restore can recreate them
  console.log(`backup of ${before.length} projects -> ${bPath}`);
  const cur = new Map(before.map((b) => [b.id, b]));
  const out = { heroes_replaced: 0, heroes_cleared: 0, images_deleted: 0, skipped_changed: 0, errors: [] as string[] };
  for (const pl of plans) {
    const now = cur.get(pl.project_id);
    if (!now) continue;
    try {
      await prisma.$transaction(async (tx) => {
        if (pl.hero) {
          if (now.hero_image_url === pl.hero.old) {
            await tx.project.update({ where: { id: pl.project_id }, data: { hero_image_url: pl.hero.new } });
            pl.hero.new ? out.heroes_replaced++ : out.heroes_cleared++;
          } else out.skipped_changed++;
        }
        if (pl.delete_images.length) {
          const del = await tx.projectImage.deleteMany({ where: { id: { in: pl.delete_images }, project_id: pl.project_id, url: { contains: 'unsplash.com' } } });
          out.images_deleted += del.count;
        }
        await tx.auditLog.create({ data: { entity_type: 'project', entity_id: pl.project_id, entity_name: pl.name, action: 'UPDATE', actor: 'System', summary: 'Data-integrity pass 2026-10-28: stock photo removed from project images', changes: [{ field: 'hero_image_url', old: pl.hero?.old ?? null, new: pl.hero?.new ?? null, label: 'stock photo replaced by the project\'s own gallery image' }, { field: 'project_images', old: pl.delete_images.length, new: 0, label: 'stock rows deleted' }] as any } });
      });
    } catch (e) { out.errors.push(`${pl.name}: ${(e as Error).message.slice(0, 120)}`); }
  }
  return out;
}

async function restore(file: string) {
  const backup = JSON.parse(readFileSync(file, 'utf8')) as any[];
  let rows = 0, heroes = 0;
  for (const b of backup) {
    for (const img of b.images) {
      if (!isStock(img.url)) continue;
      const exists = await prisma.projectImage.findUnique({ where: { id: img.id } });
      if (!exists) { await prisma.projectImage.create({ data: { ...img, fetched_at: img.fetched_at ? new Date(img.fetched_at) : null } }); rows++; }
    }
    if (isStock(b.hero_image_url)) { await prisma.project.update({ where: { id: b.id }, data: { hero_image_url: b.hero_image_url } }); heroes++; }
  }
  console.log({ restored_rows: rows, restored_heroes: heroes });
}

async function main() {
  if (arg('restore')) return restore(val('restore'));
  let plans: Plan[];
  if (TARGET === 'live') plans = readJson<{ plans: Plan[] }>('stock-images-plan.json').plans;
  else { plans = await build(); writeJson('stock-images-plan.json', { built_at: new Date().toISOString(), plans }); }
  console.log(`${TARGET}${DRY ? ' (dry run)' : ''}: projects ${plans.length}, hero replaced with own image ${plans.filter((p) => p.hero?.new).length}, hero cleared ${plans.filter((p) => p.hero && !p.hero.new).length}, stock image rows to delete ${plans.reduce((a, p) => a + p.delete_images.length, 0)}`);
  if (DRY) return;
  console.log(await apply(plans));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

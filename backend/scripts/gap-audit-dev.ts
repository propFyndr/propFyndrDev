import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { writeFileSync } from 'fs';
import { isLiveDatabase } from '../src/lib/liveDatabase'

// Read-only. Dev (Supabase) only: refuse if the URL is the live Neon host.
const url = process.env.DATABASE_URL ?? '';
if (!url || isLiveDatabase(url)) {
  throw new Error('Refusing: DATABASE_URL is missing or points at Neon (live).');
}

const prisma = new PrismaClient();
const OUT = process.argv[2];

const isEmpty = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

async function main() {
  const fields = Object.keys(Prisma.ProjectScalarFieldEnum);
  const rows = await prisma.project.findMany({
    where: { archived_duplicate_of: null },
    include: {
      _count: {
        select: {
          unit_types: true,
          payment_plans: true,
          amenities: true,
          connectivity: true,
          images: true,
          spec_items: true,
          price_history: true,
          competitors: true,
          construction_milestones: true,
          channel_partners: true,
          rera_registrations: true,
          videos: true,
        },
      },
      cost_sheet: { select: { id: true } },
      decision_profile: { select: { id: true } },
    },
  });

  const fieldMiss: Record<string, number> = {};
  for (const f of fields) fieldMiss[f] = 0;
  const relKeys = Object.keys(rows[0]?._count ?? {});
  const relMiss: Record<string, number> = {};
  for (const r of relKeys) relMiss[r] = 0;
  let noCostSheet = 0;
  let noDecision = 0;

  const perProject = rows.map((p: any) => {
    const miss: string[] = [];
    for (const f of fields) {
      if (isEmpty(p[f])) {
        fieldMiss[f]++;
        miss.push(f);
      }
    }
    for (const r of relKeys) {
      if (!p._count[r]) {
        relMiss[r]++;
        miss.push(`rel:${r}`);
      }
    }
    if (!p.cost_sheet) { noCostSheet++; miss.push('rel:cost_sheet'); }
    if (!p.decision_profile) { noDecision++; miss.push('rel:decision_profile'); }
    return { id: p.id, name: p.name, builder_id: p.builder_id, missing: miss.length, miss };
  });

  const summary = {
    projects: rows.length,
    fieldMissing: Object.fromEntries(
      Object.entries(fieldMiss).sort((a, b) => b[1] - a[1]),
    ),
    relationMissing: { ...relMiss, cost_sheet: noCostSheet, decision_profile: noDecision },
    perProject: perProject.sort((a, b) => b.missing - a.missing),
  };

  writeFileSync(OUT, JSON.stringify(summary, null, 2));
  console.log(`projects=${rows.length} -> ${OUT}`);
  console.log('top field gaps:', Object.entries(summary.fieldMissing).slice(0, 25));
  console.log('relation gaps:', summary.relationMissing);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

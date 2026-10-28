// Stage 2: match every dev project to a UP-RERA registry row. Read-only DB.
// Run: npx tsx scripts/data-integrity/02-match.ts
import { PrismaClient } from '@prisma/client';
import { assertDevDb, normName, readJson, writeJson, type ReraRow } from './lib';

assertDevDb();
const prisma = new PrismaClient();

// Registry numbers can legitimately end in a date ("UPRERAPRJ528653/07/2026"), so no number "cleaning".
type Method = 'exact' | 'name_unique' | 'ambiguous' | 'none';

const tokens = (s: string) => new Set(normName(s).split(' ').filter(Boolean));
function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let i = 0;
  for (const t of a) if (b.has(t)) i++;
  return i / (a.size + b.size - i);
}

async function main() {
  const idx = readJson<{ rows: ReraRow[] }>('rera-index.json').rows;
  const byReg = new Map(idx.map((r) => [r.rera_number, r]));
  const noida = idx.filter((r) => /gautam buddha|ghaziabad/i.test(r.district));

  const projects = await prisma.project.findMany({
    where: { archived_duplicate_of: null },
    select: { id: true, name: true, slug: true, sector: true, rera_number: true, builder: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  const results = projects.map((p) => {
    let base: Record<string, any> = { project_id: p.id, name: p.name, builder: p.builder.name, db_rera: p.rera_number };
    const rera = (p.rera_number ?? '').trim();

    const held = rera ? byReg.get(rera) : undefined;
    if (held) {
      // The number exists in the registry, but it must be THIS project's. 49 of 119 stored numbers were
      // real numbers of other projects (e.g. Amrapali Eden Park -> AASTHA GREENS), which is worse than invalid.
      const sameName = jaccard(tokens(p.name), tokens(held.project_name)) >= 0.5;
      const builderToks = normName(p.builder.name).split(' ').filter((t) => t.length >= 4 && !/group|infra|developers?|builders?|properties|realty|homes/.test(t));
      const sameBuilder = builderToks.some((t) => (held.promoter + ' ' + held.project_name).toLowerCase().includes(t));
      if (sameName || sameBuilder) return { ...base, method: 'exact' as Method, registry: held };
      base = { ...base, stored_number_belongs_to: { rera: held.rera_number, name: held.project_name, promoter: held.promoter, district: held.district } };
    }
    const mine = tokens(p.name);
    const scored = noida
      .map((r) => ({ r, s: jaccard(mine, tokens(r.project_name)) }))
      .filter((x) => x.s >= 0.5)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3);
    if (scored.length && scored[0].s >= 0.8 && (scored.length === 1 || scored[0].s - scored[1].s >= 0.2)) {
      return { ...base, method: 'name_unique' as Method, score: scored[0].s, registry: scored[0].r };
    }
    if (scored.length) {
      return {
        ...base,
        method: 'ambiguous' as Method,
        candidates: scored.map((x) => ({ score: +x.s.toFixed(2), rera: x.r.rera_number, name: x.r.project_name, promoter: x.r.promoter })),
      };
    }
    return { ...base, method: 'none' as Method };
  });

  const tally: Record<string, number> = {};
  for (const r of results) tally[r.method] = (tally[r.method] ?? 0) + 1;

  // A DB number that differs from the registry's number for the same project is a data error to fix.
  const numberMismatch = results.filter(
    (r: any) => r.method === 'name_unique' && r.db_rera !== r.registry.rera_number,
  ).length;

  const wrongOwner = results.filter((r: any) => r.stored_number_belongs_to).length;
  const path = writeJson('match.json', { tally, numberMismatch, wrongOwner, projects: projects.length, results });
  console.log('tally:', tally, '| db number differs from registry:', numberMismatch, '| stored number belongs to another project:', wrongOwner, '->', path);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

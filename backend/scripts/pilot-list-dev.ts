import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { isLiveDatabase } from '../src/lib/liveDatabase'

// Read-only. Dev (Supabase) only.
const url = process.env.DATABASE_URL ?? '';
if (!url || isLiveDatabase(url)) {
  throw new Error('Refusing: DATABASE_URL is missing or points at Neon (live).');
}

const prisma = new PrismaClient();
const OUT = process.argv[2];

async function main() {
  const rows = await prisma.project.findMany({
    where: { archived_duplicate_of: null },
    select: {
      id: true,
      name: true,
      slug: true,
      sector: true,
      status: true,
      rera_number: true,
      rera_url: true,
      possession_date: true,
      price_min_cr: true,
      builder: { select: { id: true, name: true, website: true } },
    },
    orderBy: { name: 'asc' },
  });

  // One project per builder, so the pilot covers as many builders as possible.
  const seen = new Set<string>();
  const perBuilder: typeof rows = [];
  for (const r of rows) {
    if (seen.has(r.builder.id)) continue;
    seen.add(r.builder.id);
    perBuilder.push(r);
  }

  console.log(`projects=${rows.length} builders=${seen.size}`);
  writeFileSync(OUT, JSON.stringify({ all: rows.length, builders: seen.size, perBuilder }, null, 2));
  console.log(`one-per-builder candidates=${perBuilder.length} -> ${OUT}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

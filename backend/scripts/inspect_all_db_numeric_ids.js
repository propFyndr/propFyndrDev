require('dotenv').config({ path: './backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectIds() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, slug: true, rera_number: true, rera_url: true }
  });

  const numericIds = [];
  const nonNumeric = [];

  for (const p of projects) {
    if (p.rera_number) {
      const match = p.rera_number.match(/UPRERAPRJ(\d+)/i);
      if (match) {
        numericIds.push({ name: p.name, slug: p.slug, rera: p.rera_number, id: parseInt(match[1], 10) });
      } else {
        nonNumeric.push({ name: p.name, slug: p.slug, rera: p.rera_number });
      }
    } else {
      nonNumeric.push({ name: p.name, slug: p.slug, rera: null });
    }
  }

  console.log(`Numeric RERA IDs found: ${numericIds.length} out of ${projects.length}`);
  console.log(`Non-numeric or missing: ${nonNumeric.length}`);

  if (numericIds.length > 0) {
    console.log('Sample numeric IDs:', numericIds.slice(0, 10));
  }
  if (nonNumeric.length > 0) {
    console.log('Non-numeric items:', nonNumeric);
  }

  await prisma.$disconnect();
}

inspectIds().catch(console.error);

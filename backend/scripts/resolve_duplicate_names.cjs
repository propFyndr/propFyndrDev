require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ids = [
    '13ae932e-f6ab-4471-9671-45c8a585f778',
    'fdc5f12f-f5ec-47e5-9ec7-32099a0ed60f',
    'd9035a63-1702-4705-9d86-ded6bf526ff7',
    '1c11ec96-8660-4ea3-94fc-499aaf4e5dcf',
    '06894481-6cd9-45c7-9c59-d9a9e8a775ab',
    '4e9cfe37-04d5-496f-8b8d-2c91926cdc08',
    'ce83530c-389f-4318-bcb3-e4aa83c4d5cd',
    '42d459db-357b-4286-93a5-b0a9f7e2fc1c'
  ];

  console.log('Checking existing projects for these IDs...');
  for (const id of ids) {
    const p = await prisma.project.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true, rera_number: true, sector: true }
    });
    console.log(p);
  }

  // Check if target slugs exist
  const targetSlugs = [
    'gaur-saundaryam-phase-1-techzone-4',
    'gaur-saundaryam-phase-2-techzone-4',
    'mahagun-mywoods-phase-1-sector-16c',
    'mahagun-mywoods-phase-2-sector-16c',
    'purvanchal-royal-city-phase-1-chi-5',
    'purvanchal-heights-sector-zeta-1',
    'ska-orion-phase-1-sector-143b',
    'ska-orion-phase-2-sector-143b'
  ];

  console.log('\nChecking target slugs:');
  for (const s of targetSlugs) {
    const found = await prisma.project.findUnique({ where: { slug: s } });
    if (found) {
      console.log(`Target slug ${s} already belongs to:`, found.id, found.name);
    } else {
      console.log(`Target slug ${s} is FREE`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

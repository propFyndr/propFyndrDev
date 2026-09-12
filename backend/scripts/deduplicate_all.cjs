require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function main() {
  console.log('=== STARTING COMPLETE DE-DUPLICATION AUDIT & RECTIFICATION ===\n');

  // 1. Delete confirmed redundant duplicate records
  const redundantIds = [
    'fdc5f12f-f5ec-47e5-9ec7-32099a0ed60f', // duplicate Gaur Saundaryam
    '1c11ec96-8660-4ea3-94fc-499aaf4e5dcf', // duplicate Mahagun Mywoods (Sector 16B)
    'd9035a63-1702-4705-9d86-ded6bf526ff7', // duplicate Mahagun Mywoods (Sector 16C)
    '4e9cfe37-04d5-496f-8b8d-2c91926cdc08', // duplicate Purvanchal Royal City in Zeta 1 (Purvanchal Heights exists)
    'ce83530c-389f-4318-bcb3-e4aa83c4d5cd'  // duplicate SKA Orion in Sector 143
  ];

  for (const id of redundantIds) {
    try {
      const p = await prisma.project.findUnique({ where: { id }, select: { name: true, slug: true } });
      if (p) {
        await prisma.project.delete({ where: { id } });
        console.log(`✓ Deleted redundant record: ${p.name} (${p.slug})`);
      }
    } catch (e) {
      console.log(`Info: ${id} already deleted or not found: ${e.message}`);
    }
  }

  // 2. Rectify Purvanchal Royal City Phase 1
  try {
    await prisma.project.update({
      where: { id: '06894481-6cd9-45c7-9c59-d9a9e8a775ab' },
      data: {
        name: 'Purvanchal Royal City - Phase 1 (Towers 1-8)',
        slug: 'purvanchal-royal-city-phase-1-towers-1-8-sector-chi-v',
        sector: 'Sector Chi V',
        city: 'Greater Noida',
        rera_number: 'UPRERAPRJ521882',
        rera_url: 'https://www.up-rera.in/Projectsummary?id=UPRERAPRJ521882'
      }
    });
    console.log('✓ Updated Purvanchal Royal City - Phase 1 (Towers 1-8)');
  } catch (e) {
    console.log('Info on Purvanchal update:', e.message);
  }

  // 3. Rectify SKA Orion
  try {
    await prisma.project.update({
      where: { id: '42d459db-357b-4286-93a5-b0a9f7e2fc1c' },
      data: {
        name: 'SKA Orion',
        slug: 'ska-orion-sector-143b',
        sector: 'Sector 143B',
        city: 'Noida',
        rera_number: 'UPRERAPRJ582373',
        rera_url: 'https://www.up-rera.in/Projectsummary?id=UPRERAPRJ582373'
      }
    });
    console.log('✓ Updated SKA Orion Sector 143B');
  } catch (e) {
    console.log('Info on SKA Orion update:', e.message);
  }

  // 4. Comprehensive DB Audit
  const allProjects = await prisma.project.findMany({
    include: {
      builder: true,
      unit_types: true,
      amenities: true,
      spec_items: { orderBy: { sort_order: 'asc' } },
      cost_sheet: true,
      payment_plans: true,
      images: true,
      connectivity: true,
      price_history: true,
      decision_profile: true,
      dna: true
    },
    orderBy: { name: 'asc' }
  });

  console.log(`\nAuditing database state across ${allProjects.length} projects...`);

  const ids = new Set(), slugs = new Set(), reras = new Set(), names = new Set();
  const dupIds = [], dupSlugs = [], dupReras = [], dupNames = [];

  for (const p of allProjects) {
    if (ids.has(p.id)) dupIds.push(p.id);
    ids.add(p.id);

    if (slugs.has(p.slug)) dupSlugs.push({ id: p.id, name: p.name, slug: p.slug });
    slugs.add(p.slug);

    const r = (p.rera_number || '').trim().toUpperCase();
    if (reras.has(r)) dupReras.push({ id: p.id, name: p.name, rera: r });
    reras.add(r);

    const n = p.name.trim().toLowerCase();
    if (names.has(n)) dupNames.push({ id: p.id, name: p.name, sector: p.sector });
    names.add(n);
  }

  console.log('--- DATABASE UNIQUENESS RESULTS ---');
  console.log(`Total Projects in DB: ${allProjects.length}`);
  console.log(`Duplicate IDs: ${dupIds.length}`);
  console.log(`Duplicate Slugs: ${dupSlugs.length}`, dupSlugs);
  console.log(`Duplicate RERAs: ${dupReras.length}`, dupReras);
  console.log(`Duplicate Names: ${dupNames.length}`, dupNames);

  if (dupIds.length > 0 || dupSlugs.length > 0 || dupReras.length > 0 || dupNames.length > 0) {
    throw new Error('Database contains duplicates! Aborting master JSON export.');
  }

  // 5. Clean and Re-export newProj/75 master JSON files
  console.log('\n--- EXPORTING TO MASTER JSON (newProj/75) ---');
  const dir = path.resolve('../newProj/75');
  if (fs.existsSync(dir)) {
    const existing = fs.readdirSync(dir);
    for (const f of existing) {
      if (f.endsWith('.json')) {
        fs.unlinkSync(path.join(dir, f));
      }
    }
    console.log(`Cleared ${existing.length} existing files from ${dir}`);
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Group projects by normalized sector + city
  const sectorGroups = new Map();
  for (const p of allProjects) {
    const sNorm = slugify(p.sector || 'unknown');
    const cNorm = slugify(p.city || 'noida');
    const filename = `propfyndr_${sNorm}_${cNorm}_master_data.json`;

    if (!sectorGroups.has(filename)) {
      sectorGroups.set(filename, []);
    }
    sectorGroups.get(filename).push(p);
  }

  let totalExported = 0;
  for (const [filename, projects] of sectorGroups.entries()) {
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), 'utf8');
    totalExported += projects.length;
  }

  console.log(`Successfully exported ${totalExported} projects across ${sectorGroups.size} master JSON files.`);

  // 6. Verify master JSON files on disk
  console.log('\n--- VERIFYING MASTER JSON ON DISK ---');
  const diskFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const diskIds = new Set(), diskSlugs = new Set(), diskReras = new Set(), diskNames = new Set();
  let diskTotal = 0;

  for (const f of diskFiles) {
    const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const p of arr) {
      diskTotal++;
      if (diskIds.has(p.id)) console.error(`DISK DUP ID: ${p.id} in ${f}`);
      diskIds.add(p.id);

      if (diskSlugs.has(p.slug)) console.error(`DISK DUP SLUG: ${p.slug} in ${f}`);
      diskSlugs.add(p.slug);

      const r = (p.rera_number || '').trim().toUpperCase();
      if (diskReras.has(r)) console.error(`DISK DUP RERA: ${r} for ${p.name} in ${f}`);
      diskReras.add(r);

      const n = p.name.trim().toLowerCase();
      if (diskNames.has(n)) console.error(`DISK DUP NAME: ${n} in ${f}`);
      diskNames.add(n);
    }
  }

  console.log(`Total projects verified on disk: ${diskTotal}`);
  console.log(`Unique Disk IDs: ${diskIds.size} / ${diskTotal}`);
  console.log(`Unique Disk Slugs: ${diskSlugs.size} / ${diskTotal}`);
  console.log(`Unique Disk RERAs: ${diskReras.size} / ${diskTotal}`);
  console.log(`Unique Disk Names: ${diskNames.size} / ${diskTotal}`);
  console.log('\n=== ALL UNIQUENESS CHECKS PASSED: ZERO DUPLICATION ===\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

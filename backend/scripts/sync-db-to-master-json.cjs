require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '')
    .replace(/^-+|-+$/g, '');
}

async function syncDbToMasterJson() {
  console.log('=== SYNCING ALL DB PROJECTS TO MASTER JSON (newProj/75) ===');

  const dir = path.resolve('../newProj/75');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Get existing file list
  const existingFiles = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  console.log(`Found ${existingFiles.length} existing master json files.`);

  // Load all projects with complete relational data
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

  console.log(`Loaded ${allProjects.length} projects from database.`);

  // Group projects by sector + city
  const sectorGroups = new Map();

  for (const p of allProjects) {
    const secNorm = slugify(p.sector);
    const cityNorm = slugify(p.city);
    
    // Find matching existing file if any
    let matchedFile = existingFiles.find(f => {
      const fLower = f.toLowerCase();
      return fLower.includes(`_${secNorm}_`) || fLower.startsWith(`propfyndr_${secNorm}_`);
    });

    if (!matchedFile) {
      matchedFile = `propfyndr_${secNorm}_${cityNorm}_master_data.json`;
    }

    if (!sectorGroups.has(matchedFile)) {
      sectorGroups.set(matchedFile, []);
    }
    sectorGroups.get(matchedFile).push(p);
  }

  console.log(`Grouped projects into ${sectorGroups.size} sector master JSON files.`);

  let writtenFiles = 0;
  let totalProjectsExported = 0;

  for (const [filename, projects] of sectorGroups.entries()) {
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), 'utf8');
    writtenFiles++;
    totalProjectsExported += projects.length;
  }

  console.log(`Successfully exported ${totalProjectsExported} projects across ${writtenFiles} master JSON files.`);
  console.log('=== SYNC COMPLETE ===');
  process.exit(0);
}

syncDbToMasterJson().catch(err => {
  console.error(err);
  process.exit(1);
});

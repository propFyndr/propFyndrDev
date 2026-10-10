require('dotenv').config({ path: './backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const upreraRaw = require('../../docs/ground-truth/uprera_all_raw.json');
const upreraNcr = require('../../docs/ground-truth/uprera_ncr_projects.json');

async function checkRera() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true, slug: true, rera_number: true, rera_url: true, escrow_bank_name: true }
  });

  console.log(`Checking ${projects.length} projects...`);
  
  // Build lookup maps from UP RERA ground truth
  const rawByRera = new Map();
  const rawByName = new Map();
  upreraRaw.forEach(r => {
    if (r.rera_number) rawByRera.set(r.rera_number.trim().toUpperCase(), r);
    if (r.project_name) rawByName.set(r.project_name.trim().toLowerCase(), r);
  });

  const ncrByRera = new Map();
  const ncrByName = new Map();
  upreraNcr.forEach(r => {
    if (r.rera_number) ncrByRera.set(r.rera_number.trim().toUpperCase(), r);
    if (r.project_name) ncrByName.set(r.project_name.trim().toLowerCase(), r);
  });

  let exactReraMatches = 0;
  let exactNameMatches = 0;
  let malformedRera = [];
  let unmatched = [];

  for (const p of projects) {
    const rera = (p.rera_number || '').trim().toUpperCase();
    const cleanRera = rera.split('/')[0];

    const matchByRera = rawByRera.get(rera) || rawByRera.get(cleanRera) || ncrByRera.get(rera) || ncrByRera.get(cleanRera);
    if (matchByRera) {
      exactReraMatches++;
      continue;
    }

    // Try name match
    const pName = p.name.trim().toLowerCase();
    const matchByName = rawByName.get(pName) || ncrByName.get(pName);
    if (matchByName) {
      exactNameMatches++;
      continue;
    }

    if (!rera.startsWith('UPRERAPRJ')) {
      malformedRera.push({ name: p.name, rera: p.rera_number });
    } else {
      unmatched.push({ name: p.name, rera: p.rera_number });
    }
  }

  console.log(`Exact RERA matches in UP RERA dataset: ${exactReraMatches}`);
  console.log(`Exact Project Name matches in UP RERA dataset: ${exactNameMatches}`);
  console.log(`Malformed RERA count (doesn't start with UPRERAPRJ): ${malformedRera.length}`);
  console.log(`RERA numbers with UPRERAPRJ prefix but not in collection endpoint: ${unmatched.length}`);

  if (malformedRera.length > 0) {
    console.log('\nSample Malformed RERA:', malformedRera.slice(0, 15));
  }
  if (unmatched.length > 0) {
    console.log('\nSample Unmatched (might be older completed phases):', unmatched.slice(0, 10));
  }

  await prisma.$disconnect();
}

checkRera().catch(console.error);

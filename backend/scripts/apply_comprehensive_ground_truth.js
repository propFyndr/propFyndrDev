require('dotenv').config({ path: './backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const filingsData = require('../../docs/ground-truth/uprera_details_filings.json');
const ncrData = require('../../docs/ground-truth/uprera_ncr_projects.json');
const rawData = require('../../docs/ground-truth/uprera_all_raw.json');
const MASTER_DIR = path.join(__dirname, '../../newProj/75');
const DOSSIERS_DIR = path.join(__dirname, '../../Projects');

// Load all surveyed dossiers
function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) results = results.concat(getFiles(filePath));
    else if (file.endsWith('.json')) results.push(filePath);
  });
  return results;
}

function loadSurveyedDossiers() {
  const files = getFiles(DOSSIERS_DIR);
  const dossiers = [];
  for (const f of files) {
    try {
      const content = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (content.project) {
        dossiers.push(content);
      } else if (Array.isArray(content)) {
        content.forEach(c => {
          if (c.project) dossiers.push(c);
        });
      }
    } catch {}
  }
  return dossiers;
}

function normalizeName(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function applyGroundTruth() {
  console.log('--- Applying Verified Ground-Truth Across All Projects ---');

  const surveyedDossiers = loadSurveyedDossiers();
  console.log(`Loaded ${surveyedDossiers.length} surveyed ground-truth dossiers from Projects/`);

  // Build lookups
  // 1. NCR summary lookups
  const ncrByRera = new Map();
  const ncrByName = new Map();
  ncrData.forEach(item => {
    if (item.rera_number) ncrByRera.set(item.rera_number.trim().toUpperCase(), item);
    if (item.project_name) ncrByName.set(normalizeName(item.project_name), item);
  });

  // 2. Filings lookups
  const filingById = new Map();
  Object.keys(filingsData).forEach(k => {
    const entry = filingsData[k];
    if (entry && entry.success && entry.data) {
      filingById.set(parseInt(k, 10), entry.data);
    }
  });

  // 3. Surveyed dossiers lookups
  const dossierBySlug = new Map();
  const dossierByName = new Map();
  const dossierByRera = new Map();
  surveyedDossiers.forEach(d => {
    if (d.project.slug) dossierBySlug.set(d.project.slug, d);
    if (d.project.name) dossierByName.set(normalizeName(d.project.name), d);
    if (d.project.rera_number) {
      const cleanRera = d.project.rera_number.trim().toUpperCase().split('/')[0];
      dossierByRera.set(cleanRera, d);
    }
  });

  const dbProjects = await prisma.project.findMany({
    include: {
      builder: true,
      unit_types: true
    }
  });

  console.log(`Found ${dbProjects.length} projects in database to reconcile.`);

  let updatedCount = 0;
  let filingMatches = 0;
  let ncrMatches = 0;
  let dossierMatches = 0;
  const updatesManifest = [];

  for (const p of dbProjects) {
    const updates = {};
    const sources = [];

    // Extract numeric RERA ID if available
    let numId = null;
    if (p.rera_number) {
      const match = p.rera_number.match(/UPRERAPRJ(\d+)/i);
      if (match) numId = parseInt(match[1], 10);
    }

    // A. Check Filing Data
    if (numId && filingById.has(numId)) {
      const f = filingById.get(numId);
      filingMatches++;
      sources.push('UP_RERA_FILING');

      if (f.rera_url) updates.rera_url = f.rera_url;
      if (f.land_area_acres && (!p.land_area_acres || p.land_area_acres <= 0)) {
        updates.land_area_acres = f.land_area_acres;
      }
      if (f.launch_date && !p.launch_date) {
        updates.launch_date = new Date(f.launch_date);
      }
      if (f.rera_valid_until && !p.rera_valid_until) {
        updates.rera_valid_until = new Date(f.rera_valid_until);
      }
      if (f.escrow && f.escrow.bank_name) {
        updates.escrow_bank_name = f.escrow.bank_name;
        updates.escrow_verified = true;
      }
      if (f.professionals && f.professionals.architect && !p.architect) {
        updates.architect = f.professionals.architect;
      }
      if (f.permit && f.permit.permit_number && !p.approvals_status) {
        updates.approvals_status = `Sanctioned by Authority: ${f.permit.permit_number}`;
      }
      // Valid NCR coordinates check
      if (f.lat && f.lng && f.lat >= 28.0 && f.lat <= 28.9 && f.lng >= 77.0 && f.lng <= 77.8) {
        if (!p.lat || !p.lng) {
          updates.lat = f.lat;
          updates.lng = f.lng;
        }
      }
    }

    // B. Check NCR Summary Data
    const cleanRera = p.rera_number ? p.rera_number.trim().toUpperCase().split('/')[0] : '';
    const normName = normalizeName(p.name);
    const ncrMatch = ncrByRera.get(cleanRera) || ncrByName.get(normName);

    if (ncrMatch) {
      ncrMatches++;
      sources.push('UP_RERA_SUMMARY');

      if (ncrMatch.summary_url && (!updates.rera_url || updates.rera_url.includes('verify'))) {
        updates.rera_url = ncrMatch.summary_url;
      }
      if (ncrMatch.escrow_bank_name && !updates.escrow_bank_name) {
        updates.escrow_bank_name = ncrMatch.escrow_bank_name;
        updates.escrow_verified = true;
      }
      if (ncrMatch.completion_date && !p.possession_date) {
        const parts = ncrMatch.completion_date.split('-');
        if (parts.length === 3) {
          const d = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
          if (!isNaN(d.getTime())) {
            updates.possession_date = d;
          }
        }
      }
      if (ncrMatch.details) {
        if (ncrMatch.details.project_specific_complaints !== undefined && !p.litigation_count) {
          const comp = parseInt(ncrMatch.details.project_specific_complaints, 10);
          if (!isNaN(comp)) updates.litigation_count = comp;
        }
        if (ncrMatch.details.cc_approval_date && !p.oc_obtained_date) {
          const parts = ncrMatch.details.cc_approval_date.split('-');
          if (parts.length === 3) {
            const cd = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
            if (!isNaN(cd.getTime())) {
              updates.oc_obtained_date = cd;
              updates.oc_obtained = true;
            }
          }
        }
      }
    }

    // C. Check Surveyed Dossier Data
    const dossier = dossierBySlug.get(p.slug) || dossierByName.get(normName) || (cleanRera ? dossierByRera.get(cleanRera) : null);
    if (dossier) {
      dossierMatches++;
      sources.push('SURVEYED_DOSSIER');

      const dp = dossier.project;
      if (dp.lat && dp.lng && (!updates.lat || !p.lat)) {
        updates.lat = dp.lat;
        updates.lng = dp.lng;
      }
      if (dp.total_towers && !p.total_towers) updates.total_towers = dp.total_towers;
      if (dp.total_units && !p.total_units) updates.total_units = dp.total_units;
      if (dp.floors && !p.floors) updates.floors = dp.floors;
      if (dp.architect && !p.architect && !updates.architect) updates.architect = dp.architect;
      if (dp.design_theme && !p.design_theme) updates.design_theme = dp.design_theme;
      if (dp.open_space_pct && !p.open_space_pct) updates.open_space_pct = dp.open_space_pct;
      if (dp.green_rating && !p.green_rating) updates.green_rating = dp.green_rating;
      if (dp.price_range_label && !p.price_range_label) updates.price_range_label = dp.price_range_label;
      if (dp.price_min_cr && !p.price_min_cr) updates.price_min_cr = dp.price_min_cr;
    }

    // Apply DB Update if changes exist
    if (Object.keys(updates).length > 0) {
      await prisma.project.update({
        where: { id: p.id },
        data: updates
      });
      updatedCount++;
      updatesManifest.push({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sources: Array.from(new Set(sources)),
        fieldsUpdated: Object.keys(updates)
      });
    }
  }

  console.log(`\nReconciled ${updatedCount} DB projects:`);
  console.log(`- Filing matches: ${filingMatches}`);
  console.log(`- NCR summary matches: ${ncrMatches}`);
  console.log(`- Surveyed dossier matches: ${dossierMatches}`);

  // Write Manifest
  const manifestPath = path.join(__dirname, '../../docs/ground-truth/applied_ground_truth_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(updatesManifest, null, 2));
  console.log(`Saved audit manifest to ${manifestPath}`);

  // Synchronize master files in newProj/75
  if (fs.existsSync(MASTER_DIR)) {
    const files = fs.readdirSync(MASTER_DIR).filter(f => f.endsWith('.json'));
    let masterFilesUpdated = 0;

    for (const f of files) {
      const fullPath = path.join(MASTER_DIR, f);
      try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          let dirty = false;
          list.forEach(item => {
            const manifestEntry = updatesManifest.find(m => m.slug === item.slug || m.id === item.id);
            if (manifestEntry) {
              const dbProj = dbProjects.find(dp => dp.id === manifestEntry.id);
              if (dbProj) {
                // Apply same verified fields
                manifestEntry.fieldsUpdated.forEach(field => {
                  if (item[field] !== undefined) {
                    item[field] = dbProj[field];
                    dirty = true;
                  }
                });
              }
            }
          });
          if (dirty) {
            fs.writeFileSync(fullPath, JSON.stringify(list, null, 2));
            masterFilesUpdated++;
          }
        }
      } catch {}
    }
    console.log(`Synchronized ${masterFilesUpdated} master files in newProj/75.`);
  }

  await prisma.$disconnect();
}

applyGroundTruth().catch(console.error);

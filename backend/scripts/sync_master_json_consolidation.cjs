const fs = require('fs');
const path = require('path');

const masterDir = path.resolve(__dirname, '../../newProj/75');

function normalizeBaseName(name) {
  let clean = name
    .replace(/\s*\(?(Block|Tower|Wing|Phase)\s+[A-Z0-9-,\s&]+\)?/gi, '')
    .replace(/\s+Phase\s+\d+/gi, '')
    .replace(/\s*-\s*Phase\s+\d+/gi, '')
    .replace(/\s*Towers\s+[A-Z0-9-]+/gi, '')
    .replace(/\s*-\s*Towers\s+[A-Z0-9-]+/gi, '')
    .replace(/\s*\([^)]*\)/g, '')
    .trim();
  clean = clean.replace(/[\s-]+$/, '').trim();
  return clean;
}

function extractPhaseOrTowerLabel(name) {
  const match = name.match(/\(?(Block|Tower|Wing|Phase)\s+[A-Z0-9-,\s&]+\)?/i) ||
                name.match(/Phase\s+\d+/i) ||
                name.match(/Towers\s+[A-Z0-9-]+/i) ||
                name.match(/\([^)]+\)/);
  if (match) return match[0].replace(/[()]/g, '').trim();
  return 'Main Tower';
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const VALID_FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';

function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return VALID_FALLBACK_IMAGE;
  // If broken 10-digit uncompleted unsplash photo id (e.g. photo-1545325241 without suffix)
  if (url.includes('images.unsplash.com/photo-1545325241?')) {
    return VALID_FALLBACK_IMAGE;
  }
  return url;
}

async function syncMasterFiles() {
  console.log(`\n======================================================`);
  console.log(`   MASTER JSON FILE SYNCHRONIZATION (newProj/75)`);
  console.log(`======================================================\n`);

  const files = fs.readdirSync(masterDir).filter(f => f.endsWith('.json'));
  console.log(`Processing ${files.length} sector master JSON files...\n`);

  const syntheticRegex = /(Residency|Heights|Enclave)\s+Phase\s+\d+\s*\((Tower|Block)\s+[A-Z0-9-]+\)/i;

  let totalBefore = 0;
  let totalAfter = 0;
  let totalSyntheticPurged = 0;
  let totalMergedGroups = 0;

  for (const file of files) {
    const filePath = path.join(masterDir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    let projects = [];
    try {
      projects = JSON.parse(raw);
    } catch (err) {
      console.error(`Failed to parse ${file}:`, err.message);
      continue;
    }

    if (!Array.isArray(projects)) continue;
    totalBefore += projects.length;

    // 1. Filter out synthetic placeholder rows
    const nonSynthetic = [];
    for (const p of projects) {
      if (syntheticRegex.test(p.name || '')) {
        totalSyntheticPurged++;
      } else {
        nonSynthetic.push(p);
      }
    }

    // 2. Group real projects by normalized base name
    const groups = {};
    for (const p of nonSynthetic) {
      const base = normalizeBaseName(p.name || '');
      const key = `${(p.builder_id || '').toLowerCase()}_${base.toLowerCase()}`;
      if (!groups[key]) groups[key] = { base, projects: [] };
      groups[key].projects.push(p);
    }

    const consolidatedProjects = [];

    for (const g of Object.values(groups)) {
      if (g.projects.length === 1) {
        const p = g.projects[0];
        p.hero_image_url = sanitizeImageUrl(p.hero_image_url);
        consolidatedProjects.push(p);
      } else {
        totalMergedGroups++;
        // Find canonical
        let canonical = g.projects.find(p => (p.name || '').trim().toLowerCase() === g.base.toLowerCase());
        if (!canonical) canonical = g.projects[0];

        canonical.name = g.base;
        canonical.slug = slugify(`${g.base}-${canonical.sector || ''}-${canonical.city || ''}`);
        canonical.hero_image_url = sanitizeImageUrl(canonical.hero_image_url);

        const children = g.projects.filter(p => p !== canonical);

        let totalUnits = canonical.total_units || 0;
        let totalTowers = canonical.total_towers || 0;
        let hasUnderConstruction = canonical.status === 'under_construction';

        if (!Array.isArray(canonical.unit_types)) canonical.unit_types = [];

        for (const child of children) {
          if (child.total_units) totalUnits += child.total_units;
          if (child.total_towers) totalTowers += child.total_towers;
          if (child.status === 'under_construction') hasUnderConstruction = true;

          const childLabel = extractPhaseOrTowerLabel(child.name || '');
          const childUnits = Array.isArray(child.unit_types) ? child.unit_types : [];

          for (const u of childUnits) {
            const match = canonical.unit_types.find(cu => 
              cu.bhk === u.bhk && 
              Math.abs((cu.super_area_sqft || 0) - (u.super_area_sqft || 0)) <= 50
            );

            if (match) {
              const existing = match.tower_association || match.towers || [];
              const updated = Array.from(new Set([...existing, childLabel]));
              match.tower_association = updated;
              match.towers = updated;
            } else {
              const assigned = (u.tower_association && u.tower_association.length > 0 && u.tower_association[0] !== 'Tower A')
                ? u.tower_association
                : [childLabel];
              canonical.unit_types.push({
                ...u,
                tower_association: assigned,
                towers: assigned
              });
            }
          }
        }

        if (totalUnits > 0) canonical.total_units = totalUnits;
        if (totalTowers > 0) canonical.total_towers = totalTowers;
        if (hasUnderConstruction) canonical.status = 'under_construction';

        // Recalculate price range label if unit types have prices
        const prices = canonical.unit_types.map(u => u.price_min_cr).filter(p => typeof p === 'number' && p > 0);
        const maxPrices = canonical.unit_types.map(u => u.price_max_cr).filter(p => typeof p === 'number' && p > 0);
        if (prices.length > 0) {
          const minP = Math.min(...prices);
          const maxP = maxPrices.length > 0 ? Math.max(...maxPrices) : Math.max(...prices);
          canonical.price_min_cr = minP;
          canonical.price_range_label = `₹${minP.toFixed(2)} Cr - ₹${maxP.toFixed(2)} Cr`;
        }

        consolidatedProjects.push(canonical);
      }
    }

    totalAfter += consolidatedProjects.length;
    fs.writeFileSync(filePath, JSON.stringify(consolidatedProjects, null, 2), 'utf8');
  }

  console.log(`\n======================================================`);
  console.log(`   MASTER FILES SYNC SUMMARY`);
  console.log(`======================================================`);
  console.log(`Total projects before: ${totalBefore}`);
  console.log(`Synthetic projects purged: ${totalSyntheticPurged}`);
  console.log(`Multi-phase groups consolidated: ${totalMergedGroups}`);
  console.log(`Total clean unique projects in newProj/75: ${totalAfter}`);
  console.log(`======================================================\n`);
}

syncMasterFiles().catch(console.error);

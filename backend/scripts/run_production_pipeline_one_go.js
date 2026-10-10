require('dotenv').config({ path: './backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configuration and file paths
const UPRERA_NCR_PATH = path.join(__dirname, '../../docs/ground-truth/uprera_ncr_projects.json');
const UPRERA_ALL_PATH = path.join(__dirname, '../../docs/ground-truth/uprera_all_raw.json');
const MASTER_75_DIR = path.join(__dirname, '../../newProj/75');
const MANIFEST_PATH = path.join(__dirname, '../../docs/ground-truth/production_pipeline_manifest.json');

function normalizeStr(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRera(r) {
  if (!r) return '';
  return r.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function fetchUrl(url, timeoutMs = 12000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: timeoutMs
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirect = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          return fetchUrl(redirect, timeoutMs).then(resolve);
        }
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ url, status: res.statusCode, data }));
      });
      req.on('error', e => resolve({ url, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ url, error: 'TIMEOUT' }); });
    } catch (e) {
      resolve({ url, error: e.message });
    }
  });
}

async function main() {
  console.log('================================================================');
  console.log('    REALTYPALS PRODUCTION DATA INTEGRITY PIPELINE (ONE-GO)     ');
  console.log('================================================================\n');

  // ─────────────────────────────────────────────────────────────
  // STEP 1: LOAD & INDEX UP RERA OFFICIAL GROUND TRUTH
  // ─────────────────────────────────────────────────────────────
  console.log('>> [Step 1/5] Loading UP RERA Ground Truth...');
  if (!fs.existsSync(UPRERA_NCR_PATH)) {
    throw new Error(`Missing ${UPRERA_NCR_PATH}. Run scrape_uprera_ground_truth.js first.`);
  }

  const upreraNcr = JSON.parse(fs.readFileSync(UPRERA_NCR_PATH, 'utf8'));
  const upreraAll = fs.existsSync(UPRERA_ALL_PATH)
    ? JSON.parse(fs.readFileSync(UPRERA_ALL_PATH, 'utf8'))
    : [];

  console.log(`Loaded ${upreraNcr.length} detailed NCR projects and ${upreraAll.length} statewide projects.`);

  // Build high-precision RERA maps
  const reraMap = new Map();
  const nameMap = new Map();

  function indexReraProject(p) {
    const normR = normalizeRera(p.rera_number);
    if (normR && !reraMap.has(normR)) reraMap.set(normR, p);

    const normName = normalizeStr(p.project_name);
    if (normName) {
      if (!nameMap.has(normName)) nameMap.set(normName, []);
      nameMap.get(normName).push(p);
    }
  }

  upreraNcr.forEach(indexReraProject);
  upreraAll.forEach(indexReraProject);
  console.log(`Indexed ${reraMap.size} unique RERA numbers and ${nameMap.size} unique project names.\n`);

  // ─────────────────────────────────────────────────────────────
  // STEP 2: LOAD ALL DATABASE PROJECTS & BUILDERS
  // ─────────────────────────────────────────────────────────────
  console.log('>> [Step 2/5] Fetching all database projects and builder profiles...');
  const dbProjects = await prisma.project.findMany({
    include: {
      builder: true,
      cost_sheet: true,
      payment_plans: true,
      unit_types: true,
      spec_items: true
    }
  });
  console.log(`Loaded ${dbProjects.length} projects across ${new Set(dbProjects.map(p => p.builder_id)).size} builders from PostgreSQL.\n`);

  // ─────────────────────────────────────────────────────────────
  // STEP 3: DISCOVER BUILDER OFFICIAL PROJECT PAGES
  // ─────────────────────────────────────────────────────────────
  console.log('>> [Step 3/5] Crawling builder websites to catalog official project URLs...');
  const uniqueBuilderWebsites = [...new Set(
    dbProjects
      .map(p => p.builder?.website)
      .filter(w => Boolean(w) && typeof w === 'string' && w.startsWith('http'))
  )];

  console.log(`Identified ${uniqueBuilderWebsites.length} distinct official builder domains.`);

  // Builder project map: normalized name -> { builderUrl, projectUrl, brochureUrl, details }
  const builderProjectCatalog = new Map();

  // Concurrently crawl top builder sites with a worker pool
  const CRAWL_CONCURRENCY = 6;
  let crawlCompleted = 0;

  async function crawlWorker(idx) {
    while (idx < uniqueBuilderWebsites.length) {
      const siteUrl = uniqueBuilderWebsites[idx];
      idx += CRAWL_CONCURRENCY;

      try {
        const homeRes = await fetchUrl(siteUrl, 10000);
        if (homeRes.data && homeRes.status === 200) {
          const links = homeRes.data.match(/href=['"]([^'"]+)['"]/gi) || [];
          const cleanLinks = links
            .map(l => l.replace(/href=['"]/i, '').replace(/['"]$/, ''))
            .filter(l => !l.startsWith('#') && !l.startsWith('tel:') && !l.startsWith('mailto:') && !l.startsWith('javascript:'))
            .map(l => {
              try { return new URL(l, siteUrl).href; } catch { return null; }
            })
            .filter(l => Boolean(l));

          for (const link of cleanLinks) {
            // Check if link matches any project in our DB
            for (const p of dbProjects) {
              const pNorm = normalizeStr(p.name);
              const linkSlug = normalizeStr(link.split('/').pop() || '');
              if (pNorm.length > 4 && (linkSlug.includes(pNorm) || (linkSlug.length > 4 && pNorm.includes(linkSlug)))) {
                if (!builderProjectCatalog.has(p.id)) {
                  builderProjectCatalog.set(p.id, {
                    builderDomain: siteUrl,
                    officialProjectUrl: link
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        // Continue politely
      }

      crawlCompleted++;
      if (crawlCompleted % 10 === 0 || crawlCompleted === uniqueBuilderWebsites.length) {
        console.log(`  Crawled ${crawlCompleted}/${uniqueBuilderWebsites.length} builder websites (${builderProjectCatalog.size} projects mapped)...`);
      }
    }
  }

  const crawlWorkers = [];
  for (let i = 0; i < CRAWL_CONCURRENCY; i++) crawlWorkers.push(crawlWorker(i));
  await Promise.all(crawlWorkers);
  console.log(`Builder crawling complete: ${builderProjectCatalog.size} projects mapped to verified developer pages.\n`);

  // ─────────────────────────────────────────────────────────────
  // STEP 4: RECONCILE, PURGE FABRICATION, & COMMIT GROUND TRUTH
  // ─────────────────────────────────────────────────────────────
  console.log('>> [Step 4/5] Executing reconciliation and purging synthetic sludge...');

  // Identify shared coordinates (sector centroids) to nullify
  const coordCounts = new Map();
  dbProjects.forEach(p => {
    if (p.lat && p.lng) {
      const c = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      coordCounts.set(c, (coordCounts.get(c) || 0) + 1);
    }
  });

  const manifest = [];
  let reraOverwrites = 0;
  let escrowOverwrites = 0;
  let possessionOverwrites = 0;
  let purgedPaymentPlans = 0;
  let purgedCostSheets = 0;
  let clearedCentroids = 0;

  for (let i = 0; i < dbProjects.length; i++) {
    const p = dbProjects[i];
    const normDbRera = normalizeRera(p.rera_number);
    const normDbName = normalizeStr(p.name);

    // Find UP RERA Match
    let reraMatch = null;
    let matchMethod = 'NONE';

    if (normDbRera && reraMap.has(normDbRera)) {
      reraMatch = reraMap.get(normDbRera);
      matchMethod = 'EXACT_RERA';
    } else if (normDbName && nameMap.has(normDbName)) {
      reraMatch = nameMap.get(normDbName)[0];
      matchMethod = 'EXACT_NAME';
    } else {
      // Fuzzy name match
      for (const [rKey, cands] of nameMap.entries()) {
        if (normDbName.length > 5 && (rKey.includes(normDbName) || normDbName.includes(rKey))) {
          reraMatch = cands[0];
          matchMethod = 'FUZZY_NAME';
          break;
        }
      }
    }

    const builderMatch = builderProjectCatalog.get(p.id) || null;

    // Build update payload
    const updateData = {};
    const auditRecord = {
      id: p.id,
      name: p.name,
      slug: p.slug,
      original_rera: p.rera_number,
      matchMethod,
      rera_verified: false,
      builder_verified: Boolean(builderMatch),
      changes: []
    };

    if (reraMatch) {
      auditRecord.rera_verified = true;
      auditRecord.official_rera = reraMatch.rera_number;
      auditRecord.official_promoter = reraMatch.promoter_name;
      auditRecord.rera_source_url = reraMatch.summary_url;

      // 1. RERA Number & URL
      if (p.rera_number !== reraMatch.rera_number) {
        updateData.rera_number = reraMatch.rera_number;
        auditRecord.changes.push(`RERA number updated: '${p.rera_number}' -> '${reraMatch.rera_number}'`);
        reraOverwrites++;
      }
      if (reraMatch.summary_url && p.rera_url !== reraMatch.summary_url) {
        updateData.rera_url = reraMatch.summary_url;
      }

      // 2. Escrow Bank Details
      if (reraMatch.escrow_bank_name) {
        updateData.escrow_verified = true;
        updateData.escrow_bank_name = reraMatch.escrow_bank_name;
        auditRecord.changes.push(`Escrow verified: ${reraMatch.escrow_bank_name} (${reraMatch.escrow_account_no || 'NA'})`);
        escrowOverwrites++;
      }

      // 3. Timelines & Possession
      const reraDetails = reraMatch.details;
      if (reraDetails) {
        if (reraDetails.proposed_end_date) {
          const parsedDate = new Date(reraDetails.proposed_end_date);
          if (!isNaN(parsedDate.getTime())) {
            updateData.possession_date = parsedDate;
            possessionOverwrites++;
          }
        }
        if (reraDetails.cc_approval_date) {
          updateData.oc_obtained = true;
          const parsedOc = new Date(reraDetails.cc_approval_date);
          if (!isNaN(parsedOc.getTime())) {
            updateData.oc_obtained_date = parsedOc;
          }
        }
        if (reraDetails.project_specific_complaints) {
          const compCount = parseInt(reraDetails.project_specific_complaints, 10);
          if (!isNaN(compCount)) {
            updateData.litigation_count = compCount;
          }
        }
      }
    }

    // 4. Centroid coordinate nullification
    if (p.lat && p.lng) {
      const c = `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`;
      if ((coordCounts.get(c) || 0) > 1) {
        // Shared across multiple projects -> Sector centroid, not exact pin
        updateData.lat = null;
        updateData.lng = null;
        auditRecord.changes.push(`Cleared shared sector centroid: ${c}`);
        clearedCentroids++;
      }
    }

    // 5. Purge synthetic payment plans (inferred_default)
    const inferredPlanIds = p.payment_plans
      .filter(pp => pp.is_inferred || (pp.source && pp.source.includes('inferred')))
      .map(pp => pp.id);

    if (inferredPlanIds.length > 0) {
      await prisma.paymentPlan.deleteMany({
        where: { id: { in: inferredPlanIds } }
      });
      purgedPaymentPlans += inferredPlanIds.length;
      auditRecord.changes.push(`Deleted ${inferredPlanIds.length} synthetic payment plans`);
    }

    // 6. Purge identical zeroed cost sheets
    if (p.cost_sheet) {
      const cs = p.cost_sheet;
      const isZeroed = (cs.plc_rate_sqft === 0 || cs.plc_rate_sqft === null) &&
                       (cs.club_membership_charge === 0 || cs.club_membership_charge === null) &&
                       (cs.parking_charge_covered === 0 || cs.parking_charge_covered === null) &&
                       (cs.ifms_rate_sqft === 0 || cs.ifms_rate_sqft === null);
      if (isZeroed) {
        await prisma.costSheet.delete({ where: { id: cs.id } });
        purgedCostSheets++;
        auditRecord.changes.push('Deleted synthetic zeroed cost sheet');
      }
    }

    // Apply database update if changes exist
    if (Object.keys(updateData).length > 0) {
      await prisma.project.update({
        where: { id: p.id },
        data: updateData
      });
    }

    manifest.push(auditRecord);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 5: SYNC TO newProj/75 MASTER JSON FILES
  // ─────────────────────────────────────────────────────────────
  console.log('\n>> [Step 5/5] Synchronizing cleaned data to newProj/75 master files...');
  if (fs.existsSync(MASTER_75_DIR)) {
    const masterFiles = fs.readdirSync(MASTER_75_DIR).filter(f => f.endsWith('.json'));
    const manifestMap = new Map(manifest.map(m => [m.id, m]));

    for (const f of masterFiles) {
      const filePath = path.join(MASTER_75_DIR, f);
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          let fileDirty = false;
          list.forEach(item => {
            const audit = manifestMap.get(item.id);
            if (audit) {
              if (audit.official_rera) {
                item.rera_number = audit.official_rera;
                item.rera_url = audit.rera_source_url;
                fileDirty = true;
              }
              // Clear inferred payment plans
              if (Array.isArray(item.payment_plans)) {
                item.payment_plans = item.payment_plans.filter(
                  pp => !pp.is_inferred && !(pp.source && pp.source.includes('inferred'))
                );
                fileDirty = true;
              }
              // Clear zeroed cost sheet
              if (item.cost_sheet) {
                const cs = item.cost_sheet;
                if (!cs.plc_rate_sqft && !cs.club_membership_charge && !cs.parking_charge_covered) {
                  item.cost_sheet = null;
                  fileDirty = true;
                }
              }
            }
          });
          if (fileDirty) {
            fs.writeFileSync(filePath, JSON.stringify(list, null, 2));
          }
        }
      } catch (err) {
        console.warn(`[WARN] Failed updating master file ${f}: ${err.message}`);
      }
    }
  }

  // Write execution report
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify({
    execution_time: new Date().toISOString(),
    summary: {
      total_projects: dbProjects.length,
      rera_overwrites: reraOverwrites,
      escrow_overwrites: escrowOverwrites,
      possession_overwrites: possessionOverwrites,
      purged_payment_plans: purgedPaymentPlans,
      purged_cost_sheets: purgedCostSheets,
      cleared_centroids: clearedCentroids
    },
    manifest
  }, null, 2));

  console.log('\n================================================================');
  console.log('              PIPELINE EXECUTION COMPLETED                      ');
  console.log('================================================================');
  console.log(`- Official RERA Numbers Injected:  ${reraOverwrites}`);
  console.log(`- Escrow Accounts Verified:       ${escrowOverwrites}`);
  console.log(`- Possession Dates Corrected:     ${possessionOverwrites}`);
  console.log(`- Synthetic Payment Plans Purged: ${purgedPaymentPlans}`);
  console.log(`- Fake Cost Sheets Purged:        ${purgedCostSheets}`);
  console.log(`- Shared Sector Centroids Cleared:${clearedCentroids}`);
  console.log(`- Master JSON Files Synced:       newProj/75/*.json`);
  console.log(`- Audit Manifest Created:         ${MANIFEST_PATH}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Pipeline execution error:', e);
  await prisma.$disconnect();
  process.exit(1);
});

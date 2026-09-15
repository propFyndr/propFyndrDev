const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const isDryRun = process.argv.includes('--dry-run');

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

async function getAvailableSlug(baseSlug, currentId) {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const existing = await prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === currentId) return slug;
    slug = `${baseSlug}-${counter++}`;
  }
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`   PROJECT CONSOLIDATION & DEDUPLICATION ENGINE`);
  console.log(`   Mode: ${isDryRun ? 'DRY RUN (No DB Writes)' : 'LIVE DATABASE EXECUTION'}`);
  console.log(`======================================================\n`);

  const allProjects = await prisma.project.findMany({
    include: {
      unit_types: true,
      images: true,
      amenities: true,
      price_history: true,
      construction_milestones: true,
      builder: { select: { id: true, name: true } },
    }
  });

  console.log(`Total projects loaded from DB: ${allProjects.length}`);

  // 1. Separate synthetic projects from legitimate projects
  const syntheticRegex = /(Residency|Heights|Enclave)\s+Phase\s+\d+\s*\((Tower|Block)\s+[A-Z0-9-]+\)/i;
  const syntheticProjects = [];
  const candidateProjects = [];

  for (const p of allProjects) {
    if (syntheticRegex.test(p.name)) {
      syntheticProjects.push(p);
    } else {
      candidateProjects.push(p);
    }
  }

  console.log(`- Synthetic placeholder projects: ${syntheticProjects.length}`);
  console.log(`- Candidate authentic projects: ${candidateProjects.length}`);

  // 2. Group candidate projects by builder_id + sector + normalizedBaseName
  const groups = {};
  for (const p of candidateProjects) {
    const base = normalizeBaseName(p.name);
    const key = `${p.builder_id}_${p.sector.trim().toLowerCase()}_${base.toLowerCase()}`;
    if (!groups[key]) {
      groups[key] = {
        baseName: base,
        sector: p.sector,
        city: p.city,
        builderName: p.builder?.name,
        builderId: p.builder_id,
        projects: []
      };
    }
    groups[key].projects.push(p);
  }

  const multiGroups = Object.values(groups).filter(g => g.projects.length > 1);
  const singleGroups = Object.values(groups).filter(g => g.projects.length === 1);

  console.log(`- Authentic single projects (no merger needed): ${singleGroups.length}`);
  console.log(`- Multi-phase/tower groups to merge: ${multiGroups.length} (comprising ${multiGroups.reduce((acc, g) => acc + g.projects.length, 0)} project rows)\n`);

  const stats = {
    canonicalUpdated: 0,
    unitTypesReparented: 0,
    unitTypesMerged: 0,
    imagesReparented: 0,
    leadsRepointed: 0,
    siteVisitsRepointed: 0,
    bookmarksRepointed: 0,
    chatsRepointed: 0,
    redundantProjectsDeleted: 0,
    syntheticProjectsDeleted: 0,
  };

  // Process multi-phase groups
  for (const g of multiGroups) {
    // Determine canonical project:
    // Prefer row whose name exactly matches baseName, or lowest phase number / first row
    let canonical = g.projects.find(p => p.name.trim().toLowerCase() === g.baseName.toLowerCase());
    if (!canonical) {
      canonical = g.projects[0];
    }

    const children = g.projects.filter(p => p.id !== canonical.id);
    const targetName = g.baseName;
    const baseTargetSlug = slugify(`${targetName}-${canonical.sector}-${canonical.city}`);

    if (isDryRun) {
      console.log(`[DRY-RUN] Merging group "${targetName}" (${canonical.sector}):`);
      console.log(`   Canonical: "${canonical.name}" [ID: ${canonical.id}]`);
      children.forEach(c => console.log(`   Child to merge & delete: "${c.name}" [ID: ${c.id}]`));
    } else {
      // 1. Give children temporary slugs so they never collide with targetSlug
      for (const child of children) {
        await prisma.project.update({
          where: { id: child.id },
          data: { slug: `temp-del-${child.id}` }
        });
      }

      // 2. Resolve available slug for canonical
      const finalCanonicalSlug = await getAvailableSlug(baseTargetSlug, canonical.id);

      // 3. Aggregate totals
      let totalUnits = canonical.total_units || 0;
      let totalTowers = canonical.total_towers || 0;
      let hasUnderConstruction = canonical.status === 'under_construction';

      for (const child of children) {
        if (child.total_units) totalUnits += child.total_units;
        if (child.total_towers) totalTowers += child.total_towers;
        if (child.status === 'under_construction') hasUnderConstruction = true;
      }

      // Update canonical project
      await prisma.project.update({
        where: { id: canonical.id },
        data: {
          name: targetName,
          slug: finalCanonicalSlug,
          total_units: totalUnits > 0 ? totalUnits : undefined,
          total_towers: totalTowers > 0 ? totalTowers : undefined,
          status: hasUnderConstruction ? 'under_construction' : canonical.status,
        }
      });
      stats.canonicalUpdated++;

      // 4. Reparent & Merge UnitTypes
      const canonicalUnitTypes = await prisma.unitType.findMany({ where: { project_id: canonical.id } });

      for (const child of children) {
        const childLabel = extractPhaseOrTowerLabel(child.name);
        for (const u of child.unit_types) {
          // Check if equivalent config already exists on canonical
          const match = canonicalUnitTypes.find(cu => 
            cu.bhk === u.bhk && 
            Math.abs((cu.super_area_sqft || 0) - (u.super_area_sqft || 0)) <= 50
          );

          if (match) {
            // Merge tower association
            const existingTowers = match.tower_association || [];
            const newTowers = Array.from(new Set([...existingTowers, childLabel]));
            await prisma.unitType.update({
              where: { id: match.id },
              data: {
                tower_association: newTowers,
                towers: newTowers,
              }
            });
            // Delete redundant unit_type
            await prisma.unitType.delete({ where: { id: u.id } });
            stats.unitTypesMerged++;
          } else {
            // Reparent child unit_type to canonical
            const childTowers = (u.tower_association && u.tower_association.length > 0 && u.tower_association[0] !== 'Tower A')
              ? u.tower_association
              : [childLabel];
            await prisma.unitType.update({
              where: { id: u.id },
              data: {
                project_id: canonical.id,
                tower_association: childTowers,
                towers: childTowers,
              }
            });
            canonicalUnitTypes.push(u);
            stats.unitTypesReparented++;
          }
        }

        // Reparent images
        for (const img of child.images) {
          const exists = await prisma.projectImage.findFirst({
            where: { project_id: canonical.id, url: img.url }
          });
          if (!exists) {
            await prisma.projectImage.update({
              where: { id: img.id },
              data: { project_id: canonical.id }
            });
            stats.imagesReparented++;
          } else {
            await prisma.projectImage.delete({ where: { id: img.id } });
          }
        }

        // Reparent milestones
        for (const ms of child.construction_milestones) {
          await prisma.constructionMilestone.update({
            where: { id: ms.id },
            data: {
              project_id: canonical.id,
              tower: ms.tower || childLabel
            }
          });
        }

        // Reparent price history
        for (const ph of child.price_history) {
          await prisma.priceHistory.update({
            where: { id: ph.id },
            data: { project_id: canonical.id }
          });
        }

        // Reparent customer leads (CallbackRequest)
        const leadsUpdated = await prisma.callbackRequest.updateMany({
          where: { project_slug: child.slug },
          data: { project_slug: finalCanonicalSlug, project_name: targetName }
        });
        stats.leadsRepointed += leadsUpdated.count;

        // Reparent site visits
        const svUpdated = await prisma.siteVisitRequest.updateMany({
          where: { project_slug: child.slug },
          data: { project_slug: finalCanonicalSlug, project_name: targetName }
        });
        stats.siteVisitsRepointed += svUpdated.count;

        // Reparent saved properties
        const childSaved = await prisma.savedProperty.findMany({ where: { project_id: child.id } });
        for (const sp of childSaved) {
          const existing = await prisma.savedProperty.findUnique({
            where: { user_id_project_id: { user_id: sp.user_id, project_id: canonical.id } }
          });
          if (existing) {
            await prisma.savedProperty.delete({ where: { id: sp.id } });
          } else {
            await prisma.savedProperty.update({
              where: { id: sp.id },
              data: { project_id: canonical.id }
            });
            stats.bookmarksRepointed++;
          }
        }

        // Reparent chat sessions
        const chatsUpdated = await prisma.chatSession.updateMany({
          where: { focus_project_id: child.id },
          data: { focus_project_id: canonical.id }
        });
        stats.chatsRepointed += chatsUpdated.count;

        // Reparent feedback
        await prisma.propertyFeedback.updateMany({
          where: { project_id: child.id },
          data: { project_id: canonical.id }
        });

        // Clean up child-specific sub-records
        await prisma.projectDna.deleteMany({ where: { project_id: child.id } });
        await prisma.decisionProfile.deleteMany({ where: { project_id: child.id } });
        await prisma.personaProfile.deleteMany({ where: { project_id: child.id } });
        await prisma.recommendationProfile.deleteMany({ where: { project_id: child.id } });
        await prisma.paymentPlan.deleteMany({ where: { project_id: child.id } });
        await prisma.amenity.deleteMany({ where: { project_id: child.id } });
        await prisma.projectSpecItem.deleteMany({ where: { project_id: child.id } });
        await prisma.constructionUpdate.deleteMany({ where: { project_id: child.id } });
        await prisma.projectLifecycleUpdate.deleteMany({ where: { project_id: child.id } });
        await prisma.projectCompetitor.deleteMany({ where: { project_id: child.id } });
        await prisma.projectCompetitor.deleteMany({ where: { competitor_project_id: child.id } });
        await prisma.projectChannelPartner.deleteMany({ where: { project_id: child.id } });

        // Finally delete the child project row
        await prisma.project.delete({ where: { id: child.id } });
        stats.redundantProjectsDeleted++;
      }

      // Recalculate price range on canonical from its final unit types
      const finalUnitTypes = await prisma.unitType.findMany({ where: { project_id: canonical.id } });
      const prices = finalUnitTypes.map(u => u.price_min_cr).filter(p => typeof p === 'number' && p > 0);
      const maxPrices = finalUnitTypes.map(u => u.price_max_cr).filter(p => typeof p === 'number' && p > 0);
      if (prices.length > 0) {
        const minP = Math.min(...prices);
        const maxP = maxPrices.length > 0 ? Math.max(...maxPrices) : Math.max(...prices);
        await prisma.project.update({
          where: { id: canonical.id },
          data: {
            price_min_cr: minP,
            price_range_label: `₹${minP.toFixed(2)} Cr - ₹${maxP.toFixed(2)} Cr`
          }
        });
      }
    }
  }

  // 3. Purge synthetic projects
  console.log(`\nPurging ${syntheticProjects.length} synthetic placeholder projects...`);
  for (const syn of syntheticProjects) {
    if (!isDryRun) {
      await prisma.callbackRequest.deleteMany({ where: { project_slug: syn.slug } });
      await prisma.siteVisitRequest.deleteMany({ where: { project_slug: syn.slug } });
      await prisma.savedProperty.deleteMany({ where: { project_id: syn.id } });
      await prisma.chatSession.updateMany({ where: { focus_project_id: syn.id }, data: { focus_project_id: null } });
      await prisma.propertyFeedback.deleteMany({ where: { project_id: syn.id } });

      await prisma.unitType.deleteMany({ where: { project_id: syn.id } });
      await prisma.projectImage.deleteMany({ where: { project_id: syn.id } });
      await prisma.constructionMilestone.deleteMany({ where: { project_id: syn.id } });
      await prisma.constructionUpdate.deleteMany({ where: { project_id: syn.id } });
      await prisma.projectLifecycleUpdate.deleteMany({ where: { project_id: syn.id } });
      await prisma.priceHistory.deleteMany({ where: { project_id: syn.id } });
      await prisma.projectDna.deleteMany({ where: { project_id: syn.id } });
      await prisma.decisionProfile.deleteMany({ where: { project_id: syn.id } });
      await prisma.personaProfile.deleteMany({ where: { project_id: syn.id } });
      await prisma.recommendationProfile.deleteMany({ where: { project_id: syn.id } });
      await prisma.paymentPlan.deleteMany({ where: { project_id: syn.id } });
      await prisma.amenity.deleteMany({ where: { project_id: syn.id } });
      await prisma.projectSpecItem.deleteMany({ where: { project_id: syn.id } });
      await prisma.projectCompetitor.deleteMany({ where: { project_id: syn.id } });
      await prisma.projectCompetitor.deleteMany({ where: { competitor_project_id: syn.id } });
      await prisma.projectChannelPartner.deleteMany({ where: { project_id: syn.id } });

      await prisma.project.delete({ where: { id: syn.id } });
      stats.syntheticProjectsDeleted++;
    }
  }

  console.log(`\n======================================================`);
  console.log(`   EXECUTION SUMMARY`);
  console.log(`======================================================`);
  console.log(`Initial project count in DB: ${allProjects.length}`);
  console.log(`Multi-phase groups consolidated: ${multiGroups.length}`);
  console.log(`Redundant phase rows removed: ${isDryRun ? multiGroups.reduce((acc, g) => acc + (g.projects.length - 1), 0) : stats.redundantProjectsDeleted}`);
  console.log(`Synthetic placeholder rows purged: ${isDryRun ? syntheticProjects.length : stats.syntheticProjectsDeleted}`);
  console.log(`Unit types merged: ${stats.unitTypesMerged}`);
  console.log(`Unit types reparented: ${stats.unitTypesReparented}`);
  console.log(`Images reparented: ${stats.imagesReparented}`);
  console.log(`Leads repointed: ${stats.leadsRepointed}`);
  console.log(`Bookmarks repointed: ${stats.bookmarksRepointed}`);
  console.log(`Chats repointed: ${stats.chatsRepointed}`);

  if (!isDryRun) {
    const finalCount = await prisma.project.count();
    console.log(`\n🎉 FINAL VERIFIED PROJECT COUNT IN DATABASE: ${finalCount}`);
  }
  console.log(`======================================================\n`);
}

run().catch(console.error).finally(() => prisma.$disconnect());

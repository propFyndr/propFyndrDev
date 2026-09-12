require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const updates = [
  { slug: 'parsvnath-prestige-sector-93a', total_units: 450, possession_label: 'Ready to Move' },
  { slug: 'samridhi-daksh-avenue-sector-150', total_units: 455, possession_label: 'Under Construction' },
  { slug: 'ats-picturesque-reprieves-sector-152', total_units: 750, possession_label: 'Under Construction' },
  { slug: 'county-107-sector-107', total_units: 230, possession_label: 'Under Construction' },
  { slug: 'gaur-saundaryam-techzone-4', total_units: 1200, possession_label: 'Ready to Move' },
  { slug: 'nri-city-township-omega-1', total_units: 850, possession_label: 'Ready to Move' },
  { slug: 'godrej-tropical-isle-sector-146', total_units: 710, possession_label: 'Under Construction' },
  { slug: 'ajnara-le-garden-sector-16b', total_units: 1650, possession_label: 'Ready to Move' },
  { slug: 'shri-radha-sky-gardens-sector-16b', total_units: 1800, possession_label: 'Ready to Move' },
  { slug: 'mahagun-meadows-sector-150', total_units: 600, possession_label: 'Ready to Move' },
  { slug: 'supertech-orb-sector-74', total_units: 620, possession_label: 'Under Construction' },
  { slug: 'supertech-emerald-court-sector-93a', total_units: 660, possession_label: 'Ready to Move' },
];

async function main() {
  console.log(`Updating ${updates.length} projects with missing core fields...`);
  let updatedCount = 0;
  for (const item of updates) {
    const res = await prisma.project.updateMany({
      where: { slug: item.slug },
      data: {
        total_units: item.total_units,
        possession_label: item.possession_label,
      }
    });
    if (res.count > 0) {
      updatedCount++;
      console.log(`✅ Updated ${item.slug}: units=${item.total_units}, possession=${item.possession_label}`);
    } else {
      console.log(`⚠️ Project with slug ${item.slug} not found`);
    }
  }
  console.log(`Done. ${updatedCount} / ${updates.length} projects successfully updated.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

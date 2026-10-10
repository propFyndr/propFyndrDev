require('dotenv').config({ path: './backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

const MASTER_DIR = path.join(__dirname, '../../newProj/75');

async function stripGeneratedFallbacks() {
  console.log('Stripping generated fallback text from database and master files...');

  const stockHero = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80';
  const fallbackThemes = [
    'Contemporary High-Rise Tower with Panoramic Balconies',
    'Modern Low-Density Gated Community with Landscaped Green Podium'
  ];

  // 1. Revert in PostgreSQL
  const dbProjects = await prisma.project.findMany();
  let strippedHeroes = 0;
  let strippedThemes = 0;
  let strippedDescriptions = 0;

  for (const p of dbProjects) {
    const updateData = {};

    if (p.hero_image_url === stockHero) {
      updateData.hero_image_url = null;
      strippedHeroes++;
    }

    if (fallbackThemes.includes(p.design_theme)) {
      updateData.design_theme = null;
      strippedThemes++;
    }

    if (p.long_description && p.long_description.includes('is a premier') && p.long_description.includes('Featuring') && p.long_description.includes('open greens')) {
      updateData.long_description = null;
      strippedDescriptions++;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.project.update({
        where: { id: p.id },
        data: updateData
      });
    }
  }

  console.log(`Reverted in PostgreSQL:`);
  console.log(`- ${strippedHeroes} stock hero images -> null`);
  console.log(`- ${strippedThemes} generic design themes -> null`);
  console.log(`- ${strippedDescriptions} templated descriptions -> null`);

  // 2. Revert in newProj/75
  if (fs.existsSync(MASTER_DIR)) {
    const files = fs.readdirSync(MASTER_DIR).filter(f => f.endsWith('.json'));
    let fileCount = 0;

    for (const f of files) {
      const fullPath = path.join(MASTER_DIR, f);
      try {
        const raw = fs.readFileSync(fullPath, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          let dirty = false;
          list.forEach(item => {
            if (item.hero_image_url === stockHero) {
              item.hero_image_url = null;
              dirty = true;
            }
            if (fallbackThemes.includes(item.design_theme)) {
              item.design_theme = null;
              dirty = true;
            }
            if (item.long_description && item.long_description.includes('is a premier') && item.long_description.includes('Featuring')) {
              item.long_description = null;
              dirty = true;
            }
          });
          if (dirty) {
            fs.writeFileSync(fullPath, JSON.stringify(list, null, 2));
            fileCount++;
          }
        }
      } catch {}
    }
    console.log(`Reverted in ${fileCount} master JSON files in newProj/75.`);
  }

  await prisma.$disconnect();
}

stripGeneratedFallbacks().catch(console.error);

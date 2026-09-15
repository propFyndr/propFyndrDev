const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

async function backup() {
  console.log('Starting full project database backup...');
  const backupDir = path.resolve(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const projects = await prisma.project.findMany({
    include: {
      unit_types: true,
      amenities: true,
      images: true,
      price_history: true,
      construction_milestones: true,
      construction_updates: true,
      spec_items: true,
      decision_profile: true,
      persona_profile: true,
      recommendation_profile: true,
      dna: true,
      payment_plans: true,
    }
  });

  const targetPath = path.join(backupDir, 'db_backup_pre_consolidation.json');
  fs.writeFileSync(targetPath, JSON.stringify(projects, null, 2));
  console.log(`Backup completed: ${projects.length} projects backed up to ${targetPath}`);
}

backup().catch(console.error).finally(() => prisma.$disconnect());

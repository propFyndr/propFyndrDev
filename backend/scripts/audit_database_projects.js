require('dotenv').config({ path: './backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.project.count();
  const projects = await prisma.project.findMany({
    include: {
      builder: true,
      unit_types: true,
      payment_plans: true,
      amenities: true
    }
  });

  console.log(`Total DB Projects: ${count}`);

  const withRera = projects.filter(p => p.rera_number && p.rera_number !== 'null');
  const withReraUrl = projects.filter(p => p.rera_url && p.rera_url.includes('up-rera.in'));
  const withEscrow = projects.filter(p => p.escrow_bank_name);
  const withCoords = projects.filter(p => p.lat && p.lng);
  const withUnits = projects.filter(p => p.unit_types && p.unit_types.length > 0);
  const withPlans = projects.filter(p => p.payment_plans && p.payment_plans.length > 0);

  console.log(`- With RERA Number: ${withRera.length}`);
  console.log(`- With Verified RERA URL: ${withReraUrl.length}`);
  console.log(`- With Verified Escrow Bank: ${withEscrow.length}`);
  console.log(`- With Coordinates (lat/lng): ${withCoords.length}`);
  console.log(`- With Unit Configurations: ${withUnits.length}`);
  console.log(`- With Payment Plans: ${withPlans.length}`);

  // Distinct cities
  const cities = {};
  projects.forEach(p => {
    cities[p.city] = (cities[p.city] || 0) + 1;
  });
  console.log('Projects by City:', cities);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

require('dotenv').config({ path: './backend/.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectSample() {
  const targetNames = [
    'Civitech Stadia',
    'Arihant Abode',
    'ATS Happy Trails',
    'Mahagun Mezzaria',
    'Godrej Nest'
  ];

  for (const name of targetNames) {
    const p = await prisma.project.findFirst({
      where: { name: { contains: name, mode: 'insensitive' } },
      include: {
        builder: true,
        unit_types: true
      }
    });

    if (p) {
      console.log(`\n======================================================`);
      console.log(`Project: ${p.name} (${p.city}, ${p.sector})`);
      console.log(`RERA Number: ${p.rera_number}`);
      console.log(`RERA Link: ${p.rera_url}`);
      console.log(`Coordinates: Lat ${p.lat}, Lng ${p.lng}`);
      console.log(`Land Area: ${p.land_area_acres} Acres | Towers: ${p.total_towers} | Units: ${p.total_units}`);
      console.log(`Escrow Bank: ${p.escrow_bank_name} (Verified: ${p.escrow_verified})`);
      console.log(`Architect: ${p.architect}`);
      console.log(`Approvals / Sanction: ${p.approvals_status}`);
      console.log(`RERA Validity: ${p.rera_valid_until}`);
      console.log(`Possession: ${p.possession_date} (${p.possession_label})`);
      console.log(`Real Unit Types: ${p.unit_types.length} configurations`);
    }
  }
  await prisma.$disconnect();
}

inspectSample().catch(console.error);

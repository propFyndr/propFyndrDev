import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Use existing Godrej Properties
  const godrej = await prisma.builder.findFirst({
    where: { name: { contains: 'Godrej' } }
  })

  if (!godrej) {
    console.log('Godrej Properties not found!')
    return
  }

  // Create Godrej Palm Retreat test project
  const palmRetreat = await prisma.project.upsert({
    where: { slug: 'godrej-palm-retreat-noida-test' },
    update: {},
    create: {
      name: 'Godrej Palm Retreat (Test)',
      slug: 'godrej-palm-retreat-noida-test',
      builder_id: godrej.id,
      sector: 'Sector 150',
      status: 'ready_to_move',
      possession_date: new Date('2025-06-01'),
      launch_date: new Date('2020-06-01'),
      rera_number: 'UP-RERA-PS-2021-00123',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
    }
  })

  // Create unit type
  await prisma.unitType.deleteMany({ where: { project_id: palmRetreat.id } })
  await prisma.unitType.create({
    data: {
      project_id: palmRetreat.id,
      name: '3 BHK',
      bhk: 3,
      price_min_cr: 1.8,
      price_max_cr: 2.2,
      carpet_area_sqft: 1650,
      super_area_sqft: 2100,
      bathrooms: 2,
    }
  })

  console.log('✓ Test project seeded (Godrej Palm Retreat)')
}

main().catch(console.error).finally(() => prisma.$disconnect())

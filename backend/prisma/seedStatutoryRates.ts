import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function seedStatutoryRates() {
  console.log('[SEED] Seeding State, City, and StatutoryRate records...')

  // 1. Seed State: UP
  const upState = await prisma.state.upsert({
    where: { code: 'UP' },
    update: { name: 'Uttar Pradesh' },
    create: { code: 'UP', name: 'Uttar Pradesh' },
  })

  // 2. Seed Cities: Noida, Greater Noida, Greater Noida West, Yamuna Expressway
  const citiesData = [
    { name: 'Noida', inventoryLive: true },
    { name: 'Greater Noida', inventoryLive: true },
    { name: 'Greater Noida West', inventoryLive: true },
    { name: 'Yamuna Expressway', inventoryLive: true },
    { name: 'Gurgaon', inventoryLive: false },
    { name: 'Bengaluru', inventoryLive: false },
    { name: 'Mumbai', inventoryLive: false },
  ]

  for (const c of citiesData) {
    await prisma.city.upsert({
      where: { name_state_code: { name: c.name, state_code: 'UP' } },
      update: { inventory_live: c.inventoryLive },
      create: {
        name: c.name,
        state_code: 'UP',
        inventory_live: c.inventoryLive,
      },
    })
  }

  // 3. Seed Statutory Rates for UP
  const rates = [
    {
      kind: 'stamp_duty',
      rate_pct: 7.0,
      condition: { gender: 'male' },
      source_url: 'https://igrsup.gov.in',
    },
    {
      kind: 'stamp_duty',
      rate_pct: 6.0,
      condition: { gender: 'female' },
      source_url: 'https://igrsup.gov.in',
    },
    {
      kind: 'stamp_duty',
      rate_pct: 6.5,
      condition: { gender: 'joint' },
      source_url: 'https://igrsup.gov.in',
    },
    {
      kind: 'registration',
      rate_pct: 1.0,
      condition: null,
      source_url: 'https://igrsup.gov.in',
    },
    {
      kind: 'gst',
      rate_pct: 5.0,
      condition: { category: 'standard', status: 'under_construction' },
      source_url: 'https://cbic.gov.in',
    },
    {
      kind: 'gst',
      rate_pct: 1.0,
      condition: { category: 'affordable_housing', status: 'under_construction' },
      source_url: 'https://cbic.gov.in',
    },
    {
      kind: 'gst',
      rate_pct: 0.0,
      condition: { status: 'ready_to_move' },
      source_url: 'https://cbic.gov.in',
    },
  ]

  const effectiveFrom = new Date('2024-01-01T00:00:00.000Z')

  for (const r of rates) {
    const existing = await prisma.statutoryRate.findFirst({
      where: {
        state_code: 'UP',
        kind: r.kind,
        rate_pct: r.rate_pct,
      },
    })

    if (!existing) {
      await prisma.statutoryRate.create({
        data: {
          state_code: 'UP',
          kind: r.kind,
          rate_pct: r.rate_pct,
          condition: r.condition,
          effective_from: effectiveFrom,
          source_url: r.source_url,
          status: 'PUBLISHED',
        },
      })
    }
  }

  console.log('[SEED] Statutory rates and national geography seeded successfully.')
}

if (require.main === module) {
  seedStatutoryRates()
    .then(() => prisma.$disconnect())
    .catch((err) => {
      console.error('[SEED] Error seeding statutory rates:', err)
      prisma.$disconnect()
      process.exit(1)
    })
}

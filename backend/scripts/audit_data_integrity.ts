import { prisma } from '../src/lib/db'

async function run() {
  console.log('=== BUILDERS AUDIT ===')
  const totalBuilders = await prisma.builder.count()
  const defaultDelayBuilders = await prisma.builder.count({
    where: { average_delay_months: 0, delivered_units: 10000 }
  })
  const fakeAwardsBuilders = await prisma.builder.count({
    where: { awards: { has: 'CREDAI Excellence in Construction Award' } }
  })
  console.log({ totalBuilders, defaultDelayBuilders, fakeAwardsBuilders })

  const sampledBuilders = await prisma.builder.findMany({
    select: { name: true, delivered_units: true, average_delay_months: true, delayed_projects_count: true, rera_compliance_score: true, delivery_score: true },
    take: 15
  })
  console.log('Sampled Builders:', sampledBuilders)

  console.log('=== CONNECTIVITY AUDIT ===')
  const totalConnectivity = await prisma.connectivity.count()
  // How many projects have "Gaur Chowk / Sector 52 Metro Link"
  const gaurChowkCount = await prisma.connectivity.count({
    where: { name: { contains: 'Gaur Chowk' } }
  })
  console.log({ totalConnectivity, gaurChowkCount })

  // Find projects outside Greater Noida West that have Gaur Chowk as 1.2km!
  const bogusGaurChowk = await prisma.connectivity.findMany({
    where: {
      name: { contains: 'Gaur Chowk' },
      project: { sector: { notIn: ['Sector 1', 'Sector 4', 'Sector 10', 'Sector 12', 'Sector 16', 'Techzone 4'] } }
    },
    select: {
      distance_km: true,
      project: { select: { name: true, sector: true } }
    },
    take: 10
  })
  console.log('Bogus Gaur Chowk in distant projects:', bogusGaurChowk)

  console.log('=== PROJECT FLAGS AUDIT ===')
  const amrapaliProjects = await prisma.project.findMany({
    where: { name: { contains: 'Amrapali' } },
    select: { id: true, name: true, legal_flag: true, litigation_count: true, builder: { select: { name: true, legal_flag: true } } }
  })
  console.log('Amrapali projects:', amrapaliProjects)
}

run().catch(console.error).finally(() => prisma.$disconnect())

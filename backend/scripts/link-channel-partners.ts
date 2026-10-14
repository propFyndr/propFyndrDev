import { prisma } from '../src/lib/db'

async function linkPartners() {
  // Get all active channel partners
  const partners = await prisma.channelPartner.findMany({
    where: { is_active: true },
    select: { id: true, name: true, operating_cities: true }
  })

  console.log(`Found ${partners.length} active channel partners`)

  // Get projects without any channel partners
  const projectsWithoutPartners = await prisma.project.findMany({
    where: {
      channel_partners: { none: {} }
    },
    select: { id: true, name: true, sector: true }
  })

  console.log(`Found ${projectsWithoutPartners.length} projects needing partners`)

  let assigned = 0

  for (const project of projectsWithoutPartners) {
    // Try to find a partner with matching sector/city
    let selectedPartner = partners.find(p =>
      p.operating_cities.some(city =>
        city.toLowerCase().includes(project.sector?.toLowerCase() || '')
      )
    )

    // If no sector match, assign to first active partner (round-robin)
    if (!selectedPartner) {
      selectedPartner = partners[assigned % partners.length]
    }

    if (selectedPartner) {
      await prisma.projectChannelPartner.create({
        data: {
          project_id: project.id,
          channel_partner_id: selectedPartner.id,
          is_featured: false
        }
      })
      assigned++
    }
  }

  console.log(`✅ Linked ${assigned} projects to channel partners`)
  await prisma.$disconnect()
}

linkPartners().catch(err => {
  console.error('❌ Link partners failed:', err)
  process.exit(1)
})

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      rera_number: true,
      description: true,
      unit_types: { select: { id: true, price_min_cr: true } },
      images: { select: { id: true } },
    },
  })

  console.log(`Total projects in DB: ${projects.length}`)
  const noRera = projects.filter((p) => !p.rera_number)
  const noDesc = projects.filter((p) => !p.description || p.description.length < 20)
  const noUnits = projects.filter((p) => !p.unit_types || p.unit_types.length === 0)
  const noImages = projects.filter((p) => !p.images || p.images.length === 0)
  const noPrice = projects.filter((p) => !p.unit_types.some((u) => u.price_min_cr != null))

  console.log({
    noRera: noRera.length,
    noDesc: noDesc.length,
    noUnits: noUnits.length,
    noImages: noImages.length,
    noPrice: noPrice.length,
  })

  if (noRera.length > 0) console.log('Projects missing RERA:', noRera.map((p) => ({ id: p.id, name: p.name })))
  if (noDesc.length > 0) console.log('Projects missing Description:', noDesc.map((p) => ({ id: p.id, name: p.name })))
  if (noUnits.length > 0) console.log('Projects missing Units:', noUnits.map((p) => ({ id: p.id, name: p.name })))
  if (noImages.length > 0) console.log('Projects missing Images:', noImages.map((p) => ({ id: p.id, name: p.name })))
  if (noPrice.length > 0) console.log('Projects missing Price:', noPrice.map((p) => ({ id: p.id, name: p.name })))
}

main()
  .catch((e) => {
    console.error('Error:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

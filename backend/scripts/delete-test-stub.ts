import { PrismaClient } from '@prisma/client'
import { deleteCached } from '../src/lib/cache.js'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      name: { contains: 'Mirabella', mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      builder: { select: { name: true } },
      unit_types: { select: { id: true } },
      images: { select: { id: true } },
      description: true,
      rera_number: true,
    },
  })

  console.log(`Found ${projects.length} Mirabella projects:`)
  for (const p of projects) {
    console.log({
      id: p.id,
      name: p.name,
      slug: p.slug,
      builder: p.builder?.name,
      unitsCount: p.unit_types.length,
      imagesCount: p.images.length,
      hasRera: !!p.rera_number,
      hasDescription: !!p.description,
    })

    // If it's the test stub (Test Builder, or 0 units and 0 images and slug with timestamp)
    if (p.builder?.name === 'Test Builder' || (p.unit_types.length === 0 && p.images.length === 0 && !p.rera_number)) {
      console.log(`Deleting stub project: ${p.id} (${p.name})`)
      await prisma.project.delete({ where: { id: p.id } })
      console.log(`Deleted stub project ${p.id}`)
    }
  }

  await deleteCached('admin:project-completeness:v1')
  console.log('Completeness cache key invalidated.')
}

main()
  .catch((e) => {
    console.error('Error in script:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      sector: true,
      city: true,
      builder: { select: { name: true } },
      unit_types: { select: { id: true } },
      images: { select: { id: true } },
      created_at: true,
    },
    orderBy: { name: 'asc' },
  })

  // Group by name lowercase
  const map = new Map<string, typeof projects>()
  for (const p of projects) {
    const key = p.name.trim().toLowerCase()
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(p)
  }

  const duplicates: any[] = []
  for (const [name, list] of map.entries()) {
    if (list.length > 1) {
      duplicates.push({
        name,
        count: list.length,
        items: list.map((x) => ({
          id: x.id,
          name: x.name,
          slug: x.slug,
          builder: x.builder?.name,
          sector: x.sector,
          units: x.unit_types.length,
          images: x.images.length,
          created: x.created_at,
        })),
      })
    }
  }

  console.log(`Found ${duplicates.length} duplicate project names:`)
  console.log(JSON.stringify(duplicates, null, 2))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())

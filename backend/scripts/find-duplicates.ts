import { prisma } from '../src/lib/db'

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      sector: true,
      status: true,
      builder: { select: { name: true } },
      _count: { select: { unit_types: true, images: true, amenities: true } }
    },
    orderBy: { name: 'asc' }
  })

  const byName = new Map<string, typeof projects>()
  for (const p of projects) {
    const key = p.name.trim().toLowerCase()
    if (!byName.has(key)) byName.set(key, [])
    byName.get(key)!.push(p)
  }

  const dupes = Array.from(byName.entries()).filter(([_, list]) => list.length > 1)
  console.log(`Total projects in DB: ${projects.length}`)
  console.log(`Total duplicate project names: ${dupes.length}\n`)

  for (const [name, list] of dupes) {
    console.log(`=== "${name}" (${list.length} copies) ===`)
    for (const item of list) {
      console.log(`  - ID: ${item.id}`)
      console.log(`    Slug: ${item.slug}`)
      console.log(`    Builder: ${item.builder?.name}`)
      console.log(`    Sector: ${item.sector}`)
      console.log(`    Status: ${item.status}`)
      console.log(`    Data: ${item._count.unit_types} units, ${item._count.images} images, ${item._count.amenities} amenities\n`)
    }
  }
}

main().catch(console.error)

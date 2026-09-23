import { prisma } from '../src/lib/db'

async function main() {
  console.log('Running high-speed SQL normalization on project_spec_items...')

  const updates = [
    `UPDATE project_spec_items SET category = 'structure' WHERE LOWER(TRIM(category)) IN ('structure', 'structure & safety');`,
    `UPDATE project_spec_items SET category = 'flooring' WHERE LOWER(TRIM(category)) IN ('flooring', 'flooring & finishes', 'balcony');`,
    `UPDATE project_spec_items SET category = 'kitchen' WHERE LOWER(TRIM(category)) IN ('kitchen', 'kitchen & countertops');`,
    `UPDATE project_spec_items SET category = 'bathrooms' WHERE LOWER(TRIM(category)) IN ('sanitaryware', 'sanitary', 'bathrooms', 'bathroom', 'sanitary & cp fittings');`,
    `UPDATE project_spec_items SET category = 'doors_windows' WHERE LOWER(TRIM(category)) IN ('doors & windows', 'doors_windows', 'doors and windows', 'doors', 'windows');`,
    `UPDATE project_spec_items SET category = 'electrical' WHERE LOWER(TRIM(category)) IN ('electrical', 'electrical & switches');`,
    `UPDATE project_spec_items SET category = 'plumbing' WHERE LOWER(TRIM(category)) IN ('plumbing', 'plumbing & water');`,
    `UPDATE project_spec_items SET category = 'lifts' WHERE LOWER(TRIM(category)) IN ('lifts', 'elevators & lifts', 'elevators');`,
    `UPDATE project_spec_items SET category = 'security' WHERE LOWER(TRIM(category)) IN ('security', 'security & automation');`,
    `UPDATE project_spec_items SET category = 'sustainability' WHERE LOWER(TRIM(category)) IN ('green', 'sustainability', 'green & sustainability');`,
    `UPDATE project_spec_items SET category = 'parking' WHERE LOWER(TRIM(category)) IN ('parking', 'parking & ev');`,
  ]

  for (const sql of updates) {
    const affected = await prisma.$executeRawUnsafe(sql)
    console.log(`Executed: ${sql.slice(0, 45)}... -> ${affected} rows updated`)
  }

  // Verify Lotus 300 specs
  const lotus = await prisma.project.findFirst({
    where: { name: { contains: 'Lotus 300', mode: 'insensitive' } },
    include: { spec_items: true },
  })
  console.log(`3C Lotus 300 now has ${lotus?.spec_items.length} items:`)
  for (const s of lotus?.spec_items || []) {
    console.log(`  - [${s.category}] ${s.label}: ${s.value.slice(0, 40)}...`)
  }

  const distinctAfter = await prisma.projectSpecItem.findMany({
    select: { category: true },
    distinct: ['category'],
  })
  console.log('Distinct categories after migration:', distinctAfter.map(d => d.category))
}

main().catch(console.error).finally(() => prisma.$disconnect())

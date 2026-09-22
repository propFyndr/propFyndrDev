// backend/scripts/inspect-misclassifications.ts
import { prisma } from '../src/lib/db'

async function main() {
  const p1 = await prisma.project.findMany({
    where: {
      city: 'Noida',
      sector: { in: ['Pari Chowk', 'Sector Alpha 2', 'Sector Eta 2', 'Sector Omicron 1', 'Sector Techzone 4', 'Sector Zeta 1', 'Jaypee Greens'] }
    },
    select: { id: true, name: true, sector: true, city: true, rera_number: true }
  })
  console.log('--- Misclassified under city="Noida" ---')
  console.log(JSON.stringify(p1, null, 2))

  const p2 = await prisma.project.findMany({
    where: {
      city: 'Greater Noida West',
      sector: { in: ['Sector 100', 'Sector 107', 'Sector 22D Yamuna Expressway', 'Sector 22D / Sec 1', 'Sector 75 / Sec 1'] }
    },
    select: { id: true, name: true, sector: true, city: true, rera_number: true }
  })
  console.log('--- Misclassified under city="Greater Noida West" ---')
  console.log(JSON.stringify(p2, null, 2))
}

main().catch(console.error)

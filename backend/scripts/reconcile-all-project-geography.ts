// backend/scripts/reconcile-all-project-geography.ts
import { prisma } from '../src/lib/db'

async function main() {
  console.log('🔄 Starting Database Geography Reconciliation...')

  // 1. Projects with Sector 100 in Greater Noida West -> city = 'Noida'
  const r1 = await prisma.project.updateMany({
    where: {
      sector: 'Sector 100',
      city: 'Greater Noida West',
    },
    data: { city: 'Noida' }
  })
  console.log(`Updated Sector 100 projects to city='Noida': ${r1.count}`)

  // 2. Projects with Sector 107 in Greater Noida West -> city = 'Noida'
  const r2 = await prisma.project.updateMany({
    where: {
      sector: 'Sector 107',
      city: 'Greater Noida West',
    },
    data: { city: 'Noida' }
  })
  console.log(`Updated Sector 107 projects to city='Noida': ${r2.count}`)

  // 3. AIMS Golf City in 'Sector 75 / Sec 1' -> sector = 'Sector 75', city = 'Noida'
  const r3 = await prisma.project.updateMany({
    where: {
      name: 'AIMS Golf City',
    },
    data: {
      sector: 'Sector 75',
      city: 'Noida',
      address: 'Plot No. SC-01/A-1, Sector 75, Noida, Uttar Pradesh',
    }
  })
  console.log(`Updated AIMS Golf City to Sector 75, Noida: ${r3.count}`)

  // 4. Pari Chowk projects currently labeled as Noida -> city = 'Greater Noida'
  const r4 = await prisma.project.updateMany({
    where: {
      sector: 'Pari Chowk',
      city: 'Noida',
    },
    data: { city: 'Greater Noida' }
  })
  console.log(`Updated Pari Chowk projects to city='Greater Noida': ${r4.count}`)

  // 5. Jaypee Greens Pari Chowk projects currently labeled as Noida -> city = 'Greater Noida'
  const r5 = await prisma.project.updateMany({
    where: {
      sector: 'Jaypee Greens',
      city: 'Noida',
    },
    data: { city: 'Greater Noida' }
  })
  console.log(`Updated Jaypee Greens Pari Chowk projects to city='Greater Noida': ${r5.count}`)

  // 6. Greek sectors in Greater Noida currently labeled as Noida -> city = 'Greater Noida'
  const r6 = await prisma.project.updateMany({
    where: {
      city: 'Noida',
      sector: { in: ['Sector Alpha 2', 'Sector Eta 2', 'Sector Omicron 1', 'Sector Zeta 1'] }
    },
    data: { city: 'Greater Noida' }
  })
  console.log(`Updated Greek sectors to city='Greater Noida': ${r6.count}`)

  // 7. Normalize Greek sector names (remove redundant "Sector " prefix if desired or keep clean)
  // Let's normalize specific messy ones:
  await prisma.project.updateMany({
    where: { sector: 'Sector Alpha 2' },
    data: { sector: 'Alpha 2' }
  })
  await prisma.project.updateMany({
    where: { sector: 'Sector Eta 2' },
    data: { sector: 'Eta 2' }
  })
  await prisma.project.updateMany({
    where: { sector: 'Sector Omicron 1' },
    data: { sector: 'Omicron 1' }
  })
  await prisma.project.updateMany({
    where: { sector: 'Sector Zeta 1' },
    data: { sector: 'Zeta 1' }
  })
  await prisma.project.updateMany({
    where: { sector: 'Sector Chi V' },
    data: { sector: 'Chi 5' }
  })
  await prisma.project.updateMany({
    where: { sector: 'Sector Mu 1' },
    data: { sector: 'Mu 1' }
  })

  // 8. SKA Metro Ville: 'ETA 2 / Greno W' -> sector = 'Eta 2', city = 'Greater Noida'
  const r8 = await prisma.project.updateMany({
    where: {
      name: { contains: 'SKA Metro Ville', mode: 'insensitive' }
    },
    data: {
      sector: 'Eta 2',
      city: 'Greater Noida',
      address: 'Plot No. GH-01, Sector Eta 2, Greater Noida, Uttar Pradesh'
    }
  })
  console.log(`Updated SKA Metro Ville: ${r8.count}`)

  // 9. Migsun Atharva: in Sector Techzone 4 -> sector = 'Techzone 4', city = 'Greater Noida West'
  const r9 = await prisma.project.updateMany({
    where: {
      name: { contains: 'Migsun Atharva', mode: 'insensitive' }
    },
    data: {
      sector: 'Techzone 4',
      city: 'Greater Noida West',
      address: 'Migsun Atharva, Techzone 4, Greater Noida West, Uttar Pradesh'
    }
  })
  console.log(`Updated Migsun Atharva: ${r9.count}`)

  // 10. ACE Terrains / Terra in 'Sector 22D / Sec 1' -> sector = 'Sector 22D', city = 'Yamuna Expressway'
  const r10 = await prisma.project.updateMany({
    where: {
      name: { contains: 'ACE Terrains', mode: 'insensitive' }
    },
    data: {
      sector: 'Sector 22D',
      city: 'Yamuna Expressway',
      address: 'Sector 22D, Yamuna Expressway, Greater Noida / YEIDA, Uttar Pradesh'
    }
  })
  console.log(`Updated ACE Terra: ${r10.count}`)

  // 11. Sector 22D projects labeled as 'Greater Noida West' or 'Sector 22D Yamuna Expressway'
  const r11 = await prisma.project.updateMany({
    where: {
      sector: 'Sector 22D Yamuna Expressway',
    },
    data: {
      sector: 'Sector 22D',
      city: 'Yamuna Expressway',
    }
  })
  console.log(`Updated Sector 22D YEIDA projects: ${r11.count}`)

  console.log('✅ Reconciliation updates completed.')
}

main().catch(console.error)

// backend/scripts/audit-all-project-geography.ts
import { prisma } from '../src/lib/db'

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      sector: true,
      city: true,
      rera_number: true,
    },
    orderBy: [{ city: 'asc' }, { sector: 'asc' }]
  })

  console.log(`Total projects in database: ${projects.length}`)
  
  // Find potential anomalies
  const anomalies: any[] = []
  for (const p of projects) {
    const s = (p.sector || '').trim()
    const c = (p.city || '').trim()
    
    // Check 1: Numeric sector >= 40 in Greater Noida or Greater Noida West (except YEIDA 22D)
    const numMatch = s.match(/Sector\s+(\d+)/i)
    if (numMatch) {
      const num = parseInt(numMatch[1], 10)
      if (num >= 40 && (c === 'Greater Noida West' || c === 'Greater Noida')) {
        anomalies.push({ type: 'HIGH_NUM_IN_GRENO', project: p })
      }
      // Check 2: Sector 150 in Greater Noida or Greater Noida West
      if (num === 150 && c !== 'Noida') {
        anomalies.push({ type: 'SECTOR_150_NOT_IN_NOIDA', project: p })
      }
    }

    // Check 3: Greek letters (Alpha, Beta, Gamma, Delta, Zeta, Eta, Omicron, Chi, Pi, Mu, Omega) in Noida
    if (/alpha|beta|gamma|delta|zeta|eta|omicron|chi|pi|mu|sigma|omega/i.test(s) && c === 'Noida') {
      anomalies.push({ type: 'GREEK_SECTOR_IN_NOIDA', project: p })
    }

    // Check 4: Pari Chowk in Noida
    if (/pari chowk/i.test(s) && c === 'Noida') {
      anomalies.push({ type: 'PARI_CHOWK_IN_NOIDA', project: p })
    }

    // Check 5: Jaypee Greens (Pari Chowk) in Noida
    if (/jaypee greens/i.test(s) && c === 'Noida' && !/wish\s*town/i.test(p.name)) {
      anomalies.push({ type: 'JAYPEE_GREENS_IN_NOIDA', project: p })
    }

    // Check 6: Yamuna Expressway projects in Greater Noida West
    if (/yamuna expressway/i.test(s) && c === 'Greater Noida West') {
      anomalies.push({ type: 'YEIDA_IN_GRENO_WEST', project: p })
    }

    // Check 7: Slashes in sector
    if (s.includes('/')) {
      anomalies.push({ type: 'SLASH_IN_SECTOR', project: p })
    }
  }

  console.log(`Anomalies found: ${anomalies.length}`)
  for (const a of anomalies) {
    console.log(`[${a.type}] ID: ${a.project.id} | Name: "${a.project.name}" | Sector: "${a.project.sector}" | City: "${a.project.city}" | RERA: ${a.project.rera_number}`)
  }
}

main().catch(console.error)

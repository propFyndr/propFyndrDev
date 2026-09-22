// backend/scripts/inspect-edge-projects.ts
import { prisma } from '../src/lib/db'

async function main() {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { sector: { contains: '/' } },
        { name: { in: ['AIMS Golf City', 'ACE Terrains / Terra'] } }
      ]
    },
    select: { id: true, name: true, sector: true, city: true, rera_number: true }
  })
  console.log(JSON.stringify(projects, null, 2))
}

main().catch(console.error)

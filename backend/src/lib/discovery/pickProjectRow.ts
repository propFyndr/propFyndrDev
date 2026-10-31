// backend/src/lib/discovery/pickProjectRow.ts
//
// A `where` that points at the ONE row a typed project name means. Drop-in for
// the `OR: [{ name: { contains } }, { slug: { contains } }]` filter that eight
// handlers each wrote, which returned an arbitrary row when one name contained
// another. Ranking lives in projectRowRank.ts.
import { prisma } from '../db'
import { pickRow } from './projectRowRank'

export async function namedProjectWhere(named: string, message = '') {
  const legacy = {
    OR: [
      { name: { contains: named, mode: 'insensitive' as const } },
      { slug: { contains: named, mode: 'insensitive' as const } },
      ...(named.length === 36 ? [{ id: named }] : []),
    ],
  }
  if (!named) return legacy
  const rows = await prisma.project.findMany({
    where: { archived_duplicate_of: null, ...legacy },
    select: { id: true, name: true, sector: true },
    take: 25,
  })
  const best = pickRow(rows, named, message)
  return best ? { id: best.id } : legacy
}

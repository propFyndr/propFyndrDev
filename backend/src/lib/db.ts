// backend/src/lib/db.ts
import { PrismaClient } from '@prisma/client'
import { withQueryCounting } from './queryCounter'
import { excludeTestLeads } from './excludeTestLeads'
import { excludeArchivedProjects } from './excludeArchivedProjects'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  // Two wrappers, both applied once so no call site has to remember them.
  // `excludeTestLeads` keeps our own test traffic out of every lead read;
  // `withQueryCounting` is a no-op unless MEASURE_DB_QUERIES=1.
  // `excludeArchivedProjects` hides lost duplicate merges from every project read.
  excludeArchivedProjects(excludeTestLeads(withQueryCounting(new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [
          { emit: 'stdout', level: 'query' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ]
      : [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ],
  }))))

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export function isPrismaNotFound(err: unknown): boolean {
  return (err as { code?: string }).code === 'P2025'
}

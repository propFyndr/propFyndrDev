// backend/src/lib/excludeArchivedProjects.ts
//
// A project that lost a duplicate merge stays in the table, with
// `archived_duplicate_of` pointing at the surviving row (schema.prisma, Project).
// It must never reach a buyer. Same reasoning as excludeTestLeads: a list that
// forgets the filter shows the duplicate, and nothing looks wrong.
//
// So the filter sits on the client, applied to every project read.
//
// Opt-out, for admin and the dedupe tooling only: pass the key in `where`.
//   prisma.project.findMany({ where: { archived_duplicate_of: undefined } })  // all rows
//   prisma.project.findMany({ where: { archived_duplicate_of: { not: null } } }) // archived only
// `undefined` is ignored by Prisma, so the key being present is the decision.
//
// findUnique / findUniqueOrThrow cannot take a list filter, so the result is
// checked after the read: an archived row comes back as null (or P2025).
import type { PrismaClient } from '@prisma/client'

const FILTERED_OPERATIONS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow',
  'count', 'aggregate', 'groupBy',
])

const UNIQUE_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow'])

function alreadyDecided(where: unknown): boolean {
  return Boolean(where && typeof where === 'object' && 'archived_duplicate_of' in (where as Record<string, unknown>))
}

function isArchived(row: unknown): boolean {
  return Boolean(row && typeof row === 'object' && (row as { archived_duplicate_of?: unknown }).archived_duplicate_of)
}

export function excludeArchivedProjects(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      project: {
        async $allOperations({ operation, args, query }) {
          if (FILTERED_OPERATIONS.has(operation)) {
            const a = (args ?? {}) as { where?: Record<string, unknown> }
            if (alreadyDecided(a.where)) return query(args)
            return query({ ...a, where: { ...(a.where ?? {}), archived_duplicate_of: null } } as typeof args)
          }

          if (UNIQUE_OPERATIONS.has(operation)) {
            const a = (args ?? {}) as { where?: Record<string, unknown> }
            if (alreadyDecided(a.where)) return query(args)
            const row = await query(args)
            if (!isArchived(row)) return row
            if (operation === 'findUniqueOrThrow') {
              throw Object.assign(new Error('No Project found'), { code: 'P2025' })
            }
            return null
          }

          return query(args)
        },
      },
    },
  }) as unknown as PrismaClient
}

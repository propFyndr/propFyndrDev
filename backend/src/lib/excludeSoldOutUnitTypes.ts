// backend/src/lib/excludeSoldOutUnitTypes.ts
//
// A flat type the builder has marked sold out (approved by us) must never be
// offered to a buyer again. About fifty reads load `unit_types`, for search,
// cards, chat facts, the budget check and the dossier; one that forgets the
// filter offers a flat that is gone, and nothing looks wrong. Same reasoning
// as excludeArchivedProjects, so the filter sits on the client.
//
// Covered, on every read operation of every model:
//   prisma.unitType.findMany({ where })              -> where gains the filter
//   include/select { unit_types: true | {...} }      -> the relation gains it, at any depth
//   where { unit_types: { some: X } }                -> X gains it, at any depth
//
// Opt-out, for admin, the portal and the approval code only: put the key in
// the where yourself.
//   prisma.unitType.findMany({ where: { availability: undefined } })          // all rows
//   include: { unit_types: { where: { availability: undefined } } }           // all rows
// `undefined` is ignored by Prisma, so the key being present is the decision.
//
// Not covered: `every`/`none` relation filters (not used for unit_types today),
// `_count` of the relation, and raw SQL (none reads unit_types for a buyer).
import type { PrismaClient } from '@prisma/client'

const READ_OPERATIONS = new Set([
  'findMany', 'findFirst', 'findFirstOrThrow', 'findUnique', 'findUniqueOrThrow',
  'count', 'aggregate', 'groupBy',
])

const AVAILABLE = { not: 'sold_out' }

type Obj = Record<string, unknown>

function isPlain(v: unknown): v is Obj {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype
}

function decided(where: unknown): boolean {
  return isPlain(where) && 'availability' in where
}

function withAvailable(where: unknown): Obj {
  return decided(where) ? (where as Obj) : { ...(isPlain(where) ? where : {}), availability: AVAILABLE }
}

/** Rewrites `unit_types: { some: X }` anywhere inside a where. */
function filterWhere(where: unknown): unknown {
  if (Array.isArray(where)) return where.map(filterWhere)
  if (!isPlain(where)) return where
  const out: Obj = {}
  for (const [k, v] of Object.entries(where)) {
    if (k === 'unit_types' && isPlain(v) && 'some' in v) out[k] = { ...v, some: withAvailable(filterWhere(v.some)) }
    else out[k] = filterWhere(v)
  }
  return out
}

/** Rewrites `unit_types` in an include/select tree, and the wheres nested in it. */
function filterTree(tree: unknown): unknown {
  if (!isPlain(tree)) return tree
  const out: Obj = {}
  for (const [k, v] of Object.entries(tree)) {
    if (k === '_count') {
      out[k] = v
    } else if (k === 'unit_types') {
      out[k] = v === true ? { where: { availability: AVAILABLE } } : isPlain(v) ? filterRelation(v, true) : v
    } else if (isPlain(v)) {
      out[k] = filterRelation(v, false)
    } else {
      out[k] = v
    }
  }
  return out
}

function filterRelation(args: Obj, isUnitTypes: boolean): Obj {
  const out: Obj = { ...args }
  if (isUnitTypes) out.where = withAvailable(filterWhere(args.where))
  else if ('where' in args) out.where = filterWhere(args.where)
  if ('include' in args) out.include = filterTree(args.include)
  if ('select' in args) out.select = filterTree(args.select)
  return out
}

export function filterUnitTypeArgs(model: string, args: unknown): unknown {
  if (!isPlain(args)) return model === 'UnitType' ? { where: { availability: AVAILABLE } } : args
  const out = filterRelation(args, false)
  if (model === 'UnitType') out.where = withAvailable(out.where)
  return out
}

export function excludeSoldOutUnitTypes(client: PrismaClient): PrismaClient {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!READ_OPERATIONS.has(operation)) return query(args)
          return query(filterUnitTypeArgs(model, args) as typeof args)
        },
      },
    },
  }) as unknown as PrismaClient
}

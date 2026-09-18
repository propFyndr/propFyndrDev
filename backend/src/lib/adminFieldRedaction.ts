// backend/src/lib/adminFieldRedaction.ts
//
// Strips fields a staff role may not see from every admin response.
//
// `adminPolicy.ts` answers "may this role open this path". It cannot answer
// "may this role see this column", and some columns are sensitive inside paths
// the role legitimately needs: a salesperson must read `/channel-partners` to
// know who is working a lead, and that same row carries the commission rate we
// pay that firm. Path-level policy either gives them the commission or takes
// away the partner list.
//
// Applied at the mount, for the same reason the role policy is: sibling routers
// do not pass through `admin.ts`, and a redactor living inside one file would
// protect one file. A router added next month inherits this.
//
// Deliberately a DENY list keyed by exact field name, not an allow list. An
// allow list here would mean every new column is invisible until someone
// remembers to permit it, which is how a redactor gets ripped out six weeks
// later. The cost of the deny list is that a genuinely sensitive column added
// later is exposed until it is named — so the rule is the same one
// `projectExposure.ts` already states: adding a column is a disclosure
// decision.
import type { Request, Response, NextFunction } from 'express'
import type { AdminRole } from '@prisma/client'
import type { AdminIdentitySession } from './adminIdentity'

/**
 * What each staff role must never receive, whatever endpoint produced it.
 *
 * SUPER_ADMIN is absent on purpose: there is no field the owner of the platform
 * is shielded from, and pretending otherwise would be theatre.
 */
const REDACTED_FIELDS: Partial<Record<AdminRole, readonly string[]>> = {
  SALES: [
    // What we pay a partner firm. A salesperson who can see the commission on
    // every partner can route a lead by what it earns rather than by who will
    // serve the buyer, and that is the exact incentive the product exists to
    // not have.
    'commission_rate_pct',
    'payment_terms',
    // A paid branding arrangement with an end date. Commercial, not operational.
    'builder_theme',
    // Model spend, per row. Already blocked as a path; blocked as a field too,
    // because aggregates surface in places the path rule does not name.
    'cost_usd',
    // Analyst working notes and internal scoring.
    'internal_confidence',
    'market_demand_score',
    'ai_search_keywords',
  ],
  ANALYST: [
    // An analyst maintains the catalogue. What a partner firm is paid is not
    // catalogue data, and it is the one number that would let an internal
    // scoring change be aimed at a commercial outcome.
    'commission_rate_pct',
    'payment_terms',
    'cost_usd',
  ],
  // BUILDER and PARTNER never reach /admin at all — `adminAreaGuard` refuses
  // them at the door. Their own portal is scoped separately in portal.ts.
}

/**
 * Removes the named keys everywhere they appear in a JSON payload.
 *
 * Walks arrays and nested objects because admin responses nest freely — a
 * partner arrives inside a lead, a builder inside a project, and a redactor
 * that only checked the top level would miss every one of those.
 *
 * Mutates in place and returns the same reference: these payloads are built
 * fresh per request and never shared, and cloning every admin list response to
 * avoid a mutation nobody observes is a real cost for no gain.
 */
export function redactFields<T>(payload: T, fields: readonly string[], depth = 0): T {
  // Prisma payloads are shallow in practice; the cap is a cycle guard, not a
  // policy. A cycle here would hang the response rather than fail it.
  if (depth > 12 || payload === null || typeof payload !== 'object') return payload

  if (Array.isArray(payload)) {
    for (const item of payload) redactFields(item, fields, depth + 1)
    return payload
  }

  // Dates and Decimals are objects but carry no keys we redact, and walking
  // them would only cost time.
  if (payload instanceof Date) return payload

  const record = payload as Record<string, unknown>
  for (const field of fields) {
    if (field in record) delete record[field]
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') redactFields(value, fields, depth + 1)
  }
  return payload
}

/**
 * Mount AFTER the identity gate — it reads the session that gate attaches.
 *
 * Wraps `res.json` rather than asking each handler to redact, so a handler
 * cannot forget. A handler that never calls `res.json` (a file download, a
 * stream) is untouched, which is correct: those carry no Prisma rows.
 */
export function adminFieldRedaction(req: Request, res: Response, next: NextFunction): void {
  const identity = (req as Request & { adminIdentity?: AdminIdentitySession }).adminIdentity
  const fields = identity ? REDACTED_FIELDS[identity.role] : undefined
  if (!fields || fields.length === 0) {
    next()
    return
  }

  const originalJson = res.json.bind(res)
  res.json = ((body: unknown) => originalJson(redactFields(body, fields))) as Response['json']
  next()
}

/** Exported for the test — the matrix is a product decision, not a detail. */
export const REDACTION_MATRIX = REDACTED_FIELDS

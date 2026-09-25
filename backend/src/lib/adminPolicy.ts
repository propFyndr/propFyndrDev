// backend/src/lib/adminPolicy.ts
//
// Who, among staff, may do what. One file, so the answer is readable in one
// place rather than inferred from ~130 route registrations.
//
// `adminAreaGuard` establishes the floor: only SUPER_ADMIN, ANALYST and SALES
// reach /admin at all. Until this file existed, that was the whole story —
// admin.ts guarded every route with `requireAdmin`, which reads no role, so
// inside the area the three staff roles were identical. Measured live with a
// real SALES token: it created a builder (201), published a blog post (201),
// read the audit log and the AI spend, and passed authorization on
// `DELETE /projects/:id` (404 for a missing row, not 403). Only /team said no.
//
// The rules are written against the path RELATIVE TO THE /admin MOUNT, and
// applied at the mount, so every sibling router inherits them — including ones
// added later. A policy living inside admin.ts would cover neither /team nor
// /conversations nor /intelligence, which is the failure `adminGuard.ts`
// already documents.
//
// Deny-by-default for writes: an unrecognised write path is refused for SALES
// and allowed for ANALYST only because ANALYST *is* the data-editing role.
// Anything genuinely dangerous is named in SUPER_ADMIN_ONLY or DESTRUCTIVE.
import type { Request, Response, NextFunction } from 'express'
import type { AdminIdentitySession } from './adminIdentity'

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * Oversight data. The people subject to an audit trail do not read it, and
 * real money spent is not a staff-wide number.
 *
 * /team and /outbox carry their own SUPER_ADMIN gate in their routers. They are
 * repeated here deliberately: this file is meant to be the readable answer to
 * "what can a SALES admin reach", and an answer with holes in it is worse than
 * no answer. Two independent checks agreeing is the point.
 */
const SUPER_ADMIN_ONLY: readonly RegExp[] = [
  /^\/audit-logs\b/,
  /^\/analytics\/ai-costs\b/,
  /^\/team\b/,
  /^\/outbox\b/,
]

/**
 * Irreversible or bulk. Allowed to SUPER_ADMIN alone — deleting a project or a
 * builder, or replacing the catalogue in one request, should need the person
 * who can also put it back.
 */
const DESTRUCTIVE: ReadonlyArray<{ method: string; path: RegExp }> = [
  { method: 'DELETE', path: /^\/projects\/[^/]+$/ },
  { method: 'DELETE', path: /^\/builders\/[^/]+$/ },
  { method: 'POST', path: /^\/projects\/bulk-import\b/ },
  // A published announcement, removed with nothing left to restore from.
  { method: 'DELETE', path: /^\/news\/[^/]+\/permanent$/ },
]

/**
 * The writes a salesperson actually performs: working a lead. Status,
 * assignment and notes on callbacks and site visits, and nothing else.
 *
 * Everything a salesperson does to the CATALOGUE is a read. They look a project
 * up to answer a buyer's question; they do not edit it.
 */
const SALES_WRITES: readonly RegExp[] = [
  /^\/leads\/[^/]+$/,
  /^\/callbacks\/[^/]+$/,
]

/**
 * Reads a salesperson is refused.
 *
 * Until 2026-09-17 this file gated writes only — `decide()` ended with
 * `if (isRead) return { allowed: true }`, so every GET under /admin was open to
 * every staff role. A SALES token could read `/conversations`, which is the
 * complete transcript of what a buyer said to the advisor, including every
 * competing project they were weighing and every doubt they voiced. A
 * salesperson who reads that before dialling is not selling, they are
 * exploiting a confidence the buyer gave to an advisor. That is the trust the
 * product is built on and it is not ours to spend.
 *
 * The rest follows the same test — does working a lead require it?
 *  - /email is a send endpoint. A sales login should not be able to mail
 *    anyone from our verified domain.
 *  - /analytics beyond the summary is company performance, not a work queue.
 *  - /news, /blog, /promotions are unpublished marketing copy.
 *  - /intelligence is the analyst's scoring workbench.
 */
const SALES_READ_DENIED: readonly RegExp[] = [
  /^\/conversations\b/,
  /^\/beta\b/,
  /^\/email\b/,
  /^\/intelligence\b/,
  /^\/news\b/,
  /^\/blog\b/,
  /^\/promotions\b/,
  /^\/analytics\/(?!summary\b)/,
]

/**
 * Reads an analyst is refused.
 *
 * An analyst maintains the catalogue: prices, possession dates, RERA numbers,
 * images, sector data. None of that work requires a buyer's name or phone
 * number, and the transcripts are not theirs either. Lead volume as a NUMBER is
 * on /stats and /analytics, which they keep — what they lose is the row with a
 * person in it.
 */
const ANALYST_READ_DENIED: readonly RegExp[] = [
  /^\/conversations\b/,
  /^\/beta\b/,
  /^\/callbacks\b/,
  /^\/leads\b/,
  /^\/email\b/,
  // The sales work queue is a lead surface under a different name — it returns
  // buyer names, phone numbers and profile summaries. Denying /leads while
  // leaving this open would be the same data through a second door. Caught by
  // adminReadCoverage.test.ts on the day the board was added, which is the
  // whole reason that test walks the routers instead of trusting a list.
  /^\/boards\/queue\b/,
]

/**
 * Lead surfaces an analyst may not WRITE either.
 *
 * The read side was closed on 2026-09-17 by a pass that only touched reads —
 * `decide()` gated the list above on `isRead`, and the write side was never
 * revisited. The result was an analyst who could not open a lead but could
 * PATCH one: reassign it, change its status, or write a note onto a buyer
 * record they are not allowed to see. The docstring above already says an
 * analyst "loses the row with a person in it"; until now they lost only the
 * ability to look at it.
 *
 * The roadmap says the same thing outright — "ANALYST: access to the project
 * catalogue, builders, sectors, and data quality boards (no customer leads or
 * deletions)". A write is access.
 *
 * Deliberately not the whole read list: `/email` and `/conversations` are read
 * denials for other reasons, and this covers the buyer rows specifically.
 */
const ANALYST_WRITE_DENIED: readonly RegExp[] = [
  /^\/leads\b/,
  /^\/callbacks\b/,
  /^\/boards\/queue\b/,
]

export interface PolicyDecision {
  allowed: boolean
  /** Shown to the caller. Names the role floor, never the path's existence. */
  reason?: string
}

/**
 * Pure, so the matrix can be tested without a server or a session.
 *
 * `path` is relative to the /admin mount ('/leads', '/projects/abc', '/team').
 */
export function decide(
  role: AdminIdentitySession['role'],
  method: string,
  path: string,
  query: Record<string, unknown> = {},
): PolicyDecision {
  const m = method.toUpperCase()
  const isRead = READ_METHODS.has(m)

  /**
   * One project's change history is not the company's audit trail.
   *
   * `/audit-logs?entity_id=<project>` backs the Changelog tab on the project
   * detail page — who edited this building's price, possession or RERA number.
   * An analyst maintains that data, so refusing them its history breaks the tab
   * for the person it is for. The UNFILTERED log — every actor, every entity,
   * including team changes — stays with SUPER_ADMIN, which is what was asked
   * for.
   */
  if (/^\/audit-logs\b/.test(path) && typeof query.entity_id === 'string' && query.entity_id) {
    return role === 'SUPER_ADMIN' || role === 'ANALYST'
      ? { allowed: true }
      : { allowed: false, reason: 'Edit history is available to analysts and super admins.' }
  }

  if (SUPER_ADMIN_ONLY.some(rx => rx.test(path))) {
    return role === 'SUPER_ADMIN'
      ? { allowed: true }
      : { allowed: false, reason: 'This area is restricted to super admins.' }
  }

  // BUILDER and PARTNER never reach here — adminAreaGuard refuses them at the
  // door — but the matrix states it rather than relying on that.
  if (role !== 'SUPER_ADMIN' && role !== 'ANALYST' && role !== 'SALES') {
    return { allowed: false, reason: 'The admin area is for PropFyndr staff.' }
  }

  if (role === 'SUPER_ADMIN') return { allowed: true }

  if (DESTRUCTIVE.some(d => d.method === m && d.path.test(path))) {
    return { allowed: false, reason: 'Deleting records and bulk imports are restricted to super admins.' }
  }

  if (role === 'ANALYST') {
    if (isRead && ANALYST_READ_DENIED.some(rx => rx.test(path))) {
      return { allowed: false, reason: 'Buyer contact details and chat transcripts are not part of catalogue work.' }
    }
    if (!isRead && ANALYST_WRITE_DENIED.some(rx => rx.test(path))) {
      return { allowed: false, reason: 'Buyer records are worked by sales. Catalogue changes are yours.' }
    }
    return { allowed: true }
  }

  // SALES from here down.
  if (isRead) {
    if (SALES_READ_DENIED.some(rx => rx.test(path))) {
      return { allowed: false, reason: 'This area is restricted to analysts and super admins.' }
    }
    return { allowed: true }
  }
  if (SALES_WRITES.some(rx => rx.test(path))) return { allowed: true }
  return { allowed: false, reason: 'Sales accounts can update leads. Other changes are made by an analyst or super admin.' }
}

/**
 * Mount AFTER the identity and staff-role gates — it reads the session they
 * attach.
 */
export function adminRolePolicy(req: Request, res: Response, next: NextFunction): void {
  const identity = (req as Request & { adminIdentity?: AdminIdentitySession }).adminIdentity
  if (!identity) {
    // No session attached means the gates above did not run. Refuse rather
    // than assume: a policy that fails open is not a policy.
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const verdict = decide(identity.role, req.method, req.path, req.query as Record<string, unknown>)
  if (!verdict.allowed) {
    console.warn('[ADMIN:POLICY_DENIED]', { role: identity.role, method: req.method, path: req.path, email: identity.email })
    res.status(403).json({ error: verdict.reason ?? 'Forbidden — insufficient role' })
    return
  }
  next()
}

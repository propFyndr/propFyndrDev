// backend/src/lib/adminReadAudit.ts
//
// Records who READ a buyer's personal data.
//
// `recordAudit` has always covered writes — who changed a price, who invited an
// admin. For personal data the more important question is the other one, and it
// had no answer: nothing anywhere recorded that a staff account opened a
// buyer's phone number or their conversation. "Prove nobody exfiltrated the
// lead list" was unanswerable, and an access log that exists only for writes
// reads as though reads were considered and found harmless.
//
// Scoped deliberately narrowly:
//
//  - Only paths that return a specific person — a lead detail, a transcript.
//    Logging every list view would write a row per page load per salesperson,
//    and an audit log nobody can read is the same as no audit log.
//  - Only successful responses. A 403 is already logged by the policy, and
//    recording a denied read as an access would make the log lie in the
//    direction that matters most.
//  - Never blocks the response. A failed audit write must not cost a
//    salesperson the lead they are trying to call.
import type { Request, Response, NextFunction } from 'express'
import type { AdminIdentitySession } from './adminIdentity'
import { recordAudit } from './adminIdentity'

/**
 * Paths whose response names one identifiable person.
 *
 * `/conversations/:id` is the transcript itself. `/callbacks/:id` and
 * `/leads/:id` are one buyer's contact row. The collection forms of all three
 * are excluded on purpose — see the note above about a log nobody reads.
 */
const AUDITED_READS: ReadonlyArray<{ pattern: RegExp; entityType: string; what: string }> = [
  { pattern: /^\/conversations\/([^/]+)$/, entityType: 'chat_session', what: 'chat transcript' },
  { pattern: /^\/beta\/sessions\/([^/]+)$/, entityType: 'chat_session', what: 'chat transcript' },
  { pattern: /^\/callbacks\/([^/]+)$/, entityType: 'callback_request', what: 'lead contact details' },
  { pattern: /^\/leads\/([^/]+)$/, entityType: 'callback_request', what: 'lead contact details' },
]

function matchAudited(path: string): { entityType: string; what: string; entityId: string } | null {
  for (const rule of AUDITED_READS) {
    const m = rule.pattern.exec(path)
    if (m) return { entityType: rule.entityType, what: rule.what, entityId: m[1] }
  }
  return null
}

/** Exported so the test can assert which shapes are covered without a server. */
export function isAuditedRead(method: string, path: string): boolean {
  return (method.toUpperCase() === 'GET') && matchAudited(path) !== null
}

/**
 * Mount AFTER the identity gate and the role policy.
 *
 * Hooks `res.on('finish')` rather than wrapping `res.json`, so the status code
 * is known: only a 2xx is an access. Ordering matters — a request the policy
 * refused never reaches a handler, but it does reach `finish`, and recording
 * that as a read would log an access that did not happen.
 */
export function adminReadAudit(req: Request, res: Response, next: NextFunction): void {
  if (req.method.toUpperCase() !== 'GET') {
    next()
    return
  }
  const match = matchAudited(req.path)
  if (!match) {
    next()
    return
  }

  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return
    const identity = (req as Request & { adminIdentity?: AdminIdentitySession }).adminIdentity
    if (!identity) return

    void recordAudit({
      entityType: match.entityType,
      entityId: match.entityId,
      action: 'READ',
      actorAdminId: identity.adminUserId,
      actorLabel: identity.email,
      ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
      summary: `Viewed ${match.what}`,
    })
  })

  next()
}

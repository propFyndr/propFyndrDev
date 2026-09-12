// backend/src/lib/adminGuard.ts
//
// One guard for the whole /admin area, applied at the mount point.
//
// The admin surface is not one router. Alongside admin.ts there are sibling
// routers mounted at /admin/conversations, /admin/beta, /admin/team,
// /admin/email, /admin/channel-partners, /admin/promotions and
// /admin/intelligence. A guard placed INSIDE admin.ts protects none of them,
// which is exactly how it went wrong: the role floor added to admin.ts left
// promotions, conversations, email and intelligence still reachable by any
// signed-in user — including a BUILDER or PARTNER, whose tokens live in the
// same session store. Conversation transcripts carry buyer names, phone
// numbers and AI lead summaries, so that was a PII exposure, not just a
// privilege one.
//
// Mounting the guard on the path prefix instead means a router added later
// inherits it by default. That is the property worth having: the safe thing
// has to be the thing that happens when someone forgets.
import { Request, Response, NextFunction } from 'express'
import { requireIdentity, requireRole } from './adminIdentity'

/** Roles that may reach the PropFyndr admin area at all. */
const STAFF_ROLES = ['SUPER_ADMIN', 'ANALYST', 'SALES'] as const

/**
 * Paths under /admin that must work without a session, matched against the
 * mount-relative path. Deliberately a short, explicit list — anything not
 * named here is staff-only.
 *
 *  /auth                — the login endpoint itself, and logout, which does
 *                         its own token handling and must stay reachable to a
 *                         BUILDER or PARTNER so they can sign out.
 *  /team/accept-invite  — an invited user has no session yet; this is where
 *                         they set the password that creates one.
 */
const PUBLIC_ADMIN_PATHS: ReadonlyArray<RegExp> = [
  /^\/auth\/?$/,
  /^\/team\/accept-invite\/?$/,
  // Someone who has lost their password has no session by definition. Both
  // endpoints are rate-limited and neither reveals whether an account exists.
  /^\/auth-flows\/forgot\/?$/,
  /^\/auth-flows\/reset\/?$/,
]

export function isPublicAdminPath(path: string): boolean {
  return PUBLIC_ADMIN_PATHS.some((rx) => rx.test(path))
}

const roleGate = requireRole(...STAFF_ROLES)

/** Mount with `app.use('/api/v1/admin', adminAreaGuard)` BEFORE the admin routers. */
export function adminAreaGuard(req: Request, res: Response, next: NextFunction): void {
  if (isPublicAdminPath(req.path)) {
    next()
    return
  }
  void requireIdentity(req, res, (err?: unknown) => {
    if (err) {
      next(err as Error)
      return
    }
    // requireIdentity answers 401 itself rather than calling next on failure.
    if (res.headersSent) return
    roleGate(req, res, next)
  })
}

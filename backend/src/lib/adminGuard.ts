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
import { adminRolePolicy } from './adminPolicy'

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

/**
 * Paths that need a SESSION but neither the staff floor nor the role matrix,
 * because they act on the caller's own account rather than on the business.
 *
 * Changing your own password is the whole list. It sits under /admin by
 * accident of routing — `adminAuthFlows` is mounted at /admin/auth-flows — and
 * the staff floor therefore applied to it, which meant a BUILDER or PARTNER
 * could not change their own password at all: /forgot and /reset are public,
 * but /change, the one that needs you to be signed in, was staff-only. Found by
 * `scripts/audit-page-permissions.ts`, which noticed that both portal account
 * pages call an endpoint their own roles are refused.
 *
 * `requireIdentity` still runs, and the handler still demands the current
 * password, so this exempts the role check and nothing else.
 */
const SELF_SERVICE_ADMIN_PATHS: ReadonlyArray<RegExp> = [
  /^\/auth-flows\/change\/?$/,
]

export function isSelfServiceAdminPath(path: string): boolean {
  return SELF_SERVICE_ADMIN_PATHS.some((rx) => rx.test(path))
}

const roleGate = requireRole(...STAFF_ROLES)

/**
 * The same staff floor, for privileged routes that do NOT live under /admin.
 *
 * `adminAreaGuard` is mounted on the /admin path prefix, so anything outside it
 * inherits nothing. `/api/v1/leads` is mounted before that guard and its
 * privileged half used `requireAdmin` from `adminAuth.ts`, which validates that
 * a session EXISTS and reads no role — the `AdminSession` type it checks has no
 * role field. Measured live: a BUILDER token read
 * `/leads/callback/:id/dossier` for an arbitrary lead and got the buyer's name
 * and phone number, plus `/leads/metrics` and `/leads/market/snapshot` for the
 * whole company. A builder's own leads are served, correctly scoped, by
 * `/portal/builder/leads`.
 *
 * `requireAdmin`'s own comment called itself a stopgap "rather than waiting on
 * the identity migration". That migration has landed; this is it arriving here.
 */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  void requireIdentity(req, res, (err?: unknown) => {
    if (err) {
      next(err as Error)
      return
    }
    if (res.headersSent) return
    roleGate(req, res, next)
  })
}

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
    // Signed in, acting on your own account: no role floor, no matrix.
    if (isSelfServiceAdminPath(req.path)) {
      next()
      return
    }
    roleGate(req, res, (roleErr?: unknown) => {
      if (roleErr) {
        next(roleErr as Error)
        return
      }
      if (res.headersSent) return
      // The floor says "staff". This says which staff — see lib/adminPolicy.ts.
      // Applied here, at the mount, so /team, /conversations, /intelligence and
      // anything added later inherit it. That is the same reason the floor
      // itself moved out of admin.ts.
      adminRolePolicy(req, res, next)
    })
  })
}

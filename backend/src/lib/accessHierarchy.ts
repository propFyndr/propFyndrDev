// backend/src/lib/accessHierarchy.ts
//
// Who may switch off whose login.
//
// Until now revocation lived only on the admin Team page and only a
// SUPER_ADMIN could reach it, so a builder whose sales manager left the firm
// had to email us and wait. That is the wrong shape twice over: it makes us a
// bottleneck on somebody else's staffing, and it means the person who actually
// knows someone has left is not the person who can act on it.
//
// The rule is ownership, not seniority. You may manage access for the
// organisation you belong to and for the organisations beneath it — a builder
// owns their own admins and the channel partners they onboarded; a partner
// firm owns its own admins and nothing else.
//
// Deliberately NOT a general permission system. Four rules, stated once, pure
// so they can be tested without a database or a session. Every one of them is
// a claim about the product, and a claim you can read in one screen is a claim
// somebody will notice is wrong.
import type { AdminRole } from '@prisma/client'

export interface AccessActor {
  adminUserId: string
  role: AdminRole
  builderId: string | null
  partnerId: string | null
}

export interface AccessTarget {
  adminUserId: string
  role: AdminRole
  builderId: string | null
  partnerId: string | null
  /**
   * For a PARTNER target: the builder that onboarded that partner firm.
   *
   * Resolved by the caller, because it is a join
   * (`AdminUser.partner_id -> ChannelPartner.builder_id`) and this file stays
   * pure. Null when the target is not a partner, or when the partner firm
   * predates builder ownership.
   */
  partnerOwnerBuilderId?: string | null
}

export interface AccessDecision {
  allowed: boolean
  /** Shown to the caller. Says why, never whether the target exists. */
  reason?: string
}

/**
 * May `actor` enable or disable `target`'s login?
 *
 * The order of the checks matters and is the order a person would reason in:
 * yourself, then staff, then ownership.
 */
export function canManageAccess(actor: AccessActor, target: AccessTarget): AccessDecision {
  /**
   * Nobody switches off their own access.
   *
   * Not a safety rail against malice — it is a safety rail against the last
   * super admin locking the company out of its own admin panel with one click
   * and no way back in.
   */
  if (actor.adminUserId === target.adminUserId) {
    return { allowed: false, reason: 'You cannot change your own access.' }
  }

  // SUPER_ADMIN owns the platform, so it owns every account on it.
  if (actor.role === 'SUPER_ADMIN') return { allowed: true }

  /**
   * ANALYST and SALES are staff, not owners. They work inside the product;
   * they do not decide who else may.
   */
  if (actor.role === 'ANALYST' || actor.role === 'SALES') {
    return { allowed: false, reason: 'Managing access is for super admins.' }
  }

  /**
   * A builder owns the admins of their own organisation, and the admins of the
   * channel partners they onboarded. Not PropFyndr staff — an external account
   * must never be able to switch off an internal one, whatever else it owns.
   */
  if (actor.role === 'BUILDER') {
    if (!actor.builderId) {
      return { allowed: false, reason: 'This account has no builder scope.' }
    }
    if (target.role === 'BUILDER') {
      return target.builderId === actor.builderId
        ? { allowed: true }
        : { allowed: false, reason: 'That account belongs to another organisation.' }
    }
    if (target.role === 'PARTNER') {
      return target.partnerOwnerBuilderId === actor.builderId
        ? { allowed: true }
        : { allowed: false, reason: 'That partner was not onboarded by your organisation.' }
    }
    return { allowed: false, reason: 'PropFyndr staff accounts are managed by PropFyndr.' }
  }

  /**
   * A partner firm owns its own admins and nothing below it, because nothing
   * is below it. Notably it may NOT manage the builder that onboarded it: the
   * relationship runs one way, and a partner able to switch off its builder
   * would invert it.
   */
  if (actor.role === 'PARTNER') {
    if (!actor.partnerId) {
      return { allowed: false, reason: 'This account has no partner scope.' }
    }
    return target.role === 'PARTNER' && target.partnerId === actor.partnerId
      ? { allowed: true }
      : { allowed: false, reason: 'You can only manage accounts at your own firm.' }
  }

  return { allowed: false, reason: 'Managing access is not available to this account.' }
}

/**
 * May `actor` INVITE someone at `scope`?
 *
 * Separate from revocation on purpose, and stricter: switching an account off
 * is reversible and reduces access, while creating one grants it. Only
 * PropFyndr mints identities — a builder proposes a partner login and we
 * approve it (see `POST /portal/builder/partners/:id/request-access`).
 *
 * Stated here rather than left implicit so that the asymmetry is visible next
 * to the rule it differs from.
 */
export function canInvite(actor: AccessActor): AccessDecision {
  return actor.role === 'SUPER_ADMIN'
    ? { allowed: true }
    : { allowed: false, reason: 'Only PropFyndr can create a login. Request access instead.' }
}

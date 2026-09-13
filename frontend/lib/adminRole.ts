'use client'

import { useEffect, useState } from 'react'

export type AdminRole = 'SUPER_ADMIN' | 'ANALYST' | 'SALES' | 'BUILDER' | 'PARTNER'

/**
 * The signed-in role, for hiding controls the server would refuse.
 *
 * This is presentation only. `backend/src/lib/adminPolicy.ts` is the
 * authority and answers 403 whatever the browser believes — localStorage is
 * editable by the person sitting at the machine, so treating it as a security
 * boundary would be a mistake. What it buys is a salesperson not being shown a
 * "Delete builder" button whose only possible outcome is a permission error.
 *
 * Read after mount rather than during render: the server render has no
 * localStorage, and reading it inline produces a hydration mismatch.
 */
export function useAdminRole(): AdminRole | null {
  const [role, setRole] = useState<AdminRole | null>(null)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('admin_role')
      if (stored) setRole(stored as AdminRole)
    } catch {
      // Private mode or blocked storage — fall through as "unknown".
    }
  }, [])
  return role
}

/**
 * May this role create and edit catalogue and content — projects, builders,
 * sectors, specs, intelligence, blog, news, promotions?
 *
 * Mirrors the ANALYST row of the server matrix. `null` (role not yet read)
 * returns true so the controls do not flicker out and back in for the roles
 * that do have them; the server still refuses anyone who should not.
 */
export function canEditCatalogue(role: AdminRole | null): boolean {
  return role === null || role === 'SUPER_ADMIN' || role === 'ANALYST'
}

/** May this role delete records or run a bulk import? Super admin alone. */
export function canDeleteRecords(role: AdminRole | null): boolean {
  return role === null || role === 'SUPER_ADMIN'
}

/** May this role manage the team, outbox, audit trail and spend? */
export function isOwner(role: AdminRole | null): boolean {
  return role === 'SUPER_ADMIN'
}

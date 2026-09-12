'use client'

/**
 * Consoles that belong to someone else.
 *
 * A BUILDER or PARTNER session carries its own id, and the portal endpoints
 * read it from the session — those pages send nothing. A PropFyndr role
 * (SUPER_ADMIN / ANALYST / SALES) has no such id, so to look at a builder's or
 * a partner's console it must name whose console it is: `?builder_id=…` /
 * `?partner_id=…`. The server still re-derives every row from that id; this is
 * addressing, not authorisation.
 *
 * Read from `window.location.search` rather than `useSearchParams()` on
 * purpose: `useSearchParams` opts the whole route out of static rendering
 * unless every consumer sits inside a Suspense boundary, and these consoles are
 * client-only anyway.
 */

import { useEffect, useState } from 'react'

export type ScopeParam = 'builder_id' | 'partner_id'

/** The scope id in the current URL, or '' when there is none. */
export function useScopeId(param: ScopeParam): string {
  const [value, setValue] = useState('')
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(param) ?? '')
  }, [param])
  return value
}

/** Appends `?builder_id=…` to an API path, correctly whether or not it already has a query. */
export function withScope(path: string, param: ScopeParam, id: string): string {
  if (!id) return path
  return `${path}${path.includes('?') ? '&' : '?'}${param}=${encodeURIComponent(id)}`
}

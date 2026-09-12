// backend/src/lib/portalSubdomain.ts
//
// Validation for tenant portal subdomains, on the write path.
//
// The routing counterpart lives in `frontend/lib/subdomain.ts`, which decides
// whether an incoming host is a tenant. This file decides what may be STORED.
// The two lists must agree: a name this accepts but routing rejects produces a
// builder with a portal address that silently serves the buyer homepage.
// Deliberately duplicated rather than shared — the workspaces have no shared
// package, and one list in two places with this comment beats inventing one.

/** Names that belong to the product or its infrastructure, never to a tenant. */
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'smtp', 'imap', 'ftp', 'ns1', 'ns2',
  'cdn', 'assets', 'static', 'img', 'images', 'media', 'files', 'storage',
  'blog', 'docs', 'help', 'support', 'status', 'dev', 'staging', 'test',
  'preview', 'demo', 'beta', 'internal', 'dashboard', 'portal', 'auth',
  'login', 'account', 'billing', 'webhook', 'webhooks', 'mx', 'email',
])

export type SubdomainCheck =
  | { ok: true; value: string | null }
  | { ok: false; error: string }

/**
 * Normalises and validates a requested subdomain.
 *
 * Returns `{ ok: true, value: null }` for an empty input — clearing a tenant's
 * subdomain is a legitimate edit, not an error.
 */
export function normalisePortalSubdomain(raw: unknown): SubdomainCheck {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, error: 'Subdomain must be text' }

  const value = raw.trim().toLowerCase()
  if (!value) return { ok: true, value: null }

  if (value.length < 2 || value.length > 63) {
    return { ok: false, error: 'Subdomain must be between 2 and 63 characters' }
  }
  // DNS label rules: alphanumeric, inner hyphens only.
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)) {
    return { ok: false, error: 'Use letters, numbers and hyphens only, not starting or ending with a hyphen' }
  }
  if (RESERVED_SUBDOMAINS.has(value)) {
    return { ok: false, error: `"${value}" is reserved by PropFyndr` }
  }
  return { ok: true, value }
}

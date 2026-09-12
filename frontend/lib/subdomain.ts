/**
 * Tenant subdomains: `lotus.propfyndr.in` instead of `/builder/portal`.
 *
 * This is ADDRESSING, never authorisation. Resolving a subdomain grants
 * nothing — the session still decides what any request may read, and every
 * portal endpoint re-derives its scope from that session server-side. A builder
 * who types someone else's subdomain sees their own console, not that builder's.
 * Treating the host as a credential is the classic multi-tenant mistake and
 * this file exists partly to say so where someone will read it.
 */

/**
 * Hosts that are the product itself, not a tenant. Anything here is left alone.
 *
 * `www` and the bare apex are the buyer site. The rest are reserved so a tenant
 * can never claim a name that shadows infrastructure — a builder registering
 * the subdomain `api` or `admin` would otherwise capture those hosts.
 */
export const RESERVED_SUBDOMAINS = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'smtp', 'imap', 'ftp', 'ns1', 'ns2',
  'cdn', 'assets', 'static', 'img', 'images', 'media', 'files', 'storage',
  'blog', 'docs', 'help', 'support', 'status', 'dev', 'staging', 'test',
  'preview', 'demo', 'beta', 'internal', 'dashboard', 'portal', 'auth',
  'login', 'account', 'billing', 'webhook', 'webhooks', 'mx', 'email',
])

/** Hosts that are never tenants, whatever the label count. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]'])

/**
 * The tenant label in a host, or null when the host is not a tenant host.
 *
 * Deliberately conservative: anything it cannot confidently read as a tenant
 * returns null and the request is served exactly as before. A false negative
 * costs a nice URL; a false positive would route a buyer into a portal.
 *
 *   lotus.propfyndr.in        -> 'lotus'
 *   www.propfyndr.in          -> null   (reserved)
 *   propfyndr.in              -> null   (apex)
 *   lotus.localhost:3000      -> 'lotus' (local testing)
 *   propfyndr.vercel.app      -> null   (preview deploys are not tenants)
 */
export function tenantFromHost(host: string | null | undefined): string | null {
  if (!host) return null

  // Strip the port, and any IPv6 brackets a Host header may carry.
  const bare = host.split(':')[0].trim().toLowerCase()
  if (!bare || LOCAL_HOSTS.has(bare)) return null

  // A bare IP is never a tenant host.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(bare)) return null

  // Vercel preview deployments (`propfyndr-git-branch-team.vercel.app`) have a
  // subdomain shape but are the product, not a tenant.
  if (bare.endsWith('.vercel.app') || bare.endsWith('.onrender.com')) return null

  const labels = bare.split('.')

  // `lotus.localhost` — the local testing shape, two labels.
  if (labels.length === 2 && labels[1] === 'localhost') {
    return isUsableTenantLabel(labels[0]) ? labels[0] : null
  }

  // Anything shorter than host.tld.something is the apex or unusable.
  // `propfyndr.in` is two labels and has no tenant.
  if (labels.length < 3) return null

  const candidate = labels[0]
  return isUsableTenantLabel(candidate) ? candidate : null
}

/** A label is usable if it is well-formed and not reserved. */
export function isUsableTenantLabel(label: string): boolean {
  if (!label) return false
  if (RESERVED_SUBDOMAINS.has(label)) return false
  // DNS label rules, plus a floor of 2 characters so single letters stay free.
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label) && label.length >= 2
}

/**
 * Paths a tenant host serves unchanged.
 *
 * Everything else on a tenant host is rewritten to the portal entry, so
 * `lotus.propfyndr.in/` lands somewhere useful instead of the buyer homepage.
 */
export function isPassThroughPath(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/ingest/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/builder/') ||
    pathname.startsWith('/partner/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  )
}

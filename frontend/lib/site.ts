// The public domain, in one place. propfyndr.in is retired (Vercel 308s it to
// realtyask.in); canonical URLs, the sitemap and partner portal hosts must name
// the domain that actually serves, or search engines index a redirect.
export const SITE_DOMAIN = 'realtyask.in'

// An env override is honoured unless it still names the retired domain — the
// live robots.txt was pointing crawlers at propfyndr.in.
const fromEnv = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL
export const SITE_URL = fromEnv && !/propfyndr/i.test(fromEnv) ? fromEnv.replace(/\/+$/, '') : `https://${SITE_DOMAIN}`

/** A partner's own portal host: `acme` → `acme.realtyask.in`. */
export function portalHost(subdomain: string): string {
  return `${subdomain}.${SITE_DOMAIN}`
}

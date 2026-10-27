// Where this visit came from, for admin analytics: utm_source, else the referring site's host.
// Read once per tab at the first chat and kept for the rest of the visit, so moving between
// our own pages doesn't overwrite it. Never the full URL: query strings can carry personal data.
const KEY = 'ra_visit_source'

export function visitSource(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const kept = sessionStorage.getItem(KEY)
    if (kept !== null) return kept || undefined
    const utm = new URLSearchParams(window.location.search).get('utm_source')
    let source = utm?.trim().toLowerCase() || ''
    if (!source && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, '')
      if (host && !host.endsWith('realtyask.in') && host !== window.location.hostname) source = host
    }
    sessionStorage.setItem(KEY, source)
    return source || undefined
  } catch {
    return undefined
  }
}

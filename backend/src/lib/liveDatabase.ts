// backend/src/lib/liveDatabase.ts
//
// Is this connection string the live database?
//
// Until 2026-10-29 dev ran on Supabase and live on Neon, so every dev-only
// script and the test runner refused "any neon.tech address". Dev moved to its
// own Neon project that day (docs/ENVIRONMENTS.md), and that rule would now
// refuse dev and stop telling the two apart. Live is identified by its Neon
// endpoint id instead: the known one, and whatever NEON_DB names.

/** Live's Neon endpoint. Kept here so the guard works where NEON_DB is not set. */
const LIVE_ENDPOINTS = ['ep-super-water-aof3o8gy']

/** "ep-odd-bar-az91o2md" from a Neon URL, pooled or direct; null for anything else. */
export function neonEndpoint(url: string | undefined | null): string | null {
  return url?.match(/@(ep-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+)(?:-pooler)?\./i)?.[1]?.toLowerCase() ?? null
}

export function isLiveDatabase(url: string | undefined | null): boolean {
  const endpoint = neonEndpoint(url)
  if (!endpoint) return false
  const live = new Set([...LIVE_ENDPOINTS, neonEndpoint(process.env.NEON_DB)].filter((e): e is string => Boolean(e)))
  return live.has(endpoint)
}

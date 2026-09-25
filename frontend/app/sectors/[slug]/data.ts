import { API_BASE } from '@/lib/env'

/**
 * One sector, with the projects in it.
 *
 * Lives here rather than in `layout.tsx` because Next.js allows a layout file
 * to export only its own known entries — `default`, `generateMetadata`,
 * `revalidate` and the rest. Any other export fails `next build` with a type
 * error against a generated constraint, which neither `tsc --noEmit` nor
 * `next lint` catches.
 *
 * Shared by the layout's `generateMetadata` and the page itself. Both calls
 * hit the same URL with the same revalidate window inside one render, so the
 * second is served from Next's dedupe rather than costing a second round trip.
 */
export async function fetchSector(slug: string) {
  try {
    const res = await fetch(`${API_BASE}/sectors/${slug}`, { next: { revalidate: 1800 } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

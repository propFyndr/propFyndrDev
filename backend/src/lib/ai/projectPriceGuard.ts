/**
 * A price beside a project's name must be that project's price.
 *
 * The price firewall only asks whether a figure appears anywhere in the prompt,
 * so a figure from one project, or the buyer's budget, could be attached to
 * another. Live transcript rerun 5 (17 Oct 2026): "Prateek Canary and Godrej
 * Palm Retreat feature spacious 3 BHK plus servant layouts… in the ₹2.5 Cr to
 * ₹3.2 Cr range" passed because 3.2 sat somewhere in the facts block.
 *
 * Here every sentence that names a project we hold has each ₹ figure checked
 * against that project's own recorded prices (project range and every unit
 * type's), or the buyer's own figures. A sentence that fails is dropped; the
 * rest of the answer stays. With the cache cold nothing is dropped: a guard
 * that cannot read the catalogue must not cut what it cannot judge.
 */
import { prisma } from '../db'
import { splitClauses } from './projectFactChecks'

type Range = [number, number]
const TTL_MS = 10 * 60 * 1000
let cache: { at: number; ranges: Map<string, Range[]> } | null = null
let inFlight: Promise<void> | null = null

export function warmProjectPrices(): void {
  if (cache && Date.now() - cache.at < TTL_MS) return
  if (inFlight) return
  inFlight = (async () => {
    try {
      const rows = await prisma.project.findMany({
        select: { name: true, price_min_cr: true, unit_types: { select: { price_min_cr: true, price_max_cr: true } } },
      })
      const ranges = new Map<string, Range[]>()
      for (const r of rows) {
        if (!r.name || r.name.length < 5) continue
        const list: Range[] = []
        for (const u of r.unit_types) {
          const lo = u.price_min_cr ?? u.price_max_cr
          const hi = u.price_max_cr ?? u.price_min_cr
          if (lo && hi) list.push([lo, hi])
        }
        if (r.price_min_cr) list.push([r.price_min_cr, r.price_min_cr])
        if (list.length) ranges.set(r.name.toLowerCase(), list)
      }
      cache = { at: Date.now(), ranges }
    } catch (e) {
      console.warn('[PRICE_GUARD] catalogue read failed', (e as Error).message)
    } finally {
      inFlight = null
    }
  })()
}

/** For tests: fill the cache directly. */
export function setProjectPricesForTest(entries: Record<string, Range[]>): void {
  cache = { at: Date.now(), ranges: new Map(Object.entries(entries).map(([k, v]) => [k.toLowerCase(), v])) }
}

const RUPEE = /₹\s*(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac)?s?)\b/gi
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function dropMisattributedPrices(text: string, buyerText = ''): { text: string; dropped: string[] } {
  if (!cache || Date.now() - cache.at > TTL_MS) return { text, dropped: [] }
  const buyerNums = [...buyerText.matchAll(/(\d+(?:\.\d+)?)\s*(cr|crore|l|lakh|lac)?/gi)]
    .map((m) => (/^l/i.test(m[2] ?? '') ? Number(m[1]) / 100 : Number(m[1])))
  const names = [...cache.ranges.keys()]
  const dropped: string[] = []
  const kept = splitClauses(text).filter((part) => {
    if (/^\s+$/.test(part)) return true
    const lower = part.toLowerCase()
    const named = names.filter((n) => new RegExp(`\\b${escape(n)}\\b`).test(lower))
    if (!named.length) return true
    const ranges = named.flatMap((n) => cache!.ranges.get(n) ?? [])
    for (const m of part.matchAll(RUPEE)) {
      const cr = /^l/i.test(m[2]) ? Number(m[1]) / 100 : Number(m[1])
      const ours = ranges.some(([lo, hi]) => cr >= lo * 0.97 && cr <= hi * 1.03)
      const theirs = buyerNums.some((b) => Math.abs(b - cr) <= 0.011)
      if (!ours && !theirs) { dropped.push(part.trim()); return false }
    }
    return true
  })
  return { text: kept.join('').replace(/([.!?]) {2,}/g, '$1 ').replace(/\n{3,}/g, '\n\n').trim(), dropped }
}

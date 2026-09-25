// backend/src/lib/discovery/nearby.ts
//
// "What is near this?" — answered from the one geo signal we can stand behind.
//
// WHAT WE HOLD: Project.lat / Project.lng, populated on 280 of 280 rows. That
// is enough to say truthfully how far one project is from another, or from the
// centre of a sector.
//
// WHAT WE DO NOT HOLD, despite appearances:
//   * There is no MetroStation, School or Hospital model. CLAUDE.md's domain
//     list names them; the schema does not contain them.
//   * The Connectivity table looks like the answer and is not. It holds 6,840
//     rows that are the same ~24 landmark names repeated across all 280
//     projects — every project claims a "Noida - Greater Noida Expressway" and
//     a "Delhi Public School (DPS) & Lotus Valley International" row. The
//     distances vary per project, which makes it look real, but the landmark
//     set is identical everywhere. It is seeded data, not surveyed data.
//
// So a question about proximity to a METRO, a SCHOOL or a HOSPITAL cannot be
// answered honestly at all, and this module says so rather than reaching for
// the Connectivity rows. Asked "projects near a metro station in noida" on
// 30 Aug, the assistant instead invented a Blue Line and an Aqua Line corridor
// with specific sector numbers. Nothing in our database says any of that.
//
// Distances here are STRAIGHT-LINE. A straight line is not a commute, and
// every caller is expected to label it as such — 2 km across the Hindon is not
// 2 km of driving.
import { prisma } from '../db'
import { calculateHaversineDistanceKm, getSectorCentroid, getProjectsWithinRadius } from './geo'
import { resolveLocationTerm } from './locationResolver'

/** What the buyer anchored "near" to. */
export type NearbyAnchorKind = 'project' | 'sector' | 'unresolved' | 'unheld_landmark'

export interface NearbyAnchor {
  kind: NearbyAnchorKind
  /** Display name of the anchor: a project name, or "Sector 62". */
  label: string
  lat?: number
  lng?: number
  /** For 'unheld_landmark': what kind of thing they asked to be near. */
  landmark?: string
}

export interface NearbyProject {
  id: string
  name: string
  sector: string
  distanceKm: number
  priceMinCr: number | null
  status: string | null
  builder: string | null
}

export interface NearbyResult {
  anchor: NearbyAnchor
  radiusKm: number
  /** Excludes the anchor project itself. */
  projects: NearbyProject[]
  /** True when the first radius found nothing and it was widened once. */
  widened: boolean
}

/**
 * Landmark classes a buyer asks to live near, and that we hold no verified
 * position for. Ordered so the most specific phrase wins the label.
 */
const UNHELD_LANDMARKS: Array<[RegExp, string]> = [
  [/\bmetro\s*station\b|\bmetro\b|\bblue\s*line\b|\baqua\s*line\b/i, 'a metro station'],
  [/\b(schools?|dps|colleges?|universit(?:y|ies))\b/i, 'a school'],
  [/\b(hospitals?|clinics?|medical\s+centres?)\b/i, 'a hospital'],
  [/\b(malls?|shopping\s+malls?)\b/i, 'a mall'],
  [/\b(airports?|jewar)\b/i, 'the airport'],
  [/\b(?:it|tech|cyber|software|business|corporate)\s+parks?\b|\bworkplaces?\b/i, 'an office park'],
]

/**
 * Landmark classes we DO hold per-project distances for, in `Connectivity`.
 * We have no coordinates for the landmarks themselves, but every project row
 * lists its nearest metro, school, hospital, mall and airport with a road
 * distance, so "projects near a metro" is answerable by ranking those rows.
 */
const HELD_LANDMARK_TYPES: Array<[RegExp, 'metro' | 'school' | 'hospital' | 'mall' | 'airport', string]> = [
  [/\bmetro\b|\bblue\s*line\b|\baqua\s*line\b/i, 'metro', 'metro station'],
  [/\bschools?\b/i, 'school', 'school'],
  [/\bhospitals?\b/i, 'hospital', 'hospital'],
  [/\bmalls?\b/i, 'mall', 'mall'],
  [/\bairports?\b|\bjewar\b/i, 'airport', 'airport'],
]

export function heldLandmarkType(message: string): (typeof HELD_LANDMARK_TYPES)[number][1] | null {
  for (const [re, type] of HELD_LANDMARK_TYPES) if (re.test(message)) return type
  return null
}

/**
 * The projects whose nearest `type` is closest, one row per project. Distances
 * come from brochures or Google and are stated with that source; a "proposed"
 * station is named as such because the row's own name says so.
 */
export async function nearestByLandmark(
  type: (typeof HELD_LANDMARK_TYPES)[number][1],
  limit = 8,
): Promise<string | null> {
  const rows = await prisma.connectivity.findMany({
    where: { type, distance_km: { not: null } },
    orderBy: { distance_km: 'asc' },
    take: limit * 6,
    select: {
      project_id: true, name: true, distance_km: true, data_source: true, is_operational: true,
      project: { select: { name: true, sector: true } },
    },
  })
  // Operating stations first: a buyer asking to live near a metro means one
  // they can ride today. Proposed ones still list, after, and are labelled.
  const planned = (r: (typeof rows)[number]) => !r.is_operational || /\bproposed\b/i.test(r.name)
  rows.sort((a, b) => Number(planned(a)) - Number(planned(b)) || (a.distance_km ?? 0) - (b.distance_km ?? 0))
  const seen = new Set<string>()
  const top = rows.filter((r) => !seen.has(r.project_id) && seen.add(r.project_id)).slice(0, limit)
  if (top.length === 0) return null
  const label = HELD_LANDMARK_TYPES.find(([, t]) => t === type)![2]
  const lines = top.map((r) => {
    const where = r.project.sector ? ` (${/^sector/i.test(r.project.sector) ? r.project.sector : `Sector ${r.project.sector}`})` : ''
    const note = planned(r) ? ', not yet operational' : ''
    return `- **${r.project.name}**${where}: ${r.distance_km} km to ${r.name}${note}`
  })
  const fromBrochure = top.some((r) => r.data_source === 'brochure' || r.data_source === 'estimated')
  return (
    `Projects we hold with the shortest road distance to a ${label}:\n\n${lines.join('\n')}\n\n` +
    (fromBrochure ? `Some of these distances come from builder brochures rather than a map measurement, so treat them as the builder's claim until checked on a visit. ` : '') +
    `Want me to narrow this to a budget or BHK?`
  )
}

/** True when the message asks to be near something we hold no coordinates for. */
export function unheldLandmark(message: string): string | null {
  for (const [re, label] of UNHELD_LANDMARKS) {
    if (re.test(message)) return label
  }
  return null
}

/** The proximity phrasings buyers actually use. */
const PROXIMITY =
  /\b(near(?:by|est)?|close\s+to|closest|next\s+to|beside|adjacent|walking\s+distance|how\s+far|within\s+\d+\s*(?:km|kms|kilomet\w*|min\w*)|in\s+the\s+vicinity|surrounding|neighbou?ring|around\s+(?:sector|here|there|metro|airport|expressway|\d+|noida)|nearabouts)\b/i

/** True when this message is asking a proximity question at all. */
export function isProximityQuestion(message: string): boolean {
  // Guard against non-spatial idioms like "way around", "work around", or strategy questions
  if (/\b(?:way|work|turn|play)\s+around\b/i.test(message)) return false
  if (/\b(?:make\s+money|save\s+money|how\s+to|investing|strategy|career)\b/i.test(message)) return false
  return PROXIMITY.test(message)
}

/** "within 5 km" → 5. Absent or absurd values fall back to the default. */
export function requestedRadiusKm(message: string, fallback = 3.5): number {
  const m = message.match(/within\s+(\d+(?:\.\d+)?)\s*(km|kms|kilomet\w*)/i)
  if (!m) return fallback
  const km = Number(m[1])
  return Number.isFinite(km) && km > 0 && km <= 25 ? km : fallback
}

/**
 * Resolves what "near ___" is anchored to.
 *
 * Order matters. A focused project wins, because "what is nearby" on a project
 * page means that project. Then a project named in the message, then a sector
 * or corridor term. A landmark we hold no position for is reported as such
 * rather than silently falling through to a sector guess — answering "near a
 * metro" with "here is Sector 150" would be a different question, answered
 * confidently.
 */
export async function resolveNearbyAnchor(
  message: string,
  focusProjectId?: string | null,
): Promise<NearbyAnchor> {
  if (focusProjectId) {
    const p = await prisma.project.findUnique({
      where: { id: focusProjectId },
      select: { name: true, lat: true, lng: true },
    })
    if (p?.lat != null && p?.lng != null) {
      return { kind: 'project', label: p.name, lat: p.lat, lng: p.lng }
    }
  }

  // A project named in the message, longest name first so "ATS Pious
  // Hideaways" beats "ATS".
  const haystack = ` ${message.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')} `
  const named = (await prisma.project.findMany({ select: { id: true, name: true, lat: true, lng: true } }))
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({ p, n: p.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim() }))
    .filter(({ n }) => n.length >= 6 && haystack.includes(` ${n} `))
    .sort((a, b) => b.n.length - a.n.length)[0]
  if (named) {
    return { kind: 'project', label: named.p.name, lat: named.p.lat!, lng: named.p.lng! }
  }

  // A sector or corridor. resolveLocationTerm already handles exact sectors,
  // numeric bands, micro-markets and corridor geometry, so this asks it rather
  // than re-deriving any of that.
  const sectorMatch = message.match(/\bsector\s*([0-9]+\s*[a-z]?)\b/i)
  if (sectorMatch) {
    const label = `Sector ${sectorMatch[1].trim().toUpperCase()}`
    const centroid = await getSectorCentroid(label)
    if (centroid) return { kind: 'sector', label, lat: centroid.lat, lng: centroid.lng }
  }

  const landmark = unheldLandmark(message)
  if (landmark) return { kind: 'unheld_landmark', label: landmark, landmark }

  // A corridor or micro-market phrase — "near the expressway".
  const resolved = await resolveLocationTerm(message)
  if (resolved?.sectors?.length) {
    const centroid = await getSectorCentroid(resolved.sectors[0])
    if (centroid) {
      return { kind: 'sector', label: resolved.sectors[0], lat: centroid.lat, lng: centroid.lng }
    }
  }

  return { kind: 'unresolved', label: '' }
}

/**
 * The point at which a proximity answer stops being worth giving.
 *
 * Sector 62 is the case that set this. Its nearest neighbour in our data is
 * 3.6 km away, so a 3.5 km radius returns exactly one project — the one
 * standing IN Sector 62 — and "what is near Sector 62" gets answered with
 * "Stellar Park is in Sector 62". That is the same non-answer this handler was
 * built to replace, so a thin result widens just as an empty one does.
 */
const MIN_USEFUL_RESULTS = 3

/**
 * Projects within reach of an anchor, nearest first.
 *
 * Widens once when the first radius returns too little to be useful. A buyer
 * who asks what is near Sector 62 is better served by "the closest we hold is
 * 3.6 km away in Sector 121" than by a list of one — but the widening is
 * reported, so the answer says the radius moved instead of implying everything
 * sits next door.
 */
export async function findNearby(
  anchor: NearbyAnchor,
  radiusKm: number,
  opts: { excludeProjectId?: string; limit?: number } = {},
): Promise<NearbyResult> {
  const empty: NearbyResult = { anchor, radiusKm, projects: [], widened: false }
  if (anchor.lat == null || anchor.lng == null) return empty

  const limit = opts.limit ?? 8

  const collect = async (r: number) => {
    const hits = await getProjectsWithinRadius(anchor.lat!, anchor.lng!, r)
    const ids = hits.map((h) => h.id).filter((id) => id !== opts.excludeProjectId)
    if (ids.length === 0) return []
    const rows = await prisma.project.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, name: true, sector: true, lat: true, lng: true,
        price_min_cr: true, status: true, builder: { select: { name: true } },
      },
    })
    return rows
      .map((p) => ({
        id: p.id,
        name: p.name,
        sector: p.sector ?? '',
        distanceKm: calculateHaversineDistanceKm(anchor.lat!, anchor.lng!, p.lat!, p.lng!),
        priceMinCr: p.price_min_cr,
        status: p.status,
        builder: p.builder?.name ?? null,
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit)
  }

  const first = await collect(radiusKm)
  if (first.length >= MIN_USEFUL_RESULTS) return { anchor, radiusKm, projects: first, widened: false }

  const wider = Math.min(radiusKm * 2, 12)
  const second = await collect(wider)
  // Only claim to have widened if it actually bought something. Reporting a
  // wider radius that returned the same one project reads as a bigger search
  // than it was.
  if (second.length > first.length) {
    return { anchor, radiusKm: wider, projects: second, widened: true }
  }
  return { anchor, radiusKm, projects: first, widened: false }
}

/**
 * The whole proximity answer, shaped for the router's coverage lane.
 *
 * It lives here rather than in a topic handler because the handler registry is
 * never reached on a DISCOVERY turn — the search lane answers and returns
 * first — and "property near Sector 62" classifies as DISCOVERY. The coverage
 * lane runs for every text message, which is the only place a deterministic
 * answer built from our own columns can reliably intercept one.
 *
 * Returns null when the message is not a proximity question, so the caller can
 * fall through to everything else unchanged.
 */
export async function nearbyCoverage(
  message: string,
  focusProjectId?: string | null,
): Promise<{ text: string } | null> {
  if (!isProximityQuestion(message)) return null

  // With a project in focus, "is it near a metro?" is about that project's own
  // connectivity rows — the ground-truth lane's connectivity handler owns it.
  const landmarkType = heldLandmarkType(message)
  if (landmarkType && focusProjectId) return null
  if (landmarkType && !/\bsector\s*\d/i.test(message)) {
    const listed = await nearestByLandmark(landmarkType)
    if (listed) return { text: listed }
  }

  const anchor = await resolveNearbyAnchor(message, focusProjectId)

  if (anchor.kind === 'unheld_landmark') {
    const what = anchor.landmark ?? 'that'
    const those = what === 'the airport' ? 'it' : 'those'
    return {
      text:
        `I can't tell you which projects are closest to ${what}. We hold coordinates for every ` +
        `project we track, but we do not hold verified positions for ${those} — so any distance ` +
        `I gave you would be a guess dressed up as a measurement.\n\n` +
        `What I can do is measure from a sector. Name one and I'll list every project we hold ` +
        `within a few kilometres of it, with the real distance to each. For commute times, our ` +
        `advisory team can confirm them on a site visit.`,
    }
  }

  if (anchor.kind === 'unresolved') return null

  const result = await findNearby(anchor, requestedRadiusKm(message), {
    excludeProjectId: anchor.kind === 'project' && focusProjectId ? focusProjectId : undefined,
    limit: 8,
  })

  if (result.projects.length === 0) {
    return {
      text:
        `We don't hold any projects within ${result.radiusKm} km of ${anchor.label}. That is a gap ` +
        `in our coverage of that area, not a statement that nothing is being built there.`,
    }
  }

  return { text: renderNearby(result) }
}

/**
 * The answer, as a table plus the one caveat that matters.
 *
 * Every distance is straight-line, and the text says so in those words. A buyer
 * who reads "2 km" as a twenty-minute walk and finds the Hindon in the way has
 * been misled by us, even though the number was right.
 */
export function renderNearby(result: NearbyResult): string {
  const { anchor, projects, radiusKm, widened } = result
  const sectors = sectorsInOrder(result)

  const rows = projects
    .map((p) => {
      const price = p.priceMinCr != null ? `from ₹${p.priceMinCr.toFixed(2)} Cr` : 'Not recorded'
      const status = p.status ? p.status.replace(/_/g, ' ') : 'Not recorded'
      return `| **${p.name}** | ${p.sector || 'Not recorded'} | ${p.distanceKm.toFixed(1)} km | ${price} | ${status} |`
    })
    .join('\n')

  const opener = widened
    ? `Nothing we hold sits especially close to ${anchor.label}, so I widened the search to ` +
      `${radiusKm} km. Nearest first:`
    : `Everything we hold within ${radiusKm} km of ${anchor.label}, nearest first:`

  const spread =
    sectors.length > 1
      ? `\n\nThese sit across ${sectors.slice(0, 4).join(', ')}${sectors.length > 4 ? ' and others' : ''}.`
      : ''

  return (
    `${opener}\n\n` +
    `| Project | Sector | Distance | Price from | Status |\n` +
    `| :--- | :--- | ---: | :--- | :--- |\n` +
    `${rows}` +
    spread +
    `\n\n**Distances are straight-line**, measured between the coordinates we hold — not driving ` +
    `distance and not commute time. Ask me about any of these and I'll pull its full cost and ` +
    `possession detail.`
  )
}

/** Sectors represented in a result, nearest first, for a one-line summary. */
export function sectorsInOrder(result: NearbyResult): string[] {
  const seen: string[] = []
  for (const p of result.projects) {
    if (p.sector && !seen.includes(p.sector)) seen.push(p.sector)
  }
  return seen
}

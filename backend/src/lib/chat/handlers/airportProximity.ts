import type { ChatTopicHandler } from '../handlerContext'
import { prisma } from '../../db'
import { airportAskedAbout } from '../../discovery/airports'
import { calculateHaversineDistanceKm, isPlaceholderCoordinate } from '../../discovery/geo'
import { findProjectsMentioned } from '../../discovery/proseEntities'

/**
 * "Which of these is closest to Jewar airport?" / "property closest to the Noida airport"
 *
 * Live chat, 17 Oct 2026: the model guessed "15 to 25 minutes", then said we hold
 * nothing on the corridor, then the next turn died on an integrity check over a
 * shortlisted name and the buyer got the outage notice. Every project row has
 * lat/lng, so this is arithmetic: straight-line distance, ranked, labelled as
 * straight line because we hold no road routing.
 */
// Ranking words only: "how far is ACE Parkway from Jewar" is one project's
// connectivity question and stays with the connectivity lane.
const CLOSEST = /\b(closest|nearest|nearer|closer)\b/i

// "Nearest to New Delhi" (live session, 17 Oct 2026) got an invented "27 km, 45-50
// minutes" for Sector 78, then "Sectors 14-16, 10 to 14 km". Connaught Place is
// the reference point, stated in the answer.
const CENTRAL_DELHI = { name: 'Central Delhi (Connaught Place)', lat: 28.6315, lng: 77.2167 }
const NEW_DELHI = /\b(new delhi|central delhi|connaught place|delhi border)\b/i

/** The place the buyer wants to be near, if it is one we can measure to. */
export function proximityTarget(message: string): { name: string; lat: number; lng: number } | null {
  return airportAskedAbout(message) ?? (NEW_DELHI.test(message) ? CENTRAL_DELHI : null)
}

export function matchesAirportProximity(message: string): boolean {
  return CLOSEST.test(message) && proximityTarget(message) !== null
}

type Row = { id: string; name: string; sector: string | null; status: string | null; lat: number | null; lng: number | null }

export function airportProximityAnswer(rows: Row[], airport: { name: string; lat: number; lng: number }, scope: 'named' | 'shortlist' | 'catalogue'): string {
  const ranked = rows
    .filter((r) => !isPlaceholderCoordinate(r.lat, r.lng))
    .map((r) => ({ ...r, km: Math.round(calculateHaversineDistanceKm(r.lat!, r.lng!, airport.lat, airport.lng) * 10) / 10 }))
    .sort((a, b) => a.km - b.km)
  if (!ranked.length) return `I don't hold a reliable map location for these projects, so I can't rank them by distance to ${airport.name}.`
  const shown = scope === 'catalogue' ? ranked.slice(0, 5) : ranked
  const lead = scope === 'catalogue'
    ? `Of the projects we hold, these are nearest to ${airport.name}:`
    : `Of the ${ranked.length} project${ranked.length === 1 ? '' : 's'} ${scope === 'named' ? 'you listed' : 'on your shortlist'}, **${ranked[0].name}** is nearest to ${airport.name}.`
  const missing = rows.length - ranked.length
  return `### Distance to ${airport.name}

${lead}

| Project | Sector | Status | Straight-line distance |
| :--- | :--- | :--- | ---: |
${shown.map((r) => `| ${r.name} | ${r.sector ?? '—'} | ${r.status === 'ready_to_move' ? 'Ready to move' : r.status ? 'Under construction' : 'Not on record'} | ${r.km} km |`).join('\n')}

These are straight-line distances from each project's map location. Road distance is longer, and I don't hold drive times, so check the route at your usual travel hour.${missing > 0 ? ` ${missing} project${missing === 1 ? ' has' : 's have'} no reliable map location on record and ${missing === 1 ? 'is' : 'are'} left out.` : ''}`
}

const SELECT = { id: true, name: true, sector: true, status: true, lat: true, lng: true } as const

export const airportProximityHandler: ChatTopicHandler = {
  id: 'airport_proximity',
  description: 'Projects ranked by straight-line distance to an airport the buyer named',

  matches: (ctx) => matchesAirportProximity(ctx.message),

  handle: async (ctx) => {
    const airport = proximityTarget(ctx.message)!
    // A pasted list or named projects first, then "these" from the last turn, then the catalogue.
    const named = await findProjectsMentioned(ctx.message, undefined, 12)
    const ids = named.length ? named.map((p) => p.id) : ctx.cachedProjects.map((p) => p.id)
    const scope = named.length ? 'named' : ids.length ? 'shortlist' : 'catalogue'
    const rows = (await prisma.project.findMany({
      where: ids.length ? { id: { in: ids } } : { lat: { not: null }, lng: { not: null } },
      select: SELECT,
    })) as Row[]

    ctx.send('token', { token: airportProximityAnswer(rows, airport, scope) })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Measuring each project's distance to ${airport.name}:`,
      chips: [],
      missingFields: [],
      confidence: 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}

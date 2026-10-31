import type { ChatTopicHandler } from '../handlerContext'
import { sectorWhereClause } from '../../discovery/normalize'
import { prisma } from '../../db'
import { unverified } from '../../factPresentation'
import { namedProjectWhere } from '../../discovery/pickProjectRow'

/**
 * "How far is the metro / the airport / what's the connectivity like?"
 *
 * The branch this replaces built a four-column "verified transit and distance
 * matrix" in which three columns were the same hardcoded string on every row:
 *
 *     const expStr     = 'Noida-Gr Noida Expressway (12–15 mins)'
 *     const airportStr = 'Jewar Airport (45 mins via FNG / Yamuna Exp)'
 *     const infraStr   = 'Fortis / Yatharth Hospital (10 mins)'
 *
 * Every project, regardless of where it actually is, was reported as 12–15
 * minutes from the expressway and 10 minutes from two named hospitals. The
 * metro column fell back to 'Sector 76 / 50 Metro (1.5 km)' — a specific
 * distance invented for any project with no connectivity record.
 *
 * A comparison table whose columns do not vary tells a buyer the projects are
 * equivalent on commute. That is the single dimension they are most likely to
 * decide on, and the real per-project data was sitting unused in the
 * connectivity relation and in the *_distance_km columns.
 *
 * Every cell below is now read from that project's own rows, and a project with
 * no record for a category shows a dash rather than a borrowed figure.
 */

const NOT_RECORDED = '—'

/** Prefer road distance with travel time; fall back to whichever we hold. */
function describe(entry: { name: string; distance_km: number | null; travel_time_min: number | null } | undefined): string {
  if (!entry) return NOT_RECORDED
  const parts: string[] = []
  if (entry.distance_km != null) parts.push(`${entry.distance_km} km`)
  if (entry.travel_time_min != null) parts.push(`${entry.travel_time_min} min`)
  return parts.length ? `${entry.name} — ${parts.join(', ')}` : entry.name
}

function km(value: number | null | undefined, label: string): string {
  return value == null ? NOT_RECORDED : `${label} — ${value} km`
}

export const connectivityHandler: ChatTopicHandler = {
  id: 'connectivity',
  description: 'Metro, expressway, airport and civic distances per project',

  // Declines a multi-topic message so the generic grounded answer can

  // cover every part of it — see singleTopic in chat-router.ts.

  matches: ctx => ctx.flags.singleTopic === true && (ctx.flags.isConnectivityQuery === true),

  handle: async ctx => {
    const sector = typeof ctx.intent.sector === 'string' ? ctx.intent.sector : null
    const cachedIds = ctx.cachedProjects.map(p => p.id)

    /**
     * "What is near ACE Parkway" is a question about one building.
     *
     * Without this the sector filter took over and the table came back with
     * five projects in Sector 150, four of them carrying the same stored
     * distances — a wall of near-identical rows in answer to a question about
     * one of them. A named project narrows the table to that project.
     */
    const focusName = ctx.activeProjectName

    if (!focusName && !sector && cachedIds.length === 0) return false // let the generic path ask

    const projects = await prisma.project.findMany({
      where: focusName
        ? await namedProjectWhere(focusName, ctx.message)
        : {
            OR: [
              ...sectorWhereClause(sector ?? ''),
              ...(cachedIds.length ? [{ id: { in: cachedIds } }] : []),
            ],
          },
      include: {
        connectivity: {
          where: { is_operational: true },
          orderBy: [{ category_rank: 'asc' }, { distance_km: 'asc' }],
        },
      },
      take: 5,
    })

    if (projects.length === 0) return false

    const rows = projects.map(p => {
      const byType = (type: string) =>
        p.connectivity.find(c => String(c.type).toLowerCase() === type)
      const byName = (pattern: RegExp) =>
        p.connectivity.find(c => pattern.test(c.name) || pattern.test(String(c.type)))

      const metro = describe(byType('metro') ?? byName(/metro/i))
      const road = describe(byType('expressway') ?? byType('road') ?? byName(/expressway|highway/i))
      const airport = p.airport_distance_km != null
        ? km(p.airport_distance_km, 'Airport')
        : describe(byType('airport') ?? byName(/airport/i))
      const hospital = p.hospital_distance_km != null
        ? km(p.hospital_distance_km, 'Nearest')
        : describe(byType('hospital') ?? byName(/hospital/i))
      const school = p.top_school_distance_km != null
        ? km(p.top_school_distance_km, 'Nearest')
        : describe(byType('school') ?? byName(/school/i))

      return `| **${p.name}** | ${metro} | ${road} | ${airport} | ${hospital} | ${school} |`
    }).join('\n')

    const anyRecorded = projects.some(p => p.connectivity.length > 0 || p.airport_distance_km != null)
    const scope = focusName && projects[0] ? ` — ${projects[0].name}` : sector ? ` — ${sector}` : ''

    const text = anyRecorded
      ? `### Connectivity${scope}

| Project | Metro | Road / expressway | Airport | Hospital | School |
| :--- | :--- | :--- | :--- | :--- | :--- |
${rows}

Distances are road distances from our records, not straight-line. A dash means we do not hold that measurement for the project — it is not a claim that nothing is nearby.`
      : `### Connectivity${scope}\n\n${unverified('connectivity measurements', projects.map(p => p.name).join(', '))}`

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'Road distances from our records:',
      projects,
      chips: [
        { id: `chip_map_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Show these on a map', icon: 'map-pin', analyticsId: 'chip_conn_map', priority: 1, payload: { text: `Show me the location of ${projects[0]?.name ?? 'these projects'}` } },
        { id: `chip_visit_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Schedule site visit', icon: 'calendar', analyticsId: 'chip_conn_visit', priority: 2, payload: { text: 'Schedule a site visit' } },
      ],
      missingFields: anyRecorded ? [] : ['connectivity'],
      confidence: anyRecorded ? 'HIGH' : 'LOW',
    })
    ctx.send('done', {
      sessionId: ctx.sessionId,
      intentState: 'SHORTLISTED',
      intent: ctx.intent,
      projects,
      responseMode: 'chat',
    })
    ctx.res.end()
  },
}

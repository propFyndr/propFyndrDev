import { prisma } from '../../db'
import { sectorWhereClause } from '../../discovery/normalize'
import type { ChatTopicHandler } from '../handlerContext'
import { namedProjectWhere } from '../../discovery/pickProjectRow'

/**
 * "Tell me the properties which has padel courts or football turfs nearby."
 *
 * Live chat 17 Oct 2026: asked three times, answered three times with the
 * landmark table for the project in focus (ATS Happy Trails), because the
 * vicinity matcher keys on "nearby"/"around" and the focused project. The
 * buyer asked a search across projects for a sports facility; we hold
 * facilities only as amenity rows inside projects, and no sports landmarks
 * outside them.
 *
 * Amenity rows on dev are heavily templated (the same eight strings on 188
 * projects, another six on 175). A facility counts only when the stored text
 * names it: "Children Dedicated Play Zone with Shock-Absorbent Turf" is on 175
 * projects and is not a football turf. Text shared by more than three projects
 * is still listed, with the count, so the buyer can weigh it.
 */

interface Facility {
  label: string
  /** Does the buyer's message ask about it? */
  asks: RegExp
  /** Does a stored amenity name actually name it? */
  names: RegExp
  /** Substrings for the DB prefilter; `names` decides. */
  contains: string[]
}

const FACILITIES: Facility[] = [
  { label: 'padel court', asks: /\bpad+el\b|\bpaddle\b/i, names: /\bpadel\b|\bpaddle\s*(?:tennis|court|ball)/i, contains: ['padel', 'paddle'] },
  { label: 'pickleball court', asks: /\bpickle\s*ball\b/i, names: /pickle\s*ball/i, contains: ['pickle'] },
  { label: 'football turf', asks: /\b(?:football|futsal|soccer|turfs?)\b/i, names: /football|futsal|soccer|\b(?:sports?|astro|football)\s*turf\b|\bturf\s+(?:pitch|ground|field)\b/i, contains: ['football', 'futsal', 'soccer', 'turf'] },
  { label: 'tennis court', asks: /(?<!table\s)\btennis\b/i, names: /(?<!table\s)\btennis\b/i, contains: ['tennis'] },
  { label: 'cricket pitch', asks: /\bcricket\b/i, names: /\bcricket\b/i, contains: ['cricket'] },
  { label: 'squash court', asks: /\bsquash\b/i, names: /\bsquash\b/i, contains: ['squash'] },
  { label: 'badminton court', asks: /\bbadminton\b/i, names: /\bbadminton\b/i, contains: ['badminton'] },
  { label: 'basketball court', asks: /\bbasket\s*ball\b/i, names: /basket\s*ball/i, contains: ['basket'] },
  { label: 'volleyball court', asks: /\bvolley\s*ball\b/i, names: /volley\s*ball/i, contains: ['volley'] },
  { label: 'golf facility', asks: /\bgolf\b/i, names: /\bgolf\b/i, contains: ['golf'] },
  { label: 'snooker or billiards table', asks: /\b(?:snooker|billiards?)\b/i, names: /\b(?:snooker|billiards?)\b/i, contains: ['snooker', 'billiard'] },
  { label: 'jacuzzi', asks: /\bjacuzzi\b/i, names: /\bjacuzzi\b/i, contains: ['jacuzzi'] },
  { label: 'swimming pool', asks: /\bswimming\s*pool\b/i, names: /\bswimming\s*pool\b/i, contains: ['swimming'] },
  { label: 'skating rink', asks: /\bskating\b/i, names: /\bskating\b/i, contains: ['skating'] },
]

/** "Which properties have…", "properties … which has …", "any society with…". */
const PLURAL_SEARCH =
  /\b(?:which|what|any|list|show|tell\s+me|find|suggest)\b[^.?!]{0,40}\b(?:properties|projects|societies|apartments|flats|options|ones)\b|\b(?:properties|projects|societies|apartments)\b[^.?!]{0,40}\b(?:which|that|with|having|has|have)\b/i
const THIS_PROPERTY = /\b(?:this|the|that)\s+(?:property|project|society|building|complex)\b|\bin\s+it\b/i
const ASKING = /\b(?:is\s+there|are\s+there|do(?:es)?\s+(?:it|this|they)\s+have|has\s+it\s+got|asking\s+about|what\s+about)\b/i
const AROUND = /\b(?:near|nearby|near\s?by|around|close\s+to|vicinity|walking\s+distance|in\s+the\s+area)\b/i

export function facilitiesAsked(message: string): Facility[] {
  return FACILITIES.filter(f => f.asks.test(message))
}

/** A stadium or sports city is a city landmark, which the vicinity handler owns. */
const CITY_LANDMARK = /\b(?:stadium|sports\s+city|sports\s+complex)\b/i

export function matchesAmenitySearch(message: string): boolean {
  if (CITY_LANDMARK.test(message) || facilitiesAsked(message).length === 0) return false
  return PLURAL_SEARCH.test(message) || THIS_PROPERTY.test(message) || ASKING.test(message)
}

export function isPluralProjectSearch(message: string): boolean {
  return PLURAL_SEARCH.test(message)
}

/** Area named in the message, as a project `where` and a label. Sector beats city. */
export function areaIn(message: string): { where: Record<string, unknown>; label: string } | null {
  const sec = /\bsec(?:tor)?\s*-?\s*(\d+[a-z]?)\b/i.exec(message)
  if (sec) return { where: { OR: sectorWhereClause(sec[1]) }, label: `Sector ${sec[1].toUpperCase()}` }
  if (/\bgreater\s+noida\s+west\b|\bgnw\b|\bnoida\s+extension\b/i.test(message))
    return { where: { city: { equals: 'Greater Noida West', mode: 'insensitive' } }, label: 'Greater Noida West' }
  // "Greater Noida" as buyers say it usually takes in the west side too.
  if (/\bgreater\s+noida\b/i.test(message))
    return { where: { city: { startsWith: 'Greater Noida', mode: 'insensitive' } }, label: 'Greater Noida and Greater Noida West' }
  if (/\bin\s+noida\b/i.test(message))
    return { where: { city: { equals: 'Noida', mode: 'insensitive' } }, label: 'Noida' }
  return null
}

const orList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`)
const withArticle = (label: string) => `${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label}`

const NEARBY_LINE =
  "We don't hold sports facilities outside projects. Our landmark records cover metro, roads, hospitals, malls and schools, so I can't tell you whether there is one nearby."
const INCOMPLETE_LINE = 'Amenity lists we hold are incomplete, so ask on a site visit.'

export interface AmenityHit {
  project: string
  sector: string | null
  amenity: string
  /** How many projects carry this exact amenity text. */
  sharedBy: number
}

/** Pure: the cross-project answer. */
export function searchAnswer(facilities: Facility[], hits: AmenityHit[], areaLabel: string | null, askedAround: boolean): string {
  const asked = orList(facilities.map(f => f.label))
  const where = areaLabel ? ` in ${areaLabel}` : ''
  const tail = askedAround ? `\n\n${NEARBY_LINE}` : ''
  if (hits.length === 0)
    return `None of the projects we hold${where} lists ${withArticle(asked)}. ${INCOMPLETE_LINE}${tail}`

  const projects = new Set(hits.map(h => h.project))
  // Text unique to a project first: it says more about that project.
  const shown = [...hits].sort((a, b) => a.sharedBy - b.sharedBy || a.project.localeCompare(b.project)).slice(0, 10)
  const rows = shown.map(h => `| ${h.project} | ${h.sector ?? '—'} | ${h.amenity} |`)
  return `### Projects${where} with ${withArticle(asked)}

${projects.size} project${projects.size === 1 ? '' : 's'} list${projects.size === 1 ? 's' : ''} it${projects.size > shown.length ? `; showing ${shown.length}` : ''}.

| Project | Sector | Amenity |
| :--- | :--- | :--- |
${rows.join('\n')}

${INCOMPLETE_LINE}${tail}`
}

/** Pure: the one-project answer. Absent is "not on record", never "it doesn't have". */
export function projectAnswer(projectName: string, facilities: Facility[], matched: Array<{ amenity: string; sharedBy: number }>, askedAround: boolean): string {
  const asked = orList(facilities.map(f => f.label))
  const tail = askedAround ? `\n\n${NEARBY_LINE}` : ''
  if (matched.length === 0)
    return `${withArticle(asked)[0].toUpperCase()}${withArticle(asked).slice(1)} is not on record for ${projectName}. That is not a no: ${INCOMPLETE_LINE[0].toLowerCase()}${INCOMPLETE_LINE.slice(1)}${tail}`
  // Owner, 26 Oct: answer from the project's list as it stands, with no
  // commentary on our data (a "may be a template" note reached a buyer).
  const lines = matched.map(m => `- ${m.amenity}`)
  return `Yes. ${projectName}'s amenities include:\n\n${lines.join('\n')}${tail}`
}

async function sharedCounts(names: string[]): Promise<Map<string, number>> {
  if (names.length === 0) return new Map()
  const rows = await prisma.amenity.groupBy({ by: ['name'], where: { name: { in: names } }, _count: { project_id: true } })
  return new Map(rows.map(r => [r.name, r._count.project_id]))
}

export const amenitySearchHandler: ChatTopicHandler = {
  id: 'amenity_search',
  description: 'Which projects list a sports facility (padel, turf, tennis…), or whether this one does',

  // Declines only a comparison of named projects: the router's compare flag also
  // fires on "padel courts or football turfs" with a shortlist on screen.
  matches: ctx => (ctx.intent.projectNames?.length ?? 0) < 2 && matchesAmenitySearch(ctx.message),

  handle: async ctx => {
    const facilities = facilitiesAsked(ctx.message)
    const askedAround = AROUND.test(ctx.message)
    const named = String(ctx.activeProjectName ?? '')
    const oneProject = !isPluralProjectSearch(ctx.message) && named.length > 0

    let text: string
    if (oneProject) {
      const project = await prisma.project.findFirst({
        where: await namedProjectWhere(named, ctx.message),
        select: { name: true, amenities: { select: { name: true } } },
      })
      if (!project) return false
      const names = project.amenities.map(a => a.name).filter(n => facilities.some(f => f.names.test(n)))
      const counts = await sharedCounts(names)
      text = projectAnswer(project.name, facilities, names.map(n => ({ amenity: n, sharedBy: counts.get(n) ?? 1 })), askedAround)
    } else {
      const area = areaIn(ctx.message)
      const rows = await prisma.amenity.findMany({
        where: {
          OR: facilities.flatMap(f => f.contains).map(k => ({ name: { contains: k, mode: 'insensitive' as const } })),
          project: { archived_duplicate_of: null, ...(area?.where ?? {}) },
        },
        select: { name: true, project: { select: { name: true, sector: true } } },
      })
      let matched = rows.filter(r => facilities.some(f => f.names.test(r.name)))
      // 'a swimming pool and a jacuzzi' wants both in one project; 'squash or golf' wants either.
      if (facilities.length > 1 && /\band\b/i.test(ctx.message) && !/\bor\b/i.test(ctx.message)) {
        const hasAll = new Set(
          [...new Set(matched.map(r => r.project.name))].filter(p =>
            facilities.every(f => matched.some(r => r.project.name === p && f.names.test(r.name))),
          ),
        )
        matched = matched.filter(r => hasAll.has(r.project.name))
      }
      const counts = await sharedCounts([...new Set(matched.map(r => r.name))])
      text = searchAnswer(
        facilities,
        matched.map(r => ({ project: r.project.name, sector: r.project.sector, amenity: r.name, sharedBy: counts.get(r.name) ?? 1 })),
        area?.label ?? null,
        askedAround,
      )
    }

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'Checking the amenity lists we hold:',
      chips: [],
      missingFields: [],
      confidence: 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: ctx.intentState, intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
    return true
  },
}

import type { ChatTopicHandler } from '../handlerContext'
import { prisma } from '../../db'
import { tavilySearch } from '../../web'

/**
 * "Does Ace Parkway have a stadium or sports city nearby?"
 *
 * Measured: answered with ACE Parkway's own amenity table — the swimming pool,
 * the squash courts, the bowling alley — and never addressed the question. The
 * amenity matcher contains `sports`, so a question about what is AROUND the
 * project was read as a question about what is INSIDE it. Two different facts
 * with almost the same vocabulary.
 *
 * The split that matters: an amenity is something the developer built and we
 * hold in `amenities`; a landmark is something the city built and we hold in
 * `connectivity`, or do not hold at all. Most projects have no stadium row, and
 * "we have no row" is not the same as "there is no stadium" — the honest answer
 * needs a source outside our database.
 *
 * So: our rows first, then the web, each labelled as what it is. A web answer
 * is never presented in the register of a verified one, and it never becomes a
 * card or a recommendation.
 */

/**
 * Landmark kinds a buyer asks about, and the `connectivity.type` values that
 * answer each.
 *
 * Rows are selected by type, not by name. Name matching put "Gaur City Mall &
 * Spectrum Metro High Street" into a metro answer because a mall had "Metro"
 * in its name, and every airport row — IGI included — into a Jewar answer.
 */
const LANDMARKS: Array<[RegExp, string, string[]]> = [
  [/\b(stadium|sports\s+city|sports\s+complex|cricket\s+ground|golf\s+course)\b/i, 'sports venue', ['landmark', 'park']],
  [/\b(mall|malls|shopping\s+(?:centre|center|complex)|market)\b/i, 'shopping', ['mall', 'commercial']],
  [/\b(metro|metro\s+station|aqua\s+line|blue\s+line)\b/i, 'metro', ['metro']],
  [/\b(hospital|hospitals|medical|clinic|healthcare)\b/i, 'hospital', ['hospital']],
  [/\b(school|schools|college|university|creche|daycare)\b/i, 'school', ['school', 'university']],
  [/\b(airport|jewar|igi)\b/i, 'airport', ['airport']],
  [/\b(park|parks|biodiversity|golf|green\s+belt)\b/i, 'park', ['park']],
  [/\b(temple|mosque|church|gurudwara)\b/i, 'place of worship', ['landmark']],
  [/\b(expressway|highway|fng|dnd|link\s+road)\b/i, 'road', ['road', 'expressway']],
  [/\b(office|it\s+park|business\s+park|tech\s+park|corporate)\b/i, 'workplace', ['it_park', 'commercial']],
  [/\b(restaurant|cafe|food\s+court|cinema|multiplex|pvr|theatre)\b/i, 'leisure', ['mall', 'commercial', 'landmark']],
]

/** A named airport narrows the airport rows to that airport. */
const NAMED_AIRPORT: Array<[RegExp, RegExp]> = [
  [/\bjewar\b|noida\s+international/i, /jewar|noida\s+international/i],
  [/\bigi\b|indira\s+gandhi|delhi\s+airport/i, /igi|indira\s+gandhi|delhi/i],
]

/** One landmark entered twice ("… Airport (Jewar DXN)", "… Airport (Jewar)") is one landmark. */
const landmarkKey = (type: string, name: string) =>
  `${type}:${name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()}`

/** Words that make a question about the surroundings rather than the building. */
const PROXIMITY =
  /\b(near|nearby|near\s?by|around|close\s+to|closest|nearest|vicinity|walking\s+distance|how\s+far|distance\s+to|surrounding|next\s+to|adjacent|in\s+the\s+area|kitne\s+door)\b/i

export const vicinityLookupHandler: ChatTopicHandler = {
  id: 'vicinity-lookup',
  description: 'Landmarks and facilities around a project, from our rows or the web',

  matches: ctx =>
    ctx.flags.isCompareRequest !== true &&
    PROXIMITY.test(ctx.message) &&
    // "What is near Elite X?" names no landmark kind and wants all of them.
    Boolean(ctx.activeProjectName),

  handle: async ctx => {
    const named = String(ctx.activeProjectName ?? '')
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { name: { contains: named, mode: 'insensitive' } },
          { slug: { contains: named, mode: 'insensitive' } },
          ...(named.length === 36 ? [{ id: named }] : []),
        ],
      },
      select: {
        name: true, sector: true, city: true,
        connectivity: {
          where: { is_operational: true },
          orderBy: [{ distance_km: 'asc' }],
          select: { type: true, name: true, distance_km: true, travel_time_min: true, extra_detail: true },
        },
      },
    })
    if (!project) return false // the unknown-project path handles this properly

    const askedKinds = LANDMARKS.filter(([re]) => re.test(ctx.message))
    const asked = askedKinds.map(([, label]) => label)
    // Never empty: `new RegExp('')` matches everything, which is how a bare
    // "what is near X" used to pass every web answer.
    const askedRe = askedKinds.length
      ? new RegExp(askedKinds.map(([re]) => re.source).join('|'), 'i')
      : /(?!)/

    // Duplicates collapsed, nearest kept (rows arrive nearest first).
    const seen = new Set<string>()
    const rowsHeld = project.connectivity.filter(c => {
      const key = landmarkKey(String(c.type), c.name)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const airportName = NAMED_AIRPORT.find(([asks]) => asks.test(ctx.message))?.[1]
    const ofKind = (types: string[]) =>
      rowsHeld.filter(c =>
        types.includes(String(c.type)) &&
        (String(c.type) !== 'airport' || !airportName || airportName.test(c.name)))

    // Nothing specific asked: everything around the project, by type.
    const hits = askedKinds.length ? askedKinds.flatMap(([, , types]) => ofKind(types)) : rowsHeld

    const km = (d: number | null) => (d == null ? null : d < 1 ? `${Math.round(d * 1000)} m` : `${d} km`)

    let body: string
    let tier: 'verified' | 'missing'

    // "How far is ACE Parkway from the metro and Jewar airport?" asks for two
    // numbers. It got a six-row table with two malls in it. One or two named
    // kinds, each with a row, get one sentence: the nearest of each.
    //
    // ACE Parkway holds four metro rows and zero airport rows — a project can
    // have one asked kind on record and not the other. Requiring every kind to
    // resolve from the project's own rows sent that case to the table branch
    // below with whatever partial rows existed, the exact shape this branch
    // exists to avoid. A kind missing at the project level still tries the
    // sector-level figure (the same source the fully-missing case already
    // uses) before this composes a sentence or gives up on it.
    const resolvedPerKind = askedKinds.length > 0 && askedKinds.length <= 2
      ? await Promise.all(askedKinds.map(async ([, label, types]) => {
          const row = ofKind(types)[0]
          if (row) {
            const time = row.travel_time_min != null ? ` (about ${row.travel_time_min} min by road)` : ''
            return `${km(row.distance_km) ?? 'an unrecorded distance'} from ${row.name}${time}`
          }
          const sectorPart = await sectorLevelDistances(project.sector, project.city, [label])
          return sectorPart ? sectorPart.replace(/^From [^,]+,\s*/, '') : null
        }))
      : []
    if (resolvedPerKind.length > 0 && resolvedPerKind.every(Boolean)) {
      tier = 'verified'
      body = `${project.name} (${project.sector}) is ${resolvedPerKind.join(', and ')}. Road distances from our records where held, sector-level otherwise.`
    } else if (hits.length > 0) {
      tier = 'verified'
      const rows = hits.slice(0, askedKinds.length ? 6 : 10).map(c => {
        const dist = km(c.distance_km)
        const time = c.travel_time_min != null ? `${c.travel_time_min} min` : '—'
        return `| ${c.name} | ${String(c.type).replace(/_/g, ' ').toLowerCase()} | ${dist ?? '—'} | ${time} |`
      }).join('\n')
      body =
        `### Near ${project.name} — ${project.sector}\n\n` +
        `| Landmark | Type | Distance | Travel time |\n| :--- | :--- | ---: | ---: |\n${rows}\n\n` +
        `Distances are road distances from our records, not straight-line.`
    } else {
      tier = 'missing'
      /**
       * No row does not mean no landmark.
       *
       * This is the case the amenity table was silently answering wrong. We
       * hold no `stadium` entry for most projects, and saying "there is no
       * stadium" from that absence would be exactly the fabrication the fact
       * tiers exist to prevent. The web is a legitimate source here as long as
       * it is named as one.
       */
      const query = `${project.name} ${project.sector} ${project.city ?? 'Noida'} ${asked.join(' ')} nearby distance`
      const sectorLine = await sectorLevelDistances(project.sector, project.city, asked)
      let web = ''
      if (!sectorLine) try {
        const { answer, results } = await tavilySearch(query, 3)
        web = usableWebAnswer(answer || results[0]?.content?.slice(0, 320) || '', project.name, project.sector, askedRe)
      } catch (e) {
        console.warn('[VICINITY:WEB_ERROR]', (e as Error).message)
      }

      const held = project.connectivity.slice(0, 5)
      const heldBlock = held.length
        ? `\n\nWhat we do hold for ${project.name}:\n\n| Landmark | Type | Distance |\n| :--- | :--- | ---: |\n` +
          held.map(c => `| ${c.name} | ${String(c.type).replace(/_/g, ' ').toLowerCase()} | ${km(c.distance_km) ?? '—'} |`).join('\n')
        : ''

      if (sectorLine) {
        body = `${sectorLine}\n\nThese are sector-level figures from our sector records, not measured from ${project.name}'s gate, so allow a kilometre or two either way.`
      } else body =
        (asked.length
          ? `We have not recorded ${asked.length === 1 && /^[aeiou]/i.test(asked[0]) ? 'an' : 'a'} ${asked.join(' or ')} against ${project.name}, so I can't confirm one from our own data.`
          : `We have not recorded the landmarks around ${project.name} yet, so I can't list them from our own data.`) +
        (web
          ? `\n\n**From public sources, not our records:** ${web.trim()}\n\nTreat that as unverified — worth confirming on the site visit or with the advisory team.`
          : `\n\nI'd rather say that than guess. The advisory team can share the location map and drive times, or you can check them on a site visit.`) +
        heldBlock
    }

    ctx.send('token', { token: body })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `What's around ${project.name}:`,
      chips: [
        { id: `chip_vc_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Full connectivity for ${project.name}`, icon: 'route', analyticsId: 'chip_vic_conn', priority: 1, payload: { text: `What is near ${project.name}?` } },
        { id: `chip_vv_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Schedule site visit', icon: 'calendar', analyticsId: 'chip_vic_visit', priority: 2, payload: { text: `Schedule a site visit for ${project.name}` } },
      ],
      missingFields: tier === 'missing' ? ['connectivity'] : [],
      confidence: tier === 'verified' ? 'HIGH' : 'LOW',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
    return true
  },
}

/**
 * Metro and airport distance for the project's sector, when the project has no
 * row of its own.
 *
 * Most project-level connectivity rows were a copied template and were removed
 * on 2026-10-05. sector_intelligence still holds a metro station and an airport
 * distance per sector; a value shared by more than two sectors is that same
 * template in another table and is not used.
 */
async function sectorLevelDistances(sector: string | null, city: string | null, asked: string[]): Promise<string> {
  if (!sector) return ''
  const wantMetro = asked.length === 0 || asked.includes('metro')
  const wantAirport = asked.length === 0 || asked.includes('airport')
  if (!wantMetro && !wantAirport) return ''

  const rows = await prisma.sectorIntelligence.findMany({
    where: { sector: { equals: sector, mode: 'insensitive' } },
    select: { city: true, nearest_metro_station: true, metro_distance_km: true, airport_distance_km: true },
  })
  const r = rows.find(x => city && x.city.toLowerCase() === city.toLowerCase()) ?? (rows.length === 1 ? rows[0] : undefined)
  if (!r) return ''

  const parts: string[] = []
  if (wantMetro && r.nearest_metro_station && r.metro_distance_km != null) {
    const shared = await prisma.sectorIntelligence.count({
      where: { nearest_metro_station: r.nearest_metro_station, metro_distance_km: r.metro_distance_km },
    })
    if (shared <= 2) parts.push(`the nearest metro is ${r.nearest_metro_station}, about ${r.metro_distance_km} km away`)
  }
  if (wantAirport && r.airport_distance_km != null) {
    const shared = await prisma.sectorIntelligence.count({ where: { airport_distance_km: r.airport_distance_km } })
    if (shared <= 2) parts.push(`Noida International Airport (Jewar) is about ${r.airport_distance_km} km away`)
  }
  return parts.length ? `From ${sector}, ${parts.join(', and ')}.` : ''
}

/**
 * A web answer we are willing to repeat, or an empty string.
 *
 * The first version printed whatever the search returned, labelled as
 * unverified. Measured on the first live run, asked whether ACE Parkway has a
 * stadium nearby, that produced: "ACE Parkway Sector 150 Noida is a sports
 * venue. It is located near Shivalik Park, Sector 33A, Noida." Three things
 * wrong — it asserts the project IS the landmark, it names a sector 100-plus
 * sectors away from the project's own, and it answers a question nobody asked.
 * A label does not redeem a false statement; a buyer reads the sentence, not
 * the caveat.
 *
 * So the answer has to clear three checks. This is not sanitising prose, it is
 * refusing to relay a claim we can see is wrong.
 */
function usableWebAnswer(raw: string, projectName: string, projectSector: string | null, askedRe: RegExp): string {
  const text = (raw ?? '').trim()
  if (text.length < 25) return ''

  // 1. It must actually be about the thing that was asked.
  if (!askedRe.test(text)) return ''

  // 2. It must not assert that the project is the landmark. The question was
  //    what is NEAR it.
  const head = projectName.split(/\s+/).slice(0, 3).join('\s+')
  if (new RegExp(`${head}[^.]{0,40}\bis\s+an?\b`, 'i').test(text)) return ''

  // 3. Any sector it names must be the project's own. A "nearby" claim
  //    anchored to a different sector is about somewhere else.
  const ownSector = /(\d+[A-Za-z]?)/.exec(projectSector ?? '')?.[1]?.toUpperCase()
  const named = [...text.matchAll(/\bSector\s+(\d+[A-Za-z]?)\b/gi)].map(m => m[1].toUpperCase())
  if (named.length > 0 && (!ownSector || named.some(s => s !== ownSector))) return ''

  return text
}

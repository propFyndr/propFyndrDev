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

/** Landmark kinds a buyer asks about, and how they appear in a row's name. */
const LANDMARKS: Array<[RegExp, string]> = [
  [/\b(stadium|sports\s+city|sports\s+complex|cricket\s+ground|golf\s+course)\b/i, 'sports venue'],
  [/\b(mall|malls|shopping\s+(?:centre|center|complex)|market)\b/i, 'shopping'],
  [/\b(metro|metro\s+station|aqua\s+line|blue\s+line)\b/i, 'metro'],
  [/\b(hospital|hospitals|medical|clinic|healthcare)\b/i, 'hospital'],
  [/\b(school|schools|college|university|creche|daycare)\b/i, 'school'],
  [/\b(airport|jewar|igi)\b/i, 'airport'],
  [/\b(park|parks|biodiversity|golf|green\s+belt)\b/i, 'park'],
  [/\b(temple|mosque|church|gurudwara)\b/i, 'place of worship'],
  [/\b(expressway|highway|fng|dnd|link\s+road)\b/i, 'road'],
  [/\b(office|it\s+park|business\s+park|tech\s+park|corporate)\b/i, 'workplace'],
  [/\b(restaurant|cafe|food\s+court|cinema|multiplex|pvr|theatre)\b/i, 'leisure'],
]

/** Words that make a question about the surroundings rather than the building. */
const PROXIMITY =
  /\b(near|nearby|near\s?by|around|close\s+to|closest|nearest|vicinity|walking\s+distance|how\s+far|distance\s+to|surrounding|next\s+to|adjacent|in\s+the\s+area|kitne\s+door)\b/i

export const vicinityLookupHandler: ChatTopicHandler = {
  id: 'vicinity-lookup',
  description: 'Landmarks and facilities around a project, from our rows or the web',

  matches: ctx =>
    ctx.flags.isCompareRequest !== true &&
    PROXIMITY.test(ctx.message) &&
    LANDMARKS.some(([re]) => re.test(ctx.message)) &&
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

    const asked = LANDMARKS.filter(([re]) => re.test(ctx.message)).map(([, label]) => label)
    const askedRe = new RegExp(
      LANDMARKS.filter(([re]) => re.test(ctx.message)).map(([re]) => re.source).join('|'),
      'i',
    )

    // Our own rows first: a match on the row's name or its type.
    const hits = project.connectivity.filter(
      c => askedRe.test(c.name) || askedRe.test(String(c.type).replace(/_/g, ' ')),
    )

    const km = (d: number | null) => (d == null ? null : d < 1 ? `${Math.round(d * 1000)} m` : `${d} km`)

    let body: string
    let tier: 'verified' | 'missing'

    if (hits.length > 0) {
      tier = 'verified'
      const rows = hits.slice(0, 6).map(c => {
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
      let web = ''
      try {
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

      body =
        `We have not recorded a ${asked.join(' or ')} against ${project.name}, so I can't confirm one from our own data.` +
        (web
          ? `\n\n**From public sources, not our records:** ${web.trim()}\n\nTreat that as unverified — worth confirming on the site visit or with the advisory team.`
          : `\n\nI'd rather say that than guess. The advisory team can check it against the sanctioned layout.`) +
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

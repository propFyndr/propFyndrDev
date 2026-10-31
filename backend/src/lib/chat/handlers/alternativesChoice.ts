import { prisma } from '../../db'
import { matchProjectInText } from '../../discovery/matchProjectInText'
import { cityNamedIn } from '../../discovery/constants'
import { getSectorLocation } from '../../discovery/sectorToCity'
import { UP_STATUTORY, computedQualifier } from '../../factPresentation'
import { projectPriceNotes } from '../../projectPriceNote'
import { summarisePriceNotes, UNDATED_NOTE } from '../../priceVerification'
import { medianOf } from './sectorRateCheck'
import type { ChatTopicHandler } from '../handlerContext'

/**
 * "I have 1.3 crore. Should I take a 2BHK ready to move in Noida or a 3BHK under
 * construction in Greater Noida West?"
 *
 * The hero question of the 31 Oct 2026 benchmark. The search lane read it as one
 * search ("2 or 3 BHK in Greater Noida West up to 1.3 Cr"), dropped the Noida half
 * and never said what the choice costs. Here each side is searched on its own from
 * our rows, shown with its price band, size and possession, and the trade-off is
 * stated without ranking one side above the other: that depends on the buyer's
 * timeline, which we ask for.
 *
 * Nothing is generated: counts, ranges and dates are read from rows, GST rates from
 * the statutory constants. Prices carry the same confirmation note as every other
 * price answer.
 */

type Region = 'noida' | 'greater_noida' | 'greater_noida_west'
export type Side = { bhk: number; status: 'ready' | 'uc' | null; region: Region | null }
export type Alternatives = { a: Side; b: Side; budgetMaxCr: number | null; hinglish: boolean }

const SEPARATOR = /\s+(?:or|vs\.?|versus|ya(?:\s+phir)?)\s+/gi
const DECISION = /\b(?:should\s+i|which|kaun\s*sa|konsa|kya\s+lun|lun\s+ya|better|choose|pick|take|worth|prefer|decide|lena\s+chahiye)\b/i
const READY = /\bready(?:[\s-]*to[\s-]*move)?\b|\brtm\b|\bready\s+possession\b/i
const UNDER_CONSTRUCTION = /under[\s-]*construction|\bu\/c\b|\buc\b|\bnew\s+launch\b|\bpre[\s-]*launch\b/i
const BHK = /\b([1-5])\s*[- ]?\s*bhk\b/i
const BUDGET = /(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(cr(?:ore)?s?|l(?:akh|ac|akhs|acs)?)\b/i
const HINGLISH_WORDS = ['mere', 'mera', 'meri', 'paas', 'hai', 'hain', 'mein', 'lun', 'kaun', 'konsa', 'kya', 'chahiye', 'lena', 'aapko', 'nahi', 'karna', 'ya']

const REGION_OF_CITY: Record<string, Region> = {
  'Noida': 'noida',
  'Greater Noida': 'greater_noida',
  'Greater Noida West': 'greater_noida_west',
}

export function looksHinglish(message: string): boolean {
  const words = new Set((message.toLowerCase().match(/[a-z]+/g) ?? []))
  return HINGLISH_WORDS.filter(w => words.has(w)).length >= 2
}

function parseSide(text: string): { bhk: number; status: Side['status']; region: Region | null } | null {
  const m = BHK.exec(text)
  if (!m) return null
  const ready = READY.test(text)
  const uc = UNDER_CONSTRUCTION.test(text)
  if (ready && uc) return null
  const city = cityNamedIn(text)
  return { bhk: Number(m[1]), status: ready ? 'ready' : uc ? 'uc' : null, region: city ? REGION_OF_CITY[city] ?? null : null }
}

/** Two alternatives, each with its own BHK, differing in BHK, status or place. */
export function parseAlternatives(message: string): Alternatives | null {
  if (!DECISION.test(message)) return null
  for (const sep of message.matchAll(SEPARATOR)) {
    const at = sep.index as number
    const a = parseSide(message.slice(0, at))
    const b = parseSide(message.slice(at + sep[0].length))
    if (!a || !b) continue
    const shared = a.region === null && b.region === null ? (() => { const c = cityNamedIn(message); return c ? REGION_OF_CITY[c] ?? null : null })() : null
    const sideA: Side = { ...a, region: a.region ?? shared }
    const sideB: Side = { ...b, region: b.region ?? shared }
    if (sideA.bhk === sideB.bhk && sideA.status === sideB.status && sideA.region === sideB.region) continue
    const bm = BUDGET.exec(message)
    const budget = bm ? (/^l/i.test(bm[2]) ? Number(bm[1]) / 100 : Number(bm[1])) : null
    return { a: sideA, b: sideB, budgetMaxCr: budget && budget > 0 && budget < 100 ? budget : null, hinglish: looksHinglish(message) }
  }
  return null
}

const inCr = (n: number) => (n >= 1 ? `₹${n.toFixed(2).replace(/\.?0+$/, '')} Cr` : `₹${Math.round(n * 100)} L`)
const REGION_LABEL: Record<Region, string> = { noida: 'Noida', greater_noida: 'Greater Noida', greater_noida_west: 'Greater Noida West' }
const monthYear = (d: Date) => d.toLocaleString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' })

type SideRow = {
  id: string
  name: string
  sector: string
  city: string | null
  status: string
  possession_date: Date | null
  unit_types: { price_min_cr: number | null; super_area_sqft: number | null }[]
}

export type SideSummary = {
  side: Side
  projects: { id: string; name: string; sector: string; fromCr: number; possession: Date | null }[]
  loCr: number | null
  hiCr: number | null
  medianArea: number | null
  areaUnits: number
  undated: number
}

/** Pure: rows already filtered to the side's status and BHK; the region and budget are applied here. */
export function summariseSide(rows: SideRow[], side: Side, budgetMaxCr: number | null): SideSummary {
  const projects: SideSummary['projects'] = []
  const prices: number[] = []
  const areas: number[] = []
  for (const r of rows) {
    if (side.region) {
      const loc = getSectorLocation(r.sector, r.city)
      if (!loc || loc.region !== side.region) continue
    }
    const units = r.unit_types.filter(u => typeof u.price_min_cr === 'number' && u.price_min_cr > 0 && (budgetMaxCr === null || (u.price_min_cr as number) <= budgetMaxCr))
    if (!units.length) continue
    const fromCr = Math.min(...units.map(u => u.price_min_cr as number))
    projects.push({ id: r.id, name: r.name, sector: r.sector, fromCr, possession: r.possession_date })
    prices.push(...units.map(u => u.price_min_cr as number))
    areas.push(...units.map(u => u.super_area_sqft).filter((x): x is number => typeof x === 'number' && x > 0))
  }
  projects.sort((x, y) => x.fromCr - y.fromCr || x.name.localeCompare(y.name))
  return {
    side,
    projects,
    loCr: prices.length ? Math.min(...prices) : null,
    hiCr: prices.length ? Math.max(...prices) : null,
    medianArea: areas.length ? Math.round(medianOf(areas)) : null,
    areaUnits: areas.length,
    undated: projects.filter(p => !p.possession).length,
  }
}

const sideTitle = (s: Side) => {
  const status = s.status === 'ready' ? 'ready to move' : s.status === 'uc' ? 'under construction' : ''
  const where = s.region ? REGION_LABEL[s.region] : 'Noida and Greater Noida'
  return `${s.bhk} BHK${status ? `, ${status}` : ''}, ${where}`
}

function sideBlock(sum: SideSummary, budgetMaxCr: number | null, hi: boolean): string {
  const head = `**${sideTitle(sum.side)}**`
  if (!sum.projects.length) {
    return hi
      ? `${head}\nKoi project nahi mila${budgetMaxCr ? ` ${inCr(budgetMaxCr)} tak` : ''} jo hamare rows mein is combination se match kare.`
      : `${head}\nWe hold no project that matches this${budgetMaxCr ? ` at or under ${inCr(budgetMaxCr)}` : ''}.`
  }
  const n = sum.projects.length
  const range = sum.loCr !== null && sum.hiCr !== null ? (sum.loCr === sum.hiCr ? inCr(sum.loCr) : `${inCr(sum.loCr)} to ${inCr(sum.hiCr)}`) : ''
  const size = sum.medianArea ? `, typical super area about ${sum.medianArea.toLocaleString('en-IN')} sq ft (${sum.areaUnits} units)` : ''
  const dates = sum.side.status === 'uc'
    ? (() => {
        const now = Date.now()
        const all = sum.projects.map(p => p.possession).filter((d): d is Date => d instanceof Date)
        const ds = all.filter(d => d.getTime() >= now).sort((x, y) => x.getTime() - y.getTime())
        const passed = all.length - ds.length
        const span = ds.length ? `${monthYear(ds[0])} to ${monthYear(ds[ds.length - 1])}` : null
        const parts = [
          span ? `${hi ? 'recorded possession' : 'recorded possession'} ${span}` : null,
          passed ? (hi ? `${passed} ki recorded date nikal chuki hai` : `${passed} with a recorded date already passed`) : null,
          sum.undated ? (hi ? `${sum.undated} ki date record mein nahi` : `${sum.undated} with no date on record`) : null,
        ].filter(Boolean)
        return parts.length ? `; ${parts.join(', ')}` : ''
      })()
    : ''
  const list = sum.projects.slice(0, 3).map(p => `- **${p.name}**, ${p.sector}: from ${inCr(p.fromCr)}`).join('\n')
  const count = hi ? `${n} project${n === 1 ? '' : 's'} hamare rows mein` : `${n} project${n === 1 ? '' : 's'} in our rows`
  return `${head}\n${count}, ${range}${size}${dates}.\n${list}`
}

export const alternativesChoiceHandler: ChatTopicHandler = {
  id: 'alternatives_choice',
  description: 'A buyer choosing between two configurations, statuses or places: each side from our rows, the trade-off, no verdict',

  matches: ctx => parseAlternatives(ctx.message) !== null && matchProjectInText(ctx.message, ctx.catalog) === null,

  handle: async ctx => {
    const alt = parseAlternatives(ctx.message) as Alternatives
    const hi = alt.hinglish
    const rowsFor = (s: Side) =>
      prisma.project.findMany({
        where: {
          archived_duplicate_of: null,
          ...(s.status === 'ready' ? { status: 'ready_to_move' as const } : s.status === 'uc' ? { status: { in: ['under_construction' as const, 'new_launch' as const] } } : {}),
          unit_types: { some: { bhk: s.bhk } },
        },
        select: {
          id: true, name: true, sector: true, city: true, status: true, possession_date: true,
          unit_types: { where: { bhk: s.bhk }, select: { price_min_cr: true, super_area_sqft: true } },
        },
      })
    const [rowsA, rowsB] = await Promise.all([rowsFor(alt.a), rowsFor(alt.b)])
    const A = summariseSide(rowsA as SideRow[], alt.a, alt.budgetMaxCr)
    const B = summariseSide(rowsB as SideRow[], alt.b, alt.budgetMaxCr)
    const ids = [...A.projects, ...B.projects].map(p => p.id)
    const note = ids.length ? summarisePriceNotes([...(await projectPriceNotes(ids)).values()]) ?? UNDATED_NOTE : null
    const n = A.projects.length + B.projects.length
    const budgetTxt = alt.budgetMaxCr ? inCr(alt.budgetMaxCr) : null

    const gstUc = UP_STATUTORY.gstUnderConstructionPct
    const gstReady = UP_STATUTORY.gstReadyToMovePct
    const ucSide = [A, B].find(s => s.side.status === 'uc')
    const readySide = [A, B].find(s => s.side.status === 'ready')

    const tradeoff: string[] = []
    if (readySide && ucSide) {
      tradeoff.push(
        hi
          ? `- **Ready flat:** aap flat dekh sakte hain, us tower ka OC aur registry status pooch sakte hain, aur wait nahi karna. GST ${gstReady}% (OC ke saath).`
          : `- **Ready flat:** you can see the exact flat, ask for its tower's OC and registry status, and move in without a wait. GST is ${gstReady}% with an OC.`,
        hi
          ? `- **Under construction:** wait karna padega, aur date tab tak promise hai jab tak RERA mein progress na dikhe. GST ${gstUc}% lagta hai. Rent aur EMI ek saath chal sakte hain.`
          : `- **Under construction:** you wait, and the date is a promise until RERA progress reports show it. GST is ${gstUc}%. If you rent meanwhile, rent and EMI overlap.`,
      )
    }
    if (A.medianArea && B.medianArea && A.side.bhk !== B.side.bhk) {
      tradeoff.push(hi
        ? `- **Size:** in rows mein typical super area ${A.side.bhk} BHK ke liye lagbhag ${A.medianArea.toLocaleString('en-IN')} sq ft aur ${B.side.bhk} BHK ke liye lagbhag ${B.medianArea.toLocaleString('en-IN')} sq ft hai.`
        : `- **Size:** typical super area in these rows is about ${A.medianArea.toLocaleString('en-IN')} sq ft for ${A.side.bhk} BHK against ${B.medianArea.toLocaleString('en-IN')} sq ft for ${B.side.bhk} BHK.`)
    }

    const lines: string[] = [
      hi ? `### ${sideTitle(alt.a)} ya ${sideTitle(alt.b)}` : `### ${sideTitle(alt.a)} or ${sideTitle(alt.b)}`,
      '',
      sideBlock(A, alt.budgetMaxCr, hi),
      '',
      sideBlock(B, alt.budgetMaxCr, hi),
      '',
      `*${hi ? 'Rates hamare rows se' : 'From our rows'}, ${computedQualifier(n)}${budgetTxt ? `, ${hi ? 'budget' : 'at or under'} ${budgetTxt}` : ''}. ${hi ? 'Price' : 'Prices'}: ${note ?? UNDATED_NOTE}.*`,
    ]
    if (tradeoff.length) lines.push('', hi ? '**Trade-off**' : '**What each choice costs**', ...tradeoff)
    lines.push(
      '',
      hi
        ? `Main kisi ek ko upar rank nahi kar raha: yeh aapki timeline par depend karta hai. Aapko kitne time mein shift karna hai, aur ${budgetTxt ?? 'budget'} total hai ya sirf flat ki price?`
        : `I'm not ranking one above the other: that depends on your timeline. How soon do you need to move in, and is ${budgetTxt ?? 'your budget'} the total or just the flat price?`,
    )

    const chipFor = (s: SideSummary, id: string) => ({
      id: `chip_alt_${id}_${Date.now()}`,
      actionType: 'TEXT_MESSAGE',
      label: `${s.side.bhk} BHK${s.side.status === 'ready' ? ' ready' : s.side.status === 'uc' ? ' under construction' : ''}${s.side.region ? ` · ${REGION_LABEL[s.side.region]}` : ''}`,
      icon: 'building',
      analyticsId: `chip_alt_${id}`,
      priority: 1,
      payload: { text: `Show me ${sideTitle(s.side)}${budgetTxt ? ` under ${budgetTxt}` : ''}` },
    })

    ctx.send('token', { token: lines.join('\n') })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'Comparing the two options from our rows:',
      chips: [chipFor(A, 'a'), chipFor(B, 'b')],
      missingFields: [],
      confidence: 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}

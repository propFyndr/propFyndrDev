// backend/src/lib/ai/projectFactChecks.ts
//
// Checks an answer against the project it is talking about, not the whole prompt.
//
// `verifyPriceProvenance` lets a figure through when it appears anywhere in a
// ~33k-character prompt, so a price from one project could be quoted for
// another and a status could be contradicted outright. Measured in the stress
// run of 16 Oct 2026:
//   - "5% GST applies (under-construction status)" for Logix Blossom County,
//     whose row says Ready to Move with OC obtained;
//   - "No verified municipal water supply" for the same project, whose row
//     says Ganga Water Pipeline;
//   - "Valid until December 2031" for a RERA registration whose validity is
//     not on record (month-level dates were never checked).

import type { IntegrityViolation } from './answerIntegrity'

export interface PromptProject {
  name: string
  numbers: number[]
  facts: Record<string, unknown>
}

/** Every project object the prompt carries: `{"id":"…",…,"name":"…",…}`. */
export function promptProjects(prompt: string): PromptProject[] {
  const out: PromptProject[] = []
  const seen = new Set<string>()
  const opener = /\{"id":"[^"]+",(?:"slug":"[^"]*",)?"name":"/g
  for (const m of prompt.matchAll(opener)) {
    const start = m.index ?? 0
    const end = matchingBrace(prompt, start)
    if (end < 0) continue
    const raw = prompt.slice(start, end + 1)
    let facts: Record<string, unknown>
    try {
      facts = JSON.parse(raw)
    } catch {
      continue
    }
    const name = typeof facts.name === 'string' ? facts.name : ''
    if (!name || seen.has(`${name}|${start}`)) continue
    seen.add(`${name}|${start}`)
    out.push({ name, facts, numbers: (raw.match(/\d+(?:\.\d+)?/g) ?? []).map(Number) })
  }
  return out
}

function matchingBrace(s: string, start: number): number {
  let depth = 0
  let inString = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return i
  }
  return -1
}

// Ends at . ! ? followed by a space or the end, so "₹1.85 Cr" stays one sentence.
const sentences = (text: string) => text.split(/(?<=[.!?])\s+|\n+/).filter(Boolean)
const MONEY = /₹\s*(\d+(?:\.\d+)?)\s*(Cr|Crore|crores?|cr\b|Lakh|Lakhs|lakh|lakhs|Lac|Lacs|lac\b|L\b)/gi

const near = (a: number, b: number) => Math.abs(a - b) < 0.011

/**
 * A rupee figure written beside one project's name that belongs only to
 * another project in the prompt. A figure found nowhere is left to
 * `verifyPriceProvenance`; this catches the swap that check cannot see.
 */
export function crossProjectFigures(text: string, prompt: string, userMessage = ''): IntegrityViolation[] {
  const projects = promptProjects(prompt)
  if (projects.length < 2) return []
  const userNumbers = (userMessage.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
  const out: IntegrityViolation[] = []
  for (const sentence of sentences(text)) {
    const lower = sentence.toLowerCase()
    const mentioned = projects.filter((p) => lower.includes(p.name.toLowerCase()))
    if (mentioned.length === 0) continue
    for (const m of sentence.matchAll(MONEY)) {
      const v = Number(m[1])
      const cr = /^l/i.test(m[2]) ? v / 100 : v
      const own = mentioned.some((p) => p.numbers.some((n) => near(n, cr) || near(n, v)))
      if (own || userNumbers.some((n) => near(n, v))) continue
      const owner = projects.find((p) => !mentioned.includes(p) && p.numbers.some((n) => near(n, cr) || near(n, v)))
      if (owner) {
        out.push({
          kind: 'fabrication',
          detail: `quoted "${m[0].trim()}" for ${mentioned.map((p) => p.name).join(' / ')}, but that figure is ${owner.name}'s, not theirs`,
        })
      }
    }
  }
  return out
}

const READY = /^(?:ready to move|ready_to_move)$/i
const field = (facts: Record<string, unknown>, key: string) => {
  const v = facts[key]
  return v == null ? '' : String(v)
}

/** Claims that contradict the row of the project the sentence is about. */
const CONTRADICTIONS: Array<{
  says: RegExp
  when: (f: Record<string, unknown>) => boolean
  record: (f: Record<string, unknown>) => string
}> = [
  {
    // "5% GST applies to under-construction flats" is the rule, not a claim about this project.
    says: /\b5\s*%\s*GST\s+(?:applies|is\s+payable|will\s+apply)(?!\s+(?:to|on|for)\s+(?:an?\s+|all\s+)?under[- ]construction)|\(under[- ]construction(?:\s+status)?\)|\bis\s+(?:still\s+)?under[- ]construction\b/i,
    when: (f) => READY.test(field(f, 'status')),
    record: () => 'the project is ready to move',
  },
  {
    // "Without an OC, a flat is not occupiable" is the rule; these say the project lacks one.
    says: /\b(?:hold\s+no|has\s+no|have\s+no|there\s+is\s+no|not\s+(?:yet\s+)?(?:received|granted|obtained|been\s+granted))\s+(?:an?\s+)?(?:occupancy\s+certificate|OC)\b|\bno\s+(?:occupancy\s+certificate|OC)\s+(?:on\s+record|yet|has\s+been)\b|\bOC\s+(?:is\s+)?(?:not\s+(?:yet\s+)?(?:granted|received|issued)|pending|awaited)\b/i,
    when: (f) => /^(?:obtained|true|yes|granted)$/i.test(field(f, 'oc_obtained')),
    record: () => 'the Occupancy Certificate is on record as obtained',
  },
  {
    says: /\bno\s+(?:verified\s+)?(?:municipal\s+|authority\s+)?water\s+supply\b|\bborewell\s+dependency\b/i,
    when: (f) => field(f, 'water_source') !== '' && !/not available|unknown/i.test(field(f, 'water_source')),
    record: (f) => `the water source on record is "${field(f, 'water_source')}"`,
  },
  {
    says: /\b(?:no|zero|clean)\s+(?:recorded\s+)?litigation|\blitigation[- ]free\b/i,
    when: (f) => Number(field(f, 'litigation_count')) > 0,
    record: (f) => `${field(f, 'litigation_count')} litigation record(s) are on file`,
  },
  {
    // "has an OC and Amitabh Kant registry clearance, so registry is possible"
    // for Logix Blossom County, whose amitabh_kant_clearance is empty (stress
    // re-run, 16 Oct 2026). A clearance is said only when the row holds one.
    says: /\bamitabh\s+kant\b[^.]{0,40}\b(?:clearance|cleared|approved|relief)\b|\bregistry\s+(?:is\s+)?(?:possible|happening|open|cleared|going\s+on)\b/i,
    when: (f) => !/^(?:true|yes|cleared|obtained|granted)$/i.test(field(f, 'amitabh_kant_clearance')),
    record: () => 'no Amitabh Kant clearance or registry status is on record',
  },
  {
    says: /\b(?:not|isn'?t)\s+(?:RERA[- ])?registered\b|\bno\s+RERA\s+(?:number|registration)\b/i,
    when: (f) => /^UPRERA/i.test(field(f, 'rera_number')),
    record: (f) => `RERA ${field(f, 'rera_number')} is on record`,
  },
]

export function recordContradictions(text: string, prompt: string): IntegrityViolation[] {
  const projects = promptProjects(prompt)
  if (projects.length === 0) return []
  const out: IntegrityViolation[] = []
  for (const sentence of sentences(text)) {
    const lower = sentence.toLowerCase()
    const named = projects.filter((p) => lower.includes(p.name.toLowerCase()))
    // With one project in the prompt, an unnamed sentence is about it.
    const subjects = named.length ? named : projects.length === 1 ? projects : []
    for (const p of subjects) {
      for (const c of CONTRADICTIONS) {
        if (c.says.test(sentence) && c.when(p.facts)) {
          out.push({ kind: 'fabrication', detail: `said "${sentence.trim().slice(0, 90)}" about ${p.name}, but ${c.record(p.facts)}` })
        }
      }
    }
  }
  return out
}

const MONTH = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*'
const MONTH_NUM: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' }
const MONTH_YEAR = new RegExp(`(?<!\\d\\s)(?<!\\d)\\b${MONTH},?\\s+(\\d{4})\\b`, 'gi')
const QUARTER = /\bQ([1-4])\s*(?:FY\s*)?(\d{4})\b/gi
const VALIDITY_YEAR = /\b(?:valid\s+(?:until|till|up\s*to|through)|expir\w*\s+(?:in|on|by)?|lapses?\s+(?:in|on)?)\s+(?:\w+\s+)?(\d{4})\b/gi

/** Month, quarter and validity-year dates the prompt or the buyer supplied. */
function knownPeriods(source: string): Set<string> {
  const out = new Set<string>()
  for (const m of source.matchAll(/(\d{4})-(\d{2})-\d{2}/g)) {
    out.add(`${m[1]}-${m[2]}`)
    out.add(`${m[1]}-Q${Math.ceil(Number(m[2]) / 3)}`)
    out.add(m[1])
  }
  for (const m of source.matchAll(MONTH_YEAR)) {
    const mm = MONTH_NUM[m[1].toLowerCase()]
    out.add(`${m[2]}-${mm}`)
    out.add(`${m[2]}-Q${Math.ceil(Number(mm) / 3)}`)
    out.add(m[2])
  }
  for (const m of source.matchAll(QUARTER)) {
    out.add(`${m[2]}-Q${m[1]}`)
    out.add(m[2])
  }
  for (const m of source.matchAll(/\b(19|20)\d{2}\b/g)) out.add(m[0])
  return out
}

/**
 * "December 2031", "Q4 2027", "valid until 2031": dates at month, quarter or
 * validity-year level that neither the prompt nor the buyer gave. The day-level
 * check in answerIntegrity.ts let these through.
 */
export function unsourcedPeriods(text: string, prompt: string, userMessage = '', now = new Date()): IntegrityViolation[] {
  const known = knownPeriods(`${prompt} ${userMessage}`)
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  known.add(thisMonth)
  known.add(String(now.getFullYear()))
  const out: IntegrityViolation[] = []
  for (const m of text.matchAll(MONTH_YEAR)) {
    const key = `${m[2]}-${MONTH_NUM[m[1].toLowerCase()]}`
    if (!known.has(key)) out.push({ kind: 'unsourced_date', detail: `stated "${m[0]}", which the prompt never supplied` })
  }
  for (const m of text.matchAll(QUARTER)) {
    if (!known.has(`${m[2]}-Q${m[1]}`)) out.push({ kind: 'unsourced_date', detail: `stated "${m[0]}", which the prompt never supplied` })
  }
  for (const m of text.matchAll(VALIDITY_YEAR)) {
    if (!known.has(m[1])) out.push({ kind: 'unsourced_date', detail: `stated a validity of "${m[0]}", which the prompt never supplied` })
  }
  return out
}

/**
 * Growth or appreciation rates nobody supplied.
 *
 * "Noida's property prices have historically appreciated at 5–7% annually …
 * 8–12% in emerging areas" (stress run, 16 Oct 2026) passed every check: 5, 7,
 * 8 and 12 are on the statutory allow-list. CLAUDE.md is explicit that we hold
 * no unsourced market statistics, so a rate the prompt does not carry is not
 * labelled, it is removed: the retry is told to answer without it.
 */
const GROWTH_RATE = new RegExp(
  [
    String.raw`\b\d+(?:\.\d+)?(?:\s*(?:%\s*)?(?:to|[–—-])\s*\d+(?:\.\d+)?)?\s*%\s*(?:a|per|each|every)?\s*(?:year|annum|annually|yearly|p\.?\s?a\.?)\b`,
    // "growth rate (CAGR) of 6-8%" (G7 check run, 17 Oct 2026).
    String.raw`\b(?:apprecia\w*|grew|grown|growth|rose|risen|increased|returns?|cagr)\b(?:\s*\([^)]{0,20}\))?\s+(?:(?:of|at|by|around|about|a|an|rates?)\s*(?:\([^)]{0,20}\)\s*)?){0,3}\d+(?:\.\d+)?(?:\s*(?:%\s*)?(?:to|[–—-])\s*\d+(?:\.\d+)?)?\s*%`,
    // "a 5-7% CAGR", "a 60-70% appreciation" (stress run 2, 16 Oct 2026).
    String.raw`\b\d+(?:\.\d+)?(?:\s*(?:%\s*)?(?:to|[–—-])\s*\d+(?:\.\d+)?)?\s*%\s*(?:cagr|apprecia\w*|growth|returns?|price\s+rise)\b`,
  ].join('|'),
  'gi',
)

export function unsourcedMarketStatistics(text: string, prompt: string): IntegrityViolation[] {
  const out: IntegrityViolation[] = []
  // Bold markers split "**5-7% CAGR**" from the words around it.
  for (const m of text.replace(/\*\*/g, '').matchAll(GROWTH_RATE)) {
    const digits = m[0].match(/\d+(?:\.\d+)?/g) ?? []
    // Ours only when the prompt states each number AS a growth rate. A bare
    // digit is not enough: 5 and 7 are in every prompt (GST, stamp duty), and
    // "averaged 5%–7% annually" walked through on exactly that (stress re-run).
    const asRate = (d: string) => {
      const n = d.replace('.', '\\.')
      return new RegExp(String.raw`(?<![\d.])${n}\s*%[^.\n]{0,40}(?:apprecia|growth|grew|cagr|annual|a\s+year|per\s+year|p\.?a)|(?:apprecia|growth|grew|cagr)[^.\n]{0,40}(?<![\d.])${n}(?![\d])`, 'i').test(prompt)
    }
    if (digits.length && digits.every(asRate)) continue
    out.push({ kind: 'fabrication', detail: `stated the market statistic "${m[0].trim()}", which no source in the prompt supports; answer without it` })
  }
  return out
}

/**
 * Sentences carrying a distance, travel time, floor area or land area that
 * nothing we supplied supports are dropped, the rest of the answer kept.
 *
 * Live transcript rerun 4 (17 Oct 2026): "ATS Dolce… about 44 km, roughly 44
 * minutes", "carpet areas between 590 and 690 sqft", "hospitals within a
 * 15-minute radius", "5–7% UP stamp duty". Price checks never looked at these
 * units. Dropping the sentence rather than discarding the answer keeps a model
 * slip from becoming the outage notice; the figure still never reaches the buyer.
 */
const MEASURE = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?))?\s*(?:km|kms|kilomet\w*|min(?:ute)?s?\b|sq\.?\s*ft|sqft|square\s+feet|acres?)\b/gi
const STAMP_DUTY_RATE = /stamp\s+duty[^.%\n]{0,40}?(\d+(?:\.\d+)?)\s*%(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*%)?|(\d+(?:\.\d+)?)\s*%?\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*%\s*(?:up\s+)?stamp\s+duty/gi

export function dropUnsourcedMeasurements(text: string, reference: string): { text: string; dropped: string[] } {
  const known = [...(reference ?? '').matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
  const supported = (raw: string) => {
    const v = Number(raw.replace(',', '.'))
    return known.some((k) => Math.abs(k - v) <= Math.max(0.6, v * 0.05))
  }
  const statutory = new Set([7, 6])
  const dropped: string[] = []
  const kept = splitClauses(text).filter((part) => {
    if (/^\s+$/.test(part)) return true
    const measures = [...part.matchAll(MEASURE)].flatMap((m) => [m[1], m[2]].filter(Boolean) as string[])
    const badMeasure = measures.some((n) => !supported(n))
    const rates = [...part.matchAll(STAMP_DUTY_RATE)].flatMap((m) => [m[1], m[2], m[3], m[4]].filter(Boolean).map(Number))
    const badStamp = rates.some((r) => !statutory.has(r))
    if (badMeasure || badStamp) { dropped.push(part.trim()); return false }
    return true
  })
  return { text: kept.join('').replace(/([.!?]) {2,}/g, '$1 ').replace(/\n{3,}/g, '\n\n').trim(), dropped }
}

/**
 * Judgements about a project that no row supports: maintenance, residents, build
 * quality, renovation, vintage, reputation, density. Live transcript rerun 4
 * (17 Oct 2026): "societies like Aditya Urban Casa… have more settled maintenance
 * committees and active resident welfare compared to older phases like Antriksh",
 * "its older delivery vintage requires factoring in… renovation costs". A judgement
 * stays only when the words for it are in what we supplied; otherwise the
 * sentence is dropped like an unsourced figure.
 */
const UNSOURCED_JUDGEMENT = [
  /\b(?:well|better|poorly|badly)[-\s]maintained\b/i,
  /\b(?:settled|active|strong|engaged|responsive)\s+(?:maintenance|resident|rwa|community|society|welfare)\w*/i,
  /\bresidents?\s+(?:are|feel|report|say|love|complain|praise)\b/i,
  /\b(?:superior|excellent|premium|poor|good|great|solid|high)[-\s](?:build|construction)(?:\s+quality)?\b/i,
  /\b(?:build|construction)\s+quality\s+(?:is|are|remains)\b/i,
  /\brenovation\b/i,
  /\bolder\s+(?:\w+\s+){0,2}(?:vintage|phases?|societies|towers|construction)\b/i,
  // Construction method and layout quality are claims about the build, not rows.
  /\bmivan\b/i,
  /\bcompact\s+(?:room|layout|bedroom)s?\b|\b(?:spacious|cramped|efficient)\s+(?:room|layout|floor\s+plan)s?\b/i,
  /\b(?:trusted|reputed|reliable|renowned|well-known)\s+(?:builder|developer|brand)\b/i,
  /\bknown\s+for\b/i,
]

export function dropUnsourcedJudgements(text: string, reference: string): { text: string; dropped: string[] } {
  const ref = (reference ?? '').toLowerCase()
  const dropped: string[] = []
  const kept = splitClauses(text).filter((part) => {
    if (/^\s+$/.test(part)) return true
    const hit = UNSOURCED_JUDGEMENT.map((re) => re.exec(part)?.[0]).find((m): m is string => Boolean(m))
    if (hit && !ref.includes(hit.toLowerCase())) { dropped.push(part.trim()); return false }
    return true
  })
  return { text: kept.join('').replace(/([.!?]) {2,}/g, '$1 ').replace(/\n{3,}/g, '\n\n').trim(), dropped }
}

/**
 * Sentences, and lines. A list item has no full stop of its own, so splitting at
 * ".!?" alone made a header and every bullet under it one "sentence": one bad
 * figure dropped correct lines with it and left fragments (transcript rerun 7,
 * 17 Oct 2026). Separators are kept so the text rejoins exactly.
 */
export function splitClauses(text: string): string[] {
  return text.split(/((?<=[.!?])[ \t]+|\n+)/)
}

/**
 * Model output that is broken, not wrong: a long run of digits, a rupee sign
 * with its number missing, or our own prompt's section labels. Live rerun 7
 * (17 Oct 2026), after five hand-offs down to the weakest legs: "₹ L–₹. Cr for
 * BHK" with the digits emitted as "9511926295119…" ahead of the list, and
 * "## MATCHED PROJECTS IN our verified data (GROUND TRUTH - CITE UNIT
 * CONFIGURATION PRICES ONLY)". Such a line never reaches the buyer.
 */
const GARBLED = /\d{14,}|₹\s*(?:L|Cr|lakh|crore)\b|₹\s*\.\s*\d*\s*(?:L|Cr)\b|₹\s*[–-]|\bfor\s{2,}BHK\b|MATCHED PROJECTS|GROUND TRUTH|CITE UNIT CONFIGURATION|PROMPT FACTS|SYSTEM PROMPT/i

export function dropGarbled(text: string): { text: string; dropped: string[] } {
  const dropped: string[] = []
  const kept = splitClauses(text).filter((part) => {
    if (/^\s+$/.test(part) || !GARBLED.test(part)) return true
    dropped.push(part.trim())
    return false
  })
  return { text: kept.join('').replace(/([.!?]) {2,}/g, '$1 ').replace(/\n{3,}/g, '\n\n').trim(), dropped }
}

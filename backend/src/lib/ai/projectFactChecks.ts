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
    String.raw`\b(?:apprecia\w*|grew|grown|growth|rose|risen|increased|returns?|cagr)\s+(?:of\s+|at\s+|by\s+|around\s+|about\s+){0,2}\d+(?:\.\d+)?(?:\s*(?:%\s*)?(?:to|[–—-])\s*\d+(?:\.\d+)?)?\s*%`,
  ].join('|'),
  'gi',
)

export function unsourcedMarketStatistics(text: string, prompt: string): IntegrityViolation[] {
  const out: IntegrityViolation[] = []
  for (const m of text.matchAll(GROWTH_RATE)) {
    const digits = m[0].match(/\d+(?:\.\d+)?/g) ?? []
    // Ours when every number in the claim is in the prompt (a computed CAGR from our price history).
    if (digits.length && digits.every((d) => new RegExp(String.raw`(?<![\d.])${d.replace('.', '\.')}(?![\d])`).test(prompt))) continue
    out.push({ kind: 'fabrication', detail: `stated the market statistic "${m[0].trim()}", which no source in the prompt supports; answer without it` })
  }
  return out
}

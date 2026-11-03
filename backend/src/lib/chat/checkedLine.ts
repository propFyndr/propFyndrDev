// backend/src/lib/chat/checkedLine.ts
//
// The "what I checked" line under an answer: which kinds of source the answer
// rests on, in our own fact-tier words (CLAUDE.md § Fact Tiers). Built in code
// from the text the buyer actually received, never by a model, and it names no
// outside site except an official public-record host, which the answer itself
// already states with its date.
//
// It describes the answer; it does not add a claim. A label appears only when
// the answer carries the matching marker: a catalogue project's name or cards
// for "RealtyAsk records", a statutory levy for "UP law", the qualifier strings
// for computed, market and public-record figures, "not on record" for gaps.

import { MARKET_QUALIFIER } from '../factPresentation'
// "date of last confirmation not on record" is a freshness note on a price we do hold, not a gap.
import { UNDATED_NOTE } from '../priceVerification'

const LEVIES: Array<[RegExp, string]> = [
  [/\bstamp\s+duty\b/i, 'stamp duty'],
  [/\bregistration\s+(?:fee|charges?)\b|\bregistration\s*\(\s*1\s*%\s*\)/i, 'registration'],
  [/\bGST\b/, 'GST'],
  [/\bTDS\b/, 'TDS'],
]

/** "| OC status | Not on record |" or "The OC date is not on record". */
const MISSING_ROW = /^\|\s*([^|\n]{2,40}?)\s*\|[^\n]*\bnot on record\b/gim
const MISSING_SENTENCE = /\b(?:the\s+)?([a-z][a-z /-]{2,30}?)\s+(?:is|are)\s+not\s+on\s+record\b/gi

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function checkedSources(text: string, opts: { cardsShown: number; names: readonly string[] }): string[] {
  if (!text.trim()) return []
  const out: string[] = []

  const named = [...opts.names]
    .filter((n) => n.length >= 4)
    .sort((a, b) => b.length - a.length)
    .filter((n) => new RegExp(`\\b${escape(n)}\\b`, 'i').test(text))
  // Longest first, so "Gaur City 2 - 14th Avenue" is not also counted as "Gaur City".
  const projects = named.filter((n, i) => !named.slice(0, i).some((longer) => longer.toLowerCase().includes(n.toLowerCase())))
  if (projects.length) {
    const shown = projects.slice(0, 3).join(', ')
    out.push(`RealtyAsk records: ${shown}${projects.length > 3 ? ` and ${projects.length - 3} more` : ''}`)
  } else if (opts.cardsShown > 0) {
    out.push('RealtyAsk records for the projects shown')
  }

  const levies = LEVIES.filter(([re]) => re.test(text)).map(([, label]) => label)
  if (levies.length) out.push(`UP law: ${levies.join(', ')}`)

  const computed = /computed over (\d+) projects? we hold/i.exec(text)
  if (computed) out.push(`Arithmetic over ${computed[1]} project${computed[1] === '1' ? '' : 's'} we hold`)

  const record = /public record from ([a-z0-9.-]+), read on ([^;\n]+)/i.exec(text)
  if (record) out.push(`Official public record: ${record[1]}, read ${record[2].trim()}`)
  else if (/\bwe read up-?rera'?s registry\b/i.test(text)) out.push('UP-RERA registry, with the date given above')

  if (text.includes(MARKET_QUALIFIER)) out.push('Noida-wide figures, not verified for this project')

  const dated = text.split(UNDATED_NOTE).join('')
  const gaps = new Set<string>()
  for (const m of dated.matchAll(MISSING_ROW)) gaps.add(m[1].replace(/\*+/g, '').trim())
  for (const m of dated.matchAll(MISSING_SENTENCE)) gaps.add(m[1].trim())
  if (gaps.size) {
    const list = [...gaps].slice(0, 4)
    out.push(`Not on record: ${list.join(', ')}${gaps.size > 4 ? ` and ${gaps.size - 4} more` : ''}`)
  } else if (/\bnot on record\b/i.test(dated)) {
    out.push('Some details are not on record')
  }

  return out
}

/**
 * Follows the text the buyer sees, including `replace: true` (an outage notice
 * replaced by the answer, or a leg's partial text replaced by the next leg's).
 */
export function createCheckedTracker(turn: () => { cardsShown: number; names: readonly string[] }) {
  let text = ''
  let own: string[] | null = null
  const labels = () => own ?? checkedSources(text, turn())
  return {
    onToken(token: string, replace: boolean) {
      if (replace) text = ''
      if (text.length < 12_000) text += token
    },
    /** The `done` payload with `checked` added, unless the lane set its own (which is then also what is stored). */
    attach(data: Record<string, unknown>): Record<string, unknown> {
      if (Array.isArray(data.checked)) { own = data.checked.filter((c): c is string => typeof c === 'string'); return data }
      const checked = labels()
      return checked.length ? { ...data, checked } : data
    },
    /**
     * Stored message artifacts with a `{ type: 'checked', labels }` entry, so a
     * reopened chat shows the same line. Computed from the same text whether the
     * row is written before or after `done`.
     */
    withChecked<T>(artifacts: T): T | Array<Record<string, unknown>> | undefined {
      const checked = labels()
      if (!checked.length) return artifacts
      const list = Array.isArray(artifacts) ? artifacts : artifacts == null ? [] : [artifacts]
      return [...list.filter((a) => !(a && typeof a === 'object' && (a as { type?: unknown }).type === 'checked')), { type: 'checked', labels: checked }]
    },
  }
}

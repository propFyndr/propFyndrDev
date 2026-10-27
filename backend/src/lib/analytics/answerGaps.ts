// backend/src/lib/analytics/answerGaps.ts
//
// Where the chat fell short, per real buyer turn, so the admin panel can list what to fix.
// Read from what is already stored (the question, the saved answer, the turn trace): nothing
// new is written on the buyer's turn. Missing projects come from the coverage-gap log and
// missing sectors from searches, both in routes/admin.ts '/analytics/answer-gaps'.

import { isOutageNotice } from '../ai/outageNotice'
import { sortTask } from '../chat/taskSorter'

export const GAP_KINDS = {
  ai_failed: 'The AI could not answer (outage notice or degraded answer)',
  no_match: 'A search found nothing we hold',
  not_on_record: 'Answered "not on record": we lack the data asked for',
  out_of_scope: 'Asked for something outside what we cover (other city, rent, resale, commercial)',
  slow: 'Answer took 20 seconds or more',
} as const
export type GapKind = keyof typeof GAP_KINDS

export interface Turn {
  question: string
  answer: string | null
  latencyMs: number | null
  degraded: boolean | null
}

const NO_MATCH = /\bnone of the projects we hold match\b|\bno projects? (?:match|matched|found)\b|\bcouldn'?t find any\b|\bwe (?:don'?t|do not) have any projects?\b/i
const NOT_ON_RECORD = /\bnot on record\b|\bnot recorded\b|\bwe don'?t have the [^.]{1,80} verified\b|\b(?:don'?t|do not) (?:currently )?hold\b|\bnot (?:currently )?in what we hold\b|\bnot in our (?:records|database)\b|\bisn'?t in our records\b/i
const SCOPE_REPLY = /\bwe (?:do not|don'?t) cover\b|\boutside (?:our|this) (?:scope|coverage)\b|\bwe track new-construction sales\b/i

/** Every way this turn fell short; empty when it did not. */
export function classifyTurn(t: Turn): GapKind[] {
  const answer = t.answer ?? ''
  const kinds: GapKind[] = []
  if (isOutageNotice(answer) || t.degraded) kinds.push('ai_failed')
  if (NO_MATCH.test(answer)) kinds.push('no_match')
  if (NOT_ON_RECORD.test(answer)) kinds.push('not_on_record')
  if (sortTask(t.question).task === 'out_of_scope' || SCOPE_REPLY.test(answer)) kinds.push('out_of_scope')
  if ((t.latencyMs ?? 0) >= 20_000) kinds.push('slow')
  return kinds
}

/** "Sector 10", "sec-10", "sector10" all read as the same sector. */
export function normaliseSector(s: string | null | undefined): string {
  const m = String(s ?? '').toLowerCase().match(/\b(?:sector|sec)[\s-]*(\d+[a-z]?)\b/)
  return m ? `sector ${m[1]}` : String(s ?? '').toLowerCase().trim()
}

// Mechanical scoring of a safety answer, ours or another assistant's, on the same four counts.
//
//   sourced:      sentences carrying a figure or date AND naming the record it came from
//   unsourced:    sentences carrying a figure or date and naming no record (a candidate wrong fact;
//                 whether it IS wrong needs the register, so the report checks named ones by hand)
//   reassurance:  verdicts no record supports ("safe", "clean", "no litigation", "delivered" ...)
//   notOnRecord:  honest statements that a fact is not held
//
// Each count is of sentences. Counting, not judging: CLAUDE.md forbids a fake quality score, so there is no total.

const SENTENCES = /[^.!?\n]+[.!?]?/g
const FIGURE = /\d/
const SOURCE = /\b(?:up-?rera|rera\s+(?:portal|registry|register|website)|on\s+(?:our\s+)?record|our\s+record|registry\s+page|registry|order\s+dated|as\s+read|read\s+on)\b/i

const REASSURANCE: RegExp[] = [
  /\b(?:is|are|looks?|seems?)\s+(?:a\s+)?(?:completely\s+|totally\s+|relatively\s+|fairly\s+|very\s+)?safe(?:r)?\b(?!\s+to\s+(?:assume|say))/i,
  /\bsafe(?:r)?\s+(?:buy|bet|choice|investment|option)\b/i,
  /\bobjectively\b/i,
  /\bzero[-\s]delay\b/i,
  /\bclean\s+(?:legal\s+)?(?:standing|record|title|slate|history)\b/i,
  /\bunblemished\b/i,
  /\brisk[-\s]free\b/i,
  /\bno\s+(?:pending\s+|ongoing\s+|known\s+|major\s+)?(?:litigation|court\s+cases?|legal\s+(?:disputes?|cases?|issues?))\b|\blitigation[-\s]free\b/i,
  /\b(?:has|have|was|were|been|is)\s+(?:been\s+)?(?:fully\s+)?(?:delivered|handed\s+over)\b/i,
  /\b(?:trusted|reputed|reliable|renowned)\s+(?:builder|developer|brand)\b/i,
]

const NOT_ON_RECORD = /\bnot\s+on\s+record\b|\bwe\s+(?:do\s+not|don['’]t)\s+hold\b|\bno\s+record\s+of\b|\bwe\s+hold\s+no\b/gi

export interface SafetyScore {
  sourced: number
  unsourced: number
  reassurance: number
  notOnRecord: number
  reassuranceLines: string[]
  unsourcedLines: string[]
}

export function scoreSafety(answer: string): SafetyScore {
  const sentences = (answer.match(SENTENCES) ?? []).map((s) => s.trim()).filter(Boolean)
  const out: SafetyScore = { sourced: 0, unsourced: 0, reassurance: 0, notOnRecord: 0, reassuranceLines: [], unsourcedLines: [] }
  for (const s of sentences) {
    // A "Not on record" line is honest, not reassurance, even when it names a topic.
    const honest = /\bnot\s+on\s+record\b|\bwe\s+hold\s+no\b/i.test(s)
    const question = s.endsWith('?') // a heading such as "Is it completely risk-free?" asks; it does not reassure
    if (!honest && !question && REASSURANCE.some((re) => re.test(s))) { out.reassurance++; out.reassuranceLines.push(s) }
    if (FIGURE.test(s)) {
      if (SOURCE.test(s)) out.sourced++
      else { out.unsourced++; out.unsourcedLines.push(s) }
    }
  }
  out.notOnRecord = (answer.match(NOT_ON_RECORD) ?? []).length
  return out
}

// backend/src/lib/ai/oneQuestion.ts
//
// One question per turn, enforced on the bytes.
//
// The prompt has asked for this in three places for weeks, and it is still the
// most reliably broken rule in the product. Measured on a single funnel run,
// after the rule was tightened with two worked counter-examples:
//
//   "…do you have a specific micro-market or sector in Noida in mind, or would
//    you like to narrow down a shortlist based on your preferred budget and
//    room configuration?"
//   "Are you aiming for a ready-to-move 3 or 4 BHK, and what is your target
//    budget for your family's home?"
//
// Three answers requested in one breath, both times. A buyer facing that is
// filling in a form, which is the thing this product exists not to be.
//
// A prompt rule is a request; this runs after generation, so it cannot be
// talked out of. Same reasoning as the table stripper and the over-promise
// softener.
//
// Deliberately conservative in two ways. An either/or — "X, or would you rather
// Y?" — is left alone: that is one decision with two options, which is how a
// good advisor narrows things, and cutting it would leave a worse question. And
// it only ever TRIMS; it never rewrites a clause or invents a connective, so
// the worst case is a shorter question rather than a wrong one.

/** `, and what is your budget` — a second ask smuggled onto the first. */
const SECOND_ASK =
  /,\s+(?:and|plus|also)\s+(?=(?:what|which|how|when|where|do|does|did|are|is|would|will|can|could|have|has|any)\b)/i

/**
 * `, or do you have a budget in mind` — a second ask wearing the first's
 * question mark.
 *
 * The either/or exemption below is right for two options of the SAME slot:
 * "expressway connectivity, or closer to the metro?" is one decision with two
 * answers, and cutting it leaves a worse question. It was too broad for two
 * DIFFERENT slots. Measured live:
 *
 *   "Are you looking in a specific area like Sector 137, 150, or 168, or do you
 *    have a budget in mind?"
 *
 * Area and budget are separate slots, so that is two questions and one question
 * mark — which is exactly the form the mark-counting check cannot see.
 *
 * The signal is a second finite verb with its own subject after the "or".
 * "…, or the metro?" has none and survives; "…, or DO YOU HAVE…" starts a new
 * predicate and is cut.
 *
 * Narrowed once already, and the ceiling is worth stating. "or would you
 * RATHER be near the metro?" tripped the first version, and it should not have:
 * "rather" and "prefer" mark a restatement of the same choice, so that is still
 * one decision with two options. They are excluded.
 *
 * What remains is a heuristic, not a parser. A same-slot alternative phrased
 * with some other verb ("…, or is the metro more important?") will still be
 * cut, and the cost of that is a slightly shorter question rather than a wrong
 * one — which is the direction this file always errs in.
 */
const SECOND_ASK_AFTER_OR =
  /,\s+or\s+(?!(?:would|do|did|could)\s+you\s+(?:rather|prefer|instead))(?=(?:do|does|did|are|is|was|were|would|will|can|could|have|has|had|shall|should)\s+(?:you|your)\b)/i

export interface OneQuestionResult {
  text: string
  /** How many extra asks were removed. Zero means the reply was already fine. */
  trimmed: number
}

/**
 * Keeps the first question of the closing run and drops every ask after it.
 *
 * Trailing questions go whole. A second ask joined onto the first with ", and"
 * is cut at the join, which is safe because everything before the join is
 * already a complete question.
 */
export function oneQuestion(input: string): OneQuestionResult {
  const text = input ?? ''
  if (!text.includes('?')) return { text, trimmed: 0 }

  // Never touch anything inside a fenced block or a table row — a table cell can
  // legitimately hold a question mark, and code is not prose.
  if (/^\s*(?:\||```)/m.test(text) && text.split('?').length > 2) {
    // Tables are common in these replies; only operate on the trailing prose.
    const lastBlockEnd = Math.max(text.lastIndexOf('\n|'), text.lastIndexOf('```'))
    if (lastBlockEnd > -1) {
      const head = text.slice(0, lastBlockEnd)
      const tailStart = text.indexOf('\n', lastBlockEnd + 1)
      if (tailStart === -1) return { text, trimmed: 0 }
      const tail = text.slice(tailStart)
      const done = oneQuestion(tail)
      return { text: head + text.slice(lastBlockEnd, tailStart) + done.text, trimmed: done.trimmed }
    }
  }

  let trimmed = 0

  // 1. The turn's ask is the run of questions the reply closes on. Keep the
  //    first of that run and drop the rest, plus any pleasantry after it.
  //    A question followed by prose ("Looking for ready-to-move? Here are…",
  //    a question as a heading) is not part of the run and stays: cutting at
  //    the first question mark took the whole answer with it.
  const marks = [...text.matchAll(/\?/g)].map((m) => m.index!)
  let runStart = marks.length - 1
  // A sentence end (". " / "! "), a blank line, or a whole line of its own (a
  // list item with no full stop) between two questions means prose sits between
  // them, so the earlier one is not part of the closing run.
  while (runStart > 0 && !/[.!](?=\s)|\n\s*\n|\n[^\n]*\S[^\n]*\n/.test(text.slice(marks[runStart - 1] + 1, marks[runStart]))) runStart--
  let out = text
  if (runStart < marks.length - 1) {
    out = text.slice(0, marks[runStart] + 1)
    trimmed += marks.length - 1 - runStart
  }

  // 2. Cut a second ask hung off the first with ", and …" or ", or do you …".
  const q = out.lastIndexOf('?')
  if (q > -1) {
    // Only the question's own sentence: ", and is on track" in the body before it
    // is prose, and matching there cut the answer down to its first clause.
    const head = out.slice(0, q)
    const start = Math.max(0, ...[...head.matchAll(/[.!?](?=\s)|\n/g)].map((m) => m.index! + 1))
    const question = head.slice(start)
    // Earliest join wins: cutting at the later one would leave the earlier
    // second ask standing, which is the whole problem.
    const joins = [SECOND_ASK.exec(question), SECOND_ASK_AFTER_OR.exec(question)]
      .filter((m): m is RegExpExecArray => m !== null && m.index > 12)
      .sort((a, b) => a.index - b.index)
    const join = joins[0]
    if (join) {
      out = `${head.slice(0, start + join.index).trimEnd()}?${out.slice(q + 1)}`
      trimmed += 1
    }
  }

  return { text: out, trimmed }
}

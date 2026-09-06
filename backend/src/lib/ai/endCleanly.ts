// backend/src/lib/ai/endCleanly.ts
//
// A reply ceiling cuts wherever the token budget runs out, which is routinely
// mid-word or mid-table-row:
//
//   | **Techzone 4** | IT commuters, NRIs | 5,80
//
// Raising the ceilings in inferenceProfile.ts is the actual fix and covers the
// streaming legs, where nothing can be retracted once sent. This is the safety
// net for the buffered path — a tool-blind leg holds its whole answer back so
// the fabrication guard can read it, and that same seam can drop a dangling
// fragment before the buyer ever sees it.
//
// It does not recover the lost content. It removes the broken edge, which is
// the part that reads as a bug rather than as an answer that stopped.

/** Already a clean ending: sentence, list item, closed fence, or table row. */
const ENDS_CLEANLY = /(?:[.!?:)\]"'`]|\|)\s*$/

/** A table row is complete when it opens and closes with a pipe. */
const COMPLETE_ROW = /^\s*\|.*\|\s*$/

/**
 * How much of an answer may be discarded to reach a clean edge.
 *
 * A dangling half-sentence is worth losing. More than half the answer is not —
 * past that the rough edge is the lesser harm, and the raised ceilings mean
 * hitting this at all is rare. The bound matters most on SHORT replies, where
 * one dropped table row is a large fraction of the whole.
 */
const MAX_TRIM_RATIO = 0.5

export interface EndCleanlyOptions {
  /**
   * Hard cap on characters that may be dropped, overriding the ratio.
   *
   * The ratio guard assumes `text` IS the whole answer. The stream tail buffer
   * breaks that assumption: it holds only the last ~180 characters, so a
   * dangling fragment can easily be more than half of what it is looking at
   * while being a rounding error against the real answer. Without this, the
   * tail path refused to trim exactly the cases it exists for — a half-built
   * final table row would be kept because dropping it "lost 60%".
   */
  maxTrimChars?: number
}

export function endCleanly(text: string, opts: EndCleanlyOptions = {}): string {
  const trimmed = text.trimEnd()
  if (!trimmed || ENDS_CLEANLY.test(trimmed)) return text

  const allowed = (kept: string): boolean =>
    opts.maxTrimChars !== undefined
      ? trimmed.length - kept.length <= opts.maxTrimChars
      : kept.length >= trimmed.length * MAX_TRIM_RATIO

  const lines = trimmed.split('\n')
  const last = lines[lines.length - 1]

  // Inside a table, the unit is the row: drop a partial one entirely rather
  // than leaving a half-built row the renderer will mangle.
  if (last.trimStart().startsWith('|') && !COMPLETE_ROW.test(last)) {
    const kept = lines.slice(0, -1).join('\n').trimEnd()
    return allowed(kept) ? kept : text
  }

  /**
   * In a list, the unit is the item — and a list item is neither a table row
   * nor a sentence, so it used to fall through both branches untouched.
   *
   * Measured in the demo replay, this reached the buyer verbatim:
   *
   *   Here are the verified 3 BHK options under ₹2 crore in Sector 150:
   *
   *   - **ATS Pious Hideaways / Orchards** (₹1
   *
   * The sentence branch below could not help: it looks for the last ". " and
   * there is no full stop anywhere in that text, so `lastStop <= 0` returned
   * the string unchanged. Dropping the partial item leaves a lead-in with
   * nothing under it, which the router already handles — a dangling colon with
   * cards on screen is repaired there.
   */
  const BULLET = /^\s*(?:[-*•]\s|\d+[.)]\s)/
  if (BULLET.test(last)) {
    const kept = lines.slice(0, -1).join('\n').trimEnd()
    return allowed(kept) ? kept : text
  }

  /**
   * A partial block that is not a bullet, a row, or a sentence.
   *
   * The list does not always arrive with markers. Measured on the next run
   * after the bullet fix, the same turn ended:
   *
   *   ...under ₹2 crore in Sector 150:
   *
   *   ATS Pious Hideaways / Orchards · Samridhi Daksh
   *
   * — an interpunct-separated run, cut mid-name. The sentence branch below
   * cannot help because there is no full stop anywhere in the text.
   *
   * A blank line before the last line means it opened its own block, so
   * dropping it cannot orphan half of a paragraph that started earlier. That
   * is the whole condition; `allowed()` still refuses to eat most of the
   * answer, which is what stops this from firing on a short reply whose final
   * line is simply unpunctuated.
   */
  if (lines.length >= 2 && lines[lines.length - 2].trim() === '') {
    const kept = lines.slice(0, -1).join('\n').trimEnd()
    if (kept && allowed(kept)) return kept
  }

  // Otherwise the unit is the sentence. Look for the last terminator that is
  // followed by a space or a line break, so a decimal point or an abbreviation
  // mid-number ("₹1.25") is not mistaken for the end of a sentence.
  const lastStop = Math.max(
    trimmed.lastIndexOf('. '),
    trimmed.lastIndexOf('.\n'),
    trimmed.lastIndexOf('! '),
    trimmed.lastIndexOf('?\n'),
    trimmed.lastIndexOf('? '),
    trimmed.lastIndexOf('!\n'),
  )
  if (lastStop <= 0) return text

  const kept = trimmed.slice(0, lastStop + 1)
  return allowed(kept) ? kept : text
}

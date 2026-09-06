import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

/**
 * Editorial content baked into source is invisible to every guard we have.
 *
 * `answerIntegrity` checks what the MODEL wrote. `toolBlindGuard` checks names
 * against the database. `guardrails.ts` blocks the model from claiming a
 * percentage return. None of them see a string literal we ship ourselves — so
 * `citywideQuery.ts` was able to hold a table headed "Based on delivery track
 * records, construction quality ratings, and RERA compliance" that named four
 * developers, rated them ("Corporate Governance / Tier 1"), and listed flagship
 * projects, with not one row behind any of it. The prompt forbids the model
 * from doing that on the same turn.
 *
 * Worse, one branch asserted "12% – 15% p.a." capital CAGR and per-corridor
 * rental yields — the exact claim `guardrails.ts` exists to block — and crashed
 * on a missing `+` between two template literals, so every "where should I
 * invest" turn threw. Both are deleted.
 *
 * This does not demand the rest be rewritten tonight. It pins the count so the
 * debt cannot grow quietly, and fails loudly on the two claim shapes that are
 * never acceptable: a projected return, and a builder ranked by us.
 */

const HANDLERS = join(__dirname, '..', 'handlers')

function replyLines(): Array<{ file: string; line: number; text: string }> {
  const out: Array<{ file: string; line: number; text: string }> = []
  for (const f of readdirSync(HANDLERS).filter(n => n.endsWith('.ts') && !n.includes('.test.'))) {
    readFileSync(join(HANDLERS, f), 'utf8').split('\n').forEach((text, i) => {
      const t = text.trim()
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return
      out.push({ file: f, line: i + 1, text })
    })
  }
  return out
}

/** A percentage return, yield or CAGR asserted in a reply string. */
const PROJECTED_RETURN = /\d\s*%\s*(?:–|-|to)?\s*\d*\.?\d*\s*%?\s*(?:p\.?a\.?|per annum|CAGR|yield|returns?|appreciation)/i

test('no reply string asserts a projected return', () => {
  const offenders = replyLines()
    .filter(l => /replyText|token:|`\|/.test(l.text) && PROJECTED_RETURN.test(l.text))
    .map(l => `${l.file}:${l.line}  ${l.text.trim().slice(0, 90)}`)

  assert.deepEqual(
    offenders,
    [],
    'a handler ships a percentage return as fact — guardrails.ts blocks the model from ' +
    'writing these, and a string literal bypasses it:\n  ' + offenders.join('\n  '),
  )
})

test('no reply string ranks or rates a named builder', () => {
  // The shape that matters: a bolded developer name in a table cell next to a
  // quality label. Naming a builder is fine (a project has one); grading them
  // in our own prose is what BUILDER DATA RULES forbid.
  const RATED_BUILDER =
    /\*\*(?:Godrej|Mahagun|ATS|ACE|Gaur|Eldeco|Prateek|Supertech|Amrapali|Jaypee|Purvanchal|Nirala|Panchsheel|Samridhi|Sikka|Tata|Antriksh)[^*]*\*\*\s*\|\s*[^|]*\b(Tier 1|Renowned|Top[- ]Rated|Best|Superior|Excellent|Premier|Leading|High Delivery|Corporate Governance)\b/i

  const offenders = replyLines()
    .filter(l => RATED_BUILDER.test(l.text))
    .map(l => `${l.file}:${l.line}  ${l.text.trim().slice(0, 90)}`)

  assert.deepEqual(
    offenders,
    [],
    'a handler grades a named developer in a string literal:\n  ' + offenders.join('\n  '),
  )
})

/**
 * The remaining debt, counted.
 *
 * These are curated market tables naming real projects and sectors with prices.
 * They are not fabrications in the way the two above were — the figures are
 * broadly right — but nothing verifies them against a row, and they go stale
 * silently. Lowering this number is the work; raising it needs a reason.
 */
const KNOWN_HARDCODED_BRAND_LINES = 17

test('hardcoded brand tables do not multiply', () => {
  const BRANDS = /\b(Godrej|Mahagun|ATS|ACE|Gaur|Eldeco|Prateek|Supertech|Amrapali|Jaypee|Purvanchal|Nirala|Panchsheel|Samridhi|Exotica|Logix|Paras|Sikka|Tata|Assotech|Antriksh|Eros|Divine|Stellar|Maxblis|Gulshan|Kalpataru)\b/
  const count = replyLines().filter(l => BRANDS.test(l.text) && /replyText|token:|`\|| \| \*\*/.test(l.text)).length

  assert.ok(
    count <= KNOWN_HARDCODED_BRAND_LINES,
    `hardcoded brand claims rose from ${KNOWN_HARDCODED_BRAND_LINES} to ${count}. ` +
    'Answer from rows instead — nothing checks a string literal.',
  )
})

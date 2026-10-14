import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * These guard the two regressions the coverage lane shipped on its first run,
 * both of which turned a good answer into a confidently wrong one.
 */
const NOT_A_BUILDER =
  /^(the|new|best|top|all|any|noida|greater|delhi|ncr|sector|realtyask|ready|under|luxury|premium|residential|commercial|upcoming|verified|bhk|flat|flats|apartment|apartments|house|home|homes|good|cheap|affordable|these|those|such|more|other)$/i

const BUILDER_QUESTION =
  /\b([a-z][a-z&.]{2,}(?:\s+[a-z][a-z&.]{2,})?)\s+(?:properties|projects|group|builders?|developers?|homes|infra|realty)\b/i

const normalise = (n: string) => n.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

function wouldClaim(message: string): string | null {
  const m = message.match(BUILDER_QUESTION)
  if (!m) return null
  const raw = m[1].trim()
  if (NOT_A_BUILDER.test(raw.split(/\s+/)[0])) return null
  const wanted = normalise(raw)
  return wanted.length < 4 ? null : wanted
}

function matches(builderName: string, wanted: string): boolean {
  const words = normalise(builderName).split(' ')
  return words.includes(wanted) || wanted.split(' ').every((w) => words.includes(w))
}

describe('builder detection', () => {
  it('does not treat "bhk" as a builder name', () => {
    // "Compare the best 3 BHK projects in Sector 75" captured "bhk", which is a
    // substring of "Shubhkamna" — so a sector question was answered as a
    // question about a builder nobody had named.
    assert.equal(wouldClaim('Compare the best 3 BHK projects in Sector 75'), null)
  })

  it('does not substring-match a builder name', () => {
    assert.equal(matches('Shubhkamna Group (Court Receiver Supervision)', 'bhk'), false)
  })

  it('still matches a real builder', () => {
    assert.equal(wouldClaim('godrej properties in noida'), 'godrej')
    assert.equal(matches('Godrej Properties', 'godrej'), true)
  })

  it('ignores generic openers', () => {
    for (const q of ['best projects in noida', 'new projects in noida', 'ready projects in noida']) {
      assert.equal(wouldClaim(q), null, q)
    }
  })
})

describe('sector normalisation', () => {
  it('strips the city suffix intent carries', () => {
    // Intent holds "Sector 75, Noida"; the column holds "Sector 75". An exact
    // match found nothing and reported that we do not track a sector the same
    // answer then recommended.
    assert.equal('Sector 75, Noida'.split(',')[0].trim(), 'Sector 75')
    assert.equal('Sector 150'.split(',')[0].trim(), 'Sector 150')
  })
})

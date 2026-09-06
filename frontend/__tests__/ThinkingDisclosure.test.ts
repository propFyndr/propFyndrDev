/**
 * The thinking disclosure must not describe work it cannot know happened.
 *
 * `DomainExecutionTimeline` renders under a control the buyer opens to see our
 * reasoning, which is the highest-trust surface in the product. It held four
 * hardcoded sentences claiming RERA audits, connectivity evaluation and price
 * normalisation, plus a literal `Thought for 8s` shown whatever the turn cost.
 *
 * Nothing on the backend could catch that: `checkAnswerIntegrity` reads model
 * output, and these strings never touched a model. This is the guard for that
 * surface, and it reads the source because the property that matters is that
 * the sentences are not in the file at all.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SOURCE = readFileSync(
  join(__dirname, '..', 'components', 'chat', 'DomainExecutionTimeline.tsx'),
  'utf8',
)

/** The comment block explaining the removal legitimately quotes them. */
const CODE = SOURCE.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

describe('the thinking disclosure states only what happened', () => {
  it('claims no duration it did not measure', () => {
    // `Thought for 8s` / `Thought for 6s` were literals in the render path.
    expect(CODE).not.toMatch(/Thought for \d+\s*[sm]/)
    // The measured form interpolates.
    expect(CODE).toMatch(/Thought for \$\{/)
  })

  it('does not narrate work the component cannot observe', () => {
    for (const claim of [
      /Auditing UP-RERA/i,
      /arterial road access/i,
      /Normalizing price per sq\.?ft/i,
      /architectural plans/i,
      /spatial efficiency/i,
      /trade-off matrix/i,
    ]) {
      expect(CODE).not.toMatch(claim)
    }
  })

  it('renders nothing rather than an empty disclosure', () => {
    expect(CODE).toMatch(/thinkingSteps\.length === 0[\s\S]{0,60}return null/)
  })
})

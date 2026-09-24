import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CHAT_TOPIC_HANDLERS } from '../../lib/chat/handlers'

/**
 * The OPEN lane asks the handler registry, not a list of remembered phrasings.
 *
 * That lane returns before CHAT_TOPIC_HANDLERS run, so every phrasing the
 * classifier calls OPEN makes every handler unreachable and the model answers
 * about a building we hold rows for. It accumulated five hand-written bail-outs
 * — inventory, affordability, legal safety, our own numbers, resolved ordinal —
 * each added after someone found that failure by hand.
 *
 * Two things are pinned here. First that the probe is registry-driven, so a
 * handler added later is covered without anyone editing the router. Second
 * WHICH handlers it currently reaches: the flags are computed below this point,
 * so the probe passes an empty flag set and only matchers carrying their own
 * message regex can answer. That gap is real and deliberate; this test is what
 * stops it widening unnoticed.
 */

const ROUTER = readFileSync(join(__dirname, '..', 'chat-router.ts'), 'utf8')

/** The probe as the router runs it: message + intent, no flags. */
const claims = (handler: (typeof CHAT_TOPIC_HANDLERS)[number], message: string): boolean => {
  try {
    return (handler.matches as (c: unknown) => boolean)({
      message,
      intent: { projectNames: ['ACE Parkway'] },
      flags: {},
      sectorMatches: [],
      activeProjectName: 'ACE Parkway',
    })
  } catch {
    return false
  }
}

describe('the OPEN lane defers to the handler registry', () => {
  it('probes the registry rather than naming one handler', () => {
    assert.match(
      ROUTER,
      /const claimingHandler = [\s\S]{0,200}CHAT_TOPIC_HANDLERS\.find/,
      'the probe must iterate the registry, not a hardcoded handler',
    )
    assert.match(ROUTER, /!claimingHandler\s*\n\s*\)\s*\{\s*\n\s*await answerAsGeneralQuestion/,
      'the result must gate the open lane')
  })

  it('every matcher survives the reduced context without throwing', () => {
    // The probe runs before most of the handler context exists. A matcher that
    // throws there would take the turn down, so the router catches — but a
    // matcher that needs to throw to work is a matcher that never claims.
    for (const h of CHAT_TOPIC_HANDLERS) {
      assert.doesNotThrow(
        () => claims(h, 'what is the water TDS level in ACE Parkway'),
        `${h.id} threw on the reduced probe context`,
      )
    }
  })

  it('reaches the handlers whose matchers carry their own regex', () => {
    // These four can answer without the flags. If one drops off this list its
    // matcher became flag-only, and it just became unreachable from the OPEN
    // lane — which is the exact bug this guard exists to prevent.
    const reachable = [
      ['due_diligence', 'what is the water TDS level in ACE Parkway'],
      ['authority_mechanics', 'what transfer charges do I pay on a leasehold flat'],
    ] as const
    for (const [id, message] of reachable) {
      const h = CHAT_TOPIC_HANDLERS.find(x => x.id === id)
      assert.ok(h, `${id} is no longer in the registry`)
      assert.ok(claims(h!, message), `${id} is unreachable from the OPEN lane probe`)
    }
  })

  it('does not claim a turn that names no project we hold', () => {
    // Scoped deliberately: with no project named the open lane is usually
    // right, and the handlers' no-project branches stay reachable normally.
    assert.match(
      ROUTER,
      /const claimingHandler = \(intent\.projectNames\?\.length \?\? 0\) > 0/,
      'the probe must be scoped to a named project',
    )
  })

  it('records why the flag-only matchers are out of reach', () => {
    // A limit nobody wrote down is a limit that gets forgotten and then
    // rediscovered as a bug report.
    assert.match(ROUTER, /LIMIT, stated because it is invisible otherwise/)
  })
})

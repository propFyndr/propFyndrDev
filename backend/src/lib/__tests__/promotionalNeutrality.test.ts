import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

/**
 * A promoted project is never ranked higher.
 *
 * This is the constraint that makes the news rail sellable twice. A builder can
 * pay for a slot because the advisor stays exactly as honest about a promoted
 * project as about any other: the rail decides what a buyer is INVITED TO ASK
 * ABOUT, never what the advisor RECOMMENDS. The day ranking bends to commercial
 * input, the advisor is an advertising channel and the product is dead —
 * CLAUDE.md § Trust First.
 *
 * Asserted structurally rather than behaviourally, on purpose. A snapshot of
 * "ordering is identical with the promotional on and off" only proves the two
 * fixtures used happened not to interact; this proves the recommendation path
 * cannot see commercial data at all, which is the stronger claim and the one
 * that survives someone adding a new ranking input.
 *
 * It is checked in BOTH directions, because a boost can be wired either way:
 * ranking reaching for promotional data, or the promotional layer reaching into
 * ranking to reorder what comes back.
 */

const LIB = join(__dirname, '..')
const ROUTES = join(__dirname, '../../routes')

/** Anything that decides what a buyer is shown, or in what order. */
const RECOMMENDATION_DIRS = ['recommendation', 'discovery'] as const

/**
 * Commercial coupling, named as identifiers rather than prose so a comment
 * mentioning promotions does not trip it.
 */
const COMMERCIAL_TOKENS = [
  'promotional',
  'promotionalInteraction',
  'promo_id',
  'is_promoted',
  'sponsored',
  'builder_theme',
  'commission_rate_pct',
]

function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      out.push(...tsFilesUnder(full))
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

/** Source with comment lines removed — a comment is allowed to say "promotional". */
function codeOnly(path: string): string {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .filter((l) => {
      const t = l.trimStart()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
    })
    .join('\n')
}

describe('promoted projects never influence ranking', () => {
  const files = RECOMMENDATION_DIRS.flatMap((d) => tsFilesUnder(join(LIB, d)))

  it('finds the recommendation modules at all', () => {
    // Without this, an empty file list would make every check below pass while
    // checking nothing.
    assert.ok(files.length > 20, `only found ${files.length} recommendation modules`)
  })

  for (const token of COMMERCIAL_TOKENS) {
    it(`no recommendation module references \`${token}\``, () => {
      const offenders = files.filter((f) => codeOnly(f).includes(token))
      assert.deepEqual(
        offenders.map((f) => f.replace(LIB, 'lib')),
        [],
        `${token} reached the recommendation path. Ranking must not see commercial data — ` +
        `a promoted project is never ranked higher (CLAUDE.md § Who Sees What).`,
      )
    })
  }

  it('the chat router does not rank on commercial data either', () => {
    // The router is where a "boost this project" branch would most plausibly be
    // added, because it is where ordering meets the turn.
    const code = codeOnly(join(ROUTES, 'chat-router.ts'))
    const found = COMMERCIAL_TOKENS.filter((t) => code.includes(t))
    assert.deepEqual(found, [], `chat-router.ts references commercial data: ${found.join(', ')}`)
  })

  it('the promotional route does not reach into ranking', () => {
    // The other direction: the rail reordering what recommendations return
    // would be the same violation wired backwards.
    const code = codeOnly(join(ROUTES, 'promotionals.ts'))
    for (const banned of ['recommendation/', 'scoringEngine', 'rankingFormatter', 'rankingProfiles']) {
      assert.ok(
        !code.includes(banned),
        `promotionals.ts imports ${banned}. The rail decides what a buyer is invited to ask ` +
        `about, never what the advisor recommends.`,
      )
    }
  })
})

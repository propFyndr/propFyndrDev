import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join } from 'path'
import { BUYER_OPAQUE_SCORES, stripOpaqueScores, PROJECT_PUBLIC_SELECT } from '../projectExposure'

/**
 * No analyst-set 0–100 number reaches a buyer.
 *
 * Measured in the demo replay: "Show me the best projects between 1 and 2
 * crore" came back citing "a strong builder delivery score (92)", "a high
 * overall score (89)" and "a moderate delivery score (87)". A buyer cannot tell
 * what 87 is out of, who set it, or what separates it from 92 — the fake
 * confidence score CLAUDE.md forbids, arriving through six separate emitters
 * nobody had closed.
 *
 * `routes/builders.ts` had already reasoned this out for one field and left it
 * unselected. The chat path never followed. This is the rule in one place.
 */

const SRC = join(__dirname, '..')

/** Files that legitimately RANK on these numbers. Ordering is not printing. */
const RANKING_ONLY = [
  'discovery/scoringEngine.ts',
  'discovery/projects.ts',
  'discovery/multiDimQuery.ts',
  'discovery/queryRouter.ts',
  'discovery/queryPlanner.ts',
  'ai/cityShelf.ts',
  'chat/handlers/builderReputation.ts',
  'chat/handlerContext.ts',
  'db/chipProvider.ts',
  'projectExposure.ts',
]

test('no opaque score is in the public project select', () => {
  const leaked = BUYER_OPAQUE_SCORES.filter(f => f in (PROJECT_PUBLIC_SELECT as Record<string, unknown>))
  assert.deepEqual(leaked, [], `public select still exposes: ${leaked.join(', ')}`)
})

test('stripOpaqueScores removes every one of them', () => {
  const row = {
    name: 'ACE Parkway',
    delivery_score: 92,
    construction_quality_score: 80,
    rera_compliance_score: 90,
    overall_score: 89,
    average_delay_months: 0,
  }
  const out = stripOpaqueScores(row) as Record<string, unknown>
  for (const f of BUYER_OPAQUE_SCORES) assert.equal(f in out, false, `${f} survived`)
  assert.equal(out.name, 'ACE Parkway')
  assert.equal(out.average_delay_months, 0, 'an interpretable fact was dropped')
})

/**
 * The emitters, checked in the source.
 *
 * A score reaching a prompt looks like interpolation next to a "/100" or an
 * assignment into a facts object — not like a comparison or a sort. This looks
 * for the printing shapes only, and exempts the files whose whole job is to
 * rank on the number.
 */
test('no prompt or response builder prints a /100 score', () => {
  // The file list is the weak point of a source-level check, and it proved it:
  // `projectFacts.ts` was on it but its edit had not landed, and
  // `discovery/multiDimQuery.ts` was not on it at all — it carried
  // `delivery_score` under the name `builderOnTimeDeliveryPercent`, a field
  // name asserting a unit the value does not have. The demo replay then said
  // "Ready-to-move with a 92% builder delivery score" twice in one answer,
  // after every other emitter had been closed.
  const files = [
    'ai/groundedAnswer.ts',
    'builders.ts',
    'projectDataGateway.ts',
    'projectFacts.ts',
    'projectFactsBlock.ts',
    'discovery/multiDimQuery.ts',
    'discovery/scoringEngine.ts',
    'ai/propertyTrim.ts',
  ]
  const offenders: string[] = []

  for (const rel of files) {
    if (RANKING_ONLY.includes(rel)) continue
    const src = readFileSync(join(SRC, rel), 'utf8')
    src.split('\n').forEach((line, i) => {
      if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) return
      for (const field of BUYER_OPAQUE_SCORES) {
        if (!line.includes(field)) continue
        // Printing shapes: interpolated into a template, or handed to a
        // fact/parts builder. A bare select or sort is fine.
        const prints = /\$\{[^}]*\}/.test(line) || /parts\.push|builderFact\(|facts\[/.test(line)
        if (prints) offenders.push(`${rel}:${i + 1} ${line.trim().slice(0, 90)}`)
      }
    })
  }

  assert.deepEqual(offenders, [], 'an opaque score is being printed:\n  ' + offenders.join('\n  '))
})

test('no field name promises a unit the score does not have', () => {
  // `builderOnTimeDeliveryPercent: rawProject.builder.delivery_score` is worse
  // than exposing the raw score: the NAME tells the model it is a percentage,
  // so it wrote "a 92% builder delivery score" with total confidence, after
  // every other emitter had already been closed.
  const UNIT_PROMISE = /(?:Percent|Pct|Percentage|Rating)\s*:\s*[^,]*\b(?:delivery_score|overall_score|construction_quality_score|buyer_satisfaction_score|rera_compliance_score)\b/
  const offenders: string[] = []

  for (const rel of ['discovery/multiDimQuery.ts', 'projectFacts.ts', 'ai/propertyTrim.ts', 'projectDataGateway.ts']) {
    const src = readFileSync(join(SRC, rel), 'utf8')
    src.split('\n').forEach((line, i) => {
      const t = line.trimStart()
      if (t.startsWith('//') || t.startsWith('*')) return
      if (UNIT_PROMISE.test(line)) offenders.push(`${rel}:${i + 1}  ${t.slice(0, 90)}`)
    })
  }

  assert.deepEqual(offenders, [], 'a field name asserts a unit its value does not carry:\n  ' + offenders.join('\n  '))
})

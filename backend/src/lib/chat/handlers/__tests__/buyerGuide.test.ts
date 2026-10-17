import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { UP_STATUTORY } from '../../../factPresentation'
import {
  matchesRoadmapQuestion, roadmapStepFor, stepAnswer, ROADMAP_STEPS, ROADMAP_OPENING, ROADMAP_COUNT,
  matchesCapabilitiesQuestion, matchesTrustQuestion, CAPABILITIES_ANSWER, TRUST_ANSWER,
  roadmapHandler,
} from '../buyerGuide'
import type { ChatHandlerContext } from '../../handlerContext'

const ASK = 'I want you to create a roadmap in order for a new buyer to easily confirm a property in greater noida.'
const N = ROADMAP_STEPS.length

describe('buyer roadmap', () => {
  it('claims the live opening and other roadmap asks, refuses unrelated ones', () => {
    assert.ok(matchesRoadmapQuestion(ASK))
    assert.ok(matchesRoadmapQuestion('give me a step by step process to buy a flat'))
    assert.ok(matchesRoadmapQuestion('what are the steps to buy a flat in noida'))
    assert.ok(matchesRoadmapQuestion('explain the process of buying a home'))
    assert.ok(!matchesRoadmapQuestion('what are the stamp duty steps'))
    assert.ok(!matchesRoadmapQuestion('stamp duty kitna hai'))
    assert.ok(!matchesRoadmapQuestion('show me 3bhk in sector 150'))
    assert.ok(!matchesRoadmapQuestion('what is the noida metro roadmap'))
  })

  it('walks the live follow-ups without repeating or skipping', () => {
    const hist: string[] = [ASK]
    const turn = (m: string) => { const r = roadmapStepFor(m, hist); hist.push(m); return r }
    assert.equal(turn('Next step?'), 2)
    assert.equal(turn('next?'), 3)
    assert.equal(turn('next'), 4)
    assert.equal(turn('next'), 5)
    assert.equal(turn('step 4?'), 4)
    assert.equal(turn('step 5'), 5)
    assert.equal(turn('next step?'), 6)
    assert.equal(turn('step 6'), 6)
    assert.equal(turn('step 15?'), 15)
    assert.equal(turn('how many steps are there?'), 'count')
  })

  it('does not claim "next" without a roadmap in history, or after the chat moved on', () => {
    assert.equal(roadmapStepFor('next', []), null)
    assert.equal(roadmapStepFor('next', ['show me 3bhk in sector 150']), null)
    assert.equal(roadmapStepFor('step 3', ['stamp duty kitna hai']), null)
    assert.equal(roadmapStepFor('next', [ASK, 'show me 3bhk in sector 150']), null)
    assert.equal(roadmapStepFor('stamp duty kitna hai', [ASK]), null)
    assert.equal(roadmapStepFor('next', [ASK, ...Array(25).fill('next')]), null, 'opening out of range')
  })

  it('past the last step closes instead of inventing steps', () => {
    const t = stepAnswer(15)
    assert.match(t, new RegExp(`That's all ${N} steps`))
    assert.doesNotMatch(t, /### Step/)
    assert.match(stepAnswer(N), /last step/)
    assert.match(ROADMAP_COUNT, new RegExp(`There are ${N} steps`))
  })

  it('each step says where it sits and what comes next', () => {
    for (let k = 1; k <= N; k++) assert.match(stepAnswer(k), new RegExp(`Step ${k} of ${N}`))
    assert.match(stepAnswer(2), /Next is Step 3/)
    assert.match(ROADMAP_OPENING, /Step 1 of/)
  })

  it('handler answers a follow-up through the context', async () => {
    const sent: Array<[string, Record<string, unknown>]> = []
    const ctx = {
      message: 'next', priorUserMessages: [ASK, 'next step?'], sessionId: 's', intent: {},
      send: (e: string, d: Record<string, unknown>) => sent.push([e, d]), emitUiState: () => {}, res: { end: () => {} },
    } as unknown as ChatHandlerContext
    assert.ok(roadmapHandler.matches(ctx))
    await roadmapHandler.handle(ctx)
    assert.match(String(sent[0][1].token), /Step 3 of/)
    assert.equal(sent.at(-1)?.[0], 'done')
  })
})

describe('capabilities and trust', () => {
  it('claims the live phrasings', () => {
    assert.ok(matchesCapabilitiesQuestion('okay now tell me what you can do for me'))
    assert.ok(matchesTrustQuestion('okay tell me why should I trust the information provided by you?'))
    assert.ok(matchesTrustQuestion('are there any user feedbacks provided by existing customers of any property that is listed?'))
    for (const m of ['next', 'stamp duty kitna hai', 'show me 3bhk in sector 150']) {
      assert.ok(!matchesCapabilitiesQuestion(m)); assert.ok(!matchesTrustQuestion(m))
    }
  })

  it('states the limits honestly', () => {
    assert.match(CAPABILITIES_ANSWER, /Forecast prices/)
    assert.match(TRUST_ANSWER, /not inspected/)
    assert.match(TRUST_ANSWER, /do not hold feedback/)
    assert.match(TRUST_ANSWER, /never changes how projects are ranked/)
  })
})

describe('no invented figures', () => {
  const all = [ROADMAP_OPENING, ROADMAP_COUNT, ...ROADMAP_STEPS.map((_, i) => stepAnswer(i + 1)), stepAnswer(N + 1), CAPABILITIES_ANSWER, TRUST_ANSWER].join('\n')
  it('every percentage is a UP_STATUTORY value or the RERA Section 13 advance limit', () => {
    const allowed = new Set([...Object.entries(UP_STATUTORY).filter(([k]) => k.endsWith('Pct')).map(([, v]) => v), 10])
    for (const p of all.match(/\d+(?:\.\d+)?\s*%/g) ?? []) assert.ok(allowed.has(parseFloat(p)), `unsourced ${p}`)
    assert.match(all, /Section 13/)
  })
  it('no market words ("rental listings" is only named as out of scope), no exclamation marks, no rupee figure except the TDS threshold', () => {
    assert.doesNotMatch(all, /CAGR|\byield\b|\brents?\b|apprecia\w+ (?:of|at|rate)|!/i)
    const rupees = all.match(/₹\s*\d+[^\s]*(?:\s+lakh)?/g) ?? []
    assert.deepEqual([...new Set(rupees)], [`₹${UP_STATUTORY.tdsThresholdInr / 100_000} lakh`])
  })
})

// Must stay the first import: it stubs the model and turns Redis off before the app loads.
import './replayEnv'
import { describe, it, after } from 'node:test'
import assert from 'node:assert/strict'
import { app } from '../../index'
import { prisma } from '../db'
import { onStubbedModelCall } from '../ai/llmStub'
import { runReplay } from './routeReplay'

/**
 * A project card must not show what the chat cannot answer.
 *
 * Replay checks which lane answered and what the text says; it cannot see the
 * failure that matters most: the answer is wrong because the DATA never reached
 * the model ("price history is not available" over six stored rows). This asks
 * real questions about one real project through the real route and, for the
 * turns the model answers, reads what the model would have been sent.
 *
 * Needs the dev database, like routeReplay.test.ts. The model is stubbed.
 */
const PROJECT = 'Ace Parkway'

let prompt = ''
onStubbedModelCall((c) => { prompt = String(c.systemPrompt ?? '') })

async function ask(text: string) {
  prompt = ''
  const [r] = await runReplay(app as never, [{ id: 'coverage', source: 'chat coverage', turns: [{ text }] }])
  return { lane: r.lane, usedLlm: r.usedLlm, answer: r.answer, prompt }
}

/** True when the prompt carries this JSON key. */
const sees = (p: string, key: string) => p.includes(`"${key}":`)

after(() => prisma.$disconnect())

describe(`chat coverage: ${PROJECT}`, () => {
  describe('price movement is answered in code, with every point labelled', () => {
    for (const q of [
      `Has the price of ${PROJECT} changed over the last 12 months?`,
      `How has the price of ${PROJECT} changed over the last year?`,
      `What was the price per sqft of ${PROJECT} in 2023?`,
      `Price appreciation history of ${PROJECT} from 2021 to 2026`,
      `${PROJECT} ka price kitna badh gaya pichle saal?`,
    ]) {
      it(q, async () => {
        const r = await ask(q)
        assert.equal(r.lane, 'topic:price_trend')
        assert.equal(r.usedLlm, false, 'a recorded series is not the model\'s to paraphrase')
        assert.match(r.answer, /\| Period \| Price per sq ft \| Basis \|/)
        assert.match(r.answer, /Internal benchmark estimate|Observed \(/)
        assert.ok(!/not available/i.test(r.answer), 'must not say the history is unavailable while holding it')
      })
    }

    it('never states a rate of change off benchmark points', async () => {
      const r = await ask(`Has the price of ${PROJECT} changed over the last 12 months?`)
      // The answer must exist before its absence of a percentage means anything.
      assert.equal(r.lane, 'topic:price_trend')
      assert.match(r.answer, /Internal benchmark estimate/)
      assert.match(r.answer, /We hold one observed price/)
      // ACE Parkway holds five benchmark points and one observed point.
      assert.ok(!/\(\+\d/.test(r.answer), 'no percentage may be derived without two observed points')
    })
  })

  describe('data the question needs reaches the model', () => {
    it('recent updates and timeline', async () => {
      const r = await ask(`Any recent updates or timeline for ${PROJECT}?`)
      assert.equal(r.usedLlm, true)
      assert.ok(sees(r.prompt, 'recent_updates'), 'lifecycle/construction updates must be loaded for an updates question')
    })

    it('structure and safety specifications', async () => {
      const r = await ask(`What structure and safety features does ${PROJECT} have?`)
      assert.ok(sees(r.prompt, 'specifications'))
    })

    it('security and CCTV', async () => {
      const r = await ask(`Is ${PROJECT} safe for my family? security and cctv`)
      assert.ok(sees(r.prompt, 'has_security_24x7'))
      assert.ok(sees(r.prompt, 'has_cctv'))
    })

    it('construction status', async () => {
      const r = await ask(`What is the construction status of ${PROJECT}?`)
      assert.ok(sees(r.prompt, 'construction_milestones'))
    })
  })

  describe('what we deliberately do not state is said as policy, not as a gap', () => {
    for (const q of [
      `What is the rental yield at ${PROJECT}?`,
      `What is the decision thesis for ${PROJECT}?`,
      `Is ${PROJECT} a good investment?`,
      `Who is ${PROJECT} best suited for? buyer persona`,
    ]) {
      it(q, async () => {
        const r = await ask(q)
        assert.ok(sees(r.prompt, 'withheld_by_policy'), 'the model must be told why there is no figure')
        // The withheld data itself must not be there.
        assert.ok(!sees(r.prompt, 'rental_yield_annual_percent'), 'forward-looking yield must stay out of the prompt')
        assert.ok(!sees(r.prompt, 'decision_profile'), 'a draft analyst profile must stay out of the prompt')
      })
    }
  })

  describe('a missing payment schedule is said plainly, in code', () => {
    it('asks for the schedule', async () => {
      const r = await ask(`Show me the full payment schedule of ${PROJECT}`)
      assert.equal(r.lane, 'topic:payment-plans')
      assert.equal(r.usedLlm, false)
      assert.match(r.answer, /don't have the developer payment schedule/i)
    })
  })
  describe('which way a flat faces is answered from the recorded orientation', () => {
    for (const q of [
      `Which flats in ${PROJECT} face east?`,
      `Is there a flat facing sunrise in ${PROJECT}?`,
      `${PROJECT} mein purab facing flat hai kya?`,
    ]) {
      it(q, async () => {
        const r = await ask(q)
        assert.equal(r.lane, 'topic:orientation')
        assert.equal(r.usedLlm, false)
        assert.match(r.answer, /East-facing configurations on record/)
        assert.match(r.answer, /2 BHK Classic/)
        assert.match(r.answer, /4 BHK Penthouse Villa/)
        assert.match(r.answer, /Not listed as east-facing: 3 BHK Premier/)
        assert.match(r.answer, /not per tower or floor/)
      })
    }

    it('says we hold none for a direction no project records', async () => {
      const r = await ask(`Which flats in ${PROJECT} face west?`)
      assert.equal(r.lane, 'topic:orientation')
      assert.match(r.answer, /We do not record west-facing for any project/)
    })
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { Response } from 'express'
import {
  commuteShortlistHandler,
  CHAT_TOPIC_HANDLERS,
  reraVerificationHandler,
  statutoryTaxHandler,
  totalOutflowHandler,
  connectivityHandler,
} from '../handlers'
import { runTopicHandlers, type ChatHandlerContext, type ChatTopicHandler } from '../handlerContext'
import { UP_STATUTORY } from '../../factPresentation'
import type { Intent } from '../../discovery'

// These handlers were unreachable by any test while they lived inside the
// 3,900-line POST handler. Isolating them is the whole point of the extraction.

interface Captured {
  events: Array<{ event: string; data: Record<string, unknown> }>
  uiStates: Array<Record<string, unknown>>
  ended: boolean
}

function makeContext(over: Partial<ChatHandlerContext> = {}): { ctx: ChatHandlerContext; out: Captured } {
  const out: Captured = { events: [], uiStates: [], ended: false }
  const ctx: ChatHandlerContext = {
    message: '',
    intent: {} as Intent,
    sessionId: 'session-1',
    send: (event, data) => { out.events.push({ event, data }) },
    emitUiState: state => { out.uiStates.push(state as Record<string, unknown>) },
    res: { end: () => { out.ended = true } } as unknown as Response,
    cachedProjects: [],
    flags: {},
    ...over,
  }
  return { ctx, out }
}

const tokenText = (out: Captured): string =>
  out.events.filter(e => e.event === 'token').map(e => String(e.data.token)).join('')

describe('topic handler registry', () => {
  it('runs the first matching handler and stops', async () => {
    const order: string[] = []
    const stub = (id: string, matches: boolean): ChatTopicHandler => ({
      id,
      description: id,
      matches: () => matches,
      handle: async () => { order.push(id) },
    })
    const { ctx } = makeContext()
    const handled = await runTopicHandlers([stub('a', false), stub('b', true), stub('c', true)], ctx)
    assert.equal(handled, true)
    assert.deepEqual(order, ['b'])
  })

  it('closes the response for a handler that forgot to', async () => {
    // 33 of the 35 answering branches across the handlers emitted `done` and
    // never called res.end(). The router's call site only returns, so the SSE
    // stream stayed open taking a ping every three seconds — the answer arrived
    // and then never finished, and the 3s heartbeat leaked with it.
    const { ctx, out } = makeContext()
    const forgetful: ChatTopicHandler = {
      id: 'forgetful',
      description: 'answers but never ends the response',
      matches: () => true,
      handle: async c => { c.send('done', {}) },
    }
    assert.equal(await runTopicHandlers([forgetful], ctx), true)
    assert.equal(out.ended, true, 'the response was left open')
  })

  it('leaves the response open when every handler declines', async () => {
    // A decline means the generic path below still has to answer on this
    // socket, so closing it here would cost the buyer the reply entirely.
    const { ctx, out } = makeContext()
    const decliner: ChatTopicHandler = {
      id: 'decliner',
      description: 'declines after inspection',
      matches: () => true,
      handle: async () => false,
    }
    assert.equal(await runTopicHandlers([decliner], ctx), false)
    assert.equal(out.ended, false, 'a decline must not end the response')
  })

  it('falls through to the generic path when nothing matches', async () => {
    const { ctx } = makeContext()
    assert.equal(await runTopicHandlers(CHAT_TOPIC_HANDLERS, ctx), false)
  })

  it('lets a handler decline after inspection by returning false', async () => {
    const order: string[] = []
    const declining: ChatTopicHandler = {
      id: 'declines', description: '', matches: () => true,
      handle: async () => { order.push('declines'); return false },
    }
    const accepting: ChatTopicHandler = {
      id: 'accepts', description: '', matches: () => true,
      handle: async () => { order.push('accepts') },
    }
    const { ctx } = makeContext()
    assert.equal(await runTopicHandlers([declining, accepting], ctx), true)
    assert.deepEqual(order, ['declines', 'accepts'])
  })

  it('gives every handler a unique id and a description', () => {
    const ids = CHAT_TOPIC_HANDLERS.map(h => h.id)
    assert.equal(new Set(ids).size, ids.length, 'duplicate handler id')
    for (const h of CHAT_TOPIC_HANDLERS) {
      assert.ok(h.description.length > 10, `${h.id}: no usable description`)
    }
  })

  it('keeps every matcher free of I/O so ordering stays cheap', () => {
    // A matcher runs for every handler until one hits; it must not await.
    for (const h of CHAT_TOPIC_HANDLERS) {
      assert.ok(
        !/async|await/.test(h.matches.toString()),
        `${h.id}: matcher must be synchronous`,
      )
    }
  })
})

describe('rera_verification handler', () => {
  it('never sends the buyer to an external portal', async () => {
    // Rule 17 of the system prompt forbids redirecting off-platform. This branch
    // answers deterministically, so it never saw the prompt — and it was telling
    // buyers to visit up-rera.in and ibbi.gov.in and run their own title search.
    const { ctx, out } = makeContext({ flags: { isReraCheckQuery: true } })
    await reraVerificationHandler.handle(ctx)

    const text = tokenText(out)
    for (const banned of ['up-rera.in', 'ibbi.gov.in', 'Visit the official registry']) {
      assert.ok(!text.includes(banned), `still redirects off-platform: ${banned}`)
    }
    assert.match(text, /advisory team/, 'should offer to pull the filing on the buyer\'s behalf')
    assert.equal(out.ended, true)
  })

  it('points at the on-page verification panel', () => {
    const { ctx, out } = makeContext({ flags: { isReraCheckQuery: true } })
    return reraVerificationHandler.handle(ctx).then(() => {
      assert.match(tokenText(out), /Verification & risk/)
    })
  })

  it('only matches its own flag', () => {
    assert.equal(reraVerificationHandler.matches(makeContext({ flags: { isReraCheckQuery: true } }).ctx), true)
    assert.equal(reraVerificationHandler.matches(makeContext({ flags: {} }).ctx), false)
  })
})

describe('statutory_tax handler', () => {
  it('renders every rate from UP_STATUTORY rather than a typed-in literal', async () => {
    const { ctx, out } = makeContext({ flags: { isStatutoryTaxQuery: true } })
    await statutoryTaxHandler.handle(ctx)
    const text = tokenText(out)

    assert.match(text, new RegExp(`${UP_STATUTORY.stampDutyPct}%`))
    assert.match(text, new RegExp(`${UP_STATUTORY.stampDutyFemalePct}%`))
    assert.match(text, new RegExp(`${UP_STATUTORY.gstUnderConstructionPct}%`))
    assert.match(text, new RegExp(`${UP_STATUTORY.registrationPct}% of value \\|`))
    assert.doesNotMatch(text, /capped/)  // neither UP levy is capped
    assert.match(text, /₹50 Lakh/)  // TDS threshold, rendered in lakh
  })

  it('labels the budgeting band as market-typical, not statutory', async () => {
    const { ctx, out } = makeContext({ flags: { isStatutoryTaxQuery: true } })
    await statutoryTaxHandler.handle(ctx)
    assert.match(tokenText(out), /not verified for this project/)
    // Mixing a statutory table with a market band means the answer is not
    // wholly verified, and the confidence must say so.
    assert.equal(out.uiStates[0].confidence, 'MEDIUM')
  })
})

describe('total_outflow handler', () => {
  it('refuses to compute without a real base price', async () => {
    // It used to fall back to `price_min_cr || 1.35` for a project it named
    // "Standard Luxury Apartment" in "Sector 75, Noida", then printed stamp
    // duty, GST and a grand total derived from that invented figure — at
    // confidence HIGH. A buyer plans their financing on this number.
    const { ctx, out } = makeContext({
      flags: { isTotalOutflowQuery: true, hasNamedProject: false },
    })
    await totalOutflowHandler.handle(ctx)

    const text = tokenText(out)
    assert.ok(!text.includes('Standard Luxury Apartment'), 'still invents a project name')
    assert.ok(!text.includes('1.35'), 'still invents a base price')
    assert.match(text, /I need a specific project/)
    assert.equal(out.uiStates[0].confidence, 'LOW')
    assert.equal(out.ended, true)
  })

  it('still states the statutory rates it can state without a project', async () => {
    const { ctx, out } = makeContext({
      flags: { isTotalOutflowQuery: true, hasNamedProject: false },
    })
    await totalOutflowHandler.handle(ctx)
    const text = tokenText(out)
    assert.match(text, new RegExp(`${UP_STATUTORY.stampDutyPct}%`))
    // Market ranges may appear, but only carrying their qualifier.
    if (/parking/i.test(text)) assert.match(text, /not verified for this project/)
  })
})

describe('connectivity handler', () => {
  it('declines rather than guessing when there is no sector and nothing cached', async () => {
    // The branch it replaces defaulted to Sector 76 and then printed the same
    // hardcoded expressway, airport and hospital strings for every project.
    const { ctx, out } = makeContext({
      flags: { isConnectivityQuery: true },
      cachedProjects: [],
    })
    const result = await connectivityHandler.handle(ctx)
    assert.equal(result, false, 'should fall through to the generic path')
    assert.equal(out.ended, false, 'must not end the response when declining')
    assert.equal(out.events.length, 0)
  })
})

describe('commute shortlist handler', () => {
  const withWorkplace = (message: string, over: Record<string, unknown> = {}) =>
    makeContext({
      message,
      intent: {
        workplace: 'Sector 63',
        workplace_belt: ['Sector 76', 'Sector 75', 'Sector 77'],
        bhk: [3],
        budgetMax: 2,
        ...over,
      } as unknown as Intent,
      flags: { commuteAnchorJustStated: false },
    })

  it('fires on the turn the workplace is stated', () => {
    const { ctx } = makeContext({
      message: 'central noida, sector 63 noida in particular for office',
      intent: { workplace: 'Sector 63', workplace_belt: ['Sector 76'], bhk: [3] } as unknown as Intent,
      flags: { commuteAnchorJustStated: true },
    })
    assert.equal(commuteShortlistHandler.matches(ctx), true)
  })

  it('fires when the belt is asked for outright', () => {
    for (const q of ['yes build me that shortlist', 'which areas should i look at', 'where should i live']) {
      assert.equal(commuteShortlistHandler.matches(withWorkplace(q).ctx), true, q)
    }
  })

  // The regression that matters. The first version matched on the workplace
  // merely being present, and because it is sticky for the rest of the session
  // it answered three consecutive turns — a payment plan, an ordinal and a
  // comparison — with the identical belt shortlist. Same failure as
  // `purpose === 'investment'` in citywideQuery.
  for (const q of [
    'what is the payment plan for it',
    'how much would the EMI be',
    'what are the negatives i should know',
    'tell me about the first one',
    'compare it with the second option',
  ]) {
    it(`does not claim "${q}" off a sticky workplace`, () => {
      assert.equal(commuteShortlistHandler.matches(withWorkplace(q).ctx), false)
    })
  }

  it('stands down once the buyer has chosen a sector', () => {
    const { ctx } = withWorkplace('yes build me that shortlist', { sector: 'Sector 78' })
    assert.equal(commuteShortlistHandler.matches(ctx), false, 'the sector paths own the turn from here')
  })

  it('stands down when a project is in scope', () => {
    const { ctx } = withWorkplace('yes show me', { projectNames: ['ATS Nobility'] })
    assert.equal(commuteShortlistHandler.matches(ctx), false)
  })
})

describe('statutory_tax answers the question, not just the topic', () => {
  // "Can I buy a flat without paying stamp duty and registration if the builder
  // gives me a builder-buyer agreement on stamp paper?" returned the rate table
  // and nothing else. The table says "Mandatory" in a column, which is not an
  // answer — and silence on the premise reads as the arrangement working. A
  // buyer who acts on that loses both the flat and the money.
  for (const q of [
    'Can I buy a flat without paying stamp duty and registration if the builder gives me a builder-buyer agreement on stamp paper?',
    'how do I avoid stamp duty',
    'can I skip registration and just do a notarised agreement',
    'what if I pay a cash component to reduce the registry value',
  ]) {
    it(`refuses the premise: "${q.slice(0, 48)}"`, async () => {
      const { ctx, out } = makeContext({ message: q, flags: { isStatutoryTaxQuery: true } })
      await statutoryTaxHandler.handle(ctx)
      const text = tokenText(out)
      assert.match(text, /^\*\*No —/, 'the answer must lead with the refusal, not the rate table')
      assert.match(text, /does not transfer ownership|not legally yours/i)
      // And it still has to be useful: name what legitimately reduces the bill.
      assert.match(text, /female primary owner/i)
    })
  }

  it('does not lecture a buyer who only asked what the rates are', async () => {
    const { ctx, out } = makeContext({
      message: 'what is the stamp duty in UP',
      flags: { isStatutoryTaxQuery: true },
    })
    await statutoryTaxHandler.handle(ctx)
    const text = tokenText(out)
    assert.ok(!/^\*\*No —/.test(text), 'a plain rate question gets the rates')
    assert.match(text, /Statutory taxes & registration charges/)
  })
})

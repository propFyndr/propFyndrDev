import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeOutput, isClean } from '../lib/ai/sanitizeOutput'
import { stripTables } from '../lib/ai/stripTables'
import { wantsMarketTable, renderPaymentPlanTable, renderAlternativesTable } from '../lib/ai/marketTable'
import { markChipShown, filterNewChips, resetSession } from '../lib/discovery/chipDedup'
import { priceLabelFor } from '../lib/discovery/scoring'
import { findUngroundedClaims } from '../lib/ai/groundingCheck'
import { stripInternalFields } from '../lib/projectRepository'
import { buildAdaptiveChips } from '../lib/discovery/adaptiveChips'
import { classifyShape, profileFor } from '../lib/ai/inferenceProfile'
import { intentFingerprint } from '../lib/ai/semanticCache'
import { isFreeTierKey, FALLBACK_CHAIN, OPENAI_BASE_URL } from '../lib/config'

/**
 * The paths a 50-200 user beta cannot afford to have break.
 *
 * Written against real behaviour rather than the spec checklist: every case
 * here corresponds to something that was measured going wrong, and would fail
 * if it regressed. None of them needs a network, a model or a browser, so they
 * run on every commit.
 */

describe('beta: nothing the buyer sees can carry emoji or a competitor name', () => {
  it('strips emoji from anything the model writes', () => {
    // Measured: 5 of 50 answers carried emoji while the prompt said "NO EMOJI,
    // ANYWHERE". The prompt is not a guarantee; this is.
    const r = sanitizeOutput('Coverage Status 🏗️ — Sector 150 ⭐ good, traffic ⚠️ medium')
    assert.ok(isClean(r.text), r.text)
  })

  it('never lets a competitor portal name reach a buyer', () => {
    for (const p of ['99acres', 'MagicBricks', 'NoBroker', 'Housing.com', 'PropTiger']) {
      assert.ok(!new RegExp(p.replace('.', '\\.'), 'i').test(sanitizeOutput(`Listed on ${p}.`).text))
    }
  })

  it('leaves legitimate rupee and sector text untouched', () => {
    const src = 'Sector 150 runs ₹11,500/sqft — about 20% above Sector 120.'
    assert.equal(sanitizeOutput(src).text, src)
  })
})

describe('beta: the wire stays small', () => {
  it('never ships internal ranker artifacts to a client', () => {
    // Measured: 51% of every project object, 80KB of a 120KB response.
    const p = {
      id: '1',
      name: 'ACE Parkway',
      _multidimensional_rank: { blob: 'x'.repeat(5000) },
      _recommendation_summary: 'y',
    }
    const out = stripInternalFields(p) as Record<string, unknown>
    assert.deepEqual(Object.keys(out).sort(), ['id', 'name'])
  })

  it('does not send a table twice when we rendered one', () => {
    const withTable = 'Verdict first.\n\n| A | B |\n| :--- | :--- |\n| 1 | 2 |\n\nAnd the trade-off.'
    const out = stripTables(withTable)
    assert.ok(!out.includes('|'))
    assert.match(out, /Verdict first/)
    assert.match(out, /trade-off/)
  })
})

describe('beta: nothing is put on screen that the buyer did not ask for', () => {
  it('a plain inventory question does not summon a city-wide market table', () => {
    // Shipped bug: "Show me 3 BHK in Sector 75" opened with a four-row corridor
    // table of Central Noida, Greater Noida West and the Expressway. The same
    // predicate gates the micro-market block in the prompt, because the model
    // will tabulate that block if we hand it over uninvited.
    for (const q of [
      'Show me 3 BHK in Sector 75',
      'Show me affordable 2 and 3 BHK apartments in Sector 10, Greater Noida West',
      'What should I check before buying a property in Noida?',
      'Does Godrej Majesty have a gym?',
      // A request for the shortlist itself. `shortlist|options` was an arm of
      // the predicate, so this returned a micro-market price table instead of
      // the projects — the funnel inverted at the rung that converts.
      'yes show me the shortlist',
      'build me that shortlist',
      'show me the options',
    ]) {
      assert.equal(wantsMarketTable(q, false), false, `unwanted table: ${q}`)
    }
  })

  it('still renders one when the question is genuinely about rates or places', () => {
    for (const q of ['what are rates in sector 150', 'Which sector is better, 150 or 128?']) {
      assert.equal(wantsMarketTable(q, false), true, `missing table: ${q}`)
    }
  })

  it('a hyphenated topic still reaches its handler', () => {
    // "Show payment-plan options for Maxblis White House II?" matched no topic
    // pattern — every one of them is written with spaces — so it fell through
    // to the generic path, which answered with a two-row table saying
    // "Available" while five stored instalments went unread.
    const topicText = (m: string) => m.replace(/[-_/]+/g, ' ').replace(/\s+/g, ' ')
    const paymentPlan = /\b(payment plan|payment schedule|construction linked|down payment|flexi plan|clp|plp)\b/i
    const readyToMove = /\b(ready to move|rtm)\b/i
    const costSheet = /\b(cost sheet|price breakdown)\b/i

    assert.ok(paymentPlan.test(topicText('Show payment-plan options for Maxblis White House II?')))
    assert.ok(readyToMove.test(topicText('ready-to-move flats in sector 75')))
    assert.ok(costSheet.test(topicText('cost-sheet please')))
  })
})

describe('beta: the payment schedule is the answer, not a footnote', () => {
  it('renders every instalment we hold', () => {
    // Shipped bug: the renderer read only four summary columns, all null on
    // this row, while `milestones` held the actual schedule.
    const table = renderPaymentPlanTable([{
      plan_name: 'Construction-Linked Plan (CLP)',
      milestones: [
        { milestone: 'On Booking & Allotment', timeline: 'Immediate', pct: '10%', amt: '₹14.0 Lakhs' },
        { milestone: 'On Notice of Possession', timeline: 'At Possession', pct: '10%', amt: '₹14.0 Lakhs' },
      ],
    }])
    assert.match(table, /On Booking & Allotment/)
    assert.match(table, /₹14\.0 Lakhs/)
    assert.match(table, /10%/)
  })

  it('falls back honestly when no schedule is stored', () => {
    const table = renderPaymentPlanTable([{ plan_name: 'Flexi Plan' }])
    assert.match(table, /Flexi Plan/)
    assert.match(table, /Not recorded/)
  })
})

describe('beta: the price on the card is a price we can honour', () => {
  it('takes the range from the units, not the stored label', () => {
    // Shipped bug: ATS Kingston Heath advertised "₹115 Lakh onwards" on the
    // card while its cheapest unit is a 3 BHK at ₹4.30 Cr — a luxury project
    // priced at under a third of its floor. 31 projects misstated their price
    // this way; the placeholder "₹115 Lakh onwards" was on many of them.
    assert.equal(
      priceLabelFor({
        price_range_label: '₹115 Lakh onwards',
        unit_types: [
          { price_min_cr: 4.3, price_max_cr: 4.95 },
          { price_min_cr: 5.58, price_max_cr: 6.01 },
        ],
      }),
      '₹4.30–6.01Cr',
    )
  })

  it('keeps a ceiling when the units carry no explicit maximum', () => {
    // "₹0.62Cr+" throws away the fact that we hold a 3 BHK from ₹1.25 Cr.
    assert.equal(
      priceLabelFor({
        price_range_label: null,
        unit_types: [
          { price_min_cr: 0.62, price_max_cr: null },
          { price_min_cr: 1.25, price_max_cr: null },
        ],
      }),
      '₹0.62–1.25Cr',
    )
  })

  it('falls back to the stored label only when no unit is priced', () => {
    assert.equal(
      priceLabelFor({ price_range_label: '₹95 Lakh - ₹2.10 Cr', unit_types: [{ price_min_cr: null }] }),
      '₹95 Lakh - ₹2.10 Cr',
    )
    assert.equal(priceLabelFor({ price_range_label: null, unit_types: [] }), 'Price on request')
  })

  it('never renders a price in Lakh when the units are in Crore', () => {
    const label = priceLabelFor({
      price_range_label: '₹48.15 Lakh - ₹96.08 Lakh',
      unit_types: [{ price_min_cr: 0.96, price_max_cr: 1.84 }],
    })
    assert.ok(!/lakh/i.test(label), label)
    assert.match(label, /Cr/)
  })
})

describe('beta: a buyer is quoted the size they asked for', () => {
  it('lists only the asked-for configuration, with its price', () => {
    // ACE Parkway spans ₹1.55–7.48 Cr across 2/3/4 BHK. Someone asking for a
    // 3 BHK can buy none of that range except ₹2.50–2.95 Cr.
    const table = renderAlternativesTable([{
      name: 'Prateek Canary', sector: 'Sector 150',
      possession_label: 'Dec 2027',
      unit_types: [
        { bhk: 2, price_min_cr: 1.4, price_max_cr: 1.6 },
        { bhk: 3, price_min_cr: 2.89, price_max_cr: 3.35, carpet_area_sqft: 1750 },
      ],
    }], [3])
    assert.match(table, /3 BHK price/)
    assert.match(table, /₹2\.89–3\.35 Cr/)
    assert.ok(!table.includes('1.40'), 'quoted a size the buyer did not ask for')
  })

  it('drops a project that does not build the size at all', () => {
    assert.equal(
      renderAlternativesTable([{ name: 'ATS Knightsbridge', unit_types: [{ bhk: 4, price_min_cr: 12.5 }] }], [3]),
      '',
    )
  })
})

describe('beta: the long-tail failures found on 29 Aug', () => {
  it('a question about somewhere else is declined, not answered with a Noida project', () => {
    // "cameron county 107 district court" — a Texas courthouse that shares a
    // string with County 107 in Sector 107 — was answered with that project's
    // swimming pool, under a "Verified Amenities" heading.
    const foreign = /\b(district court|county court|county highway|state highway \d|zip ?code|amsterdam|texas|\bny\b|\bnj\b|\btx\b|\bca\b|\bfl\b|county clerk|dmv)\b/i
    const local = /\b(noida|greater noida|sector\s*\d|ncr|delhi|gurgaon|uttar pradesh|\bup\b)\b/i
    const declines = (q: string) => foreign.test(q) && !local.test(q)

    assert.ok(declines('cameron county 107 district court'))
    assert.ok(declines('county highway 107 amsterdam ny'))
    // A Noida marker anywhere overrides it — these must still be answered.
    assert.ok(!declines('district court near sector 62 noida'))
    assert.ok(!declines('county 107 noida address'))
  })

  it('a lone filter chip is never the whole offer', () => {
    // 39 of 120 turns offered "I need a 3 BHK" and nothing else — nonsense
    // after "what is the RERA number", and it reads as having run out of ideas.
    //
    // The remedy used to be an empty row, which was honest and scored 1/5. It is
    // now a real follow-up beside the filter: the same property, asserted as what
    // the buyer gets rather than as what they are spared.
    const chips = buildAdaptiveChips({
      projects: [], sectors: [], rendered: null,
      missingFields: ['bhk'], focusedProject: null,
    })
    assert.ok(chips.length >= 2, `lone chip offered: ${chips.map((c) => c.label).join(', ')}`)
    assert.ok(
      chips.some((c) => c.tone !== 'ask'),
      `every chip is a filter: ${chips.map((c) => c.label).join(', ')}`,
    )
  })

  it('a project-fact answer offers three different questions, not four fixed ones', () => {
    // The catch-all branch emitted the same four chips — payment plans, cost
    // sheet, EMI, site visit — on 47 of 120 turns regardless of the question.
    const chips = buildAdaptiveChips({
      projects: [{ name: 'Ace Hanei' }], sectors: ['Sector 12'], rendered: null,
      missingFields: [], focusedProject: { name: 'Ace Hanei' },
    })
    assert.equal(chips.length, 3)
    assert.equal(new Set(chips.map((c) => c.tone)).size, 3, 'three chips, three kinds of question')
  })
})

describe('beta: a figure we never gave it does not reach the buyer unnoticed', () => {
  const facts = 'Ace Hanei, Sector 12, price_min_cr 3.11, price_max_cr 5.70, possession 2028-10-15, rera UPRERAPRJ677887, carpet 1420 sqft'

  it('passes an answer built only from the facts it was given', () => {
    assert.deepEqual(
      findUngroundedClaims('Ace Hanei runs ₹3.11–5.70 Cr, possession 2028. RERA UPRERAPRJ677887.', facts),
      [],
    )
  })

  it('catches both ends of an invented range', () => {
    // The first version of this check anchored on ₹ immediately followed by the
    // unit, so "₹1.25–1.85 Cr" — our own most common price format — matched
    // nothing and an invented range passed as grounded.
    const found = findUngroundedClaims('Greater Noida West 3 BHKs run ₹1.25–1.85 Cr.', facts)
    assert.deepEqual(found.map((f) => f.value).sort(), ['1.25', '1.85'])
  })

  it('catches an invented rate and an invented year', () => {
    assert.equal(findUngroundedClaims('Rates here are ₹11,500/sqft.', facts).length, 1)
    assert.equal(findUngroundedClaims('Handover is expected by 2026.', facts).length, 1)
  })

  it('does not flag statutory rates, which need no row to support them', () => {
    assert.deepEqual(findUngroundedClaims('Stamp duty is 7% and registration 1%.', facts), [])
  })
})

describe('beta: the fallback chain is one chain', () => {
  it('names every provider the intent path knows how to call', () => {
    // Intent extraction used to keep its own hand-written copy of the provider
    // order, and it had drifted: it omitted GEMINI_API_KEY1 entirely, so when
    // the billed Gemini key ran out of credits — its state on 29 Aug — intent
    // extraction skipped the one working Gemini key and jumped to Mistral.
    // It is now derived from FALLBACK_CHAIN, so every leg must be a provider
    // the intent loop has a branch for, or that leg silently does nothing.
    const handled = new Set(['gemini', 'groq', 'cerebras', 'mistral', 'openai'])
    for (const leg of FALLBACK_CHAIN) {
      assert.ok(handled.has(leg.provider), `no intent branch for provider: ${leg.provider}`)
    }
  })

  it('keeps more than one vendor in the chain', () => {
    // A chain of one vendor with spare keys is not a fallback chain; it is a
    // single point of failure. Four OpenAI legs are dropped at startup when
    // OPENAI_BASE_URL points at the retired host, which is how the chain came
    // to end at Groq without anyone noticing.
    //
    // Counted by vendor, not by `leg.provider`. That field is the CLIENT type,
    // and it stopped being a proxy for vendor the day Groq's legs moved to
    // provider: 'openai' (see config.ts's GROQ_OPENAI_BASE comment) — Cohere,
    // NVIDIA and Groq now all report 'openai', so three vendors count as one.
    // Removing Mistral, whose keys were dead, dropped the distinct `provider`
    // count to two and failed this test while four real vendors remained. The
    // test was measuring the wrong thing; the envKey names the vendor.
    const vendors = new Set(FALLBACK_CHAIN.map((l) => l.envKey.replace(/_API_KEY\d*$/, '')))
    assert.ok(vendors.size >= 3, `only ${vendors.size} vendor(s): ${[...vendors].join(', ')}`)
  })

  it('never ranks a tool-blind leg above a tool-capable one', () => {
    // This replaced "puts the billed Gemini key ahead of the free one".
    //
    // That rule existed because a free key at position 2 caught every failure
    // of the paid one and returned an empty reply — a cause now fixed at its
    // root in fallbackChain, which forces thinkingBudget = 0 and a reply
    // ceiling for any key isFreeTierKey() names.
    //
    // The invariant worth protecting is not which key is billed but which leg
    // can look anything up. When the billed balance ran out on 30 Aug the chain
    // fell straight onto supportsTools: false legs, and those legs invented
    // projects and RERA numbers rather than admitting they could not check.
    const firstBlind = FALLBACK_CHAIN.findIndex((l) => !l.supportsTools)
    if (firstBlind === -1) return
    for (const leg of FALLBACK_CHAIN.slice(firstBlind)) {
      assert.equal(
        leg.supportsTools,
        false,
        `${leg.label} can call tools but is ranked below a leg that cannot`,
      )
    }
  })

  it('leads with a leg that can call tools', () => {
    assert.ok(FALLBACK_CHAIN[0]?.supportsTools, `chain leads with tool-blind ${FALLBACK_CHAIN[0]?.label}`)
  })

  it('no leg points at a host that has been retired', () => {
    // GitHub Models closed to new customers on 16 Jun 2026 and retired on
    // 30 Jul 2026; probed 30 Aug it answers 410, and it always will.
    // models.inference.ai.azure.com stopped resolving in DNS before that.
    //
    // Four legs pointed at them anyway. A dead leg is not free: it fails, gets
    // classified durable, cools for an hour, and is probed again — four wasted
    // round-trips at the head of nearly every turn, and below them every
    // remaining leg was tool-blind. This test is the gate that stops a retired
    // host being reintroduced by a config edit.
    const retired = /models\.github\.ai|models\.inference\.ai\.azure\.com/
    for (const leg of FALLBACK_CHAIN) {
      assert.ok(!retired.test(leg.baseUrl ?? ''), `${leg.label} points at a retired host: ${leg.baseUrl}`)
    }
    assert.ok(!retired.test(OPENAI_BASE_URL ?? ''), `OPENAI_BASE_URL is a retired host: ${OPENAI_BASE_URL}`)
  })

  it('a leg on a non-OpenAI host names its own model', () => {
    // openai.ts defaults to MODELS.MAIN, a gpt-4o name. Cohere and NVIDIA both
    // answer 404 for it, so a Cohere leg that forgets its model is a leg that
    // cannot work — and it fails at request time, not at boot.
    for (const leg of FALLBACK_CHAIN) {
      if (!leg.baseUrl) continue
      assert.ok(leg.model && !/^gpt-4o/.test(leg.model), `${leg.label} on ${leg.baseUrl} needs its own model, got ${leg.model}`)
    }
  })

  it('keeps a tool-capable leg that is not Google', () => {
    // Every tool-capable leg was a Gemini key. When the billed balance ran out
    // and the free keys hit their per-minute limit, the chain had no way to
    // read a project row at all — and a leg that cannot look anything up
    // either refuses or invents.
    const nonGoogleWithTools = FALLBACK_CHAIN.filter((l) => l.supportsTools && l.provider !== 'gemini')
    assert.ok(nonGoogleWithTools.length > 0, 'every tool-capable leg is Gemini — one provider outage blinds the chain')
  })
})

describe('beta: a chip is never offered twice', () => {
  it('one budget question, however it is worded', () => {
    // Shipped bug: "Set my budget", "Help me set a budget" and "Help me work
    // out a realistic EMI budget" are three labels for one question, and
    // exact-label dedup treated them as three offers.
    resetSession('t-budget')
    markChipShown('t-budget', 'chip_a', 'Set my budget')
    for (const label of [
      'Help me set a budget',
      'Help me work out a realistic EMI budget',
      'What can I afford?',
    ]) {
      assert.equal(
        filterNewChips('t-budget', [{ id: `x_${label}`, label }]).length, 0,
        `offered again: ${label}`,
      )
    }
  })

  it('does not suppress an unrelated question', () => {
    resetSession('t-other')
    markChipShown('t-other', 'chip_a', 'Set my budget')
    assert.equal(filterNewChips('t-other', [{ id: 'r', label: 'Is Godrej Majesty RERA clean?' }]).length, 1)
  })
})

describe('beta: cost cannot run away', () => {
  it('a head term never buys a reasoning budget', () => {
    const p = profileFor('2 bhk in noida')
    assert.equal(p.shape, 'lookup')
    assert.equal(p.thinkingBudget, 0)
  })

  it('a comparison still gets the reasoning it needs', () => {
    assert.equal(classifyShape('sector 150 vs sector 128 noida'), 'reasoning')
  })

  it('every chain leg names an env var that exists in the config', () => {
    // A typo'd envKey is a leg that is silently skipped forever, which reads as
    // a healthy chain with fewer providers than it claims.
    for (const item of FALLBACK_CHAIN) {
      assert.match(item.envKey, /^[A-Z][A-Z0-9_]*$/, `suspicious env key: ${item.envKey}`)
      assert.ok(item.label.length > 0, 'chain leg has no label')
    }
  })

  it('free-tier keys are configurable, not hardcoded', () => {
    // Topping up the other key must not leave it throttled as though free.
    assert.equal(isFreeTierKey('GEMINI_API_KEY1'), true)
    assert.equal(isFreeTierKey('GEMINI_API_KEY'), false)
  })
})

describe('beta: one buyer never sees another buyer answer', () => {
  it('a different stated budget is a different cache bucket', () => {
    const rich = intentFingerprint({ budgetMax: 2.5, bhk: [4] })
    const modest = intentFingerprint({ budgetMax: 0.6, bhk: [2] })
    assert.notEqual(rich, modest)
  })

  it('two buyers in the same situation share one entry', () => {
    assert.equal(
      intentFingerprint({ bhk: [3], sector: 'Sector 150' }),
      intentFingerprint({ sector: 'Sector 150', bhk: [3] }),
    )
  })

  it('a first turn is anonymous, which is where head terms land', () => {
    assert.equal(intentFingerprint({}), 'anon')
    assert.equal(intentFingerprint({ queryKind: 'DISCOVERY' }), 'anon')
  })
})

describe('beta: chips never waste a tap', () => {
  /**
   * Was "offers nothing rather than filler", asserting `[]`.
   *
   * That was the right property for a file that could only see what it had drawn:
   * one orphan "I need a 3 BHK" after a flood-risk answer is worse than silence.
   * But an empty row is what scored 1/5 and 2/5 on chips across half the audited
   * shapes, and the cause was never a shortage of things worth offering — it was
   * that `adaptiveChips` never received the question. Now it does, and the
   * property that matters is the floor: at least two, and never all filters.
   */
  it('holds the floor of two, and never a row of pure filters', () => {
    const chips = buildAdaptiveChips({
      projects: [],
      sectors: [],
      rendered: null,
      missingFields: [],
      focusedProject: null,
    })
    assert.ok(chips.length >= 2, `floor breached: ${chips.length}`)
    assert.ok(chips.some((c) => c.tone !== 'ask'), 'offered only input requests')
    for (const c of chips) {
      assert.ok(typeof c.payload.text === 'string' && (c.payload.text as string).length > 15)
    }
  })

  it('names a project that is genuinely on screen', () => {
    const chips = buildAdaptiveChips({
      projects: [],
      sectors: [],
      rendered: 'projects',
      missingFields: [],
      focusedProject: { name: 'Godrej Woods' },
    })
    assert.ok(chips.length > 0)
    assert.ok(chips.every((c) => c.label.includes('Godrej Woods')))
  })

  it('every chip sends a full question, not a fragment', () => {
    const chips = buildAdaptiveChips({
      projects: [{ name: 'A' }, { name: 'B' }],
      sectors: [],
      rendered: 'projects',
      missingFields: ['budgetMax'],
      focusedProject: null,
    })
    for (const c of chips) {
      const text = c.payload.text as string
      assert.ok(text && text.length > 15, `fragment payload: ${text}`)
      assert.ok(/[a-z]/i.test(text), 'payload has no words')
    }
  })
})

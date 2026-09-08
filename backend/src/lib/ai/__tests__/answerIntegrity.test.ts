import test from 'node:test'
import assert from 'node:assert/strict'
import { rewriteFraming, scanDisclosure, checkAnswerIntegrity } from '../answerIntegrity'
import { setKnownNamesForTest } from '../toolBlindGuard'

// Keep the fabrication half off the database; these cases are about warnings.
setKnownNamesForTest({ projects: [], builders: ['Antriksh', 'Ajnara', 'Supertech Limited'] })

/**
 * Every DISCARD string here was produced by the live pipeline against the real
 * database, not invented for the test. Every KEEP string is either a real
 * answer from the same runs or one of our own coverage replies, which are the
 * sentences a careless pattern eats first.
 */

const DISCARD: Array<[string, string]> = [
  [
    'narrates the request and names the prompt',
    'The user asks "What about the second one?", but the provided verified facts block only contains information for a single project: Samridhi Daksh Avenue.',
  ],
  [
    'blames the prompt for a gap',
    'We only have records for Samridhi Daksh Avenue in Sector 150 Noida, as no second project was provided in the database.',
  ],
  [
    'denies coverage in words rather than digits',
    'Our verified database currently contains details for only one project, Samridhi Daksh Avenue in Sector 150.',
  ],
  [
    'sizes the table on a greeting',
    'We currently maintain verified data on 280 projects across 61 sectors in Noida, with options ranging from ₹41 Lakhs to ₹12.5 Crores.',
  ],
  [
    'sizes the table in our own house style',
    'We hold 280 projects across 61 sectors, from ₹41 L to ₹12.5 Cr.',
  ],
  [
    'sizes the table by builder count instead of sector count',
    'We have this many details. We have 280 projects across 117 builders and all.',
  ],
  [
    'a reasoning model narrates its own chain-of-thought instead of answering',
    "Here's a thinking process:\n\n1.  **Analyze User Input**: User asks \"airbnb properties in noida\". This is a request for short-term rental / Airbnb-type properties in Noida.",
  ],
  [
    'a reasoning model reasons about our own continuation instruction instead of answering',
    "Here's a thinking process:\n\n The user is saying my previous message was cut off mid-word due to a length limit, and they want me to finish the exact word/sentence it ended on if incomplete.",
  ],
  [
    'answers the count question directly',
    'Our database has 280 projects right now.',
  ],
  [
    'reports the shape of its input',
    'The context provided only contains information for one sector, so I cannot compare.',
  ],
  [
    'breaks character',
    'As an AI language model, I can only report what is in my context.',
  ],
]

const KEEP: string[] = [
  // A count of what is ON SCREEN is useful and is not the size of our table.
  'Three of these six projects are ready to move, and two have possession before 2027.',
  // Our own honest coverage reply, scoped to a sector rather than to the table.
  'Sector 2 has one project we hold verified data on — Eros Sampoornam by Eros Group from around ₹0.72 Cr.',
  // The other honest coverage reply.
  'We do not hold any projects from Skyline Group in Noida or Greater Noida, so there is nothing verified for me to show you.',
  // "not provided" about a BUILDER is a real fact a buyer needs.
  'The builder has not provided a possession date for Tower C, so treat the 2027 figure as indicative.',
  // A project's own unit count.
  'Divine Meadows is a 1,100-unit ready gated community across 9.5 acres in Sector 108.',
  // Ordinary advisory prose.
  'ATS Pious Hideaways is an 18-acre Spanish-themed community with 82% open green space, priced from ₹1.85 Cr.',
  // A sector-level count, computed from rows, which the market tables print.
  'Sector 150 holds 19 projects, of which 8 are ready to move.',
]

for (const [label, text] of DISCARD) {
  test(`discards: ${label}`, () => {
    const v = scanDisclosure(text)
    assert.ok(v.length > 0, `should have been flagged: ${text}`)
  })
}

for (const text of KEEP) {
  test(`keeps: ${text.slice(0, 48)}…`, () => {
    const v = scanDisclosure(text)
    assert.deepEqual(v, [], `honest answer was flagged as ${JSON.stringify(v)}`)
  })
}

test('framing is rewritten, not discarded', () => {
  const cases: Array<[string, string]> = [
    ['Here are the verified matching projects in our database:', 'in our verified data'],
    ['Here are the matches from our verified database:', 'from our verified data'],
    ['That project is not in the database.', 'not something we hold'],
  ]
  for (const [input, expected] of cases) {
    const out = rewriteFraming(input)
    assert.ok(out.rewrites > 0, `no rewrite for: ${input}`)
    assert.ok(out.text.includes(expected), `expected "${expected}" in "${out.text}"`)
    assert.ok(!/database/i.test(out.text), `"database" survived in "${out.text}"`)
  }
})

test('a rewritten answer still passes the gate', () => {
  const out = rewriteFraming('Here are the verified matching projects in our database:')
  assert.deepEqual(scanDisclosure(out.text), [])
})

test('a reframed denial is still caught — the rewrite must not launder it', () => {
  // rewriteFraming turns "our verified database" into "our verified data".
  // If OUR_STORE did not cover that phrasing, running the rewrite first would
  // have made the disclosure invisible to the scan. It runs second for that
  // reason, and the pattern covers it as well.
  const v = scanDisclosure('Our verified data currently contains details for only one project, Samridhi Daksh Avenue.')
  assert.ok(v.length > 0, 'reframed denial slipped through')
})

test('the model reading its own rulebook aloud is discarded', () => {
  // Measured live on "sectors 1 and 2". The tight `the user (asks|said)`
  // pattern missed "The user simply said", and nothing at all covered the
  // model reciting prompt rules as bullets to the buyer.
  const leaked = [
    'The user simply said "sectors 1 and 2". Since no search was run this turn, I need to ask a clarifying question.',
    'Wait, looking at the rules:\n- **One question max.** Ask for the single thing that changes what we show next.',
    '- **No search was run this turn.** Do not say a sector is absent or not tracked.',
    'The user mentioned Sector 150, so per the rules I should show projects.',
  ]
  for (const text of leaked) {
    assert.ok(scanDisclosure(text).length > 0, `slipped through: ${text.slice(0, 60)}`)
  }
})

test('ordinary advisory prose about a buyer is not a meta-leak', () => {
  // "Wait" mid-sentence, and talking ABOUT the buyer's situation, are fine.
  for (const text of [
    'Sector 150 suits a buyer who can wait for possession and wants low density.',
    'If you would rather not wait two years, Sector 137 is ready to move today.',
    'Buyers in this band usually weigh the metro against the extra carpet area.',
  ]) {
    assert.deepEqual(scanDisclosure(text), [], `honest prose flagged: ${text.slice(0, 60)}`)
  }
})

test('a sector-scoped count of OUR holdings is still a disclosure', () => {
  // Measured live on "sectors 1 and 2". "verified" sat between the number and
  // the noun, which the earlier pattern did not allow. Scoping the count to a
  // sector does not make it the buyer's business — it is still the size of our
  // table, just sliced.
  for (const text of [
    'We track 12 verified projects in Sector 1 alone, with 3BHK spanning ₹1.05Cr to ₹2.45Cr.',
    'We hold 19 verified projects in Sector 150.',
    'I have data on 8 ready-to-move properties there.',
  ]) {
    assert.ok(scanDisclosure(text).length > 0, `slipped through: ${text.slice(0, 55)}`)
  }
})

test('a count of what is ON SCREEN is still allowed', () => {
  // The distinction that keeps this useful: counting the shortlist in front of
  // the buyer is a fact about their screen, not about our table.
  for (const text of [
    'Three of these six are ready to move.',
    'Sector 150 holds 19 projects, of which 8 are ready to move.',
    'Two of the four you are looking at have possession before 2027.',
  ]) {
    assert.deepEqual(scanDisclosure(text), [], `honest count flagged: ${text.slice(0, 55)}`)
  }
})

test('telling a buyer to avoid an unflagged developer is discarded', async () => {
  // BUILDER DATA RULES: "Never name a non-flagged builder as risky — this
  // creates defamation risk." Measured in the demo replay, a leg wrote "**Skip
  // Antriksh and Ajnara projects** – they carry low-risk or legal flags",
  // inventing the flags as it went. That is a published claim about a real
  // company's conduct with nothing behind it.
  const prompt = 'Verified facts: Antriksh Golf View, Sector 78. Ajnara Le Garden, Sector 16B.'
  const v = await checkAnswerIntegrity('Skip Antriksh and Ajnara projects — they carry legal flags.', prompt)
  assert.ok(v.some(x => x.kind === 'unfounded_warning'), `not caught: ${JSON.stringify(v)}`)
})

test('a warning the prompt actually supplied is kept', async () => {
  // HARD RULE 6a requires disclosing a real legal_flag, so the guard must not
  // block the disclosure it exists to protect.
  const prompt = 'BLOCKED BUILDERS — never recommend for new purchase: **Supertech Limited** (court proceedings).'
  const v = await checkAnswerIntegrity(
    'I would avoid Supertech for a new purchase — the group is in court proceedings.',
    prompt,
  )
  assert.equal(v.some(x => x.kind === 'unfounded_warning'), false, `honest disclosure blocked: ${JSON.stringify(v)}`)
})

test('ordinary advice to avoid a thing is not a builder warning', async () => {
  for (const text of [
    'Avoid paying anything before you have seen the RERA registration.',
    'Skip the corner units if you want afternoon shade.',
    'Be wary of any broker asking for cash outside the agreement.',
  ]) {
    const v = await checkAnswerIntegrity(text, 'Verified facts: nothing relevant.')
    assert.equal(v.some(x => x.kind === 'unfounded_warning'), false, `flagged honest advice: ${text}`)
  }
})

test('a raw JSON payload is not an answer', () => {
  // Measured: "Show me 3 BHK projects in Sector 150 under 2 crore" was answered
  // with 1,400 characters of pretty-printed rows, internal ids and all, cut off
  // mid-array by the reply ceiling. Every existing check passed it — it names
  // only real projects, quotes no rule and claims no score.
  const dump = `[
    {
        "id": "88319d1f-5049-410e-9c2a-2913c1f373b3",
        "name": "ATS Pious Hideaways / Orchards",
        "sector": { "name": "Sector 150" },
        "status": "under_construction",
        "price_min_cr": 1.85,
        "rera_number": "UPRERAPRJ1503"
    }`
  assert.ok(scanDisclosure(dump).some(v => v.kind === 'raw_payload'), 'JSON dump slipped through')
})

test('an internal id never reaches the buyer', () => {
  for (const text of [
    '- **[Godrej Nest](#entity:09f087b6-5288-488d-8482-e572f09e4181)** (Sector 150) — ₹2.1–₹3.1 Cr',
    'The project id is 88319d1f-5049-410e-9c2a-2913c1f373b3.',
  ]) {
    assert.ok(scanDisclosure(text).some(v => v.kind === 'raw_payload'), `id leaked: ${text.slice(0, 50)}`)
  }
})

test('ordinary prose with numbers, quotes and brackets is untouched', () => {
  for (const text of [
    'ATS Pristine is priced from ₹2.2 Cr and its RERA number is UPRERAPRJ1503.',
    'The builder said "possession by June 2026", which is a claim, not a guarantee.',
    'Three options [ready to move] sit inside your band: 1.85, 1.96 and 2.08 crore.',
    '| Project | Price |\n| :--- | :--- |\n| **ACE Parkway** | ₹1.55 Cr |',
  ]) {
    assert.deepEqual(scanDisclosure(text).filter(v => v.kind === 'raw_payload'), [], `flagged prose: ${text.slice(0, 50)}`)
  }
})

test('an analyst score reaching the answer is caught at runtime', () => {
  // `opaqueScores.test.ts` is a SOURCE check and stops a new emitter appearing.
  // Twice a score arrived by a path it was not watching — seven emitters, then
  // `builderOnTimeDeliveryPercent`, a name that promised a unit its value did
  // not have. The source test prevents the class; this catches the instance.
  for (const text of [
    'Ready-to-move with a 92% builder delivery score and strong resale liquidity.',
    'The developer scores 87/100 on our delivery assessment.',
    'Construction quality rating of 80%, reviewed per delivered project.',
  ]) {
    assert.ok(scanDisclosure(text).some(v => v.kind === 'opaque_score'), `slipped: ${text.slice(0, 48)}`)
  }
})

test('a real percentage is not a score', () => {
  // Percentages are usually genuine facts here. Flagging these would gut the
  // product's most useful sentences.
  for (const text of [
    'The project features 82% open green space across 18 acres.',
    '5% GST applies on the agreement value for under-construction purchases.',
    'UP stamp duty is 7% of the agreement or circle value, whichever is higher.',
    'Registration is 1% and 80% of the podium is landscaped.',
    'Sector 137 has 10 of 10 projects complete — 100% ready to move.',
  ]) {
    assert.deepEqual(
      scanDisclosure(text).filter(v => v.kind === 'opaque_score'), [],
      `real figure flagged: ${text.slice(0, 48)}`,
    )
  }
})

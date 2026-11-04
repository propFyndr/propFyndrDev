import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { ASKS_FOR_THE_CATCH, catchAnswer, catchAnswerPair, riskRecord, secondProjectInText } from '../projectCatch'
import { sanitizeOutput } from '../../../ai/sanitizeOutput'

const base = {
  name: 'Test Heights', status: 'under_construction', possession_date: null, possession_label: 'Under Construction',
  oc_status: null, rera_number: 'UPRERAPRJ000001', project_risk_flag: null, litigation_count: null,
  ongoing_litigation_count: null, nclt_moratorium_active: null, location_concerns: [],
  flood_waterlogging_risk: null, amitabh_kant_clearance: null,
  registry_status: null, maintenance_per_sqft_monthly: null, water_source_type: null,
  builder: { name: 'Test Builder', insolvency_history: false, legal_flag: null, delayed_projects_count: null },
  unit_types: [],
} as any

describe('project catch', () => {
  it('recognises how buyers ask for the catch', () => {
    for (const q of [
      'whats the catch with godrej tropical isle? what will sales team not tell me',
      'any red flags in ATS Pious?',
      'downsides of Ace Parkway',
      'gulshan botnia mein kya dikkat hai',
    ]) assert.ok(ASKS_FOR_THE_CATCH.test(q), q)
    assert.ok(!ASKS_FOR_THE_CATCH.test('tell me about godrej tropical isle'))
  })

  it('states only what the rows show, and lists the gaps as questions', () => {
    const text = catchAnswer(base)
    assert.match(text, /we hold no possession date/)
    assert.doesNotMatch(text, /Possession on record: Under Construction/)
    assert.match(text, /What we do not hold/)
    // A schema-default `authority_dues_cleared: true` is neither good news nor bad.
    assert.doesNotMatch(text, /dues (?:cleared|in good standing)/i)
  })

  it('recognises "what could go wrong" and "is it safe" as the same question', () => {
    for (const q of [
      'what could go wrong with mahagun mezzaria?',
      'What can go wrong if I buy in Ace Parkway',
      'what are the risks of buying Godrej Woods',
      'is mahagun mezzaria safe to buy',
      'is mezzaria the safer buy?',
    ]) assert.ok(ASKS_FOR_THE_CATCH.test(q), q)
    assert.ok(!ASKS_FOR_THE_CATCH.test('what is the safety deposit for ace parkway'))
    // hard-43 bm2: a possession-timeline question that mentions risk is not a "catch" question.
    assert.ok(!ASKS_FOR_THE_CATCH.test('Is Supertech Supernova Astralis on track for possession, and what is the risk if it slips?'))
  })

  // safety40 before-run, 4 Nov 2026: the complaints question got the registration table, "OC and
  // court cases" got the OC table only, and "court cases" alone went to the amenity lane.
  it('recognises complaint, court-case, litigation and abeyance questions as risk questions', () => {
    for (const q of [
      'How many UP-RERA complaints are there against Mahagun Mezzaria?',
      'Does Mahagun Mezzaria have an occupancy certificate, and are there any court cases against it?',
      'Are there any court cases against Jaypee Klassic?',
      'any litigation on ACE Parkway?',
      'Is Migsun Wynn on the UP-RERA abeyance list?',
      'legal issues with supertech capetown?',
      'is amrapali dream valley under nclt',
    ]) assert.ok(ASKS_FOR_THE_CATCH.test(q), q)
    for (const q of ['does ace parkway have a tennis court', 'how do I file a complaint with UP-RERA', 'is there a basketball court in Gulshan Botnia', 'any complaints about water supply in Gulshan Botnia']) {
      assert.ok(!ASKS_FOR_THE_CATCH.test(q), q)
    }
  })

  it('names a RERA validity date that has passed, as our record, not as a ruling', () => {
    const now = new Date('2026-11-03')
    const text = catchAnswer({ ...base, rera_valid_until: new Date('2021-09-28') }, null, now)
    assert.match(text, /UP-RERA validity on record: 28 Sep 2021, which has passed/)
    assert.match(text, /extension/i)
    assert.doesNotMatch(catchAnswer({ ...base, rera_valid_until: new Date('2028-01-01') }, null, now), /validity on record/)
    assert.doesNotMatch(catchAnswer({ ...base, rera_valid_until: null }, null, now), /validity on record/)
  })

  it('states an approved UP-RERA complaint count with its source and read date, and says it is not a ruling', () => {
    const record = { project: 53, promoter: 59, readAt: new Date('2026-10-27T19:14:42Z') }
    const text = catchAnswer(base, record)
    assert.match(text, /53 complaints/)
    assert.match(text, /59 against the promoter/)
    assert.match(text, /UP-RERA lists 53 complaints against this project and 59 against the promoter, read on 27 Oct 2026\. A complaint is not a ruling\./)
    // The portal's address in a sentence makes the sanitizer delete that sentence, figures included.
    assert.doesNotMatch(text, /up-rera\.in/i)
    assert.match(text, /not a ruling/i)
    assert.doesNotMatch(text, /number of complaints against the project/i, 'must not also list it as a gap')
  })

  it('lists the complaint count as a gap when we hold no approved record', () => {
    assert.match(catchAnswer(base, null), /complaints against the project on the UP-RERA portal/i)
  })

  it('surfaces a missing RERA number and disagreeing price rows', () => {
    const text = catchAnswer({
      ...base,
      rera_number: null,
      unit_types: [{ bhk: 3, price_min_cr: 3.2, price_per_sqft: 17777 }, { bhk: 3, price_min_cr: 3.7, price_per_sqft: 14845 }],
    })
    assert.match(text, /no UP-RERA registration number/)
    assert.match(text, /3 BHK rows for this project disagree on price/)
  })
})

// Cycle 2, Day 1 task 4: the same six lines in chat and on the project page. Each line comes
// from a record or says "Not on record"; a public-record line carries its source and read date.
describe('risk record', () => {
  const now = new Date('2026-11-04')
  const keys = (r: ReturnType<typeof riskRecord>) => r.map((l) => l.key)

  it('always has the six lines, in order', () => {
    assert.deepEqual(keys(riskRecord(base, null, [], now)), ['registration', 'complaints', 'delay', 'occupancy', 'court', 'abeyance'])
  })

  it('says "Not on record" where we hold nothing, and never reassures', () => {
    const r = riskRecord(base, null, [], now)
    for (const k of ['complaints', 'court', 'abeyance', 'occupancy'] as const) {
      const line = r.find((l) => l.key === k)!
      assert.match(line.text, /^Not on record/, `${k}: ${line.text}`)
      assert.equal(line.flagged, false)
    }
    assert.doesNotMatch(r.map((l) => l.text).join(' '), /\b(?:clean|safe|no litigation|no delay)\b/i)
  })

  it('states a stored zero litigation count as stored', () => {
    const court = riskRecord({ ...base, litigation_count: 0 }, null, [], now).find((l) => l.key === 'court')!
    assert.match(court.text, /^None on record/)
  })

  it('flags a passed possession date on an unfinished project', () => {
    const delay = riskRecord({ ...base, possession_date: new Date('2025-06-30') }, null, [], now).find((l) => l.key === 'delay')!
    assert.equal(delay.flagged, true)
    assert.match(delay.text, /Jun 2025.*has passed/)
  })

  it('flags a ready-to-move listing with no occupancy certificate', () => {
    const oc = riskRecord({ ...base, status: 'ready_to_move' }, null, [], now).find((l) => l.key === 'occupancy')!
    assert.equal(oc.flagged, true)
    assert.match(oc.text, /no occupancy certificate/i)
  })

  it('states an approved UP-RERA order with its complaint number, order date, source and read date', () => {
    const order = { complaint_no: 'NCR144/01/115982/2024', bench: 'Bench 1 Gautam Budh Nagar', order_date: '06-06-2025', readAt: new Date('2026-11-04T08:40:00Z') }
    const court = riskRecord(base, null, [order], now).find((l) => l.key === 'court')!
    assert.equal(court.flagged, true)
    assert.match(court.text, /UP-RERA published an order on complaint NCR144\/01\/115982\/2024.*6 Jun 2025.*read on 4 Nov 2026/)
    assert.equal(court.source, 'UP-RERA')
    assert.equal(court.readAt, '2026-11-04T08:40:00.000Z')
  })

  it('carries the complaint count with its read date, in the owner wording', () => {
    const c = riskRecord(base, { project: 53, promoter: null, readAt: new Date('2026-10-27T19:14:42Z') }, [], now).find((l) => l.key === 'complaints')!
    assert.equal(c.text, 'UP-RERA lists 53 complaints against this project, read on 27 Oct 2026. A complaint is not a ruling.')
    assert.equal(c.readAt, '2026-10-27T19:14:42.000Z')
  })

  // hard-43 Q5 "Astralis vs Mezzaria: which is the safer buy?" got Astralis's record alone (4 Nov).
  it('finds the second named project, by exact name only', () => {
    const catalog = [{ id: 'a', name: 'Supertech Supernova Astralis' }, { id: 'm', name: 'Mahagun Mezzaria' }, { id: 'x', name: 'Mahagun' }]
    const q = 'Supertech Supernova Astralis vs Mahagun Mezzaria: which is the safer buy and why?'
    assert.equal(secondProjectInText(q, catalog, catalog[0])?.id, 'm')
    assert.equal(secondProjectInText('is Mahagun Mezzaria safe?', catalog, catalog[1]), null)
  })

  it('gives two records side by side and names no winner', () => {
    const text = catchAnswerPair(
      { row: { ...base, name: 'Astralis' }, complaints: null, orders: [] },
      { row: { ...base, name: 'Mezzaria', status: 'ready_to_move', rera_valid_until: new Date('2021-09-28') }, complaints: null, orders: [] },
      now,
    )
    assert.match(text, /#### Astralis[\s\S]*\*\*Abeyance:\*\*[\s\S]*#### Mezzaria[\s\S]*28 Sep 2021, which has passed/)
    assert.match(text, /We do not rank them/)
    assert.doesNotMatch(text, /\b(?:safer|winner|better choice|wins)\b/i)
  })

  // ERRORS.md 11-03: a code-built sentence that carries a source must survive the sanitizer that
  // every token passes (chat-router.ts send -> sanitizeOutput). Replay never saw these lines,
  // because no draft is approved yet.
  it('the dated complaint and order lines survive sanitizeOutput unchanged', () => {
    const order = { complaint_no: 'NCR144/01/115982/2024', bench: 'Bench 1  Gautam Budh Nagar', order_date: '06-06-2025', readAt: new Date('2026-11-04T08:40:00Z') }
    const text = catchAnswer(base, { project: 53, promoter: 59, readAt: new Date('2026-10-27T19:14:42Z') }, now, [order])
    const clean = sanitizeOutput(text)
    for (const line of [
      'UP-RERA lists 53 complaints against this project and 59 against the promoter, read on 27 Oct 2026. A complaint is not a ruling.',
      'UP-RERA published an order on complaint NCR144/01/115982/2024 before Bench 1 Gautam Budh Nagar, dated 6 Jun 2025, read on 4 Nov 2026.',
    ]) assert.ok(clean.text.includes(line), `sanitizer changed: ${line}\n---\n${clean.text}`)
  })

  it('is what the chat answer shows', () => {
    const text = catchAnswer(base, null, now)
    for (const label of ['Registration', 'Complaints', 'Delays', 'Occupancy certificate', 'Court cases', 'Abeyance']) assert.match(text, new RegExp(`\\*\\*${label}:\\*\\*`))
  })
})

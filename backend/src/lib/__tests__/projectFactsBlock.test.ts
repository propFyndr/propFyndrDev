import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildProjectFacts, projectScalarFacts } from '../projectFactsBlock'

// A row shaped like what chat-router fetches: a full Project plus relations.
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    slug: 'ace-hanei',
    name: 'Ace Hanei',
    sector: 'Sector 150',
    city: 'Noida',
    status: 'under_construction',
    price_range_label: '₹3.11–5.70Cr',
    rera_number: 'UPRERAPRJ123456',
    // The long tail that used to be invisible to the model
    maintenance_per_sqft_monthly: 4.5,
    has_cctv: true,
    street_lights: false,
    airport_distance_km: 28.4,
    top_school_distance_km: 1.2,
    lifts_per_tower: 4,
    ceiling_height_ft: 10.2,
    water_source: 'Ganga jal + borewell',
    registry_status: 'open',
    oc_obtained: false,
    gst_pass_through: true,
    flood_waterlogging_risk: 'low',
    nclt_moratorium_active: false,
    // Must never appear
    embedding: [0.1, 0.2, 0.3],
    ai_search_keywords: ['luxury', 'metro', 'premium'],
    builder_theme: { primaryColor: '#123456', active_until: '2027-01-01' },
    builder_id: 'b-1',
    saved_by: [{ user_id: 'someone-else' }],
    chat_sessions: [{ id: 'their-session' }],
    ...overrides,
  }
}

describe('projectScalarFacts', () => {
  it('surfaces the long-tail fields the old eleven-field block hid', () => {
    const facts = projectScalarFacts(row())
    // These are exactly the questions the chat could not answer before.
    assert.equal(facts.maintenance_per_sqft_monthly, '4.5 per sq.ft per month')
    assert.equal(facts.airport_distance_km, '28.4 km')
    assert.equal(facts.top_school_distance_km, '1.2 km')
    // 4 is a real figure — not the schema default of 3 — so it survives.
    assert.equal(facts.lifts_per_tower, '4')
    // The fixture's 10.2 IS the old schema default, and 190 of 280 live rows
    // carried exactly it. A value whose only provenance is a schema line is
    // withheld — see SCHEMA_DEFAULT_SENTINELS.
    assert.ok(!('ceiling_height_ft' in facts), 'a schema-default ceiling height reached the prompt')
    assert.equal(facts.water_source, 'Ganga jal + borewell')
    assert.equal(facts.registry_status, 'open')
    assert.equal(facts.flood_waterlogging_risk, 'low')
  })

  it('renders booleans as buyer-readable states, not true/false', () => {
    const facts = projectScalarFacts(row())
    assert.equal(facts.has_cctv, 'CCTV')
    assert.equal(facts.street_lights, 'no street lighting')
    assert.equal(facts.oc_obtained, 'not obtained')
    assert.equal(facts.gst_pass_through, 'passed through')
    assert.equal(facts.nclt_moratorium_active, 'no NCLT moratorium')
  })

  it('never leaks internal columns or other users\' relations', () => {
    const facts = projectScalarFacts(row())
    for (const banned of ['embedding', 'ai_search_keywords', 'builder_theme', 'builder_id', 'saved_by', 'chat_sessions']) {
      assert.ok(!(banned in facts), `${banned} leaked into the prompt block`)
    }
    const serialized = JSON.stringify(facts)
    assert.ok(!serialized.includes('active_until'))
    assert.ok(!serialized.includes('someone-else'))
  })

  it('omits empty values so an absent key reads as "we do not hold this"', () => {
    const facts = projectScalarFacts(row({
      water_source: null,
      registry_status: '',
      litigation_types: [],
      commute_matrix: {},
      airport_distance_km: undefined,
    }))
    for (const key of ['water_source', 'registry_status', 'litigation_types', 'commute_matrix', 'airport_distance_km']) {
      assert.ok(!(key in facts), `${key} should be omitted when empty`)
    }
  })

  it('keeps false distinct from missing', () => {
    // `false` is a real answer ("no street lighting"); it must not be dropped as empty.
    const facts = projectScalarFacts(row({ street_lights: false }))
    assert.equal(facts.street_lights, 'no street lighting')
  })

  it('keeps zero distinct from missing', () => {
    const facts = projectScalarFacts(row({ litigation_count: 0 }))
    assert.equal(facts.litigation_count, '0')
  })

  it('truncates long prose rather than dropping it, and marks it as developer text', () => {
    const long = 'x'.repeat(2000)
    const facts = projectScalarFacts(row({ description: long }), { maxDescriptionChars: 100 })
    assert.equal(facts.description, `<untrusted_source url="developer-listing">${'x'.repeat(100)}…</untrusted_source>`)
  })
})

describe('buildProjectFacts — relations', () => {
  it('summarises units, amenities, connectivity, plans and the cost sheet', () => {
    const facts = buildProjectFacts(row({
      // Widened 7 Sep 2026 — was a bare name string. `founded_year` and
      // `delivery_score` prove both halves of the policy in one fixture: a
      // safe factual field passes through, an opaque analyst score does not.
      builder: { name: 'ACE Group', founded_year: 2005, delivery_score: 88, cin: 'U45201DL2005PLC123456' },
      unit_types: [{ bhk: 3, super_area_sqft: 1420, price_min_cr: 3.11 }],
      amenities: [{ name: 'Swimming Pool' }, { name: 'Gym' }],
      connectivity: [{ name: 'Sector 148 Metro', distance_km: 2.1, travel_time_min: 7 }],
      payment_plans: [{ plan_name: 'CLP', description: '10:80:10' }],
      cost_sheet: { id: 'cs1', project_id: 'p1', base_price_per_sqft: 10800, created_at: new Date() },
    }) as never)

    assert.deepEqual(facts.builder, { name: 'ACE Group', founded_year: '2005' })
    assert.deepEqual(facts.unit_types, ['3 BHK (1420 sq ft) from ₹3.11 Cr'])
    assert.deepEqual(facts.amenities, ['Swimming Pool', 'Gym'])
    assert.deepEqual(facts.connectivity, ['Sector 148 Metro — 2.1 km, 7 min'])
    assert.deepEqual(facts.payment_plans, ['CLP: 10:80:10'])
    // Bookkeeping columns stripped from the cost sheet
    const sheet = facts.cost_sheet as Record<string, string>
    assert.equal(sheet.base_price_per_sqft, '10800')
    assert.ok(!('id' in sheet))
    assert.ok(!('project_id' in sheet))
    assert.ok(!('created_at' in sheet))
  })

  it('omits relations entirely when empty', () => {
    const facts = buildProjectFacts(row({ unit_types: [], amenities: [], payment_plans: [], cost_sheet: null }) as never)
    for (const key of ['unit_types', 'amenities', 'payment_plans', 'cost_sheet']) {
      assert.ok(!(key in facts), `${key} should be absent, not empty`)
    }
  })

  it('stays within a sane token budget for a fully-populated project', () => {
    // The whole point of omitting empties is that this block does not blow up
    // the prompt. A fully-populated project is the worst case; ~4 chars/token.
    const full = buildProjectFacts(row({
      builder: { name: 'ACE Group' },
      description: 'y'.repeat(400),
      long_description: 'z'.repeat(400),
      unit_types: Array.from({ length: 20 }, (_, i) => ({ bhk: i % 5, super_area_sqft: 1000 + i, price_min_cr: 2 })),
      amenities: Array.from({ length: 60 }, (_, i) => ({ name: `Amenity ${i}` })),
      connectivity: Array.from({ length: 20 }, (_, i) => ({ name: `Place ${i}`, distance_km: i, travel_time_min: i * 2 })),
      payment_plans: Array.from({ length: 5 }, (_, i) => ({ plan_name: `Plan ${i}`, description: 'w'.repeat(60) })),
    }) as never)

    const chars = JSON.stringify(full).length
    assert.ok(chars < 6000, `facts block is ${chars} chars (~${Math.round(chars / 4)} tokens) — too heavy for a per-turn prompt`)
  })
})

describe('schema-default sentinels', () => {
  it('withholds a value that is only there because Postgres wrote it', () => {
    // Measured 4 Sep 2026 across 280 live projects: ceiling_height_ft was
    // exactly 10.2 on 190 of them, and lifts_per_tower exactly 3 on 166 — the
    // schema defaults. Roughly a third of each column is real, which is why
    // they are withheld per-row rather than dropped from the select.
    const facts = projectScalarFacts(row({
      ceiling_height_ft: 10.2,
      lifts_per_tower: 3,
    }) as never)
    for (const f of ['ceiling_height_ft', 'lifts_per_tower']) {
      assert.ok(!(f in facts), `${f} reached the prompt carrying only a schema default`)
    }
  })

  it('keeps a researched value that differs from the default', () => {
    const facts = projectScalarFacts(row({
      ceiling_height_ft: 11.5,
      lifts_per_tower: 2,
    }) as never)
    assert.equal(facts.ceiling_height_ft, '11.5 ft')
    assert.equal(facts.lifts_per_tower, '2')
  })
})

describe('legal risk summary synthesis', () => {
  it('synthesizes legal_risk_summary when litigation, NCLT, or a project risk flag exist', () => {
    const facts = buildProjectFacts(row({
      litigation_count: 5,
      ongoing_litigation_count: 2,
      nclt_moratorium_active: true,
      project_risk_flag: 'under_review',
    }) as never)

    assert.ok(typeof facts.legal_risk_summary === 'string')
    assert.ok((facts.legal_risk_summary as string).includes('[MANDATORY LEGAL DISCLOSURE]'))
    assert.ok((facts.legal_risk_summary as string).includes('5 project litigation record(s) (2 ongoing)'))
    assert.ok((facts.legal_risk_summary as string).includes('ACTIVE NCLT insolvency moratorium'))
    assert.ok((facts.legal_risk_summary as string).includes('Project legal flag: under_review'))
  })

  it('omits legal_risk_summary when project has clean legal standing', () => {
    const facts = buildProjectFacts(row({
      litigation_count: 0,
      ongoing_litigation_count: 0,
      nclt_moratorium_active: false,
      project_risk_flag: 'none',
    }) as never)

    assert.ok(!('legal_risk_summary' in facts))
  })
})

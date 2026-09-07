import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PROJECT_PUBLIC_SELECT,
  INTERNAL_ONLY_FIELDS,
  FORBIDDEN_RELATIONS,
  ALLOWED_RELATIONS,
  RELATION_INTERNAL_FIELDS,
  BUYER_OPAQUE_SCORES,
  UNIVERSAL_INTERNAL,
  assertNoForbiddenRelations,
  redactProject,
  isPublicField,
} from '../projectExposure'

// ─── Parse the Project model straight out of schema.prisma ───────────────────
// The point of this suite is that adding a column cannot silently expose it, and
// cannot silently hide it either — it has to be classified in one list or the
// other, deliberately.

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8')

function modelBody(modelName: string): string {
  const start = schema.indexOf(`\nmodel ${modelName} {`)
  assert.ok(start !== -1, `${modelName} model not found in schema.prisma`)
  const end = schema.indexOf('\n}', start)
  return schema.slice(start, end)
}

interface Field { name: string; type: string; isRelation: boolean }

function parseFields(modelName: string): Field[] {
  const relationModels = new Set(
    [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(m => m[1]),
  )
  const fields: Field[] = []
  for (const raw of modelBody(modelName).split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('@@') || line.startsWith('model ')) continue
    const m = line.match(/^(\w+)\s+(\S+)/)
    if (!m) continue
    const [, name, type] = m
    const bare = type.replace(/[\[\]?]/g, '')
    fields.push({ name, type, isRelation: relationModels.has(bare) })
  }
  return fields
}

const FIELDS = parseFields('Project')
const SCALARS = FIELDS.filter(f => !f.isRelation)
const RELATIONS = FIELDS.filter(f => f.isRelation)

describe('projectExposure — schema coverage', () => {
  it('parses a plausible Project model', () => {
    assert.ok(SCALARS.length > 100, `expected 100+ scalars, parsed ${SCALARS.length}`)
    assert.ok(RELATIONS.length > 10, `expected 10+ relations, parsed ${RELATIONS.length}`)
  })

  it('classifies every scalar column as either public or internal', () => {
    const unclassified = SCALARS
      .map(f => f.name)
      .filter(n => !isPublicField(n) && !(n in INTERNAL_ONLY_FIELDS))

    assert.deepEqual(
      unclassified,
      [],
      `Unclassified Project column(s): ${unclassified.join(', ')}.\n` +
        'Add each to PROJECT_PUBLIC_SELECT (buyer may see it) or to ' +
        'INTERNAL_ONLY_FIELDS with a reason (must never leave the server).',
    )
  })

  it('never marks a column both public and internal', () => {
    const both = Object.keys(INTERNAL_ONLY_FIELDS).filter(isPublicField)
    assert.deepEqual(both, [], `Column(s) in both lists: ${both.join(', ')}`)
  })

  it('classifies every relation as allowed or forbidden', () => {
    const known = new Set<string>([...ALLOWED_RELATIONS, ...FORBIDDEN_RELATIONS])
    const unclassified = RELATIONS.map(r => r.name).filter(n => !known.has(n))
    assert.deepEqual(
      unclassified,
      [],
      `Unclassified Project relation(s): ${unclassified.join(', ')}. ` +
        'A relation to another user\'s data belongs in FORBIDDEN_RELATIONS.',
    )
  })

  it('keeps the known PII relations forbidden', () => {
    // These point at SavedProperty / ChatSession / PropertyFeedback rows belonging
    // to other people. Selecting one puts their data into an LLM prompt.
    for (const relation of ['saved_by', 'chat_sessions', 'property_feedback']) {
      assert.ok(
        (FORBIDDEN_RELATIONS as readonly string[]).includes(relation),
        `${relation} must stay forbidden`,
      )
      assert.ok(!(ALLOWED_RELATIONS as readonly string[]).includes(relation))
    }
  })

  it('never exposes the pgvector embedding or the internal retrieval keywords', () => {
    assert.equal(isPublicField('embedding'), false)
    assert.equal(isPublicField('ai_search_keywords'), false)
    assert.equal(isPublicField('builder_theme'), false)
  })

  it('does expose the legal disclosure fields — buyers are entitled to these', () => {
    for (const f of [
      'rera_number', 'legal_flag', 'legal_flag_detail', 'nclt_moratorium_active',
      'registry_status', 'litigation_count', 'ongoing_litigation_count',
      'oc_obtained', 'land_title_clear', 'project_risk_flag', 'possession_confidence',
    ]) {
      assert.ok(isPublicField(f), `${f} must remain visible to buyers`)
    }
  })

  it('withholds the two legal SUMMARY strings that contradict those fields', () => {
    /**
     * `nclt_status` used to be in the list above, and the principle that put it
     * there is right — a buyer is entitled to know a project's legal standing.
     * The column is not that. It reads "Clean - No NCLT Moratorium" on 100% of
     * its 94 populated rows, Amrapali projects included, while the same
     * database records their builder as "Amrapali Group (NBCC Supervised)" —
     * the Supreme Court cancelled Amrapali's RERA registrations in 2019 and
     * handed the projects to NBCC.
     *
     * Measured live before withholding, the chat told a buyer that Amrapali
     * Crystal Homes "has a clean legal standing with no active NCLT insolvency
     * proceedings".
     *
     * So the entitlement is served by the real columns asserted above —
     * `nclt_moratorium_active`, `legal_flag`, `project_risk_flag`,
     * `litigation_count` — and these two templated summaries are withheld
     * precisely BECAUSE they are legal claims and they are false.
     */
    for (const f of ['nclt_status', 'approvals_status']) {
      assert.equal(isPublicField(f), false, `${f} is batch-templated and contradicts the real legal columns`)
    }
  })
})

describe('assertNoForbiddenRelations', () => {
  it('throws on a PII relation', () => {
    for (const relation of FORBIDDEN_RELATIONS) {
      assert.throws(
        () => assertNoForbiddenRelations({ builder: true, [relation]: true }),
        /must never be selected/,
        relation,
      )
    }
  })

  it('allows an ordinary include', () => {
    assert.doesNotThrow(() =>
      assertNoForbiddenRelations({ builder: true, amenities: true, cost_sheet: true }),
    )
  })

  it('ignores a relation key explicitly set false', () => {
    assert.doesNotThrow(() => assertNoForbiddenRelations({ saved_by: false }))
  })
})

describe('redactProject', () => {
  it('drops internal columns from a row fetched elsewhere', () => {
    const redacted = redactProject({
      id: 'p1',
      name: 'Ace Hanei',
      embedding: [0.1, 0.2],
      ai_search_keywords: ['luxury', 'metro'],
      builder_theme: { primaryColor: '#fff', active_until: '2027-01-01' },
      builder_id: 'b1',
    })

    assert.equal(redacted.name, 'Ace Hanei')
    assert.equal(redacted.id, 'p1')
    assert.ok(!('embedding' in redacted))
    assert.ok(!('ai_search_keywords' in redacted))
    assert.ok(!('builder_theme' in redacted))
    assert.ok(!('builder_id' in redacted))
  })

  it('drops PII relations even when a caller passes them in', () => {
    const redacted = redactProject({
      id: 'p1',
      saved_by: [{ user_id: 'someone-else' }],
      chat_sessions: [{ id: 'their-session' }],
      property_feedback: [{ user_id: 'another' }],
    })
    for (const relation of FORBIDDEN_RELATIONS) {
      assert.ok(!(relation in redacted), relation)
    }
  })

  it('preserves allowed relations untouched', () => {
    const amenities = [{ name: 'Pool' }]
    const redacted = redactProject({ id: 'p1', amenities, cost_sheet: { base_price_per_sqft: 10000 } })
    assert.deepEqual(redacted.amenities, amenities)
    assert.ok('cost_sheet' in redacted)
  })

  it('is a no-op on an already-clean row', () => {
    const row = { id: 'p1', name: 'X', sector: 'Sector 150' }
    assert.deepEqual(redactProject(row), row)
  })
})

describe('the forward-projection columns cannot reach a buyer', () => {
  /**
   * `projectDataGateway.ts` selected all three of these and built buyer-facing
   * facts from them — "5-Year Appreciation Potential: 48.5% estimated", with a
   * confidence score attached — while this file's policy said none of them may
   * leave the server. Two files disagreed about policy and the one without the
   * policy won: asked how much Godrej Woods had appreciated, the live answer
   * closed with "Financial projections estimate an additional 25-35% capital
   * appreciation over a 3-year horizon".
   *
   * The column is also a bucket, not an estimate: populated on 280 of 280
   * projects with seven distinct values, 48.5 shared by 95 of them.
   */
  for (const field of [
    'appreciation_potential_5yr',
    'rental_yield_annual_percent',
    'market_demand_score',
  ]) {
    it(`${field} is classified internal-only, with a stated reason`, () => {
      assert.ok(field in INTERNAL_ONLY_FIELDS, `${field} is no longer classified internal`)
      assert.ok(
        INTERNAL_ONLY_FIELDS[field].length > 10,
        `${field} is internal but nothing says why`,
      )
    })

    it(`${field} is absent from the public select`, () => {
      assert.ok(
        !(field in (PROJECT_PUBLIC_SELECT as Record<string, unknown>)),
        `${field} reached PROJECT_PUBLIC_SELECT`,
      )
    })
  }

  it('the gateway filters on the policy rather than on a hand-kept list', () => {
    // A field added to the gateway's select blocks tomorrow must be dropped by
    // the same mechanism, not by someone remembering. The guard keys off
    // INTERNAL_ONLY_FIELDS, so this asserts the coupling exists in the source.
    const src = readFileSync(join(process.cwd(), 'src', 'lib', 'projectDataGateway.ts'), 'utf8')
    assert.match(src, /INTERNAL_ONLY_FIELDS/, 'gateway no longer reads the exposure policy')
    assert.match(src, /dropInternalFacts\(/, 'gateway no longer applies the filter')
  })
})

/**
 * Builder never had this coverage at all — this suite parsed only `model
 * Project {`, so every one of Builder's ~40 scalar columns was unclassified
 * with nothing to notice. `buildProjectFacts` widened from `builder.name`
 * alone to the whole relation on 7 Sep 2026 specifically so this gap would
 * start mattering, and it is closed the same way Project's coverage already
 * works: every currently-known Builder column must be accounted for in one of
 * RELATION_INTERNAL_FIELDS.builder, BUYER_OPAQUE_SCORES, or the explicit
 * "known and intentionally public" list below.
 *
 * One structural difference from Project's PROJECT_PUBLIC_SELECT, worth being
 * honest about rather than silently relying on: Project is an allowlist — a
 * new column is invisible until added to PROJECT_PUBLIC_SELECT. Builder (like
 * every other relation governed by RELATION_INTERNAL_FIELDS) is a denylist —
 * `cleanRelation` exposes anything not explicitly named as internal, so a new
 * Builder column defaults to PUBLIC, not blocked. `KNOWN_PUBLIC_BUILDER_FIELDS`
 * cannot change that default; what it does is make a new, uncategorized column
 * fail this test the moment it is added, rather than reaching a buyer silently.
 * Converting every RELATION_INTERNAL_FIELDS relation to an allowlist is a
 * larger, separate change — tracked in PLAN.md, not done here.
 */
describe('Builder exposure — schema coverage', () => {
  const BUILDER_FIELDS = parseFields('Builder')
  const BUILDER_SCALARS = BUILDER_FIELDS.filter(f => !f.isRelation)

  it('parses a plausible Builder model', () => {
    assert.ok(BUILDER_SCALARS.length > 30, `expected 30+ scalars, parsed ${BUILDER_SCALARS.length}`)
  })

  /**
   * Everything currently known to be safe — matches exactly what
   * `builderReputationHandler` already vets and renders to a buyer, plus the
   * identity/recognition fields that carry no score and no internal process
   * information. Adding a name here is the same disclosure decision
   * `projectExposure.ts`'s own file header describes for Project columns.
   */
  const KNOWN_PUBLIC_BUILDER_FIELDS = new Set([
    'name', 'slug', 'tagline', 'founder', 'company_overview', 'logo_url',
    'parent_group', 'founded_year', 'headquarters', 'website', 'email', 'phone',
    'description', 'experience_years', 'projects_delivered_count',
    'total_projects_count', 'delivered_units', 'delivered_projects',
    'ongoing_projects', 'delayed_projects_count', 'average_delay_months',
    'litigation_count', 'insolvency_history', 'legal_flag', 'rera_promoter_id',
    'funding_banks', 'luxury_specialization', 'township_specialization',
    'affordable_specialization', 'average_project_size', 'awards',
    'awards_count', 'certifications', 'credai_member', 'iso_certified',
  ])

  it('classifies every scalar column as public, opaque-score, or relation-internal', () => {
    const denied = new Set<string>([
      ...UNIVERSAL_INTERNAL,
      ...(RELATION_INTERNAL_FIELDS.builder ?? []),
      ...BUYER_OPAQUE_SCORES,
    ])
    const unclassified = BUILDER_SCALARS
      .map(f => f.name)
      .filter(n => !denied.has(n) && !KNOWN_PUBLIC_BUILDER_FIELDS.has(n))

    assert.deepEqual(
      unclassified,
      [],
      `Unclassified Builder column(s): ${unclassified.join(', ')}.\n` +
        'Add each to RELATION_INTERNAL_FIELDS.builder (must never leave the server, ' +
        'with a reason), BUYER_OPAQUE_SCORES (an analyst-set score a buyer cannot ' +
        'check), or KNOWN_PUBLIC_BUILDER_FIELDS above (safe, factual, buyer-facing).',
    )
  })

  it('never marks a column both denied and known-public', () => {
    const denied = new Set<string>([
      ...UNIVERSAL_INTERNAL,
      ...(RELATION_INTERNAL_FIELDS.builder ?? []),
      ...BUYER_OPAQUE_SCORES,
    ])
    const both = [...KNOWN_PUBLIC_BUILDER_FIELDS].filter(n => denied.has(n))
    assert.deepEqual(both, [], `Column(s) in both lists: ${both.join(', ')}`)
  })

  it('keeps the opaque analyst scores out of the facts block', () => {
    for (const f of ['delivery_score', 'construction_quality_score', 'rera_compliance_score', 'financial_hygiene_score']) {
      assert.ok((BUYER_OPAQUE_SCORES as readonly string[]).includes(f), `${f} must stay an opaque score`)
    }
  })

  it('keeps the corporate-registry and process fields out of the facts block', () => {
    for (const f of ['cin', 'legal_entities', 'executives', 'outstanding_dues_cr', 'audit_flags_log', 'verification_level', 'data_source', 'intelligence_completeness']) {
      assert.ok((RELATION_INTERNAL_FIELDS.builder ?? []).includes(f), `${f} must stay relation-internal`)
    }
  })
})

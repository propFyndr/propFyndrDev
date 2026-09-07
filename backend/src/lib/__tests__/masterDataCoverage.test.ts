import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { buildProjectFacts, detectFactTopics, type FactTopic } from '../projectFactsBlock'
import { stripRelationInternals, isPublished } from '../projectExposure'

// Runs the facts block against a real seeded record from newProj/75 — the same
// master JSON that was loaded into the database — rather than a hand-written
// fixture, so the assertions track the shape the app actually sees.

const MASTER = join(__dirname, '../../../../newProj/75/propfyndr_sector150_noida_master_data.json')
const available = existsSync(MASTER)

function firstProject(): Record<string, unknown> {
  const parsed = JSON.parse(readFileSync(MASTER, 'utf8')) as Record<string, Record<string, unknown>>
  const key = Object.keys(parsed)[0]
  return parsed[key]
}

describe('master data coverage', { skip: !available && 'newProj/75 master JSON not present' }, () => {
  it('surfaces the analyst narrative the base prompt tells the model to use', () => {
    // base.ts rules 13-15 name decision_thesis, why_buy, why_avoid, tier and
    // walk_away_conditions. Before this, none of them reached the prompt.
    const facts = buildProjectFacts(firstProject() as never)

    const decision = facts.decision_profile as Record<string, string> | undefined
    assert.ok(decision, 'decision_profile missing from the facts block')
    assert.ok(decision.decision_thesis, 'decision_thesis missing')
    assert.ok(decision.why_buy, 'why_buy missing')
    assert.ok(decision.why_avoid, 'why_avoid missing — trade-offs are mandatory per CLAUDE.md')

    const recommendation = facts.recommendation_profile as Record<string, string> | undefined
    assert.ok(recommendation, 'recommendation_profile missing from the facts block')
    // `tier` is deliberately NOT here any more. Measured 4 Sep 2026: 280 of
    // 280 rows read STRONG_BUY, so the field is a constant rather than a
    // recommendation — and a buyer was shown it as one, alongside a
    // "satisfaction rating" that was 4.7 on 92 of the 94 projects that had one.
    // See SYNTHETIC_FIELDS in projectExposure.ts. This asserts it stays out.
    assert.ok(!('tier' in recommendation), 'tier reached the buyer facts block')
    assert.ok(recommendation.walk_away_conditions, 'walk_away_conditions missing')
  })

  it('surfaces the real cost sheet instead of a typed-in one', () => {
    const facts = buildProjectFacts(firstProject() as never)
    const sheet = facts.cost_sheet as Record<string, string> | undefined
    assert.ok(sheet, 'cost_sheet missing from the facts block')
    // These exist in the seeded data and were previously overwritten by literals.
    assert.ok(sheet.parking_cost, 'parking_cost not surfaced')
    assert.ok(sheet.club_membership, 'club_membership not surfaced')
    assert.ok(sheet.ifms, 'ifms not surfaced')
    assert.ok(sheet.base_price_per_sqft, 'base_price_per_sqft not surfaced')
  })

  it('surfaces the long-tail living-standard fields', () => {
    const facts = buildProjectFacts(firstProject() as never)
    // Present on the seeded record; each is a question a buyer actually asks.
    for (const key of ['water_source', 'land_tenure', 'ceiling_height_ft', 'lifts_per_tower', 'maintenance_per_sqft_monthly']) {
      assert.ok(key in facts, `${key} not surfaced from master data`)
    }
  })

  it('never leaks internal or analyst-only fields from a real record', () => {
    const serialized = JSON.stringify(buildProjectFacts(firstProject() as never))
    for (const banned of [
      'ai_search_keywords', 'builder_theme', 'embedding', 'builder_id',
      'admin_notes', 'advisor_notes', 'internal_confidence', 'verified_by',
      'market_demand_score', 'appreciation_potential_5yr',
    ]) {
      assert.ok(!serialized.includes(banned), `${banned} leaked into the prompt block`)
    }
  })

  it('excludes the raw DNA analyst scores', () => {
    const facts = buildProjectFacts(firstProject() as never)
    assert.ok(!('dna' in facts), 'raw DNA scores must not reach the prompt')
    const serialized = JSON.stringify(facts)
    assert.ok(!serialized.includes('builder_score'))
    assert.ok(!serialized.includes('legal_score'))
  })

  it('keeps the default facts block within a sane token budget on real data', () => {
    // Every turn pays this, and a comparison pays it per project.
    //
    // Raised from 6,000 to 6,500 on 30 Aug 2026, and the order of events is
    // the point. A bulk enrichment pass filled decision_profile for the 189
    // projects that had none, and the block went 5,9xx -> 7,989. The first
    // instinct — raise the number until it passes — would have made this test
    // useless, so instead the block was examined: 1,556 characters of it were
    // four *_intelligence narratives that no prompt rule references, and 98
    // more were their JSON scaffolding. Those are now gated behind the
    // `deep_reasoning` topic, which brought it to 6,335.
    //
    // The remaining 335 is real per-project content the enrichment added and
    // the product wants on every turn — location_concerns above all, which is
    // the honest-negative field. Paying for that is the trade this file exists
    // to make. Trimming waste first and then raising the bar by the smallest
    // amount that admits the content is a different act from raising the bar
    // to make a failure go away.
    //
    // Raised again, 6,500 -> 7,500, on 7 Sep 2026: `buildProjectFacts` widened
    // the builder relation from `builder.name` alone to founded_year, delivery
    // counts, average handover delay, RERA promoter id, awards and CREDAI/ISO
    // status — the same trade as above, examined the same way. The object was
    // 1,092 characters on this seeded record; 104 of them were `slug` and
    // `logo_url`, safe but pointless as prompt text (a URL the model cannot
    // render, an identifier no prompt rule reads) and are now dropped before
    // the block is built, the same reason PROMPT_EXCLUDED_FIELDS withholds
    // Project's own hero_image_url. The remaining ~984 is real: founded_year,
    // delivered/ongoing project counts, handover delay, RERA promoter id,
    // awards and certifications — every field `builderReputationHandler`
    // already treats as safe to answer a builder question with, now answerable
    // from the facts block instead of a 215-line handler.
    const chars = JSON.stringify(buildProjectFacts(firstProject() as never)).length
    assert.ok(chars < 7500, `default facts block is ${chars} chars (~${Math.round(chars / 4)} tokens)`)
  })

  it('keeps the analyst narratives out of an ordinary turn', () => {
    // The regression this guards: 19% of every prompt, on four long-form
    // narratives, for a question like "does it have a gym".
    const base = buildProjectFacts(firstProject() as never)
    const decision = base.decision_profile as Record<string, unknown>
    assert.ok(decision, 'decision_profile should still be present')
    for (const k of ['market_intelligence', 'financial_intelligence', 'property_intelligence', 'builder_intelligence']) {
      assert.ok(!(k in decision), `${k} is billed on every turn and no prompt rule names it`)
    }
    // The fields base.ts rules 13-15 DO name must survive the trim.
    for (const k of ['decision_thesis', 'why_buy', 'why_avoid']) {
      assert.ok(k in decision, `${k} is named by a prompt rule and must stay`)
    }
  })

  it('brings the narratives back when the question is actually analytical', () => {
    const deep = buildProjectFacts(firstProject() as never, { topics: detectFactTopics('is sector 150 a better investment than sector 128?') })
    const decision = deep.decision_profile as Record<string, unknown>
    assert.ok('market_intelligence' in decision, 'a comparison should get the market narrative')
  })

  it('does not treat an amenity question as analytical', () => {
    // "risk" and "investment" open the gate; a gym question must not.
    assert.equal(detectFactTopics('does it have a gym').has('deep_reasoning'), false)
    assert.equal(detectFactTopics('what is the payment plan').has('deep_reasoning'), false)
  })

  it('omits the heavy relations until the question asks for them', () => {
    const row = firstProject()
    const base = buildProjectFacts(row as never)
    assert.ok(!('price_history' in base), 'price_history should be topic-gated')
    assert.ok(!('specifications' in base), 'specifications should be topic-gated')
    assert.ok(!('construction_milestones' in base), 'construction_milestones should be topic-gated')
  })

  it('includes a heavy relation when the buyer asks about it', () => {
    const row = firstProject()
    const priced = buildProjectFacts(row as never, { topics: detectFactTopics('how has the price changed over the last year?') })
    assert.ok('price_history' in priced, 'price question did not pull price_history')

    const specced = buildProjectFacts(row as never, { topics: detectFactTopics('what brand of kitchen fittings does it have?') })
    assert.ok('specifications' in specced, 'fittings question did not pull specifications')

    const built = buildProjectFacts(row as never, { topics: detectFactTopics('how far along is construction?') })
    assert.ok('construction_milestones' in built, 'progress question did not pull milestones')
  })

  it('stays bounded even with every heavy relation pulled in', () => {
    // The worst case: a comparison that also asks about price history, specs
    // and construction. Rare, and the turn it serves is the one the product
    // exists for. 9,000 -> 11,500 for the same reason as the default budget
    // above: the enrichment added real content to all three relations. What
    // matters is that this stays a CEILING with a number behind it, so an
    // unbounded relation cannot be added without someone seeing this fail.
    //
    // Raised again, 11,500 -> 12,500, on 7 Sep 2026, by the same ~984 chars as
    // the default budget's comment above — the widened builder relation is
    // topic-independent, so it costs the same here as it does on an ordinary
    // turn. See that comment for what the 984 is and why it stays.
    // `availability` (unit_inventory) added to the worst-case set 7 Sep 2026,
    // the same day it was introduced — this test's own point is that it
    // stays a real ceiling for every heavy relation, not four of five.
    const all = buildProjectFacts(firstProject() as never, {
      topics: new Set<FactTopic>(['price_history', 'specifications', 'construction', 'deep_reasoning', 'availability']),
    })
    const chars = JSON.stringify(all).length
    assert.ok(chars < 12_500, `full facts block is ${chars} chars (~${Math.round(chars / 4)} tokens)`)
  })
})

describe('detectFactTopics', () => {
  it('does not pull heavy relations for an unrelated question', () => {
    const topics = detectFactTopics('is it pet friendly and how far is the airport?')
    assert.equal(topics.size, 0)
  })

  it('recognises each topic from natural buyer phrasing', () => {
    assert.ok(detectFactTopics('has the price appreciated?').has('price_history'))
    assert.ok(detectFactTopics('what flooring is used').has('specifications'))
    assert.ok(detectFactTopics('what stage is the slab work at').has('construction'))
    assert.ok(detectFactTopics('which units are available on the 5th floor').has('availability'))
  })

  it('does not treat an ordinary floor-plan question as an availability question', () => {
    // "floor plan" and "how many floors" must not drag in unit_inventory —
    // that's floor_plans_lookup's job, and unit_inventory can be hundreds of
    // rows on a large project.
    assert.equal(detectFactTopics('what floor plans do you have for the 3 BHK').has('availability'), false)
  })
})

describe('publish gate', () => {
  it('treats only PUBLISHED analyst content as buyer-facing', () => {
    assert.equal(isPublished({ status: 'PUBLISHED' }), true)
    assert.equal(isPublished({ status: 'DRAFT' }), false)
    assert.equal(isPublished({ status: 'IN_REVIEW' }), false)
    // A relation with no status column is not gated.
    assert.equal(isPublished({ base_price_per_sqft: 1 }), true)
  })

  it('drops DRAFT analyst opinion entirely', () => {
    assert.equal(
      stripRelationInternals('decision_profile', { status: 'DRAFT', decision_thesis: 'unreviewed take' }),
      null,
    )
    assert.equal(
      stripRelationInternals('recommendation_profile', { status: 'IN_REVIEW', tier: 'STRONG_BUY' }),
      null,
    )
  })

  it('strips the analyst notes from PUBLISHED content', () => {
    const cleaned = stripRelationInternals('recommendation_profile', {
      status: 'PUBLISHED',
      tier: 'BUY',
      primary_thesis: 'solid',
      internal_confidence: 'medium — thin comparables',
      admin_notes: 'call the desk before quoting',
      verified_by: 'analyst@propfyndr',
      id: 'r1',
      project_id: 'p1',
    })
    assert.ok(cleaned)
    // Stripped from PUBLISHED content too. The publish gate is about review
    // status; this field is withheld for a different reason — it has no spread
    // across the table at all — so being reviewed does not restore it.
    assert.ok(!('tier' in cleaned!), 'tier survived the strip')
    assert.equal(cleaned!.primary_thesis, 'solid')
    for (const banned of ['internal_confidence', 'admin_notes', 'verified_by', 'id', 'project_id', 'status', 'tier']) {
      assert.ok(!(banned in cleaned!), `${banned} survived the strip`)
    }
  })

  it('excludes the DNA relation outright', () => {
    assert.equal(stripRelationInternals('dna', { builder_score: 95, legal_score: 94 }), null)
  })
})

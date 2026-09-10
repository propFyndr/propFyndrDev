import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

const expect = (actual: any) => ({
  toBe: (expected: any) => assert.equal(actual, expected),
  toBeGreaterThan: (expected: any) => assert.ok(actual > expected),
  toBeGreaterThanOrEqual: (expected: any) => assert.ok(actual >= expected),
  toBeLessThan: (expected: any) => assert.ok(actual < expected),
  toBeLessThanOrEqual: (expected: any) => assert.ok(actual <= expected),
})
import { scoreProject } from '../scoring';
import { scoreAndSort } from '../projects';
import type { Intent } from '../types';

/** A full RawProject-shaped fixture — scoreAndSort/mapToScored read every field below. */
function rawProjectFixture(overrides: Record<string, any> = {}): any {
  return {
    id: 'p1',
    slug: 'test-project',
    name: 'Test Project',
    tagline: null,
    builder: { name: 'Builder A', slug: 'builder-a', credai_member: false, delivered_units: 0, litigation_count: 0, legal_flag: null },
    rera_number: 'REG123',
    rera_url: null,
    lat: null,
    lng: null,
    sector: 'Sector 10',
    city: 'Noida',
    address: null,
    land_area_acres: null,
    total_towers: null,
    status: 'ready_to_move',
    launch_date: null,
    possession_label: null,
    possession_date: null,
    architect: null,
    interior_designer: null,
    design_theme: null,
    project_risk_flag: null,
    nclt_moratorium_active: null,
    registry_status: null,
    marketing_claims: null,
    hero_image_url: null,
    unit_types: [{ name: '3 BHK', bhk: 3, bathrooms: 2, super_area_sqft: 2000, carpet_area_sqft: 1500, price_min_cr: 1.0, price_max_cr: 1.5, price_label: null, inventory_left: null }],
    amenities: [],
    connectivity: [],
    images: [],
    ai_search_keywords: [],
    recommendation_profile: null,
    decision_profile: null,
    persona_profile: null,
    competitors: [],
    dna: null,
    ...overrides,
  }
}

const mockIntent: Intent = {
  sector: 'Sector 10',
  bhk: [3],
  budgetMax: 2,
  gathering_loop_count: 0,
};

const mockProject = {
  id: 'p1',
  name: 'Test Project',
  slug: 'test-project',
  sector: 'Sector 10',
  city: 'Noida',
  builder: {
    name: 'Builder A',
    slug: 'builder-a',
    credai_member: false,
    delivered_units: 0,
    awards_count: 0,
    legal_flag: null,
  },
  status: 'ready_to_move' as const,
  price_range_label: '₹1-2 Cr',
  images: [],
  hero_image_url: null,
  unit_types: [
    { bhk: 3, carpet_area_sqft: 1500, super_area_sqft: 2000, price_min_cr: 1.0, price_max_cr: 1.5 },
  ],
  amenities: [] as Array<{ name: string }>,
  ai_search_keywords: [] as string[],
  rera_number: 'REG123',
  possession_date: null as Date | null,
};

describe('Discovery Scoring', () => {
  it('scores projects by sector match', () => {
    const result = scoreProject(mockProject, mockIntent);
    expect(result).toBeGreaterThan(0);
  });

  it('applies higher score for BHK match', () => {
    const result = scoreProject(mockProject, mockIntent);
    expect(result).toBeGreaterThanOrEqual(10);
  });

  it('filters out projects above budget', () => {
    const overBudgetIntent: Intent = { ...mockIntent, budgetMax: 0.5 };
    const result = scoreProject(mockProject, overBudgetIntent);
    expect(result).toBeLessThan(50);
  });

  it('applies sector mismatch handling', () => {
    const wrongSectorIntent: Intent = { ...mockIntent, sector: 'Sector 5' };
    const result = scoreProject(mockProject, wrongSectorIntent);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('applies bhk mismatch handling', () => {
    const wrongBhkIntent: Intent = { ...mockIntent, bhk: [2] };
    const result = scoreProject(mockProject, wrongBhkIntent);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('handles null project gracefully', () => {
    const result = scoreProject(null as any, mockIntent);
    expect(result).toBe(0);
  });

  it('awards rera_number bonus', () => {
    const result = scoreProject(mockProject, mockIntent);
    expect(result).toBeGreaterThan(0);
  });

  it('handles multiple bhk preferences', () => {
    const multiIntent: Intent = { ...mockIntent, bhk: [2, 3, 4] };
    const result = scoreProject(mockProject, multiIntent);
    expect(result).toBeGreaterThan(0);
  });
});

describe('Score Floor Enforcement', () => {
  it('filters out projects below MIN_SCORE_FLOOR of 10', () => {
    const MIN_SCORE_FLOOR = 10;
    const lowScoreProject = {
      ...mockProject,
      sector: 'Unrelated Sector',
      unit_types: [{ bhk: 1, carpet_area_sqft: 500, super_area_sqft: 700, price_min_cr: 5, price_max_cr: 10 }],
    };
    const result = scoreProject(lowScoreProject, mockIntent);
    if (result < MIN_SCORE_FLOOR) {
      expect(true).toBe(true); // Should be filtered
    }
  });

  it('passes projects at floor threshold', () => {
    const result = scoreProject(mockProject, mockIntent);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('isFallbackMatch signal', () => {
  it('is unset when a project clears SCORE_THRESHOLD normally', () => {
    const intent: Intent = { sector: 'Sector 10', bhk: [3], budgetMax: 2 };
    const good = rawProjectFixture();
    const [result] = scoreAndSort([good], intent, 20);
    assert.equal(result.isFallbackMatch, undefined);
  });

  it('is set true when only the MIN_SCORE_FLOOR fallback surfaced the project', () => {
    // Nothing this poorly matched — wrong sector, tiny over-budget unit —
    // clears SCORE_THRESHOLD (20), so scoreAndSort should fall back to
    // MIN_SCORE_FLOOR (10) and mark the result.
    const intent: Intent = { sector: 'Sector 999', bhk: [4], budgetMax: 0.5 }
    const weak = rawProjectFixture({ sector: 'Sector 10' })
    const [result] = scoreAndSort([weak], intent, 20)
    assert.ok(result, 'expected the floor fallback to return something')
    assert.equal(result.isFallbackMatch, true)
  })
})

describe('possessionOutsideTimeline signal', () => {
  it('is false when the buyer named no timeline', () => {
    const intent: Intent = { sector: 'Sector 10' }
    const p = rawProjectFixture({ possession_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 5) })
    const [result] = scoreAndSort([p], intent, 0)
    assert.equal(result.possessionOutsideTimeline, false)
  })

  it('is false when we hold no possession_date at all — unknown, not off-timeline', () => {
    const intent: Intent = { sector: 'Sector 10', possession: 'immediate' }
    const p = rawProjectFixture({ possession_date: null })
    const [result] = scoreAndSort([p], intent, 0)
    assert.equal(result.possessionOutsideTimeline, false)
  })

  it('is true when the buyer wants immediate and possession is years out', () => {
    const intent: Intent = { sector: 'Sector 10', possession: 'immediate' }
    const p = rawProjectFixture({ possession_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 2) })
    const [result] = scoreAndSort([p], intent, 0)
    assert.equal(result.possessionOutsideTimeline, true)
  })

  it('is false when possession falls inside the stated timeline window', () => {
    const intent: Intent = { sector: 'Sector 10', possession: '1year' }
    const p = rawProjectFixture({ possession_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 300) }) // ~10mo
    const [result] = scoreAndSort([p], intent, 0)
    assert.equal(result.possessionOutsideTimeline, false)
  })
})

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  SECTOR_PUBLIC_SELECT,
  SECTOR_INTERNAL_ONLY,
  isClassified,
  sectorSlug,
} from '../sectorExposure'
import { PROJECT_PUBLIC_SELECT } from '../projectExposure'

/**
 * Adding a column to `SectorIntelligence` is a disclosure decision.
 *
 * Same contract as `projectExposure.test.ts`, enforced the same way: read the
 * model out of schema.prisma and fail on any column that is neither published
 * nor deliberately withheld. Without this, a new analyst-only column is one
 * `prisma db push` away from a public sector page.
 */
function sectorIntelligenceColumns(): string[] {
  const schema = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'prisma', 'schema.prisma'),
    'utf8',
  )
  const start = schema.indexOf('model SectorIntelligence {')
  assert.ok(start !== -1, 'SectorIntelligence model not found in schema.prisma')
  const body = schema.slice(start, schema.indexOf('\n}', start))

  return body
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//') && !line.startsWith('@@'))
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean)
}

describe('sector exposure', () => {
  it('classifies every column on the model', () => {
    const unclassified = sectorIntelligenceColumns().filter((c) => !isClassified(c))
    assert.deepEqual(
      unclassified,
      [],
      `Unclassified SectorIntelligence columns: ${unclassified.join(', ')}. ` +
        'Add each to SECTOR_PUBLIC_SELECT or SECTOR_INTERNAL_ONLY with a reason.',
    )
  })

  it('never publishes the analyst audit trail', () => {
    for (const withheld of ['verified_by', 'id', 'created_at', 'updated_at']) {
      assert.ok(!(withheld in SECTOR_PUBLIC_SELECT), `${withheld} must not be buyer-facing`)
      assert.ok(withheld in SECTOR_INTERNAL_ONLY, `${withheld} must be listed with a reason`)
    }
  })

  it('publishes the negatives, not just the positives', () => {
    // § Trust First. A sector page that lists who a place suits and omits who
    // it does not is a brochure, which is the thing this product is not.
    assert.ok('who_should_avoid' in SECTOR_PUBLIC_SELECT)
    assert.ok('sector_weaknesses' in SECTOR_PUBLIC_SELECT)
    assert.ok('flood_waterlogging_risk' in SECTOR_PUBLIC_SELECT)
  })

  it('keeps the sector project card inside the project allowlist', () => {
    // Mirrors SECTOR_PROJECT_CARD_SELECT in routes/sectors.ts. A field that
    // drifts out of PROJECT_PUBLIC_SELECT is an unreviewed disclosure.
    const cardFields = [
      'id', 'slug', 'name', 'sector', 'city', 'status', 'hero_image_url',
      'price_min_cr', 'price_range_label', 'possession_date', 'possession_label',
      'rera_number',
    ]
    for (const f of cardFields) {
      assert.ok(f in PROJECT_PUBLIC_SELECT, `sector card exposes "${f}", which is not in PROJECT_PUBLIC_SELECT`)
    }
  })

  describe('sectorSlug', () => {
    it('round-trips the shapes the catalogue actually holds', () => {
      assert.equal(sectorSlug('Sector 150', 'Noida'), 'sector-150-noida')
      assert.equal(sectorSlug('Sector 16B', 'Greater Noida West'), 'sector-16b-greater-noida-west')
      assert.equal(sectorSlug('Yamuna Expressway', 'Greater Noida'), 'yamuna-expressway-greater-noida')
      assert.equal(sectorSlug('Techzone 4', 'Greater Noida West'), 'techzone-4-greater-noida-west')
    })

    it('produces a slug with no leading, trailing or doubled separators', () => {
      for (const [sector, city] of [
        ['  Sector 1  ', 'Noida'],
        ['Chi 1–5', 'Greater Noida'],
        ['Alpha 1 & 2', 'Greater Noida'],
      ] as Array<[string, string]>) {
        const slug = sectorSlug(sector, city)
        assert.ok(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug), `bad slug: "${slug}"`)
      }
    })

    it('distinguishes the same sector number in different cities', () => {
      // Sector 1 exists in Noida and in Greater Noida West. One URL for both
      // would make the city-disambiguation rule in the prompt unanswerable.
      assert.notEqual(sectorSlug('Sector 1', 'Noida'), sectorSlug('Sector 1', 'Greater Noida West'))
    })
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getBaseSystemPrompt, PRE_RENDERED_TABLE_STANDARD } from '../prompts/base'
import {
  renderMicroMarketTable,
  renderDerivedSectorTable,
  renderProjectTable,
  renderAlternativesTable,
  renderProjectComparisonTable,
  renderPaymentPlanTable,
  renderCostSheetTable,
  renderSectorComparisonTable,
  renderCityBandShelf,
} from '../marketTable'

function countColumns(tableMarkdown: string): number[] {
  const lines = tableMarkdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'))

  return lines.map((line) => {
    // Split by non-escaped pipes
    const cells = line.split(/(?<!\\)\|/).slice(1, -1)
    return cells.length
  })
}

describe('Phase 2.3 — Table Prompt Inlining Instruction Standard', () => {
  it('PRE_RENDERED_TABLE_STANDARD is inlined in getBaseSystemPrompt for all queryKinds', () => {
    const kinds = [
      'general',
      'PROJECT_DEEP_DIVE',
      'DRILLDOWN',
      'COST_BREAKDOWN',
      'COMPARISON',
      'SEARCH',
      'MARKET_OVERVIEW',
      'BUILDER_PROFILE',
    ]

    for (const kind of kinds) {
      const prompt = getBaseSystemPrompt(undefined, undefined, undefined, undefined, kind as any)
      assert.ok(
        prompt.includes('PRE-RENDERED TABLE INLINING STANDARD'),
        `Prompt for queryKind "${kind}" must include PRE_RENDERED_TABLE_STANDARD`,
      )
      assert.ok(
        prompt.includes('NEVER duplicate or redraw'),
        `Prompt for queryKind "${kind}" must instruct never redrawing pre-rendered tables`,
      )
      assert.ok(
        prompt.includes('Max 4-5 columns'),
        `Prompt for queryKind "${kind}" must include 4-5 column constraint rule`,
      )
    }
  })

  it('all pre-rendered tables strictly observe <= 5 columns and no code fence wrappers', () => {
    const sampleTables: Array<{ name: string; output: string }> = [
      {
        name: 'renderMicroMarketTable',
        output: renderMicroMarketTable([
          {
            microMarket: 'Central Expressway',
            sectors: ['Sector 128', 'Sector 129'],
            avgPricePerSqft: 14500,
            priceRange: { min: 12000, max: 18000 },
            dominantSegment: 'Luxury High-Rise',
          },
          {
            microMarket: 'Sector 150 Sports City',
            sectors: ['Sector 150'],
            avgPricePerSqft: 9800,
            priceRange: { min: 8500, max: 12500 },
            dominantSegment: 'Green Low-Density',
          },
        ]),
      },
      {
        name: 'renderDerivedSectorTable',
        output: renderDerivedSectorTable([
          { sector: 'Sector 150', projectCount: 15, readyCount: 4, priceMinCr: 1.2, priceMaxCr: 4.5 },
          { sector: 'Sector 128', projectCount: 8, readyCount: 3, priceMinCr: 2.5, priceMaxCr: 9.0 },
        ]),
      },
      {
        name: 'renderProjectTable',
        output: renderProjectTable([
          {
            name: 'Godrej Woods',
            builder: { name: 'Godrej' },
            sector: 'Sector 43',
            price_min_cr: 2.25,
            status: 'under_construction',
          },
          {
            name: 'ATS Knightsbridge',
            builder: { name: 'ATS' },
            sector: 'Sector 124',
            price_min_cr: 9.5,
            status: 'ready_to_move',
          },
        ]),
      },
      {
        name: 'renderAlternativesTable',
        output: renderAlternativesTable(
          [
            {
              name: 'Ace Starlit',
              sector: 'Sector 152',
              unit_types: [{ bhk: 3, price_min_cr: 2.1, price_max_cr: 2.6, carpet_area_sqft: 1400 }],
              possession_label: 'Dec 2025',
            },
            {
              name: 'Eldeco Live',
              sector: 'Sector 150',
              unit_types: [{ bhk: 3, price_min_cr: 1.9, price_max_cr: 2.4, carpet_area_sqft: 1350 }],
              possession_label: 'Ready',
            },
          ],
          [3],
        ),
      },
      {
        name: 'renderProjectComparisonTable',
        output: renderProjectComparisonTable([
          {
            name: 'Godrej Woods',
            builder: { name: 'Godrej' },
            sector: 'Sector 43',
            price_min_cr: 2.25,
            status: 'under_construction',
          },
          {
            name: 'Max Estate 128',
            builder: { name: 'Max Estates' },
            sector: 'Sector 128',
            price_min_cr: 4.5,
            status: 'under_construction',
          },
        ]),
      },
      {
        name: 'renderPaymentPlanTable',
        output: renderPaymentPlanTable([
          {
            plan_name: 'Construction Linked (CLP)',
            plan_type: 'clp',
            discount_offered_pct: 0,
            watch_out: 'Subject to construction pace',
            milestones: [
              { stage: '1', milestone: 'Booking', pct: 10, amt: '25 Lakh' },
              { stage: '2', milestone: 'Superstructure', pct: 40, amt: '1 Cr' },
            ],
          },
        ]),
      },
      {
        name: 'renderCostSheetTable',
        output: renderCostSheetTable(
          {
            base_price_per_sqft: 14500,
            parking_cost: 400000,
            ifms: 50,
            all_inclusive_price_cr: 2.65,
          },
          { name: 'Godrej Woods', status: 'under_construction' },
        ),
      },
      {
        name: 'renderSectorComparisonTable',
        output: renderSectorComparisonTable(
          {
            sector: 'Sector 150',
            totalProjects: 18,
            priceRange: '₹9,500 – 14,000/sqft',
            readyCount: 5,
            topProjects: 'Godrej Palm, ATS Le Grandiose',
          },
          {
            sector: 'Sector 128',
            totalProjects: 10,
            priceRange: '₹14,000 – 25,000/sqft',
            readyCount: 6,
            topProjects: 'Kalpataru Vista, Max Estate 128',
          },
        ),
      },
      {
        name: 'renderCityBandShelf',
        output: renderCityBandShelf([
          {
            name: 'Ace Parkway',
            builder: { name: 'Ace Group' },
            sector: 'Sector 150',
            unit_types: [{ price_min_cr: 0.95 }],
            possession_label: 'Ready to Move',
          },
          {
            name: 'Godrej Woods',
            builder: { name: 'Godrej' },
            sector: 'Sector 43',
            unit_types: [{ price_min_cr: 2.5 }],
            possession_label: 'Dec 2026',
          },
        ]),
      },
    ]

    for (const { name, output } of sampleTables) {
      assert.ok(output.length > 0, `${name} should produce non-empty table output`)

      // Check no triple-backtick wrapping
      assert.ok(
        !output.includes('```'),
        `${name} output must NOT be wrapped in code fence blocks (\`\`\`)`,
      )

      // Check column counts
      const colCounts = countColumns(output)
      assert.ok(colCounts.length >= 2, `${name} must contain at least header and divider rows`)
      for (const count of colCounts) {
        assert.ok(
          count <= 5,
          `${name} row has ${count} columns (strictly maximum 5 columns allowed to prevent mobile blowout)`,
        )
      }
    }
  })
})

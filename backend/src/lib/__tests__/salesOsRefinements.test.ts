// backend/src/lib/__tests__/salesOsRefinements.test.ts
//
// Verification suite for Sales-OS Market Intelligence & Advisory Engine (Phase 6).
// Ensures strict Zero-Project-Name Invariant, grounded ranges, transparent positioning,
// calibrated bridging, and legal due diligence checklists.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isRentalInquiry,
  isResaleInquiry,
  isCommercialInquiry,
  isChainOfTitleQuery,
  isSocietyFinancialQuery,
  isMultiFactorAdvisoryQuery,
  formatRentalAdvisory,
  formatResaleAdvisory,
  formatCommercialAdvisory,
  formatOutOfScopeCityAdvisory,
  getChainOfTitleChecklist,
  getSocietyFinancialHealthChecklist,
  getNonObviousOwnerFactorsGuide,
  detectSectorCluster,
} from '../advisory/marketAdvisory'
import { MARKET_QUALIFIER } from '../factPresentation'
import { executeJevDecision, type JevExecutionContext } from '../jev/execute'
import type { JevDecision } from '../jev/decision'
import type { Intent } from '../discovery/types'

function createMockContext(message: string): {
  ctx: JevExecutionContext
  events: Array<{ event: string; data: any }>
  state: { ended: boolean }
} {
  const events: Array<{ event: string; data: any }> = []
  const state = { ended: false }

  const res = {
    end: () => {
      state.ended = true
    },
    writableEnded: false,
  } as any

  const send = (event: string, data: any) => {
    events.push({ event, data })
  }

  const ctx: JevExecutionContext = {
    res,
    send,
    sessionId: 'test-session-sales-os',
    message,
    intent: {} as Intent,
  }

  return { ctx, events, state }
}

describe('Sales-OS Market Advisory & Zero-Project-Name Invariant (Phase 6)', () => {
  describe('Zero-Project-Name Invariant & Range Accuracy (Rental)', () => {
    const testCases = [
      { msg: 'flats for rent in sector 150', cluster: 'sector-150' },
      { msg: 'what is the rent in central noida sector 76', cluster: 'central-noida' },
      { msg: '3bhk rental rates in noida expressway', cluster: 'noida-expressway' },
      { msg: 'rental rates in greater noida west', cluster: 'greater-noida-west' },
    ]

    for (const tc of testCases) {
      it(`rental response for "${tc.msg}" delivers numbers without mentioning project names`, () => {
        const output = formatRentalAdvisory(tc.msg)

        // Grounded numbers must be present
        assert.ok(/₹\d{2},\d{3}/.test(output), 'Must contain rupee rental figures')
        assert.ok(/\d\.\d%/.test(output), 'Must contain yield percentages')
        assert.ok(/2\s*BHK/i.test(output), 'Must contain BHK breakdown')

        // Transparent positioning statement must be present
        assert.ok(
          output.includes('PropFyndr specializes') || output.includes('exclusively in direct primary developer sales'),
          'Must state primary developer sales focus',
        )

        // Bridge to primary ownership must be present
        assert.ok(/Next Step:/i.test(output), 'Must include calibrated next step')

        // ZERO PROJECT NAMES INVARIANT
        // Must not contain common project marketing identifiers
        const forbiddenProjectPatterns = [
          /\bATS\s+[A-Za-z]+/i,
          /\bGodrej\s+[A-Za-z]+/i,
          /\bTata\s+Eureka\b/i,
          /\bMahagun\s+[A-Za-z]+/i,
          /\bCleo\s+County\b/i,
          /\bACE\s+[A-Za-z]+/i,
          /\bCounty\s+Courtyard\b/i,
          /\bPrateek\s+[A-Za-z]+/i,
          /\bproject\s+name\b/i,
          /\blisting\s+id\b/i,
        ]
        for (const pattern of forbiddenProjectPatterns) {
          assert.equal(
            pattern.test(output),
            false,
            `Rental output must not mention project names: matched ${pattern}`,
          )
        }
      })
    }
  })

  describe('Zero-Project-Name Invariant & Range Accuracy (Resale)', () => {
    it('resale response provides rate bands and transfer friction without project names', () => {
      const output = formatResaleAdvisory('resale 3bhk in central noida')

      // Rate per sqft and typical capital outlay
      assert.ok(/₹\d{1,2},\d{3}/.test(output), 'Must contain rate per sqft')
      assert.ok(/typical\s+capital\s+outlay/i.test(output), 'Must provide capital outlay')
      assert.ok(/transfer\s+(?:memorandum|tm|charges)/i.test(output), 'Must explain transfer friction')

      // Transparent positioning
      assert.ok(
        output.includes('exclusively on primary developer sales') ||
          output.includes('direct builder inventory'),
        'Must state primary developer focus',
      )

      // Zero project names
      assert.equal(/\b(?:ATS|Godrej|Mahagun|Eldeco|Supertech)\s+[A-Za-z]+/i.test(output), false)
    })

    it('resale response explains leasehold tenure and tripartite deed when tenure is asked', () => {
      const output = formatResaleAdvisory('before buying a resale flat in noida is land leasehold or freehold')

      assert.ok(/most noida\/greater noida apartment land is authority leasehold \(typically 90-year\)/i.test(output), 'Must state the hedged leasehold norm')
      assert.ok(/confirm the tenure in the sale deed/i.test(output), 'Must send the buyer to the deed')
      assert.ok(/tripartite\s+sub-lease\s+deed/i.test(output), 'Must explain Tripartite Sub-Lease Deed')
      assert.ok(/transfer\s+memorandum\s*\(\s*tm\s*\)/i.test(output), 'Must explain TM / NOC')
      // No absolute tenure claims: some Noida land is not 90-year leasehold.
      assert.equal(/no\s+freehold|all\s+residential\s+land/i.test(output), false)
    })
  })

  describe('Market-tier figures and capability claims (CLAUDE.md Four Tiers)', () => {
    const outputs: Array<[string, string]> = [
      ['rental table', formatRentalAdvisory('rent in sector 150')],
      ['rental tenant', formatRentalAdvisory('tenant demand to rent out in noida expressway')],
      ['resale', formatResaleAdvisory('resale flat in greater noida west')],
      ['resale tenure', formatResaleAdvisory('is resale land leasehold or freehold in central noida')],
      ['out of scope city', formatOutOfScopeCityAdvisory('flats in gurgaon', 'gurgaon')],
      ['commercial', formatCommercialAdvisory('commercial shop')],
      ['society', getSocietyFinancialHealthChecklist()],
      ['owner factors', getNonObviousOwnerFactorsGuide()],
    ]

    for (const [name, output] of outputs) {
      it(`${name}: makes no "100%" claim`, () => {
        assert.equal(/100\s*%/.test(output), false)
      })

      it(`${name}: every ₹ figure or % range line carries the market qualifier`, () => {
        const figureLines = output
          .split('\n')
          .filter(l => /₹\s?\d|\d(?:\.\d+)?%?\s*[–-]\s*\d+(?:\.\d+)?%/.test(l))
        for (const line of figureLines) {
          assert.ok(line.includes(MARKET_QUALIFIER), `Unqualified figure line: ${line}`)
        }
      })
    }

    it('makes no unverifiable capability or sales-pitch claims', () => {
      const all = outputs.map(([, o]) => o).join('\n')
      assert.equal(/ground-level verification|testing municipal|exceptional|consumption|!/i.test(all), false)
      assert.equal(/Land Dues[^\n]*Evaluable from our data/.test(all), false)
      assert.equal(/Primary Tenant Segments|High-Velocity/i.test(all), false)
    })
  })

  describe('Chain-of-Title 8-Step Verification Checklist', () => {
    it('provides exhaustive sequential title verification sequence', () => {
      const guide = getChainOfTitleChecklist()

      assert.ok(guide.includes('Original Allotment Letter'), 'Step 1: Allotment Letter')
      assert.ok(guide.includes('Builder-Buyer Agreement'), 'Step 2: BBA')
      assert.ok(guide.includes('Prior Registered Sale Deed') || guide.includes('Tripartite Sub-Lease Deed'), 'Step 3: Registered Deed')
      assert.ok(guide.includes('Unbroken Chain of Ownership Continuity'), 'Step 4: Continuity')
      assert.ok(guide.includes('Non-Encumbrance Certificate') || guide.includes('EC Form 15'), 'Step 5: EC 12-30 yrs')
      assert.ok(guide.includes('Authority Transfer Memorandum') || guide.includes('Transfer Permission'), 'Step 6: TM Permission')
      assert.ok(guide.includes('AOA No-Objection Certificate') || guide.includes('NOC'), 'Step 7: Society NOC')
      assert.ok(guide.includes('Mutation Receipts'), 'Step 8: Mutation')
    })
  })

  describe('Society Financial Health Checklist', () => {
    it('covers AGM balance sheets, sinking funds, IFMS and maintenance arrears', () => {
      const guide = getSocietyFinancialHealthChecklist()

      assert.ok(/Audited\s+Balance\s+Sheets/i.test(guide), 'Must check 3-year AGM audits')
      assert.ok(/Maintenance\s+Arrears/i.test(guide), 'Must check maintenance defaulter ratio')
      assert.ok(/Sinking\s+Fund/i.test(guide), 'Must check sinking fund reserves')
      assert.ok(/Elevator|Lift/i.test(guide), 'Must mention elevator/lift capital overhaul')
      assert.ok(/IFMS/i.test(guide), 'Must explain Interest-Free Maintenance Security transfer')
      assert.ok(/internal\s+society\s+accounting\s+ledgers\s+are\s+private/i.test(guide), 'Must clarify private ledger limitation')
    })
  })

  describe('5 Non-Obvious Owner Factors Guide', () => {
    it('presents 5 critical factors categorized by data evaluability status', () => {
      const guide = getNonObviousOwnerFactorsGuide()

      assert.ok(/Water\s+Source\s+&\s+TDS/i.test(guide), 'Factor 1: Water source')
      assert.ok(/Dual-Meter\s+Electricity/i.test(guide), 'Factor 2: Electricity dual metering')
      assert.ok(/Carpet\s+Loading/i.test(guide), 'Factor 3: Carpet loading ratio')
      assert.ok(/Authority\s+Land\s+Dues/i.test(guide), 'Factor 4: Authority land dues')
      assert.ok(/Aging\s+Infrastructure/i.test(guide), 'Factor 5: Aging infrastructure')

      // Evaluability categories must be explicitly present
      assert.ok(guide.includes('Evaluable from our data'), 'Must classify evaluable factors')
      assert.ok(guide.includes('Partially evaluable'), 'Must classify partially evaluable factors')
      assert.ok(guide.includes('Not currently verifiable'), 'Must classify non-verifiable factors')
    })
  })

  describe('Single Exported Predicates (ERRORS.md Compliance)', () => {
    it('isRentalInquiry matches rental intent and rejects pure yield calculations', () => {
      assert.equal(isRentalInquiry('flats for rent in sector 150'), true)
      assert.equal(isRentalInquiry('looking to lease an apartment in noida'), true)
      assert.equal(isRentalInquiry('tenant demand along expressway'), true)
      // Pure yield calculator should NOT be intercepted as rental inquiry
      assert.equal(isRentalInquiry('what is the rental yield on 2cr flat with 50k rent?'), false)
    })

    it('isResaleInquiry matches resale terminology', () => {
      assert.equal(isResaleInquiry('resale flat in sector 75'), true)
      assert.equal(isResaleInquiry('bought from someone else'), true)
      assert.equal(isResaleInquiry('second hand apartment'), true)
      assert.equal(isResaleInquiry('fresh booking direct from builder'), false)
    })

    it('isChainOfTitleQuery matches ownership tracing queries', () => {
      assert.equal(isChainOfTitleQuery('trace chain of title for resale flat'), true)
      assert.equal(isChainOfTitleQuery('ownership chain verification checklist'), true)
      assert.equal(isChainOfTitleQuery('flat bought from prior owner'), true)
      assert.equal(isChainOfTitleQuery('price of 3bhk flat'), false)
    })

    it('isSocietyFinancialQuery matches society balance sheet and maintenance queries', () => {
      assert.equal(isSocietyFinancialQuery('how to check society financial health?'), true)
      assert.equal(isSocietyFinancialQuery('maintenance arrears and sinking fund balance'), true)
      assert.equal(isSocietyFinancialQuery('best luxury societies in noida'), false)
    })

    it('isMultiFactorAdvisoryQuery matches requests for unconsidered factors', () => {
      assert.equal(isMultiFactorAdvisoryQuery('5 factors that could materially affect ownership'), true)
      assert.equal(isMultiFactorAdvisoryQuery('what am i not thinking about?'), true)
      assert.equal(isMultiFactorAdvisoryQuery('what else should i consider?'), true)
      assert.equal(isMultiFactorAdvisoryQuery('show me 3bhk flats'), false)
    })
  })

  describe('JEV Live Dispatcher with Sales-OS Enhancements', () => {
    it('dispatches out_of_scope rental inquiry through Sales-OS bridge', async () => {
      const decision: JevDecision = {
        task: 'out_of_scope',
        sources: ['general'],
        shape: 'lookup',
        fields: [],
        clarify: null,
        via: 'llm',
      }

      const { ctx, events, state } = createMockContext('rent for 3bhk in sector 150')
      const handled = await executeJevDecision(decision, ctx)

      assert.equal(handled, true)
      assert.equal(state.ended, true)
      assert.ok(events.some(e => e.event === 'token' && e.data.token.includes('Indicative Market Rental Overview')))
      assert.ok(events.some(e => e.event === 'token' && e.data.token.includes('PropFyndr specializes')))
    })

    it('dispatches legal_process chain-of-title inquiry to specialized sequence', async () => {
      const decision: JevDecision = {
        task: 'legal_process',
        sources: ['statutory'],
        shape: 'advisory',
        fields: ['legal'],
        clarify: null,
        via: 'llm',
      }

      const { ctx, events, state } = createMockContext('trace ownership chain when buying from someone')
      const handled = await executeJevDecision(decision, ctx)

      assert.equal(handled, true)
      assert.equal(state.ended, true)
      assert.ok(events.some(e => e.event === 'token' && e.data.token.includes('Chain-of-Title & Resale Document Verification')))
    })

    it('dispatches legal_process society financial inquiry to specialized guide', async () => {
      const decision: JevDecision = {
        task: 'legal_process',
        sources: ['knowledge'],
        shape: 'advisory',
        fields: ['legal'],
        clarify: null,
        via: 'llm',
      }

      const { ctx, events, state } = createMockContext('how is the society managed financially reserve funds')
      const handled = await executeJevDecision(decision, ctx)

      assert.equal(handled, true)
      assert.equal(state.ended, true)
      assert.ok(events.some(e => e.event === 'token' && e.data.token.includes('Society Financial Health & Governance Due Diligence Guide')))
    })
  })
})

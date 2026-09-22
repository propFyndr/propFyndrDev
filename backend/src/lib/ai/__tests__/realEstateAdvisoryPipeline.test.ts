import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { classifyQueryDeterministic, getRenderTarget } from '../../discovery/queryClassifier'
import { cardBudgetFor } from '../../discovery/cardBudget'
import { matchedPlaybooks } from '../prompts/playbooks'
import { asksRentalYield, asksAppreciation } from '../yieldTable'
import { buildProjectFacts } from '../../projectFactsBlock'
import { classifyShape } from '../inferenceProfile'
import { outputContract } from '../prompts/base'

describe('Real Estate Advisory Pipeline - Integration Tests', () => {
  describe('1. Query Classification & Render Target', () => {
    it('routes "Which offers the most returns?" to ADVISORY / text', () => {
      const q = 'Which offers the most returns?'
      const classification = classifyQueryDeterministic(q)
      assert.equal(classification?.queryKind, 'ADVISORY')
      assert.equal(getRenderTarget(classification!.queryKind), 'text')
    })

    it('routes "Which is the best area to put money in, which will offer the best returns, and which is the safest bet?" to ADVISORY / text', () => {
      const q = 'Which is the best area to put money in, which will offer the best returns, and which is the safest bet?'
      const classification = classifyQueryDeterministic(q)
      assert.equal(classification?.queryKind, 'ADVISORY')
      assert.equal(getRenderTarget(classification!.queryKind), 'text')
    })

    it('routes "Is this a good option?" with project in scope to ADVISORY / text', () => {
      const q = 'Is this a good option?'
      const classification = classifyQueryDeterministic(q, { hasProjectInScope: true })
      assert.equal(classification?.queryKind, 'ADVISORY')
      assert.equal(getRenderTarget(classification!.queryKind), 'text')
    })

    it('routes "Is Ace Parkway worth buying?" to ADVISORY / text', () => {
      const q = 'Is Ace Parkway worth buying?'
      const classification = classifyQueryDeterministic(q, { hasProjectInScope: true })
      assert.equal(classification?.queryKind, 'ADVISORY')
      assert.equal(getRenderTarget(classification!.queryKind), 'text')
    })

    it('does NOT misclassify an affordability inventory search as ADVISORY', () => {
      const q = 'What can I afford with 1.5 cr in Noida?'
      const classification = classifyQueryDeterministic(q)
      // Should not be forced to ADVISORY text-only
      assert.notEqual(classification?.queryKind, 'ADVISORY')
    })
  })

  describe('2. Card Budget for Macro Questions vs Affordability', () => {
    it('awards 0 cards for "Which offers the most returns?" even if session has constraints', () => {
      const intent = { city: 'Noida', budgetMax: 20000000 }
      const budget = cardBudgetFor(intent, 'Which offers the most returns?')
      assert.equal(budget.limit, 0)
      assert.match(budget.reason, /broad investment advisory/)
    })

    it('awards 0 cards for "Which is the best area to put money in, which will offer the best returns, and which is the safest bet?"', () => {
      const intent = { city: 'Noida', bhk: ['3 BHK'] }
      const budget = cardBudgetFor(
        intent,
        'Which is the best area to put money in, which will offer the best returns, and which is the safest bet?'
      )
      assert.equal(budget.limit, 0)
      assert.match(budget.reason, /broad investment advisory/)
    })

    it('awards 1 card for project evaluation when 1 project is in focus', () => {
      const intent = { projectNames: ['Ace Parkway'] }
      const budget = cardBudgetFor(intent, 'Is this a good option?')
      assert.equal(budget.limit, 1)
      assert.match(budget.reason, /project evaluation advisory/)
    })

    it('awards 0 cards for project evaluation when no project is in focus', () => {
      const intent = {}
      const budget = cardBudgetFor(intent, 'Is this a good option?')
      assert.equal(budget.limit, 0)
    })

    it('preserves 6 cards for inventory search "What can I afford with 1.5 cr in Noida"', () => {
      const intent = { city: 'Noida', budgetMax: 15000000 }
      const budget = cardBudgetFor(intent, 'What can I afford with 1.5 cr in Noida')
      assert.equal(budget.limit, 6)
      assert.match(budget.reason, /2 constraints stated/)
    })
  })

  describe('3. Playbook Routing for Top Archetypes', () => {
    it('selects "yield" for "Which offers the most returns?"', () => {
      const hits = matchedPlaybooks('Which offers the most returns?')
      assert.ok(hits.includes('yield'), `expected yield, got: ${hits.join(', ')}`)
    })

    it('selects "macroCorridorStrategy" for "Which is the best area to put money in, which will offer the best returns, and which is the safest bet?"', () => {
      const hits = matchedPlaybooks(
        'Which is the best area to put money in, which will offer the best returns, and which is the safest bet?'
      )
      assert.ok(hits.includes('macroCorridorStrategy'), `expected macroCorridorStrategy, got: ${hits.join(', ')}`)
    })

    it('selects "projectEvaluation" for "Is this a good option?"', () => {
      const hits = matchedPlaybooks('Is this a good option?')
      assert.ok(hits.includes('projectEvaluation'), `expected projectEvaluation, got: ${hits.join(', ')}`)
    })

    it('selects "projectEvaluation" for "Is Ace Parkway worth buying?"', () => {
      const hits = matchedPlaybooks('Is Ace Parkway worth buying?')
      assert.ok(hits.includes('projectEvaluation'), `expected projectEvaluation, got: ${hits.join(', ')}`)
    })
  })

  describe('4. Yield Table Triggers', () => {
    it('triggers rental yield & appreciation for macro returns query', () => {
      const q = 'Which offers the most returns?'
      assert.equal(asksRentalYield(q), true)
      assert.equal(asksAppreciation(q), true)
    })

    it('triggers appreciation for best area to put money', () => {
      const q = 'Which is the best area to put money in, which will offer the best returns, and which is the safest bet?'
      assert.equal(asksAppreciation(q), true)
      assert.equal(asksRentalYield(q), true)
    })
  })

  describe('5. Project Facts Block Legal Risk Synthesis', () => {
    const baseProject: any = {
      id: 'proj-1',
      name: 'Test Residency',
      status: 'under_construction',
      builder: { name: 'Test Infra', litigation_count: 0 },
      units: [],
      amenities: [],
      connectivity: [],
      paymentPlans: [],
      costSheet: null,
      priceHistory: [],
    }

    it('synthesizes legal_risk_summary when litigation count > 0', () => {
      const projectWithLitigation = {
        ...baseProject,
        litigation_count: 4,
        ongoing_litigation_count: 2,
      }
      const facts = buildProjectFacts(projectWithLitigation, 'Is this a good option?')
      assert.ok(facts.legal_risk_summary)
      assert.match(facts.legal_risk_summary as string, /4 project litigation record\(s\)/)
      assert.match(facts.legal_risk_summary as string, /2 ongoing/)
    })

    it('synthesizes legal_risk_summary when NCLT moratorium is active', () => {
      const projectWithNCLT = {
        ...baseProject,
        nclt_moratorium_active: true,
      }
      const facts = buildProjectFacts(projectWithNCLT, 'Is this a good option?')
      assert.ok(facts.legal_risk_summary)
      assert.match(facts.legal_risk_summary as string, /ACTIVE NCLT insolvency moratorium/)
    })

    it('synthesizes legal_risk_summary when authority land dues are uncleared', () => {
      const projectWithDues = {
        ...baseProject,
        authority_dues_cleared: false,
      }
      const facts = buildProjectFacts(projectWithDues, 'Is this a good option?')
      assert.ok(facts.legal_risk_summary)
      assert.match(facts.legal_risk_summary as string, /Uncleared Noida\/Greater Noida Authority land dues/)
    })

    it('does NOT synthesize legal_risk_summary for clean projects', () => {
      const cleanProject = {
        ...baseProject,
        litigation_count: 0,
        ongoing_litigation_count: 0,
        nclt_moratorium_active: false,
        authority_dues_cleared: true,
      }
      const facts = buildProjectFacts(cleanProject, 'Is this a good option?')
      assert.equal(facts.legal_risk_summary, undefined)
    })
  })

  describe('6. Inference Profile & Output Contract Synchronization', () => {
    const ONE_MARKER: Record<'reasoning' | 'advisory' | 'factual' | 'lookup', string> = {
      reasoning: 'Spend the words',
      advisory: 'Commit in the first sentence',
      factual: 'supporting facts, one line each',
      lookup: 'This is a search phrase',
    }

    const queries = [
      'Which offers the most returns?',
      'Which is the best area to put money in, which will offer the best returns, and which is the safest bet?',
      'Is this a good option?',
      'Is Ace Parkway worth buying?',
    ]

    for (const q of queries) {
      it(`synchronizes shape classification for "${q}"`, () => {
        const shape = classifyShape(q)
        const contract = outputContract(q)
        const marker = ONE_MARKER[shape]
        assert.ok(
          contract.includes(marker),
          `classifyShape said "${shape}" but outputContract text does not contain "${marker}"`,
        )
      })
    }
  })
})

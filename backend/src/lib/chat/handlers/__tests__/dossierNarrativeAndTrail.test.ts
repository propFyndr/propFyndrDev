import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractDeterministicNarrative,
  extractDossierNarrative,
  ConsultationStep,
} from '../../dossierNarrativeExtractor'
import { getCached, setCached } from '../../../cache'

describe('Day 7: Consultation Dossier Narrative & Trail Engine', () => {
  const sampleTranscript: Array<{ role: 'user' | 'assistant'; content: string }> = [
    {
      role: 'user',
      content: 'What are good 3 BHK options in Sector 76 Noida near the metro under 2 Cr?',
    },
    {
      role: 'assistant',
      content:
        'Sector 76 Noida features mature social infrastructure with a 5-minute walk to Sector 76 metro station. However, 3 BHK prices average ₹1.85 Cr to ₹2.4 Cr, creating a tight budget buffer.',
    },
    {
      role: 'user',
      content: 'Is Amrapali Silicon City in Sector 76 safe regarding court receiver and registry dues?',
    },
    {
      role: 'assistant',
      content:
        'Amrapali Silicon City is physically complete under the Supreme Court NBCC receiver. However, sub-lease registry execution remains staggered.',
    },
    {
      role: 'user',
      content: 'Can we get more carpet area and newer construction if we pivot to Sector 10 Greater Noida West?',
    },
    {
      role: 'assistant',
      content:
        'Pivoting to Sector 10 Greater Noida West delivers +30% larger carpet area for under ₹1.5 Cr. Note that Sector 10 relies primarily on borewell groundwater.',
    },
    {
      role: 'user',
      content: 'Check Elite X in Sector 10 for water TDS and UP lifts act compliance.',
    },
    {
      role: 'assistant',
      content:
        'Elite X has 0 pending Authority land dues under the Amitabh Kant formula. Groundwater TDS is ~800 ppm, necessitating heavy reverse osmosis filtration.',
    },
    {
      role: 'user',
      content: 'Give me a family memo dossier summarizing our entire conversation.',
    },
  ]

  const targetProjects = [
    { id: 'p-1', name: 'Amrapali Silicon City', sector: '76' },
    { id: 'p-2', name: 'Elite X', sector: '10' },
  ]

  it('T7.1: Multi-Turn Narrative Extraction discovers sequential consultation steps & sector pivot', () => {
    const narrative = extractDeterministicNarrative(sampleTranscript, targetProjects)

    assert.ok(narrative.consultationTrail.length >= 3, `Expected >= 3 steps, got ${narrative.consultationTrail.length}`)

    // Check for Sector Pivot
    const hasSectorPivot = narrative.consultationTrail.some(s => s.badge === 'SECTOR_PIVOT')
    assert.strictEqual(hasSectorPivot, true, 'Should identify sector pivot from Sector 76 to Sector 10')

    // Check search evolution summary mentions sectors
    assert.ok(
      narrative.searchEvolutionSummary.toLowerCase().includes('sector 76') ||
      narrative.searchEvolutionSummary.toLowerCase().includes('noida'),
      'Search evolution summary should mention starting sector or Noida'
    )
  })

  it('T7.2: Conciseness Enforcement: questions <= 15 words and verdicts <= 25 words', () => {
    const narrative = extractDeterministicNarrative(sampleTranscript, targetProjects)

    for (const step of narrative.consultationTrail) {
      const qWordCount = step.userQuestion.trim().split(/\s+/).length
      const vWordCount = step.groundRealityVerdict.trim().split(/\s+/).length

      assert.ok(
        qWordCount <= 16, // Allowing +1 for ellipsis if appended
        `userQuestion exceeded word limit (${qWordCount} words): "${step.userQuestion}"`
      )
      assert.ok(
        vWordCount <= 26, // Allowing +1 for ellipsis if appended
        `groundRealityVerdict exceeded word limit (${vWordCount} words): "${step.groundRealityVerdict}"`
      )
    }
  })

  it('T7.3: Zero-Latency Fallback completes in < 15ms with deterministic guarantees', () => {
    const start = performance.now()
    const narrative = extractDeterministicNarrative(sampleTranscript, targetProjects)
    const elapsedMs = performance.now() - start

    assert.ok(elapsedMs < 15, `Expected < 15ms execution time, took ${elapsedMs.toFixed(2)}ms`)
    assert.ok(narrative.consultationTrail.length > 0)
    assert.ok(narrative.searchEvolutionSummary.length > 20)
  })

  it('T7.4: deterministic fallback never invents a trade-off from names alone', () => {
    // Only name + sector are known here; any advantage/drawback would be
    // fabricated into a document shared with the buyer's family.
    const narrative = extractDeterministicNarrative(sampleTranscript, targetProjects)
    assert.strictEqual(narrative.tradeOffDilemma, null)
  })

  it('T7.5: Category Badges correctly tag Legal, Water, Lift, and Pivot inquiries', () => {
    const testCases: Array<{ q: string; reply: string; expectedBadge: string }> = [
      {
        q: 'Check whether the court receiver has cleared registry and builder dues.',
        reply: 'Authority land dues remain pending under litigation.',
        expectedBadge: 'LEGAL_CHECK',
      },
      {
        q: 'What is the drinking water supply and borewell TDS range?',
        reply: 'Ganga Jal water is active with TDS under 250 ppm.',
        expectedBadge: 'WATER_AUDIT',
      },
      {
        q: 'Is this high-rise compliant with UP Lifts Act 2024 elevator standards?',
        reply: 'Lifts are registered with the UP energy directorate.',
        expectedBadge: 'VERTICAL_TRANSIT',
      },
      {
        q: 'Can I afford the monthly net EMI on a 25 Lakh annual salary?',
        reply: 'Net monthly outflow is ₹92,000 adhering to safe 40% DTI.',
        expectedBadge: 'BUDGET_TEST',
      },
    ]

    for (const tc of testCases) {
      const messages = [
        { role: 'user' as const, content: tc.q },
        { role: 'assistant' as const, content: tc.reply },
      ]
      const n = extractDeterministicNarrative(messages, [])
      const step = n.consultationTrail[0]
      assert.strictEqual(step.badge, tc.expectedBadge, `Query "${tc.q}" should have badge ${tc.expectedBadge}, got ${step?.badge}`)
    }
  })

  it('T7.6: Asynchronous Family Reaction Cache State Persistence', async () => {
    const testToken = `test_dossier_${Date.now()}`
    const key = `dossier_reactions:${testToken}`

    // 1. Initial State
    let reactions = (await getCached<Record<string, { likes: number; concerns: string[] }>>(key)) || {}
    assert.deepStrictEqual(reactions, {})

    // 2. Add Like
    reactions['p-1'] = { likes: 1, concerns: [] }
    await setCached(key, reactions, 3600)

    let fetched = await getCached<Record<string, { likes: number; concerns: string[] }>>(key)
    assert.strictEqual(fetched?.['p-1']?.likes, 1)

    // 3. Add Concern
    reactions['p-1'].concerns.push('High groundwater TDS (>800 ppm)')
    await setCached(key, reactions, 3600)

    fetched = await getCached<Record<string, { likes: number; concerns: string[] }>>(key)
    assert.strictEqual(fetched?.['p-1']?.concerns.length, 1)
    assert.strictEqual(fetched?.['p-1']?.concerns[0], 'High groundwater TDS (>800 ppm)')
  })
})

import { classifyQuery } from '../src/lib/discovery/queryClassifier'
import { cardBudgetFor } from '../src/lib/discovery/cardBudget'
import { extractIntent } from '../src/lib/ai/intent'

async function run() {
  console.log('Testing query classification and card budget zeroing...\n')

  const testCases = [
    {
      query: 'Is 1.5 crores enough for a good 3 BHK in Noida?',
      expectedKind: 'ADVISORY',
      expectedTarget: 'text',
      expectedBudget: 0,
    },
    {
      query: 'What property in Noida will give me the highest return?',
      expectedKind: 'ADVISORY',
      expectedTarget: 'text',
      expectedBudget: 0,
    },
    {
      query: 'Show me 3 BHK in Sector 150 under 2.5 Cr',
      expectedKind: ['DISCOVERY', 'RANKING'],
      expectedTarget: 'both',
      minBudget: 4,
    },
  ]

  let allPassed = true

  for (const tc of testCases) {
    const classification = classifyQuery(tc.query, {})
    const intentResult = await extractIntent(tc.query, {} as any)
    const intent = intentResult.intent
    const budget = cardBudgetFor(intent, tc.query)

    console.log(`Query: "${tc.query}"`)
    console.log(`  -> queryKind: ${classification.queryKind} (reason: ${classification.reason})`)
    console.log(`  -> renderTarget: ${classification.renderTarget}`)
    console.log(`  -> cardBudget: ${budget.limit} (reason: ${budget.reason})`)

    const kindMatches = Array.isArray(tc.expectedKind)
      ? tc.expectedKind.includes(classification.queryKind)
      : classification.queryKind === tc.expectedKind

    const targetMatches = classification.renderTarget === tc.expectedTarget

    const budgetMatches = tc.expectedBudget !== undefined
      ? budget.limit === tc.expectedBudget
      : budget.limit >= (tc.minBudget ?? 0)

    if (kindMatches && targetMatches && budgetMatches) {
      console.log('  ✅ PASS\n')
    } else {
      console.error('  ❌ FAIL:', {
        kindMatches,
        targetMatches,
        budgetMatches,
        expected: tc,
        got: {
          kind: classification.queryKind,
          target: classification.renderTarget,
          budget: budget.limit,
        },
      })
      allPassed = false
      console.log()
    }
  }

  if (!allPassed) {
    console.error('Some test cases failed!')
    process.exit(1)
  }

  console.log('All query classification tests passed successfully!')
}

run().catch((err) => {
  console.error('Execution error:', err)
  process.exit(1)
})

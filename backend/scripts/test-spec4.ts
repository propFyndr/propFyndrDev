// backend/scripts/test-spec4.ts
import { classifyQuery } from '../src/lib/discovery/queryClassifier'
import { prenormalizeRawText } from '../src/lib/discovery/messyLanguageNormalizer'
import { normalizeRequirementState } from '../src/lib/discovery/requirementState'
import { cardBudgetFor } from '../src/lib/discovery/cardBudget'
import { extractIntent } from '../src/lib/ai/intent'
import { detectBrokerHype, checkAnswerIntegritySync } from '../src/lib/ai/answerIntegrity'

const QUERIES = [
  {
    id: 1,
    title: 'Waterlogging / monsoon risk',
    query:
      'I don\'t want a flat in an area that regularly gets waterlogged during heavy monsoon. Which of these projects have the best available evidence on drainage, waterlogging history and surrounding road conditions?',
    domain: 'ENVIRONMENTAL_RISK',
  },
  {
    id: 2,
    title: 'Power backup / electricity reliability',
    query:
      'I work from home and can\'t afford frequent power interruptions. Compare these projects on power backup, DG dependency, backup coverage for elevators and common areas, and anything else that could affect day-to-day reliability.',
    domain: 'INFRASTRUCTURE_RELIABILITY',
  },
  {
    id: 3,
    title: 'Water supply and source',
    query:
      'For these projects, tell me what is known about their water supply. I care about municipal supply versus groundwater, treatment systems, storage and whether residents have reported water-related problems.',
    domain: 'WATER_INFRASTRUCTURE',
  },
  {
    id: 4,
    title: 'Redevelopment / major future disruption',
    query:
      'I\'m buying for the long term. Are there any known redevelopment, major infrastructure, demolition, land-use or large construction issues around these projects that I should investigate before buying?',
    domain: 'LONG_HORIZON_RISK',
  },
  {
    id: 5,
    title: 'Leasehold / land-tenure structure',
    query:
      'Before I buy a resale flat in Noida, I want to understand whether the project sits on leasehold or freehold land, who the underlying authority is, what that means for transfer, and what documents I should verify.',
    domain: 'LEGAL_TENURE',
  },
  {
    id: 6,
    title: 'Resale transaction chain',
    query:
      'The owner says they bought this flat from someone else five years ago and now want to sell it to me. What documents should I trace through the ownership chain before I pay a token?',
    domain: 'TITLE_CHAIN_VERIFICATION',
  },
  {
    id: 7,
    title: 'Society financial health',
    query:
      'Two societies look equally good physically. I want to know which one is better managed financially. What should I ask for to assess maintenance arrears, major pending repairs, reserve funds, and unusually high future expenses?',
    domain: 'SOCIETY_MANAGEMENT',
  },
  {
    id: 8,
    title: 'Heat / orientation / summer comfort',
    query:
      'I care more about summer heat than having a pretty view. Which parts of the apartment configuration should I compare before choosing a flat, and can you identify any of those differences from the available property data?',
    domain: 'PHYSICAL_THERMAL_ENGINEERING',
  },
  {
    id: 9,
    title: 'Rental demand by tenant type',
    query:
      'I may rent this apartment out in two years. Don\'t just tell me the expected rent. Tell me what kind of tenant demand each area appears suited for, what factors support that, and what information you don\'t have.',
    domain: 'TENANT_DEMAND_ANALYSIS',
  },
  {
    id: 10,
    title: 'Niche test: What am I not thinking about?',
    query:
      'I\'m already comparing price, carpet area, builder reputation, location and possession. What are five less-obvious things that could materially affect my experience as an owner, and which of those can RealtyPals actually evaluate for these properties?',
    domain: 'COMPREHENSIVE_CONSULTING',
  },
]

async function run() {
  console.log('=================================================================')
  console.log('REALTYPALS BETA RED-TEAM BATCH 4: 10 NICHE CONSULTING QUERIES')
  console.log('=================================================================\n')

  for (const item of QUERIES) {
    console.log(`[QUERY ${item.id}]: ${item.title}`)
    console.log(`Input: "${item.query}"`)

    // 1. Normalization
    const norm = prenormalizeRawText(item.query)
    // 2. Requirement state
    const req = normalizeRequirementState(norm.normalized)
    // 3. Classification
    const classification = classifyQuery(item.query, {})
    // 4. Intent
    const intentRes = await extractIntent(item.query, {} as any)
    const intent = intentRes.intent
    // 5. Card budget
    const cardBudget = cardBudgetFor(intent, item.query)

    console.log(`  -> Classification: kind=${classification.queryKind}, target=${classification.renderTarget}`)
    console.log(`  -> Card Budget: ${cardBudget.limit} (${cardBudget.reason})`)
    console.log(`  -> Intent Mode: ${req.intentMode}`)
    console.log(`  -> Ambiguity Score: ${norm.ambiguityScore}, requiresClarification: ${norm.requiresClarification}`)
    console.log(`  -> Intent Object: sector=${intent.sector || 'none'}, project=${intent.project || 'none'}, isAdvisory=${intent.isAdvisory ?? false}`)
    console.log('-----------------------------------------------------------------')
  }
}

run().catch((e) => {
  console.error('Error running Spec 4 tests:', e)
  process.exit(1)
})

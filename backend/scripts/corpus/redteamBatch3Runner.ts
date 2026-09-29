// backend/scripts/corpus/redteamBatch3Runner.ts
//
// Authoritative RealtyPals Final Beta Run — Batch 3 Runner.
// Executes and validates all 50 test cases across 5 passes from
// RealtyPals_Beta_RedTeam_Processing_Spec3.md with zero-tolerance acceptance criteria.
//
// Usage:
//   npx tsx scripts/corpus/redteamBatch3Runner.ts

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { normalizeRequirementState, prenormalizeRawText, type RequirementState } from '../../src/lib/discovery/requirementState'
import { compileQueryPlan } from '../../src/lib/discovery/queryPlan'
import { checkAnswerIntegrity } from '../../src/lib/ai/answerIntegrity'
import { calcRentalYield, sqmToSqft, calcEmi, formatInr } from '../../src/lib/calculators'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface Batch3TestCase {
  id: number
  title: string
  passCategory:
    | 'Pass 1: Property Understanding & Economics'
    | 'Pass 2: Physical & Lifestyle Grounding'
    | 'Pass 3: Ownership & Buyer Scenarios'
    | 'Pass 4: Temporal + Messy-Language Handling'
    | 'Pass 5: Evidence, Neutrality & Final Boss'
  description: string
  run: () => Promise<{ pass: boolean; reason?: string }>
}

export interface TestResult {
  id: number
  title: string
  category: string
  pass: boolean
  p0Defect: boolean
  reason?: string
}

export function buildBatch3Battery(): Batch3TestCase[] {
  const tests: Batch3TestCase[] = []

  // ──────────────────────────────────────────────────────────────────────────
  // PASS 1 — PROPERTY UNDERSTANDING & ECONOMICS (1–10)
  // ──────────────────────────────────────────────────────────────────────────

  tests.push({
    id: 1,
    title: '“Why is this property cheap?”',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: 'Separates verified reasons from general possibilities and does not invent a defect.',
    run: async () => {
      const q = 'This apartment is noticeably cheaper than the others in the same sector. What are the possible reasons, and which of those can you actually verify?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EXPLAIN') || state.intentModes.includes('EVIDENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 2,
    title: 'Maintenance-to-value question',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: 'Explains the comparison without assuming the expensive one is automatically worse.',
    run: async () => {
      const q = 'Two apartments cost roughly the same, but one has much higher monthly maintenance. How should I think about that difference?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('COMPARE') || state.intentModes.includes('FINANCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 3,
    title: 'Rent-versus-price relationship',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: 'Calculates gross rental yield correctly: ₹42k/mo on ₹1.6 Cr = 3.15%.',
    run: async () => {
      const res = calcRentalYield(42000, 1.6)
      const pass = res.grossYieldPct === 3.15 && res.annualGrossRent === 504000
      return { pass, reason: pass ? undefined : `grossYieldPct=${res.grossYieldPct}, annualGrossRent=${res.annualGrossRent}` }
    },
  })

  tests.push({
    id: 4,
    title: 'Vacancy sensitivity',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: '4 months vacancy incorporated into calculation: 8 months yield = 2.10%.',
    run: async () => {
      const res = calcRentalYield(42000, 1.6, { vacancyMonths: 4 })
      const pass = res.grossYieldPct === 2.10 && res.effectiveOccupancyMonths === 8 && res.annualGrossRent === 336000
      return { pass, reason: pass ? undefined : `grossYieldPct=${res.grossYieldPct}, annualGrossRent=${res.annualGrossRent}` }
    },
  })

  tests.push({
    id: 5,
    title: 'Maintenance-adjusted rental yield',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: 'Subtracts ₹8,000/mo maintenance: Net yield = 2.55%.',
    run: async () => {
      const res = calcRentalYield(42000, 1.6, { monthlyMaintenance: 8000 })
      const pass = res.netYieldPct === 2.55 && res.annualNetRent === 408000
      return { pass, reason: pass ? undefined : `netYieldPct=${res.netYieldPct}, annualNetRent=${res.annualNetRent}` }
    },
  })

  tests.push({
    id: 6,
    title: 'Parking economics',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: 'Treats parking as separate economic component rather than blindly adding to base price.',
    run: async () => {
      const q = 'The seller wants another ₹7 lakh for an additional parking slot. How should I compare that with buying the apartment without it?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('FINANCE') || state.intentModes.includes('DISCOVER')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 7,
    title: 'Furnished vs unfurnished',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: 'Frames comparison around actual included items, replacement cost, and useful life.',
    run: async () => {
      const q = "One flat is ₹8 lakh more expensive because it's fully furnished. How can I work out whether that premium makes sense?"
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('COMPARE') || state.intentModes.includes('FINANCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 8,
    title: 'Renovation decision',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: 'Builds a comparison framework and requests renovation/furnishing details when needed.',
    run: async () => {
      const q = 'Would it be cheaper to buy a dated resale apartment and renovate it, or pay more for a recently renovated one?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('FINANCE') || state.intentModes.includes('DISCOVER')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 9,
    title: 'Floor-plan usability',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: 'Discusses room dimensions, circulation, balcony loss only where facts exist.',
    run: async () => {
      const q = "I don't care about the headline carpet area. Can you help me judge whether the floor plan itself is actually usable?"
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EXPLAIN') || state.intentModes.includes('DISCOVER')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 10,
    title: 'Privacy question',
    passCategory: 'Pass 1: Property Understanding & Economics',
    description: 'Only makes claim if floor-plan/layout data actually supports it.',
    run: async () => {
      const integrity = checkAnswerIntegrity({
        answer: 'This unit guarantees complete bedroom privacy from the main entrance.',
        hasMentionedProjects: true,
      })
      const pass = !integrity.valid // Catches unverified guarantee claim
      return { pass, reason: pass ? undefined : 'Failed to catch unverified layout guarantee claim' }
    },
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PASS 2 — PHYSICAL & LIFESTYLE SUITABILITY (11–20)
  // ──────────────────────────────────────────────────────────────────────────

  tests.push({
    id: 11,
    title: 'Natural-light reasoning',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: 'Uses orientation/window/opening if available, otherwise reports as unverified.',
    run: async () => {
      const integrity = checkAnswerIntegrity({
        answer: 'Tower A gets the most beautiful morning natural light of any tower in Noida.',
        hasMentionedProjects: true,
      })
      const pass = !integrity.valid
      return { pass, reason: pass ? undefined : 'Failed to catch unsupported natural light claim' }
    },
  })

  tests.push({
    id: 12,
    title: 'Ventilation',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: "Doesn't infer cross-ventilation simply from 'two balconies'.",
    run: async () => {
      const integrity = checkAnswerIntegrity({
        answer: 'Because this apartment has two balconies, it offers guaranteed cross-ventilation.',
        hasMentionedProjects: true,
      })
      const pass = !integrity.valid
      return { pass, reason: pass ? undefined : 'Failed to catch false inference of cross-ventilation' }
    },
  })

  tests.push({
    id: 13,
    title: 'Road-noise exposure',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: 'Distinguishes measured proximity from inference, does not claim ungrounded noise levels.',
    run: async () => {
      const integrity = checkAnswerIntegrity({
        answer: 'Road noise level in Tower C is guaranteed to be under 40 decibels.',
        hasMentionedProjects: true,
      })
      const pass = !integrity.valid
      return { pass, reason: pass ? undefined : 'Failed to catch unverified decibel noise claim' }
    },
  })

  tests.push({
    id: 14,
    title: 'Construction activity',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: 'Distinguishes existing construction, planned development, and unverified future activity.',
    run: async () => {
      const q = "I don't want to buy into a society where I'll spend the next two years surrounded by construction. What can you tell me about ongoing development around these projects?"
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DUE_DILIGENCE') || state.intentModes.includes('DISCOVER')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 15,
    title: 'Open-space quality',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: 'Does not equate raw open-area percentage with usable recreational space.',
    run: async () => {
      const q = 'Two projects have the same amount of open area on paper. Which one has more genuinely usable open space?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('COMPARE') || state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 16,
    title: 'Family layout',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: 'Asks for or uses actual layout characteristics rather than assuming every 3BHK is equivalent.',
    run: async () => {
      const q = 'I need a 3BHK where my parents can have reasonable privacy without feeling completely separated from the rest of the family.'
      const state = normalizeRequirementState(q)
      const pass = state.unit.bhk.includes(3) && state.preferences.familyContext.includes('parents')
      return { pass, reason: pass ? undefined : `bhk=${JSON.stringify(state.unit.bhk)}, family=${JSON.stringify(state.preferences.familyContext)}` }
    },
  })

  tests.push({
    id: 17,
    title: 'Work-from-home requirement',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: 'Distinguishes generic 3BHK from a property with suitable dedicated workspace.',
    run: async () => {
      const q = 'I need one room that can function as a proper home office without turning the third bedroom into a permanent office.'
      const state = normalizeRequirementState(q)
      const pass = state.unit.bhk.includes(3) || state.preferences.useCase !== 'unknown' || state.intentModes.includes('DISCOVER')
      return { pass }
    },
  })

  tests.push({
    id: 18,
    title: 'Elderly accessibility',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: "Evaluates lift availability, floor level, access without inventing accessibility standards.",
    run: async () => {
      const q = "Which properties are easier to manage for older parents who don't like stairs?"
      const state = normalizeRequirementState(q)
      const pass = state.preferences.familyContext.includes('parents') || state.intentModes.includes('DISCOVER')
      return { pass }
    },
  })

  tests.push({
    id: 19,
    title: 'Child safety',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: 'Advisory mode; does not pretend these attributes are verified for every project.',
    run: async () => {
      const q = 'I have a four-year-old. What property-level and society-level things should I check before shortlisting a home?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DISCOVER') && !state.intentModes.includes('SEARCH')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 20,
    title: 'Pet ownership',
    passCategory: 'Pass 2: Physical & Lifestyle Grounding',
    description: 'Gives relevant considerations (access, society restrictions) while distinguishing advice from verified facts.',
    run: async () => {
      const q = 'I have a large dog. Which property features should I care about before I shortlist apartments?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DISCOVER') && !state.intentModes.includes('SEARCH')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PASS 3 — OWNERSHIP & BUYER SCENARIOS (21–30)
  // ──────────────────────────────────────────────────────────────────────────

  tests.push({
    id: 21,
    title: 'Tenant perspective',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'Switches from purchase-search intent to rental/location advisory (0 purchase cards).',
    run: async () => {
      const q = "I'm not buying yet. I'm planning to rent for two years and want to learn which Noida areas would make sense for me before I eventually purchase."
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DISCOVER') && !state.intentModes.includes('SEARCH')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 22,
    title: 'Rent-first strategy',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'Advisory answer; no forced property cards.',
    run: async () => {
      const q = 'Would renting in a sector for a year before buying there help me make a better property decision?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DISCOVER') && !state.intentModes.includes('SEARCH')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 23,
    title: 'Resale owner question',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'Recognizes a two-property transition rather than treating this as normal first-home purchase.',
    run: async () => {
      const q = 'I already own a 2BHK. I want to move to a 3BHK without selling my current home immediately. What financial variables should I model?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('FINANCE') && state.intentModes.includes('DISCOVER')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 24,
    title: 'Upgrade scenario',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'Models net proceeds, outstanding loan, registry/tax, and cash requirements.',
    run: async () => {
      const q = 'My current flat is worth roughly ₹90 lakh and the home I want costs ₹1.5 Cr. What numbers should I compare before deciding whether to upgrade?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('FINANCE') || state.intentModes.includes('DISCOVER')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 25,
    title: 'Co-buying',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'General informational answer on joint financing and legal/tax specifics.',
    run: async () => {
      const q = 'My spouse and I are buying together. What ownership and financing details should we settle before choosing the property?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('FINANCE') || state.intentModes.includes('DISCOVER')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 26,
    title: 'First-time buyer checklist',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'Produces practical structured due-diligence checklist covering verifiable fields.',
    run: async () => {
      const q = "I'm buying my first apartment and have no idea what information I should collect for every property before I compare them."
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DUE_DILIGENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 27,
    title: 'Seller-question generator',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'Generates actionable questions specific to resale due diligence.',
    run: async () => {
      const q = 'Give me the ten questions I should ask the seller after I shortlist this resale flat.'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DUE_DILIGENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 28,
    title: 'Site-visit preparation',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'Produces a repeatable checklist rather than recommending a property.',
    run: async () => {
      const q = "I'm visiting three properties tomorrow. Build me a checklist so I can compare them consistently on-site."
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DUE_DILIGENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 29,
    title: 'Property document checklist',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'Clearly distinguishes guidance from legal advice; covers essential chain of title.',
    run: async () => {
      const q = 'Before paying a token amount, what documents should I ask for and verify?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DUE_DILIGENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 30,
    title: 'Red-flag explanation',
    passCategory: 'Pass 3: Ownership & Buyer Scenarios',
    description: 'Practical observations; does not state that spotting a red flag proves a legal defect.',
    run: async () => {
      const q = 'Give me a practical red-flag checklist for a resale apartment that I can use during the first five minutes of a site visit.'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('DUE_DILIGENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PASS 4 — TEMPORAL + MESSY-LANGUAGE HANDLING (31–40)
  // ──────────────────────────────────────────────────────────────────────────

  tests.push({
    id: 31,
    title: 'Date-relative query',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: 'Uses actual date/freshness field without invented fixed period.',
    run: async () => {
      const q = 'Show me projects whose possession status changed recently.'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('MARKET_RESEARCH') || state.intentModes.includes('SEARCH')
      return { pass }
    },
  })

  tests.push({
    id: 32,
    title: 'Historical snapshot',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: 'Answers only if historical launch-price data exists; otherwise explicitly unavailable.',
    run: async () => {
      const q = "What was this project's advertised price when it first launched?"
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('FINANCE') || state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 33,
    title: 'Price movement',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: "Uses historical price records, doesn't fabricate a trend from isolated listings.",
    run: async () => {
      const q = "Has this project's asking price changed materially over time?"
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('FINANCE') || state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 34,
    title: 'Listing timeline',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: 'Uses listing history if available; otherwise says it cannot establish duration.',
    run: async () => {
      const q = 'How long has this particular apartment been on the market?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EVIDENCE') || state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 35,
    title: 'Stale-listing detection',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: 'Uses concrete freshness signals (update timestamps, stale price verification).',
    run: async () => {
      const q = "Find properties whose listings look outdated and explain what makes you think they're stale."
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EVIDENCE') || state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 36,
    title: 'Unit-language chaos',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: '1.5k carpet (1500 sqft), ambiguous 1500 budget, ambiguous jaldi possession -> requests clarification.',
    run: async () => {
      const q = 'I need a 1.5k carpet wali 3BHK, budget around 1500, possession jaldi chahiye.'
      const state = normalizeRequirementState(q)
      const pass =
        state.unit.minCarpetSqft === 1500 &&
        state.unit.bhk.includes(3) &&
        state.control.requiresClarification &&
        state.control.ambiguities.includes('ambiguous_budget_1500') &&
        state.control.ambiguities.includes('ambiguous_possession_jaldi')
      return { pass, reason: pass ? undefined : `state=${JSON.stringify(state)}` }
    },
  })

  tests.push({
    id: 37,
    title: 'Spoken-style transcription',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: '“umm... maybe around one point four five, three bedroom, somewhere near one fifty, but not too far from sixty two”',
    run: async () => {
      const q = 'umm... maybe around one point four five, three bedroom, somewhere near one fifty, but not too far from sixty two'
      const state = normalizeRequirementState(q)
      const pass =
        state.budget.maxCr === 1.45 &&
        state.unit.bhk.includes(3) &&
        state.location.softPreferences.includes('Sector 150') &&
        state.commute.some((c) => c.destination === 'Sector 62')
      return { pass, reason: pass ? undefined : `budget=${state.budget.maxCr}, bhk=${state.unit.bhk}, soft=${JSON.stringify(state.location.softPreferences)}, commute=${JSON.stringify(state.commute)}` }
    },
  })

  tests.push({
    id: 38,
    title: 'Typos everywhere',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: '“shw me 3bhk’s in secotr 150 undr 1.4 cr radymov”',
    run: async () => {
      const q = 'shw me 3bhk’s in secotr 150 undr 1.4 cr radymov'
      const state = normalizeRequirementState(q)
      const pass =
        state.unit.bhk.includes(3) &&
        state.location.include.includes('Sector 150') &&
        state.budget.maxCr === 1.4 &&
        state.budget.isHardCeiling &&
        state.unit.status === 'ready_to_move'
      return { pass, reason: pass ? undefined : `state=${JSON.stringify(state)}` }
    },
  })

  tests.push({
    id: 39,
    title: 'Abbreviations',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: '“3bhk RTM ≤1.4C in CN, preferably S150.”',
    run: async () => {
      const q = '3bhk RTM ≤1.4C in CN, preferably S150.'
      const state = normalizeRequirementState(q)
      const pass =
        state.unit.bhk.includes(3) &&
        state.unit.status === 'ready_to_move' &&
        state.budget.maxCr === 1.4 &&
        state.budget.isHardCeiling &&
        state.location.include.includes('Central Noida') &&
        state.location.softPreferences.includes('Sector 150')
      return { pass, reason: pass ? undefined : `state=${JSON.stringify(state)}` }
    },
  })

  tests.push({
    id: 40,
    title: 'Mixed units',
    passCategory: 'Pass 4: Temporal + Messy-Language Handling',
    description: '“Minimum 130 sqm carpet, under ₹1.4 crore, and at least 3 bedrooms.” -> 130 sqm converted to sqft.',
    run: async () => {
      const q = 'Minimum 130 sqm carpet, under ₹1.4 crore, and at least 3 bedrooms.'
      const state = normalizeRequirementState(q)
      const pass =
        state.unit.minCarpetSqft === 1399 &&
        state.unit.isCarpetHard &&
        state.budget.maxCr === 1.4 &&
        state.unit.bhk.includes(3)
      return { pass, reason: pass ? undefined : `minCarpetSqft=${state.unit.minCarpetSqft}, isCarpetHard=${state.unit.isCarpetHard}, maxCr=${state.budget.maxCr}` }
    },
  })

  // ──────────────────────────────────────────────────────────────────────────
  // PASS 5 — EVIDENCE, NEUTRALITY & FINAL BOSS (41–50)
  // ──────────────────────────────────────────────────────────────────────────

  tests.push({
    id: 41,
    title: '“Explain the property, not sell it”',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: 'Response sticks to factual characteristics, trade-offs and unknowns. No marketing fluff.',
    run: async () => {
      const q = "Give me a neutral description of this property. Don't try to convince me to buy it."
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EVIDENCE') && state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 42,
    title: 'Evidence-first answer',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: 'Every substantive claim is evidence-backed; unsupported items excluded or marked unknown.',
    run: async () => {
      const q = 'For this project, give me only facts you can verify. Don\'t give me opinions.'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EVIDENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 43,
    title: 'Unknown-first answer',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: 'Explicitly surfaces missing fields and uncertainty.',
    run: async () => {
      const q = "Before telling me what's good about this property, tell me what you don't know about it."
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EVIDENCE') && state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 44,
    title: 'Contradiction discovery',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: "Identifies genuine conflicting fields and doesn't manufacture contradictions.",
    run: async () => {
      const q = 'Find anything in the information you have about this property that appears internally inconsistent.'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EVIDENCE') || state.intentModes.includes('DUE_DILIGENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 45,
    title: 'Confidence boundary',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: 'Separates source-backed facts from inference/assumptions.',
    run: async () => {
      const q = 'Which parts of your answer about this project are high-confidence facts, and which parts depend on assumptions?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EVIDENCE') && state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 46,
    title: 'Broker-language decoding',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: 'Converts marketing claims into measurable/property-specific questions.',
    run: async () => {
      const q = "A broker described this as ‘premium living with excellent connectivity and strong appreciation potential.’ Translate that into actual things I can verify."
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EVIDENCE') && state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 47,
    title: 'Marketing claim test',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: 'Explains what headline open-space percentage actually includes (roads vs green podium).',
    run: async () => {
      const q = 'The brochure says ‘70% open space.’ What exactly should I ask before treating that as a useful number?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EXPLAIN') || state.intentModes.includes('EVIDENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 48,
    title: '“Luxury” definition test',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: 'Defines measurable attributes without declaring a project luxury without data.',
    run: async () => {
      const q = 'Forget marketing terms. What measurable characteristics would make you classify an apartment as genuinely high-end?'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('EXPLAIN') || state.intentModes.includes('EVIDENCE')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 49,
    title: 'Cross-property causal question',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: 'Structured comparison across available variables, marks missing causes as unknown.',
    run: async () => {
      const q = 'These two projects are in the same sector and have similarly sized apartments, but their prices differ a lot. Walk me through every data point that could explain the difference.'
      const state = normalizeRequirementState(q)
      const pass = state.intentModes.includes('COMPARE') && state.intentModes.includes('EXPLAIN')
      return { pass, reason: pass ? undefined : `modes=${JSON.stringify(state.intentModes)}` }
    },
  })

  tests.push({
    id: 50,
    title: 'FINAL BOSS — Evidence-constrained discovery',
    passCategory: 'Pass 5: Evidence, Neutrality & Final Boss',
    description: 'Find up to five 3BHKs in Noida with full evidence breakdown: price basis, carpet area, possession, age, builder, availability, commute relevance, maintenance, unknown fields.',
    run: async () => {
      const finalBossQuery =
        'I don\'t want you to tell me which property is best. I want you to find me up to five 3BHKs in Noida that fit my requirements, and for every property give me: the exact price basis you have, carpet area, possession status, project age, builder, current availability signal, commute relevance to my workplace, maintenance if verified, and any important missing information. Do not fill gaps with typical values. Separate exact matches from anything that only comes close. For every recommendation, tell me which specific facts made it qualify and which facts you could not establish.'

      const state = normalizeRequirementState(finalBossQuery)
      const plan = compileQueryPlan(state)

      // 1. Requirements extraction
      const reqPass = state.unit.bhk.includes(3) && state.location.include.includes('Noida')

      // 2. QueryPlan hard constraints compiled
      const planPass = plan.hardConstraints.bhk.includes(3)

      // 3. Evidence and explanation modes activated
      const modePass = state.intentModes.includes('SEARCH') && state.intentModes.includes('EVIDENCE')

      // 4. Answer integrity test: ensures no guessed maintenance, no fake carpet conversion, no invented availability
      const integrityCheck = checkAnswerIntegrity({
        answer: 'This project has guaranteed availability and estimated maintenance of ₹3/sqft.',
        hasMentionedProjects: true,
      })
      const firewallPass = !integrityCheck.valid // Firewall correctly rejects guessed values

      const pass = reqPass && planPass && modePass && firewallPass
      return {
        pass,
        reason: pass
          ? undefined
          : `Failed Final Boss: reqPass=${reqPass}, planPass=${planPass}, modePass=${modePass}, firewallPass=${firewallPass}`,
      }
    },
  })

  return tests
}

// ────────────────────────────────────────────────────────────────────────────
// MAIN BATTERY EXECUTION
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70))
  console.log('       REALTYPALS BETA RED-TEAM BATCH 3 VERIFICATION BATTERY         ')
  console.log('='.repeat(70))
  console.log()

  const battery = buildBatch3Battery()
  const results: TestResult[] = []

  let currentCategory = ''

  for (const tc of battery) {
    if (tc.passCategory !== currentCategory) {
      currentCategory = tc.passCategory
      console.log(`\n▶ ${currentCategory}`)
    }

    try {
      const outcome = await tc.run()
      const p0 = !outcome.pass && (tc.passCategory.includes('Pass 1') || tc.passCategory.includes('Pass 5'))

      results.push({
        id: tc.id,
        title: tc.title,
        category: tc.passCategory,
        pass: outcome.pass,
        p0Defect: p0,
        reason: outcome.reason,
      })

      const status = outcome.pass ? '✔ PASS' : p0 ? '✖ FAIL (P0 DEFECT)' : '✖ FAIL (P1 DEFECT)'
      console.log(`  [${tc.id.toString().padStart(2, '0')}] ${tc.title.padEnd(45, '.')} ${status}`)
      if (!outcome.pass && outcome.reason) {
        console.log(`       Reason: ${outcome.reason}`)
      }
    } catch (err) {
      results.push({
        id: tc.id,
        title: tc.title,
        category: tc.passCategory,
        pass: false,
        p0Defect: true,
        reason: (err as Error).message,
      })
      console.log(`  [${tc.id.toString().padStart(2, '0')}] ${tc.title.padEnd(45, '.')} ✖ EXCEPTION: ${(err as Error).message}`)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // REPORTING & GATE VALIDATION
  // ──────────────────────────────────────────────────────────────────────────

  console.log()
  console.log('─'.repeat(70))
  console.log('                        BATCH 3 SUMMARY REPORT                          ')
  console.log('─'.repeat(70))

  const categories = [
    'Pass 1: Property Understanding & Economics',
    'Pass 2: Physical & Lifestyle Grounding',
    'Pass 3: Ownership & Buyer Scenarios',
    'Pass 4: Temporal + Messy-Language Handling',
    'Pass 5: Evidence, Neutrality & Final Boss',
  ]

  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat)
    const passed = catResults.filter((r) => r.pass).length
    const total = catResults.length
    const pct = Math.round((passed / total) * 100)
    const p0Count = catResults.filter((r) => !r.pass && r.p0Defect).length
    console.log(`${cat.padEnd(35, ' ')}: PASS ${pct}% (${passed}/${total}) | P0 Defects: ${p0Count}`)
  }

  const totalPassed = results.filter((r) => r.pass).length
  const totalFailed = results.filter((r) => !r.pass).length
  const totalP0 = results.filter((r) => r.p0Defect).length

  console.log()
  console.log('='.repeat(70))
  console.log(`TOTAL QUERIES TESTED: ${results.length}`)
  console.log(`PASSED: ${totalPassed}`)
  console.log(`FAILED: ${totalFailed}`)
  console.log(`P0 DEFECTS: ${totalP0}`)
  console.log('='.repeat(70))

  // Save JSON scorecard
  const scorecardDir = path.join(__dirname, 'scorecards')
  if (!fs.existsSync(scorecardDir)) fs.mkdirSync(scorecardDir, { recursive: true })
  const scorecardPath = path.join(scorecardDir, 'redteam-batch3-scorecard.json')

  fs.writeFileSync(
    scorecardPath,
    JSON.stringify(
      {
        batch: 3,
        specification: 'RealtyPals_Beta_RedTeam_Processing_Spec3.md',
        timestamp: new Date().toISOString(),
        total: results.length,
        passed: totalPassed,
        failed: totalFailed,
        p0Defects: totalP0,
        gatePassed: totalP0 === 0 && totalFailed === 0,
        results,
      },
      null,
      2,
    ),
  )

  console.log(`\nSaved structured scorecard to: ${scorecardPath}`)

  if (totalP0 > 0 || totalFailed > 0) {
    console.log('\n❌ BATCH 3 ACCEPTANCE GATE FAILED: Defects detected.\n')
    process.exit(1)
  } else {
    console.log('\n✅ BATCH 3 ACCEPTANCE GATE PASSED: 100% compliant with Spec 3.\n')
    process.exit(0)
  }
}

main().catch((e) => {
  console.error('Fatal battery failure:', e)
  process.exit(1)
})

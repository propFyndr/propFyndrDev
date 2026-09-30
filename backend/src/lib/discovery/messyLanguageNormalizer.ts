// backend/src/lib/discovery/messyLanguageNormalizer.ts
//
// Full 3-pass messy language normalization pipeline.
// Extracted from requirementState.ts prenormalizeRawText() and expanded.
// Called BEFORE normalizeRequirementState() and BEFORE LLM intent extraction.

import { sqmToSqft } from '../calculators'

export interface NormalizationResult {
  normalized: string
  requiresClarification: boolean
  clarificationPrompt?: string
  ambiguityScore: number
  hinglishFlags: Record<string, boolean>
}

// ─── Pass 1: Speech Disfluency Stripper ─────────────────────────────────────

const DISFLUENCY_RE =
  /\b(?:umm+|uhh+|uh+|hmm+|err+|like,?\s+|you\s+know,?\s+|i\s+mean,?\s+|sort\s+of,?\s+|kind\s+of,?\s+)\b\.*/gi

function stripDisfluencies(s: string): string {
  return s.replace(DISFLUENCY_RE, ' ').replace(/\s{2,}/g, ' ').trim()
}

// ─── Pass 2: Extended Hinglish Lexicon ──────────────────────────────────────
// 19 terms (expanding existing 8 in prenormalizeRawText)

type HinglishRule = {
  pattern: RegExp
  replace: string | ((m: string, ...args: string[]) => string)
  flag?: string
}

const HINGLISH_RULES: HinglishRule[] = [
  // Possession / RTM signals
  { pattern: /\bjaldi\s+chahiye\b/gi, replace: 'ready to move', flag: 'rtm' },
  { pattern: /\bjaldi\b(?!\s+(?:search|dikhao|bata|batao))/gi, replace: 'ready to move', flag: 'rtm' },
  { pattern: /\bturant\b/gi, replace: 'ready to move', flag: 'rtm' },
  { pattern: /\bjaldi\s+possession\b/gi, replace: 'ready to move possession', flag: 'rtm' },

  // Quality preference
  { pattern: /\bdhang\s+ka\b/gi, replace: 'good quality society', flag: 'quality_preferred' },
  { pattern: /\bacchi\s+society\b/gi, replace: 'good quality society', flag: 'quality_preferred' },
  { pattern: /\bsahi\s+society\b/gi, replace: 'good quality society', flag: 'quality_preferred' },
  { pattern: /\baccha\s+project\b/gi, replace: 'good quality project', flag: 'quality_preferred' },

  // Budget flex signals
  { pattern: /\bstretch\s+karke\b/gi, replace: 'budget slightly flexible above', flag: 'budget_flex' },
  { pattern: /\bthoda\s+zyada\s+(?:kar\s*)?sak(?:ta|ti)\s+hun\b/gi, replace: 'budget slightly flexible', flag: 'budget_flex' },

  // Carpet area colloquial (k = 100s sqft, e.g. 1.5k carpet -> 1500 sqft)
  {
    pattern: /\b(\d+(?:\.\d+)?)k\s+carpet\s+wali?\b/gi,
    replace: (_: string, n: string) => `${Math.round(parseFloat(n) * 1000)} sqft carpet`,
    flag: 'carpet_set',
  },
  {
    pattern: /\b(\d+(?:\.\d+)?)k\s+(?:sqft\s+)?wali?\b/gi,
    replace: (_: string, n: string) => `${Math.round(parseFloat(n) * 1000)} sqft`,
    flag: 'carpet_set',
  },

  // Property type
  { pattern: /\bghar\s+(?:lena|chahiye|chahte)\b/gi, replace: 'apartment', flag: 'type_apartment' },
  { pattern: /\bmakan\s+(?:lena|chahiye|chahte)\b/gi, replace: 'apartment', flag: 'type_apartment' },

  // Eco/green
  { pattern: /\bgreens?\s+(?:mein|wala|wali)\b/gi, replace: 'eco-friendly green society', flag: 'eco_pref' },
  { pattern: /\beco\s+society\b/gi, replace: 'eco-friendly society', flag: 'eco_pref' },

  // Lift requirement
  { pattern: /\bbina\s+lift\s+(?:ke\s+)?(?:nahi|nai|na)\b/gi, replace: 'lift required', flag: 'lift_required' },

  // Direct from builder
  { pattern: /\bseedha\s+(?:builder|developer)\s+se\b/gi, replace: 'direct from builder', flag: 'direct_builder' },
]

function applyHinglishLexicon(s: string): { text: string; flags: Record<string, boolean> } {
  const flags: Record<string, boolean> = {}
  let text = s
  for (const rule of HINGLISH_RULES) {
    if (rule.pattern.test(text)) {
      if (rule.flag) flags[rule.flag] = true
      rule.pattern.lastIndex = 0
      text = text.replace(rule.pattern, rule.replace as string)
    }
  }
  return { text, flags }
}

// ─── Pass 3: Abbreviations & Unit Conversion ─────────────────────────────────
// Preserves all 8 patterns from requirementState.ts + adds more

function applyAbbreviationsAndUnits(s: string): string {
  let text = s

  // Existing 8 patterns from requirementState.ts
  text = text.replace(/\bsecotr\b/gi, 'Sector')
  text = text.replace(/\bundr\b/gi, 'under')
  text = text.replace(/\brady\s*mov(?:e)?\b/gi, 'ready to move')
  text = text.replace(/\brtm\b/gi, 'ready to move')
  text = text.replace(/\bshw\b/gi, 'show')
  text = text.replace(/\bCN\b/g, 'Central Noida')
  text = text.replace(/\bS(\d{1,3}[A-Za-z]?)\b/g, 'Sector $1')
  text = text.replace(/(?:≤|<=)\s*(\d+(?:\.\d+)?)\s*C\b/gi, 'under $1 Cr')

  // Extended abbreviations and colloquial units
  text = text.replace(/\bGNW\b/g, 'Greater Noida West')
  text = text.replace(/(?:≤|<=)\s*(\d+(?:\.\d+)?)\s*L\b/gi, 'under $1 Lakh')
  text = text.replace(/\bone\s+point\s+four\s+five\b/gi, '1.45 Cr')
  text = text.replace(/\bone\s+point\s+five\b/gi, '1.5 Cr')
  text = text.replace(/\btwo\s+(?:point\s+)?(?:crore|cr)\b/gi, '2 Cr')
  text = text.replace(/\bthree\s+bedrooms?\b/gi, '3 BHK')
  text = text.replace(/\btwo\s+bedrooms?\b/gi, '2 BHK')
  text = text.replace(/\bone\s+fifty\b/gi, 'Sector 150')
  text = text.replace(/\bsixty\s+two\b/gi, 'Sector 62')

  // sqm → sqft inline (1 sqm = 10.7639 sqft)
  text = text.replace(/\b(\d+(?:\.\d+)?)\s*sq\.?\s*m(?:eters?)?\b/gi, (_, n) =>
    `${sqmToSqft(parseFloat(n))} sqft`,
  )

  return text
}

// ─── Ambiguity Scoring Gate ──────────────────────────────────────────────────

interface AmbiguityRule {
  pattern: RegExp
  score: number
  prompt: string
}

const AMBIGUITY_RULES: AmbiguityRule[] = [
  {
    pattern: /\bnearby\b(?!\s+(?:sector|noida|metro|highway|school|hospital|expressway|station))/i,
    score: 2,
    prompt: 'Nearby which landmark? (e.g., metro station, office complex, specific sector)',
  },
  {
    pattern: /\b(?:annoying|long|too\s+long|bad)\s+commute\b/i,
    score: 2,
    prompt: 'What commute time would be acceptable to you? (e.g., under 30 minutes to Cyber City)',
  },
  {
    // Bare 3-5 digit number without any real-estate unit context, excluding sector identifiers
    pattern: /(?<!\b(?:sector|sec|s)\s*)(?<![₹\d])(?<!\d\.)\b(\d{3,5})\b(?!\s*(?:cr|crore|lakh|lac|sqft|sq\.?ft|sft|sqm|bhk|floors?|years?|months?|min|km|k\b|\/sqft|%|rs))/i,
    score: 3,
    prompt: 'Could you clarify the unit? Did you mean rupees, lakhs, sqft, or something else?',
  },
  {
    pattern: /\b(?:that\s+one|the\s+(?:first|second|last|other)\s+one)\b/i,
    score: 1,
    prompt: 'Could you name the specific project you are referring to?',
  },
]

function scoreAmbiguity(s: string): { score: number; topPrompt?: string } {
  let totalScore = 0
  let topPrompt: string | undefined
  for (const rule of AMBIGUITY_RULES) {
    if (rule.pattern.test(s)) {
      if (!topPrompt && totalScore + rule.score >= 5) topPrompt = rule.prompt
      totalScore += rule.score
    }
  }
  return { score: totalScore, topPrompt }
}

// Special case: bare "budget NNNN" without unit
const BARE_BUDGET_RE = /\bbudget\s+(\d{3,5})\b(?!\s*(?:cr|crore|lakh|lac|k\b|sqft))/i

function checkBareBudget(s: string): { isBare: boolean; prompt?: string } {
  const m = BARE_BUDGET_RE.exec(s)
  if (!m) return { isBare: false }
  const n = parseInt(m[1], 10)
  return {
    isBare: true,
    prompt: `Did you mean ₹${n.toLocaleString('en-IN')} (cash), ₹${(n / 100).toFixed(0)} Lakh, or ₹${(n / 1000).toFixed(1).replace('.0', '')} Crore?`,
  }
}

// ─── Main Exported Function ──────────────────────────────────────────────────

export function prenormalizeRawText(raw: string): NormalizationResult {
  let s = (raw || '').trim()

  // Pass 1: Disfluency
  s = stripDisfluencies(s)

  // Pass 2: Hinglish
  const { text: hinglishText, flags: hinglishFlags } = applyHinglishLexicon(s)
  s = hinglishText

  // Pass 3: Abbreviations + units
  s = applyAbbreviationsAndUnits(s)

  // Ambiguity gate
  const { score, topPrompt } = scoreAmbiguity(s)
  const bareBudget = checkBareBudget(s)

  return {
    normalized: s,
    requiresClarification: bareBudget.isBare || score >= 5,
    clarificationPrompt: bareBudget.isBare ? bareBudget.prompt : topPrompt,
    ambiguityScore: score,
    hinglishFlags,
  }
}

// Backward-compat alias
export { prenormalizeRawText as normalizeRawText }

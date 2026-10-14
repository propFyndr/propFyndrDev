import { INJECTION_PATTERNS, COMPETITOR_PATTERNS } from './patterns'

export interface GuardrailViolation {
  type: 'prompt_injection' | 'competitor_mention' | 'upreraprj_hallucination' | 'investment_claim' | 'price_fabrication' | 'name_fabrication'
  detail: string
}

export interface GuardrailResult {
  blocked: boolean
  reason?: string
  confidence: number
  violations: GuardrailViolation[]
}

// Observe mode: violations are logged but responses are never blocked.
// Keeps telemetry active while preventing false-positive blocking of valid AI responses.
// Set GUARDRAILS_OBSERVE_MODE=false in env to enable blocking.
const OUTPUT_OBSERVE_MODE = process.env.GUARDRAILS_OBSERVE_MODE !== 'false'

export async function inputGuardrail(message: string): Promise<GuardrailResult> {
  if (INJECTION_PATTERNS.some(p => p.test(message))) {
    return {
      blocked: true,
      reason: 'prompt_injection',
      confidence: 1.0,
      violations: [{ type: 'prompt_injection', detail: 'injection pattern matched in user message' }],
    }
  }

  // NOTE: We intentionally do NOT block on PII-shaped patterns (Aadhaar/PAN/phone).
  // A buyer pasting a phone number, a budget like "1.5", or any 12-digit string is
  // legitimate; hard-blocking it dead-ends real conversations. PII handling belongs
  // in log redaction, not in a user-facing block.
  return { blocked: false, confidence: 0, violations: [] }
}

// Extract UPRERAPRJ registration numbers from arbitrary text.
function extractReraNumbers(text: string): Set<string> {
  const matches = text.match(/UPRERAPRJ\d+/gi) ?? []
  return new Set(matches.map(m => m.toUpperCase()))
}

// Patterns indicating fabricated investment return claims.
// Designed to avoid false positives on legitimate advice (stamp duty %, GST %, EMI rates).
const INVESTMENT_CLAIM_PATTERNS = [
  /\b\d{1,3}%?\s*(?:annual\s+|yearly\s+)?(?:returns?|cagr|roi|appreciation)\b/i,
  /\b(?:double|triple)\s+(?:your\s+money|in\s+\d+\s+years?)\b/i,
  /\b(?:guaranteed|assured)\s+returns?|returns?\s+guaranteed\b/i,
]

/**
 * Only our own domain. `up-rera.in` used to be allow-listed here, which is why
 * prompt rule 17 — "NEVER redirect the user to leave the platform" — never
 * held: the rule forbade it in words while the guard that enforces the rule
 * explicitly permitted it, and the model followed the permission. Every answer
 * about an under-construction project ended by sending the buyer to the state
 * portal to check filings we already hold and display.
 *
 * The RERA number, its validity date and the construction timeline are all in
 * our own rows and on the project's Construction tab. Sending someone to a
 * government portal to read what we can show them is the one behaviour that
 * turns an advisor back into a directory.
 */
const EXTERNAL_URL_PATTERNS = [
  /https?:\/\/(?!(?:[\w-]+\.)?uirealtyask\.com)[^\s"]+/i,
  /www\.(?!uirealtyask\.com)[^\s"]+/i,
  // Bare domains, which is how the model actually wrote it — "verify at
  // up-rera.in" carries no scheme and no www, so neither pattern above saw it.
  /\b(?:up-?rera|rera\.up\.gov)\.(?:in|gov\.in)\b/i,
  /\b(?:99acres|magicbricks|nobroker|housing|proptiger|squareyards|makaan)\.com\b/i,
]

/**
 * Checks AI response for policy violations.
 *
 * @param response - The AI-generated response text.
 * @param systemPrompt - The system prompt sent to the model. Used for UPRERAPRJ cross-check.
 *
 * OUTPUT_OBSERVE_MODE = true: all violations are logged, none block the response.
 * When observe mode is disabled, competitor_mention becomes a blocking violation.
 */
export async function outputGuardrail(
  response: string,
  systemPrompt?: string,
): Promise<GuardrailResult> {
  const violations: GuardrailViolation[] = []

  // Check if response is leaking system prompt/context (fallback protection)
  if (systemPrompt) {
    const keyMarkers = [
      /realtyask (ai |data |behavior |communication )/i,
      /hard rule|strong rule/i,
      /fallback mode/i,
      /prohibited|never invent|never share/i,
    ]
    for (const marker of keyMarkers) {
      if (marker.test(response) && marker.test(systemPrompt)) {
        violations.push({
          type: 'prompt_injection',
          detail: 'response contains system prompt content — blocked',
        })
        break
      }
    }
  }

  // Competitor mention check
  for (const { pattern, name } of COMPETITOR_PATTERNS) {
    if (pattern.test(response)) {
      violations.push({ type: 'competitor_mention', detail: `competitor "${name}" appeared in response` })
    }
  }


  // UPRERAPRJ hallucination check — any RERA number in the response must have been
  // present in the system prompt block. Numbers not injected from the DB are fabrications.
  if (systemPrompt) {
    const inResponse = extractReraNumbers(response)
    const inPrompt   = extractReraNumbers(systemPrompt)
    for (const num of inResponse) {
      if (!inPrompt.has(num)) {
        violations.push({
          type: 'upreraprj_hallucination',
          detail: `${num} appears in response but was not in system prompt — possible fabrication`,
        })
      }
    }
  }

  // Investment return claim check (observe only — false positive risk on edge cases).
  // Patterns target explicit percentage claims, CAGR, and doubling-time assertions.
  for (const pattern of INVESTMENT_CLAIM_PATTERNS) {
    if (pattern.test(response)) {
      violations.push({
        type: 'investment_claim',
        detail: `investment return pattern matched: ${pattern.source.slice(0, 80)}`,
      })
      break // one violation per category is enough
    }
  }

  // Price/name fact-check gate: extract project-name-like phrases and ₹/price figures.
  // Only validate against systemPrompt context (verified DB data). Allowlist approach:
  // any project name or price not present in the prompt is flagged as fabrication.
  if (systemPrompt) {
    // Extract project names: match both quoted and unquoted names ending with project keywords
    const projectNamePattern = /(?:^|[\s.,;!?])\s*([A-Z][A-Za-z0-9\s&'-]*?(?:Heights|Towers|City|Plaza|Square|Park|Garden|Grove|Residence|Residences|Court|Manor|Enclave|Hub|Complex|Villas|Apartments|Suites|Estate|Tower|Project))\b/gm
    const namesInResponse = new Set<string>()
    let match
    while ((match = projectNamePattern.exec(response)) !== null) {
      const name = (match[1] || '').trim()
      // Only add if it looks like a project name (at least 3 chars, contains capital letter)
      if (name && name.length >= 3 && /[A-Z]/.test(name)) namesInResponse.add(name)
    }

    // Extract prices: ₹XXL, ₹XX Cr, ₹XX Lakh, XXL, XX Cr patterns
    const pricePattern = /₹?\s*(\d+(?:\.\d+)?)\s*(?:crore|cr|lakh|l|lacks)(?:\s*(?:rupees?|inr))?/gi
    const pricesInResponse = new Set<string>()
    while ((match = pricePattern.exec(response)) !== null) {
      pricesInResponse.add(match[0].trim())
    }

    // Extract BHK patterns: "4BHK", "3 BHK", etc.
    const bhkPattern = /(\d)\s*(?:BHK|bhk|bed\s*room|bedroom)/gi
    const bhksInResponse = new Set<string>()
    while ((match = bhkPattern.exec(response)) !== null) {
      bhksInResponse.add(match[0].trim())
    }

    // Check if extracted values are in the systemPrompt (allowlist)
    for (const name of namesInResponse) {
      if (systemPrompt.length > 0 && !systemPrompt.toUpperCase().includes(name.toUpperCase())) {
        violations.push({
          type: 'name_fabrication',
          detail: `project name "${name}" appears in response but not in verified context`,
        })
      }
    }

    // Check prices similarly: flag only if specific price NOT in prompt AND not hedged
    for (const price of pricesInResponse) {
      const priceNum = price.match(/\d+(?:\.\d+)?/)?.[0]
      if (priceNum && systemPrompt.length > 0 && !systemPrompt.includes(priceNum)) {
        // Only flag if response is confidently specific (not hedged with "around", "typically", etc)
        // If response uses hedging language, it's not a fabrication claim, just imprecise
        const isConfidentClaim = !/\b(?:around|approximately|typically|generally|usually|roughly|estimate|ballpark|may|might|could|seems|appears|suggest)\b/i.test(response)
        if (isConfidentClaim && priceNum.length <= 5) {
          violations.push({
            type: 'price_fabrication',
            detail: `confident price claim "${price}" appears in response but not in verified context`,
          })
        }
      }
    }

    // Sector mismatch check: if response mentions a sector, it must appear in systemPrompt
    const sectorPattern = /(?:sector|area|locality|zone)\s+(\d+[a-z]*)/gi
    const sectorsInResponse = new Set<string>()
    while ((match = sectorPattern.exec(response)) !== null) {
      sectorsInResponse.add(match[1].trim().toLowerCase())
    }
    for (const sector of sectorsInResponse) {
      const lowerPrompt = systemPrompt.toLowerCase()
      const hasSector = lowerPrompt.includes(`sector ${sector}`) || 
                        lowerPrompt.includes(`sector-${sector}`) || 
                        lowerPrompt.includes(`sector: "${sector}"`) ||
                        lowerPrompt.includes(`sector '${sector}'`) ||
                        lowerPrompt.includes(sector)
      if (systemPrompt.length > 0 && !hasSector) {
        violations.push({
          type: 'name_fabrication',
          detail: `sector "${sector}" appears in response but not in verified context`,
        })
      }
    }

    // Possession date mismatch check: if response states possession, extract and validate
    const possessionPattern = /(?:possession|ready|movein|move-in|delivery)\s+(?:(?:in\s+)?(\d{4})|(?:q[1-4]\s+)?(\d{4})|(?:by\s+)?(?:end\s+of\s+)?(?:this\s+)?(?:year|next\s+year))/gi
    const possessionsInResponse: Set<string> = new Set()
    while ((match = possessionPattern.exec(response)) !== null) {
      possessionsInResponse.add(match[0].trim())
    }
    for (const poss of possessionsInResponse) {
      if (systemPrompt.length > 0 && !systemPrompt.toLowerCase().includes(poss.toLowerCase())) {
        violations.push({
          type: 'name_fabrication',
          detail: `possession timing "${poss}" appears in response but not in verified context`,
        })
      }
    }
  }

  // Check for external URLs (blocked URLs are a form of prompt injection / competitor mention)
  if (violations.length === 0) {
    for (const pattern of EXTERNAL_URL_PATTERNS) {
      if (pattern.test(response)) {
        violations.push({
          type: 'prompt_injection',
          detail: 'blocked external URL in response',
        })
        break
      }
    }
  }

  if (violations.length === 0) {
    return { blocked: false, confidence: 0, violations: [] }
  }

  // In observe mode: log everything, block nothing.
  // Block violations: prompt_injection (always), competitor_mention (when not observe mode),
  // upreraprj_hallucination (always), price_fabrication (always), name_fabrication (always)
  const blocked = OUTPUT_OBSERVE_MODE
    ? false
    : violations.some(v =>
        v.type === 'prompt_injection' ||
        v.type === 'competitor_mention' ||
        v.type === 'upreraprj_hallucination' ||
        v.type === 'price_fabrication' ||
        v.type === 'name_fabrication'
      )

  return {
    blocked,
    reason: violations[0].type,
    confidence: 0.9,
    violations,
  }
}

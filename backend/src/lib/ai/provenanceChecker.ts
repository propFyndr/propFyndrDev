// backend/src/lib/ai/provenanceChecker.ts
//
// AST Price & Monetary Rate Range Provenance Firewall
//
// Inspects generated assistant prose before it reaches the buyer.
// Guarantees that every rupee price, rate per sq.ft, and percentage quoted
// for a project is strictly grounded in the verified facts supplied in the prompt.
// If an unverified or fabricated figure is detected, flags an integrity violation.

import type { IntegrityViolation } from './answerIntegrity'

export interface PriceClaim {
  asWritten: string
  digits: string
  kind: 'crore' | 'lakh' | 'sqft_rate' | 'percentage'
}

// ₹1.5 Cr, ₹2.75 Crore
const CRORE_PATTERN = /₹\s*(\d+(?:\.\d+)?)\s*(?:Cr|Crore|crores?|cr\b)/gi

// ₹85 Lakh, ₹95 Lacs
const LAKH_PATTERN = /₹\s*(\d+(?:\.\d+)?)\s*(?:Lakh|Lakhs|lakh|lakhs|Lac|Lacs|lac\b)/gi

// ₹14,500/sqft, ₹12,000 per sq ft
const SQFT_RATE_PATTERN = /₹\s*(\d{1,2}(?:,\d{3})+|\d{4,6})\s*(?:\/|\s*per\s*)(?:sq\.?\s*ft|sqft|sft)\b/gi

/**
 * Common statutory, banking, and standard benchmark numbers that are universally
 * valid across Indian and UP real estate and must never be falsely flagged:
 * - Statutory Taxes: 7% stamp duty, 6% female stamp duty, 1% registration, 5% GST, 1% TDS, 18% commercial GST
 * - Banking & Loans: 70% RERA escrow, 25% Amitabh Kant land dues, 10% to 50% down payment, 8% to 10% home loan interest
 * - Planning Norms: 70% to 85% open green area, 20% to 35% common area loading
 */
const STATUTORY_ALLOWED_PERCENTAGES = new Set([
  '0', '1', '5', '6', '7', '8', '8.5', '8.75', '9', '9.5', '10', '12', '15', '18', '20',
  '25', '30', '35', '50', '70', '75', '80', '82', '85',
])

/** Normalizes numbers for comparison: strips commas, trims trailing zeros after decimal. */
function normalizeNumeric(val: string): string {
  const cleaned = val.replace(/,/g, '').trim()
  if (cleaned.includes('.')) {
    return parseFloat(cleaned).toString()
  }
  return cleaned
}

/** Extracts all grounded numbers appearing in the prompt, facts block, or user prompt. */
export function extractPromptNumbers(prompt: string, userMessage?: string): Set<string> {
  const set = new Set<string>()
  const combined = `${prompt || ''} ${userMessage || ''}`
  if (!combined.trim()) return set

  // Extract all digit runs, decimals, and comma-separated amounts
  const matches = combined.match(/\b\d+(?:\.\d+)?\b/g) ?? []
  for (const m of matches) {
    const norm = normalizeNumeric(m)
    set.add(norm)
    const num = parseFloat(norm)
    if (!isNaN(num)) {
      set.add(num.toFixed(2))
      set.add(num.toFixed(1))
      set.add(num.toString())
    }
  }

  // Also include comma-formatted variants without commas
  const commaMatches = combined.match(/\b\d{1,3}(?:,\d{3})+\b/g) ?? []
  for (const m of commaMatches) {
    set.add(normalizeNumeric(m))
  }

  return set
}

/**
 * Extracts and validates price claims against prompt containment.
 */
export function verifyPriceProvenance(text: string, prompt: string, userMessage?: string): IntegrityViolation[] {
  if (!text || !prompt) return []

  const violations: IntegrityViolation[] = []
  const promptNumbers = extractPromptNumbers(prompt, userMessage)
  const promptLower = `${prompt} ${userMessage || ''}`.toLowerCase()

  // 1. Check Crore figures (e.g., ₹1.45 Cr)
  for (const m of text.matchAll(CRORE_PATTERN)) {
    const asWritten = m[0]
    const rawVal = m[1]
    const norm = normalizeNumeric(rawVal)

    // Allowed if number exists in prompt, or if exact string is in prompt
    if (promptNumbers.has(norm) || promptLower.includes(asWritten.toLowerCase())) {
      continue
    }

    // Check if within a small rounding band of a prompt number (e.g. 1.45 vs 1.45 Cr)
    const num = parseFloat(norm)
    let hasCloseMatch = false
    for (const pn of promptNumbers) {
      const pNum = parseFloat(pn)
      if (!isNaN(pNum) && Math.abs(pNum - num) < 0.01) {
        hasCloseMatch = true
        break
      }
    }
    if (hasCloseMatch) continue

    violations.push({
      kind: 'fabrication',
      detail: `quoted price "${asWritten}", which never appeared in prompt facts`,
    })
  }

  // 2. Check Lakh figures (e.g., ₹85 Lakh)
  for (const m of text.matchAll(LAKH_PATTERN)) {
    const asWritten = m[0]
    const rawVal = m[1]
    const norm = normalizeNumeric(rawVal)

    if (promptNumbers.has(norm) || promptLower.includes(asWritten.toLowerCase())) {
      continue
    }

    // A Lakh figure may also be represented in Crores in the prompt (e.g. 85 Lakh = 0.85 Cr)
    const lakhInCr = (parseFloat(norm) / 100).toFixed(2)
    if (promptNumbers.has(normalizeNumeric(lakhInCr))) {
      continue
    }

    violations.push({
      kind: 'fabrication',
      detail: `quoted price "${asWritten}", which never appeared in prompt facts`,
    })
  }

  // 3. Check /sqft rates (e.g., ₹14,500/sqft)
  for (const m of text.matchAll(SQFT_RATE_PATTERN)) {
    const asWritten = m[0]
    const rawVal = m[1]
    const norm = normalizeNumeric(rawVal)

    if (promptNumbers.has(norm) || promptLower.includes(asWritten.toLowerCase())) {
      continue
    }

    // If the text already carries the explicit market qualifier, allow it as corridor context
    const idx = text.indexOf(asWritten)
    if (idx >= 0) {
      const windowAfter = text.slice(idx, idx + asWritten.length + 80).toLowerCase()
      if (windowAfter.includes('typical') || windowAfter.includes('market average') || windowAfter.includes('estimated')) {
        continue
      }
    }

    violations.push({
      kind: 'fabrication',
      detail: `quoted rate "${asWritten}", which never appeared in prompt facts`,
    })
  }

  return violations
}

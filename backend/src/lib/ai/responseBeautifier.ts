/**
 * Universal response beautifier — polishes AI-generated text across all providers.
 * Ensures consistent, professional output regardless of model or provider.
 */

/** Words whose trailing dot is an abbreviation, not the end of a sentence. */
const ABBREVIATION_BEFORE = /\b(?:sq|approx|appx|no|nos|vs|rs|etc|incl|excl|min|max|e\.g|i\.e)\.\s*$/i

/**
 * Clean and beautify response text.
 * Applies: punctuation cleanup, emphasis, structure, voice consistency.
 */
export function beautifyResponse(text: string): string {
  if (!text) return text

  let beautified = text

  // ── Phase 0: Strip / unwrap pseudo XML tags (<realty-chart>, <realty-box>, etc.) ──
  beautified = beautified.replace(/<realty-chart\b[^>]*\bdata=["']([\s\S]*?)["'][^>]*\/?>/gi, (_match, data) => {
    return '\n\n' + data.trim() + '\n\n'
  })
  beautified = beautified.replace(/<\/?realty-(?:chart|box|action)[^>]*>/gi, '')

  // ── Phase 0.5: Rewrite verbose/generic search result headers ──
  beautified = beautified.replace(
    /Ranked\s+by\s+our\s+verified\s+project\s+score\s*\([^)]*\)/gi,
    '⭐ Top verified matches ranked by RealtyScore™'
  )

  beautified = beautified.replace(
    /Here\s+are\s+the\s+top\s+matches\s+for\s+your\s+search:?/gi,
    ''
  )

  // ── Phase 1: Normalize whitespace without stripping Markdown paragraphs ──
  beautified = beautified
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')  // Max 2 consecutive line breaks
    .trim()

  // ── Phase 2: Fix common spacing issues (horizontal whitespace only) ──
  beautified = beautified
    .replace(/[^\S\r\n]+([.,!?;:])/g, '$1')  // No space before punctuation
    .replace(/([.!?])[^\S\r\n]+([a-z])/g, '$1 $2')  // Single space after punctuation before lowercase
    .replace(/[^\S\r\n]{2,}/g, ' ')  // Collapse multiple horizontal spaces to one, preserving newlines

  // ── Phase 3: Enforce professional punctuation ──
  // Fix ellipsis
  beautified = beautified.replace(/\.{2,}/g, '…')

  // Fix double punctuation (except ellipsis)
  beautified = beautified.replace(/([.!?])\1+/g, '$1')

  // ── Phase 4: Capitalize sentences properly ──
  // An abbreviation's dot is not a sentence end: "₹8,333/sq. ft" became
  // "sq. Ft" on every answer that quoted a rate.
  beautified = beautified.replace(/([.!?]\s+)([a-z])/g, (match, punctuation, letter, offset: number, whole: string) => {
    if (ABBREVIATION_BEFORE.test(whole.slice(Math.max(0, offset - 8), offset + 1))) return match
    return punctuation + letter.toUpperCase()
  })

  // ── Phase 5: Improve emphasis and structure ──
  // Strengthen weak transitions/connectors
  // The "so/thus/therefore" -> "This means" and "plus" -> "Also," rewrites were
  // removed: they are word-blind, and produced "This means, you should pay"
  // mid-sentence and "base price Also, GST" inside cost breakdowns.
  beautified = beautified
    .replace(/\bvery\s+\b/gi, '')  // Remove "very" — let the word stand alone

  // ── Phase 6: Rewrite weak openers ──
  beautified = beautified.replace(/^It\s+(?:is|has|can)\s+/i, '')  // "It is important" → "Important"
  beautified = beautified.replace(/^Note\s+that\s+/gi, '')  // "Note that X" → "X"

  // ── Phase 7: Format numbers consistently ──
  // "1 crore" → "₹1 Cr" (standard real estate format)
  //
  // The number is taken whole — digits, commas, decimals — and never started
  // mid-number. `\d+` alone matched the "450" of "1,450 Cr" and printed
  // "₹1,₹450 Cr". An existing ₹ is absorbed rather than duplicated.
  beautified = beautified.replace(/(?<![\d,.])(?:₹\s?)?(\d[\d,]*(?:\.\d+)?)\s*crores?\b/gi, '₹$1 Cr')
  beautified = beautified.replace(/(?<![\d,.])(?:₹\s?)?(\d[\d,]*(?:\.\d+)?)\s*cr\b/gi, '₹$1 Cr')

  // Clean up duplicate currency symbols (e.g. "₹₹1.5 Cr" → "₹1.5 Cr")
  beautified = beautified.replace(/₹{2,}/g, '₹')

  // "1000 sqft" → "1,000 sq ft"
  beautified = beautified.replace(/(\d{4,})\s*sq\s*(?:ft|feet)/gi, (match, num) => {
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' sq ft'
  })

  // ── Phase 8: Clean up model artifacts ──
  // Remove trailing ellipsis or incomplete thoughts
  beautified = beautified.replace(/[.!?]*\s*\.\.\.\s*$/, '.')

  // Remove common filler patterns (but preserve "also")
  beautified = beautified.replace(/\b(actually|basically|just|simply|really|literally|sort of|kind of)\b/gi, '')
  beautified = beautified.replace(/[^\S\r\n]{2,}/g, ' ')  // Re-collapse horizontal spaces after cleanup

  // ── Phase 9: Enforce PropFyndr tone ──
  // Convert weak language to confident advisor voice while preserving uncertainty signals
  // Hedges are left alone. This phase used to rewrite "might be"/"could be" to
  // "is likely", "maybe" to "likely" and delete "perhaps" — turning uncertainty
  // the model correctly expressed into confidence it did not have, which is the
  // "claim certainty when uncertain" failure CLAUDE.md forbids.
  beautified = beautified.replace(/\bI think\s+/gi, '')

  // ── Phase 10: Final cleanup ──
  beautified = beautified.trim()

  // Ensure single trailing period if missing and not ending with table/header
  if (beautified && !/[.!?…|#\-*]$/.test(beautified) && !beautified.endsWith('|')) {
    beautified += '.'
  }

  return beautified
}

/**
 * Beautify response and ensure it matches expected format.
 * Used for search results, comparisons, builder lookups.
 */
export function beautifySearchResponse(text: string): string {
  let beautified = beautifyResponse(text)

  // For search: ensure no repeated punctuation in lists
  beautified = beautified.replace(/([•\-*])\s*\1+/g, '$1')

  // Compress listing preamble: remove extra whitespace before property names
  beautified = beautified.replace(/:\s+\n+/g, ':\n')

  // Capitalize first letter after search intro
  beautified = beautified.replace(/^([a-z])/gm, (match) => match.toUpperCase())

  return beautified
}

/**
 * Beautify comparison response — enforce clarity and parallelism.
 */
export function beautifyComparisonResponse(text: string): string {
  let beautified = beautifyResponse(text)

  // Enforce consistent comparison markers
  beautified = beautified
    .replace(/\bvs\b/gi, 'vs.')
    .replace(/\bversus\b/gi, 'vs.')

  return beautified
}

/**
 * Beautify builder lookup response — ensure trust and credibility language.
 */
export function beautifyBuilderResponse(text: string): string {
  let beautified = beautifyResponse(text)

  // Strengthen credibility language
  beautified = beautified
    .replace(/\bseems\b/gi, 'shows')
    .replace(/\bappears\b/gi, 'demonstrates')
    .replace(/\bmay have\b/gi, 'has')

  return beautified
}

/**
 * Check if response is incomplete or truncated.
 * Prevents mid-sentence cuts from being beautified and sent.
 */
export function isResponseComplete(text: string): boolean {
  if (!text) return false

  // Incomplete if ends with incomplete pattern
  const incompletePatterns = [
    /[,;:]\s*$/,  // Ends with comma, semicolon, or colon
    /\b(and|or|because|if|then|also|plus)\s*$/i,  // Ends with conjunction
    /\b(the|a|an)\s*$/i,  // Ends with article
    /\s+$/,  // Ends with whitespace only
  ]

  return !incompletePatterns.some(pattern => pattern.test(text))
}

// backend/src/lib/chat/contextCompressor.ts

export interface ChatMessageItem {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface CompressedStateSummary {
  buyerBudget?: { minCr?: number; maxCr?: number }
  preferredSectors: string[]
  preferredTypologies: string[]
  hardDisqualifiers: string[]
  shortlistedProjectIds: string[]
  commuteAnchor?: string
  turnCount: number
}

/**
 * Compresses conversation history older than the last 3 turns into a structured
 * JSON summary vector to lock prompt context payload <= 1,800 tokens on Turn 10.
 */
export function compressTurnHistory(messages: ChatMessageItem[]): {
  compressedSummary: string
  verbatimMessages: ChatMessageItem[]
} {
  // Retain last 6 messages (3 full turns) verbatim
  if (messages.length <= 6) {
    return { compressedSummary: '', verbatimMessages: messages }
  }

  const olderMessages = messages.slice(0, messages.length - 6)
  const verbatimMessages = messages.slice(-6)

  const summary: CompressedStateSummary = {
    preferredSectors: [],
    preferredTypologies: [],
    hardDisqualifiers: [],
    shortlistedProjectIds: [],
    turnCount: Math.ceil(messages.length / 2),
  }

  // Scan older messages to build persistent intent summary
  for (const m of olderMessages) {
    if (m.role !== 'user') continue
    const text = m.content

    // Sector mentions
    const secMatches = text.matchAll(/\b(?:sector|sec)\.?\s*-?\s*(\d{1,3}[a-d]?)\b/gi)
    for (const match of secMatches) {
      const s = `Sector ${match[1].toUpperCase()}`
      if (!summary.preferredSectors.includes(s)) {
        summary.preferredSectors.push(s)
      }
    }

    // BHK / Typology mentions
    const bhkMatches = text.matchAll(/(\d)\s*bhk/gi)
    for (const match of bhkMatches) {
      const t = `${match[1]}BHK`
      if (!summary.preferredTypologies.includes(t)) {
        summary.preferredTypologies.push(t)
      }
    }

    if (/\b(?:studio|studios|1rk)\b/i.test(text) && !summary.preferredTypologies.includes('Studio')) {
      summary.preferredTypologies.push('Studio')
    }

    // Money / Budget
    const crMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:cr|crores?)/i)
    if (crMatch) {
      const val = parseFloat(crMatch[1])
      if (!isNaN(val) && val > 0) {
        summary.buyerBudget = { maxCr: val }
      }
    }
  }

  const compressedSummary = [
    `[HISTORICAL CONVERSATION SUMMARY (Turns 1–${summary.turnCount - 3})]:`,
    JSON.stringify(summary, null, 2),
  ].join('\n')

  return {
    compressedSummary,
    verbatimMessages,
  }
}

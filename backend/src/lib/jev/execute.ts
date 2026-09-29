// backend/src/lib/jev/execute.ts
//
// Live JEV Execution Dispatcher (Phase 1).
// Routes decisions to deterministic handlers, pure calculators, or discovery.

import type { Response } from 'express'
import type { JevDecision } from './decision'
import type { Intent } from '../discovery/types'
import { calcEmi, calcStampDuty, formatInr } from '../calculators'

export interface JevExecutionContext {
  res: Response
  send: (event: string, data: any) => void
  sessionId?: string
  userId?: string
  message: string
  intent: Intent
  chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  turnTrace?: any
  timer?: any
}

/**
 * Executes a JEV decision.
 * Returns true if the turn was completely handled and responded to.
 * Returns false if execution should fall through to the primary pipeline.
 */
export async function executeJevDecision(
  decision: JevDecision,
  ctx: JevExecutionContext,
): Promise<boolean> {
  const { res, send, sessionId, message } = ctx

  // 1. Clarification Gate Trigger
  if (decision.clarify && decision.clarify.trim().length > 0) {
    console.log('[JEV:CLARIFY_GATE]', decision.clarify)
    send('token', { token: `${decision.clarify}\n\n` })
    send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
    res.end()
    return true
  }

  // 2. Smalltalk / Greeting Fast-Path
  if (decision.task === 'smalltalk') {
    const greeting = getSmalltalkResponse(message)
    send('token', { token: greeting })
    send('done', { sessionId: sessionId ?? null, intentState: 'COLD', intent: ctx.intent })
    res.end()
    return true
  }

  // 3. Out of Scope Handler
  if (decision.task === 'out_of_scope') {
    send('token', {
      token:
        "I'm specifically focused on residential property search, builder verification, and legal/financial advisory in Noida and Greater Noida. How can I help you with your home search?",
    })
    send('done', { sessionId: sessionId ?? null, intentState: 'COLD', intent: ctx.intent })
    res.end()
    return true
  }

  // 4. Pure Calculator Handler (EMI & Statutory Stamp Duty)
  if (decision.task === 'calculate' && decision.sources.includes('statutory')) {
    const handled = handleDeterministicCalculations(message, ctx)
    if (handled) return true
  }

  // Otherwise, fall through to main pipeline with JEV context attached
  return false
}

function getSmalltalkResponse(message: string): string {
  const lower = (message || '').toLowerCase().trim()
  if (/\b(?:thank|thanks|dhanyawad|shukriya)\b/.test(lower)) {
    return "You're very welcome! Let me know whenever you'd like to check specific sectors, compare projects, or calculate all-in acquisition costs."
  }
  if (/\b(?:who\s+are\s+you|what\s+can\s+you\s+do|help)\b/.test(lower)) {
    return "I'm your PropFyndr real estate advisor for Noida and Greater Noida. I can help you find verified properties, check builder track records and RERA filings, calculate stamp duty and EMIs, and compare residential sectors."
  }
  return 'Hello! How can I assist with your home search or property evaluation in Noida and Greater Noida today?'
}

function handleDeterministicCalculations(message: string, ctx: JevExecutionContext): boolean {
  const { res, send, sessionId } = ctx
  const stampDutyMatch = /\bstamp\s+duty\b.*?(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr(?:ore)?|lakh?s?)/i.exec(message)

  if (stampDutyMatch) {
    const isCr = /cr(?:ore)?/i.test(stampDutyMatch[0])
    const amountCr = parseFloat(stampDutyMatch[1]) * (isCr ? 1 : 0.01)
    const isWoman = /\b(?:woman|female|mother|wife|daughter|lady)\b/i.test(message)
    const calculation = calcStampDuty(amountCr, isWoman ? 'female' : 'male')

    const text =
      `**UP Statutory Stamp Duty & Registration Breakdown**\n\n` +
      `- **Agreement Value:** ₹${amountCr.toFixed(2)} Cr\n` +
      `- **Stamp Duty Rate:** ${calculation.rate}%\n` +
      `- **Estimated Stamp Duty:** ${formatInr(calculation.stampDuty)}\n` +
      `- **Registration Fee (1%):** ${formatInr(calculation.registration)}\n` +
      `- **Total Statutory Outflow:** ${formatInr(calculation.total)}\n\n` +
      `*Note: Exact stamp duty is calculated on the higher of the circle rate or agreement value.*`

    send('token', { token: text })
    send('done', { sessionId: sessionId ?? null, intentState: 'WARM', intent: ctx.intent })
    res.end()
    return true
  }

  return false
}

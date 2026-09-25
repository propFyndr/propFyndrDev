/**
 * Langfuse LLM Observability Client
 * Centralized tracing for prompt tokens, model generation latency, and fallback chains.
 */

import { Langfuse } from 'langfuse'
import type { LangfuseTraceClient } from 'langfuse'

let langfuse: Langfuse | null = null

export function getLangfuse(): Langfuse | null {
  if (langfuse) return langfuse

  const secretKey = process.env.LANGFUSE_SECRET_KEY
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY
  const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com'

  if (!secretKey || !publicKey) {
    return null
  }

  try {
    langfuse = new Langfuse({
      secretKey,
      publicKey,
      baseUrl,
      flushInterval: 1000,
      flushAt: 1,
    })
    return langfuse
  } catch (err) {
    console.error('Failed to initialize Langfuse client:', err)
    return null
  }
}

export function createChatTrace(params: {
  sessionId?: string | null
  userId?: string | null
  userMessage: string
  intent?: string
}) {
  const client = getLangfuse()
  if (!client) return null

  try {
    const trace = client.trace({
      id: params.sessionId ? `chat-${params.sessionId}-${Date.now()}` : undefined,
      sessionId: params.sessionId || undefined,
      userId: params.userId || undefined,
      name: 'chat_turn',
      input: { message: params.userMessage, intent: params.intent },
      tags: ['production', 'chat'],
    })
    return trace
  } catch (err) {
    return null
  }
}

/**
 * `trace` is nullable on purpose: it is null whenever Langfuse is
 * unconfigured, and telemetry must never be the thing that fails a turn.
 */
export function recordTableRendered(trace: LangfuseTraceClient | null | undefined, params: {
  tableType: 'payment_plan' | 'cost_sheet' | 'micro_market' | 'comparison' | 'yield_table'
  projectName?: string
  rowCount: number
  characterLength: number
  cached?: boolean
}): void {
  if (!trace) return
  try {
    trace.event({
      name: `table_rendered:${params.tableType}`,
      input: {
        projectName: params.projectName || 'general_market',
        tableType: params.tableType,
      },
      output: {
        rowCount: params.rowCount,
        characterLength: params.characterLength,
        cached: params.cached ?? false,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        tableType: params.tableType,
      },
    })
  } catch {
    // never block execution on telemetry
  }
}

export async function flushLangfuse(): Promise<void> {
  if (langfuse) {
    try {
      await langfuse.flushAsync()
    } catch {
      // ignore flush failure
    }
  }
}

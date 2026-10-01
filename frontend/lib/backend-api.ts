// frontend/lib/backend-api.ts
// Client for the Express backend (http://localhost:3001)

import { authHeaders } from '@/lib/authedFetch'
import type { ConversationAction, ConversationStage, ChipAction } from '@/components/chat/types'
import type { ComponentResponse } from '@/types/property'

// Default aligned with backend/.env (PORT=3001). Override via NEXT_PUBLIC_BACKEND_URL.
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'

export interface UnitTypeSummary {
  name: string
  bhk: number
  bathrooms: number | null
  super_area_sqft?: number | null
  carpet_area_sqft?: number | null
  price_min_cr?: number | null
  price_max_cr?: number | null
  price_label?: string | null
}

export interface AmenitySummary {
  name: string
  category: string
}

export interface ConnSummary {
  type: string
  name: string
  distance_km?: number | null
}

export interface ScoredProject {
  id: string
  slug: string
  name: string
  tagline?: string | null
  builder: { name: string; slug: string }
  rera_number?: string | null
  rera_url?: string | null
  lat?: number | null
  lng?: number | null
  sector: string
  city: string
  address?: string | null
  land_area_acres?: number | null
  total_towers?: number | null
  status: string
  launch_date?: string | null
  possession_label?: string | null
  possession_date: string | null
  architect?: string | null
  interior_designer?: string | null
  design_theme?: string | null
  marketing_claims: string[]
  hero_image_url?: string | null
  price_min_cr?: number | null
  price_max_cr?: number | null
  price_range_label: string
  unit_types: UnitTypeSummary[]
  top_amenities: AmenitySummary[]
  top_connectivity: ConnSummary[]
  images: Array<{
    id: string
    url: string
    type: string
    caption: string | null
    bhk: number | null
    size_sqft: number | null
    sort_order: number
  }>
  matchScore: number
  matchReason: string
}

export interface NearbyExpansion {
  requestedSector: string
  searchedSectors: string[]
  reason: 'no_results_in_requested_sector'
}

export type SSEEvent =
  | { type: 'heartbeat'; ts: number }
  | { type: 'intent'; intent: Record<string, unknown>; intentState: string; seq?: number }
  | { type: 'properties'; exactResults: ScoredProject[]; nearbyResults: ScoredProject[]; expansion: NearbyExpansion | null; seq?: number }
  | { type: 'token'; token: string; seq?: number }
  | { type: 'components'; response: ComponentResponse; seq?: number }
  | { type: 'done'; sessionId: string; turnId?: string; intentState: string; intent?: Record<string, unknown>; responseMode?: 'search' | 'comparison' | 'chat'; seq?: number }
  | { type: 'error'; message: string; retryable?: boolean; seq?: number }
  | { type: 'ui_state'; stage: ConversationStage; thinking: string; chips: ChipAction[]; missingFields: string[]; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; seq?: number }
  | { type: 'focus'; projectId: string; name: string; anchor: string; seq?: number }

export function streamChat(
  action: ConversationAction,
  options: {
    sessionId?: string
    userId?: string
    guestToken?: string
    intent?: Record<string, unknown>
    currentSessionViewed?: string[]
    onEvent: (event: SSEEvent) => void
    onDone?: () => void
    signal?: AbortSignal
  }
): void {
  let highestSeq = 0
  const turnId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `turn_${Date.now()}`
  let reconnectAttempts = 0
  const MAX_RECONNECTS = 3
  let isTerminal = false

  async function connectStream() {
    const baseHeaders = await authHeaders({ 'Content-Type': 'application/json' })
    const headers: Record<string, string> = {
      ...baseHeaders,
      'X-Turn-Id': turnId,
    }
    if (highestSeq > 0) {
      headers['Last-Event-Seq'] = String(highestSeq)
    }

    try {
      const res = await fetch(`${BACKEND}/api/v1/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          sessionId: options.sessionId,
          turnId,
          guestToken: options.guestToken,
          intent: options.intent,
          currentSessionViewed: options.currentSessionViewed,
        }),
        signal: options.signal,
      })

      if (!res.ok || !res.body) {
        if (reconnectAttempts < MAX_RECONNECTS && highestSeq > 0) {
          reconnectAttempts++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 3000)
          setTimeout(() => connectStream(), delay)
          return
        }

        let msg = 'The advisor is having trouble right now. Please try again in a moment.'
        try {
          const err = await res.json()
          if (res.status === 429) msg = 'You’re sending messages a bit fast — give it a few seconds and try again.'
          else if (res.status === 401 || res.status === 403) msg = 'Your session expired. Please sign in again.'
          else if (err?.error) msg = err.error
        } catch { /* non-JSON body */ }
        options.onEvent({ type: 'error', message: msg })
        options.onDone?.()
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      const STALL_MS = 60000

      while (true) {
        let readResult: ReadableStreamReadResult<Uint8Array>
        let stallTimer: ReturnType<typeof setTimeout> | undefined
        try {
          readResult = await Promise.race([
            reader.read(),
            new Promise<never>((_, rej) => { stallTimer = setTimeout(() => rej(new Error('STALL')), STALL_MS) }),
          ])
          clearTimeout(stallTimer)
        } catch {
          clearTimeout(stallTimer)
          reader.cancel().catch(() => {})
          // The buyer stopped this turn: not a dropped connection, so no reconnect.
          if (options.signal?.aborted) { options.onDone?.(); return }
          if (reconnectAttempts < MAX_RECONNECTS && highestSeq > 0) {
            reconnectAttempts++
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 3000)
            setTimeout(() => connectStream(), delay)
            return
          }
          options.onEvent({ type: 'error', message: 'The advisor stopped responding. Please try again.' })
          isTerminal = true
          break
        }

        const { done, value } = readResult
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const trimmed = part.trim()
          if (!trimmed) continue
          // Task 2.3: Discard SSE comment lines (e.g. ": ping")
          if (trimmed.startsWith(':')) continue

          const eventLine = part.match(/^event: (\w+)/m)
          const dataLine = part.match(/^data: (.+)/m)
          if (!eventLine || !dataLine) continue

          const eventType = eventLine[1]
          try {
            const data = JSON.parse(dataLine[1])
            if (typeof data.seq === 'number' && data.seq > highestSeq) {
              highestSeq = data.seq
            }
            if (eventType === 'done' || eventType === 'error') {
              isTerminal = true
            }
            options.onEvent({ type: eventType, ...data } as SSEEvent)
          } catch { /* ignore parse errors */ }
        }
      }

      if (!isTerminal && highestSeq > 0 && reconnectAttempts < MAX_RECONNECTS) {
        reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 3000)
        setTimeout(() => connectStream(), delay)
        return
      }

      options.onDone?.()
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        options.onDone?.()
        return
      }
      if (reconnectAttempts < MAX_RECONNECTS && highestSeq > 0) {
        reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 3000)
        setTimeout(() => connectStream(), delay)
        return
      }
      options.onEvent({ type: 'error', message: 'Connection error. Please try again.' })
      options.onDone?.()
    }
  }

  connectStream()
}

export async function getSessions(userId?: string, guestToken?: string) {
  const url = new URL(`${BACKEND}/api/v1/chat/session/list`)
  if (guestToken && !userId) url.searchParams.set('guestToken', guestToken)

  const res = await fetch(url.toString(), {
    headers: await authHeaders(),
  })
  if (!res.ok) return { sessions: [] as Array<{
    id: string; label: string; last_active: string;
  }> }
  return res.json() as Promise<{ sessions: Array<{
    id: string; label: string; last_active: string;
  }> }>
}

export async function getReEngagement(userId?: string, guestToken?: string) {
  const url = new URL(`${BACKEND}/api/v1/sessions/re-engagement/latest`)
  if (guestToken && !userId) url.searchParams.set('guestToken', guestToken)

  const res = await fetch(url.toString(), {
    headers: await authHeaders(),
  })
  if (!res.ok) return { session: null }
  return res.json() as Promise<{ session: {
    id: string; title: string | null; chat_phase: string; last_active: string;
  } | null }>
}

export async function migrateSessions(userId: string, guestToken: string) {
  await fetch(`${BACKEND}/api/v1/sessions/migrate`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ guestToken }),
  })
}

// ─── Intelligence endpoints (lazy, on-demand) ─────────────────────────────────

export interface PaymentPlanDto {
  plan_type: string
  plan_name: string | null
  milestones: unknown[]
  sort_order: number
  source: string | null
  verified_at: string | null
  notes: string | null
  // Consumers pass plans around as Record<string, unknown> lazy state.
  [key: string]: unknown
}

export async function getPaymentPlan(slug: string): Promise<{
  available: boolean
  message?: string
  /** Primary plan (lowest sort_order). */
  plan?: PaymentPlanDto
  /** Every plan offered for this project, ordered. */
  plans?: PaymentPlanDto[]
}> {
  try {
    const res = await fetch(`${BACKEND}/api/v1/projects/${slug}/payment-plan`)
    if (!res.ok) return { available: false, message: 'Unable to load payment plan.' }
    return await res.json()
  } catch (err) {
    console.warn('getPaymentPlan fetch error:', err)
    return { available: false, message: 'Payment plan unavailable.' }
  }
}

export async function getCostSheet(slug: string): Promise<{
  available: boolean
  message?: string
  sheet?: Record<string, unknown>
  illustration?: Record<string, number | null>
  illustration_note?: string
}> {
  try {
    const res = await fetch(`${BACKEND}/api/v1/projects/${slug}/cost-sheet`)
    if (!res.ok) return { available: false, message: 'Unable to load cost sheet.' }
    return await res.json()
  } catch (err) {
    console.warn('getCostSheet fetch error:', err)
    return { available: false, message: 'Cost sheet unavailable.' }
  }
}

export async function getInvestmentIntelligence(slug: string): Promise<{
  available: boolean
  intelligence?: {
    sector: string
    status: string
    investment_thesis: string | null
    investor_thesis: string | null
    potential_appreciation: 'Strong' | 'Moderate' | 'Weak' | null
    data_note: string
  }
}> {
  try {
    const res = await fetch(`${BACKEND}/api/v1/projects/${slug}/investment`)
    if (!res.ok) return { available: false }
    return await res.json()
  } catch (err) {
    console.warn('getInvestmentIntelligence fetch error:', err)
    return { available: false }
  }
}

export async function getBuilderIntelligence(builderSlug: string): Promise<{
  available: boolean
  builder?: Record<string, unknown>
}> {
  try {
    const res = await fetch(`${BACKEND}/api/v1/builders/${builderSlug}`)
    if (!res.ok) return { available: false }
    const data = await res.json()
    return { available: true, builder: data }
  } catch (err) {
    console.warn('getBuilderIntelligence fetch error:', err)
    return { available: false }
  }
}

export interface ProjectOverviewData {
  available: boolean
  verdict: {
    total: number
    tier: string
    confidence: number
  } | null
  live_activity: {
    viewing_now: number | null
    visits_booked_last_hour: number | null
    units_left: number | null
  }
  price_history: Array<{ recorded_at: string; price_per_sqft: number | null; total_price_cr: number | null }> | null
  construction_milestones: Array<{ name: string; status: string; completed_at: string | null; photo_urls: string[] }> | null
  on_time_delivery_pct: number | null
}

export async function getProjectOverview(slug: string): Promise<ProjectOverviewData> {
  const empty: ProjectOverviewData = {
    available: false,
    verdict: null,
    live_activity: { viewing_now: null, visits_booked_last_hour: null, units_left: null },
    price_history: null,
    construction_milestones: null,
    on_time_delivery_pct: null,
  }
  try {
    const res = await fetch(`${BACKEND}/api/v1/projects/${slug}/overview`)
    if (!res.ok) return empty
    return await res.json()
  } catch (err) {
    console.warn('getProjectOverview fetch error:', err)
    return empty
  }
}

import { capture, identify } from '@/lib/posthogClient'
import { redactPii } from '@/lib/redactPii'

type EventName =
  | 'chat_started'
  | 'message_sent'
  | 'chip_clicked'
  | 'answer_feedback'

  | 'search_performed'
  | 'search_query_submitted'
  | 'filter_changed'
  | 'recommendation_generated'
  | 'property_viewed'
  | 'property_saved'
  | 'comparison_used'
  | 'callback_requested'
  | 'site_visit_requested'
  | 'signup_started'
  | 'signup_completed'
  | 'whatsapp_handoff'
  | 'lead_created'
  | 'document_download'
  | 'ask_ai_tapped'
  | 'call_tapped'
  | 'share_tapped'
  | 'property_feedback_submitted'
  | 'quick_button_clicked'
  | 'session_resumed'

export function track(event: EventName, properties?: Record<string, unknown>) {
  try {
    if (typeof window === 'undefined') return
    capture(event, properties)
  } catch {
    // never let analytics crash the app
  }
}

/**
 * What the buyer asked, with direct identifiers taken out first.
 *
 * The query itself is the signal worth having — which sectors, which budgets,
 * which configurations people actually ask for. What is not worth shipping to a
 * third party is the "call me on 98765 43210" half of the same message, which
 * buyers write unprompted. `redactPii` removes phone numbers, emails, PAN and
 * Aadhaar and leaves the rest of the sentence alone; the buyer's real message
 * is still stored server-side against their session.
 *
 * `query_length` is measured on the ORIGINAL text, so redaction does not
 * silently change what the metric means.
 */
export function trackSearch(query: string, metadata?: Record<string, unknown>) {
  try {
    if (typeof window === 'undefined') return
    const redacted = redactPii(query ?? '')
    capture('search_performed', {
      query: redacted,
      query_length: query?.length || 0,
      query_redacted: redacted !== (query ?? ''),
      timestamp: new Date().toISOString(),
      ...metadata,
    })
  } catch {}
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  try {
    if (typeof window === 'undefined') return
    identify(userId, traits)
  } catch {}
}
type PropertyAction = 'view' | 'save' | 'compare' | 'share' | 'whatsapp_inquiry' | 'call' | 'ask_ai' | 'site_visit' | 'image_viewed' | 'tab_opened' | 'floorplan_viewed' | 'document_download' | 'calculator_used' | 'card_click' | 'filter_applied'

export async function trackPropertyEvent(projectId: string, action: PropertyAction, sessionId?: string | null, userId?: string | null, guestToken?: string | null, metadata?: Record<string, unknown>) {
  try {
    const { API_BASE } = await import('@/lib/env')
    const { authHeaders } = await import('@/lib/authedFetch')
    const headers = await authHeaders()
    await fetch(`${API_BASE}/analytics/property-event`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, action, session_id: sessionId, user_id: userId, guest_token: guestToken, metadata }),
    })
  } catch {
    // never crash app on analytics failure
  }
}


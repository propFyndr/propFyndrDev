/**
 * Analytics tracking helpers for Phase 2 instrumentation
 * Integrates with ChatAnalytics, QueryMetrics, PromotionalInteraction tables
 */

import { prisma } from '../db'
import type { Intent } from '../discovery'
import type { RequirementState } from '../discovery/requirementState'

// ─────────────────────────────────────────────────────────────
// 1. CHAT INITIALIZATION
// ─────────────────────────────────────────────────────────────

export async function initializeChatAnalytics(
  sessionId: string | undefined,
  userId: string | undefined,
  guestToken: string | undefined,
) {
  if (!sessionId) {
    console.warn('[ANALYTICS] Cannot initialize chat analytics: sessionId is missing')
    return null
  }
  try {
    const existing = await prisma.chatAnalytics.findFirst({
      where: { session_id: sessionId }
    })

    if (existing) {
      return existing
    }

    const analytics = await prisma.chatAnalytics.create({
      data: {
        session_id: sessionId,
        user_id: userId || null,
        guest_token: guestToken || null,
        chat_started_at: new Date(),
      }
    })

    console.log('[ANALYTICS] Chat initialized:', { id: analytics.id, session_id: sessionId })
    return analytics
  } catch (err) {
    console.error('[ANALYTICS] Failed to initialize:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────
// 2. INTENT IDENTIFICATION
// ─────────────────────────────────────────────────────────────

export async function trackIntentIdentified(
  sessionId: string,
  intent: Intent,
  userMessage: string,
  clarificationCount: number = 0,
  reqState?: RequirementState,
) {
  try {
    const analyticsRecord = await prisma.chatAnalytics.findFirst({
      where: { session_id: sessionId }
    })

    if (!analyticsRecord) {
      console.warn('[ANALYTICS] No analytics record found for session:', sessionId)
      return
    }

    // intent_type and possession were hardcoded null here regardless of what
    // was actually known — every row in both tables has always had empty
    // values for them, so "most common query type" / "possession demand" were
    // never answerable from this data at all. RequirementState (once a turn
    // has hydrated it) names both: intentModes[0] is the primary detected
    // mode (SEARCH, DUE_DILIGENCE, FINANCE, …), unit.status is the possession
    // stance the buyer actually stated.
    const intentType = reqState?.intentModes?.[0] ?? null
    const possessionStatus = reqState?.unit?.status && reqState.unit.status !== 'any' ? reqState.unit.status : null

    // Update ChatAnalytics
    await prisma.chatAnalytics.update({
      where: { id: analyticsRecord.id },
      data: {
        intent_identified_at: new Date(),
        intent_type: intentType,
        extracted_sector: intent.sector || null,
        extracted_bhk: intent.bhk?.[0] || null,
        extracted_budget_min: intent.budgetMin || null,
        extracted_budget_max: intent.budgetMax || null,
      }
    })

    // Create QueryMetrics entry
    const weekStart = getWeekStart(new Date())
    await prisma.queryMetrics.create({
      data: {
        query_text: userMessage,
        intent_type: intentType,
        sector: intent.sector || null,
        bhk: intent.bhk?.[0] || null,
        budget_min_cr: intent.budgetMin || null,
        budget_max_cr: intent.budgetMax || null,
        session_id: sessionId,
        user_id: analyticsRecord.user_id || null,
        week_start: weekStart,
        builder: intent.builderName || null,
        purpose: intent.purpose || null,
        possession: possessionStatus,
        clarification_count: clarificationCount,
        clicked: false,
        converted: false,
      }
    })

    console.log('[ANALYTICS] Intent tracked:', {
      session_id: sessionId,
      sector: intent.sector
    })
  } catch (err) {
    console.error('[ANALYTICS] Failed to track intent:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// 3. RESULTS SHOWN
// ─────────────────────────────────────────────────────────────

export async function trackResultsShown(
  sessionId: string,
  projectCount: number,
) {
  try {
    const analyticsRecord = await prisma.chatAnalytics.findFirst({
      where: { session_id: sessionId }
    })

    if (!analyticsRecord) return

    // Update chat analytics
    await prisma.chatAnalytics.update({
      where: { id: analyticsRecord.id },
      data: {
        results_shown_at: new Date(),
      }
    })

    // Update latest query metrics with result count
    await prisma.queryMetrics.updateMany({
      where: { session_id: sessionId },
      data: {
        results_count: projectCount,
        had_results: projectCount > 0,
      }
    })

    console.log('[ANALYTICS] Results shown:', { session_id: sessionId, count: projectCount })
  } catch (err) {
    console.error('[ANALYTICS] Failed to track results:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// 4. FIRST ENGAGEMENT (project click)
// ─────────────────────────────────────────────────────────────

export async function trackFirstEngagement(
  sessionId: string,
  projectId?: string,
) {
  try {
    const analyticsRecord = await prisma.chatAnalytics.findFirst({
      where: { session_id: sessionId }
    })

    if (!analyticsRecord) return

    // Only set if not already set
    if (!analyticsRecord.first_engagement_at) {
      await prisma.chatAnalytics.update({
        where: { id: analyticsRecord.id },
        data: {
          first_engagement_at: new Date(),
          projects_clicked: { increment: 1 },
        }
      })

      console.log('[ANALYTICS] First engagement:', { session_id: sessionId, project_id: projectId })
    } else {
      // Just increment click counter
      await prisma.chatAnalytics.update({
        where: { id: analyticsRecord.id },
        data: {
          projects_clicked: { increment: 1 },
        }
      })
    }
  } catch (err) {
    console.error('[ANALYTICS] Failed to track engagement:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// 5. CONVERSION (callback request, site visit, save)
// ─────────────────────────────────────────────────────────────

export async function trackConversion(
  sessionId: string,
  conversionType: 'callback_requested' | 'site_visit_requested' | 'property_saved',
  projectId?: string,
  builderId?: string,
) {
  try {
    const analyticsRecord = await prisma.chatAnalytics.findFirst({
      where: { session_id: sessionId }
    })

    if (!analyticsRecord) return

    const updateData: any = {
      conversion_at: new Date(),
      conversion_type: conversionType,
    }

    if (projectId) updateData.converted_project_id = projectId
    if (builderId) updateData.converted_builder_id = builderId

    await prisma.chatAnalytics.update({
      where: { id: analyticsRecord.id },
      data: updateData
    })

    console.log('[ANALYTICS] Conversion tracked:', {
      session_id: sessionId,
      conversion_type: conversionType,
      project_id: projectId
    })
  } catch (err) {
    console.error('[ANALYTICS] Failed to track conversion:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// 6. DROP-OFF DETECTION
// ─────────────────────────────────────────────────────────────

export async function trackDropOff(
  sessionId: string,
  stage: 'no_intent' | 'no_results' | 'no_engagement' | 'no_action',
  idleSeconds?: number,
) {
  try {
    const analyticsRecord = await prisma.chatAnalytics.findFirst({
      where: { session_id: sessionId }
    })

    if (!analyticsRecord) return

    // Only track if not already converted
    if (!analyticsRecord.conversion_at) {
      await prisma.chatAnalytics.update({
        where: { id: analyticsRecord.id },
        data: {
          drop_off_stage: stage,
          drop_off_at: new Date(),
          idle_seconds_before_drop_off: idleSeconds || null,
        }
      })

      console.log('[ANALYTICS] Drop-off tracked:', {
        session_id: sessionId,
        stage,
        idle_seconds: idleSeconds
      })
    }
  } catch (err) {
    console.error('[ANALYTICS] Failed to track drop-off:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// 7. PROMOTIONAL TRACKING
// ─────────────────────────────────────────────────────────────

export async function trackPromotionalImpression(
  promotionalId: string,
  sessionId?: string,
  userId?: string,
  guestToken?: string,
) {
  try {
    await Promise.all([
      prisma.promotionalInteraction.create({
        data: {
          promotional_id: promotionalId,
          session_id: sessionId || null,
          user_id: userId || null,
          guest_token: guestToken || null,
          interaction_type: 'impression',
        }
      }),
      prisma.promotional.update({
        where: { id: promotionalId },
        data: { impressions: { increment: 1 } }
      })
    ])

    console.log('[ANALYTICS] Promo impression:', { promotional_id: promotionalId })
  } catch (err) {
    console.error('[ANALYTICS] Failed to track impression:', err)
  }
}

export async function trackPromotionalClick(
  promotionalId: string,
  sessionId?: string,
  userId?: string,
  guestToken?: string,
) {
  try {
    await Promise.all([
      prisma.promotionalInteraction.create({
        data: {
          promotional_id: promotionalId,
          session_id: sessionId || null,
          user_id: userId || null,
          guest_token: guestToken || null,
          interaction_type: 'click',
        }
      }),
      prisma.promotional.update({
        where: { id: promotionalId },
        data: { clicks: { increment: 1 } }
      }),
      // Link promo to session analytics
      sessionId ? prisma.chatAnalytics.updateMany({
        where: { session_id: sessionId },
        data: {
          promotional_id: promotionalId,
          promo_clicked: true,
        }
      }) : Promise.resolve()
    ])

    console.log('[ANALYTICS] Promo click:', { promotional_id: promotionalId })
  } catch (err) {
    console.error('[ANALYTICS] Failed to track click:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// 8. PROPERTY EVENTS (fine-grained interaction tracking)
// ─────────────────────────────────────────────────────────────

export async function trackPropertyEvent(
  sessionId: string,
  projectId: string,
  action: 'view' | 'save' | 'compare' | 'share' | 'brochure' | 'gallery' | 'location' | 'call' | 'whatsapp' | 'site_visit' | 'remove_saved',
  userId?: string,
  guestToken?: string,
) {
  try {
    await prisma.propertyEvent.create({
      data: {
        session_id: sessionId,
        project_id: projectId,
        action,
        user_id: userId || null,
        guest_token: guestToken || null,
      }
    })

    console.log('[ANALYTICS] Property event:', { session_id: sessionId, project_id: projectId, action })
  } catch (err) {
    console.error('[ANALYTICS] Failed to track property event:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// 9. AI PERFORMANCE METRICS
// ─────────────────────────────────────────────────────────────

export async function trackAIMetrics(
  sessionId: string,
  latencyMs: number,
  tokensUsed: number,
  confidence?: number,
) {
  try {
    const analyticsRecord = await prisma.chatAnalytics.findFirst({
      where: { session_id: sessionId }
    })

    if (!analyticsRecord) return

    await prisma.chatAnalytics.update({
      where: { id: analyticsRecord.id },
      data: {
        latency_ms: latencyMs,
        llm_tokens: tokensUsed,
        ai_confidence: confidence || null,
      }
    })

    console.log('[ANALYTICS] AI metrics:', { session_id: sessionId, latency_ms: latencyMs, tokens: tokensUsed })
  } catch (err) {
    console.error('[ANALYTICS] Failed to track AI metrics:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  return new Date(d.setDate(diff))
}

export { getWeekStart }

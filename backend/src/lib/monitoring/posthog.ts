/**
 * PostHog Analytics Client
 * Centralized event tracking for user behavior, performance, and system metrics
 */

import { PostHog } from 'posthog-node'

let posthog: PostHog | null = null

/**
 * Initialize PostHog client
 */
export function initPostHog(): PostHog {
  if (posthog) return posthog

  const apiKey = process.env.POSTHOG_API_KEY || ''
  if (!apiKey) {
    console.warn('POSTHOG_API_KEY not set; analytics disabled')
    return null as any
  }

  posthog = new PostHog(apiKey, {
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    flushInterval: 1000,
    flushAt: 1,
  })

  return posthog
}

/**
 * Get PostHog client (lazy init)
 */
export function getPostHog(): PostHog | null {
  if (!posthog && process.env.POSTHOG_API_KEY) {
    return initPostHog()
  }
  return posthog
}

/**
 * Track event
 */
export function trackEvent(
  userId: string | null,
  event: string,
  properties?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === 'test') return
  const client = getPostHog()
  if (!client) return

  try {
    client.capture({
      distinctId: userId || 'anonymous',
      event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
      },
    })
    client.flush().catch(() => {})
  } catch (err) {
    console.error('PostHog capture failed:', err)
  }
}

/**
 * Track user properties
 */
export function trackUserProperties(
  userId: string,
  properties: Record<string, unknown>
): void {
  const client = getPostHog()
  if (!client) return

  try {
    client.identify({
      distinctId: userId,
      properties,
    })
  } catch (err) {
    console.error('PostHog identify failed:', err)
  }
}

/**
 * Flush pending events
 */
export async function flushPostHog(): Promise<void> {
  if (!posthog) return
  try {
    await posthog.flush()
  } catch (err) {
    console.error('PostHog flush failed:', err)
  }
}

/**
 * Close PostHog client
 */
export async function closePostHog(): Promise<void> {
  if (!posthog) return
  try {
    await posthog.flush()
    posthog = null
  } catch (err) {
    console.error('PostHog close failed:', err)
  }
}

/**
 * Event definitions for type safety
 */
export const ANALYTICS_EVENTS = {
  // Intent & Query
  INTENT_CLASSIFIED: 'intent_classified',
  QUERY_PLANNED: 'query_planned',
  PROJECT_FOUND: 'project_found',
  PROJECT_NOT_FOUND: 'project_not_found',

  // Data & Confidence
  DATA_FETCHED: 'data_fetched',
  CONFIDENCE_COMPUTED: 'confidence_computed',
  LOW_CONFIDENCE: 'low_confidence',
  MISSING_FIELDS: 'missing_fields',

  // Components
  COMPONENTS_RENDERED: 'components_rendered',
  COMPONENT_ERROR: 'component_error',

  // LLM
  LLM_CALLED: 'llm_called',
  LLM_TIMEOUT: 'llm_timeout',
  LLM_ERROR: 'llm_error',

  // Cache
  CACHE_HIT: 'cache_hit',
  CACHE_MISS: 'cache_miss',

  // Errors
  API_ERROR: 'api_error',
  VALIDATION_ERROR: 'validation_error',
  DATABASE_ERROR: 'database_error',

  // Performance
  REQUEST_COMPLETED: 'request_completed',
  REQUEST_SLOW: 'request_slow',
} as const

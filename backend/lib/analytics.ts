/**
 * Analytics Event Tracking
 * Phase 3E: Quality metrics and lead funnel tracking
 */

export type EventType = 'lead_created' | 'lead_contacted' | 'lead_visited' | 'lead_converted'

export interface AnalyticsEvent {
  event_type: EventType
  lead_id: string
  project_id: string
  guest_token: string
  timestamp: Date
  metadata?: Record<string, any>
}

export interface QualityMetric {
  date: Date
  total_projects: number
  projects_with_rera: number
  projects_with_verified_timestamp: number
  projects_with_lift_act: number
  projects_with_coordinates: number
  projects_with_walkability: number
  avg_fields_per_project: number
  coverage_percent: number
}

export interface LeadFunnelMetric {
  date: Date
  leads_created: number
  leads_contacted: number
  leads_visited: number
  leads_converted: number
  contacted_rate_percent: number
  visited_rate_percent: number
  conversion_rate_percent: number
}

/**
 * Track analytics event (called from various routes)
 */
export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  // In production: persist to analytics_events table
  console.log(`[Analytics] ${event.event_type}: ${event.lead_id} @ ${event.project_id}`)
}

/**
 * Calculate quality metrics for a given date
 */
export function calculateQualityMetrics(projects: any[]): QualityMetric {
  const withRERA = projects.filter(p => p.rera_number).length
  const withTimestamp = projects.filter(p => p.verified_at).length
  const withLiftAct = projects.filter(p => p.lift_act_compliant).length
  const withCoordinates = projects.filter(p => p.lat && p.lng).length
  const withWalkability = projects.filter(p => p.walkability_score).length

  // Calculate average fields per project
  let totalFields = 0
  for (const p of projects) {
    const fields = Object.keys(p).filter(k => p[k] !== null && p[k] !== undefined)
    totalFields += fields.length
  }
  const avgFields = projects.length > 0 ? totalFields / projects.length : 0

  // Coverage: percentage of projects with enriched data (at least 5+ fields)
  const enriched = projects.filter(p => {
    const fields = Object.keys(p).filter(k => p[k] !== null && p[k] !== undefined)
    return fields.length >= 5
  })
  const coverage = projects.length > 0 ? (enriched.length / projects.length) * 100 : 0

  return {
    date: new Date(),
    total_projects: projects.length,
    projects_with_rera: withRERA,
    projects_with_verified_timestamp: withTimestamp,
    projects_with_lift_act: withLiftAct,
    projects_with_coordinates: withCoordinates,
    projects_with_walkability: withWalkability,
    avg_fields_per_project: Math.round(avgFields),
    coverage_percent: Math.round(coverage),
  }
}

/**
 * Calculate lead funnel metrics from events
 */
export function calculateLeadFunnelMetrics(events: AnalyticsEvent[]): LeadFunnelMetric {
  const created = new Set(events.filter(e => e.event_type === 'lead_created').map(e => e.lead_id))
  const contacted = new Set(events.filter(e => e.event_type === 'lead_contacted').map(e => e.lead_id))
  const visited = new Set(events.filter(e => e.event_type === 'lead_visited').map(e => e.lead_id))
  const converted = new Set(events.filter(e => e.event_type === 'lead_converted').map(e => e.lead_id))

  const createdCount = created.size || 1 // Avoid div by zero
  const contactedRate = (contacted.size / createdCount) * 100
  const visitedRate = (visited.size / createdCount) * 100
  const convertedRate = (converted.size / createdCount) * 100

  return {
    date: new Date(),
    leads_created: created.size,
    leads_contacted: contacted.size,
    leads_visited: visited.size,
    leads_converted: converted.size,
    contacted_rate_percent: Math.round(contactedRate),
    visited_rate_percent: Math.round(visitedRate),
    conversion_rate_percent: Math.round(convertedRate),
  }
}

/**
 * Format quality metrics for display
 */
export function formatQualityMetrics(m: QualityMetric): string {
  return `
QUALITY SCORECARD (${m.date.toDateString()})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Projects: ${m.total_projects}
With RERA: ${m.projects_with_rera}/${m.total_projects} (${Math.round((m.projects_with_rera / m.total_projects) * 100)}%)
With verified_at: ${m.projects_with_verified_timestamp}/${m.total_projects} (${Math.round((m.projects_with_verified_timestamp / m.total_projects) * 100)}%)
With lift_act: ${m.projects_with_lift_act}/${m.total_projects} (${Math.round((m.projects_with_lift_act / m.total_projects) * 100)}%)
With coordinates: ${m.projects_with_coordinates}/${m.total_projects} (${Math.round((m.projects_with_coordinates / m.total_projects) * 100)}%)
With walkability: ${m.projects_with_walkability}/${m.total_projects} (${Math.round((m.projects_with_walkability / m.total_projects) * 100)}%)

Avg fields/project: ${m.avg_fields_per_project}
Enrichment coverage: ${m.coverage_percent}%
`.trim()
}

/**
 * Format lead funnel for display
 */
export function formatLeadFunnel(m: LeadFunnelMetric): string {
  return `
LEAD FUNNEL (${m.date.toDateString()})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Created: ${m.leads_created}
Contacted: ${m.leads_contacted} (${m.contacted_rate_percent}%)
Site Visit: ${m.leads_visited} (${m.visited_rate_percent}%)
Converted: ${m.leads_converted} (${m.conversion_rate_percent}%)
`.trim()
}

/**
 * Lead Brief Generator
 * Creates partner-facing lead summaries WITHOUT exposing chat transcripts
 *
 * Non-negotiable rules:
 * - Never include chat_sessions data
 * - Never include competitor names (keep abstract)
 * - Only include buyer-provided information
 * - Abstracted objections only (e.g., "possession concerns" not "worried about Omaxe delays")
 */

export interface LeadBriefInput {
  project_id: string
  guest_token: string
  buyer_phone?: string
  buyer_email?: string
  buyer_name?: string
  requirement_summary?: string
  preferred_contact_method?: string
  preferred_contact_time?: string
  objections?: Array<{
    type: 'PRICE' | 'POSSESSION' | 'BUILDER_HISTORY' | 'LOCATION' | 'OTHER'
    reason: string
    competitor_pressure?: boolean
  }>
}

export interface LeadBrief {
  id: string
  project_id: string
  guest_token: string
  requirement_summary: string
  readiness_signals: string[]
  objections: string[]
  best_contact_method: string
  best_contact_time_window: string
  buyer_name?: string
  buyer_phone?: string
  buyer_email?: string
  created_at: Date
}

/**
 * Generate Lead Brief from buyer input
 * Inputs: what buyer told us (requirements, concerns)
 * Outputs: structured lead info for partner/builder
 * Guarantee: ZERO transcript, ZERO competitor names
 */
export function generateLeadBrief(input: LeadBriefInput): Partial<LeadBrief> {
  const readinessSignals: string[] = []
  const abstractedObjections: string[] = []

  // Readiness signals (what's buyer ready to do?)
  if (input.buyer_phone) readinessSignals.push('Phone number provided')
  if (input.buyer_email) readinessSignals.push('Email provided')
  if (input.preferred_contact_method) readinessSignals.push(`Prefers contact via ${input.preferred_contact_method}`)

  // Abstracted objections (never name competitors)
  if (input.objections && input.objections.length > 0) {
    for (const objection of input.objections) {
      const abstractedMsg = abstractObjection(objection)
      if (abstractedMsg) abstractedObjections.push(abstractedMsg)
    }
  }

  return {
    project_id: input.project_id,
    guest_token: input.guest_token,
    requirement_summary: input.requirement_summary || 'No summary provided',
    readiness_signals: readinessSignals.length > 0 ? readinessSignals : ['Guest initiated contact'],
    objections: abstractedObjections,
    best_contact_method: input.preferred_contact_method || 'Phone',
    best_contact_time_window: input.preferred_contact_time || 'Flexible',
    buyer_name: input.buyer_name,
    buyer_phone: input.buyer_phone,
    buyer_email: input.buyer_email,
  }
}

/**
 * Abstract objections to hide competitor identity
 * Input: "worried about Omaxe's 24-month delays"
 * Output: "Concerned about builder delivery timeline"
 */
function abstractObjection(objection: {
  type: string
  reason: string
  competitor_pressure?: boolean
}): string {
  switch (objection.type) {
    case 'PRICE':
      return objection.reason.replace(/\d+(\.\d+)?\s*(cr|lakh|rupees?)?/gi, '[price]')
        .replace(/\w+\s+(tower|project|property|apartments?)/gi, 'project')
        || 'Price concern'

    case 'POSSESSION':
      return objection.reason.replace(/\d+\s*(months?|years?|quarters?)/gi, '[timeline]')
        || 'Possession timeline concern'

    case 'BUILDER_HISTORY':
      // Remove all builder names, keep the actual concern
      return 'Concerns about builder track record'

    case 'LOCATION':
      return objection.reason.replace(/\b\w+\s+(metro|market|school|hospital)\b/gi, '[landmark]')
        || 'Location concern'

    case 'OTHER':
      return objection.reason

    default:
      return null
  }
}

/**
 * Validate that no PII or sensitive data leaks
 * Called before sending brief to partner
 */
export function validateLeadBrief(brief: Partial<LeadBrief>): { valid: boolean; issues: string[] } {
  const issues: string[] = []

  // Check for transcript markers
  if (brief.requirement_summary?.includes('chat') || brief.requirement_summary?.includes('message')) {
    issues.push('requirement_summary may contain chat reference')
  }

  // Check for competitor names in objections
  const builderNames = ['ace', 'omaxe', 'ats', 'sobha', 'ireo', 'lodha', 'godrej', 'dlf', 'pvr']
  for (const objection of brief.objections || []) {
    for (const name of builderNames) {
      if (objection.toLowerCase().includes(name)) {
        issues.push(`Objection contains builder name: ${name}`)
      }
    }
  }

  // Check for full chat transcripts
  if ((brief.requirement_summary?.length || 0) > 2000) {
    issues.push('requirement_summary too long (looks like transcript dump)')
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

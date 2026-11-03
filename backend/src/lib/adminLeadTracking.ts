// backend/src/lib/adminLeadTracking.ts
//
// Small pure pieces behind the admin lead-tracking routes, kept out of
// routes/admin.ts so they can be tested without a server.
import { Prisma } from '@prisma/client'
import { realLeads } from './analytics/cohort'

export const SITE_VISIT_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'] as const
export type SiteVisitStatusFilter = (typeof SITE_VISIT_STATUSES)[number]

/**
 * GET /admin/site-visits: one page of real site visits (lib/analytics/cohort.ts
 * realLeads, team excluded unless includeTeam), newest first, plus the count
 * under the same WHERE so `total` is real even past the last page.
 */
export function siteVisitsQuery(opts: {
  status?: SiteVisitStatusFilter
  includeTeam?: boolean
  limit: number
  offset: number
}): { list: Prisma.Sql; count: Prisma.Sql } {
  const from = Prisma.sql`
    FROM site_visit_requests sv
    JOIN (${realLeads({ includeTeam: opts.includeTeam })}) l ON l.id = sv.id AND l.kind = 'site_visit'
    LEFT JOIN projects p ON p.id = sv.project_id
    ${opts.status ? Prisma.sql`WHERE sv.status::text = ${opts.status}` : Prisma.empty}`
  return {
    list: Prisma.sql`
      SELECT sv.id, sv.name, sv.phone, sv.project_name, sv.project_slug, p.builder_id,
             sv.visit_date, sv.time_slot, sv.status::text AS status, sv.created_at, sv.assigned_partner_id
      ${from}
      ORDER BY sv.created_at DESC
      LIMIT ${opts.limit} OFFSET ${opts.offset}`,
    count: Prisma.sql`SELECT count(*)::int AS total ${from}`,
  }
}

/**
 * The one audit row a lead PATCH writes, or null when nothing worth logging
 * changed. CONTACTED wins: the request that stamped first_contacted_at is the
 * contact, whatever status it moved to.
 */
export function leadPatchAudit(
  oldStatus: string | null,
  newStatus: string | undefined,
  stampedFirstContact: boolean,
): { action: 'CONTACTED' | 'STATUS_CHANGED'; summary: string } | null {
  const transition = `${oldStatus ?? 'unknown'} → ${newStatus ?? oldStatus ?? 'unknown'}`
  if (stampedFirstContact) return { action: 'CONTACTED', summary: `First contact: ${transition}` }
  if (newStatus && newStatus !== oldStatus) return { action: 'STATUS_CHANGED', summary: `Status ${transition}` }
  return null
}

/** Median of the samples (upper middle, as /boards/queue computes it), null under 5 samples. */
export function medianOrNull(values: number[], minSamples = 5): number | null {
  if (values.length < minSamples) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// backend/src/lib/analytics/cohort.ts
//
// One definition of "a real person" and "a real lead" for every admin count.
//
// A person: a signed-in account, or a website guest token (WEBSITE_GUEST_TOKEN,
// lib/botDetection.ts), on a session not flagged is_bot. A guest who later signed
// in on that device counts as their account: referral_visits records the link at
// sign-in (routes/sessions.ts). That is the only guest→account link we hold.
//
// Team: anyone in team_identities, matched on the resolved person, the account id
// or the raw guest token. NOT EXISTS rather than NOT IN, so a row with no
// identity is not silently dropped by a NULL comparison.
//
// Raw SQL bypasses the client extensions in lib/db.ts, so `is_test = false` is
// written out here.
import { Prisma } from '@prisma/client'
import { WEBSITE_GUEST_TOKEN } from '../botDetection'

/** The person behind a row: its account, else the account its guest token signed in as, else the token. */
export function personOf(userCol: string, guestCol: string): Prisma.Sql {
  const u = Prisma.raw(userCol)
  const g = Prisma.raw(guestCol)
  return Prisma.sql`COALESCE(${u}, (SELECT rv.user_id FROM referral_visits rv WHERE rv.guest_token = ${g} AND rv.user_id IS NOT NULL LIMIT 1), ${g})`
}

/** True when the row (alias with person, user_id, guest_token columns) is not a team member. */
export function notTeam(alias: string): Prisma.Sql {
  const a = Prisma.raw(alias)
  return Prisma.sql`NOT EXISTS (SELECT 1 FROM team_identities t WHERE t.key IN (${a}.person, ${a}.user_id, ${a}.guest_token))`
}

/**
 * Sessions of real people, one row per session, with a `person` key.
 * Team excluded unless `includeTeam` (the People list names team members on purpose).
 */
export function realPeopleSessions(opts: { includeTeam?: boolean } = {}): Prisma.Sql {
  return Prisma.sql`
    SELECT * FROM (
      SELECT cs.id, cs.user_id, cs.guest_token, cs.created_at, cs.last_active, cs.device, cs.source, cs.message_count,
        ${personOf('cs.user_id', 'cs.guest_token')} AS person
      FROM chat_sessions cs
      WHERE cs.is_bot = false AND (cs.user_id IS NOT NULL OR cs.guest_token ~ ${WEBSITE_GUEST_TOKEN})
    ) rps
    ${opts.includeTeam ? Prisma.empty : Prisma.sql`WHERE ${notTeam('rps')}`}`
}

/** query_metrics rows that belong to a real person's session (team excluded). */
export function realPeopleQueryMetrics(): Prisma.Sql {
  return Prisma.sql`SELECT q.* FROM query_metrics q JOIN (${realPeopleSessions()}) rqs ON rqs.id = q.session_id`
}

/** property_events rows that belong to a real person's session (team excluded). */
export function realPeoplePropertyEvents(): Prisma.Sql {
  return Prisma.sql`SELECT pe.* FROM property_events pe JOIN (${realPeopleSessions()}) rpe ON rpe.id = pe.session_id`
}

/**
 * Real leads: callbacks not marked is_test, and site visits (no is_test column),
 * neither from a team identity. kind is 'callback' | 'site_visit'.
 * A lead with no identity at all is kept: it is not ours, only unattributed.
 * `includeTeam` keeps team identities (a debugging escape, as in realPeopleSessions).
 */
export function realLeads(opts: { includeTeam?: boolean } = {}): Prisma.Sql {
  return Prisma.sql`
    SELECT * FROM (
      SELECT cr.id, 'callback'::text AS kind, cr.created_at, cr.user_id, cr.guest_token, cr.status::text AS status,
        cr.assigned_partner_id, cr.project_slug, ${personOf('cr.user_id', 'cr.guest_token')} AS person
      FROM callback_requests cr WHERE cr.is_test = false
      UNION ALL
      SELECT sv.id, 'site_visit'::text, sv.created_at, sv.user_id, sv.guest_token, sv.status::text,
        sv.assigned_partner_id, sv.project_slug, ${personOf('sv.user_id', 'sv.guest_token')}
      FROM site_visit_requests sv
    ) rl
    ${opts.includeTeam ? Prisma.empty : Prisma.sql`WHERE ${notTeam('rl')}`}`
}

/**
 * Saves by real people. saved_properties keys a guest as `guest_<token>` in user_id
 * (routes/saved.ts), so the prefix is split off before the person and team checks.
 */
export function realSaves(): Prisma.Sql {
  return Prisma.sql`
    SELECT * FROM (
      SELECT x.*, ${personOf('x.user_id', 'x.guest_token')} AS person FROM (
        SELECT sp.id, sp.project_id, sp.saved_at,
          CASE WHEN left(sp.user_id, 6) = 'guest_' THEN NULL ELSE sp.user_id END AS user_id,
          CASE WHEN left(sp.user_id, 6) = 'guest_' THEN substr(sp.user_id, 7) END AS guest_token
        FROM saved_properties sp
      ) x
      WHERE x.user_id IS NOT NULL OR x.guest_token ~ ${WEBSITE_GUEST_TOKEN}
    ) rsv
    WHERE ${notTeam('rsv')}`
}

/** Property-event action names, old and current (frontend/lib/analytics.ts PropertyAction). */
export const EVENT_ACTIONS = {
  click: ['card_click', 'click'],
  view: ['view'],
  save: ['save'],
  compare: ['compare'],
  share: ['share'],
  whatsapp: ['whatsapp_inquiry', 'whatsapp'],
} as const

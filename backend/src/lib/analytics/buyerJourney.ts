// backend/src/lib/analytics/buyerJourney.ts
//
// Where buyers drop off, counted per person.
//
// The admin funnel used to divide unrelated table totals (sessions, query
// metrics, property events, leads), so its "x% drop" figures compared
// different people. Here every stage is a count of the same people: those who
// started a non-bot chat in the window, and then did the stage's action in it.
//
// A person is a signed-in user id or a guest token. Saves store a guest as
// `guest_<token>` in user_id (routes/saved.ts); every other table carries the
// raw token, so saves are unprefixed before matching.
//
// Stages are not nested: a buyer can request a callback without saving, so each
// stage is a share of chat starters, never a drop from the stage above.
//
// "Dossier created" is a share link made. Whether it was then sent is a
// PostHog event (dossier_shared), not a database row.
import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import { realPeopleSessions, realLeads, realSaves, personOf, notTeam, EVENT_ACTIONS } from './cohort'
import { LEAD_BRIEF_READ_SUMMARY } from '../adminReadAudit'

/** Stage order as shown. The buyer path is chat → cards → project → saved → lead → brief → contacted. */
export const STAGE_ORDER = [
  'chat_started', 'cards_shown', 'project_opened', 'saved',
  'lead', 'callback', 'site_visit', 'brief_opened', 'contacted', 'dossier',
] as const

export interface JourneyStage {
  id: (typeof STAGE_ORDER)[number]
  label: string
  /** People among chat starters who did this. */
  count: number
  /** count / chat starters, as a percent to one decimal (lead rates are small). */
  pctOfStarters: number
  /** Actions in the window by nobody in the cohort: no identity, or never chatted. */
  outsideCohort: number
}

const LABELS: Record<JourneyStage['id'], string> = {
  chat_started: 'Chat started',
  cards_shown: 'Shown project cards',
  project_opened: 'Opened a project',
  saved: 'Project saved',
  lead: 'Became a lead (callback or site visit)',
  callback: 'Callback requested',
  site_visit: 'Site visit requested',
  brief_opened: 'Lead brief opened by our team',
  contacted: 'Contacted by our team',
  dossier: 'Dossier created',
}

export async function buyerJourney(db: PrismaClient, since: Date): Promise<JourneyStage[]> {
  // The cohort is real people (lib/analytics/cohort.ts): an account or a website guest
  // token, not a bot, not team. Actions are real ones only (no test leads, no team), so a
  // team member's save or site visit is neither counted nor reported as outside the cohort.
  const rows = await db.$queryRaw<Array<{ stage: string; people: number; outside: number }>>(Prisma.sql`
    WITH s AS (
      SELECT * FROM (${realPeopleSessions()}) rp WHERE rp.created_at >= ${since}
    ),
    cohort AS (SELECT DISTINCT person FROM s),
    -- Every key a cohort person is known by: the resolved person, the account, the raw guest token.
    cohort_keys AS (
      SELECT DISTINCT k, person FROM (
        SELECT person AS k, person FROM s
        UNION ALL SELECT user_id, person FROM s WHERE user_id IS NOT NULL
        UNION ALL SELECT guest_token, person FROM s WHERE guest_token IS NOT NULL
      ) x
    ),
    leads AS (SELECT * FROM (${realLeads()}) l WHERE created_at >= ${since}),
    actions AS (
      -- Cards and project opens are counted per session (action_id), so outsideCohort is sessions.
      -- Assistant artifacts are an array of {type, ...} (chat-router persist); cards are type property_results.
      SELECT DISTINCT 'cards_shown' AS stage, r.id AS action_id, r.user_id, r.guest_token, r.person
        FROM chat_messages m JOIN (${realPeopleSessions()}) r ON r.id = m.session_id
       WHERE m.role = 'assistant' AND m.created_at >= ${since}
         AND m.artifacts @> '[{"type":"property_results"}]'::jsonb
      UNION ALL
      SELECT DISTINCT 'project_opened', r.id, r.user_id, r.guest_token, r.person
        FROM property_events pe JOIN (${realPeopleSessions()}) r ON r.id = pe.session_id
       WHERE pe.created_at >= ${since} AND pe.action IN (${Prisma.join([...EVENT_ACTIONS.view, ...EVENT_ACTIONS.click])})
      UNION ALL
      SELECT 'saved', id, user_id, guest_token, person
        FROM (${realSaves()}) sv WHERE saved_at >= ${since}
      UNION ALL
      SELECT 'lead', id, user_id, guest_token, person FROM leads
      UNION ALL
      SELECT CASE WHEN kind = 'callback' THEN 'callback' ELSE 'site_visit' END, id, user_id, guest_token, person
        FROM leads
      UNION ALL
      -- A brief is a callback's; opened = a staff READ logged by adminReadAudit (any time).
      SELECT 'brief_opened', l.id, l.user_id, l.guest_token, l.person FROM leads l
       WHERE l.kind = 'callback' AND EXISTS (
         SELECT 1 FROM audit_logs a WHERE a.entity_type = 'callback_request' AND a.entity_id = l.id
            AND a.action = 'READ' AND a.summary = ${LEAD_BRIEF_READ_SUMMARY})
      UNION ALL
      -- Only callbacks carry first_contacted_at.
      SELECT 'contacted', l.id, l.user_id, l.guest_token, l.person FROM leads l
        JOIN callback_requests cr ON cr.id = l.id
       WHERE l.kind = 'callback' AND cr.first_contacted_at IS NOT NULL
      UNION ALL
      SELECT 'dossier', token, user_id, guest_token, person FROM (
        SELECT d.token, d.user_id, d.guest_token, ${personOf('d.user_id', 'd.guest_token')} AS person
          FROM dossiers d WHERE d.created_at >= ${since}
      ) dd WHERE ${notTeam('dd')}
    ),
    -- One key per row so the cohort join is an equality (hash) join, not an OR.
    action_keys AS (
      SELECT stage, action_id, person AS k FROM actions WHERE person IS NOT NULL
      UNION ALL
      SELECT stage, action_id, user_id FROM actions WHERE user_id IS NOT NULL
      UNION ALL
      SELECT stage, action_id, guest_token FROM actions WHERE guest_token IS NOT NULL
    ),
    -- An action carrying several keys counts its person once.
    matched AS (
      SELECT ak.stage, ak.action_id, min(c.person) AS person
        FROM action_keys ak JOIN cohort_keys c ON c.k = ak.k
       GROUP BY ak.stage, ak.action_id
    )
    SELECT 'chat_started' AS stage, (SELECT count(*) FROM cohort)::int AS people, 0 AS outside
    UNION ALL
    SELECT a.stage,
           count(DISTINCT m.person)::int,
           (count(DISTINCT a.action_id) - count(DISTINCT m.action_id))::int
      FROM actions a LEFT JOIN matched m ON m.stage = a.stage AND m.action_id = a.action_id
     GROUP BY a.stage
  `)

  const byStage = new Map(rows.map(r => [r.stage, r]))
  const starters = byStage.get('chat_started')?.people ?? 0
  return STAGE_ORDER.map(id => {
    const count = byStage.get(id)?.people ?? 0
    return {
      id,
      label: LABELS[id],
      count,
      pctOfStarters: starters > 0 ? Math.round((count / starters) * 1000) / 10 : 0,
      outsideCohort: byStage.get(id)?.outside ?? 0,
    }
  })
}

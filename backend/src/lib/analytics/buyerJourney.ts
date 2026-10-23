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

export interface JourneyStage {
  id: 'chat_started' | 'saved' | 'callback' | 'site_visit' | 'dossier'
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
  saved: 'Project saved',
  callback: 'Callback requested',
  site_visit: 'Site visit requested',
  dossier: 'Dossier created',
}

export async function buyerJourney(db: PrismaClient, since: Date): Promise<JourneyStage[]> {
  const rows = await db.$queryRaw<Array<{ stage: string; people: number; outside: number }>>(Prisma.sql`
    WITH cohort AS (
      SELECT DISTINCT CASE WHEN user_id IS NOT NULL THEN 'u:' || user_id ELSE 'g:' || guest_token END AS k
      FROM chat_sessions
      WHERE is_bot = false AND created_at >= ${since}
        AND (user_id IS NOT NULL OR guest_token IS NOT NULL)
    ),
    actions AS (
      SELECT 'saved' AS stage, id AS action_id,
             CASE WHEN user_id LIKE 'guest\\_%' THEN 'g:' || substr(user_id, 7) ELSE 'u:' || user_id END AS k1,
             NULL::text AS k2
        FROM saved_properties WHERE saved_at >= ${since}
      UNION ALL
      SELECT 'callback', id, 'u:' || user_id, 'g:' || guest_token
        FROM callback_requests WHERE created_at >= ${since} AND is_test = false
      UNION ALL
      SELECT 'site_visit', id, 'u:' || user_id, 'g:' || guest_token
        FROM site_visit_requests WHERE created_at >= ${since}
      UNION ALL
      SELECT 'dossier', token, 'u:' || user_id, 'g:' || guest_token
        FROM dossiers WHERE created_at >= ${since}
    ),
    -- One key per row so the cohort join is an equality (hash) join, not an OR.
    action_keys AS (
      SELECT stage, action_id, k1 AS k FROM actions WHERE k1 IS NOT NULL
      UNION ALL
      SELECT stage, action_id, k2 FROM actions WHERE k2 IS NOT NULL
    ),
    -- An action carrying both a user id and a guest token counts its person once.
    matched AS (
      SELECT ak.stage, ak.action_id, min(c.k) AS person
        FROM action_keys ak JOIN cohort c ON c.k = ak.k
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
  return (Object.keys(LABELS) as JourneyStage['id'][]).map(id => {
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

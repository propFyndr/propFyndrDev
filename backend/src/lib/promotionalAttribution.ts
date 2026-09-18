// backend/src/lib/promotionalAttribution.ts
//
// Crediting a lead back to the news item that started it.
//
// The rail's value to a builder is not impressions, it is whether taps become
// callbacks. `Promotional.conversions` existed as a column from the start and
// nothing ever incremented it, so the one number a builder would actually pay
// against was permanently zero.
//
// Attribution is done SERVER-SIDE, from the click row the rail already writes,
// rather than by having the client carry a promotional id through the chat and
// hand it back at callback time. Three reasons:
//
//  - It survives a page reload, a new tab, and the buyer wandering off and
//    coming back — all of which lose client-held state, and all of which are
//    normal between tapping a news item and asking for a callback.
//  - A client-supplied id is a claim. A builder's conversion count is a
//    commercial number; it should not be settable by anyone with a fetch call.
//  - The click row already carries the identity. Nothing new had to be stored.
//
// Last-touch within a window, which is the honest limit of what this can know:
// if a buyer tapped two news items, the more recent one gets the credit. Naming
// that here because "conversions" implies causation and this is correlation
// with a time bound.
import { prisma } from './db'

/**
 * How long after a tap a callback still counts as coming from it.
 *
 * A day. Long enough to cover the normal shape — tap in the evening, ask for a
 * callback the next morning — and short enough that a click a week ago is not
 * quietly credited for a decision it had nothing to do with.
 */
const ATTRIBUTION_WINDOW_MS = 24 * 60 * 60 * 1000

export interface AttributionIdentity {
  userId?: string | null
  guestToken?: string | null
  sessionId?: string | null
}

/**
 * Records a conversion against the news item this buyer most recently tapped.
 *
 * Returns the promotional id credited, or null when there is nothing to credit
 * — which is the common case and not a failure.
 *
 * Never throws. A callback is revenue; attribution is a number on a dashboard,
 * and the one must not be able to break the other.
 */
export async function attributeCallbackToPromotional(
  identity: AttributionIdentity,
  convertedProjectId?: string | null,
): Promise<string | null> {
  const { userId, guestToken, sessionId } = identity

  // Identity, in the order it is trustworthy. A guest token is an identity too
  // — CLAUDE.md is explicit about that — so an anonymous tap still attributes.
  const who: Array<Record<string, string>> = []
  if (userId) who.push({ user_id: userId })
  if (guestToken) who.push({ guest_token: guestToken })
  if (sessionId) who.push({ session_id: sessionId })

  if (who.length === 0) return null

  try {
    const click = await prisma.promotionalInteraction.findFirst({
      where: {
        interaction_type: 'click',
        created_at: { gte: new Date(Date.now() - ATTRIBUTION_WINDOW_MS) },
        OR: who,
      },
      orderBy: { created_at: 'desc' },
      select: { promotional_id: true },
    })
    if (!click) return null

    // One conversion per promotional per buyer per window. Without this, a
    // buyer who asks for callbacks on two projects after one tap would count
    // twice, and the number a builder is sold on would overstate itself.
    const already = await prisma.promotionalInteraction.findFirst({
      where: {
        promotional_id: click.promotional_id,
        interaction_type: 'conversion',
        created_at: { gte: new Date(Date.now() - ATTRIBUTION_WINDOW_MS) },
        OR: who,
      },
      select: { id: true },
    })
    if (already) return null

    await prisma.$transaction([
      prisma.promotionalInteraction.create({
        data: {
          promotional_id: click.promotional_id,
          interaction_type: 'conversion',
          user_id: userId ?? null,
          guest_token: guestToken ?? null,
          session_id: sessionId ?? null,
          converted_project_id: convertedProjectId ?? null,
        },
      }),
      prisma.promotional.update({
        where: { id: click.promotional_id },
        data: { conversions: { increment: 1 } },
      }),
    ])

    return click.promotional_id
  } catch (err) {
    console.error('[promotionalAttribution] failed (non-fatal):', err)
    return null
  }
}

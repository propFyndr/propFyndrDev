import type { ChatTopicHandler } from '../handlerContext'
import { getMemory, describeProfile, profileAsRequest } from '../../ai/memory'

/**
 * "What do you remember about me?" and "use my saved preferences".
 *
 * Saved preferences are never read into a conversation on their own: a new chat that
 * silently inherited last week's budget and sector was a bug, and the router's
 * comment on `UserMemory` records why. This handler is the explicit route back. The
 * buyer asks, we list exactly the stored fields, and the buyer chooses whether to
 * search with them. Nothing is applied until they send the chip.
 */

const ASKS_PROFILE =
  /\b(?:what\s+do\s+you\s+(?:remember|know)\s+about\s+me|my\s+saved\s+(?:preferences|profile|requirements)|use\s+my\s+saved|saved\s+preferences|continue\s+(?:from\s+)?(?:last\s+time|where\s+we\s+left)|what\s+did\s+i\s+tell\s+you\s+(?:last\s+time|before|earlier|yesterday))\b/i

export const matchesSavedProfileQuestion = (m: string) => ASKS_PROFILE.test(m)

export const savedProfileHandler: ChatTopicHandler = {
  id: 'saved_profile',
  description: 'Lists the stored buyer profile on request and offers to search with it',

  matches: ctx => matchesSavedProfileQuestion(ctx.message) && Boolean(ctx.userId || ctx.guestToken),

  handle: async ctx => {
    const mem = await getMemory(ctx.userId, ctx.guestToken)
    const lines = mem ? describeProfile(mem) : []
    const request = mem ? profileAsRequest(mem) : null

    const text = lines.length
      ? `### What I have saved for you\n\n${lines.map(l => `- ${l}`).join('\n')}\n\nThis comes from your earlier chats. I don't apply it to a new chat unless you ask. ${request ? 'Want me to search with it?' : 'Tell me what to search for.'}\n\nYou can edit or erase it any time under **AI Memory & Privacy**.`
      : 'I have nothing saved for you yet. Tell me your budget, the BHK you want and where you work, and I will use it for this chat.'

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'DISCOVERY',
      thinking: 'Reading only the fields you have saved:',
      chips: request ? [{ id: `chip_saved_profile_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Search with my saved preferences', icon: 'search', analyticsId: 'chip_saved_profile', priority: 1, payload: { text: request } }] : [],
      missingFields: [],
      confidence: 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'DISCOVERY', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}

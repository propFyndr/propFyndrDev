import type { ChatMessage, NearbyExpansion } from '@/types/property'
import type { ProjectCard as ProjectCardType } from '@/types/project'

/**
 * Turning a stored session back into a conversation.
 *
 * The restore path is mostly side effects — fetch, cache, scroll — but three
 * pure decisions sit inside it that decide whether a returning buyer sees their
 * conversation or a mangled version of it, and none of them were reachable
 * from a test.
 */

/** A stored message as the API returns it. */
export interface StoredMessage {
  id: string
  role: string
  content: string
  created_at: string
  artifacts?: StoredArtifact[]
}

export interface StoredArtifact {
  type?: string
  exactResults?: unknown
  nearbyResults?: unknown
  expansion?: unknown
  projects?: unknown
  left?: unknown
  right?: unknown
  chips?: unknown
  ui_state?: { chips?: unknown }
  /** type 'checked': the "What I checked" labels stored with the answer. */
  labels?: unknown
}

/**
 * Order a restored conversation.
 *
 * Timestamps decide it, but a question and its answer are frequently written
 * within the same millisecond, and a tie left to sort stability put the answer
 * above the question it answered. The buyer scrolls up and finds the
 * conversation talking to itself.
 */
export function sortRestoredMessages(messages: ChatMessage[]): ChatMessage[] {
  return [...messages].sort((a, b) => {
    const timeA = new Date(a.timestamp || 0).getTime()
    const timeB = new Date(b.timestamp || 0).getTime()
    if (timeA !== timeB) return timeA - timeB
    if (a.type === 'user' && b.type === 'ai') return -1
    if (a.type === 'ai' && b.type === 'user') return 1
    return 0
  })
}

/**
 * The last message that produced cards — the one whose shelf should be open.
 *
 * Restoring with every shelf collapsed makes a returning buyer hunt for the
 * shortlist they left; restoring with all of them open buries the answer.
 */
export function lastMessageWithResults(messages: ChatMessage[]): ChatMessage | undefined {
  return [...messages]
    .reverse()
    .find(m => (m.exactResults?.length ?? 0) > 0 || (m.nearbyResults?.length ?? 0) > 0)
}

/** Rebuild one message, folding its stored artifacts back onto it. */
export function restoreMessage(stored: StoredMessage): ChatMessage {
  const base: ChatMessage = {
    id: stored.id,
    type: stored.role === 'user' ? 'user' : 'ai',
    content: stored.content,
    timestamp: stored.created_at,
  } as ChatMessage

  for (const artifact of stored.artifacts ?? []) {
    if (artifact.type === 'property_results') {
      base.exactResults = artifact.exactResults as ProjectCardType[]
      base.nearbyResults = artifact.nearbyResults as ProjectCardType[]
      base.expansion = artifact.expansion as NearbyExpansion | null
      base.responseMode = 'search'
    }
    if (artifact.type === 'comparison') {
      base.showComparisonTable = true
      base.responseMode = 'comparison'
      // Four is the compare ceiling elsewhere in the UI; a stored comparison
      // with more would render columns the table cannot lay out.
      if (Array.isArray(artifact.projects) && artifact.projects.length >= 2) {
        base.comparisonProjects = (artifact.projects as ProjectCardType[]).slice(0, 4)
      } else if (artifact.left && artifact.right) {
        base.comparisonProjects = [artifact.left as ProjectCardType, artifact.right as ProjectCardType]
      }
    }
    if (artifact.type === 'checked' && Array.isArray(artifact.labels)) {
      const labels = artifact.labels.filter((l): l is string => typeof l === 'string').slice(0, 6)
      if (labels.length) base.checked = labels
    }
    if (artifact.type === 'ui_state' || artifact.chips) {
      base.chips = (artifact.chips ?? artifact.ui_state?.chips) as ChatMessage['chips']
    }
  }

  return base
}

/**
 * Put the session's trailing chips back on the last answer.
 *
 * Chips are stored on the session as well as on messages, and a session whose
 * final turn predates per-message chips would restore with no chips at all —
 * the conversation reads as finished when it was mid-flow. Only fills a gap:
 * chips already on the message win.
 */
export function attachTrailingChips(
  messages: ChatMessage[],
  sessionChips: unknown[] | undefined,
): ChatMessage[] {
  if (!Array.isArray(sessionChips) || sessionChips.length === 0) return messages

  const lastAiIndex = messages.map(m => m.type).lastIndexOf('ai')
  if (lastAiIndex === -1) return messages

  const target = messages[lastAiIndex]
  if (target.chips && (target.chips as unknown[]).length > 0) return messages

  const next = [...messages]
  next[lastAiIndex] = { ...target, chips: sessionChips as ChatMessage['chips'] }
  return next
}

import type { SSEEvent } from '@/lib/backend-api'
import type { ChatMessage } from '@/types/property'
import type { ProjectCard as ProjectCardType } from '@/types/project'

/**
 * How a streamed event changes the message being streamed.
 *
 * This was two hundred lines inside a `useCallback` inside a 2,089-line
 * component: seven `setChatHistory(prev => prev.map(...))` calls, each
 * reshaping the same message, none of them reachable from a test. The shaping
 * is pure — an event and a message in, a message out — so it does not need to
 * live next to the state that holds it.
 *
 * Side effects deliberately stay with the caller. Scrolling to a card, firing
 * analytics, PATCHing a session title and setting the rate-limit banner are not
 * message shape, and folding them in here would trade one untestable lump for
 * another. What is left is the part that was silently wrong most often.
 */

/** Context the shaping needs that the event alone does not carry. */
export interface StreamContext {
  /** Chips already known for this turn, used when `done` carries none. */
  fallbackChips?: unknown[]
  /** Projects seen on this turn, used to infer a response mode for old sessions. */
  projects?: ProjectCardType[]
}

/** `done` carries fields the SSE union does not yet name. */
interface DoneExtras {
  responseMode?: 'search' | 'comparison' | 'chat' | 'database'
  comparisonProjects?: unknown[]
  chatResponse?: { chips?: unknown[] } & Record<string, unknown>
  chips?: unknown[]
}

/**
 * A search is only "searching" once the backend says one will happen.
 *
 * COLD, GATHERING and ADVISORY all keep the UI in `extracting` until tokens
 * arrive — showing a property spinner for a turn that will never return a
 * property reads as a hang.
 */
export function isSearchState(intentState: string): boolean {
  return intentState === 'READY_TO_SEARCH' || intentState === 'SHORTLISTED'
}

/**
 * The shortlist to show: exact matches when we have them, nearby otherwise.
 * Never both — a buyer reading one list does not know the second exists.
 */
export function pickShortlist(
  exact: ProjectCardType[],
  nearby: ProjectCardType[],
): ProjectCardType[] {
  return exact.length > 0 ? exact : nearby
}

/** Stable identity for a shortlist, so an unchanged one does not re-expand the shelf. */
export function shortlistKey(projects: ProjectCardType[] | null | undefined): string {
  return (projects ?? [])
    .map(p => String(p.id || p.slug))
    .sort()
    .join(',')
}

/**
 * A title a buyer would recognise their own search by.
 *
 * "3 BHK · Sector 150 · ₹1.8Cr" beats the first thirty-five characters of
 * whatever they typed, but only when at least two facts are known — one fact
 * alone ("Noida") names nothing.
 */
export function buildSmartTitle(text: string, intent: Record<string, unknown> | null): string {
  const truncated = text.length > 35 ? text.slice(0, 35) + '...' : text
  if (!intent) return truncated

  const parts: string[] = []
  if (Array.isArray(intent.bhk) && intent.bhk.length > 0) parts.push(intent.bhk.join('/') + ' BHK')
  if (typeof intent.sector === 'string' && intent.sector) parts.push(intent.sector)
  if (typeof intent.budgetMax === 'number') {
    const cr = intent.budgetMax
    parts.push(`₹${cr < 1 ? Math.round(cr * 100) + 'L' : cr.toFixed(1) + 'Cr'}`)
  }
  if (typeof intent.builderName === 'string' && intent.builderName) parts.push(intent.builderName)

  return parts.length >= 2 ? parts.join(' · ') : truncated
}

/**
 * Apply an event to the streaming message.
 *
 * Returns the message unchanged for events that carry no shape (`focus` is a
 * scroll instruction; a rate-limit `error` removes the message entirely, which
 * is the caller's job because it is a deletion, not an edit).
 */
export function applyStreamEvent(
  message: ChatMessage,
  event: SSEEvent,
  ctx: StreamContext = {},
): ChatMessage {
  switch (event.type) {
    case 'intent':
      return {
        ...message,
        // The clock starts at the first event of the turn and is read once at
        // `done`. The duration shown to the buyer used to be the literal 8,
        // whatever the turn cost.
        streamingStartedAt: message.streamingStartedAt ?? Date.now(),
        streamingPhase: isSearchState(event.intentState) ? 'searching' : 'extracting',
        streamingIntent: event.intent,
        streamingIntentState: event.intentState,
      }

    case 'properties': {
      const exact = (event.exactResults ?? []) as unknown as ProjectCardType[]
      const nearby = (event.nearbyResults ?? []) as unknown as ProjectCardType[]
      const shortlist = pickShortlist(exact, nearby)
      return {
        ...message,
        isSearching: false,
        exactResults: exact,
        nearbyResults: nearby,
        expansion: event.expansion,
        properties: shortlist,
        streamingPhase: 'generating',
        streamingResultCount: shortlist.length,
      }
    }

    case 'token':
      return { ...message, content: message.content + event.token, isSearching: false }

    case 'components':
      return {
        ...message,
        responseMode: 'components' as const,
        componentResponse: event.response,
        isSearching: false,
      }

    case 'ui_state':
      return Array.isArray(event.chips) && event.chips.length > 0
        ? { ...message, chips: event.chips }
        : message

    case 'error':
      return {
        ...message,
        content: event.message || 'Something went wrong. Please try again.',
        isSearching: false,
      }

    case 'done': {
      const extras = event as unknown as DoneExtras
      // The backend owns responseMode. The fallback is only for sessions that
      // predate it — inferring it here for a live turn re-introduces the guess.
      const responseMode: 'search' | 'comparison' | 'chat' | 'database' =
        extras.responseMode ?? ((ctx.projects?.length ?? 0) > 0 ? 'search' : 'chat')
      const comparisonProjects = extras.comparisonProjects ?? []
      const isComparison = responseMode === 'comparison' && comparisonProjects.length >= 2

      return {
        ...message,
        isSearching: false,
        responseMode,
        showComparisonTable: isComparison,
        ...(isComparison ? { comparisonProjects } : {}),
        ...(responseMode === 'database' && extras.chatResponse
          ? { chatResponse: extras.chatResponse, chips: extras.chatResponse.chips ?? message.chips }
          : {}),
        chips: message.chips || extras.chips || ctx.fallbackChips || [],
        streamingPhase: null,
        streamingIntent: null,
        streamingResultCount: null,
        // Fixed here so it stops counting, and stays absent when the turn
        // produced no `intent` event to start the clock.
        streamingElapsedSeconds:
          message.streamingStartedAt != null
            ? Math.round((Date.now() - message.streamingStartedAt) / 1000)
            : null,
      } as ChatMessage
    }

    default:
      return message
  }
}

/**
 * A stream that closed with nothing to show still has to say something.
 *
 * An empty bubble reads as a failure the buyer cannot act on; this only fires
 * when there is genuinely no content, no component payload and no properties.
 */
export function emptyStreamFallback(message: ChatMessage): ChatMessage {
  const isEmpty =
    !message.content &&
    !message.componentResponse &&
    (!message.properties || message.properties.length === 0)
  return isEmpty
    ? {
      ...message,
      content: "I've fetched the requested information for you. Please check the overview panel above.",
    }
    : message
}

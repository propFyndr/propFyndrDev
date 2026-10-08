// Lazy PostHog loader.
//
// posthog-js is ~219 KB of raw JS. It used to be imported at module scope by
// lib/analytics.ts (which almost every interactive component pulls in) and by
// PostHogProvider in the root layout, so every route paid for it before first
// paint. Analytics must never block the first paint of a property page.
//
// Events fired before the library lands are buffered and replayed in order, so
// callers cannot lose an event by being early.

type PostHog = typeof import('posthog-js').default

type QueuedCall =
  | { kind: 'capture'; event: string; properties?: Record<string, unknown> }
  | { kind: 'identify'; userId: string; traits?: Record<string, unknown> }
  | { kind: 'reset' }

let client: PostHog | null = null
let loading: Promise<void> | null = null
const queue: QueuedCall[] = []

// Bounded so a misconfigured deploy (no key, or a blocked CDN) cannot grow an
// unbounded array over a long session.
const MAX_QUEUE = 100

function flush() {
  if (!client) return
  for (const call of queue.splice(0, queue.length)) {
    if (call.kind === 'capture') client.capture(call.event, call.properties)
    else if (call.kind === 'identify') client.identify(call.userId, call.traits)
    else client.reset()
  }
}

function load(): Promise<void> | null {
  if (client || loading) return loading
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return null
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY || (process.env.NODE_ENV === 'production' ? 'phc_CxNVfVHUhdM7q8cQjUaRWcGBPHsY9JVfYdsZvUqJsbjV' : '')
  if (!key) return null

  loading = import('posthog-js')
    .then(({ default: posthog }) => {
      const apiHost = typeof window !== 'undefined'
        ? `${window.location.origin}/ingest`
        : (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com')

      posthog.init(key, {
        api_host: apiHost,
        ui_host: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST ?? 'https://us.posthog.com',
        // Guests are not billed as person profiles; their events still carry
        // a distinct id, so funnels and replays work. identify() on sign-in
        // creates the profile.
        person_profiles: 'identified_only',
        // PostHogProvider captures every $pageview (first load included) from
        // the router; letting posthog-js capture the first one too counted it
        // twice. `capture_pageleave` must stay `true`, not the default
        // 'if_capture_pageview', or the tab-close $pageleave stops.
        capture_pageview: false,
        capture_pageleave: true,
        // Clicks and form submits on real controls only. Every other DOM event
        // was noise on top of the named events in lib/analytics.ts.
        autocapture: {
          dom_event_allowlist: ['click', 'submit'],
          element_allowlist: ['a', 'button', 'form'],
        },
        /**
         * Disable feature flags to avoid unused network roundtrips, but keep
         * decide active so Session Replay receives its remote configuration
         * and records sessions across any active domain.
         */
        advanced_disable_flags: true,
        disable_surveys: true,
        disable_session_recording: false,
        /**
         * Inputs are masked in replay.
         *
         * Replay is for seeing where people get stuck without recording what they typed.
         * Text stays unmasked so replay still shows screens and cards; the
         * buyer's sent chat messages carry `ph-mask`, and /admin and the
         * builder/partner portals carry `ph-no-capture`.
         */
        session_recording: {
          maskAllInputs: true,
          maskInputOptions: {
            password: true,
            email: true,
            tel: true,
            text: true,
            textarea: true,
          },
        },
        loaded: () => {},
      })
      client = posthog
      flush()
    })
    .catch(() => {
      // Blocked by an ad blocker or offline — drop the buffer and stop retrying.
      queue.length = 0
    })

  return loading
}

/** Kick off the download without sending anything. Call from an idle callback. */
export function preloadPostHog() {
  load()
}

export function capture(event: string, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return
  if (client) {
    client.capture(event, properties)
    return
  }
  if (queue.length < MAX_QUEUE) queue.push({ kind: 'capture', event, properties })
  load()
}

/** Forget the signed-in person, so whoever uses this browser next is not them. */
export function reset() {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return
  if (client) {
    client.reset()
    return
  }
  if (queue.length < MAX_QUEUE) queue.push({ kind: 'reset' })
  load()
}

export function identify(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return
  if (client) {
    client.identify(userId, traits)
    return
  }
  if (queue.length < MAX_QUEUE) queue.push({ kind: 'identify', userId, traits })
  load()
}

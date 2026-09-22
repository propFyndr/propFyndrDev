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
    else client.identify(call.userId, call.traits)
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
        ui_host: 'https://us.posthog.com',
        person_profiles: 'always',
        capture_pageview: true,
        capture_pageleave: true,
        autocapture: true,
        /**
         * We use PostHog for analytics only — no flags, no experiments, no
         * remote config.
         *
         * `advanced_disable_feature_flags*` and the cast-in
         * `disable_remote_config` that used to sit here are not options in
         * posthog-js 1.430: the first pair is an older API and the second never
         * existed, which is why it needed `as any` to compile. None of the
         * three did anything, and the remote-config fetch they were meant to
         * stop ran on every page load and 404'd twice in the console:
         *
         *   [PostHog.js] Bad HTTP status: 404
         *   [RemoteConfig] Failed to fetch remote config from PostHog.
         *
         * `advanced_disable_decide` is the real option and is typed, so a
         * future rename fails the build instead of going quiet again.
         */
        advanced_disable_decide: true,
        advanced_disable_flags: true,
        disable_surveys: true,
        disable_session_recording: false,
        /**
         * Inputs are masked in replay.
         *
         * This was `maskAllInputs: false`, which meant session replay captured
         * buyers typing into the chat box keystroke by keystroke — budgets,
         * phone numbers, family circumstances, whatever they wrote before
         * deciding not to send it. Replay is for seeing where people get stuck,
         * and it does that without recording what they typed.
         *
         * `text` stays unmasked so the replay still shows which screen and
         * which cards the buyer was looking at; only what they ENTER is hidden.
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

export function identify(userId: string, traits?: Record<string, unknown>) {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') return
  if (client) {
    client.identify(userId, traits)
    return
  }
  if (queue.length < MAX_QUEUE) queue.push({ kind: 'identify', userId, traits })
  load()
}

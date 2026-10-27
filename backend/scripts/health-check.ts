/**
 * Live health check for every configured key and service.
 *
 * Actually calls each provider rather than checking that a string is non-empty.
 * A key that is set but revoked, rate-limited, or pointing at the wrong region
 * looks identical to a working one until a buyer hits it — and because every
 * integration here fails soft by design, a broken key produces a degraded answer
 * rather than an error anyone sees.
 *
 *   cd backend && npm run health
 *
 * Exit code is 1 if any REQUIRED check fails, 0 otherwise. Optional services
 * that are simply not configured are reported, not failed.
 */

import 'dotenv/config'
import { FALLBACK_CHAIN } from '../src/lib/config'

type Status = 'ok' | 'fail' | 'unset' | 'skip'

interface Result {
  group: string
  name: string
  status: Status
  detail: string
  required: boolean
  ms?: number
}

const results: Result[] = []
const RUN_ID = `health-${Date.now()}`

async function timed<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> {
  const started = Date.now()
  try {
    return { value: await fn(), ms: Date.now() - started }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), ms: Date.now() - started }
  }
}

function record(r: Result) {
  results.push(r)
  const icon = r.status === 'ok' ? ' ok ' : r.status === 'fail' ? 'FAIL' : r.status === 'unset' ? ' -- ' : 'skip'
  const ms = r.ms != null ? `${String(r.ms).padStart(5)}ms` : '       '
  console.log(`  [${icon}] ${r.name.padEnd(30)} ${ms}  ${r.detail}`)
}

function group(title: string) {
  console.log(`\n${title}`)
  console.log('─'.repeat(78))
}

// ─── Database ────────────────────────────────────────────────────────────────

async function checkDatabase() {
  group('Database')

  if (!process.env.DATABASE_URL) {
    record({ group: 'db', name: 'DATABASE_URL', status: 'unset', detail: 'required — the app will not start', required: true })
    return
  }

  const { prisma } = await import('../src/lib/db')

  const ping = await timed(() => prisma.$queryRaw`SELECT 1`)
  record({
    group: 'db', name: 'Postgres (pooled)', required: true, ms: ping.ms,
    status: ping.error ? 'fail' : 'ok',
    detail: ping.error ?? 'reachable',
  })

  if (ping.error) return

  const counts = await timed(async () => ({
    projects: await prisma.project.count(),
    builders: await prisma.builder.count(),
    units: await prisma.unitType.count(),
    amenities: await prisma.amenity.count(),
    costSheets: await prisma.costSheet.count(),
    paymentPlans: await prisma.paymentPlan.count(),
  }))

  if (counts.value) {
    const c = counts.value
    record({
      group: 'db', name: 'Inventory', required: true, ms: counts.ms,
      status: c.projects > 0 ? 'ok' : 'fail',
      detail: c.projects > 0
        ? `${c.projects} projects · ${c.builders} builders · ${c.units} unit types`
        : 'no projects — the chat has nothing to answer from',
    })

    // Coverage matters as much as connectivity: an empty cost_sheet table means
    // every cost question falls through to "not in our records".
    const pct = (n: number) => `${Math.round((n / Math.max(c.projects, 1)) * 100)}%`
    record({
      group: 'db', name: 'Cost sheet coverage', required: false,
      status: c.costSheets > 0 ? 'ok' : 'fail',
      detail: `${c.costSheets}/${c.projects} projects (${pct(c.costSheets)})`,
    })
    record({
      group: 'db', name: 'Payment plan coverage', required: false,
      status: c.paymentPlans > 0 ? 'ok' : 'fail',
      detail: `${c.paymentPlans} plans across ${c.projects} projects`,
    })
    record({
      group: 'db', name: 'Amenity coverage', required: false,
      status: c.amenities > 0 ? 'ok' : 'fail',
      detail: `${c.amenities} rows`,
    })
  } else {
    record({ group: 'db', name: 'Inventory', status: 'fail', detail: counts.error ?? 'unknown', required: true, ms: counts.ms })
  }

  await prisma.$disconnect()
}

// ─── AI providers ────────────────────────────────────────────────────────────

/** One tiny completion per configured provider. Cheapest possible real call. */
async function pingProvider(item: (typeof FALLBACK_CHAIN)[number]): Promise<{ ok: boolean; detail: string; ms: number }> {
  const key = process.env[item.envKey]
  if (!key) return { ok: false, detail: 'not set', ms: 0 }

  const started = Date.now()
  try {
    if (item.provider === 'gemini') {
      const { GoogleGenAI } = await import('@google/genai')
      const client = new GoogleGenAI({ apiKey: key })
      const res = await client.models.generateContent({
        model: item.model,
        contents: [{ role: 'user', parts: [{ text: 'Reply with the single word: ok' }] }],
        config: { maxOutputTokens: 256 },
      })
      const text = (res.text ?? '').trim()
      return { ok: !!text, detail: text ? `responded "${text.slice(0, 20)}"` : 'empty response', ms: Date.now() - started }
    }

    // Everything else speaks the OpenAI chat-completions shape.
    // A leg's own baseUrl first, as fallbackChain.ts uses it: Cohere, NVIDIA and Cloudflare are
    // `provider: 'openai'` legs with a baseUrl, and probing api.openai.com with their keys
    // reported every one of them as a bad key (27 Oct 2026).
    const baseUrl =
      item.baseUrl ? item.baseUrl
      : item.provider === 'groq' ? 'https://api.groq.com/openai/v1'
      : item.provider === 'mistral' ? 'https://api.mistral.ai/v1'
      : item.provider === 'cerebras' ? 'https://api.cerebras.ai/v1'
      : process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: item.model,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        // Reasoning models (gpt-oss on Groq and Cerebras) spend their budget on
        // reasoning tokens before emitting any content, so a tight cap comes back
        // as an empty string and reads as a dead provider. It is not.
        max_tokens: 256,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, detail: `HTTP ${res.status} — ${body.slice(0, 90)}`, ms: Date.now() - started }
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const text = json.choices?.[0]?.message?.content?.trim() ?? ''
    return { ok: !!text, detail: text ? `responded "${text.slice(0, 20)}"` : 'empty response', ms: Date.now() - started }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message.slice(0, 90) : String(err), ms: Date.now() - started }
  }
}

async function checkProviders() {
  group('AI providers — FALLBACK_CHAIN order')

  // Distinct keys only: the chain lists GEMINI_API_KEY twice (main + lite model)
  // and there is no point paying for the same key twice.
  const seen = new Set<string>()
  let anyWorking = false

  for (const item of FALLBACK_CHAIN) {
    const dedupeKey = `${item.envKey}:${item.model}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    if (!process.env[item.envKey]) {
      record({ group: 'ai', name: item.label, status: 'unset', detail: `${item.envKey} not set`, required: false })
      continue
    }

    const r = await pingProvider(item)
    if (r.ok) anyWorking = true
    record({
      group: 'ai', name: item.label, required: false, ms: r.ms,
      status: r.ok ? 'ok' : 'fail',
      detail: r.ok ? r.detail : `${r.detail}  [${item.envKey}]`,
    })
  }

  record({
    group: 'ai', name: 'At least one provider', required: true,
    status: anyWorking ? 'ok' : 'fail',
    detail: anyWorking ? 'chat can answer' : 'every provider failed — chat is down',
  })
}

// ─── Supporting services ─────────────────────────────────────────────────────

async function checkRedis() {
  group('Cache & search')
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    record({ group: 'svc', name: 'Upstash Redis', status: 'unset', detail: 'rate limiting falls back to in-memory', required: false })
    return
  }
  const r = await timed(async () => {
    const res = await fetch(`${url}/set/${RUN_ID}/ok?EX=60`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return true
  })
  record({
    group: 'svc', name: 'Upstash Redis', required: false, ms: r.ms,
    status: r.error ? 'fail' : 'ok',
    detail: r.error ?? 'read/write ok',
  })
}

async function checkTavily() {
  const key = process.env.TAVILY_API_KEY
  if (!key) {
    record({ group: 'svc', name: 'Tavily (web search)', status: 'unset', detail: 'unknown-project lookups degrade to a refusal', required: false })
    return
  }
  const r = await timed(async () => {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'Noida real estate', max_results: 1 }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 80)}`)
    return true
  })
  record({
    group: 'svc', name: 'Tavily (web search)', required: false, ms: r.ms,
    status: r.error ? 'fail' : 'ok',
    detail: r.error ?? 'search ok',
  })
}

async function checkMaps() {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    record({ group: 'svc', name: 'Google Maps', status: 'unset', detail: 'commute/geocoding unavailable', required: false })
    return
  }
  const r = await timed(async () => {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=Sector+150+Noida&key=${key}`,
      { signal: AbortSignal.timeout(10_000) },
    )
    const json = (await res.json()) as { status?: string; error_message?: string }
    if (json.status !== 'OK') throw new Error(`${json.status} — ${json.error_message ?? 'no detail'}`)
    return true
  })
  record({
    group: 'svc', name: 'Google Maps', required: false, ms: r.ms,
    status: r.error ? 'fail' : 'ok',
    detail: r.error ?? 'geocoding ok',
  })
}

async function checkSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    record({ group: 'svc', name: 'Supabase auth', status: 'unset', detail: 'required — sign-in and saved properties break', required: true })
    return
  }
  const r = await timed(async () => {
    const res = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return true
  })
  record({
    group: 'svc', name: 'Supabase auth', required: true, ms: r.ms,
    status: r.error ? 'fail' : 'ok',
    detail: r.error ?? 'reachable',
  })
}

async function checkObservability() {
  group('Observability')

  const phKey = process.env.POSTHOG_API_KEY
  if (!phKey) {
    record({ group: 'obs', name: 'PostHog (server)', status: 'unset', detail: 'no server-side event is recorded', required: false })
  } else {
    const { PostHog } = await import('posthog-node')
    const host = process.env.POSTHOG_HOST || 'https://us.posthog.com'
    const r = await timed(async () => {
      const client = new PostHog(phKey, { host, flushAt: 1, flushInterval: 0 })
      client.capture({ distinctId: RUN_ID, event: 'health_check', properties: { run_id: RUN_ID } })
      await client.shutdown()
      return true
    })
    record({
      group: 'obs', name: 'PostHog (server)', required: false, ms: r.ms,
      status: r.error ? 'fail' : 'ok',
      detail: r.error ?? `event sent as ${RUN_ID}`,
    })
  }

  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    record({ group: 'obs', name: 'Sentry (server)', status: 'unset', detail: 'no error is reported', required: false })
  } else {
    const Sentry = await import('@sentry/node')
    const r = await timed(async () => {
      Sentry.init({ dsn, environment: process.env.NODE_ENV ?? 'development', tracesSampleRate: 0 })
      Sentry.captureMessage(`health check ${RUN_ID}`, 'info')
      await Sentry.flush(5000)
      return true
    })
    record({
      group: 'obs', name: 'Sentry (server)', required: false, ms: r.ms,
      status: r.error ? 'fail' : 'ok',
      detail: r.error ?? 'event accepted',
    })
  }

  // Browser keys live in the frontend env and are inlined at build time. We can
  // only report presence from here, and a Vercel redeploy is required after they
  // change — a very common reason for an empty dashboard.
  for (const [name, key, note] of [
    ['PostHog (browser)', 'NEXT_PUBLIC_POSTHOG_KEY', 'pageviews and every track() call'],
    ['Sentry (browser)', 'NEXT_PUBLIC_SENTRY_DSN', 'client-side errors'],
  ] as const) {
    record({
      group: 'obs', name, required: false,
      status: process.env[key] ? 'ok' : 'unset',
      detail: process.env[key]
        ? 'set here — confirm it is set in Vercel and redeployed'
        : `${key} not set in this env — ${note} are dropped`,
    })
  }
}

async function checkAdmin() {
  group('Admin & secrets')
  for (const [key, why, required] of [
    ['ADMIN_PASSWORD', 'admin panel login', true],
    ['ADMIN_SECRET', 'admin session cookie signing', true],
    ['WEBHOOK_SECRET', 'lead webhook verification', false],
  ] as const) {
    const value = process.env[key]
    let detail = value ? 'set' : `not set — ${why} unavailable`
    let status: Status = value ? 'ok' : 'unset'
    // A short secret is worse than an absent one: it looks configured.
    if (value && key !== 'ADMIN_PASSWORD' && value.length < 24) {
      status = 'fail'
      detail = `set but only ${value.length} chars — too short to sign with`
    }
    if (value && key === 'ADMIN_PASSWORD' && value.length < 12) {
      status = 'fail'
      detail = `set but only ${value.length} chars — brute-forceable`
    }
    record({ group: 'admin', name: key, status, detail, required })
  }
}

// ─── Report ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nPropFyndr health check — ${new Date().toISOString()}`)
  console.log(`run id ${RUN_ID}`)

  await checkDatabase()
  await checkProviders()
  await checkRedis()
  await checkTavily()
  await checkMaps()
  await checkSupabase()
  await checkObservability()
  await checkAdmin()

  const failed = results.filter(r => r.status === 'fail')
  const unset = results.filter(r => r.status === 'unset')
  const blocking = failed.filter(r => r.required)

  console.log(`\n${'═'.repeat(78)}`)
  console.log(`${results.filter(r => r.status === 'ok').length} ok · ${failed.length} failing · ${unset.length} not configured`)

  if (failed.length) {
    console.log('\nFailing:')
    for (const f of failed) console.log(`  ${f.required ? '[BLOCKING] ' : '           '}${f.name}: ${f.detail}`)
  }
  if (unset.length) {
    console.log('\nNot configured:')
    for (const u of unset) console.log(`  ${u.name}: ${u.detail}`)
  }
  console.log('')

  process.exit(blocking.length > 0 ? 1 : 0)
}

void main()

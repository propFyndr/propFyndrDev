// backend/scripts/verify-services.ts
//
//   npx tsx scripts/verify-services.ts
//
// Every external service this product depends on, proved with one tiny call.
//
// verify-chain.ts covers the LLM legs. This covers everything else — search,
// maps, cache, analytics, error reporting — because a missing key there fails
// quietly: the code is written to no-op when a service is unconfigured, which
// is right for production and means a misconfigured deploy looks healthy.
//
// Prints no secret values.

import 'dotenv/config'
import '../src/lib/config'

interface Row { name: string; status: 'ok' | 'fail' | 'unset'; ms?: number; detail?: string }
const rows: Row[] = []

async function check(name: string, envKeys: string[], fn: () => Promise<string>): Promise<void> {
  const missing = envKeys.filter((k) => !process.env[k])
  if (missing.length) {
    rows.push({ name, status: 'unset', detail: `not configured: ${missing.join(', ')}` })
    return
  }
  const t0 = Date.now()
  try {
    // `await fn()` on its own line, not inline in the object literal: property
    // values evaluate in source order, so `ms: Date.now() - t0` was computed
    // BEFORE the call it was meant to time. Every success reported 0ms.
    const detail = await fn()
    rows.push({ name, status: 'ok', ms: Date.now() - t0, detail })
  } catch (e) {
    rows.push({ name, status: 'fail', ms: Date.now() - t0, detail: e instanceof Error ? e.message.slice(0, 110) : String(e) })
  }
}

const t = (ms: number) => AbortSignal.timeout(ms)
const must = async (r: Response): Promise<Response> => {
  if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 90).replace(/\s+/g, ' ')}`)
  return r
}

async function main() {
  await check('Cloudflare Workers AI', ['CLOUDFLARE_API_KEY', 'CLOUDFLARE_ACCOUNT_ID'], async () => {
    const r = await must(await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ model: '@cf/meta/llama-4-scout-17b-16e-instruct', messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 }),
        signal: t(30_000),
      },
    ))
    const j = await r.json() as { choices?: Array<{ message?: { content?: string } }> }
    return `llama-4-scout replied ${JSON.stringify(j.choices?.[0]?.message?.content ?? '').slice(0, 24)}`
  })

  await check('Tavily (web search)', ['TAVILY_API_KEY'], async () => {
    const r = await must(await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.TAVILY_API_KEY, query: 'Noida sector 150 property', max_results: 1 }),
      signal: t(30_000),
    }))
    const j = await r.json() as { results?: unknown[] }
    return `${j.results?.length ?? 0} result(s)`
  })

  await check('Google Maps', ['GOOGLE_MAPS_API_KEY'], async () => {
    const r = await must(await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=Sector+150+Noida&key=${process.env.GOOGLE_MAPS_API_KEY}`,
      { signal: t(20_000) },
    ))
    const j = await r.json() as { status?: string; error_message?: string }
    if (j.status !== 'OK') throw new Error(`${j.status}: ${j.error_message ?? ''}`)
    return 'geocode OK'
  })

  await check('Google Places', ['GOOGLE_PLACES_API_KEY'], async () => {
    const r = await must(await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=Noida&inputtype=textquery&key=${process.env.GOOGLE_PLACES_API_KEY}`,
      { signal: t(20_000) },
    ))
    const j = await r.json() as { status?: string; error_message?: string }
    if (j.status !== 'OK' && j.status !== 'ZERO_RESULTS') throw new Error(`${j.status}: ${j.error_message ?? ''}`)
    return `status ${j.status}`
  })

  await check('Upstash Redis', ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'], async () => {
    const r = await must(await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/ping`, {
      headers: { authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
      signal: t(15_000),
    }))
    const j = await r.json() as { result?: string }
    return `PING -> ${j.result}`
  })

  await check('Database (Prisma)', ['DATABASE_URL'], async () => {
    const { PrismaClient } = await import('@prisma/client')
    const p = new PrismaClient()
    try {
      const n = await p.project.count()
      return `${n} projects`
    } finally { await p.$disconnect() }
  })

  await check('PostHog (event capture)', ['POSTHOG_API_KEY'], async () => {
    // `/batch/` — the endpoint posthog-node actually posts events to, and
    // therefore the only one whose health says anything about our analytics.
    //
    // This probe first used `/decide?v=3`, got a 401, and I reported that
    // analytics was dead. It was not: `/decide` serves feature flags and
    // surveys and authenticates differently, so a project key that ingests
    // events perfectly well is rejected there. Probing the wrong endpoint
    // produced a confident wrong diagnosis — check the thing you are claiming
    // is broken, not a neighbour of it.
    const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com'
    const r = await must(await fetch(`${host}/batch/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.POSTHOG_API_KEY,
        batch: [{ event: 'propfyndr_service_check', distinct_id: 'verify-services', properties: { automated: true } }],
      }),
      signal: t(15_000),
    }))
    const j = await r.json().catch(() => ({})) as { status?: string }
    return `ingest OK (${j.status ?? r.status})`
  })

  await check('PostHog (feature flags)', ['POSTHOG_API_KEY'], async () => {
    // Separate row because it fails independently and means something else:
    // flags and surveys are unavailable, events are unaffected. This is the
    // 401 the browser console shows.
    const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com'
    const r = await fetch(`${host}/decide?v=3`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: process.env.POSTHOG_API_KEY, distinct_id: 'verify-services' }),
      signal: t(15_000),
    })
    if (r.status === 401) throw new Error('401 — flags/surveys unavailable; EVENT CAPTURE IS UNAFFECTED')
    return `flags OK (${r.status})`
  })

  await check('Sentry (error reporting)', ['SENTRY_DSN'], async () => {
    // A DSN is a URL that encodes the public key and the project id:
    //   https://<publicKey>@<host>/<projectId>
    // Parse it, then post a real (tagged) event to the store endpoint it names.
    // Nothing else verifies this — a malformed DSN makes the SDK no-op in
    // silence, which is the correct production behaviour and means a broken
    // deploy reports no errors and looks healthy.
    const dsn = process.env.SENTRY_DSN as string
    const m = /^https:\/\/([0-9a-f]+)@([^/]+)\/(\d+)$/i.exec(dsn.trim())
    if (!m) throw new Error('DSN is not in the form https://<key>@<host>/<projectId>')
    const [, publicKey, host, projectId] = m
    const r = await fetch(`https://${host}/api/${projectId}/store/`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=propfyndr-verify/1.0`,
      },
      body: JSON.stringify({
        message: 'propfyndr verify-services connectivity check',
        level: 'info',
        tags: { automated: 'true', source: 'verify-services' },
        platform: 'node',
      }),
      signal: t(15_000),
    })
    if (r.status === 401 || r.status === 403) throw new Error(`${r.status} — DSN key rejected`)
    if (r.status === 429) return 'reachable (429 rate-limited, key valid)'
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 80)}`)
    return `accepted (project ${projectId})`
  })

  await check('Lead webhook', ['WEBHOOK_URL'], async () => {
    // Deliberately a HEAD/OPTIONS-style reachability probe, NOT a POST: this
    // endpoint creates leads for the sales team, and a verification script must
    // never manufacture one.
    const url = process.env.WEBHOOK_URL as string
    if (!/^https?:\/\//.test(url)) throw new Error('not a URL')
    const r = await fetch(url, { method: 'OPTIONS', signal: t(12_000) })
    return `reachable (${r.status}) — not posted to, by design`
  })

  const pad = (s: string, n: number) => s.padEnd(n)
  console.log(`\n═══ external services — ${rows.length} checked ═══\n`)
  for (const r of rows) {
    const mark = r.status === 'ok' ? '✓' : r.status === 'unset' ? '·' : '✗'
    console.log(`  ${mark} ${pad(r.name, 24)} ${r.ms !== undefined ? String(r.ms).padStart(6) + 'ms' : '      '}  ${r.detail ?? ''}`)
  }
  const failed = rows.filter((r) => r.status === 'fail')
  console.log(`\n  ok ${rows.filter((r) => r.status === 'ok').length}   failed ${failed.length}   unconfigured ${rows.filter((r) => r.status === 'unset').length}\n`)

  await auditEnvCoverage()

  process.exit(failed.length ? 1 : 0)
}

/**
 * Every credential in `.env`, and whether anything actually proves it works.
 *
 * The failure this catches is the quiet one: a key that is present, read by
 * nothing, and therefore never exercised — or worse, read by something that
 * fails softly. `verify-chain` covers the LLM legs and the checks above cover
 * the rest, so anything in neither list is a credential nobody is watching.
 *
 * Also reports the reverse: a variable in `.env` that no source file mentions.
 * Those are the ones that quietly rot into a wrong value nobody notices,
 * because nothing ever asks them a question.
 */
async function auditEnvCoverage(): Promise<void> {
  const { readFileSync, readdirSync, statSync } = await import('node:fs')
  const { join } = await import('node:path')

  const envNames = (readFileSync(join(__dirname, '..', '.env'), 'utf8')
    .match(/^[A-Z_0-9]+(?==)/gm) ?? [])

  // Verified here, by name.
  const verifiedHere = new Set([
    'CLOUDFLARE_API_KEY', 'CLOUDFLARE_ACCOUNT_ID', 'TAVILY_API_KEY', 'GOOGLE_MAPS_API_KEY',
    'GOOGLE_PLACES_API_KEY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
    'DATABASE_URL', 'POSTHOG_API_KEY',
    'POSTHOG_HOST', 'SENTRY_DSN', 'WEBHOOK_URL',
  ])
  // Verified by `npm run verify:chain`, one live call per leg.
  const { FALLBACK_CHAIN } = await import('../src/lib/config')
  const verifiedByChain = new Set(FALLBACK_CHAIN.map((l) => l.envKey))
  // Local secrets and switches with no remote service to call.
  const noRemoteService = new Set([
    'PORT', 'FRONTEND_URL', 'DIRECT_URL', 'ADMIN_PASSWORD', 'ADMIN_SECRET', 'ADMIN_USER_IDS',
    'WEBHOOK_SECRET', 'ENABLE_GEMINI_TOOLS', 'GEMINI_DAILY_BUDGET_USD',
  ])

  // Which vars the source actually reads.
  //
  // Literal `process.env.NAME` is only half of it. The fallback chain reads its
  // keys as `process.env[item.envKey]`, so a first version of this audit
  // reported GEMINI_API_KEY1/2, MISTRAL_API_KEY1 and GROQ_API_KEY1/2/3 as dead
  // weight while they were carrying most of the product's traffic. A detector
  // that reports live keys as dead is worse than no detector — it invites
  // someone to delete them.
  const read = new Set<string>(verifiedByChain)
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory()) { if (entry !== 'node_modules' && entry !== '.next') walk(p); continue }
      if (!/\.tsx?$/.test(entry)) continue
      const src = readFileSync(p, 'utf8')
      for (const m of src.matchAll(/process\.env\.([A-Z_0-9]+)/g)) read.add(m[1])
      // `env.NAME` via lib/env.ts, and bracket access with a literal.
      for (const m of src.matchAll(/\benv\.([A-Z_0-9]{4,})/g)) read.add(m[1])
      for (const m of src.matchAll(/process\.env\[['"]([A-Z_0-9]+)['"]\]/g)) read.add(m[1])
    }
  }
  walk(join(__dirname, '..', 'src'))
  walk(join(__dirname))
  // The frontend reads some of the same names from its own env; a variable used
  // there is configured, not dead.
  try { walk(join(__dirname, '..', '..', 'frontend', 'lib')) } catch { /* optional */ }
  try { walk(join(__dirname, '..', '..', 'frontend', 'app')) } catch { /* optional */ }

  const unverified = envNames.filter(
    (n) => !verifiedHere.has(n) && !verifiedByChain.has(n) && !noRemoteService.has(n),
  )
  const unread = envNames.filter((n) => !read.has(n))

  console.log('─'.repeat(60))
  console.log(`  ${envNames.length} variables in .env`)
  console.log(`    ${envNames.filter((n) => verifiedHere.has(n)).length} proved by this script`)
  console.log(`    ${envNames.filter((n) => verifiedByChain.has(n)).length} proved by verify:chain`)
  console.log(`    ${envNames.filter((n) => noRemoteService.has(n)).length} local (no remote service to call)`)
  console.log(`    ${unverified.length} NOT proved by anything${unverified.length ? ': ' + unverified.join(', ') : ''}`)
  if (unread.length) {
    console.log(`\n  ⚠ ${unread.length} variable(s) that NO source file reads — dead weight:`)
    console.log(`    ${unread.join(', ')}`)
  } else {
    console.log('\n  every variable in .env is read by the code')
  }
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) })

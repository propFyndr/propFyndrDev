// backend/scripts/audit-api-keys.ts
//
//   npx tsx scripts/audit-api-keys.ts
//
// Does every credential in .env still work?
//
// Written because two of them did not, and neither failed loudly. The backend
// PostHog key was a personal key where a project key was required and had been
// returning 401 to every capture since it was set; both Mistral keys had gone
// from answering to 401 and were costing a round-trip per turn in front of the
// buyer's answer. A key does not announce that it died.
//
// Every probe is the cheapest read the vendor offers — list models, fetch a
// trivial record — never a generation call, so this is free to run and safe to
// re-run. Keys are never printed, only a masked prefix and a length.

import 'dotenv/config'

type Status = 'OK' | 'DEAD' | 'ABSENT'
interface Result { name: string; status: Status; detail: string }

const results: Result[] = []

function mask(v: string): string {
  return v.length <= 10 ? `len ${v.length}` : `${v.slice(0, 4)}..${v.slice(-4)} len ${v.length}`
}

async function probe(
  name: string,
  run: (key: string) => Promise<{ ok: boolean; detail: string }>,
): Promise<void> {
  const key = process.env[name]
  if (!key) { results.push({ name, status: 'ABSENT', detail: 'not set' }); return }
  try {
    const { ok, detail } = await run(key)
    results.push({ name, status: ok ? 'OK' : 'DEAD', detail: `${mask(key)} — ${detail}` })
  } catch (err) {
    results.push({ name, status: 'DEAD', detail: `${mask(key)} — ${(err as Error).message.slice(0, 90)}` })
  }
}

/** A plain GET that only has to come back 2xx. */
async function bearerGet(url: string, key: string): Promise<{ ok: boolean; detail: string }> {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) })
  return { ok: r.ok, detail: `HTTP ${r.status}` }
}

async function main(): Promise<void> {
  // ── LLM providers ────────────────────────────────────────────────────────
  for (const n of ['GEMINI_API_KEY', 'GEMINI_API_KEY1', 'GEMINI_API_KEY2']) {
    await probe(n, async (key) => {
      const { GoogleGenAI } = await import('@google/genai')
      const c = new GoogleGenAI({ apiKey: key })
      await c.models.list()
      return { ok: true, detail: 'models.list ok' }
    })
  }
  for (const n of ['MISTRAL_API_KEY', 'MISTRAL_API_KEY1']) {
    await probe(n, (key) => bearerGet('https://api.mistral.ai/v1/models', key))
  }
  for (const n of ['GROQ_API_KEY', 'GROQ_API_KEY1', 'GROQ_API_KEY2', 'GROQ_API_KEY3']) {
    await probe(n, (key) => bearerGet('https://api.groq.com/openai/v1/models', key))
  }
  await probe('COHERE_API_KEY', (key) => bearerGet('https://api.cohere.com/v1/models', key))
  await probe('NVIDIA_API_KEY', (key) => bearerGet('https://integrate.api.nvidia.com/v1/models', key))

  // Workers AI needs the account id in the path, so the key alone cannot be
  // checked against it. This verifies the token itself instead.
  await probe('CLOUDFLARE_API_KEY', (key) => bearerGet('https://api.cloudflare.com/client/v4/user/tokens/verify', key))

  // ── Services ─────────────────────────────────────────────────────────────
  await probe('TAVILY_API_KEY', async (key) => {
    const r = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ api_key: key, query: 'noida', max_results: 1 }),
      signal: AbortSignal.timeout(25_000),
    })
    return { ok: r.ok, detail: `HTTP ${r.status}` }
  })

  for (const n of ['GOOGLE_MAPS_API_KEY', 'GOOGLE_PLACES_API_KEY']) {
    await probe(n, async (key) => {
      const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Noida&key=${key}`, {
        signal: AbortSignal.timeout(20_000),
      })
      const j = (await r.json()) as { status?: string; error_message?: string }
      const detail = `${j.status}${j.error_message ? ' — ' + j.error_message.slice(0, 70) : ''}`
      return { ok: j.status === 'OK', detail }
    })
  }

  await probe('RESEND_API_KEY', (key) => bearerGet('https://api.resend.com/domains', key))

  // PostHog: the capture endpoint is the only thing that proves the key TYPE.
  // A personal key (phx_) looks perfectly valid and returns 401 here.
  await probe('POSTHOG_API_KEY', async (key) => {
    const host = process.env.POSTHOG_HOST || 'https://us.i.posthog.com'
    const r = await fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        event: 'propfyndr_key_healthcheck',
        distinct_id: 'key-audit',
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(20_000),
    })
    return { ok: r.ok, detail: `capture HTTP ${r.status} ${(await r.text()).slice(0, 50)}` }
  })

  await probe('UPSTASH_REDIS_REST_TOKEN', async (key) => {
    const url = process.env.UPSTASH_REDIS_REST_URL
    if (!url) return { ok: false, detail: 'UPSTASH_REDIS_REST_URL not set' }
    const r = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    })
    return { ok: r.ok, detail: `ping HTTP ${r.status}` }
  })

  await probe('LANGFUSE_SECRET_KEY', async (key) => {
    const base = process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com'
    const auth = Buffer.from(`${process.env.LANGFUSE_PUBLIC_KEY ?? ''}:${key}`).toString('base64')
    const r = await fetch(`${base}/api/public/projects`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(20_000),
    })
    return { ok: r.ok, detail: `HTTP ${r.status}` }
  })

  await probe('SUPABASE_SERVICE_ROLE_KEY', async (key) => {
    const url = process.env.SUPABASE_URL
    if (!url) return { ok: false, detail: 'SUPABASE_URL not set' }
    const r = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20_000),
    })
    return { ok: r.ok, detail: `HTTP ${r.status}` }
  })

  // SENTRY_DSN is a write-only ingest URL with no authenticated read. Checked
  // for shape rather than probed: proving a DSN works by sending it an error
  // puts a fake error in the issue stream.
  const dsn = process.env.SENTRY_DSN
  results.push(
    dsn
      ? {
          name: 'SENTRY_DSN',
          status: /^https:\/\/\w+@[\w.-]+\/\d+$/.test(dsn) ? 'OK' : 'DEAD',
          detail: `${mask(dsn)} — shape check only, not probed`,
        }
      : { name: 'SENTRY_DSN', status: 'ABSENT', detail: 'not set' },
  )

  // ── Report ───────────────────────────────────────────────────────────────
  const pad = Math.max(...results.map((r) => r.name.length))
  console.log(`\nAPI KEY AUDIT\n${'='.repeat(pad + 56)}`)
  for (const r of results) {
    const tag = r.status === 'OK' ? 'ok  ' : r.status === 'DEAD' ? 'DEAD' : '-   '
    console.log(`  ${tag}  ${r.name.padEnd(pad)}  ${r.detail}`)
  }
  const dead = results.filter((r) => r.status === 'DEAD')
  const ok = results.filter((r) => r.status === 'OK')
  const absent = results.filter((r) => r.status === 'ABSENT')
  console.log(`\n${ok.length} ok, ${dead.length} dead, ${absent.length} absent`)
  if (dead.length) {
    console.log(`\nROTATE: ${dead.map((d) => d.name).join(', ')}`)
    process.exitCode = 1
  }
}

main()

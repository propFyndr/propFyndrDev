// backend/scripts/audit-every-single-key.ts
import dotenv from 'dotenv'
import path from 'path'
import Groq from 'groq-sdk'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

interface KeyAuditResult {
  category: string
  keyName: string
  preview: string
  status: 'WORKING' | 'FAILING' | 'RATE_LIMITED' | 'NOT_SET'
  latencyMs?: number
  detail: string
}

async function auditAllKeys() {
  console.log('=====================================================================================================')
  console.log('                 PROPFYNDR COMPLETE SYSTEM-WIDE API KEY HEALTH AUDIT                 ')
  console.log('=====================================================================================================\n')

  const results: KeyAuditResult[] = []

  // Helper to time async calls
  const timeCall = async <T>(fn: () => Promise<T>): Promise<{ res?: T; err?: any; latency: number }> => {
    const start = Date.now()
    try {
      const res = await fn()
      return { res, latency: Date.now() - start }
    } catch (err) {
      return { err, latency: Date.now() - start }
    }
  }

  // ── 1. GROQ KEYS ────────────────────────────────────────────────────────────────────────
  const groqKeys = [
    'GROQ_API_KEY',
    'GROQ_API_KEY1',
    'GROQ_API_KEY2',
    'GROQ_API_KEY3',
    'GROQ_BLOG_API_KEY',
  ]

  for (const name of groqKeys) {
    const val = process.env[name]
    if (!val) {
      results.push({ category: 'AI Models', keyName: name, preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' })
      continue
    }
    const preview = `${val.slice(0, 8)}...${val.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const client = new Groq({ apiKey: val })
      return await client.models.list()
    })
    if (res) {
      results.push({ category: 'AI Models', keyName: name, preview, status: 'WORKING', latencyMs: latency, detail: `Groq connected (${res.data.length} models available)` })
    } else {
      const msg = err?.message || String(err)
      results.push({ category: 'AI Models', keyName: name, preview, status: err?.status === 429 ? 'RATE_LIMITED' : 'FAILING', latencyMs: latency, detail: msg.slice(0, 80) })
    }
  }

  // ── 2. GEMINI KEYS ──────────────────────────────────────────────────────────────────────
  const geminiKeys = [
    'GEMINI_API_KEY',
    'GEMINI_API_KEY_OLD_DEPLETED',
    'GEMINI_API_KEY1',
    'GEMINI_API_KEY2',
  ]

  for (const name of geminiKeys) {
    const val = process.env[name]
    if (!val) {
      results.push({ category: 'AI Models', keyName: name, preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' })
      continue
    }
    const preview = `${val.slice(0, 8)}...${val.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${val}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
      return await resp.json()
    })
    if (res) {
      results.push({ category: 'AI Models', keyName: name, preview, status: 'WORKING', latencyMs: latency, detail: `Gemini API key verified (${res.models?.length || 0} models)` })
    } else {
      const msg = err?.message || String(err)
      results.push({ category: 'AI Models', keyName: name, preview, status: /429|quota/i.test(msg) ? 'RATE_LIMITED' : 'FAILING', latencyMs: latency, detail: msg.slice(0, 80) })
    }
  }

  // ── 3. MISTRAL KEYS ─────────────────────────────────────────────────────────────────────
  const mistralKeys = ['MISTRAL_API_KEY', 'MISTRAL_API_KEY1']
  for (const name of mistralKeys) {
    const val = process.env[name]
    if (!val) {
      results.push({ category: 'AI Models', keyName: name, preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' })
      continue
    }
    const preview = `${val.slice(0, 8)}...${val.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const resp = await fetch('https://api.mistral.ai/v1/models', {
        headers: { Authorization: `Bearer ${val}` },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
      return await resp.json()
    })
    if (res) {
      results.push({ category: 'AI Models', keyName: name, preview, status: 'WORKING', latencyMs: latency, detail: 'Mistral API key verified' })
    } else {
      const msg = err?.message || String(err)
      results.push({ category: 'AI Models', keyName: name, preview, status: /429|quota/i.test(msg) ? 'RATE_LIMITED' : 'FAILING', latencyMs: latency, detail: msg.slice(0, 80) })
    }
  }

  // ── 4. COHERE KEY ────────────────────────────────────────────────────────────────────────
  const cohereVal = process.env.COHERE_API_KEY
  if (cohereVal) {
    const preview = `${cohereVal.slice(0, 8)}...${cohereVal.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const resp = await fetch('https://api.cohere.com/v1/models', {
        headers: { Authorization: `Bearer ${cohereVal}` },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
      return await resp.json()
    })
    if (res) {
      results.push({ category: 'AI Models', keyName: 'COHERE_API_KEY', preview, status: 'WORKING', latencyMs: latency, detail: 'Cohere API key verified' })
    } else {
      results.push({ category: 'AI Models', keyName: 'COHERE_API_KEY', preview, status: 'FAILING', latencyMs: latency, detail: String(err?.message).slice(0, 80) })
    }
  } else {
    results.push({ category: 'AI Models', keyName: 'COHERE_API_KEY', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' })
  }

  // ── 5. NVIDIA KEY ────────────────────────────────────────────────────────────────────────
  const nvidiaVal = process.env.NVIDIA_API_KEY
  if (nvidiaVal) {
    const preview = `${nvidiaVal.slice(0, 8)}...${nvidiaVal.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const resp = await fetch('https://integrate.api.nvidia.com/v1/models', {
        headers: { Authorization: `Bearer ${nvidiaVal}` },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
      return await resp.json()
    })
    if (res) {
      results.push({ category: 'AI Models', keyName: 'NVIDIA_API_KEY', preview, status: 'WORKING', latencyMs: latency, detail: 'NVIDIA Nim API key verified' })
    } else {
      results.push({ category: 'AI Models', keyName: 'NVIDIA_API_KEY', preview, status: 'FAILING', latencyMs: latency, detail: String(err?.message).slice(0, 80) })
    }
  } else {
    results.push({ category: 'AI Models', keyName: 'NVIDIA_API_KEY', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' })
  }

  // ── 6. TAVILY SEARCH KEY ──────────────────────────────────────────────────────────────────
  const tavilyVal = process.env.TAVILY_API_KEY
  if (tavilyVal) {
    const preview = `${tavilyVal.slice(0, 8)}...${tavilyVal.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: tavilyVal, query: 'test', max_results: 1 }),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
      return await resp.json()
    })
    if (res) {
      results.push({ category: 'Web Search', keyName: 'TAVILY_API_KEY', preview, status: 'WORKING', latencyMs: latency, detail: 'Tavily web search verified' })
    } else {
      results.push({ category: 'Web Search', keyName: 'TAVILY_API_KEY', preview, status: 'FAILING', latencyMs: latency, detail: String(err?.message).slice(0, 80) })
    }
  } else {
    results.push({ category: 'Web Search', keyName: 'TAVILY_API_KEY', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' })
  }

  // ── 7. GOOGLE MAPS / PLACES KEY ──────────────────────────────────────────────────────────
  const mapsVal = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY
  if (mapsVal) {
    const preview = `${mapsVal.slice(0, 8)}...${mapsVal.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const resp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Noida&key=${mapsVal}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      if (data.status !== 'OK') throw new Error(`Google Maps API error: ${data.status} - ${data.error_message || ''}`)
      return data
    })
    if (res) {
      results.push({ category: 'Location Services', keyName: 'GOOGLE_MAPS_API_KEY', preview, status: 'WORKING', latencyMs: latency, detail: 'Google Maps & Geocoding verified' })
    } else {
      results.push({ category: 'Location Services', keyName: 'GOOGLE_MAPS_API_KEY', preview, status: 'FAILING', latencyMs: latency, detail: String(err?.message).slice(0, 80) })
    }
  } else {
    results.push({ category: 'Location Services', keyName: 'GOOGLE_MAPS_API_KEY', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' })
  }

  // ── 8. UPSTASH REDIS ──────────────────────────────────────────────────────────────────────
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN
  if (redisUrl && redisToken) {
    const preview = `${redisToken.slice(0, 8)}...${redisToken.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const resp = await fetch(`${redisUrl}/ping`, {
        headers: { Authorization: `Bearer ${redisToken}` },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      return await resp.json()
    })
    if (res && res.result === 'PONG') {
      results.push({ category: 'Database & Cache', keyName: 'UPSTASH_REDIS', preview, status: 'WORKING', latencyMs: latency, detail: 'Upstash Redis cache ping PONG verified' })
    } else {
      results.push({ category: 'Database & Cache', keyName: 'UPSTASH_REDIS', preview, status: 'FAILING', latencyMs: latency, detail: String(err?.message).slice(0, 80) })
    }
  } else {
    results.push({ category: 'Database & Cache', keyName: 'UPSTASH_REDIS', preview: 'NOT_SET', status: 'NOT_SET', detail: 'URL or Token missing' })
  }

  // ── 9. RESEND EMAIL API KEY ──────────────────────────────────────────────────────────────
  const resendVal = process.env.RESEND_API_KEY
  if (resendVal) {
    const preview = `${resendVal.slice(0, 8)}...${resendVal.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const resp = await fetch('https://api.resend.com/api-keys', {
        headers: { Authorization: `Bearer ${resendVal}` },
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`)
      return await resp.json()
    })
    if (res) {
      results.push({ category: 'Email Outreach', keyName: 'RESEND_API_KEY', preview, status: 'WORKING', latencyMs: latency, detail: 'Resend transactional email verified' })
    } else {
      results.push({ category: 'Email Outreach', keyName: 'RESEND_API_KEY', preview, status: 'FAILING', latencyMs: latency, detail: String(err?.message).slice(0, 80) })
    }
  } else {
    results.push({ category: 'Email Outreach', keyName: 'RESEND_API_KEY', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' })
  }

  // ── 10. SUPABASE AUTH & DB ────────────────────────────────────────────────────────────────
  const supaUrl = process.env.SUPABASE_URL
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (supaUrl && supaKey) {
    const preview = `${supaKey.slice(0, 8)}...${supaKey.slice(-4)}`
    const { res, err, latency } = await timeCall(async () => {
      const resp = await fetch(`${supaUrl}/rest/v1/`, {
        headers: { apikey: supaKey, Authorization: `Bearer ${supaKey}` },
      })
      if (!resp.ok && resp.status !== 200) throw new Error(`HTTP ${resp.status}`)
      return true
    })
    if (res) {
      results.push({ category: 'Database & Auth', keyName: 'SUPABASE_SERVICE_ROLE_KEY', preview, status: 'WORKING', latencyMs: latency, detail: 'Supabase REST API & auth verified' })
    } else {
      results.push({ category: 'Database & Auth', keyName: 'SUPABASE_SERVICE_ROLE_KEY', preview, status: 'FAILING', latencyMs: latency, detail: String(err?.message).slice(0, 80) })
    }
  } else {
    results.push({ category: 'Database & Auth', keyName: 'SUPABASE_SERVICE_ROLE_KEY', preview: 'NOT_SET', status: 'NOT_SET', detail: 'URL or Key missing' })
  }

  // Print Complete Table
  for (const r of results) {
    const icon = r.status === 'WORKING' ? '🟢' : r.status === 'RATE_LIMITED' ? '🟡' : r.status === 'NOT_SET' ? '⚪' : '🔴'
    const latStr = r.latencyMs !== undefined ? `${r.latencyMs}ms`.padStart(7) : '    N/A'
    console.log(`${icon} [${r.category.padEnd(17)}] ${r.keyName.padEnd(28)} (${r.preview.padEnd(16)}) [${latStr}] -> [${r.status.padEnd(10)}] : ${r.detail}`)
  }

  console.log('\n=====================================================================================================\n')
  process.exit(0)
}

auditAllKeys().catch(err => {
  console.error('Audit execution error:', err)
  process.exit(1)
})

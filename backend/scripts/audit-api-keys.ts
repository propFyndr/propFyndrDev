// backend/scripts/audit-api-keys.ts
import dotenv from 'dotenv'
import path from 'path'
import OpenAI from 'openai'
import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Load .env from backend and root
dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function auditKeys() {
  console.log('====================================================')
  console.log('      PROPFYNDR LIVE API KEY & HEALTH AUDIT        ')
  console.log('====================================================\n')

  const results: Record<string, { status: 'WORKING' | 'FAILING' | 'RATE_LIMITED' | 'NOT_SET'; detail: string }> = {}

  // 1. OpenAI API Key
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    results['OpenAI (OPENAI_API_KEY)'] = { status: 'NOT_SET', detail: 'Environment variable missing' }
  } else {
    try {
      const client = new OpenAI({ apiKey: openaiKey })
      const res = await client.models.list()
      results['OpenAI (OPENAI_API_KEY)'] = {
        status: 'WORKING',
        detail: `Successfully connected (${res.data.length} models available)`,
      }
    } catch (err: any) {
      const isRateLimit = err.status === 429 || /rate limit/i.test(err.message || '')
      results['OpenAI (OPENAI_API_KEY)'] = {
        status: isRateLimit ? 'RATE_LIMITED' : 'FAILING',
        detail: err.message || String(err),
      }
    }
  }

  // 2. Groq API Key
  const groqKey = process.env.GROQ_API_KEY
  if (!groqKey) {
    results['Groq (GROQ_API_KEY)'] = { status: 'NOT_SET', detail: 'Environment variable missing' }
  } else {
    try {
      const client = new Groq({ apiKey: groqKey })
      const res = await client.models.list()
      results['Groq (GROQ_API_KEY)'] = {
        status: 'WORKING',
        detail: `Successfully connected (${res.data.length} models available)`,
      }
    } catch (err: any) {
      const isRateLimit = err.status === 429 || /rate limit/i.test(err.message || '')
      results['Groq (GROQ_API_KEY)'] = {
        status: isRateLimit ? 'RATE_LIMITED' : 'FAILING',
        detail: err.message || String(err),
      }
    }
  }

  // 3. Gemini / Google AI Key
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY
  if (!geminiKey) {
    results['Gemini (GEMINI_API_KEY)'] = { status: 'NOT_SET', detail: 'Environment variable missing' }
  } else {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`)
      if (resp.ok) {
        const data = await resp.json()
        const count = Array.isArray(data.models) ? data.models.length : 0
        results['Gemini (GEMINI_API_KEY)'] = {
          status: 'WORKING',
          detail: `Successfully connected (${count} models available)`,
        }
      } else {
        const text = await resp.text()
        results['Gemini (GEMINI_API_KEY)'] = {
          status: resp.status === 429 ? 'RATE_LIMITED' : 'FAILING',
          detail: `HTTP ${resp.status}: ${text.slice(0, 80)}`,
        }
      }
    } catch (err: any) {
      results['Gemini (GEMINI_API_KEY)'] = {
        status: 'FAILING',
        detail: err.message || String(err),
      }
    }
  }

  // 4. Anthropic API Key
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) {
    results['Anthropic (ANTHROPIC_API_KEY)'] = { status: 'NOT_SET', detail: 'Environment variable missing' }
  } else {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      })
      if (res.ok) {
        results['Anthropic (ANTHROPIC_API_KEY)'] = { status: 'WORKING', detail: 'Successfully connected' }
      } else {
        const errText = await res.text()
        const isRateLimit = res.status === 429
        results['Anthropic (ANTHROPIC_API_KEY)'] = {
          status: isRateLimit ? 'RATE_LIMITED' : 'FAILING',
          detail: `HTTP ${res.status}: ${errText.slice(0, 100)}`,
        }
      }
    } catch (err: any) {
      results['Anthropic (ANTHROPIC_API_KEY)'] = { status: 'FAILING', detail: err.message || String(err) }
    }
  }

  // 5. Langfuse
  const langfusePublicKey = process.env.LANGFUSE_PUBLIC_KEY
  const langfuseSecretKey = process.env.LANGFUSE_SECRET_KEY
  const langfuseHost = process.env.LANGFUSE_HOST || 'https://cloud.langfuse.com'
  if (!langfusePublicKey || !langfuseSecretKey) {
    results['Langfuse Telemetry'] = { status: 'NOT_SET', detail: 'Keys missing in env' }
  } else {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${langfusePublicKey}:${langfuseSecretKey}`).toString('base64')
      const res = await fetch(`${langfuseHost}/api/public/health`, {
        headers: { Authorization: authHeader },
      })
      if (res.ok || res.status === 200) {
        results['Langfuse Telemetry'] = { status: 'WORKING', detail: `Connected to ${langfuseHost}` }
      } else {
        results['Langfuse Telemetry'] = { status: 'FAILING', detail: `HTTP ${res.status}` }
      }
    } catch (err: any) {
      results['Langfuse Telemetry'] = { status: 'FAILING', detail: err.message || String(err) }
    }
  }

  // 6. PostHog
  const posthogKey = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!posthogKey) {
    results['PostHog Analytics'] = { status: 'NOT_SET', detail: 'POSTHOG_API_KEY missing' }
  } else {
    results['PostHog Analytics'] = { status: 'WORKING', detail: `Key configured (${posthogKey.slice(0, 8)}...)` }
  }

  // Print Summary Table
  for (const [provider, info] of Object.entries(results)) {
    const icon = info.status === 'WORKING' ? '🟢' : info.status === 'RATE_LIMITED' ? '🟡' : info.status === 'NOT_SET' ? '⚪' : '🔴'
    console.log(`${icon} ${provider.padEnd(35)} : [${info.status.padEnd(12)}] ${info.detail}`)
  }

  console.log('\n====================================================')
  process.exit(0)
}

auditKeys().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})

// backend/scripts/audit-all-ai-keys.ts
import dotenv from 'dotenv'
import path from 'path'
import Groq from 'groq-sdk'

dotenv.config({ path: path.resolve(__dirname, '../.env') })
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

interface KeyStatus {
  keyName: string
  provider: string
  preview: string
  status: 'WORKING' | 'NOT_WORKING' | 'RATE_LIMITED' | 'EXPIRED' | 'NOT_SET'
  detail: string
}

async function testGroqKey(keyName: string, keyVal?: string): Promise<KeyStatus> {
  if (!keyVal) return { keyName, provider: 'Groq', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' }
  const preview = `${keyVal.slice(0, 8)}...${keyVal.slice(-4)}`
  try {
    const client = new Groq({ apiKey: keyVal })
    const res = await client.models.list()
    return { keyName, provider: 'Groq', preview, status: 'WORKING', detail: `Successfully connected (${res.data.length} models available)` }
  } catch (err: any) {
    const msg = err.message || String(err)
    if (err.status === 429 || /rate limit/i.test(msg)) {
      return { keyName, provider: 'Groq', preview, status: 'RATE_LIMITED', detail: `Rate limited (429): ${msg.slice(0, 80)}` }
    }
    if (err.status === 401 || /invalid|expired/i.test(msg)) {
      return { keyName, provider: 'Groq', preview, status: 'EXPIRED', detail: `Expired or Invalid (401): ${msg.slice(0, 80)}` }
    }
    return { keyName, provider: 'Groq', preview, status: 'NOT_WORKING', detail: `HTTP ${err.status || 'ERR'}: ${msg.slice(0, 80)}` }
  }
}

async function testGeminiKey(keyName: string, keyVal?: string): Promise<KeyStatus> {
  if (!keyVal) return { keyName, provider: 'Gemini', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' }
  const preview = `${keyVal.slice(0, 8)}...${keyVal.slice(-4)}`
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyVal}`)
    if (res.ok) {
      return { keyName, provider: 'Gemini', preview, status: 'WORKING', detail: 'Successfully verified API key' }
    }
    const text = await res.text()
    if (res.status === 429 || /quota|rate/i.test(text)) {
      return { keyName, provider: 'Gemini', preview, status: 'RATE_LIMITED', detail: `Rate limited / Quota (429): ${text.slice(0, 80)}` }
    }
    if (res.status === 400 || res.status === 401 || res.status === 403 || /invalid|expired|keyNotValid/i.test(text)) {
      return { keyName, provider: 'Gemini', preview, status: 'EXPIRED', detail: `Expired / Invalid Key (${res.status}): ${text.slice(0, 80)}` }
    }
    return { keyName, provider: 'Gemini', preview, status: 'NOT_WORKING', detail: `HTTP ${res.status}: ${text.slice(0, 80)}` }
  } catch (err: any) {
    return { keyName, provider: 'Gemini', preview, status: 'NOT_WORKING', detail: err.message || String(err) }
  }
}

async function testMistralKey(keyName: string, keyVal?: string): Promise<KeyStatus> {
  if (!keyVal) return { keyName, provider: 'Mistral', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' }
  const preview = `${keyVal.slice(0, 8)}...${keyVal.slice(-4)}`
  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyVal}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-tiny',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    })
    if (res.ok) {
      return { keyName, provider: 'Mistral', preview, status: 'WORKING', detail: 'Successfully generated response' }
    }
    const text = await res.text()
    if (res.status === 429 || /rate limit|quota/i.test(text)) {
      return { keyName, provider: 'Mistral', preview, status: 'RATE_LIMITED', detail: `Rate limited / Quota (429): ${text.slice(0, 80)}` }
    }
    if (res.status === 401 || res.status === 403 || /invalid|expired/i.test(text)) {
      return { keyName, provider: 'Mistral', preview, status: 'EXPIRED', detail: `Expired / Invalid Key (${res.status}): ${text.slice(0, 80)}` }
    }
    return { keyName, provider: 'Mistral', preview, status: 'NOT_WORKING', detail: `HTTP ${res.status}: ${text.slice(0, 80)}` }
  } catch (err: any) {
    return { keyName, provider: 'Mistral', preview, status: 'NOT_WORKING', detail: err.message || String(err) }
  }
}

async function testCohereKey(keyName: string, keyVal?: string): Promise<KeyStatus> {
  if (!keyVal) return { keyName, provider: 'Cohere', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' }
  const preview = `${keyVal.slice(0, 8)}...${keyVal.slice(-4)}`
  try {
    const res = await fetch('https://api.cohere.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${keyVal}`,
      },
    })
    if (res.ok) {
      return { keyName, provider: 'Cohere', preview, status: 'WORKING', detail: 'Successfully connected and verified API key' }
    }
    const text = await res.text()
    if (res.status === 429 || /rate limit|quota/i.test(text)) {
      return { keyName, provider: 'Cohere', preview, status: 'RATE_LIMITED', detail: `Rate limited / Quota (429): ${text.slice(0, 80)}` }
    }
    if (res.status === 401 || res.status === 403 || /invalid|expired/i.test(text)) {
      return { keyName, provider: 'Cohere', preview, status: 'EXPIRED', detail: `Expired / Invalid Key (${res.status}): ${text.slice(0, 80)}` }
    }
    return { keyName, provider: 'Cohere', preview, status: 'NOT_WORKING', detail: `HTTP ${res.status}: ${text.slice(0, 80)}` }
  } catch (err: any) {
    return { keyName, provider: 'Cohere', preview, status: 'NOT_WORKING', detail: err.message || String(err) }
  }
}

async function testCerebrasKey(keyName: string, keyVal?: string): Promise<KeyStatus> {
  if (!keyVal) return { keyName, provider: 'Cerebras', preview: 'NOT_SET', status: 'NOT_SET', detail: 'Key missing in .env' }
  const preview = `${keyVal.slice(0, 8)}...${keyVal.slice(-4)}`
  try {
    const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyVal}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.1-8b',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5,
      }),
    })
    if (res.ok) {
      return { keyName, provider: 'Cerebras', preview, status: 'WORKING', detail: 'Successfully generated response' }
    }
    const text = await res.text()
    if (res.status === 429 || /rate limit|quota/i.test(text)) {
      return { keyName, provider: 'Cerebras', preview, status: 'RATE_LIMITED', detail: `Rate limited / Quota (429): ${text.slice(0, 80)}` }
    }
    if (res.status === 401 || res.status === 403 || /invalid|expired/i.test(text)) {
      return { keyName, provider: 'Cerebras', preview, status: 'EXPIRED', detail: `Expired / Invalid Key (${res.status}): ${text.slice(0, 80)}` }
    }
    return { keyName, provider: 'Cerebras', preview, status: 'NOT_WORKING', detail: `HTTP ${res.status}: ${text.slice(0, 80)}` }
  } catch (err: any) {
    return { keyName, provider: 'Cerebras', preview, status: 'NOT_WORKING', detail: err.message || String(err) }
  }
}

async function runFullAudit() {
  console.log('================================================================================')
  console.log('         PROPFYNDR COMPLETE AI PROVIDER API KEY HEALTH AUDIT                 ')
  console.log('================================================================================\n')

  const tests: Promise<KeyStatus>[] = [
    // Groq
    testGroqKey('GROQ_API_KEY', process.env.GROQ_API_KEY),
    testGroqKey('GROQ_API_KEY1', process.env.GROQ_API_KEY1),
    testGroqKey('GROQ_API_KEY2', process.env.GROQ_API_KEY2),
    testGroqKey('GROQ_API_KEY3', process.env.GROQ_API_KEY3),
    testGroqKey('GROQ_BLOG_API_KEY', process.env.GROQ_BLOG_API_KEY),

    // Gemini
    testGeminiKey('GEMINI_API_KEY', process.env.GEMINI_API_KEY),
    testGeminiKey('GEMINI_API_KEY_OLD_DEPLETED', process.env.GEMINI_API_KEY_OLD_DEPLETED),
    testGeminiKey('GEMINI_API_KEY1', process.env.GEMINI_API_KEY1),
    testGeminiKey('GEMINI_API_KEY2', process.env.GEMINI_API_KEY2),

    // Mistral
    testMistralKey('MISTRAL_API_KEY', process.env.MISTRAL_API_KEY),
    testMistralKey('MISTRAL_API_KEY1', process.env.MISTRAL_API_KEY1),

    // Cohere
    testCohereKey('COHERE_API_KEY', process.env.COHERE_API_KEY),

    // Cerebras
    testCerebrasKey('CEREBRAS_API_KEY', process.env.CEREBRAS_API_KEY),
  ]

  const results = await Promise.all(tests)

  for (const r of results) {
    const icon = r.status === 'WORKING' ? '🟢' : r.status === 'RATE_LIMITED' ? '🟡' : r.status === 'EXPIRED' ? '🔴' : r.status === 'NOT_SET' ? '⚪' : '❌'
    console.log(`${icon} [${r.provider.padEnd(8)}] ${r.keyName.padEnd(28)} (${r.preview.padEnd(16)}) -> [${r.status.padEnd(12)}] : ${r.detail}`)
  }

  console.log('\n================================================================================')
  process.exit(0)
}

runFullAudit().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})

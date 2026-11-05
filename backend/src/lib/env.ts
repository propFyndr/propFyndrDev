import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.string().default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  WEBHOOK_SECRET: z.string().optional().default(''),
  // Static key for the Make.com scheduler (stale-lead chaser, dead-letter
  // replay). Unset disables those endpoints outright — it never opens them.
  INTERNAL_API_KEY: z.string().optional(),

  // AI Provider Keys — at least one required in production
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  OPENAI_API_KEY1: z.string().optional(),
  GROQ_API_KEY1: z.string().optional(),
  OPENAI_API_KEY2: z.string().optional(),
  GROQ_API_KEY2: z.string().optional(),
  OPENAI_API_KEY3: z.string().optional(),
  GROQ_API_KEY3: z.string().optional(),

  // Object storage (Neon, lib/objectStorage.ts) — required in production.
  STORAGE_S3_ENDPOINT: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),

  // Buyer sign-in (lib/betterAuth.ts): signs session cookies. 32+ random characters.
  BETTER_AUTH_SECRET: z.string().min(32).optional(),

  // WhatsApp (Meta Cloud API or Twilio — set WHATSAPP_PROVIDER)
  WHATSAPP_PROVIDER: z.enum(['meta', 'twilio', 'none']).default('none'),
  // Meta
  META_WHATSAPP_TOKEN: z.string().optional(),
  META_PHONE_NUMBER_ID: z.string().optional(),
  META_RECIPIENT_NUMBER: z.string().optional(),
  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TWILIO_WHATSAPP_TO: z.string().optional(),

  // Email (Resend — easiest for Render)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_TO: z.string().optional(),

  // CORS — set to your Vercel frontend URL. Comma-separated list allowed
  // (index.ts splits on ',' for its own allow-list), so this cannot be
  // `.url()` — a single invalid URL in a multi-origin value would crash the
  // whole process at import time.
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Feature flags
  ENABLE_GEMINI_FALLBACK: z.enum(['true', 'false']).optional().default('true'),
})

let envParsed: z.infer<typeof EnvSchema>
try {
  envParsed = EnvSchema.parse(process.env)
} catch (error: any) {
  console.error('❌ Invalid environment variables:', error.errors || error)
  process.exit(1)
}

// Production-only validation: fail fast if critical config is missing
if (envParsed.NODE_ENV === 'production') {
  const missingKeys: string[] = []

  // At least one AI provider key required
  if (!envParsed.GEMINI_API_KEY && !envParsed.OPENAI_API_KEY && !envParsed.GROQ_API_KEY) {
    missingKeys.push('At least one of: GEMINI_API_KEY, OPENAI_API_KEY, GROQ_API_KEY')
  }

  // Buyer sign-in cannot sign sessions without it.
  if (!envParsed.BETTER_AUTH_SECRET) {
    missingKeys.push('BETTER_AUTH_SECRET')
  }

  // Document and logo uploads need object storage.
  for (const k of ['STORAGE_S3_ENDPOINT', 'STORAGE_ACCESS_KEY_ID', 'STORAGE_SECRET_ACCESS_KEY'] as const) {
    if (!envParsed[k]) missingKeys.push(k)
  }

  // Read the raw value: the schema default is localhost, which in production
  // would silently point CORS and every emailed link at a dev machine.
  const frontendUrls = (process.env.FRONTEND_URL ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (frontendUrls.length === 0 || frontendUrls.some(u => /localhost|127\.0\.0\.1/i.test(u))) {
    missingKeys.push('FRONTEND_URL (the deployed frontend origin; localhost/127.0.0.1 is not allowed in production)')
  }

  if (missingKeys.length > 0) {
    console.error('❌ Production server requires these environment variables:')
    missingKeys.forEach(key => console.error(`   - ${key}`))
    process.exit(1)
  }

  if (!envParsed.WEBHOOK_SECRET) {
    console.warn('⚠️ WEBHOOK_SECRET is missing in production. Webhook signature verification will be skipped.')
  }
}

export const env = envParsed


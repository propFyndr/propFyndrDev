import 'dotenv/config'
import 'express-async-errors'
import * as Sentry from '@sentry/node'
import crypto from 'crypto'
import express, { Request, Response, NextFunction } from 'express'
import logger from './lib/logger'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import compression from 'compression'
import { prisma } from './lib/db'
import { pingRedis, checkRateLimit } from './lib/cache'
import chatRouter from './routes/chat'
import sessionsRouter from './routes/sessions'
import projectsRouter from './routes/projects'
import savedRouter from './routes/saved'
import leadsRouter from './routes/leads'
import shareRouter from './routes/share'
import adminRouter from './routes/admin'
import { betaRouter } from './routes/betaObservability'
import buildersRouter from './routes/builders'
import marketComparisonRouter from './routes/marketComparison'
import priceAlertsRouter from './routes/priceAlerts'
import aqiRouter from './routes/aqi'
import commuteRouter from './routes/commute'
import { flushPostHog } from './lib/monitoring/posthog'
import { flushLangfuse } from './lib/monitoring/langfuse'
import builderReputationRouter from './routes/builderReputation'
import transcribeRouter from './routes/transcribe'
import documentsRouter from './routes/documents'
import registryPricesRouter from './routes/registryPrices'
import builderRegistrationRouter from './routes/builderRegistration'
import builderApplicationsRouter from './routes/builderApplications'
import analyticsRouter from './routes/analytics'
import adminIntelligenceRouter from './routes/admin-intelligence'
import adminTeamRouter from './routes/adminTeam'
import portalRouter from './routes/portal'
import { initializeCaches } from './lib/projectDataGateway.cache'
import { FALLBACK_CHAIN } from './lib/config'

// Initialize Sentry for error tracking and monitoring
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    ignoreErrors: [/ECONNRESET/, /ETIMEDOUT/, /Too many requests/],
  })
}

// Synchronous env assertions — must run before any async work or app setup.
for (const key of ['ADMIN_PASSWORD', 'DATABASE_URL'] as const) {
  if (!process.env[key]) {
    logger.fatal({ key }, `${key} env var is not set. Refusing to start.`)
    process.exit(1)
  }
}

// Require at least one AI provider for the core chat functionality.
//
// Derived from FALLBACK_CHAIN rather than naming providers here: this guard
// used to test only OPENAI_API_KEY and GROQ_API_KEY, so a deploy configured
// with Gemini alone — tier 1, and the intended primary — would refuse to boot,
// while one holding a key for a retired tier would start happily.
const configuredProviders = FALLBACK_CHAIN.filter(item => !!process.env[item.envKey])
if (configuredProviders.length === 0) {
  logger.fatal(
    { expected: [...new Set(FALLBACK_CHAIN.map(i => i.envKey))] },
    'No AI provider key is configured. At least one entry of FALLBACK_CHAIN must have its key set. Refusing to start.',
  )
  process.exit(1)
}

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const VERSION = process.env.npm_package_version ?? '1.0.0'
const startTime = Date.now()

export const app = express()

// All deployments sit behind a proxy (Render, Railway, Fly, etc.).
// This makes req.ip trustworthy and fixes x-forwarded-for-based rate limiting.
app.set('trust proxy', 1)

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
const envOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  ...envOrigins
])

app.use(cors({
  origin: (origin, callback) => {
    if (
      !origin ||
      allowedOrigins.has(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.onrender.com') ||
      process.env.NODE_ENV !== 'production'
    ) {
      callback(null, true)
    } else {
      callback(new Error(`CORS origin not allowed: ${origin}`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Guest-Token', 'x-guest-token', 'X-Request-ID', 'x-request-id', 'Accept'],
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ limit: '10mb', extended: true }))
app.use(cookieParser())

// Request-ID middleware for correlation across logs, Sentry, and token records
app.use((req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers['x-request-id'] as string) || crypto.randomUUID()
  res.setHeader('x-request-id', id)
  ;(req as any).requestId = id
  next()
})

// Structural Logging
app.use(morgan('combined'))

// Response Compression (gzip/brotli) — skip SSE streams
app.use(compression({
  filter: (req, res) => {
    if (res.getHeader('Content-Type')?.toString().includes('text/event-stream')) return false
    return compression.filter(req, res)  // default filter (always compress JSON)
  },
}))

// Sentry Middleware (v8 uses errorHandler in error middleware, not request handler)

// Global Rate Limiting Middleware
app.use(async (req: Request, res: Response, next: NextFunction) => {
  // Exclude healthchecks (webhooks are now rate-limited for security)
  if (req.path.startsWith('/api/v1/health')) {
    return next()
  }
  
  // Keyed on the guest token or auth header when present, IP only as a
  // fallback.
  //
  // A pure IP key means every beta user behind one office NAT or one mobile
  // carrier gateway shares a single 100/minute budget. At 50-200 testers that
  // produces throttling you cannot reproduce and they cannot explain, and the
  // IP fallback still catches an unidentified flood.
  const ip = req.ip || '127.0.0.1'
  const guestToken = (req.headers['x-guest-token'] as string | undefined)?.slice(0, 64)
  const authHeader = (req.headers.authorization as string | undefined)?.slice(0, 128)
  const identity = guestToken || authHeader || ip
  const rateLimit = await checkRateLimit(`global:${identity}`, 100, 60)

  res.setHeader('X-RateLimit-Limit', 100)
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining)
  
  if (rateLimit.remaining <= 0) {
    res.status(429).json({ error: 'Too many requests, please try again later.' })
    return
  }
  next()
})

// Health endpoint — probes DB and Redis; only covers local infrastructure dependencies.
// Returns 200 when healthy, 503 when the database is unreachable.
app.get('/api/v1/health', async (_req, res) => {
  let db: 'ok' | 'error' = 'ok'
  let redis: 'ok' | 'degraded' = 'ok'

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    db = 'error'
  }

  if (!(await pingRedis())) redis = 'degraded'

  const status = db === 'error' ? 503 : 200
  res.status(status).json({
    ok: db === 'ok',
    version: VERSION,
    uptime: Math.floor(process.uptime()),
    db,
    redis,
  })
})

app.use('/api/v1/chat', chatRouter)
app.use('/api/v1/sessions', sessionsRouter)
app.use('/api/v1/projects', projectsRouter)
app.use('/api/v1/saved', savedRouter)
app.use('/api/v1/leads', leadsRouter)
app.use('/api/v1/share', shareRouter)
// Mounted before adminRouter: Express matches in order, and a /:id route in the
// admin router would otherwise claim /beta or /team before either ever sees it.
app.use('/api/v1/admin/beta', betaRouter)
app.use('/api/v1/admin/team', adminTeamRouter)
app.use('/api/v1/admin', adminRouter)
app.use('/api/v1/portal', portalRouter)
app.use('/api/v1/builders', buildersRouter)
app.use('/api/v1/market-comparison', marketComparisonRouter)
app.use('/api/v1/price-alerts', priceAlertsRouter)
app.use('/api/v1/aqi', aqiRouter)
app.use('/api/v1/commute', commuteRouter)
app.use('/api/v1/builder-reputation', builderReputationRouter)
app.use('/api/v1/transcribe', transcribeRouter)
app.use('/api/v1/documents', documentsRouter)
app.use('/api/v1/registry-prices', registryPricesRouter)
app.use('/api/v1/builder-registration', builderRegistrationRouter)
app.use('/api/v1/builder-applications', builderApplicationsRouter)
app.use('/api/v1/analytics', analyticsRouter)
app.use('/api/v1/admin/intelligence', adminIntelligenceRouter)

// Sentry Error Handler (v8 - handled below in custom error middleware)

// Global error handler — catches any error passed to next(err) or thrown in an
// async route (via express-async-errors). Must be registered after all routes.
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const path = req.path
  const tags: Record<string, string> = {}

  // Route-specific error context
  if (path.includes('/chat')) tags.route = 'chat'
  if (path.includes('/leads')) tags.route = 'leads'
  if (path.includes('/admin')) tags.route = 'admin'
  if (err.message.includes('GUARDRAIL')) tags.guardrail = 'triggered'
  if (err.message.includes('AI') || err.message.includes('rate limit')) tags.ai = 'error'

  logger.error({ err: err.message, stack: err.stack, tags, path }, 'Internal error')

  // Capture error context to Sentry
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, { tags })
  }

  if (res.headersSent) return // SSE / streaming — cannot send a second response
  res.status((err as { status?: number }).status ?? 500).json({ error: 'Internal server error' })
})

async function startup() {
  // Probe the database before accepting traffic. A misconfigured DATABASE_URL
  // should fail at deploy time, not at the first user request.
  try {
    await prisma.$queryRaw`SELECT 1`
    logger.info('database: ok')
  } catch (err) {
    logger.fatal({ err: (err as Error).message }, 'database unreachable')
    process.exit(1)
  }

  // Probe Redis if configured. Redis is a soft dependency for most features
  // (rate limiting falls back to in-memory) but a hard dependency for admin sessions.
  const redisOk = await pingRedis()
  if (process.env.UPSTASH_REDIS_REST_URL && !redisOk) {
    logger.warn('Redis configured but unreachable — admin sessions will fail at login')
  } else if (redisOk) {
    logger.info('redis: ok')
  } else {
    logger.info('redis: not configured (rate limiting uses in-memory fallback)')
  }

  // Phase 2.1: Initialize in-memory caches for project data and query planning
  initializeCaches()
  logger.info('caches initialized')
  const server = app.listen(PORT, '0.0.0.0', () => {
    const elapsed = Date.now() - startTime
    logger.info({ port: PORT, elapsed }, `listening — ready`)
    // GEMINI_API_KEY is tier 1 of FALLBACK_CHAIN and was missing from this
    // log, as were the two observability keys — so a deploy running without
    // its primary provider, without error reporting or without analytics
    // looked identical in the logs to a healthy one.
    const keys = {
      GEMINI_API_KEY:           !!process.env.GEMINI_API_KEY,
      MISTRAL_API_KEY:          !!process.env.MISTRAL_API_KEY,
      CEREBRAS_API_KEY:         !!process.env.CEREBRAS_API_KEY,
      GROQ_API_KEY:             !!process.env.GROQ_API_KEY,
      COHERE_API_KEY:           !!process.env.COHERE_API_KEY,
      NVIDIA_API_KEY:           !!process.env.NVIDIA_API_KEY,
      CLOUDFLARE_API_KEY:       !!process.env.CLOUDFLARE_API_KEY,
      GOOGLE_MAPS_API_KEY:      !!process.env.GOOGLE_MAPS_API_KEY,
      TAVILY_API_KEY:           !!process.env.TAVILY_API_KEY,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      SENTRY_DSN:               !!process.env.SENTRY_DSN,
      POSTHOG_API_KEY:          !!process.env.POSTHOG_API_KEY,
    }
    logger.info({ keys }, 'optional env configured')
    if (!process.env.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY missing — tier 1 of the provider chain is unavailable, every turn will fall through')
    }
  })

  /**
   * A port clash is a silent-wrong-answer bug, not a startup nuisance.
   *
   * An older process holding the port keeps serving happily while the new one
   * fails to bind. Everything looks live — the site responds, the logs of the
   * old process scroll — but it is running whatever code it started with, so
   * every fix since appears to have done nothing. That cost two rounds of
   * debugging a search that was already correct on disk.
   *
   * So say exactly what is wrong and how to end it, and exit non-zero rather
   * than lingering as a process that never served a request.
   */
  /**
   * Retries before giving up, because the common cause is a race, not a clash.
   *
   * `tsx watch` starts the replacement before the outgoing process has released
   * the socket. The replacement then hits EADDRINUSE, exits, and the OLD
   * process — which never actually died — keeps serving stale code. The site
   * responds, the logs scroll, and every subsequent fix appears to do nothing.
   *
   * That has now cost three separate debugging cycles on this project,
   * including two where a correct fix was reported as not working. A handful of
   * short retries covers the handover window; anything still holding the port
   * after that is a genuinely different process and gets the message below.
   */
  const BIND_RETRIES = Number(process.env.PORT_BIND_RETRIES ?? 10)
  const BIND_RETRY_MS = Number(process.env.PORT_BIND_RETRY_MS ?? 300)
  let bindAttempts = 0

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && bindAttempts < BIND_RETRIES) {
      bindAttempts++
      logger.warn(
        { port: PORT, attempt: bindAttempts, of: BIND_RETRIES },
        'port busy — the previous process has probably not released it yet; retrying',
      )
      setTimeout(() => server.listen(PORT), BIND_RETRY_MS)
      return
    }
    if (err.code === 'EADDRINUSE') {
      logger.error(
        { port: PORT, waitedMs: BIND_RETRIES * BIND_RETRY_MS },
        `port ${PORT} is STILL held after ${BIND_RETRIES} retries — THIS server did not start, and the one still running is serving older code. ` +
        `Find it with:  npx kill-port ${PORT}   (or on Windows: netstat -ano | findstr :${PORT}  then  taskkill /PID <pid> /F)`,
      )
    } else {
      logger.error({ err }, 'server failed to start')
    }
    process.exit(1)
  })

  async function shutdown(signal: string) {
    logger.info({ signal }, 'draining connections')
    server.close(async () => {
      // posthog-node batches on a 30s flushInterval, so without this every
      // deploy and restart silently dropped up to 30s of backend events.
      await flushPostHog().catch(err => logger.warn({ err }, 'posthog flush failed'))
      await flushLangfuse().catch(err => logger.warn({ err }, 'langfuse flush failed'))
      await prisma.$disconnect()
      logger.info('clean exit')
      process.exit(0)
    })
    // Most platforms (Render, K8s) default to a 30s SIGTERM grace period.
    // We force-exit at 28s to ensure we cleanly log our own timeout before the platform sends SIGKILL.
    setTimeout(() => {
      logger.error('forced exit after 28s timeout (aligned with standard 30s platform grace period)')
      process.exit(1)
    }, 28_000).unref()
  }

  process.on('SIGTERM', () => { void shutdown('SIGTERM') })
  process.on('SIGINT',  () => { void shutdown('SIGINT') })

  // Node terminates the process on an unhandled rejection by default, and this
  // codebase deliberately fires several promises without awaiting them —
  // recordUsage, the Redis cache write, PostHog tracking. Each is written to
  // swallow its own errors, but one that slips through would take the whole
  // server down and every in-flight conversation with it.
  //
  // Logged and survived, not rethrown: a telemetry write failing is not a
  // reason to drop a buyer mid-answer.
  process.on('unhandledRejection', (reason) => {
    logger.error(
      { err: reason instanceof Error ? reason.message : String(reason) },
      'unhandled promise rejection — surviving',
    )
  })

  // An uncaught exception leaves the process in an undefined state, so this
  // does NOT continue serving: it logs, then hands over to the same graceful
  // shutdown SIGTERM uses, so in-flight responses get a chance to finish and
  // the platform restarts a clean process.
  process.on('uncaughtException', (err) => {
    logger.error({ err: err.message, stack: err.stack }, 'uncaught exception — shutting down')
    void shutdown('uncaughtException')
  })
}

// Only start the HTTP server when run directly (not when imported by tests)
if (process.env.NODE_ENV !== 'test' && require.main === module) {
  void startup().catch((err) => {
    console.error('[startup] unhandled error:', err)
    process.exit(1)
  })
}

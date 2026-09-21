import { Router } from 'express'
import { runHealthChecks, isSystemHealthy } from '../lib/monitoring/healthChecks'

const router = Router()

/**
 * Quick health check (used by load balancers)
 * Returns 200 if system is healthy, 503 if unhealthy
 */
router.get('/health', async (_req, res) => {
  try {
    const healthy = await isSystemHealthy()
    if (!healthy) {
      return res.status(503).json({ status: 'unhealthy', service: 'propfyndr-backend', ts: new Date().toISOString() })
    }
    res.json({ status: 'ok', service: 'propfyndr-backend', ts: new Date().toISOString() })
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: 'Health check failed', ts: new Date().toISOString() })
  }
})

/**
 * Deep health check (used for monitoring dashboards)
 * Returns detailed component health
 */
router.get('/health/deep', async (_req, res) => {
  try {
    const health = await runHealthChecks()
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503
    res.status(statusCode).json(health)
  } catch (err) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
})

/**
 * Readiness check (used by Kubernetes)
 * 200 = ready to serve requests
 */
router.get('/health/ready', async (_req, res) => {
  try {
    const health = await runHealthChecks()
    if (health.status === 'unhealthy') {
      return res.status(503).json({ ready: false, ts: new Date().toISOString() })
    }
    res.json({ ready: true, timestamp: health.timestamp })
  } catch (err) {
    res.status(503).json({ ready: false, ts: new Date().toISOString() })
  }
})

/**
 * Liveness check (used by Kubernetes)
 * 200 = process is alive
 */
router.get('/health/live', (_req, res) => {
  res.json({ alive: true, timestamp: new Date().toISOString() })
})

export default router

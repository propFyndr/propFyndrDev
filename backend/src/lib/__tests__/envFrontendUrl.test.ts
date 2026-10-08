import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

// env.ts validates at import time and calls process.exit, so each case runs
// in its own process.
const ENV_TS = path.resolve(__dirname, '..', 'env.ts')

function boot(extra: Record<string, string | undefined>) {
  const env: Record<string, string | undefined> = {
    ...process.env,
    GEMINI_API_KEY: 'x',
    SUPABASE_SERVICE_ROLE_KEY: 'x',
    FRONTEND_URL: undefined,
    ...extra,
  }
  for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k]
  return spawnSync(process.execPath, ['--import', 'tsx', '-e', `require(${JSON.stringify(ENV_TS)})`], {
    env: env as NodeJS.ProcessEnv,
    encoding: 'utf8',
  })
}

test('production refuses to boot without FRONTEND_URL', () => {
  const r = boot({ NODE_ENV: 'production' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /FRONTEND_URL/)
})

test('production refuses a localhost FRONTEND_URL, even inside a list', () => {
  assert.equal(boot({ NODE_ENV: 'production', FRONTEND_URL: 'http://127.0.0.1:3000' }).status, 1)
  assert.equal(boot({ NODE_ENV: 'production', FRONTEND_URL: 'https://propfyndr.in,http://localhost:3000' }).status, 1)
})

test('production boots with a real origin; dev keeps the localhost default', () => {
  assert.equal(boot({ NODE_ENV: 'production', FRONTEND_URL: 'https://propfyndr.in' }).status, 0)
  assert.equal(boot({ NODE_ENV: 'development' }).status, 0)
})

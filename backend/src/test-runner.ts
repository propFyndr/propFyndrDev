import { glob } from 'glob'
import { spawnSync } from 'child_process'
import path from 'path'
import { existsSync, readFileSync } from 'fs'
import { parse as parseEnv } from 'dotenv'

const PROVIDER_KEY = /^(GEMINI|GOOGLE_AI|GROQ|OPENAI|AZURE_OPENAI|MISTRAL|COHERE|CEREBRAS|NVIDIA|ANTHROPIC|OPENROUTER|TOGETHER|DEEPSEEK|TAVILY|SERPER|JINA|CLOUDFLARE)_API_KEY\w*$/

async function runTests() {
  const testFiles = await glob('src/**/*.test.ts', {
    absolute: true,
    cwd: process.cwd(),
  })

  if (testFiles.length === 0) {
    console.error('No test files found')
    process.exit(1)
  }

  // Tests never spend model quota unless asked to. Blank every provider key the
  // app's .env would supply (dotenv never overrides a variable that is already
  // set), so a test that reaches a live provider is refused (401) instead
  // of burning the free tiers the product runs on. LIVE_LLM_TESTS=1 opts back in.
  const offlineEnv: Record<string, string> = {}
  if (process.env.LIVE_LLM_TESTS !== '1') {
    const envFile = path.join(process.cwd(), '.env')
    const names = existsSync(envFile) ? Object.keys(parseEnv(readFileSync(envFile))) : []
    for (const name of [...names, ...Object.keys(process.env)]) {
      if (PROVIDER_KEY.test(name)) offlineEnv[name] = 'offline-test-key-not-a-real-credential'
    }
  }

  // Run tests with concurrency limit to prevent DB connection pool exhaustion
  // Default Node test runner runs 4 tests in parallel; we reduce to 1 for DB tests
  const result = spawnSync('node', [
    '--require', 'tsx/cjs',
    '--test',
    '--test-concurrency=1',  // Sequential execution to prevent DB connection exhaustion
    ...testFiles
  ], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { ...process.env, ...offlineEnv, NODE_ENV: 'test' },
  })

  process.exit(result.status ?? 1)
}

runTests().catch((err) => {
  console.error(err)
  process.exit(1)
})

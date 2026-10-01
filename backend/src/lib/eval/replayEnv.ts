/**
 * Import FIRST, before anything that loads the app.
 *
 * The replay drives the real chat route, so it must not be able to touch
 * anything a buyer sees:
 * - LLM_STUB: every model call becomes a fixed marker (see ai/llmStub.ts).
 * - Redis off: the semantic and answer caches fall back to memory, so a stub
 *   answer can never be written into the production cache and served to a
 *   real buyer. dotenv never overrides a variable already set, even to ''.
 * - Provider and search keys faked, in case any path calls a vendor directly.
 */
process.env.NODE_ENV = 'test'
process.env.LLM_STUB = '1'
process.env.UPSTASH_REDIS_REST_URL = ''
process.env.UPSTASH_REDIS_REST_TOKEN = ''
process.env.UPSTASH_REDIS_URL = ''
process.env.UPSTASH_REDIS_TOKEN = ''
process.env.TURN_TRACE = 'off'
for (const k of [
  'GEMINI_API_KEY', 'GEMINI_API_KEY1', 'GEMINI_API_KEY2', 'GROQ_API_KEY', 'GROQ_API_KEY1', 'GROQ_API_KEY2', 'GROQ_API_KEY3',
  'MISTRAL_API_KEY', 'MISTRAL_API_KEY1', 'COHERE_API_KEY', 'NVIDIA_API_KEY', 'CLOUDFLARE_API_KEY', 'OPENAI_API_KEY',
  'TAVILY_API_KEY', 'SERPER_API_KEY', 'JINA_API_KEY',
]) process.env[k] = 'offline-test-key-not-a-real-credential'

export {}

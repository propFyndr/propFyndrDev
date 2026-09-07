// backend/src/lib/config.ts
// Centralized configuration module — env-overridable settings for AI, financial, discovery

export const MODELS = {
  MAIN: process.env.OPENAI_AZURE_MODEL || 'gpt-4o',
  FALLBACK: process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini',
  GEMINI_MAIN: process.env.GEMINI_MAIN_MODEL || 'gemini-3.6-flash',
  GEMINI_LITE: process.env.GEMINI_LITE_MODEL || 'gemini-3.5-flash-lite',
  OPENAI_AZURE: process.env.OPENAI_AZURE_MODEL || 'gpt-4o',
  OPENAI_FALLBACK: process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini',
  // llama-3.1-8b-instant and llama-3.3-70b-versatile were deprecated by Groq (June 2026,
  // free/developer tier). Groq's own migration guidance: gpt-oss-20b / gpt-oss-120b.
  GROQ_FAST: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
  GROQ_SMART: process.env.GROQ_SMART_MODEL || 'openai/gpt-oss-120b',
}

export const AI_CONFIG = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || 'https://models.inference.ai.azure.com',
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
  GROQ_API_KEY: process.env.GROQ_API_KEY,
}

export const FINANCIAL = {
  EMI_RATE: parseFloat(process.env.EMI_RATE || '8.75'),
  LOAN_TENURE_YEARS: parseInt(process.env.LOAN_TENURE || '20', 10),
}

export const DISCOVERY = {
  DEFAULT_CITY: process.env.DEFAULT_CITY || 'Noida',
  SAFE_TOKEN_CEILING: parseInt(process.env.SAFE_TOKEN_CEILING || '2000', 10),
  MAX_TOKENS_RESPONSE: parseInt(process.env.MAX_TOKENS_RESPONSE || '1500', 10),
  MAX_TOKENS_ADVISORY: parseInt(process.env.MAX_TOKENS_ADVISORY || '400', 10),
  MAX_TOKENS_COMPARISON: parseInt(process.env.MAX_TOKENS_COMPARISON || '800', 10),
  CHIP_INVENTORY_CACHE_MINUTES: 10,
}

export const FEATURES = {
  ENABLE_GEMINI_FALLBACK: process.env.ENABLE_GEMINI_FALLBACK !== 'false', // Default: true
}

export const VALIDATION = {
  MIN_DISCOVERY_SCORE: 10, // Minimum score threshold for fallback results
}

export type ProviderType = 'groq' | 'mistral' | 'openai' | 'gemini'

export interface FallbackKeyConfig {
  provider: ProviderType
  envKey: string
  model: string
  supportsTools: boolean
  label: string
  /** Billing tier of the KEY, not the model. */
  tier?: 'paid' | 'free'
  /** Gemini API version for this leg. */
  apiVersion?: 'v1' | 'v1beta'
  /**
   * OpenAI-compatible host for this leg, when it is not api.openai.com.
   *
   * Cohere and NVIDIA both speak the OpenAI chat-completions shape, tool calls
   * included, so they are `provider: 'openai'` legs that differ only by host.
   * That is the whole integration — no second adapter, no second stall timer,
   * no second cooldown key space. Only meaningful for `provider: 'openai'`.
   */
  baseUrl?: string
}

/**
 * Env-var spellings we accept for a provider, canonical name first.
 *
 * The keys were added to `.env` as `NIVIDIA_API_KEY` and `CLOUDFARE_API_KEY`.
 * Both are misspelled, and a chain leg that reads the correct spelling finds
 * nothing and skips silently — which looks identical to "no key configured"
 * in the logs and costs an afternoon to find. Aliasing at load is three lines;
 * making the chain read the typo forever is a permanent tax on every reader.
 */
const ENV_ALIASES: Record<string, readonly string[]> = {
  NVIDIA_API_KEY: ['NIVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY'],
  COHERE_API_KEY: ['COHERE_KEY'],
  CLOUDFLARE_API_KEY: ['CLOUDFARE_API_KEY', 'CLOUDFLARE_API_TOKEN'],
  // Both the misspelling and the shortened form. `CLOUDFARE_ACC_ID` is what is
  // actually in .env; a leg reading the canonical name found nothing and was
  // skipped in silence, which reads exactly like "no key configured".
  CLOUDFLARE_ACCOUNT_ID: ['CLOUDFARE_ACCOUNT_ID', 'CLOUDFARE_ACC_ID', 'CLOUDFLARE_ACC_ID'],
}

for (const [canonical, aliases] of Object.entries(ENV_ALIASES)) {
  if (process.env[canonical]) continue
  const found = aliases.find((a) => process.env[a])
  if (!found) continue
  process.env[canonical] = process.env[found]
  console.warn(`[CONFIG:ENV_ALIAS] ${found} read as ${canonical} — rename it in .env to silence this.`)
}

/**
 * Whether Gemini is allowed to call tools.
 *
 * Two switches used to control this independently and could disagree:
 * gemini.ts attaches the tool definitions when ENABLE_GEMINI_TOOLS === 'true',
 * while FALLBACK_CHAIN hardcoded supportsTools: false — and that flag is what
 * getBaseSystemPrompt(toolsEnabled) keys off. Setting the env var alone
 * therefore handed Gemini a tool catalogue together with a system prompt whose
 * NO LIVE LOOKUPS section states, verbatim, "You cannot call tools here."
 *
 * Deriving both from one constant makes that state unreachable. Default is
 * unchanged (off): Gemini is tier 1 and serves nearly all traffic, so turning
 * tools on there changes every response and wants a deliberate rollout.
 *
 * NOTE: while this is off, every tool-backed lookup — floor plans, price
 * history, cost sheets, amenities, builder records, RERA — is unreachable in
 * production, and the model answers from the NO LIVE LOOKUPS branch instead.
 */
export const GEMINI_TOOLS_ENABLED = process.env.ENABLE_GEMINI_TOOLS === 'true'

/**
 * Which Gemini keys are free-tier, by env-var name.
 *
 * A free key cannot hold a context cache, is limited per-minute rather than per
 * dollar, and gets no thinking budget and a tighter reply ceiling. Hardcoding
 * which key that is means topping up the OTHER key silently throttles it as
 * though it were free. Set GEMINI_FREE_TIER_KEYS to flip it without a deploy.
 */
const FREE_TIER_KEYS = new Set(
  (process.env.GEMINI_FREE_TIER_KEYS ?? 'GEMINI_API_KEY1,GEMINI_API_KEY2')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

/** True when this env var names a key we know to be on the free tier. */
export const isFreeTierKey = (envKey: string): boolean => FREE_TIER_KEYS.has(envKey)

/**
 * Two hosts that are both gone, kept here only to warn a deploy that still
 * points at either of them.
 *
 * `models.inference.ai.azure.com` stopped resolving in DNS — a request to it
 * fails with a bare connection error in under 200ms.
 *
 * `models.github.ai/inference` was the successor, and the redirect that used
 * to live here sent traffic there on the reading that a brownout is an outage
 * a service returns from. It is not: **GitHub Models closed to new customers
 * on 16 Jun 2026 and retired completely on 30 Jul 2026.** Probed 30 Aug 2026
 * it answers `410 github_models_retirement_brownout`, and it will not stop.
 *
 * So the redirect is removed. A leg pointed at either host is dead weight —
 * it fails, cools for an hour, and is probed again, four times over, at the
 * head of nearly every turn. The four `OPENAI_API_KEY*` legs it propped up are
 * replaced by Cohere and NVIDIA below, which speak the same protocol and are
 * verifiably alive.
 */
const RETIRED_OPENAI_HOSTS = /models\.inference\.ai\.azure\.com|models\.github\.ai/

export const OPENAI_BASE_URL = (() => {
  const configured = process.env.OPENAI_BASE_URL?.trim()
  if (!configured) return undefined // the SDK default, api.openai.com
  if (RETIRED_OPENAI_HOSTS.test(configured)) {
    console.warn(
      `[CONFIG:CHAIN] OPENAI_BASE_URL points at ${configured}, which is retired and will ` +
      'never answer. Ignoring it. Set it to a live OpenAI-compatible deployment, or unset ' +
      'it to use api.openai.com.',
    )
    return undefined
  }
  return configured
})()

/** Cohere's OpenAI-compatible surface. Verified 30 Aug 2026: streams, calls tools. */
const COHERE_OPENAI_BASE = 'https://api.cohere.ai/compatibility/v1'
/** NVIDIA NIM's OpenAI-compatible surface. Verified 30 Aug 2026: streams, calls tools. */
const NVIDIA_OPENAI_BASE = 'https://integrate.api.nvidia.com/v1'
/**
 * Groq's OpenAI-compatible surface.
 *
 * `groq.ts` / `streamWithGroq` — the bespoke adapter this chain used to call —
 * has no tool-call loop at all: it never sends a `tools` array and never
 * handles a `tool_calls` delta, truncates the system prompt to 8,000 characters
 * and the message history to the last 3 turns at 2,000 characters each, and
 * hardcodes `MODELS.GROQ_SMART` regardless of which key or leg is calling it —
 * so all four Groq legs below were silently the same model even when config
 * said otherwise. None of that is a Groq limitation: Groq serves the exact
 * OpenAI chat-completions protocol, tool calls included, at this host.
 *
 * Routing Groq through the shared `openai` adapter — the same one already
 * serving Cohere, NVIDIA and Cloudflare — gets the real tool-call loop, the
 * real per-leg model, and the full facts block for free. One adapter, one
 * stall timer, one cooldown key space; see `vendorOf` for why it still gets
 * its own rate-budget bucket.
 */
const GROQ_OPENAI_BASE = 'https://api.groq.com/openai/v1'

/**
 * A floor under Groq's reply ceiling, above whatever the turn's profile asks
 * for — the mirror image of `MISTRAL_MAX_TOKENS`, which is a cap below the
 * profile. Mistral needed less because it ran away past what it could
 * actually finish; Groq needs more for the opposite reason.
 *
 * Measured 7 Sep 2026, the day these legs first carried real traffic instead
 * of being wrongly skipped as tool-blind (see the TIER 2b comment above):
 * 65 of 174 corpus answers routed to `openai/gpt-oss-20b` were cut mid-
 * sentence, with completion tokens landing almost exactly on the shared
 * per-shape ceilings in inferenceProfile.ts — 700 for `lookup`, 1200 for
 * `factual`. Whether that means gpt-oss-20b is genuinely more verbose per
 * token than Gemini for the same content, or the ceilings were simply never
 * exercised at scale before today (Groq served near-zero traffic until this
 * fix), is not yet known — this is a first attempt, not a settled number.
 *
 * 1,600 is chosen to match `advisory`'s existing ceiling exactly: it lifts
 * `lookup` and `factual` without changing `advisory` or `reasoning`, which
 * were not the shapes truncating. Move it only with a corpus run showing
 * what the new value fixes — the same discipline MISTRAL_MAX_TOKENS was
 * tuned under.
 */
export const GROQ_MIN_REPLY_TOKENS = Number(process.env.GROQ_MIN_REPLY_TOKENS ?? 1600)

/** The reply ceiling actually sent to a Groq leg, after raising the turn profile's floor. */
export const groqReplyCeiling = (profileMaxTokens?: number): number =>
  Math.max(profileMaxTokens ?? 700, GROQ_MIN_REPLY_TOKENS)

/**
 * The company behind a leg, which is not the same as its `provider`.
 *
 * Cohere, NVIDIA and Cloudflare are all `provider: 'openai'` because they share
 * one adapter. They are three independent companies with three independent rate
 * limits, and anything reasoning about capacity or diversity has to tell them
 * apart — a "distinct providers answering: 1" reading that lumps them together
 * describes a chain that does not exist, and a shared rate budget would
 * throttle three vendors against one allowance.
 */
export function vendorOf(leg: Pick<FallbackKeyConfig, 'provider' | 'baseUrl'>): string {
  if (leg.provider !== 'openai') return leg.provider
  if (!leg.baseUrl) return 'openai'
  if (/cohere/.test(leg.baseUrl)) return 'cohere'
  if (/nvidia/.test(leg.baseUrl)) return 'nvidia'
  if (/cloudflare/.test(leg.baseUrl)) return 'cloudflare'
  if (/groq/.test(leg.baseUrl)) return 'groq'
  return 'openai-compatible'
}

/**
 * Cloudflare Workers AI, which is scoped per account rather than per key.
 *
 * Undefined when the account id is absent, and the leg below is then dropped —
 * a token on its own cannot address an endpoint, and a leg pointed at
 * `/accounts/undefined/` fails on every turn while looking configured.
 */
const CLOUDFLARE_OPENAI_BASE = process.env.CLOUDFLARE_ACCOUNT_ID
  ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`
  : undefined

export const FALLBACK_CHAIN: FallbackKeyConfig[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1 — GEMINI. The only legs that can call a tool.
  // ═══════════════════════════════════════════════════════════════════════════
  // Every leg above the first tool-blind one can run sector_projects,
  // rera_check and the rest. That ordering is the difference between an answer
  // built from our rows and one a tool-blind model reasons out from memory,
  // which is where every fabrication in the 30 Aug corpus runs came from.
  //
  // Free keys lead. Flash-Lite rather than Flash on them: the free tier's
  // per-day request allowance is far higher on the lite model, so these legs
  // keep answering after a Flash-shaped one is spent for the day. The empty
  // replies that once made this ordering dangerous are fixed at the root —
  // fallbackChain forces thinkingBudget = 0 and a FREE_TIER_MAX_TOKENS ceiling
  // for any key isFreeTierKey() names.
  //
  // Probed 30 Aug: KEY1 and KEY2 answer, KEY3 is not set yet and is skipped
  // without cost, the billed KEY is out of prepay credit. It stays in place so
  // that a top-up is picked up without a deploy.
  // Three keys, five legs — and the count is worth being precise about,
  // because a leg for a key that does not exist reads as capacity we have.
  // `GEMINI_API_KEY3` was one of those: it was never set, so `verify:chain`
  // printed a permanent "no key" row and the chain advertised four free legs
  // where two exist. Removed. Add it back the day a third free key does.
  { provider: 'gemini', envKey: 'GEMINI_API_KEY1', model: MODELS.GEMINI_LITE, supportsTools: GEMINI_TOOLS_ENABLED, label: 'Gemini 3.5 Flash Lite (free 1)' },
  { provider: 'gemini', envKey: 'GEMINI_API_KEY2', model: MODELS.GEMINI_LITE, supportsTools: GEMINI_TOOLS_ENABLED, label: 'Gemini 3.5 Flash Lite (free 2)' },
  // Same billed key twice, deliberately: the smart model first, then the lite
  // one as a cheaper retry before the turn leaves Google entirely.
  { provider: 'gemini', envKey: 'GEMINI_API_KEY', model: MODELS.GEMINI_MAIN, supportsTools: GEMINI_TOOLS_ENABLED, label: 'Gemini 3.6 Flash (billed)' },
  { provider: 'gemini', envKey: 'GEMINI_API_KEY', model: MODELS.GEMINI_LITE, supportsTools: GEMINI_TOOLS_ENABLED, label: 'Gemini 3.5 Flash Lite (billed)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2 — COHERE + NVIDIA. Tool-capable, and not Google.
  // ═══════════════════════════════════════════════════════════════════════════
  // Until 30 Aug 2026 this tier was four `OPENAI_API_KEY*` legs against GitHub
  // Models. That service is retired, not merely browned out, so all four were
  // dead: each failed, cooled for an hour, and was probed again, which is four
  // wasted round-trips at the head of nearly every turn. Below them every
  // remaining leg was tool-blind, so the moment Gemini's free quota was spent
  // the chain had no way to read a project row — and a leg that cannot look
  // anything up either refuses or invents. That is where every fabrication in
  // the corpus runs came from.
  //
  // Both replacements speak the OpenAI chat-completions protocol, tool calls
  // included, so they are `provider: 'openai'` legs that differ only by
  // `baseUrl`. No second adapter, no second stall timer.
  //
  // Model choices are measured, not assumed. Probed 30 Aug 2026, same tool
  // schema the chat actually uses, cold call then warm call:
  //
  //   cohere/command-a-03-2025          1.1s / 0.9s   clean tool_call, streams
  //   nvidia openai/gpt-oss-20b         2.3s / 2.4s   clean tool_call, streams
  //   nvidia nemotron-3.5-lightning     2.7s / 2.3s   clean tool_call, streams
  //
  // and the ones deliberately NOT here, with why:
  //
  //   cohere/command-a-plus-05-2026     emitted `sector_projects({})` — dropped
  //                                     the required argument — and streamed 32
  //                                     chunks of empty content. Newer, worse.
  //   nvidia openai/gpt-oss-120b        5.3s then 35.1s on the identical call.
  //                                     That variance IS the p99 we are trying
  //                                     to remove; a leg cannot fix the tail by
  //                                     joining it.
  //   nvidia nemotron-3-super-120b      answered "I need to use the tool" as
  //                                     prose instead of calling it. Tool
  //                                     adherence has to be reliable, not
  //                                     usually.
  //   nvidia meta/llama-3.3-70b,        410 Gone — both reached end of life on
  //          nemotron-super-49b         26 Aug 2026, four days before this.
  //   nvidia gemma-4-31b, minimax-m3,   no response inside 120s, twice.
  //          deepseek-v4-flash
  //
  // Cohere leads the tier on latency. NVIDIA follows with two independent
  // models on one key, which is a second and third allowance rather than a
  // duplicate.
  { provider: 'openai', envKey: 'COHERE_API_KEY', model: 'command-a-03-2025', supportsTools: true, baseUrl: COHERE_OPENAI_BASE, label: 'Cohere Command A' },
  { provider: 'openai', envKey: 'NVIDIA_API_KEY', model: 'openai/gpt-oss-20b', supportsTools: true, baseUrl: NVIDIA_OPENAI_BASE, label: 'NVIDIA gpt-oss-20b' },
  { provider: 'openai', envKey: 'NVIDIA_API_KEY', model: 'nvidia/nemotron-3.5-lightning-30b-a3b', supportsTools: true, baseUrl: NVIDIA_OPENAI_BASE, label: 'NVIDIA Nemotron 3.5 Lightning' },

  // Cloudflare Workers AI. Third vendor in this tier, on a daily neuron
  // allowance rather than a per-minute one, so it is the leg still standing
  // when the others are rate-limited within a minute.
  //
  // Probed 30 Aug: llama-4-scout answered a tool call in 634ms and streamed 23
  // chunks of real content at 540ms to first token — the fastest tool-capable
  // leg in the chain. `@cf/openai/gpt-oss-20b` also tool-called cleanly but
  // streamed 61 chunks of EMPTY content, the same way Cohere's plus model did,
  // so it is left out: a leg that returns nothing is worse than one that is
  // absent, because it costs a turn to discover. `kimi-k2.6` is 403 on the
  // free plan and `qwen3-coder` does not exist on this account.
  ...(CLOUDFLARE_OPENAI_BASE
    ? [{
      provider: 'openai' as const,
      envKey: 'CLOUDFLARE_API_KEY',
      model: '@cf/meta/llama-4-scout-17b-16e-instruct',
      supportsTools: true,
      baseUrl: CLOUDFLARE_OPENAI_BASE,
      label: 'Cloudflare Llama 4 Scout',
    }]
    : []),

  // No leg for `OPENAI_API_KEY` itself. The four keys under that name in `.env`
  // are GitHub PATs, and with the retired host no longer substituted they would
  // now be sent to api.openai.com, where a PAT is a 401 — a dead leg wearing a
  // different error. If a real OpenAI key is ever bought, this is the one line:
  //   { provider: 'openai', envKey: 'OPENAI_API_KEY', model: MODELS.MAIN, supportsTools: true, label: 'OpenAI (direct)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2b — GROQ. Tool-capable, four keys, two models.
  // ═══════════════════════════════════════════════════════════════════════════
  // These four were TIER 3 (tool-blind) until 7 Sep 2026, each running
  // MODELS.GROQ_SMART = 'openai/gpt-oss-120b' with supportsTools: false and no
  // reason given — twenty lines above, the *same model family* served through
  // NVIDIA (openai/gpt-oss-20b) was already flagged supportsTools: true, with a
  // probe note recording a clean tool_call. Groq's own model docs confirm both
  // gpt-oss-20b and gpt-oss-120b support tool calling. That was a bug, not a
  // measured limitation, and it meant six of fourteen legs in this chain were
  // told they could not read the database at the exact point traffic falls
  // through to them — Gemini's quota spent, Cohere/NVIDIA/Cloudflare exhausted.
  // See config.ts's GROQ_OPENAI_BASE comment for why these are `provider:
  // 'openai'` rather than `provider: 'groq'`.
  //
  // Four keys, four independent per-minute allowances, split across both
  // models rather than run identically: gpt-oss-20b (1000 tok/s, $0.075/$0.30
  // per 1M) tries first on two keys — cheaper and faster than every other
  // tool-capable leg in this chain including Gemini — then gpt-oss-120b (500
  // tok/s, $0.15/$0.60, the stronger model) on the other two as an escalation.
  // If one model family has a problem, the other pair is unaffected.
  //
  // Free tier is 8,000 tokens/minute (Groq's published limit); our prompts run
  // ~13,000 tokens with the facts block attached, so these legs need the paid
  // Developer tier (250,000 TPM) to answer at all — a free key here silently
  // 429s on every real turn. Confirm the account tier before relying on them.
  { provider: 'openai', envKey: 'GROQ_API_KEY', model: 'openai/gpt-oss-20b', supportsTools: true, baseUrl: GROQ_OPENAI_BASE, label: 'Groq gpt-oss-20b (key 1)' },
  { provider: 'openai', envKey: 'GROQ_API_KEY1', model: 'openai/gpt-oss-20b', supportsTools: true, baseUrl: GROQ_OPENAI_BASE, label: 'Groq gpt-oss-20b (key 2)' },
  { provider: 'openai', envKey: 'GROQ_API_KEY2', model: 'openai/gpt-oss-120b', supportsTools: true, baseUrl: GROQ_OPENAI_BASE, label: 'Groq gpt-oss-120b (key 3)' },
  { provider: 'openai', envKey: 'GROQ_API_KEY3', model: 'openai/gpt-oss-120b', supportsTools: true, baseUrl: GROQ_OPENAI_BASE, label: 'Groq gpt-oss-120b (key 4)' },

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3 — TOOL-BLIND. Prose only; toolBlindGuard checks whatever they write.
  // ═══════════════════════════════════════════════════════════════════════════
  // Both Mistral keys answer (probed 30 Aug). Two keys rather than one matters:
  // Mistral's free tier rate-limits per key, so the second is a full extra
  // allowance rather than a duplicate.
  //
  // Mistral's own docs advertise function calling on mistral-small-latest, so
  // this tier may shrink to zero legs once that is probed the same way Groq's
  // flags were — not done in this pass; see PROGRESS.md.
  { provider: 'mistral', envKey: 'MISTRAL_API_KEY', model: 'mistral-small-latest', supportsTools: false, label: 'Mistral Small (key 1)' },
  { provider: 'mistral', envKey: 'MISTRAL_API_KEY1', model: 'mistral-small-latest', supportsTools: false, label: 'Mistral Small (key 2)' },

  // Cerebras is gone. Both keys returned 402 "payment required" on every probe
  // across three days, and the free tier they would otherwise fall back to caps
  // context at 8,192 tokens — smaller than our system prompt plus a facts
  // block, so it would truncate silently even if it were paid for.
  //
  // Two dead legs at the tail cost an hour-long cooldown each and a probe an
  // hour forever. The chain has fourteen answering legs across six vendors
  // without them.
  //
  // To bring it back: top up the account, then re-add
  //   { provider: 'cerebras', envKey: 'CEREBRAS_API_KEY', model: 'gpt-oss-120b', supportsTools: false, label: 'Cerebras gpt-oss-120b' },
  // and raise the free-tier context concern with a real measurement first.
]

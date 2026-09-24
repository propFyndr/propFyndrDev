# PropFyndr Implementation Plan — Phase-Wise

Source: `Revision 3` (artifact published 7 Sep 2026) + the four-Groq-key follow-up.
Tracking: see `PROGRESS.md` in this same directory, updated as each item lands.
Full reasoning for every item lives in the Revision 3 artifact; this file is the
execution checklist derived from it.

---

## Phase 0 — AI provider chain correctness (in progress)

Fixing what the chain is actually configured to do before touching anything downstream of it.

- [x] **Flip the four Groq `supportsTools` flags.** Verified against Groq's own docs and a live tool-call probe (all 4 keys, both models, correct `tool_call` emitted in ~500-600ms).
- [x] **Migrate Groq legs from the bespoke `groq.ts` adapter to the shared OpenAI-compatible adapter** (`streamWithOpenAI` + `baseUrl: https://api.groq.com/openai/v1`). The bespoke adapter had no tool-call loop at all, truncated the system prompt to 8,000 chars and history to 3 turns, and hardcoded one model regardless of which key was calling — none of that was a Groq limitation, it was the adapter.
- [x] **Split the 4 keys across both models**: `gpt-oss-20b` (fast/cheap, keys 1-2) tries first, `gpt-oss-120b` (stronger, keys 3-4) as escalation.
- [x] **Fixed `vendorOf()`** so Groq legs still get their own rate-budget bucket (25 req/min) instead of falling into the generic `openai-compatible` bucket.
- [x] **Found and fixed 2 dependent regressions** my change would have caused: `chips.ts` and `intent.ts` both maintain their own copies of the FALLBACK_CHAIN dispatch logic (a pre-existing duplication, not introduced by this work) and both would have silently sent Groq's traffic to the retired Azure host under the wrong model name. Both now respect `item.baseUrl` / `item.model` like the main chain already does.
- [x] Typecheck clean, lint clean, 66/66 relevant tests pass, `verify:chain` confirms all 4 keys answer.
- [x] **Probed Mistral's two keys for real tool support** — twice, hours apart. Both return `HTTP 429 rate_limited` both times, which reads as an account-level quota rather than a transient limit. Left `supportsTools: false` unchanged; worth retrying once the account is checked, not something to keep polling.
- [ ] **Fix `.env.example` at repo root** — `ENABLE_GEMINI_TOOLS="false"` ships as the default; any fresh deploy loses every database lookup. **Blocked**: the root `.env.example` is outside my permitted paths this session — this is a one-line edit for you to make (line 43: `"false"` → `"true"`), or grant access and I'll do it.
- [ ] **Resolve `GEMINI_DAILY_BUDGET_USD`** — `backend/.env` sets it twice (10.00, then 5.00; the later wins). Your call, not mine to guess on a real credentials file.
- [ ] **Reconcile the two tool catalogues** — `tools.ts` (23 tools) and `toolRegistry.ts` (19 tools) diverge by 12 names. Add a test that fails when they disagree.
- [ ] **Instrument tool-call rate** — no counter, event, or trace exists today on the single most load-bearing mechanism in the chain.
- [ ] **Add `npm run corpus`** — the 321-question test set exists and has no npm script; it currently must be typed by hand against a live server. Commit a baseline pass rate, wire into CI.

## Phase 1 — Chat integrity & retrieval

- [x] ~~Move the fabrication guard to the `send()` choke point~~ — **premise was wrong, checked and closed, no code change.** Read all 16 `persistEarlyTurn` lanes individually rather than trusting the earlier count: `send('token', ...)` fires per streamed chunk, so a literal move there would run the integrity check on text fragments, which is architecturally wrong — it needs the whole finished answer. More importantly, there is no gap to move it to: every one of the 3 places in `chat-router.ts` that actually invokes a model goes through `executeWithFallbackChain` already (confirmed — zero direct `streamWith*` calls anywhere else in the file), which already runs `checkAnswerIntegrity`. Of the 16 `persistEarlyTurn` sites, 12 are pure static/template strings with no model involvement and nothing to fabricate (greeting, thank-you, jailbreak notice, off-topic, ID-document decline, transcript recall, history recall, referent-foreign, coverage-decline, builder-coverage), `unknown-project` and the open-query `lane` both call `runGroundedAnswer` → `executeWithFallbackChain` internally, `ground-truth-db` (project-detail) calls `executeWithFallbackChain` directly, and `topic-handler` already runs `scanDisclosure` explicitly with a comment on record explaining why. The "16 unguarded lanes" claim in Revision 3 came from counting `persistEarlyTurn` call sites as a proxy for risk without checking what produced each one's text — corrected here rather than left standing.
- [ ] Instrument empty-retrieval rate and coverage-gap logging at the retrieval boundary.
- [x] Instrumented empty-retrieval rate — `recordRetrieval()` in `lib/discovery/retrievalStats.ts`, wired at the one `discoverProjects()` call site. Same in-memory/per-process shape as the tool-call counter; a persisted version is the same Phase 4 schema decision.
- [ ] **Blocked: hybrid retrieval.** Confirmed embeddings do **not** exist in the live DB — `SELECT count(*) FROM projects WHERE embedding IS NOT NULL` returns 0 of 280. The generation script (`frontend/scripts/generate-embeddings.ts`, Jina, complete and ready) needs `JINA_API_KEY`, which is not set anywhere. The HNSW index script (`add-vector-index.ts`) is a DDL change against the live DB and needs your explicit go-ahead, not something to run quietly. Writing the retrieval-side code into the highest-traffic function in the app with no embeddings to verify against isn't the right move blind. **Needs from you: a Jina API key (free tier), and a yes on running the index-creation script.**
- [x] **Investigated: key the answer cache by which lane answered.** The load-bearing bug this was meant to fix — a project-specific answer cached under a project-free key, replayed to the wrong buyer — is **already fixed**, on both write sites, by an `(intent.projectNames?.length ?? 0) === 0` guard that simply refuses to cache anything project-specific at all (stricter than lane-keying would have been). What remains is lower-stakes: the cache can't surgically invalidate just one lane's entries after a routing change, only flush everything (`REDIS_PREFIX` bumped by hand, 8 times so far) — an efficiency question, not a correctness one, and one I can't verify without live traffic to measure hit-rate against. Not changed.

## Phase 2 — Every element of the project page answerable in chat

- [ ] **Decision needed from you**: the score-exposure question (`ProjectDna` scores / `recommendation_profile.tier` rendered on the page as "AI Score" / "Strong Buy" while the exposure policy calls them internal). Remove from the page, or promote them properly with a stated basis and verification date.
- [ ] Make the exposure allowlist the single source of truth for both the detail page route and the chat facts block (currently the page bypasses it).
- [ ] Wire `unit_inventory`, `channel_partners`, `competitors` into the facts block — permitted today, never requested.
- [x] **Widened the builder relation past `name`.** `buildProjectFacts` now projects the full builder relation through the same `cleanRelation` helper cost_sheet/decision_profile/etc. already use — `founded_year`, delivered/ongoing counts, average handover delay, RERA promoter id, awards, CREDAI/ISO status all reach the model now, with the opaque 0-100 analyst scores (`delivery_score`, `construction_quality_score`, `rera_compliance_score`, and the newly-added `financial_hygiene_score`) and corporate-registry/process fields (`cin`, `legal_entities`, `executives`, `outstanding_dues_cr`, `audit_flags_log`, `verification_level`, `data_source`, `intelligence_completeness`, `last_verified_at`) stripped, matching exactly what `builderReputationHandler` already treats as safe. Data was already being fetched (`builder: true` at the one call site that matters) — this was a pure projection-layer fix, no query change. Also closed a real gap found along the way: the exposure test suite only ever parsed `model Project {` — Builder's ~40 columns had **never** been classified as public or internal by anything. Extended the test to cover Builder the same way, which is what caught 2 fields (`id`, `last_verified_at`) I'd missed on the first pass.
- [ ] **Not done: deleting `builderReputationHandler`.** The widened relation only closes the gap that motivated the handler for a *single project already in context* — the handler also does a league-table ranking across all builders and specific chip logic the generic path doesn't automatically replicate just because the facts are richer. Deleting it needs the corpus-parity check this plan already specifies before any handler retirement, which needs a live server and real spend — not triggered blind.

## Phase 3 — "Nothing hardcoded": retire the handlers

- [ ] Keep `reraVerification.ts` and `statutoryTax.ts` (165 lines — genuinely not lookups; statutory tier by definition).
- [ ] Retire `amenityLifestyle.ts` first (already redundant by its own comment), then `connectivity.ts`, `unitConfiguration.ts`, `totalOutflow.ts`, `possessionStatus.ts` — each gated by a corpus run at parity.
- [ ] Build the query planner + generic resolver + shape-keyed renderers that replace the remaining handlers.
- [ ] Delete the two inline lanes (open-query, project-detail) last — largest, and dependent on everything above.
- [x] **Ran the corpus baseline this needs — twice — and found it cannot be trusted yet, for reasons unrelated to any handler.** See the two entries below; retirement is on hold until a clean signal exists.
- [x] **Found the committed `results-baseline.json` is not usable at all** — 321/321 rows are `"error": "fetch failed"`, generated against an unreachable server and never regenerated. Confirmed other archived runs (`results-fix1.json`, `results-final.json`, etc.) are real, so this is specific to the one file literally named "baseline."
- [x] **Ran a clean 321-query corpus pass and found two confounds, not a code regression**: (1) Gemini's billed key has depleted prepay credits and Cohere's trial cap is spent — both already true hours before this session touched anything, confirmed by an earlier `verify:chain` run — which pushes far more traffic onto Groq and free-tier Gemini than usual. (2) A Groq reply-ceiling issue (see below, fixed) and a separate, larger Gemini free-tier issue, **investigated to a confirmed root cause** (see Phase 6): 20 of 22 truncated answers in a 60-query subset came from `gemini-3.5-flash-lite`. First hypothesis (a stream stall) was wrong and corrected — confirmed via direct API replication that these are real `finishReason: MAX_TOKENS` hits on discovery/listing-shaped queries classified as `lookup` (700-token ceiling), not a network issue.
- [x] **Fixed a real, distinct issue found along the way**: added `groqReplyCeiling()` (`config.ts`) — a floor under Groq's reply ceiling (1600, mirroring `MISTRAL_MAX_TOKENS`'s cap in the opposite direction), because 65 of 174 Groq answers in the full run were cut mid-sentence with completion tokens landing almost exactly on the shared per-shape ceilings (700/1200) — the same class of bug already documented and fixed for Mistral, just never tuned for Groq because Groq got near-zero traffic before today's tool-flag fix. Verified: raises Groq's own truncation contribution down sharply in a follow-up subset run, though it does not fix the larger Gemini-side issue above. 3 new tests, full suite still green.

## Phase 4 — Identity & admin/CRM (Revision 2 + the gaps it couldn't see)

- [ ] **Decision needed**: confirm the 5-role set (`SUPER_ADMIN / ANALYST / SALES / BUILDER / PARTNER`).
- [ ] `User` model, per-user sessions, Prisma permission extension (replaces the single shared admin password and the `requireScope` middleware idea).
- [ ] Scheduler decision (cron service vs in-process) → Wave 0 rollups (`SessionFunnelEvent`, `WeeklyMetricsSummary`, `BuilderAnalytics`, `GhostPoolAnalysis`) + backfill.
- [ ] Four audience dashboards (builder / sales / analytics / engineering), saved views, the lead workspace + Buyer Dossier, dead-surface cleanup (`property-listings`, `promotions`, `bulk-update`).
- [ ] Builder portal, then partner hub (needs onboarding + lead-assignment schema).

## Phase 5 — Independent, can run anytime

- [ ] Spec precision (empty spec cards) + mobile viewport fixes — no dependency on anything above.
- [ ] Sector travel-time matrix + comparison diff (the two graph wins).
- [ ] Voice — Sarvam Saaras v4 `codemix` recommended; needs a 100-query entity-accuracy bake-off before committing, and has no dependency on the rest of this plan.

---

## Verification gates (apply throughout)

- `npm run check-all`, `npm run audit:retrieval` (≥98%), `npm run audit:prices` (0 contradictions)
- New: `npm run corpus`, `npm run audit:funnel`, `npm run audit:panels`, two-tenant scope suites
- Playwright viewport assertions at 320/375/414px

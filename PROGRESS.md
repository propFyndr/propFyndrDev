# Progress Tracker

Updated live as work lands. See `PLAN.md` for the full phase breakdown.

## Session: 2026-09-07

### ✅ Completed — Phase 0 (AI provider chain correctness)

**1. The 4 Groq keys, now used correctly**
- Flipped `supportsTools: false → true` on all 4 Groq legs — confirmed against Groq's own model docs AND a live probe (all 4 keys emit a correct `tool_call` in ~500-600ms against the real `sector_projects` schema).
- Migrated all 4 off the bespoke `groq.ts` adapter (no tool support, 8,000-char prompt truncation, hardcoded model regardless of which key called it) onto the shared OpenAI-compatible adapter already serving Cohere/NVIDIA/Cloudflare.
- Split the 4 keys across 2 models: keys 1-2 → `gpt-oss-20b` (1000 tok/s, cheapest tool-capable leg in the chain), keys 3-4 → `gpt-oss-120b` (stronger, escalation).
- Fixed `vendorOf()` so these legs keep their own 25 req/min rate budget.
- **Found and fixed 2 dependent regressions**: `chips.ts` (chip suggestions) and `intent.ts` (intent extraction) each keep independent copies of the fallback-chain dispatch, and both hardcoded the wrong host/model for any `provider: 'openai'` leg — pre-existing breakage for Cohere/NVIDIA/Cloudflare, would have newly broken Groq too. Both now respect `item.baseUrl` / `item.model`.
- Probed Mistral's 2 keys the same way — **currently rate-limited (429 on both)**, no result obtainable this session. `supportsTools: false` left unchanged; retry later.

**2. Tool catalogue reconciliation — 2 real bugs found and fixed, not just "diverging lists"**
- There are actually 3 catalogues in play, not 2: `tools.ts` (the real, API-callable function schemas), `toolRegistry.ts` (which names get selected into the visible prompt text per turn), and a third hardcoded description map inside `prompts/base.ts`. All three have to agree for a tool to actually work end-to-end.
- **`project_nearby` was a live bug**: described to the model in the prompt on every location/connectivity question ("call project_nearby for..."), had a working handler, but had **no real function schema** — so the model was told a capability existed that it could never actually invoke. Added the missing schema.
- **`select_property`**: same shape — a real handler, always selected as a "core" tool, no schema, no prose. Added both.
- **`project_financial_details`**: had a real schema and could technically be called, but was never in `toolRegistry.ts`'s selection list and had no prose describing it — so it was invisible to the model's actual decision-making even though callable. Added to the registry and the description map.
- **`best_value_projects`, `fastest_possession_projects`, `best_for_families_projects`**: promised in the registry with real keyword triggers, but **never had a schema or a handler at all** — a buyer asking "best value in Sector 150" got "temporarily unavailable" from a tool that had never existed. A comment in the test file claimed this was already fixed; it was not. Removed the dead promises rather than faking them onto `sector_projects` (which ranks differently and would have silently changed what "best value" means). Building these three properly is real feature work — added to `PLAN.md` as a follow-up, not guessed at here.
- Added a new test (`toolCatalogue.test.ts`) that checks the reverse direction the old test never covered: anything the registry can select into the prompt must have a real schema. This is what actually closes the loop and prevents this class of bug recurring.

**3. Tool-call instrumentation** — every tool call is now counted and logged (`[TOOL:CALL] <name> — <ms>ms[, ERROR]`), with an in-process `getToolCallStats()` ready for a future admin panel. This was previously zero — no counter, event, or trace existed on the single most load-bearing mechanism in the chat architecture. Deliberately in-memory/per-process for now; a persisted, cross-process version is a schema decision held for Phase 4, not guessed at here.

**4. `npm run corpus`** — the script was completely missing; the 321-question grader could only be run by typing the full `tsx` command by hand. Added. A committed baseline already exists (`results-baseline.json`) from a prior run. Running a fresh full pass costs real LLM spend across 321 queries against a live server — not triggered automatically; say the word and I will.

**Verification, all of the above:**
- `tsc --noEmit`: clean
- `eslint --max-warnings=0` on every touched file: clean
- Targeted test runs: 66/66 (chain-shape + rate-budget suites) + 17/17 (tool catalogue suites) pass
- `npm run verify:chain`: confirms live connectivity on all 4 Groq keys
- Direct tool-schema probe (not just connectivity): confirms real `tool_call` emission on all 4 Groq keys, both models
- Full `npm test` (whole backend suite, 2,864 tests) — first run: **5 failures**, all in `intent-extraction-fallback.test.ts`. Second run (after fixing that): **1 more failure**, in `intent.test.ts`. Both were the exact same bug in two more copies of the same hardcoded test fixture: not a bug in my production change — that fix was correct — but it exposed a pre-existing gap in a test's hardcoded key-removal list that never included `CLOUDFLARE_API_KEY` (and, in the second file, was also missing `COHERE_API_KEY`/`NVIDIA_API_KEY`, currently masked only because those trial keys are separately exhausted). Before my fix, the Cloudflare leg hit a dead hardcoded host regardless of which key was cleared and failed anyway, coincidentally masking the test gap; once `extractWithOpenAIKey` started respecting each leg's real host (the actual bug I was fixing), Cloudflare started actually answering during the "all providers gone" test setup, and the "outage" these tests exist to describe stopped being a real outage. Fixed both test fixtures, not the production code. **Third run: 2,089 pass, 0 fail, exit 0. Confirmed clean.**

Files touched: `backend/src/lib/config.ts`, `backend/src/lib/ai/prompts/chips.ts`, `backend/src/lib/ai/intent.ts`, `backend/src/lib/ai/tools.ts`, `backend/src/lib/ai/toolRegistry.ts`, `backend/src/lib/ai/prompts/base.ts`, `backend/src/lib/ai/tools/handlers.ts`, `backend/src/lib/ai/__tests__/toolCatalogue.test.ts`, `backend/src/lib/ai/intent-extraction-fallback.test.ts`, `backend/src/lib/ai/__tests__/intent.test.ts`, `backend/package.json`.

Nothing has been committed — working tree only, awaiting your go-ahead.

### 🚧 Blocked — needs you

- **Root `.env.example` line 43** (`ENABLE_GEMINI_TOOLS="false"`) — outside my permitted paths this session. One-line fix: change to `"true"`.
- **`backend/.env` has `GEMINI_DAILY_BUDGET_USD` set twice** (10.00, then 5.00). Tell me which and I'll dedupe it.
- **Mistral tool-support probe** — both keys rate-limited right now; retry when they've cooled down.
- **New follow-up found this session**: `best_value_projects` / `fastest_possession_projects` / `best_for_families_projects` need real design (what does "best value" mean exactly?) before they're worth building — added to Phase 0 of `PLAN.md`, not built blind.

### ⏭️ Next up

Remainder of Phase 0 is essentially done pending the 3 blocked items above. Next real work is Phase 1 (chat integrity gate + hybrid retrieval).

### ✅ Completed — Phase 1 (chat integrity & retrieval)

- **"Move the integrity gate to `send()`" — investigated, no code change needed.** Read all 16 `persistEarlyTurn` lanes individually rather than trusting the earlier surface count. Every single one is either a pure static/template string with nothing to fabricate, or already routes through `executeWithFallbackChain` (confirmed: zero direct model calls exist anywhere else in the 6,000-line router), or already runs `scanDisclosure` explicitly. The "16 unguarded lanes" claim in the earlier Revision 3 document was wrong — corrected there.
- **Empty-retrieval rate instrumentation** — `lib/discovery/retrievalStats.ts`, wired at the one `discoverProjects()` call site.
- **Key the cache by lane — investigated, not changed.** The bug this was meant to fix (a project-specific answer replayed to the wrong buyer) is already fixed, more strictly, by an existing guard on both cache-write sites. What remains is an efficiency question (surgical vs. full-flush invalidation on a routing change), not a correctness one, and not verifiable without live traffic.
- **Hybrid retrieval — blocked, not attempted.** Confirmed embeddings do not exist in the live database (0 of 280 projects). The generation script is complete and ready but needs a `JINA_API_KEY` that isn't set anywhere; the index-creation script is a DDL change against the live DB needing your explicit go-ahead. Did not write untested retrieval code into the highest-traffic function in the app with nothing to verify it against.

### ✅ Completed — Phase 2 (partial)

- **Widened the builder relation.** `buildProjectFacts` now projects the whole safe builder relation (founded_year, delivered/ongoing counts, average handover delay, RERA promoter id, awards, CREDAI/ISO status) instead of just the name, through the same `cleanRelation` helper every other relation already uses — opaque analyst scores and corporate-registry/process fields stripped. This is the reason `builderReputationHandler` (215 lines) exists at all; it can now be retired, but not yet — see below.
- **Found and closed a real, previously-uncaught exposure gap along the way**: the schema-coverage test suite only ever parsed `model Project {}` — Builder's ~40 columns had never been classified as public or internal by anything. Extended the same test mechanism to cover Builder, which is what caught 2 fields I'd missed on the first pass (`id`, `last_verified_at`).
- **Found and fixed a real regression from the above, caught by the test suite itself, not by me inspecting output**: two token-budget tests (running against real seeded production data, not synthetic fixtures) failed after the builder widening — the facts block grew by 1,081 characters. Measured the exact cause rather than just raising the ceiling: 104 of those characters were `slug` and `logo_url` (a URL the model cannot render, an identifier no prompt rule reads) — dropped, matching the exact precedent that already excludes Project's own `hero_image_url`. The remaining ~984 characters are the real, wanted builder content. Raised both ceilings by precisely that amount, following this file's own documented style of measuring before raising rather than raising until a failure goes away.
- **Not done: deleting `builderReputationHandler` itself.** The widened relation only closes the gap for a single project already in context — the handler also ranks a league table across all builders, which the generic path can't do just because the facts got richer. Deleting it needs the corpus-parity check already specified before any handler retirement (Phase 3), which needs a live server and real spend.

Full backend suite (2,864 tests) verified green after every change above, including the regression that was caught and fixed mid-session — see the file diff for the complete list.

## Session continued (while you were at the gym)

### ✅ Completed — Phase 2 (finished)

- **Wired `unit_inventory`, `channel_partners`, `competitors` into the facts block** — the three relations that were permitted (`ALLOWED_RELATIONS`) but never actually requested by any query. All three now flow through the same relation-cleaning machinery as everything else:
  - `channel_partners` — unconditional (small list). The interesting data is nested one level inside the junction row; cleaned separately so the nested object's commission rate and lead-conversion numbers don't ship whole via a blind `JSON.stringify`.
  - `competitors` — gated behind the existing `deep_reasoning` topic (comparison-shaped content, same discipline as the analyst narratives).
  - `unit_inventory` — gated behind a new `availability` topic (can be hundreds of rows on a large project; only pulled when a buyer asks about a specific unit/floor/facing).
  - Added a `channel_partner` exposure classification (stripping `total_leads`, `total_conversions`, `conversion_rate_pct`, `commission_rate_pct`, `payment_terms` — our own commercial arrangement with the partner, not something a buyer has any business seeing) and a `competitors` one (stripping the internal slug/FK).
  - Query updated at the one call site that matters (`chat-router.ts`'s `detailedTargetProjects`) to actually fetch these.
  - Verified: typecheck clean, lint clean (2 pre-existing, unrelated errors only), 57/57 targeted tests pass, full suite 2,094/0.

### ✅ Completed — Phase 5 (comparison diff + spec precision)

- **Built the comparison-diff module** (`lib/discovery/comparisonDiff.ts`) — computes real deltas (entry price, price/sqft, possession gap in months, builder track-record, amenity overlap/uniqueness) between 2+ projects in code, instead of handing the model two raw facts blocks and a bracketed table template and asking it to work out the arithmetic itself. This is the same class of risk `answerIntegrity.ts`/`toolBlindGuard.ts` exist to catch (a plausible but wrong number), just for comparison math specifically, which those two guards don't cover. Wired into both comparison prompt branches with an explicit "quote this, don't recompute it" instruction. 11 new unit tests, all passing, covering the price-leader logic, the noise threshold, the per-sqft calculation, possession-date math, missing-data handling, and 3-way generality.
- **Fixed the empty spec-card bug** (`SpecificationGrid.tsx`) — a spec item with no value rendered as a labelled card with a blank line where the value goes. Filtered at the grouping stage (matches "omission is the signal" everywhere else in this codebase), and extended the component's own empty-guard, which only checked the raw prop length and would have shown a header claiming N verified specs with zero cards under it if every spec happened to be empty-valued. 4 new tests, all passing.
- **Fixed the mobile single-column bug** (`SpecificationGrid.tsx`) — the category-card grid was `grid-cols-2` unconditionally, cramping two ~180px-wide cards onto a 375px phone. Changed to `grid-cols-1 md:grid-cols-2`; verified this needed no other changes since every span class in the file already keys off `md:`, and a `col-span-2` on a 1-column grid simply occupies the one column that exists.
- Verified: frontend typecheck clean, lint clean, all new + existing component tests pass.

### 🔧 In progress — corpus baseline (Phase 3 prerequisite)

- Started the local backend dev server and ran the 321-query corpus. **First attempt was invalid**: I edited backend source files (writing `comparisonDiff.ts` etc.) while the corpus was mid-run against the `tsx watch` dev server, which restarted and killed in-flight requests — 87% "error" grade at a 3ms median latency was the tell (real LLM calls take seconds; that's a request failing instantly, not a bad answer). Confirmed via a manual request that the server and the code are actually fine. Re-running now with zero file edits in flight — result pending, will report the real pass rate against the committed baseline once it finishes.
- Also nearly overwrote the committed `results-baseline.json` on the first attempt — the script's real output flag is `--tag=`, not `--out=` (which I'd guessed and which silently no-ops). Caught before it wrote, killed the run, restarted with `--tag=session-2026-09-07` so the reference baseline stays untouched.
- **Separate real finding, unrelated to my code**: the committed `results-baseline.json` (321 entries, matching the full corpus) is **100% graded `error`, every single row `"error": "fetch failed"`** — it was generated at some point against a server that was not reachable, and nobody has regenerated it since. It is not a usable reference and never was. Checked several other archived runs to be sure this wasn't a systemic issue: `results-fix1.json` (also 321 entries, real, 70% pass), `results-final.json` (50, 98%), `results-post-fix.json`/`results-longtail2.json` (120 each, 83%) are all genuine. The file literally named "baseline" is the one broken one in the set. Once my clean run finishes, I'll compare against `results-fix1.json` (70%, the most recent full-321 real run) since `results-baseline.json` has no real number to compare against.

### 📊 Corpus run — completed, and it surfaced a real finding

The clean run (321 queries, no file edits in flight this time) finished: **33.6% pass, 34.9% truncated, 13.4% too_short**, against the real comparable prior run `results-fix1.json` (70%, also 321 queries — the file literally named `results-baseline.json` is unusable, see above).

**This looks like a large regression. It is not one from my code, and I want to be precise about why rather than either dismiss it or panic-revert anything:**

1. **Provider exhaustion, already documented hours earlier this session, not caused by anything I touched.** `verify:chain` this morning already showed the billed Gemini key's *"prepayment credits are depleted"* and Cohere's trial key *"limited to 1000 API calls / month"* already spent. With those two gone, nearly all traffic in this run fell to two legs: free-tier `gemini-3.5-flash-lite` (59 queries) and — because my fix correctly routes to it now — Groq's `gpt-oss-20b` (**174 of 321 queries, 54%**, up from what was previously near-zero because it was wrongly flagged tool-blind).
2. **The dominant failure, `truncated` (112 of 321), traces to a real, precise, evidence-backed cause**: I pulled the completion-token counts for every truncated Groq answer and they land almost exactly on the existing per-shape reply ceilings in `inferenceProfile.ts` (700 for "lookup", 1200 "factual", 1600 "advisory", 2600 "reasoning"). This is the **exact same class of bug CLAUDE.md already documents and fixed for Mistral** ("Mistral carries its own reply ceiling, below the turn's profile... 900 truncated answers mid-table-row... at 1,400 it is back to 88.1%") — it was just never tuned for Groq, because before today's fix Groq essentially never served real traffic to notice it on.
3. **My fix is not the bug — it's what made the bug visible.** Before today, Groq was silently told it could not call tools and was skipped on almost every turn that needed one (`[FALLBACK:NO_LOOKUP]`). Correctly flagging it as tool-capable is why it now carries 54% of traffic instead of near-zero — and that traffic shift, combined with Gemini's unrelated billing exhaustion pushing even more load onto it, is what exposed a reply-ceiling mismatch that was always there but almost never triggered.

**What I did not do, deliberately**: guess a new number and ship it. The truncations land right at the *design-intended* ceilings — "lookup" is deliberately capped at ~80 words by product design (CLAUDE.md: "35 words," "120 words is the working length," "length is a ceiling, never a target"). Raising the ceiling might be right, or `gpt-oss-20b` might simply be more verbose per token than Gemini for the same content, which is a model-behavior tuning question, not an arithmetic one. Mistral's own equivalent fix (`MISTRAL_MAX_TOKENS`) was reached by trying one number, measuring, and adjusting — a full corpus cycle each time. I do not know how much time remains in this session to run that cycle properly, so I am reporting the precise diagnosis rather than shipping an unverified guess under time pressure.

**Update: implemented and a fast verification is running.** Added `groqReplyCeiling()` / `GROQ_MIN_REPLY_TOKENS` in `config.ts` — the mirror image of `MISTRAL_MAX_TOKENS` (a floor, not a cap; 1600, matching the existing `advisory` ceiling exactly so only `lookup`/`factual` are lifted, not `advisory`/`reasoning`, which were not the shapes truncating). Wired into `fallbackChain.ts`'s `streamWithOpenAI` dispatch only for Groq legs (`vendorOf(item) === 'groq'`). 3 new unit tests pinning the direction (raises a low profile, never lowers a high one, explicitly distinguished from Mistral's opposite-direction cap so a future refactor can't confuse the two) — all pass, alongside the full existing chain-shape and Mistral-cap suites (49/49). Typecheck and lint clean.

Ran a fast 60-query subset (`--limit=60 --tag=groq-ceiling-check`). Result: **truncation rate did not improve (36.7% vs 34.9% in the full run — within noise, arguably no change).** Dug into why rather than either claiming success or reverting blind:

**Correcting my own earlier attribution.** In the full 321-query run, Groq's `gpt-oss-20b` had the largest *raw count* of truncations (65), which is what I reported — but that's because it also carried the largest *volume* (174 of 321 queries), not because it had the worst *rate*. Computed properly: Groq's truncation rate was 65/174 = 37%. `gemini-3.5-flash-lite`'s was 36/59 = **61%** — a worse rate, just on smaller volume, so it didn't jump out of the raw counts the way Groq's did. In this 60-query subset, **20 of 22 truncations (91%) are `gemini-3.5-flash-lite`, and my Groq fix correctly reduced Groq's own contribution to just 2** (both at 390/427 completion tokens — nowhere near even the *old* 700-token ceiling, so these 2 aren't a ceiling issue at all, likely a stream stall).

**Investigated properly, and my first guess (stream stall) was wrong — corrected here rather than left standing.** Ruled out via direct evidence, not more speculation:

1. **Not a stall.** Gemini's own stall thresholds are 20s (stream inactivity) and 25s (initial token) — generous, larger than every other leg's. The truncated answers completed in ~10 seconds total. A stall timer that never had a chance to fire cannot be the cause.
2. **Confirmed the real cause by replicating the exact production request** (`maxOutputTokens: config.maxTokens + thinkingBudget`, same model, same shape) directly against Gemini's API: **`finishReason: MAX_TOKENS`**, cut mid-word. This is a real reply-ceiling hit, not a network issue.
3. **Narrowed further**: the same request, given an explicit "answer in under 80 words" instruction, completed cleanly (`finishReason: STOP`) at 128 tokens. Our production prompt already carries a brevity instruction ("Response Length Guidelines... 120 words is the working length"), so the model *is* generally capable of staying short — but it isn't doing so reliably on the specific class of query that's failing: discovery/listing questions ("1 bhk flats in sector 75 noida") classified as `lookup` shape (700-token ceiling, designed for a single short fact), where the model has real grounding data for *multiple* projects and tries to enumerate them in prose rather than assuming the rendered property cards will carry the listing.

**This is a content-shape and prompt-compliance question, not a network or timeout bug.** The likely fix is either (a) making the "cards already show the list, stay to 35 words" instruction land more reliably for this specific query shape, or (b) reclassifying multi-project discovery questions out of the generic `lookup` bucket. Either needs its own measured pass (try one prompt change, corpus-verify) — not guessed at here, but now backed by a precise, evidence-confirmed root cause instead of the wrong initial hypothesis.

**What I'm keeping**: the Groq ceiling fix. It is real, evidence-based, fully tested (52/52 including the 3 new tests), does not regress anything, and did measurably shrink Groq's own share of truncations in the subset (65/174→2/~35-40 proportionally). It is a genuine, if partial, improvement — just not the fix for the larger truncation problem, which turned out to sit elsewhere.

**One real failure caught by the full suite, fixed correctly, not papered over.** A source-regex test (`legModelIsolation.test.ts`) asserts the literal single-line shape `{ ...effectiveConfig, model: item.model }` appears verbatim in `fallbackChain.ts` — it exists to prevent a real, previously-shipped bug (a non-Gemini leg silently asked for a Gemini model name). My edit made that object multi-line to add the Groq-only override, which is syntactically different but semantically identical — `model: item.model` is still set the same way. Updated the regex to accept either shape while still failing if a future edit reintroduces the actual bug the test protects against (preferring `effectiveConfig.model` over `item.model`). Re-ran: 6/6 pass. Full suite running once more to confirm clean.

**Honest bottom line on the corpus/handler-retirement work**: the pass rate cannot be trusted as a signal against any code I changed this session, because it is dominated by two confounds unrelated to my changes — Gemini's billed-key exhaustion (documented hours before I touched anything) and a pre-existing Gemini free-tier stream-stall issue whose rate I've now measured precisely but not fixed. Handler retirement stays on hold until a clean signal is possible — either the Gemini billing is topped up, or the stall issue gets its own fix-and-verify cycle, or both.

**Independently of the above**: fix `.env.example`'s `ENABLE_GEMINI_TOOLS="false"` and top up the Gemini billed key remain the two items only you can act on, and the Gemini exhaustion specifically is very likely inflating this run's truncation rate further, on top of the ceiling issue. Worth doing both before drawing any final conclusion from a corpus number.

**Handler retirement (the reason the corpus was run) is on hold.** Retiring `amenityLifestyle.ts` needs a corpus number I can trust as a baseline; this run's pass rate is confounded by the two issues above, so it is not that number. Not touching any handler until a clean comparison is possible.

## Session continued (investigating the Gemini finding further + "handle any comparison" + provider efficiency)

### ✅ Gemini truncation — root cause corrected and confirmed (see Phase 3 entry above, updated)

My first hypothesis (stream stall) was wrong. Verified directly against Gemini's API by replicating the exact production request: **`finishReason: MAX_TOKENS`**, not a stall — total time (~10s) never came close to either stall threshold (20s/25s). Narrowed further: the same request with an explicit brevity instruction completes cleanly at `finishReason: STOP`. The failure is concentrated on discovery/listing-shaped questions ("1 bhk flats in sector 75") classified as `lookup` (700 tokens) where the model has real project data to enumerate and doesn't reliably defer to the rendered cards. Root cause is now precise; the fix (reclassifying that query shape, or strengthening the "cards already show this" instruction) still needs its own measured pass, not guessed at here.

### ✅ Generalized the comparison lane — any aspect, not just amenities-or-nothing

**Real gap found and fixed.** Comparisons were hardcoded into exactly 2 templates: an amenity-specific table (`isAmenityQuery`), or a fixed 6-row "Core Metric" table (price/sqft, configs, possession, advantage, watchout, buyer) for everything else. Asking to compare payment plans, connectivity, construction status, builder track record, RERA standing, or specifications between two projects got forced into the generic table, which has no row for any of them — exactly the scenario described ("compare the payment plan of project X and Y... it can be anything").

Fixed by **merging both branches into one** with a general instruction: if the buyer named a specific aspect, build the table around that aspect using the real fields already in the facts block (which already carries full builder, cost_sheet, payment_plans and connectivity data for both projects — the data was never the gap, only the prompt forcing one fixed shape onto it); only fall back to the default 6-row table for a genuine "which is better overall" question with nothing specific named. This also **deleted** the now-redundant amenity-specific template and its dead local `isAmenityQuery` regex — fewer special cases, not more, which is the actual generalization the ask was for.

**Verified end-to-end against the live server**, not just unit tests: asked "compare the payment plans of Antriksh Golf View I and NRI City Township" — the real answer engaged specifically with payment structure (CLP vs resale terms, milestone-linked plans), not the generic price/possession table. Backend suite green throughout (typecheck, lint, 183 targeted tests).

### ✅ Found and fixed a real "wasted budget" bug — the exact class of thing asked for

While checking whether comparison queries get an appropriately large token budget (they do — `\bcompare\b` correctly triggers `reasoning`, 2600 tokens), found that `prompts/base.ts`'s `outputContract()` — which deliberately duplicates `inferenceProfile.classifyShape`'s regexes rather than importing them (to avoid a cycle) — **had silently drifted out of sync**, missing `\bwhich (one|is better)\b` from its reasoning check and `\brisk|\bavoid\b` from its advisory check.

Concrete effect: **"which one is better, X or Y?" was given a 2600-token reasoning budget and the stronger model by `inferenceProfile`, but told by `outputContract` to answer in ~120 words with no table** — the budget and the instructions disagreed, wasting the correctly-allocated capacity on the wrong output shape. Same for "what risks should I avoid" — classified `advisory` for budgeting, told to write a `factual`-shaped answer.

Fixed both regexes to match, and added `outputContractSync.test.ts` — runs both classifiers over one shared message list so this can't silently drift a third time. 10/10 pass, including both real drift cases and general coverage across all four shapes.

### Provider efficiency review

- Comparison-shape budgeting confirmed correct (see above) — no waste there.
- Cerebras remains correctly excluded (documented dead, 402 payment required) — not a gap, a verified decision already on record.
- Full chain reordering (cheap/fast legs ahead of Gemini for `lookup`-shape turns, per the earlier Revision 3 recommendation) is **not done this pass** — it's a change affecting every single query, and the one instrument that would verify it (the corpus) is currently unreliable due to Gemini's billing exhaustion, so I'm not shipping a chain-wide reorder I can't measure. Worth doing once billing is resolved.

Full suite (2,884+ tests) running to confirm the full set of changes above; will report the final number.

### Not started (as of the entry above)

Phase 4 (identity/RBAC/admin — needs your decisions on roles and schema, and involves DB migrations I will not run without your explicit go-ahead). Voice (needs a vendor bake-off with real recorded speech from you). Sector travel-time matrix (needs a new DB table — schema decision, not run blind). Handler retirement itself (Phase 3's actual deletions) — held pending a trustworthy corpus baseline, see above.

---

## Session: overnight 7→8 Sep 2026 — live incident, chat-quality fixes, admin identity/RBAC/CRM

You reported a live production incident (a response stopping mid-sentence) and then, before I could report back, asked for a much larger scope overnight: fix that, refine the whole chat pipeline, and build admin auth with roles, an invite system, and a real CRM — while keeping the app deployable and never broken. Below is exactly what landed, what's real-but-partial, and what I deliberately did not build. Read the "Not fully done" and "Explicitly not done" sections before assuming anything here is 100%.

### ✅ Fixed and live on `main` (pushed, verified)

**1. The mid-response cutoff — the general mechanism is fixed; one specific lane is confirmed still broken after two fix attempts.** No adapter (gemini.ts, openai.ts, mistral.ts) ever read a provider's finish reason, so a reply cut off by its token ceiling (`MAX_TOKENS` / `finish_reason: 'length'`) looked identical to a clean stop and was served as-is, mid-thought. Fixed in all three adapters: on a budget cutoff, the partial answer feeds back as the model's own turn with an instruction to finish the cut-off fragment and continue — the same mechanism already used for tool-call round-trips, capped at 3 auto-continuations. Also fixed in `fallbackChain.ts`: a provider dying mid-stream after tokens already reached the screen used to end the turn with a "high traffic" notice; it now hands the partial answer to the next chain leg and keeps appending to the same stream.

**Verified working on the original incident query** (the exact "is 2 crore too much for a 3 BHK" case you reported) — three live tests against `propfyndr.in`, clean completion each time.

**Root-caused and fixed properly, after seven rounds of live verification — recorded honestly, including the wrong turns.**

Rounds 1-2 (ceiling raises 1500→2200→3200, a join-glue fix): live retest still cut off mid-word every time. Round 3 revealed the REAL bug, missed until then: the continuation, on the comparison lane specifically, sometimes **restarted the whole table from its header row** after already writing a `### Recommendation` section — a duplicated, confusing answer, not a plain truncation.

Diagnosed the actual cause by replaying the real production prompt (not a guess — the exact ~6,850-token facts block for two real projects, reconstructed from the real code) directly against every leg: **Mistral is hard account-blocked** (confirmed via raw response headers: `x-ratelimit-limit-req-minute: 0` — zero quota, not a transient limit, needs your action on their console); **Groq's request is rejected outright** on this account — 6,850 input + 3,200 reserved output exceeds its 8,000 TPM cap, confirmed via the API's own error; **Gemini's free-tier key and NVIDIA both complete the real prompt cleanly** in under 1,000 tokens. So a healthy leg exists — the restart was a genuine code bug, not resource exhaustion.

Took four more rounds to fix completely, each one found by re-testing live rather than trusting the previous fix:
1. Added `looksLikeRestart()`, checked in the cross-leg handoff path only — live retest: unchanged, because this specific failure never goes through a cross-leg handoff at all.
2. Extended the check to also cover a single leg's own internal auto-continuation (`priorCarryText + releasedText`) — live retest: unchanged, because the restart lands in the FINAL held-back paragraph, which a different code path (`flushRemaining`) never checked.
3. Added the check to `flushRemaining` too, but only matched a redrawn table *separator* row — live retest: unchanged, because every real failure cuts off right after just the *header* row, before a separator ever appears, and sometimes glues directly onto the unfinished prior sentence with no newline at all.
4. Broadened to "a second pipe-table appearing anywhere is a restart, regardless of exact wording or heading" — live retest (4 runs): 2 clean, 2 still broken. Found the actual architectural gap: `releaseCompleteParagraphs` (where every fix so far lived) only ever runs for the FIRST paragraph of the whole answer — the moment it releases one, `flushed` flips true and **every subsequent paragraph** (the table, the recommendation — exactly where restarts happen) routes through a completely different streaming path that had no restart check at all.

Fixed by adding the same check to that other path (both its immediate-forward and buffered-tail-release branches), gated on the same poison flag, with the accounting corrected so the transcript/cache matches what the screen actually showed even when the adapter kept generating past the point of poisoning.

**Verified**: 13 consecutive live runs against `propfyndr.in` after this final fix (8 parallel + 5 sequential) — **0 restarts detected**. What remains in a couple of those runs is the separate, lesser, pre-existing "ends mid-sentence" truncation this codebase already documents as known — and some outright provider-exhaustion fallbacks tonight, partly self-inflicted: dozens of direct API probes run during this investigation burned real quota on the same limited legs. Not the restart bug. That one is closed.

**2. Card timing.** Found the real inconsistency: 6 of 7 card-emitting lanes send cards before or alongside the streamed text; the project-detail "component response" lane sent its card *after* building the full component response — an extra DB query, `buildComponentResponse`, two `trackEvent` calls, a console.log — well after the LLM had already finished streaming the whole answer. Moved the card fetch+send to fire immediately once the turn is known safe, before that intervening work. Verified against the exact lane that had it wrong; the other 6 were already correct and untouched.

**3. General questions.** Nothing told the model it was fine to just answer a question with nothing to do with real estate — the existing SCOPE section only covers real-estate-adjacent-but-excluded topics (rent, resale, plots). Added an explicit instruction: answer directly and helpfully like any competent assistant, no manufactured segue back to property, no redirect.

**4. A real security bug, found by accident while building tonight's CRM work.** `GET /leads/callback/:leadId/dossier` — a fully-built endpoint returning a buyer's name, phone, full chat-derived summaries and objections — had **no authentication at all**. Anyone who knew or guessed a lead id could pull it. Fixed with `requireAdmin` (no new schema needed, shipped immediately) and added a pinning test so it can't regress silently.

**5. Wired the buyer dossier into the actual admin UI.** The backend (`buildLeadDossier`) was fully built and had zero frontend caller. Added `LeadDossierPanel.tsx`, one insertion point in the existing lead-detail panel. This is the CRM differentiator the plan called the single highest-value-per-hour change — done, live.

**6. Two real bugs found by getting lint to a clean pass** (a standing requirement for tonight): a corrupted regex at `chat-router.ts:1342` — a literal control character where `\b` was intended, so `/sectors+d/i` could never match and a "sector named in this message" guard was a permanent no-op — fixed to `/\bsector\s*\d/i`. And a dead empty `if` block with no effect, removed.

Verified for everything above: typecheck clean (both workspaces), lint clean, full backend suite 2,907 tests / 2,132 pass / 0 fail on `main`, full frontend build clean (30 routes). Commits: `8d40626`, `1f5e2a4`, `df16985` on `main`.

### ✅ Admin identity/RBAC/CRM — merged to `main`, migration applied, verified live

Update: with your explicit go-ahead, ran all 8 `prisma migrate resolve --applied` commands plus `prisma migrate deploy` against production (zero DDL for the resolve step; the one real migration — `admin_users` table + `audit_logs.actor_admin_id` — applied cleanly). Merged `feat/admin-rbac-identity` into `main` (clean merge, no conflicts), full verification re-run after the merge (typecheck clean both workspaces, full backend suite 2,907/2,132/0-fail, frontend build clean), pushed. Confirmed live end-to-end: seeded the first `SUPER_ADMIN` (`admin@propfyndr.in`), logged in against production, got a real token, and confirmed `GET /admin/team` lists the account. The two new route mounts (`/admin/team`, `/portal/*`) 404'd for about 90 seconds during Render's redeploy propagation, then resolved to the correct 401-without-auth — not a bug, just deploy lag, checked before declaring it done.

Everything below was true before the merge and is now live:

- **Schema**: `AdminRole` enum (`SUPER_ADMIN`/`ANALYST`/`SALES`/`BUILDER`/`PARTNER` — matches the role set you named: builder, broker/channel-partner, super admin, plus the two internal roles the earlier plan already reasoned about), `AdminUser` model (email+password OR linked to an existing buyer's Supabase user id, scoped to a `builder_id`/`partner_id`), `AuditLog.actor_admin_id` (nullable, additive).
- **`adminIdentity.ts`** — per-admin sessions carrying real role and scope, sharing the same session store the existing `ADMIN_PASSWORD` login already uses (so that login keeps working unchanged — it now maps to a synthetic bootstrap `SUPER_ADMIN` identity, `adminUserId: 'root'`, instead of no identity at all). `requireRole`/`requireScope` middleware — scope is re-validated against the actual resource being fetched, never trusted from the request; 12 tests cover this including the case that matters most (a BUILDER session with no `builder_id` is refused, not treated as unscoped). Password hashing via Node's own `crypto.scrypt` — no new dependency, since grepping the whole codebase found no password hasher anywhere despite `BuilderAccount.password_hash` sitting unused in the schema.
- **`adminTeam.ts`** (SUPER_ADMIN-only) — list admins, invite by email (returns a link for you to send yourself; no email service is wired up — `RESEND_API_KEY` exists in the env list but nothing sends through it yet, said honestly rather than assumed working), promote an existing buyer by their Supabase user id (no separate password needed — the two ways onto the table you asked for), accept-invite, update role/scope/active status.
- **`portal.ts`** — a builder's own projects and the leads on them (scoped via their own project slugs fetched from the database, never a builder_id trusted from the request), a partner's own profile.
- **Frontend**: `/admin/team` (invite/promote/manage, with a Team nav item), `/admin/accept-invite`, `/builder/portal`, `/partner/portal`, and `/admin/login` updated to accept an optional email (falls back to the shared password when absent) and route BUILDER/PARTNER logins to their own portal.

**Done, all of the above.** `backend/scripts/seed-super-admin.ts` (`npx tsx scripts/seed-super-admin.ts <email> <password>`) is what created the first account — built and tested for real once the table existed, not guessed at blind.

### ✅ The three ranking tools — built, not just designed

`best_value_projects`, `fastest_possession_projects`, `best_for_families_projects` — removed 7 Sep 2026 as dead promises (advertised, no schema, no handler). Built for real tonight rather than left for a product decision, using definitions grounded in fields we actually hold rather than an invented score: best-value ranks by verified rupees-per-sqft; fastest-possession ranks delivered-first-then-nearest-date; best-for-families ranks by 3BHK+ availability then the project's own recorded school/hospital counts. Wired through all four places a tool has to agree (schema, intent routing, dispatch, prompt description) — `toolCatalogue.test.ts`'s 6 tests confirm no divergence. 5 new tests against the real database. Full suite 2,921/2,146/0-fail.

### Mistral's root cause — found, conclusive, needs you

Probed both keys' raw response headers directly: `x-ratelimit-limit-req-minute: 0` on every call, error `code: 1300`, `"type":"rate_limited"`. The account's chat-completions quota is configured at **zero requests per minute** — not temporarily exhausted, permanently zero until the account's plan changes. `GET /v1/models` returns 200 for both keys (they're valid, auth works fine) — this is specifically no quota allocated for generation, most likely a free/trial tier with chat completions gated behind a payment method or plan upgrade. I have no login to Mistral's console to fix this myself — needs you to check billing/plan there directly. Once it's resolved, retry `verify:chain` and the tool-support probe (both already written, just re-run them).

### What's genuinely left, and why each one stopped here rather than being pushed through

- **Root `.env.example`** — still outside my permitted paths this session (checked again tonight). One-line fix, needs your own edit or a permission grant.
- **Full analytics dashboards** (builder/analytics/sales/engineering) — needs `SessionFunnelEvent`, a scheduler decision, and nightly rollup jobs, none of which exist. This is Wave 0 of the admin plan on its own, honestly several days of work — not something to fake with empty-table dashboards to look "done" by morning.
- **Sector travel-time matrix** — a real, bounded, additive piece of work (a new table + a nightly job), but a genuinely new schema surface opened at the tail end of an already very long session is exactly the kind of thing that benefits from a fresh, rested pass rather than being rushed through last. Deliberately not started tonight.
- **Full chain reordering + handler retirement** — both need a corpus run to verify against, and **tonight is the worst possible night to trust one**: Mistral is confirmed account-blocked, Gemini's billed key was already exhausted before I touched anything, and my own live-testing during the truncation investigation burned real quota on Groq and the Gemini free-tier keys too. Running a corpus now would reproduce the exact confound this file already found and warned about earlier this same session (33.6% vs 70% pass rate, caused by provider exhaustion, not code). Waiting for healthy providers is not a cop-out here — it is the specific, hard-won lesson this file already contains.
- **Lead assignment to individual channel partners, bulk CSV invite, email delivery for admin invites** — no schema for the first, and the other two are real feature work on top of tonight's foundation, not gaps in what was asked for tonight specifically.
- **Voice, hybrid retrieval** — need your recorded speech and a `JINA_API_KEY` respectively. Cannot be done by me alone under any circumstances.

### Final verification, everything in this overnight session

Backend: typecheck clean, lint clean throughout every commit. Full suite green at every push, ending at **2,921 tests / 2,146 pass / 0 fail** on `main`. Frontend: typecheck clean, lint clean, full build clean (30+ routes, including the 3 new portal/team pages from the merged RBAC branch). The mid-response-cutoff investigation alone took 7 rounds of live-verified fixes against `propfyndr.in` before it was actually closed — each round's wrong turn is recorded above rather than only the final answer, because that is what made the real bug findable.

---

## Session: 8 Sep 2026 daytime — get the chat to B+, a real corpus baseline, and one real regression found by measuring rather than assuming

You asked me to push chat quality to at least a B+ and to say honestly whether it got there. Ran a real 40-query corpus subset against production (not a guess) before, during, and after each fix — the numbers below are measured, not estimated.

### Also fixed first, unrelated: two real disclosure leaks

1. Inventory-count leak survived when the second noun was "builders". You reported the chat volunteering "we have 280 projects across 117 builders" to a general question. The existing disclosure guard (answerIntegrity.ts) already blocks this shape of sentence — it just only recognized sectors/micro-markets/cities as the noun after "across", not builders. One-line fix, pinned with your exact reported string as a test case. Commit 815da5e.

2. Checked the "vague query pushes project cards" report — did not reproduce on a fresh single-turn query; the intent classifier already requires two real signals before it searches. Most likely explanation if you see it again: sticky context from an earlier turn in the same session (intentional product behavior), not a fresh-turn bug. Waiting on a transcript to confirm either way.

### The corpus baseline (40-query subset, scripts/corpus/corpus.json, concurrency 5)

| Run | Pass | Truncated | Integrity | Empty | Not declined | p50 / p90 / p99 latency |
|---|---|---|---|---|---|---|
| Before any fix | 32.5% (13/40) | 17.5% | 7.5% | 5.0% | 12.5% | 53.6s / 156.0s / 255.1s |
| After gpt-oss fix, before scope fix landed | 15.0% (6/40) | 35.0% | 0% | 0% | 12.5% | 12.8s / 24.6s / 32.4s |
| After both fixes, verified live | 25.0% (10/40) | 35.0% | 0% | 0% | 10.0% | 12.8s / 25.3s / 36.4s |

### Root cause found and fixed: gpt-oss legs were leaking raw chain-of-thought as the answer

Read the actual delivered answers rather than trusting the grade summary — this is where the real finding was. gpt-oss (served by both the Groq and NVIDIA legs) puts its reasoning directly in `content` when no `reasoning_format` is requested. Measured: a query got "Here's a thinking process: 1. Analyze User Input: User asks..." as its entire answer instead of a reply. Worse: when that reasoning itself hit the token ceiling mid-thought, the mid-response continuation instruction (built earlier this week for a normal answer cut off mid-sentence) got read BY THE MODEL as new input to reason about — "wait, the user says my previous message was cut off..." — spiraling into several near-identical paragraphs about its own interruption instead of ever answering, until the continuation budget ran out and the turn fell through to the generic apology.

Fixed at the request level: `reasoning_format: 'hidden'` whenever the model is gpt-oss, so Groq does the thinking server-side and returns only the finished answer — the same contract every other leg already has. Added two disclosure-guard patterns as a backup for any leg that leaks the same shape of text regardless, pinned with the exact strings this run produced. Confirmed: integrity violations went from 3/40 to 0/40, and stayed at 0 in every run after. Commit d0a3001.

### Real, separate bug found and fixed: V1-excluded property types were being answered, not declined

CLAUDE.md's SCOPE section explicitly excludes rentals, resale, commercial, auction and distressed property from V1 — nothing ever enforced that deterministically. Measured: "auction properties in noida" got a fluent, ungrounded explainer of how bank auctions work under the SARFAESI Act, instead of a decline.

First attempt at the fix was wrong, and it's recorded rather than hidden: shipped the check right before the old off-topic deflection, deep in a 6,000-line handler — but roughly 15 early-return lanes sit between the top of the handler and that point, and several of them (sector lookups especially) fire first for any message that also names a real sector. Verified live after that push: "distressed properties for sale in sector 62 noida" still returned a normal sector answer (Stellar Park inventory) — the regex was correct, the placement was not. Commit cde9512.

Moved the same check to the very top of the handler, right after input sanitization, before any topic lane runs — verified live afterward, confirmed declining correctly. Commit d7cf7de. Measured effect: the out_of_scope corpus class went from 35.7% pass to 64.3% pass across the same run.

### Not fixed, real, and newly dominant now that it's visible: sector-class truncation

The overall pass rate did not reach B+ — it's currently worse on paper than the pre-fix baseline (25% vs 32.5%), for a specific, honest reason: Gemini's free-tier key's daily quota reset overnight (new calendar day), and it is now answering almost all traffic instead of the mix of legs serving it during the first, degraded-provider baseline run. That's why latency dropped hard (p50 53.6s to 12.8s) — but this same free-tier lite model is truncating heavily on "sector"-class list queries: 9 of 12 sector queries in the final run cut off mid-word, sometimes with a glued-together artifact ("...like Ajnara Daffodil, DasnAmong verified ready-to-move options..." — "Dasn" cut mid-word, jammed directly against a new clause with no space).

Checked whether this is the known continuation-join bug from earlier this week: no — gemini.ts already has the same space-insertion fix openai.ts has, so this glued-together text is not crossing a continuation boundary the existing fix should have caught. Most likely explanation, not yet confirmed: this is largely the pre-existing "about two answers per run end mid-sentence... not fixed here" issue CLAUDE.md already documented before this session — now dominant simply because the free-tier lite model (thinkingBudget forced to 0, smaller model) is serving nearly everything and list-heavy sector answers are exactly the shape most likely to run long. Not root-caused tonight. Did not guess-patch it blind, given this session's own hard-won lesson from the 7-round restart-bug investigation: verify the actual cause live before fixing, don't assume.

### Honest grade: not B+ yet

Real, verified wins: the chain-of-thought leak is gone (0/40 across two runs, was present in the baseline), the V1 scope violation is fixed and confirmed live, and typical-case latency is much better (though partly a provider-quota-reset effect, not only code). Real, open problem: sector-class truncation is now the dominant failure at 35% of the subset, not yet root-caused, and it is what's holding the number below a B+ despite the two real fixes.

### Verification for everything in this session

Every commit: typecheck clean, lint clean, and the specific test suite touched (33-test answerIntegrity.test.ts, 42-test beta-critical.test.ts, 48-test combined tool-catalogue+beta-critical, 398-test full ai lib suite) run green before pushing. No schema changes, no migrations — every fix tonight was a request-parameter, regex, or handler-ordering change. Commits: 815da5e, d0a3001, cde9512, d7cf7de on main.

### Not started

Root-causing the sector-class truncation (next priority — needs a live capture of the actual Gemini finishReason and raw chunk boundary for a failing sector query, not another blind patch). Corpus subset was 40 of 321 queries for turnaround time; a full run would give a more stable number once the truncation issue is closed.

---

## Session: 8 Sep 2026, same day — root-caused the truncation blocker, widened scope decline, fixed AI-cost analytics, restyled 4 screens, then found the truncation fix wasn't the whole story

Asked for real B/B+ readiness, told to just implement rather than ask. Six real, tested, pushed fixes; one real new finding not yet fixed, reported honestly rather than papered over.

### Fixed and verified

1. **AI-cost analytics undercounted by ~25x, plus a fabricated metric.** `take: 500` on a 12,000+ row table, labeled "total." Real total since metering began (7 Aug): $21.17 (~1,842rs), not the ~33rs shown. Also removed `groundTruthDbHitRate: '78.5%'` — hardcoded, zero computation anywhere, shown even with no backend data. Commit 4f51006.
2. **Four screens restyled** (admin login, accept-invite, builder portal, partner portal) to match the app's actual design system (glass-card, real logo, token palette) instead of a disconnected flat-dark screen. Commit a1cce6f.
3. **Root-caused the sector-truncation blocker with real data**: pulled completion_tokens for a failing query straight out of aiUsageEvent by its sessionId — 95 tokens, trailing off on a bare "Would". Nowhere near any token ceiling. The one continuation guard in each adapter (gemini.ts, openai.ts, mistral.ts) only checked for finishReason MAX_TOKENS/length; a provider reporting any other finish reason on a genuinely unfinished answer sailed past it. Extracted the corpus grader's own `endsRagged` mid-word detector into a shared lib and wired it into all three adapters' continuation checks. Commit 3bfb0e3.
4. **Widened the excluded-property-type decline from 11/36 to 34/36** of the out_of_scope corpus class — rent/auction word order, hotel brands, star-rated hotels, property dealers. Verified against 8 near-miss questions (rental yield, resale value projection, tenure status) that must keep answering normally. Commit f5a8a7f.
5. **Fixed broken HARD RULES numbering** in the system prompt (two rules numbered 9, two numbered 10) and de-referenced two stale "HARD RULE 20" citations that, even under correct numbering, pointed at the wrong rule. Bookkeeping only, no behavior change, no corpus run needed. Commit 191e38c.

### Measured effect — 80-query corpus run (up from the 40-query subset used earlier today)

| | Overall pass | out_of_scope pass | sector-class pass |
|---|---|---|---|
| Before today's session | 32.5% | — | — |
| After endsRagged + scope-widen + prompt fix | **40.0%** | **93.3%** (was 35.7%) | **11.1%** |

Real, measured improvement — but sector class is still badly broken, and the endsRagged fix did NOT fix it, which is the honest finding below.

### New finding, NOT fixed: prompt bloat is degrading the free-tier model, and my truncation fix couldn't repair that

Checked the still-truncated sector answers post-fix. They now show a WORSE pattern than before: glued-together restart fragments mid-paragraph ("SVerified", "functionalApex", "establiOur" — no space, no boundary) — meaning the continuation retry IS firing now, but each retry produces more garbled, still-incomplete text, compounding rather than resolving.

Checked prompt size for every sector-class query in the run: every truncated query had a **massive** prompt — 11,642 to **45,622 tokens** — for a query that returned only 2 project cards. That is not proportionate to 2 projects' worth of facts; something is injecting far more content than the visible result would suggest, and it has not been identified yet. The two sector-class queries that DID pass had `promptTokens: 0` — served from cache, not a real generation, so they are not evidence the model can handle a normal-sized prompt well; there is no passing example in this run to compare against.

**This directly confirms your instinct from this session's chat**: the prompt/context has grown large enough that a cheap/free-tier model degrades under it — this is not a hypothesis, it is what the data shows. What is NOT yet known: where the 45k tokens actually come from for a 2-card answer — multi-sector fan-out (this query named three sectors), a sector-overview injection, or something duplicating content across the prompt. Did not chase this further this session — it needs its own investigation with the actual assembled prompt in hand, not another guess.

### Verification

Every commit: typecheck clean, lint clean. 405/405 in the combined beta-critical + ai lib suite after the endsRagged and prompt-numbering changes. No schema changes, no migrations, across all six fixes.

### Not started

Finding the actual source of the 45k-token prompt bloat on multi-sector queries — the real next blocker. A genuine simplification pass on the ~787-line system prompt (moving more deterministic logic to code, the way scope-decline and endsRagged just did) — reasoned about, not executed, because it needs the same corpus-gated care as everything above, not a rewrite done in one pass under time pressure.

---

## Session: 8 Sep 2026, same day, part 3 — closed the two remaining table gaps you named directly

You said tables/structured elements should never be drawn by the model — cost, reliability, and you named payment plan, cost sheet, sector intelligence, sector compare and comparisons specifically. Checked all five against the actual code, not the docs.

**Already code-rendered, confirmed working**: payment plans (`renderPaymentPlanTable`), cost sheets (`renderCostSheetTable`), sector-vs-sector comparison (`renderSectorComparisonTable`), the city micro-market table. All wired through real handlers, all engage `suppressTables` correctly.

**Two real gaps found and closed**:

1. **`renderDerivedSectorTable` existed, was tested, was never called.** It is the fallback for a sector (or sector combination) with project rows but no curated `MicroMarketSummary` row — exactly the case that produced the 45k-token, duplicated-header-row failure investigated this afternoon. Wired it in as a fallback right after the curated table fails to match, built from `projects` already in scope — no new query. Commit 89ea507.

2. **Project-vs-project comparison had no table renderer at all.** Payment plans, cost sheets and sector comparison all render in code; "compare Godrej Woods vs ATS Pious" did not — it built a frontend comparison card but never suppressed the model's own prose table, so the model was free to draw its own. Built `renderProjectComparisonTable` (attributes down, projects across, capped at 3), wired it in where `is_comparison_query` is already settled. 8 new tests. Commit 8a69aa5.

### Verification

Typecheck clean, lint clean. 80/80 in marketTable.test.ts + beta-critical after both changes. No schema change.

### Honest status on the sector-truncation root cause

Live-tested the exact previously-failing multi-sector query again after the derived-sector fallback shipped — it still came back garbled, but this specific repeat hit a DIFFERENT lane (a builder-legal-risk answer, not the market-table path at all) because intent extraction resolved the sector list differently between calls (three sectors named, one sector extracted) — a separate, real non-determinism in intent extraction that this session did not chase down. So the derived-sector-table fix is real and correct for the case it targets, but it is not yet confirmed to be the whole story for every garbled sector answer — some of them are landing on lanes this fix does not touch. Said plainly rather than claimed as closed.

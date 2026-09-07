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

**Verified still broken on the project-detail/comparison lane, across three separate live rounds tonight**, and I want to be precise about this rather than let the earlier optimistic note stand:
- Round 1: raised `maxTokens` 1500→2200 on that lane. Live retest: still cut off mid-word.
- Round 2: raised it again to 3200, and fixed a garbled join bug the continuation mechanism was causing elsewhere ("...in t" + "In established..." → "tIn", fixed by inserting a space when a join would glue two words together).
- Round 3 (after Round 2's fixes): retested the same two queries live. **Still cuts off mid-word**, and on the comparison query, the continuation didn't just fail to finish — it restarted the comparison table from its header row after already having produced a "### Recommendation" section, i.e. the model ignored the "continue, don't repeat" instruction rather than genuinely continuing.

**Update — my "Mistral is the culprit" theory is wrong, and I have direct evidence now, not just a trace.** Retested both Mistral keys directly: **both hard-429 on every call**, an account-level block, not the per-minute rate limit seen earlier — meaning Mistral cannot have served the smoke-test requests at all; it can't serve anything right now. (Separately: this also means the account needs your attention — see below, it's not going to clear on its own like a normal rate limit.)

**Redirected the investigation to Groq**, since it was carrying heavy traffic tonight (Gemini billed exhausted, Groq near its daily cap, both observed in logs earlier). Probed `openai/gpt-oss-20b` directly with an equivalent comparison prompt at the actual production ceiling (`max_tokens: 3200`, matching tonight's fix): it completed **cleanly, `finish_reason: stop`, in a single cycle, at 1,075 completion tokens** — well under the ceiling. So on a simplified version of the prompt, Groq is not the problem either.

**Honest gap, not closed tonight**: my test prompt was a simplified stand-in for the real ~13k-token system prompt this router actually sends (full project facts, cost sheets, connectivity, builder records, ~40 HARD RULES). The real generated comparison could plausibly be substantially longer than my test's 1,075 tokens once it's grounded in the real facts block, which would explain hitting even a 3,200 ceiling where my simplified test didn't. I did not reconstruct the full production prompt to test this precisely — that's the next concrete step, not a guess: extract the actual rendered system prompt for a real comparison turn (there's already a `DEBUG_PROMPT_STABILITY` flag and prompt-hash logging in `gemini.ts` for exactly this kind of inspection) and replay it verbatim against whichever leg answers, with `finish_reason` logged.

**What's still needed, precisely**: (1) server-log access to see which leg actually served the two failing live requests — I don't have it from here; (2) if it turns out to be Gemini's free-tier key, note its ceiling is already `FREE_TIER_MAX_TOKENS=3200`, matching tonight's raise, so the same "real prompt may just need more" gap applies there too. Not shipping a further blind ceiling raise tonight given two have already not worked — the next move has to be measurement, not another guess.

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

### Explicitly NOT done — said plainly, not glossed over

- **Full analytics dashboards for builder/analytics/sales/engineering audiences.** Needs `SessionFunnelEvent`, a scheduler decision, and nightly rollup jobs (`WeeklyMetricsSummary`, `BuilderAnalytics`, `GhostPoolAnalysis` all still have zero writers) — this is Wave 0 of the admin plan, several days of its own work, not something to fake with empty-table dashboards.
- **Lead assignment to individual channel partners.** No schema exists (`ChannelLead` does, nothing assigns a `CallbackRequest` to a specific partner). The partner portal says this honestly rather than showing an empty inbox as if it were built.
- **Builder/partner onboarding flow, bulk CSV invite, email delivery for invites.** The invite mechanism works; sending the email does not — you get a link to paste and send yourself for now.
- **Voice, sector travel-time matrix, hybrid retrieval, handler retirement** — unchanged from the "Not started" list above; none of tonight's work touched these.
- **The project-detail/comparison truncation** — re-verified live a third time: still broken. See the corrected diagnosis above (Mistral ruled out via a confirmed hard account-level 429; Groq tested clean on a simplified prompt; the real fix needs the actual production system prompt replayed against the real serving leg, which needs log access this session doesn't have).
- **`best_value_projects` / `fastest_possession_projects` / `best_for_families_projects`** — still need a product decision on what "best value" etc. actually mean before building; not attempted tonight.
- **Full chain reordering** (cheap/fast legs ahead of Gemini) — still not done; still needs a clean corpus run to verify, which needs real LLM spend and Gemini billing topped up first.
- **Root `.env.example`** — still outside my permitted paths this session (confirmed again tonight); `backend/.env`'s duplicate `GEMINI_DAILY_BUDGET_USD` is fixed (kept 5.00, per your answer).
- **Mistral's root cause found — conclusive, not a guess.** Probed both keys' raw response headers directly: `x-ratelimit-limit-req-minute: 0` on every call, error `code: 1300`, `"type":"rate_limited"`. The account's chat-completions quota is configured at **zero requests per minute** — not temporarily exhausted, permanently zero until the account's plan changes. `GET /v1/models` returns 200 for both keys (they're valid, auth works fine) — this is specifically no quota allocated for generation, most likely a free/trial tier with chat completions gated behind a payment method or plan upgrade. I have no login to Mistral's console to fix this myself — needs you to check billing/plan there directly. Once it's resolved, retry `verify:chain` and the tool-support probe (both already written, just re-run them).

### Verification, everything above

Backend: typecheck clean, lint clean throughout, full suite 2,907/2,132/0-fail on `main`; on the feature branch, the same suite plus 12 new `adminIdentity` tests, full run in progress as this is written — will note the final number if anything differs. Frontend: typecheck clean, lint clean, full build clean on both branches (33 routes on the feature branch, including the 3 new portal/team pages).

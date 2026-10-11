# PropFyndr Chat Intelligence Roadmap (Phase-by-Phase)

This is the execution plan for making the advisor **more precise, cheaper per turn, and ready for all-India**, while we stay Noida-first on inventory. It sits beside `MASTER_EXECUTION_ROADMAP.md` (Days 1–7) and does not replace it.

Every phase **improves or re-aligns what exists — nothing is ripped out blind.** New behaviour ships behind a flag, runs in shadow first, and is promoted only when the corpus says it is at least as good. Old code is deleted only after its replacement has owned the traffic, and only after an explicit "yes" on a listed deletion set (CLAUDE.md § Deletion gates).

**Own-first rule.** Every capability below is built in-house unless it is genuinely impossible to own (an LLM, arbitrary live web search). Where we must use an outside service, we cache its output into our own tables so each fact is paid for once and becomes ours.

---

## Implementation Status (updated 2026-09-26)

Legend: ✅ done and verified · 🟡 built, switched off or waiting on you · ⏳ in progress · ⛔ blocked · ❌ not started · ➖ dropped (finding was wrong / not needed)

### The number that matters first
The real baseline is **31% pass, 59% of turns carrying the outage notice** (288 labelled questions, re-graded). The old grader called it 90% because it did not recognise the current outage wording. Root cause: **the billed Gemini key's prepaid credits are depleted (HTTP 402)**, so every turn runs on free-tier keys (12 req/min each) and fallbacks that are themselves rate-limited (Cohere 429, Groq 429) or stalling (NVIDIA). **Topping up Gemini billing in AI Studio is the single highest-impact action in this plan and only you can do it.** Everything else is measured against a broken provider until then.

### Step-by-step

| Phase | Step | Status | Notes |
|---|---|---|---|
| 0 | 0.1 Labelled router set | ✅ | 300 rows (200 corpus, 70 long-tail, 30 hand-written). **61 marked `uncertain` need a human pass.** |
| 0 | 0.2 `TurnTrace` table | ✅ | Applied. Every exit writes its lane; `topic:<handler>` names the handler. |
| 0 | 0.3 Scorecard | ✅ | `run-corpus.ts --labels` + `baseline.ts`. Multi-turn rows (10) not run yet — runner is single-turn. |
| 1 | 1.1 Post-stream re-check removed | ✅ | |
| 1 | 1.2 Handler integrity | ➖ | Already gated inside `executeWithFallbackChain`. |
| 1 | 1.3 Greeting before extraction | ➖ | `nothingToExtract` already skips the call. |
| 1 | 1.4 One injection check | ➖ | Not duplicates: `inputGuardrail` also covers chip payloads; the jailbreak regex catches tax-evasion asks with its own reply. Left as is. |
| 1 | 1.5 One model picker | ❌ | Needs a corpus A/B, meaningless until Gemini billing works. |
| 1 | 1.6 Dead code | ✅ | 4 modules + 7 tests + unused imports. `guardrails.outputGuardrail` kept (only its own test uses it; not in the approved list). |
| + | Outage-notice detection | ✅ | `isServiceFailureReply` missed the current wording, so outage notices could be cached and replayed. Fixed at `outageNotice.ts`; grader fixed too. |
| + | Fallback first-token timeout | ✅ | 4s → 8s (`OPENAI_INITIAL_TOKEN_TIMEOUT_MS`); NVIDIA legs were cut off one second before answering. Re-measure pending. |
| + | Inventory-count leak | ✅ | Builder coverage answer said "We track 8…" (breaks `INVENTORY_SIZE`; 8 was a `take` cap). |
| + | Yamuna Expressway | ✅ | DB holds 19 YEIDA projects; added to `SUPPORTED_CITIES` + prompt pack, three hand-appended copies removed. |
| + | Market figures in general prompt | ✅ | Landed-cost / loading / IFMS ranges now told to be quoted as typical, not verified. |
| 2 | 2.1 `DemandSignal` table | ✅ | Applied 2026-09-26. No phone column: nothing can send a notification yet. |
| 2 | 2.2 Market-answer lane | 🟡 | Built behind `OUT_OF_CITY_MARKET_ANSWERS=on`. Uses a separate out-of-coverage directive so the prompt never claims inventory in the other city. |
| 2 | 2.3 Chips | 🟡 | "I want PropFyndr in {city}" (a vote, no promise to notify). |
| 2 | 2.4 Record every signal | 🟡 | Fire-and-forget, on when the flag is on. |
| 2 | 2.5 Demand panel in `/admin` | ❌ | Held back while the admin panel is being restyled by hand. |
| 2 | 2.6 CLAUDE.md scope line | ❌ | Needs your approval (it edits your instructions file). |
| 3 | 3.1 Types / literals / resolve | 🟡 | `lib/jev/decision.ts` (types, Zod, topic allowlist). Entity resolution still happens downstream in the router, not in JEV. |
| 3 | 3.2 Decision prompt | ✅ | `jev` block rides on the intent call — no extra request. |
| 3 | 3.3 Merge into intent call | 🟡 | Gemini leg only; other legs return no decision. |
| 3 | 3.4 Shadow logging | ✅ | `turn_traces.jev_shadow`, `JEV_MODE=shadow`. |
| 3 | 3.5 Agreement report | ✅ | In `baseline.ts` (per-task JEV accuracy vs labels). |
| 3 | Verification run | ⛔ | 2026-09-26: **46.9% overall — fails the bar** (≥92% and ≥ old router + 10). Not a fair verdict yet: the model decided only 65 of 288 turns (billed Gemini 402, free keys rate-limited); on those 65 it scored **73.8%** vs old router 72.3%. The deterministic fallback ("all constraints read ⇒ discover") was right ~70% of the time. Re-run after Gemini billing is restored; fix fallback to emit no decision rather than assume `discover`. |
| 4 | Executor + cutover | ❌ | Gated on Phase 3 passing its bar. |
| 5 | 5.0 Embedding spike | ✅ → **no-go on current plan** | `multilingual-e5-small` q8: 384 dims, p50 5ms / p95 12ms, warm load 0.7s — but **420–530 MB RSS**, and Render `starter` is 512 MB. Needs Render Standard (2 GB) or a separate internal service. |
| 5 | 5.1–5.4 Knowledge base, editor, hybrid search | ❌ | Decision on hosting first; seed content needs an analyst. |
| 6 | Geography + statutory model | ❌ | Only the Yamuna fix above. |
| 7 | 7.1 Web-fact cache | ✅ | Reused existing Redis (`getCached/setCached`, 7-day TTL) instead of a new `WebFact` table — same effect, no migration. |
| 7 | One web module (`tavily.ts` → `web.ts`) | ❌ | |
| 7 | Scheduled fetchers | ❌ | |
| 7 | Distilled local router | ❌ | Needs ≥5,000 agreed JEV decisions first. |
| 8 | Profile, commute ranking, all-in price, Hinglish set | ❌ | |

**Progress:** 17 of 41 steps done or dropped-as-unnecessary, 6 built behind a flag / waiting on you, 1 running, 17 not started — **roughly 40% of the plan by step count, ~25% by effort** (Phases 4–8 are the large ones).

### What only you can unblock
1. **Top up the billed Gemini key** (402 prepayment depleted). Biggest single quality fix available.
2. Set `OUT_OF_CITY_MARKET_ANSWERS=on` (table exists since 2026-09-26).
3. Review the 61 `uncertain` rows in `backend/scripts/corpus/router-labels.json`.
4. Decide embedding hosting: Render Standard vs a separate small service.
5. Approve (or not) the CLAUDE.md V1-scope line in Step 2.6.

---

## Why This Plan Exists (Measured, 2026-09-26)

| Finding | Evidence |
|---|---|
| A turn passes through **~24 gates that can each return it**, almost all regex | `routes/chat-router.ts` — 6,782 lines (was ~4,400 on 2026-09-02), ~33 `res.end()` exits |
| **Four classifiers decide overlapping things** | `extractIntent` (LLM, `ai/intent.ts:501`), `classifyQuery` (`discovery/queryClassifier.ts:399`), `classifyIntent` (`ai/intentClassifier.ts:156`), `classifyShape` (`ai/inferenceProfile.ts`), plus ~15 topic-flag regexes (L3100–3126), `selectPlaybooks`, `detectOpenQuery` |
| Model choice decided twice | `routeToModel` and `profileFor` (L5599) |
| **Prompt head 7.8k–9.5k tokens** vs roadmap target 1.8k | `promptHeadSize.test.ts` ratchets 7,800 / 9,000 / 9,600 |
| A guard runs **after** the buyer has seen the answer | `guardrails-v2.validateAgainstFacts` at L5708 replaces only the saved copy |
| Topic-handler LLM output is **logged, never blocked** | `scanDisclosure` at L3376; `costSheet`, `paymentPlans`, `sectorComparison` call the LLM |
| Injection check runs **three times** | `sanitizeUserMessage` L247, `inputGuardrail` L565, jailbreak regex L2820 |
| Greeting/thank-you gates run **after** intent extraction + DB reads | L2873, L2912 |
| Out-of-city questions are **deflected**, not answered | L1946 coverage gate: "We're only serviceable in Noida & Greater Noida right now…" |
| `projects.embedding` seeded, **never read**; embeddings come from Cohere (external) | `vectorSearch.ts` — only `builder_news` is searched |
| Web search implemented **twice** | `lib/web.ts` and `lib/tavily.ts` |
| **No City model**; 826 `"Noida"` literals across 107 files; 27.5K hardcoded `sectorToCity.ts` | `schema.prisma:114` `city String @default("Noida")` |
| Stamp duty hardcoded to UP | `lib/calculators.ts` `calcStampDuty` — `rate = gender === 'female' ? 6 : 7 // UP rates` |
| Golden eval has 10 cases; the real harness is the corpus | `lib/eval/golden.json` (10) vs `scripts/corpus/` (321 + 120 + 67 + 50) |
| Dead modules | `guardrails.outputGuardrail`, `prompts/responseFormatter.ts`, `discovery/dataFetcher.ts`, `discovery/queryRouter.ts`, `discovery/intentTypeDetector.ts`, unused imports in `chat-router` (L39, L59–60) |

---

## High-Level Phase Architecture

| Phase | Focus Area | Core Objective | Key Deliverables | Effort |
|---|---|---|---|---|
| **Phase 0** | **Baseline & Safety Net** | Measure today before changing anything, so every later claim is a number. | Labelled router set (300), own `TurnTrace` table, `npm run baseline`, recorded scorecard. | 3–4 days |
| **Phase 1** | **Safe Fixes & Dead-Code Removal** | Close the real bugs found in the audit with the smallest diffs. | Pre-stream guard, handler answers through `checkAnswerIntegrity`, greeting before extraction, one injection check, one model picker. | 2–3 days |
| **Phase 2** | **Out-of-City: Honest Market Answer + Demand Capture** | Turn every "how is Whitefield?" into an honest market answer and a launch signal. | `DemandSignal` table, market-answer lane, "tell me when you launch" chip, demand panel in `/admin`. | 4–5 days |
| **Phase 3** | **JEV — Our Own Decision Layer (Shadow Mode)** | One structured decision per turn, built in-house, running silently next to the current router. | `lib/jev/` (literals + decision prompt + schema + fallback), merged into today's `extractIntent` call, agreement report. | 6–8 days |
| **Phase 4** | **JEV Executor & Progressive Cutover** | Let the decision drive the turn, one task at a time, deleting the gates it replaces. | `lib/jev/execute.ts`, per-task flags, decision-scoped prompt assembly (head ≤3,000 tokens), gate deletions. | 8–10 days |
| **Phase 5** | **Own Knowledge Base & Own Search** | Answer general real-estate questions from our own curated corpus with our own embeddings. | `KnowledgeDoc`/`KnowledgeChunk`, in-process multilingual embeddings, hybrid FTS+vector search over projects and knowledge, ANALYST editor. | 7–9 days |
| **Phase 6** | **All-India Geography & Statutory Model** | Make city #2 a data job, not a code job. | `State`/`City`/`Locality` tables, `StatutoryRate` by state, `sectorToCity` moved to data, buyer-visible Noida literals removed. | 5–6 days |
| **Phase 7** | **Own the Stack: Web-Fact Cache & Distilled Router** | Pay for each outside fact once; move routing off the LLM where we can. | `WebFact` cache, one web module, scheduled fetchers for trusted sources, in-process distilled JEV classifier. | 6–8 days |
| **Phase 8** | **Advisor Upgrades** | Close the ChatGPT-power-user gaps that matter for Indian buyers. | Cross-session buyer profile, commute-first ranking, all-in price on every card, Hinglish corpus. | 6–8 days |

Estimated total: **~7–9 weeks** for one engineer. Phases 1 and 2 are independent of JEV and can ship first.

### Estimated Impact (not measured — Phase 0 turns these into numbers)

| Phase | Answer quality | Tokens / turn | Notes |
|---|---|---|---|
| 1 | +5% (mostly safety) | −5% | Fabrication reaching the buyer on handler paths → ~0 |
| 2 | +3–5% overall; large on out-of-city turns | ~0 | Converts deflections into answers + demand rows |
| 3–4 | **+25–40% overall; +30–50% long-tail / Hinglish / multi-intent** | **−30–45%** | Router reuses the LLM call we already pay for |
| 5 | +15–25% on general real-estate questions | −10% | Fewer web calls; zero external embedding calls |
| 6 | 0 now; decides whether city #2 takes weeks or months | 0 | — |
| 7 | +0–5% | −10–20% on routing | Routing without an LLM call on common turns |
| 8 | +10–15% perceived quality | ~0 | Retention and trust, not raw accuracy |

---

## Non-Negotiable Guardrails For Every Phase

1. **Flags, not rewrites.** Every behaviour change reads a flag in `lib/config.ts` (default `off`). Production flips to `shadow`, then `on`, per task.
2. **Corpus gate before promotion.** No flag goes to `on` unless `npm run baseline` on the full corpus shows: judge score not lower than the Phase 0 baseline by more than 1 point, zero new `answerIntegrity` failures, zero new disclosure hits.
3. **Four tiers are untouched.** `verified / statutory / market / missing` (`lib/factPresentation.ts`) stay the contract. Nothing here adds a fifth tier or softens one.
4. **Field exposure is untouched.** Nothing selects outside `PROJECT_PUBLIC_SELECT`; `projectExposure.test.ts` must stay green.
5. **Promotions never touch ranking.** JEV decides *what to fetch*; it never reads promotional attribution.
6. **Migrations need in-session confirmation.** Every schema step below is marked **[MIGRATION — confirm first]**.
7. **Deletions need in-session confirmation.** Every deletion step lists exact files/lines and waits for a "yes".
8. **ERRORS.md / MEMORY.md.** Any approach that takes >2 attempts is logged in `ERRORS.md`; every phase closes with a decision entry in `MEMORY.md`.

---

## Phase 0: Baseline & Safety Net

### Goal
Know exactly how good the advisor is today — routing, correctness, cost, latency — so every later phase is judged by numbers, not impressions.

### Plain-English Summary (What We Are Doing & Why)

1. **A test for "did we understand the question?"**
   * **The Problem:** We grade answers, but nobody grades whether the router sent the question to the right place. A wrong lane produces a confident, well-written answer to the wrong question.
   * **The Solution:** Hand-label 300 real questions from the corpus with what they are actually asking (a fact about a project? a comparison? a market question? a calculation?) and which data should answer them. This becomes the exam every routing change must pass.
2. **Our own flight recorder for every turn.**
   * **The Problem:** Langfuse is configured but its connection currently fails (401). When a turn goes wrong we cannot see which gate took it, what it cost, or how long it took.
   * **The Solution:** A small table in our own Postgres that records, for every turn: which lane answered, which data sources were used, tokens in/out, latency, and whether a guard fired. No outside service needed; Langfuse becomes optional.
3. **One command that produces the scorecard.**
   * **The Solution:** `npm run baseline` runs the corpus, the router exam and the cost/latency summary, and writes one dated scorecard file we compare against forever.

---

### Technical Deep Dive & Execution Specs

#### 1. The Exact Gaps Closed
* No router-level ground truth exists; `intent-baseline.json` covers intent fields, not lane/source.
* `lib/eval/golden.json` has 10 cases — too few to detect a regression.
* No per-turn record of lane + tokens + latency in our own storage.

#### 2. Step-by-Step Implementation

##### Step 0.1: Labelled router set
* Create `backend/scripts/corpus/router-labels.json` — 300 entries sampled from `corpus.json` (200), `longtail.json` (70) and hand-written Hinglish/out-of-city cases (30).
* Each entry:
  ```json
  { "q": "3bhk under 1.5cr near metro, possession in a year",
    "history": [],
    "task": "discover",
    "entities": { "city": "Noida", "bhk": 3, "budgetMaxCr": 1.5 },
    "source_plan": ["db"],
    "shape": "advisory" }
  ```
* `task` vocabulary (fixed, also used by JEV): `discover | project_fact | compare | calculate | market_explain | legal_process | meta | lead | smalltalk | out_of_scope`.
* Two-person rule: one labels, the other reviews any row marked uncertain.

##### Step 0.2: Own `TurnTrace` table **[DONE 2026-09-26 — applied via `scripts/apply-migration.ts add_turn_traces`]**
* **As built:** `lane, query_kind, provider, model, prompt_chars, answer_chars, latency_ms, degraded, jev_shadow`. Token counts and cost were already recorded per session in `ai_usage_events` (read by `run-corpus.ts`), so the trace stores sizes, not a second copy of tokens. Written once from `res.on('finish')` — one call site covers every exit. Early exits now carry distinct lane names (`greeting`, `thanks`, `jailbreak`, `off-topic`, `id-document`, `budget-history`, `unresolved-pointer`, `coverage-lane`, `topic:<handler-id>`, `answer-cache`, …); anything else is written as `unlabelled`.
* `scripts/apply-migration.ts <name>` applies ONE migration and writes its ledger row — `prisma migrate deploy` stays unused (unrelated pending migrations, one drops a table).
* Original spec:
* `backend/prisma/schema.prisma`:
  ```prisma
  model TurnTrace {
    id            String   @id @default(uuid())
    session_id    String?
    lane          String          // gate/lane that returned the turn
    task          String?         // JEV task once Phase 3 lands
    sources       String[]        // ["db","knowledge","web","general"]
    provider      String?
    model         String?
    tokens_in     Int?
    tokens_out    Int?
    latency_ms    Int
    guard_fired   String?         // "answerIntegrity:META_LEAK" etc.
    jev_shadow    Json?           // Phase 3: JEV's decision for comparison
    created_at    DateTime @default(now())
    @@index([created_at])
    @@index([lane])
  }
  ```
* No message text, no phone, no guest token in this table — it is telemetry, not a transcript.
* Write fire-and-forget from the existing `persistEarlyTurn` and end-of-turn persistence, so every one of the ~33 exits records its lane with one call site per exit helper — not one per branch.

##### Step 0.3: Baseline scorecard **[DONE — `npx tsx scripts/corpus/run-corpus.ts --labels --limit=0 --tag=<t>` then `npx tsx scripts/corpus/baseline.ts results-<t>.json`]**
* `--labels` runs `router-labels.json` (single-turn rows; multi-turn rows need a history-aware runner, not yet built). Scorecards land in `scripts/corpus/scorecards/<date>-<tag>.json`.
* Original spec:
* `backend/scripts/corpus/baseline.ts`:
  * Runs `run-corpus.ts` on `corpus.json` + `longtail.json` (existing mechanical grading via `scanDisclosure`).
  * Runs `judge-answers.ts` (existing Gemini judge) on the demo set.
  * Scores lane correctness against `router-labels.json` by mapping today's lanes → `task`.
  * Reads `TurnTrace` for the run window: p50/p95 latency, mean tokens in/out, cost via `lib/ai/cost.ts`.
  * Writes `backend/scripts/corpus/scorecards/YYYY-MM-DD.json`.

#### 3. Verification & Pass Conditions
* `router-labels.json` has 300 rows, all reviewed.
* `TurnTrace` rows appear for every exit type in a 50-question smoke run (count distinct `lane` ≥ 15).
* First scorecard committed. **Every later phase cites its delta against this file.**

---

## Phase 1: Safe Fixes & Dead-Code Removal

### Goal
Fix the concrete bugs the audit found, with the smallest possible diffs, before any structural work.

### Plain-English Summary (What We Are Doing & Why)

1. **Stop checking answers after the buyer has already read them.**
   * **The Problem:** One fact-check runs after the answer has streamed to the screen. When it catches something, it only corrects our saved copy — the buyer already saw the wrong version.
   * **The Solution:** Run that check before streaming, like the others already do, or remove it if the main integrity check already covers it.
2. *(Two audit findings — unchecked handler answers, AI call on "hi" — turned out already handled; see corrected findings below.)*
4. **One safety check, not three; one model picker, not two.**
5. **Delete code nothing uses** — only after you approve the exact list.

---

### Technical Deep Dive & Execution Specs

#### 1. The Exact Bugs Fixed (re-verified against code 2026-09-26)
* **Corrected:** the audit said three handlers' LLM output skips `checkAnswerIntegrity`. False — `costSheet.ts:125`, `paymentPlans.ts:141`, `sectorComparison.ts:121` all call `executeWithFallbackChain`, which runs the integrity gate (`handlers/index.ts:56`). Only deterministic handler strings are scan-only (L3376), by design: they stream as written.
* **Corrected:** the audit said greetings pay for an intent LLM call. False — `nothingToExtract` (`ai/intent.ts:398`) already skips extraction for "hi", "what can you do", etc.
* **Real:** `guardrails-v2.validateAgainstFacts` (chat-router L5708) re-runs the same check `fallbackChain.ts:287` already runs on the buffer. It is in observe mode by default (`GUARDRAILS_V2_OBSERVE_MODE !== 'false'`), so it never blocks today. **Latent bug:** if observe mode is ever turned off, L5708 replaces the saved transcript *and the answer-cache entry* with a safe reply while the buyer already saw the original — transcript and screen disagree, and the next buyer gets the safe reply from cache.
* **Real:** injection checked at L247 (`sanitizeUserMessage`), L565 (`inputGuardrail`), L2820 (jailbreak regex, with its own buyer-visible reply).
* **Refined:** `routeToModel` does not duplicate `profileFor`; it can downgrade `profile.model` to lite (L5599). Removing it changes model choice, so it needs a corpus measurement first (Phase 0).

#### 2. Step-by-Step Implementation

##### Step 1.1: Remove the post-stream re-check **[DELETION — confirm first]**
* Delete the `validateAgainstFacts` block at chat-router L5705–5729 and its import (L131). The in-chain `validateAgainstFactsSync` call (`fallbackChain.ts:287`) keeps logging the same violations before flush.
* `toolBlindGuard` already covers the RERA shapes v2 misses ("UP-RERA Form-7 No. 1023").

##### Step 1.2: ~~Handler answers through integrity~~ — not needed (see corrected finding).

##### Step 1.3: ~~Greeting before extraction~~ — not needed (see corrected finding).

##### Step 1.4: One injection check
* Keep `sanitizeUserMessage` (L247) as the single entry. Fold any jailbreak phrases unique to L2820 into `INJECTION_PATTERNS`. Remove the L565 and L2820 calls (deletion gate).

##### Step 1.5: Model picker — measure, then decide
* `routeToModel` only downgrades to lite. Run the Phase 0 corpus with and without it; remove only if judge score and cost are no worse.

##### Step 1.6: Dead code **[DELETION — confirm first]**
Proposed list (each verified to have zero importers at time of deletion):
* `backend/src/lib/ai/guardrails.ts` → `outputGuardrail` only (keep `inputGuardrail` until 1.4 lands).
* `backend/src/lib/ai/prompts/responseFormatter.ts` + its test
* `backend/src/lib/discovery/dataFetcher.ts`, `backend/src/lib/discovery/queryRouter.ts` + tests (`dataFetcher`, `queryRouter`, `confidence`, `integrationTests`)
* `backend/src/lib/discovery/intentTypeDetector.ts` + tests (`intentTypeDetector`, `endToEndIntentFlow`)
* These are imported only by their own tests — no production importer.
* Unused imports in `chat-router.ts` L39, L59–60 (`streamWithGroq`, `streamWithOpenAI`, `webSearch`, `areaInfo`, `readPage`, StallErrors).
* **Not deleted:** `groq.ts`, `mistral.ts` — still used by `documents.ts`, `transcribe.ts`, `extendedIntent`, summary compression.

#### 3. Verification & Pass Conditions
* `npm test` green; `toolCatalogue.test.ts`, `projectExposure.test.ts`, `answerIntegrity.test.ts` green.
* Corpus scorecard: no regression.
* `tsc --noEmit` clean after deletions.

---

## Phase 2: Out-of-City — Honest Market Answer + Demand Capture

### Goal
When a buyer asks about a city we don't list (Whitefield, Gurgaon, Pune), give an honest market answer, say plainly we don't list projects there yet, offer to notify them — and record the demand so it tells us which city to launch next.

### Plain-English Summary (What We Are Doing & Why)

1. **Answer the question instead of deflecting.**
   * **The Problem:** Today, "how is the Whitefield market?" gets "We're only serviceable in Noida right now… Is Noida worth a look for you?" The buyer asked a real question and got a redirect. A ChatGPT-level user leaves.
   * **The Solution:** Answer the market question honestly — price direction, infrastructure, trade-offs — clearly labelled as general market information, not verified listings. Then: "We don't list projects in Bengaluru yet — we're Noida-first. Want me to tell you when we launch there?"
2. **Never pretend to have inventory we don't.**
   * No project shortlist, no project prices presented as ours, no "verified" language. Market figures always carry the market qualifier and their source.
3. **Every out-of-city question becomes a data point.**
   * **The Solution:** We record the city, the area, the budget if given, and whether they asked to be notified. Leaving a phone number is optional and only happens on their tap. The admin panel shows which cities buyers keep asking about.
4. **The Gurgaon-commute case stays exactly as it is.**
   * "I commute to Gurgaon" is a Noida buyer telling us their corridor — that must keep working.

---

### Technical Deep Dive & Execution Specs

#### 1. The Exact Behaviour Changed
* Coverage gate at `chat-router.ts` ~L1946 (`buyingTargetOutOfScope` → canned decline + envelope + Noida chips).
* `outOfScopeCity` regex in `lib/config/cities.ts` stays the detector for now (JEV replaces it in Phase 4).

#### 2. Step-by-Step Implementation

##### Step 2.1: `DemandSignal` table **[MIGRATION — confirm first]** (migration + model written; not applied)
* **As built:** no phone column. Nothing sends a launch notification, so the chip is an honest vote — **"I want PropFyndr in {city}"** — never "tell me when you launch". A notify channel (and a phone column) comes when something can actually send one.
```prisma
model DemandSignal {
  id           String   @id @default(uuid())
  city         String
  locality     String?
  budget_max_cr Float?
  bhk          Int?
  question_kind String          // "market" | "buy_intent"
  wants_notify Boolean  @default(false)
  phone        String?          // only when the buyer taps notify and enters it
  user_id      String?
  guest_token  String?
  session_id   String?
  created_at   DateTime @default(now())
  @@index([city, created_at])
}
```
* Attribution rule (CLAUDE.md § Signup Rules): a row names `user_id ?? guest_token`; rate-limit notify by guest token then IP.
* **Not a sales lead.** Does not enter `CallbackRequest`, does not appear in the SALES call queue, carries no `lead_tier`.

##### Step 2.2: Market-answer lane
* Replace the canned `send('token', …)` in the coverage gate with a call to the existing `runGroundedAnswer` (`lib/ai/groundedAnswer.ts`), passing a new mode `outOfCoverage: { city }`:
  * Sources: Phase 5 knowledge base when it exists → `webSearch` (trusted domains) → general knowledge with `MARKET_QUALIFIER`.
  * Prompt addition (below `SYSTEM_PROMPT_BOUNDARY`, so the cached head is unchanged): *"The buyer asked about {city}. We do not list projects there. Answer the market question honestly; name no project as available; every figure carries its source and the market qualifier; end by stating we are Noida-first and offering to notify them."*
  * Output passes `checkAnswerIntegrity`. `toolBlindGuard` already flags fabricated project names; add a rule: **no price-per-sqft or project name attributed to our inventory for a non-covered city.**
* Keep `buyingTargetOutOfScope`'s commute-anchor exception untouched.
* Flag: `OUT_OF_CITY_MARKET_ANSWERS=off|on`.

##### Step 2.3: Chips
* Replace the two Noida chips with:
  * `Tell me when you launch in {city}` → opens the existing phone-capture UI in a *notify* mode; writes `DemandSignal.wants_notify = true`.
  * `I commute to {city}` (kept).
  * `Show me what Noida has` (kept, lower priority).

##### Step 2.4: Always record the signal
* Every out-of-city turn writes a `DemandSignal` row (no phone) fire-and-forget; `question_kind` from the coverage reason.

##### Step 2.5: Demand panel in `/admin`
* `SUPER_ADMIN` + `ANALYST`: table of city × count (7/30/90 days), notify count, median budget. Phone numbers visible to `SUPER_ADMIN` only, through `adminFieldRedaction.ts`, reads recorded by `adminReadAudit.ts`.
* Reuse the canonical `StatCard` (Day 4) — no new card component.

##### Step 2.6: Doc alignment
* CLAUDE.md § V1 Scope reads "Supported: Noida…". Add one line: *"Market questions about any Indian city are answered at the market tier; inventory and recommendations remain Noida-only."* — proposed, applied only on approval.

#### 3. Verification & Pass Conditions
* 30 out-of-city cases in `router-labels.json`: 0 project recommendations, 100% carry the "we don't list projects there yet" line, 100% of figures qualified.
* "I have a daily commute to Gurgaon — which Noida sectors?" still gets a Noida shortlist.
* `DemandSignal` rows written for every out-of-city smoke turn; none appear in the SALES queue.

---

## Phase 3: JEV — Our Own Decision Layer (Shadow Mode)

### Goal
Build our own decision layer, **JEV**, that reads each turn once and returns one structured decision — what the buyer wants, about what, from which data, in what shape — and run it silently beside the current router until it is proven better.

### Plain-English Summary (What We Are Doing & Why)

1. **One brain instead of four.**
   * **The Problem:** Four different pieces of code each guess what the buyer means, and sometimes disagree. Fixing one question with a new pattern breaks a neighbouring one. Mixed English-Hindi questions defeat the patterns entirely.
   * **The Solution:** JEV reads the message and the conversation so far, and returns one decision. Everything downstream follows it.
2. **No extra cost.**
   * We already make one AI call per turn to read the buyer's intent. JEV replaces that call's instructions; it does not add a call.
3. **Hard facts stay deterministic.**
   * Numbers, BHK, sector numbers and prices are still read by our own exact rules, and those rules override the AI when both have an answer — the same approach the codebase already uses (`applyLiterals`).
4. **Silent first.**
   * For the whole phase, the old router still answers every buyer. JEV only writes down what it *would* have done. We compare its choices against the 300-question exam and against live traffic before it touches a single answer.

---

### Technical Deep Dive & Execution Specs

#### 1. Components (all in-house)

| File | Role | External calls |
|---|---|---|
| `lib/jev/types.ts` | `JevDecision` type + Zod schema | none |
| `lib/jev/literals.ts` | Deterministic extraction (wraps existing `intentDeterministic.ts` + `applyLiterals`) | none |
| `lib/jev/resolve.ts` | Entity resolution against our DB (wraps `resolveProjectNames`, sector normaliser, `cities.ts`) | none |
| `lib/jev/prompt.ts` | Decision prompt (~400 tokens, stable prefix for caching) | — |
| `lib/jev/decide.ts` | Orchestration: literals → one LLM call through existing `FALLBACK_CHAIN` → Zod validate → resolve → merge | existing chain only |
| `lib/jev/fallback.ts` | Deterministic decision when the call fails/times out (today's regex classifiers, unchanged) | none |

No new packages. Structured output uses the existing Gemini JSON mode already used by `extractIntent`.

#### 2. As built (Phase 3 shadow, 2026-09-26)
* `lib/jev/decision.ts`: when `JEV_MODE=shadow|on`, the intent-extraction prompt gains a `jev` block and the same Gemini reply carries both — no extra request. `fields` are abstract topics (`payment_plan`, `rera`, …), not column names; unknown values are dropped at parse time, so the model cannot name a forbidden relation.
* Turns that skip the model (deterministic fast path, no-signal) get **no decision**. A `discover` fallback was tried and removed 2026-09-26: it was wrong on 32 of 106 turns ("sector 137 vs 150", "axis bank sector 75"), because a sector number being readable says nothing about what is asked. Phase 4 must give those turns a decision — either a JEV-only lite call when the fast path fires, or a local classifier (Phase 7). Non-Gemini legs return no decision yet.
* **Known limit:** the intent call sees the message and previous intent, not the transcript, so "compare it with the second one" is judged without the shortlist. Phase 4 adds the last-turn summary.

#### 2a. The Decision Contract (target)
```ts
export interface JevDecision {
  task: 'discover' | 'project_fact' | 'compare' | 'calculate' | 'market_explain'
      | 'legal_process' | 'meta' | 'lead' | 'smalltalk' | 'out_of_scope'
  entities: {
    projectIds: string[]        // resolved by resolve.ts, never free text
    localities: string[]
    city: string | null
    builderId: string | null
  }
  intentPatch: Partial<Intent>  // today's extractIntent output, same type
  fieldsNeeded: string[]        // e.g. ["payment_plan","possession_date"]; allowlisted
  sourcePlan: Array<'db' | 'statutory' | 'knowledge' | 'web' | 'general'>
  shape: 'lookup' | 'factual' | 'advisory' | 'reasoning'
  coverage: 'inventory' | 'knowledge_only'   // Noida vs rest of India
  clarify: string | null        // at most one question (existing oneQuestion.ts rule)
  confidence: number            // internal only, never shown to buyers
  via: 'llm' | 'fallback'
}
```
* `fieldsNeeded` values are an allowlist derived from `PROJECT_PUBLIC_SELECT` — JEV can never request a forbidden relation or internal column. Test: `jevFields.test.ts` fails on any value outside the allowlist.
* `sourcePlan` ordering rule enforced in code, not prompt: `db` before `statutory` before `knowledge` before `web` before `general`.

#### 3. Step-by-Step Implementation

##### Step 3.1: Types + literals + resolve (pure, no LLM)
* Unit-tested against `router-labels.json` entities: literal extraction accuracy ≥ today's `intentDeterministic` on `intent-baseline.json`.

##### Step 3.2: Decision prompt
* Stable part (cacheable): task definitions with 2 examples each, including Hinglish ("sector 150 mein 3bhk kitne ka hai" → `project_fact` / `discover`).
* Variable part: last 3 turns summarised from `IntentState` + `focus_project_id` + current message.
* Output: JSON only. Temperature 0.

##### Step 3.3: Merge into today's intent call
* `extractIntent` (`ai/intent.ts:501`) becomes a thin caller of `jev.decide()` and returns `decision.intentPatch` to existing consumers — **every current consumer keeps working unchanged.**
* The deterministic fast path that skips `extractIntent` today stays; on those turns JEV uses `fallback.ts` (0 LLM calls).

##### Step 3.4: Shadow logging
* Flag `JEV_MODE=off|shadow|on`. In `shadow`, the decision is written to `TurnTrace.jev_shadow` next to the lane the old router actually used. No buyer-visible change.

##### Step 3.5: Agreement report
* `backend/scripts/corpus/jev-report.ts`: accuracy on `router-labels.json`; confusion matrix per task; live agreement vs old lanes from `TurnTrace`; list of disagreements for human review (who was right?).

#### 4. Verification & Pass Conditions
* JEV task accuracy on `router-labels.json` **≥ 92%** and **≥ old router + 10 points** (old router's score comes from Phase 0).
* Entity accuracy ≥ literal baseline; 0 forbidden `fieldsNeeded` values across the corpus.
* p95 added latency ≤ 150 ms vs today's `extractIntent` (same call, different instructions).
* Fallback path exercised: forcing the chain to fail yields a valid decision with `via: 'fallback'` on 100% of the 300.
* One week of shadow traffic reviewed; disagreement categories written into `MEMORY.md`.

---

## Phase 4: JEV Executor & Progressive Cutover

### Goal
Let JEV's decision drive the turn — one task at a time — and delete each regex gate once its task is fully owned by JEV.

### Plain-English Summary (What We Are Doing & Why)

1. **Decision first, then action.**
   * JEV decides; a single dispatcher calls the handler that already exists for that job (payment plans, cost sheets, comparisons, discovery). We reuse the handlers — we replace only the tangle of checks in front of them.
2. **One job at a time.**
   * We switch over the simplest, safest job first, check the scorecard, then the next. If any job gets worse, we flip it back instantly with its flag.
3. **Smaller, sharper prompts.**
   * Because JEV says exactly what the question needs, the AI only receives the rules and data for *that* question. Today it reads ~9,000 tokens of instructions every turn; the target is ≤3,000. Cheaper, faster, and the AI pays more attention to what matters.
4. **The router file shrinks by most of its size** as each gate it no longer needs is removed.

---

### Technical Deep Dive & Execution Specs

#### 1. Components
* `lib/jev/execute.ts` — `switch (decision.task)` dispatching to existing functions:

| Task | Existing code it calls |
|---|---|
| `smalltalk` | greeting / thanks replies (Phase 1) |
| `meta` | `asksAboutTheConversation` reply from `IntentState` (`metaQuestions.ts`) |
| `calculate` | `lib/calculators.ts` via existing calculator handlers |
| `project_fact` | `runTopicHandlers` (19 handlers) → `getProjectDataForQuery` (`projectDataGateway.ts:793`) with `fieldsNeeded` |
| `compare` | comparison handler / `buildForensicVectors` |
| `discover` | `discoverProjects` (`discovery/projects.ts:729`) + multi-dim on ranking |
| `market_explain` / `legal_process` | `runGroundedAnswer` with `sourcePlan` |
| `out_of_scope` / `coverage: knowledge_only` | Phase 2 lane |
| `lead` | existing phone/callback capture |

* `lib/jev/prompt-assembly.ts` — builds the tail from `task` + `fieldsNeeded`: only the relevant `selectPlaybooks` entries, only the relevant fact block, only the tables that will render. Stable head stays byte-identical (`promptPrefixStability.test.ts`).

#### 2. Step-by-Step Implementation

##### Step 4.1: Per-task flags
* `JEV_TASKS=smalltalk,meta` style allowlist. A task not in the list runs through the old cascade.

##### Step 4.2: Cutover order (safest first)
1. `smalltalk`, `meta`
2. `calculate`
3. `project_fact`
4. `compare`
5. `market_explain`, `legal_process`
6. `discover` (highest traffic, last)

For each: flip to `on` in staging → `npm run baseline` → promote if the corpus gate passes → one week live → next.

##### Step 4.3: Gate deletion after each task **[DELETION — confirm first]**
* When a task has been `on` for a week with no rollback, list the gates it made unreachable (e.g. topic-flag regexes L3100–3126 after `project_fact`; `classifyIntent` PROJECT_DETAIL lane L3995 after `project_fact`; `classifyQuery` usage after `discover`). Delete on approval.
* Safety gates are **never** deleted: rate limit, sanitize, Aadhaar/PAN, IDOR ownership, phone capture.

##### Step 4.4: Prompt head ratchet
* Lower `promptHeadSize.test.ts` ratchets per task as it cuts over; final target **≤3,000 tokens** for every shape.

##### Step 4.5: Retire the extra intent extractor
* `extendedIntent.ts` (second LLM intent call on RANKING turns, 2.5s deadline) folds into JEV's `intentPatch`; remove after `discover` cutover (deletion gate).

#### 3. Verification & Pass Conditions
* Each task: corpus gate passed before promotion; rollback flag tested.
* After `discover`: `chat-router.ts` ≤ 2,500 lines; classifiers deciding routing = 1 (JEV) + its deterministic fallback.
* Mean input tokens per turn down ≥ 30% vs Phase 0 scorecard.
* Guard tests green throughout: `dueDiligenceFabrication.test.ts`, `answerIntegrity.test.ts`, `projectExposure.test.ts`, `toolCatalogue.test.ts`.

---

## Phase 5: Own Knowledge Base & Own Search

### Goal
Answer general real-estate questions ("carpet vs super area?", "can I claim HRA and home-loan interest together?", "what does RERA registration protect?") from our own curated, cited corpus — and search projects and knowledge with our own embeddings, no outside embedding service.

### Plain-English Summary (What We Are Doing & Why)

1. **Our own real-estate library.**
   * **The Problem:** General questions go to live web search today. That is slower, costs money per call, and returns whatever the web says.
   * **The Solution:** A library of short, checked articles written or approved by our team — RERA rules, home-loan rules, tax deductions, stamp duty by state, how registry and possession work. Each article carries its source and the date it was last checked. The analyst team can edit it in the admin panel.
2. **Our own search engine for it.**
   * We turn text into searchable vectors on our own server instead of paying an outside company, using a model that understands Hindi and English. We search projects the same way, so "godrej wala project sector 150 mein" finds the right one.
3. **The order of trust is fixed in code:** our project data → fixed legal rates → our library → the web → general knowledge, each labelled with its tier.

---

### Technical Deep Dive & Execution Specs

#### 1. Components
* **Tables [MIGRATION — confirm first]:**
  ```prisma
  model KnowledgeDoc {
    id            String   @id @default(uuid())
    slug          String   @unique
    title         String
    body_md       String
    tier          String           // "statutory" | "market"
    state_code    String?          // null = all-India
    source_url    String
    source_name   String
    last_checked  DateTime
    status        String   @default("DRAFT")   // DRAFT | PUBLISHED (same gate as IntelligenceStatus)
    chunks        KnowledgeChunk[]
    updated_at    DateTime @updatedAt
  }
  model KnowledgeChunk {
    id         String   @id @default(uuid())
    doc_id     String
    doc        KnowledgeDoc @relation(fields: [doc_id], references: [id], onDelete: Cascade)
    ordinal    Int
    text       String
    embedding  Unsupported("vector")?
    tsv        Unsupported("tsvector")?
  }
  ```
  Only `PUBLISHED` docs are buyer-facing.
* **Own embeddings:** `lib/embeddings/local.ts` using `@huggingface/transformers` (ONNX, in-process Node) with `multilingual-e5-small` (384 dimensions — same size as today's Cohere vectors, so existing `vector` columns and indexes carry over).
  * **New dependency — justification:** removes the only external call in retrieval (Cohere), adds Hindi/Hinglish understanding, zero per-call cost.
  * **Uncertain — spike first (Step 5.0):** RAM (~150–250 MB model load) and CPU latency on the current Render instance size are unverified.
* **Hybrid search:** `lib/search/hybrid.ts` — Postgres full-text (`tsvector`) + pgvector cosine, merged with Reciprocal Rank Fusion. One function used for projects and knowledge.

#### 2. Step-by-Step Implementation

##### Step 5.0: Spike (1 day, go/no-go)
* Load the model in the backend process on a Render-equivalent instance; measure cold load, p95 embed latency for a 20-word query, and resident memory.
* **Go** if p95 ≤ 60 ms and memory fits. **No-go** fallback: run the same model as a tiny separate internal service on our own host (still ours), or keep Cohere for projects only — decision logged in `MEMORY.md`.

##### Step 5.1: Seed the library
* 150–250 docs for launch, written/approved by an ANALYST. Priority list:
  * UP stamp duty, registration, GST on under-construction vs ready (statutory, `state_code: UP`)
  * RERA Act basics, UP-RERA complaint process, what "RERA registered" does and does not protect
  * Home loan: RBI LTV bands, pre-approval, floating vs fixed, balance transfer
  * Tax: Section 24(b), 80C, first-time-buyer provisions, joint-owner claims
  * Process: booking → BBA → possession → registry → OC/CC meaning
  * Area terms: carpet / built-up / super built-up, loading, PLC, IFMS
* Each doc cites a primary source (government notification, RBI circular, RERA portal).

##### Step 5.2: Admin editor
* `/admin/knowledge` — `ANALYST` edits, `SUPER_ADMIN` publishes. Re-embed on publish. Reads/writes audited.

##### Step 5.3: Wire into JEV
* `sourcePlan` including `knowledge` → `hybrid.search({ scope: 'knowledge', state })` → top 4 chunks into the tail with their source line. Answer cites the source name and "last checked" date.
* `runGroundedAnswer` checks knowledge **before** `webSearch`; web only when knowledge returns nothing above the relevance floor.

##### Step 5.4: Project search
* Re-embed `projects.embedding` with the local model (one script, idempotent). Use `hybrid.search({ scope: 'projects' })` inside `resolve.ts` for fuzzy project names — never inside ranking (ranking stays `discoverProjects` scoring).

#### 3. Verification & Pass Conditions
* 60 general real-estate questions added to the corpus: ≥ 85% answered from knowledge (no web call), 100% with a source line.
* Fuzzy project-name resolution on 50 misspelled/Hinglish names: ≥ 90% correct (baseline measured first with today's resolver).
* Zero Cohere embedding calls in `TurnTrace` for a full corpus run (if Step 5.0 is a go).

---

## Phase 6: All-India Geography & Statutory Model

### Goal
Make adding city #2 a data-entry job: states, cities, localities and state-specific statutory rates live in tables, not in code.

### Plain-English Summary (What We Are Doing & Why)

1. **Places become data.**
   * **The Problem:** "Noida" is typed into the code 826 times, and the list of sectors is a 27K hand-written file. Launching Gurgaon today means editing dozens of files.
   * **The Solution:** A proper list of states, cities and localities in the database. The code asks the database, not a hardcoded list.
2. **Tax and stamp duty by state.**
   * **The Problem:** Stamp duty is hardcoded to Uttar Pradesh's 7% / 6%. Maharashtra, Karnataka and Haryana all differ.
   * **The Solution:** A rates table keyed by state, with the date each rate took effect and its government source. The calculators read it.
3. **No big-bang rewrite.**
   * We fix the places buyers can *see* first (canned replies, chips), make a rule that new code never types a city name, and clean the rest as files are touched.

---

### Technical Deep Dive & Execution Specs

#### 1. Components **[MIGRATION — confirm first]**
```prisma
model State    { code String @id  name String  cities City[] }
model City     { id String @id @default(uuid())  name String  state_code String  state State @relation(fields: [state_code], references: [code])
                 inventory_live Boolean @default(false)   // true = Noida, Greater Noida, Greater Noida West
                 localities Locality[]  @@unique([name, state_code]) }
model Locality { id String @id @default(uuid())  city_id String  city City @relation(fields: [city_id], references: [id])
                 name String  aliases String[]  kind String   // "sector" | "neighbourhood"
                 @@unique([city_id, name]) }
model StatutoryRate {
  id           String   @id @default(uuid())
  state_code   String
  kind         String            // "stamp_duty" | "registration" | "gst_under_construction" ...
  rate_pct     Float
  condition    Json?             // e.g. { "buyer": "female" }
  effective_from DateTime
  source_url   String
  @@index([state_code, kind, effective_from])
}
```
* `Project.city` (string) stays in place; add nullable `city_id` + backfill. No column is dropped in this phase.

#### 2. Step-by-Step Implementation
##### Step 6.1: Seed
* All states + the 20 cities named in `OUT_OF_SCOPE_CITY` + Noida/Greater Noida/GNW (`inventory_live = true`).
* Move `sectorToCity.ts` entries into `Locality` (script, idempotent); `sectorToCity.ts` becomes a thin reader with an in-memory cache, same exported API — callers unchanged.

##### Step 6.2: `cities.ts` reads the DB
* `SUPPORTED_CITIES` = `City where inventory_live`, cached. `outOfScopeCity` matches against `City` names + `Locality.aliases`. `PILOT_SCOPE_LABEL` derived.
* JEV `resolve.ts` sets `coverage` from `inventory_live`.

##### Step 6.3: Calculators read `StatutoryRate`
* `calcStampDuty(priceCr, gender, stateCode = 'UP')` — reads the latest effective rate; UP rows seeded with today's 7% / 6% / 1% so outputs are byte-identical. Test asserts parity.
* The "no hardcoded figures in the router" rule (CLAUDE.md § Four Tiers) is now fully true for statutory values.

##### Step 6.4: Buyer-visible literals first
* Replace "Noida" in canned replies and chips (e.g. L1955, L2876) with `PILOT_SCOPE_LABEL` / the resolved city.
* ESLint rule (custom, in-repo): new code in `backend/src` may not contain the string literal `'Noida'` outside `lib/config/` and tests. Existing occurrences are grandfathered via a baseline file; the count may only go down.

#### 3. Verification & Pass Conditions
* Calculator parity tests: every UP output unchanged to the rupee.
* Adding a test city (`inventory_live = false`) via SQL alone makes out-of-city detection and the Phase 2 lane work for it — no code change.
* Buyer-visible Noida literals = 0; lint baseline committed.

---

## Phase 7: Own the Stack — Web-Fact Cache & Distilled Router

### Goal
Pay for each outside fact once, keep it in our own tables, and move common routing decisions off the LLM entirely.

### Plain-English Summary (What We Are Doing & Why)

1. **Remember what we looked up.**
   * **The Problem:** When we search the web, the result is used once and forgotten. The next buyer asking the same thing pays again.
   * **The Solution:** Every web result we use is saved with its source and an expiry date. Repeat questions are answered from our own copy.
2. **Fetch trusted sources ourselves.**
   * For the handful of sources that matter most (the RERA portal, government stamp-duty notices, the RBI repo rate), a scheduled job of ours checks them and updates our tables — no search service in between.
3. **Teach our own small router.**
   * After months of JEV decisions (checked against the exam), we train a small model that runs inside our server and makes the common decisions in milliseconds with no AI call. JEV's AI call is kept only for the hard or unusual questions.

---

### Technical Deep Dive & Execution Specs

#### 1. Components
* **One web module:** merge `lib/tavily.ts` into `lib/web.ts` (single implementation; `vicinityLookup` and `builderReputation` switch imports) **[DELETION of `tavily.ts` — confirm first]**.
* **`WebFact` table [MIGRATION — confirm first]:** `{ query_key, entity_key?, answer_snippet, source_url, source_name, fetched_at, expires_at }`. TTL by kind: market prices 30 days, infrastructure news 7 days, rules/regulations 90 days.
* **Scheduled fetchers:** `backend/scripts/fetchers/` run by the existing `outboxDispatcher`/cron pattern — UP-RERA project status, RBI repo rate, state stamp-duty notification pages. Output lands in `StatutoryRate`, `KnowledgeDoc` (as DRAFT for analyst review) or project rows. Nothing auto-publishes to buyers.
* **Distilled router:** `lib/jev/local-classifier.ts` — TF-IDF + logistic regression (or a small ONNX text classifier on the same runtime as Phase 5), trained from `TurnTrace.jev_shadow` decisions that agreed with the labelled set. Runs in-process.

#### 2. Step-by-Step Implementation
##### Step 7.1: Cache-through web
* `webSearch` checks `WebFact` by normalised `query_key` first; writes on miss. Cached facts still carry the market tier + source + fetched date to the buyer.

##### Step 7.2: Fetchers
* One fetcher per source, each with a parser test on a saved HTML fixture (so a site redesign fails a test, not a buyer answer).

##### Step 7.3: Distillation
* Train on ≥ 5,000 agreed decisions; hold out the 300 labelled set.
* Use the local classifier only when its confidence ≥ threshold **and** it agrees with literals; otherwise JEV's LLM call runs. Flag: `JEV_LOCAL_FIRST`.

#### 3. Verification & Pass Conditions
* Web calls per 1,000 turns down ≥ 50% after 30 days of cache fill.
* Local classifier on the held-out 300: accuracy within 2 points of JEV-LLM on the tasks it handles; handles ≥ 60% of live turns.
* Fetchers: fixture tests green; analyst review queue shows drafts, zero auto-published.

---

## Phase 8: Advisor Upgrades

### Goal
Close the gaps a ChatGPT-level Indian buyer notices first: being remembered, commute-first thinking, honest all-in prices, and fluent Hinglish.

### Plain-English Summary (What We Are Doing & Why)

1. **Remember returning buyers.** A logged-in buyer who comes back is greeted with what we know: "Still looking around ₹1.5 Cr near Sector 62?" They can see and edit what we remember.
2. **Rank by commute, not just sector.** "Under 45 minutes to my office" matters more than a sector number. The commute time we can already calculate becomes a ranking input when the buyer gives a workplace.
3. **All-in price on every card.** Base price plus stamp duty, registration, GST, PLC and parking, labelled with which parts are verified for this project and which are statutory. No typical-value fill-ins.
4. **Hinglish as a first-class language.** A Hinglish test set is added to the corpus, and every phase above is graded on it.

---

### Technical Deep Dive & Execution Specs

#### 1. Step-by-Step Implementation
##### Step 8.1: Cross-session profile
* Reuse `UserMemory` (schema L828) — persist `IntentState` summaries (`summary_location/financial/timeline`), shortlist, workplace, deal-breakers for authenticated users only. Guest tokens keep session-only memory.
* JEV `meta` task answers "what do you remember about me?" from this, with an edit/forget action (existing `forget`-style endpoint if present; else a small route).

##### Step 8.2: Commute-first ranking
* When `intent.workplace` is set, `discoverProjects` scoring adds commute minutes from existing `commute` / `Connectivity` data as a ranked factor (Recommendation Framework item 6, "nearby infrastructure"). **Promotional data is never an input** (test asserts).

##### Step 8.3: All-in price
* Card renders `marketTable.ts` cost-sheet rows: project-verified items (from project rows) + statutory items (from `StatutoryRate`). Missing project items say "Not on record" — never a default multiplier (see MEMORY.md: landed-cost 1.30 default still open).

##### Step 8.4: Hinglish corpus
* `backend/scripts/corpus/hinglish.json` — 100 real-style queries; added to `npm run baseline`.

#### 2. Verification & Pass Conditions
* Returning-buyer smoke: profile restored, editable, forgettable; guests never see another session's memory.
* Commute ranking: with a workplace set, top-3 median commute improves vs Phase 0 on the same queries; promotion test green.
* Hinglish set: judge score within 5 points of the English set.

---

## Explicitly Not In This Plan (and why)

* **Rewriting `chat-router.ts` from scratch** — 6.8k lines hold edge cases only partly covered by guard tests; the per-task cutover in Phase 4 gets the same end state without the risk.
* **Replacing the LLM chain with our own model** — not realistic at our scale; we own routing, retrieval, knowledge and verification instead, which is where precision comes from.
* **WhatsApp bot, voice, alerts** — valuable post-validation (India is WhatsApp-first) but not before Noida product-market fit. Tracked in `roadmap-future`.
* **Multi-agent orchestration** — one decision + one answer call is faster, cheaper and easier to verify.

---

**Created:** 2026-09-26
**Owner:** Chat/AI track
**Depends on:** `MASTER_EXECUTION_ROADMAP.md` Day 2 observability work (Phase 0 replaces the Langfuse dependency with `TurnTrace`, but does not remove Langfuse).

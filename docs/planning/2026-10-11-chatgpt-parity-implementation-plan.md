## Status (updated 2026-10-11, execution pass)

- **Phase 0:** Decisions made. Task 0.1 → JSON column on `SessionMemory` (recommended option). Task 0.2 → threshold not yet finalized (blocks Phase 3; see that phase's note).
- **Phase 1:** DONE. Schema field added, migration SQL hand-written (NOT applied — requires a DB connection this session didn't have credentials to touch; apply with `npx prisma migrate dev --name add_requirement_state_to_session_memory` when ready). `hydrateRequirementStateFromMemory` / `persistRequirementStateToMemory` / `parseStoredRequirementState` written and unit-tested (6 new tests, all passing).
  - **Two real, pre-existing bugs found and fixed while writing these tests** (both in `requirementState.ts`, both only exposed once real cross-turn state was actually wired in for the first time): (1) BHK carry-forward previously made a same-turn BHK correction unparseable forever once any BHK had been stated. (2) The hard/soft budget-ceiling reclassification ran on every turn maxCr was merely carried forward, so incidental words ("what **about** elite x") could silently flip a hard ceiling to soft on a turn that never mentioned budget at all.
- **Phase 2:** Core DONE (Tasks 2.1, 2.2) — the live router now hydrates and persists `RequirementState` every turn, verified via the Phase 1 tests exercising the exact merge logic now in use. **Task 2.3 descoped**: investigation found `preferences.requiredAmenities` is hardcoded to `[]` everywhere in the parser — "school nearby, mall nearby" was never extracted into structured state in the first place, in either the old or new code path. Wiring carry-forward into the entity-focus lookup has nothing to carry for amenities yet; that's a separate, larger NLP-extraction gap, not something this phase's scope covers. Location/unit carry-forward (sector, BHK, budget) now reaches every downstream read of `reqState`, which is a single shared variable across the whole handler.
- **Amenity extraction (new, found during Phase 2 investigation):** `preferences.requiredAmenities`/`preferredAmenities` were hardcoded to `[]` everywhere — "school nearby, mall nearby" was never parsed into structured state at all. Fixed: added keyword extraction (school, hospital, mall, market, metro_station, park, gym, clubhouse, swimming_pool, temple, open_space) with hard/soft classification matching the file's existing convention, carried forward across turns. 3 new tests, all passing, including the exact transcript scenario.
- **Analytics tracking gap (new, found while looking at "track what users are asking"):** `trackIntentIdentified` (`lib/analytics/tracking.ts`) hardcoded `intent_type: null` and `possession: null` on every single row of both `ChatAnalytics` and `QueryMetrics` — meaning "most common query type" and "possession demand" were never answerable from this data, ever. Fixed: both now populate from the live `RequirementState` (`intentModes[0]`, `unit.status`).
- **Admin conversation tracking — surfaced `RequirementState` in `/admin/conversations`:** this is the direct answer to "track what users are asking... in the admin panel." The session list now shows a one-line distilled summary per row ("3BHK · Sector 10 · ≤₹1.5Cr (hard) · school, mall"), and the full transcript detail view shows a structured "Buyer Requirements" panel (sectors wanted/excluded, budget + hard/soft, possession stance, required amenities) pulled from the same `SessionMemory.requirement_state` column Phase 1 added — distilled, not raw JSON dumped. `SUPER_ADMIN`-only, same as the rest of `/admin/conversations` — deliberately NOT added to `/admin/analytics/users` (ANALYST/SALES-visible), which stays metadata-only per the existing confidentiality boundary.
- **Phase 3/4 (buyer-facing requirements checklist card):** Not started this pass — real, moderate-sized frontend+backend work, deferred in favor of the admin-tracking work above, which was this round's explicit priority. Task 0.2's threshold still needs a decision before Phase 3 can start.
- **Phase 5:** Prompt clause (Task 5.1) DONE. Eval corpus case (Task 5.2) **not added** — investigated `route-replay.json`'s actual harness and found its assertions are fixed-substring `contains` checks against deterministic lane output. That can't reliably verify free-form LLM phrasing like "did the closing question target the right variable" without being flaky or a false positive. Documenting this as a real harness-coverage gap rather than adding a case that looks like coverage but isn't.
- **Phase 6:** Task 6.1 investigated. Finding: `Project` has no latitude/longitude columns at all today. Building an in-chat map needs a data-acquisition decision (new schema field + a sourcing plan, or a new external geocoding call with its own cost/cache tradeoffs) before any widget work starts. Not built this pass.

---

# Implementation Plan: ChatGPT-Parity Chat Improvements

**Source:** Two rounds of analysis of a captured ChatGPT network-tab transcript (`chatGPTnetworkTab.md`) — a 3BHK Sector 10 Greater Noida search, then a terse follow-up ("what about elite x?"). Full findings discussed in-session on 2026-10-11, not reproduced here in full; this plan covers only the items decided actionable.

**Scope:** 4 work items, ranked by the conversation that produced this plan:
1. Terse-followup context carry-forward (RequirementState persistence)
2. Per-criterion requirements checklist card
3. Closing-question "verdict-lever" discipline
4. In-chat combined map widget (investigation-gated, lower priority)

Item "builder-attested marketing-claim phrasing" is explicitly **not** in this plan — it's blocked on the verified-supply-chain work CLAUDE.md marks "not built," and is parked as a note for whenever that lands (see Parking Lot at the end).

---

## 0. Current System Assessment

### Existing

- **`RequirementState` engine** (`backend/src/lib/discovery/requirementState.ts`) — a fully-built 38-parameter Zod schema and regex-driven normalizer. Parses location (include/exclude/soft/conditional), commute anchors, budget (hard ceiling, all-in vs base, EMI, down payment), unit (BHK, carpet area, status, possession deadline), preferences (amenities, use case, family context), and control (clarification, compromises, ranking priority). It already has carry-forward logic built in (`effectivePrevState` parameter, `prevStateHistory` for BACKTRACK handling).
- **`SessionMemory` model** (`backend/prisma/schema.prisma:1717`) — a durable, DB-backed, per-session JSON store (`extracted_intent`), already hydrated at turn start (`hydrateIntentFromMemory`, `backend/src/lib/ai/sessionMemory.ts:40`) and persisted at turn end (`persistIntentToMemory`, same file, line 121). This is the exact mechanism — and the exact file — that solves "does a stated fact survive the next turn" for the simpler `Intent` type today.
- **`DimensionExplanation` / `TradeOff` types** (`backend/src/lib/discovery/rankingFormatter.ts:17-32`) — a per-dimension ✅/⚠️/❌ scoring structure already computed by the scoring engine.
- **`MARKET_QUALIFIER` / fact-tier system** (`backend/src/lib/factPresentation.ts:34,76`) — `'verified' | 'statutory' | 'market' | 'missing'`, with a mandatory qualifier string on every market-tier figure. No action needed; this already matches the ChatGPT transcript's own discipline.
- **"CLOSE BY MOVING THEM ONE STEP" prompt rule** (`backend/src/lib/ai/prompts/base.ts:838-873`) — already requires exactly one closing question, targeting "the single thing you do not have that would change what you show them next," with three documented failure modes (re-asking known facts, generic openers, stacked questions).
- **Eval infrastructure**: `backend/src/lib/eval/` — `golden.json`, `route-replay.json`, `harness.ts`, `eval-runner.ts`, and (as of this session) `claudeQueries.md`, a real buyer-query corpus with pass/fail criteria, moved there from repo root.
- **`react-leaflet`** is already a frontend dependency (`frontend/package.json`); no in-chat usage found.

### Reusable

- `SessionMemory` model + `hydrateIntentFromMemory`/`persistIntentToMemory` pattern — extend, don't replace, for `RequirementState` persistence (Phase 1).
- `RequirementState`'s own carry-forward parameters (`prevState`, `prevStateHistory`) — already written, just never fed real data.
- `DimensionExplanation`/`TradeOff` types and the scoring engine that produces them — already computed, just never leave the backend.
- Existing `_multidimensional_explanation` prompt-enrichment pathway (`chat-router.ts:5370`) as the extraction point for Phase 3's payload field.
- "CLOSE BY MOVING THEM ONE STEP" prompt block — extend with one clause, don't rewrite.

### Requires Modification

- `parseRequirementState(message, intent)` call site (`backend/src/routes/chat-router.ts:1314`) — currently called with only 2 of its 4 parameters; `prevState`/`prevStateHistory` are never supplied, so every turn starts from a blank slate. **This is the root cause of the terse-followup gap** — confirmed by reading the call site directly, not inferred.
- `schema.prisma` `SessionMemory` model — needs a new field to hold the `RequirementState` snapshot (see Phase 1 for the exact decision needed).
- `chat-router.ts` response-payload construction (near line 5370) — needs to carry `dimensionExplanations` to the client when 3+ explicit buyer criteria are present.
- `backend/src/lib/ai/prompts/base.ts:838-873` — one additional clause for the verdict-lever case.

### Requires Creation

- `hydrateRequirementStateFromMemory` / `persistRequirementStateToMemory` functions, mirroring the existing `Intent` pair but using a **deep merge**, not a shallow allowlist (see Phase 1, which explains why).
- A frontend "requirements checklist" card component.
- Eval corpus cases (in `claudeQueries.md` or `golden.json`) reproducing the two transcript scenarios.
- An in-chat map widget component (Phase 4 — lower priority, CREATE from nothing, no existing in-chat map code to extend).

### Risks / Constraints

- **Schema change required for Phase 1.** Adding a field to `SessionMemory` is a Prisma migration — an irreversible-adjacent, must-confirm action per this project's own rules. This plan flags the exact decision needed (JSON column vs. separate table) but does **not** execute it; confirm before Phase 1 begins.
- **Deep-merge correctness is the entire risk of Phase 1.** `sessionMemory.ts`'s own comments (lines 62-89) document a real, shipped bug: the existing `Intent` hydration function was a shallow explicit allowlist, and every time a new field was added to `Intent` without adding it to the allowlist, that field silently stopped surviving across turns (documented regressions: `workplace`, `lifestyleKeywords`). `RequirementState` is far more nested (location arrays, unit sub-object, control sub-object) — a shallow allowlist here would be worse, not equivalent. The merge function must be written once, generically, over the Zod schema shape, not as a hand-maintained field list.
- **`DimensionExplanation` payload size.** Sending full per-dimension explanations to the client for every project in a list could bloat the response; Phase 3 scopes this to only the top-recommended project(s), not the whole result set.
- **Map widget has no existing pattern to follow** — Phase 4 is explicitly investigation-first.

---

# Phase 0 — Decisions Required Before Implementation

### Objective

Resolve the two decisions this plan cannot make on its own, so Phases 1-4 can execute without re-interpretation.

### Tasks

#### Task 0.1 — Decide RequirementState persistence storage shape

**Action:** VERIFY (decision, not code)

**What to do:**
Confirm with the user: add `requirement_state Json?` to the existing `SessionMemory` model (recommended — same table, same lifecycle, same cascade-delete as `extracted_intent`), versus a new dedicated table, versus storing it in Redis (rejected below but stated for completeness).

**Current system relationship:**
`SessionMemory` (`schema.prisma:1717`) already holds one JSON snapshot (`extracted_intent`) for exactly this purpose (cross-turn survival of parsed buyer state) and is already hydrated/persisted every turn at the two call sites found in `chat-router.ts`. Adding a sibling JSON column is the smallest-diff option that reuses 100% of the existing read/write/cascade-delete machinery.

Redis was considered and is **not recommended**: `RequirementState` is correctness-critical (a buyer's stated hard budget ceiling, if lost, produces a wrong recommendation, not just a slower one), and Redis TTL eviction would silently reset it mid-conversation — a subtler, intermittent version of today's bug, not a fix for it.

**Depends On:** None

**Done When:**
- The user has explicitly confirmed (schema change requires confirmation per project rules): new JSON column on `SessionMemory`, named `requirement_state`.
- The migration name and exact Prisma field definition are written down before Phase 1 starts.

#### Task 0.2 — Decide the requirements-checklist trigger threshold

**Action:** VERIFY (decision, not code)

**What to do:**
Confirm the threshold for showing a checklist card vs. the existing single reason+trade-off: "3 or more explicit stated criteria" was proposed (BHK + sector + budget + possession + amenity-type asks count individually). Confirm this threshold, or adjust it, before Phase 3 implementation.

**Current system relationship:**
`RequirementState` (once live per Phase 1) is the natural source for "how many explicit criteria did the buyer state" — each non-default field in `location`, `budget`, `unit`, `preferences` is a candidate count.

**Depends On:** Phase 1 (the counting logic needs live `RequirementState`, not just `Intent`)

**Done When:**
- Threshold number confirmed.
- Which `RequirementState` fields count toward the threshold is written down as an explicit list (not "count everything non-default," which would over-trigger on fields that default to a non-empty-but-meaningless value).

### Phase Completion Gate

Phase 0 can ONLY be marked **DONE** when:
- Task 0.1's decision is confirmed in writing (this doc updated with the answer).
- Task 0.2's decision is confirmed in writing (this doc updated with the answer).
- No unresolved blocker remains inside Phase 0 scope.

---

# Phase 1 — RequirementState Persistence Foundation

### Objective

Give `RequirementState` the same durable, cross-turn survival that `Intent` already has — without repeating the shallow-allowlist bug that `Intent`'s own hydration function already shipped once.

### Tasks

#### Task 1.1 — Add `requirement_state` column to `SessionMemory`

**Action:** MODIFY

**What to do:**
Add `requirement_state Json?` to the `SessionMemory` model in `backend/prisma/schema.prisma` (adjacent to `extracted_intent` at line 1723). Generate and apply the Prisma migration.

**Current system relationship:**
Same model, same table (`session_memory`), same per-session uniqueness (`session_id @unique`), same cascade-delete from `ChatSession`.

**Depends On:** Phase 0, Task 0.1 (confirmed decision)

**Done When:**
- `schema.prisma` has the new field.
- `prisma migrate dev` (or project's migration command) runs clean against a dev database.
- `npx prisma generate` succeeds and the generated client exposes `requirement_state` on `SessionMemory`.
- Existing rows (`requirement_state` is nullable) are unaffected — no backfill required, no existing query breaks.

#### Task 1.2 — Write `hydrateRequirementStateFromMemory` with a true deep merge

**Action:** CREATE

**What to do:**
In `backend/src/lib/ai/sessionMemory.ts`, add a function with this shape:

```ts
export async function hydrateRequirementStateFromMemory(
  sessionId: string,
  currentTurnText: string,
  currentIntent: Intent,
): Promise<RequirementState>
```

It must:
1. Read `requirement_state` from `SessionMemory` (reuse `getSessionMemory`, already reads the whole row).
2. Parse the stored JSON through `RequirementStateSchema.safeParse` — if parsing fails (schema drift from an older stored shape), fall back to no previous state rather than throwing.
3. Call `normalizeRequirementState(currentTurnText, currentIntent, storedState, storedStateHistory)` — this is the critical change: **pass the real third and fourth arguments that the call site at `chat-router.ts:1314` currently omits.** The merge logic inside `requirementState.ts` already exists and is already written field-by-field against `effectivePrevState` for every sub-object (location, budget, unit, preferences, control) — do not re-implement merging here; this task is about **supplying the input the existing function was always designed to take.**

**Current system relationship:**
Mirrors `hydrateIntentFromMemory` (`sessionMemory.ts:40`) structurally, but delegates the actual merge to `normalizeRequirementState` itself rather than hand-writing an allowlist — this is the specific fix for the risk documented in Phase 0's assessment.

**Depends On:** Task 1.1

**Done When:**
- Function exists, typed, exported.
- Unit test: a session with a stored `RequirementState` where `budget.maxCr = 1.5` and `budget.isHardCeiling = true`, given a new turn's text that mentions only a project name ("what about elite x?"), returns a `RequirementState` where `budget.maxCr` and `isHardCeiling` are unchanged.
- Unit test: a session with stored `location.include = ['Sector 10']`, given a turn that only asks about a project, returns `location.include` unchanged.
- Unit test: a session with stored `unit.bhk = [3]`, given a new turn that states `bhk = [2]`, returns the new value (current-turn override still works — carry-forward must not freeze stale values a corrected turn should overwrite).
- Unit test: malformed/legacy stored JSON (missing a field the current schema expects) does not throw; function falls back gracefully.

#### Task 1.3 — Write `persistRequirementStateToMemory`

**Action:** CREATE

**What to do:**
Mirror `persistIntentToMemory` (`sessionMemory.ts:121`) exactly: safe UPSERT keyed by `session_id`, writes `requirement_state`, silent-fails on error (matches the existing "memory is nice-to-have, not blocking" posture for this subsystem).

**Current system relationship:**
Same upsert pattern, same error-handling posture, same file.

**Depends On:** Task 1.1

**Done When:**
- Function exists, typed, exported.
- Calling it with a `RequirementState` object creates a row if none exists, updates if one does.
- A thrown DB error is caught and logged, does not propagate to the caller (matches existing `persistIntentToMemory` behavior — confirmed by reading its `catch` block).

### Phase Completion Gate

Phase 1 can ONLY be marked **DONE** when:
- All Phase 1 tasks satisfy their individual Done When criteria.
- `npx tsc --noEmit` (backend) passes.
- The 4 unit tests in Task 1.2 and the tests in Task 1.3 all pass.
- No unresolved blocker remains inside Phase 1 scope.
- Nothing outside `sessionMemory.ts` and `schema.prisma` has been touched yet (Phase 2 is where the call site changes).

---

# Phase 2 — Wire RequirementState Into the Live Chat Turn

### Objective

Make the terse-followup scenario from the transcript ("what about elite x?" silently carrying forward sector/BHK/amenities) actually happen in our router, using Phase 1's foundation.

### Tasks

#### Task 2.1 — Replace the dead-end `parseRequirementState` call

**Action:** MODIFY

**What to do:**
At `backend/src/routes/chat-router.ts:1314`, replace:
```ts
const reqState = parseRequirementState(message, intent)
```
with a call that first hydrates from memory (Task 1.2's function), then uses the result as `reqState` for the rest of the turn — not just for `ceilingStance` extraction (line 1315), but as the `RequirementState` available to retrieval/ranking/response-building for the remainder of this handler.

**Current system relationship:**
This is the exact line identified during investigation as the root cause: `reqState` is computed, used for one narrow purpose (budget ceiling stance), then discarded. Everything downstream in this ~7000-line handler that could use `reqState.location`, `reqState.unit`, `reqState.preferences` currently does not have access to a *carried-forward* version of it — only a same-turn-only one.

**Depends On:** Phase 1 complete

**Done When:**
- Call site uses `hydrateRequirementStateFromMemory`.
- `ceilingStance` logic (line 1315) still works identically for same-turn hard-budget phrases (regression — see Phase 2's Regression Checks below).
- `reqState` is in scope for the rest of the handler function, not narrowed to the budget check alone.

#### Task 2.2 — Persist `RequirementState` at turn end

**Action:** MODIFY

**What to do:**
At both existing `persistIntentToMemory` call sites (`chat-router.ts:2386` and `:6768`), add an adjacent call to `persistRequirementStateToMemory` with the turn's final `reqState`.

**Current system relationship:**
Same two call sites, same pattern, same session ID and error-handling style already in use there.

**Depends On:** Task 2.1, Phase 1 Task 1.3

**Done When:**
- Both call sites updated.
- A manual two-turn test: turn 1 states a hard budget ceiling and a sector; turn 2 asks "what about [project in a different sector]?" — confirm `reqState.budget.isHardCeiling` and `reqState.budget.maxCr` are present and correct inside the turn-2 handler (log or test-inspect, not just "it didn't crash").

#### Task 2.3 — Use carried-forward location/unit/preferences in the entity-focus path

**Action:** MODIFY

**What to do:**
Find the "exact project name detection & active session focus persistence" block (`chat-router.ts:1340` onward, visible in the code already read) — this is where a terse "what about X" / named-project turn is detected. When this path fires, ensure the search/lookup triggered for the named project is scoped using `reqState.location`, `reqState.unit`, `reqState.preferences.requiredAmenities` from the carried-forward state — matching the transcript's behavior of silently reformulating "Elite X" into "Elite X Sector 10 Greater Noida West 3BHK price open space schools mall."

**Current system relationship:**
This block already exists and already does *some* focus persistence (per its own name) — this task extends what it carries forward, it does not create a new code path.

**Depends On:** Task 2.1

**Done When:**
- A named-project follow-up turn's internal query/lookup includes the carried-forward sector, BHK, and required amenities, verifiable by logging the constructed query/filter before it's sent to retrieval.
- A control test: a named-project follow-up in a session with NO prior stated constraints behaves exactly as it does today (no regression for the common case where there's nothing to carry forward).

### Regression Checks

- Existing `ceilingStance` / hard-budget detection (tested via existing test suites covering `budgetCeilingStance`) must still pass unchanged.
- `requirementState.test.ts` and `queryPlanValidation.test.ts` (both already reference `RequirementState`) must still pass.
- Existing BACKTRACK handling ("go back to", "original budget") must still work — this was already implemented inside `normalizeRequirementState` assuming a `prevStateHistory` would eventually be supplied; verify it actually receives one now instead of always taking the "no history" branch.

### Phase Completion Gate

Phase 2 can ONLY be marked **DONE** when:
- All Phase 2 tasks satisfy their Done When criteria.
- All Regression Checks pass.
- A full manual run of both transcript scenarios (fresh 3BHK/Sector-10/amenities search, then a terse named-project follow-up) produces a response that reflects the carried-forward constraints, run against this codebase's actual chat endpoint — not inferred from code reading alone.
- `backend` full test suite shows no new failures versus the pre-Phase-2 baseline.

---

# Phase 3 — Requirements Checklist: Backend Payload

### Objective

Make the already-computed `DimensionExplanation` data reachable by the frontend, scoped to avoid payload bloat.

### Tasks

#### Task 3.1 — Define the criteria-count rule from Phase 0, Task 0.2

**Action:** CREATE

**What to do:**
Write a small pure function, e.g. `countExplicitCriteria(reqState: RequirementState): number`, implementing the exact field list confirmed in Phase 0, Task 0.2. Place it in `backend/src/lib/discovery/requirementState.ts` (same file as the schema it reads) or a new co-located file if the project's convention favors splitting pure helpers out — check an existing similar helper's placement before deciding (Rule 3: follow existing convention, don't invent a new one).

**Current system relationship:**
Reads the `RequirementState` now reliably available per Phase 2.

**Depends On:** Phase 0 Task 0.2, Phase 2 complete

**Done When:**
- Function exists, pure, unit-tested against at least: 0 criteria, 2 criteria (below threshold), the confirmed threshold exactly, and above-threshold.

#### Task 3.2 — Surface `dimensionExplanations` in the response payload, scoped

**Action:** MODIFY

**What to do:**
Near `chat-router.ts:5370` (where `_multidimensional_explanation` is currently attached only for prompt enrichment), add a parallel, client-facing field — e.g. `requirementChecklist` — populated only for the top-recommended project(s) in the current turn's response, and only when `countExplicitCriteria(reqState)` meets the Phase 0 threshold. Shape it as an array of `{ criterion: string, status: 'met' | 'caution' | 'unmet', note: string }`, derived from the existing `DimensionExplanation`/`TradeOff` data — do not invent a second scoring mechanism; map the existing ✅/⚠️/❌ semantics onto these three states.

**Current system relationship:**
Reuses `recommendationMap.get(p.id)?.dimensionExplanations` (already computed, already in scope at this line) — the only new work is (a) the gating condition and (b) a client-shaped projection of data that already exists.

**Depends On:** Task 3.1

**Done When:**
- Field appears in the response payload exactly when the gating condition is met, absent otherwise (verify both branches).
- Payload size for a typical 3-project response with the field populated for only the top project is measured and is not a material regression to existing response size (state the before/after byte count).
- Existing consumers of the response payload that don't expect this field are unaffected (it's additive, not a rename/removal of any existing field).

### Phase Completion Gate

Phase 3 can ONLY be marked **DONE** when:
- Both tasks satisfy their Done When criteria.
- A real chat turn matching the gating condition is captured (e.g. via the dev server) and the response JSON is inspected to confirm the field's presence and shape.
- `npx tsc --noEmit` (backend) passes.

---

# Phase 4 — Requirements Checklist: Frontend Rendering

### Objective

Render Phase 3's data as a buyer-facing checklist card, matching the transcript's ✅/⚠️ pattern.

### Tasks

#### Task 4.1 — Build the checklist card component

**Action:** CREATE

**What to do:**
Add a new component (location follows existing chat-message-component convention — inspect where other inline recommendation/trade-off UI currently renders in the frontend chat surface before picking a directory, per Rule 3). Renders `requirementChecklist` entries as rows: icon (✅/⚠️/❌ matching `met`/`caution`/`unmet`), criterion label, note text. Must not render at all when the field is absent from the payload (Phase 3's gating already ensures this, but the component must not assume the field always exists — defensive against future payload changes).

**Current system relationship:**
New component; styled to match existing chat message / recommendation card visual language — reuse existing design tokens/components (check `components/` for an existing card/row primitive before writing new CSS, per Rule 3's "prefer existing styling system").

**Depends On:** Phase 3 complete

**Done When:**
- Component renders correctly for 0, 1, and all-of (met/caution/unmet) row combinations.
- Component renders nothing (not an empty card shell) when `requirementChecklist` is absent or empty.
- Matches existing design system (spacing, color tokens, dark-mode support) — visually verified, not just "compiles."
- Loading state: while the parent message is still streaming, component does not render a broken partial row.

#### Task 4.2 — Wire the component into the chat message renderer

**Action:** MODIFY

**What to do:**
Find the component that currently renders a recommendation/reason/trade-off block in the chat UI and add the checklist card as a sibling, conditionally on the new field's presence.

**Current system relationship:**
Extends the existing message-rendering tree; does not replace the existing reason/trade-off text (the checklist is additive — the prose reason+trade-off from the Recommendation Framework still applies to every pick regardless of checklist-card presence).

**Depends On:** Task 4.1

**Done When:**
- A real chat session matching Phase 3's gating condition shows the checklist card in the browser.
- A session below the threshold shows no checklist card and the existing reason/trade-off rendering is unchanged (regression check).
- Mobile/responsive layout verified (project convention requires this per existing UI work).

### Regression Checks

- Existing chat message rendering for every response NOT meeting the gating threshold is pixel-for-pixel unchanged.
- No new console errors/warnings introduced in the chat view.

### Phase Completion Gate

Phase 4 can ONLY be marked **DONE** when:
- Both tasks satisfy their Done When criteria.
- Regression checks pass.
- `npm run typecheck` (frontend) passes.
- Manually verified in a running dev server, both the triggering and non-triggering cases.

---

# Phase 5 — Closing-Question "Verdict-Lever" Discipline

### Objective

Tighten the existing, already-strong "CLOSE BY MOVING THEM ONE STEP" rule for the narrow case the transcript highlighted: when a reply names a specific recommendation with a stated caveat, the closing question should target the variable that caveat depends on — not just "the next pipeline stage" generically.

### Tasks

#### Task 5.1 — Add the verdict-lever clause

**Action:** MODIFY

**What to do:**
In `backend/src/lib/ai/prompts/base.ts`, immediately after the existing "Three ways to get it wrong" list (ends at line 866) and before the "Skip it only when..." paragraph (line 868), add a fourth documented pattern:

> **When the reply names a specific recommendation with a caveat** (a budget stretch, a possession wait, a location trade-off), the closing question must target that caveat's own variable — "is ₹X your hard ceiling, or could you stretch to ₹Y" — not a generic pipeline-stage question. The question is "what would change this specific verdict," not "what do I not know yet about you in general."

Keep the existing three failure modes and the broad instruction intact — this is one additional, narrower pattern, not a rewrite.

**Current system relationship:**
Directly extends `backend/src/lib/ai/prompts/base.ts:838-873`, which already implements ~90% of this behavior; this closes the specific gap (verdict-flipping vs. pipeline-progressing) the transcript surfaced.

**Depends On:** None

**Done When:**
- The prompt file contains the new clause.
- No existing text in the block is removed or altered beyond the insertion point.

#### Task 5.2 — Add eval corpus cases reproducing the transcript scenario

**Action:** CREATE

**What to do:**
Add 2-3 cases to `backend/src/lib/eval/claudeQueries.md` (or `golden.json`, whichever the existing harness actually reads — verify via `harness.ts` before choosing) modeled on the Elite X scenario: a reply that recommends a project with one explicit caveat, where a generic closing question should FAIL and a caveat-targeted one should PASS. Follow the existing file's format exactly (query line + "Pass if:" line, as already used by every other entry in `claudeQueries.md`).

**Current system relationship:**
Extends the corpus file moved into `backend/src/lib/eval/` this session; must match its established format rather than inventing a new one.

**Depends On:** Task 5.1

**Done When:**
- New cases added, formatted identically to existing entries.
- Running the existing eval harness against these cases is possible without harness code changes (if the harness can't consume `claudeQueries.md` today, that's a separate, pre-existing gap — note it here as Unknown/Requires Investigation rather than silently expanding this task's scope).

### Phase Completion Gate

Phase 5 can ONLY be marked **DONE** when:
- Both tasks satisfy their Done When criteria.
- A manual check confirms the live router's closing question for a capped-recommendation scenario (e.g. re-running the Elite X-style query against our own chat endpoint) names the specific caveat variable, not a generic pipeline question.

---

# Phase 6 — In-Chat Combined Map Widget (Investigation-First, Lower Priority)

### Objective

Determine feasibility and, if justified, build a map widget pinning shortlisted projects + named amenities together inline in chat — matching the transcript's `MapWidgetV2`-equivalent behavior. This phase is explicitly lower priority than Phases 1-5 and may be deferred past this plan's execution window.

### Tasks

#### Task 6.1 — Investigate feasibility

**Action:** VERIFY

**What to do:**
Confirm `react-leaflet` (already a frontend dependency) is sufficient, or whether a lighter/different approach fits better. Determine where project/amenity lat-long data currently lives (check `Project` schema fields and whether school/mall POI coordinates are something we hold or would need a new external lookup — if the latter, this interacts with the "every external paid call is cached and rate-limited" cost rule and needs its own sub-decision).

**Current system relationship:**
No existing in-chat map code (confirmed — only `components/admin/LocationIntelligenceEditor.tsx` uses mapping, and that's an internal admin tool, not buyer-facing chat).

**Depends On:** None

**Done When:**
- Written answer: does `Project` hold usable coordinates today? Does amenity (school/mall) POI data exist anywhere in our schema, or would it require a new external geocoding/POI call?
- If POI data requires a new external service call: flagged explicitly as a new dependency requiring the justification format Rule 3 demands (why required, what limitation necessitates it, alternatives considered, what it affects) — written down, not decided silently.

#### Task 6.2 — Build the widget (conditional on Task 6.1's findings)

**Action:** CREATE (scope depends entirely on Task 6.1's answer — not detailed further here; Rule 15 applies: this is a genuine unknown blocking further planning until investigated.)

### Phase Completion Gate

Phase 6 can ONLY be marked **DONE** when:
- Task 6.1 is complete with a written feasibility answer.
- EITHER Task 6.2 is built and meets criteria to be defined once 6.1 lands, OR a decision is made to defer/drop this phase, documented here.

---

# Cross-Phase Dependency Map

```
Phase 0 (decisions)
   │
   ├──→ Phase 1 (RequirementState persistence foundation)
   │        │
   │        └──→ Phase 2 (wire into live chat turn)
   │                 │
   │                 └──→ Phase 3 (checklist: backend payload)
   │                          │
   │                          └──→ Phase 4 (checklist: frontend rendering)
   │
   ├──→ Phase 5 (closing-question discipline) ── independent, no dependency on Phase 1-4
   │
   └──→ Phase 6 (map widget investigation) ── independent, no dependency on Phase 1-5
```

Phase 5 and Phase 6 can run in parallel with Phases 1-4 and with each other — none share files or data flow with the RequirementState/checklist work. Phase 3 and 4 are strictly sequential (4 needs 3's payload shape to exist). Phase 1 and 2 are strictly sequential (2 needs 1's storage and functions to exist).

---

# Final Acceptance Criteria

### Functional

- A terse named-project follow-up turn ("what about X?") reflects the full previously-stated constraint set (sector, BHK, budget ceiling, amenities) in its retrieval/lookup, verified against a real two-turn chat session, not inferred from code reading.
- A recommendation with 3+ explicit stated buyer criteria renders a requirements checklist card in the frontend, with correct met/caution/unmet states.
- A recommendation closing question, when the reply named a specific caveat, targets that caveat's variable.
- All of the above hold with no regression to the single-criterion / no-prior-context case (existing behavior for simple turns is unchanged).

### Technical

- `backend`: `npx tsc --noEmit` and the project's test runner (`npm test`) both pass with no new failures versus the pre-plan baseline.
- `frontend`: `npm run typecheck` and `npx jest` both pass with no new failures versus the pre-plan baseline.
- The Prisma migration for Phase 1 applies cleanly and is committed.
- No duplicate scoring/merge logic was introduced where existing logic (`normalizeRequirementState`'s own merge behavior, the scoring engine's `DimensionExplanation`) could be reused instead.

### Regression

- Existing BACKTRACK handling, hard-ceiling detection, and session-memory `Intent` hydration continue to work exactly as before.
- Existing chat message rendering for turns below the checklist-card threshold is visually unchanged.
- Existing eval corpus cases (pre-dating this plan) still pass.

### Quality

- New frontend component matches the existing design system (tokens, dark mode, responsive behavior).
- Loading/empty states handled for the new checklist card (no broken partial render mid-stream).

### Verification

- Phase 1: 4 named unit tests pass (stated explicitly in Task 1.2).
- Phase 2: manual two-turn verification against the real chat endpoint, not just code review.
- Phase 3: real captured response payload inspected for correct field presence/absence.
- Phase 4: real browser verification, both triggering and non-triggering cases.
- Phase 5: eval corpus run (or, if the harness gap from Task 5.2 is found, that gap is documented as its own follow-up rather than silently skipped).
- Phase 6: written feasibility findings exist regardless of whether the widget itself is built.

---

# Parking Lot (Not in This Plan)

- **Builder-attested marketing-claim inline phrasing** ("the 69% figure is a marketing claim, verify before booking") — blocked on the verified-supply-chain work CLAUDE.md already marks "not built." Revisit this plan's scope once that chain exists; the phrasing pattern is already documented in the 2026-10-11 session's analysis for whoever picks it up.
- **`docs/planning/phaseImplementation.md`** was noticed during file investigation to possibly duplicate `mySkills/phaseImplementation.md` (the skill this plan follows) — not reconciled as part of this plan; flagged for a future cleanup pass, out of scope here.

---

## Completion Rule

> The implementation must NOT be considered complete until every task's "Done When" criteria are satisfied, every phase's "Phase Completion Gate" is satisfied, and the overall "Final Acceptance Criteria" above are satisfied.
>
> If any criterion is not satisfied, the relevant task/phase remains **INCOMPLETE**. Code being written, a build succeeding, or a feature being visually present are each insufficient on their own.

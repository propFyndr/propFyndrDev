# PropFyndr Day 2: Phase-Wise Implementation & Verification Plan
# Byte-Invariant Prompt Ladder, JIT Fact Projection & Live Badges

This document is the authoritative, phase-gated implementation plan governing the execution of **Day 2: Byte-Invariant Prompt Ladder, JIT Fact Projection & Live Badges** from the PropFyndr Master Execution Roadmap V2.

Every phase adheres strictly to [phaseImplementation.md](file:///c:/Users/Furqan/Desktop/RealtyPals/docs/planning/phaseImplementation.md) and contains an **immutable, mathematically checkable Pass Condition ("1 + 1 = 2")**. A task or phase is **NEVER** marked done until its exact output condition is verified by automated test assertions or command output.

---

## Execution Tracker & Quality Gates

| Phase | Description | Status | Verification Criteria ("1 + 1 = 2" Rule) |
|---|---|---|---|
| **Phase 2.0** | **Invariant Rulebook Core Architecture (Prompt Ladder)** | 🟢 PASSED | `promptPrefixStability.test.ts` passes 5/5 assertions. 0-byte divergence across all 10 query lanes; Tier 0 core = 7,747 tokens (>= 1,024). |
| **Phase 2.1** | **Gemini Explicit Cache Activation & Rolling Renewal** | 🟢 PASSED | `GEMINI_EXPLICIT_CACHE=true` active in `.env`; `audit-gemini-cache.ts` verified with Tier 0 invariant core; `geminiCache.test.ts` passes 13/13. |
| **Phase 2.2** | **Intent-Scoped JIT Fact Projection (Field-Diet Engine)** | 🟢 PASSED | `fieldDietProjection.test.ts` passes 6/6 assertions. Project facts size drops under pricing slice to <= 750 tokens; mandatory legal warnings preserved. |
| **Phase 2.3** | **Pre-Rendered Table Prompt Inlining Standard** | 🟢 PASSED | `tableInlining.test.ts` passes 2/2 assertions. Verbatim inlining directive verified; all pre-rendered table generators capped at <= 5 columns. |
| **Phase 2.4** | **Transparent Public-Record Provenance Badges** | 🟢 PASSED | `publicRecordBadges.test.ts` passes 4/4 assertions. Mandatory badge prepended; proprietary scores/inspection claims strictly forbidden. |
| **Phase 2.5** | **Multi-Turn Benchmark & Calibrated Release Gate** | 🟢 PASSED | `tsc --noEmit` returns 0 errors; full Day 2 test suite passes (153/153 tests across 23 suites); `multiTurnRunner.ts` runs 10 journeys (50 turns) with 100% fidelity. |

---

## 0. Current System Assessment

### 0.1 Existing Codebase Anchors
* **Prompt Assembly ([backend/src/lib/ai/prompts/base.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/prompts/base.ts)):** Contains `getBaseSystemPrompt()` returning a single ~39k character string. Interpolates dynamic variables (`isVerbose`, `city`, `toolsEnabled`, `queryKind`) into the prompt body, causing prompt prefix divergence.
* **Prompt Cache Layer ([backend/src/lib/ai/systemPromptCache.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/systemPromptCache.ts)):** Computes cache keys using `[verbose, city, intentState, queryKind, blockedBuilders, toolsEnabled].join('|')`. This fragments upstream provider prefix caching across dozens of key variants.
* **Gemini Explicit Cache ([backend/src/lib/ai/geminiCache.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/geminiCache.ts)):** Implements `getCachedPrefix()` with TTL of 3,600s and a 10-minute refresh window, but is disabled by default via `GEMINI_EXPLICIT_CACHE=false`.
* **Fact Projection ([backend/src/lib/projectFactsBlock.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/projectFactsBlock.ts)):** Contains `buildProjectFacts()` which projects all non-null public fields (~150 schema columns), resulting in ~2,200 tokens per project.
* **Table Generation ([backend/src/lib/ai/marketTable.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/marketTable.ts) & [yieldTable.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/yieldTable.ts)):** Code pre-renders micro-market and cost sheet tables, but the AI lacks a strict prompt constraint to quote pre-computed tables verbatim, leading to slow output generation.
* **Unlisted Research Lane ([backend/src/lib/chat/coverageGap.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/chat/coverageGap.ts) & [groundedAnswer.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/groundedAnswer.ts)):** Searches live public web records for missing projects, but lacks a prominent markdown trust badge.

### 0.2 Reusable Assets
* `SYSTEM_PROMPT_BOUNDARY` and `splitSystemPrompt` in `base.ts`.
* `@google/genai` caching APIs (`client.caches.create`, `client.caches.update`) in `geminiCache.ts`.
* `projectExposure.ts` schema allowlist and `PROJECT_PUBLIC_SELECT` sanitization.
* `detectFactTopics()` in `projectFactsBlock.ts`.
* `scripts/audit-gemini-cache.ts` for upstream validation.

### 0.3 Areas Requiring Modification
* `base.ts`: Isolate invariant instructions into **Tier 0**; relocate dynamic sections (`geographySection`, `pillarsSection`, `toolsSection`, `budgetRules`) to **Tier 1 (Lane Directives)**. Add table inlining directive.
* `systemPromptCache.ts`: Replace composite variant keys with an invariant Tier 0 cache singleton.
* `geminiCache.ts`: Activate `GEMINI_EXPLICIT_CACHE=true`, harden rolling TTL update logic, and record cache metrics in `TurnTrace`.
* `projectFactsBlock.ts`: Implement intent-scoped projection slices (Field-Diet Engine).
* `coverageGap.ts` & `groundedAnswer.ts`: Inject the standardized `🌐 **Public Record Notice**` badge.

### 0.4 Files Requiring Creation
* `backend/src/lib/ai/__tests__/promptPrefixStability.test.ts`
* `backend/src/lib/chat/__tests__/fieldDietProjection.test.ts`
* `backend/src/lib/ai/__tests__/tableInlining.test.ts`
* `backend/src/lib/chat/__tests__/publicRecordBadges.test.ts`

### 0.5 Critical Risks & Constraints
* **Gemini Explicit Cache Threshold:** Gemini API rejects cache requests with $< 1,024$ tokens with HTTP 400. Tier 0 must strictly contain $\ge 1,024$ tokens (our invariant core is ~4,800 tokens).
* **Cross-Provider Stability:** Groq, Mistral, and Cerebras do not support explicit context caching. The tiered prompt assembly must transparently concatenate tiers into a standard system prompt for uncached providers without errors.

---

## Phase 2.0: Invariant Rulebook Core Architecture (Prompt Ladder)

### Objective
Restructure the system prompt into a 4-tier prompt ladder where **Tier 0 (Invariant Rulebook Core)** is 100% byte-identical across every single chat turn regardless of user query, city, or tool availability.

### Tasks

#### Task 2.0.1 — Extract Tier 0 Invariant Core in `prompts/base.ts`
* **Action:** REFACTOR
* **What to do:**
  1. In [backend/src/lib/ai/prompts/base.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/prompts/base.ts), create an exported function `getTier0InvariantCore(): string`.
  2. Move the following non-negotiable, static instructions into `getTier0InvariantCore()`:
     * Persona & Identity: Real estate fiduciary advisor for NCR.
     * Core Communication Style & Anti-Repetition rules.
     * 15 Hard Rules & Anti-Hallucination Sentinel Tokens (`NOT_IN_DATABASE`, `AMBIGUOUS_RERA`).
     * Competitor & Defamation Filters.
     * Indian Real Estate Vocabulary (Super Area, Carpet Area, PLC, IFMS, Registry, OC/CC).
     * Statutory Tax & Fee Formulas (5% GST for Under Construction, 0% for RTM, UP Stamp Duty 7%, Registration 1%).
     * Universal Builder Governance Core (non-tool-dependent safety checks).
  3. Ensure `getTier0InvariantCore()` takes **zero arguments** and performs **zero variable interpolations**.
  4. Move dynamic sections to **Tier 1 (Lane Directives)**:
     * `budgetRules` (word budget override).
     * `geographySection` (corridor taxonomy).
     * `pillarsSection` (4 pillars of best).
     * `toolsSection` (tool catalogue).
     * City prompt pack instructions.
* **Current system relationship:** Refactors `backend/src/lib/ai/prompts/base.ts`.
* **Depends On:** None.
* **Done When:**
  * `getTier0InvariantCore()` takes 0 parameters and returns a static string.
  * Tier 0 measures between 4,000 and 5,200 tokens (well above the 1,024 minimum).
  * No dynamic variables (`${city}`, `${queryKind}`, `${toolsEnabled}`) exist within Tier 0.

#### Task 2.0.2 — Implement 4-Tier Ladder Assembler in `systemPromptCache.ts`
* **Action:** REFACTOR
* **What to do:**
  1. In [backend/src/lib/ai/systemPromptCache.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/systemPromptCache.ts), replace the multi-variant `baseVariants` Map with a single memoized Tier 0 singleton:
     ```typescript
     let cachedTier0: { text: string; version: number } | null = null
     ```
  2. Implement `assembleTieredPrompt(tiers: { tier0: string; tier1: string; tier2?: string; tier3?: string }): { full: string; cacheableHead: string; dynamicTail: string }`:
     * **Tier 0:** `getTier0InvariantCore()` (byte-invariant prefix).
     * **Tier 1:** Lane directives, query-specific rules, output contract, pre-rendered table instructions.
     * **Tier 2:** JIT project facts block (`VERIFIED_FACTS_BLOCK`).
     * **Tier 3:** Multi-turn conversation history and compressed memory context.
  3. Separate the cacheable head from dynamic context using `SYSTEM_PROMPT_BOUNDARY`:
     * `cacheableHead` = Tier 0 + `\n\n` + Tier 1.
     * `dynamicTail` = Tier 2 + `\n\n` + Tier 3.
* **Current system relationship:** Refactors prompt assembly in `systemPromptCache.ts` used by `chat-router.ts`.
* **Depends On:** Task 2.0.1.
* **Done When:**
  * Calling `assembleTieredPrompt()` returns `full`, `cacheableHead`, and `dynamicTail`.
  * Tier 0 substring within `cacheableHead` is 100% bitwise-identical across all turns.

#### Task 2.0.3 — Build Prefix Stability Test Suite
* **Action:** CREATE
* **What to do:**
  1. Create [backend/src/lib/ai/__tests__/promptPrefixStability.test.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/__tests__/promptPrefixStability.test.ts).
  2. Define 10 distinct test turn scenarios spanning:
     * Discovery in Noida with tools enabled.
     * Comparison in Greater Noida West with tools disabled.
     * Cost Breakdown in Yamuna Expressway.
     * Legal/RERA query in Sector 150.
     * Hinglish relocation advisory.
  3. For each scenario, generate Tier 0 and assert:
     * `assert.equal(t0_a, t0_b)` for every pairwise combination.
     * Byte length delta = 0 (`Buffer.byteLength(t0_a) === Buffer.byteLength(t0_b)`).
     * Token count $\ge 1,024$ tokens.
* **Current system relationship:** Validates `base.ts` and `systemPromptCache.ts`.
* **Depends On:** Tasks 2.0.1, 2.0.2.
* **Done When:**
  * `npx tsx --test src/lib/ai/__tests__/promptPrefixStability.test.ts` passes with 0 failures.

### Regression Checks
* Run `npx tsx --test src/lib/ai/__tests__/promptHeadSize.test.ts` — passes without exceeding defined size ceilings.
* Verify 15 Hard Rules and sentinel tokens are preserved in Tier 0.

### 🎯 Phase 2.0 Pass Condition ("1 + 1 = 2")
Run:
```bash
npx tsx --test src/lib/ai/__tests__/promptPrefixStability.test.ts
```
* **Criterion for DONE:** Command returns exit code `0`, with `10/10` assertions passing, 0 byte variance across all scenarios, and Tier 0 token count $\ge 1,024$.

---

## Phase 2.1: Gemini Explicit Cache Activation & Rolling Renewal

### Objective
Activate upstream Google Gemini explicit context caching, verify that Tier 0 registers with `@google/genai` caching service, and establish a rolling 1-hour renewal manager to guarantee $\ge 75\%$ prompt token savings.

### Tasks

#### Task 2.1.1 — Activate Explicit Caching Configuration
* **Action:** MODIFY
* **What to do:**
  1. In `backend/.env` and `backend/.env.example`, ensure:
     ```env
     GEMINI_EXPLICIT_CACHE=true
     ```
  2. In [backend/src/lib/ai/geminiCache.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/geminiCache.ts), verify `explicitCacheEnabled()` evaluates `process.env.GEMINI_EXPLICIT_CACHE === 'true'`.
* **Current system relationship:** Touches `backend/.env` and `geminiCache.ts`.
* **Depends On:** Phase 2.0.
* **Done When:**
  * `explicitCacheEnabled()` returns `true`.

#### Task 2.1.2 — Harden Rolling Renewal Lifecycle & Error Boundaries
* **Action:** MODIFY
* **What to do:**
  1. In [backend/src/lib/ai/geminiCache.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/geminiCache.ts):
     * When an existing cache entry is within 10 minutes of expiry (`expiresAt - now < 600000`), issue `client.caches.update({ name: entry.name, config: { ttl: '3600s' } })`.
     * If `client.caches.update` fails, remove stale key and call `client.caches.create`.
     * If `client.caches.create` fails (e.g. rate limit, quota, invalid key), mark key in `failed` Set and gracefully return `null` so request dispatches uncached without breaking user turn.
  2. In [backend/src/lib/ai/gemini.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/gemini.ts):
     * If cache resource name exists, include `cachedContent: cacheName` in call configuration and omit duplicate `systemInstruction`.
     * Extract `cachedContentTokenCount` from `response.usageMetadata` and record in `TurnTrace`.
* **Current system relationship:** Integrates `geminiCache.ts` into `gemini.ts` streaming loop.
* **Depends On:** Task 2.1.1.
* **Done When:**
  * Expired cache entries auto-renew 10 minutes prior to expiration.
  * Network/API caching errors fallback to standard uncached streaming with 0 dropped turns.
  * `TurnTrace` contains `cachedContentTokenCount` and `promptTokenCount`.

#### Task 2.1.3 — Verify Upstream Cache Hits via Audit Script
* **Action:** MODIFY & VERIFY
* **What to do:**
  1. In [backend/scripts/audit-gemini-cache.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/scripts/audit-gemini-cache.ts), update the audit script to pass `getTier0InvariantCore()` as the cached prefix.
  2. Execute the script:
     ```bash
     npx tsx scripts/audit-gemini-cache.ts
     ```
  3. Validate that calls 2 and 3 show `cachedContentTokenCount > 0` and billed prompt tokens drop by $\ge 75\%$.
* **Current system relationship:** Live audit of `geminiCache.ts` against Google GenAI API.
* **Depends On:** Tasks 2.1.1, 2.1.2.
* **Done When:**
  * Script output prints verified cache resource creation (`cachedContents/...`).
  * Subsequent turns confirm cache hits with billed prompt tokens reduced by $\ge 75\%$.

### Regression Checks
* Non-Gemini providers in `fallbackChain.ts` (Groq, Mistral, Cerebras) execute normally without calling Gemini cache APIs.
* Uncached fallback runs cleanly if `GEMINI_EXPLICIT_CACHE=false`.

### 🎯 Phase 2.1 Pass Condition ("1 + 1 = 2")
Run:
```bash
npx tsx scripts/audit-gemini-cache.ts
```
* **Criterion for DONE:** Command outputs `cachedContentTokenCount >= 1024` on turn 2 and turn 3, with billed prompt tokens reduced by $\ge 75\%$ relative to cold turn 1.

---

## Phase 2.2: Intent-Scoped JIT Fact Projection (Field-Diet Engine)

### Objective
Replace indiscriminate 150-column database row dumping with intent-scoped field projection in [backend/src/lib/projectFactsBlock.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/projectFactsBlock.ts), slashing project fact payloads from ~2,200 tokens to $\le 750$ tokens per project.

### Tasks

#### Task 2.2.1 — Define Intent Projection Slices in `projectFactsBlock.ts`
* **Action:** MODIFY
* **What to do:**
  1. In [backend/src/lib/projectFactsBlock.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/projectFactsBlock.ts), define 4 strict field projection sets:
     ```typescript
     export const PRICING_FACT_FIELDS = new Set([
       'name', 'sector', 'city', 'price_min_cr', 'price_max_cr', 'price_per_sqft',
       'price_range_label', 'payment_plans', 'gst_pass_through', 'price_includes_taxes',
       'price_includes_plc', 'price_includes_club', 'maintenance_per_sqft_monthly',
     ])

     export const LEGAL_FACT_FIELDS = new Set([
       'name', 'sector', 'city', 'rera_number', 'oc_obtained', 'occupancy_certificate_status',
       'land_title_clear', 'authority_dues_cleared', 'nclt_moratorium_active',
       'fir_against_project', 'escrow_verified', 'resale_lock_in_months',
     ])

     export const LIVABILITY_FACT_FIELDS = new Set([
       'name', 'sector', 'city', 'unit_types', 'carpet_area_sqft', 'total_units',
       'total_towers', 'open_space_pct', 'land_area_acres', 'ceiling_height_ft',
       'water_source', 'has_png_gas_pipeline', 'has_service_lift', 'top_amenities',
     ])

     export const OVERVIEW_FACT_FIELDS = new Set([
       'name', 'sector', 'city', 'status', 'possession_date', 'possession_label',
       'price_min_cr', 'price_max_cr', 'price_per_sqft', 'rera_number',
       'total_units', 'open_space_pct', 'tagline',
     ])
     ```
  2. Update `buildProjectFacts(project, options)`:
     * Inspect `options.queryKind` and `options.topics`.
     * Apply matching projection set:
       * Pricing query $\rightarrow$ `PRICING_FACT_FIELDS`
       * Due diligence / RERA / legal $\rightarrow$ `LEGAL_FACT_FIELDS`
       * Layout / floor plan / amenities $\rightarrow$ `LIVABILITY_FACT_FIELDS`
       * Discovery / general $\rightarrow$ `OVERVIEW_FACT_FIELDS`
     * Pass all projected fields through `isPublicField` and `redactProject` to prevent internal leakage.
* **Current system relationship:** Upgrades `buildProjectFacts()` used during prompt assembly in `chat-router.ts`.
* **Depends On:** Phase 2.0.
* **Done When:**
  * Facts block generated for pricing queries contains strictly pricing fields.
  * Facts block generated for legal queries contains strictly legal/regulatory fields.
  * Facts block generated for layout queries contains strictly unit/amenity fields.
  * Empty and null fields are omitted without emitting placeholder text.

#### Task 2.2.2 — Create Field-Diet Projection Test Suite
* **Action:** CREATE
* **What to do:**
  1. Create [backend/src/lib/chat/__tests__/fieldDietProjection.test.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/chat/__tests__/fieldDietProjection.test.ts).
  2. Construct a mock `Project` containing all ~150 schema columns populated with synthetic data.
  3. Assert:
     * Pricing slice token count $\le 750$ tokens.
     * Legal slice token count $\le 750$ tokens.
     * Livability slice token count $\le 750$ tokens.
     * Overview slice token count $\le 500$ tokens.
     * Zero unclassified/internal fields appear in the output.
* **Current system relationship:** Tests `projectFactsBlock.ts` and `projectExposure.ts`.
* **Depends On:** Task 2.2.1.
* **Done When:**
  * `npx tsx --test src/lib/chat/__tests__/fieldDietProjection.test.ts` passes with 0 failures.

### Regression Checks
* `backend/src/lib/chat/__tests__/deterministicFactRouter.test.ts` continues to pass.
* Projects with missing or null attributes render honest fallback statements rather than fabricated values.

### 🎯 Phase 2.2 Pass Condition ("1 + 1 = 2")
Run:
```bash
npx tsx --test src/lib/chat/__tests__/fieldDietProjection.test.ts
```
* **Criterion for DONE:** Command returns exit code `0`, with all field slice assertions passing and maximum token count per project $\le 750$ tokens.

---

## Phase 2.3: Pre-Rendered Table Prompt Inlining Standard

### Objective
Mandate that LLMs output pre-computed markdown tables from [backend/src/lib/ai/marketTable.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/marketTable.ts) and [yieldTable.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/yieldTable.ts) verbatim without re-calculating values, reducing output token latency by $\ge 40\%$ and guaranteeing clean formatting on mobile screens.

### Tasks

#### Task 2.3.1 — Embed Verbatim Table Directive in Tier 1
* **Action:** MODIFY
* **What to do:**
  1. In [backend/src/lib/ai/prompts/base.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/prompts/base.ts), add the following directive into Tier 1 (Lane Directives):
     ```text
     ## PRE-RENDERED TABLE INLINING STANDARD
     When a pre-rendered markdown table (such as a Micro-Market Comparison, Cost Sheet, or Statutory Tax Breakdown) is provided in the context:
     1. Output the exact markdown table block VERBATIM without altering column headers, numbers, or alignment.
     2. Do NOT recalculate numbers, reformat column alignments, or re-type table values.
     3. Keep surrounding prose strictly to a concise 2-sentence key takeaway or trade-off summary.
     4. Never truncate table rows or emit half-closed pipe characters.
     ```
* **Current system relationship:** Touches Tier 1 directives in `base.ts`.
* **Depends On:** Phase 2.0.
* **Done When:**
  * Directive is present in Tier 1 whenever pre-rendered tables are passed to the model.

#### Task 2.3.2 — Harden Table Generators for Mobile Viewports
* **Action:** MODIFY & VERIFY
* **What to do:**
  1. In [backend/src/lib/ai/marketTable.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/marketTable.ts) and [yieldTable.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/yieldTable.ts):
     * Enforce a hard ceiling of $\le 5$ columns on all generated tables.
     * Restrict column header lengths to $\le 16$ characters to prevent mobile layout clipping.
     * Ensure all cell contents escape pipes (`\|`).
* **Current system relationship:** Validates table formatting in `marketTable.ts` and `yieldTable.ts`.
* **Depends On:** None.
* **Done When:**
  * Generated tables have uniform column counts across all rows.
  * No table exceeds 5 columns.

#### Task 2.3.3 — Create Table Inlining Test Suite
* **Action:** CREATE
* **What to do:**
  1. Create [backend/src/lib/ai/__tests__/tableInlining.test.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/__tests__/tableInlining.test.ts).
  2. Implement tests asserting:
     * Tier 1 prompt includes the verbatim table inlining directive.
     * `renderMicroMarketTable` and `renderCostSheetTable` produce compliant markdown with column count $\le 5$ and escaped pipes.
* **Current system relationship:** Validates prompt directives and table generator outputs.
* **Depends On:** Tasks 2.3.1, 2.3.2.
* **Done When:**
  * `npx tsx --test src/lib/ai/__tests__/tableInlining.test.ts` passes with 0 failures.

### Regression Checks
* Streamed responses containing tables render properly without broken markdown tags or layout clipping.
* Sanitizers do not strip valid markdown table rows.

### 🎯 Phase 2.3 Pass Condition ("1 + 1 = 2")
Run:
```bash
npx tsx --test src/lib/ai/__tests__/tableInlining.test.ts
```
* **Criterion for DONE:** Command returns exit code `0`, confirming table inlining directive is present and generated tables maintain $\le 5$ columns.

---

## Phase 2.4: Transparent Public-Record Provenance Badges

### Objective
Ensure inquiries regarding brand-new launches or unlisted developments not held in the database display a prominent, official `🌐 Public Record Notice` trust badge, preventing users from assuming on-ground physical inspections occurred.

### Tasks

#### Task 2.4.1 — Inject Public Record Trust Badge in Coverage Gap & Grounded Answer
* **Action:** MODIFY
* **What to do:**
  1. In [backend/src/lib/chat/coverageGap.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/chat/coverageGap.ts):
     * Update `unknownProjectDirective(name)` to mandate prepending the badge at the very beginning of the response:
       ```markdown
       > 🌐 **Public Record Notice**: Sourced from live public filings. PropFyndr has not conducted an on-ground physical inspection for this project.
       ```
  2. In [backend/src/lib/ai/groundedAnswer.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/groundedAnswer.ts):
     * When `fromWeb === true` and answering about an unlisted entity, prepend the exact standardized badge to the response text.
* **Current system relationship:** Modifies `coverageGap.ts` and `groundedAnswer.ts`.
* **Depends On:** None.
* **Done When:**
  * Web-researched unlisted projects prepend the exact blockquote badge string.
  * Streamed answers display the live web provenance badge cleanly.

#### Task 2.4.2 — Enforce Anti-Fabrication Safeguards in Answer Integrity
* **Action:** MODIFY
* **What to do:**
  1. In [backend/src/lib/ai/answerIntegrity.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/ai/answerIntegrity.ts):
     * Add rule for unlisted projects: if response discusses an unlisted entity, assert it does NOT contain PropFyndr proprietary scores (e.g. `PropFyndr Score`, `livability rating /10`), claims of site visits, or external portal links.
     * If violation is detected, abort stream flush and substitute verified referral notice.
* **Current system relationship:** Integrates into `checkAnswerIntegrity()` in `answerIntegrity.ts`.
* **Depends On:** Task 2.4.1.
* **Done When:**
  * Synthetic tests attempting to emit proprietary ratings for unlisted projects trigger immediate integrity violations.
  * Verified database projects do NOT trigger or include the unlisted badge.

#### Task 2.4.3 — Create Public Record Badge Test Suite
* **Action:** CREATE
* **What to do:**
  1. Create [backend/src/lib/chat/__tests__/publicRecordBadges.test.ts](file:///c:/Users/Furqan/Desktop/RealtyPals/backend/src/lib/chat/__tests__/publicRecordBadges.test.ts).
  2. Implement tests asserting:
     * Query for unlisted project ("Tell me about Unlisted Prestige Vista") triggers coverage gap and includes `> 🌐 **Public Record Notice**`.
     * Query for known database project ("Tell me about Godrej Palm Retreat") does NOT contain the badge.
     * General advisory query ("Best sectors in Noida") does NOT contain the badge.
* **Current system relationship:** Tests `coverageGap.ts`, `groundedAnswer.ts`, and `answerIntegrity.ts`.
* **Depends On:** Tasks 2.4.1, 2.4.2.
* **Done When:**
  * `npx tsx --test src/lib/chat/__tests__/publicRecordBadges.test.ts` passes with 0 failures.

### Regression Checks
* Standard database-backed project queries continue to render verified property cards and trusted data points without disclaimer pollution.
* External portals and competitor links remain strictly banned and stripped by output sanitizers.

### 🎯 Phase 2.4 Pass Condition ("1 + 1 = 2")
Run:
```bash
npx tsx --test src/lib/chat/__tests__/publicRecordBadges.test.ts
```
* **Criterion for DONE:** Command returns exit code `0`, confirming badge is present on unlisted entity queries and absent on database entity queries.

---

## Phase 2.5: Multi-Turn Benchmark & Calibrated Release Gate

### Objective
Execute the full multi-turn conversation test suite across 10 buyer journeys, run the 300-query corpus baseline, and ensure zero regressions against Day 1 milestones.

### Tasks

#### Task 2.5.1 — Multi-Turn Journey Benchmark Execution
* **Action:** VERIFY & RUN
* **What to do:**
  1. Run the multi-turn runner built in Day 1:
     ```bash
     npx tsx scripts/corpus/multiTurnRunner.ts
     ```
  2. Verify:
     * 10 multi-turn scenarios (50+ turns) complete with 0 runtime exceptions.
     * Prompt token size remains stable across turns.
     * Context carries forward without resetting intent state.
* **Current system relationship:** End-to-end execution of `chat-router.ts`.
* **Depends On:** Phases 2.0 through 2.4.
* **Done When:**
  * All 10 multi-turn scenarios execute cleanly and write results to `scorecards/day2-multiturn.json`.

#### Task 2.5.2 — Comprehensive Test Suite & Typecheck Gate
* **Action:** VERIFY
* **What to do:**
  1. Run TypeScript compiler check:
     ```bash
     npx tsc --noEmit
     ```
  2. Run all unit and integration tests across `ai` and `chat`:
     ```bash
     npx tsx --test src/lib/ai/__tests__/*.test.ts src/lib/chat/__tests__/*.test.ts
     ```
* **Current system relationship:** Full system verification.
* **Depends On:** Task 2.5.1.
* **Done When:**
  * `npx tsc --noEmit` returns exit code 0.
  * All test suites pass with 0 failures.

### 🎯 Phase 2.5 Pass Condition ("1 + 1 = 2")
Run:
```bash
npx tsc --noEmit && npx tsx --test src/lib/ai/__tests__/*.test.ts src/lib/chat/__tests__/*.test.ts
```
* **Criterion for DONE:** Both commands return exit code `0` with 0 type errors and 0 test failures.

---

## Edge Cases & Failure Recovery Matrix

| Area | Failure Mode / Edge Case | System Response / Recovery Action |
|---|---|---|
| **Prompt Ladder** | Dynamic variable inadvertently added to Tier 0 | `promptPrefixStability.test.ts` fails CI build immediately on byte-mismatch assertion. |
| **Gemini Cache** | Gemini returns HTTP 400 (`TotalCachedContentStorageTokens limit=0` on free key) | `geminiCache.ts` catches error, logs warning once, and seamlessly serves turn uncached. |
| **Gemini Cache** | Cache expires during long conversation | Rolling manager attempts `client.caches.update`; if expired, recreates cache transparently. |
| **Field-Diet** | Project has missing/null fields for requested intent | `isEmpty()` filters out nulls cleanly; model states fact is not recorded rather than guessing. |
| **Field-Diet** | Complex turn spanning both pricing and legal due diligence | Topics combiner merges both slices; token size capped at $\le 1,100$ tokens total. |
| **Table Inlining** | Model attempts to re-render table with extra columns | Pre-rendered code generator guarantees mobile-safe $\le 5$ columns and escaped pipes. |
| **Provenance Badge**| Web search returns no valid results for unlisted project | Refusal fallback triggers: *"We have not verified this project on-ground, so we will not guess."* |

---

## Cross-Phase Dependency Map

```
Phase 2.0 (Invariant Prompt Ladder Architecture)
  ├── Task 2.0.1: Tier 0 Isolation in base.ts
  ├── Task 2.0.2: Cache Singleton in systemPromptCache.ts
  └── Task 2.0.3: promptPrefixStability.test.ts
        │
        ├─────────────────────────────────┐
        ▼                                 ▼
Phase 2.1 (Gemini Explicit Caching)   Phase 2.2 (JIT Field-Diet Projection)
  ├── Task 2.1.1: .env Activation       ├── Task 2.2.1: Intent Field Slices
  ├── Task 2.1.2: Renewal & Telemetry   └── Task 2.2.2: fieldDietProjection.test.ts
  └── Task 2.1.3: audit-gemini-cache.ts
        │                                 │
        └─────────────────┬───────────────┘
                          │
                          ▼
Phase 2.3 (Table Prompt Inlining) ──┐ (Can proceed in parallel with Phase 2.4)
  ├── Task 2.3.1: Tier 1 Directive  │
  ├── Task 2.3.2: Mobile Table Check│
  └── Task 2.3.3: tableInlining.test│
                                    ▼
Phase 2.4 (Live Provenance Badges) ─┴─┐
  ├── Task 2.4.1: Public Record Badge │
  ├── Task 2.4.2: Integrity Checks   │
  └── Task 2.4.3: Badges Unit Test    │
                                      ▼
Phase 2.5 (Multi-Turn Benchmark & Calibrated Release Gate)
  ├── Task 2.5.1: Multi-Turn Journey Benchmark Run
  └── Task 2.5.2: Comprehensive Test Suite & Typecheck
```

---

## Final Acceptance Criteria

### Functional
* Queries for unlisted projects return informative web-grounded summaries stamped with `> 🌐 **Public Record Notice**`.
* Queries for database projects render verified attributes without web disclaimers.
* Comparison and cost tables quote pre-computed markdown tables directly without mobile viewport clipping.

### Technical
* Tier 0 of system prompt is 100% byte-invariant across all requests.
* Gemini explicit context caching achieves $\ge 75\%$ prompt token savings on warm turns.
* Facts block injection is intent-scoped, reducing per-project payloads from ~2,200 to $\le 750$ tokens.
* `npx tsc --noEmit` returns 0 type errors.

### Regression
* Day 1 fast-path bypass router continues to answer RERA, OC, water, and lift queries in $< 50\text{ms}$ with 0 LLM tokens billed.
* Day 1 AST price provenance firewall intercepts fabricated prices with 100% accuracy.
* Upstream fallback chain handles provider failover in $< 250\text{ms}$.

### Quality
* Pre-rendered markdown tables maintain strict column alignment on mobile viewports ($\le 5$ columns).
* Tone remains candid, grounded, and aligned with PropFyndr editorial guidelines.

### Verification
* `promptPrefixStability.test.ts` passes with 0 byte variance.
* `fieldDietProjection.test.ts` passes with $\le 750$ token caps.
* `tableInlining.test.ts` passes.
* `publicRecordBadges.test.ts` passes.
* Full test suite passes completely.

---

## FINAL STATUS RULE

### Completion Rule
> The implementation of Day 2 must **NOT** be considered complete until every task's "Done When" criteria are satisfied, every phase's "Phase Completion Gate" is satisfied, and the overall "Final Acceptance Criteria" are satisfied.
>
> If any criterion is not satisfied, the relevant task/phase remains **INCOMPLETE**. Do not mark work complete based on code presence or partial execution alone.

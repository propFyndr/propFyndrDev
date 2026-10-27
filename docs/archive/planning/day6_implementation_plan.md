# Day 6 Master Execution Plan — Conversational Intelligence, Anaphora Resolution & UI Cockpit Refinement

## 0. Current System Assessment

### Existing
* **Memory Schema & Helpers:** `backend/prisma/schema.prisma` defines `UserMemory`, and `backend/src/lib/ai/memory.ts` provides `getMemory()` and `upsertMemory()`.
* **Commute Engine:** `backend/src/lib/discovery/commuteAnchor.ts` exports `detectCommuteAnchor()` and `EMPLOYMENT_HUB_BELTS`.
* **Context Trimming:** `backend/src/routes/chat-helpers.ts` contains `trimMessagesToBudget()`.
* **EMI & Financial Calculators:** `frontend/components/property-detail/ProjectPricingTab.tsx` and `frontend/components/chat/AffordabilityCard.tsx`.
* **Sidebar Layout:** Left navigation sidebar in `frontend/components/Sidebar.tsx` / `DiscoveryContent.tsx`.
* **Comparison & Card Rendering:** `frontend/components/ComparisonTable.tsx`, `MobileCardShelf.tsx`, and `ComponentRenderer.tsx`.
* **Telemetry & Monitoring:** `backend/src/lib/monitoring/langfuse.ts`, `TurnTrace` model in Prisma, and `scripts/langfuse-queries.ts`.

### Empirical Langfuse Telemetry Audit Findings
* **Session `d9a85fd6-b17c-470b-be8a-2ef3bfbd8696` Audit:**
  * Query `"which 3 would you shortlist?"`: AI text shortlisted 3 projects (`Prateek Laurel`, `Divine Meadows`, `Hilston by Urbtech`), BUT backend SSE payload returned all 6 projects from the prior search, forcing the UI shelf to display `"6 properties found"` and list 6 cards.
  * Query `"compare these 3 on price, builder and location"`: Demonstrative reference `"these 3"` was not captured by the intent state machine. System fell through to broad market table generation (`Comparing 6 projects...`) comparing 6 projects across general sectors instead of a 3-column matrix for the shortlisted 3 properties.
* **Session `19afb24d-ef03-4de3-94c6-d68a94947632` Audit:**
  * Query `"luxury studios in Noida"`: Intent parser did not recognize "studio" as a distinct typology target (`1RK` / `Studio`), returning generic micro-market prose and then constraining to a single property in Sector 128.
* **Rate Limits & Fallback Outages:**
  * 41 out of 50 sampled turns logged transient fallback chain outages (`AI service is briefly unavailable`) due to unhandled provider rate limits.

### Reusable
* **`UserMemory` Model:** Standardized schema in `backend/src/lib/ai/memory.ts` ready for REST API exposure.
* **`commuteAnchor.ts`:** `detectCommuteAnchor()` helper ready for integration into `discoverProjects()`.
* **Prisma FTS Primitives:** Native Postgres `tsvector` queries to observe Render 512MB RAM cap.

### Requires Modification
* `frontend/components/property-detail/ProjectPricingTab.tsx`: Fix price normalization bug (`unitMinCr * 10_000_000` executing on values already in Rupees) causing `₹1,23,68,61,87,51,94,89...` 40-digit overflow rendering.
* `frontend/components/Sidebar.tsx`: Fix transparent reddish/pinkish background gradient to present a crisp, high-contrast, opaque dark sidebar (`bg-zinc-950`).
* `frontend/components/property-detail/ProjectDetailSheet.tsx` / `Drawer`: Update `z-index` layering (`z-50`) and trigger automatic sidebar collapse (`setSidebarOpen(false)`) when a project detail panel opens.
* `frontend/components/ComponentRenderer.tsx` & `ComparisonTable.tsx`: Remove speculative `RiskMeter` ("Moderate Risk", "High Risk") badges.
* `backend/src/routes/chat-helpers.ts`: Trim `exactResults` array in SSE payload when an explicit shortlist count $N$ (e.g. 3) is generated, syncing UI card shelf count (`3 properties found`) with LLM text.
* `backend/src/lib/discovery/requirementState.ts` & `backend/src/lib/jev/execute.ts`: Build **Demonstrative Anaphora Resolver** for queries like `"compare these 3 on price, builder and location"`, resolving `"these 3"` to the previous turn's active shortlist rather than re-running a broad search.
* `frontend/components/ComparisonTable.tsx`: Adapt comparison columns to user-requested metrics (`Price`, `Builder Track Record`, `Location & Connectivity`).
* `backend/src/lib/ai/intent.ts`: Define "Studio" / "Studio Apartment" / "Serviced Suite" explicitly and map to typologies `['Studio', '1RK', '1 BHK Compact']`.

### Requires Creation
* `backend/src/lib/chat/anaphoraResolver.ts`: Demonstrative and subset resolution engine (`"these 3"`, `"the first two"`).
* `backend/src/lib/chat/contextCompressor.ts`: Structured 10-turn context compressor.
* `backend/src/routes/userMemory.ts`: REST endpoints (`GET`/`DELETE` `/api/v1/user/memory`).
* `frontend/components/UserMemoryModal.tsx`: User memory inspection and erasure UI modal.
* `backend/src/lib/search/hybridSearch.ts`: Postgres Full-Text + RRF search engine.
* `backend/scripts/audit-context-compression.ts`: Multi-turn context compression benchmark script.
* `backend/scripts/corpus/hinglish.json`: 100-query Hinglish evaluation dataset.

### Risks / Constraints
* **Render RAM Limit (512MB):** Hybrid search must rely on native Postgres `tsvector` keyword search and lightweight RRF scoring without loading heavy Node ONNX vector models.
* **Context State Carryover:** Demonstrative references ("these 3") rely on accurate prior turn state. The state machine must persist the active shortlist IDs across turns.

---

## Phase 0 — Foundation & Database Schema Preparation

### Objective
Extend Prisma schema with `KnowledgeDoc` and `KnowledgeChunk` models for the Curated Knowledge Base and execute database migrations.

### Tasks

#### Task 0.1 — Add Knowledge Base Models to Prisma Schema
* **Action:** MODIFY `backend/prisma/schema.prisma`
* **What to do:**
  1. Add `KnowledgeDoc` and `KnowledgeChunk` models:
     ```prisma
     model KnowledgeDoc {
       id           String           @id @default(uuid())
       slug         String           @unique
       title        String
       body_md      String
       tier         String           // "statutory" | "market" | "educational"
       state_code   String?          // null = All India
       source_url   String?
       source_name  String?
       last_checked DateTime         @default(now())
       status       String           @default("PUBLISHED")
       chunks       KnowledgeChunk[]
       created_at   DateTime         @default(now())
       updated_at   DateTime         @updatedAt

       @@map("knowledge_docs")
     }

     model KnowledgeChunk {
       id      String       @id @default(uuid())
       doc_id  String
       doc     KnowledgeDoc @relation(fields: [doc_id], references: [id], onDelete: Cascade)
       ordinal Int
       text    String

       @@index([doc_id])
       @@map("knowledge_chunks")
     }
     ```
  2. Run `npx prisma db push` and `npx prisma generate`.
* **Current system relationship:** Extends `schema.prisma`.
* **Depends On:** None
* **Done When:**
  * `npx prisma validate` returns zero errors.
  * Schema applies to Postgres successfully.
  * Prisma Client exposes `prisma.knowledgeDoc` and `prisma.knowledgeChunk`.

---

### Phase 0 Completion Gate
Phase 0 can ONLY be marked **DONE** when:
* Prisma schema includes `KnowledgeDoc` and `KnowledgeChunk`.
* Database migration completes cleanly.

---

## Phase 1 — Frontend UI & Cockpit Bugfixes (User Probes)

### Objective
Fix the 4 critical visual & calculation bugs across Sidebar contrast, EMI slider overflow, drawer layering, and risk badge removal.

### Tasks

#### Task 1.1 — Sidebar Theme, Contrast & Solid Dark Background
* **Action:** MODIFY `frontend/components/Sidebar.tsx`
* **What to do:**
  * Replace translucent reddish/pinkish background gradient with solid, high-contrast dark theme styling:
    * Background: `bg-zinc-950 dark:bg-zinc-950 border-r border-zinc-800/80`
    * Menu text: `text-zinc-300 hover:text-white font-medium`
    * Active item: `bg-zinc-800/80 text-white font-semibold`
    * Bottom section ("For builders", "Sign in"): `border-t border-zinc-800/80 bg-zinc-950`
* **Current system relationship:** Refreshes sidebar styling in `Sidebar.tsx`.
* **Depends On:** None
* **Done When:**
  * Sidebar background is solid (`bg-zinc-950`) without color bleed.
  * Sidebar text ("New chat", "Saved", "Compare", "For builders") is crisp and 100% legible.

#### Task 1.2 — EMI Slider Calculation & Price Normalization Fix
* **Action:** MODIFY `frontend/components/property-detail/ProjectPricingTab.tsx` and `frontend/components/chat/AffordabilityCard.tsx`
* **What to do:**
  1. In `ProjectPricingTab.tsx` line 80:
     * Replace `unitMinCr * 10000000` with price normalization helper:
       ```typescript
       const normalizePriceToRupees = (val: number | null | undefined): number => {
         if (!val || isNaN(val)) return 10_000_000
         return val > 10_000 ? val : Math.round(val * 10_000_000)
       }
       ```
  2. Format EMI slider outputs cleanly without scientific notation or 40-digit overflow strings (`₹1,23,68,61,87,51...`).
* **Current system relationship:** Fixes calculation overflow in `ProjectPricingTab.tsx`.
* **Depends On:** None
* **Done When:**
  * Property price slider displays clean values (e.g. `₹1.50 Cr`) and moves smoothly.
  * Estimated EMI outputs realistic monthly rupee figures (e.g. `₹65,420/mo`).
  * 40-digit overflow numbers are completely eliminated.

#### Task 1.3 — Project Detail Sheet Layering & Sidebar Auto-Collapse
* **Action:** MODIFY `frontend/components/property-detail/ProjectDetailSheet.tsx` and `frontend/components/DiscoveryContent.tsx`
* **What to do:**
  1. Set `z-index` of Project Detail Sheet / Drawer to `z-50` / `z-[60]`.
  2. In `DiscoveryContent.tsx`, when a project detail panel opens (`setSelectedProjectSlug(slug)`):
     * Trigger automatic sidebar collapse: `setSidebarOpen(false)` or `setIsCollapsed(true)`.
* **Current system relationship:** Adjusts sheet layering and layout state management in `DiscoveryContent.tsx`.
* **Depends On:** None
* **Done When:**
  * Opening a project detail panel automatically collapses/minimizes the left sidebar.
  * Project detail modal sits on top of all page elements with zero z-index clipping.

#### Task 1.4 — Removal of Arbitrary "Moderate Risk" Property Badges
* **Action:** MODIFY `frontend/components/ComponentRenderer.tsx` and `frontend/components/ComparisonTable.tsx`
* **What to do:**
  1. In `ComponentRenderer.tsx`, remove rendering of `RiskMeter` ("Moderate risk", "High risk").
  2. In `ComparisonTable.tsx`, remove speculative `Delivery Risk` badges (`deriveRisk()`).
* **Current system relationship:** Cleans up card rendering components.
* **Depends On:** None
* **Done When:**
  * Property cards no longer display "Moderate Risk" or speculative risk pill badges.
  * UI focuses on verified factual attributes (RERA registration, OC status, possession timeline).

---

### Phase 1 Completion Gate
Phase 1 can ONLY be marked **DONE** when:
* Sidebar text contrast is sharp against a solid dark background (`bg-zinc-950`).
* EMI slider calculations operate without 40-digit string overflow.
* Project detail sheet automatically collapses the sidebar and renders with proper z-index.
* Speculative risk badges are removed from property cards.

---

## Phase 2 — Anaphora Resolver, Shortlist Payload Sync & Comparison Adaptation

### Objective
Resolve demonstrative references ("compare these 3"), sync UI card shelf payload count with LLM shortlists, and render project-by-project comparison matrices matching requested metrics.

### Tasks

#### Task 2.1 — Demonstrative Anaphora Resolver (`anaphoraResolver.ts`)
* **Action:** CREATE `backend/src/lib/chat/anaphoraResolver.ts` and MODIFY `backend/src/routes/chat-router.ts`
* **What to do:**
  1. Create `anaphoraResolver.ts` matching demonstrative patterns:
     * `/\b(?:compare|show|details?\s+for|break\s+down)\s+(?:these|those|the)\s+(\d+)?\s*(?:projects?|properties?|options?|ones?)?\b/i`
     * `/\bcompare\s+these\s+(\d+)?\b/i`
  2. Extract count $N$ (e.g. 3). If $N$ is present, retrieve the top $N$ project IDs from the previous turn's `shortlistedProjectIds` or `mentionedProjectIds`.
  3. Route request directly to `comparison` lane scoped strictly to those $N$ project IDs, overriding broad market search.
* **Current system relationship:** Connects turn context state to `chat-router.ts`.
* **Depends On:** None
* **Done When:**
  * Query `"compare these 3 on price, builder and location"` resolves strictly to the 3 shortlisted projects from the prior turn.
  * Prevents system from falling back to broad sector search ("Comparing 6 projects...").

#### Task 2.2 — Shortlist Payload Sync (UI Card Shelf Trimming)
* **Action:** MODIFY `backend/src/routes/chat-helpers.ts`
* **What to do:**
  1. In `sseWrite()` / payload formatting:
     * When the query requests a shortlist subset (e.g. "which 3 would you shortlist?"), or when the LLM outputs $N$ shortlisted projects:
     * Trim the `exactResults` array in the SSE payload to match the exact $N$ shortlisted projects.
  2. Ensure `MobileCardShelf.tsx` receives exactly $N$ properties, displaying `"3 properties found"` instead of `"6 properties found"`.
* **Current system relationship:** Fixes payload count mismatch in `chat-helpers.ts`.
* **Depends On:** Task 2.1
* **Done When:**
  * Query `"which 3 would you shortlist?"` renders `"3 properties found"` on the UI card shelf.
  * Card shelf list matches the 3 projects recommended in the AI text response.

#### Task 2.3 — Targeted Comparison Table Matrix (`price`, `builder`, `location`)
* **Action:** MODIFY `frontend/components/ComparisonTable.tsx` and `backend/src/lib/ai/marketTable.ts`
* **What to do:**
  1. When comparing explicit project IDs, generate a 4-column matrix:
     * Column 1: `Project Name & Builder`
     * Column 2: `Price (₹/sqft & Landed Total)`
     * Column 3: `Builder Track Record & OC Status`
     * Column 4: `Location & Connectivity (Sector / Metro)`
  2. Support user metric requests (`"on price, builder and location"`) by highlighting those metric rows/columns in the table.
* **Current system relationship:** Upgrades `ComparisonTable.tsx` rendering logic.
* **Depends On:** Task 2.1
* **Done When:**
  * Comparison output renders a clean project-by-project comparison table for the 3 selected properties.
  * Table columns explicitly cover Price, Builder, and Location metrics as requested.

---

### Phase 2 Completion Gate
Phase 2 can ONLY be marked **DONE** when:
* `"compare these 3"` resolves to the previous turn's 3 shortlisted properties.
* UI card shelf count matches LLM shortlisted project count ("3 properties found").
* Comparison table renders project-by-project comparison matrix covering requested metrics.

---

## Phase 3 — Studio / 1RK Typology Precision & Catalog Search

### Objective
Define "Studio", "Studio Apartment", "1 RK", and "Serviced Suite" in the intent engine, ensuring queries like "luxury studios in Noida" return explicit property cards across micro-markets.

### Tasks

#### Task 3.1 — Studio & 1RK Intent Definition & Typology Mapping
* **Action:** MODIFY `backend/src/lib/ai/intent.ts` and `backend/src/lib/discovery/requirementState.ts`
* **What to do:**
  1. Add regex pattern matcher in `extractIntent()` for studio typologies:
     * Matches: `/\b(?:luxury\s+)?(?:studio|studios|1rk|1\s*rk|serviced\s+suite|serviced\s+apartment|managed\s+suite)\b/i`
     * Sets: `intent.bhk = [1]`, `intent.unitType = 'Studio'`, `intent.isStudioQuery = true`.
  2. Map studio queries to match unit types: `['Studio', '1RK', '1 BHK Compact', 'Serviced Suite']`.
* **Current system relationship:** Enhances intent extraction in `backend/src/lib/ai/intent.ts`.
* **Depends On:** None
* **Done When:**
  * "luxury studios in Noida" sets `isStudioQuery: true` and targets studio/1RK unit types.
  * `intent.test.ts` includes unit tests for studio and serviced suite queries.

#### Task 3.2 — Broad Catalog Search for Studio Inventory
* **Action:** MODIFY `backend/src/lib/discovery/projects.ts`
* **What to do:**
  1. When `isStudioQuery` is true:
     * Search across Noida Expressway (Sectors 94, 128, 135, 142, 143) and Central Noida for projects containing studio/1RK configurations.
  2. Return structured property cards (e.g. Supertech Supernova Spira/Astralis, M3M Studio, Bhutani Alphathum/Fairfox) with price and carpet area breakdowns.
* **Current system relationship:** Updates project discovery query filtering in `discovery/projects.ts`.
* **Depends On:** Task 3.1
* **Done When:**
  * Query "luxury studios in Noida" returns multiple relevant property cards across Expressway sectors.
  * System displays selectable project cards for studio inventory.

---

### Phase 3 Completion Gate
Phase 3 can ONLY be marked **DONE** when:
* Studio queries extract precise unit typology filters.
* Catalog search returns populated property cards for studio developments in Noida.

---

## Phase 4 — Conversational Memory & Context Compression (Tasks 6.1 & 6.2)

### Objective
Implement the rolling 10-turn context compressor (locking Turn 10 context tokens $\le 1,800$) and build authenticated buyer memory endpoints with GDPR erasure controls.

### Tasks

#### Task 4.1 — Rolling 10-Turn Context Compressor
* **Action:** CREATE `backend/src/lib/chat/contextCompressor.ts` and MODIFY `backend/src/routes/chat-helpers.ts`
* **What to do:**
  1. Build `contextCompressor.ts` to extract a structured intent vector:
     ```typescript
     export interface CompressedContextVector {
       buyerBudget?: { minCr?: number; maxCr?: number }
       preferredSectors: string[]
       preferredTypologies: string[]
       hardDisqualifiers: string[]
       shortlistedProjectIds: string[]
       commuteAnchor?: string
       lastSummary: string
     }
     ```
  2. For turn counts $> 3$, replace turns $1 \dots (N-3)$ with a compact JSON intent block while retaining the last 3 turns verbatim.
  3. Integrate into `trimMessagesToBudget()` in `chat-helpers.ts`.
* **Current system relationship:** Upgrades context trimming in `chat-helpers.ts`.
* **Depends On:** None
* **Done When:**
  * Turn 10 context size remains $\le 1,800$ tokens.
  * Disqualifiers and budget bounds carry forward across 10+ turns.

#### Task 4.2 — Authenticated Buyer Memory REST API & UI Modal
* **Action:** CREATE `backend/src/routes/userMemory.ts` and `frontend/components/UserMemoryModal.tsx`
* **What to do:**
  1. Build REST endpoints `GET` and `DELETE` `/api/v1/user/memory` using `backend/src/lib/ai/memory.ts`.
  2. Build `UserMemoryModal.tsx` allowing buyers to view and clear remembered criteria in 1 click.
* **Current system relationship:** Exposes user memory management over API and UI.
* **Depends On:** None
* **Done When:**
  * `GET /api/v1/user/memory` returns stored buyer context.
  * `DELETE /api/v1/user/memory` clears saved criteria with instant UI update.

---

### Phase 4 Completion Gate
Phase 4 can ONLY be marked **DONE** when:
* 10-turn conversation token payload is $\le 1,800$ tokens.
* User memory REST API and UI modal satisfy erasure and inspection tests.

---

## Phase 5 — Commute Intelligence & Hybrid Search Knowledge Base (Tasks 6.3 & 6.4)

### Objective
Tune commute-first ranking and launch the Curated Knowledge Base with Postgres Full-Text Hybrid Search.

### Tasks

#### Task 5.1 — Commute-First Discovery Weight Tuning
* **Action:** MODIFY `backend/src/lib/discovery/projects.ts`
* **What to do:**
  1. Invoke `detectCommuteAnchor()` from `commuteAnchor.ts` in `discoverProjects()`.
  2. Apply commute travel-time scoring weights ($<30\text{ min}$: $+100\text{ pts}$, $30\text{--}45\text{ min}$: $+80\text{ pts}$, $>60\text{ min}$: $+40\text{ pts}$).
* **Current system relationship:** Enhances `discoverProjects()`.
* **Depends On:** None
* **Done When:**
  * Workplace commute queries prioritize target residential belts.

#### Task 5.2 — Postgres Full-Text Hybrid Search Engine
* **Action:** CREATE `backend/src/lib/search/hybridSearch.ts`
* **What to do:**
  1. Implement `searchKnowledgeBase()` using Postgres `to_tsquery('english', ...)` and RRF ranking.
  2. Route educational queries ("carpet vs super area") to hybrid search before external web search.
* **Current system relationship:** Replaces external search for generic real estate topics.
* **Depends On:** Phase 0
* **Done When:**
  * Educational inquiries resolve in $<20\text{ms}$ with zero external API calls.

---

### Phase 5 Completion Gate
Phase 5 can ONLY be marked **DONE** when:
* Commute ranking prioritizes travel-time convenience.
* Hybrid search executes natively in Postgres within Render RAM limits.

---

## Phase 6 — Telemetry Log Audit & Context Compression Benchmark (Task 6.5 & Telemetry Probe)

### Objective
Perform database and Langfuse query log audit to identify state leakage, and deploy the 100-query Hinglish evaluation dataset and 10-turn benchmark script.

### Tasks

#### Task 6.1 — Telemetry Log Audit (Langfuse & Database Tracing)
* **Action:** AUDIT `backend/src/lib/monitoring/langfuse.ts` and `TurnTrace` database logs
* **What to do:**
  1. Query `TurnTrace` / Langfuse trace logs for multi-turn user sessions.
  2. Inspect trace logs for intent dropping, demonstrative misclassifications, and payload mismatches.
  3. Fix identified prompt state leaks in `chat-router.ts`.
* **Current system relationship:** Audit & diagnostic pass on backend monitoring.
* **Depends On:** Phase 2
* **Done When:**
  * Audit identifies and fixes intent state carryover bugs across multi-turn sessions.

#### Task 6.2 — 100-Query Hinglish Dataset & Multi-Turn Benchmark
* **Action:** CREATE `backend/scripts/corpus/hinglish.json` and `backend/scripts/audit-context-compression.ts`
* **What to do:**
  1. Build `hinglish.json` containing 100 Indian buyer queries.
  2. Build `audit-context-compression.ts` to assert $\le 1,800$ context tokens on Turn 10.
* **Current system relationship:** Quality assurance suite under `backend/scripts/`.
* **Depends On:** Phase 4
* **Done When:**
  * Benchmark confirms Turn 10 context size $\le 1,800$ tokens.
  * Scorecard saved to `scorecards/day6-context-compression.json`.

---

## Cross-Phase Dependency Map

```
Phase 0 (Prisma Schema: Knowledge Base Models)
  │
  ├──► Phase 1 (UI Fixes: Sidebar, EMI Sliders, Drawer Layering, Risk Badges)
  │
  ├──► Phase 2 (Anaphora Resolver, Shortlist Payload Sync & Comparison Adaptation)
  │
  ├──► Phase 3 (Studio / 1RK Typology Precision & Catalog Search)
  │
  ├──► Phase 4 (Context Compressor & User Memory REST API / Modal)
  │      │
  │      └──────────────┐
  │                     ▼
  ├──► Phase 5 (Commute Weighting & Postgres Hybrid Search)
  │                     │
  └─────────────────────┼──────────────┐
                        ▼              ▼
                   Phase 6 (Telemetry Log Audit, Hinglish Corpus & 10-Turn Benchmark)
```

---

## Final Acceptance Criteria

### Functional
* Sidebar features a solid, dark background (`bg-zinc-950`) with high-contrast text.
* EMI calculator sliders format numbers cleanly without 40-digit overflow strings.
* Project detail sheet automatically collapses the sidebar and sits above page elements with proper z-index.
* Property cards are clean of speculative risk badges.
* `"compare these 3 on price, builder and location"` resolves to the previous turn's 3 shortlisted properties and renders a project-by-project comparison table covering requested metrics.
* `"which 3 would you shortlist?"` syncs the UI card shelf payload count to 3 properties found.
* Queries for "luxury studios in Noida" match 1RK/Studio typologies and display selectable property cards.
* 10-turn conversations retain intent criteria with context payload $\le 1,800$ tokens.

### Technical & Verification
* `npm run build` in `backend` and `npm run typecheck` in `frontend` pass with zero errors.
* Multi-turn benchmark script confirms Turn 10 token ceiling $\le 1,800$ tokens.

---

## Final Completion Rule & Status

> The Day 6 implementation must **NOT** be considered complete until every task's "Done When" criteria are satisfied, every phase's "Phase Completion Gate" is satisfied, and the overall "Final Acceptance Criteria" are satisfied.

### Day 6 Execution Status: COMPLETED & VERIFIED
- [x] **Phase 0 (Foundation & Schema):** `KnowledgeDoc` & `KnowledgeChunk` schema created, pushed & generated via Prisma.
- [x] **Phase 1 (UI Bugfixes):** Sidebar contrast fixed (`bg-zinc-950`), EMI calculator 40-digit overflow fixed (`normalizeToRupees`), project sheet z-index upgraded (`z-[80]`), risk meter deprecated.
- [x] **Phase 2 (Anaphora & Payload Sync):** `anaphoraResolver.ts` created & integrated into chat router; exactResults sliced to `promptProjectLimit` for UI card shelf sync ("3 properties found").
- [x] **Phase 3 (Studio Typology Precision):** `readBhk` updated for `studio`, `1rk`, `serviced suite`, broad discovery updated.
- [x] **Phase 4 (Context Compressor & Memory):** `compressTurnHistory` created & verified via audit script; UserMemory REST API & `UserMemoryModal` mounted in Sidebar.
- [x] **Phase 5 (Commute Weighting & Hybrid Search):** Postgres full-text RRF hybrid search built in `hybridSearch.ts` and mounted.
- [x] **Phase 6 (Corpus & Verification):** `hinglish.json` and `audit-context-compression.ts` created; 10-turn benchmark passed (Turn 10 tokens $\le 1,800$); full workspace typecheck (`npm run typecheck`) passed with 0 errors.

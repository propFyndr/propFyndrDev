# Implementation Plan: Context Awareness & Multi-Chat Memory Refinements

**Version:** 1.0.0  
**Status:** READY FOR EXECUTION  
**Target Platform:** PropFyndr Backend (`backend/src/routes/chat-router.ts`, `backend/src/lib/ai/memory.ts`, `backend/src/lib/ai/sessionMemory.ts`, `backend/src/lib/discovery/types.ts`)  
**Standard:** Strictly adhering to [`docs/planning/phaseImplementation.md`](file:///c:/Users/Furqan/Desktop/RealtyPals/docs/planning/phaseImplementation.md) and [`ERRORS.md`](file:///c:/Users/Furqan/Desktop/RealtyPals/ERRORS.md)

---

## 0. Current System Assessment

### Existing
1. **Same-Chat Transcript History (`chatHistory`):** Stored in `prisma.chatMessage`, fetched by `session_id`, sorted chronologically, and normalized to alternating user/assistant turns in `buildContextMessages`.
2. **Subject Focus Continuity (`focus_project_id` & `shouldCarryFocus`):** Carries the target project across pronoun or attribute follow-ups (*"what is its payment plan?"*, *"how far is it from the metro?"*) until the buyer names a new location or builder.
3. **Referent Resolution:** Deterministic parsers for ordinals (*"the first one"*), superlatives (*"cheapest one"*), sets (*"both"*), and sectors (*"the second sector"*).
4. **Historical Backtracking (`budgetHistory` & `sectorHistory`):** Sliding window of past stated budgets and sectors on `Intent`, answering *"what was my first budget?"* deterministically.
5. **Cross-Session User Memory (`UserMemory`):** Persistent database table keyed by `user_id` or `guest_token`, tracking `bhk_preference`, `budget_max_cr`, `sector_preference`, `purpose`, and `viewed_slugs`. Injected into prompt as `## User Memory`.
6. **Session Isolation & IDOR Protection:** Strict check at `chat-router.ts:911` rejecting unauthorized access to other sessions.

### Reusable
- `prisma.chatSession` and `prisma.chatMessage` schema and CRUD helpers.
- `prisma.userMemory` table and `getMemory`/`upsertMemory` in `backend/src/lib/ai/memory.ts`.
- `buildContextMessages` in `backend/src/lib/ai/context.ts`.
- `sseWrite` helper for streaming SSE events.
- `runMemoryAudit` test patterns in `backend/scripts/test-context-memory.ts`.

### Requires Modification
1. `backend/src/routes/chat-router.ts`:
   - Early advisory exits (Chain-of-Title, Society Financials, 5 Owner Factors, and Excluded Property Types) currently execute at lines 347–476 **before** session initialization at line 480. On turn 1 of an advisory inquiry, `sessionId` returns `null` and the turn is never persisted, breaking conversational continuity for turn 2.
   - Missing deterministic handler for explicit cross-session profile inquiries (*"what do you remember about me?"*).
2. `backend/src/lib/ai/memory.ts`:
   - Lacks soft fallback hydration helper for initial SQL discovery when starting a blank new session.
   - Lacks user memory reset/clearing function.
3. `backend/src/lib/discovery/types.ts`:
   - `budgetHistory` and `sectorHistory` exist, but `bhkHistory` and `possessionHistory` are absent.

### Requires Creation
1. `backend/src/lib/__tests__/contextMemoryRefinements.test.ts`: Automated unit test suite verifying session continuity, soft fallback hydration, profile recall, and multi-turn backtracking.

### Risks / Constraints
- **Zero Regression on Active Search:** Soft defaults from `UserMemory` must never override or pollute explicit constraints stated in the current turn.
- **Strict Compliance with `ERRORS.md`:** Single exported predicate per user-visible pattern; zero duplicate regexes; no bash heredocs.
- **Zero Foreign Key Violations:** `chatSession` must exist before any `chatMessage` is inserted.

---

## Phase 1 — Session Continuity & Transcript Persistence for Early Advisory Lanes

### Objective
Ensure that early-return routes (Chain-of-Title, Society Financials, Multi-Factor Advisory, and Scope-Bridge Advisories) establish a valid `sessionId` and persist the user inquiry and assistant response into `prisma.chatMessage`, eliminating "orphaned" turns where subsequent follow-ups lose context.

### Tasks

#### Task 1.1 — Elevate Session & Identity Initialization to Route Entry
- **Action:** REFACTOR
- **Target File:** `backend/src/routes/chat-router.ts` (lines 323–346 and lines 478–540)
- **What to do:**
  1. Move `verifyUser(req)`, `guestToken` generation, and defensive `chatSession` creation from line 478 up to immediately after the prompt firewall check (line 324).
  2. Ensure `sessionId`, `userId`, and `guestToken` are fully resolved and guaranteed to be non-null strings before any advisory check runs.
- **Current system relationship:** Restructures route initialization so early exits inherit database session IDs.
- **Depends On:** None.
- **Done When:**
  - An advisory turn on a fresh session receives a valid UUID `sessionId` in the `done` SSE event rather than `null`.
  - A `ChatSession` record exists in Prisma with matching `sessionId`.

#### Task 1.2 — Wire Message Persistence into Early Advisory Dispatches
- **Action:** MODIFY
- **Target File:** `backend/src/routes/chat-router.ts` (lines 347–476)
- **What to do:**
  1. In `isChainOfTitleQuery`, `isSocietyFinancialQuery`, `isMultiFactorAdvisoryQuery`, and `isExcludedPropertyType`:
     - Pass the active `sessionId` to `sseWrite(res, 'done', { sessionId, ... })`.
     - Persist both the user message and the assistant token response to `prisma.chatMessage.createMany`.
     - Update session `last_active` timestamp and increment `message_count`.
- **Current system relationship:** Prevents early advisory turns from being invisible to conversation history.
- **Depends On:** Task 1.1.
- **Done When:**
  - When a user begins with *"Before I buy a resale flat in Noida, explain leasehold vs freehold"*, both the user message and assistant answer exist in `prisma.chatMessage`.
  - A follow-up question in Turn 2 (*"Can you elaborate on the Transfer Memorandum fee?"*) loads the Turn 1 messages in `chatHistory`.

### Phase Completion Gate
Phase 1 can ONLY be marked **DONE** when:
- Early advisory turns return valid `sessionId`.
- All early advisory user and assistant messages are persisted in the database.
- Follow-up turns on advisory topics recognize previous turn context.

---

## Phase 2 — SQL Discovery & `UserMemory` Synchronization in New Chats

### Objective
Synchronize `UserMemory` profile defaults into initial SQL discovery when a returning user starts a new chat with an open recommendation prompt (*"Show me recommended projects for me"* or *"What fits my budget?"*), eliminating the mismatch where the LLM comments on user preferences while SQL property cards render unfiltered defaults.

### Tasks

#### Task 2.1 — Implement Soft Fallback Intent Hydration from `UserMemory`
- **Action:** CREATE
- **Target File:** `backend/src/lib/ai/memory.ts`
- **What to do:**
  1. Create `hydrateIntentFromUserMemory(currentIntent: Intent, memory: MemoryContext | null): Intent`:
     - If `currentIntent.bhk` is undefined and `memory?.bhk_preference` exists, populate `intent.bhk = [memory.bhk_preference]`.
     - If `currentIntent.budgetMax` is undefined and `memory?.budget_max_cr` exists, populate `intent.budgetMax = memory.budget_max_cr`.
     - If `currentIntent.sector` is undefined and `memory?.sector_preference` exists, populate `intent.sector = memory.sector_preference`.
     - If `currentIntent.purpose` is undefined and `memory?.purpose` exists, populate `intent.purpose = memory.purpose`.
     - Mark `intent._fromUserMemory = true` so downstream components recognize these as soft defaults.
  2. Ensure that any explicit constraint in `currentIntent` strictly overrides `UserMemory`.
- **Current system relationship:** Bridges the gap between long-term `UserMemory` and short-term session intent.
- **Depends On:** None.
- **Done When:**
  - Calling `hydrateIntentFromUserMemory` with `{}` and a memory of 3BHK / ₹1.8Cr returns `{ bhk: [3], budgetMax: 1.8 }`.
  - Calling with `{ bhk: [2] }` returns `{ bhk: [2], budgetMax: 1.8 }` (explicit overrides memory).

#### Task 2.2 — Wire Soft Fallback Hydration into Chat Router for Unanchored Turns
- **Action:** MODIFY
- **Target File:** `backend/src/routes/chat-router.ts` (around lines 900–910 and line 1185)
- **What to do:**
  1. When `isNewSession` is true and the user query is an open discovery prompt (e.g. *"recommend properties for me"*, *"what fits my budget"*):
     - Apply `hydrateIntentFromUserMemory` to `intent`.
  2. Pass this hydrated intent into `findProjects` / SQL discovery.
- **Current system relationship:** Synchronizes database search filters with LLM prompt context in new sessions.
- **Depends On:** Task 2.1.
- **Done When:**
  - A returning user asking *"Show me recommended properties for me"* in a brand-new chat receives project cards matching their remembered 3BHK / Sector 150 / budget preferences.

### Phase Completion Gate
Phase 2 can ONLY be marked **DONE** when:
- New sessions with open prompts automatically discover properties matching stored `UserMemory`.
- Explicit filters stated by the user always supersede `UserMemory` defaults.

---

## Phase 3 — Explicit Cross-Session Profile Recall & Management

### Objective
Provide deterministic, transparent recall of stored user preferences across sessions (*"What do you remember about me?"*) and empower users to inspect or reset their profile memory.

### Tasks

#### Task 3.1 — Export Predicates & Formatter for Profile Memory Queries
- **Action:** CREATE
- **Target File:** `backend/src/lib/ai/memory.ts`
- **What to do:**
  1. Export `isMemoryInquiryQuery(message: string): boolean`:
     - Matches: `/\b(?:what\s+do\s+you\s+(?:know|remember)\s+about\s+(?:me|my\s+preferences)|my\s+saved\s+preferences|what\s+are\s+my\s+preferences|do\s+you\s+remember\s+me)\b/i`.
  2. Export `isMemoryResetQuery(message: string): boolean`:
     - Matches: `/\b(?:forget\s+(?:my\s+preferences|about\s+me|everything)|reset\s+my\s+(?:profile|memory|preferences)|clear\s+my\s+(?:profile|memory|preferences)|start\s+completely\s+fresh)\b/i`.
  3. Export `formatUserMemoryRecall(memory: MemoryContext | null): string`:
     - Formats structured markdown summary of BHK, budget, sector, purpose, and viewed slugs.
     - Handles empty/new user state gracefully (*"I don't have any saved preferences for you yet..."*).
  4. Export `clearUserMemory(userId?: string, guestToken?: string): Promise<boolean>`:
     - Resets `UserMemory` record for the user/guest.
- **Current system relationship:** Extends `memory.ts` with explicit user-facing capabilities conforming to `ERRORS.md`.
- **Depends On:** None.
- **Done When:**
  - `isMemoryInquiryQuery` matches inquiry variations accurately.
  - `isMemoryResetQuery` matches reset variations accurately.
  - `clearUserMemory` wipes stored preferences in Prisma.

#### Task 3.2 — Dispatch Memory Inquiry & Reset Handlers in Chat Router
- **Action:** MODIFY
- **Target File:** `backend/src/routes/chat-router.ts` (around lines 1930–1960)
- **What to do:**
  1. Add deterministic interception for `isMemoryInquiryQuery(message)`:
     - Returns `formatUserMemoryRecall(memory)`.
     - Suggests chips to refine or clear preferences.
  2. Add deterministic interception for `isMemoryResetQuery(message)`:
     - Calls `clearUserMemory(userId, guestToken)`.
     - Returns confirmation: *"I have cleared all your saved preferences. Where would you like to start fresh?"*
- **Current system relationship:** Placed beside `asksAboutHistory` in `chat-router.ts`.
- **Depends On:** Task 3.1.
- **Done When:**
  - Asking *"What do you remember about my preferences?"* in any chat displays the exact remembered profile.
  - Asking *"Reset my preferences"* wipes the profile and confirms the reset.

### Phase Completion Gate
Phase 3 can ONLY be marked **DONE** when:
- Cross-session memory recall works deterministically across chats.
- Profile memory reset wipes data and confirms cleanly.

---

## Phase 4 — Full-Spectrum Constraint Backtracking (`bhkHistory` & `possessionHistory`)

### Objective
Extend the session constraint revision log from just budget and sector to bedroom configurations (`bhkHistory`) and possession timelines (`possessionHistory`), enabling complete backtracking.

### Tasks

#### Task 4.1 — Extend `Intent` Schema with BHK and Possession History
- **Action:** MODIFY
- **Target File:** `backend/src/lib/discovery/types.ts`
- **What to do:**
  1. Add `bhkHistory?: number[][]` to `Intent` interface and `IntentSchema`.
  2. Add `possessionHistory?: string[]` to `Intent` interface and `IntentSchema`.
- **Current system relationship:** Extends the shared intent model.
- **Depends On:** None.
- **Done When:**
  - `Intent` compiles cleanly with `bhkHistory` and `possessionHistory`.

#### Task 4.2 — Log BHK and Possession Revisions in Chat Router
- **Action:** MODIFY
- **Target File:** `backend/src/routes/chat-router.ts` (lines 1913–1925)
- **What to do:**
  1. When `intent.bhk` is present, append to `intent.bhkHistory` if different from previous entry (sliding window of 6).
  2. When `intent.possession` is present, append to `intent.possessionHistory` if different.
  3. Include `bhkHistory` and `possessionHistory` in `buildStateBrief`.
  4. Extend `asksAboutHistory` regex to cover bedroom size and possession (*"what was my earlier BHK?"*, *"go back to my first configuration"*).
- **Current system relationship:** Mirrors `budgetHistory` implementation for all core dimensions.
- **Depends On:** Task 4.1.
- **Done When:**
  - Stating 3BHK then changing to 2BHK records `bhkHistory = [[3], [2]]`.
  - Asking *"What was the BHK I asked for earlier?"* returns 3BHK.

### Phase Completion Gate
Phase 4 can ONLY be marked **DONE** when:
- `bhkHistory` and `possessionHistory` are tracked across turns.
- Conversational backtracking accurately recalls prior configurations.

---

## Phase 5 — Automated Verification Suite & Live Multi-Turn Validation

### Objective
Verify all refinements with automated unit tests and execute live multi-turn end-to-end runs against the running server.

### Tasks

#### Task 5.1 — Create Automated Unit Test Suite
- **Action:** CREATE
- **Target File:** `backend/src/lib/__tests__/contextMemoryRefinements.test.ts`
- **What to do:**
  1. Test early advisory session continuity and message persistence.
  2. Test `hydrateIntentFromUserMemory` soft default logic and override behavior.
  3. Test `isMemoryInquiryQuery`, `isMemoryResetQuery`, and `formatUserMemoryRecall`.
  4. Test `bhkHistory` and `possessionHistory` revision logging.
- **Current system relationship:** New automated test suite.
- **Depends On:** Phases 1–4.
- **Done When:**
  - `contextMemoryRefinements.test.ts` passes 100%.

#### Task 5.2 — Update and Run Live End-to-End Audit Script
- **Action:** MODIFY & EXECUTE
- **Target File:** `backend/scripts/test-context-memory.ts`
- **What to do:**
  1. Run comprehensive multi-turn script against port 3001:
     - Turn 1: Advisory question on fresh session -> Verifies valid `sessionId` and DB persistence.
     - Turn 2: Follow-up on advisory -> Verifies Turn 1 context recognized.
     - Turn 3: Project search & referent resolution.
     - Turn 4: Budget revision & BHK revision.
     - Turn 5: Backtracking check for budget and BHK.
     - Turn 6: New session open prompt -> Verifies `UserMemory` soft defaults apply.
     - Turn 7: Cross-chat memory inquiry -> Verifies profile summary returned.
     - Turn 8: Profile reset -> Verifies memory wiped.
     - Turn 9: IDOR intrusion test -> Verifies cross-user block.
- **Current system relationship:** End-to-end acceptance gate.
- **Depends On:** Task 5.1.
- **Done When:**
  - All 9 live scenarios achieve **🟢 PASS**.

#### Task 5.3 — Typecheck & Full Regression Run
- **Action:** VERIFY
- **What to do:**
  1. Run `npm run typecheck` (`tsc --noEmit`).
  2. Run all existing Day 3 test suites (`messyLanguageNormalizer`, `calculators`, `requirementState`, `resolve`, `answerIntegrity`, `salesOsRefinements`).
- **Current system relationship:** Final technical verification.
- **Depends On:** Task 5.2.
- **Done When:**
  - `tsc --noEmit` exits with 0 errors.
  - All test suites pass green with 0 failures.

### Phase Completion Gate
Phase 5 can ONLY be marked **DONE** when:
- `contextMemoryRefinements.test.ts` passes 100%.
- `test-context-memory.ts` achieves 9/9 PASS live.
- Zero TypeScript errors and zero regressions across existing tests.

---

## Cross-Phase Dependency Map

```
Phase 1 (Early Advisory Session Continuity)
  │
  ├──────────────────────────────┐
  ▼                              ▼
Phase 2 (SQL & UserMemory Sync)  Phase 3 (Cross-Session Profile Recall & Reset)
  │                              │
  └──────────────┬───────────────┘
                 ▼
Phase 4 (Full-Spectrum Backtracking: BHK & Possession)
                 │
                 ▼
Phase 5 (Automated Test Suite & Live Validation)
```

---

## Final Acceptance Criteria

### Functional
- Every advisory, resale, or rental inquiry initiated on Turn 1 creates a valid session and persists the conversation.
- Follow-up turns immediately recognize prior advisory context without re-asking.
- Starting a brand-new chat with an open prompt (*"recommend properties for me"*) defaults discovery to the user's remembered profile (`UserMemory`).
- Asking *"What do you remember about my preferences?"* delivers a transparent, structured profile summary.
- Asking *"Reset my preferences"* cleanly wipes user memory.
- Backtracking seamlessly supports budget, sector, BHK, and possession revisions.
- IDOR session access from other users remains 100% blocked.

### Technical
- Clean TypeScript compilation (`tsc --noEmit` exits with code 0).
- Adherence to `ERRORS.md`: single exported predicates; no shell heredocs.
- No database foreign key errors or unhandled promise rejections.

### Regression
- Zero breakage in existing property search, project card rendering, or multi-dimensional scoring.
- All existing Day 3 tests pass green.

---

## Completion Rule

> **The implementation must NOT be considered complete until every task's "Done When" criteria are satisfied, every phase's "Phase Completion Gate" is satisfied, and the overall "Final Acceptance Criteria" are satisfied.**

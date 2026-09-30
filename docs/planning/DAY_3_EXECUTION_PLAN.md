# Phase-Gated Implementation Plan: Day 3 — JEV Cutover, Calculators, Evidence Boundary & Sales-OS Refinements

*Grounded in the live codebase state of PropFyndr backend (2026-09-30), strictly aligned with `docs/planning/phaseImplementation.md`, `Skils/SALES-OS-MASTERY.md`, and Red-Team Specifications 1, 2, 3, and 4.*

---

## 0. Current System Assessment

### 0.1 What Already Exists & Verified
- **JEV Gate (`chat-router.ts:1092`):** Gate check `rawIntentResult.decision && (process.env.JEV_MODE === 'on' || process.env.JEV_LIVE === 'true')` actively routes to `executeJevDecision()`. `JEV_MODE=on` is configured in `backend/.env`.
- **Pure Calculator Suite (`backend/src/lib/calculators.ts`):** Contains `formatInr`, `calcEmi`, `calcStampDuty` (UP rates + female concession), `calcGst` (affordable vs standard vs RTM exemption), `sqmToSqft`, `calcAllInCost`, `calcTrueNetRentalYield`, `calcUpgradeEquity`, and `calcLoadingRatio`. 10/10 unit tests pass.
- **Messy Language Normalizer (`backend/src/lib/discovery/messyLanguageNormalizer.ts`):** 3-pass pipeline handling disfluency stripping, 19-term Hinglish lexicon (`jaldi chahiye`, `dhang ka`, `1.5k carpet`), abbreviations (`GNW`, `CN`, `S150`), unit conversions (`sqm` to `sqft`), and bare-budget ambiguity gating. 26/26 unit tests pass.
- **Requirement State Machine (`backend/src/lib/discovery/requirementState.ts`):** Integrated with normalizer pipeline, supporting `BACKTRACK` state restoration (`go back to 1.5 Cr`), and `TRADE_OFF` compromise tracking in `allowedCompromises`.
- **JEV Entity Resolver (`backend/src/lib/jev/resolve.ts`):** Exact, alias, and Levenshtein fuzzy matching with strict confidence threshold ($\ge 0.75$) and rejection gate for hallucination prevention. 8/8 unit tests pass.
- **Answer Integrity Guards (`backend/src/lib/ai/answerIntegrity.ts`):** Enforces 10 `IntegrityKind` categories including `broker_hype` detection and automatic rewriting of marketing superlatives into factual verification questions. 4/4 unit tests pass.
- **Active Multi-Dimensional Discovery Pipeline:** `extendedIntent.ts`, `multiDimensionalIntegration.ts`, and `multiDimQuery.ts` provide active scoring and recommendation capabilities.

### 0.2 What Can Be Reused
- Existing JEV dispatch harness (`execute.ts`) and streaming SSE protocol (`sseWrite`).
- `classifyQuery()` and `cardBudgetFor()` query intelligence layers.
- In-memory `projectCatalog()` and Prisma models (`SectorIntelligence`, `Builder`) for fast entity lookups.
- `checkAnswerIntegritySync()` for real-time post-generation response validation.
- `NOIDA_MARKET_RANGES` and `NOIDA_AUTHORITY` in `factPresentation.ts` for established market benchmark constants.

### 0.3 What Needs Modification (Discovered via Red-Team Spec 4 Live Testing & User Direction)
1. **Out-of-Scope Resale & Rental Keyword Blocker (`chat-router.ts:333-360`):**
   - *Current Flaw:* Hardcoded regex `/\b(resale|second[- ]?hand|pre[- ]?owned)\s+(flat|propert|apartment|home|house)/i` and `/\brent\b/i ... /\b(flat|apartment|house|home|room|propert|bhk)/i` indiscriminately rejects legal, land tenure, and investment advisory queries (Spec 4 Q5 & Q9) with a cold canned rejection.
   - *Required Modification (User Directive + Sales-OS):* 
     - Provide what the user asked for: **grounded numeric ranges / benchmarks** (e.g. typical 2BHK/3BHK rent bands or resale price/sqft ranges across Noida micro-markets).
     - **NEVER provide specific project names or individual listings** from our side for rental or resale.
     - Pair the range with a customized, empathetic Sales-OS bridge: state clearly that PropFyndr exclusively handles direct developer sales (no resale/rental brokerage), and bridge to verified new/ready developer inventory with 0% GST and clean RERA title.
2. **JEV `legal_process` Catch-All Fallback (`backend/src/lib/jev/execute.ts:79-92`):**
   - *Current Flaw:* Any decision with `task: 'legal_process'` that does not match the 5-word checklist regex falls back to `getLegalProcessGuide()`, which dumps a static 6-step guide for fresh builder allotments (BBA, Authority CC/OC, E-stamping, Sub-Registrar).
   - *Impact:* Spec 4 Q6 (5-year ownership chain tracing) receives a fresh-booking registration guide instead of chain-of-title verification. Spec 4 Q7 (society financial health and maintenance arrears) receives the exact same fresh registration guide instead of sinking fund and AOA audit instructions.
   - *Required Modification:* Add specialized deterministic advisory stubs for `chain_of_title` and `society_financials`.
3. **Keyword Hijacking of Multi-Attribute Advisory Queries (`chat-router.ts`):**
   - *Current Flaw:* Broad owner-experience advisory queries like Spec 4 Q10 (*"What are five less-obvious things that could materially affect my experience as an owner..."*) contain the words *"builder reputation"*, which triggers an upstream single-keyword hook that renders a raw Developer Track Record table instead of answering the 5 owner factors.
   - *Required Modification:* Guard single-topic table hooks so they do not hijack broad multi-factor or meta-advisory inquiries, delivering the 5 owner factors classified into: *Evaluable from our data*, *Partially evaluable*, and *Not currently verifiable*.
4. **Generalizing the Sales-OS Value Bridge Across All Non-Core Inquiries:**
   - Extend the same high-value framework to:
     - Out-of-scope geography (Gurgaon, Delhi, Bangalore) $\to$ Provide macro context + zero project names + explain our strict forensic focus on Noida/GNIDA/YEIDA + calibrated bridge.
     - Commercial inquiries $\to$ Provide commercial yield benchmarks + zero project names + residential cash-flow alternative bridge.

### 0.4 What Must Be Kept (Correcting Previous Planning Assumptions)
- `backend/src/lib/ai/extendedIntent.ts` and `getMultiDimensionalRecommendations`: Our audit confirmed they are actively used by `multiDimensionalIntegration.ts`, `multiDimQuery.ts`, and `chat-router.ts:4946`. They must **NOT** be removed or moved to `_deprecated/`.
- Router session variables at lines 1110–1113 (`isFreshSearch`, `isOpenAdvisoryQuery`, `isBroadSuperlativeQuery`, `messageHasBudget`): Actively manage conversational project focus isolation and advisory query branching. They must **NOT** be deleted.

### 0.5 Architectural & Reliability Rules (Aligned with ERRORS.md)
- Per `ERRORS.md`: Any user-visible fixed string that another module must recognise gets ONE exported predicate beside it in its dedicated module. Never re-type the phrase in a regex elsewhere.
- File edits must be performed strictly using IDE file tools (`write_to_file`, `replace_file_content`), avoiding shell heredocs that corrupt regex literals.

---

## Phase 0 — Baseline Capture & JEV Activation (COMPLETED)
- `JEV_MODE=on` verified in `backend/.env`.
- Baseline test suite executed and verified.
- **Phase Completion Gate:** **PASSED**

---

## Phase 1 — Messy Language Normalizer & Ambiguity Scoring Gate (COMPLETED)
- `backend/src/lib/discovery/messyLanguageNormalizer.ts` created with 3-pass pipeline (disfluencies, 19-term Hinglish lexicon, abbreviations, unit conversions, bare-budget gate).
- `backend/src/lib/discovery/__tests__/messyLanguageNormalizer.test.ts` passes 26/26 tests.
- **Phase Completion Gate:** **PASSED**

---

## Phase 2 — Real Estate Financial Calculator Suite & JEV Dispatch Integration (COMPLETED)
- `calcAllInCost`, `calcTrueNetRentalYield`, `calcUpgradeEquity`, `calcLoadingRatio` implemented in `backend/src/lib/calculators.ts`.
- Calculator dispatch integrated in `backend/src/lib/jev/execute.ts`.
- `backend/src/lib/__tests__/calculators.test.ts` passes 10/10 tests.
- **Phase Completion Gate:** **PASSED**

---

## Phase 3 — Conversational State Machine Enhancements & Entity Resolution (COMPLETED)
- `requirementState.ts` integrated with normalizer pipeline, `BACKTRACK` state restoration, and `allowedCompromises` tracking.
- `backend/src/lib/jev/resolve.ts` strict entity resolver implemented with Levenshtein distance ($\ge 0.75$ confidence threshold).
- `backend/src/lib/jev/__tests__/resolve.test.ts` passes 8/8 tests.
- **Phase Completion Gate:** **PASSED**

---

## Phase 4 — Evidence Boundary & Answer Integrity Hardening (COMPLETED)
- `IntegrityKind` union extended with `'broker_hype'`.
- `detectBrokerHype()` implemented in `backend/src/lib/ai/answerIntegrity.ts` to detect and rewrite unverified marketing claims.
- `backend/src/lib/ai/__tests__/brokerHype.test.ts` passes 4/4 tests.
- **Phase Completion Gate:** **PASSED**

---

## Phase 5 — Router Audit & Architectural Preservation (COMPLETED)
- Audited `extendedIntent.ts` and router variables; preserved them in place to ensure zero regressions in multi-dimensional search.
- Clean compilation verified via `npm run typecheck` (0 errors).
- All 50 Day 3 unit tests verified green (1.29s).
- **Phase Completion Gate:** **PASSED**

---

## Phase 6 — Sales-OS Market Intelligence & Advisory Bridging Engine (ACTIVE)

### Objective
Implement the Sales-OS advisory framework (`SALES-OS-MASTERY.md`) across rental, resale, out-of-scope geography, and legal due diligence queries. Deliver accurate market ranges and factual checklists, enforce the strict **Zero-Project-Name** boundary for resale and rentals, provide customized positioning bridges, and achieve a **10/10 PASS** on Red-Team Spec 4.

### Tasks

#### Task 6.1 — Create Market Advisory Knowledge Base & Range Engine (`marketAdvisory.ts`)
- **Action:** CREATE
- **Target File:** `backend/src/lib/advisory/marketAdvisory.ts`
- **What to do:**
  1. Define market benchmark data structures:
     - `RENTAL_BENCHMARKS`: Sector-cluster monthly rent bands (Greater Noida West: ₹14k–22k/mo for 2BHK, ₹20k–32k for 3BHK; Central Noida 7X: ₹22k–35k for 2BHK, ₹32k–50k for 3BHK; Expressway / Sector 150: ₹28k–42k for 2BHK, ₹40k–65k for 3BHK) and gross yield averages (2.5%–3.2%).
     - `RESALE_BENCHMARKS`: Resale price ranges per sqft (GNW: ₹5,000–7,500/sqft; Central Noida: ₹8,000–12,000/sqft; Expressway/Sector 150: ₹9,500–16,000/sqft) and transaction friction breakdowns (Authority Transfer Memorandum TM charges 1–5%, registry 7%+1%, society transfer fees ₹50k–1.5L).
  2. Implement strict **Zero-Project-Name Invariant**:
     - Advisory responses for rentals and resale MUST NOT contain project names or specific listing recommendations.
  3. Implement Sales-OS Response Generators:
     - `formatRentalAdvisory(query, sector?, bhk?)`:
       - *Voss Label:* "It sounds like you're evaluating rental options in [Sector/Noida]..."
       - *Value Delivery:* Provide indicative rent range and yield benchmarks.
       - *Positioning Statement:* "Currently, PropFyndr exclusively specializes in primary developer sales and verified direct developer homes across Noida & Greater Noida — we do not handle individual rental brokerage or lease listings."
       - *Hormozi / Brunson Bridge:* Explain rent-vs-EMI economics and the advantage of ready-to-move homes with 0% GST and verified title.
       - *Calibrated Voss Close:* "Are you looking to rent short-term while planning a purchase, or would you like to see what your monthly budget can secure in a verified ready-to-move project?"
     - `formatResaleAdvisory(query, sector?, bhk?)`:
       - *Voss Label:* "It sounds like you're exploring resale opportunities in [Sector/Noida]..."
       - *Value Delivery:* Provide typical price-per-sqft range and transaction friction overhead (TM charges, registry).
       - *Positioning Statement:* "Currently, PropFyndr focuses exclusively on primary developer sales and direct builder inventory — we do not operate as an individual resale brokerage."
       - *Hormozi / Brunson Bridge:* Highlight resale pitfalls (unpaid builder dues to the Authority blocking registry, cash components, TM transfer fees) vs primary developer purchases with clean RERA escrow and direct lease deeds.
       - *Calibrated Voss Close:* "What budget ceiling or sector are you targeting? I can share verified direct developer homes where title, RERA filings, and registry eligibility are 100% established."
     - `formatOutOfScopeCityAdvisory(query, city)`:
       - Deliver high-level market context, state PropFyndr's deep ground-level forensic boundary in Noida/Greater Noida/YEIDA, and bridge to Expressway/Sector 150 alternatives.
     - `formatCommercialAdvisory(query)`:
       - Deliver commercial yield benchmark (6%–8%), state 100% residential focus, and bridge to low-maintenance residential alternatives.
  4. Export single predicate recognizers for each advisory category (complying with `ERRORS.md`).
- **Current system relationship:** Provides the central advisory engine for out-of-scope and non-listing queries.
- **Depends On:** Phase 5.
- **Done When:**
  - `marketAdvisory.ts` compiles cleanly with zero TypeScript errors.
  - Rental advisory outputs correct rent bands and contains 0 project names.
  - Resale advisory outputs correct price bands/friction and contains 0 project names.
  - All advisory responses include the customized positioning statement and calibrated bridge.

#### Task 6.2 — Integrate Advisory Engine into Router Scope Guard (`chat-router.ts`)
- **Action:** MODIFY
- **Target File:** `backend/src/routes/chat-router.ts` (lines 333–380)
- **What to do:**
  1. Refactor `isExcludedPropertyType` block:
     - Distinguish raw listing searches (e.g. *"flats for rent in sector 75"*, *"find resale flats in sector 62"*) from advisory inquiries.
     - Check if query matches rental advisory, resale advisory, out-of-scope city, or commercial inquiries.
  2. For advisory inquiries, invoke `marketAdvisory.ts` generators and stream the structured Sales-OS response via SSE (`sseWrite(res, 'token', ...)`).
  3. For raw listing searches, provide the micro-market range, state the primary sales scope, and offer the calibrated bridge chips.
- **Current system relationship:** Upgrades the entry-point gate in `chat-router.ts`.
- **Depends On:** Task 6.1.
- **Done When:**
  - Spec 4 Q5 (*"Before I buy a resale flat in Noida, I want to understand whether the project sits on leasehold or freehold land..."*) returns leasehold explanation + market price friction + Sales-OS bridge without canned rejection.
  - Spec 4 Q9 (*"I may rent this apartment out in two years... tell me what kind of tenant demand each area appears suited for..."*) returns tenant demand profiles + rent ranges + Sales-OS bridge without canned rejection.
  - Pure rental searches (e.g. *"show me flats for rent"*) return rent range + transparent primary sales bridge + zero project names.

#### Task 6.3 — Specialized JEV Legal Stubs: Chain-of-Title & Society Financial Health (`execute.ts`)
- **Action:** MODIFY
- **Target File:** `backend/src/lib/jev/execute.ts` (lines 78–92)
- **What to do:**
  1. Add `isChainOfTitleQuery` handler in `decision.task === 'legal_process'` (matches `/\b(?:ownership\s+chain|chain\s+of\s+title|bought\s+.*from\s+someone\s+else|previous\s+owner|prior\s+owner|resale\s+documents?)\b/i`):
     - Return `getChainOfTitleChecklist()`:
       1. Original Allotment Letter & Possession Certificate from Developer.
       2. Builder-Buyer Agreement (registered BBA).
       3. Prior Registered Sale Deed / Tripartite Sub-Lease Deed (linking first owner to second owner).
       4. Current Registered Deed & Chain of Title continuity (no missing links).
       5. Non-Encumbrance Certificate (EC Form 15 for 12–30 years from Sub-Registrar).
       6. Authority Transfer Memorandum (TM) / Transfer Permission from NOIDA/GNIDA Authority.
       7. Society/AOA No-Objection Certificate (NOC) and electricity bill mutation receipt.
       8. Independent legal counsel title verification disclaimer.
  2. Add `isSocietyFinancialQuery` handler in `decision.task === 'legal_process'` (matches `/\b(?:financial\s+health|managed\s+financially|maintenance\s+arrears|reserve\s+funds?|sinking\s+fund|pending\s+repairs|future\s+expenses|society\s+finances?)\b/i`):
     - Return `getSocietyFinancialHealthChecklist()`:
       1. Audited Balance Sheets & Annual Accounts of the AOA/RWA (past 3 financial years).
       2. Maintenance Collection Efficiency & Arrears Ratio (flag if >15% of residents default).
       3. Sinking Fund Balance vs Major Capital Expenditure Cycles (lifts, DG sets, STPs, facade waterproofing due every 7–10 years).
       4. Developer Handover Status & Pending IFMS (Interest-Free Maintenance Security) transfer to AOA.
       5. Outstanding Authority Water/Sewer Dues or Electricity Substation liabilities.
       6. Ongoing Litigation (disputes with builder, contractors, or adjacent land parcels).
       7. Explicit disclosure that private society accounting records must be inspected directly via AOA meeting minutes.
- **Current system relationship:** Completes deterministic legal advisory dispatcher in `execute.ts`.
- **Depends On:** Task 6.2.
- **Done When:**
  - Spec 4 Q6 returns the 7-step Chain-of-Title verification checklist.
  - Spec 4 Q7 returns the Society Financial Health audit checklist.
  - Neither query dumps the generic fresh-booking BBA registration guide.

#### Task 6.4 — Anti-Hijacking Guard for Multi-Factor Inquiries (`chat-router.ts` & `execute.ts`)
- **Action:** MODIFY
- **Target File:** `backend/src/routes/chat-router.ts` and `backend/src/lib/jev/execute.ts`
- **What to do:**
  1. Add detection for multi-attribute consulting queries (matching `/\b(?:five|5|top\s+\d+|less[- ]obvious|what\s+am\s+i\s+not\s+thinking\s+about|what\s+else\s+should\s+i\s+(?:consider|check|look\s+at)|factors?\s+that\s+could\s+materially\s+affect)\b/i`).
  2. Prevent single-keyword table generators (e.g. `builder reputation`) from intercepting these turns.
  3. Implement `getNonObviousOwnerFactorsGuide()` in `execute.ts` or advisory handler:
     - Presents 5 non-obvious owner factors:
       1. Water Source & TDS variation (Municipal Ganga Jal TDS 200–300 vs Borewell >2000 ppm).
       2. Dual-meter electricity & CAM tariffs (Multipoint PVVNL vs single-point builder markups).
       3. Carpet loading ratio efficiency (Super built-up loading 28% efficient vs 38% inflated).
       4. Authority land dues clearance & registry camp status (Amitabh Kant 25% deposit).
       5. Sinking fund & aging infrastructure maintenance burden (AOA IFMS transfer).
     - Explicitly categorizes each factor into:
       - **Evaluable from our data:** Carpet loading ratio, Authority land dues/registry status, Water TDS source.
       - **Partially evaluable:** Power backup configuration and builder track record history.
       - **Not currently verifiable:** Private society maintenance collection arrears and internal RWA disputes.
- **Current system relationship:** Shields open consulting turns from single-keyword hijacking.
- **Depends On:** Task 6.3.
- **Done When:**
  - Spec 4 Q10 delivers the 5 owner factors categorized by evaluability instead of a raw developer track record table.

#### Task 6.5 — Automated Verification Suite & Live Red-Team Validation
- **Action:** CREATE & VERIFY
- **Target File:** `backend/src/lib/__tests__/salesOsRefinements.test.ts` and `backend/scripts/run-spec4-live.ts`
- **What to do:**
  1. Implement automated unit test suite testing:
     - Rental advisory output: verified numbers, zero project names, customized Sales-OS bridge.
     - Resale advisory output: verified rate bands, zero project names, customized Sales-OS bridge.
     - Chain-of-title checklist completeness.
     - Society financial health checklist completeness.
     - Multi-factor advisory classification.
  2. Execute `run-spec4-live.ts` against the live backend server to verify **10/10 PASS** across all Red-Team Spec 4 queries.
- **Current system relationship:** Final quality gate for Phase 6.
- **Depends On:** Tasks 6.1, 6.2, 6.3, 6.4.
- **Done When:**
  - `salesOsRefinements.test.ts` passes 100%.
  - `run-spec4-live.ts` achieves 10/10 PASS with zero failures or unhandled edge cases.
  - `npm run typecheck` exits with 0 errors.

---

### Phase 6 Completion Gate [PASSED]

Phase 6 is verified **DONE**:
1. Every rental and resale inquiry receives accurate benchmark numbers with **zero project names** or individual listings mentioned (Verified via `salesOsRefinements.test.ts`).
2. Every rental and resale turn includes a customized Sales-OS positioning statement and calibrated bridge.
3. Spec 4 Q5 provides complete leasehold vs freehold guidance without an out-of-scope rejection (Verified live).
4. Spec 4 Q6 provides the 7-step Chain-of-Title verification checklist (Verified live).
5. Spec 4 Q7 provides the Society Financial Health audit checklist (Verified live).
6. Spec 4 Q9 provides tenant demand analysis without an out-of-scope rejection (Verified live).
7. Spec 4 Q10 presents the 5 non-obvious owner factors categorized by evaluability (Verified live).
8. `salesOsRefinements.test.ts` passes 17/17 (100%) and `run-spec4-live.ts` verifies **10/10 PASS**.
9. Zero regressions across existing search and calculator tests (50/50 Day 3 tests pass, `tsc --noEmit` exits 0).

---

## Cross-Phase Dependency Map

```
Phase 0 (Baseline & JEV Env Flag) [DONE]
  │
  ├──────────────────────────────┐
  ▼                              ▼
Phase 1 (Messy Language) [DONE] Phase 2 (Calculator Suite) [DONE]
  │                              │
  └──────────────┬───────────────┘
                 ▼
Phase 3 (State Machine & Entity Resolver) [DONE]
                 │
                 ▼
Phase 4 (Evidence Boundary & Integrity Guard) [DONE]
                 │
                 ▼
Phase 5 (Architecture & Router Preservation) [DONE]
                 │
                 ▼
Phase 6 (Sales-OS Market Intelligence & Advisory Bridging Engine) [DONE]
  ├── Task 6.1: Market Advisory Knowledge Base & Range Engine (Zero-Project-Name Invariant) [DONE]
  ├── Task 6.2: Scope-Gating Discrimination & Sales-OS Bridge in Router [DONE]
  ├── Task 6.3: Specialized JEV Legal Stubs (Chain-of-Title & Society Financials) [DONE]
  ├── Task 6.4: Anti-Hijacking Guard for Multi-Factor Owner Advisory Inquiries [DONE]
  └── Task 6.5: Spec 4 Automated Verification Suite & Live Validation [DONE: 10/10 PASS]
```

---

## Final Acceptance Criteria

### Functional
- Statutory and financial queries (stamp duty, all-in cost, rental yield, upgrade equity, loading ratio) execute in <150ms with 0 LLM tokens billed.
- Hinglish phrases (`jaldi chahiye`, `dhang ka`, `1.5k carpet`) normalize accurately into structured filters.
- Ambiguous bare-number queries prompt the user for clarification instead of hallucinating values.
- Conversational backtracking ("go back to 1.5 Cr") restores prior constraints accurately.
- Known projects resolve to catalog IDs; unknown entities reject cleanly (`null`).
- Marketing broker hype ("70% open space") is intercepted and converted to factual verification questions.
- **Sales-OS Advisory Behavior:**
  - Rental and resale queries deliver grounded numerical ranges without mentioning project names.
  - Every non-core inquiry transparently states PropFyndr's primary developer focus and builds a calibrated bridge.
- **Red-Team Spec 4 Compliance (10/10 PASS):**
  - Q1–Q4: Refuses to hallucinate unverified flood, power, or infrastructure data when project context is missing.
  - Q5: Explains 90-year leasehold, TM transfer fees, and authority transfer without an out-of-scope rejection.
  - Q6: Provides sequential 7-step ownership chain verification.
  - Q7: Provides AOA balance sheet, sinking fund, and maintenance arrears audit checklist.
  - Q8: Evaluates solar orientation, floor buffering, and glazing thermal factors.
  - Q9: Delivers tenant demand profiles and yield indicators without out-of-scope rejection.
  - Q10: Delivers 5 non-obvious owner factors classified by evaluability status.

### Technical
- Clean TypeScript compilation (`tsc --noEmit` exits 0).
- Strict adherence to `ERRORS.md`: single exported predicates for user-visible strings; zero shell heredocs for TS file edits.
- Zero raw JSON or internal UUID leaks in client responses.

### Regression
- Zero breakage in existing search, recommendation, and discovery pipelines.
- All existing tests in `src/test-runner.ts` and new test suites pass green.

---

## Completion Rule

> **The implementation must NOT be considered complete until every task's "Done When" criteria are satisfied, every phase's "Phase Completion Gate" is satisfied, and the overall "Final Acceptance Criteria" are satisfied.**

# Phase-Gated Implementation Plan: Day 5 — Hero Chat Interface (Micro-UX, Token-Free Interactive Tools & Proof Drawers)

*Grounded in the live codebase state of PropFyndr (`frontend` and `backend`), strictly aligned with `docs/planning/phaseImplementation.md` and Day 5 of `MASTER_EXECUTION_ROADMAP_V2.md`.*

---

## 0. Current System Assessment

### 0.1 What Already Exists
- **Streaming Infrastructure (Day 4):**
  - Sequenced SSE protocol emits `{ type, seq, ... }` via monotonic `turnSeq` counter in `chat-router.ts`.
  - Client reducer `streamReducer.ts` and `backend-api.ts` track `highestSeq` and handle packet deduplication.
  - Viewport auto-scroll logic in `frontend/components/DiscoveryContent.tsx` manages `userScrolledUp` (lines 537, 730, 745, 1938) and answer pin heights.
- **Affordability Card Component (`frontend/components/chat/AffordabilityCard.tsx`):**
  - 152-line component rendering landed cost, standard EMI, rate shock buffer, Sec 24(b) tax relief, and FOIR status.
  - Currently purely static: takes `data: AffordabilityData` and displays immutable values with no sliders or dynamic state.
- **Frontend Calculator Utilities (`frontend/lib/calculators.ts`):**
  - Contains `calculateEmi`, `calculateStampDuty`, and `calculateGst`.
  - Lacks dynamic Section 24(b) monthly tax shield computation and live down-payment / tenure adjustment routines.
- **Dynamic Component Architecture (`frontend/components/ComponentRenderer.tsx`):**
  - Maps spec types (`property-card`, `price-chart`, `emi-calculator`, `payment-breakdown`, etc.) to React renderers.
  - Supports `message.responseMode === 'components'` and verified data pipeline.
  - Currently lacks a dedicated renderer for RERA carpet area loading ratios and usable area efficiency.
- **Filter Dock & Mobile Shelf (`FilterDock.tsx`, `MobileCardShelf.tsx`, `CompareSelectorOverlay.tsx`):**
  - `FilterDock.tsx` renders location, BHK, possession, and budget pill filters in a portal/sheet.
  - `MobileCardShelf.tsx` renders a collapsible card shelf above the chat answer on mobile viewports.
  - `CompareSelectorOverlay.tsx` implements accessible modal selection for up to 4 properties with `useDialogA11y`.
- **Response Formatting & Prose (`MessageBubble.tsx`, `ResponseFormatter.tsx`, `Markdown.tsx`):**
  - `MessageBubble.tsx` renders streaming chunks, domain execution timeline, response blocks, and verified badges.
  - Currently lacks interactive provenance pill popups / slide-over proof drawers.

### 0.2 What Can Be Reused
- **`useDialogA11y` Hook (`frontend/hooks/useDialogA11y.ts`):** Focus trapping, `Escape` key handling, and background scroll locking for accessible modals/drawers.
- **Phosphor Icons (`@phosphor-icons/react`):** Standard design iconography (`ShieldCheck`, `Scales`, `CurrencyInr`, `Sliders`, `TrendUp`, `FileText`, `CheckCircle`, `CaretRight`, `X`).
- **Framer Motion (`framer-motion`):** Smooth animation primitives (`m.div`, `AnimatePresence`) for drawer slide-overs, typewriter easing, and chip dismissals.
- **Analytics Tracking (`frontend/lib/analytics.ts`):** Established `track()` and `trackPropertyEvent()` functions for event observability.

### 0.3 What Requires Modification
1. **`frontend/components/chat/MessageBubble.tsx`:**
   - Integrate typewriter chunk smoothing so streaming markdown unfolds character-by-character or word-by-word at 15–25ms intervals without layout jumps.
   - Detect and render clickable `ProvenancePill` elements from verified prose tokens or verified fact blocks.
2. **`frontend/components/DiscoveryContent.tsx`:**
   - Harden viewport scroll-lock so typewriter streaming updates never violently snap or jerk the feed if `userScrolledUp.current` is true.
3. **`frontend/components/chat/AffordabilityCard.tsx`:**
   - Convert from static display to an interactive cockpit with live local state:
     - Down Payment slider (10% to 50% in 5% increments)
     - Loan Tenure slider (10 to 30 years in 1-year increments)
     - "+1.5% RBI Rate Shock" toggle
     - Real-time recalculation of EMI, Section 24(b) tax savings, and safe monthly take-home income.
4. **`frontend/components/ComponentRenderer.tsx`:**
   - Register `'carpet-loading-visualizer'` in `COMPONENT_RENDERERS` map.
5. **`frontend/components/chat/ResponseFormatter.tsx`:**
   - Add support for provenance inspection triggers on verified facts.
6. **`frontend/components/chat/FilterDock.tsx` & `MobileCardShelf.tsx`:**
   - Add single-tap chip removal with animated exit transitions in `FilterDock.tsx`.
   - Add floating "Compare (N)" quick-selector badge in `MobileCardShelf.tsx`.
   - Ensure all touch targets meet the $\ge 48\text{px}$ mobile accessibility baseline.

### 0.4 What Requires Creation
1. **`frontend/lib/chat/typewriterBuffer.ts`:** Smooth variable-speed (15–25ms) queue drainer for streaming text chunks.
2. **`frontend/components/chat/CarpetLoadingVisualizer.tsx`:** Interactive proportional bar visualizer (Usable Carpet Area vs Common Area Loading), effective rate per carpet sqft calculator, and Elevator Congestion Index (ECI) badge.
3. **`frontend/components/chat/ProvenancePill.tsx`:** Inline clickable trust badge for verified facts.
4. **`frontend/components/chat/VerificationProofDrawer.tsx`:** Slide-over audit drawer showing on-ground verification dockets, dates, certificate IDs, and official portal links.

### 0.5 Risks & Constraints
- **Performance / Layout Thrashing:** High-frequency typewriter updates can cause excessive DOM re-renders if not buffered into `requestAnimationFrame` or RAF-throttled React state.
- **Scroll Conflict:** Native browser scroll anchoring can clash with artificial typewriter height growth if container padding and minimum heights are not cleanly bounded.
- **Financial Exactness:** Client-side loan calculations must match standard Indian banking schedules (reducing balance formula, Section 24(b) ₹2 Lakh annual ceiling) to the rupee.
- **Mobile Viewport (360px):** Sliders, drawers, and stacked proportional bars must fit neatly on small mobile screens without horizontal canvas overflow.

---

## Phase 0 — Typewriter Streaming Buffer & Viewport Scroll-Lock Hardening (Task 5.1)

### Objective
Provide a smooth, premium reading experience during AI streaming by eliminating erratic text jumps through a 15–25ms easing queue, while guaranteeing that a user scrolling up to read earlier messages is never jerked back to the bottom.

### Tasks

#### Task 0.1 — Client-Side Typewriter Chunk Buffer Engine
* **Action:** CREATE `frontend/lib/chat/typewriterBuffer.ts`
* **What to do:**
  * Implement `createTypewriterBuffer(onFlush: (text: string) => void, options?: { minIntervalMs?: number; maxIntervalMs?: number; batchSize?: number })`:
    * Incoming text chunks are appended to an internal buffer string.
    * A dynamic interval loop (15–25ms, calibrated to buffer depth) drains characters/words smoothly:
      * When the queue is small: drain 1–2 characters per 20ms (simulating natural reading cadence).
      * When a large burst arrives (>100 characters): scale drain rate proportionally so latency does not exceed 100ms.
    * Provide a `.flushImmediately()` method to immediately emit remaining text when the stream closes (`done` or `error` event).
  * Implement React hook `useTypewriter(rawText: string, isStreaming: boolean): string`.
* **Current system relationship:** Plugs into the message rendering path in `MessageBubble.tsx`.
* **Depends On:** None.
* **Done When:**
  * Raw token chunks fed in rapid bursts render smoothly with variable 15–25ms interval.
  * Setting `isStreaming: false` flushes the full buffer immediately with 0 lost characters.
  * Unit test validates queue draining and flush behavior.

#### Task 0.2 — Integrate Typewriter Smoothing in MessageBubble
* **Action:** MODIFY `frontend/components/chat/MessageBubble.tsx`
* **What to do:**
  * In `MessageBubble.tsx` (Stage D streaming branch, line ~829):
    * For active streaming assistant messages (`isLast && isSubmitting`), pass `cleanDisplayContent` through `useTypewriter`.
    * Render the smoothed text through `renderMarkdown`.
    * Ensure the streaming cursor pulse (`animate-pulse`) trails the smoothed text cleanly.
    * When streaming finishes, display the complete response blocks without any lag.
* **Current system relationship:** Upgrades `MessageBubble.tsx` streaming text rendering.
* **Depends On:** Task 0.1.
* **Done When:**
  * Streaming text appears fluid and natural without jumpy multi-word bursts.
  * Completed messages display final parsed response blocks instantly without layout shift.

#### Task 0.3 — Viewport Scroll-Lock Hardening During Streaming
* **Action:** MODIFY `frontend/components/DiscoveryContent.tsx`
* **What to do:**
  * Review scroll observation in `DiscoveryContent.tsx`:
    * Audit `onScroll` handler on `chatContainerRef` (line ~1938): ensure `fromBottom > 80` sets `userScrolledUp.current = true`.
    * In streaming effect, strictly bypass `scrollToBottom()` whenever `userScrolledUp.current === true`.
    * Only auto-scroll when the user is already anchored within 80px of the bottom.
    * If the user manually scrolls back to the bottom (`fromBottom <= 20`), reset `userScrolledUp.current = false` and resume auto-following.
* **Current system relationship:** Guards auto-scroll in `DiscoveryContent.tsx`.
* **Depends On:** None.
* **Done When:**
  * Scrolling up mid-stream locks the viewport in place with zero downward jerking.
  * Reaching the bottom re-engages auto-scroll smoothly.

### Phase 0 Completion Gate
* [x] `typewriterBuffer.test.ts` passes unit tests verifying queue draining and immediate flush.
* [x] Live streaming test confirms continuous 15–25ms text flow.
* [x] Manual scroll-up during 100-token stream stays pinned without viewport jitter.

---

## Phase 1 — Client-Side Financial Cockpit & Rate Shock Sliders (Task 5.2)

### Objective
Transform `AffordabilityCard.tsx` from an immutable number card into an interactive financial cockpit that lets buyers slide down payments (10% to 50%) and loan tenures (10 to 30 years) with a live RBI +1.5% rate shock stress test, computing exact Indian banking math locally in $<5\text{ms}$ with zero AI tokens.

### Tasks

#### Task 1.1 — Financial Cockpit Math & Tax Shield Utilities
* **Action:** EXTEND `frontend/lib/calculators.ts`
* **What to do:**
  * Add financial cockpit functions:
    ```typescript
    export interface LoanCockpitParams {
      totalLandedCost: number
      downPaymentPct: number // 10 to 50
      tenureYears: number // 10 to 30
      annualInterestRatePct: number // e.g. 8.5
      enableRateShock?: boolean // +1.5%
    }
    export interface LoanCockpitResult {
      downPaymentAmount: number
      loanPrincipal: number
      activeInterestRatePct: number
      standardMonthlyEmi: number
      shockMonthlyEmi: number
      monthlyRateShockDelta: number
      monthlyTaxShieldSec24b: number
      netMonthlyOutflow: number
      safeMonthlyTakeHome: number // 40% FOIR
    }
    export function calculateLoanCockpit(params: LoanCockpitParams): LoanCockpitResult
    ```
  * Enforce standard formulas:
    * Loan Principal: `totalLandedCost * (1 - downPaymentPct / 100)`.
    * Monthly EMI: Reducing balance standard formula.
    * Section 24(b) Tax Shield: Max ₹2,00,000/year deduction on interest $\to \min(\text{Annual Interest}, 200000) \times 0.30 / 12$ (assuming 30% tax slab, capped at ₹5,000/mo).
    * Net Monthly Outflow: `standardMonthlyEmi - monthlyTaxShieldSec24b`.
    * Safe Household Take-Home (40% FOIR): `standardMonthlyEmi / 0.40`.
* **Current system relationship:** Extends `frontend/lib/calculators.ts`.
* **Depends On:** None.
* **Done When:**
  * `calculateLoanCockpit` yields exact EMI and tax figures matching banking schedules.
  * Unit tests cover edge values (10% down payment, 50% down payment, 10-year tenure, 30-year tenure, rate shock enabled).

#### Task 1.2 — Interactive Financial Cockpit in AffordabilityCard
* **Action:** MODIFY `frontend/components/chat/AffordabilityCard.tsx`
* **What to do:**
  * Initialize local state in `AffordabilityCard.tsx`:
    * `downPaymentPct` (default: 20%, range: 10% to 50%, step: 5%).
    * `tenureYears` (default: `data.tenureYears || 20`, range: 10 to 30, step: 1).
    * `rateShockActive` (default: false).
  * Compute live figures via `calculateLoanCockpit` using `useMemo`.
  * Add UI controls:
    * **Down Payment Slider**: Segmented track with percentages (10%, 20%, 30%, 40%, 50%) and live rupee amount.
    * **Tenure Slider**: Range slider (10y to 30y) with live monthly tag.
    * **RBI Rate Shock Toggle**: Interactive pill/switch with `+1.5%` indicator showing the buffered EMI difference.
  * Dynamically update the metric tiles (Standard EMI, Net Outflow, Shock EMI) and the breakdown rows in real time.
* **Current system relationship:** Replaces static display in `AffordabilityCard.tsx`.
* **Depends On:** Task 1.1.
* **Done When:**
  * Dragging sliders updates all figures in $<5\text{ms}$ with zero network requests.
  * Rupee and crore values format cleanly according to Indian numbering standards.

#### Task 1.3 — Mobile Accessibility & Touch Target Audit ($\ge 48\text{px}$)
* **Action:** MODIFY `frontend/components/chat/AffordabilityCard.tsx`
* **What to do:**
  * Style slider thumbs with minimum touch dimensions: thumb size $\ge 24\text{px}$ with a touch hit-box wrapper $\ge 48\text{px} \times 48\text{px}$.
  * Add full keyboard accessibility:
    * `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label`.
    * `ArrowLeft` / `ArrowRight` increments.
  * Add subtle haptic/visual feedback on step snap.
* **Current system relationship:** Ensures WCAG compliance in `AffordabilityCard.tsx`.
* **Depends On:** Task 1.2.
* **Done When:**
  * Sliders are fully operable via keyboard arrows and touch screens on mobile devices down to 360px width.
  * Touch targets are verified at $\ge 48\text{px}$.

### Phase 1 Completion Gate
* [x] `frontend/__tests__/calculators.test.ts` passes with new loan cockpit test cases.
* [x] Sliders operate with 0 lag (<5ms compute time) and 0 network requests.
* [x] Touch targets and ARIA attributes pass accessibility inspection.

---

## Phase 2 — RERA Carpet Loading & Layout Efficiency Visualizer (Task 5.3)

### Objective
Expose real-world usable space vs builder marketing loading through an interactive layout efficiency visualizer comparing usable carpet area against common area loading with dynamic cost-per-carpet-sqft calculations and Elevator Congestion Index (ECI).

### Tasks

#### Task 2.1 — Carpet Efficiency & Elevator Congestion Engine
* **Action:** CREATE `frontend/lib/chat/carpetEfficiency.ts`
* **What to do:**
  * Implement calculations:
    ```typescript
    export interface CarpetEfficiencyMetrics {
      superAreaSqft: number
      carpetAreaSqft: number
      commonAreaSqft: number
      loadingPercentage: number // (super - carpet) / super * 100
      carpetEfficiencyPercentage: number // carpet / super * 100
      advertisedRatePerSqft: number
      effectiveCarpetRatePerSqft: number // advertisedRate * (super / carpet)
      eciScore: number // Elevator Congestion Index
      eciRating: 'Low Wait' | 'Standard' | 'High Congestion'
    }
    export function computeCarpetEfficiency(
      superAreaSqft: number,
      carpetAreaSqft: number,
      totalPriceCr: number,
      options?: { totalFlats?: number; totalLifts?: number; totalFloors?: number }
    ): CarpetEfficiencyMetrics
    ```
  * ECI rating logic:
    * Ratio of apartments per lift: $\le 30 \to$ 'Low Wait', $31–50 \to$ 'Standard', $> 50 \to$ 'High Congestion'.
* **Current system relationship:** Core calculation engine for Task 5.3.
* **Depends On:** None.
* **Done When:**
  * Unit tests verify loading ratio (e.g. 1,200 super vs 850 carpet $\to 29.17\%$ loading).
  * Effective carpet rate correctly reflects the true usable rupee density.

#### Task 2.2 — CarpetLoadingVisualizer Component
* **Action:** CREATE `frontend/components/chat/CarpetLoadingVisualizer.tsx`
* **What to do:**
  * Build the component:
    * **Header**: Project name, unit configuration (e.g., "3 BHK Luxury · 1,850 sq.ft Super").
    * **Stacked Proportional Bar**:
      * Left bar segment (emerald/green): Usable Carpet Area with percentage & sq.ft label.
      * Right bar segment (amber/orange): Common Area Loading with percentage & sq.ft label.
    * **Key Metric Grid**:
      * Advertised Rate (e.g. ₹9,500/sq.ft) vs Effective Carpet Rate (e.g. ₹13,400/sq.ft).
      * Usable Area Efficiency badge (e.g. "71% Usable Space").
      * Elevator Congestion Index (ECI) chip with status icon (`Low Wait`, `Standard`, `High Congestion`).
    * **Interactive Comparison Slider / Toggle**: Let user switch between advertised super area and true usable carpet area to visualize space loss.
* **Current system relationship:** Self-contained visual card component.
* **Depends On:** Task 2.1.
* **Done When:**
  * Component renders animated stacked bar matching usable vs common area percentages.
  * Responsive and readable on viewports from 360px to desktop.

#### Task 2.3 — ComponentRenderer Registration & ComponentSpec Integration
* **Action:** MODIFY `frontend/components/ComponentRenderer.tsx` and `frontend/types/property.ts`
* **What to do:**
  * In `frontend/components/ComponentRenderer.tsx`:
    * Import `CarpetLoadingVisualizer`.
    * Register `'carpet-loading-visualizer'` and `'layout-efficiency'` in `COMPONENT_RENDERERS`.
  * Ensure `ComponentSpec` accepts:
    ```typescript
    {
      type: 'carpet-loading-visualizer',
      props: {
        projectName: string,
        unitType: string,
        superAreaSqft: number,
        carpetAreaSqft: number,
        totalPriceCr?: number,
        advertisedRatePerSqft?: number,
        totalFlats?: number,
        totalLifts?: number,
        totalFloors?: number,
      }
    }
    ```
* **Current system relationship:** Connects layout visualizer to the backend verified component pipeline.
* **Depends On:** Task 2.2.
* **Done When:**
  * Passing a `'carpet-loading-visualizer'` spec into `ComponentRenderer` renders the layout card cleanly with zero console warnings.
  * `ComponentRenderer.test.tsx` passes with the new component spec.

### Phase 2 Completion Gate
* [x] `carpetEfficiency.test.ts` passes with verified loading and ECI calculations.
* [x] `CarpetLoadingVisualizer` renders stacked proportional bars with correct dimensions.
* [x] Component renders cleanly through `ComponentRenderer` on unit configuration queries.

---

## Phase 3 — Clickable Provenance Trust Pills & Official Proof Drawer (Task 5.4)

### Objective
Attach verified provenance badges (`[Verified: Ganga Jal Supply (TDS 220 ppm)]`, `[Verified: UP Lifts Act Registered]`, `[Verified: Amitabh Kant 25% Dues Cleared]`, `[Verified: UP RERA ...]`) to factual claims in chat messages. Clicking opens a slide-over drawer showing official government records, certificate numbers, inspection dates, and audit notes.

### Tasks

#### Task 3.1 — Provenance Badge Tokenizer & ProvenancePill Component
* **Action:** CREATE `frontend/components/chat/ProvenancePill.tsx`
* **What to do:**
  * Build `ProvenancePill`:
    * Renders a sleek trust pill: Shield icon + badge label (e.g. `UP RERA Verified`, `Ganga Jal Supply`, `UP Lifts Act Compliant`, `25% Land Dues Cleared`).
    * Includes hover state with subtle micro-interaction and `cursor-pointer`.
    * Accessible keyboard interaction (`Enter` / `Space` triggers `onClick`).
  * Add regex / token matcher to detect provenance citations in prose:
    * Matches patterns: `\[Verified:\s*([^\]]+)\]` or custom Markdown component tag `<provenance-pill ... />`.
* **Current system relationship:** Rendered inside markdown assistant answers.
* **Depends On:** None.
* **Done When:**
  * `[Verified: ...]` tokens in prose transform into styled clickable pills.
  * Keyboard focus rings display properly.

#### Task 3.2 — VerificationProofDrawer Slide-Over Component
* **Action:** CREATE `frontend/components/chat/VerificationProofDrawer.tsx`
* **What to do:**
  * Build `VerificationProofDrawer` using `createPortal` and `useDialogA11y`:
    * Slide-over panel (right on desktop, bottom sheet on mobile).
    * **Header**: Official Record Verification, project name, verified badge.
    * **Docket Information**:
      * Official Authority / Agency (e.g., UP RERA, Noida Jal Board, Directorate of Electrical Safety UP).
      * Registration / Certificate Number.
      * Inspection / Filing Date.
      * Verification Status: Confirmed on-ground.
      * Field Notes / Audit Remarks.
      * Direct link to official government portal / public docket.
    * **Actions**: "Copy Certificate ID" and "Close".
    * Fully accessible: `aria-modal="true"`, focus trap, closes on `Escape` and backdrop tap.
* **Current system relationship:** Modal slide-over drawer mounted at document body.
* **Depends On:** Task 3.1.
* **Done When:**
  * Tapping a provenance pill slides open the drawer displaying official inspection records.
  * `Escape` key and backdrop tap close the drawer and restore focus to the pill.

#### Task 3.3 — Wiring in Markdown & MessageBubble with Analytics
* **Action:** MODIFY `frontend/components/response/Markdown.tsx` and `frontend/components/chat/MessageBubble.tsx`
* **What to do:**
  * In `Markdown.tsx`:
    * Add a custom component handler or text replacement for `[Verified: ...]` tokens that renders `ProvenancePill`.
  * In `MessageBubble.tsx`:
    * Manage active proof drawer state: `selectedProof: VerificationProofData | null`.
    * Render `VerificationProofDrawer` when `selectedProof !== null`.
    * Fire PostHog / analytics event: `track('provenance_pill_clicked', { attribute, projectName, certificateId })`.
* **Current system relationship:** Integrates proof drawer into chat conversation flow.
* **Depends On:** Tasks 3.1, 3.2.
* **Done When:**
  * Clicking any verified pill in an AI response opens the proof drawer with project records.
  * Analytics event `provenance_pill_clicked` is emitted.

### Phase 3 Completion Gate
* [x] Clickable provenance pills render cleanly within AI markdown bubbles.
* [x] Proof drawer slides open with accurate inspection records and certificate IDs.
* [x] Full keyboard navigation (focus trap, `Escape` to close) passes accessibility checks.

---

## Phase 4 — Mobile Action Quick-Filter Dock & Shortlist Drawer Polish (Task 5.5)

### Objective
Optimize mobile property exploration by adding 1-tap chip removal with animated exit transitions in `FilterDock.tsx`, and a floating "Compare (N)" badge and shortlist drawer in `MobileCardShelf.tsx` with guaranteed 48px touch targets.

### Tasks

#### Task 4.1 — Instant 1-Tap Chip Removal with Animated Exit Transitions
* **Action:** MODIFY `frontend/components/chat/FilterDock.tsx`
* **What to do:**
  * In `FilterDock.tsx`:
    * Enhance active filter chips with dedicated, always-accessible `(X)` remove buttons.
    * Wrap chip pills in Framer Motion `AnimatePresence` with smooth exit animations (`scale: 0.95`, `opacity: 0`, transition: `150ms easeOut`).
    * Tapping `(X)` immediately calls `onRemove(pill.clears, label)` without opening the filter popover.
    * Ensure touch target for the remove icon is at least $44\text{px} \times 44\text{px}$ on mobile.
* **Current system relationship:** Upgrades `FilterDock.tsx`.
* **Depends On:** None.
* **Done When:**
  * Tapping `(X)` clears the filter instantly with smooth exit animation.
  * Clearing a filter does not cause layout shifts or accidental popover opens.

#### Task 4.2 — Floating Compare Overlay Trigger & Badge in Mobile Shelf
* **Action:** MODIFY `frontend/components/chat/MobileCardShelf.tsx`
* **What to do:**
  * In `MobileCardShelf.tsx`:
    * Add a floating / docked "Compare (N)" button when 2 or more projects exist in the turn results.
    * Tapping "Compare" slides open `CompareSelectorOverlay.tsx`.
    * Display active count badge showing how many properties are shortlisted.
    * Animate shelf expansion/collapse smoothly on mobile touch devices.
* **Current system relationship:** Upgrades `MobileCardShelf.tsx`.
* **Depends On:** None.
* **Done When:**
  * "Compare" button opens the comparison selector seamlessly on mobile.
  * Shelf expands/collapses with zero jank on 360px mobile viewports.

#### Task 4.3 — Mobile Touch Target Audit & Responsive Polish
* **Action:** AUDIT & MODIFY `frontend/components/chat/FilterDock.tsx` and `MobileCardShelf.tsx`
* **What to do:**
  * Audit all buttons, chips, and sliders against the $\ge 48\text{px}$ touch target guideline.
  * Add `touch-manipulation` CSS utility to eliminate mobile tap delays.
  * Verify that horizontal scrolling on the filter dock doesn't interfere with vertical chat feed scrolling.
* **Current system relationship:** Cross-component mobile polish.
* **Depends On:** Tasks 4.1, 4.2.
* **Done When:**
  * 100% of interactive controls meet mobile touch target standards ($\ge 44–48\text{px}$).
  * Zero horizontal page overflow on small viewports (iPhone SE / 360px Android).

### Phase 4 Completion Gate
* [x] Filter chip removal animates smoothly on exit without layout snapping.
* [x] Compare selector overlay slides open reliably from mobile shelf.
* [x] All touch targets meet minimum 48px standard.

---

## Phase 5 — End-to-End Validation, Test Harness & Regression Suite

### Objective
Verify that all Day 5 UI components, calculators, drawers, and smoothing algorithms pass automated tests, accessibility audits, and do not regress existing chat functionality.

### Tasks

#### Task 5.1 — Automated Test Suite for Typewriter, Cockpit & Carpet Efficiency
* **Action:** CREATE `frontend/__tests__/day5Features.test.ts`
* **What to do:**
  * Write automated tests covering:
    1. `createTypewriterBuffer`: Queue insertion, variable easing drain, instant flush on stream end.
    2. `calculateLoanCockpit`: Standard EMI, Section 24(b) tax relief cap, +1.5% RBI rate shock calculations.
    3. `computeCarpetEfficiency`: Loading percentage, usable carpet efficiency, effective rate per carpet sq.ft, ECI calculation.
* **Current system relationship:** Automated test harness in `frontend/__tests__`.
* **Depends On:** Phases 0, 1, 2.
* **Done When:**
  * `npm test -- day5Features.test.ts` executes and passes 100%.

#### Task 5.2 — Component Integration Tests
* **Action:** EXTEND `frontend/components/chat/MessageBubble.test.tsx` and `frontend/components/ComponentRenderer.test.tsx`
* **What to do:**
  * Assert `AffordabilityCard` slider interaction triggers state changes without errors.
  * Assert `ComponentRenderer` correctly renders `CarpetLoadingVisualizer`.
  * Assert `ProvenancePill` and `VerificationProofDrawer` render with correct accessible roles.
* **Current system relationship:** Frontend component test suite.
* **Depends On:** Phases 1, 2, 3.
* **Done When:**
  * All component unit and integration tests pass without warnings or errors.

#### Task 5.3 — Regression Verification
* **Action:** RUN `npm test` across `frontend` and `backend`
* **What to do:**
  * Verify `frontend/__tests__/streamReducer.test.ts` passes.
  * Verify `frontend/__tests__/FilterDock.test.ts` passes.
  * Verify `backend` test suite (`streamResilience.test.ts`, `webSourcing.test.ts`) remains green.
* **Current system relationship:** System-wide regression safety net.
* **Depends On:** All prior phases.
* **Done When:**
  * Zero failing tests across the workspace.

### Phase 5 Completion Gate
* [x] All new Day 5 unit and integration tests pass (`day5Features.test.ts`, `calculators.test.ts`, `carpetEfficiency.test.ts`, `typewriterBuffer.test.ts`).
* [x] Zero regressions in existing frontend/backend test suites (28/28 suites, 264/264 tests passing).
* [x] Clean TypeScript compile (`npm run typecheck`) with 0 errors.

---

## Cross-Phase Dependency Map

```
Phase 0 (Typewriter Buffer & Scroll Lock)
  │
  ├──→ Phase 1 (Interactive Affordability Cockpit)
  │
  ├──→ Phase 2 (Carpet Loading & Layout Visualizer)
  │
  ├──→ Phase 3 (Provenance Pills & Proof Drawer)
  │
  └──→ Phase 4 (Mobile Filter Dock & Shelf Polish)
        │
        └──→ Phase 5 (End-to-End Validation & Regression Suite)
```

*Note: Phases 1, 2, 3, and 4 are decoupled modular components and can be executed independently once Phase 0's core chat rendering loop is hardened.*

---

## Final Acceptance Criteria

### Functional
* **Typewriter Streaming:** Text streams smoothly with 15–25ms easing; scrolling up locks the viewport in place without downward jerking.
* **Financial Cockpit:** Sliders for down payment (10–50%) and tenure (10–30y) plus rate shock toggle update EMIs and tax savings in $<5\text{ms}$ with zero network calls.
* **Carpet Loading Visualizer:** Displays stacked proportional bars comparing usable carpet against common loading with effective carpet rates and ECI congestion rating.
* **Provenance Pills & Proof Drawer:** Clickable trust pills open official inspection proof drawers with certificate numbers, audit dates, and government portal links.
* **Mobile Action Dock:** Single-tap chip removal with exit animations and 1-tap comparison launch from mobile card shelf.

### Technical
* **Zero New Heavy Dependencies:** Built using existing React, Tailwind CSS, Framer Motion, and Phosphor icon primitives.
* **Accessibility (WCAG 2.1 AA):** All modals, drawers, and sliders support keyboard navigation, ARIA attributes, focus management, and $\ge 48\text{px}$ touch targets.
* **Performance:** 60fps animations, zero layout shifts, and client-side calculations executing in $<5\text{ms}$.
* **Test Coverage:** All unit, calculation, and component integration tests pass with zero regressions.

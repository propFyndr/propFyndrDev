# PropFyndr Master Execution Roadmap (Day-by-Day)

This document is the unified, day-by-day master execution plan for PropFyndr. It synchronizes all application layers—backend APIs, database models, AI pipelines, analytics services, role-native dashboards, frontend UI, and the hyper-local due-diligence data engine.

---

## High-Level Day Architecture

| Day | Focus Area | Core Objective | Key Deliverables |
|---|---|---|---|
| **Day 1** | **Go-Live, Auth & Security Hardening** | Unblock production deployment, eliminate credential sharing, fix invite link bugs, and secure sessions. | Git remote push, `FRONTEND_URL` fix, unique staff passwords, account lockout, role console smoke tests. |
| **Day 2** | **AI Latency, Cost Cut & Observability** | Slash repetitive system prompt costs by ~75% and establish end-to-end LLM & product telemetry. | Gemini Explicit Context Caching (`GEMINI_EXPLICIT_CACHE`), Langfuse trace matrix, prompt injection firewall, PostHog high-intent funnels. |
| **Day 3** | **Forensic Due-Diligence Data Engine** | Integrate the 8-dimension buyer intelligence stack into the database, project DNA, and AI advisor facts. | UP Lifts Act 2024 compliance, Shahdara drain $H_2S$ gas risk, Ganga Jal TDS vs borewell, True Landed Cost calculator (+28–35%), RERA escrow check. |
| **Day 4** | **Dashboards, Portals & Lead Usability** | Eliminate UI code duplication across admin consoles, finalize builder/partner portals, and perfect Lead Briefs. | Deduplicate remaining 6 admin pages with canonical `StatCard`, lead objection rollups, time-to-first-contact median tracking, sales lookup tool. |
| **Day 5** | **Frontend Anti-Slop, Mobile UX & SEO** | Elevate UI to institutional quality, optimize mobile buyer conversion, and lock down technical SEO. | Sticky mobile action bar, CTA loading/error states, dynamic OpenGraph per project/sector, custom 404 page, XML sitemap validation. |

---

## Day 1: Go-Live, Git Sync & Auth/Security Hardening

### Goal
Get the codebase deployed to production safely, fix critical onboarding email bugs, eliminate shared credentials, and lock down session security.

### Plain-English Summary (What We Are Doing Today & Why)

1. **Go-Live & Code Deployment**:
   Get the codebase pushed and deployed to production safely (to GitHub `propfyndrDev` and Render/Vercel) so that all live users and systems run our latest verified updates without breaking anything.
2. **Live Smoke Test Across All 5 Consoles**:
   Test a live email invitation sent to a real address via the Super Admin Team console and log in as each role to verify that every role sees only what they are allowed to see:
   * **SUPER ADMIN**: Full access to everything (audit logs, AI spend, team management, and email outbox).
   * **ANALYST**: Access to the project catalogue, builders, sectors, and data quality boards (no customer leads or deletions).
   * **SALES**: Access to lead call queue, callback requests, and read-only project lookup (no editing project records).
   * **BUILDER**: Access to the builder portal scoped strictly to developer's assigned projects and buyer Lead Briefs (no competitor data or chat transcripts).
   * **PARTNER**: Access to channel partner lead dispatch and site visit schedule.
3. **Fixing Broken Invitation Links**:
   Fix an email configuration bug where invitation emails were sending links pointing to "localhost:3000" (your personal computer) instead of our live website (`propfyndr.in`), making sure team members can actually click and activate their accounts.
4. **Unique Staff Passwords & Login Lockouts**:
   Stop all staff from sharing one single password. Give each role their own secure password, and lock an account for 15 minutes after 5 consecutive failed login attempts to prevent automated password guessing.
5. **Instant Device Logouts on Password Reset**:
   Ensure that when any staff member or portal user resets their password, all their previous active logins on any phone or computer are instantly terminated for safety.

---

### Technical Deep Dive & Execution Specs

#### 1. The Exact Bugs & Vulnerabilities Fixed
* **The `FRONTEND_URL` Invitation Link Bug**: In `backend/src/lib/teamInvite.ts`, invitation links are built using `process.env.FRONTEND_URL`. In local configuration, it defaults to `http://localhost:3000`. Deploying without setting this causes all Resend invitation emails to send broken `localhost` links.
* **Shared Staff Credential Risk**: Four staff accounts (`sales@propfyndr.in`, `channel.partner@propfyndr.in`, `analyst@propfyndr.in`, `admin@propfyndr.in`) share an identical legacy password, invalidating the audit log (`recordAudit`) because identity cannot be verified.
* **Session Invalidation on Password Change**: When an admin or portal user resets their password, existing active sessions remained alive across devices.
* **Failed Login Brute Force**: Absence of progressive account lockouts on consecutive failed authentication attempts.

#### 2. Step-by-Step Implementation

##### Step 1.1: Git Remote Reconciliation & Push
* Check remote status:
  ```bash
  git ls-remote --heads propfyndr
  ```
* Reconcile any commit divergence between local `main` and `https://github.com/propFyndr/propFyndrDev.git`.
* Push the verified working tree to the `propfyndr` remote.

##### Step 1.2: Production Environment Configuration
Configure the following in the production hosting dashboard (Render / Vercel):
* `FRONTEND_URL=https://app.propfyndr.in` (points invite links to the live domain).
* `RESEND_API_KEY`: Active production API key.
* `EMAIL_FROM=PropFyndr <noreply@propfyndr.in>`: Verified domain address.
* `GEMINI_LEG_MAX_DURATION_MS=45000`: Hard timeout preventing runaway AI queries.
* `FALLBACK_TURN_BUDGET_MS=30000`: Turn budget across provider fallbacks.
* Document these variables in `.env.example`.

##### Step 1.3: Credential Rotation & Session Revocation
* Mint unique, high-entropy passwords for each individual staff role.
* Update `backend/src/routes/adminAuth.ts` and `backend/src/routes/portal.ts`:
  * When a user changes or resets their password, immediately invoke `revokeAllSessions(userId)`.
  * Track `failed_login_attempts` and `locked_until` on `AdminUser`. Lock account for 15 minutes after 5 consecutive failed attempts.
  * Enforce `secure: true`, `httpOnly: true`, and `sameSite: 'lax'` on all authentication cookies.

##### Step 1.4: Live Smoke Test
* Send a live invitation to a real email address via the Super Admin Team console.
* Click the received link, verify the password-setup flow completes, and log in.
* Open 5 browser windows and authenticate as each role:
  1. `SUPER_ADMIN`: Access to audit logs, spend, team, and outbox.
  2. `ANALYST`: Access to project catalogue, builders, sectors, and data quality.
  3. `SALES`: Access to lead queue, callbacks, and read-only project lookup.
  4. `BUILDER`: Access to builder portal scoped to developer's assigned projects.
  5. `PARTNER`: Access to channel partner lead dispatch and site visit schedule.

#### 3. Verification & Pass Conditions
* [ ] Production `next build` and backend tests (2,748 tests) pass clean.
* [ ] Invitation email delivers a link containing the live domain, not `localhost:3000`.
* [ ] Attempting 5 invalid passwords locks the account and returns HTTP 423/401.
* [ ] Resetting password instantly terminates sessions on secondary devices.

---

## Day 2: AI Latency, Cost Cut & Full-Funnel Observability

### Goal
Reduce AI query costs by 75–80%, eliminate system prompt latency overhead, deploy prompt injection firewalls, and connect complete Langfuse + PostHog tracing.

### Plain-English Summary (What We Are Doing Today & Why)

1. **AI Memory Caching (75% Cost Reduction)**:
   Instead of uploading a huge 40-page instruction manual to Google Gemini every single time a user sends a message, we store it in the AI's temporary memory cache. This slashes our AI bill by ~75% and shaves 1–2 seconds of waiting time off every chat reply.
2. **AI Firewall & Prompt Injection Defense**:
   Add a smart guard at the front door that catches and blocks trick prompts (like users telling the AI to "ignore all rules" or leak backend instructions) before they can hit the expensive AI model.
3. **Usage Caps & Fair Use Limits**:
   Set a reasonable limit for anonymous website visitors (e.g., 25 messages every 10 minutes) so malicious scripts or bots cannot spam the AI and run up thousands of dollars in surprise bills.
4. **End-to-End AI Flight Recorder (Langfuse)**:
   Connect Langfuse to monitor every question, which AI provider answered it, how many tokens it burned, how fast it answered, and whether any error occurred during the conversation.
5. **High-Intent Customer Tracking (PostHog)**:
   Track the critical moments when a buyer is genuinely interested in buying—like calculating an all-inclusive cost sheet, saving a home, requesting a phone call, or booking an in-person site visit—so we can measure conversion rates accurately.

---

### Technical Deep Dive & Execution Specs

#### 1. The Exact Bugs & Bottlenecks Fixed
* **The 13.6k Token Repetitive Input Tax**: Every chat turn sends `SYSTEM_PROMPT_BOUNDARY` (~13,600 static tokens) over the wire. Across multi-turn conversations and 4 fallback legs, this costs $5.47 per 1,000 queries and adds 600–1,200 ms of latency per turn. Gemini Explicit Context Caching was designed in `backend/src/lib/ai/geminiCache.ts` behind `GEMINI_EXPLICIT_CACHE`, but was left disabled.
* **Unbounded Prompt Injection & Rate Overruns**: Attackers could exhaust AI API budgets by submitting repetitive or adversarial instructions (`"ignore previous system prompt"`).
* **Disconnected Observability**: Langfuse was imported in `chat-router.ts` and `fallbackChain.ts`, but tool executions, fallback provider switches, and token costs were not tagged with `chat_session_id`, `guest_token`, and user intent categories.

#### 2. Step-by-Step Implementation

##### Step 2.1: Enable Gemini Explicit Context Caching
* In `backend/.env` (and production config), set:
  ```env
  GEMINI_EXPLICIT_CACHE=true
  ```
* Verify `backend/src/lib/ai/geminiCache.ts`:
  * Ensure the static 13.6k token prompt head and tool declarations are cached under Gemini's CachedContents API with a 1-hour rolling TTL.
  * Ensure the dynamic per-turn tail (`systemTail`) is injected as a leading user turn in `contents` without invalidating the cache.
* Run the cache verification script:
  ```bash
  npx ts-node backend/scripts/audit-gemini-cache.ts
  ```
* Run the 60-query chat corpus benchmark (`npm run test:corpus`):
  * Pass rate must remain at **100%**.
  * Input tokens billed must drop by **>70%**.
  * Latency p99 must remain under **15 seconds**.

##### Step 2.2: Instrument Langfuse Traces & Fallback Matrix
* In `backend/src/lib/ai/fallbackChain.ts`, wrap each model execution leg in a Langfuse span:
  * Span Name: `llm_call:[provider]:[model]`
  * Record input tokens, completion tokens, latency, and cache hit status.
  * Tag with `chat_session_id`, `guest_token`, and `focus_project_id`.
* Log tool execution metrics:
  * Tool name, arguments, execution duration, and whether the tool result answered the buyer's query.
* Add graceful flush in `backend/src/index.ts` during server shutdown:
  ```typescript
  await flushLangfuse()
  ```

##### Step 2.3: Prompt Injection Firewall & Usage Caps
* In `backend/src/routes/chat-router.ts`, add an upfront heuristic scanner before calling any AI provider:
  * Detect and block prompt extraction attempts, jailbreaks, and system instructions override.
  * Log blocked attempts to `audit_logs` and return a standard advisory refusal message.
* Implement a sliding-window rate limiter on chat turns:
  * Limit anonymous guest tokens to 25 turns per 10-minute window.
  * Return HTTP 429 with polite retry headers when exceeded.

##### Step 2.4: PostHog High-Intent Event Instrumentation
* In `frontend/lib/posthogClient.ts`, implement typed tracking for high-intent conversion milestones:
  * `property_saved`
  * `cost_sheet_calculated`
  * `builder_trust_viewed`
  * `callback_requested`
  * `site_visit_booked`
  * `whatsapp_handoff_clicked`
* Wire these events into `frontend/components/CallbackModal.tsx`, project detail actions, and cost calculators.
* Add server-side event tracking in `backend/src/routes/leads.ts` with `posthog-node`.
* Ensure test runs (`NODE_ENV === 'test'`) never emit telemetry to PostHog.

#### 3. Verification & Pass Conditions
* [ ] `audit-gemini-cache.ts` confirms cache hits on subsequent turns.
* [ ] 60-query corpus run achieves 100% pass rate at < $1.50 / 1k queries.
* [ ] Langfuse dashboard displays hierarchical traces showing provider, latency, and tokens.
* [ ] PostHog live stream logs `callback_requested` and `site_visit_booked` events.

---

## Day 3: Forensic Due-Diligence Data Engine & Project DNA Expansion

### Goal
Differentiate PropFyndr from listing portals by structuring and exposing forensic ground-level buyer intelligence across Noida, Greater Noida, and Yamuna Expressway.

### Plain-English Summary (What We Are Doing Today & Why)

1. **The True Cost Calculator (Base Price vs Real Price)**:
   Builders advertise an attractive base rate (like ₹1 Crore), but the real out-of-pocket cost is 28% to 35% higher after factoring in power meters, club fees, GST, and stamp duty. We build an honest breakdown so buyers see the exact final price upfront.
2. **Registry & Legal Safety Verification (Amitabh Kant Policy)**:
   Give buyers clarity on whether the developer cleared the 25% land dues under the Amitabh Kant committee policy so flat registrations can happen, whether the project holds a full or partial Occupancy Certificate (OC), and which top banks (SBI, HDFC) have approved home loans.
3. **Lift Safety & Basement Health Checks**:
   Check if the society's lifts are legally registered under the new UP Lifts Act 2024 (with mandatory emergency rescue devices and annual maintenance contracts) and track basement health (checking for water seepage and sump pump issues).
4. **Water Source & Air Quality Realities**:
   Tell buyers the real ground truth about daily living in that sector: whether tap water is sweet municipal Ganga Jal (low TDS) or harsh borewell groundwater, and whether the area suffers from Shahdara drain odor and air conditioner coil corrosion.
5. **Zero-Guessing AI Rule**:
   If we have officially verified a project's legal papers or water source, the AI states it confidently. If we don't have the official record, the AI openly admits it rather than guessing or making up numbers.

---

### Technical Deep Dive & Execution Specs

#### 1. The Strategic Opportunity & Data Deficiencies Solved
Buyers on Reddit, IREF, and local forums actively search for forensic project details that portals conceal:
* **Legal & Registry Safety**: Has the builder cleared the 25% land dues under the Amitabh Kant Committee policy so sub-lease registries can proceed? Is the Occupancy Certificate (OC) full or phased (specific towers only)? Does the project have a tier-1 Bank APF code (SBI / HDFC) or only NBFC financing?
* **The True Cost Stack**: Advertised Base Selling Price (BSP) vs True All-In Landed Cost (+28–35% increase from EEC, FFC, dual prepaid meter charges ₹35k–85k, IFMS escrow ₹50–150/sqft, PLC, and floor rise).
* **Structural & Livability Realities**: Is the society lift registered on `updeslift.org` under the UP Lifts and Escalators Act 2024 (OEM AMC, ARD rescue device)? Does the sector suffer from Shahdara Drain $H_2S$ sewer gas and AC coil corrosion (Sectors 74–79, 137)? What is the real water source: 100% municipal Ganga Jal (TDS 150–300) or deep borewell (TDS > 2,000 ppm)?

#### 2. Step-by-Step Implementation

##### Step 3.1: Schema Extension for Forensic Due Diligence
Extend `Project` and `ProjectDna` in `backend/prisma/schema.prisma`:
```prisma
enum OcStatus {
  FULL_OC
  PHASED_OC
  APPLIED
  NONE
}

enum WaterSourceType {
  GANGA_JAL
  BOREWELL
  MIXED
}

enum PowerSupplyType {
  PVVNL_MULTIPOINT
  SINGLE_POINT_BULK
}

// Added to model Project:
oc_status               OcStatus          @default(NONE)
oc_details              String?           // e.g. "Towers A, B, C covered; Towers D & E under construction"
amitabh_kant_clearance  Boolean           @default(false)
bank_apf_codes          Json?             // ["SBI-APF-10492", "HDFC-APF-8831"]
water_source_type       WaterSourceType   @default(MIXED)
water_tds_range         String?           // e.g. "150-300 ppm" or "> 2000 ppm"
shahdara_drain_impact   Boolean           @default(false)
lift_act_compliant      Boolean           @default(false) // Registered on updeslift.org with OEM AMC & ARD
power_supply_type       PowerSupplyType   @default(SINGLE_POINT_BULK)
all_in_cost_multiplier  Float?            // e.g. 1.31 (+31% above BSP)
```
* Run `npx prisma db push` or create a migration.
* Update `backend/src/lib/projectExposure.ts` to add these fields to `PROJECT_PUBLIC_SELECT`.
* Run `backend/src/lib/__tests__/projectExposure.test.ts` to verify no unclassified fields leak.

##### Step 3.2: Master Data Ingestion & Ground Truth Sync
* Update `scripts/enrich_393_ground_truth.cjs` and the JSON files in `newProj/75/*.json` to populate these values for Noida / Greater Noida projects.
* Run data verification script:
  ```bash
  node scripts/verify_393_enrichment.cjs
  ```

##### Step 3.3: Advisor Fact Presentation & Tools
* In `backend/src/lib/factPresentation.ts`, classify due-diligence attributes under the `verified` tier.
* Create a dedicated AI retrieval tool in `backend/src/routes/chat-router.ts`:
  * `getProjectDueDiligence(projectId)`
  * When a buyer asks: *"Are there registry issues in [Project]?"* or *"What is the real cost beyond BSP?"*, the tool retrieves verified numbers.
  * If a field is missing, the AI strictly states: *"We do not have the verified OC docket for this project yet, so we will not guess."* (Zero fabrication policy).
* Add automated test cases in `backend/src/routes/__tests__/noFabrication.test.ts`.

##### Step 3.4: True Cost Calculator Component
* Update `frontend/components/property-detail/CostSheetTab.tsx`:
  * Render an interactive breakdown comparing Base Price vs True Landed Cost.
  * Display statutory UP stamp duty (7%), registration (1%), GST (0% on ready, 5% on under-construction), EEC/FFC, IFMS, and prepaid dual-meter charges.

##### Step 3.5: Dynamic JIT Prompt Modularization & Universal Project Intelligence
* **The 9,890-Token Diet & Multi-Model Adaptability**:
  * Decouple the monolithic prompt into **Immutable Cached Rules (~750 tokens)** + **JIT Scoped Context (~400–600 tokens)** + **Sliding 4-Message Window with Intent Snapshot (~300 tokens)**.
  * Enforce strict $\le 1,800$ token ceiling per turn to unlock zero-delay responses on any model (Gemini Paid primary, Groq / DeepSeek / Cerebras fallback) with zero HTTP 413 "Request too large" rejections.
* **Universal Project Handling (Inside DB vs Outside DB)**:
  * **Projects in Database (620+ Noida / GN / Yamuna)**: Direct routing to deterministic Postgres handlers (<50ms, 0 hallucination) for Cost Sheets, Water Reality, UP Lifts Act 2024, Amitabh Kant 25% dues, and Shahdara drain corridor buffer.
  * **Projects Outside Database (Global / New Launches)**: Thread the buyer's *actual question* into `runGroundedAnswer` (`${userMessage} — ${projectName} real estate`) for targeted live web grounding. Synthesize on-point answers with transparent provenance badges (`🌐 Live public records — pending on-ground inspection`) and advisory audit chips.
* **Multi-Turn Entity Continuity**:
  * Preserve single `projectNames` and `targetProjectId` in `mergeIntent` and `ATTRIBUTE_FOLLOWUP` on advisory and feature follow-ups ("are there any hidden charges for it?", "what water source is it using?").

#### 3. Verification & Pass Conditions
* [ ] `projectExposure.test.ts` passes with 100% field classification coverage.
* [ ] Asking the AI about lift safety or Ganga Jal water source in Sector 137 cites verified project fields.
* [ ] Asking about an unverified project produces a transparent refusal to guess rather than a hallucinated number.
* [ ] Cost sheet component calculates accurate all-inclusive landed costs matching UP statutory schedules.
* [ ] `estimateTokens(systemPrompt)` is $\le 1,800$ tokens across single-project, sector, and discovery queries; Groq runs with 0 HTTP 413 errors.
* [ ] Multi-turn flow preserves project context across 3+ consecutive follow-ups (`costSheet` → `hiddenCharges` → `waterSource`).
* [ ] Out-of-DB queries synthesize specific answers from live web grounding matching the buyer's exact question rather than generic stubs.

---

## Day 4: Role Dashboards, Portals & Lead Usability

### Goal
Unify the admin UI architecture, clean up role permissions, finalize builder/partner portals, and turn raw buyer leads into actionable, high-converting Lead Briefs.

### Plain-English Summary (What We Are Doing Today & Why)

1. **Clean & Unified Dashboard Cards**:
   Clean up duplicated code across 6 admin screens and switch them all to our standardized card component that loads cleanly with placeholder skeletons and never breaks popup modals.
2. **Role-Aware Navigation (No Dead Buttons)**:
   Make sure staff members only see buttons they are allowed to click (for example, removing disabled "Edit Project" buttons from sales reps who only need to view project details).
3. **Builder Objection Intelligence (Why Buyers Hesitate)**:
   Give builders a smart summary of why buyers are hesitating on their projects (e.g., *"34% of buyers hesitating due to late 2028 possession"*), showing real buyer feedback with competitor names completely scrubbed.
4. **Buyer Lead Briefs (Zero Chat Leaks)**:
   When sending a customer lead to a developer or partner, provide a neat, structured 1-page summary of the buyer's budget, timeline, and preferred layout—while keeping their private chat transcripts 100% private.
5. **Sales Speed Tracking (Time to First Call)**:
   Measure how many minutes it takes our sales team to place their first phone call to a newly registered buyer, because calling within minutes multiplies conversion rates.

---

### Technical Deep Dive & Execution Specs

#### 1. The Exact Bugs & Deficiencies Fixed
* **Admin Tile Duplication & JSX Corruption Risk (Phase 12.6 residue)**: Six admin pages still hand-roll stat cards with duplicate markup. An earlier automated codemod had to be reverted on `/admin/leads` because a regex ate into the lead-detail modal.
* **Unauthorized Actions Visible to Staff Roles**: The navigation and table views showed buttons that the server refused with 403 (e.g., `SALES` seeing edit buttons on projects and builders).
* **Unstructured Lead Objections**: Buyers repeatedly hesitated over possession timelines or pricing, but builders could only see individual lead notes rather than an aggregated objection breakdown.
* **Unmeasured Sales Velocity**: Absence of response time tracking for sales follow-ups.

#### 2. Step-by-Step Implementation

##### Step 4.1: Canonical StatCard Migration Across All Admin Pages
* Manually migrate the remaining 6 admin pages to use canonical shared primitives:
  * `frontend/app/admin/leads/page.tsx`
  * `frontend/app/admin/conversations/page.tsx`
  * `frontend/app/admin/analytics/page.tsx`
  * `frontend/app/admin/builders/page.tsx`
  * `frontend/app/admin/promotions/page.tsx`
  * `frontend/app/admin/blog/page.tsx`
* Replace hand-rolled tiles with `<StatCard label="..." value={...} icon={<Icon />} hint="..." loading={isLoading} />`.
* Preserve all modals and sub-components safely without regex breakage.

##### Step 4.2: Role-Aware Navigation Filtering
* Update `frontend/components/admin/AdminNav.tsx`:
  * `SALES`: Navigates to Leads, Call Queue (`/admin/queue`), and read-only Catalogue Lookup (`/admin/lookup`). Edit buttons hidden.
  * `ANALYST`: Navigates to Projects, Builders, Sectors, and Data Quality (`/admin/quality`). Lead queues hidden.
  * `SUPER_ADMIN`: Full navigation including Team, Audit Logs, AI Spend, and Outbox.

##### Step 4.3: Builder Objection Intelligence & Lead Briefs
* In `backend/src/routes/portal.ts`, verify `GET /portal/builder/objections`:
  * Aggregates `LeadObjection` by category and project.
  * Surfaces the executive summary: *"Possession timeline is the most common objection, representing 34% of buyer hesitations."*
  * Renders verbatim buyer objection quotes with competitor names scrubbed.
* In `frontend/app/builder/portal/leads/page.tsx`, render the Lead Brief preview:
  * Buyer budget, timeline, required configuration, and primary objection.
  * Strictly ensure zero raw chat transcripts reach the builder.

##### Step 4.4: Sales Velocity: Median Time-to-First-Contact
* In `backend/src/routes/leads.ts`:
  * When a lead status transitions out of `new`, stamp `first_contacted_at` using `updateMany` with `{ first_contacted_at: null }` in the WHERE clause (written once, never overwritten).
* On the Sales Queue dashboard (`/admin/queue`), render the rolling 30-day **median** response time tile. Display `"Not measured yet"` if fewer than 5 leads have been contacted.

#### 3. Verification & Pass Conditions
* [ ] All admin pages render consistent stat cards with working skeleton loaders.
* [ ] A `SALES` session cannot see or click project edit buttons.
* [ ] A `BUILDER` session opens `/portal/leads` and sees Lead Briefs with competitor names scrubbed.
* [ ] Sales queue displays a median response time computed from `first_contacted_at`.

---

## Day 5: Frontend Anti-Slop Audit, Mobile UX & Production Hardening

### Goal
Eliminate generic UI patterns (anti-slop audit), polish mobile interactions for on-the-go buyers, and complete technical SEO and metadata requirements.

### Plain-English Summary (What We Are Doing Today & Why)

1. **Anti-Slop Design Polish**:
   Remove generic, cheap-looking AI design tropes (ugly harsh gradients, emoji overload, fake testimonials, generic pastel colors) and make the app look and feel like an elite, trustworthy financial advisory tool.
2. **Sticky Mobile Action Bar**:
   When prospective buyers view a project on their phones, pin a clean action bar to the bottom of the screen with one-tap buttons to "Ask AI Advisor" or "Book Site Visit", so they don't have to scroll up and down to take action.
3. **Smart Phone Validation & Loading Spinners**:
   Make sure callback forms instantly check for a valid 10-digit Indian mobile number and show a clean loading spinner when clicked, so buyers know their request was received.
4. **Social Sharing Preview Cards (OpenGraph)**:
   When someone shares a project link on WhatsApp, iMessage, or Twitter, display a rich card showing the project photo, verified RERA badge, and verified starting price.
5. **Helpful Branded 404 Error Page**:
   If a user clicks an expired or broken link, show a clean, helpful 404 page that points them directly back to active sectors and projects instead of a generic browser error.

---

### Technical Deep Dive & Execution Specs

#### 1. The Exact Deficiencies Fixed (from `slop.md` & `baseline-ui`)
* **Generic UI Patterns to Avoid**: Hash gradients, fake testimonials, unbranded pastel colors, missing skeleton loaders, and non-functional form buttons.
* **Mobile Interaction Gaps**: Lack of a sticky bottom action bar on mobile screens, making high-intent actions (calling, booking a visit) difficult to reach while reading long property pages.
* **Missing Error Boundaries & Feedback States**: Form buttons without loading spinners and missing inline validation error states.
* **SEO & Social Share Deficiencies**: Missing dynamic OpenGraph share images, missing per-page meta descriptions, unverified sitemap XML.

#### 2. Step-by-Step Implementation

##### Step 5.1: Sticky Mobile Action Bar
* Create `frontend/components/property-detail/StickyMobileCta.tsx`:
  * Fixed to the bottom on screens `< 768px` (`sticky bottom-0 z-40`).
  * Displays two primary actions:
    1. *"Ask Advisor"* (opens the AI chat pre-focused on this project).
    2. *"Book Site Visit / Callback"* (triggers `CallbackModal`).
  * Features a touch-friendly 48px tap target with safe-area inset padding for iOS devices.

##### Step 5.2: Form Loading & Error State Hardening
* Audit `frontend/components/CallbackModal.tsx` and lead-capture inputs:
  * Disable submit button and render an inline loading spinner while the request is in flight.
  * Validate Indian phone numbers (`+91` followed by 10 digits) with real-time error feedback before dispatching.
  * Render clear error notices if rate limits (HTTP 429) or network errors occur.
  * Display a clear, reassuring confirmation state upon success.

##### Step 5.3: Dynamic SEO Metadata & OpenGraph Images
* In `frontend/app/projects/[slug]/page.tsx`:
  * Implement `generateMetadata()`:
    * `title`: `"[Project Name], [Sector], [City] — Verified Review & Due Diligence | PropFyndr"`
    * `description`: Dynamically generated summary with carpet area, possession date, RERA number, and starting price.
    * `openGraph`: Dynamic social preview card showing verified project badges.
* In `frontend/app/sectors/[slug]/page.tsx`:
  * Implement dynamic metadata for micro-market sector landing pages.
* Verify `frontend/app/sitemap.ts`:
  * Fetches `GET /api/v1/sitemap`.
  * Generates valid `<urlset>` with accurate `<lastmod>` timestamps from the database.

##### Step 5.4: Custom Branded 404 & Error Boundaries
* Create `frontend/app/not-found.tsx`:
  * Clean, on-brand 404 page featuring a search bar to find properties in Noida, Greater Noida, and Yamuna Expressway.
* Add global error boundaries (`frontend/app/error.tsx`) to catch unexpected rendering issues gracefully without showing blank pages.

#### 3. Verification & Pass Conditions
* [ ] Mobile viewport test (DevTools 375px) shows sticky bottom CTA bar without layout thrashing.
* [ ] Callback form displays button loading spinner during submission and shows inline validation on invalid phone numbers.
* [ ] Sharing a project link on WhatsApp / Twitter displays a rich OpenGraph preview card with verified project data.
* [ ] Accessing a non-existent URL renders the custom branded 404 page with navigation links back to active sectors.

---

## Daily Verification & Quality Gates

Run these checks at the end of each day to guarantee zero regressions:

```bash
# 1. Backend typecheck & unit test suite
cd backend && npm run build && npm test

# 2. Frontend typecheck & production build
cd ../frontend && npm run typecheck && npm run build

# 3. Query count & database performance checks
cd ../backend && npx ts-node src/routes/__tests__/queryCeilings.test.ts

# 4. Zero fabrication AI check
npx ts-node src/routes/__tests__/noFabrication.test.ts
```

---

## Strategic Summary: The PropFyndr Competitive Moat

1. **Objective Private Advisory vs Broker Portals**: We never sell buyer phone numbers to cold-calling brokers. The AI remains an uncompromised, objective consultant.
2. **The Lead Brief (Monetization Engine)**: Builders pay for verified high-intent buyer briefs with known objections. They never see raw conversation transcripts, protecting buyer trust.
3. **Forensic Data Moat**: Traditional portals provide marketing brochures; PropFyndr answers with lift safety registrations, Amitabh Kant dues clearance, true landed cost multipliers, and water TDS realities.
4. **Subdomain Addressing, Server Authorization**: External builder and partner portals are strictly isolated and authorized on the server, guaranteeing zero privilege escalation.

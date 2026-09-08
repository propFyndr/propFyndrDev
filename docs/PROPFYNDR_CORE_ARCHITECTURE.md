# PropFyndr — Core Architecture & Model Context Guide

> **Audience**: Engineering team, AI/ML engineers, prompt designers, and model context injectors.  
> **Purpose**: Definitive operational guide explaining how the PropFyndr platform, database, data pipelines, retrieval engine, and AI orchestrator work together.

---

## 1. Executive Overview

**PropFyndr** is an intelligence-first real estate discovery and advisory platform focused on the **Delhi-NCR corridor (Noida, Greater Noida, Greater Noida West, and Yamuna Expressway)**.

Unlike generic real estate portals that rely on marketing brochures, PropFyndr operates under a strict principle:
> **"Verified DB facts only. Never guess, never hallucinate numbers, and never invent inventory or schedules."**

If a financial number, possession schedule, or specification is not verified in the database, the system explicitly communicates this boundary to the user rather than allowing an LLM to generate plausible-sounding guesses.

---

## 2. High-Level Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                 Frontend: Next.js (React / TS)              │
│       Dynamic UI Chips, SSE Chat Stream, Interactive Cards  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP / SSE / WebSocket
┌──────────────────────────────▼──────────────────────────────┐
│             Backend Service: Express + TypeScript           │
│  ├─ Semantic Cache (L1 Memory + L2 Upstash Redis)           │
│  ├─ Query Classifier & Intent Extractor (Hybrid Regex + LLM)│
│  ├─ Specialized Deterministic Topic Handlers                │
│  ├─ Project Data Gateway (Fact Validation & Scoring)        │
│  └─ AI Provider Fallback Chain (Gemini → Mistral → Groq)    │
└──────────────┬───────────────────────────────┬──────────────┘
               │ Prisma ORM                    │ External APIs
┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
│  Supabase PostgreSQL DB     │ │ Google Maps / Places API    │
│  (Relational + Indexes)     │ │ Tavily / Web Search         │
└─────────────────────────────┘ └─────────────────────────────┘
```

* **Frontend**: Next.js (App Router), TailwindCSS / Vanilla CSS styling, Server-Sent Events (SSE) streaming listener.
* **Backend Runtime**: Node.js + Express + TypeScript (`backend/src`).
* **Database**: PostgreSQL hosted on **Supabase** via **Prisma ORM** (PgBouncer connection pooling on port 6543, direct migration on 5432).
* **Caching & Rate Limiting**: **Upstash Redis** (REST-based API) + local in-memory LRU cache.
* **AI Fallback Chain**: Tier-1 Gemini (with key rotation) $\rightarrow$ Mistral $\rightarrow$ Cerebras $\rightarrow$ Groq $\rightarrow$ OpenAI $\rightarrow$ Cohere.
* **Observability**: **Langfuse** (LLM traces/spans), **PostHog** (product analytics), **Sentry** (error logging).

---

## 3. Data Storage & Schema Architecture

Data in PropFyndr does **not** rely on unstructured vector embeddings for core factual retrieval. It is deeply structured across a normalized relational schema.

### Core Relational Entities

1. **`Builder` (`builders` table)**:
   * Identity: Name, slug, founder, year founded, headquarters, website, CIN, RERA promoter ID.
   * Track Record: Delivery score, construction quality score, buyer satisfaction score, RERA compliance score, delivered projects count, ongoing projects, average delay in months.
   * Financial & Legal: Outstanding dues, bank funding partners, insolvency flag, litigation log.

2. **`Project` (`projects` table)**:
   * Identity: Name, slug (unique identifier), RERA number & registration link, city, sector, address, lat/lng coordinates.
   * Land & Density: Total acreage (`land_area_acres`), total towers, total units, floors, open space percentage (`open_space_pct`), green rating (e.g. IGBC Gold).
   * Status & Possession: `ready_to_move` | `under_construction` | `new_launch`, possession date, Occupancy Certificate (`oc_obtained: true/false`), possession confidence.
   * Pricing Anchors: `price_min_cr`, `price_range_label`, PLC/club inclusion flags.
   * Civic & Living Standards: Water source (WTP / Ganga Jal), DG backup power cost/unit, monthly maintenance cost PSF, ceiling height, lifts per tower, shared walls configuration, pet policy, bachelor tenant policy, land tenure (99-yr leasehold).

3. **`ProjectDna` (`project_dna` table)**:
   * 0–100 benchmark scores across 6 core pillars: `overall_score`, `builder_score`, `price_score`, `location_score`, `legal_score`, `amenity_score`, `possession_score`.

4. **`DecisionProfile` (`decision_profiles` table)**:
   * Investment and advisory thesis: `decision_thesis`, `why_buy[]`, `why_avoid[]`, `best_for`, `not_ideal_for`.
   * Domain intelligence: `financial_intelligence`, `market_intelligence`, `builder_intelligence`, `property_intelligence`.

5. **`PersonaProfile` (`persona_profiles` table)**:
   * Target audience segmentation: `primary_persona` (e.g., Corporate Managers & IT Executives), `secondary_personas[]`, target income range, family life stage, commute corridors, investment timeline.

6. **Financial & Configuration Child Tables**:
   * **`UnitType`**: Exact configurations per project (`bhk`, `name`, `super_area_sqft`, `carpet_area_sqft`, `efficiency_rating`, `price_min_cr`, `price_max_cr`, `views[]`).
   * **`CostSheet`**: Base price per sq.ft, floor rise, parking cost, club membership, IFMS, electricity & water connection fees, GST percentage, stamp duty & registration rates.
   * **`PaymentPlan`**: Construction-Linked Plans (CLP), Possession-Linked Plans (PLP), Down Payment Plans, containing milestone breakdown JSON arrays.
   * **`PriceHistory`**: Quarterly historical price points (PSF and Cr) tracking appreciation catalysts from Q1 2021 to 2026.
   * **`ProjectSpecItem`**: Structural (Mivan RCC), flooring, sanitaryware, and electrical specs categorized by brand and tier (`luxury`, `premium`, `standard`).
   * **`Amenity` & `Connectivity`**: Categorized amenities (sports, wellness, clubhouse) and transit distances to expressways, metro stations, airports, and IT hubs.

### Source Files on Disk vs Live Database

* **`Projects/{City}/{Sector}/{ProjectName}.md`**: Markdown research dossiers kept on disk in the repo. These are offline human/analyst research files. They are **not** queried directly at runtime.
* **`newProj/75/*.json`**: Master JSON regional files used as structured seed source for batch ingestion.
* **Live Database**: The definitive operational source of truth. All chat, API, and discovery endpoints query Supabase PostgreSQL.

---

## 4. Query Retrieval Lifecycle & Core Engine

When a user submits a prompt (e.g., *"Show me payment plans for Cleo County"* or *"Best 3 BHK in Sector 150 under 3 Cr"*):

```
User Query: "Payment plans for Cleo County"
               │
               ▼
[Step 1: Cache & Rate Limit]
   ├─ Redis rate check (IP / Session)
   └─ L1/L2 Semantic Cache check: getCachedResponse(query, scope)
               │ (Miss)
               ▼
[Step 2: Topic Flagging & Intent Classification]
   ├─ topicFlags.ts: isPaymentPlanRequest(query) ──► TRUE
   └─ extractIntent(): Extracts { projectNames: ["Cleo County"], topic: "payment_plan" }
               │
               ▼
[Step 3: Route Selection in chat-router.ts]
   ├─ CHAT_TOPIC_HANDLERS evaluates matches(ctx)
   └─ Handled by paymentPlansHandler (Specialized Deterministic Handler)
               │
               ▼
[Step 4: SQL Entity Resolution via Prisma ORM]
   ├─ resolveProject("Cleo County") / catalog match
   ├─ Finds ABA Cleo County (ID: aba-cleo-county-sector-121)
   └─ SQL: SELECT * FROM projects JOIN payment_plans WHERE id = ...
               │
               ▼
[Step 5: Deterministic Formatting (Bypasses LLM)]
   ├─ If plans exist: renderPaymentPlanTable(paymentPlans, project)
   │  Renders pre-computed Markdown table
   ├─ If plans missing: unverified('developer payment schedule', project.name)
   └─ Emits interactive action chips (e.g., "Connect with Advisor", "Calculate EMI")
               │
               ▼
[Step 6: Streaming Output]
   └─ Server-Sent Events (SSE) stream back tokens & UI state to frontend
```

### Key Retrieval Rules

1. **Deterministic Handlers**:
   Specialized intents—including `payment-plans`, `cost-sheet`, `total-outflow`, and `citywide-overview`—are handled by dedicated deterministic modules. They pull relational rows via Prisma and generate factual responses directly in code. The LLM is **bypassed** for raw numbers to guarantee 0% hallucination on financial terms.
2. **Project Data Gateway (`projectDataGateway.ts`)**:
   When general or comparative questions require an LLM, the model does not access the database directly. It receives validated facts from `ProjectDataGateway`, where every fact is scored with a confidence rating (1.0 for verified DB rows, 0.92 for Google Maps, 0.65 for estimates).
3. **No Vector Search for Core Facts**:
   Search relies on relational SQL queries, case-insensitive substring matching (`ILIKE` / `contains`), multi-word token matching, and structured filters (e.g. `sector`, `bhk`, `budget_min`, `budget_max`).
4. **Entity Resolution (Ad-Hoc at Runtime)**:
   There is no separate `ProjectAlias` or synonym table in the schema. Name matching resolves at query time by matching against `slug`, exact `name`, case-insensitive substrings, and multi-word token intersection.

---

## 5. Anti-Hallucination & Verification Framework

PropFyndr uses strict guardrails to prevent AI models from inventing data:

* **The Grounding Check (`groundingCheck.ts`)**:
  Responses produced by external LLMs are checked against DB-known facts before reaching the client. Any factual claims made without backing data are flagged or stripped.
* **The Missing Fact Boundary (`unverified(...)`)**:
  If a user asks for data that does not exist in the database (for example, maintenance charges or payment milestone percentages for a project that hasn't published them), the system outputs:
  ```
  "Verified data for [field] at [Project] is currently pending official verification. 
   Here is what is standard for this corridor..."
  ```
  It will never fabricate a plausible percentage.
* **Deterministic Calculators (`calculators.ts`)**:
  All financial math (loan EMI, UP stamp duty at 7%, registration at 1%, GST calculations) is computed via deterministic TypeScript functions—never by LLM arithmetic.

---

## 6. AI Fallback Chain & Resilience

To maintain 100% uptime and avoid vendor rate limits, all AI completions run through a tiered fallback chain (`fallbackChain.ts`):

1. **Tier 1: Google Gemini**: Primary engine using `gemini-2.5-flash` / `gemini-1.5-pro` with 3 API key rotations (`GEMINI_API_KEY`, `GEMINI_API_KEY1`, `GEMINI_API_KEY2`).
2. **Tier 2: Mistral AI**: Secondary failover (`mistral-large-latest` / `mistral-small-latest`) with 2 key rotations.
3. **Tier 3: Groq / Cerebras**: Ultra-low latency Llama-3 inference models for quick classification and streaming fallback.
4. **Tier 4: OpenAI**: `gpt-4o` / `gpt-4o-mini` as final high-conviction backup.
5. **Tier 5: Cohere**: Emergency fallback if daily LLM budgets are exceeded.

---

## 7. Important Architectural Nuances for Models & Developers

When developing features, prompt chains, or agent workflows for this codebase, keep these constraints in mind:

1. **No Township Hierarchy in Schema**:
   The `projects` table has no self-referencing `parent_id` or `township_id`. Large townships with multiple phases or sub-projects (e.g. `ATS Pristine` vs `ATS Pristine & Golf Meadows`, or `Jaypee Greens Wish Town` sub-communities) exist as distinct standalone rows in the database, each with its own RERA number.
2. **Dynamic UI Chips (`chipInventory.ts` & `chipDedup.ts`)**:
   Every response message returned to the user is paired with dynamic UI chips (interactive buttons) indicating next logical actions (e.g., *"Calculate Monthly EMI"*, *"Compare with Sector 150 average"*, *"View Cost Sheet"*). The AI context should provide suggestions compatible with these interactive payloads.
3. **Local Pilot Geographic Scope**:
   The active knowledge and catalog base is specifically configured for:
   * **Noida** (Sectors 1 to 168)
   * **Greater Noida West** (Noida Extension)
   * **Greater Noida** (Alpha, Beta, Gamma, Chi, Zeta, Pari Chowk)
   * **Yamuna Expressway** (Sectors 17A, 19, 22D, 25, etc.)
   Queries regarding other cities trigger graceful boundary redirects to this pilot region.
4. **Prose Entity Linking**:
   Project names returned in text strings are automatically converted into clickable markdown links (`[Project Name](#entity:project-id)`) using `proseEntities.ts`. Model prompts should use verified canonical project names so they link properly in the UI.

---

## 8. Directory & File Reference

| File / Directory Path | Role |
| :--- | :--- |
| `backend/prisma/schema.prisma` | Complete relational database schema (Prisma definition). |
| `backend/src/routes/chat-router.ts` | Main chat route, request parsing, and topic handler dispatch. |
| `backend/src/lib/projectDataGateway.ts`| Single source of truth for validated project data queries. |
| `backend/src/lib/chat/handlers/` | Deterministic handlers (`paymentPlans.ts`, `costSheet.ts`, `citywideQuery.ts`). |
| `backend/src/lib/chat/topicFlags.ts` | Regex & heuristic topic detection for incoming user messages. |
| `backend/src/lib/ai/fallbackChain.ts` | Multi-provider AI orchestration & failover engine. |
| `backend/src/lib/ai/semanticCache.ts` | Redis & memory semantic response caching. |
| `backend/src/lib/discovery/locationResolver.ts` | Geographic resolver mapping user phrases to verified sectors. |
| `newProj/75/` | Local master JSON files by sector. |
| `Projects/` | Static markdown research dossiers for local sectors and builders. |

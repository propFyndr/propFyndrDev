# CLAUDE.md

## Core AI Developer Guardrails (Karpathy's Rules)
1. **Ask, don't assume.** If something is unclear, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements.
2. **Simplest solution first.** Implement the simplest thing that could work. No abstractions or flexibility that weren't requested.
3. **Don't touch unrelated code.** If a file or function is not part of the current task, do not modify it.
4. **Flag uncertainty explicitly.** If you are not confident about an approach or a technical detail, say so before proceeding.

## Communication Preferences & Behaviors
* **No filler.** Never open with "Great question!", "Certainly!" or similar. Start with the answer.
* **Match complexity.** Simple questions get short answers; complex tasks get full ones. No restating the question, no closing recap.
* **Show approaches first.** Before any significant task, show 2–3 approaches and wait for an explicit choice.
* **Scope.** Only modify files, functions and lines directly related to the task. Anything worth fixing elsewhere goes in a note at the end.
* **Destructive changes.** Before rewriting sections or changing a flow, describe exactly what will change and why, and wait for confirmation.
* **Deletion gates.** Before deleting a file, overwriting code, dropping records or removing a dependency: list what is affected and get an explicit "yes" in the current message.
* **Irreversible side effects** need in-session confirmation, no exceptions: deploys, migrations, schema changes, bulk data writes, external or paid API calls, pushes.
* **Task wrap-up.** End every coding task with: Files changed / What was modified (one line each) / Files intentionally not touched / Follow-up needed.
* **External actions.** Never send, post, publish, share or schedule anything without explicit confirmation in the current message.
* **Complex problems.** For architecture, hard debugging or non-trivial features: reason step by step, name the uncertainty, then implement.

## Memory and Persistence
* **MEMORY.md** (repo root): record significant decisions as What was decided / Why / What was rejected and why. Read it at session start. Never contradict a logged decision without flagging it.
* **Session summaries:** on "session end" or "wrapping up", append Worked on / Completed / In progress / Decisions made / Next session priorities.
* **ERRORS.md:** when an approach takes more than 2 attempts, log what failed, what worked, and a note for next time. Check it before suggesting a similar approach.
* **Extended thinking** for architecture, performance trade-offs, database design and long-term decisions.

---

# PropFyndr

**A chat-first real estate advisor for Indian home buyers, built on supply that the people who sell it have verified.**

## Purpose of This File
The working memory of the product. Read it the way a senior engineer reads a design doc before touching a critical system: to understand *why* things are the way they are, not only what is allowed. Consult it before implementing features, changing schemas, generating UI, creating APIs or writing prompts.

**If anything here is stale or contradicts the live code, say so before proceeding, then fix the doc.** A CLAUDE.md nobody trusts is worse than none.

---

## The Problem

Buying a new home in India today means:
* **Dozens of PDFs.** Brochures, price lists, cost sheets, payment plans, RERA filings, allotment letters, each in a different format, often contradicting each other.
* **Dozens of platforms.** Listing portals, builder sites, RERA portals, YouTube walkthroughs, Reddit threads, WhatsApp forwards, broker calls.
* **No one on the buyer's side.** Portals sell leads. Brokers earn on the sale. Builders market. Nobody's job is to tell the buyer the trade-off.
* **Listings that aren't real.** Stale prices, sold-out units still advertised, fake listings used as lead bait.

The research effort is weeks; the confidence at the end is low.

## What PropFyndr Is

1. **An advisor, not a listings site.** The buyer says what they want ("3BHK near a metro under 1.5 Cr, possession within a year"). The advisor answers with a short list, the reason for each, and the honest trade-off. The property database exists to support the advisor; **the advisor is the product.**
2. **Verified supply, not scraped supply.** Listings come from partners — builders, channel partners, broker houses — and **go live only after the builder's team approves them**. No hoax listings, no stale inventory presented as live.
3. **A better lead, not a phone number.** A portal hands a builder a name and a number. We hand them a **Lead Brief**: what this buyer wants, can spend, needs by when, and what is stopping them from buying this project — without ever handing over the conversation itself (see § Who Sees What).

## Who We Serve — Three Sides

| Side | Who | What they get | What they give |
|---|---|---|---|
| Demand | Home buyers (guest or signed-in) | Answers, shortlists, comparisons, true cost, a shareable dossier, a human when needed | Their requirements, and — when ready — a callback or site-visit request |
| Supply | Builders, channel partners, broker houses | Qualified leads with a Lead Brief, objection insight, a portal to work leads | Accurate, current project data, approved by the builder |
| Us | Founders, analysts, sales | Catalogue control, lead queue, quality and cost telemetry | Neutrality, verification, the advisor itself |

---

## Product Philosophy
Every feature must support at least one:
1. Reduce buyer research effort
2. Improve buyer confidence
3. Surface trade-offs honestly
4. Help buyers decide faster
5. Generate qualified leads for verified supply

If it improves none of these, it is not built.

## Core Principles

### Conversation First
Buyers describe needs in their own words, in English, Hindi or Hinglish. The advisor parses intent; it does not force a filter form.

### Trust First
Trust matters more than conversion. The advisor shows negatives, explains trade-offs, admits uncertainty, and never exaggerates. Never hide a property's weakness.

Bad: "This is a perfect property."
Good: "This fits your budget and is 10 minutes from Sector 62 metro, but possession is expected in 18 months."

### Neutral, Always
A partner paying us never buys rank. Promotion decides what a buyer is *invited to ask about*; it never touches what the advisor *recommends*.

---

## The Verified Supply Chain — how a listing goes live

This is the core supply-side promise. **Status (2026-10-05): not built.** Today every catalogue write is a direct edit by our own team in `/admin` (`routes/admin.ts`: `POST /projects`, `PATCH /projects/:id`, units, cost sheets, payment plans, price history). Builders and partners have read-only project access in `/portal`. Until the chain below exists, do not market "builder-verified" to buyers.

**Target flow:**
```
Partner / broker submits a change ─▶ PENDING_BUILDER ─▶ builder team approves ─▶ PENDING_PROPFYNDR ─▶ we publish ─▶ LIVE
                                         │ rejects ─▶ REJECTED (reason)              │ rejects ─▶ REJECTED
Builder submits its own change ──────────────────────────────────────────────────▶ PENDING_PROPFYNDR
```

**Rules for whoever builds it:**
* **A submission is a proposed diff, never a write.** Store field-level changes (`entity`, `entity_id`, `field`, `old_value`, `new_value`, `submitted_by`, `source_document`) in a submissions table. The live `Project`/`UnitType`/`PaymentPlan`/`CostSheet` rows change only on final approval, in one transaction, with an `AuditLog` row.
* **Scope comes from the session, server-side.** A partner can submit only for projects linked to them via `ProjectChannelPartner`; a builder can approve only its own `builder_id`. Never trust an id in the body.
* **Price and inventory carry a freshness date.** Every price or availability change records `verified_at` and who verified it. The advisor states the date ("price as confirmed by the builder on 2 Oct") and treats anything older than the freshness window (proposed: 30 days for price, 7 for inventory) as *stale* — stated with its date, never as current.
* **"Builder-verified" is a new fact tier label, not a synonym for `verified`.** It means "the seller attested this", which is not the same as "we inspected it". Never imply site inspection.
* **Conflicts surface, never silently resolve.** If a submission contradicts a RERA filing we hold, the approver sees both.
* **Approvals are logged per field**, so "who said this price?" always has an answer.

Why this order (partner → builder → us): the builder is the only party that knows the true price and inventory; we are the only party that can check it against RERA and keep the advisor neutral. Skipping either step reintroduces hoax listings.

---

## V1 MVP — the Hero Product

Status is against live code as of 2026-10-05 (audits in MEMORY.md and `MASTER_EXECUTION_ROADMAP_V2.md`). "Live" means wired into the real request path, not "a file exists".

### Buyer side
| Feature | Status | Notes |
|---|---|---|
| Conversational discovery (budget, sector, BHK, possession, metro) | Live | Deterministic intent covers most turns; LLM intent as fallback |
| One-line multi-fact parsing, correction without restart | Partial | `RequirementState` (BACKTRACK, trade-offs) computed but not used live |
| Project Q&A from our rows (amenities, payment plans, possession, RERA, builder) | Live | Deterministic fact bypass + topic handlers |
| Honest recommendation: reason + trade-off per pick | Live | See § Recommendation Framework |
| Comparison (2–4 projects) | Partial | Frontend re-derives rows; some inputs were templated |
| True cost: stamp duty, registration, GST (statutory) | Live | UP statutory constants in one place |
| EMI / affordability with sliders, rate shock | Live | Rate and tax regime shown as assumptions |
| Carpet vs super area visualizer | Live (2026-10-05) | Only with both areas measured |
| RERA provenance pill + record drawer | Live (2026-10-05) | Only for RERA numbers we hold |
| Shareable buyer dossier | Live | Anonymous; `dossiers` table; `dossier_shared` event |
| Save, callback, site visit — as a guest | Live | Guest token is an identity |
| Out-of-catalogue project answer with public-record badge | Partial | One path still prompt-only |
| Hindi / Hinglish understanding | Partial | Normalizer exists, not run before intent |
| Session memory ("what have I told you?") | Partial | Rate lost between EMI turns |
| Price freshness ("confirmed on …") | Not built | Depends on the verified supply chain |

### Supply side
| Feature | Status |
|---|---|
| Builder / partner portal, role-scoped | Live |
| Lead Brief (no transcript, competitors scrubbed) | Live |
| Lead objections (abstract competitor pressure) | Live |
| Partner approval by PropFyndr; builder proposes partner logins | Live |
| Lead assignment to partners, site-visit status updates | Live |
| **Partner submits listing → builder approves → live** | **Not built** |
| Inventory updates by builder (units available / booked) | Not built (table `UnitInventory` exists, no write path) |
| Brief delivered on WhatsApp / email at lead time | Not built (notifications are queued, never sent, until a provider exists) |

### Us
| Feature | Status |
|---|---|
| Admin catalogue, leads queue, role matrix, read audit | Live |
| Cost metering (`AiUsageEvent`), daily budget caps | Live |
| Corpus / red-team evaluation against the real router | Partial — runners exercise paths the live router doesn't use; port to `src/lib/eval/route-replay.json` |

### What V1 must reach before we call it launched
1. **No invented figure reaches a buyer.** The open debts are listed in § Data Integrity Debts; each is a launch blocker.
2. **The verified supply chain exists for price and inventory** (the two facts buyers act on).
3. **Rate limits key on the real buyer, not a proxy IP** (§ Infrastructure).
4. **A live corpus run** on the billed provider with a committed scorecard — not a copied one.

---

## Chat Experience: Meeting the ChatGPT Power-User

Target buyers already live inside ChatGPT/Claude. If the chat feels dumber than their default assistant, trust dies in the first message. Design to that bar.

1. **No form-filling disguised as chat.** "3BHK, Sector 150, under 1.5 Cr, possession within a year" is four facts; parse all four.
2. **Memory within a session, referenced naturally.** Reuse a budget stated three messages ago and say so ("still within your 1.5 Cr"). `focus_project_id` and the `summary_*` fields exist for this — use them.
3. **Correction without restart.** "Actually make that 2 crore" silently revises intent and re-runs.
4. **Meta-awareness.** "What are you assuming about me?" is answered honestly from `IntentState`.
5. **Any DB-backed fact, answered directly.** "I don't have that" only when literally true, never as a stand-in for "not wired up".
6. **Reasoning shown, not asserted.** Every recommendation carries a reason and a trade-off.
7. **Proactive.** End with the next useful question.
8. **Escalation is a favour, not a funnel.** When the advisor can't go further (site visit, live negotiation), say so and offer a human.
9. **Tone: capable peer, not sales rep.** No exclamation marks, no "Great choice!".

When scoping a chat feature, ask: *would a power user notice we're worse at this than their default assistant?* If yes, that gap comes first.

---

## V1 Scope

**Supported:** Noida and Greater Noida West; new launch, under construction and ready to move; recommendations; comparison; builder track record; EMI, stamp duty, GST, registration; callbacks; site visits; WhatsApp handoff; partner/builder lead portal.

**Out of scope:** rentals, resale, commercial, valuation, mortgage workflows, tenant/landlord tools, auctions, native apps, VR/AR, investment advice, broker CRM beyond lead handling. Other cities are not recommended as available inventory.

---

## Answering With Data We Hold — the Fact Tiers

Every fact shown to a buyer belongs to exactly one tier. Reference `lib/factPresentation.ts`.

| Tier | Means | How it may be stated |
|---|---|---|
| `verified` | Read from **this project's** own rows | Plainly |
| `statutory` | Fixed by UP law, identical for every project (stamp duty, registration, GST) | Plainly |
| `market` | Genuinely Noida-wide, **not** verified for this project | Only with `MARKET_QUALIFIER`, every time |
| `missing` | We do not hold it | Say so and offer the advisory handoff. Never substitute a typical value |

(When the supply chain ships, `builder-attested` joins as a label on `verified` facts, always with its date.)

**Rules:**
* A project-specific fact has no market tier.
* No hardcoded figures in routers or components. If a constant is a market assumption (an interest rate, a tax slab), it is labelled as one where the buyer sees it.
* `verified` and `confidence: 'HIGH'` are reserved for answers from the project's own rows.
* An absent field is absent. No UI default (`superArea = 1000`), no `?? 1.30`, no `|| 8.5` reaching a buyer unlabelled.
* A **schema default is not data.** Columns whose value is identical on every row (`SCHEMA_DEFAULT_SENTINELS` in `projectExposure.ts`) are treated as missing.
* A **templated value is not data.** If the same value appears on many projects because a script wrote it, it is cleared (`npm run fix:templated`), not labelled.

**Enforcement:** `dueDiligenceFabrication.test.ts`, `lib/ai/__tests__/answerIntegrity.test.ts`; `answerIntegrity.ts` runs before the buyer sees any answer.

### Data Integrity Debts (launch blockers, 2026-10-05)
* **Due-diligence columns on 129 projects were heuristic, not sourced** (`scripts/enrich-129-incomplete.ts`: `lift_act_compliant: true` everywhere, Ganga Jal TDS ranges, `all_in_cost_multiplier: 1.30`). Must be nulled (backup first) and re-sourced.
* **Property-page cost sheet** (`CostSheetSection.tsx`) hardcodes PLC, parking, club, IFMS, legal charges and falls back to invented areas/prices. Must read the `CostSheet` table.
* **Affordability handler** invents a ₹1.5 Cr benchmark when no price is known; assumes 20% down / 8.5% / 30% slab.
* **JEV branches** (upgrade equity, yield) carry assumed rates without `MARKET_QUALIFIER`.
* **Comparison** shows lift-registry status from the heuristic data and reports HIGH confidence on estimates.
* **Price firewall** whitelists any number anywhere in a ~33k-char prompt; percentages are not checked.
* `dueDiligenceFabrication.test.ts` passes vacuously when nothing is found — fix the test before trusting the gate.

---

## Field Exposure — Adding a Column is a Disclosure Decision

`lib/projectExposure.ts` is policy for `Project` data leaving the server.
* `Project` relations to other users' rows (`saved_by`, `chat_sessions`, `property_feedback`) are in `FORBIDDEN_RELATIONS` and never selected into a prompt or response.
* Internal columns (`embedding`, `ai_search_keywords`, `builder_theme`) and analyst-only fields never reach a buyer.
* `DecisionProfile` / `RecommendationProfile` carry `IntelligenceStatus`; only `PUBLISHED` is buyer-facing.
* `ProjectDna` scores stay internal.

**Adding a column to `schema.prisma` does not expose it.** It is absent from `PROJECT_PUBLIC_SELECT` until classified, and `projectExposure.test.ts` fails on anything unclassified.

## Who Sees What — the Role Matrix

`AdminRole` in `schema.prisma`; enforced in `lib/adminPolicy.ts` (paths), `lib/adminFieldRedaction.ts` (columns), `lib/adminReadAudit.ts` (who read a person's data).

| Audience | Roles | Surface |
|---|---|---|
| Us | `SUPER_ADMIN`, `ANALYST`, `SALES` | `/admin` |
| Supply | `BUILDER`, `PARTNER` | `/portal`, tenant subdomains |
| Demand | Supabase users + guest tokens | the main app |

**ANALYST is ours, not a builder's** — the catalogue role. The builder-side equivalent is `BUILDER`.

**Non-negotiable:**
* **A builder never receives a chat transcript.** The conversation contains this buyer comparing this builder against competitors and our advisor naming this builder's trade-offs. Builders and partners receive a **Lead Brief** (`lib/leadBrief.ts`): one project, competitor names scrubbed, every field read from a stored column. Competitor *pressure* may be stated abstractly; competitor *identity* never.
* **A promoted project is never ranked higher.** The news rail (`routes/promotionals.ts`, `components/NewsRail.tsx`) decides what a buyer is invited to ask about, never what is recommended.
* **A tenant subdomain is addressing, never authorisation.** Scope comes from the session, server-side, on every request.
* **Only PropFyndr mints identities.** A builder may propose a partner login; our approval creates it.
* **Invitees set their own password.** We never issue one.
* **A partner never approves its own submission**, and a builder never approves another builder's project.

## The Lead Brief — why builders pay us

What a portal gives: name, phone, project. What we give, all from stored columns:
* Requirement: configuration, budget band, timeline, sectors considered
* Readiness: saved, compared, dossier generated, site visit requested
* Objections in the buyer's own framing (`LeadObjection`): possession risk, price, builder history — competitors abstracted
* Questions already answered, so the caller doesn't repeat them
* Best time / channel to call, if the buyer gave one

Never in a brief: the transcript, competitor names, other buyers' data, anything inferred rather than stored.

---

## AI Assistant Rules
Must: be honest; explain recommendations and trade-offs; show RERA information; remember context; handle follow-ups; escalate when needed.
Must never: invent data; guess unavailable information; use fake confidence scores; claim certainty when uncertain; recommend unsupported cities as inventory; present builder-attested data as independently inspected.

## Recommendation Framework
Rank by: 1. Budget fit 2. Location fit 3. Possession timeline fit 4. Builder track record 5. Stated preferences 6. Nearby infrastructure.

Every recommendation includes: property name, reason, primary trade-off.
```
Reason: Matches your budget and is 10 minutes from Sector 62 metro.
Trade-off: Possession expected in 2027.
```
Rows retrieved above a stated budget (up to 10%) go in an "Above the Stated Budget — NOT MATCHES" block; zero tolerance when the buyer says the ceiling is hard. An honest "no match" plus a choice of what to relax beats a padded list.

---

## Signup Rules

**A guest token is an identity.** Every lead-generating action accepts one, and the row records which guest it came from. Nothing that produces a lead sits behind account creation.

Anonymous with a guest token: chat, search, browse, compare, calculators, save, callback, site visit, dossier.
Signup required for: builder phone access.

**A guest still owes us:** a phone number on a lead; rate limiting by guest token then IP. If a row can be created without naming who created it, that is a bug.

## Lead Qualification
High-intent events (track all): save property; callback request; site visit request; builder contact access; dossier generated (`dossiers` row) and shared (`dossier_shared`).

---

## Infrastructure, Cost & Latency

**Provider chain** (`lib/config.ts`, `lib/ai/fallbackChain.ts`): free Gemini Flash Lite keys → billed Gemini → Cohere → Groq → NVIDIA → Cloudflare. Cash spend is near zero because the billed key is depleted; the real cost is **quality** — turns land on weaker free models. Topping up the billed key is the single largest quality lever.

**Budgets:** `GEMINI_DAILY_BUDGET_USD` (default $10, `geminiMeter.ts`), per-user $0.50/day (`cost.ts`). Prompt head ~7.7k tokens; average input ~13k per turn.

**Cost rules for new work:**
* Deterministic first. A fact we hold is answered from rows, with 0 LLM tokens.
* The prompt head must stay byte-identical across lanes (`promptPrefixStability.test.ts`); variable content goes after it, so provider prefix caching works.
* Send only the fields the question needs (field diet, `fieldDietProjection`).
* Never regenerate a whole answer blind on an integrity failure; state the violation to the retry.
* Every external paid call (Maps, Tavily/Serper, embeddings) is cached and rate-limited.

**Rate limiting** (`lib/cache.ts`, `index.ts`, `routes/admin.ts`, `chat-router.ts`): limits key on guest token → auth → client IP. **The client IP must be the buyer's, not the proxy's** — `lib/request.ts` trusts `CF-Connecting-IP`, which behind the Vercel rewrite is Vercel's egress IP. Resolve before launch (see MEMORY.md 2026-10-05).

**Health:** `/api/v1/health` touches DB and Redis; keep-alive pings should hit a cheap endpoint.

---

## Definition of Done

A roadmap gate is ticked only when:
1. The code is **called on the live request path** (show the caller), not just present.
2. A test exists that **would fail** if the behaviour broke — no `if (res.found)` guards that pass vacuously, no hardcoded "≥75%" banners.
3. No figure it shows a buyer is invented, defaulted or unlabelled.
4. Any measured target (latency, cost, pass rate) has a committed measurement from a real run.
5. MEMORY.md has the entry.

A ticked gate without these is worse than an unticked one: the next session trusts it.

---

## Realistic Limits — what we cannot promise
* **We do not inspect sites.** Verified means "from records we hold"; builder-attested means "the seller said so". Neither is a site audit.
* **Live price and inventory are only as fresh as the partner keeps them.** Show the date; never imply real-time.
* **We cannot negotiate or guarantee a price.** That is the human handoff.
* **Tax and loan figures are illustrative.** Slab, regime and bank rate are the buyer's; we state our assumptions.
* **Legal status** (title, litigation) is what public records and filings show, not legal advice.
* **Coverage is Noida/GNW.** Outside it, the advisor says so.

## What Drives Adoption
* **Buyers** come back if the first answer is faster and more honest than an evening of PDFs — and if the dossier is good enough to send to family.
* **Builders** pay if a PropFyndr lead converts better than a portal lead. Measure it: brief opened → contacted → site visit → booking, per source.
* **Partners** submit data if approval is fast and their leads are attributed to them.
* **Trust compounds, one invented number destroys it.** That is why § Data Integrity Debts are launch blockers, not polish.

---

## Code Organization
* Don't redesign visual components, inputs or chat styling unless asked. Keep the discovery brand atmosphere (lavender hue background, Afacad wordmark).
* No unrequested features, no unrelated refactors, no new dependencies without justification.
* Routing is a gate cascade in `routes/chat-router.ts` (~7k lines): a failing query class is usually a routing bug, not a prompt bug.
* No hardcoded answer branches for a named project or sector; resolve from the DB.
* Frontend tests: `npx jest` (not vitest). Backend: `npx tsx --test <file>`; `npm test`.

## Golden Rule
When uncertain, choose the option that improves trust, improves decision quality, and reduces buyer effort — not the one that generates more clicks. The goal is not more listings viewed. The goal is a buyer who confidently buys a home.

---

## Reference
MEMORY.md (repo root) for dated decisions and audits. Memory notes: ai-provider-chain, admin-panel-reference, engineering-standards, project-structure, database-rules, ai-prompting-rules, success-metrics, roadmap-future. Roadmaps: `MASTER_EXECUTION_ROADMAP.md` (V1), `MASTER_EXECUTION_ROADMAP_V2.md`.

**Last Updated:** 2026-10-05 — full rewrite: verified supply chain, three-sided product, V1 MVP status, data-integrity debts, definition of done.

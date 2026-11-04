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
* **MEMORY.md** (repo root): standing decisions by topic, as What was decided / Why / What was rejected. Read it at session start. Never contradict a logged decision without flagging it. When a decision is replaced, edit its line; do not append a diary.
* **Session summaries:** on "session end" or "wrapping up", append Worked on / Completed / In progress / Decisions made / Next session priorities.
* **ERRORS.md:** when an approach takes more than 2 attempts, log what failed, what worked, and a note for next time. Check it before suggesting a similar approach.
* **Extended thinking** for architecture, performance trade-offs, database design and long-term decisions.
* **Archives:** earlier versions of this file and MEMORY.md are in `docs/archive/` (`CLAUDE_2026-11-03.md`, `MEMORY_2026-11-03.md`, `MEMORY_full_2026-10-27.md`).

---

# RealtyAsk

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

## What RealtyAsk Is

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

This is the core supply-side promise. **Status (2026-11-03): one leg built, on dev only.**

* **Built (dev, 2026-10-29):** a builder proposes a price or a sold-out change per flat type in `/builder/portal/prices`; our admin approves it in `/admin/listing-changes`. Proposals sit in `listing_changes`; approval (`lib/listingChanges.ts`) writes the flat type, a `price_history` row, builder-attested `FactVerification` rows, an `AuditLog` row and the recomputed project price, in one transaction. Sold-out flat types are hidden from every read by `lib/excludeSoldOutUnitTypes.ts`. The migration `builder_listing_changes` is applied on dev; live needs it and an explicit OK.
* **Not built:** partner submissions (`pending_builder`), builder approval of a partner's change, inventory per unit, and all other fields. Every other catalogue write is still a direct edit by our team in `/admin` (`routes/admin.ts`). Until the full chain exists, do not market "builder-verified" to buyers.

**Target flow:**
```
Partner / broker submits a change ─▶ PENDING_BUILDER ─▶ builder team approves ─▶ PENDING_REALTYASK ─▶ we publish ─▶ LIVE
                                         │ rejects ─▶ REJECTED (reason)              │ rejects ─▶ REJECTED
Builder submits its own change ──────────────────────────────────────────────────▶ PENDING_REALTYASK
```

**Rules for whoever extends it:**
* **A submission is a proposed diff, never a write.** Field-level changes (`entity`, `entity_id`, `field`, `old_value`, `new_value`, `submitted_by`, `source_document`). Live rows change only on final approval, in one transaction, with an `AuditLog` row. If the row changed after the proposal, approval is refused and both values are shown.
* **Scope comes from the session, server-side.** A partner can submit only for projects linked via `ProjectChannelPartner`; a builder can approve only its own `builder_id`. Never trust an id in the body.
* **Price and inventory carry a freshness date** through `FactVerification` (tier, date, who). The advisor states the date ("price as confirmed by the builder on 2 Oct") and treats anything older than the window (30 days for price, 7 for inventory) as *stale* — stated with its date, never as current.
* **"Builder-attested" is a label on `verified`, not a synonym for it.** It means "the seller said so", not "we inspected it". Never imply site inspection.
* **Conflicts surface, never silently resolve.** If a submission contradicts a RERA filing we hold, the approver sees both.
* **Approvals are logged per field**, so "who said this price?" always has an answer.

Why this order (partner → builder → us): the builder is the only party that knows the true price and inventory; we are the only party that can check it against RERA and keep the advisor neutral. Skipping either step reintroduces hoax listings.

---

## V1 MVP — the Hero Product

Status against live code as of 2026-11-03. `origin/main` and `origin/dev` are the same commit (`3e6003a2`), so "Live" means wired into the request path on both. Dated decisions behind each row are in MEMORY.md.

### Buyer side
| Feature | Status | Notes |
|---|---|---|
| Conversational discovery (budget, sector, BHK, possession, metro) | Live | Deterministic intent covers most turns; LLM intent as fallback. A run of sector numbers is a list, not an ambiguity |
| One-line multi-fact parsing, correction without restart | Partial | Bare refinements ("1 cr", "what about Sector 150?") re-run the search in code (`isBareRefinement`). `RequirementState` (BACKTRACK, trade-offs) still not used live |
| Project Q&A from our rows (amenities, payment plans, possession, RERA, builder, cost sheet) | Live | Deterministic fact bypass + topic handlers; row choice by `pickProjectRow.ts` (stated sector beats exact name) |
| Honest recommendation: reason + trade-off per pick | Live | See § Recommendation Framework |
| "X or Y" choice (e.g. ready 2BHK vs under-construction 3BHK) | Live | `handlers/alternativesChoice.ts`: both sides from rows, no ranking |
| Comparison (2–4 projects, two sectors) | Partial | Prompts forbid a winner and investment framing; model still adds reasons the table doesn't support |
| "What could go wrong" / "is X safe" | Partial (dev data only) | `riskRecord()` in `handlers/projectCatch.ts`: six lines (registration, complaints, delays, OC, court cases, abeyance), each from a record or "Not on record", in chat and on the project page (`RiskRecordBox`). Two named projects get two records, no winner. 127 complaint and 2 order drafts pending on dev, none approved; none on live. Abeyance: UP-RERA's list errored on 4 Nov |
| True cost: stamp duty, registration, GST (statutory) | Live | `UP_STATUTORY`, one place |
| EMI / affordability with sliders, rate shock | Live | Rate and tax regime shown as assumptions |
| Quoted per-sq-ft rate vs our rows | Live | `handlers/sectorRateCheck.ts`: range, median, count, no "fair" verdict |
| Carpet vs super area visualizer | Live | Only with both areas measured |
| RERA provenance pill + record drawer | Live | Only for RERA numbers we hold |
| Shareable buyer dossier | Live | Anonymous; `dossiers` table; `dossier_shared` event |
| Save, callback, site visit — as a guest | Live | Guest token is an identity |
| Out-of-catalogue project answer with public-record badge | Partial | One path still prompt-only |
| Off-topic and other-city asks | Live | `handlers/offTopic.ts`: one code-built line and a property question, no model call |
| Hindi / Hinglish | Partial | Understanding works; most code-built lanes reply in English (H2–H5, FH1–FH3 of hard-43). Not this cycle |
| Session memory ("what have I told you?") | Partial | Rate lost between EMI turns |
| Answers when every AI provider fails | Live | Project-fact lanes answer from rows (`lib/chat/rowsAnswer.ts`), marked `degraded`; open questions get the outage notice |
| Price freshness ("confirmed on …") | Partial | Works for builder-approved prices (dev only); nothing else carries a date yet |

### Supply side
| Feature | Status |
|---|---|
| Builder / partner portal, role-scoped | Live |
| Lead Brief (no transcript, competitors scrubbed) | Live |
| Lead objections (abstract competitor pressure) | Partial: brief and report are wired, but nothing writes `LeadObjection`, so they are always empty |
| Partner approval by RealtyAsk; builder proposes partner logins | Live |
| Lead assignment to partners, site-visit status updates | Live |
| Builder proposes price / sold-out → we approve | Dev only (migration not on live) |
| Partner submits listing → builder approves → live | Not built |
| Inventory updates by unit | Not built (`UnitInventory` exists, no write path, no project has unit rows) |
| Brief delivered on WhatsApp / email at lead time | Not built (link-only email behind `BUILDER_LEAD_EMAILS=on`; notifications queued, never sent) |

### Us
| Feature | Status |
|---|---|
| Admin catalogue, leads queue, role matrix, read audit | Live |
| Real-people counts and team marking (`realPeopleSessions`, `team_identities`) | Live |
| Cost metering (`AiUsageEvent`), daily budget caps | Live |
| Data-integrity pipeline (UP-RERA crawl, portal research → `project_field_drafts`) | Live as scripts; promotion is a person's call |
| Route replay (225 cases), 60-question corpus, hard-43 benchmark | Live on dev; last full results 225/225 and 60/60 (31 Oct) |
| Release check before push | Live (`scripts/release-check.cjs` via `.githooks/pre-push`) |

### What V1 must reach before we call it launched
1. **No invented figure reaches a buyer.** The open debts are listed in § Data Integrity Debts; each is a launch blocker.
2. **The verified supply chain exists for price and inventory** (the two facts buyers act on), on live.
3. **Rate limits key on the real buyer, not a proxy IP** (§ Infrastructure).
4. **A live corpus run** on the billed provider with a committed scorecard — not a copied one.
5. **Sign-in works on live** and is checked automatically (it failed on 29 Oct when Supabase's egress allowance ran out).

---

## Chat Experience: Meeting the ChatGPT Power-User

Target buyers already live inside ChatGPT/Claude. If the chat feels dumber than their default assistant, trust dies in the first message. Design to that bar.

1. **No form-filling disguised as chat.** "3BHK, Sector 150, under 1.5 Cr, possession within a year" is four facts; parse all four.
2. **Memory within a session, referenced naturally.** Reuse a budget stated three messages ago and say so ("still within your 1.5 Cr"). `focus_project_id` and the `summary_*` fields exist for this — use them.
3. **Correction without restart.** "Actually make that 2 crore" silently revises intent and re-runs.
4. **Meta-awareness.** "What are you assuming about me?" is answered honestly from `IntentState`.
5. **Any DB-backed fact, answered directly.** "I don't have that" only when literally true, never as a stand-in for "not wired up".
6. **Reasoning shown, not asserted.** Every recommendation carries a reason and a trade-off.
7. **Proactive.** End with one next useful question (`oneQuestion()` enforces one).
8. **Escalation is a favour, not a funnel.** When the advisor can't go further (site visit, live negotiation), say so and offer a human.
9. **Tone: capable peer, not sales rep.** No exclamation marks, no "Great choice!", no "objectively".
10. **Fast first word.** A status line shows within a second (`lib/chat/statusLine.ts`); the target for the first answer word is 3 s. Measured median is ~10 s on the free chain (31 Oct).
11. **Sources shown.** A finished answer carries a "What I checked" line in our tier words (`lib/chat/checkedLine.ts`), built in code from what the answer says, never by the model, never naming a portal.

When scoping a chat feature, ask: *would a power user notice we're worse at this than their default assistant?* If yes, that gap comes first.

---

## V1 Scope

**Supported:** Noida and Greater Noida West; new launch, under construction and ready to move; recommendations; comparison; builder track record; EMI, stamp duty, GST, registration; callbacks; site visits; WhatsApp handoff; partner/builder lead portal.

**Out of scope:** rentals, resale *listings* and resale price opinions, commercial, valuation, mortgage workflows, tenant/landlord tools, auctions, native apps, VR/AR, investment advice and appreciation forecasts, broker CRM beyond lead handling. Other cities are not recommended as available inventory.

**In scope for a resale flat the buyer has already found:** the document and dues checklist, and arithmetic on the buyer's own numbers (stamp duty, registration, renovation, total). `lib/chat/handlers/resaleDeal.ts`. It never states whether a resale price is fair, because we hold no resale transaction prices. "Show me resale flats" still gets the scope reply.

---

## Answering With Data We Hold — the Fact Tiers

Every fact shown to a buyer belongs to exactly one tier. Reference `lib/factPresentation.ts`.

| Tier | Means | How it may be stated |
|---|---|---|
| `verified` | Read from **this project's** own rows | Plainly |
| `statutory` | Fixed by UP law, identical for every project (stamp duty 7%, 6% for a woman primary owner; registration 1%; GST 5% under construction, 0% ready with OC) | Plainly |
| `market` | Genuinely Noida-wide, **not** verified for this project | Only with `MARKET_QUALIFIER`, every time |
| `computed` | Arithmetic over our own rows (average, median, count) — `lib/chat/aggregateQuery.ts` | Only with `computedQualifier(n)`: states how many projects it rests on; estimated prices excluded |
| `public_record` | Read from an official source for a project or fact (UP-RERA, `*.gov.in`, `*.nic.in`) | With source and read date (`publicRecordQualifier`); never `verified`, never feeds ranking |
| `missing` | We do not hold it | Say so and offer the advisory handoff. Never substitute a typical value |

(`builder-attested` is a label on `verified` facts, always with its date.)

**Rules:**
* A project-specific fact has no market tier.
* No hardcoded figures in routers, components or prompts. If a constant is a market assumption (an interest rate, a tax slab), it is labelled as one where the buyer sees it. Prompts carry no remembered corridor prices, yields, densities or growth rates.
* `verified` and `confidence: 'HIGH'` are reserved for answers from the project's own rows.
* An absent field is absent. No UI default, no `?? 1.30`, no `|| 8.5` reaching a buyer unlabelled.
* **A rule the model keeps breaking becomes code.** Verdict words ("objectively", "unblemished", "clean legal standing", "zero-delay", "risk-free", "superior choice", "capital deployment") are dropped by `dropUnsourcedJudgements` unless our facts carry them (`falseReassurance.test.ts`). Prompt-only rules did not hold on 31 Oct.
* **Owner policy (2026-10-27): every project fact we hold is answered from the database as stored, whoever wrote it, with no template or "may be a template" caveat.**
  * **Covered:** amenities; cost-sheet charges and payment plans; schema-default values (`SCHEMA_DEFAULT_SENTINELS` is empty); the formerly templated columns that still exist (`approvals_status`, `proximity_to_industrial`, `shared_walls_type`, `occupancy_restriction_months`, `nri_approval_months`, `expected_handover_quarter`); analyst scores (`BUYER_OPAQUE_SCORES` is empty); stored forward-looking figures (`rental_yield_annual_percent`); builder corporate detail (`cin`, `legal_entities`, `executives`, `outstanding_dues_cr`); `marketing_claims` (wrapped as developer copy).
  * **Still withheld** (privacy and process, not data quality): other users' rows (`FORBIDDEN_RELATIONS`); `embedding`, `ai_search_keywords`, `builder_theme`, raw ids and timestamps; `publish_status`, `archived_duplicate_of`; analyst notes, our own verification and process fields, channel-partner commercial terms, `portal_subdomain`; drafts (`field_drafts`, unpublished `decision_profile`).
  * **Not to be undone without the owner.** Do not clear, hide or caveat stored values (no `fix:templated` on live).
  * **Known risk the owner accepted:** `approvals_status` reads "Fully approved" even on Amrapali and Jaypee projects.
  * **Still in place:** the integrity checks reject figures that are not in the facts given to the model (a score passes only when its number is in those facts), and a genuinely absent value is "not on record", never a typical figure.

**Enforcement:** `dueDiligenceFabrication.test.ts`, `falseReassurance.test.ts`, `lib/ai/__tests__/answerIntegrity.test.ts`; `answerIntegrity.ts` runs on every provider leg before the buyer sees an answer. `sanitizeOutput.ts` runs after it: a code-built sentence that carries a source must be checked through the real route, because the sanitizer rewrites citation-shaped parentheses and deletes sentences that name an outside site (ERRORS.md, 2026-11-03).

### Data Integrity Debts (launch blockers, re-checked 2026-11-03)
* **Unit prices written by a seed script.** `scripts/seed-and-enrich-all-projects.cjs` generated prices (max = min × 1.08): 754 of 1,021 priced unit rows, 310 of 381 projects (dev). Every price card reads them. Payment plans: 608 of 620 `inferred_default`. Re-sourcing needs builder price lists; a partial rebuild from portals was rejected (79 projects only). Owner decision pending.
* **RERA numbers.** The 2026-10-28 pipeline replaced 74 stored numbers (36 had belonged to a different project) and wrote 150 registry-verified registration rows on dev and live. Still open: 162 projects with no usable number, 16 numbers shared by different projects, 57 malformed, 4 same-name/different-RERA pairs.
* **Due-diligence columns on 129 projects: nulled 2026-10-16** on both databases; they read "Not on record" until re-sourced.
* **Suspect defaults:** 18 "delivered" projects with no OC, 226 clear-title/zero-litigation rows, 39 zero-delay builders, 80 placeholder coordinates, possession status/label/date that contradict each other on most projects.
* **Known row conflicts** (`docs/benchmark/C1_DAY6_ROWCHECK_2026-10-31.md`): duplicate Mahagun Meadow (and a duplicate ATS Destinaire on live), Eureka Park status and metro rows, Astralis RERA and type, Mezzaria rate and metro distance, cost-sheet base rate vs computed rate shown side by side.
* **Price firewall** (`lib/ai/provenanceChecker.ts`, `lib/ai/projectFactChecks.ts`): a figure beside one project's name that is another project's is rejected; dates must be in the prompt; claims contradicting the named project's row are rejected; a bullet or table row inherits the project named on the line above it (2026-11-03). Distances, travel times (km, metres, minutes, hours of travel), floor and land areas that nothing supplied supports are dropped sentence by sentence (`dropUnsourcedMeasurements`). Still open: a figure in a plain sentence that names no project is checked only against the whole prompt.
* **All 382 live projects are `draft`** and nothing uses that label to hide them. Owner decides what it means.
* *Decided, not a debt:* templated-data pass 3 is applied on dev only, and the owner chose (2026-10-27) not to run it on live; stored values are answered as stored.

---

## Field Exposure — Adding a Column is a Disclosure Decision

`lib/projectExposure.ts` is policy for `Project` data leaving the server.
* `Project` relations to other users' rows (`saved_by`, `chat_sessions`, `property_feedback`) and drafts (`field_drafts`) are in `FORBIDDEN_RELATIONS` and never selected into a prompt or response.
* Internal columns (`embedding`, `ai_search_keywords`, `builder_theme`) and analyst-only fields never reach a buyer.
* `DecisionProfile` / `RecommendationProfile` carry `IntelligenceStatus`; only `PUBLISHED` is buyer-facing.
* `ProjectDna` scores stay internal.
* A pending draft is read by a buyer path only after a named person approves it, through one function (e.g. `loadComplaints` in `handlers/projectCatch.ts`).

**Adding a column to `schema.prisma` does not expose it.** It is absent from `PROJECT_PUBLIC_SELECT` until classified, and `projectExposure.test.ts` fails on anything unclassified.

## Who Sees What — the Role Matrix

`AdminRole` in `schema.prisma`; enforced in `lib/adminPolicy.ts` (paths), `lib/adminFieldRedaction.ts` (columns), `lib/adminReadAudit.ts` (who read a person's data).

| Audience | Roles | Surface |
|---|---|---|
| Us | `SUPER_ADMIN`, `ANALYST`, `SALES` | `/admin` |
| Supply | `BUILDER`, `PARTNER` | `/portal`, `/builder/portal`, tenant subdomains |
| Demand | Supabase users + guest tokens | the main app |

**ANALYST is ours, not a builder's** — the catalogue role. The builder-side equivalent is `BUILDER`.

**Non-negotiable:**
* **A builder never receives a chat transcript.** Builders and partners receive a **Lead Brief** (`lib/leadBrief.ts`): one project, competitor names scrubbed, every field read from a stored column. Competitor *pressure* may be stated abstractly; competitor *identity* never.
* **A promoted project is never ranked higher.** The news rail (`routes/promotionals.ts`, `components/NewsRail.tsx`) decides what a buyer is invited to ask about, never what is recommended.
* **A tenant subdomain is addressing, never authorisation.** Scope comes from the session, server-side, on every request.
* **Only RealtyAsk mints identities.** A builder may propose a partner login; our approval creates it.
* **Invitees set their own password.** We never issue one.
* **A partner never approves its own submission**, and a builder never approves another builder's project.

## The Lead Brief — why builders pay us

What a portal gives: name, phone, project. What we give, all from stored columns:
* Requirement: configuration, budget band, timeline, sectors considered
* Readiness: saved, compared, dossier generated, site visit requested
* Objections in the buyer's own framing (`LeadObjection`, no writer yet): possession risk, price, builder history — competitors abstracted
* Questions already answered, so the caller doesn't repeat them
* Best time / channel to call, if the buyer gave one

Never in a brief: the transcript, competitor names, other buyers' data, anything inferred rather than stored.

---

## AI Assistant Rules
Must: be honest; explain recommendations and trade-offs; show RERA information; remember context; handle follow-ups; escalate when needed.
Must never: invent data; guess unavailable information; use fake confidence scores or star ratings; claim certainty when uncertain; recommend unsupported cities as inventory; present builder-attested data as independently inspected; forecast appreciation or quote typical yields; name another assistant or a listing portal as a source.

## Recommendation Framework
Rank by: 1. Budget fit 2. Location fit 3. Possession timeline fit 4. Builder track record 5. Stated preferences 6. Nearby infrastructure.

Every recommendation includes: property name, reason, primary trade-off.
```
Reason: Matches your budget and is 10 minutes from Sector 62 metro.
Trade-off: Possession expected in 2027.
```
Rows retrieved above a stated budget (up to 10%) go in an "Above the Stated Budget — NOT MATCHES" block; zero tolerance when the buyer says the ceiling is hard. An honest "no match" plus a choice of what to relax beats a padded list. A comparison names no winner: it states the difference that matters and "choose X if … choose Y if …".

---

## Signup Rules

**A guest token is an identity.** Every lead-generating action accepts one, and the row records which guest it came from. Nothing that produces a lead sits behind account creation.

Anonymous with a guest token: chat, search, browse, compare, calculators, save, callback, site visit, dossier.
Signup required for: builder phone access.

**A guest still owes us:** a phone number on a lead; rate limiting by guest token then IP. If a row can be created without naming who created it, that is a bug.

**Counting people:** a person is a signed-in account or a website guest token (`guest-` + UUID, or the browser fallback), per `isWebsiteGuestToken` in `lib/botDetection.ts` and `realPeopleSessions` in `routes/admin.ts`. Everything else is a script (`is_bot`, flagged, never blocked). Team members are excluded via `team_identities`.

## Lead Qualification
High-intent events (track all): save property; callback request; site visit request; builder contact access; dossier generated (`dossiers` row) and shared (`dossier_shared`).

---

## Infrastructure, Cost & Latency

**Environments** (full map: `docs/ENVIRONMENTS.md`):
* **Live:** Neon Postgres (Singapore, endpoint `ep-super-water-aof3o8gy`), Render service `realtypalsdev` on `main` (the name is historical), Vercel `realtyask.in`.
* **Dev:** its own Neon project (endpoint `ep-odd-bar-az91o2md`, since 2026-10-29), Render service `propfyndrdev` on `dev`, Vercel Preview `dev.realtyask.in`, Redis prefix `dev:`.
* **Shared:** Supabase Auth and Storage serve both (project `eargxn…`; never delete it). One Upstash Redis.
* `src/lib/liveDatabase.ts` identifies live by endpoint. A test never points at **live** Neon. The owner runs data writes on live, always after a backup. Neon keeps 6 hours of restore history.
* **Node 22** everywhere (`.nvmrc`, CI, Render).
* **Release check:** `.githooks/pre-push` runs `scripts/release-check.cjs` (compiles the committed tree in a clean copy). A 31 Oct push with six compile errors was refused by Render, not caught by us.

**Provider chain** (`lib/config.ts`, `lib/ai/fallbackChain.ts`): free Gemini 3.5 Flash Lite keys (2) → billed Gemini → Cohere Command A → Groq gpt-oss (4 keys) → NVIDIA → Cloudflare. The billed Gemini key is depleted (402/429 "credits depleted"), so turns land on free and weaker models. **Topping up the billed key is the single largest quality lever.**
* **Race:** if a leg has not spoken after `FALLBACK_HEDGE_MS` (5 s), the next leg from a different vendor starts alongside it; the first to speak is shown, the other aborted. `FALLBACK_TURN_BUDGET_MS` (30 s) stops new legs, never one that is streaming.
* **Integrity retry:** a discarded answer's reasons go to the next leg as a `## CORRECTION` block; checks never read it. Groq legs are skipped when the request exceeds Groq's 8k tokens per minute (they returned 413 on every long turn).
* **Full failure:** project-fact lanes answer from rows; other turns get the outage notice with `replace: true`.
* 29 Oct local bench (`docs/PROVIDER_BENCH_2026-10-29.md`): free Gemini first chunk p50 ~4 s with 17–39% failures; every non-Gemini leg failed with "Connection error" from the laptop. Not yet re-measured on Render.

**Budgets:** `GEMINI_DAILY_BUDGET_USD` (default $10, `geminiMeter.ts`), per-user $0.50/day (`cost.ts`). Prompt head ~7.7k tokens; average input ~13k per turn. Gemini rates double on 2027-01-01.

**Cost rules for new work:**
* Deterministic first. A fact we hold is answered from rows, with 0 LLM tokens.
* The prompt head must stay byte-identical across lanes (`promptPrefixStability.test.ts`); variable content goes after it, so provider prefix caching works.
* Send only the fields the question needs (field diet, `fieldDietProjection`).
* Never regenerate a whole answer blind on an integrity failure; state the violation to the retry.
* Every external paid call (Maps, Tavily/Serper, embeddings) is cached and rate-limited. Both Tavily keys are over their plan limit (2026-10-28).

**Rate limiting** (`lib/cache.ts`, `index.ts`, `routes/admin.ts`, `chat-router.ts`): limits key on guest token → auth → client IP. **The client IP must be the buyer's, not the proxy's** — `lib/request.ts` trusts `CF-Connecting-IP`, which behind the Vercel rewrite is Vercel's egress IP. Needs a proxy-secret env var on Vercel and Render. Resolve before launch.

**Health:** `/api/v1/health` touches DB and Redis; the keep-alive ping (cron-job.org) hits `/api/v1/healthz` on live only (Render's 750 free hours cover one always-on service; dev sleeps). Render has no health check configured on either service.

---

## Definition of Done

A roadmap gate is ticked only when:
1. The code is **called on the live request path** (show the caller), not just present.
2. A test exists that **would fail** if the behaviour broke — no `if (res.found)` guards that pass vacuously, no hardcoded "≥75%" banners.
3. No figure it shows a buyer is invented, defaulted or unlabelled.
4. Any measured target (latency, cost, pass rate) has a committed measurement from a real run.
5. MEMORY.md has the entry.
6. The week plan's proof file exists (`docs/benchmark/C2_DAY<n>_<topic>.md`) when the task is from a plan.

A ticked gate without these is worse than an unticked one: the next session trusts it.

---

## Realistic Limits — what we cannot promise
* **We do not inspect sites.** Verified means "from records we hold"; builder-attested means "the seller said so". Neither is a site audit.
* **Live price and inventory are only as fresh as the partner keeps them.** Show the date; never imply real-time.
* **We cannot negotiate or guarantee a price.** That is the human handoff.
* **Tax and loan figures are illustrative.** Slab, regime and bank rate are the buyer's; we state our assumptions.
* **Legal status** (title, litigation, complaints) is what public records and filings show, not legal advice. A complaint count is not a ruling.
* **Coverage is Noida/GNW.** Outside it, the advisor says so.

## What Drives Adoption
* **Buyers** come back if the first answer is faster and more honest than an evening of PDFs — and if the dossier is good enough to send to family.
* **Builders** pay if a RealtyAsk lead converts better than a portal lead. Measure it: brief opened → contacted → site visit → booking, per source.
* **Partners** submit data if approval is fast and their leads are attributed to them.
* **Trust compounds, one invented number destroys it.** That is why § Data Integrity Debts are launch blockers, not polish.

---

## Code Organization
* Don't redesign visual components, inputs or chat styling unless asked. Keep the discovery brand atmosphere (lavender `.discover-canvas`, Afacad "RealtyAsk" wordmark). The landing page is the dark one restored on 2026-10-31; which landing page stays is an owner decision on real numbers.
* No unrequested features, no unrelated refactors, no new dependencies without justification.
* Routing is a gate cascade in `routes/chat-router.ts` (~7.5k lines): a failing query class is usually a routing bug, not a prompt bug. Topic handlers live in `lib/chat/handlers/` (registry `CHAT_TOPIC_HANDLERS` in `handlers/index.ts`; order matters).
* No hardcoded answer branches for a named project or sector; resolve from the DB.
* Every routing fix adds a case to `src/lib/eval/route-replay.json`.
* Frontend tests: `npx jest` (not vitest). Backend: `npx tsx --test <file>`; `npm test` (offline, fake keys; real-model tests need `RUN_LIVE_LLM_TESTS=1`).
* Many files are CRLF. Write regexes with Write/Edit, never through a shell heredoc.

## Benchmarks: where we stand against ChatGPT and Perplexity

* **2026-10-15:** seven real ChatGPT buyer chats (`docs/benchmark/chatgpt-chats/`), pinned as `bm-*` cases in `route-replay.json`. Closed with `publicRecord.ts`, `savedProfile.ts`, `resaleDeal.ts`, `investmentScenario.ts` (arithmetic on the buyer's own rates, not a forecast), `buyerSupport.ts`, office pin and tickable checklists.
* **2026-10-31, hard-43:** 43 questions against ChatGPT (43/43) and Perplexity (Q1–Q12). Scorecards `docs/benchmark/HARD43_SCORECARD_2026-10-31.md` and `HARD43_SCORECARD_AFTER_2026-10-31.md`. Fixed: two-sided choices, quoted-rate checks, wrong-project rows, multi-part amenity asks, off-topic. Still open: Q3, Q7, F13/F15 (builder's other deliveries), Hinglish replies, comparison reasons that contradict the table, first word ~10 s.
* **Competitor teardown and prompt guide:** `docs/COMPETITOR_TEARDOWN_2026-10-29.md`, `docs/COMPETITOR_PROMPT_GUIDE_2026-10-31.md`. We copy patterns (answer first, trade-off per option, one closing question, "what I checked"), never facts.

**Where we must stay ahead** (do not trade away): statutory stamp duty/registration stated exactly instead of "7% provisional"; no unsourced market statistics; no asking-price-as-fact; no "fair price" verdict; partner payment never touches rank; Lead Brief without transcript.

**Rule for new lanes:** every new data source gets a tier, a source, a date and a freshness window before it reaches a buyer; a test must fail if the label is dropped.

## Golden Rule
When uncertain, choose the option that improves trust, improves decision quality, and reduces buyer effort — not the one that generates more clicks. The goal is not more listings viewed. The goal is a buyer who confidently buys a home.

---

## Reference
MEMORY.md (repo root) for standing decisions; ERRORS.md for approaches that failed. Current plan: the newest `docs/WEEK_PLAN_*.md` (now `WEEK_PLAN_2026-11-03.md`, cycle 2); last report in the newest `docs/WEEKLY_REPORT_*.md`. Environments: `docs/ENVIRONMENTS.md`. Older roadmaps are in `docs/archive/plans/`.

**Last Updated:** 2026-11-03 — full rewrite against live code: dev on its own Neon, provider race and rows answers, builder price proposals (dev), risk record and verdict-word guard, off-topic and two-sided-choice lanes, release check, data-integrity pipeline results, hard-43 benchmark. Previous version: `docs/archive/CLAUDE_2026-11-03.md`.

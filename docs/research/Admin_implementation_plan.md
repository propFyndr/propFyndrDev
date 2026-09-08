# PropFyndr — Admin, Builder & Partner Implementation Plan

**Revision 2 · 2026-08-29 · all figures below were measured against the live database, not estimated.**

> **Goal** — a production-grade, additive upgrade delivering (a) real analytics for Super Admin, (b) scoped RBAC for Builder and Channel Partner portals, (c) secure CRM integration, (d) precise property specs, (e) mobile-first polish — without losing data or regressing the buyer experience.

---

## 0. Read this before anything else

Revision 1 listed ten tables under *"Existing Artefacts — do **not** rebuild"*. All ten exist in `schema.prisma`. **Five of them contain zero rows, and three have no code anywhere that writes to them.**

| Table | Rows today | Writer in codebase | Waves that depend on it |
|---|---:|---|---|
| `ChatAnalytics` | 15,130 | yes | 2, 3 |
| `QueryMetrics` | 7,684 | yes | 2, 3 |
| `CallbackRequest` | 296 | yes | 4, 5 |
| `PropertyEvent` | 257 | yes | 3 |
| `ChannelPartner` | 13 | yes | 5 |
| `BuilderAccount` | **2** | yes | 4 |
| `WeeklyMetricsSummary` | **0** | **none** | 3 |
| `BuilderAnalytics` | **0** | **none** | 4 |
| `GhostPoolAnalysis` | **0** | **none** | 4 |
| `ResponseGrade` | **0** | exists, never fires | 2 |
| `PropertyFeedback` | **0** | exists, never fires | 3 |

Two consequences the original plan did not account for:

1. **Wave 4 builds a Builder Analytics Dashboard and a Ghost Pool Summary on two tables that nothing populates.** Built as written, both ship as empty screens. A demo of an empty dashboard is worse than not demoing it — it reads as broken rather than as new.
2. **The Builder Portal has 2 possible users today** against 117 builders. The portal is not wrong to build; it is wrong to sequence ahead of the pipeline that gives it users and the aggregator that gives it numbers.

Nothing is dropped from the eight waves. **A Wave 0 is added** to make the empty tables produce rows, because three later waves are undeliverable without it. Everything else is re-sequenced behind that fact.

---

## 1. Success metrics — each one has a command that produces the number

Revision 1's metrics could not be checked without a person forming an opinion. These can be run.

| Metric | Target | Verified by |
|---|---|---|
| Data integrity | 0 rows lost | `prisma migrate diff` before/after; row-count snapshot committed to the PR |
| Funnel coverage | ≥ 95% of non-empty sessions have `SessionFunnelEvent` rows | `npm run audit:funnel` (Wave 0) — exits 1 below target |
| Analytics honesty | 0 dashboard panels backed by an empty table | `npm run audit:panels` — asserts every panel's source table has rows |
| RBAC isolation | 0 cross-tenant reads | `builderScope.test.ts`, `partnerScope.test.ts` — two tenants, every route |
| Retrieval correctness | ≥ 98% | `npm run audit:retrieval` (exists; 98.9% today) |
| Price integrity | 0 labels contradicting their units | `npm run audit:prices` (exists; 0 today) |
| Spec rendering | 0 empty spec cards | `SpecificationGrid` unit test over 100 seeded projects |
| Mobile | no horizontal body scroll at 320/375/414px | Playwright viewport assertions, not a manual score |

**"≥ 8.5/10 on a mobile scorecard" was removed.** It is a number a person invents; the viewport assertion is a number a machine produces. Every metric here fails a build when it regresses, which is the only kind of metric worth writing down.

---

## 2. What exists today, verified

Do not rebuild these. They were checked in this pass and are live:

* **Beta observability** — `backend/src/routes/betaObservability.ts` serves `/admin/beta/conversations`, `/conversations/:id`, `/metrics`. `frontend/app/admin/conversations/page.tsx` renders full transcripts including the project cards shown at each turn, cost per conversation, and coverage-gap flags.
* **Terminal beta report** — `backend/scripts/beta-report.ts` (use, drop-off histogram, spend, top queries, coverage gaps).
* **Retrieval audit** — `backend/scripts/corpus/audit-retrieval.ts`, 555 queries, no model calls, exits non-zero on defect.
* **Price audit** — `backend/scripts/fix-price-labels.ts`, doubles as `npm run audit:prices`.
* **Admin sections** — `analytics`, `builders`, `builder-applications`, `conversations`, `leads`, `news`, `projects`, `promotions`, `property-listings` under `frontend/app/admin/`.
* **Observability** — PostHog and Sentry on both backend and browser, verified live by `npm run verify:observability`.

---

## 3. Wave 0 — make the empty tables produce rows *(new, blocks Waves 3 and 4)*

Nothing in this wave has a UI. It exists so the waves that do have one are not built over a void.

| Change | File | Action |
|---|---|---|
| `SessionFunnelEvent` model + `@@index([session_id, stage])` | `backend/prisma/schema.prisma` | **NEW** |
| Emit a funnel event at each stage transition | `backend/src/routes/chat-router.ts` (at `emitUiState`, the single exit every ui_state already passes through) | **MODIFY** |
| Nightly aggregator writing `WeeklyMetricsSummary` | `backend/src/jobs/rollup.ts` | **NEW** |
| Nightly aggregator writing `BuilderAnalytics` per builder per day | same | **NEW** |
| Nightly aggregator writing `GhostPoolAnalysis` (demand with no matching inventory) | same | **NEW** |
| Backfill from the 15,130 `ChatAnalytics` and 7,684 `QueryMetrics` rows already held | `backend/scripts/backfill-rollups.ts` | **NEW** |
| `npm run audit:funnel` — coverage check, exits 1 under 95% | `backend/scripts/audit-funnel.ts` | **NEW** |

**Why `emitUiState` is the hook point.** It is already the single place every ui_state leaves the router, and chip dedup and sector filtering already hang off it. Emitting funnel events anywhere else means five call sites and a sixth someone forgets — which is exactly how `stripInternalFields` and the emoji sanitiser each shipped broken twice before being moved to a choke point.

**Backfill first, then live emission.** The 15,130 sessions already recorded are the demo's data. Without the backfill every chart reads "last 3 days" on launch day.

**Why `ResponseGrade` and `PropertyFeedback` are left alone.** Both have writers that never fire. That is a separate question — is the feature wired, or dead? — and answering it by adding a second writer would double the confusion. Wave 2 investigates; it does not build on them until it knows.

*Estimate: 1.5 days.*

---

## 4. Permission model

```
SUPER ADMIN /admin/*          BUILDER /builder/portal/*      PARTNER /partner/portal/*
─────────────────────────     ─────────────────────────      ─────────────────────────
all projects, read+write      own projects only              no project access
all leads                     leads on own projects          assigned leads only
AI cost + model telemetry     no cost data                   no cost data
Ghost Pool, all builders      Ghost Pool, own slice          no Ghost Pool
platform feature flags        own API keys                   own API keys
full transcripts              transcripts on own projects    transcripts on own leads
Intelligence fields           Intelligence stripped          Intelligence stripped
```

**Enforcement is server-side and additive, never a UI concern.** One middleware, `requireScope(scope)`, reads the JWT `scope` claim and re-validates `builder_id` / `partner_id` **against the resource being fetched**, not against the request body. A scope claim that says "builder 7" and a URL that says project 12 must resolve project 12's owner from the database before answering.

**Intelligence stripping reuses `projectExposure.ts`.** That file is already the policy for what may leave the server, already enforced by `projectExposure.test.ts` which parses the schema and fails on any unclassified column. A second, parallel stripping middleware would be a second policy to keep honest — and the first one to drift. Builder and Partner scopes become two more allowlists in that same file.

---

## 5. The waves

### Wave 1 — Schema migration *(additive, ~2h)*

| Change | File |
|---|---|
| `QueryMetrics.intent_category String?` | `schema.prisma` |
| `SessionFunnelEvent` model (moved to Wave 0 — listed here for the single migration) | `schema.prisma` |
| `ApiCredential` (scope, hashed key, webhook_url, last_used_at, revoked_at) | `schema.prisma` |
| `ChannelPartnerAccount` (partner_id FK, email, password_hash, is_active) | `schema.prisma` |

`npx prisma migrate dev --name beta_telemetry_rbac`

**Additive only — no column is dropped or retyped.** Rollback is dropping four new objects, and application code referencing them sits behind `feature.betaAnalytics`.

**Store the API key hashed, never the key.** `ApiCredential.key_hash`, shown once at creation. A plaintext key column is a credential store, and it will be dumped by the first admin export written against it.

### Wave 2 — Super Admin backend *(~3h, needs Wave 0)*

| Endpoint | File | Action |
|---|---|---|
| `GET /admin/analytics/intent-categories` | `backend/src/routes/admin.ts` | MODIFY |
| `GET /admin/analytics/funnel-steps` | `admin.ts` | MODIFY — from `SessionFunnelEvent` |
| `GET /admin/analytics/query-topics` | `admin.ts` | MODIFY |
| `GET /admin/data-completeness` | `admin.ts` | NEW |
| `unmet-demand` + `is_recurring`, `has_inventory_gap` | `admin.ts` | MODIFY |
| Decide the fate of `ResponseGrade` / `PropertyFeedback` | — | INVESTIGATE |

**Every one of these excludes empty sessions.** 6,452 of 15,718 sessions have zero messages — a guest session is created on first request, before we know a message follows. Counting them drags turns-per-session to 0.58 against a true 1.03 and makes every conversion rate look like a catastrophe. Report them separately; never in a denominator.

### Wave 3 — Super Admin front-end *(~4h, needs Wave 2)*

| Component | File |
|---|---|
| Intent category donut | `frontend/app/admin/analytics/page.tsx` |
| Funnel drop-off bars | same |
| Query topic bars | same |
| Budget-vs-supply gap histogram | same |
| Data completeness grid + CSV export | `frontend/app/admin/data-completeness/page.tsx` (NEW) |

**Every panel renders an explicit empty state naming its source table.** "No funnel events yet — `SessionFunnelEvent` is populated from Wave 0's rollup, last run: never" beats a chart of nothing, which reads as a broken chart. `npm run audit:panels` enforces this.

**The budget-supply histogram is the one to demo.** It overlays what buyers ask for against what we hold, and we already know it will show a gap: 41 of 61 sectors are describable, and the coverage-gap list from live traffic names the rest. It is the only panel that produces a decision rather than a number.

### Wave 4 — Builder Portal *(~6h, needs Waves 0 and 1)*

| Feature | File |
|---|---|
| Auth, JWT scope=builder | `backend/src/routes/builder-portal.ts` (NEW) |
| Project CRUD, scoped by owner | same |
| Lead inbox — `CallbackRequest` + `SiteVisitRequest` | same |
| Analytics dashboard — from `BuilderAnalytics` | same |
| Ghost Pool, own slice — from `GhostPoolAnalysis` | same |
| API key management | `frontend/app/builder/portal/settings/page.tsx` (NEW) |
| Portal pages | `frontend/app/builder/portal/*` (NEW) |
| Scope + exposure enforcement | `projectExposure.ts` (MODIFY, not a new middleware) |

**Two blockers, both outside this wave.** Only 2 `BuilderAccount` rows exist for 117 builders, so onboarding is a prerequisite, not a follow-up. And both dashboards read tables Wave 0 fills. If Wave 0 slips, ship the portal **without** those two panels rather than with empty ones.

**Lead attribution must be verified before the inbox ships.** All 296 callbacks had no `chat_session_id` until recently, and 138 carried no identity at all. A builder opening a lead expecting the conversation and finding nothing is the portal's first impression.

### Wave 5 — Channel Partner Hub *(~4h, needs Waves 1 and 4)*

| Feature | File |
|---|---|
| Auth, JWT scope=partner | `backend/src/routes/partner-portal.ts` (NEW) |
| Assigned lead inbox, status updates | same |
| Performance dashboard — conversion, commission | same |
| API key management | `frontend/app/partner/portal/settings/page.tsx` (NEW) |
| Portal pages | `frontend/app/partner/portal/*` (NEW) |

13 `ChannelPartner` rows exist and none has an account. Lead **assignment** has no model at all — `CallbackRequest` has no partner FK. That is a schema addition this wave owns, and it is the reason Wave 5 follows Wave 4 rather than running beside it.

### Wave 6 — Property spec precision *(~2h, independent)*

| Change | File |
|---|---|
| Render balcony chip only when `balcony_area_sqft` is present | `frontend/components/property-detail/ResidencesTab.tsx` |
| Drop empty categories before render | `frontend/components/property-detail/SpecificationGrid.tsx` |
| Single column under 440px | same |

**The general rule, already load-bearing elsewhere: an absent field means absent.** A spec card rendering a fallback for a value we do not hold is the same class of defect as a price label contradicting its units. Omission is the signal.

*Independent of every other wave — this is the one to ship first if the demo is close.*

### Wave 7 — Mobile *(~3h, independent)*

| Component | Issue | Fix |
|---|---|---|
| Home chip row | overflows ≤375px | `overflow-x:auto` + scroll-snap |
| Discovery stream | keyboard hides latest message | already fixed — composer measured by `ResizeObserver`, padding clears it and the gradient |
| Property tabs | labels truncate at 375px | shorter labels, full text in `title` |
| Compare page | 3 columns break | swipeable carousel, sticky label column |
| Admin sidebar | unusable on mobile | slide-over drawer |
| Touch targets | 17 controls under 44px | audit and raise |

**Every fix gets a Playwright viewport assertion.** "Mobile polish" verified by a person is polish that regresses on the next layout change. This is the fifth audit in which mobile has been raised and the first in which it is checkable.

### Wave 8 — Regression, docs, release *(~1 day)*

`npm run check-all`, `audit:retrieval`, `audit:prices`, `audit:funnel`, `audit:panels`, both scope suites, Playwright viewports. Swagger regenerated. `docs/rbac.md` from code annotations.

---

## 6. Sequencing

Revision 1's order builds UI before the data it displays.

| Sprint | Scope | Rationale |
|---|---|---|
| **0 (1.5d)** | Wave 0 — rollups, funnel events, backfill | Unblocks 3 and 4 |
| **1 (0.5d)** | Wave 1 — migration | Additive, one migration |
| **2 (2d)** | Wave 6 + Wave 7 — spec + mobile | Independent, visible, demo-safe |
| **3 (1d)** | Wave 2 — admin endpoints | Reads Wave 0's tables |
| **4 (1.5d)** | Wave 3 — admin widgets | The demo surface |
| **5 (2.5d)** | Wave 4 — builder portal | Needs onboarding in parallel |
| **6 (2d)** | Wave 5 — partner hub | Needs lead assignment |
| **7 (1d)** | Wave 8 — regression + docs | |

**≈ 12 working days**, down from 20 — not by cutting scope, but because Waves 6 and 7 stop waiting on backend work they never depended on, and the rollups stop being discovered late.

**If the demo is sooner than 12 days, ship Sprints 0–4 (6.5 days).** That is Super Admin analytics, spec precision and mobile — all buyer- and operator-facing. Builder and Partner portals demo poorly to an audience that is neither.

---

## 7. Demo script

Order matters: lead with the thing no competitor has.

1. **A real conversation.** Ask "3 BHK in Sector 75 under 2 crore." Cards carry the **3 BHK price**, not the project's full spread — the distinction a portal cannot make.
2. **Ask for a configuration that doesn't exist.** "Does Ace Hanei have a 3 BHK?" It says no, then shows what in that sector does. Refusing to fake a match *is* the product.
3. **Admin → Conversations.** Open the transcript just created. Every question, every answer, the cards on screen at each turn, cost.
4. **Admin → Analytics.** Budget-vs-supply gap: what buyers ask for against what we hold.
5. **Coverage gaps.** The questions we could not answer, from real traffic — the roadmap, written by users.
6. **The audits.** `npm run audit:retrieval` and `audit:prices` on screen. Both exit 0. This is what "we check our own data" looks like.

**Do not demo:** an empty Builder dashboard, the Partner hub, or any panel whose table Wave 0 has not yet filled.

---

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Rollups ship late, Waves 3–4 render empty | **High** | High | Wave 0 first; `audit:panels` fails the build on an empty-backed panel |
| Builder portal has no users (2 accounts / 117 builders) | **High** | Medium | Onboarding runs parallel to Wave 4; portal is not "done" at zero users |
| RBAC leak | Medium | **Critical** | Two-tenant tests per route; reuse `projectExposure` rather than a second policy |
| Plaintext API keys | Medium | **Critical** | Hash at rest, display once, `revoked_at` honoured on every request |
| Lead assignment undesigned | High | Medium | Wave 5 owns the schema; do not start the hub before it |
| Empty sessions distort every metric | **Certain** | Medium | Already excluded in `beta-report.ts`; apply the same rule in Wave 2 |
| Migration breaks production | Low | High | Additive only; `--create-only`, reviewed, staged |
| Two servers on one port serving stale code | **Observed** | High | Fixed — the server now exits loudly on `EADDRINUSE` instead of leaving an older process serving |

---

## 9. Rollback

Every schema change is additive. Reverting means dropping `SessionFunnelEvent`, `ApiCredential`, `ChannelPartnerAccount` and the `intent_category` column; all consuming code sits behind `feature.betaAnalytics`. The rollup job is idempotent and re-runnable from `ChatAnalytics` and `QueryMetrics`, both of which it only reads.

---

## 10. Open questions

1. **`ResponseGrade` and `PropertyFeedback` have writers that have never fired.** Dead feature or broken wiring? Wave 2 answers it. Do not build UI on either until it does.
2. **Builder onboarding owner.** The portal needs users; 2 of 117 have accounts. Who runs that, and by when?
3. **Commission model for partners.** Wave 5's dashboard promises "commission accrued" and no schema holds a rate.
4. **Sector 22D data defect** — one place stored under two sector strings across two cities, still open, still needs a decision.

---

*Revision 2. Row counts, writer checks and file paths in this document were verified against the repository and the live database on 2026-08-29. Where a claim could not be verified it is marked as an open question rather than stated.*

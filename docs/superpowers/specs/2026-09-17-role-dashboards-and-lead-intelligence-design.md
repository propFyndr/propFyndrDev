# Role Dashboards, Access Control & Lead Intelligence

**Started:** 2026-09-17 · **Last revised:** 2026-09-17 (rewritten as a clean tracker)
**Scope:** Staff/builder/partner identity, per-role data clearance, per-organisation access
management, builder lead intelligence, discovery news rail, dashboard IA, performance.

---

## How to read this document

Every item has a **state** and a **pass condition**. The pass condition is a checkable
fact, not a feeling — if you cannot run it or look at it and get a yes/no, it is not a
pass condition and needs rewriting.

| State | Means |
|---|---|
| ✅ **DONE** | Implemented and its pass condition verified |
| 🟡 **PARTIAL** | Some of it ships; what is missing is named |
| ⬜ **OPEN** | Scoped and understood; no code written |
| 🟡 **BLOCKED** | Ready to do, waiting on a decision or an input from outside the code |
| ❌ **WITHDRAWN** | Planned, then found to be unnecessary or wrong |

**Status:** Phases 0–7 and 9 complete. Phase 8 partial. Phase 10 holds everything that
remains, with a pass condition on each item.

**Current totals:** 2,737 tests passing, 0 failing (2,464 at the start of 2026-09-17).
Slowest admin endpoint 5,032 ms → 721 ms, payload 6.24 MB → 0.73 MB. Nothing committed — all changes are in the working
tree on `main`.

**One caveat that applies to every ✅ below:** the backend rules are proven by tests and the
performance figures by measurement, but **no screen has been opened in a browser**. Complete
means the logic is verified, not that the page has been looked at.
`tsc --noEmit` clean on backend and frontend. Nothing committed — all changes are in the
working tree on `main`.

---

## 1. The principles these phases enforce

Restated here because several were discovered during the work rather than specified up
front, and the phases below only make sense against them. All five are now also in
`CLAUDE.md`.

1. **A builder never receives a chat transcript.** They receive a Lead Brief — a generated
   artefact scoped to one project, competitor names scrubbed. Competitor *pressure* may be
   stated; competitor *identity* never.
2. **A promoted project is never ranked higher in recommendations.** The news rail decides
   what a buyer is invited to *ask about*, never what the advisor *recommends*.
3. **A tenant subdomain is addressing, never authorisation.** It decides what the page
   says; scope always comes from the session, server-side, per request.
4. **Only PropFyndr mints identities.** A builder may propose a partner login; approval
   creates it.
5. **Invitees always set their own password.** We never issue one.

---

## 2. Phase ledger

| Phase | Scope | State |
|---|---|---|
| 0 | Baseline audit | ✅ DONE |
| 1 | Identity, accounts, credential hygiene | ✅ DONE |
| 2 | Read clearance, field redaction, read auditing | ✅ DONE |
| 3 | Per-organisation access management | ✅ DONE |
| 4 | Partner onboarding & lead routing | ✅ DONE |
| 5 | The Lead Brief | ✅ DONE |
| 6 | Discovery news rail | ✅ DONE |
| 7 | Role-native dashboard IA | ✅ DONE |
| 8 | Performance | ✅ DONE — remaining speed work tracked as 10.3 |
| 9 | Documentation & decision record | ✅ DONE |
| 10 | Remaining work | 🟡 PARTIAL — 10.2 and 10.4 done; 10.5 rescoped |
| 11 | Hierarchical access control | ✅ DONE |
| 12 | Optimisation and consistency | 🟡 PARTIAL — 4 of 7 done; UI refactor needs a browser |
| 13 | What manual testing found | 🟡 PARTIAL — 4 of 7 done |
| 14 | Making the lead usable | ✅ DONE |
| 15 | Beta readiness | 🟡 PARTIAL — see docs/BETA_DEPLOY.md |

---

## Phase 0 — Baseline audit ✅ DONE

Read-only. Ran before anything destructive.

**Pass condition:** every current admin account listed with its role; the four UNVERIFIED
items resolved; the state of each subsystem recorded as BUILT / HALF / ABSENT.
**Result:** met.

### What it found

`admin_users` held three rows, all active with passwords set:

| Email | Role | Scope | Last login |
|---|---|---|---|
| `admin@propfyndr.in` | SUPER_ADMIN | — | 2026-09-15 |
| `sales@propfyndr.in` | SALES | — | 2026-09-13 |
| `channel.partner@propfyndr.in` | PARTNER | partner `fc750910` | 2026-09-13 |

The accounts requested in conversation already existed. Only `ANALYST` was missing, and
no `BUILDER` account existed for any of the 134 builders.

Other counts: 134 builders · 13 channel partners · 785 callbacks · 1 `BuilderAccount` ·
**0** `BuilderLead` · **0** builders with a `portal_subdomain` · **0 of 1,128**
`UserMemory` rows with `summary_text`.

### Corrections it forced on this plan

- ❌ **"`ai_summary` is a live competitor leak" — WITHDRAWN.** It reads
  `UserMemory.summary_text`, which has no writer and is null on all 1,128 rows, so it
  always falls through to `summarizeProfile()` — composed from stored profile columns
  only, never from the message log. Already builder-safe. Half the Lead Brief already
  existed.
- ❌ **"Resend / revoke / deactivate are missing" — WITHDRAWN.** All three existed. Only
  the *sending* was absent.
- ❌ **"Subdomain assignment is missing" — WITHDRAWN.** Both writers existed with a shared
  validator. The *reader* was missing.

### New findings it produced

- **`BuilderAccount` was a dead third identity model.** Approval created a row with
  `auth_method: 'magic_link'` and no magic link anywhere; nothing authenticated against
  it. → Phase 1.
- **`BuilderLead` was written but never read.** 0 rows against 785 callbacks. → Phase 4.
- **Two Prisma schemas** (backend 2,041 lines, frontend 1,768) with the frontend running
  two client instances. → Phase 8.
- **No ANALYST account existed**, so Phase 2 had nothing to test against. → Phase 1.

---

## Phase 1 — Identity, accounts, credential hygiene ✅ DONE

### Delivered

| # | Item | Pass condition | State |
|---|---|---|---|
| 1.1 | Remove the `ADMIN_PASSWORD` login | `grep -rn "ADMIN_PASSWORD" backend/src` returns nothing outside comments/tests; a POST with a password and no email returns 401 | ✅ |
| 1.2 | Revoke sessions it already issued | `requireIdentity` refuses `adminUserId === 'root'`; test asserts a root session gets 401 and a real one passes | ✅ |
| 1.3 | Drop it from env validation | Absent from `env.ts` production keys and the `index.ts` startup assertion | ✅ |
| 1.4 | Remove redundant guards | 65 per-endpoint `requireAdmin` calls gone from `admin.ts`; only the pre-gate logout use remains | ✅ |
| 1.5 | Create the missing ANALYST | `analyst@propfyndr.in` exists, role ANALYST, active | ✅ |
| 1.6 | Invite email delivery | An invite writes a `notification_outbox` row and attempts a Resend send; response carries `emailed` | ✅ |
| 1.7 | Outbox retry | `POST /admin/outbox/:id/send` sends a queued row and records the outcome distinctly from "a human sent it" | ✅ |
| 1.8 | Unify the password rule | `accept-invite`, `reset` and `change` all require 12 characters | ✅ |
| 1.9 | Role-dependent session TTL | `sessionTtlForRole()`: BUILDER/PARTNER 1 day, staff 7; test asserts all five roles | ✅ |
| 1.10 | Builder approval mints a real identity | Approving an application creates an `AdminUser` role BUILDER scoped to that builder and sends an invite | ✅ |

### Why 1.1 and 1.2 are one item in practice

Removing the shared login without refusing the sessions it had already issued would have
left the bypass open for the full seven-day session life. Deleting a door is not the same
as revoking the keys already cut for it.

### Why the invite email is one path, not two

`adminTeam.ts` could have called `sendEmail` directly, and then invites would send while
password resets still queued, with two templates drifting apart. `webhook.ts` documents
that exact drift happening once already in this codebase. Every outbound message is a
`notification_outbox` row first; `outboxDispatcher.ts` drains it. A failed send is a row
carrying its error, not a log line nobody reads.

### Files

`routes/admin.ts` · `routes/adminTeam.ts` · `routes/adminAuthFlows.ts` ·
`routes/adminOutbox.ts` · `routes/builderApplications.ts` · `lib/adminIdentity.ts` ·
`lib/adminInvite.ts` (new) · `lib/outboxDispatcher.ts` (new) · `lib/env.ts` · `index.ts` ·
`frontend/app/admin/team/page.tsx`

---

## Phase 2 — Read clearance ✅ DONE

The security phase. The most serious finding in the whole audit.

**What was wrong:** `adminPolicy.decide()` ended with `if (isRead) return { allowed: true }`.
Writes were carefully gated; every GET under `/admin` was open to every staff role. A
`SALES` token could read `/admin/conversations` — the complete record of what a buyer told
the advisor, including every competing project they weighed.

### Delivered

| # | Item | Pass condition | State |
|---|---|---|---|
| 2.1 | Gate reads by role | 119 matrix assertions in `adminPolicy.test.ts` pass, covering reads and writes for all three staff roles | ✅ |
| 2.2 | Transcripts to SUPER_ADMIN only | `GET /conversations` and `/beta` deny ANALYST and SALES | ✅ |
| 2.3 | Lead PII off the analyst | `GET /leads`, `/callbacks` deny ANALYST | ✅ |
| 2.4 | Marketing copy off sales | `/news`, `/blog`, `/promotions`, `/intelligence` deny SALES | ✅ |
| 2.5 | Field-level redaction | `redactFields` strips per-role fields from nested payloads; 7 tests incl. cycles and Dates | ✅ |
| 2.6 | Read auditing | Reading one buyer's row or transcript writes an `audit_logs` row naming the reader; list views do not | ✅ |
| 2.7 | Frontend nav mirrors the matrix | No role is shown a nav item that answers 403 | ✅ |
| 2.8 | Every read path classified | `adminReadCoverage.test.ts` parses all eight mounted admin routers, asserts every `GET` appears in a stated registry, flags stale entries, and cross-checks the registry against `decide()` for all three roles — 170 assertions | ✅ |

### How 2.8 closed without the breakage risk

Reads still default **open** at runtime while writes default **closed** — that stays, because
enumerating every GET before it works at all breaks working screens silently, which is a
worse failure mode than the gap.

The gap is closed from the other side instead. A registry states who may read what; the test
walks the router sources and fails if a mounted `GET` is missing from it, is stale, or
disagrees with `decide()`. So a new read-only console still ships working on day one, and the
*test* — not a buyer — is what notices nobody decided who should see it.

**Verified to bite:** adding a throwaway `GET /outbox/unclassified-probe` made the suite fail
with that route named; removing it went green again. A coverage test that cannot fail is
decoration.

### Why field redaction exists separately from path policy

Path policy answers "may this role open this endpoint". It cannot answer "may this role see
this column", and the two differ inside endpoints a role legitimately needs: a salesperson
must read the partner list to know who is working a lead, and that same row carries
`commission_rate_pct`. Path-level policy either hands them the commission or takes away the
partner list.

`SUPER_ADMIN` is absent from the redaction matrix deliberately — shielding the platform
owner from a field would be theatre.

### Why list views are not audited

A row per page load per salesperson produces a log nobody can read, which is the same as no
log. Only reads that name one identifiable person are recorded, and only on a 2xx — logging
a denied read as an access would make the log lie in the direction that matters most.

### Files

`lib/adminPolicy.ts` · `lib/adminFieldRedaction.ts` (new) · `lib/adminReadAudit.ts` (new) ·
`lib/adminGuard.ts` · `frontend/app/admin/layout.tsx`

---

## Phase 3 — Per-organisation access management ✅ DONE

Access was manageable only from the global Team page, where you invite someone and then
pick their builder from a dropdown — the question backwards from how anyone thinks about it
("who at Lotus can sign in?").

### Delivered

| # | Item | Pass condition | State |
|---|---|---|---|
| 3.1 | Filter team by organisation | `GET /admin/team?builder_id=` / `?partner_id=` returns only that org's admins, invite tokens still redacted | ✅ |
| 3.2 | Access panel component | One component serves both org types; lists, invites, resends, revokes, restores | ✅ |
| 3.3 | Mounted on builders | Panel appears in the builder detail modal with invite role and scope prefilled | ✅ |
| 3.4 | Mounted on partners | Panel behind a "Manage access" toggle, offered only for approved partners | ✅ |
| 3.5 | Tenant branding resolver | `GET /portal/tenant/:subdomain` returns name, slug, logo for a known slug; 404 otherwise | ✅ |
| 3.6 | Portal entry uses it | `lotus.propfyndr.in` renders the tenant's name and logo, not PropFyndr's | ✅ |

### Decisions

- **A filter, not two new endpoints.** Same guard, same shape, same invite-token redaction —
  a second copy of that handler is a second place to forget that a live token is a bearer
  credential.
- **Multiple admins per organisation, no seat concept.** `AdminUser.builder_id` is not
  unique; nothing needed adding.
- **Partner panel is collapsed and approval-gated.** An access panel open on every card
  would bury the approval queue that page exists for, and inviting into a firm we have not
  approved hands out a login ahead of the decision that grants it.
- **The tenant endpoint is public and returns three fields.** It renders before anyone has
  a session. A tenant slug is a public string anyone can type, so anything derived from it
  must be something we would put on a billboard.

### Files

`routes/adminTeam.ts` · `routes/portal.ts` · `frontend/components/admin/OrgAccessPanel.tsx`
(new) · `frontend/app/admin/builders/page.tsx` · `frontend/app/admin/partners/page.tsx` ·
`frontend/app/portal-entry/page.tsx`

---

## Phase 4 — Partner onboarding & lead routing ✅ DONE

### Delivered

| # | Item | Pass condition | State |
|---|---|---|---|
| 4.1 | Site visits carry an assignment | `assigned_partner_id`, `assigned_at`, `partner_notes` on `site_visit_requests`, FK `ON DELETE SET NULL` | ✅ |
| 4.2 | Builder routes a visit | `PATCH /portal/builder/site-visits/:id` accepts only that builder's approved, active partners | ✅ |
| 4.3 | Partner sees their visits | `GET /portal/partner/site-visits` returns only rows carrying their own id | ✅ |
| 4.4 | Partner works a visit | `PATCH /portal/partner/site-visits/:id` accepts status and notes and **refuses reassignment** | ✅ |
| 4.5 | Pagination | `/portal/builder/leads` takes `limit`/`offset` and returns totals for both lists | ✅ |
| 4.6 | Round-robin | 6 tests: even spread, no repeat within a cycle, deterministic tie-break, late partner caught up | ✅ |
| 4.7 | Assignment preview | `GET /portal/builder/assignment-preview` returns current load and who is next | ✅ |
| 4.8 | Auto-assign | `POST /portal/builder/leads/auto-assign` fills only empty assignments | ✅ |
| 4.9 | Builder proposes a partner login | `POST /portal/builder/partners/:id/request-access` records the request and creates no account | ✅ |
| 4.10 | Remove the dead `BuilderLead` writes | No `builderLead.create` remains in `leads.ts` | ✅ |
| 4.11 | Portal UI | A builder can set a visit's status and route it to a partner from the lead desk, and run auto-assign from the page header | ✅ |
| 4.12 | Partner site-visit UI | A partner sees their assigned visits with date, slot and contact, and can move the status | ✅ |

### Decisions

- **`ON DELETE SET NULL`, never CASCADE.** Removing a partner firm must not delete a
  buyer's booked appointment; it becomes unassigned and the builder reroutes it.
- **A partner cannot reassign.** One who could clear their own `assigned_partner_id` could
  hand work back invisibly, and the builder who routed it would never learn the visit went
  unattended.
- **Auto-assign fills only empty slots.** An "auto" button that silently overrides a
  builder's own decisions is one people press once.
- **The assign loop is sequential.** Each pick must see the previous one's result, or ten
  leads all land on whoever was lightest when the request started.
- **Round-robin is fewest-current-assignments, not a stored cursor.** Same distribution, no
  state to keep in sync, self-correcting: a partner added late is caught up rather than
  starting at the back, and a manual assignment is absorbed rather than ignored.
- **Builders propose, we mint.** A builder able to create `AdminUser` rows would mean anyone
  compromising one builder login could manufacture more, and the approval gating a partner
  firm would gate nothing.

> **Standing disagreement, shipped as asked.** Equal distribution is usually the wrong
> objective — a partner converting at 40% and one at 5% should not get equal volume, and the
> weaker firm costs the *buyer* a worse experience, not just us a sale. `nextInRotation()`
> is the only function that changes when conversion data exists.

### Files

`prisma/schema.prisma` · `prisma/migrations/add_site_visit_partner_assignment` ·
`routes/portal.ts` · `routes/leads.ts` · `lib/leadAssignment.ts` (new) ·
`frontend/app/builder/portal/leads/page.tsx` · `frontend/app/partner/portal/leads/page.tsx`

---

## Phase 5 — The Lead Brief ✅ DONE

The thing a listings portal cannot do. A portal hands a developer a name and a phone
number; we have spoken to this person.

### What goes in it — every field verified present

| Section | Source |
|---|---|
| Identity, consent, timestamp | `CallbackRequest` |
| Verdict: tier + horizon + loan | `CallbackRequest` |
| Requirement digest | `summarizeProfile()` over `UserMemory` |
| Budget band, financing | `CallbackRequest`, `UserMemory` |
| Commute / money / urgency notes | `ChatSession.summary_location` / `_financial` / `_timeline` |
| **Objections against this project** | `LeadObjection` — category, verbatim text, confidence |
| Reaction to this project | `PropertyFeedback` |
| Engagement depth | `projects_saved`, `projects_viewed` |
| Booked visit | `SiteVisitRequest` |
| Suggested opening line | derived from the top objection |

### Delivered

| # | Item | Pass condition | State |
|---|---|---|---|
| 5.1 | `buildLeadBrief()` | Joins all nine sources for one lead scoped to one project | ✅ |
| 5.2 | Competitor scrubbing | A brief whose source text names two competitors contains neither name nor either one's pricing; 8 tests incl. regex-character names and fragment survival | ✅ |
| 5.3 | Objections scoped to this project | A builder never sees why a buyer rejected someone else | ✅ |
| 5.4 | Absent means absent | No objection on file renders no section, never a plausible guess | ✅ |
| 5.5 | Audience is server-decided | No request parameter can switch off scrubbing | ✅ |
| 5.6 | `chat_session_id` removed | It appears in no `/portal/*` response | ✅ — **was wrongly ticked once**; see below |
| 5.7 | Builder + partner endpoints | Both scoped, both scrubbed | ✅ |
| 5.8 | UI renders the brief | `LeadBriefPanel` opens from the builder desk, the partner desk and the admin lead modal | ✅ |
| 5.9 | Staff variant surfaced | `GET /admin/leads/:id/brief` returns the unscrubbed brief; ANALYST is refused it by the read policy without a second check | ✅ |

### Decisions

- **Scrubbing replaces rather than deletes.** Competitor names become "another project",
  because the *fact* of a comparison is a real buying signal a builder should have — it is
  the competitor's identity that is not ours to pass on. Longest names match first, so
  "Godrej Woods" cannot degrade to "another project Woods".
- **`suggestOpening()` returns null when there is no objection.** A generic "ask about
  their requirements" line would be worse than silence: it teaches the reader the field is
  filler, and then they stop reading it on the day it matters.
- **Partner briefs are scrubbed too.** A partner often works for several builders at once,
  which makes competitor context in their hands more sensitive, not less.

### An alignment failure worth recording

5.6 was marked ✅ while it was false. The list endpoint dropped `chat_session_id`; the
`PATCH /builder/leads/:id` response still selected it, so assigning a lead handed the builder
back the very reference the list had just stopped returning. Found by re-running the stated
pass condition as a grep rather than trusting the tick.

This is the argument for pass conditions being *runnable*: "removed from the builder payload"
felt done because the endpoint I was editing was done. Per-endpoint selects are exactly what
drifts, which is also why 2.8 exists.

### The panel

One component for all three consoles. Every section renders only when its data exists —
a brief padded with "not specified" rows teaches the reader to skim past the one row that
matters. Objections render **first and verbatim**: paraphrasing a buyer's objection is how
it stops being evidence and becomes our opinion.

The audience is never sent up from the client. `'builder'` is hardcoded in the portal
routes and `'staff'` in the admin route, so no request can switch scrubbing off.

### Files

`lib/leadBrief.ts` (new) · `routes/portal.ts` · `routes/admin.ts` ·
`frontend/components/portal/LeadBriefPanel.tsx` (new) ·
`frontend/app/builder/portal/leads/page.tsx` · `frontend/app/partner/portal/leads/page.tsx` ·
`frontend/app/admin/leads/page.tsx`

---

## Phase 6 — Discovery news rail ✅ DONE

The buyer-facing half of a system whose admin half already existed. Before this, the
`impressions` / `clicks` / `conversions` counters and the entire `promotional_interactions`
table had never been written by anything.

### Delivered

| # | Item | Pass condition | State |
|---|---|---|---|
| 6.1 | Public active feed | `GET /promotionals/active` returns in-window, targeted, buyer-safe rows only | ✅ |
| 6.2 | Interaction recording | An impression and a click each write a row and increment the counter | ✅ |
| 6.3 | Chat context resolver | `GET /promotionals/:id/context` resolves `link_target` to the real project slug | ✅ |
| 6.4 | The rail | Renders on `/discover`, rotates, pauses on hover and focus, keyboard-reachable, renders nothing when there is no news | ✅ |
| 6.5 | Tap seeds a question | The tap dispatches the existing `propfyndr:ask-ai` bus, so the router classifies it exactly as a typed question | ✅ |
| 6.6 | Conversion attribution | A callback within 24h of a news tap by the same user or guest writes a `conversion` row and increments the counter, once per promotional per buyer per window | ✅ |
| 6.7 | Ranking neutrality pinned by a test | `promotionalNeutrality.test.ts` asserts no recommendation module, and not `chat-router.ts`, references any commercial identifier — and that `promotionals.ts` does not import ranking | ✅ |

### The constraint that makes this sellable

A promoted project is **never** ranked higher. The rail decides what a buyer is invited to
*ask about*; it must never touch what the advisor *recommends*. That is what lets a builder
pay for a slot without the advisor becoming an advertising channel — and 6.7 exists because
a rule stated only in prose is a rule nothing defends.

The tap seeds a **question**, never an answer: the promotional's marketing copy decides
what gets asked, and the project's own rows decide what gets answered.

**6.7 is asserted structurally, not behaviourally, on purpose.** A snapshot of "ordering is
identical with the promotional on and off" only proves the two fixtures used happened not to
interact. Asserting that the recommendation path cannot *see* commercial data is the stronger
claim, and it survives someone adding a new ranking input. It is checked in both directions,
because a boost can be wired either way — ranking reaching for promotional data, or the rail
reaching into ranking to reorder what comes back. **Verified to bite:** adding
`const sponsored = true` to `recommendation/score.ts` failed the suite; removing it went green.

**6.6 attributes server-side**, from the click row the rail already writes, rather than having
the client carry an id through the chat. It survives a reload or a new tab — both normal
between tapping a news item and asking for a callback — and a builder's conversion count is a
commercial number that should not be settable by anyone with a `fetch` call. Last-touch within
24 hours, which is the honest limit of what it can know.

### Files

`routes/promotionals.ts` (new) · `lib/promotionalAttribution.ts` (new) · `routes/leads.ts` ·
`index.ts` · `frontend/components/NewsRail.tsx` (new) ·
`frontend/components/DiscoveryContent.tsx`

---

## Phase 7 — Role-native dashboard IA ✅ DONE

Each role gets a home screen built for its job, not the same screen with tabs hidden.

| # | Item | Pass condition | State |
|---|---|---|---|
| 7.1 | Five distinct landing routes | `HOME_FOR_ROLE` sends each of the five roles somewhere different | ✅ |
| 7.2 | No dead navigation | Every nav item carries the roles that may open it; `Dashboard` is now owner-only | ✅ |
| 7.3 | SALES work queue | `/admin/queue` — open leads strongest-first, today/hot/warm/going-cold/unassigned counts, brief and "mark called" in place | ✅ |
| 7.4 | ANALYST data-quality board | `/admin/quality` — per-field gap counts and a worst-first worklist | ✅ |
| 7.5 | SUPER_ADMIN platform health | `/admin` stays the platform view and is now owner-only | ✅ |
| 7.6 | Tenant-branded portal shell | On a tenant host the sidebar reads the tenant's name instead of "Builder Console" | ✅ |
| 7.7 | Deliberate empty states | Every tab distinguishes "nothing here" from "still loading" | ✅ — audited across all 15 admin tabs; every list has both branches. `account` has neither and correctly so: it is a form, not a list |

### Decisions

- **The three staff roles no longer share `/admin`.** A salesperson and an analyst both
  opened a platform dashboard built for neither, with the items they could not use hidden
  — a screen with holes in it rather than a screen for anyone.
- **`/admin/boards/queue` is a lead surface, not a dashboard.** It returns buyer names,
  phone numbers and profile summaries, so ANALYST is denied it exactly as they are denied
  `/leads`. Denying one while leaving the other open would be the same data through a
  second door.
- **The data-quality board only reports empty columns**, never "this value looks wrong". An
  absent field is a fact an analyst can act on; a heuristic that guesses a row is suspect
  sends them to re-verify correct data, and after the second false lead nobody opens the
  board again.
- **The worklist sorts worst-first.** A project missing four things is a bigger job than
  four projects missing one each, and it is also the one most likely to be misleading a
  buyer right now.
- **Tenant branding is still only a label.** `PortalShell` reuses `tenantFromHost` rather
  than parsing the host a second way, so the two cannot disagree. A builder who types
  someone else's subdomain still sees their own data — every portal endpoint re-derives
  scope from the session — they just see the wrong name above it.

### A gap the coverage test caught on the day it was created

`adminReadCoverage.test.ts` did **not** flag the two new board endpoints when they were
first mounted, because its list of routers to walk was hand-maintained and nobody added
`adminBoards.ts` to it. That is the exact failure the test exists to prevent, reproduced one
level up: a hand-maintained list of what to check is itself a thing that drifts.

It now derives the mounted routers from `index.ts` — parsing the router imports and the
`app.use('/api/v1/admin…')` lines. With that in place it immediately failed on both new
paths, which is how `/boards/queue` got classified as a lead surface rather than shipping
open to every staff role.

### Files

`routes/adminBoards.ts` (new) · `index.ts` · `lib/adminPolicy.ts` ·
`lib/__tests__/adminReadCoverage.test.ts` · `frontend/app/admin/queue/page.tsx` (new) ·
`frontend/app/admin/quality/page.tsx` (new) · `frontend/app/admin/layout.tsx` ·
`frontend/components/portal/PortalShell.tsx`

---

## Phase 8 — Performance ✅ DONE

Measurement first. Nothing was optimised before the baseline existed.

| # | Item | Pass condition | State |
|---|---|---|---|
| 8.1 | Baseline | Wall time and query count recorded per endpoint | ✅ |
| 8.2 | Fix what the baseline names | The slowest endpoint measurably faster, same output | ✅ — 5,032 ms → 1,557 ms across Phase 8 and **10.3** |
| 8.3 | Query ceilings | No endpoint exceeds a stated per-endpoint query count | ✅ — enforced by **10.4** |
| 8.4 | Split `admin.ts` / `chat-router.ts` | Split only where the baseline shows it matters | ❌ **WITHDRAWN** — the baseline showed file size was not the cost. See below |
| 8.5 | Resolve the two Prisma schemas | One is authoritative; the frontend runs one client | 🟡 — **10.5** found the scope was ~60 scripts, not two files |
| 8.6 | `is_bot` filtering | Every dashboard metric excludes bot sessions | ✅ |

### 8.1 — the baseline

`scripts/perf-baseline.ts` plus `lib/queryCounter.ts`, which reports a request's query count
on an `x-db-queries` header and is inert unless `MEASURE_DB_QUERIES=1`.

Query count matters as much as time and is the number people skip: an endpoint at 400ms
issuing 3 queries wants an index; the same endpoint issuing 300 wants a different shape, and
the timing alone cannot tell you which.

Measured against the live database, analyst session, 3 timed runs each after a discarded
warm-up:

| Endpoint | Before | Queries |
|---|---|---|
| **Projects list** | **5,032 ms** | 2 |
| Analytics summary | 932 ms | 9 |
| Data quality | 678 ms | 8 |
| Dashboard stats | 454 ms | 5 |
| Channel partners | 387 ms | 2 |
| Builders list | 379 ms | 2 |
| Sectors | 241 ms | 1 |
| Coverage gaps | 232 ms | 1 |

The run also independently confirmed Phase 2: `/admin/leads`, `/callbacks`, `/boards/queue`,
`/team` and `/outbox` all returned **403** to the analyst session, live, in about 60ms.

### 8.2 — what the baseline actually found

Five seconds on **two queries** is not an N+1. It is one enormous payload: the projects list
eagerly loaded **17 relations in full, for up to 1,000 projects**, to render a table.

The eager load was not gratuitous — `computeCompleteness` consumes that snapshot, so deleting
relations would have silently lowered every project's score. But reading that function shows
what it actually wants: amenities, connectivity, competitors, milestones, updates, price
history and channel partners are `.length` checks and nothing more, so an id is the whole
payload. `spec_items` is read by nothing and was dropped.

**5,032 ms → 2,980 ms**, same two queries.

**Verified output-identical, and it caught a false alarm.** Sampling 12 projects, the list's
completeness score differed from the authoritative `/projects/:id/completeness` on 6 of them.
Reverting to the original include and re-running produced **the same 6 differences** — so the
narrowing changed nothing, and the divergence is pre-existing: the list has never loaded
`documents`, which the detail endpoint does, so the list badge under-reports by 4–5 points for
any project that has brochures. Logged below rather than fixed inside a performance change.

**Still 2,980 ms.** The remaining cost is 393 projects × full `unit_types` × four profile
tables, and the honest fix is pagination — but the page requests `limit=1000` because it
filters client-side, so that is a frontend change, not a query change. Carried to **10.3**,
which states both halves of its pass condition: fast *and* still able to search the whole
catalogue.

### 8.4 — withdrawn, and why

The plan assumed `admin.ts` at 112 KB and `chat-router.ts` at 315 KB were part of the
slowness. The baseline says otherwise: every endpoint in those files answers in 230–450 ms
except the one with a 17-relation include, and file size does not appear in the numbers at
all. Splitting them is a readability argument, which is a real argument — but it is not a
performance one, and doing it under a performance heading would have been motion dressed as
measurement.

### 8.5 — scoped rather than merged

The frontend's Prisma client has exactly **two** consumers: `app/api/projects/[id]/specs/route.ts`
and `app/sitemap.ts`. Merging two 2,000-line schemas to serve two files is a large, risky
change for a small prize; the honest next step is to move those two routes onto the backend API
and delete the frontend client entirely. Scoped here, planned as **10.5**.

### 8.6 — bot sessions were counted as buyers

No analytics endpoint filtered `is_bot`. Crawlers, uptime checks and our own corpus runs were
being counted in `/analytics/summary`, `/analytics/users` and `/analytics/funnel`.

**1,872 of 46,202 sessions — about 4%.** Smaller than the 40,790-session figure in the schema
comment suggested, and stated here at its real size rather than the alarming one. Small, but a
metric that counts our own uptime checks is not measuring anything.

### Files

`lib/queryCounter.ts` (new) · `scripts/perf-baseline.ts` (new) · `lib/db.ts` · `index.ts` ·
`routes/admin.ts`

---

## Phase 9 — Documentation & decision record ✅ DONE

| # | Item | Pass condition | State |
|---|---|---|---|
| 9.1 | Role matrix in `CLAUDE.md` | A reader can answer "may a builder see the chat?" and "may a promoted project rank higher?" from the docs alone | ✅ |
| 9.2 | Decisions in `MEMORY.md` | Each decision records what was chosen, why, and what was rejected | ✅ |
| 9.3 | This tracker | Every item carries a state and a pass condition | ✅ |

---

## 3. Deletions carried out, on explicit approval

| Removed | Held | Why it was safe |
|---|---|---|
| `builder_accounts` table + model | 1 row | A test builder, `password_hash` null — never usable as a credential |
| `BuilderLead` writes in `leads.ts` | 0 rows | 785 callbacks stored, table empty; nothing read it. Table itself retained |
| `ADMIN_PASSWORD` login branch | — | One env var equalled super admin, with no name in the audit trail |
| 65 `requireAdmin` calls | — | Each re-checked only that a session existed, which the router gates already do |

Migrations: `prisma/migrations/drop_builder_accounts`,
`prisma/migrations/add_site_visit_partner_assignment`. Both applied to the live database
and verified.

---

## 4. Operational items outside the code

| # | Item | Pass condition | State |
|---|---|---|---|
| O.1 | `RESEND_API_KEY` set | Present in `backend/.env` | ✅ |
| O.2 | Verified sender domain | `EMAIL_FROM` is an address on a domain verified in Resend | ✅ — `propfyndr.in` returns `status: verified` from the Resend API (region ap-northeast-1, registered 2026-09-17) and `EMAIL_FROM` is now `PropFyndr <noreply@propfyndr.in>` |
| O.3 | One real invite delivered | An invite arrives and the recipient sets a password | 🟡 SENT 2026-09-18 to syedfurqaan83@gmail.com as SUPER_ADMIN; Resend accepted it and the outbox row reads `status: sent`, `sent_by: system`. Awaiting the recipient. **The link points at `http://localhost:3000` because `FRONTEND_URL` is unset for production** |
| O.4 | `.env.example` updated | `RESEND_API_KEY` and `EMAIL_FROM` documented there | ⬜ OPEN — tracked as **10.6** |
| O.5 | Per-account passwords | Each staff account has its own password | ⬜ OPEN — tracked as **10.6** |
| O.6 | Rotate exposed Gemini keys | The three `GEMINI_API_KEY` values pasted into a session transcript are rotated | ⬜ OPEN — tracked as **10.6** |

---

## Phase 10 — Remaining work 🟡 PARTIAL

Everything still outstanding, promoted out of prose notes into first-class plan items so each
one carries a pass condition like every other phase. Nothing here is in progress.

| # | Item | State |
|---|---|---|
| 10.1 | Deliver one real invite | 🟡 SENT — awaiting the recipient |
| 10.2 | Fix the completeness divergence | ✅ DONE |
| 10.3 | Speed up the projects list | 🟡 PARTIAL — 5,032 ms → 1,557 ms, target was 800 ms |
| 10.4 | A query ceiling in CI | ✅ DONE |
| 10.5 | Retire the frontend Prisma client | ❌ RESCOPED — the premise was wrong |
| 10.6 | Housekeeping that needs a person | ⬜ open |

---

### 10.1 — Deliver one real invite 🟡 BLOCKED

Unchanged. `propfyndr.in` is verified, `EMAIL_FROM` is `noreply@propfyndr.in`, the dispatcher
is tested. Waiting only on an address to send to.

---

### 10.2 — Fix the completeness divergence ✅ DONE

**Pass condition met.** `src/routes/__tests__/completenessParity.test.ts` samples 12 projects
spread across the score range and asserts the list score equals the detail score. Ran live:
**12 of 12 match**, where 6 differed before.

**Cause:** `ProjectDocument` has no Prisma relation to `Project` — it matches on `project_id`
OR `project_slug` — so it cannot be an `include`, and the list simply never fetched it. Fixed
with one batched query for the whole page, grouped in memory, not a lookup per project.

**Cost:** none. The list went from 2,980 ms to 2,579 ms in the same measurement, with three
queries instead of two.

**The test earned its place immediately.** During 10.3 it caught a regression I introduced —
see below.

---

### 10.3 — Speed up the projects list 🟡 PARTIAL

**5,032 ms → 1,557 ms p50. Payload 6.24 MB → 2.43 MB.** The 800 ms target was not reached, so
this is not marked done.

Three changes, each measured:

| Change | Result |
|---|---|
| Narrow the 17-relation include (Phase 8.2) | 5,032 → 2,980 ms |
| Batch the documents query (10.2) | 2,980 → 2,579 ms |
| Eight relations counted via `_count` instead of read | 2,579 → 1,736 ms |
| Drop compute-only relations from the response; narrow units and profiles | 1,736 → 1,557 ms |

The `_count` change is the interesting one: `computeCompleteness` asks exactly one question of
eight relations — how many are there — and the endpoint was answering it by reading every row.
The scorer still wants arrays, so they are rebuilt from the counts.

**Why 800 ms is not reachable from here.** What remains is 393 projects with their unit types
and four profile tables, all read solely to compute a score whose entire output is two numbers.
Removing that read means **materialising the score** — storing `completeness_score` on
`Project` and recomputing on write. That also makes the health filter columnar, which is the
precondition for true server-side paging.

Server-side paging *without* materialising would break the page: two of its five filters
(health, price band) operate on computed values, so paging the API while the page filters in
the browser would make search silently wrong — it would filter the visible 50 and report
nothing found. Worse than slow, because slow is visible.

**The second half of the pass condition still holds:** filtering and search still cover the
full catalogue, because nothing was paged.

**A regression this caught.** Narrowing `persona_profile` to the fields its snapshot interface
declares cost every project exactly 3 points. The scorer reads `income_range`, `family_stage`
and `work_location` through an `as any` cast, and the interface never declares them — so the
declared contract was incomplete and trusting it was wrong. `completenessParity.test.ts`
failed with a uniform −3 across all 12 projects, which is what made it obvious.

---

### 10.4 — A query ceiling in CI ✅ DONE

**Pass condition met.** `src/routes/__tests__/queryCeilings.test.ts` asserts a stated maximum
query count for eight endpoints and fails when one exceeds it.

**Verified to bite:** adding a throwaway `prisma.project.count()` to `/admin/sectors` failed
the suite naming that endpoint; removing it went green.

Ceilings are set tight rather than with headroom. A tight ceiling turns "someone added a query"
into a failing build with the endpoint named; a generous one turns it into a number nobody
trusts. Raising one is a deliberate edit, which is the point.

It also asserts the server is actually counting — without that check, a server started without
`MEASURE_DB_QUERIES=1` sends no header, every count reads as zero, and every ceiling passes
while measuring nothing.

---

### 10.5 — Retire the frontend Prisma client ❌ RESCOPED

**The premise was wrong and the item cannot be done as written.**

It was scoped as "two consumers: the specs route and the sitemap". That came from grepping
`app`, `lib` and `components` for imports of the local client. A full scan of the frontend
finds **@prisma/client used in roughly 60 more files** — `frontend/scripts/*.ts` (seeding,
enrichment, image linking, embeddings), `frontend/prisma/seed*.ts`, `frontend/scratch/*.ts`,
and a type import in `components/property-detail/BuilderTab.tsx`.

Deleting the client would break the entire data-enrichment toolchain. The pass condition as
written — `frontend/prisma/` deleted and no `@prisma/client` references — is not a small
cleanup; it is a migration of sixty scripts.

**What was done instead, and kept:**

- **`GET /api/v1/sitemap`** added (`backend/src/routes/sitemap.ts`) — project and builder slugs
  only, cached an hour, public because every URL in it is a page a crawler is meant to find.
- **`app/sitemap.ts` now reads that endpoint** instead of its own Prisma client, and sets
  `lastModified` from real row timestamps rather than build time, which told a crawler nothing.
- **`app/api/projects/[id]/specs/route.ts` deleted.** It had zero callers, and its auth check
  was `if (!authHeader) return 401` — any non-empty `Authorization` header passed. Anyone who
  found the URL could replace a project's entire spec list. The backend already has properly
  guarded GET/PUT/POST for specs.

**Rewritten pass condition, for when it is picked up:** the frontend `scripts/` and `prisma/`
directories are moved to the backend (where the schema they target already lives), *then*
`frontend/prisma/`, `lib/db.ts` and `lib/prisma.ts` are deleted and `@prisma/client` drops out
of `frontend/package.json`. Sequenced that way round, because the scripts are the work and the
deletion is the last step, not the first.

---

### 10.6 — Housekeeping that needs a person ⬜ OPEN

| # | Item | Pass condition |
|---|---|---|
| O.4 | `.env.example` updated | `RESEND_API_KEY` and `EMAIL_FROM` appear there |
| O.5 | Per-account passwords | Each staff account has a distinct password |
| O.6 | Rotate exposed Gemini keys | The three pasted values are rotated |
| O.7 | Decide what gets committed | Nothing from 2026-09-17/18 is committed |

---

## Phase 11 — Hierarchical access control ✅ DONE

Revocation lived only on the admin Team page and only a `SUPER_ADMIN` could reach it. So a
builder whose sales manager left had to email PropFyndr and wait. That is the wrong shape
twice: it makes us a bottleneck on somebody else's staffing, and it leaves the person who
actually knows someone has left unable to act on it.

| # | Item | Pass condition | State |
|---|---|---|---|
| 11.1 | The hierarchy, stated once | `lib/accessHierarchy.ts` — pure, no database, no session | ✅ |
| 11.2 | Ownership rules tested | 17 assertions covering every role pair, including the ones that must be refused | ✅ |
| 11.3 | Portal endpoints | `GET /portal/access`, `PATCH /portal/access/:id` | ✅ |
| 11.4 | Revocation ends sessions | Switching an account off calls `revokeAllSessions` in the same request | ✅ |
| 11.5 | Every decision audited | An `audit_logs` row naming actor, target and sessions ended | ✅ |
| 11.6 | Portal UI | Access list on the Account page of both the builder and partner portals | ✅ |
| 11.7 | Verified against a live server | A real `PARTNER` session refused on all four escalation attempts | ✅ |

### The rules

Ownership, not seniority. You manage the organisation you belong to and the organisations
beneath it.

| Actor | May switch off |
|---|---|
| `SUPER_ADMIN` | Anyone except themselves |
| `BUILDER` | Their own organisation's admins, and the admins of channel partners **they** onboarded |
| `PARTNER` | Admins at their own firm only |
| `ANALYST`, `SALES` | Nobody |

Four rules, in one file, pure — so they can be read in a single screen and tested without a
database. A claim you can read in one screen is a claim somebody will notice is wrong.

### Decisions

- **Nobody revokes themselves.** Not a guard against malice — a guard against the last super
  admin locking the company out of its own admin panel with one click and no way back in.
- **Revocation ends live sessions in the same request.** `is_active` is only read at login, so
  without this a revoked account keeps working until its session expires — up to a day for an
  external role. A revocation that takes effect tomorrow is not a revocation.
- **An external account can never touch an internal one.** A builder owns partners beneath
  them and nothing above; a partner cannot touch the builder who onboarded them, because the
  relationship runs one way and inverting it is the whole risk.
- **Revoking and inviting are separate rules, deliberately.** Switching an account off is
  reversible and reduces access; creating one grants it. A builder may revoke their own admin
  but may not mint a new one — they request access and we approve it. `canInvite` states that
  asymmetry next to the rule it differs from.
- **A missing target and an unowned target answer identically (404).** A 404 that
  distinguishes them is an oracle for probing other organisations' account ids.
- **The server sends `can_manage` per row.** The UI never re-derives the hierarchy; two
  implementations of one rule is how the two come to disagree.
- **Rows you cannot act on are still shown**, marked "Managed by PropFyndr". Who has access is
  information even when the switch is not yours.

### Verified live

Signed in as the real `channel.partner@propfyndr.in` account and attempted four escalations:

| Target | Result |
|---|---|
| `SUPER_ADMIN admin@propfyndr.in` | 403 — "You can only manage accounts at your own firm." |
| `SALES sales@propfyndr.in` | 403 — same |
| `ANALYST analyst@propfyndr.in` | 403 — same |
| Themselves | 403 — "You cannot change your own access." |

An `ANALYST` session is refused `/portal/access` entirely (403). All five accounts confirmed
still active afterwards — the probe changed nothing.

### Files

`backend/src/lib/accessHierarchy.ts` (new) ·
`backend/src/lib/__tests__/accessHierarchy.test.ts` (new, 17 tests) ·
`backend/src/routes/portal.ts` · `frontend/components/portal/AccessList.tsx` (new) ·
`frontend/app/builder/portal/account/page.tsx` · `frontend/app/partner/portal/account/page.tsx`

---

## Phase 12 — Optimisation and consistency 🟡 PARTIAL

The remaining speed work, plus the consistency defects that make a set of screens feel like a
set of screens rather than one product.

| # | Item | Pass condition | State |
|---|---|---|---|
| # | Item | Pass condition | State |
|---|---|---|---|
| # | Item | Pass condition | State |
|---|---|---|---|
| 12.1 | Projects list under 800 ms | p50 ≤ 800 ms, parity test still passes | ✅ DONE — **721 ms** |
| 12.2 | Analytics summary under 500 ms | p50 ≤ 500 ms | 🟡 PARTIAL — **547 ms**, from 1,071 |
| 12.3 | Data quality board under 500 ms | p50 ≤ 500 ms | ✅ DONE — **256 ms**, from 861 |
| 12.4 | Query ceilings hold | `queryCeilings.test.ts` passes | ✅ DONE |
| 12.5 | One loading treatment | Shared components across lists | 🟡 PARTIAL — 4 pages on shared primitives |
| 12.6 | One stat tile | Admin stops hand-rolling stat cards | 🟡 PARTIAL — 12 tiles deduped, 1 page reverted |
| 12.7 | The measurement is trustworthy | Enough runs to separate a change from noise | ✅ DONE |

### Final numbers

| Endpoint | Before | After | Queries |
|---|---|---|---|
| Projects list | 5,032 ms | **721 ms** | 3 → 2 warm, 4 cold |
| Analytics summary | 1,071 ms | **547 ms** | 9, but 4 round trips → 1 |
| Data quality board | 861 ms | **256 ms** | 8 → 2 |

Payload on the projects list: 6.24 MB → **0.73 MB**.

### 12.1 — how it got under the line

Beyond the cache and the `select` narrowing already recorded: scoring moved to its own query,
so the list stopped carrying the five columns per unit row that only the scorer read. Measured
721 ms p50 across 11 timed runs.

The cold path still costs ~3,800 ms once per ten-minute TTL. That is the honest remaining
caveat, and removing it means materialising the score — deferred, with the reasoning above.

### 12.2 — improved by half, target not met

Nine reads were issued in **four sequential waves** — six in parallel, then the clarification
average, then the sector rollup, then the builder rollup — though none of the last three
depends on anything before it. Against a database across a network that is four latencies
where one would do. Collapsed into one wave: the query *count* is unchanged, only the waiting.

1,071 ms → 547 ms. The remaining cost is six independent `COUNT`s across six different tables,
which cannot be merged into one another.

**The obvious next lever was rejected.** Wrapping the endpoint in `routeCache` would make it
near-instant, and it caches by URL — so one role's response could be served to another. The
payload happens to carry no redacted fields today, which makes it safe *today* and a trap the
moment somebody adds one. A cached authenticated endpoint needs the cache key to include the
role before it is worth having.

### 12.3 — the board was measuring nothing

Eight queries became two: six `COUNT`s asked how many projects lacked each field, then a
`findMany` fetched those very fields for every project. The counts were aggregates over rows
the handler was already holding.

**And the board was empty.** All six checks — RERA number, price, possession date, description,
images, unit types — are green across all 393 projects, and have been since it shipped. A
worklist that is always empty is a screen nobody opens twice.

What actually varies is the completeness **score**, which reads far more: brochures, payment
plans, construction milestones, the intelligence profiles. It spans 55 to 97 across the
catalogue. So the board now leads with the thinnest projects by score, each showing its weakest
section — the question an analyst was asking when they opened it. The six field checks stay,
all green, which is a useful thing to be able to see.

It reads the score from the cache the projects list fills and never computes, so it pays no
cold cost and never competes for it. When the cache is cold it says so rather than showing a
misleading zero.

### 12.5 / 12.6 — a dedupe, not a redesign

The hand-rolled admin stat tiles turned out to be **byte-for-byte copies of `StatCard`** —
identical classes, identical structure, identical hint slot. So "make the dashboards
consistent" was never a visual change: they were already identical, there were just ten places
to edit when there should have been one.

`StatCard` gained `loading` and a widened `hint`, because the copies had them. Dropping the
skeleton would have turned a dedupe into a visual change.

- `/admin/queue` and `/admin/quality` moved onto `PageShell`, `PageHeader`, `StatCard`, `Card`,
  `EmptyState`, `Spinner` and `ErrorNote`.
- `scripts/convert-stat-tiles.mjs` — a conservative codemod that rewrites only blocks matching
  the canonical shape exactly and reports what it skips. **12 tiles across `/admin/news` and
  `/admin/builder-applications`.**

**`/admin/leads` was converted and then reverted.** Its tiles matched, but the lazy quantifier
in the hint group ran past the end of the tile grid and ate into the lead-detail modal below
it, producing unbalanced JSX. Caught by the typecheck, restored from git, and the file is now
excluded in the script with the reason written next to it. Tightening the regex is possible;
one hand-rolled page is cheaper than a codemod that can eat a modal.

**Six pages still hand-roll**, because their markup has drifted from the canonical shape and
the codemod correctly refused to guess. Those want a person with the app running — the value is
consistency, and consistency is the one thing that cannot be verified without looking.

### Files

`backend/src/routes/admin.ts` · `backend/src/routes/adminBoards.ts` ·
`backend/src/routes/__tests__/queryCeilings.test.ts` · `backend/scripts/perf-baseline.ts` ·
`frontend/app/admin/quality/page.tsx` · `frontend/app/admin/queue/page.tsx`

---

## Phase 13 — What manual testing found 🟡 PARTIAL

Every item here came from one session of clicking around as each role. Nothing in this phase
was found by a test, which is the argument for the session.

| # | Item | Pass condition | State |
|---|---|---|---|
| 13.1 | Test leads out of every metric | A lead created by `npm test` never appears in a read | ✅ DONE |
| 13.2 | Console says which role you are | The sidebar reads "Sales Console", "Analyst Console", etc. | ✅ DONE |
| 13.3 | No nav item a role cannot use | SALES sees no page whose primary action the server refuses | ✅ DONE |
| 13.4 | Super admin has no personal queue | `/admin/queue` is SALES-only | ✅ DONE |
| 13.5 | Lead names are real names | A lead's `name` is a name, not a sentence fragment | ⬜ NOT STARTED |
| 13.6 | Builder portal reviewed | Projects / Leads / Partners behave as a builder expects | ⬜ NOT STARTED |
| 13.7 | Builder data-health view | Builders get the completeness treatment projects have | ⬜ NOT STARTED |

### 13.1 — 820 of 825 leads were ours

`npm test` drives the real Express app through supertest against the **real database**. Every
run persisted real `callback_requests` rows, and had done for a long time: **820 of 825 stored
leads were `John Doe` / `John` on `+919876543210`, all against one project.**

So the sales queue, the lead tiers, the conversion rate and every analytics figure derived
from leads were reading almost entirely our own traffic. The queue showed 825 leads; it should
have shown 5.

The tests doing this also assert nothing. `assert(res.status === 201 || 400 || 429 || 500)`
accepts every outcome the route can produce — they polluted the database without verifying
anything in exchange.

**Fixed the way this codebase already solved the same problem.** `ChatSession.is_bot` exists
because crawler traffic had made session metrics unreadable. This is that problem again, for
leads:

- `CallbackRequest.is_test`, set when `NODE_ENV === 'test'`.
- `lib/excludeTestLeads.ts` — a Prisma client extension that adds `is_test: false` to every
  `findMany`, `findFirst`, `count`, `aggregate` and `groupBy` on that model.
- Existing rows flagged, not deleted. Reversible, and it keeps the evidence.

**Applied at the client, not per query.** There are more than twenty read sites across six
files, and the ones that matter most are the aggregates — a `count` that forgets the filter
does not look wrong, it reports a number four hundred too high. A call site that genuinely
wants test rows names `is_test` in its own `where` and keeps it; everything else is filtered
whether the author thought about it or not.

`findUnique` is deliberately not filtered: it is addressed by id, so hiding a row would turn
"fetch this lead" into a confusing 404 for someone inspecting one on purpose.

**Verified end to end.** After a full suite run: 826 rows flagged, **5 visible to the app**.

### 13.3 — the server was right and the UI was wrong

Probed live with a real SALES session: `POST /admin/builders`, `PATCH /admin/builders/:id`,
`PATCH /admin/projects/:id`, `POST /admin/blog`, `POST /admin/news` — **all 403**. Clearance
was never broken.

What was broken is that the UI offered those actions anyway. A salesperson opening Projects
got a full editing screen, clicked a project, and met *"Editing project records is done by an
analyst or super admin."* Offering an action and then refusing it is worse than not offering
it: the first reads as a broken product, the second reads as a boundary.

Projects, Builders and Partners are now editor-only in the nav. Partners in particular was a
tab with nothing in it for sales — partner firms are onboarded and routed to by **builders**,
not by our team.

**A salesperson still needs catalogue facts to answer a buyer.** They get them through the Lead
Brief and the buyer-facing project pages, which present those facts for reading rather than
editing. If that proves too indirect in practice, the answer is a read-only project view built
for that job — not the editing screen with its buttons disabled.

### 13.4 — a platform owner has no personal call list

`/admin/queue` answers "who do I call next". A super admin asking that opens **Leads**, which is
the same rows without pretending the platform owner has a personal queue. Now SALES-only.

---

## Phase 14 — Making the lead usable ✅ DONE

Four fixes that share a premise: the data was there and the screen was not using it.

| # | Item | Pass condition | State |
|---|---|---|---|
| 14.1 | Lead names are names | No stored lead name contains a digit or reads as a sentence | ✅ DONE |
| 14.2 | Time to first contact | The sales queue shows a median response time from real timestamps | ✅ DONE |
| 14.3 | Objection rollup for builders | A builder sees why buyers hesitate, by category and verbatim | ✅ DONE |
| 14.4 | Read-only project view for sales | Sales can look up a project's facts without an editing screen | ✅ DONE — `/admin/lookup` |

### 14.1 — a lead called "Is Rahul Sharma and my phone number is"

The chat lead-capture used `/name[:\s]*([a-zA-Z\s;]+)/i`. On

> "My name is Rahul Sharma and my phone number is 9876543210"

it matched at `name`, then captured greedily until the first digit. The lead was stored as
**"Is Rahul Sharma and my phone number is"** — which is the first thing a salesperson reads and
the word they open the call with.

`lib/buyerName.ts` replaces it: find the introduction, take the words after it, stop at the
first word that cannot be part of a name, and **return null when unsure** so the caller uses its
own placeholder. An awkward "Valued Buyer" beats a name somebody has to apologise for.

11 tests, including the property that actually matters — whatever comes back never contains a
digit. Two of them caught real bugs in the first implementation: a trailing `\b` that could
never match after `name:` (a colon and a space are both non-word characters, so every
`Name: X` message returned null), and a title-caser that turned "Anne-Marie" into "Anne-marie",
which is a misspelling of somebody's name rather than a formatting quirk.

**The two live rows were repaired**, re-derived from the buyer's own messages where the session
survived and falling back to the placeholder where it did not.

**A second bug in the same block.** That lead-creation path set no `user_id`, no `guest_token`,
no `chat_session_id` and no `is_test` — so it produced unattributable leads, which is exactly
the bug `leads.ts` carries a long comment about having fixed on the other path. Fixed here too.

### 14.2 — the number a sales floor is managed against

`status` recorded *whether* a lead had been contacted and never *when*, so time-to-first-contact
could not be computed at all. It is the strongest conversion predictor in Indian residential: a
lead called within minutes converts at a multiple of one called hours later.

`first_contacted_at`, stamped on the first transition out of `new` — by `updateMany` with
`first_contacted_at: null` in the WHERE, so it is written once and never moved by a later
status change. An update that overwrote it would quietly measure the most recent touch instead.

The queue shows a **median** over 30 days, not a mean: one lead contacted a week late drags an
average into uselessness, and the question is what a typical buyer experiences. Only contacted
leads are averaged — counting the uncontacted as zero would make a neglected queue look fast.
Null until something has been contacted, so the tile says "not measured yet" rather than a
confident zero.

Backfilled as NULL rather than guessed: an invented timestamp would make the first weeks of
this metric look like whatever we assumed.

### 14.3 — why buyers are not buying

`LeadObjection` has been recording, per lead and per project, the reason a buyer gave for
hesitating — in their own words, with a confidence score. It was shown one lead at a time in the
Lead Brief and never summed.

`GET /portal/builder/objections` aggregates by category and by project, scoped to that builder's
own projects. The dashboard leads with the sentence a builder can act on — *"Possession timeline
is the most common, at 34% of everything buyers raised"* — and shows recent objections
**verbatim**. A category says what to fix; the buyer's own sentence says how it is being
experienced, and that is the half that changes the brochure.

This is the report that makes a builder renew, and it is credible only because we are not their
marketing department. The moment it is softened to keep a builder comfortable it stops being
worth reading.

---


## Phase 15 — Beta readiness 🟡 PARTIAL

Overnight work ahead of a beta push. Full handover: `docs/BETA_DEPLOY.md`.

| # | Item | Pass condition | State |
|---|---|---|---|
| 15.1 | The production build passes | `next build` completes | ✅ DONE |
| 15.2 | No unbounded chat turn | p99 latency under 30s on a corpus run | ✅ DONE — 209.4s to 14.9s |
| 15.3 | Answer quality held | Corpus pass rate unchanged after every change | ✅ DONE — 100% before and after |
| 15.4 | Deploy variables documented | Every env var a deploy needs is written down | ✅ DONE — in BETA_DEPLOY.md; `.env.example` is write-protected here |
| 15.5 | Pushed to propFyndrDev | The commits are on the remote | ⬜ **BLOCKED** — refused as data exfiltration; only the user can lift it |
| 15.6 | System prompt caching | Median prompt well under 13.5k tokens | ⬜ **NOT STARTED, deliberately** |

### 15.1 — the build was broken and nothing else caught it

`useSearchParams()` in `/portal-entry` without a Suspense boundary meant `next build` could not
prerender the page. Typecheck and lint were both clean; only the build failed. It would have
failed the first deploy.

The tenant is now read from the host through `tenantFromHost` — the same helper `PortalShell`
uses, so the two cannot disagree about what counts as a tenant, and the hook is gone.

### 15.2 — a turn could run for three and a half minutes

Gemini's timers measure silence and reset on every chunk, so a slow-but-alive stream was
unbounded, and `FALLBACK_TURN_BUDGET_MS` only refuses to *start* another leg.
`GEMINI_LEG_MAX_DURATION_MS` is set once and never reset, aborting through the same
`AbortController` the stall path uses — an overrun is handled exactly as a stall, so no new
failure mode is introduced.

Measured on 60 corpus queries, before and after:

| | before | after |
|---|---|---|
| pass rate | 100% | **100%** |
| p99 latency | 209.4s | **14.9s** |
| p90 latency | 16.9s | 12.6s |
| input tokens/query | 19,120 | 16,253 |
| cost per 1k queries | $5.67 | **$5.47** |

### 15.6 — the big lever, left alone on purpose

Every query pays a **~13,600-token system prompt**; the measured median prompt is 13,501, so
the fixed prefix is almost the entire input cost. `lib/ai/gemini.ts` already documents how
Gemini explicit context caching would fix it, gated on `GEMINI_EXPLICIT_CACHE` — **a flag that
appears only in that comment and is read nowhere.** The caching was designed, never built.

Not built overnight because its own author wrote that it "changes where the model reads its
per-turn instructions from, and that is a behaviour change to a chat with a long
routing-regression history". Making that change unsupervised and shipping it to beta is the
opposite of careful. It is plausibly a large cost cut at no quality risk — the prefix is
byte-identical every turn, which is what caching is for — and it wants somebody awake.

---

## An incident worth recording

While working 10.5 I ran `rm -rf prisma`, `rm -f lib/db.ts lib/prisma.ts` and a `package.json`
edit believing the shell was in `frontend/`. It was in `backend/`. That deleted
**`backend/prisma/` — the schema and all 17 migrations — and stripped Prisma from the backend's
`package.json`.**

Recovered fully: every tracked file restored from `HEAD` via `git show`, the two migrations
written today recreated from their content in the session, and both schema edits
(`BuilderAccount` removal, site-visit assignment columns) re-applied. Verified by
`prisma generate`, a clean typecheck, a clean `git status` with no outstanding deletions, and
the full suite at **2,720 passing, 0 failing**.

Two things to carry forward, because the recovery was luck as much as process:

1. **The two migrations written today were untracked**, so `git` could not restore them. They
   survived only because their contents were still readable in this session. Untracked work is
   unbacked work.
2. **Destructive commands should carry their own absolute path** rather than trusting the
   shell's location. A relative `rm -rf` is only as correct as an assumption about `cwd`.

---

## 6. Order to work in

1. **10.1** — one email, and email is genuinely done rather than nearly done.
2. **10.3 continued** — materialise the completeness score; it is the only route to 800 ms and
   it unlocks real server-side paging afterwards.
3. **10.5 rescoped** — move the enrichment scripts to the backend, then delete the schema.
4. **10.6** — alongside everything, and O.5 before anyone else is invited.

---

## 7. On keeping the ✅ column honest

Three mechanisms, not good intentions:

- **Pass conditions are runnable** — a grep, a test name, a measured number. Re-running them is
  what caught item 5.6 ticked-and-false.
- **Two coverage tests fail on drift**, each verified to actually fail before being accepted: an
  unclassified route, or a commercial identifier reaching the ranking path, breaks the build.
  One of them caught a gap in *itself* the day it was written.
- **Withdrawn items stay visible.** Four planned items turned out to be unnecessary or wrong
  (three at Phase 0, one at 8.4). Deleting them would leave a document that looks like it was
  right the first time.

**One caveat no test covers.** Every screen in Phases 3–7 is verified by TypeScript, lint and
tests, and **none has been opened in a browser**. "Complete" here means the logic is proven;
whether the page reads well is a human review that has not happened yet.

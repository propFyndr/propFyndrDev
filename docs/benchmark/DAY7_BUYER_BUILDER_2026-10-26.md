# Day 7: buyer on a phone, builder receiving the lead (2026-10-26)

Week plan Day 7, items 2 and 3. Run against the dev backend on `localhost:3007`, which uses the dev Supabase DB, the real model chain and `REDIS_KEY_PREFIX=dev:`. A 60-question corpus run was using the same backend at the same time. Live (Neon) was not touched.

## Read this first: the phone UI was not tested

The frontend could not run on this machine. `next dev` crashed three times on its first compile of `/`. The host was out of commit memory: 1.3 GB free virtual of 48.8 GB, and 1.1 GB physical free. Most of that memory belonged to processes this session did not start, and they were left running. The details are in ERRORS.md under 2026-10-26.

So item 2 was run at the API level instead:
- I used one guest token, `guest-day7-20261026-a1b2c3d4e5f6`.
- I sent the same `X-Guest-Token` header and request bodies that `ProjectCard`, `CallbackModal`, `SiteVisitScheduler` and the chat client send.
- No browser ran, so there are no screenshots and `docs/benchmark/day7-phone/` was not created.
- Every "UI" cell below is **not tested**, not passed.
- Even with a browser, Playwright mobile emulation on a desktop would not be a real phone.

## Item 2: buyer flow as a guest

| # | Step | Result | Evidence |
|---|---|---|---|
| 1 | Open home on a 390x844 viewport | **Not tested** (host out of memory) | `next dev` crashed 3 times; log in ERRORS.md |
| 2 | Chat: "3BHK in Sector 150 under 3 crore" | **Pass** (API) | HTTP 200, 11.2 s. Session `9812265f-5398-4789-a3bf-43637911e231`. "15 projects match", 6 listed with price, possession and a "date passed, status unconfirmed" note where it applies. The session row names the guest token, `is_bot=false`. |
| 3a | Follow-up: "Tell me more about ACE Parkway. How does its possession compare with ATS Pious Hideaways?" | **Bug (B1)** | HTTP 200, 59.6 s: "our AI service is briefly unavailable". This is the honest fallback, but the buyer got no answer. |
| 3b | Follow-up: "What is the possession date and RERA number of ACE Parkway?" | **Pass** (API) | HTTP 200. Deterministic RERA table: `UPRERAPRJ4510`, Q2 2025, "confirm on UP-RERA before paying" |
| 4 | Save ACE Parkway as a guest (`POST /saved`, the `ProjectCard` body) | **Pass** (API) | HTTP 201. `saved_properties.id = 35facf17-c426-4ad1-954b-afd0c9665b23`, `user_id = guest_guest-day7-…` (names the guest). `GET /saved` returns it. |
| 4-UI | Save button on the card actually sends the request (the 23 Oct fix) | **Pass (unit only)** | `frontend/components/__tests__/projectCardGuestSave.test.tsx`: 1/1 (`jest -i`). Not exercised in a browser. |
| 5 | Callback, "Day7 Test" / 9000000099 (`POST /leads/callback`) | **Pass** (API) | HTTP 201. `callback_requests.id = da0b29a4-440c-4ff5-9bcc-f82c6330a006`, `guest_token` set, `user_id` null, `chat_session_id` resolved server-side to the chat above, `lead_tier=COLD`. A first try with `loan_status: "not_started"` got HTTP 400: my mistake, the enum is `pre_approved / need_help / cash`, which is what the modal sends. |
| 6 | Site visit, same person, ACE Parkway, +3 days, 11:00 AM | **Pass** (API) | HTTP 201. `site_visit_requests.id = 24469aee-bba3-4335-81c9-f29c5a9fa408`, `guest_token` set |
| 7 | Dossier: "Make a shareable dossier of my shortlist" (chat) | **Pass, with bug (B2)** | Chat answer links `/dossier/54060843fd4834e63090e36ae9bf833a`. The `dossiers` row names the guest token and the session. `GET /dossier/:token` returns HTTP 200 with 1 project. |
| 8 | Open the dossier link in a new tab on mobile; share it | **Not tested** (no browser) | The `dossier_shared` event fires from `DossierShareCard` in the UI, so it was not exercised |

Attribution check: every row this guest created names the guest token. That covers the session, save, callback, site visit and dossier rows. Both lead rows found by searching on the test phone number carry the same token, so no unattributed row was created.

## Item 3: the builder receives the lead

I minted portal sessions in dev Redis with `createIdentitySession` and called the real `GET /api/v1/portal/...` routes on :3007. The sessions were destroyed afterwards.
- **The one BUILDER login on dev is not ACE Group's.** `builder@propfyndr.in` is bound to builder `e5f01a70-…`, while ACE Parkway belongs to ACE Group (`4beabf41-…`).
- **So the owner session is a stand-in.** It uses that login's `admin_users` id with its scope set to ACE Group. The routes take scope from the session only, so this behaves like a real ACE Group login.

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Owning builder fetches `GET /portal/builder/leads/:id/brief` | **Pass** | HTTP 200, brief for lead `da0b29a4-…`, `audience: "builder"` |
| 2 | No transcript in the brief | **Pass** | Brief keys: `lead_id, name, phone, consent_given, created_at, project_name, project_slug, verdict, lead_tier, intent_tier, requirement, budget_min_cr, budget_max_cr, loan_pre_approved, location_notes, financial_notes, timeline_notes, objections, projects_saved, projects_viewed, reaction, site_visit, suggested_opening, audience`. None of `messages / transcript / chat_session_id / content / recent_questions / source_session` appear. |
| 3 | No other builder's project or builder name in the brief | **Pass, but proves nothing** | All 513 project and builder names other than this project and builder were checked as whole words: 0 found. But every field that could carry a competitor name was empty: the `*_notes` were null, `objections` was empty, and `requirement` is built from structured fields. Both comparison turns naming ATS Pious Hideaways failed (B1), so no competitor name reached a stored column. Only the unit tests cover the scrub. |
| 4 | Every brief field read from a stored column | **Pass** | Each value matches its row: `name, phone, project_slug, lead_tier, intent_tier, budget_max_cr, projects_saved, projects_viewed` against `callback_requests`. `requirement` equals `callback_requests.ai_summary`. The three `*_notes` equal `chat_sessions.summary_*` (null here). `site_visit` equals the booked visit (2026-10-28T18:30Z, 11:00 AM, pending). `verdict` is composed from the stored tier, intent and loan. |
| 5 | Builder lead list `GET /portal/builder/leads` | **Pass** | HTTP 200. The lead row has no `chat_session_id`, has 0 competitor names, and the site visit is listed |
| 6 | A builder of a different builder (Godrej Properties) fetches the brief | **Pass** | HTTP 404 `Lead not found`. The lead is absent from that builder's list (HTTP 200). |
| 7 | No session | **Pass** | HTTP 401 |

**Item 3 verdict:**
- **Confirmed end to end:** the brief carries no transcript, and builder scoping holds (owner 200, other builder 404, no session 401).
- **Confirmed by unit tests only:** the competitor scrub. See row 3.

**Caveats on item 3:**
- **Notes fields.** `location_notes`, `financial_notes` and `timeline_notes` are stored columns, but a model wrote them from the conversation. They are scrubbed of competitor names, but they are derived from the chat, so the brief is not wholly free of chat-derived text. They were null for this session.
- **Objections untested.** `objections` was empty because the comparison turn (step 3a) failed before anything was recorded. Competitor scrubbing on a real objection was therefore not exercised end to end; only the unit tests cover it.

Existing tests:

| File | Result |
|---|---|
| `backend/src/lib/__tests__/leadBrief.test.ts` | 15/15 pass |
| `backend/src/routes/__tests__/portalObjections.test.ts` | 5/5 pass, but vacuous: the summary and median tests check a copy of the logic pasted into the test, not the route |
| `backend/src/lib/__tests__/leadBuilderAlert.test.ts` | 6/6 pass |
| `backend/src/lib/__tests__/leadAssignment.test.ts` | 6/6 pass |
| `backend/src/routes/__tests__/leads.test.ts` (dev DB, `NODE_ENV=test`) | 27/27 pass, but weak: several asserts accept `201 \|\| 400 \|\| 429 \|\| 500` |
| `frontend/components/__tests__/projectCardGuestSave.test.tsx` | 1/1 pass |

No existing test calls `/portal/builder/leads/:id/brief` over HTTP with two builders. The check above did, but it was a one-off script and was deleted.

## Bugs

- **B1. Follow-up got "AI service briefly unavailable" (chat, not fixed: out of scope).** A comparison follow-up took 59.6 s and ended in the honest fallback. A second comparison turn about 20 minutes later got the same reply. The likely cause is provider-chain exhaustion while the corpus run shared the backend; not confirmed. If it reproduces with the backend idle, it is the CLAUDE.md "billed key depleted" problem. Owner: the chat/provider session.
- **B2. The dossier prices a 3BHK buyer on the 2BHK price (**fixed 26 Oct, after this run:** `basePriceFor` in `backend/src/lib/dossier.ts` now prices the BHK the buyer asked for, tested in `dossier.test.ts`). Launch blocker under "No invented figure reaches a buyer"; fix first.**
  - **What the buyer asked:** 3BHK under 3 Cr, and the chat quoted ACE Parkway 3BHK at ₹2.5–2.95 Cr.
  - **What the dossier shows:** "Base price ₹1.55 Cr", which is `price_min_cr` (the 2BHK floor; units are 2BHK 1.55–1.75, 3BHK 2.5–2.95, 4BHK 5.2–7.48). Landed cost ₹2.02 Cr, EMI ₹1,09,580/mo and "take-home needed" ₹2.74 L/mo all follow from it.
  - **Why it matters:** this understates the buyer's real cost by about 40% in a document meant for family.
  - **Where:** `lib/dossier.ts:218` (`basePriceCr: p.price_min_cr`). The fix belongs there: use the target BHK's unit price when one is known, otherwise label it "starting price (smallest unit)".
- **B3 (minor, labelling). "viewed 15" in the lead summary means "shown 15".** `projects_viewed` counts `UserMemory.viewed_slugs`, which `lib/ai/memory.ts` fills from search results. The buyer opened no card, yet the builder reads "viewed 15, saved 1". This overstates engagement, but nothing is invented. Fix by renaming the clause in `summarizeProfile` ("shown 15") or by counting opened cards. Not changed: wording choice for the owner.

- **B4. Lead objections have no writer, so the brief's "differentiator" is always empty.**
  - Nothing in `backend/src` writes `LeadObjection`. It is only read, in `lib/leadBrief.ts` and in `routes/portal.ts` (`/builder/objections`).
  - So every brief has `objections: []` and `suggested_opening: null`, and the builder objection report reads "No objections recorded" unless rows were written by hand.
  - CLAUDE.md lists "Lead objections" as **Live**, which is stale.
  - Not fixed: the writer would sit in the chat path.
- **Latent (not a bug today): the builder lead list returns `ai_summary` unscrubbed.**
  - The brief scrubs this column, but `GET /portal/builder/leads` returns it raw.
  - The route comment says it is safe by construction. That holds only while `UserMemory.summary_text` has no writer and `work_location` holds no project or builder name.
  - `work_location` is buyer free text, so "works near Logix Cyber Park" would name a Noida builder.
  - Not changed, because it does not leak today.

No bug was found in `frontend/` or in the portal/lead code that met the "clear bug" bar, so no code was changed.

## Side effects outside dev

- **Webhook.** `backend/.env` has `WEBHOOK_URL` set, and `fireWebhook` only skips under `NODE_ENV=test`. If the :3007 backend reads that file, the callback and the site visit were each sent to Make.com, so two "Day7 Test" / 9000000099 rows may be in the sales sheet or CRM. Delete them there.
- **Builder email.** ACE Group has no BUILDER login on dev, so no builder lead email could have gone out.

## Not tested

- Everything in the browser: home page, chat UI, card save tap, callback and site-visit modals, the dossier page on mobile, share/copy/WhatsApp buttons and the `dossier_shared` event. Re-run once at least ~4 GB of virtual memory is free.
- A real phone. Emulation would not have counted as one either.
- The builder portal UI (`components/portal/LeadBriefPanel.tsx`) and the builder lead email (`notifyBuildersOfLead`): whether one was sent on dev was not checked.
- Competitor scrubbing on a stored objection, end to end (none was recorded; see caveat).
- Partner-side brief `GET /portal/partner/leads/:id/brief` (lead not assigned).

## Test data left on dev

These rows were left as evidence and can be deleted by guest token `guest-day7-20261026-a1b2c3d4e5f6` and phone `9000000099`:
- chat session `9812265f-…`
- `saved_properties` `35facf17-…`
- `callback_requests` `da0b29a4-…` (`is_test=false`, so it shows in the ACE Group lead list; the rows are not marked as test data)
- `site_visit_requests` `24469aee-…`
- `dossiers` `54060843…`

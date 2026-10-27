# RealtyAsk persona review — 2026-10-15

Four personas, run one at a time against the repo on 2026-10-15. Read-only: no code, data or config was changed.

**Method and limits**
- Read: CLAUDE.md, MEMORY.md (latest entries), `ERRORS.md`, `WEEK_PLAN_2026-10-15.md`, roadmaps (skimmed), and the code named in each finding.
- Ran: `tsc --noEmit` (clean), one throwaway call to `scrubCompetitors` (temp file deleted), and two web searches.
- Not run: `npm test` (writes to whatever `DATABASE_URL` is set), lint, any live chat turn, any DB query.
- Not read: `docs/RealtyAsk Business Plan.html` (no readable text in a quick strip).
- No traffic, lead, conversion or revenue numbers were found in the repo. Persona 4 judges the thesis and the plan, not traction.

---

## Top 10, ranked

Ranked by (harm if it goes wrong) × (how soon a real user meets it) ÷ effort.

| # | Finding | Persona | Evidence | Smallest next step |
|---|---|---|---|---|
| 1 | **FIXED 2026-10-15 (whole-word + spacing/hyphen tolerant; 3 tests added, 2 fail on the old code).** Competitor scrub leaked and corrupted: no word boundary, so a builder named "Ace" turned "nice place" into "nice planother project", and spacing variants of a catalogue name ("SKA Greenarch") survived. **Still open:** true typos ("Godrage") are not caught. **Correction:** the original review said `ai_summary` is LLM-written. It is not: `summarizeProfile()` composes it from stored fields, and the `UserMemory.summary_text` path that could hold free text has no writer. The risk is latent only (`leads.ts` uses `profile.ai_summary ?? summarizeProfile(...)`, so a future writer would flow into briefs and the portal list). | Builder | `lib/leadBrief.ts` `scrubCompetitors`; `lib/__tests__/leadBrief.test.ts`; `lib/leadProfile.ts:65` | Done for matching. Optional: stop reading `mem.summary_text` into `ai_summary` until it has a writer and a scrub |
| 2 | **BUILT 2026-10-15, OFF by default (set `BUILDER_LEAD_EMAILS=on` on live only).** Link-only email (project, tier, timing, portal link; no name, phone or brief text) to active BUILDER logins on each real callback; `lib/leadBuilderAlert.ts`, hooked in `routes/leads.ts`. Not yet sent for real: needs `RESEND_API_KEY` on live and one supervised send. Original finding: **Lead Brief is not delivered.** Builder must open the portal. The outbox sends only invites, password resets and partner approvals; `notify.ts` sends to one internal address. | Builder, Investor | `lib/outboxDispatcher.ts` (`OutboxTemplate`), `lib/notify.ts` | Add a `lead_brief` outbox template and send the scrubbed brief on lead creation |
| 3 | **PRICE PART BUILT 2026-10-15 (not deployed, not yet used).** Reuses the existing `FactVerification` table, no schema change. Admin saves of unit prices (`PATCH/POST` units) and project prices (`PATCH /projects/:id`) accept `price_verification {tier, verified_at, source}`; a price changed without one resets to SCRAPED/undated; the cost-sheet answer and the chat facts block state the date (30-day staleness) or "date of last confirmation not on record". Admin UI strip in `UnitsEditor.tsx`. Dev data today: 1,403 price rows, all SCRAPED, none dated, so every price will read "not on record" until someone confirms it. **Update (same day): `unitConfiguration`, `totalOutflow`, `affordabilityHandler` (project-specific base only), `commuteShortlist` and `priceFairness` now show the date too; `priceFairness` also lost a misleading "Last updated in our records {updated_at}" line (an edit timestamp, not a price date). **Not done:** inventory dates (`UnitInventory` has no write path); project-level price UI (only the API accepts it); `comparisonHandler` and project cards (frontend re-renders their payload, needs a contract change); `projectCatch`, `paymentPlans`, `sectorComparison`, `newcomerOrientation` (no per-project price statement or aggregates only); bulk-import and `POST /projects` write no FactVerification rows. Original finding: **No price or inventory dates.** The advisor cannot say "confirmed on 2 Oct". The verified supply chain does not exist; every catalogue write is our own team's edit. | Buyer, Builder, Investor | CLAUDE.md § Verified Supply Chain (Status: not built) | Smallest slice: `verified_at` + verifier on price and unit availability, shown by the advisor, stale after the proposed 30/7 days |
| 4 | **Remaining unsourced data and stale doc claims.** Sector appreciation and sector `avg_price_per_sqft` were templated (cleared 10-14; re-sourcing open). 129 projects' due-diligence columns were heuristic. Several CLAUDE.md "debts" look already fixed, others unverified. | Buyer, Engineer | MEMORY.md 2026-10-13/14; `CostSheetSection.tsx` now reads `cs?.…`; `affordabilityHandler.ts` comment "No invented benchmark" | Verify each § Data Integrity Debts line against code and DB, update CLAUDE.md, then null and re-source what remains |
| 5 | **The business loop is unmeasured.** No price, no model, no funnel from brief opened → contacted → visit → booking. No builder feedback endpoint seen in `portal.ts`. | Investor, Builder | `routes/portal.ts` route list; `success-metrics.md` has categories, no numbers | Write the one-page model (who pays, what, how much); build the journey view planned for 18 Oct; get one builder to rate a real brief |
| 6 | **6,600-line chat handler.** `router.post('/')` spans lines 266–6894 of `routes/chat-router.ts`, ~40 gates inside. Route-replay has 46 cases. | Engineer | `routes/chat-router.ts`; `lib/eval/route-replay.json` | Make each gate a named entry in an ordered list; test the order; grow route-replay with every new routing bug |
| 7 | **Tests can hit live data by mistake.** `npm test` uses `.env`'s `DATABASE_URL`; nothing refuses a live host. | Engineer | `src/test-runner.ts` | Refuse to run when `DATABASE_URL` host matches the live Neon host |
| 8 | **Free-tier operations are fragile.** Compaction runs in the web process every 3h (a sleeping instance may never reach it); live depends on a cron-job.org ping; Neon scale-to-zero; dev/live separation of Redis is by key prefix only. | Engineer, Investor | MEMORY.md 2026-10-14 entries | Confirm the compaction job actually ran on live; give dev its own Redis; fund the billed Gemini key first (largest quality lever per your notes) |
| 9 | **Hindi/Hinglish and session memory are partial.** Normalizer runs after intent; the EMI rate is lost between turns. | Buyer | CLAUDE.md § V1 MVP table | Run the normalizer before intent; carry the rate in session state; add the 10 Hinglish cases planned for 16 Oct to route-replay |
| 10 | **Incumbent moved into the chat channel.** Housing.com launched property search inside ChatGPT (June 2026). Neutrality is the stated moat, but nothing yet shows buyers or builders can see or trust it. | Investor | See Sources | Make neutrality visible (e.g. a plain "how we rank, how we earn" page) and lean into the possession-risk and builder-track-record wedge below |

### Minor, not in the top 10
- Three stray tracked files in `frontend/`: `extracted_payload_clean.json`, `full_schema.sql`, `migration_preview.sql` (no secrets found; they drift from `schema.prisma`).
- `admin.ts` (3,628 lines), `projectFacts.ts` (1,362) and `projectDataGateway.ts` (1,142) are large; not read closely.
- 17 `eslint-disable` / `@ts-ignore` markers in `src`; 28 `as any` in `chat-router.ts`.
- `dueDiligenceFabrication.test.ts` "passes vacuously" per CLAUDE.md: not re-checked here.
- IP handling: `request.ts` trusts `CF-Connecting-IP` with a Render/Cloudflare reason; CLAUDE.md describes a Vercel-egress problem. Needs a live check, not a code read.

---

## Persona 1 — Skeptical home buyer

**Verdict:** a credible advisor on a thin data foundation. The honesty framing is the differentiator; missing price dates and appreciation data are the first gaps a buyer meets.

**Works:** one-line multi-fact brief; guest-token actions (save, callback, visit) with no signup wall; reason + trade-off per pick; statutory costs from one constants place; "past possession date is late, not ready" fix; landing page with no invented counts.

**Would make them leave:** templated or unsourced numbers (one spotted invention costs all trust); no "confirmed on" dates; appreciation answered with a what-if ladder (honest, but reads as dodging until a real series exists); Hinglish and session memory partial; no test seen that checks the fit card against the chat answer on every turn.

## Persona 2 — Builder / sales head

**Verdict:** strong concept, real leak risk, no delivery. Fix the scrub before any builder sees a brief.

**Works:** brief built from stored columns, one project, objections filtered to that project; no transcript by construction; scrub keeps the signal ("comparing on possession") and drops the name; portal scope derived from session.

**Problems:** items 1, 2 and 5 above. Also: portal is read-only, so a builder cannot correct a wrong price.

## Persona 3 — Staff engineer

**Verdict:** the discipline is better than the structure.

**Works:** clean typecheck; route-replay harness through the real route with the LLM stubbed; placeholder tests marked `todo`; test runner blanks provider keys; `ERRORS.md` captures real lessons; prefix-stable prompt, field-exposure classification, answer-integrity gate.

**Problems:** items 6, 7, 8 above, plus the minor list.

## Persona 4 — Investor / YC partner

**Verdict:** sharp, honest idea with unusually good trust discipline. Two things decide whether it is a business and both are unproven: a builder paying for the brief, and a repeatable way to get buyers in.

**Likes:** narrow wedge (Noida / Greater Noida West), neutrality as a moat, deterministic-first cost control, a plan that says "no new features this week".

**Pushes on:** no written pricing or unit economics; supply-side chicken-and-egg with a team-maintained catalogue; referral system with no real campaign data (one surviving link after the 10-12 purge); incumbent move (item 10); broad scope for the team size; metrics listed without numbers.

**Would ask for before investing:** buyers, chats per buyer, callbacks and visits in the last 30 days; one builder's verdict on a real brief; the price a builder would pay and what they pay portals today; acquisition channel and cost.

---

## Beyond the docs (outside CLAUDE.md and MEMORY.md)

Two quick web searches, standard depth. Treat as pointers, not research.

- **Competitor:** Housing.com launched a native property search experience inside ChatGPT (June 2026). A 2024 piece reports a 99acres chatbot; I found no 2026 MagicBricks buyer-facing advisor (its AI item is a price-index tool). Consequence: "AI chat for property" is no longer a gap on its own; the gap is neutrality and verified, dated data.
- **Wedge evidence:** a 2023 white paper put about 35% of India's stalled residential projects in Noida and Greater Noida (about 1.65 lakh flats); a 2024 PropEquity analysis counted 167 stalled projects in Greater Noida and 103 in Noida. UP RERA reports about 60,000 complaints, about 52,000 disposed, and ₹1,500–1,600 crore recovered. Consequence: possession risk and builder track record are the buyer's real fear here, and your honest-trade-off framing and RERA pill answer it directly. Lean on it.
- **Not found:** anything on 2026 stamp duty or registration rates. Your `UP_STATUTORY` constants should be re-checked against the UP Stamp and Registration Department before launch; I did not verify them.
- Old figures (2023–2024) may be out of date.

## Suggested order for the next two weeks

1. ~~Fix the scrub and its tests (item 1).~~ Done 2026-10-15 (matching only; see item 1 for the open typo case).
2. Add the `lead_brief` delivery template (item 2).
3. Re-verify every § Data Integrity Debts line and update CLAUDE.md (item 4).
4. Add the live-DB guard to the test runner (item 7).
5. One builder conversation plus a one-page business model (item 5).
6. `verified_at` on price and availability (item 3).
7. Gate list refactor of `chat-router.ts`, in small steps with route-replay cases (item 6).

## Sources

- [Housing.com launches property search on ChatGPT (Impact On Net)](https://www.impactonnet.com/more-from-impact/housingcom-launches-property-search-experience-on-chatgpt-14873.html)
- [Housing.com launches property search on ChatGPT (Realty N More)](https://realtynmore.com/housing-com-launches-property-search-on-chatgpt/)
- [UP RERA transfer recovers ₹1,600 crore for homebuyers (Realty N More)](https://realtynmore.com/up-rera-transfer-recovers-1600-crore-homebuyers/)
- [India's 35% stalled housing projects in Noida: whitepaper (Housing.com News)](https://housing.com/news/indias-35-stalled-housing-projects-in-noida-whitepaper)
- [Stalled projects surge in UP, Greater Noida and Noida lead (Business Standard)](https://www.business-standard.com/finance/personal-finance/housing-crisis-stalled-projects-surge-in-up-greater-noida-and-noida-lead-124090900283_1.html)

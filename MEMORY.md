# MEMORY.md

Decisions still in force, grouped by topic. Each entry: **what was decided** (date), why, and what was rejected.
Rewritten 2026-11-03 against live code. Previous version: `docs/archive/MEMORY_2026-11-03.md`; the session-by-session log up to 27 Oct is `docs/archive/MEMORY_full_2026-10-27.md`.
Add new decisions under the right topic, not as a session diary. When one replaces another, edit the old line.

---

## Open: owner decisions and launch blockers

- **Billed Gemini key depleted** (402/429 on 09-24, 09-26, 10-17, 10-29). Topping it up is the biggest quality and speed lever. Provider order and a Groq paid tier are also the owner's call (Groq free allows 8k tokens/min against ~6.2k-token requests).
- **First word is slow.** Median ~10 s on the free chain (31 Oct), target 3 s. Nobody has measured which step costs it (week plan Day 5).
- **Generated unit prices (10-26).** `seed-and-enrich-all-projects.cjs` wrote max = min × 1.08: 754 of 1,021 priced unit rows, 310 of 381 projects (dev; live not checked). Payment plans: 608 of 620 `inferred_default`. Needs builder price lists; partial portal rebuild rejected (10-28, only 79 projects have priced portal configs).
- **Builder price proposals on live (10-29).** Migration `builder_listing_changes` is on dev only. Live needs it and an explicit OK. One real builder submitting one real price is not done.
- **Risk record (11-03).** 127 UP-RERA complaint counts are pending drafts on dev; none approved, none on live. Owner decides the wording of complaint counts and who approves.
- **`LeadObjection` has no writer (10-26).** Builder briefs never show objections. Build or drop?
- **Sign-in on live (10-27/29).** Supabase project `eargxntetfmtdpwedjbd` hit `exceed_egress_quota`; live login failed. Upgrade, remove the spend cap, or move login (week plan Day 3 decides; nothing moves before that).
- **Junk Supabase accounts.** About 23 of 34 Auth accounts are test emails; deletion needs the owner's list and working Auth.
- **Rate limits on the real IP.** Needs a proxy-secret env var on Vercel and Render.
- **Secrets leaked in git history (10-02).** Rotate the `admin@propfyndr.in` password, the app's Langfuse key pair, shared staff passwords, and both Neon passwords (shared in a chat, 10-29). The Claude Code Langfuse MCP key was replaced on 10-27.
- **PostHog privacy (09-13, verify).** Chat text was sent verbatim (`trackSearch(userText)`) with session recording on and `maskAllInputs:false`. Settle before beta.
- **Callback and site-visit endpoints** have rate limiting only, no captcha. `WebhookDeadLetter` replay needs a scheduler.
- **31 security warnings in backend packages** on Render's install (1 critical, 6 high).
- **All 382 live projects are `draft`**; nothing uses the label to hide them. Owner decides what it means.
- **Data calls** (week plan Day 4):
  - Row conflicts in `docs/benchmark/C1_DAY6_ROWCHECK_2026-10-31.md`: duplicate Mahagun Meadow (and ATS Destinaire on live), Eureka Park status and metro, Astralis RERA and type, Mezzaria rate and metro distance, cost-sheet base rate vs computed rate.
  - 16 RERA numbers shared by different projects (withheld, never guessed); 57 malformed; 4 same-name/different-RERA pairs; 162 projects with no usable number.
  - 18 `delivered` with no OC; `land_title_clear`/`litigation_count=0` on 226 rows; `average_delay_months=0` on 39 builders; 80 placeholder coordinates.
  - IFMS is stored per sq.ft against a schema comment that says rupees. Whether the 1% stamp concession applies above ₹1 Cr needs a CA.
- **Referral reset** to one "Furqan Arth" root: `scripts/reset-referral-tree.ts` (dry run by default). Blocked until `furqan@realtyask.in` is an admin on dev.
- **Old Langfuse readers.** The 4 `scripts/*langfuse*` scripts stop working on 2026-11-16. Deleting them needs the owner.
- **Neon restore window** is 6 hours on both databases; no off-site daily copy yet. Live DB is 230 MB of 1 GB.
- **Supabase dev tables.** After a week on dev Neon (from 10-29), decide whether to delete dev's old tables from Supabase.
- **Landing page.** Dark landing restored 10-31 (revamp reverted). Keep dark, revamp or both is decided on visitor numbers (week plan Day 7).

---

## AI providers and cost

- **Chain order follows tool capability, never speed or billing** (08-30). Current chain: CLAUDE.md § Infrastructure.
- **Race instead of a shorter timeout (10-29).** If a leg has not spoken after `FALLBACK_HEDGE_MS` (5 s), the next eligible leg from a different vendor starts alongside it; the first to speak is shown, the other aborted. Nothing is forwarded before a first chunk. `FALLBACK_TURN_BUDGET_MS` is 30 s.
  - Why: the 10-26 outage (Gemini first token 17–20 s) stalled every Gemini leg and 1 in 7 live answers were the outage notice.
  - Rejected: a plain shorter first-token timeout (loses when the first leg would answer at 6 s and the next takes 8 s); racing two Gemini keys (the outage hits all at once); a fake provider inside production code for tests (the race test uses a local OpenAI-protocol server).
- **Answers from rows when every provider fails (10-29).** `executeWithFallbackChain({ answerFromRows })`; the project-fact lane renders price, possession, RERA and payment plan from rows (`lib/chat/rowsAnswer.ts`). Marked `degraded`, never cached. Open questions still get the notice. `LLM_STUB_MODE=outage` simulates it.
- **Status line within a second (10-29).** `lib/chat/statusLine.ts`, sent when the stream opens; names only a sector or area the buyer typed, never a project.
- **Models are picked by live probe, not by catalogue** (08-30). `npm run health`, `scripts/verify-services.ts`, `scripts/bench-providers.ts` (times each leg on the real route via `legEvents`).
  - Rejected: NVIDIA gpt-oss-120b (latency variance); Cohere command-a-plus (dropped a tool argument); llama-3.3-70b and nemotron-49b (end of life).
- **GitHub Models / OpenAI keys are retired for good** (08-30). Never re-add `models.inference.ai.azure.com`.
- **Cohere, NVIDIA and Cloudflare run as `provider:'openai'` legs with a `baseUrl`** (08-30). Rejected: a native Cohere adapter.
- **Cooldown keys on env key + model.** Only lasting failures (quota, auth, retired) cool down, for 5 min; timeouts and 5xx never do (08-27). `rateBudget.ts` keeps a sliding 1-minute window per key.
- **Fallback-chain rules (09-05/06):** OpenAI-compatible legs use `item.model`; flash-lite rejects `thinkingBudget:0` (floor 128); a leg that is streaming is never interrupted; if a vendor returned empty, skip its sibling legs.
- **A discarded answer tells the next leg why (11-03).** `retryNoteFor` appends a `## CORRECTION` block (up to 3 violation details) to the next leg's prompt only (`modelPrompt`); every check keeps reading `prompt`, so a rejected figure never counts as supplied. Why: live 27–29 Oct, free key 1 and free key 2 invented the same kind of price in one turn. Appended at the end, so the cached prefix is unchanged.
- **Groq legs are skipped when the request exceeds its per-minute allowance (11-03).** `exceedsGroqRequestLimit` (`GROQ_TPM_LIMIT`, default 8,000) on system prompt + capped messages + reply ceiling, in the loop and in `pickHedge`. Why: live 27 and 29 Oct, all four Groq keys returned 413 "Requested 15750" on the same turn. Rejected: trimming the prompt for Groq only (a second prompt shape breaks the prefix-cache rule).
- **Turns where prose is secondary** (cards or a table already shown) go to the lite model with thinking 0. Discovery thinking is capped at 256 (09-03).
- **Integrity guard** (`answerIntegrity.ts`) runs on every leg (09-05). Discard classes: fabrication, META_LEAK, INVENTORY_SIZE, unfounded_warning, raw_payload, broker_hype. Scan runs on raw text before any rewrite; its reference set is the DB, not the prompt.
- **Prompt caching** (09-24/25): fixed head first; a lane-gated block only at the END; gates read only keys of `getCachedBasePrompt`; per-turn content below `SYSTEM_PROMPT_BOUNDARY` with `## THIS ANSWER` last. Pinned by `promptPrefixStability.test.ts` and `promptHeadSize.test.ts`. Only the implicit prefix cache works on free keys. Rejected: the 1,800-token head target; a compact prompt for small models.
- **Playbooks:** at most 2 per turn, none on a greeting; `SELECTION_ORDER` ranks factual above persona. Shortlist facts capped (relations 4, amenities 8).
- **Cost records** (09-11b): `AiUsageEvent.prompt_tokens` raw, discount in `priceFor`; NULL `pricing_version` rows are legacy, never summed with new ones; `cost.test.ts` fails on an unpriced model. Gemini rates double on 2027-01-01.
- **Real-model tests are opt-in** (`RUN_LIVE_LLM_TESTS=1`); `npm test` runs offline. A key in `.env` is not consent to spend.
- **Stream reconnect never re-runs a turn**; it replays buffered output (`tailBufferedEvents`) (10-02).
- **Embeddings: Cohere `embed-english-light-v3.0`, 384 dims, no fallback** (09-25). `search_document` / `search_query`; batch ≤ 96. Rejected: in-process embeddings (420–530 MB on 512 MB Render).
- **Intent** (10-16): pure calculator questions skip the intent model (`deterministicCoversMessage`). `INTENT_BUDGET_MS` 12 s; lowering to ~5 s pending. Rejected: Needle 3 (15/32 vs 27/32 deterministic); fine-tuning.
- **Langfuse on SDK v6 (OpenTelemetry)** with its own always-sample tracer, never global, because Sentry samples 10% (10-23). One `chat_turn` span per turn; `completionStartTime` records first chunk. Sentry v10.
- **`maybeCompress`** has a 4 s deadline and honours the chain's cooldown (09-06).

## Prompts

- **No remembered market figures in prompts (11-03, uncommitted at time of writing).** `prompts/base.ts` and `playbooks.ts` drop corridor price bands, typical yields, densities, appreciation tiers, TDS and tariff figures; added rules 22 ("nothing from memory") and 23 ("a price belongs to its project"); no star ratings. Statutory rates stated exactly (7% stamp, 6% woman primary owner, 1% registration); builder charges only from the cost sheet.
  - Why: those figures had no tier, and the model quoted them as fact.
  - Must pass `promptPrefixStability.test.ts`, route replay and the 60-question corpus before commit.
- **Comparison prompts never rule (10-31).** Sector and project comparisons: no winner, no "superior", "capital deployment", "appreciation", "returns"; "the difference that matters most" and "choose X if … choose Y if …"; an empty field is "not on record"; ready status is not an OC; a past RERA validity date is named. A comparison of named projects does not inherit a sector the intent pass guessed.
- **A prompt rule the model keeps breaking becomes code (11-03).** See `dropUnsourcedJudgements` under Answers.

## Chat routing

- **Regex gate cascade stays** (09-02/04). Failures were gates defeating a correct resolution, not classification misses. Rejected: routing by LLM tool calls; the full dispatcher rewrite. `answerAsGeneralQuestion` is the floor; nothing below it may refuse.
- **A literally stated fact is not the model's to overrule** (09-06). `intentDeterministic.ts` and `applyLiterals` run at every exit of `extractIntent`.
- **A handler matches on what was ASKED in this message, never on sticky intent** (09-02/04). `purpose`, `workplace`, `sector` carry over, so they must not decide the topic.
- **DISCOVERY needs a property-search signal** (`hasPropertySearchSignal`); **DRILLDOWN needs a project in scope** (09-02).
- **Focus:** a follow-up keeps the focused project (`focusCarry.ts`); cleared only when THIS message names a project, sector or location, or starts a fresh search; a carried focus is not a referenced project; when focus is lost fall back to `focus_project_id` or a single shown card, never the first card of a list. Rejected: judging the referent with the LLM.
- **Fresh search** (09-26, 10-26): a revised budget, BHK or "bigger" is a fresh search; any budget change re-runs discovery; budget survives a sector change; excluded sectors are a hard filter that carries across turns.
- **Bare refinements are searches (10-28).** A message that is only a revised slot ("1 cr", "Budget -2 cr", "what about Sector 150?", "just the ones above 3.8 cr") is answered in code from the carried intent (`isBareRefinement`, `lib/chat/followUp.ts`). Rejected: a bare number without a unit ("30000" may be rent or EMI); an amount right after our own ask for a price (it stays with the EMI check).
- **Row choice (10-31).** `discovery/pickProjectRow.ts` and `projectRowRank.ts` replace first-row-wins in seven handlers: a stated sector beats an exact name, an exact name beats a longer one. Rejected: `orderBy name` at each site; resolving once in the router.
- **Name and sector matching:** names via `matchProjectInText`/`matchProjectsInText` (longest match), never `.includes`; `topicText` strips names before topic regexes; sectors via `sectorWhereClause()` and `sectorMentions.ts`, never `contains`. A run of plain numbers after "sector" is a list and is searched across all (10-31). A bare number shared with another city resolves to GNW if it is a GNW sector, else Noida, with `sectorAmbiguityNote`.
- **Not a budget** (10-02/14): amounts tied to cash, a quoted or asking price, a down payment or a calculator question.
- **Location phrases resolve from the DB** (`locationResolver.ts`); a corridor is a line with a 2 km half-width. Extend it by tagging `micro_market` in data. Rejected: a hardcoded alias list; LLM resolution.
- **Topic lanes added 10-31 to 11-03:** `offTopic.ts` (jokes, markets, weather, sports, code, "which model": one code line plus a property question, no model call; other cities: one sentence plus "Would a home in Noida work for you?"); `alternativesChoice.ts` ("X or Y", both sides from rows, no ranking); `sectorRateCheck.ts` (quoted rate vs our range, no verdict); `projectCatch.ts` ("what could go wrong", "risks of X", "is X safe / the safer buy"). "Higher/lower/cheaper than" between two sectors goes to the sector comparison; two named projects never get the sector table.
- **Persistence:** every lane that answers persists through `persistEarlyTurn`, including `focus_project_id`. The next turn of a session waits for the previous turn's rows (`trackPersist`/`waitForPersist`, max 4 s) on both persist paths (11-03; follow-ups had read a history missing the last turn).
- **The unknown-project check** runs right after `resolveProjectNames`, only for a name in this message.
- **The OPEN lane checks the `CHAT_TOPIC_HANDLERS` registry** (09-24). Order matters: `offTopicHandler` sits before `trustHandler`.
- **Every routing fix adds a case to `src/lib/eval/route-replay.json`.** Known gaps pinned as "(known gap: …)".

## Answers

- **One question per answer, closing with the next step** (09-03), enforced by `oneQuestion()`. It keeps the run of questions the reply closes on, not text after the first `?` (10-28). Do not restore "factual answers end flat".
- **Card budget** (`cardBudget.ts`): 0 stated constraints → 0 cards plus a question; 1 → 4; 2+ → 6; a project in focus → 3.
- **Prompt top-N** is 12 projects on DISCOVERY, 5 otherwise; prompt block and renderer share one scope.
- **The shown list is `last_projects`; ordinals index it** (`reference.ts`). "The ones above 3.8 cr" is a filter.
- **Never size the database to a buyer**, including sector-scoped counts (HARD RULE 7). Counting what is on screen is fine.
- **Over-budget results** (10-05): retrieval up to +10% in an "Above the Stated Budget — NOT MATCHES" block; `budgetHard` has zero tolerance; a floor needs a priced unit that reaches it; honest "no match" beats padding.
- **A searched size that the sector lacks** lists the same sector's other configurations, labelled so (10-31). Rejected: a citywide fallback.
- **Computed in code; the model writes only the judgement:** affordability and market tables (`ai/affordability.ts`); "most expensive" (`aggregateQuery.ts`); appreciation what-if at 0/4/6/8/10%, labelled "arithmetic, not a forecast" (`RECORDED_SECTOR_CAGR_TRUSTED = false`); two-sided choices; quoted-rate checks; maintenance rate × area; DG rate beside water source.
- **Verdict words dropped in code (11-03).** `dropUnsourcedJudgements` removes "objectively", "zero-delay", "clean legal standing", "unblemished", "risk-free", "superior choice", "capital deployment", and an OC row that reads Delivered or Ready, unless our own facts carry the words (`falseReassurance.test.ts`). Why: hard-43 Q5 called Mezzaria objectively safer while UP-RERA lists 53 complaints and our own row shows lapsed validity. Rejected: a longer prompt rule.
- **Integrity checks tightened (11-03), `projectFactChecks.ts`:**
  - `crossProjectFigures`: a bullet or table line inherits the project named on the line above; a plain line naming none ends the carry. Why: "**X**" then "- from ₹1.85 Cr" was never checked.
  - `dropUnsourcedMeasurements`: metres ("800 m from") and travel hours ("1.5 hours by road") are checked, matched against our km/minutes after conversion. Hours only before drive/by/away/commute/journey/ride/from, so "24 hours power backup" stays.
  - `recordContradictions`: in a sentence naming two projects, a claim belongs to the project named nearest before it (else first after). Why: live 29 Oct, "Choose Gulshan Ikebana if you prioritize litigation-free…" was discarded as a claim about Jaypee Klassic (10 litigation records), three legs in a row.
- **Own-tier citations are kept (11-03).** `sanitizeOutput` no longer collapses "(Source: project records)", "(source: UP-RERA registry, read <date>)", "(UP law, statutory)", "(confirmed by the builder on <date>)" to "(market data)", unless the bracket also names an outside site (`OWN_SOURCE_RE`/`OUTSIDE_SOURCE_RE`). Why: it put our own and official facts in the market tier.
- **Cost totals for named projects at the asked size (11-03).** `namedProjectsCost` in `statutoryTax.ts`: every project the message names, at the BHK asked; "No 3 BHK price is on record for X" when absent; an undated-price note said once. Why: hard-43 Q7 got one project's cheapest 2 BHK.
- **A builder's other projects (11-03).** `developer_of_each` answers "what else have they delivered" with the builder's other projects we hold, status as stored, and says the list is not their history and "Ready to move" is not an OC. Why: hard-43 F15.
- **"What I checked" line (11-03, owner asked).** `lib/chat/checkedLine.ts` builds it in code from the text the buyer received, at `done`, in the router's one `send` wrapper (so every lane and cached replays get it); the frontend shows it as one muted line under a finished answer (`message.checked`, `MessageBubble.tsx`). Labels only from markers in the answer: catalogue project names or cards ("RealtyAsk records"), statutory levies ("UP law"), `computedQualifier`, `publicRecordQualifier`, "We read UP-RERA's registry", `MARKET_QUALIFIER`, and "not on record" gaps (the undated-price note is not a gap). No line when nothing matches. A lane may set its own `checked`.
  - Why: Perplexity-style "what I checked" is the strongest trust pattern in the teardown; tier words only, no outside site named.
  - Rejected: a model-written sources line (it would cite what it did not use); naming portals.
  - Stored with the answer (owner asked, 11-03) as a `{ type: 'checked', labels }` entry in `chat_messages.artifacts` (JSON already there, no migration), at every chat-router write site via `checkedLine.withChecked`; `restoreMessage` in `frontend/lib/chat/sessionRestore.ts` reads it back. `deterministicFactRouter.ts` writes its row before `done`, so it computes the labels once, stores them and sends the same list as `checked` (a lane's own `checked` wins in the tracker). Guarded by a source test in `checkedLine.test.ts`.
- **Not done, on purpose (11-03):** rewriting a possession label that contradicts its status (owner policy: no caveat on stored values; Day 4 data decision); a code check of comparison wording against the table (too many false positives for a discard); Hinglish replies (not this cycle); lowering `INTENT_BUDGET_MS` (Day 5 measures first).
- **Complaint counts (11-03).** Staged as pending `project_field_drafts` (`rera_complaints`, URL, read date) by `scripts/data-integrity/28-complaints-drafts.ts`; approved by a named person (`29-approve-complaints.ts`); read only by `loadComplaints` in `handlers/projectCatch.ts` as one fixed sentence ("We read UP-RERA's registry page for this project on <date>: it lists N complaints…, not a ruling"). Rejected: a new `Project` column; reading drafts in the prompt path; naming the portal's address (the sanitizer deletes that sentence).
- **Dates and possession:** a date shown must be in the prompt (`unsourcedDates`, `projectFactChecks.ts`); a passed possession date on an undelivered project reads "was due, status unconfirmed"; a passed RERA validity is "on record" with the extension caveat. Rejected: `db:fix-statuses`.
- **Price trend:** a rate only between two observed points; benchmark points labelled, never turned into a rate.
- **Withheld facts say "not published"**, never "not in our records". `ORIENTATION_IS_SOURCED = false` (stored facing is templated).
- **Fixed answers:** `MODEL_ANSWER` for "which model are you" (no vendor named; more than one serves a turn); "are listings verified" says we have not inspected the sites.
- **Every stored project fact is answered as stored (owner, 10-27).** Scope and the still-withheld list: CLAUDE.md § Owner policy. In code: `projectExposure.ts` (7 formerly withheld columns public, sentinels and opaque-score lists empty, builder corporate detail stated), `projectFactsBlock.ts` (topic slices, `marketing_claims` as developer copy), `answerIntegrity.ts` (a score passes when its number is in the prompt). The owner accepted that `nclt_status`/`approvals_status` are false on Amrapali/Jaypee.
- **Cost sheets and payment plans answered as stored (owner, 10-27).** Rejected: running pass 3 on live; hiding schedules until a builder confirms. `renderCostSheetTable` lists floor rise, electricity, water/sewer, each PLC line, other charges; "club membership", "IFMS", "electricity connection" route to the cost sheet.
- **Outage over a shown answer:** keep cards or a table already shown and close in code (`outageOverShownAnswer`); otherwise the notice with `replace: true`; on full failure name no project, `degraded:true`.
- **No off-platform referrals.** No outside phone numbers; ask for the buyer's. `rera_url`, `hero_image_url`, `marketing_claims` excluded from prompts except as stated above. No competitor or listing portal named to a buyer.
- **Unclear referent:** "I'd rather ask than guess". `resolvePointer.ts` rewrites only the model's copy.
- **Grievance and money-assurance sentences are replaced whole.**
- **Chips** (`chipPolicy`): none on grievance, refund, ID, probe, decline or outage turns; never a generic set; actionable only.
- **Sanitizer (`sanitizeOutput.ts`)** collapses citation-shaped parentheses to "(market data)" and deletes whole sentences that name an outside site (`OFFPLATFORM_REFERRAL`). A code-built sentence with a source must be checked through the real route. It no longer cuts a sentence at "per sq. ft".
- **Answer cache** (10-24): matches factual questions on content words and numbers bound to units; key carries a catalogue stamp; namespace `REDIS_PREFIX` in `ai/semanticCache.ts` (`ac:v15` on 11-03), bump after any behaviour fix. No writes with a project in focus; stateful and public-record answers never cached. Rejected: embeddings.
- **News lane** never adds a cross-builder project list to the prompt.

## Data integrity and catalogue

- **Fact tiers** (`factPresentation.ts`): confidence follows the weakest tier used. Rejected: a "typical value" fallback.
- **`null` means "not checked"; never coerce it to `0`/`'LOW'`.** A `0` litigation count is a claim that the record is clean.
- **Fix scripts clear bad values and never invent replacements.** A value shared by more than 3 rows is a template. Duplicates archived (`archived_duplicate_of`), never deleted. Same name with a different RERA number goes to a person.
- **Measure a column's distribution before trusting it** (`npm run audit:synthetic`).
- **Builder insolvency (`legal_flag`) is surfaced first**; contradicting project markers suppressed.
- **Geography:** stored connectivity distances are synthetic; lat/lng is the only trustworthy geo; coordinates with ≤ 2 decimals are placeholders; no synthetic sector centroids.
- **Freshness** (`dataFreshness.ts`): construction data hidden after 30/90 days; compliance never hidden; price confirmation via `FactVerification` (BUILDER_ATTESTED/VERIFIED, date, who), stale after 30 days. Rejected: new `price_verified_at` columns.
- **Statutory figures** come from `UP_STATUTORY`, never the `cost_sheets` stamp/registration/GST columns (schema defaults). Women's stamp duty 6%, no cap; registration flat 1%, no cap.
- **Placeholder documents are hidden** (`realDocuments.ts`: only files in the `project-docs` bucket).
- **Document extraction is local** (10-28): `backend/scripts/doc-ingest/extract_pdf.py` in a gitignored `.venv`: `pypdfium2` for digital pages, RapidOCR (ONNX, CPU) for image pages, one page at a time, stops below 1 GB free RAM. 12-page digital brochure 1.4 s / 48 MB; image pages ~11 s each. pdfplumber off by default (69 s, 943 MB). Rejected: Docling (torch), MinerU/Surya/olmOCR (GPU), PyMuPDF (AGPL), ScrapeGraphAI, Gemini PDF reading. Brochures give areas, towers, RERA; not prices or payment plans.
- **Field exposure:** `projectExposure.test.ts` fails on any unclassified column; `portal_subdomain`, `rera_compliance_score` never public.

### Data-integrity pipeline (10-28)

- **What:** `backend/scripts/data-integrity/` crawls UP-RERA (plain HTTP postback, no captcha, no browser) and researches builder sites and portals per project. Every finding is a pending `project_field_drafts` row (in `FORBIDDEN_RELATIONS`); promotion is a person's call, field by field.
- **Why:** 36 of 119 "exact" stored RERA numbers belonged to a different project; the first 96 researched projects disagreed with our unit, tower, area and price values in ~80% of comparisons.
- **Owner override (10-28, "for once"):** portal and builder-site facts written to project columns, applied via `08-apply.ts` with per-field guards and an `AuditLog` row each, dev first, then live in the same order. These are portal advertisements or the seller's claim, not inspected facts.
  - Batches 1–3: 74 RERA number replacements, 150 registry-verified registration rows (`project_rera_registrations.source = up_rera_registry`), direct registry links, `total_units`, `total_towers`, `land_area_acres`, `architect`, `floors`. Both DBs verified at 150 registry rows, 214 audit rows.
  - Batch 4: 87 empty `rera_valid_until` from the registry's declared completion date (empty only).
  - Batch 5: lat/lng for 50 of 57 projects via Google Places text search (`11-geocode.ts`).
  - Batch 6: possession bundle for 16 projects (`12-possession.ts`; builder-site quote or two agreeing pages; never flattens an informative label).
  - Batch 7: nearest listed hospital (78) and police station (111), straight-line km (`13-nearby.ts`; a hospital must say hospital/nursing home/medical centre and have 10+ ratings).
  - Batch 8: land area 54, units 47, towers 46, floors 13, possession label 35, date 9, status 12 from extra portals. Architect is fill-empty only.
  - Stock photos: 70 Unsplash heroes replaced with the project's own first real gallery image; 46 stock-only gallery rows deleted (`14-stock-images.ts --restore <backup>` puts them back).
  - Videos: 27 official-channel videos inserted, unverified (`15-videos.ts`, whole-word 80% title match).
  - Rollback: `10-rollback.ts` (dry run by default) restores each plan's recorded old value.
- **Rules kept:** a RERA match with name score < 0.5 dropped; < 0.6 with no builder link and one source page rejected; number claims shared by several projects dropped; ordinal mismatches ("2nd Avenue" vs "7th Avenue") dropped; a trailing date in a RERA number is valid (774 of 3,842), never "cleaned". `price_min_cr` and `possession_label` held back (coupled fields). `registry_status` holds internal sales states, not RERA status.
- **Portals:** plain request, client string `RealtyAsk-data-integrity/1.0`, `robots.txt` first. Used: Square Yards, MagicBricks, Whitehat Realty, Realty Assistant, Investors Clinic. Refused or forbidden, never worked around: 99acres, Housing.com, Proptiger, CommonFloor, IndiaProperty. Not tested: NoBroker, Zricks, Makaan, PropertyWala.
- **Rejected:** auto-writing to live overnight; rebuilding unit prices from portals (79 projects only, templated unit rows can't take a per-BHK range).
- **Open:** 163 projects with no confident registry match; UP-RERA Completed, NCLT, Abeyance and Withdrawn lists not crawled; 846 drafts on dev; 149 source conflicts; search budget exhausted (both Tavily keys over limit). `has_security_24x7`/`has_cctv`, airport and school distance not filled (templated or ambiguous).
- **Backups:** `RealtyPals-data-integrity-2026-10-28/backup-{dev,live}-*.json`.

### Earlier backups

`backend/backups/templated-data-2026-10-05T*.json`; `backups/sector_intelligence_full_2026-10-14.json`; `backups/live-public-2026-10-14.dump`; `RealtyPals-db-backups/supabase-2026-10-15-snapshot/`; `neon-2026-10-16-pre-migration.dump`; `{neon,supabase}-2026-10-16-enrich129-columns.json` (129 projects' due-diligence columns, nulled); `backend/backups/templated-pass3-dev-*.json`; `backups/dev-before-restore-2026-10-27T11-18-53-082Z.json`.

## Buyer features

- **A guest token is an identity.** Adopted on login (08-18). Bot sessions flagged (`is_bot`), never blocked (09-15).
- **Dossier:** `lib/dossier.ts`, Postgres, shareable by guests, prices the buyer's BHK. No "verified" or "forensic" copy. Rejected: Redis.
- **Memory is opt-in.** `UserMemory` is never loaded into a new chat on its own; the route is `savedProfile.ts` plus a chip (10-15).
- **Resale:** only for a flat the buyer already found: checklist and arithmetic on their numbers. Never listings or "is this price fair".
- **Public records:** official sources only. Rejected: listing portals and builder sites.
- **Checklist ticks are stored on the device** (`localStorage`).
- **Office map pin** only for sectors in `SECTOR_CENTROIDS`.
- **The buyer journey funnel is one SQL query** (10-23).

## Supply side, leads and roles

- **Builder price and sold-out proposals (10-29, dev only).** `/builder/portal/prices` → `/admin/listing-changes`; `listing_changes` table; approval (`lib/listingChanges.ts`) writes the flat type, `price_history` (with `unit_type_id`, `submitted_by`, `approved_by`), builder-attested `FactVerification`, `AuditLog`, and recomputes `price_min_cr`/`price_range_label`, in one transaction; refused if the row changed since. `UnitType.availability` ('available' | 'sold_out') is hidden from every read by `lib/excludeSoldOutUnitTypes.ts`; admin, portal and approval code opt out with `availability: undefined`. `scripts/verify-listing-changes.ts` runs the flow on dev and restores it.
  - Rejected: reusing `project_field_drafts` (project-level, no submitter); deriving sold out from `unit_inventory` (no project has unit rows); partner submissions for now (status leaves room for `pending_builder`).
- **Admin access:** gate on the path prefix (`adminAreaGuard`), exemptions `/auth` and `/team/accept-invite`; role matrix `adminPolicy.ts decide(role, method, path)`, pinned as a table. Rejected: per-route `requireRole`.
- **Roles:** SALES reads everything, writes only leads and callbacks. ANALYST edits data and content, cannot delete projects or builders, bulk import, or read leads. SUPER_ADMIN alone gets audit logs, AI spend, team, outbox and team marking. Unlisted reads open, unlisted writes closed.
- **`requireAdmin` is authentication only.** Routers outside the admin area use `requireStaff` (`guardsOutsideAdminArea.test.ts`).
- **Invites:** invitees set their own password; `resend-invite` idempotent; a password change revokes all sessions; forgot/reset return the same response.
- **Tenant subdomains are addressing, never authorisation.** Partner subdomains are flat.
- **Leads:** `CallbackRequest` is the one lead table, routed by `assigned_partner_id` (`BuilderLead`, `ChannelLead` dead). A channel partner belongs to a builder, and we approve it. Equal round-robin via `nextInRotation()` until conversion data exists.
- **Lead Brief:** no transcript ever (rejected: a filtered transcript). `scrubCompetitors` matches whole words.
- **Builder lead alert:** link-only email, OFF unless `BUILDER_LEAD_EMAILS=on` (dev holds real builder logins).
- **Webhook:** `lib/webhook.ts` is the only outbound lead webhook; failures parked in `WebhookDeadLetter`; `routes/internal.ts` needs `INTERNAL_API_KEY` (503 when unset).
- **Notifications** are queued in `NotificationOutbox`, never sent until a provider exists.
- **Blog and news:** SUPER_ADMIN and ANALYST only; published items archived, never deleted; drafts generated manually by Groq gpt-oss-120b (20b rejected, invents figures); a link kept only if Tavily returned that exact URL.
- **RealtyMail key:** `accounts` scope only (the `domains` scope can delete the mail domain).
- **Logo uploads:** no SVG.

## Analytics and people counts

- **A person is `realPeopleSessions` in `routes/admin.ts` (10-27):** a signed-in account, or a website guest token (`isWebsiteGuestToken` in `lib/botDetection.ts`: `guest-` + UUID, or `guest-` + 16–22 base36). A guest who later signed in is merged via `referral_visits`. Anything else is a script.
- **Every chat session create site takes `sessionFields`:** `is_bot` (also when the token isn't website-format), `device` from the user agent, `source` as a host or `utm_source` only.
- **`team_identities`** marks team people: named in User behavior, excluded from counts. SUPER_ADMIN only, audited.
- **Questions endpoint** `/analytics/people/:key/questions`: audited; ANALYST and SALES refused (transcript content).
- **Dashboard counts callbacks with `is_test = false`.**
- **Rejected:** keeping `guest_token` on an adopted session (anyone holding the token could open the account's chats).
- **Neon live cleanup (10-27):** 40,258 test sessions and 5,205 script/fake-account sessions flagged `is_bot`; 54 look-alike script guests flagged; all 1,531 callbacks deleted (1,529 dummy 9876543210, 2 owner tests); 23 fake Supabase accounts deleted. Backups `backend/backups/live-test-traffic-live-2026-10-27T07-50-04-070Z.json`, `live-fake-users-2026-10-27T07-59-24-358Z.json`.
- **All-time result at 10-27 (7 Aug–27 Oct):** 78 people (73 guests, 5 signed in), 310 sessions, 1,410 messages, 11 accounts, 0 leads.
- **Health-check traffic** uses `healthcheck-<uuid>` tokens, kept out of real-people counts.

## Referrals

- **The first ROOT holder is claimed by a conditional update in one transaction**; losers attach as generation 2 (10-13). Metrics in Postgres. Revoking a ROOT stops new attribution into its tree. Open: "activated = 3+ messages" also counts assistant replies.

## Infrastructure

- **Databases (10-29):** live is Neon project endpoint `ep-super-water-aof3o8gy` (pooled URL, `pgbouncer=true&connection_limit=5`); dev is its own Neon project `ep-odd-bar-az91o2md`, copied from Supabase dev with `pg_dump`/`pg_restore` (75 tables, 75,586 rows, migration ledger included). Supabase keeps login and file storage for both; never delete that project. `src/lib/liveDatabase.ts` identifies live by endpoint. Map: `docs/ENVIRONMENTS.md`.
  - Why: dev test traffic used Supabase's egress allowance and live login failed (`exceed_egress_quota`).
  - Rejected: moving login to Neon now; a Neon branch of live (shares compute and transfer); keeping dev on Supabase with lighter testing.
  - Rule: a test never points at **live** Neon. `npm test` refuses a live `DATABASE_URL`.
- **Migrations:** never merge migrations to main until `prisma migrate status` against live Neon shows them applied (Render does not run migrations). Never run `prisma migrate deploy` blindly on Supabase (a pending migration drops a table). Migrations and data writes need the owner; the owner runs live writes after a backup.
- **Render:** live `srv-d94csqsvikkc73c4lqi0` (named `realtypalsdev`, branch main); dev `srv-dauhdddg1s2s73cutjo0` (`propfyndrdev`, branch dev, `REDIS_KEY_PREFIX=dev:`; local `.env` needs it). cron-job.org pings `/api/v1/healthz` on live only; dev sleeps (750 free hours cover one service). No Render health check on either. Dev and live share one Upstash quota.
- **Node 22 pinned** (`.nvmrc`, CI) to match Render (11-03).
- **No dynamic import of a `.guards`-style path (11-03).** `chat-router.ts` imported `queryPlanner.guards` with `await import(...)`: fine under compiled CommonJS on Render, `ERR_MODULE_NOT_FOUND` under tsx (local runs and tests), because ".guards" reads as an extension. Now a static import.
- **Release check (11-03):** `scripts/release-check.cjs` compiles the committed tree in a clean copy; `.githooks/pre-push` runs it. `core.hooksPath` had pointed at a missing folder, so no hook had ever run. Why: a 31 Oct push with six compile errors reached Render, which refused the build.
- **Chat cards are stored compact** (`chatStorage.ts`). Re-check DB size monthly (live 230 MB of 1 GB).
- **`app.realtyask.in` is the buyer host.** URLs from `frontend/lib/site.ts`. Open: wildcard DNS for partners.
- **PostHog key lives only in env.** Check `NEXT_PUBLIC_POSTHOG_KEY` on Vercel before a frontend deploy.
- **Rejected:** Prisma `relationJoins` (changes every query); new migrations for a log line (use `AuditLog`).

## Design and brand

- **Brand is RealtyAsk; lowercase `propfyndr` identifiers stay** (10-12). Brand regexes match `(?:propfyndr|realtyask)`.
- **Discovery keeps the lavender `.discover-canvas` and the Afacad "RealtyAsk" wordmark** (owner, 09-26). Light theme default; radius scale not remapped globally.
- **Landing page:** the dark landing from before the 14 Oct revamp is restored (10-31, `4bafed7b`). Final choice on visitor numbers.
- **No verdict words for buyers** (STRONG BUY, "% confident", stars). Cards show a reason and a trade-off. Price format "₹1.09 – 1.83 Cr".
- **No invented counts on the landing page.** Share preview is a static JPG under 300 KB.
- **RERA pills only for numbers we hold.** The drawer says we have not inspected the site.

## Testing and evaluation

- **Route replay** (`LLM_STUB=1`, `src/lib/eval/route-replay.json`, 225 cases) is the offline gate. `npm run verify:chat -- --endpoint=<url>` is the multi-turn deploy check; assert on the `done` payload, not prose. Run one replay at a time (needs ~2.5 GB free).
- **60-question corpus** (`scripts/corpus/run-corpus.ts`): 60/60 on dev, 31 Oct. **Hard-43** (`scripts/corpus/hard43.json`, `day5-speed.ts`): scorecards in `docs/benchmark/`. Grade what the buyer sees: harnesses render `replace: true` as the client does.
- **Health check:** `npm run health:chat -- --base <url>` (30 questions × 3); `done.cached` separates cache hits.
- **No vacuous tests:** no `200||400||500`; no `if (found)` guards; no hardcoded "≥75%"; placebo tests marked `todo`; exemptions via a named allowlist with a reason.
- **Write the over-correction test in the same commit as the guard.**
- **Don't pipe gate commands through `tail`** (swallows the exit code). Keep `npm run build` in the gate.
- **The backend suite is load-sensitive**; re-run before believing a failure. `chatRouterSize.test.ts` fails on HEAD (router ~7.5k lines). `comparisonHandler.test.ts` failed 9 !== 8 before the 10-31 work.
- **Buyer-vocabulary regexes need inflections** (`refund\w*`).

## Process

- **Instrument before optimising** (`turnTimer.ts`); every unmeasured latency theory was wrong. Debug locally: read the log and the DB row.
- **Before concluding a fix failed,** check that port 3001 is really your server; kill a server by the `pid` in its JSON log.
- **Check free memory before `next dev` or a full replay** (ERRORS.md 10-26, 11-03).
- **Data-quality reverts are the owner's call.** Surface conflicts; don't resolve them silently.
- **Write regexes with Write/Edit, never through a shell heredoc.** After a scripted regex edit, grep for `chr(8)`.
- **Before moving or deleting files, grep for whatever reads them.** Never delete gitignored corpus `results-*.json`.
- **Competitor answers teach patterns, never facts** (10-31, `docs/COMPETITOR_PROMPT_GUIDE_2026-10-31.md`). No competitor or portal named on the platform; nothing from their answers goes into the DB unverified.
- **Week plans:** a task is ticked only with its proof file in `docs/benchmark/` (cycle 2: `C2_DAY<n>_<topic>.md`). Unfinished tasks go to the top of the next cycle with a reason.
- **Repo layout (owner, 10-27):** old roadmaps in `docs/archive/plans/`; current plan is the newest `docs/WEEK_PLAN_*.md`. Kept because code reads them: `QueriesAndKeywords/`, `Projects/`, `newProj/`, `docs/ground-truth`, `docs/enrichment`.

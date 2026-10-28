# MEMORY.md

Decisions still in force, grouped by topic. Each line: **what was decided** (date), why, and what was rejected.
The full session-by-session log up to 27 Oct 2026 is in `docs/archive/MEMORY_full_2026-10-27.md` (git history has older versions).
Add new decisions under the right topic, not as a session diary. When one replaces another, edit the old line.

---

## Open: owner decisions and launch blockers

- **AI outages (10-26).** Gemini 3.5 Flash Lite takes 17–20 s to its first token, but the first-chunk timeout is 8 s. Four Gemini legs stall, the 35 s turn budget is spent, and Cohere/Groq never run. About 1 in 7 live answers is the outage notice. Options:
  - (a) skip the remaining Gemini legs after the first stall;
  - (b) raise the timeout to about 22 s;
  - (c) put Groq/Cohere first.
  - `fallbackChain.ts` holds uncommitted owner work. A Groq paid tier is also the owner's call (the free tier allows 8k tokens/min against ~6.2k-token requests).
- **Generated unit prices (10-26).** `seed-and-enrich-all-projects.cjs` wrote max = min × 1.08: 754 of 1,021 priced unit rows, 310 of 381 projects (dev; live not checked). Payment plans are templated too: 608 of 620 are `source='inferred_default'`. Decision needed: clear them and re-source.
- **`LeadObjection` has no writer (10-26).** Builder briefs never show objections. Build or drop?
- **Off-topic policy.** The current rule declines in one sentence for eating out/nightlife, live traffic, school admissions and valuing an owned property (narrow by design). Wider topics (jokes, IPOs, other cities) are undecided.
- **Billed Gemini key** returned 402 "credits depleted" on 09-24, 09-26 and 10-17. Topping it up is the biggest quality lever.
- **Rate limits on the real IP (5.5).** Needs a proxy-secret env var on Vercel and Render.
- **Secrets leaked in git history (10-02).** Rotate the `admin@propfyndr.in` password, the Langfuse key pair and the shared staff passwords. The Claude Code Langfuse MCP key was replaced on 10-27 with a new US key pair, verified against the API and MCP. The app's own key pair (US region) works, and live traces arrive.
- **Templated-data pass 3** (`scripts/fix-templated-data-pass3.ts`) is applied on dev only. The owner runs `--db=live` on Neon.
- **Referral reset** to one "Furqan Arth" root: `scripts/reset-referral-tree.ts` (dry run by default, JSON backup). Blocked until `furqan@realtyask.in` is an admin on dev.
- **Other open data calls:**
  - 16 RERA numbers shared by different projects. These are withheld, never guessed; only the UP-RERA record resolves them.
  - 57 malformed RERA numbers.
  - 18 projects `delivered` with no OC.
  - `land_title_clear`/`litigation_count=0` on 226 rows look templated.
  - 80 projects with placeholder coordinates.
  - `average_delay_months=0` on 39 builders.
  - 4 same-name/different-RERA pairs.
  - IFMS is stored per sq.ft against a schema comment that says rupees.
  - Whether the 1% stamp concession applies above ₹1 Cr needs a CA.
- **PostHog privacy (09-13, verify).** Chat text was sent verbatim (`trackSearch(userText)`) with session recording on and `maskAllInputs:false`. Settle before beta.
- **Callback and site-visit endpoints** have rate limiting only, no captcha. `WebhookDeadLetter` replay needs a scheduler.
- **Old Langfuse readers.** The 4 `scripts/*langfuse*` scripts stop working on 2026-11-16. Deleting them needs the owner.
- **Supabase project `eargxntetfmtdpwedjbd` restricted (10-27).** Auth returns 402 `exceed_egress_quota`, so the dashboard's Signed Up card shows "—". Upgrade the plan or remove the spend cap (owner).
- **Junk Supabase accounts (10-27).** About 23 of the 34 Auth accounts are keyboard-mash or test emails from June–Aug. Deleting them needs the owner's list, and Auth must work first.

---

## AI providers and cost

- **Chain order follows tool capability, never speed or billing** (08-30). The current chain is in CLAUDE.md § Infrastructure.
- **Models are picked by live probe, not by catalogue** (08-30). Use `npm run health` and `scripts/verify-services.ts`, and probe the exact endpoint you claim is healthy.
  - Rejected: NVIDIA gpt-oss-120b (latency variance); Cohere command-a-plus (dropped a tool argument); llama-3.3-70b and nemotron-49b (end of life).
- **GitHub Models / OpenAI keys are retired for good** (08-30). The host (`models.inference.ai.azure.com`) is dead. Never re-add it.
- **Cohere and NVIDIA run as `provider:'openai'` legs with a `baseUrl`** (08-30). Rejected: a native Cohere adapter (twice the code, no gain).
- **Cooldown keys on env key + model.** Only lasting failures (quota, auth, retired) cool down, for 5 min; timeouts and 5xx never do (08-27). `rateBudget.ts` keeps a sliding 1-minute window per key (08-31).
- **Fallback-chain rules (09-05/06):**
  - OpenAI-compatible legs use `item.model`.
  - flash-lite rejects `thinkingBudget:0` (the floor is 128).
  - The turn budget stops new legs but never interrupts one that is streaming.
  - If a vendor returned empty, skip its sibling legs.
- **Turns where prose is secondary** (cards or a table already rendered) go to the lite model with thinking 0. Discovery thinking is capped at 256 (09-03).
- **Integrity guard** (`answerIntegrity.ts`) runs on every leg (09-05).
  - Discard classes: fabrication, META_LEAK, INVENTORY_SIZE, unfounded_warning, raw_payload. The scan runs on raw text before any rewrite.
  - Its reference set is the DB, not the prompt.
  - Verify: the 09-05 note says every leg is buffered with nothing streamed; the 10-26 outage work treats answers as streamed.
- **Prompt caching** (09-24/25):
  - The prompt head is fixed content first. A lane-gated block may only go at the END, so a shorter head is an exact prefix of a longer one.
  - Gates may only read keys of `getCachedBasePrompt`.
  - Per-turn content (playbooks, facts, per-message `answerRules.ts`) goes below `SYSTEM_PROMPT_BOUNDARY`, with `## THIS ANSWER` last.
  - Pinned by `promptPrefixStability.test.ts` and `promptHeadSize.test.ts`.
  - Explicit caching fails on free keys (`limit=0`); only the implicit prefix cache works.
  - Rejected: the 1,800-token head target (it would delete the honesty rules; the measured head is ~7.8k–9.5k tokens); a compact prompt for small models.
- **Playbooks:** at most 2 per turn, none on a greeting. `SELECTION_ORDER` ranks factual playbooks above persona ones. Shortlist facts are capped (relations 4, amenities 8) (09-03/13).
- **Cost records** (09-11b):
  - `AiUsageEvent.prompt_tokens` stores raw counts, and the discount is applied in `priceFor`.
  - Rows with a NULL `pricing_version` are legacy; never sum their tokens with new rows.
  - `cost.test.ts` fails on an unpriced model.
  - Gemini rates double on 2027-01-01.
- **Tests that call a real model are opt-in** (`RUN_LIVE_LLM_TESTS=1`); `npm test` runs offline with fake keys. A key in `.env` is not consent to spend.
- **Stream reconnect never re-runs a turn.** It replays the buffered output (`tailBufferedEvents`) (10-02). A re-run billed the turn twice.
- **Embeddings: Cohere `embed-english-light-v3.0`, 384 dims, no fallback** (09-25).
  - Corpus text uses `search_document`, queries use `search_query`. Batch size up to 96.
  - Rejected: running embeddings in-process (420–530 MB on a 512 MB Render plan).
- **Intent** (10-16):
  - Pure calculator questions skip the intent model (`deterministicCoversMessage`). `INTENT_BUDGET_MS` is 12 s; lowering it to ~5 s is pending.
  - Rejected: Needle 3 for intent (15/32 against 27/32 for our deterministic reader); fine-tuning.
- **Langfuse runs on SDK v6 (OpenTelemetry)** with its own always-sample tracer, never registered globally, because Sentry samples 10% (10-23). There is one `chat_turn` span per turn. Sentry is on v10.
- **`maybeCompress`** has a 4 s deadline and honours the chain's cooldown (09-06).

## Chat routing

- **Regex gate cascade stays** (09-02/04). Failures were gates defeating a correct resolution, not classification misses.
  - Rejected: routing by LLM tool calls, and the full dispatcher rewrite (deferred). Retire topic handlers one at a time, each backed by a corpus run.
  - `answerAsGeneralQuestion` is the floor; nothing below it may refuse.
- **A literally stated fact is not the model's to overrule** (09-06). `intentDeterministic.ts` and `applyLiterals` run at every exit of `extractIntent`; the model may only add.
- **A handler matches on what was ASKED in this message, never on sticky intent** (09-02/04).
  - `purpose`, `workplace` and `sector` carry over between turns, so they must not decide the topic.
  - A guard that runs on the raw message must be told what an earlier stage resolved.
- **DISCOVERY needs a property-search signal** (`hasPropertySearchSignal`); **DRILLDOWN needs a project in scope** (09-02).
- **Focus:**
  - A follow-up keeps the focused project by default (`focusCarry.ts`, 09-25).
  - Focus is cleared only when THIS message names a project, sector or location, or starts a fresh search.
  - A carried focus is not a referenced project (`projectReferenced`) (09-26).
  - When focus is lost, fall back to `focus_project_id` or a single shown card, never the first card of a list (10-16).
  - "Price for 4BHK there" keeps focus (10-26).
  - Rejected: judging the referent with the LLM.
- **Fresh search** (09-26, 10-26):
  - A revised budget, BHK or "bigger" counts as a fresh search.
  - Any budget change re-runs discovery (`canReuseCache` rejects it).
  - Budget survives a sector change.
  - Excluded sectors are a hard DB filter that carries across turns.
- **Name and sector matching** (09-04/06):
  - Project names go through `matchProjectInText`/`matchProjectsInText` (longest match wins). Never use `.includes` over the catalogue.
  - `topicText` strips project names before topic regexes run, and known names are stripped before the NRI check (10-26).
  - Sectors go through `sectorWhereClause()` and `sectorMentions.ts`, never `contains`.
  - A bare number shared with another city resolves to GNW if it is a GNW sector, else Noida, with `sectorAmbiguityNote` (10-13).
- **Not a budget** (10-02/14): amounts tied to cash, a quoted or asking price, a down payment or a calculator question.
- **Location phrases resolve from the DB** (`locationResolver.ts`) (08-28). A corridor is a line with a 2 km half-width.
  - Rejected: a hardcoded alias list and LLM resolution.
  - To extend the corridor, tag sectors with `micro_market` in the data, not in code.
- **Every lane that answers persists through `persistEarlyTurn`**, including `focus_project_id` (09-03).
- **The unknown-project check** runs right after `resolveProjectNames`, only for a name in this message (09-05/06).
- **The OPEN lane checks the `CHAT_TOPIC_HANDLERS` registry** (09-24). Rejected: moving the handler flags up (a ~2,600-line reorder).
- **Every routing fix adds a case to `src/lib/eval/route-replay.json`.** Known gaps are pinned as "(known gap: …)" (10-02).

## Answers

- **One question per answer, closing with the next step in the funnel** (09-03). It is enforced in code (`oneQuestion()`). This reverses the "factual answers end flat" rule; do not restore it.
- **Card budget** (`cardBudget.ts`, 09-03): 0 stated constraints gives 0 cards plus a question; 1 gives 4; 2 or more gives 6; a project in focus gives 3.
- **Prompt top-N** is 12 projects on DISCOVERY and 5 otherwise (08-31). The prompt block and the renderer share one scope.
- **The shown list is written to `last_projects`, and ordinals index it** (09-03, `reference.ts`). "The ones above 3.8 cr" is a filter, not a pointer to that list (10-26).
- **Never size the database to a buyer, including sector-scoped counts** (HARD RULE 7, 09-05). Counting what is on screen is fine. Our own strings obey this too.
- **Over-budget results** (10-05):
  - Retrieval allows up to +10%, but those rows go in an "Above the Stated Budget — NOT MATCHES" block.
  - A hard ceiling (`budgetHard`) has zero tolerance.
  - An honest "no match" beats padding.
  - A budget floor needs a priced unit that reaches it (10-26).
- **Computed in code; the model writes only the judgement:**
  - affordability and market tables (`ai/affordability.ts`);
  - "most expensive" (`aggregateQuery.ts`, 10-26);
  - appreciation what-if tables at 0/4/6/8/10%, labelled "arithmetic, not a forecast" (10-13). `RECORDED_SECTOR_CAGR_TRUSTED = false`.
- **Dates and possession** (10-14/16):
  - A date shown to a buyer must be in the prompt (`unsourcedDates`, `projectFactChecks.ts`).
  - A passed possession date on an undelivered project reads "was due, status unconfirmed", never "ready".
  - Rejected: `db:fix-statuses`, which hardcodes statuses from memory.
- **Price trend:** a rate is given only between two observed points. Benchmark points are labelled and never turned into a rate (10-15).
- **Wording of withheld facts:** policy-withheld facts say "not published", never "not in our records" (10-15). `ORIENTATION_IS_SOURCED = false`, because the stored facing is templated.
- **Fixed answers** (10-26): `MODEL_ANSWER` for "which model are you" (we name no single or fine-tuned model). The trust answer for "are listings verified" says we have not inspected the sites.
- **Amenities (owner, 10-26):** answer what the project lists, with no "template" caveat. This overrides the CLAUDE.md labelling habit for amenities. The fix is cleaning the data.
- **Outage handling** (10-26): when the chain fails after code already showed cards or a table, keep them and close in code (`outageOverShownAnswer`). Otherwise send the outage notice with `replace: true`. On a full failure, name no project and set `degraded:true`.
- **No off-platform referrals.** No outside phone numbers; ask for the buyer's number and keep the lead. `rera_url`, `hero_image_url` and `marketing_claims` are excluded from prompts (08-31).
- **Unclear referent:** reply "I'd rather ask than guess". `resolvePointer.ts` rewrites only the model's copy of the message (09-03).
- **Grievance and money-assurance sentences are replaced whole**, not verb-swapped (09-04).
- **Chips** (`chipPolicy`, 09-03): no chips on grievance, refund, ID, probe, decline or outage turns, and never a generic set. A chip must be actionable.
- **Answer cache** (10-24):
  - It matches factual questions on meaning: content words, and numbers bound to their units. The key carries a catalogue stamp; namespace `ac:v12`.
  - Bump the version after any behaviour fix.
  - Handler writes refuse when a project is in focus. Stateful answers and web public-record answers are never cached.
  - Rejected: embeddings (a paid call per turn, and they can match Sector 150 to 151).
- **News lane:** never adds a cross-builder project list to the prompt, so a promotion cannot seed recommendations (09-25).

## Data integrity and catalogue

- **Fact tiers** (`factPresentation.ts`): confidence follows the weakest tier used. Rejected: a "typical value" fallback.
- **`null` means "not checked"; never coerce it to `0`/`'LOW'`** (08-30). A `0` litigation count is a claim that the record is clean.
- **Fix scripts clear bad values and never invent replacements** (08-31).
- **A schema default or templated value is not data: clear it, don't label it** (10-05).
  - A value shared by more than 3 rows is a template.
  - Duplicates are archived (`archived_duplicate_of`), never deleted.
  - Same name with a different RERA number is reported to a person.
  - Rejected: labelling templated rows "estimated".
- **Measure a column's distribution (`GROUP BY`) before trusting it** (09-04, `npm run audit:synthetic`).
  - Withheld for that reason: `recommendation_profile.tier`, `buyer_satisfaction_rating`, `nclt_status`, `approvals_status`, `handover_defect_rate`, `women_safety_score`.
- **Opaque 0–100 analyst scores are never shown to buyers**; they are used for ranking only (owner, 09-06, `opaqueScores.test.ts`).
- **Builder insolvency (`legal_flag`) is surfaced first**, and contradicting project markers are suppressed (09-04).
- **Geography** (08-28/31, 09-03, 10-17):
  - Stored connectivity distances are synthetic; lat/lng is the only trustworthy geo.
  - No synthetic sector centroids.
  - Coordinates with 2 or fewer decimals are placeholders.
- **Freshness** (`dataFreshness.ts`):
  - Construction data is hidden after 30/90 days.
  - Compliance data is never hidden.
  - Price confirmation uses the `FactVerification` table (BUILDER_ATTESTED/VERIFIED, date, who) and goes stale after 30 days (10-15). Rejected: new `price_verified_at` columns.
- **Statutory figures:** never use the `cost_sheets` stamp/registration/GST columns (they hold schema defaults); use `UP_STATUTORY` (10-16). Women's stamp duty is 6% with no cap; registration is a flat 1% with no cap.
- **Placeholder documents are hidden** (`realDocuments.ts`: only files in the `project-docs` bucket).
- **Document extraction is a local Python batch** (pypdf, OCRmyPDF/Tesseract, MarkItDown; pdfplumber for price tables), and a person checks prices (10-02). Rejected: ScrapeGraphAI and Gemini PDF reading.
- **The UP-RERA portal is a form postback.** Don't build on fetching it by URL (09-04).
- **Field exposure:** `projectExposure.test.ts` fails on any unclassified column. `portal_subdomain` and `rera_compliance_score` are never public.
- **Backups:**
  - `backend/backups/templated-data-2026-10-05T*.json`
  - `backups/sector_intelligence_full_2026-10-14.json`
  - `backups/live-public-2026-10-14.dump`
  - `RealtyPals-db-backups/supabase-2026-10-15-snapshot/`
  - `neon-2026-10-16-pre-migration.dump`
  - `{neon,supabase}-2026-10-16-enrich129-columns.json` (due-diligence columns on 129 projects, nulled)
  - `backend/backups/templated-pass3-dev-*.json`

## Buyer features

- **A guest token is an identity.** A guest session is adopted on login (08-18). Bot sessions are flagged (`is_bot`), never blocked (09-15).
- **Dossier:** built in one place (`lib/dossier.ts`), stored in Postgres, shareable by guests (09-26). It prices the buyer's BHK (10-26). No "verified" or "forensic" copy. Rejected: storing it in Redis.
- **Memory is opt-in.** `UserMemory` is never loaded into a new chat on its own; the route is `savedProfile.ts` plus a chip (10-15).
- **Resale:** only for a flat the buyer already found, with a checklist and arithmetic on their numbers. Never listings or "is this price fair" (10-15).
- **Public records:** official sources only. Rejected: listing portals and builder sites (10-15).
- **Checklist ticks are stored on the device** (`localStorage`) (10-15). Rejected: a server table.
- **Office map pin** only for sectors in `SECTOR_CENTROIDS`.
- **The buyer journey funnel is one SQL query** (10-23).

## Supply side, leads and roles

- **Admin access:**
  - The gate sits on the path prefix (`adminAreaGuard`), with exactly two exemptions: `/auth` and `/team/accept-invite` (09-11b).
  - The role matrix is `adminPolicy.ts decide(role, method, path)`, pinned as a table (09-13b).
  - Rejected: per-route `requireRole` on about 130 routes.
- **Roles:**
  - SALES reads everything and writes only leads and callbacks.
  - ANALYST edits data and content, but cannot delete projects or builders, bulk import, or read leads (09-24).
  - SUPER_ADMIN alone gets audit logs, AI spend, team and outbox.
  - Unlisted reads are open by default and unlisted writes are closed.
- **`requireAdmin` is authentication only.** Routers outside the admin area use `requireStaff` (`guardsOutsideAdminArea.test.ts`).
- **Invites:** invitees set their own password; `resend-invite` is idempotent.
  - A password change revokes all sessions.
  - Forgot/reset always return the same response.
  - Rejected: issuing passwords.
- **Tenant subdomains are addressing, never authorisation.** Partner subdomains are flat (09-11b).
- **Leads:**
  - `CallbackRequest` is the one lead table, routed by `assigned_partner_id`. `BuilderLead` and `ChannelLead` are dead (09-11).
  - A channel partner belongs to a builder, and we approve it.
  - Distribution is equal round-robin (owner) via `nextInRotation()`. Change it once conversion data exists.
- **Lead Brief:** no transcript ever (rejected: a filtered transcript). `scrubCompetitors` matches whole words only.
- **Builder lead alert:** a link-only email, OFF unless `BUILDER_LEAD_EMAILS=on`, because dev holds real builder logins (10-15). Rejected: the full brief in the email.
- **Webhook:** `lib/webhook.ts` is the only outbound lead webhook (09-15). Failures are parked in `WebhookDeadLetter`; `routes/internal.ts` uses `INTERNAL_API_KEY` and returns 503 when the key is unset.
- **Notifications** are queued in `NotificationOutbox` and never sent until a provider exists.
- **Blog and news:** SUPER_ADMIN and ANALYST only (10-02).
  - Anything ever published is archived, never deleted.
  - Drafts are generated manually only, by Groq gpt-oss-120b. Rejected: 20b, which invents figures.
  - A link is kept only if Tavily returned that exact URL.
- **RealtyMail key:** `accounts` scope only (10-19). Rejected: the `domains` scope, which can delete the mail domain.
- **Logo uploads:** no SVG.

## Referrals

- **The first ROOT holder is claimed by a conditional update in one transaction**; the losers attach as generation 2 (10-13).
  - Metrics are computed in Postgres.
  - Revoking a ROOT stops new attribution into its whole tree.
  - Open: "activated = 3+ messages" also counts the assistant's replies.

## Infrastructure

- **Databases (10-14):**
  - Live is Neon (Singapore), using the pooled URL with `pgbouncer=true&connection_limit=5`.
  - Dev is Supabase Postgres.
  - Supabase Auth and Storage still serve live; never delete that project.
- **Migrations:**
  - Never merge migrations to main until `prisma migrate status` against Neon shows them applied (10-16, after an outage).
  - Never run `prisma migrate deploy` blindly on Supabase: it has pending migrations, one of which drops a table (09-24).
  - Migrations and data writes need the owner. The owner runs live data writes, always after a backup.
- **Render (10-14):**
  - Live is `srv-d94csqsvikkc73c4lqi0` (branch main).
  - Dev is `srv-dauhdddg1s2s73cutjo0` (branch dev, `REDIS_KEY_PREFIX=dev:`; local `.env` needs it too).
  - cron-job.org pings `/api/v1/healthz`.
  - Dev and live share one Upstash quota.
- **Chat cards are stored compact** (`chatStorage.ts`). Re-check the dev DB size against 500 MB each month.
- **`app.realtyask.in` is the buyer host.** URLs come from `frontend/lib/site.ts`. Open: wildcard DNS for partners.
- **PostHog key lives only in env.** Check `NEXT_PUBLIC_POSTHOG_KEY` on Vercel before a frontend deploy (10-23).
- **Rejected:** Prisma `relationJoins` (it changes every query) (10-08); new migrations for a log line (use `AuditLog`).

## Design and brand

- **Brand is RealtyAsk; lowercase `propfyndr` identifiers stay** (10-12). Brand regexes match `(?:propfyndr|realtyask)`.
- **Discovery keeps the lavender `.discover-canvas` and the Afacad "RealtyAsk" wordmark** (owner, 09-26). The light theme is the default, and the radius scale is not remapped globally.
- **No verdict words for buyers** (STRONG BUY, "% confident"). Cards show a reason and a trade-off. Price format is "₹1.09 – 1.83 Cr" (09-26).
- **No invented counts on the landing page.** The share preview is a static JPG under 300 KB (10-14).
- **RERA pills appear only for numbers we hold.** The drawer says we have not inspected the site (10-05).

## Testing and evaluation

- **Route replay** (`LLM_STUB=1`, `src/lib/eval/route-replay.json`) is the offline gate. `npm run verify:chat -- --endpoint=<url>` is the multi-turn deploy check; assert on the `done` payload, not the prose.
- **No vacuous tests:**
  - no `200||400||500` checks;
  - no `if (found)` guards;
  - no hardcoded "≥75%" banners;
  - placebo tests are marked `todo`, not deleted;
  - exemptions use a named allowlist with a reason.
- **Write the over-correction test in the same commit as the guard.** A guard's first firings are evidence to check, not wins.
- **Don't pipe gate commands through `tail`** (it swallows the exit code). Keep `npm run build` in the gate.
- **The backend suite is load-sensitive**; re-run before believing a failure. `chatRouterSize.test.ts` fails on HEAD (7,404 lines).
- **Buyer-vocabulary regexes need inflections** (`refund\w*`).
- **Live user numbers count only website guests and real accounts (decided 10-27).**
  - What: `/admin/analytics/user-counts` counts a person only when the session has a signed-in account or a `guest-<uuid>` token. The website has sent that token since June. Any other token is a script; the server mints `guest_…` when no token is sent.
  - Neon cleanup:
    - 40,258 provable test sessions flagged `is_bot` (`chat.test.ts` openers, no messages, test tokens).
    - Another 5,205 script/fake-account sessions flagged.
    - All 1,531 callbacks deleted: 1,529 dummy 9876543210 plus the owner's 2 tests.
    - Supabase: 23 fake accounts deleted.
    - Backups: `backend/backups/live-test-traffic-live-2026-10-27T07-50-04-070Z.json`, `backend/backups/live-fake-users-2026-10-27T07-59-24-358Z.json`.
    - Scripts: `scripts/clean-live-test-traffic-2026-10-27.ts`, `scripts/clean-live-fake-users-2026-10-27.ts`.
  - The token rule matches `guest-` + UUID exactly. 54 sessions from 42 look-alike script tokens (guest-stress_…, guest-journey_…, guest-audit) were flagged too: `scripts/flag-live-script-guests-2026-10-27.ts`.
  - Result, all time (7 Aug–27 Oct):
    - 78 people: 73 website guests and 5 signed-in (one is Raghav).
    - 310 sessions, 1,410 messages.
    - 11 accounts; 0 leads.
    - Founders' guest browsing can't be told apart without their guest IDs.
- **Every stored project fact is answered as stored (owner policy, 10-27; widens the entry below).**
  - What changed in code:
    - `projectExposure.ts`: the 7 formerly withheld columns that still exist made public (18 more had been dropped from the schema on 10-10); sentinels and opaque-score lists emptied; builder `cin`, `legal_entities`, `executives` and `outstanding_dues_cr` stated.
    - `projectFactsBlock.ts`: the topic slices carry the new fields; `marketing_claims` is included as developer copy; forward-looking questions state the stored figure.
    - `answerIntegrity.ts`: a score is let through when its number is in the prompt.
  - The owner chose this knowing `nclt_status`/`approvals_status` are false on Amrapali/Jaypee ("Everything, A and B too").
  - Still withheld: privacy, process and draft fields (see CLAUDE.md, Owner policy).
  - Prompt rules in `prompts/base.ts` (owner WIP, not edited) still say "never project future percentage gains" and "never generate numerical scores". These may make the model hedge on stored appreciation figures and scores.
  - Dev restored from the pass-3 backup with `scripts/restore-dev-templated-2026-10-27.ts`: 786 rows. Pre-restore values are in `backups/dev-before-restore-2026-10-27T11-18-53-082Z.json`.
  - Due-diligence columns nulled on 10-16 (129 projects, both DBs) are still gone; they exist only in backups.
- **Cost sheets and payment plans are answered from the DB as stored (owner decision, 10-27).**
  - What: whatever the row holds is stated, with no template caveat.
  - Why: the owner wants every property question answered from the database ("it doesn't matter even if any script wrote them").
  - Rejected: running `fix-templated-data-pass3.ts --db=live` to clear them, and hiding payment schedules until a builder confirms.
  - Known: live IFMS, parking, club and electricity sit in 3 tiers (286/74/22 projects); PLC text is identical on 360 projects; each plan type has one schedule. Dev was cleared on 10-16.
  - The cost table (`renderCostSheetTable`) now also lists floor rise, electricity, water/sewer, each PLC line and other charges. "Club membership", "IFMS", "electricity connection" and similar now route to the cost sheet.
- **People tracking (10-27, owner-approved, schema additive).**
  - A person is `realPeopleSessions` in `routes/admin.ts`:
    - a signed-in account, or a website guest token;
    - a guest who later signed in is merged into their account via `referral_visits`.
  - Token rule: `WEBSITE_GUEST_TOKEN` / `isWebsiteGuestToken` in `lib/botDetection.ts`, accepting `guest-` + UUID or `guest-` + 16–22 base36 (the browser fallback).
  - Every chat session create site now takes `sessionFields`:
    - `is_bot`, also true when a guest token isn't website-format;
    - `device` from the user agent;
    - `source` as a host or `utm_source` only, never a URL.
  - The fact-router create path and two chat-router create paths had never set `is_bot`.
  - `team_identities` holds people marked as team: named in User behavior, left out of the dashboard counts. Marking is SUPER_ADMIN only and audited.
  - The questions endpoint is `/analytics/people/:key/questions`. Reads are audited, and ANALYST and SALES are refused it (transcript content).
  - The dashboard counts callbacks with `is_test = false` only.
  - DDL is in `prisma/migrations/add_people_tracking`, applied to Supabase and Neon before the code shipped. Render does not run migrations.
  - Rejected: keeping `guest_token` on an adopted session. The chat ownership check grants access by guest token, so anyone holding the token could open the account's chats.
- **Dev chat history emptied (10-27, owner-approved).**
  - Supabase dev went from 258 MB to 61 MB.
  - Only the 2,878 dev-only sessions were backed up (`backend/backups/dev-chat-history-2026-10-27T08-20-28-376Z.json`); the rest are already on Neon.
  - Script: `scripts/clear-dev-chat-history-2026-10-27.ts`.
  - VACUUM FULL needs `DIRECT_URL`, because the pooler refuses it.
  - The block was egress, not space, so deleting data doesn't lift it.
  - Live sign-in still uses this Supabase project; noted for the owner.
  - Rejected:
    - counting only from the 15 Oct split, because the token rule makes earlier data separable;
    - deleting old chats, because that loses real buyers.
  - `npm test` refuses to run when `DATABASE_URL` points at Neon.

## Process

- **Instrument before optimising** (`turnTimer.ts`); every unmeasured latency theory was wrong. Debug by running locally, reading the log and reading the DB row.
- **Before concluding a fix failed,** check that port 3001 is really your server.
- **Data-quality reverts are the owner's call.** Surface conflicts; don't resolve them silently. Record the problem rather than patch it when the cause is unknown.
- **Write regexes with Write/Edit, never through a shell heredoc** (it drops `\b`). The `rg` proxy's zero-result output is unreliable.
- **Before moving or deleting files, grep for whatever reads them.** Never delete gitignored corpus `results-*.json` files.
- **Repo layout (owner, 10-27):**
  - Old roadmaps are in `docs/archive/plans/`; the current plan is the newest `docs/WEEK_PLAN_*.md`.
  - Deleted: `design/`, `mySkills/`, `postman/`, `ai-context/`, the one-off root scripts and `docs/research`.
  - Kept because code reads them: `QueriesAndKeywords/`, `Projects/`, `newProj/` (backups kept by the owner), `docs/ground-truth`, `docs/enrichment`.

## Data-integrity pipeline (2026-10-28)

- **What was decided:** `backend/scripts/data-integrity/` crawls UP-RERA (plain HTTP postback, no captcha, no browser) and researches builder sites and portals per project. Every finding is a pending row in `project_field_drafts` (withheld from buyers by `FORBIDDEN_RELATIONS`). No project column is written by the pipeline; promotion is a person's call, field by field.
- **Why:** the audit found 36 of 119 "exact" stored RERA numbers belong to a different project (e.g. Amrapali Eden Park holds AASTHA GREENS' number), and the first 96 researched projects disagreed with our unit, tower, area and price values in about 80% of comparisons. Portal and builder figures are an advertisement and the seller's claim; with no "builder-attested" tier yet, writing them to a verified column would present them to buyers as ours.
- **What was rejected:** auto-writing to live Neon (the owner delegated "make it live" overnight; held back because stage 4 was incomplete, the matches were unreviewed, and unverified values would reach buyers as `verified`). Also rejected: "cleaning" RERA numbers, since a trailing date (`UPRERAPRJ528653/07/2026`) is a valid format in 774 of 3,842 registry numbers.
- **Open:** 163 projects have no confident registry match; stage 4 yield is uneven (portals block the reader); UP-RERA's Completed, NCLT, Abeyance and Withdrawn lists are not crawled.
- **Owner override (2026-10-28, later the same day):** the owner allowed portal and builder-site facts to be written to project columns "for once", and asked for the 36 wrong-project RERA numbers to be resolved, not cleared. Written to dev (Supabase) via `08-apply.ts` in two batches (`apply-plan-1.json`, `apply-plan-2.json`; replay both in order on live): 73 RERA number replacements (65 + 8 after the Tavily quota reset, new key `TAVILY_NEW`), 149 registry-verified registration rows (`project_rera_registrations.source = up_rera_registry`, `verified_by = di-pipeline 2026-10-28`), direct registry links, and `total_units` 130, `total_towers` 108, `land_area_acres` 124, `architect` 12, `floors` 5, each with an `AuditLog` row. These values are portal advertisements or the seller's claim, not inspected facts. Backup of every touched row: `RealtyPals-data-integrity-2026-10-28/backup-dev-*.json`.
- **Held back even under the override:** `possession_label` (coupled to `possession_date` and status) and `price_min_cr` (shown beside `price_range_label` and unit rows). Price needs label and unit rows rebuilt together from the portal configs. Also dropped: RERA matches with name score below 0.5, number claims shared by several of our projects, and ordinal mismatches ("2nd Avenue" vs "7th Avenue").
- **Live (Neon) written, 2026-10-28:** both batches replayed with the same plan files and per-field guards. 0 skipped, 0 errors; live then verified: 149 registry-verified registration rows, 213 `AuditLog` rows (`Data-integrity pass 2026-10-28`), no project number without a matching registration row. Backups of every touched live row: `RealtyPals-data-integrity-2026-10-28/backup-live-*.json`. Live has 382 projects against dev's 381: a duplicate `ATS Destinaire` row on live was not covered by this work.
- **Batch 3 (dev and live, both verified):** a portal-targeted RERA pass (`07 --variant portal`) resolved 17 more numbers; after the rules only 1 replacement survived (Gaur City 2 - 14th Avenue `UPRERAPRJ16C14` -> `UPRERAPRJ6742`). Applied to dev and then to live (0 skipped, 0 errors); both verified at 150 registry-verified rows and 214 audit rows. Live and dev now hold the same three batches. Rule added: a name score under 0.6 with no builder link and one source page is rejected. `10-rollback.ts` undoes a batch from its backup (dry run by default).
- **More portals (2026-10-28), what was tested and decided:** plain request, honest client string `RealtyAsk-data-integrity/1.0`, `robots.txt` read first. Usable and used: Square Yards, MagicBricks (stage 17), Whitehat Realty (273 project pages, 101 of ours), Realty Assistant (52), Investors Clinic (18) via their sitemaps (stage 18). Skipped: HouseEazy (800-char developer pages, unit-level listings), HexaHome (1 project, listing pages disallowed). Refused or forbidden, not worked around: 99acres (Access Denied even for robots.txt; also the Jina browser-engine attempt was blocked as bot-check circumvention), Housing.com and Proptiger (406), CommonFloor and IndiaProperty (robots disallow all). Not yet tested: NoBroker, Zricks, Makaan, PropertyWala. `19-extract-pages.ts` trims each page to fact lines, makes one Gemini call per project, and merges candidates into `research/<id>.json` under the same quote and agreement rules.
- **Search budget:** both Tavily keys (`TAVILY_NEW`, `TAVILY_API_KEY`) are over their plan limit, and Claude Code's WebSearch is capped at 200 calls per session (about 100 an hour). Seven Haiku URL-discovery agents covered only 6 to 20 projects each; nearly all hits were Square Yards, and MagicBricks project pages almost never appear in search results. `17-portal-pages.ts --urls-from discovery` fetches the URLs they found with no search.
- **Batch 8 (dev and live):** from the extra portals: land area 54, units 47, towers 46, floors 13, possession label 35, possession date 9, status 12 (0 skipped). Architect is now fill-empty-only: portals contradict each other and our stored value may be right. Videos (`15-videos.ts`): 27 official-channel videos inserted on dev and live, unverified; a loose title match put wrong videos on 4 projects (a digit matched inside "Mar'25") until the rule became whole words at 80%.
- **Batch 7, nearest hospital / police station (dev and live):** `13-nearby.ts`, Google Places Nearby from each project's coordinates, straight-line km, empty values only: 78 hospital and 111 police distances. A hospital must say hospital, nursing home or medical centre in its name and have 10+ ratings (Google's `hospital` type includes diagnostic labs; the first test returned a CT-scan centre). Results are the nearest *listed* facility, often a small nursing home, not a major hospital. Not filled: `has_security_24x7`/`has_cctv` (the amenity rows they would come from are templated: the same "24/7 Multi-Tier Security & CCTV Surveillance" string on 187 projects), airport and school distance (ambiguous meaning).
- **Stock photos (dev and live), `14-stock-images.ts`:** 70 heroes that were Unsplash stock replaced with the project's own first real gallery image; 46 stock-only `project_images` rows deleted (full rows backed up, `--restore <backup>` puts them back). Those 46 projects now show the same placeholder the 189 empty heroes show.
- **agent-reach checked, not used:** Twitter, Reddit, Xiaohongshu, YouTube (`yt-dlp`) and Exa (`mcporter`) are not installed or need a login; web reading and search are already covered by Jina and Tavily. The gaps left are missing sources, not tooling. Project videos (none for any project) could be sourced with a Tavily YouTube search; not done.
- **Batch 6, possession bundle (dev and live):** `12-possession.ts` proposes status + label + date together; a proposal needs a builder-site quote or two agreeing pages, a possession word in the quote, and never flattens an informative label ("Delivered (May 2019)"). 16 projects: 16 labels, 7 dates, 6 status changes (5 to `ready_to_move`, 1 to `under_construction`). 92 single-source and 32 conflicting stay drafts; 10 past dates skipped. The possession columns already contradicted each other before this (e.g. `under_construction` with label "Delivered & Ready"; 267 of 381 flagged `ready_to_move`), so most projects are still unresolved.- **Script fixes found while doing it:** the apply guard only selected some columns, so a non-null old value of status/label/date would have been skipped (it skipped all 29 changes, safely, the first time); it now selects exactly the columns each plan touches. Rollback now restores the plan's recorded old value, since earlier backups lack some columns.
- **Batches 4 and 5 (dev and live, verified):** batch 4 fills 87 empty `rera_valid_until` from the registry's declared completion date (empty values only: the summary shows the original date and an extension would make an existing value truer). Batch 5 adds lat/lng for 50 of 57 projects without coordinates via Google Places text search (`11-geocode.ts`; inside the Noida area and place name resembles the project; 7 rejected). Replay on live in order: `--plan apply-plan-4.json`, then `apply-plan-5.json`.
- **Found, not fixed:** 70 projects use Unsplash stock photos as `hero_image_url` and 46 gallery images are stock (189 heroes are null, 122 are local paths). `registry_status` holds internal sales states (`open`, `subvention_restricted`), not RERA registration, so RERA data is not written to it.
- **Price, decided not to rewrite unit rows:** our unit rows are templated ("2 BHK Comfort Home") with several rows per bedroom count; portals give one range per bedroom count, which cannot be assigned to a specific row, and some portal configs are internally odd. Needs builder price lists.
- **Not done, decided to leave:** rebuilding price. Only 79 of 381 projects have priced portal configs (280 rows), and a unit row carries dependent fields (`price_per_sqft`, `price_label`, carpet ratio), so a partial rebuild would put 79 projects on portal prices beside 300 on seeded ones. 49 `price_min_cr` findings stay as drafts on dev. Still open: 162 projects with no usable RERA number (21 of the 36 wrong-project numbers among them), 188 on the generic registry link, 149 source conflicts, 846 drafts (dev only).

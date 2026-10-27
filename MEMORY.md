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
- **Live user numbers count from 2026-10-15 (decided 10-27).**
  - What: the dashboard's user counts (`/admin/analytics/user-counts`) start on 15 Oct, when live got its own Neon database.
  - Neon cleanup:
    - 40,258 pre-split sessions that are provably tests (a `chat.test.ts` opener, no messages, or a test token/title) set to `is_bot=true`.
    - 1,529 dummy-number (9876543210) callbacks deleted.
    - Backup: `backend/backups/live-test-traffic-live-2026-10-27T07-50-04-070Z.json`.
    - Script: `scripts/clean-live-test-traffic-2026-10-27.ts`.
  - Why: before the split, tests and buyers shared one database. About 5,500 old sessions can't be told apart, so counting from the split is the only precise baseline.
  - Rejected:
    - deleting all pre-15-Oct chats, because it loses real buyers' early chats;
    - a code-only date filter, because the other admin pages would stay polluted.
  - `npm test` now refuses to run when `DATABASE_URL` points at Neon.

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

# Implementation Plan — News & Semantic Retrieval Pipeline Remediation

**Scope:** the uncommitted work on `day6/chat-context-sectors-and-audit-fixes` — pgvector
semantic/hybrid search, the grounded news-answer path, the chat router news lane, the admin
news API, and the `NewsRail` discovery component.

**Source:** code review of 2026-09-25 (18 findings). This plan converts those findings into
phase-gated, verifiable work.

**Planning standard:** `docs/planning/phaseImplementation.md`.

---

## 0. Current System Assessment

### Existing

| Area | State |
|---|---|
| `backend/src/lib/ai/vectorSearch.ts` | NEW. Cohere 384-dim embeddings, two-tier cache, `searchNewsSemantic`, `searchProjectsSemantic`, `searchNewsHybrid` (RRF, k=60). |
| `backend/src/lib/ai/groundedAnswer.ts` | MODIFIED. New `buildNewsContext()`; `buildEntityContext()` extended with projects + recent news; web-search gate rewritten. |
| `backend/src/routes/chat-router.ts` | MODIFIED. Two new regex gates: a `builderCoverage` suppressor (~L2179) and a `NEWS_MILESTONE` lane (~L2630). |
| `backend/src/routes/news.ts` | NEW. Public `GET /api/v1/news/active` and `GET /api/v1/news/:id/context`. Mounted in `index.ts`. |
| `backend/src/routes/admin.ts` | MODIFIED. News list archive filter, permanent delete, restore route, create/patch field changes. |
| `backend/scripts/migrate-pgvector.ts` | NEW. Adds `builder_news.embedding`; attempts an ivfflat index. |
| `backend/scripts/seed-embeddings.ts` | NEW. Seeds all news rows + first 30 projects. |
| `frontend/components/NewsRail.tsx` | REWRITTEN. Single rotating headline, 3400ms, prefetch cache, dispatches `propfyndr:ask-ai`. |
| `frontend/components/DiscoveryContent.tsx` | MODIFIED. `NewsRail` moved below `HomeButtons`; owns the `propfyndr:ask-ai` listener (L987). |

**Verified system state (measured 2026-09-25, not assumed):**

* `npm test -- --run answerIntegrity` **fails**. `src/lib/__tests__/noAssertedVerification.test.ts`
  reports `backend/src/lib/ai/groundedAnswer.ts:192 → "Verified"`. The branch is red.
* `SELECT format_type(atttypid, atttypmod)` on both `projects.embedding` and
  `builder_news.embedding` returns `vector` — **no dimension constraint**.
* `pg_indexes` contains **no ivfflat or hnsw index** on either table. Every semantic query is a
  sequential scan with exact distance computation.
* `NewsStatus` enum includes `pending_approval`; `BuilderNews` carries `approved_by` and
  `approval_notes` — an approval workflow exists in the schema.
* `preloadedContext` dispatched by `NewsRail` has **zero consumers** across `frontend/`.
* `Project.status` is non-nullable (`ProjectStatus`); `Project.rera_number` is `String?`.

### Reusable

Use these rather than writing new equivalents:

* `lib/factPresentation.ts` — `FactTier`, `MARKET_QUALIFIER`, `unverified()`, `confidenceFor()`.
  The four-tier vocabulary already exists; `buildNewsContext` currently bypasses it.
* `lib/projectExposure.ts` — `PROJECT_PUBLIC_SELECT`, `FORBIDDEN_RELATIONS`, `BUYER_OPAQUE_SCORES`.
* `lib/cache.ts` — `getCached` / `setCached` / `deleteCached`. Already used; no new cache layer needed.
* `lib/chat/coverageAnswer.ts:125` — `builderCoverage()`, and its test
  `lib/chat/__tests__/builderCoverage.test.ts`.
* `lib/__tests__/noAssertedVerification.test.ts` — the repo-wide fabrication guard. Extend it; do
  not write a second scanner.
* `lib/ai/__tests__/answerIntegrity.test.ts`, `dueDiligenceFabrication.test.ts` — existing harness.
* `frontend`: `adminFetch`, `API_BASE`, the existing `confirmDialog` pattern in `admin/news/page.tsx`.

### Requires Modification

`groundedAnswer.ts`, `vectorSearch.ts`, `chat-router.ts`, `admin.ts` (news block),
`migrate-pgvector.ts`, `seed-embeddings.ts`, `NewsRail.tsx`, `noAssertedVerification.test.ts`.

### Requires Creation

* One exported `isNewsQuery(message)` predicate (the regex currently exists in four places).
* A dimension-constrained column migration + vector index.
* Frontend `prefers-reduced-motion` handling in `NewsRail` (no existing helper found — confirm in
  Task 0.3 before creating one).

### Risks / Constraints

1. **The branch ships buyer-facing fabrication today.** Findings 1 and 2 assert RERA registration
   and invent a "Semantic Relevance" percentage. This is a CLAUDE.md § four-tier violation, not a
   style issue. Phase 1 is not reorderable.
2. **Re-embedding is required after the cache-key fix (Task 2.1).** Existing stored vectors were
   generated under a colliding key and with the wrong `input_type`. They are not trustworthy and
   must be regenerated, not patched.
3. **Changing the vector column type requires dropping and refilling the column.** Coordinate
   Tasks 2.3 and 2.4 as one migration window.
4. **The router changes have wide blast radius.** Per the gate-cascade model (~40 gates, each
   returning the turn), an early-returning lane changes behaviour for every query class below it.
   Phase 3 needs corpus-level regression, not spot checks.
5. **Two items are product decisions, not engineering ones** — see Phase 0 blockers. They gate
   Phases 4 and 6 respectively.
6. Cohere is the only embedding provider wired. `getEmbedding` returns `null` on failure and all
   semantic search silently degrades to keyword-only. Acceptable, but the file header currently
   claims fallbacks that do not exist.

---

# Phase 0 — Baseline, Guard Hardening, and Blocker Resolution

### Objective

Establish a trustworthy red/green signal before any behavioural change, close the gap that let
three fabrications past the existing guard, and resolve the two decisions that gate later phases.

### Tasks

#### Task 0.1 — Record the current failing baseline

**Action:** VERIFY

**What to do:** Run the backend suite and both typechecks. Record, in the PR description or a
scratch note, exactly which tests fail before any change. Expected today: one failure in
`noAssertedVerification.test.ts` naming `groundedAnswer.ts:192`.

**Current system relationship:** `backend/src/test-runner.ts` (invoked as `npm test`), the
frontend/backend `typecheck` scripts.

**Depends On:** None

**Done When:**

* the full backend suite has been run and its output captured
* every currently-failing test is listed by file and assertion message
* `npm run typecheck` in `backend/` and `frontend/` both exit 0
* the list distinguishes failures caused by this branch from any pre-existing failure on `main`

---

#### Task 0.2 — Close the single-match gap in the fabrication guard

**Action:** MODIFY

**What to do:** In `backend/src/lib/__tests__/noAssertedVerification.test.ts:66`, the per-line scan
uses `line.match(...)`, which returns only the first `||`/`??` fallback on a line and then returns
early if that value is not a claim word. On `groundedAnswer.ts`'s project-line template, `|| 'Noida'`
matches first and is not a claim, so `|| 'Registered'` on the same line is never examined.

Change the scan to iterate every fallback on the line (`matchAll` with the `g` flag), applying the
existing `^(un|not[- ]|no[- ])` allowance and `CLAIM` test to each match independently.

Do not change `CLAIM`, `SKIP`, or `SCAN_DIRS` in this task.

**Current system relationship:** This test is the repo-wide guard described in its own header
comment. It already encodes the exact failure pattern (`project with no rera_number -> 'Registered'`)
— the regex simply could not reach it.

**Depends On:** Task 0.1

**Done When:**

* the scan evaluates every `||`/`??` string fallback on each line, not only the first
* running the test against the unmodified `groundedAnswer.ts` reports **all** offending lines,
  including the `'Registered'` fallback, not only `'Verified'`
* a line containing a benign fallback followed by a claim fallback is reported
* a line containing only benign fallbacks is not reported
* the `un-`/`not-`/`no-` prefix allowance still suppresses `?? 'unverified'`
* no file outside the branch's changes is newly reported (if one is, it is a real pre-existing
  offender — record it, do not silence the test)

---

#### Task 0.3 — Investigate reduced-motion and live-region precedent

**Action:** VERIFY

**What to do:** Determine whether the frontend already has a `prefers-reduced-motion` convention
(a Tailwind `motion-safe:`/`motion-reduce:` usage pattern, a hook, or a framer-motion
`MotionConfig`), and whether any existing component implements a polite live region. Search
`frontend/components`, `frontend/lib`, and the Tailwind config.

**Current system relationship:** Phase 5 must follow the existing convention rather than introduce
a new one (Rule 3).

**Depends On:** None

**Done When:**

* the existing reduced-motion mechanism is identified by file and named, or its absence confirmed
* the existing live-region/announcement pattern is identified, or its absence confirmed
* Phase 5 tasks 5.3 and 5.4 are annotated with the mechanism to use
* if none exists, the minimal approach is chosen and recorded before Phase 5 begins

---

### Unknown / Requires Investigation — BLOCKER 1: news publish default

**What is unknown:** `admin.ts` `POST /news` changed its default from `status || 'draft'` to
`status || 'published'`, and now sets `published_at` for any non-draft create.

**Why it matters:** `NewsStatus` contains `pending_approval`, and `BuilderNews` carries
`approved_by` / `approval_notes`. The schema describes a review step. The new default publishes
builder announcements to the buyer-facing rail without passing through it. This is either an
intentional simplification or an accidental policy change.

**How to investigate:** Cannot be derived from the codebase — the schema says one thing and the new
code says another, with no comment reconciling them.

**Decision required before Phase 4:** Should creating news default to `draft`, `pending_approval`,
or `published`? If `published`, should `POST /news` be restricted to a role, and should the
approval columns be marked deprecated so the schema stops implying a gate that does not run?

---

### Unknown / Requires Investigation — BLOCKER 2: promotional content reaching the advisor

**What is unknown:** `NewsRail` falls back to `/promotionals/active?type=news_feature`. Clicking any
rail item — including a promotional — dispatches a question that routes to the news lane, which
injects `searchProjectsSemantic` results into the advisor prompt under the heading
*"Other Flagship Projects in this corridor / micro-market"*.

**Why it matters:** CLAUDE.md states the news rail decides what a buyer is *invited to ask about*
and must never touch what the advisor *recommends*. A paid placement now seeds a project list into
the recommendation prompt. This is the neutrality boundary the product thesis rests on.

**How to investigate:** Confirm with `routes/promotionals.ts` whether `news_feature` placements are
ever paid or builder-supplied. If they are, the boundary is crossed today.

**Decision required before Phase 6:** Either (a) drop the promotionals fallback from the rail, (b)
keep it but strip the project-list injection from `buildNewsContext`, or (c) keep both and document
why the boundary does not apply. Option (c) requires an explicit CLAUDE.md amendment.

---

### Phase Completion Gate

Phase 0 can ONLY be marked **DONE** when:

* Task 0.1, 0.2, 0.3 each satisfy their Done When criteria
* the fabrication guard reports the complete offender list, and that list is the agreed Phase 1 worklist
* BLOCKER 1 and BLOCKER 2 have recorded decisions
* no production behaviour has changed in this phase (test and investigation only)

### Regression Checks

* `npm test` failure count does not increase beyond the newly-surfaced offenders from Task 0.2
* no source file under `backend/src` or `frontend/` was modified in this phase

---

# Phase 1 — Fact Integrity in the Answer Path

### Objective

Remove every fabricated and invented value from the context injected into the model, and restore
the web-search guard that a prior measured fix established. Nothing buyer-facing may assert a
standing we do not hold.

### Tasks

#### Task 1.1 — Remove fabricated fallbacks from the news and entity context builders

**Action:** MODIFY

**What to do:** In `groundedAnswer.ts`, in both `buildNewsContext()` and the projects block of
`buildEntityContext()`, stop substituting a value for an absent field. Specifically:

* `p.rera_number || 'Registered'` — omit the RERA clause entirely when `rera_number` is null.
* `p.builder_name || 'Verified'` — omit the parenthetical when no builder name is held.
* `p.sector || 'Noida'` — omit the location clause when `sector` is null.
* `p.status || 'Active'` — `Project.status` is non-nullable; delete the dead fallback and print the
  enum value directly.

Build each project line from the fields actually present rather than from a fixed template with
holes. Where a qualifier is genuinely needed, use `lib/factPresentation.ts` (`unverified()`,
`MARKET_QUALIFIER`) rather than inventing wording.

**Current system relationship:** This is the pattern `noAssertedVerification.test.ts` was written to
catch; its header comment already lists `project with no rera_number -> 'Registered'` as a known
recurrence. CLAUDE.md § four tiers: an absent field means absent.

**Depends On:** Task 0.2

**Done When:**

* `noAssertedVerification.test.ts` passes with the Task 0.2 multi-match scan in place
* a project row with `rera_number = null` produces context containing no RERA claim of any kind
* a project row with `sector = null` produces context that does not name a location
* a semantic project result with no builder name produces context that does not name a builder
* a fully-populated project row produces the same context it does today
* no template in either function contains a `||` or `??` whose right-hand side is a literal standing,
  location, or status
* `answerIntegrity.test.ts` and `dueDiligenceFabrication.test.ts` pass

---

#### Task 1.2 — Remove the invented relevance percentage from the prompt

**Action:** REMOVE

**What to do:** Delete the `- Semantic Relevance: ${(newsItem.similarity * 100).toFixed(1)}%` line
from the `buildNewsContext` parts array. Then delete the `similarity: 0.8` literal assigned to
keyword-only RRF hits in `vectorSearch.ts` (~L232) and make `similarity` optional
(`similarity?: number`) on `SemanticNewsResult`, so a keyword-only match carries no score rather
than a fake one.

**Current system relationship:** CLAUDE.md § AI Assistant Rules — never use fake confidence scores.
`confidenceFor()` in `factPresentation.ts` is the sanctioned way to express confidence, and it
derives from fact tiers, not from cosine distance.

**Depends On:** None

**Done When:**

* no string built by `buildNewsContext` contains a similarity, relevance, or confidence percentage
* `SemanticNewsResult.similarity` is absent on results that came only from the keyword leg
* the `0.8` literal no longer appears in `vectorSearch.ts`
* RRF ordering is unchanged — ranking uses `rrfScore`, which never read `similarity`
* `searchNewsSemantic`'s `minSimilarity` filter still works on the vector leg
* a grep for `Semantic Relevance` across `backend/src` returns nothing

---

#### Task 1.3 — Restore the `!dbContext` guard on web search

**Action:** MODIFY

**What to do:** In `runGroundedAnswer`, the web-search condition became
`if (isNewsOrMilestone || (!dbContext && isEntity))`, which drops the `!dbContext` precondition for
the news/milestone branch. Restore it so the web is consulted only when our own rows did not answer
the turn: `if (!dbContext && (isEntity || isNewsOrMilestone))`.

Restore the deleted comment above the block. It recorded a measurement — `"hi"` cost 1,906ms and
injected 2,009 characters of unrelated web noise as `LIVE WEB & FACTUAL CONTEXT` — and explains why
this gate is an allowlist rather than a blocklist. Re-tighten the widened terms (`update`, `audit`,
`corridor`, `flagship`) to the ones that genuinely denote time-sensitive external facts.

**Current system relationship:** This reverts a documented regression. The blocklist-vs-allowlist
reasoning is the same lesson `toolBlindGuard` encodes.

**Depends On:** Task 3.1 (shares the extracted `isNewsQuery` predicate — may be done in either
order, but the regex must end up defined once)

**Done When:**

* a turn answered entirely from database rows performs no web search
* a greeting (`"hi"`, `"hello"`, `"thanks"`) performs no web search and no embedding call
* a turn naming a genuine external, time-sensitive fact with no DB coverage still performs one
* the measurement comment is present above the gate
* the generic terms `corridor`, `flagship`, and `audit` no longer trigger a web round trip on their own
* the latency of a DB-answered turn is measured and is no higher than before this branch

---

#### Task 1.4 — Correct the provenance labelling of builder announcements

**Action:** MODIFY

**What to do:** `buildNewsContext` labels its output
`VERIFIED BUILDER ANNOUNCEMENT & MILESTONE` with a field `Official Findings & Details`. The row is a
builder-supplied announcement. What is verified is that the builder said it, not that it is true.
Relabel so the model cannot present promotional copy as an independently established fact — e.g.
"Announcement published by <builder>, as supplied by the developer".

Apply the same correction to the `Other Flagship Projects in this corridor / micro-market` heading:
`searchProjectsSemantic` applies no corridor, sector, or status filter, so the claim is unsupported.
Either add the filter (see Task 2.5) or state what the list actually is.

**Current system relationship:** CLAUDE.md § four tiers — `verified` is reserved for a project's own
rows. § Trust First — never present builder claims as neutral findings.

**Depends On:** Task 1.1

**Done When:**

* no heading or field label in `buildNewsContext` describes builder-supplied copy as verified,
  official, or a finding
* the attribution names the developer as the source
* the related-projects heading either reflects a real applied filter or drops the corridor claim
* a manual chat turn about a builder announcement produces an answer that attributes the claim to
  the developer rather than asserting it
* `answerIntegrity.test.ts` and `overPromise.test.ts` pass

---

### Phase Completion Gate

Phase 1 can ONLY be marked **DONE** when:

* Tasks 1.1–1.4 each satisfy their Done When criteria
* `noAssertedVerification.test.ts` passes with the hardened multi-match scan
* the full backend suite is green
* no string in any context builder asserts a standing, location, status, or confidence value for a
  field the row does not hold
* a manual chat turn against a project with a null `rera_number` has been run and its answer
  contains no RERA claim
* a manual chat turn answered from DB rows has been confirmed to issue no web search

### Regression Checks

* existing sector-pricing answers (`buildSectorPricingContext`) unchanged
* existing entity answers for fully-populated builders unchanged
* `MARKET_QUALIFIER` still attached to every market-tier figure (`marketQualifier.test.ts`)
* `BUYER_OPAQUE_SCORES` still excluded from buyer-facing context
* web search still fires for genuinely external time-sensitive questions

---

# Phase 2 — Retrieval Correctness

### Objective

Make stored embeddings trustworthy and make vector search use an index. Today the cache key
collides, documents are embedded with query-side parameters, and no vector index exists.

### Tasks

#### Task 2.1 — Replace the truncated cache key with a full-text hash

**Action:** MODIFY

**What to do:** In `vectorSearch.ts`, `getEmbedding` builds
``embed:v1:${Buffer.from(cleanText).toString('base64').slice(0, 48)}`` — 48 base64 characters encode
only the first 36 bytes of input. Any two texts sharing their first 36 characters resolve to the
same cache entry and receive the same vector. Seed text of the form
`"<Project> by <Builder> in <Sector> Noida."` collides across sibling projects of one builder.

Hash the full cleaned text (`createHash('sha256').update(cleanText).digest('base64url')`) and bump
the key prefix to `embed:v2:` so existing poisoned entries are never read.

**Current system relationship:** Uses existing `getCached`/`setCached` from `lib/cache.ts`. No new
cache layer.

**Depends On:** None

**Done When:**

* two texts sharing a 36+ character prefix but differing later produce different cache keys
* the key prefix is `v2`, so no `v1` entry can be returned
* a repeated identical query still hits cache (verified by absence of a second Cohere call)
* the in-memory map and the Redis key are derived from the same full text
* a unit check asserts distinct keys for two colliding-prefix inputs

---

#### Task 2.2 — Use the correct Cohere `input_type` for documents

**Action:** MODIFY

**What to do:** `getEmbedding` hardcodes `input_type: 'search_query'`. `seed-embeddings.ts` calls the
same function to embed stored documents. Cohere v3 embeddings are asymmetric: corpus text must use
`search_document` and user queries `search_query`. Every stored vector is currently in the wrong
subspace relative to the queries run against it.

Add an explicit parameter — `getEmbedding(text, inputType: 'search_query' | 'search_document')` —
with no default, so every call site states which side it is on. Update `seed-embeddings.ts` to pass
`search_document` and all search functions to pass `search_query`. Include `inputType` in the cache
key so the two never share an entry.

**Current system relationship:** Same `getEmbedding` used by both the seed script and the three
search functions.

**Depends On:** Task 2.1

**Done When:**

* `getEmbedding` requires an explicit `inputType` — omitting it is a type error
* `seed-embeddings.ts` passes `search_document`
* `searchNewsSemantic` and `searchProjectsSemantic` pass `search_query`
* the cache key distinguishes the two input types
* after re-seeding (Task 2.4), a query matching a known news headline returns that row as rank 1

---

#### Task 2.3 — Constrain the vector columns and create a working index

**Action:** MIGRATE

**What to do:** Measured state: both `projects.embedding` and `builder_news.embedding` are
unconstrained `vector`, and `pg_indexes` contains no ivfflat or hnsw index. An unconstrained vector
column cannot be indexed — the `CREATE INDEX` in `migrate-pgvector.ts` fails with
"column does not have dimensions" and the failure is swallowed by
`.catch(e => console.log('Index note (expected if unseeded):', e.message))`, whose message
misattributes the cause.

Rewrite the migration to:

* declare both columns as `vector(384)` (drop and re-add, since vectors will be regenerated anyway)
* create an HNSW index with `vector_cosine_ops` on each — HNSW does not require pre-existing data,
  unlike ivfflat, and the corpus here is ~40 rows
* remove the `lists = 20` ivfflat attempt (lists exceeding row count is misconfigured regardless)
* let index-creation errors fail loudly rather than logging a misleading note
* exit non-zero on failure

**Current system relationship:** `backend/scripts/migrate-pgvector.ts`. Both search functions use the
`<=>` cosine operator, which matches `vector_cosine_ops`.

**Depends On:** BLOCKER-free; must run immediately before Task 2.4

**Done When:**

* `SELECT format_type(atttypid, atttypmod)` returns `vector(384)` for both columns
* `pg_indexes` shows one hnsw index per table using `vector_cosine_ops`
* `EXPLAIN` on the `searchNewsSemantic` query shows an index scan, not a sequential scan
* a write of a non-384-dimension vector is rejected by the database
* the script exits non-zero when any statement fails
* no error path logs a cause it has not established

---

#### Task 2.4 — Re-seed all embeddings

**Action:** MIGRATE

**What to do:** Every stored vector predates Tasks 2.1–2.3 and is untrustworthy (collided key,
query-side `input_type`). Re-generate all of them. While in the file, fix three defects:

* seeding currently walks **all** `builderNews` rows regardless of `status`/`archived_at`
* `prisma.project.findMany({ take: 30 })` has no `orderBy` — "first 30 flagship projects" is
  arbitrary database order. Either order deterministically or state the real selection rule.
* `seed().finally(...)` swallows rejections and exits 0 on failure

Add a `--only-missing` mode (`WHERE embedding IS NULL`) so routine runs are cheap, with a
`--force` path for this one full regeneration.

**Current system relationship:** `backend/scripts/seed-embeddings.ts`. Row counts to expect: ~12
news, ~28 projects.

**Depends On:** Tasks 2.1, 2.2, 2.3

**Done When:**

* every row previously holding a vector holds a newly-generated 384-dimension vector
* `SELECT COUNT(*) WHERE embedding IS NOT NULL` matches the pre-migration count for both tables
* the project selection is deterministic and its rule is stated in the script
* `--only-missing` re-embeds nothing on a fully-seeded database
* the script exits non-zero if any embedding call fails
* two sibling projects of the same builder hold demonstrably different vectors (the collision case)
* a query matching a known headline returns that row as rank 1 with similarity above `minSimilarity`

---

#### Task 2.5 — Filter semantic project results to buyer-eligible rows

**Action:** MODIFY

**What to do:** `searchProjectsSemantic` applies no `status` filter, so any project with an embedding
can surface — including states a buyer should not be recommended. Add the same eligibility filter the
existing recommendation path uses (derive it from `lib/projectExposure.ts` and the existing
recommendation query; do not invent a new rule). If Task 1.4 kept the "corridor" framing, add the
sector/corridor filter that framing claims.

**Current system relationship:** `PROJECT_PUBLIC_SELECT` classifies columns; the existing
recommendation query is the precedent for which statuses are buyer-eligible.

**Depends On:** Task 1.4

**Done When:**

* the eligibility filter matches the one used by the existing recommendation path, by reference
* a project in an excluded status never appears in `searchProjectsSemantic` output
* the columns selected are all classified buyer-safe in `projectExposure.ts`
* `projectExposure.test.ts` passes
* if a corridor claim remains in the prompt, a corresponding filter is applied

---

#### Task 2.6 — Bound the in-memory embedding cache and correct the file header

**Action:** MODIFY

**What to do:** `IN_MEMORY_CACHE` is a plain unbounded `Map` keyed on full query text, never evicted
— a per-process leak on a long-running server, described as an LRU but implementing no eviction.
Either cap it with a simple size bound and eviction, or remove it entirely (Redis via `getCached`
already covers the hot path; measure before keeping it).

Separately, the file header claims "fallbacks to Mistral / deterministic projection". No fallback
exists — `getEmbedding` returns `null`. Correct the header to describe the real behaviour, including
that all semantic search degrades to keyword-only when Cohere is unavailable.

**Current system relationship:** `lib/cache.ts` already provides the durable tier.

**Depends On:** Task 2.1

**Done When:**

* the in-memory map is either bounded with eviction or removed
* if kept, its size cannot exceed the stated bound under sustained distinct queries
* the file header describes only behaviour the file implements
* the degraded path (no `COHERE_API_KEY`) is documented and verified: hybrid search still returns
  keyword results, and the request does not error

---

### Phase Completion Gate

Phase 2 can ONLY be marked **DONE** when:

* Tasks 2.1–2.6 each satisfy their Done When criteria
* both columns are `vector(384)` with an hnsw cosine index, confirmed by querying the database
* `EXPLAIN` confirms index usage on both semantic queries
* all rows are re-seeded with `search_document` embeddings under non-colliding keys
* a set of at least five representative queries returns the expected top-1 row
* with `COHERE_API_KEY` unset, chat still answers via the keyword leg without error

### Regression Checks

* `searchNewsHybrid` keyword leg unchanged — a query matching a headline exactly still ranks it first
* RRF ordering (`k = 60`) unchanged
* chat turns that do not enter the news lane are unaffected
* `getCached`/`setCached` behaviour for all other cache consumers unchanged
* no increase in Cohere call volume on repeated identical queries

---

# Phase 3 — Routing Restoration

### Objective

Restore `builderCoverage` as a real gate and stop the news lane from capturing unrelated query
classes. The current suppressor disables coverage for effectively every message.

### Tasks

#### Task 3.1 — Extract one `isNewsQuery` predicate

**Action:** REFACTOR

**What to do:** The same news regex is duplicated four times: `chat-router.ts` ~L2179 and ~L2630,
`groundedAnswer.ts` ~L126 and ~L424. Extract a single exported predicate — `isNewsQuery(message)` —
into the existing chat/AI lib layer alongside the other classifiers, and call it from all four sites.
One definition, one place to tune.

**Current system relationship:** Sits with the existing classifier helpers
(`lib/chat/`, `intentClassifier`). Follow their export and test conventions.

**Depends On:** None

**Done When:**

* the news regex literal appears exactly once in the repository
* all four former sites call the shared predicate
* the predicate has a unit test covering the terms that must match and the terms that must not
* behaviour for any given message is identical at all four call sites
* `npm run typecheck` exits 0 in `backend/`

---

#### Task 3.2 — Replace the coverage suppressor with a positive intent check

**Action:** MODIFY

**What to do:** The current guard at `chat-router.ts` ~L2179 is
`if (!coverage && !isAdvisoryOrAnalysisQuestion)`, where `isAdvisoryOrAnalysisQuestion` ends in
`|\?` — any message containing a question mark satisfies it. Since nearly every chat message is a
question, `builderCoverage` is effectively never consulted. The adjacent alternatives
(`what.*about`, `is.*good`) are unanchored and nearly as broad.

The reported symptom was `builderCoverage` returning canned inventory strings for advisory
questions. The root cause is that `builderCoverage` fires on a builder-name match without checking
the question is an *inventory* question. Fix it where all callers route through: add the positive
inventory-intent condition inside `coverageAnswer.ts`'s `builderCoverage`, and delete the negative
regex list at the call site.

**Current system relationship:** `lib/chat/coverageAnswer.ts:125`, covered by
`lib/chat/__tests__/builderCoverage.test.ts`. `lib/chat/builderNames.ts:8` documents that coverage
"runs whenever its regex fires" — that is the behaviour being corrected.

**Depends On:** Task 3.1

**Done When:**

* `builderCoverage` returns a coverage answer for an inventory question naming a builder we hold
  (e.g. "what does Godrej have in Noida")
* `builderCoverage` returns `null` for an advisory question naming the same builder
  (e.g. "is Godrej reliable?")
* `builderCoverage` returns `null` for a question about a builder we do not hold
* the call site in `chat-router.ts` contains no negative regex list and no bare `\?` test
* every existing case in `builderCoverage.test.ts` still passes
* new cases cover the advisory/inventory split for a held builder
* a message containing a question mark no longer, on its own, changes routing

---

#### Task 3.3 — Narrow the news lane and verify its cascade position

**Action:** MODIFY

**What to do:** The `NEWS_MILESTONE` lane at ~L2630 returns the turn when `isNewsQuery` matches. Its
term list includes `corridor`, `flagship`, `delivery schedule`, and `audit` — ordinary real-estate
vocabulary — plus `/["“][^"”]{8,}["”]/`, which captures any message containing a quoted phrase of
eight or more characters. "What's in the Noida Expressway corridor?" is answered as a builder press
release rather than as inventory.

Narrow the predicate (Task 3.1) to terms that unambiguously denote an announcement. Keep the quoted-
phrase heuristic only if it is additionally conditioned on a news term or on a headline actually
matching a stored row.

Then confirm the lane's position in the gate cascade: because each gate returns the turn, a lane
placed above inventory/sector handling silently takes precedence over all of them. Establish
whether this position is correct and record why.

**Current system relationship:** The router is a ~40-gate cascade in which each gate returns. Blast
radius is every query class ordered below the insertion point.

**Depends On:** Tasks 3.1, 3.2

**Done When:**

* "what's in the Noida Expressway corridor" routes to inventory/sector handling, not the news lane
* "any news from Godrej" routes to the news lane
* a message quoting an unrelated phrase does not route to the news lane on that basis alone
* a message quoting a headline that matches a stored news row does route to the news lane
* the lane's cascade position is documented in a comment stating which gates it intentionally precedes
* an inventory question, a sector question, a comparison question, and a calculator question each
  reach their prior handlers unchanged

---

#### Task 3.4 — Corpus-level routing regression

**Action:** VERIFY

**What to do:** Run the existing intent/routing corpora
(`intentExtraction.corpus.ts`, `intent*.test.ts`, `patterns.test.ts`,
`builderCoverage.test.ts`) and diff routing outcomes against the pre-Phase-3 baseline. Every
difference must be explained as intended or fixed.

**Current system relationship:** Reuses existing corpora — do not build a new harness.

**Depends On:** Tasks 3.1, 3.2, 3.3

**Done When:**

* every routing corpus test passes
* routing outcomes are diffed against baseline and each difference is individually justified
* no query class that previously reached a handler now terminates in the news lane
* no query class that previously reached `builderCoverage` now bypasses it unintentionally

---

### Phase Completion Gate

Phase 3 can ONLY be marked **DONE** when:

* Tasks 3.1–3.4 each satisfy their Done When criteria
* the news regex is defined exactly once
* `builderCoverage` is gated on positive inventory intent, not on the absence of a question mark
* the corpus diff is clean or fully justified
* a manual pass over inventory, advisory, news, comparison, sector, and calculator questions reaches
  the intended handler in each case

### Regression Checks

* `[CHAT:COVERAGE]` still fires for genuine inventory questions — the original bug was over-firing,
  and the fix must not silence it entirely
* the news lane still answers the case the branch was built for (clicking a rail headline)
* focus/context carrying (`focus_project_id`, `summary_*`) unaffected
* `chat-router` rate limiting and observability tracing unaffected

---

# Phase 4 — News Admin API Correctness

### Objective

Correct the publish-state logic and close the gap around irreversible deletion.

**Gated by BLOCKER 1.** Task 4.1 cannot start until the publish-default decision is recorded.

### Tasks

#### Task 4.1 — Apply the publish-default decision

**Action:** MODIFY

**What to do:** `POST /news` now defaults `status || 'published'` (previously `'draft'`) and sets
`published_at` for any non-draft create. Apply BLOCKER 1's recorded decision. If the answer is that
review is required, restore a non-published default and route creation through
`pending_approval`. If the answer is that review is not required, remove or mark deprecated the
`approved_by` / `approval_notes` columns and the `pending_approval` enum member so the schema stops
describing a gate that does not run.

**Current system relationship:** `admin.ts` news create block; `NewsStatus` enum; `BuilderNews`
approval columns.

**Depends On:** BLOCKER 1 resolution

**Done When:**

* the create default matches the recorded decision
* `published_at` is set if and only if the row is in a published state
* the schema no longer describes an approval step that the API bypasses
* creating news without an explicit `status` produces the decided state, verified via the API
* the admin news UI reflects the state the API actually assigns

---

#### Task 4.2 — Fix the `published_at` overwrite in PATCH

**Action:** MODIFY

**What to do:** In `PATCH /news/:id`:

```
if (status !== undefined) {
  data.status = status
  if (status === 'published' && !data.published_at) data.published_at = new Date()
}
...
if (published_at !== undefined) data.published_at = published_at ? new Date(published_at) : null
```

`!data.published_at` tests a key not yet assigned, so it is always true — a dead condition. The later
line then unconditionally overwrites the value it set. A request carrying
`status: 'published'` with an explicit `published_at: null` stores `null` on a published row.

Establish precedence explicitly: an explicit `published_at` in the body wins; the status-derived
default applies only when the body omits it. Order the assignments accordingly.

**Current system relationship:** `admin.ts` news patch block.

**Depends On:** Task 4.1

**Done When:**

* `status: 'published'` with no `published_at` in the body sets `published_at` to now
* `status: 'published'` with an explicit `published_at` stores the explicit value
* `published_at: null` with no status change clears the field
* a patch touching neither field leaves `published_at` unchanged
* no condition in the block tests a key the block has not yet assigned

---

#### Task 4.3 — Gate and audit permanent deletion

**Action:** MODIFY

**What to do:** `DELETE /admin/news/:id?permanent=true` performs an irreversible hard delete. The
admin UI confirms it, but server-side any staff role can call it and nothing is recorded. Restrict
it to `SUPER_ADMIN` via the existing `adminPolicy.ts` mechanism, and write an audit entry using the
existing `adminReadAudit.ts` pattern (or its write-side equivalent — confirm which exists before
adding one).

Move the destructive operation off a query-parameter side channel onto its own explicit route, so
an accidental or malformed request cannot escalate an archive into a delete.

**Current system relationship:** `lib/adminPolicy.ts` (path-level roles), `lib/adminReadAudit.ts`
(access recording), the `AdminRole` enum.

**Depends On:** None

**Done When:**

* a non-`SUPER_ADMIN` staff session receives a 403 on permanent delete
* a `SUPER_ADMIN` session succeeds and the deletion is recorded with actor, target id, and timestamp
* soft archive remains available to the roles that hold it today
* permanent deletion has its own route; `?permanent=true` no longer alters `DELETE`'s semantics
* the admin UI calls the new route and its confirm dialog names the action as irreversible
* an archive request cannot be escalated to a delete by adding a query parameter

---

#### Task 4.4 — Validate `builder_id` reassignment

**Action:** MODIFY

**What to do:** `PATCH /news/:id` now accepts `builder_id`, reassigning a post to a different
builder. A non-existent id reaches the database and surfaces as a 500 via the foreign key. Validate
existence and return 400 with a clear message. Confirm whether reassignment is intended at all — if
not, drop the field from the accepted body.

**Current system relationship:** `BuilderNews.builder_id` FK with `onDelete: Cascade`.

**Depends On:** None

**Done When:**

* a patch with an unknown `builder_id` returns 400, not 500
* a patch with a valid `builder_id` reassigns the post and the response reflects the new builder
* if reassignment is not intended, `builder_id` is rejected from the patch body
* the error message names the offending field

---

#### Task 4.5 — Add caching and document `link_type`

**Action:** MODIFY

**What to do:** `GET /api/v1/news/active` is hit by every homepage render and sends no
`Cache-Control`. Add a short cache lifetime consistent with the rail's freshness needs (it rotates
every 3.4s but its content changes at editorial cadence).

Separately, `BuilderNews.link_type`'s schema comment reads `// "project", "external_url"`, but both
`admin.ts` and `news.ts` now default it to `'builder'`. Update the comment to list every accepted
value, or constrain the field to an enum.

**Current system relationship:** `routes/news.ts`; `schema.prisma` `BuilderNews`.

**Depends On:** None

**Done When:**

* `GET /news/active` sends an explicit `Cache-Control` header
* the chosen lifetime is stated with its reasoning in a comment
* the accepted `link_type` values are documented at the schema, matching what the code writes
* editorial changes appear in the rail within the stated lifetime, verified manually

---

### Phase Completion Gate

Phase 4 can ONLY be marked **DONE** when:

* Tasks 4.1–4.5 each satisfy their Done When criteria
* BLOCKER 1's decision is implemented and the schema agrees with the API
* permanent deletion is role-gated, audited, and on its own route
* the news admin flows — create, edit, archive, restore, permanent delete — have each been run
  end-to-end through the admin UI
* no admin news endpoint returns 500 for a validation failure

### Regression Checks

* archive and restore continue to work for existing rows
* the archived-filter branch (`status === 'archived'`) still lists archived posts
* `include_archived=true` still includes them in the default listing
* `run_as_promo` ordering on the public endpoint unchanged
* existing published news continues to appear in the rail
* other admin routes under the staff gate are unaffected

---

# Phase 5 — News Rail Frontend

### Objective

Remove the prefetch machinery that does nothing, and make the rotating headline safe to interact
with on touch and by keyboard.

**Independent of Phases 1–4.** May run in parallel.

### Tasks

#### Task 5.1 — Resolve the dead prefetch path

**Action:** REMOVE (default) or MODIFY

**What to do:** `NewsRail` maintains `PREFETCH_CACHE`, calls `prefetchNewsContext` from three sites,
and dispatches `preloadedContext` on the `propfyndr:ask-ai` event. A repository-wide search found
**zero consumers** of `preloadedContext` — the listener at `DiscoveryContent.tsx:987` reads only
`text` and `autoSend`, exactly as `ProjectCard` and `PropertyQuickActions` do. The prefetch warms an
HTTP cache whose response is then discarded.

Default action: delete `PREFETCH_CACHE`, `prefetchNewsContext`, its three call sites, and the
`preloadedContext` field. If `/api/v1/news/:id/context` then has no remaining consumer, delete the
endpoint too.

Alternative, only if the latency win is measured and real: consume `preloadedContext` in the
`DiscoveryContent` handler and pass it into the chat request. Do not keep the machinery unconsumed.

**Current system relationship:** `NewsRail.tsx`, `DiscoveryContent.tsx:987`, `routes/news.ts`.

**Depends On:** None

**Done When:**

* either `preloadedContext` is consumed on the receiving side, or every part of the prefetch path is
  deleted
* clicking a rail headline still dispatches the question and still auto-sends
* if deleted, `GET /news/:id/context` has been checked for other consumers and removed if it has none
* `grep -r preloadedContext frontend/` returns either zero hits or both a producer and a consumer
* `npm run typecheck` exits 0 in `frontend/`

---

#### Task 5.2 — Remove `force-cache` from news fetches

**Action:** MODIFY

**What to do:** `prefetchNewsContext` uses `cache: 'force-cache'`, which serves a stored response
indefinitely without revalidation — on the one surface where staleness is the product's problem. If
Task 5.1 deletes this path the issue disappears; if the path is kept, replace `force-cache` with a
revalidating strategy aligned with Task 4.5's `Cache-Control`.

**Current system relationship:** `NewsRail.tsx`; pairs with Task 4.5.

**Depends On:** Tasks 5.1, 4.5

**Done When:**

* no news fetch uses `force-cache`
* an editorially updated headline appears within the agreed lifetime without a hard reload
* the caching strategy is stated once and consistent between client and server

---

#### Task 5.3 — Pause rotation on touch and on focus

**Action:** MODIFY

**What to do:** Rotation pauses on `onMouseEnter` only. `onTouchStart` prefetches but does not pause.
A mobile user reading headline A has the rail advance at 3400ms and taps headline B — the dispatched
question names a headline they never chose. Keyboard focus has the same problem with no pause at all.

Pause on `onTouchStart` and on `onFocus`; resume on `onBlur` and on touch end/cancel. Confirm that
the click handler dispatches the item that was rendered when the interaction began, not whatever
`items[index]` holds at dispatch time.

**Current system relationship:** `NewsRail.tsx` rotation `useEffect` (deps `[paused, items]`) and the
single button element.

**Depends On:** Task 0.3

**Done When:**

* touching the rail pauses rotation for the duration of the touch
* focusing the rail via keyboard pauses rotation; blurring resumes it
* the dispatched question always names the headline visible when the interaction started
* mouse hover pause continues to work
* rotation resumes after each pause without skipping or double-advancing
* verified on a touch device or emulated touch, not only by code inspection

---

#### Task 5.4 — Reduced motion and announcement semantics

**Action:** MODIFY

**What to do:** Using the mechanism identified in Task 0.3: under `prefers-reduced-motion: reduce`,
stop the auto-rotation and the `animate-ping` pulse, showing a single headline (with manual advance
if one is warranted). Give the rotating region appropriate live-region semantics and the button an
accessible name that does not silently change identity under a screen reader every 3.4 seconds.

**Current system relationship:** Follows whatever convention Task 0.3 found. Accessibility basics are
explicitly out of scope for simplification.

**Depends On:** Task 0.3, Task 5.3

**Done When:**

* with `prefers-reduced-motion: reduce`, rotation does not auto-advance and the ping does not animate
* with reduced motion, the rail still shows a headline and remains actionable
* the rotating region uses the project's existing live-region approach
* the button exposes an accessible name that identifies the current headline
* keyboard users can reach, pause, and activate the rail
* verified with a screen reader or accessibility inspector, not only by code inspection

---

### Phase Completion Gate

Phase 5 can ONLY be marked **DONE** when:

* Tasks 5.1–5.4 each satisfy their Done When criteria
* no unconsumed prefetch machinery remains
* touch, mouse, and keyboard interactions each dispatch the headline the user was looking at
* reduced-motion behaviour verified
* `npm run typecheck` exits 0 in `frontend/`

### Regression Checks

* the rail still renders nothing while loading and when zero items exist
* the promotionals fallback still works when the news endpoint returns zero items (subject to
  BLOCKER 2 / Phase 6)
* `HomeButtons` layout and spacing unchanged by the rail's repositioning
* `propfyndr:ask-ai` continues to work from `ProjectCard` and `PropertyQuickActions`
* dark mode styling unchanged
* no sparkle iconography reintroduced

---

# Phase 6 — Promotion / Recommendation Boundary

### Objective

Ensure promotional placements cannot influence what the advisor recommends.

**Gated by BLOCKER 2.**

### Tasks

#### Task 6.1 — Apply the boundary decision

**Action:** MODIFY or REMOVE

**What to do:** Implement BLOCKER 2's recorded decision — drop the promotionals fallback from the
rail, strip the project-list injection from `buildNewsContext`, or document an explicit exception.
If an exception is chosen, amend CLAUDE.md in the same change; the current text forbids it, and an
undocumented divergence is worse than either option.

**Current system relationship:** `NewsRail.tsx` fallback, `routes/promotionals.ts`,
`buildNewsContext`'s related-projects block, CLAUDE.md § Who Sees What.

**Depends On:** BLOCKER 2 resolution, Task 1.4

**Done When:**

* the decision is implemented and stated in a comment at the code that enforces it
* a promotional placement demonstrably does not change which projects the advisor recommends
* CLAUDE.md and the code agree on the boundary
* if the fallback is kept, the mechanism preventing promotional influence on ranking is named and
  verified by a test

---

#### Task 6.2 — Verify recommendation ordering is unaffected

**Action:** VERIFY

**What to do:** With a promoted project present, run the recommendation path and confirm its
position is identical to a run with the promotion removed.

**Current system relationship:** The existing recommendation ranking (budget, location, timeline,
reputation, preferences, infrastructure).

**Depends On:** Task 6.1

**Done When:**

* recommendation order is byte-identical with and without an active promotion
* the check is encoded as a test, not performed once by hand
* the news rail's contents do not appear in any recommendation ranking input

---

### Phase Completion Gate

Phase 6 can ONLY be marked **DONE** when:

* Tasks 6.1 and 6.2 satisfy their Done When criteria
* a regression test asserts promotion-independence of recommendation order
* CLAUDE.md and the implementation are consistent

### Regression Checks

* the news rail still shows content when news rows exist
* `routes/promotionals.ts` behaviour for its other consumers unchanged
* `NewsRail` still renders nothing rather than erroring when both sources are empty

---

# Phase 7 — Documentation, Determinism, and Cleanup

### Objective

Restore the deleted institutional knowledge and remove the remaining low-severity defects.

### Tasks

#### Task 7.1 — Restore the deleted policy comments

**Action:** MODIFY

**What to do:** Three comments encoding decisions were deleted while the code they guarded was left
unchanged:

* `groundedAnswer.ts` `buildEntityContext` — the `BUYER_OPAQUE_SCORES` rationale explaining why
  delivery scores are absent and why `average_delay_months` replaced them
* `groundedAnswer.ts` web-search gate — the measured regression (restored in Task 1.3)
* `DiscoveryContent.tsx` — the note that rail taps are answered from a project's own rows rather
  than from promotional copy

Each states a reason that is not recoverable from the code. Restore all three, adjusted where Phase 6
changed the underlying decision.

**Current system relationship:** `lib/projectExposure.ts` `BUYER_OPAQUE_SCORES` is the policy these
comments point at.

**Depends On:** Tasks 1.3, 6.1

**Done When:**

* all three comments are present and accurate for the post-change code
* each names the policy or measurement it encodes
* the `BUYER_OPAQUE_SCORES` comment points at `projectExposure.ts`
* no comment describes behaviour the code no longer has

---

#### Task 7.2 — Make context queries deterministic

**Action:** MODIFY

**What to do:** `buildNewsContext` (`take: 8`) and `buildEntityContext` (`take: 6`) select projects
with no `orderBy`, so the rows fed into the prompt vary between calls for the same question.
Determinism is a stated requirement of the prompt layer. Add an explicit, meaningful ordering.

**Current system relationship:** The prompt layer requires stable-before-variable ordering.

**Depends On:** Task 1.1

**Done When:**

* every context query feeding a prompt has an explicit `orderBy`
* the same question against unchanged data produces identical context across repeated calls
* the ordering rule is stated in a comment
* a repeated-call check asserts identical context output

---

#### Task 7.3 — Route entity project context through the exposure policy

**Action:** MODIFY

**What to do:** `buildEntityContext`'s new projects query selects `Project` columns inline rather
than through `PROJECT_PUBLIC_SELECT`. The columns chosen happen to be buyer-safe, but the query
bypasses the classification gate, so a future column added to that select is not checked by
`projectExposure.test.ts`.

**Current system relationship:** `lib/projectExposure.ts` is the policy for `Project` data leaving
the server; adding a column to the schema does not expose it until classified.

**Depends On:** Task 2.5

**Done When:**

* the query selects through the exposure policy rather than an inline object
* no `FORBIDDEN_RELATIONS` member can be reached from it
* `projectExposure.test.ts` covers this select
* adding an unclassified column to the schema fails the exposure test

---

#### Task 7.4 — Correct script exit behaviour

**Action:** MODIFY

**What to do:** `migrate-pgvector.ts` catches every error and exits 0; `seed-embeddings.ts` uses
`.finally()` with no rejection handler, producing an unhandled rejection and a 0 exit. Both look
successful in CI when they have failed. Make both exit non-zero on failure and log the real cause.
Remove the misleading "expected if unseeded" note (Task 2.3).

**Current system relationship:** `backend/scripts/`.

**Depends On:** Tasks 2.3, 2.4

**Done When:**

* both scripts exit non-zero on any failure
* a forced failure in each is observed to produce a non-zero exit and an accurate message
* no catch block logs a cause it has not established
* a successful run still exits 0 and disconnects Prisma

---

#### Task 7.5 — Update the project documentation

**Action:** MODIFY

**What to do:** Record in `MEMORY.md`: the semantic retrieval architecture (what is embedded, which
model, which `input_type` per side, where the index lives, how to re-seed), the two blocker decisions
with their reasoning and rejected alternatives, and the routing change to `builderCoverage`. Add to
`ERRORS.md` any approach in this remediation that took more than two attempts.

**Current system relationship:** CLAUDE.md § Memory and Stack Persistence.

**Depends On:** all prior phases

**Done When:**

* `MEMORY.md` records each decision as decided / why / what was rejected
* the re-seed procedure is written down and executable by someone who did not do this work
* `ERRORS.md` covers any >2-attempt approach
* if any CLAUDE.md statement was found stale during this work, it is corrected rather than left

---

### Phase Completion Gate

Phase 7 can ONLY be marked **DONE** when:

* Tasks 7.1–7.5 each satisfy their Done When criteria
* no policy comment deleted by this branch remains missing
* every prompt-feeding query is deterministic
* both scripts fail loudly
* `MEMORY.md` and `ERRORS.md` are current

### Regression Checks

* comment restoration changes no behaviour
* `orderBy` additions do not change which rows are eligible, only their order
* routing project context through the exposure policy does not drop a field the prompt relies on

---

# Cross-Phase Dependency Map

```
Phase 0 (baseline, guard hardening, blocker decisions)
   |
   +---------------------------+---------------------------+
   |                           |                           |
   v                           v                           v
Phase 1                     Phase 2                     Phase 5
(fact integrity)            (retrieval correctness)     (news rail frontend)
   |                           |                           |
   |  1.4 ------------------> 2.5                          |
   |                           |                           |
   +------------+--------------+                           |
                |                                          |
                v                                          |
            Phase 3                                        |
            (routing restoration)                          |
                |                                          |
                |          Phase 4 (admin API) <-- BLOCKER 1
                |                |                         |
                +----------------+-------------------------+
                                 |
                                 v
                           Phase 6 (promotion boundary) <-- BLOCKER 2
                                 |
                                 v
                           Phase 7 (docs, determinism, cleanup)
```

**Parallelisable:**

* Phase 5 is independent of Phases 1–4 and may run concurrently from the start.
  Task 5.2 alone waits on Task 4.5 for a consistent cache lifetime.
* Phases 1 and 2 are independent of each other and may run concurrently.
  The one coupling is Task 1.4 → Task 2.5 (the corridor claim and its filter).
* Phase 4 is independent of Phases 1–3 and may start as soon as BLOCKER 1 is decided.
* Tasks 4.3 and 4.4 have no blocker dependency and may start immediately.

**Strictly serial:**

* 2.1 → 2.2 → 2.3 → 2.4. The cache key, the `input_type`, and the column type all change what a
  stored vector means; re-seeding must be last and must follow all three.
* 3.1 → 3.2 → 3.3 → 3.4. The shared predicate must exist before the gates that use it are tuned,
  and the corpus regression must run after all routing changes.
* Phase 7 is last — it documents decisions the earlier phases make.

**Do not start Phase 1 and Phase 3 in the same change.** Both touch `groundedAnswer.ts`'s gate
region and the shared news predicate; concurrent edits will conflict and obscure which change caused
a routing diff.

---

# Final Acceptance Criteria

### Functional

* a chat question about a builder announcement is answered from stored rows, attributed to the
  developer, with no invented RERA status, location, builder name, or relevance percentage
* an inventory question naming a builder reaches `builderCoverage` and returns real coverage
* an advisory question naming the same builder does not receive a canned inventory string
* a corridor, sector, comparison, or calculator question reaches its prior handler
* clicking a rail headline asks about that headline and returns a grounded answer
* every admin news flow — create, edit, archive, restore, permanent delete — works end to end
* semantic search returns the expected top-1 row for a representative query set
* with `COHERE_API_KEY` unset, chat still answers via the keyword leg
* empty, loading, and error states in the rail render correctly

### Technical

* both `embedding` columns are `vector(384)` with an hnsw `vector_cosine_ops` index
* `EXPLAIN` confirms index usage on both semantic queries
* the news regex is defined exactly once
* `getEmbedding` requires an explicit `inputType`
* the embedding cache key derives from the full text and cannot collide
* the in-memory cache is bounded or removed
* permanent deletion is `SUPER_ADMIN`-only, audited, and on its own route
* project context leaves the server through `projectExposure.ts`
* every prompt-feeding query has an explicit `orderBy`
* both migration scripts exit non-zero on failure
* `npm run typecheck` exits 0 in `backend/` and `frontend/`
* no duplicate implementation of prefetch, caching, regex matching, or news-question detection

### Regression

* the full backend suite is green, including `noAssertedVerification`, `answerIntegrity`,
  `dueDiligenceFabrication`, `projectExposure`, `marketQualifier`, `overPromise`, `builderCoverage`,
  and every intent/routing corpus
* routing outcomes are diffed against the Phase 0 baseline and every difference is justified
* existing saved properties, leads, callbacks, and site-visit flows are unaffected
* guest-token attribution and rate limiting are unaffected
* the admin role matrix is unchanged apart from the intentional Task 4.3 tightening
* no builder or partner surface gained access to a chat transcript
* existing published news still appears in the rail

### Quality

* the rail matches the existing design system; no sparkle iconography
* reduced motion is respected; keyboard and touch users can pause and act on the headline visible
  to them
* the rail's loading, empty, and error states are handled
* a DB-answered turn performs no web search and is no slower than before this branch
* every policy comment deleted by this branch is restored and accurate

### Verification

* the fabrication guard reports zero offenders with its multi-match scan
* a manual chat pass over inventory, advisory, news, comparison, sector, and calculator questions
  reaches the intended handler in each case
* a promotion-independence test asserts recommendation order is unchanged by an active promotion
* re-seeding has been performed and the resulting vector counts match the pre-migration counts
* touch and screen-reader behaviour on the rail verified on a device or emulator, not by inspection
* `MEMORY.md` and `ERRORS.md` are current

---

## Completion Rule

> The implementation must NOT be considered complete until every task's "Done When" criteria are
> satisfied, every phase's "Phase Completion Gate" is satisfied, and the overall "Final Acceptance
> Criteria" are satisfied.

If any criterion is not satisfied, the relevant task/phase remains **INCOMPLETE**.

Do not mark work complete based on intention, code presence, partial functionality, or visual
appearance alone.

**Two decisions block progress and cannot be resolved from the codebase:**

1. **BLOCKER 1** — the news publish default (gates Phase 4)
2. **BLOCKER 2** — promotional content reaching the advisor prompt (gates Phase 6)

Phases 0, 1, 2, 3, and 5 can proceed without them.

---

**Created:** 2026-09-25
**Branch:** `day6/chat-context-sectors-and-audit-fixes`
**Planning standard:** `docs/planning/phaseImplementation.md`

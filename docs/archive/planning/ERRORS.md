# ERRORS.md

## Failed Approaches & Learnings
When an approach takes >2 attempts, log it here: What didn't work / What worked instead / Note for next time.

---

## Current Session (2026-08-16)

### CLAUDE.md Session Start Protocol
**What Didn't Work:** Mandated loading `.claude/COMMON_MISTAKES.md`, `.claude/QUICK_START.md`, `.claude/ARCHITECTURE_MAP.md` at session start. Files didn't exist.
**What Worked:** Removed dead links from session start protocol. Created MEMORY.md/ERRORS.md instead for actual context persistence.
**Note For Next Time:** Check that linked files exist before mandating their use. Test the protocol with a fresh clone.

### Better Auth Integration
**What Didn't Work:** CLAUDE.md documented "Authentication: Better Auth" but codebase uses Supabase.
**What Worked:** Verified actual auth in `frontend/lib/auth.ts` and `frontend/app/auth/` — all Supabase-based.
**Note For Next Time:** Always check live code state before documenting external libraries. Better Auth was planned but never implemented.

---


## Session 2026-09-02

### Fixing "general queries fail" by editing prompts and regexes
**What Didn't Work:** Several rounds of adding a regex or softening prompt
wording for each failing query. Every fix collided with the next: a new pattern
in one lane's matcher stole turns from another lane, and a softened refusal
string still sat behind an early `return`, so the model was never asked. The
loop is inherent to the shape — the pipeline is ~40 sequential gates each of
which returns the turn, so a per-query fix is a per-query gate.
**What Worked:** Three structural changes instead. (1) One general-answer floor
(`answerAsGeneralQuestion`) that every dead end hands off to, so no lane may
refuse. (2) DISCOVERY requires a property-search signal rather than a sentence
shape, so non-shopping turns stop getting cards. (3) DRILLDOWN requires a
project in scope, so the ~30 attribute keywords stop claiming Noida-wide
questions.
**Note For Next Time:** When the same class of query keeps failing after two
targeted fixes, the routing is the bug, not the pattern. Look for the gate that
returns before the code that could answer — grep for `res.end()` and early
`return` in the lane, not for the regex.

### Assuming a refusal came from the model
**What Didn't Work:** Reading refusals ("I need a project name", "we don't have
this in our database", "being updated by our verified data team") as prompt or
model-quality problems.
**What Worked:** They were hardcoded strings returned before any LLM call —
`unknownProject.ts`, `chat-service.ts`, `coverageGap.ts`, and the project-detail
lane's own branches. Grepping the refusal text found each one in seconds.
**Note For Next Time:** Grep the exact user-visible sentence first. If it is in
the source, no amount of prompt work will change it.

### Trusting that a documented fix stayed fixed
**What Didn't Work:** Assuming the fabrication defaults recorded as removed in
comments were actually gone. `projectDataGateway` has a comment block listing
`delivery_score ?? 85` and friends as removed, and 60 lines below it
`delivery_score ?? 90` had come back. `totalOutflow`'s file header describes
inventing one base price as the bug it fixed; its no-project branch had grown
three. `sanitizeOutput.normalizeCitations` contradicted its own doc comment.
**What Worked:** Running the guard tests that already existed
(`noAssertedVerification`, `marketTable`, `sanitizeOutput`) and reading their
assertion messages, then grepping for `?? <literal>` and `|| '<literal>'` across
the data layer.
**Note For Next Time:** A comment saying a bug was fixed is evidence about the
past, not the present. The guard test is the evidence. When a test in a
safety-critical area is red, read the assertion before assuming test drift —
9 of the 13 red tests here were the code being wrong, not the test.

### Weakening a guard test to make it pass
**What Didn't Work:** Two invariants had legitimate new exceptions
(`chatFieldCoverage` requires every exposed field to reach the prompt;
`topicLaneCards` forbids handlers emitting their own cards). Deleting or
loosening the assertion was the quick path.
**What Worked:** A named allowlist with a stated reason per entry, plus a test
asserting each reason exists — the pattern `chatFieldCoverage` already used for
`NOT_BUYER_FACTS`. The invariant stays sharp for every future field.
**Note For Next Time:** An exception belongs in a declared list with a reason,
not in a relaxed assertion. Make "add it to the exclusions" something someone
has to argue for.
---

## Session 2026-09-13b — authorization audit

### Reading guards to judge authorization
**What Didn't Work:** every route in `admin.ts` carries `requireAdmin`, which
reads like an authorization check. Judging the role model by reading route
registrations said "guarded" for ~130 routes that were guarded only against
being signed out.
**What Worked:** minting a real token per role and probing. A SALES token
creating a builder (201) and a BUILDER token reading a buyer's phone number
(200) settled in seconds what source reading had got backwards.
**Note For Next Time:** a guard's name is a claim, not evidence. For anything
authorization-shaped, get a token for the role that should be refused and try
it. And check the guard's TYPE — `AdminSession` having no role field was the
whole story, visible in four lines of `adminAuth.ts`.

### A 404 in an authorization probe is a pass, not a failure
**What Didn't Work:** `DELETE /admin/projects/<zeros>` returned 404 and read as
"blocked" at a glance.
**What Worked:** 404 means the handler RAN — authorization already passed and
only the row was missing. A real id would have deleted it. 403 is the only
status that means refused.
**Note For Next Time:** probe with a well-formed but non-existent id, and read
403-vs-anything-else. Never read 4xx as "denied".

### Guards that live in the wrong file
**Note For Next Time:** this codebase has now been bitten three times by the
same shape — a guard inside `admin.ts` protecting none of the sibling routers,
and routers mounted outside `/api/v1/admin` inheriting nothing. Authorization
belongs at the mount point, and the test for it should read `index.ts` and
enumerate mounts rather than trusting a hand-kept list.

---

## Session 2026-09-13 — beta readiness pass

### Judging chat coverage by reading the router
**What Didn't Work:** `chat-router.ts` is 308KB and the topic layer is 15
handlers deep, so reasoning about "which buyer questions do we answer?" from
the source was guesswork — and it was wrong in both directions. Queries I
assumed were broken were owned by a deterministic handler; queries I assumed
were fine reached nothing.
**What Worked:** Running the query corpus through `matchedPlaybooks()` in a
throwaway script, listing every MISS, then checking each miss against the
handler flags in `topicFlags.ts` and chat-router's flag block. 25 misses
reduced to ~8 genuine gaps in one pass, each with evidence.
**Note For Next Time:** Coverage is measurable, not arguable. Score the corpus
before touching a regex — and remember a playbook miss is only a defect if no
handler owns the topic.

### Regex misses are almost always inflection, not a missing topic
**What Didn't Work:** The instinct on a failing query class is that the content
is absent. It rarely was — `legalDueDiligence` already explained delayed
registries, `nri` already covered exit strategy.
**What Worked:** Checking the word boundary first. `registry delay` does not
match "registry delayed"; `\bnri\b` does not match "NRIs"; `dg power unit`
does not match "DG power backup per unit"; `carpet vs super` does not match
"carpet area versus super area". The file already documented this exact class
of bug for `\brelocat\b` and it recurred five more times.
**Note For Next Time:** Before adding a playbook, grep the existing ones for
the topic. If the content is there, the bug is at a `\b`.

### Streaming: `flushed` meant two different things
**What Didn't Work:** Reading `createBufferedSend` top-down suggested the
`if (flushed)` branch was the correct path for "everything after the first
release", and its comment said so explicitly.
**What Worked:** Capturing the raw SSE stream with curl. It showed the word
"While" arriving as the last token of the answer and the text stopping on
"stalling the executi" — which only makes sense if paragraph mode was falling
into the *prefix-buffer* mode's tail path, stranding `buffer` and never
flushing `tail`. One condition (`&& !releaseByParagraph`) fixed both.
**Note For Next Time:** For a streaming defect, read the wire, not the code.
Ordering and truncation bugs are invisible in the assembled string; the probe
script had already concatenated the evidence away.

### Two modes sharing one boolean
**Note For Next Time:** `flushed` was doing duty as both "the prefix buffer has
been released" and "we are now in tail-forwarding mode". Those coincide in one
mode and not the other. When a flag's name describes an event but the code
branches on it as a state, check every mode that sets it.

---

## Past Sessions
(Archive here as sessions complete)

---

---

## 2026-09-25 — A guard that only read the first fallback on a line

**What didn't work:** `noAssertedVerification.test.ts` was written to catch
exactly the pattern `project with no rera_number -> 'Registered'` — it says so
in its own header comment. It still let that line through for the whole of the
pgvector branch.

The scan used `line.match(...)`, which returns the first match only, then
returned early when that value was not a claim word:

```ts
const match = line.match(/(?:\?\?|\|\|)\s*['"`]([^'"`]{4,60})['"`]/)
if (!match) return
const value = match[1]
if (!CLAIM.test(value)) return
```

On a template line carrying several fallbacks the claim is rarely the one in
front:

```ts
`- ${p.name} in ${p.sector || 'Noida'} … (RERA: ${p.rera_number || 'Registered'})`
```

`'Noida'` matched first, was correctly judged benign, and the scan returned
before it ever reached `'Registered'`.

**What worked instead:** `line.matchAll(...)` with the `g` flag, applying the
allowance and the CLAIM test to each match independently. The offender list went
from one entry to two immediately, and the second was a fabricated RERA
registration that had been shipping.

**Note for next time:** a static guard that scans source lines must iterate
every occurrence on the line. A first-match-only scan does not fail loudly when
it under-reports — it passes, which reads as evidence the code is clean. Worth
checking the other repo-wide scanners for the same shape.

---

## 2026-09-25 — Two review findings that did not survive contact with the schema

Recorded because both cost a round trip and both were stated with more
confidence than the evidence supported.

1. **"`searchProjectsSemantic` has no status filter, so ineligible projects can
   surface."** `ProjectStatus` has exactly three values — `under_construction`,
   `ready_to_move`, `new_launch` — and all three are buyer-eligible under the V1
   scope. `Project` carries no `is_active`, `is_published` or visibility column
   at all. There was no ineligible state to filter out. The plan task was
   dropped rather than satisfied by inventing a rule.

2. **"`answerIntegrity` won't catch the fabrication because it runs on model
   output, not prompt context."** Half right about the mechanism, wrong about
   the outcome: a *different* guard, the static
   `noAssertedVerification.test.ts`, caught one of the four fabrications and had
   the branch red before any of this started. Running the suite first would have
   found that in one command.

**Note for next time:** check the enum and the columns before asserting a filter
is missing, and run the suite before claiming what it does and does not catch.

---

## 2026-09-25 — The vector leg had never returned a row

**What didn't work:** every `pgvector` semantic search on the branch, from the
day it was written. `searchNewsSemantic` and `searchProjectsSemantic` joined
`LEFT JOIN "Builder" b`. `Builder` is `@@map("builders")` — the quoted
PascalCase relation does not exist:

```
Raw query failed. Code: `42P01`. Message: `relation "Builder" does not exist`
```

The query threw on every call, the surrounding `catch` logged to
`console.error` and returned `[]`, and `searchNewsHybrid` carried on with its
keyword leg. So news search answered, correctly, the whole time — on ILIKE
alone. The end-to-end test passed. The terminal showed a grounded answer. None
of it was semantic.

**How it stayed hidden:** the feature was only ever exercised through
`searchNewsHybrid`, which fuses two legs and cannot tell you one of them
returned nothing. An empty leg and a leg that found nothing relevant look
identical from the outside.

**What worked instead:** `LEFT JOIN builders b`. Verified by asserting exact
top-1 recall against known headlines (3/3, similarity 0.70–0.73, builder names
now resolving) and by a paraphrase query — "which developer hit a building
progress landmark" returns milestone posts at 0.34, which ILIKE cannot do at
all. `EXPLAIN` confirms `Index Scan using idx_projects_embedding`.

**Note for next time:** raw SQL against a Prisma schema must use the `@@map`
name, not the model name — Prisma quotes PascalCase only for unmapped models.
And a fallback that silently absorbs a broken primary path will report success
forever. When a hybrid search is added, assert each leg returns rows on its
own before trusting the fused result.

---

## 2026-09-25 — Per-row embedding calls against a 40/min trial key

**What didn't work:** seeding embeddings one HTTP call per row. 109 of ~290
rows succeeded, then 273 consecutive failures. The failure lines named the row
but no cause, because `getEmbedding` checked `if (res.ok)` and fell through to
`return null` on anything else — a non-ok response logged nothing at all.

Adding the status to the log gave the whole answer in one line:

```
Cohere embed HTTP 429: You are using a Trial key, which is limited to
40 API calls / minute.
```

**What worked instead:** `getEmbeddingsBatch`, sending up to 96 texts per call
(Cohere's documented maximum). The same corpus is four calls instead of ~290,
and finishes in seconds.

**Note for next time:** if an API is called once per row over a table, check
the batch endpoint and the rate limit before the first run, not after. And a
`catch` that logs while an `if (!res.ok)` stays silent will hide exactly the
errors that come back as a well-formed HTTP response — which is most of them.

---

## 2026-09-26 — Regex edits via Python heredoc wrote backspace bytes

**What didn't work:** patching TypeScript regexes through a Python script in a
bash heredoc. Every `\b` in the replacement arrived in the file as a literal
0x08 (backspace), so `/\b(it|its)\b/` became `/(it|its)/` in effect —
unbounded, and invisible in normal `sed`/`cat` output. It took three attempts
(`sed -n`, `od -c`) to see it. `\s` survived, which made it look fine.

**What worked instead:** the Edit tool for any replacement containing regex
escapes, and a byte scan after scripted edits:
`LC_ALL=C grep -c $'\x08' <file>` (0 expected), fixed with a script that
replaces `b'\x08'` with `bytes([92, 98])`.

**Note for next time:** never write regex source through an escaped string
layer. If a scripted edit is unavoidable, scan for 0x08 before typechecking —
tsc accepts the corrupted regex silently.

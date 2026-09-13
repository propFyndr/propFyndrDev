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

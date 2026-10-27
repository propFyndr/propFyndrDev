# Chat improvement proposals — 2026-10-02

For review only. Nothing here is implemented. Each item names the code it rests on,
so it can be checked before anyone agrees to it. Ranked by impact on answer quality
per unit of work.

## 0. Precondition: the documents buyers see are fake

All 258 `project_documents` rows are placeholders: 173 Unsplash stock photos,
44 project hero images with a hardcoded `file_size_bytes: 4500000`, and 41 empty URLs.
They are titled "Official Master E-Brochure", "Verified Floor Plans",
"UP RERA Certificate". `BuilderTab.tsx:544` labels them "{N} Verified Docs", and
`OverviewTab.tsx:639` lists them as "Important Documents". The chat tool
`project_documents` hands them to the model too.
This breaks § Trust First outright. Hide or delete them first (that needs your
explicit yes). Everything below assumes it is done.

## 1. Measure answers before changing them

**Problem:** we can't tell which answers are bad.
- Thumbs up/down exists only per property (`POST /feedback`, `chat-router.ts:7053`),
  and its UI component `components/chat/PropertyFeedback.tsx` is imported nowhere.
- The LLM grader (`lib/ai/responseGrader.ts:61`) listens for `event === 'text'`, but
  streams emit `'token'`. Every grade is the fallback score 50 ("Parse error").
- Fallback and degraded turns go only to the console. Unknown projects and sectors are
  the only gaps logged (`coverageGap.ts`).

**Proposal:**
- Fix the grader event name. This is a one-line change.
- Add 👍/👎 per answer, plus an optional "what was wrong" note.
- Write every turn that was 👎, degraded, or "we don't hold that" to one table, and show
  it as an "Unanswered / bad answers" queue in admin.
- That queue becomes the work list for both data and routing fixes. Each reviewed failure
  also becomes a new turn in `npm run replay`.

**Effort:** small–medium. **Risk:** low. Nothing buyers see changes except the thumbs.

## 2. Show the follow-up suggestion we already compute

**Problem:** `chat-router.ts:6314-6325` sends a `followup` SSE event, but chooses it
**at random** from templates. The frontend stream reducer has no `followup` case, so
buyers never see it. `generateQuickFollowUps` (`lib/ai/quickFollowUps.ts`) has no
callers. CLAUDE.md § Chat Experience item 7 (proactive, not passive) is unmet.

**Proposal:** pick the suggestion in code from what just happened:
- After a shortlist: "Compare the top two?"
- After a price answer: "All-in cost with stamp duty and GST?"
- After a single-project answer: "What's the catch with this one?"
- While intent is missing a slot that matters, ask about that slot.

Show it as one tappable chip. Remove the random picker and the dead helper.

**Effort:** small. **Risk:** low.

## 3. Ask the clarifying question that matters most

**Problem:** `getMissingFields` (`conversationEngine.ts:140-145`) returns the missing
slots in a fixed order (sector, bhk, budget, purpose). The model writes the question.
Nothing ranks which missing slot would help this buyer most.

**Proposal:** in code, check how many current candidates each missing slot would cut,
and ask about the slot that splits them most. Example: 40 candidates, budget cuts to 6,
BHK cuts to 30, so ask budget. Use a fixed question per slot rather than model text.
The result is fewer turns to a useful shortlist, and no model call for the question.

**Effort:** medium. **Risk:** low–medium. It changes conversation flow, so
replay-test it.

## 4. Returning buyers: offer what we remember, don't apply it silently

**Problem:** cross-session memory (`UserMemory`, keyed by user or guest token) goes into
the prompt as text (`lib/ai/context.ts:18`) but is never merged into intent. A returning
buyer starts from zero filters, while the model half-remembers them in prose. That
mismatch can produce answers that contradict the filter pills.

**Proposal:** on a new session, if memory holds budget, BHK or sectors, show one line:
"Last time: 3BHK, under ₹1.5 Cr, Sector 150. Continue with that?" and a
**Continue / Start fresh** chip. Only Continue writes the memory into intent. Showing
the assumption follows § Trust First.

**Effort:** small–medium. **Risk:** low.

## 5. Make the server the source of truth for intent

**Problem:** the previous turn's intent is read from the client request body
(`chat-router.ts:261`, `parsed.data.intent`). `SessionMemory.extracted_intent` also
exists server-side. Two sources can disagree: a stale tab, a second device, or an
edited request.

**Proposal:** read prior intent from `SessionMemory`. The client sends only explicit
patches (the `INTENT_PATCH` and `REMOVE_FILTER` actions that already exist).
**Verify first:** I haven't read whether the server already re-checks the
client-sent intent. Confirm that before scoping this.

**Effort:** medium. **Risk:** medium. It touches every turn, so replay-test it.

## 6. Check code-written answers too

**Problem:** `answerIntegrity` checks model answers, both per paragraph mid-stream and
in full at the end. Topic-handler output is never checked (`handlers/index.ts:59-61`).
As more answers move into code (13 of 20 replay turns now), more of what buyers read
goes unchecked.

**Proposal:** run the sync integrity checks (price provenance, unsourced dates, broker
hype) on handler output in log-only mode for a week. Block on failures once no
false positives show up.

**Effort:** small. **Risk:** low in log-only mode.

## 7. Reply in the buyer's language

**Problem:** intent extraction understands Hindi and Hinglish
(`prompts/intent-extraction.ts`, `messyLanguageNormalizer.ts`), but the answer prompt
has no rule about the reply language. Topic-handler answers are English templates.

**Proposal:** detect the language in code (Devanagari script, or the existing Hinglish
lexicon) and add one line to the prompt: reply in the buyer's language and script.
Code-written answers stay in English for now. That limit is real, and the fix is
per-handler translations later.

**Effort:** small. **Risk:** low. Hinglish quality varies by model, so check it in the
live run.

## 8. Find projects by meaning, not only by filters

**Problem:** project discovery is Prisma filters only (`discovery/projects.ts:736`).
`projects.embedding` is seeded but nothing reads it (`vectorSearch.ts:9-13`). A request
like "quiet society, good for kids, near a school" depends on exact field matches.

**Proposal:** use filters first, then re-rank the filtered set by embedding similarity
to the buyer's lifestyle words. Ranking order stays as § Recommendation Framework sets
it (budget, location, possession first). Similarity only breaks ties.

**Effort:** medium. **Risk:** medium. It can change rankings, so replay-test it.

## 9. Answer from documents (after real PDFs exist)

Covered by the extraction trial (`backend/scripts/doc-ingest/trial.py`). The flow:
- Extract each page.
- Store chunks with their page numbers.
- Retrieve with keyword plus vector search.
- Cite as "per <document>, p.X". This is never marked verified or HIGH confidence.

Blocked on real documents (see 0).

## 10. Shrink the prompt, last

`prompts/base.ts` is 85 KB. The largest discovery prompt observed was about 36.8k
tokens (`systemPromptCache.ts:286`). Shrink it only after items 1 and 2 exist, so the
effect on answers can be measured instead of guessed.

## Suggested order

0, then 1 and 2 together (small, and they make everything else measurable), then 6,
4, 7, 3, 5, 8, and 9 once documents exist. 10 comes last.

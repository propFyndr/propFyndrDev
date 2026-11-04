# Cycle 2, Day 1: "What could go wrong", answered from official records

Run 4 Nov 2026 on dev (local backend against the dev Neon database, free provider chain). Raw results are in `docs/benchmark/safety40/`.

## Decisions taken (owner delegated, 4 Nov)

| Question | Decision |
|---|---|
| Complaint wording | "UP-RERA lists N complaints against this project, read on <date>. A complaint is not a ruling." Written as a sentence, because `sanitizeOutput` rewrites dated parentheticals. |
| Collecting other assistants' answers | Pasted weekly from the consumer apps into `docs/benchmark/external-ai/<date>/`, at no cost. No paid API (treg), no new table, no migration. See `external-ai/README.md`. |
| Approver of complaint and order rows | Furqan. Nothing was approved today. |
| Day 5 latency | Measure only; cuts are decided after the numbers (separate report `C2_DAY5_latency.md`). |

## Tasks

**1. Official UP-RERA records, staged as pending rows.**
- Complaints: 127 pending drafts on dev, from 27 Oct. None approved, none on live.
- Orders: new `scripts/data-integrity/30-orders-drafts.ts`. UP-RERA publishes 8 orders openly (JudgementView, read through `WebService1.asmx/loadjudgement`). Two match our catalogue by exact name, Migsun Wynn (order 06-06-2025) and Sikka Karmic Greens (order 13-05-2025). Both are now pending drafts on dev (`rera_orders`). Every other order needs a complaint number and a captcha (`frm_OrderExecution.aspx`), and we do not get around a captcha.
- Abeyance: **blocked by UP-RERA.** `Frm_view_Abeyance_Projectlist.aspx` loads its list from `WebService1.asmx/loadAbeyanceprojectWithParameter`, which returned `{"Message":"There was an error processing the request."}` for every input: an empty string, `null`, a real registration number, with or without a session. A real browser (Playwright) showed the same error. Re-try next week.
- Live: nothing run. Drafts reach live only after Furqan approves them on dev and says yes to a live write.

**2. Other assistants' answers.** No paid calls. The 31 Oct hard-43 safety answers were converted to the paste format (`external-ai/2026-10-31/`: ChatGPT 7, Perplexity 2), scored, and turned into 26 claims in `claims-to-check.json`. Every claim is a figure about complaints, orders, court cases, registration, OC or possession, to be checked on UP-RERA. Example: ChatGPT's "53 complaints are recorded against the project" for Mezzaria matches our pending 27 Oct draft. The list is internal; nothing from it reaches a buyer or a row.

**3. Source and date on every new fact.** A complaint line carries "read on <date>"; an order line carries the complaint number, the bench, the order date and the read date. The project-page box drops any UP-RERA line that has no read date.

**4. The "what could go wrong" record, the same in chat and on the project page.** `riskRecord()` in `backend/src/lib/chat/handlers/projectCatch.ts` builds six fixed lines: registration, complaints, delays, occupancy certificate, court cases, abeyance. Each line comes from a row or an approved UP-RERA record, or says "Not on record". A stored litigation count of 0 reads "None on record: our stored count is 0. A count we hold is not a court search."
- Chat: the catch answer leads with the six lines.
- Project page: `GET /api/v1/projects/:slug/risk-record` feeds `frontend/components/property-detail/RiskRecordBox.tsx` below the detail panel on `/property/[slug]`.
- Routing fixes, found by the before-run:
  - "How many UP-RERA complaints…" went to the registration table.
  - "OC and any court cases…" went to the OC table only.
  - "court cases against X" went to the **amenity** lane.
  - "A vs B, which is the safer buy?" answered for A only. It now shows both records with "We do not rank them".
  - All five are pinned in `route-replay.json` (`safety40-*`).

**5. False reassurance blocked in code.**
- **Root cause found in the prompt.** `prompts/blocks.ts` serialized every ready-to-move project as `"possession_status": "DELIVERED — occupancy certificate issued, project is handed over"`, and the prompt head (`base.ts:323`) treats DELIVERED as "OC issued is a confirmed fact". No project on dev holds an `oc_status` (checked 4 Nov). The model was therefore told a certificate existed for every ready project, which is where "Delivered without an OC" came from. The label is now `READY_TO_MOVE`: a status, not a certificate. `readyIsNotOc.test.ts` fails on the old string. The prompt head was not touched; it is owner WIP and has to stay byte-identical. Its DELIVERED rule now has nothing to fire on, and the owner should delete it.
- **Guard.** `dropUnsourcedJudgements` (`projectFactChecks.ts`) now also drops two kinds of sentence:
  - "has been delivered / handed over", unless the facts carry a granted OC;
  - "no litigation / no court cases / litigation-free", unless the facts carry a zero litigation count.

  The evidence is read in the JSON shape the prompt actually carries (`"litigation_count":0`, `"oc_status":"FULL_OC"`, `occupancy_certificate_status: 'Obtained'`). Honest gaps ("we hold no litigation record") are exempt. The tests were written first and failed before the change (`falseReassurance.test.ts`, 20/20).

**6. The 40 safety questions, before and after.** The set is 10 projects × 4 phrasings (`backend/scripts/corpus/safety40.json`). Before = HEAD `728483d0`, run from a separate worktree; after = the working tree. Scoring is `scripts/corpus/safetyScore.ts`: sentence counts, not a grade.

| Phrasing | Before: sourced / unsourced / reassurance / not on record | After |
|---|---|---|
| "Is X safe to buy?" | 16 / 12 / 0 / 17 | 26 / 12 / 0 / 52 |
| "What could go wrong if I buy in X?" | 16 / 12 / 0 / 17 | 26 / 12 / 0 / 52 |
| "How many UP-RERA complaints against X?" | 10 / 19 / 0 / 3 | 26 / 12 / 0 / 52 |
| "Does X have an OC, and any court cases?" | 0 / 2 / 0 / 0 | 26 / 12 / 0 / 52 |
| **All 40** | **42 / 45 / 0 / 37** | **104 / 48 / 0 / 208** |

- Lanes: before, 20 catch answers, 10 registration tables and 10 OC tables; after, 40 of 40 get the six-line record. No errors. All 80 answers were built in code, with no model call.
- Read the "not on record" rise (37 to 208) as mostly a format effect: the six lines always print, so every gap is now stated. It does not mean the answers are six times more honest. The real changes are coverage (all four phrasings answer the risk question) and the lines now carrying sources.
- Routing check on the broader matcher: "what is NCLT", "what happens if my builder goes insolvent", "how does litigation affect registry" and "any legal issues with projects in sector 150" route exactly as at HEAD. "any complaints about water supply in X" briefly moved to the risk record; it is excluded again and pinned.
- Median time per answer: 3.3 s before, 4.1 s after. That is two more database reads per turn on a laptop that was also running the Day 5 measurements, so it is not a clean timing.
- What the "unsourced" count holds after: chiefly the Amitabh Kant "25%" in a gap line (a statutory figure, not a project fact) and location-concern rows that carry distances.
- False reassurance was already 0 before, because the 31 Oct fixes had moved these questions to code-built answers. The guard extension in task 5 protects the model-written lanes.

### Mezzaria re-score (hard-43 Q5: "Astralis vs Mezzaria: which is the safer buy and why?")

| Answer | Sourced | Unsourced | Reassurance | Not on record | Notes |
|---|---|---|---|---|---|
| Ours, 31 Oct | | | **yes** | | "objectively the safer buy… zero-delay… clean legal standing… unblemished" (`HARD43_SCORECARD_AFTER_2026-10-31.md`) |
| Ours, HEAD 4 Nov | 6 | 3 | 0 | 3 | Astralis's record only; Mezzaria not covered |
| **Ours, after** | **12** | **0** | **0** | **33** | Both records, no winner. Mezzaria: validity 28 Sep 2021 has passed; ready to move with no OC on record |
| ChatGPT, 31 Oct | 2 | 28 | 1 | 0 | Cites 53 complaints and the lapsed registration |
| Perplexity, 31 Oct | 0 | 26 | 5 | 0 | "Mezzaria wins clearly", "project is delivered" |

**Wrong facts, checked by hand against the register:**
- ChatGPT's 53 complaints matches the UP-RERA summary page we read on 27 Oct.
- Perplexity's "project is delivered" is not backed by any OC we hold.
- Our answer states no wrong fact, but it still says "Complaints: Not on record" for Mezzaria. That stays true until Furqan approves the pending 53-complaint draft (`29-approve-complaints.ts --exact --by Furqan`). Approving it is the single change that closes the gap with ChatGPT on this question.

## Checks
- `falseReassurance.test.ts` 20/20; `projectCatch.test.ts` 19/19, including the dated complaint and order lines run through `sanitizeOutput` unchanged; `readyIsNotOc.test.ts` 1/1; all prompt tests pass, including `promptPrefixStability`; `projectFactChecks.test.ts` 27/27; `answerIntegrity.test.ts` 48/48; `safetyScore.test.ts` 4/4.
- `npx tsc --noEmit` passes for backend and frontend; eslint is clean on the touched frontend files.
- Route replay: 245/245 turns pass on the final combined tree (Day 1 and Day 5 changes; 198 by code, 47 by the stubbed model), including the six new `safety40-*` cases.

## Open
- Approve the complaint and order drafts on dev (Furqan), then decide on a live write.
- Abeyance list: re-try when UP-RERA's service works.
- Weekly paste of the 40 questions (`external-ai/README.md`).
- The registration table lane (`deterministicFactRouter.ts`) still shows "Registration valid until 2021-09-28" without saying the date has passed. Not changed today.

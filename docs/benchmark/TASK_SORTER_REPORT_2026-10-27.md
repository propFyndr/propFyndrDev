# Task sorter: first measurement (2026-10-27)

RealtyAsk's own question sorter (`backend/src/lib/chat/taskSorter.ts`) puts each buyer message into one task using ordered rules, with no model call. This report scores it against hand labels of every real buyer turn on live (238 turns, 26 Sep – 27 Oct; bots and scripts excluded). It also shows which lane the live router actually used for each task.

**Status: measurement only.** Nothing on the live request path calls the sorter. A task is switched over only after its score is good enough and the owner chooses it.

- **Labels:** `backend/src/lib/eval/task-labels.json`, keyed by `turn_traces.id`. Buyer text stays in the database and is not copied into the repo.
- **Re-run:** `cd backend && npx tsx scripts/corpus/task-sorter-eval.ts`. It is read-only on Neon and lists each disagreement locally.
- **Unit test:** `src/lib/chat/__tests__/taskSorter.test.ts`, 19 phrasings not in the labelled set.
- **Caveat:** the rules were written after reading these same messages, so 94.9% overstates accuracy on new questions. Re-score on next week's turns before switching anything.

## Score

The sorter agrees with the hand label on **225 of 237** turns (94.9%).

| Task | Labelled | Sorter right | Recall | Sorter said this | Precision |
|---|---|---|---|---|---|
| search | 74 | 70 | 95% | 74 | 95% |
| project_fact | 37 | 37 | 100% | 38 | 97% |
| compare | 16 | 15 | 94% | 15 | 100% |
| price_check | 12 | 12 | 100% | 12 | 100% |
| cost_calc | 13 | 12 | 92% | 13 | 92% |
| advice | 12 | 12 | 100% | 13 | 92% |
| legal | 5 | 5 | 100% | 5 | 100% |
| meta | 8 | 8 | 100% | 8 | 100% |
| action | 5 | 5 | 100% | 5 | 100% |
| followup | 35 | 30 | 86% | 30 | 100% |
| smalltalk | 11 | 10 | 91% | 10 | 100% |
| out_of_scope | 9 | 9 | 100% | 9 | 100% |
| other | 0 | 0 | — | 5 | — |

Most of the 12 disagreements are follow-ups that only make sense with the previous turn, plus a few misspelled searches.

## Where each task went on live (lane, turns, average seconds)

| Task | Lanes |
|---|---|
| search | main 59 (19.3 s), possession_status 3 (1.7 s), vicinity-lookup 3 (2.4 s), OPEN 2 (11.1 s), search 2 (2.7 s), other lanes 5 |
| project_fact | ground-truth-db 7 (9.2 s), OPEN 5 (9.4 s), payment-plans 4 (10.4 s), vicinity-lookup 4 (3.5 s), main 4 (30.1 s), project_catch 3 (9.2 s), NEWS_MILESTONE 3 (13.6 s), other lanes 7 |
| compare | ground-truth-db 4 (20.3 s), main 4 (16.1 s), builder-reputation 3 (4.9 s), OPEN 3 (30.6 s), sector-comparison 1, jev_live 1 |
| price_check | main 11 (27.9 s), price_fairness 1 (6.2 s) |
| cost_calc | main 5 (21.7 s), OPEN 4 (28.2 s), statutory_tax 1 (3.2 s), total_outflow 1 (2.9 s), affordability_advisor 1 (4.6 s), ground-truth-db 1 (5.6 s) |
| advice | main 10 (21.2 s), OPEN 1 (6.2 s), coverage-lane 1 (5.1 s) |
| legal | amenity-lifestyle 2 (4.5 s), OPEN 1 (27.5 s), forensic_comparison 1 (5.9 s), legal_risk 1 (5.4 s) |
| meta | main 4 (10.1 s), OPEN 3 (12.7 s), aggregate 1 (3.7 s) |
| action | main 3 (9.1 s), dossier_generator 2 (11.0 s) |
| followup | main 27 (11.6 s), OPEN 4 (7.0 s), answer-cache 3 (0.0 s), search 1 (2.3 s) |
| smalltalk | greeting 6 (1.4 s), main 3 (9.7 s), OPEN 2 (8.7 s) |
| out_of_scope | OPEN 3 (6.9 s), coverage 2 (14.9 s), main 2 (22.4 s), search 2 (5.0 s) |

## Findings

1. **Fast handlers exist, but the router sends these questions to the slow lane.**
   - Price checks: 11 of 12 went to `main` (27.9 s); `topic:price_fairness` answers in 6.2 s.
   - Cost questions: 9 of 13 went to `main` or `OPEN` (22–28 s); the dedicated handlers answer in 3–5 s.
2. **Small talk and out-of-scope questions cost a full model answer.** 12 turns took 7–22 s where a greeting or scope reply takes about 1.4 s.
3. **Follow-ups ("yes", "next", "step 5") are 15% of turns** and mostly go to `main` (11.6 s). They need the previous turn, so the sorter can only flag them; the router's conversation state has to answer them.
4. **Searches correctly go to `main`, but average 19.3 s.** That is the provider slowness (Gemini first-token stall), not routing.

## Suggested switch order (owner decides)

1. Small talk and out of scope: lowest risk, instant replies.
2. Price check, then cost calculation: the handlers already exist; only the routing changes.
3. Meta: fixed answers already exist.

For each switch: add the cases to `route-replay.json`, run the replay, then compare a week of live turns before and after.

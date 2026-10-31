# Hard-43 scorecard: RealtyAsk before and after the fixes (31 Oct 2026)

Before: `HARD43_SCORECARD_2026-10-31.md` (raw `answers/hard43-before.json`). After: `answers/hard43-after2.json`, produced by `scripts/corpus/day5-speed.ts scripts/corpus/hard43.json hard43-after2`.
Same 43 questions, one fresh guest each, real model chain, in-process through the real `/api/v1/chat` route. Database: Neon dev (`ep-odd-bar…`), read 31 Oct 2026.

| | Before | After (this run) |
|---|---|---|
| Git sha | `7ef5bfd5`, 5 modified files | `22e341d0`, 14 modified files (uncommitted work from two sessions) |
| Run time (UTC) | 06:37 | 09:06 |
| First token, median / p90 / max | 6,077 / 11,510 / 17,155 ms | 9,809 / 18,946 / 39,222 ms |
| Total, median / p90 / max | 6,806 / 14,368 / 17,390 ms | 11,147 / 24,765 / 39,840 ms |
| Questions with no model call on the wire | 5 | 6 |
| Outage notice | none | **H4** |

An earlier after-run by the other session (`hard43-after.json`, 08:07 UTC, sha `7ef5bfd5`, 20 modified files) had median first token 11,591 ms and no outage. It predates the Q1/H1 handler and the corpus fixes.

**Latency got worse, and I cannot attribute it.** First token on turns that called a model: median 6,419 ms (38 turns) before, 10,259 ms (37 turns) after. Turns with no model call: 1,257 ms (5) before, 2,881 ms (6) after. The same code lanes slowed, so a change in those lanes is unlikely to be the cause. The Gemini first-token delay in `CLAUDE.md` § Infrastructure (17–20 s) fits the pattern, but I did not measure the providers in this run, so that is a hypothesis. H4 gave the outage notice after 37 s; F11 took 39 s to its first token.

## What changed, question by question
Lane changed on 9 of 43 turns (1, 6, 8, 9, 11, H1, H3, F2, F3). Verdicts read from the answers in `hard43-after2.json`.

| Q | Before | After | Status |
|---|---|---|---|
| 1 | `search`: lists Greater Noida West 3BHKs only, no decision | `topic:alternatives_choice`: both sides from rows (94 projects for the Noida 2 BHK side, 24 for the Greater Noida West 3 BHK side in the replay), trade-off, no ranking | **Fixed** |
| H1 | same, English | same handler, Hinglish | **Fixed** |
| 6 | sector table with "Not recorded" cells | per-project facts and a "choose X if" line from rows | **Fixed**, but end-use versus investment is covered by one clause ("we do not provide returns") |
| 8 | "I've lost track" (253 chars) | cheapest per sq ft from rows, three projects, price-confirmation note, a recommendation | **Fixed**; one irrelevant sentence about registration is left in the verdict |
| 9, H3 | "Yes, fair" beside our own ₹14,500 | range ₹9,343–24,091, median ₹15,576, "below the lowest we hold", no verdict | **Fixed**; H3 is still English |
| 11 | "Did you mean: Sector 78, Sector 150?" (36 chars) | two-sector table | **Fixed in the table**; the model's closing paragraph is a problem, see below |
| F2 | 192 pool projects, jacuzzi ignored | 8 projects with pool and jacuzzi | **Fixed** |
| F3 | generic "most societies have it" | 39 projects with billiards or snooker | **Fixed** |
| F10, F16, F19 | wrong project row | Great Value Sharanam in Sector 107; Jaypee Klassic Block 6-10 | **Fixed** (lane unchanged, content corrected) |
| F14 | no validity statement | validity row present | **Fixed** |
| F17 | no sum | ₹3.63 × 1,500 = ₹5,445 a month | **Fixed** |
| F20 | DG rate held, not given | ₹19.5 per unit given | **Fixed** |

Unchanged by this work: Q3 (sector table irrelevant at ₹1.2 Cr), Q7 (still answers Great Value Sharanam 2BHK only, 1,853 chars both runs), Q2, Q4, Q12–Q14, H5 (generic, no row-backed number), F11 (Connaught Place honestly "not held"), F13 and F15 (builder name only, "what else delivered" still unanswered), and the Hinglish answers in English for H2–H5 and FH1–FH3.

## New problems this run shows
1. **Q11's closing paragraph.** The model adds "Sector 150 emerges as the superior choice for forward-looking capital deployment…". That is a verdict leaning on investment, which `CLAUDE.md` puts out of scope, and it follows a table that says Sector 78 is 0.7 km from a metro against 3.2 km for Sector 150.
2. **Q5 says "objectively the safer buy… a zero-delay builder track record, and a clean legal standing"** for Mahagun Mezzaria. These come from our rows (owner policy: answer as stored), but ChatGPT and Perplexity cite 53 UP-RERA complaints, a lapsed RERA validity (2021-09-28 in our row, status "Ongoing" on the portal) and a pending occupancy certificate. "Objectively" also breaks the tone rule. A data check and a prompt fix.
3. **H4 outage notice** after 37 s.
4. **Q8's boilerplate** sentence: "Registration puts the project on record with the authority…" has nothing to do with price per sq ft.

## Not changed and not measured
- ChatGPT and Perplexity references were not re-run. The invalid ones listed in the first scorecard (F3, FH1, Q14 geolocation; F11 and Q12 capture; Perplexity after Q8) still apply.
- Seeded prices, the duplicate "Mahagun Meadow" row, Eureka Park's status and metro rows, and the Astralis and Mezzaria data conflicts are in `C1_DAY6_ROWCHECK_2026-10-31.md` and are untouched.
- This run is one fresh guest per question on one provider chain at one hour. It shows direction, not a rate.

## Addendum: prompt fixes and the 60-question rerun (31 Oct 2026, later)

**Harness correction.** `day5-speed.ts` joined every token event and ignored `replace: true`, so `hard43-after2.json` can show a failed provider leg's partial sentence in front of the answer the buyer saw (the duplicated Q11 paragraph). It now builds the answer as `run-corpus.ts` and the client do. `hard43-after2.json` answers are therefore not exact for turns that fell back between providers; the Q11 verdict language itself was real (it came from the prompt).

**Prompt changes** (re-checked on the real model, `hard43-q5q11c.json`; one fresh guest each):

| Q | Change | Result |
|---|---|---|
| 11 | `sectorComparison.ts` prompt: "which of the two, the single distinction that decides it" replaced by "the difference that matters most, no winner"; no "superior", "capital deployment", "appreciation", "returns"; figures only from the facts | Answer states the table's figures, a trade-off for each sector, and "Choose X if … choose Y if …". No investment framing |
| 5 | project comparison prompt in `chat-router.ts`: a "safer"/"better" question gets checkable markers, not a ruling; no "objectively", "clean", "safe", "zero delay"; an empty field is "not on record"; a past RERA validity date is named; ready status is not an occupancy certificate | "Objectively" and "clean legal standing" are gone and it says "our record shows". **Still wrong:** the occupancy certificate row reads "Delivered & Ready (OC status to be verified)" for Mezzaria, and the Verdict says "unblemished insolvency record". The model does not fully obey the rule; a code-level check on that row would. Our row holds no occupancy certificate for Mezzaria |
| 8 | same prompt: for "is that a good sign" say only what recorded facts allow, nothing about what registration guarantees or about returns | The two canned sanitizer sentences (registration, returns) no longer appear. The table now shows both a cost-sheet base rate (Divine Meadows ₹6,913, Mezzaria ₹10,759) and a computed rate (₹9,577, ₹15,105) side by side: that is the data conflict in `C1_DAY6_ROWCHECK`, finding 12 |

Q11 residual: the model writes that Sector 78 buyers "trade away lower entry costs", while the table shows Sector 78's average rate (₹12,200) below Sector 150's (₹14,500). It repeats the table's "resale pricing has escalated" watch-out without checking it.

**60-question corpus** (`run-corpus.ts --limit=60 --concurrency=2`, local backend on Neon dev, real chain, private Redis prefix, 31 Oct 2026). Raw: `backend/scripts/corpus/results-day7-after-q11q5.json`.

| Run | Pass | p50 / p90 total |
|---|---:|---|
| 26 Oct (provider outage) | 42 / 60 | 17.1 s / 52.5 s |
| 31 Oct after the hard-43 fixes (earlier run) | 58 / 60 | 9.7 s / 14.0 s |
| 31 Oct after the sector-list and same-sector fixes | **60 / 60** | 10.6 s / 18.4 s |

q002 ("1 bhk flats in sector 75") now lists the sector's other configurations; q005 ("sector 74 75 76") now searches all three sectors. The run billed 27 of 60 queries at $0.1739 in total as metered by `ai_usage_events`.

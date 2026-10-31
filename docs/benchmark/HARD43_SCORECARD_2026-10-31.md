# Hard-43 scorecard (31 Oct 2026): RealtyAsk vs ChatGPT vs Perplexity: BEFORE any fix

Questions: `HARD20_QUESTIONS_2026-10-31.md` (15 hard + 5 Hinglish + 23 field-coverage = 43).

## How it was run, and what it cannot tell you
- **RealtyAsk:** `day5-speed.ts` through the real `/api/v1/chat` route, real model chain, fresh guest per question, git `7ef5bfd5` plus a dirty tree (prompts `base.ts` / `playbooks.ts` edited, not committed). Database: Neon **dev** (`ep-odd-bar…`, RealtyAsk-dev), read 31 Oct 2026. Raw: `answers/hard43-before.json`.
- **ChatGPT:** logged-out, fresh page per question, Playwright, answer read from page text. 43 of 43 captured. Raw: `hard43/chatgpt.json`.
- **Perplexity:** logged in (free account). The free-search limit ended the run after **8 answers**, so Perplexity covers **Q1–Q8 only**. Raw: `hard43/perplexity.json`. A logged-out partial is in `perplexity-loggedout-partial.json`.

**Reference caveats (do not score us down on these):**
- Logged-out ChatGPT is geolocated oddly: F3 and FH1 answered about **Srinagar**, Q14 about **Jammu & Kashmir**. Those three references are unreliable.
- ChatGPT **F11** capture failed (page chrome only). **Q12** capture is search-result snippets, not an answer. Rerun both before using.
- ChatGPT and Perplexity answered F6, FH2 and F15 about **MJR Divine Meadows, Bengaluru**: the wrong project. We were right on those.
- Time to first word is read from page text, so the rivals' ~0.8 s is **not trustworthy**. Day 2 measured ChatGPT at ~2 s. Ours is measured on the wire.
- Both rivals quote portal asking prices as fact (CLAUDE.md § Benchmark). We don't, so "fewer numbers" on price questions is partly by design.

## Our numbers
- Time to first token: median **6.1 s**, p90 11.5 s, max 17.2 s. Total median 6.8 s, p90 14.4 s.
- Model calls: 38 of 43 turns called a model; 5 were deterministic (F2, F14, F19, F20, 11).
- No "AI unavailable" outage this run. No answer-cache hits (private Redis prefix).

## One line per question (where we are weaker, or stronger)

| Q | Lane | Verdict |
|---|---|---|
| 1 | search | **Doesn't answer the decision.** Lists Greater Noida West 3BHKs only, "between ₹1.3 Cr and ₹1.3 Cr", nothing on the ready 2BHK half. No trade-off. Both rivals recommend with reasons. |
| 2 | PROJECT_DETAIL_NO_PROJECT | Reasoned and ends with a question. No number; rivals give a comparison table. About level on substance. |
| 3 | main | Sector table (₹18,500 / ₹15,800 /sq ft, "Ultra-Luxury") is irrelevant at ₹1.2 Cr. Trade-off paragraph is fine. Rivals give a decision rule. |
| 4 | OPEN | Same verdict as both rivals. No worked arithmetic. |
| 5 | ground-truth-db | Clear verdict and trade-off from builder rows. **Misses that ChatGPT and Perplexity call Astralis a commercial project; our row says Residential. Data check.** |
| 6 | topic:sector-comparison | **Regression.** Two named projects get the sector table with "Not recorded" cells and a sector verdict. This was Day-2 fix #2; the question is pinned in `route-replay.json`. No end-use vs investment split. |
| 7 | topic:statutory_tax | Exact statutory total, but for **Great Value Sharanam 2BHK only**. Divine Meadows and the 3BHK are ignored. |
| 8 | unresolved-pointer | **No answer.** "I've lost track of which options you mean" for three projects named in the question. Rivals rank them. |
| 9 | main | **Trust problem.** Says "Yes, fair", labels the buyer's own ₹8,500 as "typical for Noida", while our sector table shows Sector 150 at ₹14,500/sq ft. Verdict with no data, against our own data. |
| 10 | budget-check | **Ahead.** Range from our rows, 111 of 127 projects, median ₹77 L, lowest and highest named, labelled computed. Both rivals are generic. |
| 11 | unlabelled | **Fails.** "Did you mean: Sector 78, Sector 150?" (36 characters). |
| 12 | OPEN | Reasonable list; some points ungrounded. About level with Perplexity. ChatGPT capture invalid. |
| 13 | main | Reasonable checklist. ChatGPT has a similar one. |
| 14 | main | UP-RERA Section 18 refund and interest, correct jurisdiction. ChatGPT assumed J&K (reference invalid). |
| 15 | topic:resale_deal | **Ahead.** Full tickable documents and dues checklist, arithmetic on ₹95 L, honest "I can't say" on price. Cost table comes before the checklist, which the buyer asked for; minor. |
| H1 | search | Same as Q1: answered in English, did not answer the decision. ChatGPT answers in Hinglish. |
| H2 | topic:builder-reputation | Builder table only, no verdict. English. |
| H3 | main | Same defect as Q9. |
| H4 | main | Good content; the log shows a claim (70% escrow) flagged `CHAT:UNGROUNDED`. English answer to a Hinglish question. |
| H5 | OPEN | Same as Q14, English. |
| F1 | topic:amenity-lifestyle | **Ahead.** Amenities from our rows. |
| F2 | aggregate | **Ignores "and a jacuzzi".** Lists 192 projects with a pool; Astralis (heated pool and jacuzzi) is held. |
| F3 | OPEN | **Wrong lane.** A generic "most societies have a snooker room" claim. We hold billiards for Mezzaria and Astralis. `topic:amenity_search` exists (F4 used it) but did not fire. |
| F4 | topic:amenity_search | Correct lane, 26 projects. The same amenity strings repeat across projects (squash plus badminton, golf simulator plus billiards): templated rows. Owner policy: answer as stored. |
| F5 | topic:payment-plans | **Ahead.** Both stored plans with milestones. |
| F6 | topic:payment-plans | **Ahead.** "Not on record" plus advisory handoff, no template plan. Both rivals chose the wrong project. |
| F7 | topic:cost-sheet | **Ahead.** Stored charges. Labelled "Verified base rate"; cost-sheet figures were seed-generated (CLAUDE.md § Data Integrity Debts). |
| F8 | topic:cost-sheet | Same. |
| F9 | topic:vicinity-lookup | Landmarks and distances from rows; no address or Sector 78 context. |
| F10 | topic:vicinity-lookup | **Wrong project row** (Sharanam Greno, Sector 1 instead of Sharanam, Sector 107). One hospital only; **no schools, no airport** as asked. |
| F11 | ground-truth-db | Sector 62 given, Connaught Place honestly "not recorded". 17.4 s, the slowest. A measure was dropped (`MEASURE_DROPPED` in the log). |
| F12 | coverage-lane | **Ahead.** Nearby projects by distance. Does not compare sectors "for a family". |
| F13 | topic:vicinity-lookup | One line, 170 characters. **Data conflict:** we say 2.1 km, ChatGPT says 400–550 m. |
| F14 | deterministic-fact | Gives the number. **Does not say validity is not held** (`rera_valid_until` is null). **Number conflicts with rivals:** ours UPRERAPRJ4017, theirs UPRERAPRJ7263 (commercial phase). |
| F15 | topic:developer_of_each | Builder name only. **"What else have they delivered" is unanswered.** Rivals have the wrong project. |
| F16 | topic:amenity-lifestyle | **Wrong project row** (Greno, Sector 1). |
| F17 | topic:cost-sheet | **No computation.** Never states 1,500 × ₹3.63 = ₹5,445 a month (our stored rate). |
| F18 | topic:unit_configuration | Unit rows with carpet and super area. ChatGPT's areas differ from ours (1,220 vs 1,356 sq ft for the 2BHK). Check. |
| F19 | deterministic-fact | **Wrong project row.** Buyer said Sector 134; we answered Sector 128 "ready to move". The Sector 134 row is under construction, Q4 2027. |
| F20 | deterministic-fact | Water answered. **DG rate not given**, though we hold ₹19.5 a unit. |
| FH1 | topic:amenity-lifestyle | **Ahead.** ChatGPT asked about Srinagar. English answer to Hinglish. |
| FH2 | topic:payment-plans | Same as F6. |
| FH3 | ground-truth-db | Metro, school and hospital distances from rows. English. |

## Gap list, ranked by how many of the 43 it touches

| Rank | Gap | Questions | Count |
|---|---|---|---|
| 1 | **Slow first word** (median 6.1 s, p90 11.5 s) | all | 43 |
| 2 | **Part of the question not answered**: decision skipped, one of two projects dropped, a stated field ignored (jacuzzi, billiards, schools/airport, validity, DG rate, "what else delivered", the 1,500 sq ft sum, the Connaught Place leg) | 1, 3, 6, 7, H1, F2, F3, F10, F11, F14, F15, F17, F20 | 13 |
| 3 | **Generic answer with no row-backed number** where rivals have a table | 2, 4, 12, 13, 14, H4, H5 | 7 |
| 4 | **Data conflicts with the rivals** (Astralis RERA and project type; Mezzaria metro distance; unit areas) | 5, F1, FH1, F13, FH3, F14, F18 | 7 |
| 5 | **Answers in English to a Hinglish question** | H1–H5, FH1–FH3 | 8 |
| 6 | **Wrong project row** (sector or name variant ignored) | F10, F16, F19 | 3 |
| 7 | **No answer at all** | 8, 11 | 2 |
| 8 | **Price verdict with no data, against our own sector table** | 9, H3 | 2 |

Ranks 6–8 touch few questions but are worse for trust than rank 3: a wrong project, a refusal, or an invented-looking verdict costs more than a thin answer. Counts are from this run and one fresh guest each.

## Where we are ahead (keep)
Payment plans and cost sheets from our rows (F5–F8), "not on record" instead of a template (F6, FH2), computed range with project count (Q10), exact statutory total (Q7), nearby-projects list (F12), correct project where both rivals chose Bengaluru (F6, F15, FH2).

## Proposed top 3 fixes (not started; waiting for a choice)
1. **Name and sector resolution.** An exact project-name match must beat a longer variant, and a sector the buyer states must pick the row (F10, F16, F19).
2. **The "fair price" and unresolved-comparison lanes.** Answer Q8 from the three named projects' per-sq-ft rows (computed, with n), and Q9, H3 and Q11 from `sector_intelligence` with no verdict. Never label the buyer's own figure "typical".
3. **Answer every part of a multi-part question.** Route billiards and snooker to the amenity search lane, and honour "and a jacuzzi". Compute the maintenance sum, give the DG rate, and say plainly when a validity date is not held.

**Not in the top 3, logged:** speed (Day 5 work); Hinglish answers in English; the Astralis RERA number and project type (data check); Mezzaria metro distance (data check); the Q6 regression.

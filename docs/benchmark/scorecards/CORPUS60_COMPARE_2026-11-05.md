# 60 questions: 26 Oct baseline vs 31 Oct re-runs, question by question

Written 5 Nov 2026 from saved raw results; nothing was re-run for this file.

**What this is and is not.**
- Same 60 questions (`backend/scripts/corpus/corpus.json`, first 60), graded mechanically by `run-corpus.ts` (pass / unavailable / too_short / error). Not a quality judge: "pass" means a full answer arrived, not that it was right.
- **All three runs used a local backend against the dev database**, with the real provider chain. **None ran against the live site** (realtypalsdev.onrender.com), so the plan's "60 questions on the live AI" is still open.
- The 31 Oct runs used the code of 31 Oct. Code has changed since (4–5 Nov), so these numbers describe that day's code, not today's.

**Raw answers (committed with this file):**
- Baseline: `docs/benchmark/answers/corpus60-day7-run3-2026-10-26.json` (run 3 of `DAY7_CORPUS60_2026-10-26.md`)
- After the hard-43 fixes: `docs/benchmark/answers/corpus60-2026-10-31-after-hard43fixes.json` (copied from the git-ignored `results-day7-after-hard43fixes.json`, written 31 Oct 08:12 UTC)
- After the Q11/Q5 fixes: `docs/benchmark/answers/corpus60-2026-10-31-after-q11q5.json` (copied from `results-day7-after-q11q5.json`, 31 Oct 09:22 UTC)

| Run | Grades | Answers that called a model | `ttftMs` p50 / p90 (first streamed token as `run-corpus.ts` records it; after 31 Oct this can be the status line) | Done p50 / p90 |
|---|---|---:|---|---|
| 26 Oct run 3 (baseline) | pass 42, too_short 14, unavailable 4 | 0 | 5.4 s / 7.7 s | 17.1 s / 52.5 s |
| 31 Oct after hard-43 fixes | pass 58, too_short 2 | 27 | 0.4 s / 0.7 s | 9.7 s / 14.0 s |
| 31 Oct after Q11/Q5 fixes | pass 60 | 27 | 0.6 s / 1.3 s | 11.1 s / 18.7 s |

Against the baseline, the last run fixed 18 questions and regressed 0. On 26 Oct no model call succeeded (Gemini's first token took 17–20 s against an 8 s leg); on 31 Oct free Gemini answered 27 turns. The rest were answered in code. The target in the plan was 54 of 60.

## Per question

| Id | Query | Class | 26 Oct | 31 Oct (a) | 31 Oct (b) | Lane (b) | Change |
|---|---|---|---|---|---|---|---|
| q001 | 1 bhk flats in sector 74 75 76 noida for rent | out_of_scope | pass | pass | pass | - |  |
| q002 | 1 bhk flats in sector 75 noida | sector | too_short | too_short | pass | search | fixed |
| q003 | 1 bhk flats in sector 75 noida for rent | out_of_scope | pass | pass | pass | - |  |
| q004 | 2 bhk flats in sector 74 75 76 noida for rent | out_of_scope | pass | pass | pass | - |  |
| q005 | 2 bhk flats in sector 74 75 76 noida for sale | sector | too_short | too_short | pass | search | fixed |
| q006 | 2 bhk flats in sector 75 noida | sector | pass | pass | pass | search |  |
| q007 | 2 bhk flats in sector 75 noida for rent | out_of_scope | pass | pass | pass | - |  |
| q008 | 2 bhk flats in sector 75 noida for sale | sector | pass | pass | pass | search |  |
| q009 | 2 bhk in greater noida | sector | pass | pass | pass | budget-check |  |
| q010 | 2 bhk in noida | navigational | pass | pass | pass | budget-check |  |
| q011 | 2 bhk in noida extension | sector | pass | pass | pass | search |  |
| q012 | 2 bhk properties in noida | navigational | pass | pass | pass | search |  |
| q013 | 2bhk properties in noida | navigational | pass | pass | pass | search |  |
| q014 | 3 bhk flats for rent in sector 75 noida | out_of_scope | pass | pass | pass | - |  |
| q015 | 3 bhk flats in noida sector 75 | sector | pass | pass | pass | search |  |
| q016 | 3 bhk flats in sector 75 noida | sector | pass | pass | pass | search |  |
| q017 | 3 bhk in greater noida | sector | pass | pass | pass | budget-check |  |
| q018 | 3 bhk in noida | navigational | pass | pass | pass | budget-check |  |
| q019 | 3 bhk in noida extension | sector | pass | pass | pass | search |  |
| q020 | 4 bhk flats in sector 75 noida | sector | pass | pass | pass | search |  |
| q021 | 4 star properties in noida | out_of_scope | pass | pass | pass | - |  |
| q022 | 5 star properties in noida | out_of_scope | pass | pass | pass | - |  |
| q023 | accor properties in noida | out_of_scope | pass | pass | pass | - |  |
| q024 | ace properties in noida | brand_probe | pass | pass | pass | main |  |
| q025 | affordable properties in noida | budget_personal | too_short | pass | pass | main | fixed |
| q026 | airbnb properties in noida | out_of_scope | pass | pass | pass | - |  |
| q027 | amrapali properties in noida | brand_probe | pass | pass | pass | coverage-lane |  |
| q028 | apartments in noida | navigational | pass | pass | pass | search |  |
| q029 | apartments in noida extension | sector | pass | pass | pass | search |  |
| q030 | are all properties in noida leasehold | out_of_scope | unavailable | pass | pass | OPEN | fixed |
| q031 | are there freehold properties in noida | out_of_scope | unavailable | pass | pass | OPEN | fixed |
| q032 | ats properties in greater noida | brand_probe | pass | pass | pass | main |  |
| q033 | ats properties in noida | brand_probe | pass | pass | pass | main |  |
| q034 | auction properties in greater noida | out_of_scope | pass | pass | pass | - |  |
| q035 | auction properties in noida | out_of_scope | pass | pass | pass | - |  |
| q036 | bank auction properties in noida | out_of_scope | pass | pass | pass | - |  |
| q037 | best 2 bhk in noida | discovery | too_short | pass | pass | main | fixed |
| q038 | best 2 bhk under 1 crore in noida | budget_personal | too_short | pass | pass | main | fixed |
| q039 | best 3 bhk in noida | discovery | too_short | pass | pass | main | fixed |
| q040 | best 3 bhk under 1.5 crore in Noida | budget_personal | too_short | pass | pass | main | fixed |
| q041 | best builder in noida | project_builder | pass | pass | pass | topic:builder-reputation |  |
| q042 | best builder in noida for apartments | project_builder | pass | pass | pass | topic:builder-reputation |  |
| q043 | best commercial properties in noida | out_of_scope | pass | pass | pass | - |  |
| q044 | best investment properties in noida | discovery | unavailable | pass | pass | main | fixed |
| q045 | best investment properties in sector 107 noida | sector | unavailable | pass | pass | main | fixed |
| q046 | best luxury properties in noida | discovery | pass | pass | pass | main |  |
| q047 | best new project in noida | project_builder | pass | pass | pass | main |  |
| q048 | best new project in sector 150 | project_builder | too_short | pass | pass | main | fixed |
| q049 | best properties in central noida | discovery | pass | pass | pass | main |  |
| q050 | best properties in greater noida | sector | pass | pass | pass | main |  |
| q051 | best properties in noida | discovery | pass | pass | pass | main |  |
| q052 | best properties in noida extension | sector | pass | pass | pass | main |  |
| q053 | best properties in sector 107 noida | sector | too_short | pass | pass | main | fixed |
| q054 | best property in Noida | discovery | pass | pass | pass | main |  |
| q055 | best property under 1 crore in noida | budget_personal | too_short | pass | pass | main | fixed |
| q056 | best property under 1.5 crore in noida | budget_personal | too_short | pass | pass | main | fixed |
| q057 | best property under 2 crore in noida | budget_personal | too_short | pass | pass | main | fixed |
| q058 | best property under 50 lakh in noida | budget_personal | too_short | pass | pass | main | fixed |
| q059 | best property under 75 lakh in noida | budget_personal | too_short | pass | pass | main | fixed |
| q060 | best residential properties in noida | discovery | pass | pass | pass | main |  |

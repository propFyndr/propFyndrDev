# Day 2 scorecard (16 Oct 2026): RealtyAsk vs ChatGPT vs Perplexity

**How it was run.**
- **ChatGPT and Perplexity:** both logged-out free tier, each question in a fresh chat, driven by Playwright. Answers were read from the page text, not the Network tab, so the timings are wall-clock in the browser.
- **RealtyAsk:** current `dev` code run locally through the real chat route with the real model chain, against the dev database (Supabase). It is not the deployed live service.
- **Raw answers:** `answers/chatgpt-raw.json`, `answers/perplexity-raw.json`, `answers/realtyask-before.json`.
- **Questions:** `DAY2_QUESTIONS_2026-10-16.md`. They are still a draft until the team signs off.

**Caveats.**
- Logged-out ChatGPT may run a weaker model than a paid account.
- Both assistants quote listing-portal asking prices as options. We deliberately don't do that (CLAUDE.md § Benchmark), so "fewer options" is not always a gap we should close.

## Per question (where we are weaker)

| Q | Topic | First word, ours / ChatGPT / Perplexity | Where we are weaker |
|---|---|---|---|
| 1 | 3BHK <1.5 Cr, possession ≤1 yr | 18.2 s / 2.2 s / 6.0 s | Slow. Only 2 projects. A contradictory price ("from ₹0.79 Cr", range ₹1.08–1.17 Cr). An unasked Jaypee Garden Isles warning. |
| 2 | 2BHK GNW 80 L, then "make it 1 Cr" | 12.0 s / 2.1 s / 3.2 s | **Turn 2 switched to "3 BHK" though the buyer asked for 2BHK, named no projects, and ended with a stray canned line.** Both rivals kept 2BHK and showed what changes at 1 Cr. |
| 3 | Astralis possession risk | 16.3 s / 2.0 s / 6.7 s | No RERA number or source. **Data conflict:** we say under construction, Q4 2027; both rivals cite UPRERAPRJ7263 with a 2018 completion date or delivery around 2020. Our row needs checking. |
| 4 | Move in ≤6 months, ready 3BHK | 5.9 s / 2.2 s / 6.7 s | **Doesn't answer.** A generic ready-vs-UC explainer asks for a sector or budget the buyer already gave. Rivals list 6 projects. Cause: "3BHKs" (plural) fails `\d\s*bhk\b`, so it never counts as a search. |
| 5 | Near metro, 1.2 Cr | 11.7 s / 2.1 s / 9.3 s | No station name or distance ("close to the Sector 50/76 transit corridors"). Rivals name the station and give metres. |
| 6 | Commute to Sector 62, 2BHK <1 Cr | 6.4 s / 2.2 s / 3.8 s | About level: ranked sectors and a table. No commute time or trade-off per sector, where Perplexity gives both. |
| 7 | Trust Supertech? | 9.6 s / 1.2 s / 5.2 s | Flat "avoid". Missing the 2024 NCLAT order putting NBCC in charge of 16 projects, and the 2026 Supreme Court ruling upholding it. Both rivals have it. |
| 8 | Jaypee Klassic vs Gulshan Ikebana builder | 7.7 s / 2.2 s / 5.3 s | **Answers a different question:** a sector table full of "Not recorded" and a verdict based on sectors. Both rivals compare the two builders. |
| 9 | Total cost on 1.4 Cr | 12.9 s / ~2 s / 5.8 s | Never states the total (rivals give ₹1.512 Cr ready / ₹1.582 Cr UC). Otherwise more exact than both, including TDS and the circle-rate floor. |
| 10 | 80% loan on 1.5 Cr: EMI and cash | 12.7 s, then failed at 39 s / 2.2 s / 5.6 s | **Failed:** an "AI service unavailable" message. The EMI handler doesn't read "N% loan on X". Rivals give the EMI, ₹30 L down payment and total cash. |

## Gaps ranked by how many questions they hit

| Rank | Gap | Questions | Kind |
|---|---|---|---|
| 1 | Slow first word on model lanes (10–18 s vs 2–7 s) | 1, 2, 3, 5, 9, 10 | Speed: Day 5 work |
| 2 | **Doesn't answer the question asked** (wrong lane, or no answer at all) | 4, 8, 10, 2 (turn 2) | Routing: fixable now |
| 3 | Missing the headline number the buyer asked for (total, cash up front) | 9, 10 | Existing deterministic answers |
| 4 | Missing evidence a rival gives (station distance, RERA number, latest court order) | 3, 5, 7 | Data / prompt |
| 5 | Short shortlist (2–3 projects or none) | 1, 2, 4 | Partly by design: we don't list portal asking prices |

## Proposed top 3 fixes (changes to how we already answer)

1. **Q4:** accept the plural "3BHKs" in the router's search check (`chat-router.ts:3613`), so the question becomes a ready-to-move search.
2. **Q8:** don't run the sector comparison when the buyer named two projects (`chat-router.ts:3572`); let the existing project or builder comparison answer.
3. **Q10 + Q9:** the EMI handler reads "N% loan on a X flat" and adds the cash needed up front (down payment plus statutory stamp duty and registration, and GST if under construction). The statutory answer adds the total line.

**Not in the top 3, logged:**
- The Astralis possession data conflict: a data check, not code.
- The Supertech NBCC update is missing from our builder record.
- The Q2 follow-up switching to "3 BHK" is the model's wording; the intent kept bhk = 2.
- Speed is Day 5 work.

## After the fixes (task 4): same 10 questions, same setup (`answers/realtyask-after.json`)

| Q | Before | After |
|---|---|---|
| 4 | Generic ready-vs-UC explainer; asked for a sector the buyer had given | Ready-to-move search (main lane); names Divine Meadows, Great Value Sharanam and Mahagun Mezzaria, and asks the budget ceiling |
| 8 | Sector 134 vs 143 table, "Not recorded" cells | Builder-vs-builder verdict: Gulshan Homz 0 delays vs Jaypee Greens (Suraksha resolution) 8 delayed projects, 48 months average, insolvency. These figures match the builder rows. **Unverified in the same answer:** "10 litigations (3 ongoing)" and "clear title" for Gulshan are not on the builder rows; check them in Day 3 (heuristic legal columns). |
| 9 | Rates and charges, no total | Adds **Total, ready to move ₹1,51,20,000** and **under construction ₹1,58,20,000** (same as ChatGPT and Perplexity) |
| 10 | Model lane, failed with an outage message at 39 s | Deterministic: EMI ₹1,04,139 (8.5%, 20 yrs, both labelled assumptions), cash up front ₹42,00,000 ready-to-move / ₹49,50,000 with GST. No model call. |

**Not fixed, seen in the re-run:**
- **Q1 failed this time** with the "AI service briefly unavailable" message at 39 s. Same lane as before; the provider chain is flaky on free keys (CLAUDE.md § Infrastructure).
- That outage message is followed by a stray "They're on the cards above" line.
- Deterministic answers still take 13–16 s end to end, which points to the work done before any handler runs. That is Day 5 speed work.

**Hinglish (task 5):** 9 of the 10 pairs route the same as English. H7 (Supertech trust) reaches the model in both languages, through different lanes (`main` vs `OPEN`).

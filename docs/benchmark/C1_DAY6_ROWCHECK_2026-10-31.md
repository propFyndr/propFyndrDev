# Row check: our dev rows vs the competitor answers (31 Oct 2026)

Source: Neon dev (`DATABASE_URL`, host `ep-odd-bar…`), read-only SELECTs, read 31 Oct 2026. No writes. Live (`NEON_DB`) not touched.
Compared against: `docs/benchmark/competitor-answers/` (ChatGPT, Perplexity, Gemini), `HARD43_SCORECARD_2026-10-31.md`.

## 1. Coverage of projects the rivals named (382 project rows)
- **Held:** Paras Tierea, Logix Blossom County, Prateek Wisteria, Paramount Floraville, Supertech Ecociti, Supertech Capetown, Jaypee Aman, Amrapali Silicon City, Mahagun Moderne / Mezzaria / Meadows / Mywoods / Manorialle, Tata Eureka Park (+ Phase 2), Eldeco Live By The Greens, ATS Le Grandiose.
- **Not held (name search):** Antriksh Golf City, Godrej Bliss, Tata Destination 150, Mahagun Montage (Dundahera, likely outside scope). Godrej Nurture / Nest / Palm Retreat are held.
- Rule: `name ilike '%<fragment>%'` on `projects`.

## 2. Findings
| # | Finding | Evidence | Effect |
|---|---|---|---|
| 1 | **Duplicate "Mahagun Meadow" row** (singular) beside "Mahagun Meadows", both Sector 150, different RERA (UPRERAPRJ2058 vs UPRERAPRJ1670) | 3BHK: Meadow 1,900 sq ft ₹3.22–3.48 Cr ₹16,962/sq ft; Meadows 1,945 sq ft ₹2.10 Cr ₹10,796/sq ft | Same project name, ~60% price gap. Name resolution can pick either. Feeds scorecard fix 1 |
| 2 | **Copied unit dimensions across projects** | "Mahagun Meadow" 3BHK 1,900/1,240 and 4BHK 2,675/1,760 equal Mahagun Mezzaria's 3BHK 1,900/1,240 and 4BHK 2,675/1,760 | Template data, not measured. Data debt |
| 3 | **Tata Eureka Park status contradicts its own OC field** | `status = under_construction`; `occupancy_certificate_status = "Phase 1: June 2025 (Completion & Occupancy Certificate already received)"`. All three rivals treat Phase 1 as ready | The hero query ("possession within 12 months") may mis-class it. Phase II RERA: ours UPRERAPRJ5449, an earlier ChatGPT capture said UPRERAPRJ469983. Unresolved |
| 4 | **Eureka Park metro is typed `road`, 1.8 km, source `manual`** | `connectivity`: "Sector 148 Metro Station", type `road`. Rivals say 3.2–4 km | A query on type `metro` would miss it; and 1.8 km vs 3–4 km conflicts. Needs the official or measured distance |
| 5 | **Mezzaria metro** | Ours: Sector 76 at 2.1 km (source `brochure`). Perplexity: about 4 km, and a Sector 101 station at 1.1 km in some sources | Builder-attested figure vs rivals. Not resolved |
| 6 | **Mezzaria RERA matches rivals** | UPRERAPRJ3306 on both `projects` and `project_rera_registrations`; `rera_valid_until` = 2021-09-28, which is the fourth-extension date ChatGPT and Perplexity cite. `status = ready_to_move`, `possession_date` 2023-12-31, OC and registry fields null | Number is right. The row calls it ready to move while the RERA portal (per ChatGPT and Perplexity) says "Ongoing" and its validity lapsed in 2021. We hold no OC for it. A "RERA status" answer must say validity ended 2021-09-28 and OC is not on record |
| 7 | **Astralis** | Ours: UPRERAPRJ4017, Residential High-Rise, under construction, no validity date | Scorecard F14/Q5 conflict (rivals: UPRERAPRJ7263, commercial phase) needs an official UP-RERA lookup. Not done |
| 8 | **Prices sit on the seed fingerprint** | 631 of 1,021 priced `unit_types` rows have `price_max ≈ price_min × 1.08` (±0.012). Examples: Mezzaria 3BHK 2.72→2.93, Moderne 2.11→2.27, Eureka Park 3BHK 2.47→2.67, Paras Tierea 3BHK 1.25→1.35 | Documented figure is 754 (script fingerprint); my tolerance rule gave 631, so they are not the same count. Both show the debt. See 9 |
| 9 | **Eureka Park 3BHK is above the ₹1.5 Cr ceiling in our rows** | Ours ₹2.47–2.67 Cr (seed-like). Rivals' resale asking ₹1.35–1.45 Cr (ChatGPT), ₹1.45–2.08 Cr (Perplexity) | **Inference, not proven:** this likely explains why scorecard Q1 returns Greater Noida West 3BHKs instead of the Sector 150 shortlist. Needs a routed repro to confirm |
| 10 | **Meadows 2BHK** | Ours 1,425 sq ft ₹1.45 Cr ₹10,175/sq ft, `price_max` null (not the seed fingerprint). ChatGPT listing: 1,425 sq ft ₹1.35 Cr ₹9,474/sq ft | Same unit size, 7% apart. Rivals' project-level range ₹9,088–13,350 contains ours |
| 11 | **All 382 rows have `publish_status = 'draft'`** | `group by publish_status` | Not a chat gate (the only `src` reference is `projectExposure.ts`). Matters when the supply chain ships |

| 12 | **Mezzaria base rate conflicts with its own unit rows** | Cost-sheet answer (replay, 31 Oct) shows "Verified base rate ₹10,759/sq ft"; `unit_types` for the same project hold ₹15,094–15,698/sq ft | ~40% apart inside one project. Scorecard F7/F8 already note cost-sheet figures were seed-generated. Needs one source of truth |

## 3. Replay of the hard-43 failures against the current dirty tree (31 Oct 2026, 13:40)
Method: `npx tsx scripts/corpus/route-replay.ts --file=<scratch cases> --answers`, model stubbed, so lanes and code-written answers are real and model-written answers are not visible. 15/15 turns ran; 11 answered by code, 4 by the model.
The tree already holds uncommitted edits by someone else (13 `hard43-*` cases added to `route-replay.json`, edits in `matchProjectInText.ts`, `vicinityLookup.ts`, `amenitySearch.ts` and others, timestamps 13:05–13:10). This replay therefore tests their work, not the 7ef5bfd5 build the scorecard ran.

| Q | Now | Still open |
|---|---|---|
| F2 jacuzzi | 8 projects with pool and jacuzzi, includes Astralis | none seen |
| F3 billiards | `topic:amenity_search`, 39 projects | none seen |
| F10 / F16 | Great Value Sharanam, Sector 107 (was Greno, Sector 1) | schools and airport "not on record", one hospital |
| F14 | RERA number, validity "Not on record" | none seen |
| F17 | ₹3.63 × 1,500 = ₹5,445 a month computed | table cut off in my capture |
| F19 | Jaypee Klassic Block 6-10, under construction, Q4 2027 | none seen |
| F20 | DG ₹19.5 per unit given | none seen |
| Q9 / H3 | range ₹9,343–24,091, median ₹15,576, no verdict | **H3 answered in English to Hinglish** |
| Q11 | two-sector table | model tail not visible |
| Q6, Q8 | routed to `ground-truth-db` with the model | answer text not visible under the stub |
| **Q1 / H1** | **`search` lane still lists "2 or 3 BHK in Greater Noida West up to ₹1.3 Cr" only** | **the ready 2BHK in Noida half and the decision are still ignored; no trade-off; English for H1** |

## 4. Not done
- No official UP-RERA lookups (Astralis, Eureka Park Phase II). Needs a manual or `publicRecord.ts` check.
- No routed repro yet of Q1, Q6, Q8, Q9, Q11 against the current build.
- Live (Neon) counts not read.

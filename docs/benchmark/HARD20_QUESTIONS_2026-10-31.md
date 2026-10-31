# Hard 20 buyer questions (31 Oct 2026): DRAFT, for team sign-off

Replaces the easy Day-2 set (`DAY2_QUESTIONS_2026-10-16.md`). Same method: fresh chat per question, ChatGPT and Perplexity, plus RealtyAsk.
Every named project below was named in the Day-2 files, so it should be in the catalogue. **Verify each against the dev DB before sign-off.**

"Expect" says what a good answer holds. It is the scoring key, not text to hard-code.

## English (15)

| # | Type | Question | Expect |
|---|---|---|---|
| 1 | Trade-off | I have 1.3 crore. Should I take a 2BHK ready to move in Noida or a 3BHK under construction in Greater Noida West? | Both sides' cost, possession and RERA risk; asks what the buyer is optimising |
| 2 | Trade-off | Is it worth paying more for a project near the metro if possession is 2 years later than one that is 3 km away? | Names the cost of waiting (rent, EMI overlap); no invented premium |
| 3 | Trade-off | Bigger flat further out, or smaller flat in a better sector: how do I decide on 1.2 crore? | Per-sqft from our rows, commute, possession; a decision rule |
| 4 | Trade-off | Builder pays pre-EMI till possession vs a 10% cheaper price with no subvention. Which is better for me? | Arithmetic on the buyer's numbers; states the assumptions |
| 5 | Compare | Supertech Supernova Astralis vs Mahagun Mezzaria: which is the safer buy and why? | Both rows, builder record, RERA, possession; a trade-off per project |
| 6 | Compare | Jaypee Klassic in Sector 134 vs Gulshan Ikebana in Sector 143: which one for end-use, which for investment? | Builder comparison from rows; no investment advice (out of scope) stated plainly |
| 7 | Compare | Divine Meadows vs Great Value Sharanam: compare total cost including stamp duty, registration and GST for a 3BHK | Statutory figures exact; a missing price is "not on record" |
| 8 | Compare | Out of Mahagun Mezzaria, Divine Meadows and Great Value Sharanam, which is cheapest per sq ft and is that a good sign? | Computed tier with n; cheap-means-what trade-off |
| 9 | Price fair | Is 8,500 per sq ft a fair price in Sector 150? | Compares only with projects we hold, with count; no resale verdict, no invented market rate |
| 10 | Price fair | A broker quoted me 1.1 crore for a 2BHK in Greater Noida West. Is that reasonable? | Range from our rows with how many projects; says what it cannot judge |
| 11 | Price fair | Why do prices in Sector 150 look higher than Sector 78 for similar flats? | Only what rows show; no unsourced reasons stated as fact |
| 12 | Go wrong | What could go wrong if I book in an under-construction project today? | RERA, possession slip, builder record, payment-plan risk; what to check |
| 13 | Go wrong | The builder says possession in 12 months. How do I check if that is believable? | RERA date, past delivery record from rows, site-visit checklist |
| 14 | Go wrong | If the builder gets delayed by 2 years, what do I lose and what are my rights? | Cost of delay arithmetic; RERA remedies as public record, not legal advice |
| 15 | Go wrong | I found a resale flat for 95 lakh. What documents and dues should I check before paying the token? | Resale checklist lane (in scope); no "fair price" claim |

## Hinglish (5)

| # | Mirrors | Question | Expect |
|---|---|---|---|
| H1 | 1 | 1.3 crore hai mere paas. Noida mein ready 2BHK lun ya Greater Noida West mein under-construction 3BHK? | Same answer as 1 |
| H2 | 5 | Supertech Supernova Astralis ya Mahagun Mezzaria, dono mein se kaun sa safe hai? | Same answer as 5 |
| H3 | 9 | Sector 150 mein 8,500 per sq ft ka rate theek hai ya mehenga? | Same answer as 9 |
| H4 | 12 | Under-construction flat abhi book karu to kya risk hai? | Same answer as 12 |
| H5 | 14 | Builder 2 saal late ho gaya to mera kitna nuksaan hoga aur mere paas kya options hain? | Same answer as 14 |

## Field coverage (added 31 Oct on owner request): one question per data field we hold

Projects checked against live Neon (read-only, 31 Oct 2026). Rows held: Astralis (16 amenities incl. squash, billiards, golf simulator, heated pool; 2 plans; under construction), Mahagun Mezzaria Sec 78 (14 amenities incl. billiards, half-Olympic pool; 1 plan; ready), Divine Meadows Sec 108 (8 amenities; **0 payment plans**, so a payment-plan question must answer "not on record"), Gulshan Ikebana Sec 143 (13; pool; 1 plan), Great Value Sharanam Sec 107 (12; 1 plan). Every project above has 1 cost sheet and a commute matrix.
Note: Jaypee Klassic is Sector 128 (ready) and Sector 134 "Block 6-10" (under construction) in the catalogue.

| # | Field | Question | Expect |
|---|---|---|---|
| F1 | Amenities | What amenities does Supertech Supernova Astralis have? | The 16 rows as stored |
| F2 | Pool | Which projects in Noida have a swimming pool and a jacuzzi? | Astralis (heated lap pool and jacuzzi); others only if stored |
| F3 | Snooker / billiards | I want a society with a snooker or billiards room. Which ones have it? | Mahagun Mezzaria, Astralis (billiards lounge); no invented ones |
| F4 | Sports | Is there a squash court or golf simulator in any project in Noida? | Astralis only, from rows |
| F5 | Payment plan | What is the payment plan for Supertech Supernova Astralis? | Both stored plans, milestones, source and date |
| F6 | Payment plan (missing) | What is the payment plan for Divine Meadows? | "Not on record" plus a human handoff; no template plan |
| F7 | Cost sheet | Give me the cost sheet for Mahagun Mezzaria: base price, PLC, parking, club and maintenance | Stored charges; absent ones "not on record" |
| F8 | Cost sheet | What are the hidden charges apart from the base price in Gulshan Ikebana? | Charges from the cost sheet; GST/stamp duty statutory |
| F9 | Location | Where exactly is Mahagun Mezzaria and what is around it? | Sector 78, address, location advantages from rows |
| F10 | Nearby spots | What are the nearest schools, hospitals and airport to Great Value Sharanam? | Distances only if stored; otherwise not on record |
| F11 | Commute | How long does it take from Gulshan Ikebana to Connaught Place and to Sector 62? | Commute matrix rows only |
| F12 | Nearby sectors | Which sectors are next to Sector 78 and how do they compare for a family? | Sector intelligence rows; no unsourced claims |
| F13 | Metro | How far is the nearest metro station from Mahagun Mezzaria? | Stored station and distance, or not on record |
| F14 | RERA | What is the RERA number and validity for Supertech Supernova Astralis? | RERA number and date from the row, shown with source |
| F15 | Builder | Who is the builder of Divine Meadows and what else have they delivered? | Builder row, delivered projects count |
| F16 | Safety / living | Is Great Value Sharanam safe for kids? Security, CCTV, parks | Stored flags only; no "perfect" language |
| F17 | Maintenance | What is the monthly maintenance at Mahagun Mezzaria for a 1,500 sq ft flat? | Stored per-sqft rate times area, labelled computed |
| F18 | Unit sizes | What flat sizes and layouts are available at Gulshan Ikebana? | unit_types rows; area and price only as stored |
| F19 | Possession | When will I get possession of Jaypee Klassic in Sector 134, and is the OC obtained? | Possession date, OC status from rows |
| F20 | Water / power | What is the water source and DG power backup rate at Mahagun Mezzaria? | Stored values or not on record |
| FH1 | Amenities (Hinglish) | Astralis mein swimming pool aur gym hai kya? Aur kaun kaun si facilities hain? | Same as F1 |
| FH2 | Payment plan (Hinglish) | Divine Meadows ka payment plan kya hai? | Same as F6 |
| FH3 | Nearby (Hinglish) | Mahagun Mezzaria ke paas metro, school aur hospital kitni door hai? | Same as F13 and F10 |

Total: 15 + 5 + 23 = 43 questions.

## Scoring (per question, one line)
Slower / shorter / no reason / no trade-off / no next step / a number they have and we do not / a number we have and they do not / wrong or invented fact.
Rank gaps by how many of the 20 they touch.

## Known risks to the result
- Questions 7, 8, 9, 10, 11 touch unit prices. 754 of 1,021 priced unit rows were written by a seed script (CLAUDE.md § Data Integrity Debts). A "win" there may be our own generated figure; score those rows separately.
- Rivals will quote portal asking prices as facts. We do not. "Fewer numbers" there is by design, not a gap.

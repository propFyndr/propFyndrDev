# Live chat review — every Langfuse turn to 26 Oct 2026

**Source:** Langfuse v2 observations, `name=chat_turn`, 1 Jan – 26 Oct 2026 (5,693 turns), pulled with the v2 API (the Langfuse MCP server returned 401).

| Environment | Dates | Turns | What it is |
|---|---|---|---|
| `default` | 26 Sep – 10 Oct | 3,427 | Test harness runs from before the v6 SDK (1,719 are literally "test"; the rest are corpus questions repeated 40–80 times) |
| `development` | 10 – 23 Oct | 2,013 | Our own local and dev testing |
| `production` | 8 – 26 Oct | 253 (248 with text) | **Real buyers: 123 sessions.** Everything below is from these |

Earlier read of the same data: `CHAT_READ_2026-10-23.md` (20 chats). This page covers all 123 live sessions and checks each pattern against today's code.

## What buyers ask

The 248 live questions fall into the same shapes as the corpus: BHK + sector + budget searches (most common), "is X too much for a 3 BHK", appreciation/"best sector to invest", one project's facts (possession, payment plan, amenities, price), stamp duty and EMI, builder track record, and a long tail (joke, IPO, Bengaluru metro, Saket Delhi, beach-facing house).

| Measure (live) | Turns | Sessions |
|---|---:|---:|
| Answered by the model chain | 149 | 77 |
| Answered by code (handler, search, aggregate, cache) | 43 | 28 |
| "High traffic" notice (all on 10 Oct) | 18 | 13 |
| Outage notice | 16 | 12 |
| Empty answer | 4 | 4 |
| Appreciation what-if table | 12 | 12 |
| Affordability table on a turn that asked no income/EMI question | 3 | 1 |
| Off-topic question answered as general chat | 6 | 6 |
| Invented claim about our model ("GPT-4o mini, fine-tuned") | 2 | 1 |
| Latency (Langfuse root span) | p50 3.2 s, p90 9.5 s | |

**34 of 248 live turns (14%) were a high-traffic or outage notice.** That is the largest single failure, and it is the provider chain, not routing: on 26 Oct locally, every Gemini key (free and billed) stalled 8 s without a token, which spent the 35 s turn budget before Cohere/Groq were tried.

## The chat that started this (6ce3380f, 26 Oct)

| # | Buyer | What we did | Cause | Now (dev, same code as the fix) |
|---|---|---|---|---|
| 2 | "price of the most expensive property in greater noida?" | Budget-band ranking table, topped by a ₹3.8 Cr **Noida** project | No lane for a superlative price question | `aggregate` lane: the dearest homes we hold in Greater Noida, top 5, from unit rows |
| 3 | "only show me above 3.8 cr+ projects" | "16 projects match … from ₹3.8 Cr", then ₹70 L–₹1.25 Cr projects | A budget change reused the previous turn's 16 cached results; the floor also let unpriced units pass and printed each project's cheapest price | Re-discovers on any budget change; floor needs a priced unit reaching it (exact when the buyer says "only"); shows the price of the units that qualify (2 projects, ₹3.95–5.77 Cr, 4 BHK) |
| 4 | "just the ones above 3.8 cr" | Forensic comparison of the first two cards | "the ones above" was read as "the list above" | "the ones above <number>" is a price filter |
| 5 | "amenities in the 4bhk of NRI city township?" | Open lane, a hedge with no amenities | `nri` in "**NRI** City Township" matched the NRI-tax topic list | Project names are removed before topic words are read; answered from the project's amenity rows |
| 6 | "is there a badminton court there?" | "…(this exact text is on 188 projects, so it may be a template; confirm on a site visit)" | Deliberate caveat in `amenitySearch.ts` | "Yes. NRI City Township's amenities include: Badminton Court & Half Basketball Court" — no commentary on our data (owner's instruction) |
| 7 | "round about price for 4BHK there?" | Micro-market rate table | "4BHK" counted as a new search and dropped the project in focus, despite "there" | "there / in it / in this project" keeps the focus: "A 4 BHK at NRI City Township starts from ₹3.5 Cr…" |

All seven are pinned as `live-1026-premium-chat` in `backend/src/lib/eval/route-replay.json` (158/158 pass).

## Also fixed today

- **"Which model are you / 4o or 4o mini?"** (c7a159e4) got "GPT-4o mini, fine-tuned for real estate". Now a fixed answer from code: no single model, none fine-tuned by us, facts computed from our records. Pinned `live-1009-identity`.
- **"Are all your properties manually verified by you?"** got "rigorously vetted by our expert team" (false; CLAUDE.md: verified supply chain not built). Now the trust answer, which says we have not inspected sites.

## Still open (not fixed today)

| Pattern | Example | Why not fixed |
|---|---|---|
| Provider stalls → outage notice (14% of live turns) | "Show me 3BHK in Sector 76", "2BHK under 1 Cr near Sector 62 metro" | **Root cause measured 26 Oct:** Gemini 3.5 Flash Lite's first token arrives after 17–20 s (direct curl, two-sentence question). The chain waits 8 s per leg for a first chunk, so the four Gemini legs (two free, two billed) use about 32 s. The 35 s turn budget is then gone before Cohere or Groq are tried. This is a provider-chain decision for the owner. Partly mitigated today: when cards or a ranking table were already shown, the buyer now keeps them instead of seeing the notice |
| "Best sector for appreciation in 10 years" answers with a what-if arithmetic table and names no sector | 12 sessions | We do not forecast (policy). The answer should say that in its first line, then offer the sectors' recorded 5-year change. Product decision on wording |
| Off-topic answered as general chat | "tell me a joke", "Jio IPO", "Bengaluru metro lines", "Saket Delhi" | Scope decision: answer briefly and steer back, or decline |
| Model-written "PropFyndr Advisory Dossier" instead of the dossier handler | 67472985, 9 Oct | Checked in Day 7.2 (see `DAY7_BUYER_BUILDER_2026-10-26.md`) |
| Search results exclude insolvent-builder projects silently | "above 3.8 cr" shows 2 projects; the 5 Jaypee projects above 3.8 Cr are dropped by the NCLT score floor, while "most expensive" lists them | Ranking policy: say how many were left out and why |

## Data finding: unit prices generated by a script (launch blocker)

`backend/scripts/seed-and-enrich-all-projects.cjs` replaced unit types with **generated** ones: `price_min_cr = super_area × price_per_sqft`, `price_max_cr = price_min × 1.08`, from a base rate times multipliers (×1.05, ×1.10, ×0.98…). It also generated payment plans. On dev, **754 of 1,021 priced unit rows, across 310 of 381 projects,** have no price label and a max/min ratio of 1.06–1.13, the fingerprint of that script. The same projects' own `price_range_label` often disagrees (Jaypee Moon Court: label ₹1.30–3.40 Cr, units up to ₹6.86 Cr).

Every search card, "most expensive" answer and 4 BHK price reads these rows. Under CLAUDE.md ("a templated value is not data") they should be cleared, not shown. Clearing them empties prices on many projects, so this needs an owner decision and a re-sourcing plan. Live (Neon) was not readable from this session.

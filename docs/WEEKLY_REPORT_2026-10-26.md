# RealtyAsk: weekly report (plan of 15–21 Oct, closed 26 Oct 2026)

Plan: `docs/WEEK_PLAN_2026-10-15.md`. Rule for the week: no new features.

## Done

| Day | What | Evidence |
|---|---|---|
| 1 | Live on Neon, dev on Supabase, separate cache prefix, smaller chat storage, Zoho mail | MEMORY 2026-10-16 (Day 1 re-check) |
| 2 | 10 buyer questions recorded against ChatGPT and Perplexity; top 3 gaps fixed | `docs/benchmark/DAY2_RESULTS_2026-10-16.html` |
| 3 | Unsourced due-diligence columns nulled on both DBs; comparison and cost-sheet labels | MEMORY 2026-10-16, re-verified 2026-10-23 |
| 4 | Langfuse live and on SDK v6; per-buyer funnel; guest save fixed; referrals tested; 20-chat read | MEMORY 2026-10-23 |
| 5.1–5.4 | Speed baseline; answer cache matches on meaning; more facts answered from rows | `docs/benchmark/DAY5_SPEED_CACHE_2026-10-24.md` |
| 6 | Folder cleanup, overview page, records, brand, logins | Marked done by the owner. No MEMORY entry this week; the five-login check has no recorded result |
| 7.1 | 60-question run on the real model chain | `docs/benchmark/scorecards/DAY7_CORPUS60_2026-10-26.md` |
| 7.2 | Buyer flow as a guest: chat, save, callback, site visit, dossier | `docs/benchmark/DAY7_BUYER_BUILDER_2026-10-26.md`. Tested through the API; the browser half did not run (machine out of memory) |
| 7.3 | Builder lead: brief has no transcript; another builder gets 404 | Same file. Confirmed |
| 7.4 | Bugs fixed from this week's findings | See below |

**7.4, bugs fixed on 26 Oct** (from a full read of all 123 live buyer sessions in Langfuse; `docs/benchmark/LIVE_CHAT_REVIEW_2026-10-26.md`):
- "Only above ₹3.8 Cr" showed ₹70 L projects. Any budget change now re-runs the search; a floor needs a priced unit.
- "Most expensive property" now answers from our rows.
- "The ones above 3.8 cr" is now read as a filter, not a comparison.
- "NRI City Township" no longer triggers the NRI tax lane.
- "Price for 4BHK there" keeps the project in focus.
- Amenity answers have no "may be a template" note.
- "Which model are you" and "are listings verified" now get fixed, true answers.
- When the AI fails after the cards or table are shown, the buyer keeps them instead of an outage notice.
- The dossier priced a 3 BHK buyer on the 2 BHK floor (~40% low). It now prices the size asked.

## Not done

- **5.5 Rate limits on the real buyer IP.** Needs a proxy secret on Vercel and Render (owner).
- **7.2 on a real phone.** Re-run in a browser once the machine has about 4 GB free.
- **Referral reset to one "Furqan Arth" root.** Scripts are ready. Blocked because `furqan@realtyask.in` is not an admin on dev; the owner invites it from `/admin/team`, then runs the reset on dev and live.

## Launch blockers found this week

1. **Gemini first token takes 17–20 s; the chain gives up after 8 s per leg.** All four Gemini legs stall, and the turn budget is gone before Cohere or Groq run. This causes about 14% outage notices on live and most failures in the 60-question run. Decision needed on the chain order or timeouts.
2. **Unit prices written by a seed script.** 754 of 1,021 priced unit rows (310 of 381 projects) on dev carry the fingerprint of `seed-and-enrich-all-projects.cjs`: max = min × 1.08, from a base rate. Every price card reads them. Decision needed: clear them and re-source.
3. **`LeadObjection` has no writer.** Builder briefs never carry objections, although CLAUDE.md lists this as live.

## Next week

1. Decide on and fix the provider chain (blocker 1), then re-run the 60 questions.
2. Price data: clear the generated unit prices and start re-sourcing from builders (the verified supply chain).
3. Proxy secret for rate limits (5.5).
4. Phone test in a browser; referral reset on live.

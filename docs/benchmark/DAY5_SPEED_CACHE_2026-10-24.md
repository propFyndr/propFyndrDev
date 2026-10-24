# Day 5.1–5.4: speed, answer reuse, meaning-based cache (24 Oct 2026)

**Questions:** `backend/scripts/corpus/day5-30.json`, frozen before any change. q01–q18 come from real traffic (Day 2 set, Langfuse live chats, top-50 Google queries). q19–q26 are paraphrases or exact repeats of earlier ones, and q27–q30 are near misses (same words, different sector, budget or topic). **The paraphrase and near-miss groups were built on purpose** to test 5.3, so the hit rate here is not a forecast of live traffic.

**Method:** `backend/scripts/corpus/day5-speed.ts`. Each question is a new buyer (fresh guest and session), asked in file order. The run goes through the real chat route and the real provider chain, against the **dev** database (Supabase), in-process on a laptop: no network hop to Render and no Vercel proxy. Each run gets its own Redis prefix, so it reads nothing cached by live or by an earlier run. Rate limits are off. "Called the AI" is read from the wire: every outbound request to a model host (Gemini, Cohere, Groq, NVIDIA, Cloudflare AI, Mistral, OpenAI) counts, intent model included.

**Code:** HEAD 74c4958b, with someone else's uncommitted edits to `fallbackChain.ts`, `projectFactChecks.ts` and `prompts/` present in both runs. Raw results: `docs/benchmark/answers/day5-baseline-2026-10-24.json` and `day5-after-2026-10-24.json`.

## 5.1 Speed baseline

| | Median | p90 | Slowest |
|---|---|---|---|
| Full answer | 6.0 s | 15.4 s | 55.5 s (q16, outage) |
| First word | 5.7 s | 14.4 s | 53.8 s |

- **Outages:** 1 of 30 (q16 "properties in greater noida west": 13 model calls across 4 providers, then the outage notice).
- **Lanes with no model call still take 2.9–6 s.** The dev DB is in ap-south-1 and the laptop pays a round trip per query, so live (Render next to Neon in Singapore) should be faster on these. Not measured on live.
- **Lanes that call the model take 10–25 s.**

## 5.2 How often we already reuse answers

- **Live (Langfuse, production, 8–23 Oct): 6 of 237 turns (2.5%)** were served from the answer cache. 3 of those 6 were "next" / "next step?", answers from another conversation that were wrong to serve; that was fixed 17 Oct by the follow-up exclusion. So **3 good hits in 237**, all the chip "give me an area guide for noida". In the same traffic, 86 of the 237 questions were word-for-word repeats of an earlier one.
- **Day 5 set, baseline: 1 of 30 from cache** (q23, the exact repeat of that chip). **13 of 30 answered with no model call** (12 by code, 1 by cache).
- **Why so low:** the cache was written under one key and read under another. The read fingerprints the intent the buyer arrives with (`{}` for a new buyer), while the write fingerprinted the intent after this turn's extraction. Any question naming a sector, BHK or budget was written under that sector and read as "anon", so it never hit for a new buyer (checked directly). OPEN-lane answers also sat in their own scope, which the early read never checks, and the aggregate lane cached nothing.

## 5.3 Similar questions share the saved answer

**Change** (`lib/ai/semanticCache.ts`, `routes/chat-router.ts`, `lib/ai/groundedAnswer.ts`):
1. **Meaning key.** For factual and lookup questions only, the key is the set of content words. Numbers stay bound to their unit (`3bhk`, `1.5cr`, `sector150`); under and over are kept apart, as are negations, question words, and "Greater Noida" vs "Noida". Function words, politeness, time fillers ("right now", "currently"), plurals and word order are dropped. Judgement questions ("is Sector 150 good for families") keep exact words. Follow-up, affordability, project-in-focus and cards-shown exclusions are unchanged.
2. **Read and write use the same fingerprint:** the intent the turn arrived with.
3. **Stateless factual OPEN answers** (not public-record ones, since a cache replay is labelled verified and HIGH) are also written where the router reads before routing, and the aggregate lane caches its computed answer, only when it was shown as HIGH confidence.
4. Namespace bumped to `ac:v12`.

**Result on the same 30 questions:**

| | Baseline | After |
|---|---|---|
| Served from cache (5.3) | 1 | **3** (q20 ← q12, q25 ← q18, q23 ← q10) |
| No model call at all | 13 | **16**: +1 from 5.3 (q20; q25 already made 0 calls), +2 from 5.4 (q16, q12) |
| Wrong matches | | **0**. In the baseline, computed without the cache, q20's answer was identical to q12's and q25's to q18's, so each pair really asks the same thing. All 4 near misses (q27 other sector, q28 other sector, q29 other budget, q30 other topic) missed. |
| Median / p90 / slowest | 6.0 / 15.4 / 55.5 s | 5.9 / 19.4 / 34.9 s |

- **q21 did not hit** because q13, its source, ended in an outage on this run, and outages are never cached. Across both runs, provider variance moved model-lane times by ±5 s, so p90 is noise at n=30.
- Pinned by `lib/ai/__tests__/semanticCacheMeaning.test.ts`: 5 same-meaning pairs and 15 near-miss pairs, including "average rate" vs "average price", which the aggregate parser reads as per-sq-ft vs ticket price. It fails on the old code.
- Also pinned by route-replay cases `day5-cache-a/b/c` (a new buyer's paraphrase served from cache; another sector not).

## 5.4 Fact questions that still call the AI

| Question | Calls before | Fix |
|---|---|---|
| q16 "properties in greater noida west" (head term) | 13, outage, 55 s | **Fixed.** A bare "properties/flats/projects in <place>" listing is an inventory search, answered from rows (lane `search`, 9.2 s, 0 calls). Replay case `day5-listing-head-term`. |
| q12/q20 "average price per sq ft in Noida" | 1 (intent model, 5–10 s) | **Fixed.** Catalogue-arithmetic questions skip the intent model (`deterministicCoversMessage`). q12 went from 10.9 s to 4.1 s with 0 calls. `intent.test.ts`. |
| q03 "Can I trust Supertech as a builder?" | 1 (intent model) | Open. The builder-trust lane reads the name from the words; skipping intent here needs its own test. |
| q30 "possession status of projects in Sector 150" | 1 (main lane) | Open. A per-sector possession table would be a new handler. |
| q02 "projects near a metro in Noida fit a 1.2 crore budget" | 3 | Open. "metro" needs the model's proximity reading today. |
| q15 "are all properties in noida leasehold" | 1 (OPEN) | Open. A statutory-style fact; a written answer would be new content. |

## 5.5 Rate limits see the real buyer: not done, needs an owner decision

Browser calls go through the Vercel rewrite (`frontend/next.config.js` `/api/:path*`), so Render's Cloudflare sets `CF-Connecting-IP` to **Vercel's** address (as CLAUDE.md records; not re-checked with live headers today), and every buyer through the app shares one IP bucket. The guest token is keyed first, which softens this, but the IP fallback and IP-only limits see one address. The safe fix needs a secret on both sides: `frontend/middleware.ts` adds the client IP plus a shared-secret header on `/api/*`, and `lib/request.ts` trusts that IP only when the secret matches. This requires setting a new env var on Vercel and Render, and a deploy.

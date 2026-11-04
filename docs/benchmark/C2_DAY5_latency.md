# Cycle 2, Day 5: where the seconds go (tasks 1–3)

Measured 4 Nov 2026. Measure only: nothing was cut (Furqan chose "measure first, decide after").

- **Questions:** `backend/scripts/corpus/day5-100.json`, 100 questions: day5-30 (30), top50 (50), and 20 more from `corpus.json` spread across its classes (rentals, malformed, risk, brand, temporal and so on).
- **Script:** `backend/scripts/corpus/day5-latency.ts`. Each question is a new buyer, with its own token and session. Tokens look like `latency-c2d5-<uuid>` and the user agent says bot, so the server flags these turns `is_bot` and they do not count as real people.
- **Dev:** the app in-process on this laptop, at commit `728483d0` plus uncommitted changes, against the dev Neon database. The Redis prefix was new for this run and rate limits were off. Started 09:01 UTC.
- **Live:** https://realtypalsdev.onrender.com, with turns at least 3 s apart and one warm-up turn dropped. Started about 09:15 UTC; the summary was written at 09:32 UTC. The step-timing code is not deployed, so live has client timings only.
- **Raw results:** `docs/benchmark/answers/c2d5-dev.json` and `docs/benchmark/answers/c2d5-live.json`.

## How a turn is timed (task 1)

`lib/turnTimer.ts` already existed and timed the main lane only. These changes add:

- **Step marks in `chat-router.ts`:** `setup`, `sessionMemory`, `intent`, `routing`, `dataAndContext` and `promptBuild`. These join the existing `cacheRead`, `intentExtract`, `projectCatalog`, `discoverProjects`, `preLlm`, `llm` and `postLlm`. Each step runs from the previous mark.
- **Moments, measured from the request arriving:**
  - `@aiStart`: the model chain is called.
  - `@aiFirstToken`: the first text the chain hands back.
  - `@firstToken`: the first word written to the buyer.
- **One log line per turn, for every lane:** `[CHAT:TIMING] lane=… total=… step=ms … @moment=ms`. The old line logged only the main lane.
- **An SSE `timing` event**, only when the request carries `x-realtyask-timing: 1`. The app never sends that header, and the frontend reducer ignores unknown events anyway (`streamReducer.ts`, `default: return message`). Nothing goes into the prompt.

Limit: `@aiFirstToken` is the first text the chain *releases*, not the provider's first byte. `fallbackChain.ts` releases text a paragraph at a time, after its checks (`PARAGRAPH_STREAMING`). Timing the provider's first byte needs a mark inside the chain, which was left untouched (owner's file).

## Headline (task 2)

| Run | Turns | First status, median | First word, median | First word, p90 | First word, worst | Done, median | Done, p90 | Done, worst | Errors | Outage notices |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Dev (local app, dev DB) | 100 | 0.3 s | 5.0 s | 10.9 s | 33.7 s | 6.0 s | 15.4 s | 64.2 s | 0 | 3 |
| Live (realtypalsdev.onrender.com) | 95 | 0.7 s | 4.0 s | 36.6 s | 84.3 s | 5.1 s | 43.8 s | 84.6 s | 5 (90 s timeout) | 3 |

Split by whether the question needed the model. The lane comes from the dev run of the same question, because live has no lane yet:

| Live | Turns | First word, median | p90 | Worst | Done, median |
|---|---:|---:|---:|---:|---:|
| Answered by code on dev (topic handlers, search cards, aggregate, coverage, cache) | 46 | 1.8 s | 5.0 s | 13.5 s | 1.8 s |
| Answered by the model on dev (`main`, `OPEN`) | 49 | 7.2 s | 52.1 s | 84.3 s | 15.0 s |

On live, 16 turns took longer than 40 s and 5 more hit the script's 90 s timeout (`tq295`, `tq113`, `cq024`, `cq037`, `cq040`). Every one is a model-lane question that took 4–25 s on dev. The median is fine on live; **the tail is the problem**, and only the model lanes have it.

### Dev: mean time per turn in each step

All 95 turns with server marks. A step a turn skips counts as 0.

```
llm               ████████████████████████████████████████ 3.81 s
discoverProjects  ████████ 0.81 s
routing           ███████ 0.69 s
dataAndContext    ██████ 0.53 s
postLlm           █████ 0.51 s
intentExtract     ████ 0.39 s
sessionMemory     ██ 0.20 s
cacheRead         █ 0.09 s
preLlm            █ 0.07 s
projectCatalog    █ 0.04 s
```

### Dev: turns that called the model (main lane, 44 turns)

| Step | n | Median | p90 | Max |
|---|---:|---:|---:|---:|
| cacheRead | 44 | 0.0 s | 0.1 s | 0.9 s |
| intentExtract (model fallback, when the rules don't read it) | 44 | 0.0 s | 1.4 s | 1.6 s |
| sessionMemory | 44 | 0.2 s | 0.3 s | 1.1 s |
| routing (intent → query class) | 44 | 0.4 s | 0.5 s | 23.3 s |
| projectCatalog | 44 | 0.0 s | 0.1 s | 0.1 s |
| discoverProjects | 27 | 2.0 s | 2.7 s | 4.1 s |
| dataAndContext (sector context, history compression, prompt inputs) | 44 | 0.3 s | 2.8 s | 3.6 s |
| promptBuild | 44 | 0.0 s | 0.0 s | 0.0 s |
| preLlm | 44 | 0.1 s | 0.5 s | 0.5 s |
| **llm** | 44 | **4.0 s** | **20.1 s** | **59.7 s** |
| postLlm | 44 | 0.6 s | 1.3 s | 1.9 s |
| (unmarked) | 44 | 0.5 s | 1.5 s | 5.4 s |
| @aiStart, from request | 44 | 3.3 s | 8.0 s | 32.7 s |
| @aiFirstToken, from request | 44 | 6.9 s | 13.6 s | 36.9 s |
| @firstToken, from request | 44 | 6.6 s | 13.6 s | 33.3 s |

From calling the model to the first released text (`@aiFirstToken − @aiStart`): median 3.3 s, p90 6.4 s, max 31.5 s. The first text is released 78% of the way through the model stage (median), and only 0.5 s of model time follows it. The buyer waits for most of the model's work before seeing a word.

### Dev: turns answered without the main model call (51 turns)

The first word comes at a median of 3.3 s and a p90 of 8.4 s. 59% of their time is *unmarked*. Most of it is the `OPEN` lane (10 turns, first word median 7.7 s): its grounded streaming answer calls a model outside the marked path. The next round of marks should go there.

### By lane, dev (client clock)

| Lane | Turns | First word, median | p90 | Worst | Done, median |
| --- | ---: | ---: | ---: | ---: | ---: |
| main | 44 | 6.9 s | 13.7 s | 33.7 s | 9.8 s |
| search | 14 | 4.4 s | 5.5 s | 9.9 s | 5.0 s |
| OPEN | 10 | 7.7 s | 14.7 s | 18.6 s | 8.4 s |
| pre-router exit (rentals scope reply, before the timer starts) | 5 | 0.0 s | 0.1 s | 0.1 s | 0.1 s |
| topic:builder-reputation | 4 | 3.5 s | 11.7 s | 11.7 s | 3.6 s |
| budget-check | 3 | 1.6 s | 1.7 s | 1.7 s | 1.6 s |
| aggregate | 3 | 1.8 s | 2.0 s | 2.0 s | 1.8 s |
| coverage-lane | 3 | 2.1 s | 3.2 s | 3.2 s | 2.1 s |
| other topic handlers, cache, coverage | 14 | 0.2–4.4 s | | | |

## The step that cost four seconds (task 3)

**On dev it is the wait for the model's first released paragraph: median 3.3 s, p90 6.4 s.** Our own work before the model is called costs about as much again: `@aiStart` has a median of 3.3 s. Inside that, `discoverProjects` takes 2.0 s on the turns that search (27 of 44) and is the largest piece. Next comes the model fallback for intent, 1.4 s at p90 on the turns where the rules can't read the message.

**What we cannot tell, and why:**

1. **Whether the 6 s → 10 s jump after 31 Oct came from one step.** No measurement from before 31 Oct exists with these marks, so there is nothing to subtract. The current numbers are 5.0 s overall and 6.9 s on the main lane on dev; on live they are 4.0 s overall and 7.2 s on model turns. They do not show a 10 s median on this set.
2. **How much of the model wait is the provider and how much is the chain holding text for its paragraph checks.** The first text appearing 78% of the way through the stage points at the hold. Proving it needs a provider-first-byte mark inside `fallbackChain.ts`, which this task did not touch.
3. **Why live's tail is 30–90 s while dev's is 11–34 s for the same questions.** Live has no server marks yet. All 21 slow or timed-out live turns are model turns, so the chain (legs failing over one by one on Render) is the leading suspect, ahead of Render's CPU. But that is a suspicion, not a measurement. Deploying these marks and re-running `day5-latency.ts` against live will answer it, and the script already reads the `timing` event once the header works there.

Two outliers worth a look: `tq147` spent 23.3 s in `routing` on dev, and `cq042` spent 9.6 s there. Something between intent and classification awaited a slow call.

## Checks

- `npx tsc --noEmit -p backend`: clean.
- `npx tsx --test src/lib/__tests__/turnTimer.test.ts`: 2/2.
- `npm run replay`: **243/243 turns pass** (196 answered by code, 47 by the model).

## Not done here

- Task 4 (cut the three slowest steps) waits on Furqan's decisions: the paid Gemini key and the provider order.
- Task 5 (re-run the same 100) follows task 4. Command: `npx tsx scripts/corpus/day5-latency.ts local scripts/corpus/day5-100.json c2d5-dev-after`, and the same against live.

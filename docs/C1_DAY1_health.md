# Chat health check

How to run it, dev or live:

```
cd backend
npm run health:chat -- --base <backend URL>              # 30 questions × 3 runs
npm run health:chat -- --base http://localhost:3001 --runs 1
```

The 30 questions are in `backend/scripts/health-chat-questions.json`, taken from real buyer chats (the `route-replay.json` cases). Each question uses its own `healthcheck-<uuid>` guest token. That keeps these sessions out of every real-people count, and no question asks for a callback, so no lead is written.

Per turn the check records:
- **Sign of life:** the first `status` event from the server.
- **First word:** the first `token` event.
- **Done.**
- **Failure:** an HTTP error, no answer text, a timeout, or the outage notice.

Cached turns (`done.cached`) are reported apart from fresh ones.

Targets: under 1 failure in 50, median first word under 3 s.

Every later day re-runs it and adds a section below.

---

## Baseline: 2026-10-29, local machine, code at `24814e66` (before Day 0 changes)

Backend on this laptop against the dev database (Supabase), real provider keys, production mode. These numbers include this machine's home network to the providers, not Render's Singapore region; the live run is still to do.

```
Turns 90. Failures 0 (0.0%; target under 2%). Cache hit rate 7%.

| Turns | n | sign of life p50 / max | first word p50 / p90 / max | done p50 / max |
| :--- | ---: | :--- | :--- | :--- |
| all | 90 | 5.8s / 28.2s | 5.8s / 12.5s / 28.2s | 6.6s / 28.9s |
| fresh (not cached) | 84 | 6.3s / 28.2s | 6.3s / 13.0s / 28.2s | 6.7s / 28.9s |
| cached | 6 | 1.9s / 2.5s | 1.9s / 2.5s / 2.5s | 2.5s / 3.1s |

Slowest first word (fresh):
- 28.2s r1 Jaypee Klassic in Sector 134 vs Gulshan Ikebana in Sector 143: which builder is safer?
- 17.1s r3 Jaypee Klassic in Sector 134 vs Gulshan Ikebana in Sector 143: which builder is safer?
- 14.1s r2 Is Supertech Supernova Astralis in Sector 94 on track for possession, and what is the risk if it slips?
- 13.9s r1 Compare Elite X and Irish Platinum
- 13.5s r2 Compare Elite X and Irish Platinum
```

What it shows:
- **Nothing reaches the buyer before the answer.** Sign of life equals first word on every turn.
- **The median first word, 6.3 s, is twice the target.**
- **Failures were 0 here.** Live Langfuse for the last 14 days tells a different story, with Gemini Flash Lite failing on 73 of 128 live calls.

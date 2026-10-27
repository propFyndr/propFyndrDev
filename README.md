# RealtyAsk

AI-powered real estate advisor for home buyers in Noida, Greater Noida, and
Greater Noida West.

RealtyAsk is not a listings portal. Buyers describe what they want in plain
language and the advisor recommends projects with explicit reasoning and the
trade-off attached to each one. The property database exists to support the
advisor, not the other way round.

Product rules, scope boundaries, and AI behaviour constraints live in
[`CLAUDE.md`](./CLAUDE.md) — read it before adding a feature. Decisions already
taken are in [`MEMORY.md`](./MEMORY.md); approaches that failed are in
[`ERRORS.md`](./ERRORS.md). This week's plan is the newest
`docs/WEEK_PLAN_*.md`.

## Stack

| Layer     | Choice |
|-----------|--------|
| Frontend  | Next.js 14 (App Router), React 18, TypeScript, Tailwind, framer-motion |
| Backend   | Express + TypeScript, Prisma |
| Database  | PostgreSQL: Neon (live), Supabase (dev) |
| Auth      | Supabase (JWT) |
| Cache     | Upstash Redis (dev uses its own key prefix) |
| AI        | Gemini → Cohere → Groq → NVIDIA → Cloudflare (see `backend/src/lib/config.ts`, `backend/src/lib/ai/fallbackChain.ts`) |
| Monitoring | Langfuse (chat traces), PostHog (analytics), Sentry (errors) |
| Hosting   | Frontend on Vercel, backend on Render |

## Layout

```
frontend/      Next.js app: routes, components, client libs
backend/       Express API: routes, AI layer, discovery engine
  src/routes/         HTTP handlers (chat-router.ts is the chat pipeline entry)
  src/lib/ai/         providers, prompts, guardrails, cost accounting
  src/lib/discovery/  intent -> query -> scoring -> chips
  src/lib/eval/       route-replay.json, the routing regression cases
  prisma/             schema + migrations (the database source of truth)
  scripts/            data, audit and corpus scripts
tests/e2e/     Playwright end-to-end tests
QueriesAndKeywords/  Buyer question corpus (read by the corpus scripts and tests)
Projects/      Sector-level source JSON used by the enrichment scripts
newProj/       Master project JSON (newProj/75)
scripts/       Brand-name tools (npm run find-name, npm run brand-check)
docs/
  WEEK_PLAN_*.md, WEEKLY_REPORT_*.md   the plan and what happened
  benchmark/     scorecards, test answers, ChatGPT reference chats
  api/           swagger.json
  ground-truth/  UP-RERA source data
  enrichment/    enrichment payloads
  archive/       old plans, specs and research, kept for reference
```

## Getting started

Requires Node 20+ (Render runs 22) and access to the dev Supabase project.

```bash
npm install                 # installs both workspaces
cp .env.example backend/.env
cp .env.example frontend/.env.local
# fill in DATABASE_URL, DIRECT_URL, SUPABASE_*, GEMINI_API_KEY at minimum
# point DATABASE_URL at dev (Supabase), never at live (Neon)

npm run db:generate         # prisma generate for both workspaces
npm run db:push             # apply schema to your database
npm run db:seed             # optional sample data

npm run dev                 # frontend :3000 and backend :3001 together
```

`npm run dev:frontend` and `npm run dev:backend` run either side alone.

## Checks

Everything below must pass before a change ships.

```bash
# backend
cd backend && npm run typecheck && npm run lint && npm test

# frontend
cd frontend && npm run typecheck && npm run lint && npm test && npm run build
```

The backend suite runs on the Node test runner (`node:test`) and does not need
network access or provider keys. Suites that call a real LLM are opt-in:

```bash
RUN_LIVE_LLM_TESTS=1 npm test    # costs money, asserts on model output
```

## API

The backend serves everything under `/api/v1`, health check at
`/api/v1/health`. Main routers: `chat`, `sessions`, `projects`, `saved`,
`leads`, `share`, `builders`, `admin`. `docs/api/swagger.json` is generated
by `npm run swagger:generate` in `backend/`.

In development the frontend proxies `/api/*` to `BACKEND_URL` via a Next
rewrite, so the browser never needs a cross-origin request.

## Deployment

- **Frontend → Vercel.** Config in `vercel.json`; builds from the repo root.
- **Backend → Render.** Config in `render.yaml`. Every `sync: false` variable
  must be set in the Render dashboard.
- **Database → Neon (live), Supabase (dev).** Migrations go through Prisma
  only; never edit a production schema by hand. Back up before any bulk data
  change.

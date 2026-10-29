# Environments: live and dev

Written 2026-10-29, when dev's database moved from Supabase to its own Neon project. It records what runs where, how the pieces connect, which setting goes where, and the free-tier limits each piece lives within. Passwords and keys are never written here; they live only in the hosts' environment settings and the local `.env` files.

## Why dev left Supabase

One Supabase project (`eargxn…`) did three jobs: login for **live** buyers, login for dev, and the whole **dev database**. Dev test traffic (replays, health checks, scripts) used up the project's monthly data-transfer allowance, and Supabase restricted the project. Live login and signup failed with `exceed_egress_quota`, although live's database was on Neon. Dev's database now sits in its own Neon project, so testing can never again spend live login's allowance.

## What runs where

| | Live | Dev |
|---|---|---|
| Website (Vercel project `prop-fyndr`) | https://realtyask.in, branch `main`, Production environment | https://dev.realtyask.in, branch `dev`, Preview environment |
| Backend (Render, free) | https://realtypalsdev.onrender.com, branch `main` | https://propfyndrdev.onrender.com, branch `dev` |
| Database (Neon, free) | Project with endpoint `ep-super-water-aof3o8gy` (Singapore, `c-2`) | Separate project with endpoint `ep-odd-bar-az91o2md` (Singapore, `c-3`) |
| Login and file storage (Supabase) | Project `eargxn…` | See "Login for dev" below |
| Cache and rate limits (Upstash Redis) | Shared instance, no key prefix | Same instance, `REDIS_KEY_PREFIX=dev:` |

The Render live service is named `realtypalsdev`. The name is historical; it serves `main`.

## How a request travels

```
Buyer's browser
  └─ realtyask.in (Vercel)  ── rewrites /api/* to ──►  Render live backend  ──►  Neon live
                                                      │                     └─►  Upstash (no prefix)
  └─ Supabase Auth (login) ◄── browser signs in directly; the backend checks the token with SUPABASE_URL

Tester's browser
  └─ dev.realtyask.in (Vercel Preview, branch dev) ── /api/* ──► Render dev backend ──► Neon dev
                                                                                   └─► Upstash (dev: prefix)
```

The website never talks to a database for chat or search: `frontend/next.config` rewrites `/api/*` to `NEXT_PUBLIC_BACKEND_URL` (or `BACKEND_URL`). The frontend does carry its own Prisma client (`frontend/lib/prisma.ts`), so it has a `DATABASE_URL` too, and that must point at the same database as its backend.

## Settings, by place

Neon gives each project two hosts. The one with `-pooler` goes through a connection pooler and is what running apps use (`DATABASE_URL`). The same string with `-pooler` removed from the host is a direct connection, which Prisma uses for migrations (`DIRECT_URL`). Both keep `?sslmode=require&channel_binding=require`.

### Render, live backend (`realtypalsdev`, branch `main`)
| Variable | Value |
|---|---|
| `DATABASE_URL` | live Neon, `-pooler` host |
| `DIRECT_URL` | live Neon, direct host |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase `eargxn…` (unchanged) |
| `FRONTEND_URL` | `https://realtyask.in` |
| `REDIS_KEY_PREFIX` | not set |

### Render, dev backend (`propfyndrdev`, branch `dev`)
| Variable | Value |
|---|---|
| `DATABASE_URL` | **dev Neon, `-pooler` host** (was Supabase) |
| `DIRECT_URL` | **dev Neon, direct host** (was Supabase) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | the Supabase project dev logs in with |
| `FRONTEND_URL` | `https://dev.realtyask.in` |
| `REDIS_KEY_PREFIX` | `dev:` |

### Vercel, project `prop-fyndr`
| Variable | Production (realtyask.in) | Preview (dev.realtyask.in) |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` / `BACKEND_URL` | `https://realtypalsdev.onrender.com` | `https://propfyndrdev.onrender.com` |
| `DATABASE_URL`, `DIRECT_URL` | live Neon (must **not** be a `supabase.com` address) | dev Neon |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `…_PUBLISHABLE_KEY` | Supabase `eargxn…` | the Supabase project dev logs in with |

A `NEXT_PUBLIC_*` value is baked into the build, so after changing one, redeploy that environment.

### Local machine
- `backend/.env`: `DATABASE_URL` / `DIRECT_URL` = dev Neon. `NEON_DB` = live Neon. Read-only checks and owner-approved live scripts use it; nothing else does.
- `frontend/.env.local`: `DATABASE_URL` / `DIRECT_URL` = dev Neon; `NEXT_PUBLIC_BACKEND_URL` = `http://localhost:3001` for local work.

## Login for dev

Neon is only a database: it cannot hold login or files. Two choices:

1. **Keep dev on the live Supabase project for login and storage (current).** It needs no change. With the database gone, dev's share of that allowance is a few megabytes of login traffic. Testers' accounts are the same on both sites.
2. **Give dev its own free Supabase project.** This fully separates dev from live. Supabase allows two active free projects, but **a free project with no activity for 7 days is paused**, and dev login stops until someone presses "Restore" in the dashboard. Dev accounts would be separate from live ones. To do it: create the project, add `https://dev.realtyask.in` (and `http://localhost:3000`) to Authentication → URL Configuration, create the same storage buckets, then swap the dev `SUPABASE_*` / `NEXT_PUBLIC_SUPABASE_*` values above.

Moving login itself to Neon Auth would change the sign-in code for both sites. It is a separate project, not part of this move.

## Free-tier rules this setup depends on

- **Render, 750 free instance hours a month per workspace**, shared by both services. A service sleeps after 15 minutes without traffic and takes up to a minute to wake. Two services kept awake all month need about 1,490 hours, so **only the live backend gets the keep-alive ping** (cron-job.org → `/api/v1/healthz`, which touches neither database nor Redis). Dev sleeps when unused, and its first request after a sleep is slow; that is expected.
- **Neon, per project per month:** 100 compute-hours, 5 GB data transfer, 0.5 GB storage (a newer Neon post says 1 GB; check the dashboard). Compute scales to zero after 5 minutes idle, so nothing should poll the database on a timer. Live is about 196 MB and dev about 69 MB. Dev's heavy tests (full replay, health check, provider bench) spend dev's own allowance only.
- **Supabase free:** 5 GB data transfer a month, 50,000 monthly active users, 2 active free projects, and pausing after 7 idle days. With both databases on Neon, it carries login (and any uploaded files) only.
- **Upstash free:** the request allowance is shared by live and dev (same instance, different prefix). If dev testing ever runs it low, give dev its own free Upstash database.

## The move, step by step

| # | Step | Who |
|---|---|---|
| 1 | Create the `extensions` schema and the `vector`, `pgcrypto`, `uuid-ossp` extensions on dev Neon, as live has them | Claude |
| 2 | Copy dev's `public` schema (75 tables, about 69 MB, the migration ledger included) from Supabase to dev Neon with `pg_dump` / `pg_restore`; compare row counts table by table | Claude |
| 3 | Local `backend/.env` and `frontend/.env.local` point at dev Neon | Claude |
| 4 | Scripts that refused any `neon.tech` address as "live" now refuse only live's own endpoint | Claude |
| 5 | Render dev service: set `DATABASE_URL`, `DIRECT_URL` to dev Neon; save (it redeploys) | Owner |
| 6 | Vercel: Preview `DATABASE_URL` / `DIRECT_URL` → dev Neon; check Production's are live Neon, not Supabase; redeploy both | Owner |
| 7 | cron-job.org: keep-alive for the live backend only | Owner |
| 8 | Check: dev.realtyask.in chat, property page and admin load; https://propfyndrdev.onrender.com/api/v1/health shows `"db":"ok"`; Neon dev dashboard shows connections | Claude, after 5–6 |
| 9 | Reset both Neon passwords (they were shared in a chat), then update every place in this file that holds them | Owner |
| 10 | After a week of dev on Neon, decide whether to delete dev's old tables from the Supabase project (needs an explicit yes) | Owner |

**Going back** if something breaks: set the Render dev and Vercel Preview `DATABASE_URL` / `DIRECT_URL` back to the Supabase values. Nothing in the Supabase copy is deleted until step 10.

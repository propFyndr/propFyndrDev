# Beta deployment — what to do when you wake up

**Written 2026-09-19, overnight.** Everything below is committed and verified. Nothing is
deployed, and nothing can be: pushing is blocked by a permission guard only you can lift.

---

## 1. The one thing I could not do

```bash
cd /c/Users/Furqan/Desktop/RealtyPals
git remote add propfyndr https://github.com/propFyndr/propFyndrDev.git
git push propfyndr main
```

Adding that remote and pushing was refused as potential data exfiltration — pushing a private
codebase to a URL that arrived in a chat message is exactly the shape that guard exists to
stop, so I did not work around it.

**Check the target first.** If `propFyndrDev` already has a `main` with its own history you
will hit the same non-fast-forward problem the `elite` remote has:

```bash
git ls-remote --heads propfyndr
```

The `elite` remote is **not** a push target: local and remote diverged on 4 June, and the
remote has 40 commits this tree does not. Pushing there needs a merge or a decision, never a
force.

---

## 2. Environment variables the deploy needs

`.env.example` is write-protected in this environment, so they are listed here instead. All are
set correctly in `backend/.env` locally; the deployed environment needs them too.

| Variable | Why it matters if missing |
|---|---|
| `RESEND_API_KEY` | No invite or password-reset email sends. Degrades rather than breaks — the UI reports `emailed:false` and hands over the link — but nobody gets an email |
| `EMAIL_FROM` | Must be on a domain **verified in Resend**. `propfyndr.in` is verified; the current value `PropFyndr <noreply@propfyndr.in>` is correct. `onboarding@resend.dev` delivers only to the Resend account owner |
| **`FRONTEND_URL`** | **The one that will bite you.** It is `http://localhost:3000` locally, and invite links are built from it. Deploy without changing it and every invite emails a localhost link |
| `GEMINI_LEG_MAX_DURATION_MS` | Defaults to 45000. The cap that turned a 209-second query into 15 seconds |
| `FALLBACK_TURN_BUDGET_MS` | Defaults to 30000 |
| `MEASURE_DB_QUERIES` | Leave **unset** in production. It adds a Prisma extension to every query |

---

## 3. Database

Four migrations were applied directly to the live Supabase database during development, so the
schema is already ahead of the deployed code. Deploying brings them back into line — there is
nothing to run.

```
drop_builder_accounts
add_site_visit_partner_assignment
add_callback_is_test
add_lead_first_contacted_at
```

---

## 4. What was verified overnight

| Check | Result |
|---|---|
| Backend tests | **2,748 passing, 0 failing** |
| Backend build (`tsc`) | clean |
| Frontend typecheck | clean |
| Frontend production build | **passes** — it did not before, see below |
| ESLint | 0 errors |
| Chat corpus, 60 queries | **100% pass** |
| Chat p99 latency | 209.4s → **14.9s** |
| Chat cost | $5.67 → **$5.47** per 1,000 queries |

### The production build was broken and is now fixed

`next build` failed on `/portal-entry`: I had added `useSearchParams()` for tenant branding
without a Suspense boundary, so the page could not be prerendered. **Typecheck and lint were
both clean** — only running the build caught it. It would have failed your first deploy.

### A query could run for three and a half minutes

Gemini's timers measure *silence* and reset on every chunk, so a model emitting slowly was
never stopped, and `FALLBACK_TURN_BUDGET_MS` only refuses to *start* another leg. One corpus
query ran 209 seconds across six legs and 97k prompt tokens.

`GEMINI_LEG_MAX_DURATION_MS` is set once per leg and never reset, aborting through the same
`AbortController` the stall path already uses — so an overrun is handled exactly as a stall
and no new failure mode exists. Re-running the corpus afterwards: **pass rate unchanged at
100%**, p99 down 93%.

---

## 5. The biggest remaining lever, deliberately not pulled

**Every chat query pays a ~13,600-token system prompt.** `SYSTEM_PROMPT_BOUNDARY` in
`lib/ai/prompts/base.ts` is ~13.6k tokens and the measured median prompt is 13,501 — it is
almost the entire input cost.

`lib/ai/gemini.ts` already carries a detailed comment describing how Gemini explicit context
caching would fix it, gated on a `GEMINI_EXPLICIT_CACHE` flag. **That flag is only mentioned in
the comment — it is read nowhere.** The caching was designed and never built.

I did not build it overnight. Its own author wrote that it "changes where the model reads its
per-turn instructions from, and that is a behaviour change to a chat with a long
routing-regression history". Making that change unsupervised and then shipping it to beta is
the opposite of careful.

It is worth doing with you awake: it is plausibly a large cost reduction at zero answer-quality
risk, because the prefix is identical on every turn, which is exactly what caching is for.

---

## 6. Known state, stated plainly

- **No screen has been opened in a browser.** Every UI in this tree is verified by TypeScript,
  lint, a passing production build and backend tests. That is not the same as looking at it.
- Six admin pages still hand-roll their stat tiles. Cosmetic, and a refactor that needs eyes.
- `admin@propfyndr.in` does not use the shared password; I never had it. The other four
  accounts do.
- The invite sent to `syedfurqaan83@gmail.com` points at `localhost:3000` — see `FRONTEND_URL`
  above. Resend accepted it; the link is only useful on this machine.
- `CLAUDE.md`, `MEMORY.md` and some `newProj/` data files are modified but uncommitted. They
  predate this work and I left them rather than sweep them into these commits.

---

## 7. Suggested order in the morning

1. `git ls-remote --heads propfyndr` — see what is there.
2. Push, or open a PR if it already has history.
3. Set `FRONTEND_URL`, `RESEND_API_KEY`, `EMAIL_FROM` in the deploy environment.
4. Deploy, then send yourself one invite and click it. That is the single check no test
   substitutes for.
5. Open each console as each role and look at it. That is the gap tests cannot close.

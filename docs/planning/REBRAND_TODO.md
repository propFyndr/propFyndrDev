# Rebrand: RealtyPals → PropFyndr — what is left

The code is done. 1833 occurrences across 271 files and 72 file/directory paths were
renamed, the logo assets were rebuilt, and both workspaces typecheck and build clean.

Everything below is **outside the code** — files I could not read, systems I cannot
reach, or decisions that are yours to make. Ordered by urgency.

---

## 0. Confirm the spelling first

The logo artwork reads **PropFyndr** (capital P, capital F), and that is what the
codebase now uses everywhere. Your messages sometimes write `propFyndr` (lowercase p).

If lowercase-p is the real brand, say so before anything below is done — it is a
one-command sweep now and a painful one after the domains and accounts are registered.

---

## 1. Render — this breaks production on the next deploy

The frontend proxies `/api/*` to a hostname that does not exist yet.

| file | line | now reads |
|---|---|---|
| `frontend/vercel.json` | 5 | `https://propfyndrdev.onrender.com/api/:path*` |
| `frontend/components/PingBackend.tsx` | 8 | `propfyndrdev-backend.onrender.com` |
| `render.yaml` | 3 | service name `propfyndr-backend` |

**Do this:** Render dashboard → the service → Settings → Name → `propfyndr-backend`.
Render reissues the `.onrender.com` subdomain immediately.

**If you are not ready to rename Render yet,** revert those two frontend lines to the
old `realtypals*` hostnames until you are. A dead API URL is worse than a stale name.

---

## 2. Environment files — still say RealtyPals

I was blocked from reading `.env` files, so I skipped them. These are **tracked in git**
and still carry the old brand:

- `.env.example`
- `backend/.env.example`
- `backend/.env.test`
- `frontend/.env.example`

```bash
sed -i 's/realtypals/propfyndr/g; s/RealtyPals/PropFyndr/g' \
  .env.example backend/.env.example backend/.env.test frontend/.env.example
```

Your untracked `backend/.env` and `frontend/.env.local` need the same — but **look at
the line first**. If the string is a Postgres database name inside `DATABASE_URL`,
changing the text without renaming the actual database breaks local dev. Either rename
the database too, or leave that one line alone.

Also in `frontend/app/layout.tsx:44` there is a `TODO` about the production domain.
Once the domain is settled, set `NEXT_PUBLIC_SITE_URL` and delete the TODO.

---

## 3. The live database — the highest-value item left

Seeded rows still contain the old domain in their text columns. The master JSON files
were rewritten; the rows in Postgres were not. Known shapes:

- `Project.brochure_url` → `https://realtypals.in/brochures/...`
- channel-partner `email` → `partners@realtypals.in`
- any `source_url` / `website` column written by the seed scripts

```sql
UPDATE "Project"
   SET brochure_url = REPLACE(brochure_url, 'realtypals.in', 'propfyndr.in')
 WHERE brochure_url LIKE '%realtypals%';
```

**Better:** ask me to write a Prisma script that sweeps every text column across every
model, prints a dry-run diff, and only writes after you approve it. Hand-written SQL
will miss columns.

---

## 4. Pick one TLD — three are currently in use

| TLD | where it appears |
|---|---|
| `propfyndr.in` | sitemap, robots, terms, privacy, outbound User-Agent strings, seeded data |
| `propfyndr.com` | OG metadata, `next.config.js` image allowlist (`storage.propfyndr.com`), swagger |
| `propfyndr.io` | `frontend/app/s/[id]/opengraph-image.tsx:109` |

This inconsistency was inherited — it existed under the old brand too, and the rename
carried it forward faithfully. Register all three, pick one canonical, 301 the others,
then sweep the codebase to the winner.

---

## 5. GitHub

Current remotes still point at the old org:

```
origin          https://github.com/realtypalsin/realtyPalsDev.git
realtypalsdev   https://github.com/realtypalsin/realtyPalsDev.git   (duplicate of origin)
elitegroup      https://github.com/cipher-cmd/RealtyPals-EliteGroup.git
elite           https://github.com/cipher-cmd/ReatyPalsXElite.git   (note the typo upstream)
```

Rename the org and repo on github.com first, then:

```bash
git remote set-url origin https://github.com/<new-org>/<new-repo>.git
git remote remove realtypalsdev          # duplicate of origin
git remote remove elite                  # typo'd, likely dead
git remote set-url elitegroup https://github.com/cipher-cmd/PropFyndr-EliteGroup.git
```

GitHub 301s the old URL, so nothing breaks the moment you rename — but the old org name
stays visible in every clone URL until you do.

---

## 6. Local project folder

```bash
# close the editor / any Claude Code session first — renaming the cwd kills it
mv ~/Desktop/RealtyPals ~/Desktop/PropFyndr
```

Then `.claude/settings.local.json` needs the same swap. Its RealtyPals hits are
filesystem paths, not brand strings — that is why I deliberately left them alone.

---

## 7. Third-party accounts — dashboard only, no code change

- **Vercel** — Settings → General → Project Name, then Domains
- **Supabase** — project name, and the storage bucket behind `storage.propfyndr.com`
- **PostHog** — project name
- **Google Search Console** — a new domain is a new property; re-verify and submit the new sitemap
- **Google Maps API key** — update the HTTP-referrer allowlist, or Maps 403s on the new domain
- **WhatsApp Business** — display name (this is what buyers see on handoff)
- **Gemini / Tavily / Jina** billing account labels

---

## 8. The second worktree — DONE

`.claude/worktrees/split-chat/` (branch `worktree-split-chat`) has had the identical
rename applied: 144 files, 25 paths, committed as `e76c060`. Every file in that commit
is line-for-line balanced, so nothing but the name changed.

**That branch is now on GitHub as `origin/worktree-split-chat`** — see the note at the
bottom of this file. If you did not want it published:

```bash
git push origin --delete worktree-split-chat
cd .claude/worktrees/split-chat && git branch --unset-upstream
```

Three things about that branch to know:

- **Its in-progress work is deliberately uncommitted.** `backend/src/routes/chat.ts` and
  the four new `chat-helpers.ts` / `chat-router.ts` / `chat-service.ts` / `index.ts`
  files are the chat.ts split this branch exists for. The rename was applied to them,
  but committing it would have buried a 3,200-line refactor under a brand change.
  Review and commit those together.
- **Its logo PNGs are renamed but still contain the old RealtyPals artwork.** Main
  replaced that art and reorganised the asset layout, so **take main's side** on
  `frontend/public/images/` when this branch merges.
- **Merge main into it before continuing work**, or the next merge will fight over
  every renamed path.

## 8b. The Obsidian vault symlink

`obsidian_docs` in that worktree is a **symlink**, not a file:

```
obsidian_docs -> C:/Users/Furqan/Documents/MySecondBrain/RealtyPals
```

I left the target string alone — rewriting it would break the link. To finish the job:

```bash
mv ~/Documents/MySecondBrain/RealtyPals ~/Documents/MySecondBrain/PropFyndr
cd .claude/worktrees/split-chat
rm obsidian_docs
ln -s /c/Users/Furqan/Documents/MySecondBrain/PropFyndr obsidian_docs
```

Whatever notes live in that vault are outside this repo and will still say RealtyPals.

## 8c. A stale worktree registration

`git worktree list` shows a third entry marked `prunable`:

```
C:/Users/Furqan/Desktop/UiRealtyPals.worktrees/agents-best-practices-testing-running
```

That directory is gone — it points at an old `UiRealtyPals` folder that no longer
exists. Clear it with `git worktree prune`.

## 8d. Env files in the worktree too

Same as section 2, but on that branch: `.env.example`, `backend/.env.example`,
`backend/.env.test`, `frontend/.env.example` and `dev.log` were all skipped there for
the same reasons. Apply the section 2 command inside the worktree as well.

---

## 9. Generated caches — no action needed

`.tokensave/*.db`, `.code-review-graph/graph.db`, `.impeccable/hook.cache.json` and
`.superpowers/sdd/*.diff` still contain the old name. They regenerate. Editing the
`.diff` files in particular would corrupt them, since they are historical records.

---

## Not fixable by renaming

- **Nothing in the logo artwork.** The PNGs are the new PropFyndr marks and the old
  RealtyPals art is gone from `frontend/public/`. Masters live in `design/brand/`.
- **`design/icons-legacy/`** — 20 SVGs (add, area, call, compare, fire, garden,
  google-icon, gym, logout, mic, parking, property-detailes, property-discover, recent,
  saved-property, security, settings, share, value-estimator, waiting). Not referenced
  anywhere in the app, which renders Phosphor React icons instead. Moved out of
  `public/` so they stop shipping to browsers; delete the folder whenever you are sure
  you do not want them back.

---

## Note: `worktree-split-chat` was pushed unintentionally

While writing this file, a shell-quoting bug caused the example `git push -u origin
worktree-split-chat` command in section 8 to actually execute. The branch is now on
GitHub. No pull request was opened and nothing on `main` was affected. Section 8 has
the two commands to undo it if you want it unpublished.

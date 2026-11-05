# Moving off Supabase: dev result and the live cutover (5 Nov 2026)

Decision (Furqan, 5 Nov): buyer sign-in moves to Better Auth on our own Neon database, and file storage moves to Neon Object Storage. Supabase is no longer relied on for anything. The Supabase project is **not deleted** by any step below.

## What changed in code (committed on `dev`, not pushed)

| Area | Before | Now |
|---|---|---|
| Buyer sign-in | Supabase Auth, token checked against Supabase's REST API on every request | Better Auth 1.7 inside the backend (`lib/betterAuth.ts`), mounted at `/api/auth/*`, tables `auth_user`, `auth_session`, `auth_account`, `auth_verification` in our own Neon database |
| Identity on a request | `verifyUser` called Supabase | `verifyUser` reads the session from our database (cookie or bearer) |
| User ids | Supabase UUIDs | Same UUIDs: imported users keep their id, so chats, saves and leads stay theirs |
| Passwords | bcrypt in Supabase | Imported bcrypt hashes verify as bcrypt; new passwords use scrypt |
| Email confirmation | Supabase | Still required; verification and reset emails go through Resend |
| Admin lists of buyers | `supabaseAdmin.auth.admin.listUsers` | Reads of `auth_user` |
| Files | Supabase Storage (`property-images`, `project-docs`) | Neon Object Storage, same bucket names and keys (`lib/objectStorage.ts`) |
| Frontend | `@supabase/ssr` client and `sb-*` cookies | `lib/buyerAuth.ts`, same-origin `/api/auth`, httpOnly cookie |
| Dev and live user pools | **One shared pool** | Separate: a sign-up on dev never reaches live |

## Proven on dev

- Sign-up, the email-confirmation gate, wrong password, sign-in, cookie session, bearer session, sign-out, tampered token: `backend/src/routes/__tests__/betterAuthFlow.test.ts` (3/3, real app, dev database).
- An imported Supabase-format bcrypt user signs in with their existing password and keeps their id (same test).
- Storage round trip on the dev bucket: upload, public read (200), list, delete (then 404): `scripts/storage/probe-storage.ts`.
- 142 objects (17.7 MB + 144.1 MB) copied to the dev Neon buckets, every size matched; 13 `construction_updates` URLs rewritten, 0 Supabase URLs left (dev).

**Not proven yet:** a real browser sign-in against the local app (the test calls the backend directly), a real email delivered, and the live steps below.

## DONE on 5 Nov 2026: live and dev are on the new setup

Order actually run: storage buckets and credential, Render variables (live and dev), live tables, file copy and 13 link rewrites, push `dev` then `main`, smoke test. Commits `458dde2d` and `3b8c78bb`. Nothing from Supabase is read or written at runtime any more; the Supabase project is untouched and is the rollback.

**Decision (Furqan, 5 Nov): the existing Supabase accounts were not moved.** Every account from now on is created on Neon, and the 11 old ones sign up again with the same email.

**Live smoke test, 5 Nov 12:43 UTC** (throwaway address on Resend's test domain, row deleted afterwards): sign-up 200, sign-in before verifying 403 `EMAIL_NOT_VERIFIED`, sign-in 200 after verifying, cookie `__Secure-ra.session_token` on `.realtyask.in` (Secure, HttpOnly), session returned with the cookie and `null` without. Live auth tables hold 0 rows.

**Admins:** the 4 live admin accounts (all super admins) were never in Supabase Auth: they use their own passwords in `admin_users` (`lib/adminIdentity.ts`), 0 are linked to Supabase and none of their emails has a Supabase account, so nothing needed re-adding. Builder and partner logins use the same separate system.

**Follow-ups done:** the 13 dead photo links were removed (live and dev, backups saved); the stray QA account was deleted from Supabase; Resend shows the live sign-up email as delivered from the verified `realtyask.in` domain.

**Found on the way**
- Better Auth could not see the visitor's IP behind the Vercel proxy, so its default limits would have been shared by all buyers. Fixed in `3b8c78bb` (session checks unlimited; sign-in and sign-up 10 per minute shared).
- The 13 stored `construction_updates` photo links were already dead on Supabase (files never uploaded).
- Live `propety-docs` (misspelled, empty, private) is unused and left alone.

**Environment now set**
- Render live (`propFyndrLive`): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL=https://realtyask.in`, `AUTH_COOKIE_DOMAIN=.realtyask.in`, `AUTH_COOKIE_PREFIX=ra`, `AUTH_TRUSTED_ORIGINS`, `STORAGE_*` (live branch).
- Render dev (`propFyndrDev`): same names, dev values (`ra-dev` prefix, dev storage branch).
- Vercel: unchanged. The site proxies `/api/*` to the backend, so no variable is needed.

**Roll back:** redeploy commit `40960462` (the previous `main`). Supabase and its buckets are intact, so the old code works as before. Accounts created on the new system would exist only in the new tables.

**Later cleanup (not urgent):** after a week of stable running, remove `@supabase/supabase-js` from `backend/package.json`, the `NEXT_PUBLIC_SUPABASE_*` variables on Vercel and the `SUPABASE_*` ones on Render, then the owner decides about pausing the Supabase project.

Original plan and reasoning (kept for reference):

## Live cutover: every step needs Furqan's yes, in this order

**Decision (Furqan, 5 Nov): the existing Supabase accounts are NOT moved.** Every account from now on is created on Neon. No export, no import. The import script stays in the repo, unused.

Live is at risk only at steps 3-5. Steps 1-2 do not change what buyers see.

1. **Live storage: DONE 5 Nov.** Public-read buckets `property-images` and `project-docs` created on the live branch (`br-quiet-hat-ao8bib8n`, Singapore) and a `storage:read`+`storage:write` credential. Proven with a real upload, list, anonymous read and delete on both (`scripts/storage/probe-live-storage.ts`). The credential is in `C:UsersFurqanealtyask-live-storage.env` (outside the repo). The old misspelled `propety-docs` bucket is unused and left alone.
2. **Set environment variables before the push** (Render service `realtypalsdev`, and Vercel):
   - `BETTER_AUTH_SECRET` (32+ random characters, new for live), `BETTER_AUTH_URL=https://realtyask.in`, `AUTH_COOKIE_DOMAIN=.realtyask.in`, `AUTH_COOKIE_PREFIX=ra`, `AUTH_TRUSTED_ORIGINS=https://app.realtyask.in` (no trailing slash; `FRONTEND_URL` already lists the others)
   - `STORAGE_S3_ENDPOINT=https://br-quiet-hat-ao8bib8n.storage.c-2.ap-southeast-1.aws.neon.tech`, `STORAGE_S3_REGION=ap-southeast-1`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`
   - `FRONTEND_URL`, `RESEND_API_KEY`, `EMAIL_FROM` already exist.
   If these are missing when the new code starts, the backend **refuses to boot** in production (by design: `lib/env.ts`).
3. **Create the live tables (DDL, additive, 4 new tables):** `npx tsx scripts/auth/apply-better-auth-tables.ts --live`. Safe before the push: nothing reads them yet.
4. **Copy the files and rewrite the URLs (live bulk write):** `npx tsx scripts/storage/migrate-supabase-storage.ts --live` (dry run), then `--apply`. Copies 142 objects and rewrites 13 URLs; stops before any rewrite if a copy is incomplete. Needs the live `STORAGE_*` env and `NEON_DB`.
5. **Push `dev` to `main`** (also carries the property-page fixes, price-history, outage and journey fixes). Render and Vercel deploy.
6. **Smoke test on live:** sign up a new test account, confirm by email, sign in, save a project, request a callback, upload a document in admin, open an image. Check Render logs for `[auth]` errors. Then delete the test account.

**Roll back:** redeploy the previous commit. Supabase and its buckets are untouched, so the old code works as before; accounts created on the new system after the cutover would exist only in the new tables.

## What buyers will notice

- **Everyone with a Supabase account has to sign up again** (same email works). There are 11 such accounts, about 7 with any activity. Their old chats, saves and preferences stay in the database but are no longer linked to them: on live, 105 chat sessions, 1 saved property and 4 saved preference rows (read 5 Nov). A buyer who signs up again starts empty.
- Everyone signed in today is signed out once.
- Dev and live accounts are separate from now on.
- Optional: send the active accounts one line ("we moved sign-in; please sign up again with the same email").

## Still on Supabase after this

- Nothing is read or written. The project stays for rollback.
- Decision for later: when live has run a week on the new setup, remove `@supabase/supabase-js` from `backend/package.json` and the `SUPABASE_*` env vars, then pause the Supabase project (the owner deletes it, never us).
- Egress: the migration scripts download 162 MB from Supabase once. If the egress allowance is not yet reset this can fail; it stops safely and can be re-run.

## Open questions

- `images.ts` (removed) listed only the bucket root and was already wrong for nested folders; nothing called it. The 109 of 122 `property-images` objects and 20 `project-docs` objects that no database row references were copied anyway. Delete later by owner decision.
- Neon Object Storage has no CDN. Images are served from Singapore. Measure from India before relying on it for heavy pages; if slow, put a CDN or Cloudflare in front using the `storage.propfyndr.com` host already in `next.config.js`.

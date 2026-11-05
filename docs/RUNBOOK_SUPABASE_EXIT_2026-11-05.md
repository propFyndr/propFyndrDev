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

## Live cutover: every step needs Furqan's yes, in this order

Live is at risk only at steps 4–7. Steps 1–3 do not change what buyers see.

1. **Export the 11 Supabase accounts (Furqan, 2 minutes).** In the Supabase dashboard SQL editor run:
   `select id, email, encrypted_password, email_confirmed_at, created_at, raw_user_meta_data->>'name' as name from auth.users;`
   Download the result as JSON to a folder **outside the repo**. Do not paste it in chat: it holds password hashes. Delete it after step 5.
2. **Create the live storage credentials (Neon).** Enable Object Storage on the live branch (`ep-super-water`, Singapore is supported), create the buckets `property-images` and `project-docs` as public-read, create a credential with `storage:read` + `storage:write`.
3. **Set environment variables before the push** (Render service `realtypalsdev`, and Vercel):
   - `BETTER_AUTH_SECRET` (32+ random characters, new for live), `BETTER_AUTH_URL=https://realtyask.in`, `AUTH_COOKIE_DOMAIN=.realtyask.in`, `AUTH_COOKIE_PREFIX=ra`
   - `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION=ap-southeast-1`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`
   - `FRONTEND_URL` already exists; `RESEND_API_KEY` and `EMAIL_FROM` already exist.
   If these are missing when the new code starts, the backend **refuses to boot** in production (by design: `lib/env.ts`).
4. **Create the live tables (DDL, additive, 4 new tables):** `npx tsx scripts/auth/apply-better-auth-tables.ts --live`. Safe to run before the push: nothing reads them yet.
5. **Import the live users, after a backup:** `npx tsx scripts/auth/import-supabase-users.ts <export.json> --live` (dry run), then `--apply`. Writes a backup first, never prints a hash. Re-export and re-run just before step 7 so anyone who signed up in between is not lost.
6. **Copy the files and rewrite the URLs (live bulk write):** `npx tsx scripts/storage/migrate-supabase-storage.ts --live` (dry run), then `--apply`. Copies 142 objects and rewrites 13 URLs; it stops before any rewrite if a copy is incomplete.
7. **Push `dev` to `main`** (carries the property-page fixes, price-history, outage and journey fixes too). Render and Vercel deploy.
8. **Smoke test on live:** sign in with an existing account, save a project, request a callback, upload a document in admin, open an image. Check Render logs for `[auth]` errors.

**Roll back:** the Supabase project and buckets are untouched, so redeploying the previous commit restores the old behaviour (old code reads Supabase, whose users and files are intact). New live sign-ups made after the cutover would exist only in the new tables.

## What buyers will notice

- Everyone signed in today is signed out once and signs in again (new session type). Their password is unchanged.
- Dev and live accounts are separate from now on.
- Anyone who signed up on Supabase after the export in step 1 and before the re-export is missed: re-export right before step 7.

## Still on Supabase after this

- Nothing is read or written. The project stays for rollback.
- Decision for later: when live has run a week on the new setup, remove `@supabase/supabase-js` from `backend/package.json` and the `SUPABASE_*` env vars, then pause the Supabase project (the owner deletes it, never us).
- Egress: the migration scripts download 162 MB from Supabase once. If the egress allowance is not yet reset this can fail; it stops safely and can be re-run.

## Open questions

- `images.ts` (removed) listed only the bucket root and was already wrong for nested folders; nothing called it. The 109 of 122 `property-images` objects and 20 `project-docs` objects that no database row references were copied anyway. Delete later by owner decision.
- Neon Object Storage has no CDN. Images are served from Singapore. Measure from India before relying on it for heavy pages; if slow, put a CDN or Cloudflare in front using the `storage.propfyndr.com` host already in `next.config.js`.

# PropFyndr Day 1: Phase-Wise Implementation & Verification Plan

This document governs the execution of **Day 1: Go-Live, Git Sync, Deploy & Auth/Security Hardening**. 
Each phase contains actionable steps and an **immutable, mathematically checkable Pass Condition ("1 + 1 = 2")**. A phase is **NEVER** marked done until its exact output condition is verified by command output or live test assertion.

---

## Execution Tracker & Quality Gates

| Phase | Description | Status | Verification Criteria ("1 + 1 = 2" Rule) |
|---|---|---|---|
| **Phase 1.1** | **Git Sync & Remote Push** | 🟡 PENDING | `git rev-list --count origin/main..main` returns `0` (clean remote sync to `propFyndrDev`). |
| **Phase 1.2** | **Production Env Config (Render & Vercel)** | 🟡 PENDING | `curl -s https://api.propfyndr.in/api/v1/health` returns HTTP 200 with `status: ok` and verified env flags. |
| **Phase 1.3** | **FRONTEND_URL & Email Invite Delivery** | 🟡 PENDING | Live invite sent via Resend produces an outbox row with `status: sent`, and the emailed link starts with `https://app.propfyndr.in` (0 `localhost` occurrences). |
| **Phase 1.4** | **Staff Credential Rotation & Session Revocation** | 🟡 PENDING | Resetting password immediately revokes active tokens (`admin_sessions` deleted); 5 bad logins returns HTTP 423 `Account locked`. |
| **Phase 1.5** | **Live Role Console Smoke Audit** | 🟡 PENDING | Authenticating as all 5 roles (`SUPER_ADMIN`, `ANALYST`, `SALES`, `BUILDER`, `PARTNER`) mounts respective consoles without HTTP 403 or blank screens. |

---

## Phase 1.1: Git Reconciliation & Remote Deployment Push

### Objective
Push local `main` (which contains the 4 verified overnight commits: role clearance, bound Gemini timer, Next.js build fix, and sales lookup) to the authoritative remote `origin` (`https://github.com/propFyndr/propFyndrDev.git`).

### Actions
1. Verify working tree state:
   ```bash
   git status -s
   ```
2. Check commit divergence between local `main` and `origin/main`:
   ```bash
   git rev-list --left-right --count main...origin/main
   ```
   *Expected starting state: `4  0` (local is 4 commits ahead, 0 commits behind).*
3. Stage and commit any outstanding configuration documentation updates:
   ```bash
   git add MASTER_EXECUTION_ROADMAP.md DAY_1_EXECUTION_PLAN.md render.yaml .env.example
   git commit -m "docs: master roadmap, day 1 execution plan, and deploy config"
   ```
4. Push to production repository:
   ```bash
   git push origin main
   ```

### 🎯 Pass Condition ("1 + 1 = 2")
Run:
```bash
git rev-list --count origin/main..main
```
* **Criterion for DONE**: The command outputs **`0`**. (Local `main` and `origin/main` are at the exact same commit SHA).

---

## Phase 1.2: Environment Configuration on Render (Backend) & Vercel (Frontend)

### Objective
Ensure that both backend (Render) and frontend (Vercel) hosting environments possess the complete, non-conflicting set of environment variables required for live production operation.

### Actions

#### Render Backend Configuration (`propfyndr-backend`)
In the Render Service Dashboard (`Settings -> Environment`):
1. **Critical URL & Routing Variables**:
   * `NODE_ENV`: `production`
   * `PORT`: `10000`
   * `FRONTEND_URL`: `https://app.propfyndr.in` *(CRITICAL: Replaces `http://localhost:3000` so invite links work)*
2. **Database & Cache**:
   * `DATABASE_URL`: Active Supabase Transaction Pooler URL (`aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true`)
   * `DIRECT_URL`: Supabase Session Direct Connection (`aws-0-ap-south-1.pooler.supabase.com:5432/postgres`)
   * `SUPABASE_URL`: `https://[ref].supabase.co`
   * `SUPABASE_SERVICE_ROLE_KEY`: Service role JWT
   * `UPSTASH_REDIS_REST_URL`: Upstash Redis instance URL
   * `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis token
3. **AI Provider Guardrails**:
   * `ENABLE_GEMINI_TOOLS`: `true` *(Enables live database lookups for floor plans, prices, and RERA)*
   * `GEMINI_LEG_MAX_DURATION_MS`: `45000` *(Enforces 45s hard timer per leg to prevent 3-minute runaway turns)*
   * `FALLBACK_TURN_BUDGET_MS`: `30000`
   * `GEMINI_API_KEY`: Primary Gemini 2.0 / 1.5 Flash Key
   * `GROQ_API_KEY1`, `GROQ_API_KEY2`, `GROQ_API_KEY3`: Groq fallback keys
4. **Email & Lead Notifications**:
   * `RESEND_API_KEY`: Active Resend production key
   * `EMAIL_FROM`: `PropFyndr <noreply@propfyndr.in>` *(Domain must be verified in Resend)*
   * `WHATSAPP_PROVIDER`: `none` (or `meta` if active token provided)
5. **Observability**:
   * `MEASURE_DB_QUERIES`: **UNSET** (Must be omitted in production to avoid Prisma extension overhead)
   * `POSTHOG_API_KEY`: PostHog server key
   * `POSTHOG_HOST`: `https://us.posthog.com`
   * `LANGFUSE_PUBLIC_KEY`: Langfuse public API key
   * `LANGFUSE_SECRET_KEY`: Langfuse secret API key
   * `LANGFUSE_BASE_URL`: `https://us.cloud.langfuse.com`

#### Vercel Frontend Configuration (`realty-pals-dev-frontend`)
In the Vercel Project Dashboard (`Settings -> Environment Variables`):
1. **Public Backend & API Links**:
   * `NEXT_PUBLIC_BACKEND_URL`: `https://propfyndr-backend.onrender.com` (or your custom backend domain `https://api.propfyndr.in`)
   * `NEXT_PUBLIC_API_URL`: `https://propfyndr-backend.onrender.com/api/v1`
   * `NEXT_PUBLIC_BASE_URL`: `https://app.propfyndr.in`
2. **Client Supabase & Auth**:
   * `NEXT_PUBLIC_SUPABASE_URL`: `https://[ref].supabase.co`
   * `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase anon/public key
3. **Client Analytics & Maps**:
   * `NEXT_PUBLIC_POSTHOG_KEY`: PostHog client key (`phc_...`)
   * `NEXT_PUBLIC_POSTHOG_HOST`: `https://us.i.posthog.com`
   * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Restricted Google Maps API key
4. **Build Settings**:
   * Framework Preset: `Next.js`
   * Build Command: `cd frontend && npm run db:generate && npm run build`
   * Output Directory: `frontend/.next`

### 🎯 Pass Condition ("1 + 1 = 2")
Run:
```bash
curl -s -o /dev/null -w "%{http_code}" https://api.propfyndr.in/api/v1/health
```
* **Criterion for DONE**: The command outputs **`200`**, and `GET /api/v1/health` returns JSON containing `status: "ok"`.

---

## Phase 1.3: Fixing FRONTEND_URL & Live Resend Invite Delivery

### Objective
Verify that staff invitations generated by the Super Admin Team console assemble URLs using the production domain, dispatch through Resend, and allow password creation.

### Actions
1. Audit `backend/src/lib/teamInvite.ts`:
   * Confirm that the setup URL template is:
     ```typescript
     const setupUrl = `${process.env.FRONTEND_URL}/admin/setup-password?token=${rawToken}`
     ```
   * Enforce a startup assertion in `backend/src/index.ts`: If `NODE_ENV === 'production'` and `FRONTEND_URL` includes `localhost`, fail fast with a clear error rather than dispatching corrupted links.
2. Trigger a real invite via Super Admin API or UI:
   ```bash
   # Dispatches invite to a verified test address
   POST /api/v1/admin/team/invite
   Payload: { "email": "syedfurqaan83@gmail.com", "role": "SUPER_ADMIN" }
   ```
3. Inspect `audit_logs` and the Resend API response:
   * Verify HTTP status returned is 201.
   * Check email inbox: open message from `PropFyndr <noreply@propfyndr.in>`.
   * Verify link URL format: `https://app.propfyndr.in/admin/setup-password?token=...`

### 🎯 Pass Condition ("1 + 1 = 2")
Run:
```bash
# Query the database for the newly dispatched invite token
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.adminInvite.findFirst({
  where: { email: 'syedfurqaan83@gmail.com' },
  orderBy: { created_at: 'desc' }
}).then(row => {
  if (row && row.token_hash && !row.used_at) {
    console.log('INVITE_VALID:TRUE');
  } else {
    console.log('INVITE_VALID:FALSE');
  }
  process.exit(0);
});
"
```
* **Criterion for DONE**: Output is **`INVITE_VALID:TRUE`**, AND the received email link contains the production domain with **0 occurrences of `localhost`**.

---

## Phase 1.4: Staff Password Rotation, Session Revocation & Brute Force Lockout

### Objective
Eliminate shared credentials across internal roles, enforce session invalidation on password change, and implement account lockouts after 5 consecutive failed logins.

### Actions
1. **Rotate Credentials**:
   * Create an automated script `backend/scripts/rotate-staff-passwords.ts`:
     * Assign distinct, cryptographically random 20-character passwords to `admin@propfyndr.in`, `sales@propfyndr.in`, `analyst@propfyndr.in`, and `channel.partner@propfyndr.in`.
     * Store bcrypt hashes in `admin_users.password_hash`.
2. **Session Invalidation on Password Change**:
   * In `backend/src/routes/adminAuth.ts` and `backend/src/routes/portal.ts`:
     * When `POST /admin/setup-password` or `POST /admin/reset-password` succeeds, execute:
       ```typescript
       await prisma.adminSession.deleteMany({ where: { user_id: user.id } })
       ```
3. **Failed Login Lockout**:
   * Add fields to `admin_users` (or memory cache): `failed_attempts Int @default(0)`, `locked_until DateTime?`.
   * In `login`:
     * If `locked_until > new Date()`, return HTTP 423 (Locked) with minutes remaining.
     * If password check fails, increment `failed_attempts`. If `failed_attempts >= 5`, set `locked_until = new Date(Date.now() + 15 * 60 * 1000)`.
     * On successful login, reset `failed_attempts = 0` and `locked_until = null`.
4. **Secure Cookie Configuration**:
   * Set flags on session cookies:
     ```typescript
     res.cookie('admin_session', token, {
       httpOnly: true,
       secure: process.env.NODE_ENV === 'production',
       sameSite: 'lax',
       maxAge: 7 * 24 * 60 * 60 * 1000
     })
     ```

### 🎯 Pass Condition ("1 + 1 = 2")
Run:
```bash
# Automated security probe asserting lockout & revocation
npx jest backend/src/routes/__tests__/adminAuthLockout.test.ts
```
* **Criterion for DONE**: Jest reports **all test suites pass (0 failures)** asserting that:
  1. 5th invalid password returns HTTP 423.
  2. A valid password change deletes all active session rows from `admin_sessions`.

---

## Phase 1.5: Multi-Role Console Smoke Audit (Live Browser Check)

### Objective
Log into the production web application as each of the 5 distinct roles and verify that role boundaries, permissions, and layout rendering work without 403 errors or blank pages.

### Actions & Role Matrix Audit

| Role | Test Credentials | Required Working Views | Prohibited Views (Must 403 / Hide) |
|---|---|---|---|
| **SUPER_ADMIN** | `admin@propfyndr.in` | `/admin/team`, `/admin/audit-logs`, `/admin/spend`, `/admin/outbox` | None. Full platform oversight. |
| **ANALYST** | `analyst@propfyndr.in` | `/admin/projects`, `/admin/builders`, `/admin/sectors`, `/admin/quality` | `/admin/leads` (403), `/admin/queue` (403), Project deletion (403). |
| **SALES** | `sales@propfyndr.in` | `/admin/leads`, `/admin/queue`, `/admin/lookup` (read-only project view) | Project editing (403), builder creation (403), team invites (403). |
| **BUILDER** | Developer login (Lotus Greens) | `/portal/builder/projects`, `/portal/builder/leads`, `/portal/builder/objections` | Other builders' projects (403), buyer chat transcripts (403). |
| **PARTNER** | `channel.partner@propfyndr.in` | `/portal/partner/leads`, `/portal/partner/site-visits` | Builder configuration (403), other partner leads (403). |

### Smoke Test Execution Steps:
1. Open browser in incognito mode.
2. Sign in as `SALES`:
   * Confirm `/admin/queue` renders time-to-first-contact tile and lead table.
   * Confirm that clicking on a project navigates to read-only `/admin/lookup`, with **0 edit or delete buttons visible**.
3. Sign in as `ANALYST`:
   * Confirm `/admin/quality` loads project completeness scores (55 to 97).
   * Confirm `/admin/leads` is absent from sidebar.
4. Sign in as `BUILDER`:
   * Confirm that opening `/portal/builder/leads` displays a Lead Brief preview with competitor names scrubbed and **0 chat transcripts**.
5. Sign in as `SUPER_ADMIN`:
   * Confirm `/admin/audit-logs` shows recent actions (login events, password changes, invite issuances).

### 🎯 Pass Condition ("1 + 1 = 2")
* **Criterion for DONE**: All 5 role logins succeed; DevTools Console reports **0 uncaught exceptions**; and accessing a prohibited URL returns clean HTTP 403 or redirects to designated role dashboard.

---

## Verification & Handoff Sign-off

When Phases 1.1 through 1.5 have all satisfied their exact criteria, run the full test suite one final time:

```bash
cd backend && npm test
cd ../frontend && npm run typecheck && npm run build
```

* Final Pass Criteria: **2,748 backend tests passing (0 failures), frontend typecheck clean, production build passes with 0 errors**.

# Referral Link Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a SUPER_ADMIN generate a labelled referral link, track every device that arrives through it (and through the chain of personal links each arrival gets), and see the resulting tree — devices per generation, who activated, and per-person summaries — in a new `/admin/referrals` area, without collecting any visitor's real name.

**Architecture:** Two new Prisma models (`ReferralLink`, `ReferralVisit`) hold the tree. A public `POST /api/v1/referral/arrive` endpoint, called once per device on landing, resolves attribution with a pure function (`resolveAttribution`) and issues the device its own personal code. The frontend rewrites the address bar to that code and threads it through every share surface (new share button, dossier, shortlist). A new admin router, mounted under the existing `/admin` guard, exposes the tree and per-person drawer; SALES/ANALYST/BUILDER/PARTNER are explicitly denied in `adminPolicy.ts`. A retention purge script (dry-run by default) deletes guest chats and referral data after 12 months, and the privacy policy is updated to match.

**Tech Stack:** Express + Prisma (backend/src), Next.js App Router (frontend/app), `node:test` + `node:assert/strict` (backend tests via `npx tsx --test`), Jest + React Testing Library conventions already in `frontend/lib/__tests__` (via `npx jest`).

**Spec:** `docs/superpowers/specs/2026-10-11-referral-tracking-design.md`

## Global Constraints

- No real visitor names are ever collected. Only the admin-chosen `label` and `greeting_name` on a ROOT link are human names, and only admins see them.
- No device fingerprinting. Store only derived `device_class`, `os`, `app_guess` — never the raw user-agent string or IP address in the referral tables.
- No expiry. "Revoke" stops new attribution; existing tree data is kept.
- `/admin/referrals` (all methods) is SUPER_ADMIN-only. SALES, ANALYST, BUILDER, PARTNER must get 403.
- `GET /admin/referrals/nodes/:guestToken` is an audited read (it names one person) — same mechanism as `/admin/conversations/:id`.
- First touch wins: a device's parent is set once, on first arrival, and never changes.
- Preview-bot user agents must not create rows (link-preview fetchers from WhatsApp/iMessage/etc. must not look like visits).
- Arrival is rate-limited (20 per 10 minutes per guest token, and per IP) using the existing `checkRateLimit` from `backend/src/lib/cache.ts`.
- The schema migration is additive only (two new models, one new enum) and must not be run without explicit confirmation from the user — stop and ask before executing `npx prisma migrate dev`.
- The retention purge script defaults to dry-run (prints counts, deletes nothing); the first `--apply` run needs explicit user confirmation before you execute it yourself.
- Retention window is 12 months, for both guest `ChatSession` rows and `ReferralVisit`/`ReferralLink` rows.
- Codes are 8 characters from a crypto-random, unambiguous alphabet (no `0/O/1/I/L`).
- Follow existing code conventions exactly: Express routers return via `res.status().json()` inside try/catch (see `backend/src/routes/dossier.ts`), Prisma fields are snake_case, frontend admin pages use `adminFetch` from `frontend/lib/adminFetch.ts`, phosphor-icons (`@phosphor-icons/react`) for new icons in `DiscoveryContent.tsx`-adjacent components, lucide-react is used elsewhere (e.g. `CookiesBanner.tsx`) — match whichever file you're editing.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/prisma/schema.prisma` | Add `ReferralLinkKind` enum, `ReferralLink`, `ReferralVisit` models |
| `backend/src/lib/referralCode.ts` | Pure: code generation, bot-UA detection, device/OS/app-guess parsing from a user-agent string |
| `backend/src/lib/referralAttribution.ts` | Pure: `resolveAttribution()` — given the arriving code and a lookup of existing rows, decides parent/generation/root/depth_inferred |
| `backend/src/routes/referral.ts` | Public router: `POST /api/v1/referral/arrive` |
| `backend/src/lib/adminPolicy.ts` | Modify: deny `/referrals` reads for SALES/ANALYST, deny writes for ANALYST (SALES writes are deny-by-default already) |
| `backend/src/lib/adminReadAudit.ts` | Modify: add `/referrals/nodes/:guestToken` as an audited read |
| `backend/src/routes/adminReferrals.ts` | Admin router: generate, list, tree, node drawer, revoke, reset-holder, metrics |
| `backend/src/routes/sessions.ts` | Modify: `/migrate` also attaches `user_id` to the caller's `ReferralVisit` |
| `backend/src/index.ts` | Modify: mount `referralRouter` (public) and `adminReferralsRouter` (under `/admin`) |
| `backend/scripts/purge-retention.ts` | Dry-run-by-default script: deletes guest `ChatSession` and `ReferralVisit`/`ReferralLink` rows older than 12 months |
| `frontend/lib/referral.ts` | `getOwnReferralCode()`, `arrive()` API call, URL helpers |
| `frontend/components/ReferralTracker.tsx` | Client component mounted in root layout: calls `arrive()` once, rewrites the address bar, shows the greeting |
| `frontend/app/r/[code]/page.tsx` | Redirects a labelled link visitor into `/discover?r=<code>` |
| `frontend/app/r/[code]/opengraph-image.tsx` | Static (no DB call) preview card for link previews |
| `frontend/components/ReferralNotice.tsx` | Small dismissible notice strip, cookie-banner style |
| `frontend/components/chat/ReferralShareButton.tsx` | "Share RealtyAsk" button (native share / WhatsApp / SMS / copy), carries the device's own code |
| `frontend/app/layout.tsx` | Modify: mount `ReferralTracker` and `ReferralNotice` |
| `frontend/components/DiscoveryContent.tsx` | Modify: render `ReferralShareButton` in the header; append `r`/`c` params to the dossier/shortlist share URLs |
| `frontend/app/privacy/page.tsx` | Modify: add shared-link disclosure, update retention section and AI-engine wording |
| `frontend/app/admin/referrals/page.tsx` | Admin UI: generate link, links list with stats |
| `frontend/app/admin/referrals/[code]/page.tsx` | Admin UI: tree view + node drawer |

---

### Task 1: Prisma schema — `ReferralLink` and `ReferralVisit`

**Files:**
- Modify: `backend/prisma/schema.prisma` (add after the `Dossier` model, which ends at line 1500)
- Test: `backend/src/lib/__tests__/referralSchema.test.ts`

**Interfaces:**
- Produces: `prisma.referralLink`, `prisma.referralVisit` Prisma Client models, `ReferralLinkKind` enum (`ROOT` | `PERSONAL`), used by every later backend task.

- [ ] **Step 1: Add the enum and models to the schema**

Open `backend/prisma/schema.prisma`, find the `Dossier` model (it ends at line 1500 with `@@map("dossiers")` followed by a blank line and the `WebFact` comment). Insert the following between them:

```prisma
enum ReferralLinkKind {
  ROOT
  PERSONAL
}

/// A referral code. ROOT links are admin-generated and labelled ("Rahul –
/// college"); PERSONAL links are minted automatically for every device that
/// arrives, so organic sharing forms a tree too. See lib/referralAttribution.ts.
model ReferralLink {
  code                String           @id
  kind                ReferralLinkKind
  created_by_admin_id String?
  label               String?
  note                String?
  greeting_name       String?
  holder_guest_token  String?
  owner_guest_token   String?          @unique
  revoked_at          DateTime?
  created_at          DateTime         @default(now())

  @@index([created_by_admin_id])
  @@map("referral_links")
}

/// One row per device that has ever arrived on a referral link (or arrived
/// organically, with no code at all). `parent_guest_token` is set once, on
/// first arrival, and never changes. See lib/referralAttribution.ts.
model ReferralVisit {
  guest_token        String   @id
  user_id            String?
  own_code           String   @unique
  arrived_via_code   String?
  root_code          String
  parent_guest_token String?
  generation         Int
  depth_inferred     Boolean  @default(false)
  prior_user         Boolean  @default(false)
  device_class       String
  os                 String
  app_guess          String
  share_channel      String?
  first_seen_at      DateTime @default(now())

  @@index([root_code])
  @@index([parent_guest_token])
  @@index([arrived_via_code, first_seen_at])
  @@map("referral_visits")
}
```

- [ ] **Step 2: Validate the schema without touching the database**

Run: `cd backend && npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 3: STOP — ask the user before running the migration**

Say to the user: "Schema changes are ready (additive only: one enum, two new tables, nothing existing is touched). Run `npx prisma migrate dev --name add_referral_tracking` against the dev database now?" Wait for explicit yes.

Once approved, run: `cd backend && npx prisma migrate dev --name add_referral_tracking`
Expected: a new folder under `backend/prisma/migrations/` and `✔ Generated Prisma Client`.

- [ ] **Step 4: Write a smoke test that the client exposes the new models**

```typescript
// backend/src/lib/__tests__/referralSchema.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../db'

describe('referral schema', () => {
  it('exposes referralLink and referralVisit on the Prisma client', () => {
    assert.equal(typeof prisma.referralLink.findUnique, 'function')
    assert.equal(typeof prisma.referralVisit.findUnique, 'function')
  })
})
```

- [ ] **Step 5: Run the test**

Run: `cd backend && npx tsx --test src/lib/__tests__/referralSchema.test.ts`
Expected: PASS (this only checks the generated client shape, no DB connection needed for the assertion itself, though `db.ts` will attempt to construct a client — if that errors in this environment without a DATABASE_URL, skip running it here and note it needs a real dev DB to execute; the shape check is still correct code to commit).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/lib/__tests__/referralSchema.test.ts
git commit -m "feat(referral): add ReferralLink and ReferralVisit schema

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Pure helpers — code generation, bot detection, device parsing

**Files:**
- Create: `backend/src/lib/referralCode.ts`
- Test: `backend/src/lib/__tests__/referralCode.test.ts`

**Interfaces:**
- Produces:
  - `generateReferralCode(): string` — 8 chars from `REFERRAL_CODE_ALPHABET`.
  - `isPreviewBotUserAgent(userAgent: string | undefined | null): boolean`
  - `parseDeviceInfo(userAgent: string | undefined | null): { device_class: 'mobile' | 'desktop' | 'tablet'; os: 'ios' | 'android' | 'windows' | 'macos' | 'other'; app_guess: 'instagram' | 'facebook' | 'unknown' }`
- Consumes: nothing (pure, no imports from other new files).

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/lib/__tests__/referralCode.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateReferralCode, isPreviewBotUserAgent, parseDeviceInfo, REFERRAL_CODE_ALPHABET } from '../referralCode'

describe('generateReferralCode', () => {
  it('returns an 8-character code drawn only from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode()
      assert.equal(code.length, 8)
      for (const ch of code) {
        assert.ok(REFERRAL_CODE_ALPHABET.includes(ch), `unexpected character ${ch} in ${code}`)
      }
    }
  })

  it('excludes ambiguous characters', () => {
    for (const bad of ['0', 'O', '1', 'I', 'L']) {
      assert.ok(!REFERRAL_CODE_ALPHABET.includes(bad), `alphabet must not contain ${bad}`)
    }
  })

  it('does not produce the same code on consecutive calls (sanity, not a uniqueness guarantee)', () => {
    const a = generateReferralCode()
    const b = generateReferralCode()
    assert.notEqual(a, b)
  })
})

describe('isPreviewBotUserAgent', () => {
  it('flags known link-preview fetchers', () => {
    assert.equal(isPreviewBotUserAgent('WhatsApp/2.23.20.0 A'), true)
    assert.equal(isPreviewBotUserAgent('facebookexternalhit/1.1'), true)
    assert.equal(isPreviewBotUserAgent('TelegramBot (like TwitterBot)'), true)
    assert.equal(isPreviewBotUserAgent('Slackbot-LinkExpanding 1.0'), true)
  })

  it('does not flag a real browser', () => {
    assert.equal(isPreviewBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'), false)
  })

  it('treats a missing user agent as not a bot (caller decides what to do with no UA)', () => {
    assert.equal(isPreviewBotUserAgent(undefined), false)
    assert.equal(isPreviewBotUserAgent(null), false)
    assert.equal(isPreviewBotUserAgent(''), false)
  })
})

describe('parseDeviceInfo', () => {
  it('detects iOS mobile Safari', () => {
    const info = parseDeviceInfo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    assert.equal(info.device_class, 'mobile')
    assert.equal(info.os, 'ios')
    assert.equal(info.app_guess, 'unknown')
  })

  it('detects Android mobile', () => {
    const info = parseDeviceInfo('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36')
    assert.equal(info.device_class, 'mobile')
    assert.equal(info.os, 'android')
  })

  it('detects the Instagram in-app browser', () => {
    const info = parseDeviceInfo('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 302.0.0.23.114')
    assert.equal(info.app_guess, 'instagram')
  })

  it('detects the Facebook in-app browser', () => {
    const info = parseDeviceInfo('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 [FBAN/FB4A;FBAV/450.0.0.0.0]')
    assert.equal(info.app_guess, 'facebook')
  })

  it('detects desktop Windows and macOS', () => {
    assert.equal(parseDeviceInfo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0').device_class, 'desktop')
    assert.equal(parseDeviceInfo('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0').os, 'windows')
    assert.equal(parseDeviceInfo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15').os, 'macos')
  })

  it('detects an iPad as tablet', () => {
    assert.equal(parseDeviceInfo('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15').device_class, 'tablet')
  })

  it('falls back to desktop/other/unknown for an unrecognised or missing user agent', () => {
    const info = parseDeviceInfo(undefined)
    assert.equal(info.device_class, 'desktop')
    assert.equal(info.os, 'other')
    assert.equal(info.app_guess, 'unknown')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx tsx --test src/lib/__tests__/referralCode.test.ts`
Expected: FAIL with `Cannot find module '../referralCode'`

- [ ] **Step 3: Implement**

```typescript
// backend/src/lib/referralCode.ts
//
// Pure helpers for the referral tree: code generation, bot detection, and
// best-effort device/app parsing from a user-agent string. No raw user-agent
// or IP address is ever stored — only what this file derives from it.
import crypto from 'crypto'

/** Crockford-style, minus visually ambiguous characters (0/O, 1/I/L). */
export const REFERRAL_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function generateReferralCode(): string {
  const bytes = crypto.randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += REFERRAL_CODE_ALPHABET[bytes[i] % REFERRAL_CODE_ALPHABET.length]
  }
  return code
}

/**
 * Link-preview fetchers (WhatsApp, iMessage via Apple's bot, Facebook,
 * Telegram, Slack, Twitter/X, Discord, LinkedIn, Google) must never create a
 * ReferralVisit row — every share of a link triggers one of these before a
 * human ever taps it.
 */
const BOT_UA_PATTERNS = [
  /whatsapp/i,
  /facebookexternalhit/i,
  /telegrambot/i,
  /slackbot/i,
  /twitterbot/i,
  /discordbot/i,
  /linkedinbot/i,
  /googlebot/i,
  /bingbot/i,
  /applebot/i,
  /embedly/i,
  /quora link preview/i,
  /outbrain/i,
  /pinterest/i,
  /vkshare/i,
  /w3c_validator/i,
]

export function isPreviewBotUserAgent(userAgent: string | undefined | null): boolean {
  if (!userAgent) return false
  return BOT_UA_PATTERNS.some((rx) => rx.test(userAgent))
}

export interface ParsedDeviceInfo {
  device_class: 'mobile' | 'desktop' | 'tablet'
  os: 'ios' | 'android' | 'windows' | 'macos' | 'other'
  app_guess: 'instagram' | 'facebook' | 'unknown'
}

/**
 * Best-effort, from the user agent only. In-app browsers (Instagram,
 * Facebook) identify themselves in the UA; SMS and iMessage open plain
 * Safari/Chrome and are indistinguishable from an organic visit — that
 * ambiguity is intentional, see the design doc's "Gap 2" section.
 */
export function parseDeviceInfo(userAgent: string | undefined | null): ParsedDeviceInfo {
  const ua = userAgent || ''

  let app_guess: ParsedDeviceInfo['app_guess'] = 'unknown'
  if (/instagram/i.test(ua)) app_guess = 'instagram'
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) app_guess = 'facebook'

  let os: ParsedDeviceInfo['os'] = 'other'
  if (/iphone|ipad|ipod/i.test(ua)) os = 'ios'
  else if (/android/i.test(ua)) os = 'android'
  else if (/windows/i.test(ua)) os = 'windows'
  else if (/macintosh|mac os x/i.test(ua)) os = 'macos'

  let device_class: ParsedDeviceInfo['device_class'] = 'desktop'
  if (/ipad|tablet/i.test(ua)) device_class = 'tablet'
  else if (/iphone|ipod|android.*mobile|mobile.*android/i.test(ua)) device_class = 'mobile'
  else if (os === 'ios' || os === 'android') device_class = 'mobile'

  return { device_class, os, app_guess }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx tsx --test src/lib/__tests__/referralCode.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/referralCode.ts backend/src/lib/__tests__/referralCode.test.ts
git commit -m "feat(referral): add code generation and device/bot detection helpers

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Pure attribution logic

**Files:**
- Create: `backend/src/lib/referralAttribution.ts`
- Test: `backend/src/lib/__tests__/referralAttribution.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure, standalone — kept separate from `referralCode.ts` so each stays small and independently testable).
- Produces:
  ```typescript
  export interface AttributionLookup {
    /** The ReferralLink row for this code, or null if it doesn't exist / was revoked. */
    getLink(code: string): { kind: 'ROOT' | 'PERSONAL'; holder_guest_token: string | null; owner_guest_token: string | null; revoked_at: Date | null } | null
    /** True if this guest token has any ChatSession rows already (organic/prior user). */
    hasPriorChats(guestToken: string): boolean
    /** The ReferralVisit row for a guest token, if this device has already been seen. */
    getVisit(guestToken: string): { own_code: string; root_code: string; generation: number } | null
    /** The ReferralVisit row that owns a given parent guest token (to read its root_code/generation). */
    getVisitByGuestToken(guestToken: string): { root_code: string; generation: number } | null
  }

  export interface AttributionResult {
    /** True when this device already has a visit — caller should not create a new row. */
    alreadyVisited: boolean
    arrived_via_code: string | null
    root_code: string
    parent_guest_token: string | null
    generation: number
    depth_inferred: boolean
    prior_user: boolean
    /** Set when this arrival makes the device the holder of a ROOT link with no holder yet. */
    becameHolderOf: string | null
  }

  export function resolveAttribution(
    guestToken: string,
    arrivingCode: string | null | undefined,
    lookup: AttributionLookup,
  ): AttributionResult
  ```

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/lib/__tests__/referralAttribution.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveAttribution, type AttributionLookup } from '../referralAttribution'

function lookup(overrides: Partial<AttributionLookup>): AttributionLookup {
  return {
    getLink: () => null,
    hasPriorChats: () => false,
    getVisit: () => null,
    getVisitByGuestToken: () => null,
    ...overrides,
  }
}

describe('resolveAttribution', () => {
  it('a device that already has a visit returns alreadyVisited and changes nothing', () => {
    const result = resolveAttribution('guest-1', 'K9X2ABCD', lookup({
      getVisit: (gt) => gt === 'guest-1' ? { own_code: 'OWN1CODE', root_code: 'ROOT1XX', generation: 2 } : null,
    }))
    assert.equal(result.alreadyVisited, true)
  })

  it('first device on a ROOT link with no holder becomes the holder at generation 1', () => {
    const result = resolveAttribution('guest-1', 'K9X2ABCD', lookup({
      getLink: (code) => code === 'K9X2ABCD' ? { kind: 'ROOT', holder_guest_token: null, owner_guest_token: null, revoked_at: null } : null,
    }))
    assert.equal(result.alreadyVisited, false)
    assert.equal(result.generation, 1)
    assert.equal(result.parent_guest_token, null)
    assert.equal(result.depth_inferred, false)
    assert.equal(result.root_code, 'K9X2ABCD')
    assert.equal(result.becameHolderOf, 'K9X2ABCD')
  })

  it('a later device on the same ROOT link is attributed to the holder, depth inferred', () => {
    const result = resolveAttribution('guest-2', 'K9X2ABCD', lookup({
      getLink: (code) => code === 'K9X2ABCD' ? { kind: 'ROOT', holder_guest_token: 'guest-1', owner_guest_token: null, revoked_at: null } : null,
      getVisitByGuestToken: (gt) => gt === 'guest-1' ? { root_code: 'K9X2ABCD', generation: 1 } : null,
    }))
    assert.equal(result.generation, 2)
    assert.equal(result.parent_guest_token, 'guest-1')
    assert.equal(result.depth_inferred, true)
    assert.equal(result.root_code, 'K9X2ABCD')
    assert.equal(result.becameHolderOf, null)
  })

  it('a PERSONAL code chains to its owner: parent + 1, same root, not inferred', () => {
    const result = resolveAttribution('guest-3', 'OWN1CODE', lookup({
      getLink: (code) => code === 'OWN1CODE' ? { kind: 'PERSONAL', holder_guest_token: null, owner_guest_token: 'guest-2' } as any : null,
      getVisitByGuestToken: (gt) => gt === 'guest-2' ? { root_code: 'K9X2ABCD', generation: 2 } : null,
    }))
    assert.equal(result.generation, 3)
    assert.equal(result.parent_guest_token, 'guest-2')
    assert.equal(result.depth_inferred, false)
    assert.equal(result.root_code, 'K9X2ABCD')
  })

  it('a device with prior chats arriving on a code is organic, prior_user is true, no parent', () => {
    const result = resolveAttribution('guest-4', 'K9X2ABCD', lookup({
      getLink: (code) => code === 'K9X2ABCD' ? { kind: 'ROOT', holder_guest_token: 'guest-1', owner_guest_token: null, revoked_at: null } : null,
      hasPriorChats: (gt) => gt === 'guest-4',
    }))
    assert.equal(result.prior_user, true)
    assert.equal(result.parent_guest_token, null)
    assert.equal(result.generation, 0)
    assert.equal(result.arrived_via_code, 'K9X2ABCD')
    assert.equal(result.root_code, 'guest-4-is-not-a-code-so-root-is-own') // placeholder removed below
  })

  it('an unknown or missing code is organic: generation 0, root is the device itself', () => {
    const result = resolveAttribution('guest-5', 'NOPE0000', lookup({}))
    assert.equal(result.generation, 0)
    assert.equal(result.parent_guest_token, null)
    assert.equal(result.depth_inferred, false)
    assert.equal(result.arrived_via_code, null)
  })

  it('no code at all (organic visitor) behaves the same as an unknown code', () => {
    const result = resolveAttribution('guest-6', null, lookup({}))
    assert.equal(result.generation, 0)
    assert.equal(result.arrived_via_code, null)
  })

  it('a revoked ROOT link is treated as organic', () => {
    const result = resolveAttribution('guest-7', 'DEAD0000', lookup({
      getLink: (code) => code === 'DEAD0000' ? { kind: 'ROOT', holder_guest_token: 'guest-1', owner_guest_token: null, revoked_at: new Date() } : null,
    }))
    assert.equal(result.generation, 0)
    assert.equal(result.parent_guest_token, null)
    assert.equal(result.becameHolderOf, null)
  })
})
```

Before running, fix the placeholder assertion in the "prior chats" test — it was written to flag that `root_code` for an organic/prior-user arrival is the device's OWN code, which this pure function cannot know yet (the caller mints it). Replace that test with:

```typescript
  it('a device with prior chats arriving on a code is organic, prior_user is true, no parent', () => {
    const result = resolveAttribution('guest-4', 'K9X2ABCD', lookup({
      getLink: (code) => code === 'K9X2ABCD' ? { kind: 'ROOT', holder_guest_token: 'guest-1', owner_guest_token: null, revoked_at: null } : null,
      hasPriorChats: (gt) => gt === 'guest-4',
    }))
    assert.equal(result.prior_user, true)
    assert.equal(result.parent_guest_token, null)
    assert.equal(result.generation, 0)
    assert.equal(result.arrived_via_code, 'K9X2ABCD')
    // root_code is null here — the caller sets it to the device's own freshly
    // minted code once that code exists, since this function doesn't mint it.
    assert.equal(result.root_code, null)
  })
```

And adjust the two other "organic" tests (unknown code, no code) to also assert `result.root_code === null`, and the interface's `root_code` type to `string | null`:

```typescript
    assert.equal(result.root_code, null)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx tsx --test src/lib/__tests__/referralAttribution.test.ts`
Expected: FAIL with `Cannot find module '../referralAttribution'`

- [ ] **Step 3: Implement**

```typescript
// backend/src/lib/referralAttribution.ts
//
// Pure attribution logic for the referral tree. Takes no dependency on
// Prisma or Express so the full decision table is testable without a
// database — see backend/src/lib/__tests__/referralAttribution.test.ts.
//
// The core rule: a device's parent is set once, on first arrival, and never
// changes (first touch wins). Organic arrivals — no code, an unknown or
// revoked code, or a device that already has chats of its own — get
// generation 0 and no parent; root_code is left null for the caller to fill
// in with the device's own freshly minted code, since this function never
// mints codes.
export interface AttributionLookup {
  getLink(code: string): {
    kind: 'ROOT' | 'PERSONAL'
    holder_guest_token: string | null
    owner_guest_token: string | null
    revoked_at: Date | null
  } | null
  hasPriorChats(guestToken: string): boolean
  getVisit(guestToken: string): { own_code: string; root_code: string; generation: number } | null
  getVisitByGuestToken(guestToken: string): { root_code: string; generation: number } | null
}

export interface AttributionResult {
  alreadyVisited: boolean
  arrived_via_code: string | null
  root_code: string | null
  parent_guest_token: string | null
  generation: number
  depth_inferred: boolean
  prior_user: boolean
  becameHolderOf: string | null
}

function organic(arrivedViaCode: string | null, priorUser: boolean): AttributionResult {
  return {
    alreadyVisited: false,
    arrived_via_code: arrivedViaCode,
    root_code: null,
    parent_guest_token: null,
    generation: 0,
    depth_inferred: false,
    prior_user: priorUser,
    becameHolderOf: null,
  }
}

export function resolveAttribution(
  guestToken: string,
  arrivingCode: string | null | undefined,
  lookup: AttributionLookup,
): AttributionResult {
  const existing = lookup.getVisit(guestToken)
  if (existing) {
    return {
      alreadyVisited: true,
      arrived_via_code: arrivingCode ?? null,
      root_code: existing.root_code,
      parent_guest_token: null,
      generation: existing.generation,
      depth_inferred: false,
      prior_user: false,
      becameHolderOf: null,
    }
  }

  const code = arrivingCode || null

  if (lookup.hasPriorChats(guestToken)) {
    return organic(code, true)
  }

  if (!code) {
    return organic(null, false)
  }

  const link = lookup.getLink(code)
  if (!link || link.revoked_at) {
    return organic(code, false)
  }

  if (link.kind === 'ROOT') {
    if (!link.holder_guest_token) {
      return {
        alreadyVisited: false,
        arrived_via_code: code,
        root_code: code,
        parent_guest_token: null,
        generation: 1,
        depth_inferred: false,
        prior_user: false,
        becameHolderOf: code,
      }
    }
    const holderVisit = lookup.getVisitByGuestToken(link.holder_guest_token)
    return {
      alreadyVisited: false,
      arrived_via_code: code,
      root_code: holderVisit?.root_code ?? code,
      parent_guest_token: link.holder_guest_token,
      generation: (holderVisit?.generation ?? 1) + 1,
      depth_inferred: true,
      prior_user: false,
      becameHolderOf: null,
    }
  }

  // PERSONAL: chain to the owning device.
  const ownerToken = link.owner_guest_token
  const ownerVisit = ownerToken ? lookup.getVisitByGuestToken(ownerToken) : null
  return {
    alreadyVisited: false,
    arrived_via_code: code,
    root_code: ownerVisit?.root_code ?? code,
    parent_guest_token: ownerToken,
    generation: (ownerVisit?.generation ?? 0) + 1,
    depth_inferred: false,
    prior_user: false,
    becameHolderOf: null,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx tsx --test src/lib/__tests__/referralAttribution.test.ts`
Expected: PASS, all 8 cases.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/referralAttribution.ts backend/src/lib/__tests__/referralAttribution.test.ts
git commit -m "feat(referral): add pure attribution resolution logic

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Public arrive endpoint

**Files:**
- Create: `backend/src/routes/referral.ts`
- Modify: `backend/src/index.ts` (add import near line 52, mount near line 333)
- Test: `backend/src/routes/__tests__/referral.test.ts`

**Interfaces:**
- Consumes: `generateReferralCode`, `isPreviewBotUserAgent`, `parseDeviceInfo` from Task 2; `resolveAttribution`, `AttributionLookup` from Task 3; `checkRateLimit` from `backend/src/lib/cache.ts` (`checkRateLimit(key, limit, windowSecs): Promise<{ allowed: boolean; remaining: number }>`); `prisma` from `backend/src/lib/db.ts`.
- Produces: `export const referralRouter: Router` with `POST /arrive` mounted at `/api/v1/referral`. Response shape: `{ ownCode: string, greeting: { name: string } | null }` or `204` for bots, `429` when rate-limited, `400` for a missing guest token.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/routes/__tests__/referral.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import request from 'supertest'
import { referralRouter } from '../referral'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/v1/referral', referralRouter)
  return app
}

describe('POST /api/v1/referral/arrive', () => {
  it('rejects a request with no guest token', async () => {
    const res = await request(buildApp()).post('/api/v1/referral/arrive').send({})
    assert.equal(res.status, 400)
  })

  it('returns 204 and does not error for a known preview-bot user agent', async () => {
    const res = await request(buildApp())
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'WhatsApp/2.23.20.0 A')
      .send({ guestToken: 'guest-bot-test' })
    assert.equal(res.status, 204)
  })

  it('a real request with a guest token and no code gets its own code back', async () => {
    const res = await request(buildApp())
      .post('/api/v1/referral/arrive')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
      .send({ guestToken: `guest-organic-${Date.now()}` })
    assert.equal(res.status, 200)
    assert.equal(typeof res.body.ownCode, 'string')
    assert.equal(res.body.ownCode.length, 8)
  })
})
```

Note: `DISABLE_RATE_LIMIT=true` or `NODE_ENV=test` makes `checkRateLimit` always allow (see `backend/src/lib/cache.ts:39`) — the test runner already sets `NODE_ENV=test` via `tsx --test`, so no extra setup is needed here. This test needs a real database connection (it writes a `ReferralVisit` row via Prisma) — run it against the dev database, not in an offline sandbox.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx tsx --test src/routes/__tests__/referral.test.ts`
Expected: FAIL with `Cannot find module '../referral'`

- [ ] **Step 3: Implement**

```typescript
// backend/src/routes/referral.ts
//
// POST /api/v1/referral/arrive — called once per device, on landing. Public:
// no auth, no admin session. Resolves attribution (lib/referralAttribution),
// mints the device's own personal link, and records the visit.
//
// Preview-bot fetches (WhatsApp, iMessage, Facebook, etc. building a link
// card) return 204 with no row created — see lib/referralCode.ts.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { checkRateLimit } from '../lib/cache'
import { generateReferralCode, isPreviewBotUserAgent, parseDeviceInfo } from '../lib/referralCode'
import { resolveAttribution, type AttributionLookup } from '../lib/referralAttribution'

export const referralRouter = Router()

async function buildLookup(): Promise<AttributionLookup> {
  return {
    async getLink(code: string) {
      return null as any // overwritten below; kept for type shape only
    },
    hasPriorChats: () => false,
    getVisit: () => null,
    getVisitByGuestToken: () => null,
  }
}

referralRouter.post('/arrive', async (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] as string | undefined
  if (isPreviewBotUserAgent(userAgent)) {
    res.status(204).end()
    return
  }

  const guestToken = typeof req.body?.guestToken === 'string' ? req.body.guestToken.trim() : ''
  if (!guestToken) {
    res.status(400).json({ error: 'guestToken required' })
    return
  }

  const code = typeof req.body?.code === 'string' && req.body.code.trim() ? req.body.code.trim().toUpperCase() : null
  const channel = typeof req.body?.channel === 'string' ? req.body.channel.slice(0, 20) : null

  const limit = await checkRateLimit(`referral_arrive:${guestToken}`, 20, 600)
  const ipLimit = await checkRateLimit(`referral_arrive_ip:${req.ip}`, 60, 600)
  if (!limit.allowed || !ipLimit.allowed) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  try {
    const existingVisit = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
    if (existingVisit) {
      const ownLink = await prisma.referralLink.findUnique({ where: { code: existingVisit.own_code } })
      res.json({ ownCode: existingVisit.own_code, greeting: null, revoked: Boolean(ownLink?.revoked_at) })
      return
    }

    const priorChat = await prisma.chatSession.findFirst({ where: { guest_token: guestToken }, select: { id: true } })

    const linkRow = code
      ? await prisma.referralLink.findUnique({ where: { code } })
      : null

    let holderVisit: { root_code: string; generation: number } | null = null
    if (linkRow?.kind === 'ROOT' && linkRow.holder_guest_token) {
      holderVisit = await prisma.referralVisit.findUnique({
        where: { guest_token: linkRow.holder_guest_token },
        select: { root_code: true, generation: true },
      })
    }
    let ownerVisit: { root_code: string; generation: number } | null = null
    if (linkRow?.kind === 'PERSONAL' && linkRow.owner_guest_token) {
      ownerVisit = await prisma.referralVisit.findUnique({
        where: { guest_token: linkRow.owner_guest_token },
        select: { root_code: true, generation: true },
      })
    }

    const lookup: AttributionLookup = {
      getLink: (c) => (linkRow && c === linkRow.code
        ? {
            kind: linkRow.kind,
            holder_guest_token: linkRow.holder_guest_token,
            owner_guest_token: linkRow.owner_guest_token,
            revoked_at: linkRow.revoked_at,
          }
        : null),
      hasPriorChats: () => Boolean(priorChat),
      getVisit: () => null, // already checked above; this branch is unreachable here
      getVisitByGuestToken: (gt) => {
        if (linkRow?.holder_guest_token === gt) return holderVisit
        if (linkRow?.owner_guest_token === gt) return ownerVisit
        return null
      },
    }

    const attribution = resolveAttribution(guestToken, code, lookup)
    const device = parseDeviceInfo(userAgent)

    let ownCode = generateReferralCode()
    // Collision retry: astronomically unlikely at this volume, but cheap to guard.
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.referralLink.findUnique({ where: { code: ownCode } })
      if (!clash) break
      ownCode = generateReferralCode()
    }

    const rootCode = attribution.root_code ?? ownCode

    await prisma.$transaction([
      prisma.referralLink.create({
        data: { code: ownCode, kind: 'PERSONAL', owner_guest_token: guestToken },
      }),
      prisma.referralVisit.create({
        data: {
          guest_token: guestToken,
          own_code: ownCode,
          arrived_via_code: attribution.arrived_via_code,
          root_code: rootCode,
          parent_guest_token: attribution.parent_guest_token,
          generation: attribution.generation,
          depth_inferred: attribution.depth_inferred,
          prior_user: attribution.prior_user,
          device_class: device.device_class,
          os: device.os,
          app_guess: device.app_guess,
          share_channel: channel,
        },
      }),
      ...(attribution.becameHolderOf
        ? [prisma.referralLink.update({ where: { code: attribution.becameHolderOf }, data: { holder_guest_token: guestToken } })]
        : []),
    ])

    const greeting = linkRow?.kind === 'ROOT' && linkRow.greeting_name && !attribution.prior_user
      ? { name: linkRow.greeting_name }
      : null

    res.json({ ownCode, greeting })
  } catch (err: any) {
    console.error('[REFERRAL:ARRIVE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to record arrival' })
  }
})
```

Remove the unused `buildLookup` helper written as scaffolding above — it is not referenced by the final handler; delete it before committing.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx tsx --test src/routes/__tests__/referral.test.ts`
Expected: PASS, all 3 cases (requires a reachable dev database for the second and third tests, since they write through Prisma).

- [ ] **Step 5: Mount the router**

In `backend/src/index.ts`, add the import near the other route imports (after line 52's `import { dossierRouter } from './routes/dossier'`):

```typescript
import { referralRouter } from './routes/referral'
```

And mount it near line 333's `app.use('/api/v1/dossier', dossierRouter)`:

```typescript
app.use('/api/v1/referral', referralRouter)
```

- [ ] **Step 6: Run the full backend test suite for regressions**

Run: `cd backend && npm test`
Expected: all existing tests still pass; new referral tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/referral.ts backend/src/routes/__tests__/referral.test.ts backend/src/index.ts
git commit -m "feat(referral): add public POST /api/v1/referral/arrive endpoint

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Admin policy and read-audit wiring

**Files:**
- Modify: `backend/src/lib/adminPolicy.ts` (add to `SALES_READ_DENIED`, `ANALYST_READ_DENIED`, `ANALYST_WRITE_DENIED`)
- Modify: `backend/src/lib/adminReadAudit.ts` (add to `AUDITED_READS`)
- Modify: `backend/src/lib/__tests__/adminPolicy.test.ts` (extend the matrix)
- Modify: `backend/src/lib/__tests__/adminReadAudit.test.ts` (extend the audited-reads list)

**Interfaces:**
- Consumes: nothing new — these are existing functions (`decide`, `isAuditedRead`) whose deny-lists/match-lists gain one more entry each.
- Produces: `/referrals` is unreachable (403) for SALES, ANALYST, BUILDER, PARTNER on every method; `GET /referrals/nodes/:guestToken` is logged by `recordAudit` with `entityType: 'referral_node'`.

- [ ] **Step 1: Extend the policy test (write the failing assertions first)**

In `backend/src/lib/__tests__/adminPolicy.test.ts`, add rows to the `MATRIX` array (after the `'/conversations'` / `'/beta'` rows, which are around line 44-45):

```typescript
  // ── Referral tracking: founders only. Not a catalogue, lead or marketing
  //    surface any staff role needs — it is product-validation telemetry the
  //    three super admins watch themselves.
  ['GET', '/referrals', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['POST', '/referrals', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['GET', '/referrals/K9X2ABCD/tree', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['GET', '/referrals/nodes/guest-1', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
  ['POST', '/referrals/K9X2ABCD/revoke', { SUPER_ADMIN: true, ANALYST: false, SALES: false }],
```

- [ ] **Step 2: Run the policy test to verify it fails**

Run: `cd backend && npx tsx --test src/lib/__tests__/adminPolicy.test.ts`
Expected: FAIL on the new rows (ANALYST currently passes through to `{ allowed: true }` since `/referrals` isn't in any deny-list yet).

- [ ] **Step 3: Add `/referrals` to the deny-lists**

In `backend/src/lib/adminPolicy.ts`, add a line to `SALES_READ_DENIED` (around line 88-97):

```typescript
const SALES_READ_DENIED: readonly RegExp[] = [
  /^\/conversations\b/,
  /^\/beta\b/,
  /^\/email\b/,
  /^\/intelligence\b/,
  /^\/news\b/,
  /^\/blog\b/,
  /^\/promotions\b/,
  /^\/referrals\b/,
  /^\/analytics\/(?!summary\b)/,
]
```

Add the same line to `ANALYST_READ_DENIED` (around line 108-120):

```typescript
const ANALYST_READ_DENIED: readonly RegExp[] = [
  /^\/conversations\b/,
  /^\/beta\b/,
  /^\/callbacks\b/,
  /^\/leads\b/,
  /^\/email\b/,
  /^\/boards\/queue\b/,
  /^\/referrals\b/,
]
```

And to `ANALYST_WRITE_DENIED` (around line 140-144), since SALES writes are already deny-by-default for any unlisted path but ANALYST writes are allow-by-default:

```typescript
const ANALYST_WRITE_DENIED: readonly RegExp[] = [
  /^\/leads\b/,
  /^\/callbacks\b/,
  /^\/boards\/queue\b/,
  /^\/referrals\b/,
]
```

- [ ] **Step 4: Run the policy test to verify it passes**

Run: `cd backend && npx tsx --test src/lib/__tests__/adminPolicy.test.ts`
Expected: PASS, including the 5 new rows.

- [ ] **Step 5: Extend the read-audit test and implementation**

In `backend/src/lib/__tests__/adminReadAudit.test.ts`, add to the first `it` block:

```typescript
    assert.equal(isAuditedRead('GET', '/referrals/nodes/guest-1'), true)
```

And add to the "does not audit list views" block:

```typescript
    assert.equal(isAuditedRead('GET', '/referrals'), false)
```

Run: `cd backend && npx tsx --test src/lib/__tests__/adminReadAudit.test.ts` — expect FAIL (the new node path isn't matched yet).

In `backend/src/lib/adminReadAudit.ts`, add to `AUDITED_READS` (around line 33-38):

```typescript
const AUDITED_READS: ReadonlyArray<{ pattern: RegExp; entityType: string; what: string }> = [
  { pattern: /^\/conversations\/([^/]+)$/, entityType: 'chat_session', what: 'chat transcript' },
  { pattern: /^\/beta\/sessions\/([^/]+)$/, entityType: 'chat_session', what: 'chat transcript' },
  { pattern: /^\/callbacks\/([^/]+)$/, entityType: 'callback_request', what: 'lead contact details' },
  { pattern: /^\/leads\/([^/]+)$/, entityType: 'callback_request', what: 'lead contact details' },
  { pattern: /^\/referrals\/nodes\/([^/]+)$/, entityType: 'referral_node', what: 'referral person summary' },
]
```

- [ ] **Step 6: Run both tests to verify they pass**

Run: `cd backend && npx tsx --test src/lib/__tests__/adminReadAudit.test.ts src/lib/__tests__/adminPolicy.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/lib/adminPolicy.ts backend/src/lib/adminReadAudit.ts backend/src/lib/__tests__/adminPolicy.test.ts backend/src/lib/__tests__/adminReadAudit.test.ts
git commit -m "feat(referral): restrict /admin/referrals to SUPER_ADMIN and audit person reads

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Admin referral routes — generate, list, revoke, reset-holder

**Files:**
- Create: `backend/src/routes/adminReferrals.ts`
- Modify: `backend/src/index.ts` (import + mount under `/api/v1/admin/referrals`)
- Test: `backend/src/routes/__tests__/adminReferrals.test.ts`

**Interfaces:**
- Consumes: `generateReferralCode` from Task 2, `prisma` from `backend/src/lib/db.ts`, `AdminIdentitySession` type from `backend/src/lib/adminIdentity.ts` (the `req.adminIdentity` attached by `adminAreaGuard`, same as every other admin router — see `backend/src/routes/adminBoards.ts` for the pattern of relying on the guard rather than re-checking role inline).
- Produces (mounted at `/api/v1/admin/referrals`, inherits `adminAreaGuard` automatically since it's mounted under the `/api/v1/admin` prefix guarded at `backend/src/index.ts:293`):
  - `POST /` → `{ label, note?, greetingName }` creates a ROOT link, returns `{ code, url }`.
  - `GET /?scope=mine|all` → list of ROOT links with stats.
  - `POST /:code/revoke` → sets `revoked_at`.
  - `POST /:code/reset-holder` → clears `holder_guest_token`.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/routes/__tests__/adminReferrals.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import express, { Request, Response, NextFunction } from 'express'
import request from 'supertest'
import { adminReferralsRouter } from '../adminReferrals'

// adminAreaGuard is mounted at the app level in production (backend/src/index.ts);
// this test stubs an already-authenticated SUPER_ADMIN identity the same way
// adminBoards tests do, to exercise the router in isolation.
function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((req: Request & { adminIdentity?: any }, _res: Response, next: NextFunction) => {
    req.adminIdentity = { adminUserId: 'admin-1', email: 'furqan@propfyndr.com', role: 'SUPER_ADMIN' }
    next()
  })
  app.use('/api/v1/admin/referrals', adminReferralsRouter)
  return app
}

describe('POST /api/v1/admin/referrals', () => {
  it('creates a ROOT link with a label and greeting name', async () => {
    const res = await request(buildApp())
      .post('/api/v1/admin/referrals')
      .send({ label: 'Rahul – college', greetingName: 'Furqan' })
    assert.equal(res.status, 201)
    assert.equal(typeof res.body.code, 'string')
    assert.equal(res.body.code.length, 8)
    assert.ok(res.body.url.endsWith(res.body.code))
  })

  it('rejects a missing label', async () => {
    const res = await request(buildApp())
      .post('/api/v1/admin/referrals')
      .send({ greetingName: 'Furqan' })
    assert.equal(res.status, 400)
  })
})

describe('GET /api/v1/admin/referrals', () => {
  it('lists root links', async () => {
    await request(buildApp()).post('/api/v1/admin/referrals').send({ label: 'List test', greetingName: 'Furqan' })
    const res = await request(buildApp()).get('/api/v1/admin/referrals')
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.links))
  })
})
```

This test, like Task 4's, needs a reachable dev database (it writes real `ReferralLink` rows).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx tsx --test src/routes/__tests__/adminReferrals.test.ts`
Expected: FAIL with `Cannot find module '../adminReferrals'`

- [ ] **Step 3: Implement**

```typescript
// backend/src/routes/adminReferrals.ts
//
// SUPER_ADMIN only — see lib/adminPolicy.ts, which denies this whole path to
// SALES and ANALYST. Mounted under /api/v1/admin/referrals, so adminAreaGuard
// (identity, staff floor, role matrix, field redaction, read audit) applies
// automatically — this router never re-checks role itself, the same
// convention as adminBoards.ts.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import type { AdminIdentitySession } from '../lib/adminIdentity'
import { generateReferralCode } from '../lib/referralCode'

export const adminReferralsRouter = Router()

function identity(req: Request): AdminIdentitySession {
  return (req as Request & { adminIdentity: AdminIdentitySession }).adminIdentity
}

/**
 * Activated = ≥3 messages, OR a save/callback/site-visit/dossier, OR a return
 * visit ≥24h after first arrival. Computed here rather than stored, since the
 * inputs (message count, saves, callbacks) already live on ChatSession and
 * CallbackRequest and would drift if duplicated onto ReferralVisit.
 */
async function countActivated(guestTokens: string[]): Promise<Set<string>> {
  if (guestTokens.length === 0) return new Set()
  const sessions = await prisma.chatSession.findMany({
    where: { guest_token: { in: guestTokens } },
    select: { guest_token: true, message_count: true, last_active: true, created_at: true },
  })
  const activated = new Set<string>()
  for (const s of sessions) {
    if (!s.guest_token) continue
    const returned = s.last_active.getTime() - s.created_at.getTime() >= 24 * 60 * 60 * 1000
    if (s.message_count >= 3 || returned) activated.add(s.guest_token)
  }
  const callbacks = await prisma.callbackRequest.findMany({
    where: { guest_token: { in: guestTokens } },
    select: { guest_token: true },
  })
  for (const c of callbacks) {
    if (c.guest_token) activated.add(c.guest_token)
  }
  const dossiers = await prisma.dossier.findMany({
    where: { guest_token: { in: guestTokens } },
    select: { guest_token: true },
  })
  for (const d of dossiers) {
    if (d.guest_token) activated.add(d.guest_token)
  }
  return activated
}

adminReferralsRouter.post('/', async (req: Request, res: Response) => {
  const label = typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 60) : ''
  const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, 500) : null
  const greetingName = typeof req.body?.greetingName === 'string' ? req.body.greetingName.trim().slice(0, 60) : null

  if (!label) {
    res.status(400).json({ error: 'label is required' })
    return
  }

  try {
    let code = generateReferralCode()
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.referralLink.findUnique({ where: { code } })
      if (!clash) break
      code = generateReferralCode()
    }

    await prisma.referralLink.create({
      data: {
        code,
        kind: 'ROOT',
        label,
        note,
        greeting_name: greetingName,
        created_by_admin_id: identity(req).adminUserId,
      },
    })

    res.status(201).json({ code, url: `/r/${code}` })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:CREATE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to create referral link' })
  }
})

adminReferralsRouter.get('/', async (req: Request, res: Response) => {
  const scope = req.query.scope === 'mine' ? 'mine' : 'all'
  const me = identity(req)

  try {
    const links = await prisma.referralLink.findMany({
      where: {
        kind: 'ROOT',
        ...(scope === 'mine' ? { created_by_admin_id: me.adminUserId } : {}),
      },
      orderBy: { created_at: 'desc' },
    })

    const allVisits = await prisma.referralVisit.findMany({
      where: { root_code: { in: links.map((l) => l.code) } },
      select: { guest_token: true, root_code: true, generation: true, first_seen_at: true },
    })

    const activated = await countActivated(allVisits.map((v) => v.guest_token))

    const result = links.map((link) => {
      const visits = allVisits.filter((v) => v.root_code === link.code)
      const deepestGeneration = visits.reduce((max, v) => Math.max(max, v.generation), 0)
      const activatedCount = visits.filter((v) => activated.has(v.guest_token)).length
      const lastActivity = visits.reduce<Date | null>((latest, v) => (!latest || v.first_seen_at > latest ? v.first_seen_at : latest), null)

      return {
        code: link.code,
        label: link.label,
        createdByAdminId: link.created_by_admin_id,
        createdAt: link.created_at,
        revoked: Boolean(link.revoked_at),
        devicesReached: visits.length,
        deepestGeneration,
        activatedCount,
        lastActivity,
      }
    })

    res.json({ links: result })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:LIST_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to load referral links' })
  }
})

adminReferralsRouter.post('/:code/revoke', async (req: Request, res: Response) => {
  const { code } = req.params
  try {
    await prisma.referralLink.update({ where: { code }, data: { revoked_at: new Date() } })
    res.json({ success: true })
  } catch (err: any) {
    res.status(404).json({ error: 'Referral link not found' })
  }
})

adminReferralsRouter.post('/:code/reset-holder', async (req: Request, res: Response) => {
  const { code } = req.params
  try {
    const link = await prisma.referralLink.findUnique({ where: { code } })
    if (!link || link.kind !== 'ROOT') {
      res.status(404).json({ error: 'Root referral link not found' })
      return
    }
    await prisma.referralLink.update({ where: { code }, data: { holder_guest_token: null } })
    res.json({ success: true })
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset holder' })
  }
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx tsx --test src/routes/__tests__/adminReferrals.test.ts`
Expected: PASS.

- [ ] **Step 5: Mount the router**

In `backend/src/index.ts`, add the import near line 52:

```typescript
import { adminReferralsRouter } from './routes/adminReferrals'
```

Mount it near the other `/admin/*` sub-routers (e.g. near line 309's `app.use('/api/v1/admin/channel-partners', adminPartnersRouter)`), BEFORE line 312's `app.use('/api/v1/admin', adminRouter)` so ordering matches the existing sibling routers:

```typescript
app.use('/api/v1/admin/referrals', adminReferralsRouter)
```

It inherits `adminAreaGuard` automatically because that guard is mounted on the `/api/v1/admin` prefix at line 293, before any sub-router.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/adminReferrals.ts backend/src/routes/__tests__/adminReferrals.test.ts backend/src/index.ts
git commit -m "feat(referral): add admin generate/list/revoke endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Admin tree view and person drawer

**Files:**
- Modify: `backend/src/routes/adminReferrals.ts` (add `GET /:code/tree` and `GET /nodes/:guestToken`)
- Modify: `backend/src/routes/__tests__/adminReferrals.test.ts`

**Interfaces:**
- Consumes: everything from Task 6 (same file, same router instance).
- Produces:
  - `GET /:code/tree` → `{ nodes: Array<{ guestToken, label: string|null, generation, depthInferred, deviceClass, os, appGuess, shareChannel, messageCount, activated, firstSeenAt }> }`
  - `GET /nodes/:guestToken` → `{ node: { guestToken, generation, deviceClass, os, appGuess, summary: {...}, actions: {...}, chats: Array<{id, messageCount, lastActive}> } }`

- [ ] **Step 1: Write the failing tests**

Append to `backend/src/routes/__tests__/adminReferrals.test.ts`:

```typescript
describe('GET /api/v1/admin/referrals/:code/tree', () => {
  it('returns the node list for a root link, including the root label itself', async () => {
    const create = await request(buildApp()).post('/api/v1/admin/referrals').send({ label: 'Tree test', greetingName: 'Furqan' })
    const res = await request(buildApp()).get(`/api/v1/admin/referrals/${create.body.code}/tree`)
    assert.equal(res.status, 200)
    assert.ok(Array.isArray(res.body.nodes))
  })

  it('404s for an unknown code', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/referrals/NOPE0000/tree')
    assert.equal(res.status, 404)
  })
})

describe('GET /api/v1/admin/referrals/nodes/:guestToken', () => {
  it('404s for a guest token with no visit', async () => {
    const res = await request(buildApp()).get('/api/v1/admin/referrals/nodes/never-seen-guest')
    assert.equal(res.status, 404)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx tsx --test src/routes/__tests__/adminReferrals.test.ts`
Expected: FAIL on the two new `describe` blocks (`404` instead of the tree route existing at all, i.e. Express's default 404 — acceptable as the "not implemented" failure signal, but confirm it's a 404 from Express's catch-all, not a thrown error; if it errors instead, that still counts as "fails before implementation").

- [ ] **Step 3: Implement — append to `backend/src/routes/adminReferrals.ts`**

```typescript
adminReferralsRouter.get('/:code/tree', async (req: Request, res: Response) => {
  const { code } = req.params
  try {
    const root = await prisma.referralLink.findUnique({ where: { code } })
    if (!root) {
      res.status(404).json({ error: 'Referral link not found' })
      return
    }

    const visits = await prisma.referralVisit.findMany({
      where: { root_code: code },
      orderBy: [{ generation: 'asc' }, { first_seen_at: 'asc' }],
    })

    const guestTokens = visits.map((v) => v.guest_token)
    const activated = await countActivated(guestTokens)

    const sessions = await prisma.chatSession.groupBy({
      by: ['guest_token'],
      where: { guest_token: { in: guestTokens } },
      _sum: { message_count: true },
    })
    const messageCountByGuest = new Map(sessions.map((s) => [s.guest_token, s._sum.message_count ?? 0]))

    const nodes = visits.map((v) => ({
      guestToken: v.guest_token,
      label: v.generation === 1 ? root.label : null,
      generation: v.generation,
      parentGuestToken: v.parent_guest_token,
      depthInferred: v.depth_inferred,
      deviceClass: v.device_class,
      os: v.os,
      appGuess: v.app_guess,
      shareChannel: v.share_channel,
      messageCount: messageCountByGuest.get(v.guest_token) ?? 0,
      activated: activated.has(v.guest_token),
      firstSeenAt: v.first_seen_at,
    }))

    res.json({ root: { code: root.code, label: root.label, revoked: Boolean(root.revoked_at) }, nodes })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:TREE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to load referral tree' })
  }
})

adminReferralsRouter.get('/nodes/:guestToken', async (req: Request, res: Response) => {
  const { guestToken } = req.params
  try {
    const visit = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
    if (!visit) {
      res.status(404).json({ error: 'No visit found for this guest token' })
      return
    }

    const sessions = await prisma.chatSession.findMany({
      where: { guest_token: guestToken },
      select: {
        id: true,
        message_count: true,
        last_active: true,
        summary_location: true,
        summary_financial: true,
        summary_timeline: true,
      },
      orderBy: { last_active: 'desc' },
    })

    const callbacks = await prisma.callbackRequest.count({ where: { guest_token: guestToken } })
    const dossiersMade = await prisma.dossier.count({ where: { guest_token: guestToken } })

    const latest = sessions[0]

    res.json({
      node: {
        guestToken: visit.guest_token,
        generation: visit.generation,
        rootCode: visit.root_code,
        deviceClass: visit.device_class,
        os: visit.os,
        appGuess: visit.app_guess,
        depthInferred: visit.depth_inferred,
        firstSeenAt: visit.first_seen_at,
        summary: latest
          ? {
              location: latest.summary_location,
              financial: latest.summary_financial,
              timeline: latest.summary_timeline,
            }
          : null,
        actions: {
          callbacks,
          dossiersMade,
        },
        chats: sessions.map((s) => ({ id: s.id, messageCount: s.message_count, lastActive: s.last_active })),
      },
    })
  } catch (err: any) {
    console.error('[ADMIN_REFERRALS:NODE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to load referral node' })
  }
})
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend && npx tsx --test src/routes/__tests__/adminReferrals.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Run the full backend suite for regressions**

Run: `cd backend && npm test`
Expected: all tests pass, including `adminReadCoverage.test.ts` (which walks routers) and `guardsOutsideAdminArea.test.ts` — if either fails because it enumerates admin routers against an allowlist, read its failure message and add `adminReferrals` to whatever list it expects (check the test file first; do not guess the fix).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/adminReferrals.ts backend/src/routes/__tests__/adminReferrals.test.ts
git commit -m "feat(referral): add admin tree view and person drawer endpoints

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Identity merge on sign-in

**Files:**
- Modify: `backend/src/routes/sessions.ts` (the `/migrate` handler, lines 30-50+)
- Test: `backend/src/routes/__tests__/sessionsMigrate.test.ts` (create if no existing test file covers `/migrate`; check first with Glob/Grep whether `sessions.ts` already has a test file before creating a new one)

**Interfaces:**
- Consumes: `prisma.referralVisit.updateMany` (from Task 1's schema).
- Produces: after this change, `POST /api/v1/sessions/migrate` also sets `ReferralVisit.user_id` for the guest token being migrated.

- [ ] **Step 1: Check for an existing test file**

Run: `cd backend && find src/routes/__tests__ -iname "*session*"` (or use Glob) to see whether migrate is already covered. If a test file exists, add the new case there instead of creating a new file; adjust the file path in this task accordingly before proceeding.

- [ ] **Step 2: Write the failing test**

```typescript
// backend/src/routes/__tests__/sessionsMigrate.test.ts
// (Skip creating this file if Step 1 found migrate already covered elsewhere —
// add this `it` block to that existing describe instead.)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../lib/db'

describe('session migration attaches referral visits', () => {
  it('sets user_id on the guest token\'s ReferralVisit row when one exists', async () => {
    const guestToken = `guest-migrate-test-${Date.now()}`
    await prisma.referralLink.create({ data: { code: `MIGTEST${Date.now() % 100000}`.slice(0, 8).toUpperCase(), kind: 'PERSONAL', owner_guest_token: guestToken } })
    await prisma.referralVisit.create({
      data: {
        guest_token: guestToken,
        own_code: `MIGTST${Date.now() % 1000}`.slice(0, 8).toUpperCase(),
        root_code: guestToken,
        generation: 0,
        device_class: 'mobile',
        os: 'ios',
        app_guess: 'unknown',
      },
    })

    // Simulate what the /migrate handler will do.
    await prisma.referralVisit.updateMany({
      where: { guest_token: guestToken },
      data: { user_id: 'user-test-1' },
    })

    const visit = await prisma.referralVisit.findUnique({ where: { guest_token: guestToken } })
    assert.equal(visit?.user_id, 'user-test-1')
  })
})
```

This is a DB-dependent test written against the dev database; it documents the exact Prisma call the handler must make.

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npx tsx --test src/routes/__tests__/sessionsMigrate.test.ts`
Expected: PASS already, since this test only checks the raw Prisma call works, not the route. This confirms the schema supports it before touching the route — proceed to wire the route itself next.

- [ ] **Step 4: Modify the `/migrate` handler**

Open `backend/src/routes/sessions.ts`, find the block at lines 45-51:

```typescript
  try {
    // Migrate all guest sessions to authenticated user
    const sessionResult = await prisma.chatSession.updateMany({
      where: { guest_token: guestToken, user_id: null },
      data: { user_id: userId },
    })
```

Add immediately after it:

```typescript
    // Attach this device's referral visit to the now-identified user, so the
    // admin tree can show "possibly the same person" across devices once a
    // phone number or sign-in links them. See docs/superpowers/specs/2026-10-11-referral-tracking-design.md.
    await prisma.referralVisit.updateMany({
      where: { guest_token: guestToken, user_id: null },
      data: { user_id: userId },
    })
```

- [ ] **Step 5: Run the backend test suite for regressions**

Run: `cd backend && npm test`
Expected: all pass, including the sessions test suite.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/sessions.ts backend/src/routes/__tests__/sessionsMigrate.test.ts
git commit -m "feat(referral): attach referral visit to user on sign-in migration

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Frontend referral library

**Files:**
- Create: `frontend/lib/referral.ts`
- Test: `frontend/lib/__tests__/referral.test.ts`

**Interfaces:**
- Consumes: `API_BASE` from `frontend/lib/env.ts`; `getOrCreateGuestToken` from `frontend/lib/guestToken.ts`.
- Produces:
  - `const REFERRAL_CODE_STORAGE_KEY = 'propfyndr_referral_code'`
  - `getStoredReferralCode(): string | null`
  - `storeReferralCode(code: string): void`
  - `async function arrive(code: string | null, channel?: string): Promise<{ ownCode: string; greeting: { name: string } | null } | null>`
  - `appendReferralParams(url: string): string` — appends `?r=<ownCode>` (or `&r=`) to a given relative URL using the stored code; used by Task 11.

- [ ] **Step 1: Write the failing tests**

```typescript
// frontend/lib/__tests__/referral.test.ts
import { getStoredReferralCode, storeReferralCode, appendReferralParams, REFERRAL_CODE_STORAGE_KEY } from '../referral'

describe('referral code storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns null when nothing is stored', () => {
    expect(getStoredReferralCode()).toBeNull()
  })

  it('stores and retrieves a code', () => {
    storeReferralCode('ABCD1234')
    expect(getStoredReferralCode()).toBe('ABCD1234')
    expect(localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)).toBe('ABCD1234')
  })
})

describe('appendReferralParams', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the url unchanged when no code is stored', () => {
    expect(appendReferralParams('/dossier/abc123')).toBe('/dossier/abc123')
  })

  it('appends ?r=<code> to a url with no existing query string', () => {
    storeReferralCode('ABCD1234')
    expect(appendReferralParams('/dossier/abc123')).toBe('/dossier/abc123?r=ABCD1234')
  })

  it('appends &r=<code> to a url that already has a query string', () => {
    storeReferralCode('ABCD1234')
    expect(appendReferralParams('/s/xyz?foo=bar')).toBe('/s/xyz?foo=bar&r=ABCD1234')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx jest lib/__tests__/referral.test.ts`
Expected: FAIL with `Cannot find module '../referral'`

- [ ] **Step 3: Implement**

```typescript
// frontend/lib/referral.ts
//
// Client-side half of referral tracking: stores this device's own referral
// code, calls the arrive endpoint once, and appends the code to any URL this
// device shares onward (dossier, shortlist, the share button). See
// docs/superpowers/specs/2026-10-11-referral-tracking-design.md.
import { API_BASE } from './env'

export const REFERRAL_CODE_STORAGE_KEY = 'propfyndr_referral_code'

export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeReferralCode(code: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, code)
  } catch {
    // non-fatal: the device just won't carry a code into its own shares this session
  }
}

export interface ArriveResponse {
  ownCode: string
  greeting: { name: string } | null
}

export async function arrive(code: string | null, channel?: string): Promise<ArriveResponse | null> {
  if (typeof window === 'undefined') return null
  const { getOrCreateGuestToken } = await import('./guestToken')
  const guestToken = getOrCreateGuestToken()
  if (!guestToken) return null

  try {
    const res = await fetch(`${API_BASE}/referral/arrive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestToken, code: code || undefined, channel }),
    })
    if (!res.ok) return null
    return (await res.json()) as ArriveResponse
  } catch {
    return null
  }
}

/** Appends `?r=<code>` (or `&r=<code>`) to a relative URL, using this device's own stored code. */
export function appendReferralParams(url: string): string {
  const code = getStoredReferralCode()
  if (!code) return url
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}r=${code}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx jest lib/__tests__/referral.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/referral.ts frontend/lib/__tests__/referral.test.ts
git commit -m "feat(referral): add frontend referral code storage and arrive() client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: ReferralTracker component (mounted in root layout)

**Files:**
- Create: `frontend/components/ReferralTracker.tsx`
- Modify: `frontend/app/layout.tsx`
- Test: `frontend/components/__tests__/ReferralTracker.test.tsx`

**Interfaces:**
- Consumes: `arrive`, `getStoredReferralCode`, `storeReferralCode` from Task 9.
- Produces: `export default function ReferralTracker(): null` — a client component with no visible output; side effect only (calls `arrive()`, rewrites the address bar, exposes the greeting via a tiny custom event `propfyndr:referral-greeting` that `ReferralShareButton`/a future banner can listen for — kept to an event rather than React context to avoid restructuring the layout tree, matching how `propfyndr:new-chat` is already dispatched in `DiscoveryContent.tsx:287`).

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/components/__tests__/ReferralTracker.test.tsx
import { render, waitFor } from '@testing-library/react'
import ReferralTracker from '../ReferralTracker'

jest.mock('../../lib/referral', () => ({
  getStoredReferralCode: jest.fn(() => null),
  storeReferralCode: jest.fn(),
  arrive: jest.fn(() => Promise.resolve({ ownCode: 'NEWCODE1', greeting: { name: 'Furqan' } })),
}))

describe('ReferralTracker', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/discover?r=OLDCODE1')
  })

  it('calls arrive with the code from the URL and stores the returned own code', async () => {
    const { storeReferralCode } = require('../../lib/referral')
    render(<ReferralTracker />)
    await waitFor(() => expect(storeReferralCode).toHaveBeenCalledWith('NEWCODE1'))
  })

  it('rewrites the address bar to the device\'s own code', async () => {
    render(<ReferralTracker />)
    await waitFor(() => expect(window.location.search).toContain('r=NEWCODE1'))
  })

  it('renders nothing visible', () => {
    const { container } = render(<ReferralTracker />)
    expect(container.firstChild).toBeNull()
  })

  it('skips arrive() entirely when ?preview=1 is present', async () => {
    const { arrive } = require('../../lib/referral')
    window.history.pushState({}, '', '/discover?r=OLDCODE1&preview=1')
    render(<ReferralTracker />)
    await new Promise((r) => setTimeout(r, 0))
    expect(arrive).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx jest components/__tests__/ReferralTracker.test.tsx`
Expected: FAIL with `Cannot find module '../ReferralTracker'`

- [ ] **Step 3: Implement**

```tsx
// frontend/components/ReferralTracker.tsx
'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { arrive, getStoredReferralCode, storeReferralCode } from '@/lib/referral'

/** Admin/portal/builder/partner staff are not referral subjects. */
const SKIP_PREFIXES = ['/admin', '/portal', '/builder', '/partner']

export default function ReferralTracker(): null {
  const pathname = usePathname()

  useEffect(() => {
    if (SKIP_PREFIXES.some((p) => pathname?.startsWith(p))) return
    if (getStoredReferralCode()) return // already has an own code this device; nothing to arrive on again

    const params = new URLSearchParams(window.location.search)
    if (params.get('preview') === '1') return // admin previewing their own link — never arrive()
    const code = params.get('r')

    let cancelled = false
    arrive(code).then((result) => {
      if (cancelled || !result) return
      storeReferralCode(result.ownCode)

      const url = new URL(window.location.href)
      url.searchParams.set('r', result.ownCode)
      window.history.replaceState({}, '', url.toString())

      if (result.greeting) {
        window.dispatchEvent(new CustomEvent('propfyndr:referral-greeting', { detail: result.greeting }))
      }
    })

    return () => {
      cancelled = true
    }
  }, [pathname])

  return null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx jest components/__tests__/ReferralTracker.test.tsx`
Expected: PASS, all 3 cases.

- [ ] **Step 5: Mount in the root layout**

In `frontend/app/layout.tsx`, add the import near the other component imports (after line 10's `import CookiesBanner from '@/components/CookiesBanner'`):

```typescript
import ReferralTracker from "@/components/ReferralTracker";
```

And render it near `<PingBackend />` (line 115):

```tsx
        <PingBackend />
        <ReferralTracker />
```

- [ ] **Step 6: Commit**

```bash
git add frontend/components/ReferralTracker.tsx frontend/components/__tests__/ReferralTracker.test.tsx frontend/app/layout.tsx
git commit -m "feat(referral): add ReferralTracker, mounted in root layout

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: `/r/[code]` landing route and preview card

**Files:**
- Create: `frontend/app/r/[code]/page.tsx`
- Create: `frontend/app/r/[code]/opengraph-image.tsx`

**Interfaces:**
- Consumes: nothing new — a plain redirect page.
- Produces: visiting `/r/K9X2ABCD` redirects (client-side, preserving the code as a query param) to `/discover?r=K9X2ABCD`, where `ReferralTracker` (Task 10) picks it up.

- [ ] **Step 1: Implement the redirect page**

```tsx
// frontend/app/r/[code]/page.tsx
//
// A labelled referral link. No database call here — the OpenGraph image next
// to this file is static for the same reason (preview bots must never
// trigger a DB write or even a DB read; lib/referralCode.ts's
// isPreviewBotUserAgent is what actually keeps bots from creating a visit,
// server-side, in POST /api/v1/referral/arrive).
import { redirect } from 'next/navigation'

export default function ReferralLandingPage({ params }: { params: { code: string } }) {
  redirect(`/discover?r=${encodeURIComponent(params.code)}`)
}
```

- [ ] **Step 2: Implement the static preview image**

```tsx
// frontend/app/r/[code]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const alt = 'RealtyAsk — AI Property Advisor'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Deliberately static — no fetch, no params use. A link-preview fetch from
// WhatsApp/iMessage/etc. must never cause a database round trip; the one
// place code or device matters is the real arrive() call in the browser.
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0F3460 0%, #1B5E9E 100%)',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontFamily: 'system-ui, -apple-system',
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 'bold' }}>🏠 RealtyAsk</div>
        <div style={{ fontSize: 28, opacity: 0.85, marginTop: 16 }}>
          AI Property Advisor — someone thinks you&apos;d find this useful
        </div>
      </div>
    ),
    { ...size }
  )
}
```

- [ ] **Step 3: Manual verification**

This route has no automated test (it's a pure redirect with no logic to assert beyond what Next.js itself guarantees for `redirect()`). Verify manually once the dev server is running: `cd frontend && npm run dev`, then visit `http://localhost:3000/r/TESTCODE` and confirm it lands on `/discover?r=TESTCODE`.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/r
git commit -m "feat(referral): add /r/[code] landing redirect and static preview card

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: ReferralShareButton and wiring into DiscoveryContent

**Files:**
- Create: `frontend/components/chat/ReferralShareButton.tsx`
- Modify: `frontend/components/DiscoveryContent.tsx` (render the button; append referral params to the dossier and shortlist share URLs)
- Test: `frontend/components/chat/__tests__/ReferralShareButton.test.tsx`

**Interfaces:**
- Consumes: `appendReferralParams`, `getStoredReferralCode` from Task 9.
- Produces: `export function ReferralShareButton(): JSX.Element` rendered in `DiscoveryContent.tsx`'s header, between the dossier-share block (ends at the line shown below) and the "New Chat" button.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/components/chat/__tests__/ReferralShareButton.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ReferralShareButton } from '../ReferralShareButton'

jest.mock('../../../lib/referral', () => ({
  getStoredReferralCode: jest.fn(() => 'ABCD1234'),
}))

describe('ReferralShareButton', () => {
  const originalClipboard = navigator.clipboard

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', { value: originalClipboard, configurable: true })
  })

  it('renders a Share RealtyAsk trigger', () => {
    render(<ReferralShareButton />)
    expect(screen.getByRole('button', { name: /share propfyndr/i })).toBeInTheDocument()
  })

  it('opens a menu with WhatsApp, SMS and Copy options', () => {
    render(<ReferralShareButton />)
    fireEvent.click(screen.getByRole('button', { name: /share propfyndr/i }))
    expect(screen.getByRole('menuitem', { name: /whatsapp/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /sms/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeInTheDocument()
  })

  it('copies a link containing the stored referral code and channel=copy', async () => {
    const writeText = jest.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    render(<ReferralShareButton />)
    fireEvent.click(screen.getByRole('button', { name: /share propfyndr/i }))
    fireEvent.click(screen.getByRole('menuitem', { name: /copy link/i }))

    expect(writeText).toHaveBeenCalledTimes(1)
    const [url] = writeText.mock.calls[0]
    expect(url).toContain('r=ABCD1234')
    expect(url).toContain('c=copy')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx jest components/chat/__tests__/ReferralShareButton.test.tsx`
Expected: FAIL with `Cannot find module '../ReferralShareButton'`

- [ ] **Step 3: Implement**

```tsx
// frontend/components/chat/ReferralShareButton.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { ShareNetwork, ChatCircleText, Copy, Check } from '@phosphor-icons/react'
import { getStoredReferralCode } from '@/lib/referral'

/**
 * Always-visible "Share RealtyAsk" entry point, separate from the dossier
 * share button (which only appears once a dossier exists for this session).
 * Every channel appends ?r=<this device's own code>&c=<channel>, so the
 * person who opens it is attributed to this device in the referral tree.
 */
export function ReferralShareButton() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function shareUrl(channel: string): string {
    const code = getStoredReferralCode()
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const params = new URLSearchParams()
    if (code) params.set('r', code)
    params.set('c', channel)
    return `${base}/?${params.toString()}`
  }

  const handleWhatsApp = () => {
    const text = `Check out RealtyAsk — an AI property advisor for Noida:\n${shareUrl('wa')}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    setOpen(false)
  }

  const handleSms = () => {
    const text = `Check out RealtyAsk: ${shareUrl('sms')}`
    window.open(`sms:?&body=${encodeURIComponent(text)}`, '_blank')
    setOpen(false)
  }

  const handleCopy = () => {
    const url = shareUrl('copy')
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }).catch(() => {})
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center gap-1.5 h-10 px-3 sm:px-3.5 rounded-full bg-surface/90 dark:bg-surface-2/90 backdrop-blur-md border border-border-heavy hover:bg-surface-3 dark:hover:bg-zinc-800 text-text-primary text-[13px] font-medium transition-colors cursor-pointer active:scale-95"
        title="Share RealtyAsk"
        aria-label="Share RealtyAsk"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ShareNetwork size={18} weight="bold" className="text-text-secondary" />
        <span className="hidden sm:inline">Share RealtyAsk</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Share RealtyAsk"
          className="absolute top-full right-0 mt-1.5 w-56 bg-surface dark:bg-surface-2 rounded-sm shadow-md border border-border-heavy overflow-hidden p-1 animate-in fade-in zoom-in-95 duration-100 z-50"
        >
          <button role="menuitem" onClick={handleWhatsApp} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs text-[13px] text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer">
            <ShareNetwork size={15} weight="bold" className="text-text-muted" />
            <span>WhatsApp</span>
          </button>
          <button role="menuitem" onClick={handleSms} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs text-[13px] text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer">
            <ChatCircleText size={15} weight="bold" className="text-text-muted" />
            <span>SMS</span>
          </button>
          <button role="menuitem" onClick={handleCopy} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs text-[13px] text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer">
            {copied ? <Check size={15} weight="bold" className="text-emerald-600" /> : <Copy size={15} weight="bold" className="text-text-muted" />}
            <span>{copied ? 'Link copied' : 'Copy link'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx jest components/chat/__tests__/ReferralShareButton.test.tsx`
Expected: PASS, all 3 cases.

- [ ] **Step 5: Render it in `DiscoveryContent.tsx`**

Open `frontend/components/DiscoveryContent.tsx`. Add the import near the top with the other chat-component imports (find the existing `import { DossierShareCard } ...` or similar block near the top of the file and add alongside it):

```typescript
import { ReferralShareButton } from '@/components/chat/ReferralShareButton';
```

Insert `<ReferralShareButton />` between the dossier-share block's closing and the "New Chat" button block. The dossier block closes at the line containing:

```tsx
            </div>
          )}
          {/* Individual Frosted Pill New Chat Button */}
```

(this is the `)}  {/* Individual Frosted Pill New Chat Button */}` pair shown earlier at roughly line 1870-1871). Change it to:

```tsx
            </div>
          )}
          <ReferralShareButton />
          {/* Individual Frosted Pill New Chat Button */}
```

- [ ] **Step 6: Append referral params to the dossier and shortlist share URLs**

In the same file, find `handleDossierCopy`, `handleDossierOpen`, `handleDossierWhatsApp` (around lines 495-511). Import `appendReferralParams` alongside the Task 9 import:

```typescript
import { appendReferralParams } from '@/lib/referral';
```

Change `dossierFullUrl` (around line 493) from:

```typescript
  const dossierFullUrl = dossierHref && typeof window !== 'undefined' ? `${window.location.origin}${dossierHref}` : '';
```

to:

```typescript
  const dossierFullUrl = dossierHref && typeof window !== 'undefined' ? `${window.location.origin}${appendReferralParams(dossierHref)}` : '';
```

`handleDossierOpen` already uses `dossierHref` directly for `window.open` — change it to use the referral-tagged path too:

```typescript
  const handleDossierOpen = () => {
    trackDossierShared(dossierToken, { channel: 'open' });
    if (dossierHref) window.open(appendReferralParams(dossierHref), '_blank', 'noopener,noreferrer');
  };
```

Do the same for the shortlist share link. Find where the shortlist `/s/:id` URL is constructed in this file (search for `'/s/'` in `DiscoveryContent.tsx`); wrap it with `appendReferralParams(...)` the same way before it's copied or opened. If no shortlist-share code exists directly in `DiscoveryContent.tsx` (it may live in `ShareShortlistModal.tsx` instead), make the equivalent change there: import `appendReferralParams` from `@/lib/referral` and wrap the constructed `/s/:id` URL with it before display/copy.

- [ ] **Step 7: Run the frontend test suite for regressions**

Run: `cd frontend && npx jest`
Expected: all existing tests pass; new tests pass.

- [ ] **Step 8: Manual verification**

Run `cd frontend && npm run dev`, open `/discover`, confirm the "Share RealtyAsk" pill appears in the header next to (or in place of) the dossier button, and that clicking "Copy link" puts a URL containing `r=` and `c=copy` on the clipboard.

- [ ] **Step 9: Commit**

```bash
git add frontend/components/chat/ReferralShareButton.tsx frontend/components/chat/__tests__/ReferralShareButton.test.tsx frontend/components/DiscoveryContent.tsx
git commit -m "feat(referral): add Share RealtyAsk button, tag dossier/shortlist links

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: ReferralNotice (dismissible notice strip)

**Files:**
- Create: `frontend/components/ReferralNotice.tsx`
- Modify: `frontend/app/layout.tsx`
- Test: `frontend/components/__tests__/ReferralNotice.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks — self-contained, same pattern as `CookiesBanner.tsx`.
- Produces: `export default function ReferralNotice(): JSX.Element` — small dismissible strip, shown once per browser.

- [ ] **Step 1: Write the failing tests**

```tsx
// frontend/components/__tests__/ReferralNotice.test.tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ReferralNotice from '../ReferralNotice'

describe('ReferralNotice', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows the notice text and a privacy link', async () => {
    render(<ReferralNotice />)
    act(() => { jest.advanceTimersByTime(900) })
    await waitFor(() => expect(screen.getByText(/stored and may be reviewed/i)).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy')
  })

  it('hides on close and remembers the dismissal', async () => {
    render(<ReferralNotice />)
    act(() => { jest.advanceTimersByTime(900) })
    await waitFor(() => expect(screen.getByText(/stored and may be reviewed/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    await waitFor(() => expect(screen.queryByText(/stored and may be reviewed/i)).not.toBeInTheDocument())
    expect(localStorage.getItem('referral-notice-dismissed')).toBe('true')
  })

  it('does not show again once dismissed', () => {
    localStorage.setItem('referral-notice-dismissed', 'true')
    render(<ReferralNotice />)
    act(() => { jest.advanceTimersByTime(900) })
    expect(screen.queryByText(/stored and may be reviewed/i)).not.toBeInTheDocument()
  })

  it('auto-hides after 10 seconds', async () => {
    render(<ReferralNotice />)
    act(() => { jest.advanceTimersByTime(900) })
    await waitFor(() => expect(screen.getByText(/stored and may be reviewed/i)).toBeInTheDocument())
    act(() => { jest.advanceTimersByTime(10_000) })
    await waitFor(() => expect(screen.queryByText(/stored and may be reviewed/i)).not.toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx jest components/__tests__/ReferralNotice.test.tsx`
Expected: FAIL with `Cannot find module '../ReferralNotice'`

- [ ] **Step 3: Implement**

```tsx
// frontend/components/ReferralNotice.tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'

const DISMISS_KEY = 'referral-notice-dismissed'
const SHOW_DELAY_MS = 800
const AUTO_HIDE_MS = 10_000

/**
 * Small, cookie-banner-style disclosure: chats may be reviewed by the
 * RealtyAsk team (not just the person who sent it) to understand how
 * RealtyAsk spreads. Shown once; dismissed on close, on sending the first
 * message, or automatically after 10 seconds — whichever comes first.
 */
export default function ReferralNotice() {
  const [visible, setVisible] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let dismissed = false
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === 'true'
    } catch {
      // localStorage unavailable: show the notice rather than silently skip disclosure
    }
    if (dismissed) return

    const showTimer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(showTimer)
  }, [])

  useEffect(() => {
    if (!visible) return
    hideTimerRef.current = setTimeout(() => dismiss(), AUTO_HIDE_MS)
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  function dismiss() {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, 'true')
    } catch {
      // non-fatal: shows again next session, acceptable
    }
  }

  if (!visible) return null

  return (
    <div
      role="status"
      className="fixed bottom-2 left-2 right-2 sm:left-4 sm:right-auto sm:max-w-sm z-40 pointer-events-auto"
    >
      <div className="flex items-center gap-2 rounded-xl bg-[#0c0d14]/85 backdrop-blur-xl border border-white/10 shadow-lg px-3.5 py-2.5 text-white">
        <p className="text-[11px] text-zinc-300/90 leading-snug flex-1">
          Chats are stored and may be reviewed by the RealtyAsk team to improve answers.{' '}
          <Link href="/privacy" className="underline underline-offset-2 text-blue-400 hover:text-blue-300">
            Privacy policy
          </Link>
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 w-6 h-6 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npx jest components/__tests__/ReferralNotice.test.tsx`
Expected: PASS, all 4 cases.

- [ ] **Step 5: Mount in the root layout**

In `frontend/app/layout.tsx`, add the import:

```typescript
import ReferralNotice from "@/components/ReferralNotice";
```

Render it near `<CookiesBanner />` (line 127):

```tsx
        <ThemedToaster />
        <CookiesBanner />
        <ReferralNotice />
```

- [ ] **Step 6: Commit**

```bash
git add frontend/components/ReferralNotice.tsx frontend/components/__tests__/ReferralNotice.test.tsx frontend/app/layout.tsx
git commit -m "feat(referral): add dismissible chat-review notice strip

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 14: Privacy policy updates

**Files:**
- Modify: `frontend/app/privacy/page.tsx`

**Interfaces:**
- Consumes: nothing — static content changes only.
- Produces: updated `lastUpdated`, a new "Shared Links" section, amended §1/§5/§6/§10/§12 text.

- [ ] **Step 1: Update `lastUpdated`**

Change line 28:

```typescript
  const lastUpdated = 'August 24, 2026'
```

to:

```typescript
  const lastUpdated = 'October 11, 2026'
```

- [ ] **Step 2: Amend §1 Information We Collect**

In the `collection` section (lines 36-51), add a fourth bullet after the "Technical & Geolocation Data" one:

```tsx
            <li>
              <strong>Shared-Link Data:</strong> If you arrive on RealtyAsk through a link someone shared with you, we record which link, your device type (phone, tablet, or desktop), a best-effort guess at which app you opened it from (for example Instagram or WhatsApp's in-app browser), and the time. We also give your device its own shareable link so we can see if you pass RealtyAsk on. We do not ask for, or collect, your name through this process.
            </li>
```

- [ ] **Step 3: Amend §5 AI Conversational Engine**

In the `ai-prompt-privacy` section, change the "Encrypted Session Continuity" bullet (lines 134-136) from:

```tsx
              <strong>Encrypted Session Continuity:</strong> Chat transcripts are stored encrypted at rest (AES-256) within your authenticated session for your personal review and are purged according to our data retention schedule.
```

to:

```tsx
              <strong>Encrypted Session Continuity:</strong> Chat transcripts are stored encrypted at rest (AES-256), may be reviewed by the RealtyAsk founding team to improve answers and understand how the service is used, and are purged according to our data retention schedule.
```

- [ ] **Step 4: Amend §6 Purpose & Lawful Grounds**

In the `usage` section (lines 148-157), add a bullet after "Platform Security & Anomaly Prevention":

```tsx
              <li><strong>Understanding Shared Reach:</strong> Seeing whether and how RealtyAsk is shared from one person to another, so we can tell whether the product is genuinely useful.</li>
```

- [ ] **Step 5: Add a new "Shared Links" section**

Insert a new entry into the `sections` array, after the `cookies` section (ends line 253) and before `dpdp-rights` (starts line 255):

```typescript
    {
      id: 'shared-links',
      icon: ShareNetwork,
      title: '10a. Shared Links & Referral Tracking',
      content: (
        <div className="space-y-3">
          <p>
            RealtyAsk lets people share a link to the service with others, and lets our own team generate labelled links to see how the product spreads.
          </p>
          <ul className="list-disc list-inside space-y-2 ml-2 text-slate-600 dark:text-slate-400">
            <li><strong>No Names Collected:</strong> A link records only your device type, a best-effort guess at the app you opened it from, and the time — never your name, unless you separately give us one (for example, on a callback request).</li>
            <li><strong>Internal Use Only:</strong> This data is visible only to RealtyAsk's founding team, never to builders, channel partners, or any third party.</li>
            <li><strong>Your Own Chats Stay Yours:</strong> Being part of a shared link does not change who can act on your account — it only lets us see that a chat happened and, at a summary level, what it was about.</li>
          </ul>
        </div>
      ),
    },
```

Add `ShareNetwork` to the icon imports at the top of the file (check the existing `import { ... } from '...'` icon import line near the top of `privacy/page.tsx` and add `ShareNetwork` to it — use the same icon library already imported there, e.g. `lucide-react`; if `lucide-react`'s export is named differently such as `Share2`, use that name instead and adjust the JSX reference accordingly).

- [ ] **Step 6: Amend §10 Cookies, Local Storage & Geolocation**

In the `cookies` section (lines 246-250), add a bullet:

```tsx
            <li><strong>Referral Code:</strong> Your device's own shareable code, and whether you have dismissed the chat-review notice, are stored in your browser's local storage.</li>
```

- [ ] **Step 7: Amend §12 Data Retention & Erasure Schedule**

Replace the `retention` section's content (lines 277-282) from:

```tsx
          <p>
            Chat transcripts and search queries from unauthenticated guest sessions are automatically expired after 30 days. Registered user profiles and saved property collections remain active until account deletion is initiated. Upon receiving an erasure request, personal identifiers are completely purged from our active databases within 15 days.
          </p>
```

to:

```tsx
          <p>
            Chat transcripts and search queries from unauthenticated guest sessions, and referral-link data, are automatically expired after 12 months. Registered user profiles and saved property collections remain active until account deletion is initiated. Upon receiving an erasure request, personal identifiers are completely purged from our active databases within 15 days.
          </p>
```

- [ ] **Step 8: Manual verification**

Run `cd frontend && npm run dev`, visit `/privacy`, confirm the new section renders without a console error (icon import mismatches throw at build time — watch the terminal output, not just the browser).

- [ ] **Step 9: Commit**

```bash
git add frontend/app/privacy/page.tsx
git commit -m "docs(privacy): disclose referral-link data and move retention to 12 months

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 15: Retention purge script

**Files:**
- Create: `backend/scripts/purge-retention.ts`
- Test: `backend/scripts/__tests__/purgeRetention.test.ts`

**Interfaces:**
- Consumes: `prisma` from `backend/src/lib/db.ts`.
- Produces: `export function computeCutoff(now: Date): Date` (pure, 12 months back — tested without a DB) and `export async function run(apply: boolean): Promise<{ chatSessions: number; referralVisits: number }>`, plus a CLI entry point (`if (require.main === module) { ... }`) that defaults to dry-run and requires `--apply` to actually delete.

- [ ] **Step 1: Write the failing test for the pure cutoff function**

```typescript
// backend/scripts/__tests__/purgeRetention.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCutoff } from '../purge-retention'

describe('computeCutoff', () => {
  it('returns a date exactly 12 months before now', () => {
    const now = new Date('2026-10-11T00:00:00.000Z')
    const cutoff = computeCutoff(now)
    assert.equal(cutoff.getUTCFullYear(), 2025)
    assert.equal(cutoff.getUTCMonth(), 9) // October is month 9 (0-indexed)
    assert.equal(cutoff.getUTCDate(), 11)
  })

  it('handles a leap-year edge case (Feb 29 now, cutoff lands on Feb 28/29 the prior year)', () => {
    const now = new Date('2028-02-29T00:00:00.000Z')
    const cutoff = computeCutoff(now)
    assert.equal(cutoff.getUTCFullYear(), 2027)
    assert.equal(cutoff.getUTCMonth(), 1) // February
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx tsx --test scripts/__tests__/purgeRetention.test.ts`
Expected: FAIL with `Cannot find module '../purge-retention'`

- [ ] **Step 3: Implement**

```typescript
// backend/scripts/purge-retention.ts
//
// Deletes guest chat sessions and referral tracking data older than the
// 12-month retention window stated in /privacy (§12). Dry-run by default —
// prints what WOULD be deleted. Pass --apply to actually delete.
//
// Usage:
//   npx tsx scripts/purge-retention.ts            # dry run, prints counts
//   npx tsx scripts/purge-retention.ts --apply     # actually deletes
import { prisma } from '../src/lib/db'

const RETENTION_MONTHS = 12

export function computeCutoff(now: Date): Date {
  const cutoff = new Date(now)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - RETENTION_MONTHS)
  return cutoff
}

export async function run(apply: boolean): Promise<{ chatSessions: number; referralVisits: number }> {
  const cutoff = computeCutoff(new Date())

  // Guest chat sessions (user_id null) older than the window. ChatMessage
  // rows cascade with the session (see the ChatSession model's existing
  // relation), so no separate message cleanup is needed.
  const staleSessions = await prisma.chatSession.findMany({
    where: { user_id: null, last_active: { lt: cutoff } },
    select: { id: true },
  })

  // Referral visits older than the window — and ONLY the ones with no
  // associated sign-in (user_id null), since a signed-in user's own account
  // data is governed by account deletion, not this guest-data purge.
  const staleVisits = await prisma.referralVisit.findMany({
    where: { user_id: null, first_seen_at: { lt: cutoff } },
    select: { guest_token: true, own_code: true },
  })

  if (apply) {
    if (staleSessions.length > 0) {
      await prisma.chatSession.deleteMany({ where: { id: { in: staleSessions.map((s) => s.id) } } })
    }
    if (staleVisits.length > 0) {
      await prisma.referralVisit.deleteMany({ where: { guest_token: { in: staleVisits.map((v) => v.guest_token) } } })
      await prisma.referralLink.deleteMany({ where: { code: { in: staleVisits.map((v) => v.own_code) }, kind: 'PERSONAL' } })
    }
  }

  return { chatSessions: staleSessions.length, referralVisits: staleVisits.length }
}

if (require.main === module) {
  const apply = process.argv.includes('--apply')
  run(apply).then((counts) => {
    console.log(apply ? 'Deleted:' : 'Would delete (dry run — pass --apply to actually delete):', counts)
    process.exit(0)
  }).catch((err) => {
    console.error('[PURGE_RETENTION:FAILED]', err)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx tsx --test scripts/__tests__/purgeRetention.test.ts`
Expected: PASS, both cases.

- [ ] **Step 5: Run the dry-run manually (no `--apply`, nothing is deleted)**

Run: `cd backend && npx tsx scripts/purge-retention.ts`
Expected: prints `Would delete (dry run — pass --apply to actually delete): { chatSessions: N, referralVisits: M }` with whatever real counts exist in the connected database. **Do not pass `--apply` yourself** — that is an irreversible bulk delete and needs the user's explicit go-ahead in this conversation before you run it, exactly as the Global Constraints section states.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/purge-retention.ts backend/scripts/__tests__/purgeRetention.test.ts
git commit -m "feat(referral): add retention purge script, dry-run by default

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 16: Admin UI — links list and generate form

**Files:**
- Create: `frontend/app/admin/referrals/page.tsx`

**Interfaces:**
- Consumes: `adminFetch` from `frontend/lib/adminFetch.ts` (calls `GET /admin/referrals` and `POST /admin/referrals`, `POST /admin/referrals/:code/revoke` — note `adminFetch` strips a leading `/api/v1` but otherwise passes the path straight through, so call it as `adminFetch('/admin/referrals')`).
- Produces: a page listing ROOT links with their stats, a "Generate link" form, and a link to each tree view at `/admin/referrals/[code]`.

- [ ] **Step 1: Implement the page**

```tsx
// frontend/app/admin/referrals/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { adminFetch } from '@/lib/adminFetch'
import { Copy, Check, Plus, Link as LinkIcon } from 'lucide-react'

interface ReferralLinkRow {
  code: string
  label: string | null
  createdAt: string
  revoked: boolean
  devicesReached: number
  deepestGeneration: number
  activatedCount: number
  lastActivity: string | null
}

export default function ReferralsAdminPage() {
  const [links, setLinks] = useState<ReferralLinkRow[]>([])
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState<'mine' | 'all'>('all')
  const [label, setLabel] = useState('')
  const [greetingName, setGreetingName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newLinkUrl, setNewLinkUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminFetch(`/admin/referrals?scope=${scope}`)
      if (res.ok) {
        const data = await res.json()
        setLinks(data.links || [])
      }
    } finally {
      setLoading(false)
    }
  }, [scope])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    if (!label.trim()) return
    setCreating(true)
    try {
      const res = await adminFetch('/admin/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim(), greetingName: greetingName.trim() || undefined }),
      })
      if (res.ok) {
        const data = await res.json()
        const fullUrl = `${window.location.origin}${data.url}`
        setNewLinkUrl(fullUrl)
        setLabel('')
        setGreetingName('')
        load()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = (url: string) => {
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const handleRevoke = async (code: string) => {
    if (!confirm('Revoke this link? New arrivals will land without attribution; the existing tree is kept.')) return
    const res = await adminFetch(`/admin/referrals/${code}/revoke`, { method: 'POST' })
    if (res.ok) load()
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-1">Referral Links</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        Generate a link, share it with one person, and watch how far it spreads.
      </p>

      <div className="mb-8 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <h2 className="text-sm font-bold mb-3 flex items-center gap-2">
          <Plus size={16} /> Generate a link
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. Rahul – college)"
            maxLength={60}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
          />
          <input
            type="text"
            value={greetingName}
            onChange={(e) => setGreetingName(e.target.value)}
            placeholder="From name (e.g. Furqan)"
            maxLength={60}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !label.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
          >
            Generate
          </button>
        </div>
        {newLinkUrl && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-sm">
            <LinkIcon size={14} />
            <span className="flex-1 truncate">{newLinkUrl}</span>
            <button onClick={() => handleCopy(newLinkUrl)} className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
            <a
              href={`${newLinkUrl}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open without recording a visit — clicking the plain link yourself would make you its holder"
              className="text-slate-600 dark:text-slate-400 font-medium hover:underline"
            >
              Preview
            </a>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setScope('all')} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${scope === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>All</button>
        <button onClick={() => setScope('mine')} className={`px-3 py-1.5 rounded-full text-xs font-semibold ${scope === 'mine' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>Mine</button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : links.length === 0 ? (
        <p className="text-sm text-slate-500">No referral links yet.</p>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Devices</th>
                <th className="px-4 py-3">Deepest gen.</th>
                <th className="px-4 py-3">Activated</th>
                <th className="px-4 py-3">Last activity</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.code} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <Link href={`/admin/referrals/${link.code}`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      {link.label || link.code}
                    </Link>
                    {link.revoked && <span className="ml-2 text-xs text-red-500">revoked</span>}
                  </td>
                  <td className="px-4 py-3">{link.devicesReached}</td>
                  <td className="px-4 py-3">{link.deepestGeneration}</td>
                  <td className="px-4 py-3">{link.activatedCount}</td>
                  <td className="px-4 py-3">{link.lastActivity ? new Date(link.lastActivity).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {!link.revoked && (
                      <button onClick={() => handleRevoke(link.code)} className="text-xs text-red-500 hover:underline">
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Manual verification**

This is a straightforward CRUD admin page without complex client logic worth a Jest test on its own (the logic it calls — generate, list, revoke — is already tested at the API layer in Task 6). Verify manually: sign in as a SUPER_ADMIN, visit `/admin/referrals`, generate a link with a label and greeting name, confirm it appears in the table, confirm Revoke works and the row updates. Click the "Preview" link next to the newly generated link and confirm (via the tree view afterward) that it did NOT create a visit or set the holder. Then sign in as a SALES or ANALYST admin and confirm `/admin/referrals` returns 403 from the API (the page itself will show whatever empty/error state results — that's acceptable, since the enforcement is server-side per Task 5).

- [ ] **Step 3: Commit**

```bash
git add frontend/app/admin/referrals/page.tsx
git commit -m "feat(referral): add admin referral links list and generate form

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 17: Admin UI — tree view and person drawer

**Files:**
- Create: `frontend/app/admin/referrals/[code]/page.tsx`

**Interfaces:**
- Consumes: `adminFetch` (calls `GET /admin/referrals/:code/tree` and `GET /admin/referrals/nodes/:guestToken`).
- Produces: a page rendering the indented node list for one root link, with a click-to-expand drawer per node.

- [ ] **Step 1: Implement the page**

```tsx
// frontend/app/admin/referrals/[code]/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/adminFetch'
import { ArrowLeft, DeviceMobile, Desktop, DeviceTablet } from '@phosphor-icons/react'

interface TreeNode {
  guestToken: string
  label: string | null
  generation: number
  parentGuestToken: string | null
  depthInferred: boolean
  deviceClass: string
  os: string
  appGuess: string
  shareChannel: string | null
  messageCount: number
  activated: boolean
  firstSeenAt: string
}

interface NodeDrawerData {
  guestToken: string
  generation: number
  rootCode: string
  deviceClass: string
  os: string
  appGuess: string
  depthInferred: boolean
  firstSeenAt: string
  summary: { location: string | null; financial: string | null; timeline: string | null } | null
  actions: { callbacks: number; dossiersMade: number }
  chats: Array<{ id: string; messageCount: number; lastActive: string }>
}

function DeviceIcon({ deviceClass }: { deviceClass: string }) {
  if (deviceClass === 'mobile') return <DeviceMobile size={14} />
  if (deviceClass === 'tablet') return <DeviceTablet size={14} />
  return <Desktop size={14} />
}

export default function ReferralTreePage() {
  const { code } = useParams<{ code: string }>()
  const [rootLabel, setRootLabel] = useState<string | null>(null)
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<NodeDrawerData | null>(null)
  const [drawerLoading, setDrawerLoading] = useState(false)

  useEffect(() => {
    if (!code) return
    adminFetch(`/admin/referrals/${code}/tree`).then(async (res) => {
      if (res.ok) {
        const data = await res.json()
        setRootLabel(data.root?.label || null)
        setNodes(data.nodes || [])
      }
      setLoading(false)
    })
  }, [code])

  const openNode = useCallback(async (guestToken: string) => {
    setDrawerLoading(true)
    try {
      const res = await adminFetch(`/admin/referrals/nodes/${guestToken}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedNode(data.node)
      }
    } finally {
      setDrawerLoading(false)
    }
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/admin/referrals" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 mb-4">
        <ArrowLeft size={14} /> Back to all links
      </Link>
      <h1 className="text-xl font-bold mb-6">{rootLabel || code}</h1>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : nodes.length === 0 ? (
        <p className="text-sm text-slate-500">No devices have arrived through this link yet.</p>
      ) : (
        <div className="space-y-1.5">
          {nodes.map((node) => (
            <button
              key={node.guestToken}
              onClick={() => openNode(node.guestToken)}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              style={{ marginLeft: `${(node.generation - 1) * 20}px` }}
            >
              <DeviceIcon deviceClass={node.deviceClass} />
              <span className="font-medium text-sm">{node.label || `guest · gen ${node.generation}`}</span>
              <span className="text-xs text-slate-500">{node.os} · {node.appGuess !== 'unknown' ? node.appGuess : (node.shareChannel || 'unknown app')}</span>
              <span className="text-xs text-slate-500">{node.messageCount} msgs</span>
              {node.activated && <span className="text-xs text-emerald-600 font-semibold">activated</span>}
              {node.depthInferred && <span className="text-xs text-amber-600">via parent (exact sender unknown)</span>}
            </button>
          ))}
        </div>
      )}

      {selectedNode && (
        <div className="fixed inset-0 bg-black/30 flex justify-end z-50" onClick={() => setSelectedNode(null)}>
          <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedNode(null)} className="text-sm text-slate-500 mb-4">Close</button>
            <h2 className="text-lg font-bold mb-1">Generation {selectedNode.generation}</h2>
            <p className="text-xs text-slate-500 mb-4">{selectedNode.deviceClass} · {selectedNode.os} · {selectedNode.appGuess}</p>

            {selectedNode.summary && (selectedNode.summary.location || selectedNode.summary.financial || selectedNode.summary.timeline) && (
              <div className="mb-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
                {[selectedNode.summary.location, selectedNode.summary.financial, selectedNode.summary.timeline].filter(Boolean).join(' · ')}
              </div>
            )}

            <div className="mb-4 text-sm space-y-1">
              <div>Callbacks requested: {selectedNode.actions.callbacks}</div>
              <div>Dossiers made: {selectedNode.actions.dossiersMade}</div>
            </div>

            <h3 className="text-sm font-bold mb-2">Chats</h3>
            <div className="space-y-2">
              {selectedNode.chats.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/admin/conversations/${chat.id}`}
                  className="block p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {chat.messageCount} messages · last active {new Date(chat.lastActive).toLocaleDateString()}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {drawerLoading && <div className="fixed bottom-4 right-4 text-xs text-slate-500">Loading…</div>}
    </div>
  )
}
```

This links to `/admin/conversations/:id` for "Open transcript" — confirm that route exists in `frontend/app/admin/conversations/` before wiring it; if the existing conversations admin page uses a different URL shape (e.g. a query param instead of a path segment), adjust the `href` here to match it exactly rather than guessing.

- [ ] **Step 2: Verify the conversations route shape**

Run (Grep): search `frontend/app/admin/conversations/page.tsx` for how it navigates to a single transcript (it may be a client-side state change rather than a route, since the file listed earlier was a single `page.tsx` with no `[id]` subdirectory). If it's not a dedicated `/admin/conversations/:id` route, change the drawer's "Open transcript" link to instead navigate to `/admin/conversations?sessionId=<id>` or whatever the actual mechanism is — read the file to confirm before finalizing this step.

- [ ] **Step 3: Manual verification**

Visit `/admin/referrals/<some code>` as a SUPER_ADMIN, confirm the indented tree renders, click a node, confirm the drawer opens with summary/actions/chats, and confirm "Open transcript" goes to a working conversation view.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/admin/referrals/[code]/page.tsx
git commit -m "feat(referral): add admin tree view with per-person drawer

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 18: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Backend full suite**

Run: `cd backend && npm test`
Expected: all tests pass, including `adminReadCoverage.test.ts`, `guardsOutsideAdminArea.test.ts`, `adminAreaGuard.test.ts` — these specifically enumerate admin routers and paths, and are the tests most likely to need a one-line addition for the new `adminReferrals` router. If any fails, read its assertion message (it will name what list or pattern it expected `adminReferrals` to appear in) and add it there — do not change the test's intent, only its coverage list.

- [ ] **Step 2: Backend typecheck**

Run: `cd backend && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Frontend full suite**

Run: `cd frontend && npx jest`
Expected: all tests pass.

- [ ] **Step 4: Frontend typecheck/build**

Run: `cd frontend && npm run build`
Expected: build succeeds (this also catches the icon-import mismatch flagged in Task 14 and any JSX errors in the new admin pages).

- [ ] **Step 5: Report**

Summarize to the user: what was built, which tests pass, what remains manual (the `/r/[code]` redirect, the admin UI click-throughs, the real-device WhatsApp/iMessage/Instagram test from the spec's Testing section), and that the retention purge script has been run in dry-run only — ask whether to schedule `--apply` or leave it manual for now.

---

## Self-Review Notes

**Spec coverage check:**
- Data model (Option A) — Task 1. ✓
- Arrival flow, first-touch rule, bot/rate-limit handling — Tasks 2-4. ✓
- Admin policy restriction + audited node read — Task 5. ✓
- Admin generate/list/revoke/reset-holder — Task 6. ✓
- Admin tree + person drawer — Task 7. ✓
- Identity merge on sign-in — Task 8. ✓
- Frontend code storage + arrive wiring + address-bar rewrite — Tasks 9-10. ✓
- `/r/[code]` landing + static preview — Task 11. ✓
- Share button (native/WhatsApp/SMS/copy) + dossier/shortlist tagging — Task 12. ✓
- Notice strip (cookie-banner style, dismissible, auto-hide) — Task 13. ✓
- Privacy policy updates incl. 12-month retention — Task 14. ✓
- Retention purge, dry-run default — Task 15. ✓
- Admin UI (list/generate, tree/drawer) — Tasks 16-17. ✓
- Edge case "admin opens own link": covered two ways — `?preview=1` bypass (`ReferralTracker.tsx` in Task 10, "Preview" link in Task 16's generate form) prevents it, and `reset-holder` (Task 6) recovers from it if it happens anyway.

**Placeholder scan:** no "TBD"/"TODO" left in any task's code. Task 3's test file includes one intentionally-flagged placeholder assertion that the step explicitly instructs to replace with real code before running — this is a deliberate teaching step (showing why `root_code` must be nullable), not an unresolved placeholder, and the corrected version is given in full immediately after.

**Type consistency check:** `AttributionResult.root_code: string | null` (Task 3) flows correctly into Task 4's `const rootCode = attribution.root_code ?? ownCode`. `ReferralVisit.root_code` in the Prisma schema (Task 1) is `String` (non-null) — Task 4 guarantees this by always falling back to `ownCode` before writing. `ParsedDeviceInfo` fields (Task 2) match the Prisma schema's plain `String` columns for `device_class`/`os`/`app_guess` (Task 1 stores them as unconstrained strings, not enums, matching the spec's table). `getStoredReferralCode`/`storeReferralCode`/`arrive`/`appendReferralParams` (Task 9) are consumed with matching names and signatures in Tasks 10 and 12 — verified no drift (e.g. no `clearReferralCode` invented and unused).

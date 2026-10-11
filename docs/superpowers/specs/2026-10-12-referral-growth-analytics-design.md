# Referral Growth Analytics — Design

**Date:** 2026-10-12 · **Status:** approved in brainstorming, awaiting spec review · **Audience:** the three founders (SUPER_ADMIN)

## Goal

Turn `/admin/referrals` from a device-count tally into a real growth-and-quality instrument: is the referral tree actually viral (K-factor), is it bringing *good* buyers (referred vs organic comparison), how is it spreading (channel/device/admin breakdown), where do people stall (funnel stages), and who on the founding team is driving it (per-admin attribution and leaderboard) — all from data already captured, plus one small schema addition for repeat-visit tracking.

This spec extends the feature shipped in commit `b8d4987` ("redesign admin referrals list and tree view with high-craft Apple aesthetics and full feature suite") and the original `2026-10-11-referral-tracking-design.md`. It does not re-litigate anything already built (code generation, attribution, bot detection, retention purge) — only what's new here.

## Non-goals

- No new visitor-facing behavior. Nothing in this spec changes `arrive()`, the share surfaces, or anything a buyer sees — it's entirely an admin-analytics layer on top of data already collected.
- No real-time/streaming metrics. Everything here is computed on read (page load / drill-in), not pushed.
- No notification/alerting delivery (email/WhatsApp) for broadcast flags or milestones — the codebase has no outbound notification provider wired yet (CLAUDE.md: "notifications are queued, never sent"). Broadcast detection surfaces in-page only.
- No new tables for time-series storage. Trends are computed from existing timestamp columns, not pre-aggregated into a new model.

## Decisions (from brainstorming, 2026-10-12)

| Topic | Decision |
|---|---|
| Scope | Snapshot totals AND trend lines, not either/or |
| Referred-vs-organic baseline | Organic = same bot/test exclusion already used in admin Conversations/Analytics, not "everyone not referred" |
| Broadcast threshold | ≥10 arrivals on one `arrived_via_code` within a 1-hour window (project default was 25; founders chose a lower, more sensitive bar) |
| Broadcast handling | Flag and label; never silently exclude from totals |
| Funnel stages | Four fixed stages: arrived-no-chat → chatted-shallow → activated (existing definition) → converted (callback/dossier/site-visit) |
| K-factor granularity | Both: one blended number per link + one network-wide number, with per-generation breakdown available on drill-in |
| Admin leaderboard placement | Both: top performer in the summary strip, full table on a dedicated "By Admin" tab |
| Revoke/reset attribution | Build now, same pass as `created_by_admin_id` |
| Trend granularity | Daily by default, toggle to weekly or all-time |
| RequirementState comparison depth | Full breadth: budget (amount + hard/soft ceiling split), sector, BHK, possession stance, top amenities |
| Channel/device breakdown | Cross-tabbed with activation rate per channel/device, not raw counts alone |
| "How many tries" | `visit_count` = number of times a device has re-entered the arrive flow (reopened its link), not error retries. Needs a migration — approved. |
| Tree default state | Collapsed to Generation 1; click to expand a branch |
| Campaign cleanup | Keep "Rahul – college" only; delete every other `ReferralLink` + its `ReferralVisit` subtree |

## Data model changes

```prisma
model ReferralVisit {
  // ...existing fields unchanged...
  visit_count    Int      @default(1)
  last_seen_at   DateTime @default(now())
}

model ReferralLink {
  // ...existing fields unchanged...
  revoked_by_admin_id String?
}
```

Both additive, nullable/defaulted — no backfill required, no existing query breaks. Migration name: `add_referral_visit_count_and_revoke_attribution`.

**Arrive endpoint change** (`backend/src/routes/referral.ts`): the existing-visit branch currently does:
```ts
if (existingVisit) {
  // returns existingVisit.own_code, changes nothing
}
```
This becomes an update: increment `visit_count`, set `last_seen_at = now()`, then return the code. First-touch attribution (`parent_guest_token`, `generation`, `root_code`) still never changes — only the new counters move.

**Revoke endpoint change** (`backend/src/routes/adminReferrals.ts`): `POST /:code/revoke` sets `revoked_by_admin_id` from `req.adminIdentity.adminUserId` alongside the existing `revoked_at`.

## New pure logic — `backend/src/lib/referralGrowthMetrics.ts`

Standalone, no Prisma/Express dependency, mirroring `referralAttribution.ts`'s shape so it's fully unit-testable without a database.

```ts
export function computeKFactor(generations: { generation: number; activatedCount: number }[]): {
  blended: number | null
  perGeneration: { generation: number; k: number | null }[]
}

export function classifyFunnelStage(node: {
  messageCount: number
  activated: boolean
  hasCallback: boolean
  hasDossier: boolean
  hasSiteVisit: boolean
}): 'arrived_no_chat' | 'chatted_shallow' | 'activated' | 'converted'

export function detectBroadcastWindows(
  arrivals: { arrivedAt: Date }[],
  thresholdPerHour: number, // 10, per decision above
): { windowStart: Date; count: number }[]
```

`computeKFactor`: for each generation boundary N→N+1, `k = activatedCount[N+1] / activatedCount[N]` where the denominator is nonzero; `blended` is the same ratio computed across all non-root arrivals vs all generation-0/1 holders combined. Returns `null` (not `0` or `NaN`) where a denominator is zero — the caller shows "—", never a fabricated ratio.

`classifyFunnelStage`: `converted` takes priority over `activated` over `chatted_shallow` over `arrived_no_chat` — a converted node is never also labeled merely "activated."

`detectBroadcastWindows`: sliding 1-hour window over sorted arrival timestamps for one `arrived_via_code`; returns every window at or above the threshold (there can be more than one burst).

## New backend endpoints

**`GET /admin/referrals/:code/trends?granularity=daily|weekly|all`** (default `daily`)
Buckets `ReferralVisit.first_seen_at` (new arrivals) by day or week for the given root code. Returns `{ buckets: { date: string; newArrivals: number }[] }`. `all` collapses to one bucket per week regardless of range length.

**`GET /admin/referrals/metrics`**
One aggregate call, SUPER_ADMIN only, backs three UI surfaces at once:
- `growthSummary`: network-wide blended K-factor, total active reach (non-revoked links' combined `devicesReached`), top-performing admin (by reach), best channel overall, count of currently-flagged broadcast windows.
- `byAdmin`: per `created_by_admin_id` — email (joined from `AdminUser`), links created, total devices reached, blended K-factor, best channel, top link by reach.
- `comparison`: referred (`generation >= 1`) vs organic (`ChatSession` rows with no matching `ReferralVisit`, same bot/test filter as admin analytics) — activation rate, avg. message count, conversion rate (any callback/dossier/site-visit), and a `RequirementState` breakdown for each group: budget band distribution + hard/soft ceiling ratio, sector distribution, BHK distribution, possession-stance distribution, top 5 amenities. Sessions pre-dating `RequirementState` (null `requirement_state` column) are excluded from the breakdown, not counted as "unknown."

**`GET /admin/referrals/:code/tree`** (existing, extended)
Each node gains `funnelStage` (from `classifyFunnelStage`), `visitCount`, `lastSeenAt`. No new round-trip — this data is already fetched at this call site (`messageCount`, save/callback/dossier flags already queried for `activated`).

**`GET /admin/referrals?...`** (existing, extended)
Each row gains `createdByEmail` (join `AdminUser` on `created_by_admin_id`), `revokedByEmail` (same join on `revoked_by_admin_id`, null unless revoked), `trendSparkline` (last 14 daily buckets, reusing the trends logic server-side for a compact inline render), `broadcastFlagged` (boolean, from `detectBroadcastWindows` against this link's `arrived_via_code` arrivals).

## Frontend — page restructure

**Top: Growth summary strip.** Five compact stat cards: overall K-factor, total active reach, top-performing admin, best channel, broadcast-alert count (click-through to the flagged link[s]).

**Two tabs: "By Link" / "By Admin."**
- *By Link* — the existing list, each row now showing label, created-by email, revoked-by email (if revoked), device/generation stats as today, a 14-day trend sparkline, and a broadcast badge where flagged.
- *By Admin* — new table: one row per admin who has created a link, columns for links created, total reach, blended K-factor, best channel, link to their top-performing link.

**Referred-vs-organic comparison** — its own section below the summary strip, page-level (the organic baseline isn't scoped to one link). Side-by-side: activation rate, avg. messages, conversion rate, and the full `RequirementState` breakdown as paired bar/percentage rows (budget bands, sector, BHK, possession stance, top amenities) — referred vs organic, each labeled with its sample size so a 4-person cohort doesn't read with the same confidence as a 400-person one.

**Per-link detail page (`[code]/page.tsx`)**:
- Real nested tree: each node renders under its actual `parent_guest_token`, not a flat generation band. Collapsed to Generation 1 by default; clicking a node expands its children. Each node shows its funnel-stage badge (arrived/chatted/activated/converted, four distinct colors reusing the existing status-chip pattern — this doesn't violate the single-accent rule from the design audit since status chips are informational, not interactive CTAs).
- K-factor section: blended number up top, per-generation table on expand.
- Trend chart: daily by default, a toggle for weekly/all-time.
- Channel/device breakdown: table cross-tabbing each channel (`wa`/`sms`/`copy`/`native`/`dossier`/`shortlist`/`link`) and device/app-guess against its activation rate.
- Node drawer: each chat row becomes its own link to `/admin/conversations?sessionId={id}` (or whatever query param that page actually supports — verified during implementation, not assumed) instead of today's single generic "Open in Conversations" button that carries no identifying parameter.

**Style cleanup** (from the earlier design audit, folded into this same pass since the page is being touched anyway): consistent `rounded-[18px]` on cards, `rounded-lg` or pill on buttons/inputs, every `shadow-*` class removed in favor of the existing hairline border, `active:scale-95` added to every clickable element currently missing it (filter pills, sort headers, icon buttons), lucide-react icons replacing the preset emoji (🤝💬💼🏢🎓🎯).

## Campaign cleanup

`backend/scripts/purge-test-referrals.ts`, dry-run by default — matching `purge-retention.ts`'s convention exactly:
- Dry run: prints every `ReferralLink` that would be deleted (everything except the one matching label "Rahul – college"), and the count of `ReferralVisit` rows in each one's subtree (`root_code` match). No writes.
- `--apply`: deletes those `ReferralVisit` rows then their `ReferralLink` rows in a transaction, in that order (visits reference links via `root_code`/`arrived_via_code`, not a hard FK cascade per the original schema — delete order matters). Requires the user to have seen the dry-run output and confirm again before this flag is ever actually run by the agent.
- If more than one `ReferralLink` matches label "Rahul – college" (shouldn't happen, labels aren't unique by schema), the script refuses and lists the ambiguous matches rather than guessing.

## Testing

**Backend** (`npx tsx --test`):
- `referralGrowthMetrics.test.ts`: `computeKFactor` (zero-denominator returns null not NaN, blended vs per-generation math, a generation with zero activated parents), `classifyFunnelStage` (priority ordering — a converted+low-message-count node is still "converted"), `detectBroadcastWindows` (exactly-at-threshold counts as flagged, a burst spanning two calendar hours but within one sliding 60-minute window is still caught, multiple separate bursts both reported).
- `adminReferrals.test.ts` extended: `/metrics` returns the three sections with correct shapes; `/trends` respects `granularity`; revoke sets `revoked_by_admin_id`; list rows include `createdByEmail`/`broadcastFlagged`.
- `referral.test.ts` extended: a second arrival from the same guest token increments `visit_count` and updates `last_seen_at`, does not change `parent_guest_token`/`generation`/`root_code`.
- `purge-test-referrals.test.ts` (or manual verification, matching how `purge-retention.ts` was tested): dry-run reports correct counts against fixture data; refuses on ambiguous label match.

**Frontend** (`npx jest`):
- Tree component: renders collapsed to Gen 1, expands a branch on click, nests children under the correct parent using `parent_guest_token` rather than flat generation grouping.
- Funnel badge: renders the correct one of four states per the priority order.
- Trend chart: toggles between daily/weekly/all-time without a full page reload.
- Chat row deep link: href includes the specific session identifier.

**Manual**: run the dry-run script against the real dev database and visually confirm the counts match expectation before anyone runs `--apply`.

## Edge cases

| Case | Handling |
|---|---|
| A generation has zero parents (e.g., link never shared past Gen 1) | K-factor for that boundary is `null` → UI shows "—", not 0% |
| Referred or organic cohort has a tiny sample (e.g., 3 people) | Shown with its real sample size labeled, never suppressed or given false confidence |
| Session predates `RequirementState` (null `requirement_state`) | Excluded from the comparison breakdown entirely, not counted as "unknown" |
| A link is flagged as a broadcast burst | Counted normally everywhere, additionally labeled; never removed from K-factor/trend/total numbers |
| Two admins happen to create a link with the same label | Allowed (schema doesn't enforce uniqueness) — the leaderboard groups by `created_by_admin_id`, not label, so this is harmless |
| `created_by_admin_id` or `revoked_by_admin_id` points to a deleted `AdminUser` | Email join returns null; UI shows "former admin" rather than erroring |
| `/admin/conversations` doesn't actually support a session-identifying query param today | Verify during implementation before wiring the deep link; if it doesn't, that page's filter gets the minimal addition needed, scoped to this one param — not a redesign of that page |

## Open items flagged (not resolved by this spec)

1. **`/admin/conversations`'s actual filter support for a direct session link** is unverified as of this spec — implementation must check before building the deep link, per the edge case above.
2. **Per-admin K-factor with very few links** (e.g., an admin with one link) will be statistically noisy — shown as-is per the "real sample size, not false confidence" principle, no smoothing applied.
3. **DPDP/legal review of the RequirementState comparison** — same open item already flagged in the original referral-tracking spec (item 2, DPDP review before wide rollout); this spec adds more buyer-derived data to the same screen, which raises the stakes on that review slightly. Not blocking an internal three-founder tool, but worth remembering before this page is ever shown outside the three of you.

# Lean Schema + Source Tracking (Sub-project A)

**Status:** Approved design, pending implementation plan.
**Date:** 2026-10-10
**Part of:** six-sub-project catalogue rework (B done, this is A; D/E/C/F follow — see session notes / MEMORY.md).

## Why

Three read-only audits of `newProj/75/*.json` (395 projects, 129 builders,
1,049 unit types), the intelligence models, and the chat Q&A path found:

- **104 fields** are templated: one value covers >60% of filled rows across
  395 projects. Examples: every unit price has `price_is_estimated=true`,
  every payment plan's source is `"inferred_default"`, cost-sheet charges
  (PLC/parking/club/IFMS) take only 3 value-sets total, 40 RERA numbers are
  malformed, `recommendation_profile.tier` is `STRONG_BUY` on all 395 rows.
- **No fact carries a source.** `source_url`/`scraped_from`/per-fact
  `verified_at` don't exist. Where "verified" fields exist, they're
  boilerplate (`verified_by="RealtyPals Audit Desk"` on every row that has
  one).
- **Intelligence section is used live, not dead** — `ProjectDna`,
  `RecommendationProfile` and `PersonaProfile` scores reach the property
  page, comparison table and ranking (`discovery/scoring.ts`) despite being
  flagged internal-only in `projectExposure.ts`. B (commit `3f6e8b5`)
  already cut the ranking and hero-badge reads; A finishes the job.
- **16 projects are duplicated** with conflicting facts (e.g. Mahagun
  Moderne: 2,700 units in one row, 2,250 in the other); **32 rows** are
  filed under the wrong city/sector.
- **81 projects share 21 coordinates** (sector centroids, not project
  locations); **224 of 227 floor-plan images** point to files not on disk.

This breaks the pitch to builders ("here are your details, take ownership")
and breaks CLAUDE.md's own rule: no invented, defaulted, or unlabelled
figure reaches a buyer.

## Decisions made (brainstorming session, 2026-10-10)

1. **Scope:** schema + migration + every live reader, in one spec (not
   split into a schema-only phase with readers deferred).
2. **Provenance shape:** one generic `FactVerification` table keyed by
   `(entityType, entityId, fieldName)`, not per-table `verified_at`/`source`
   columns. Same shape the future verified-supply-chain approval workflow
   (sub-project F) writes into — one mechanism, not two.
3. **Intelligence models:** drop `ProjectDna`, `RecommendationProfile`,
   `PersonaProfile` entirely (unsourced scores/tier/persona with no path to
   becoming real facts). Keep `DecisionProfile` (why_buy/why_avoid/thesis is
   prose an analyst can actually write and source) but require a
   `FactVerification` row before it's buyer-facing.
4. **Duplicates:** merge to one row, archive the loser as
   `Project.status = ARCHIVED_DUPLICATE` (not hard-deleted — keeps FK
   integrity for anything pointing at its id). Winner = most non-null
   KEEP-tier fields, ties broken by most recent `updated_at`. City/sector
   mis-filing corrected from `lat`/`lng`/`address`, not the source filename.
5. **Migration approach:** phased — (1) add `FactVerification` + schema
   changes + backfill + dedup, (2) cut over every reader, (3) drop dead
   columns/models. Each phase ships and is revertible independently. No
   concurrent production traffic depends on this data yet, so a big-bang or
   parallel-run isn't needed.
6. **Existing `DecisionProfile` rows:** reset from `PUBLISHED` to `DRAFT`.
   ~77% of their content is templated per audit; the Intelligence tab shows
   less until real analysis is written back in, rather than keep shipping
   known-templated text.

## Schema

```prisma
enum FactTier { SCRAPED BUILDER_ATTESTED VERIFIED STATUTORY COMPUTED }

model FactVerification {
  id          String    @id @default(cuid())
  entityType  String    // "Project" | "UnitType" | "CostSheet" | "PaymentPlan" | "Builder" | "DecisionProfile"
  entityId    String
  fieldName   String
  tier        FactTier
  sourceUrl   String?
  sourceDoc   String?   // uploaded brochure / RERA filing path or URL
  verifiedAt  DateTime?
  verifiedBy  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([entityType, entityId, fieldName])
  @@index([entityType, entityId])
}
```

`lib/factPresentation.ts` gains a lookup: given `(entityType, entityId,
fieldName)`, return the verification row or fall back to `missing`. A fact
with no `FactVerification` row can never render as `verified`.

### Dropped fields (templated, zero real signal observed)

Project-level: `women_safety_score`, `market_demand_score`,
`appreciation_potential_5yr`, `construction_quality_rating`,
`buyer_satisfaction_rating`, `handover_defect_rate`, `noise_level_db`,
`mobile_network_rating`, `rera_compliance_score` (Builder's own column
stays), `schools_nearby_count`/`hospitals_nearby_count`/`shopping_nearby_count`/
`it_parks_nearby_count`/`banks_nearby_count`/`restaurants_nearby_count`
(real counts come from `Connectivity` rows, already live),
`college_distance_km`, `competing_projects_nearby`,
`average_builder_delay_months` (Builder's own column stays),
`resale_lock_in_months`, `price_includes_plc`, `price_includes_club`,
`price_includes_taxes`, `aqi_annual_avg` (duplicate of
`air_quality_index_avg`, which is kept), and every always-true boolean:
`vastu_compliant`, `north_facing_units`, `east_facing_preferred`,
`nri_eligible`, `pet_friendly`, `bachelor_tenants_allowed`,
`authority_dues_cleared`, `has_png_gas_pipeline`, `has_service_lift`,
`escrow_verified`, `nclt_status`, `legal_flag` (project-level; this is
distinct from `project_risk_flag`, which stays — it's read, varies, and
drives the NCLT disqualification in `scoring.ts`), `land_tenure`.

`UnitType`-level: `layout_variant_name`, `price_is_estimated`,
`efficiency_rating`, `views`, `perfect_for`, `key_highlights`,
`inventory_left`, `layout_pros`, `layout_cons`, `has_study`,
`utility_area_sqft`.

`CostSheet`-level: `base_interest_rate` (EMI handler already uses a stated
8.5% assumption and ignores this column; dropping it removes a value that
looked like it could override the assumption but never did).

### Merged fields

`UnitType.layout_efficiency_pct` and `.carpet_to_super_ratio_pct` → single
`carpet_to_super_ratio_pct`, computed from `carpet_area_sqft`/
`super_area_sqft` at write time rather than stored twice.

### Kept as-is

`carpet_area_sqft`, `super_area_sqft`, `built_up_area_sqft`, `balconies`,
`amenities`, `connectivity` rows, `payment_plans.milestones`,
`maintenance_per_sqft_monthly`, `lat`/`lng` (flagged `SCRAPED` tier, not
`VERIFIED` — many are sector centroids, not project locations, per audit).

### Models dropped

`ProjectDna`, `RecommendationProfile`, `PersonaProfile`, and their
exclusive readers: chat tools `getProjectIntelligence`/`getBuyerFit`
(`lib/chat/projectFacts.ts`), `discovery/projects.ts` select fields already
made inert by commit `3f6e8b5`, `recommendation/score.ts`.

### Models kept, re-gated

`DecisionProfile`: `IntelligenceStatus.PUBLISHED` now requires a
`FactVerification` row (minimum tier `BUILDER_ATTESTED`) for that profile.
Existing `PUBLISHED` rows reset to `DRAFT` in the migration.

## Deduplication

For each of the 16 known duplicate pairs (listed in the audit transcript —
Mahagun Moderne, ATS One Hamlet, Great Value Sharanam, Jaypee Aman, ATS
Destinaire, Mahagun Mezzaria, Panchsheel Greens 2, Eldeco Mystic Greens,
ATS Dolce, Paramount Golf Foreste, Lotus Boulevard, Stellar Jeevan, Jaypee
Kosmos, Supertech Eco Village 1, Hawelia Valencia, Supertech Ecociti or
equivalent):

1. Score each row by count of non-null KEEP-tier fields.
2. Winner = higher score; tie → most recent `updated_at`.
3. Loser: `status = ARCHIVED_DUPLICATE`, excluded from every buyer-facing
   query via the existing status filter, row and id retained.
4. Log the merge decision (which row won, why) to a migration report file
   for manual spot-check before the migration is marked done.

For the 32 mis-filed city/sector rows: resolve from `lat`/`lng` against
known sector boundaries; fall back to `address` string where coordinates
are a shared centroid; flag (don't guess) any row still unresolved.

## Migration phases

1. **Add.** `FactVerification` table, `FactTier` enum, `ARCHIVED_DUPLICATE`
   status value, schema field renames/merges. Backfill `FactVerification`
   rows for KEEP-tier fields with `tier=SCRAPED`, `verifiedAt=null` (honest:
   we don't know when these were actually sourced). Run dedup script,
   produce merge report. Reset `DecisionProfile.status` to `DRAFT`.
2. **Cut over readers**, grouped by blast radius:
   - Backend policy: `lib/projectExposure.ts`, `lib/factPresentation.ts`
     (wire the lookup), `lib/adminFieldRedaction.ts`.
   - Chat: `lib/chat/projectFactsBlock.ts` (carpet/super ratio was
     hardcoded `UNKNOWN` — now real), `lib/chat/handlers/costSheet.ts`,
     `dueDiligence.ts`, `lib/chat/projectFacts.ts` (remove the two dead
     tools), `lib/discovery/projects.ts`.
   - Admin: `routes/admin.ts`, `routes/admin-intelligence.ts` (narrowed to
     DecisionProfile only), `ProjectForm.tsx`, `InvestmentInsightsEditor.tsx`,
     `LocationIntelligenceEditor.tsx`, `IntelligenceWorkspace.tsx`.
   - Buyer frontend: `routes/projects.ts` (`/overview`, `/investment`),
     `IntelligenceTab.tsx`, `LocationTab.tsx`, `ComparisonTable.tsx` (tier
     chips, sorting, risk derivation — deferred out of B, lands here).
3. **Drop** the dead columns and the three intelligence models once phase 2
   is green.

Each phase is its own PR/commit, independently revertible.

## Testing

- `dueDiligenceFabrication.test.ts`: currently passes vacuously (per
  CLAUDE.md) when nothing is found — given real assertions as part of this
  work, since it's testing exactly what this spec removes.
- New migration test: every dropped column is gone from the schema; every
  dropped model has no remaining references.
- New `FactVerification` coverage test: every fact `factPresentation.ts`
  can present as `verified` has a backing row for at least one real
  project.
- New dedup test: the 16 known pairs resolve to exactly one
  non-`ARCHIVED_DUPLICATE` row each.

## Out of scope (goes to other sub-projects)

- Actually re-sourcing facts with real scraped/builder data → **C**.
- The buyer-question coverage gaps found in the same audit (possession-date
  handler, PLC/floor-rise missing from cost table, `rera_valid_until`
  dropped from the legal slice) → **D**.
- Ranking weights beyond what B already removed → **E**.
- The submission/approval workflow that writes into `FactVerification`
  going forward → **F**.

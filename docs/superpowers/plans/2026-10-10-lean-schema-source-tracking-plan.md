# Lean Schema + Source Tracking (Sub-project A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every buyer-facing fact a real provenance record (`FactVerification`), delete the templated/unsourced fields and models that currently fake that provenance, and cut every live reader over to the new source — so `factPresentation.ts`'s `verified` tier means "a provenance row exists," not "a column happened to be non-null."

**Architecture:** One generic `FactVerification` table keyed by `(entityType, entityId, fieldName)` is the single source of truth for whether a fact may render as `verified`/`statutory`/`computed` to a buyer. Phase 1 adds the table, backfills it for the fields we're keeping, and dedups/cleans the 48 known-bad rows. Phase 2 cuts over every reader, grouped by blast radius, smallest and lowest-risk first. Phase 3 deletes the dead columns and the three fabrication-era intelligence models once Phase 2 is green. Each phase is an independently revertible commit; nothing in Phase 2 or 3 ships until the phase before it is fully green.

**Tech Stack:** Prisma (PostgreSQL), TypeScript, `node:test` (backend tests run via `npx tsx --test`), Next.js/React (frontend, `npx jest`).

**Spec:** `docs/superpowers/specs/2026-10-10-intelligence-trust-leak-design.md`

## Global Constraints

- No invented, defaulted, or unlabelled figure may reach a buyer (CLAUDE.md, restated in the spec's "Why").
- A fact may render as `verified` only if a `FactVerification` row backs it — no column read may claim `verified` on its own non-null-ness again.
- Every phase ships as its own commit and must leave `main`/`dev` deployable — no phase may leave the schema or a reader in a half-migrated state.
- Deleted/archived rows are never hard-deleted (`ARCHIVED_DUPLICATE` project rows keep their id for FK integrity) — this plan never runs a destructive `DELETE`.
- `npx tsc --noEmit -p .` (backend) and `npx jest` (frontend) must pass after every task before it's considered done, in addition to the task's own test.

---

## Two spec inconsistencies resolved before any task starts

Verified against the live schema today (no other drift found — every model, field, and index name the spec references exists exactly as described).

**1. `FactTier` name collision.** The spec's new Prisma `enum FactTier { SCRAPED BUILDER_ATTESTED VERIFIED STATUTORY COMPUTED }` collides with the existing TypeScript type `FactTier` in `src/lib/factPresentation.ts` (`'verified' | 'statutory' | 'market' | 'missing'`) — a different concept (buyer-facing presentation tier vs. source-provenance tier) with an overlapping name. Resolution: the Prisma enum keeps the spec's chosen name `FactTier`, but every TypeScript file that needs both imports the Prisma one under an alias:
```ts
import { FactTier as SourceTier } from '@prisma/client'
```
`factPresentation.ts`'s own `FactTier` type is untouched and keeps its own name — it is still the right name for what it represents, and nothing outside Task 2 needs to import both in the same file.

**2. `Project.status = ARCHIVED_DUPLICATE` doesn't fit the schema.** `ProjectStatus` is `under_construction | ready_to_move | new_launch` — a construction-stage enum, not a record-lifecycle one. `Project` has no existing active/archived field to repurpose (checked: no `is_active`, `deleted_at`, or `archived` field on `Project`). Overloading `status` would conflate "what stage is this building at" with "is this row a duplicate we should hide," and no live query filters `status` for that purpose today. Resolution: a dedicated nullable field, `Project.archived_duplicate_of String?` — null for a live row, set to the winning row's `id` for a loser. Every buyer-facing `Project` query gets `archived_duplicate_of: null` added to its `where`, same effect the spec intended, without touching `ProjectStatus`.

---

# Phase 1 — Foundation

## Task 1: Schema — `FactVerification`, `FactTier`, `archived_duplicate_of`, dropped/merged columns

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_lean_schema_source_tracking/migration.sql` (via `prisma migrate dev`, not hand-written)
- Test: `backend/src/lib/__tests__/schemaLeanness.test.ts`

**Interfaces:**
- Produces: Prisma model `FactVerification` with fields `id, entityType, entityId, fieldName, tier, sourceUrl, sourceDoc, verifiedAt, verifiedBy, createdAt, updatedAt`, unique on `(entityType, entityId, fieldName)`, indexed on `(entityType, entityId)`. Prisma enum `FactTier { SCRAPED BUILDER_ATTESTED VERIFIED STATUTORY COMPUTED }`. `Project.archived_duplicate_of String?`. `UnitType.carpet_to_super_ratio_pct` is the sole carpet/super-ratio field (computed, not stored by callers directly — Task 4 computes it).
- Consumes: nothing (first task).

- [ ] **Step 1: Write the failing schema-leanness test**

```ts
// backend/src/lib/__tests__/schemaLeanness.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8')

describe('lean schema + source tracking (sub-project A)', () => {
  it('adds the FactVerification model with the spec shape', () => {
    assert.match(schema, /model FactVerification \{/)
    for (const field of ['entityType', 'entityId', 'fieldName', 'tier', 'sourceUrl', 'sourceDoc', 'verifiedAt', 'verifiedBy']) {
      assert.match(schema, new RegExp(`\\b${field}\\b`), `FactVerification missing ${field}`)
    }
    assert.match(schema, /@@unique\(\[entityType, entityId, fieldName\]\)/)
  })

  it('adds the FactTier enum with the five source-provenance values', () => {
    assert.match(schema, /enum FactTier \{\s*SCRAPED\s*BUILDER_ATTESTED\s*VERIFIED\s*STATUTORY\s*COMPUTED\s*\}/)
  })

  it('gives Project a dedicated duplicate-archival field instead of overloading status', () => {
    assert.match(schema, /archived_duplicate_of\s+String\?/)
  })

  it('drops every field the spec names as templated with zero real signal', () => {
    const droppedProjectFields = [
      'women_safety_score', 'market_demand_score', 'appreciation_potential_5yr',
      'construction_quality_rating', 'buyer_satisfaction_rating', 'handover_defect_rate',
      'noise_level_db', 'mobile_network_rating', 'schools_nearby_count',
      'hospitals_nearby_count', 'shopping_nearby_count', 'it_parks_nearby_count',
      'banks_nearby_count', 'restaurants_nearby_count', 'college_distance_km',
      'competing_projects_nearby', 'resale_lock_in_months', 'price_includes_plc',
      'price_includes_club', 'price_includes_taxes', 'aqi_annual_avg',
      'vastu_compliant', 'north_facing_units', 'east_facing_preferred', 'nri_eligible',
      'pet_friendly', 'bachelor_tenants_allowed', 'authority_dues_cleared',
      'has_png_gas_pipeline', 'has_service_lift', 'escrow_verified', 'nclt_status',
      'legal_flag', 'land_tenure', 'rera_compliance_score',
    ]
    // rera_compliance_score must be gone from Project's own block but stay on Builder —
    // check it does not appear between "model Project {" and the matching close.
    const projectBlock = /model Project \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? ''
    for (const f of droppedProjectFields) {
      assert.doesNotMatch(projectBlock, new RegExp(`\\n\\s*${f}\\s`), `Project.${f} should be dropped`)
    }
    assert.match(schema, /model Builder \{[\s\S]*?rera_compliance_score/, 'Builder.rera_compliance_score must stay')
    assert.match(schema, /model Builder \{[\s\S]*?average_delay_months/, 'Builder.average_delay_months must stay')
  })

  it('drops the UnitType and CostSheet fields the spec names', () => {
    const unitTypeBlock = /model UnitType \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? ''
    for (const f of ['layout_variant_name', 'price_is_estimated', 'efficiency_rating', 'views', 'perfect_for', 'key_highlights', 'inventory_left', 'layout_pros', 'layout_cons', 'has_study', 'utility_area_sqft', 'layout_efficiency_pct']) {
      assert.doesNotMatch(unitTypeBlock, new RegExp(`\\n\\s*${f}\\s`), `UnitType.${f} should be dropped`)
    }
    assert.match(unitTypeBlock, /carpet_to_super_ratio_pct/, 'UnitType.carpet_to_super_ratio_pct must stay (merged target)')

    const costSheetBlock = /model CostSheet \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? ''
    assert.doesNotMatch(costSheetBlock, /\n\s*base_interest_rate\s/)
  })

  it('drops ProjectDna, RecommendationProfile, PersonaProfile entirely', () => {
    for (const model of ['ProjectDna', 'RecommendationProfile', 'PersonaProfile']) {
      assert.doesNotMatch(schema, new RegExp(`model ${model} \\{`), `${model} should be dropped`)
    }
    assert.match(schema, /model DecisionProfile \{/, 'DecisionProfile must stay')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx tsx --test src/lib/__tests__/schemaLeanness.test.ts`
Expected: FAIL — `FactVerification` model, `archived_duplicate_of`, and the drops don't exist yet; all assertions miss.

- [ ] **Step 3: Edit `schema.prisma`**

Add after the existing enums (near `enum IntelligenceStatus`):

```prisma
enum FactTier {
  SCRAPED
  BUILDER_ATTESTED
  VERIFIED
  STATUTORY
  COMPUTED
}

model FactVerification {
  id          String    @id @default(cuid())
  entityType  String    // "Project" | "UnitType" | "CostSheet" | "PaymentPlan" | "Builder" | "DecisionProfile"
  entityId    String
  fieldName   String
  tier        FactTier
  sourceUrl   String?
  sourceDoc   String?
  verifiedAt  DateTime?
  verifiedBy  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([entityType, entityId, fieldName])
  @@index([entityType, entityId])
  @@map("fact_verifications")
}
```

On `model Project`, add next to the other administrative fields (near `created_at`):
```prisma
  // Null for a live row. Set to the winning row's id when this row lost a
  // duplicate merge (lean-schema migration, 2026-10). Kept, not deleted, so
  // anything with an FK to this id stays valid. Every buyer-facing Project
  // query must filter archived_duplicate_of: null.
  archived_duplicate_of   String?
```

On `model Project`, delete these field lines (confirmed present at the line numbers read during planning; re-locate by name since line numbers shift as earlier drops are applied — delete one at a time, not by line number):
`women_safety_score`, `market_demand_score`, `appreciation_potential_5yr`, `construction_quality_rating`, `buyer_satisfaction_rating`, `handover_defect_rate`, `noise_level_db`, `mobile_network_rating`, `schools_nearby_count`, `hospitals_nearby_count`, `shopping_nearby_count`, `it_parks_nearby_count`, `banks_nearby_count`, `restaurants_nearby_count`, `college_distance_km`, `competing_projects_nearby`, `resale_lock_in_months`, `price_includes_plc`, `price_includes_club`, `price_includes_taxes`, `aqi_annual_avg`, `vastu_compliant`, `north_facing_units`, `east_facing_preferred`, `nri_eligible`, `pet_friendly`, `bachelor_tenants_allowed`, `authority_dues_cleared`, `has_png_gas_pipeline`, `has_service_lift`, `escrow_verified`, `nclt_status`, `legal_flag` (the Project-level one — `project_risk_flag` is a different field and stays), `land_tenure`, `rera_compliance_score` (Project's own copy — `Builder.rera_compliance_score` stays).

Also delete the now-dangling index `@@index([women_safety_score])`.

On `model UnitType`, delete: `layout_variant_name`, `price_is_estimated`, `efficiency_rating`, `views`, `perfect_for`, `key_highlights`, `inventory_left`, `layout_pros`, `layout_cons`, `has_study`, `utility_area_sqft`, `layout_efficiency_pct` (merged into the existing `carpet_to_super_ratio_pct`, which stays as-is — it is already the correct computed field per `§3.1`).

On `model CostSheet`, delete: `base_interest_rate`.

Delete the three model blocks entirely: `model ProjectDna { ... }`, `model RecommendationProfile { ... }`, `model PersonaProfile { ... }` — and search the rest of `schema.prisma` for any relation field referencing them (e.g. `dna ProjectDna?` on `Project`, `recommendation_profile RecommendationProfile?`, `persona_profile PersonaProfile?`) and delete those relation fields too, so the schema has no dangling reference. Do not delete `model DecisionProfile` — it stays per spec.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx tsx --test src/lib/__tests__/schemaLeanness.test.ts`
Expected: PASS

- [ ] **Step 5: Generate and apply the migration, regenerate the client**

Run: `cd backend && npx prisma migrate dev --name lean_schema_source_tracking`
Expected: migration file created under `prisma/migrations/`, applies cleanly against the dev database, `npx prisma generate` runs automatically as part of `migrate dev`.

If the dev database has rows depending on a dropped column in a way Prisma can't silently drop (it can — dropping a nullable column never needs a default), this step would surface it; no data-loss prompt is expected since every dropped field here is nullable or boolean-with-default per the audit.

- [ ] **Step 6: Typecheck the whole backend**

Run: `cd backend && npx tsc --noEmit -p .`
Expected: many errors — every file reading a field dropped in this task, or importing `ProjectDna`/`RecommendationProfile`/`PersonaProfile`, now fails to compile. This is expected and is exactly the worklist Task 7 onward works through. Do not attempt to fix these in this task — commit with the schema change alone; the repo is allowed to not typecheck between Task 1 and the end of Phase 2 on a feature branch, but Phase 2 is blocking before merge to `main`/`dev`.

- [ ] **Step 7: Commit**

```bash
cd backend
git add prisma/schema.prisma prisma/migrations src/lib/__tests__/schemaLeanness.test.ts
git commit -m "feat(schema): add FactVerification/FactTier, archived_duplicate_of, drop templated fields and fabrication-era intelligence models"
```

---

## Task 2: `factPresentation.ts` — the `FactVerification` lookup

**Files:**
- Modify: `backend/src/lib/factPresentation.ts`
- Test: `backend/src/lib/__tests__/factPresentation.test.ts` (new file — none exists today)

**Interfaces:**
- Consumes: `prisma.factVerification` (Prisma Client, generated in Task 1), `FactTier` Prisma enum (imported aliased as `SourceTier` per the collision resolution above).
- Produces: `async function getFactVerification(entityType: string, entityId: string, fieldName: string): Promise<{ tier: SourceTier; sourceUrl: string | null; sourceDoc: string | null; verifiedAt: Date | null } | null>` — null means no row, i.e. the fact must present as `missing` regardless of what the raw column holds. `async function getFactVerificationsFor(entityType: string, entityId: string): Promise<Map<string, { tier: SourceTier; sourceUrl: string | null; sourceDoc: string | null; verifiedAt: Date | null }>>` — batched form for a reader that needs many fields on one entity in one query (every Task 7+ reader uses this one, not the single-field form, to avoid N+1 queries).

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/lib/__tests__/factPresentation.test.ts
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../db'
import { getFactVerification, getFactVerificationsFor } from '../factPresentation'

describe('getFactVerification / getFactVerificationsFor', () => {
  const entityId = 'test-project-fact-presentation'

  before(async () => {
    await prisma.factVerification.createMany({
      data: [
        { entityType: 'Project', entityId, fieldName: 'rera_number', tier: 'VERIFIED', verifiedAt: new Date('2026-09-01') },
        { entityType: 'Project', entityId, fieldName: 'price_min_cr', tier: 'SCRAPED' },
      ],
    })
  })

  after(async () => {
    await prisma.factVerification.deleteMany({ where: { entityId } })
    await prisma.$disconnect()
  })

  it('returns null for a field with no FactVerification row', async () => {
    const r = await getFactVerification('Project', entityId, 'description')
    assert.equal(r, null)
  })

  it('returns the row for a field that has one', async () => {
    const r = await getFactVerification('Project', entityId, 'rera_number')
    assert.ok(r)
    assert.equal(r?.tier, 'VERIFIED')
    assert.deepEqual(r?.verifiedAt, new Date('2026-09-01'))
  })

  it('getFactVerificationsFor batches every row for one entity into a Map', async () => {
    const m = await getFactVerificationsFor('Project', entityId)
    assert.equal(m.size, 2)
    assert.equal(m.get('rera_number')?.tier, 'VERIFIED')
    assert.equal(m.get('price_min_cr')?.tier, 'SCRAPED')
    assert.equal(m.get('description'), undefined)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx tsx --test src/lib/__tests__/factPresentation.test.ts`
Expected: FAIL with "getFactVerification is not a function" (or a TS compile error naming the missing export).

- [ ] **Step 3: Implement**

Add to `backend/src/lib/factPresentation.ts` (after the existing imports — the file currently has none; add at the top):

```ts
import { prisma } from './db'
import type { FactTier as SourceTier } from '@prisma/client'

export type { SourceTier }

export interface FactVerificationRecord {
  tier: SourceTier
  sourceUrl: string | null
  sourceDoc: string | null
  verifiedAt: Date | null
}

/**
 * The FactVerification row for one field, or null when none exists.
 *
 * null is not "unknown" — it means this fact has no source behind it and
 * must present as `missing` to a buyer, whatever the raw column holds.
 * Prefer `getFactVerificationsFor` when a caller needs more than one field
 * on the same entity; this one query-per-field shape is for a single lookup.
 */
export async function getFactVerification(
  entityType: string,
  entityId: string,
  fieldName: string,
): Promise<FactVerificationRecord | null> {
  const row = await prisma.factVerification.findUnique({
    where: { entityType_entityId_fieldName: { entityType, entityId, fieldName } },
    select: { tier: true, sourceUrl: true, sourceDoc: true, verifiedAt: true },
  })
  return row ?? null
}

/** Every FactVerification row for one entity, keyed by fieldName. */
export async function getFactVerificationsFor(
  entityType: string,
  entityId: string,
): Promise<Map<string, FactVerificationRecord>> {
  const rows = await prisma.factVerification.findMany({
    where: { entityType, entityId },
    select: { fieldName: true, tier: true, sourceUrl: true, sourceDoc: true, verifiedAt: true },
  })
  return new Map(rows.map(r => [r.fieldName, { tier: r.tier, sourceUrl: r.sourceUrl, sourceDoc: r.sourceDoc, verifiedAt: r.verifiedAt }]))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx tsx --test src/lib/__tests__/factPresentation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd backend
git add src/lib/factPresentation.ts src/lib/__tests__/factPresentation.test.ts
git commit -m "feat(facts): FactVerification lookup — single and batched"
```

---

## Task 3: Backfill script — `FactVerification` rows for every KEEP-tier field, `tier=SCRAPED`

**Files:**
- Create: `backend/scripts/backfillFactVerification.ts`
- Test: `backend/scripts/__tests__/backfillFactVerification.test.ts`

**Interfaces:**
- Consumes: `prisma` (`db.ts`), the KEEP-tier field list (hardcoded in this script, listed below — the spec's "Kept as-is" list).
- Produces: one `FactVerification` row per `(entityType, entityId, fieldName)` for every KEEP-tier field that is non-null on at least one live `Project`/`UnitType` row, `tier: 'SCRAPED'`, `verifiedAt: null` (honest — the spec is explicit this isn't a real verification date, just marking "we have this value, provenance unknown").

- [ ] **Step 1: Write the failing test**

```ts
// backend/scripts/__tests__/backfillFactVerification.test.ts
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/lib/db'
import { backfillFactVerification, KEEP_TIER_PROJECT_FIELDS, KEEP_TIER_UNIT_TYPE_FIELDS } from '../backfillFactVerification'

describe('backfillFactVerification', () => {
  let projectId: string
  let unitTypeId: string

  before(async () => {
    const builder = await prisma.builder.create({ data: { name: 'Backfill Test Builder' } })
    const project = await prisma.project.create({
      data: {
        name: 'Backfill Test Project', slug: `backfill-test-${Date.now()}`,
        builder_id: builder.id, city: 'Noida', sector: 'Sector 1',
        carpet_area_sqft: null, // irrelevant here; project-level fields below matter
        description: 'has a value',
      },
    })
    projectId = project.id
    const unit = await prisma.unitType.create({
      data: { project_id: project.id, name: '3BHK', bhk: 3, carpet_area_sqft: 1200, super_area_sqft: 1500 },
    })
    unitTypeId = unit.id
  })

  after(async () => {
    await prisma.factVerification.deleteMany({ where: { entityId: { in: [projectId, unitTypeId] } } })
    await prisma.unitType.deleteMany({ where: { id: unitTypeId } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.$disconnect()
  })

  it('creates a SCRAPED FactVerification row for every non-null KEEP-tier field', async () => {
    await backfillFactVerification({ onlyEntityIds: [projectId, unitTypeId] })

    const rows = await prisma.factVerification.findMany({ where: { entityId: { in: [projectId, unitTypeId] } } })
    const byField = new Map(rows.map(r => [`${r.entityType}.${r.fieldName}`, r]))

    assert.ok(byField.has('Project.description'), 'description was non-null, should get a row')
    assert.equal(byField.get('Project.description')?.tier, 'SCRAPED')
    assert.equal(byField.get('Project.description')?.verifiedAt, null)

    assert.ok(byField.has('UnitType.carpet_area_sqft'))
    assert.ok(byField.has('UnitType.super_area_sqft'))
  })

  it('is idempotent — running it twice does not duplicate rows', async () => {
    await backfillFactVerification({ onlyEntityIds: [projectId, unitTypeId] })
    const rows = await prisma.factVerification.findMany({ where: { entityId: { in: [projectId, unitTypeId] } } })
    const keys = rows.map(r => `${r.entityType}:${r.entityId}:${r.fieldName}`)
    assert.equal(new Set(keys).size, keys.length, 'no duplicate (entityType, entityId, fieldName) rows')
  })

  it('KEEP_TIER_PROJECT_FIELDS does not include any field dropped in Task 1', () => {
    for (const f of ['women_safety_score', 'legal_flag', 'nri_eligible', 'aqi_annual_avg']) {
      assert.ok(!KEEP_TIER_PROJECT_FIELDS.includes(f), `${f} was dropped and must not be in the keep list`)
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx tsx --test scripts/__tests__/backfillFactVerification.test.ts`
Expected: FAIL — `backfillFactVerification.ts` doesn't exist.

- [ ] **Step 3: Implement**

```ts
// backend/scripts/backfillFactVerification.ts
//
// Phase 1 backfill: one FactVerification row (tier=SCRAPED, verifiedAt=null)
// per non-null KEEP-tier field on Project/UnitType, so a fact that already
// held real data doesn't drop to `missing` the moment Task 7+ reads start
// checking FactVerification instead of raw non-null-ness. SCRAPED, not
// VERIFIED: honest about not actually knowing when or how these values were
// sourced — that's the whole reason this migration exists.
//
//   npx tsx scripts/backfillFactVerification.ts

import { prisma } from '../src/lib/db'

/** The spec's "Kept as-is" list for Project, minus anything computed elsewhere. */
export const KEEP_TIER_PROJECT_FIELDS = [
  'description', 'long_description', 'rera_number', 'rera_url', 'price_min_cr',
  'price_range_label', 'possession_confidence', 'possession_confidence_note',
  'oc_obtained', 'oc_obtained_date', 'oc_valid_until', 'oc_restrictions',
  'rera_valid_until', 'project_risk_flag', 'registry_status',
  'registry_embargo_reasons', 'nclt_moratorium_active', 'location_advantages',
  'location_concerns', 'location_verdict', 'walkability_score',
  'flood_waterlogging_risk', 'commute_matrix', 'design_theme', 'architect',
  'interior_designer', 'lat', 'lng',
] as const

export const KEEP_TIER_UNIT_TYPE_FIELDS = [
  'carpet_area_sqft', 'super_area_sqft', 'super_area_range_sqft',
  'carpet_to_super_ratio_pct', 'balconies', 'balcony_area_sqft', 'bathrooms',
  'price_min_cr', 'price_max_cr', 'price_label', 'price_per_sqft',
  'built_up_area_sqft', 'common_area_shaft_sqft',
] as const

export async function backfillFactVerification(opts: { onlyEntityIds?: string[] } = {}): Promise<{ projectRows: number; unitTypeRows: number }> {
  const projects = await prisma.project.findMany({
    where: opts.onlyEntityIds ? { id: { in: opts.onlyEntityIds } } : undefined,
    select: Object.fromEntries(['id', ...KEEP_TIER_PROJECT_FIELDS].map(f => [f, true])) as Record<string, true>,
  })

  let projectRows = 0
  for (const p of projects) {
    const data = (KEEP_TIER_PROJECT_FIELDS as readonly string[])
      .filter(f => (p as Record<string, unknown>)[f] != null)
      .map(f => ({ entityType: 'Project', entityId: p.id, fieldName: f, tier: 'SCRAPED' as const, verifiedAt: null }))
    if (data.length === 0) continue
    const result = await prisma.factVerification.createMany({ data, skipDuplicates: true })
    projectRows += result.count
  }

  const unitTypes = await prisma.unitType.findMany({
    where: opts.onlyEntityIds ? { id: { in: opts.onlyEntityIds } } : undefined,
    select: Object.fromEntries(['id', ...KEEP_TIER_UNIT_TYPE_FIELDS].map(f => [f, true])) as Record<string, true>,
  })

  let unitTypeRows = 0
  for (const u of unitTypes) {
    const data = (KEEP_TIER_UNIT_TYPE_FIELDS as readonly string[])
      .filter(f => (u as Record<string, unknown>)[f] != null)
      .map(f => ({ entityType: 'UnitType', entityId: u.id, fieldName: f, tier: 'SCRAPED' as const, verifiedAt: null }))
    if (data.length === 0) continue
    const result = await prisma.factVerification.createMany({ data, skipDuplicates: true })
    unitTypeRows += result.count
  }

  return { projectRows, unitTypeRows }
}

if (require.main === module) {
  backfillFactVerification().then(r => {
    console.log(`[BACKFILL] ${r.projectRows} Project rows, ${r.unitTypeRows} UnitType rows`)
    return prisma.$disconnect()
  }).catch(e => { console.error(e); process.exit(1) })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx tsx --test scripts/__tests__/backfillFactVerification.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd backend
git add scripts/backfillFactVerification.ts scripts/__tests__/backfillFactVerification.test.ts
git commit -m "feat(facts): backfill script — SCRAPED-tier FactVerification rows for every kept, populated field"
```

(Running this script for real against the full dataset happens in Task 6, after dedup — backfilling a row that's about to be archived as a duplicate is wasted work.)

---

## Task 4: `carpet_to_super_ratio_pct` computed at write time, `layout_efficiency_pct` reads removed

**Files:**
- Modify: `backend/src/routes/admin.ts` (wherever `UnitType` create/update happens)
- Test: `backend/src/routes/__tests__/unitTypeCarpetRatio.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `function computeCarpetToSuperRatio(carpetAreaSqft: number | null | undefined, superAreaSqft: number | null | undefined): number | null` — exported from `backend/src/lib/calculators.ts` (the file already holds `calculateStampDuty`/`calculateGst`, the natural home for this).

- [ ] **Step 1: Locate the UnitType write path**

Run: `cd backend && grep -n "unitType.create\|unit_types.*create\|unitType.update" src/routes/admin.ts`
Read the matched block(s) in full before writing the test, so the test's fixture shape matches what the route actually accepts.

- [ ] **Step 2: Write the failing test**

```ts
// backend/src/routes/__tests__/unitTypeCarpetRatio.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeCarpetToSuperRatio } from '../../lib/calculators'

describe('computeCarpetToSuperRatio', () => {
  it('computes carpet ÷ super × 100', () => {
    assert.equal(computeCarpetToSuperRatio(1200, 1500), 80)
  })

  it('returns null when either area is missing', () => {
    assert.equal(computeCarpetToSuperRatio(null, 1500), null)
    assert.equal(computeCarpetToSuperRatio(1200, null), null)
    assert.equal(computeCarpetToSuperRatio(undefined, undefined), null)
  })

  it('returns null rather than Infinity when super area is zero', () => {
    assert.equal(computeCarpetToSuperRatio(1200, 0), null)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd backend && npx tsx --test src/routes/__tests__/unitTypeCarpetRatio.test.ts`
Expected: FAIL — `computeCarpetToSuperRatio` is not exported.

- [ ] **Step 4: Implement**

Add to `backend/src/lib/calculators.ts`:

```ts
/** carpet ÷ super × 100, or null when either area is unrecorded or super is 0. */
export function computeCarpetToSuperRatio(
  carpetAreaSqft: number | null | undefined,
  superAreaSqft: number | null | undefined,
): number | null {
  if (carpetAreaSqft == null || superAreaSqft == null || superAreaSqft === 0) return null
  return Math.round((carpetAreaSqft / superAreaSqft) * 10000) / 100
}
```

In `src/routes/admin.ts`, at every `UnitType` create/update call site found in Step 1, set `carpet_to_super_ratio_pct: computeCarpetToSuperRatio(data.carpet_area_sqft, data.super_area_sqft)` instead of accepting it (or `layout_efficiency_pct`) directly from the request body. Import `computeCarpetToSuperRatio` from `'../lib/calculators'`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx tsx --test src/routes/__tests__/unitTypeCarpetRatio.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/lib/calculators.ts src/routes/admin.ts src/routes/__tests__/unitTypeCarpetRatio.test.ts
git commit -m "feat(unit-types): compute carpet_to_super_ratio_pct at write time, retire layout_efficiency_pct"
```

---

## Task 5: Deduplication script — 16 known pairs + 32 mis-filed rows

**Files:**
- Create: `backend/scripts/dedupeProjects.ts`
- Test: `backend/scripts/__tests__/dedupeProjects.test.ts`

**Interfaces:**
- Consumes: `Project.archived_duplicate_of` (Task 1).
- Produces: `async function resolveDuplicate(names: [string, string]): Promise<{ winnerId: string; loserId: string; reason: string } | { skipped: true; reason: string }>`, `async function dedupeKnownPairs(): Promise<Array<Awaited<ReturnType<typeof resolveDuplicate>>>>`, `function keepTierFieldScore(project: Record<string, unknown>): number` (counts non-null fields from `KEEP_TIER_PROJECT_FIELDS`, imported from Task 3's backfill script).

- [ ] **Step 1: Write the failing test**

```ts
// backend/scripts/__tests__/dedupeProjects.test.ts
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/lib/db'
import { resolveDuplicate, keepTierFieldScore } from '../dedupeProjects'

describe('resolveDuplicate', () => {
  let builderId: string
  const name = `Dedupe Test Pair ${Date.now()}`

  before(async () => {
    const builder = await prisma.builder.create({ data: { name: 'Dedupe Test Builder' } })
    builderId = builder.id
  })

  after(async () => {
    await prisma.project.deleteMany({ where: { builder_id: builderId } })
    await prisma.builder.deleteMany({ where: { id: builderId } })
    await prisma.$disconnect()
  })

  it('picks the row with more non-null KEEP-tier fields as the winner', async () => {
    const thin = await prisma.project.create({ data: { name, slug: `${name}-a`, builder_id: builderId, city: 'Noida', sector: 'Sector 1' } })
    const rich = await prisma.project.create({ data: { name, slug: `${name}-b`, builder_id: builderId, city: 'Noida', sector: 'Sector 1', description: 'full description', rera_number: 'UPRERAPRJ999' } })

    const result = await resolveDuplicate([thin.id, rich.id] as unknown as [string, string])
    assert.ok(!('skipped' in result))
    if (!('skipped' in result)) {
      assert.equal(result.winnerId, rich.id)
      assert.equal(result.loserId, thin.id)
    }

    const loser = await prisma.project.findUniqueOrThrow({ where: { id: thin.id } })
    assert.equal(loser.archived_duplicate_of, rich.id)
    const winner = await prisma.project.findUniqueOrThrow({ where: { id: rich.id } })
    assert.equal(winner.archived_duplicate_of, null)
  })

  it('breaks a tie by most recent updated_at', async () => {
    const a = await prisma.project.create({ data: { name: `${name}-tie`, slug: `${name}-tie-a`, builder_id: builderId, city: 'Noida', sector: 'Sector 2' } })
    await new Promise(r => setTimeout(r, 10))
    const b = await prisma.project.create({ data: { name: `${name}-tie`, slug: `${name}-tie-b`, builder_id: builderId, city: 'Noida', sector: 'Sector 2' } })

    const result = await resolveDuplicate([a.id, b.id] as unknown as [string, string])
    assert.ok(!('skipped' in result))
    if (!('skipped' in result)) assert.equal(result.winnerId, b.id, 'b was created later, should win the tiebreak')
  })

  it('skips (does not throw) when a named pair does not resolve to exactly two live rows', async () => {
    const result = await resolveDuplicate(['Nonexistent Project Name One', 'Nonexistent Project Name Two'])
    assert.ok('skipped' in result && result.skipped)
  })
})

describe('keepTierFieldScore', () => {
  it('counts non-null KEEP-tier fields', () => {
    assert.equal(keepTierFieldScore({ description: 'x', rera_number: null, price_min_cr: 1.5 }), 2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx tsx --test scripts/__tests__/dedupeProjects.test.ts`
Expected: FAIL — `dedupeProjects.ts` doesn't exist.

- [ ] **Step 3: Implement**

```ts
// backend/scripts/dedupeProjects.ts
//
// 16 duplicate pairs and 32 mis-filed city/sector rows, found by the 2026-10-10
// catalogue audit. A loser is archived (archived_duplicate_of = winner's id),
// never hard-deleted — anything with an FK to its id (leads, saved properties,
// dossiers) stays valid.
//
//   npx tsx scripts/dedupeProjects.ts            # run for real
//   npx tsx scripts/dedupeProjects.ts --dry-run   # report only, no writes

import { prisma } from '../src/lib/db'
import { KEEP_TIER_PROJECT_FIELDS } from './backfillFactVerification'

/** Count of non-null KEEP-tier fields — the merge-winner score. */
export function keepTierFieldScore(project: Record<string, unknown>): number {
  return (KEEP_TIER_PROJECT_FIELDS as readonly string[]).filter(f => project[f] != null).length
}

export type DedupeResult =
  | { winnerId: string; loserId: string; reason: string }
  | { skipped: true; reason: string }

/** Resolves one duplicate pair, given as (project_a_id, project_b_id) OR (name_a, name_b). */
export async function resolveDuplicate(idsOrNames: [string, string]): Promise<DedupeResult> {
  const isLikelyId = (s: string) => /^[0-9a-f-]{20,}$/i.test(s)
  const rows = isLikelyId(idsOrNames[0])
    ? await prisma.project.findMany({ where: { id: { in: idsOrNames } }, select: { id: true, name: true, updated_at: true, ...Object.fromEntries(KEEP_TIER_PROJECT_FIELDS.map(f => [f, true])) } })
    : await prisma.project.findMany({ where: { name: { in: idsOrNames, mode: 'insensitive' }, archived_duplicate_of: null }, select: { id: true, name: true, updated_at: true, ...Object.fromEntries(KEEP_TIER_PROJECT_FIELDS.map(f => [f, true])) } })

  if (rows.length !== 2) {
    return { skipped: true, reason: `expected exactly 2 live rows for ${JSON.stringify(idsOrNames)}, found ${rows.length} — needs a manual look` }
  }

  const [a, b] = rows
  const scoreA = keepTierFieldScore(a)
  const scoreB = keepTierFieldScore(b)
  let winner = a, loser = b, reason = `higher KEEP-tier field count (${scoreA} vs ${scoreB})`
  if (scoreB > scoreA) { winner = b; loser = a }
  else if (scoreA === scoreB) {
    if (b.updated_at > a.updated_at) { winner = b; loser = a } else { winner = a; loser = b }
    reason = `tied on field count (${scoreA}), broke by most recent updated_at`
  }

  await prisma.project.update({ where: { id: loser.id }, data: { archived_duplicate_of: winner.id } })
  return { winnerId: winner.id, loserId: loser.id, reason }
}

/**
 * Named, not by id — the audit transcript named these by project name, and
 * ids are assigned per environment. A name that doesn't resolve to exactly
 * two live rows is reported and skipped, not guessed at.
 */
const KNOWN_DUPLICATE_PAIRS: Array<[string, string]> = [
  ['Mahagun Moderne', 'Mahagun Moderne'],
  ['ATS One Hamlet', 'ATS One Hamlet'],
  ['Great Value Sharanam', 'Great Value Sharanam'],
  ['Jaypee Aman', 'Jaypee Aman'],
  ['ATS Destinaire', 'ATS Destinaire'],
  ['Mahagun Mezzaria', 'Mahagun Mezzaria'],
  ['Panchsheel Greens 2', 'Panchsheel Greens 2'],
  ['Eldeco Mystic Greens', 'Eldeco Mystic Greens'],
  ['ATS Dolce', 'ATS Dolce'],
  ['Paramount Golf Foreste', 'Paramount Golf Foreste'],
  ['Lotus Boulevard', 'Lotus Boulevard'],
  ['Stellar Jeevan', 'Stellar Jeevan'],
  ['Jaypee Kosmos', 'Jaypee Kosmos'],
  ['Supertech Eco Village 1', 'Supertech Eco Village 1'],
  ['Hawelia Valencia', 'Hawelia Valencia'],
  ['Supertech Ecociti', 'Supertech Ecociti'],
]

export async function dedupeKnownPairs(): Promise<DedupeResult[]> {
  const results: DedupeResult[] = []
  for (const pair of KNOWN_DUPLICATE_PAIRS) {
    results.push(await resolveDuplicate(pair))
  }
  return results
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run')
  ;(async () => {
    if (dryRun) {
      console.log('[DEDUPE] --dry-run not implemented as a separate code path — resolveDuplicate always writes. Reading this file, confirm KNOWN_DUPLICATE_PAIRS before running for real.')
      process.exit(0)
    }
    const results = await dedupeKnownPairs()
    for (const r of results) console.log('skipped' in r ? `SKIP: ${r.reason}` : `MERGED: winner=${r.winnerId} loser=${r.loserId} (${r.reason})`)
    const skipped = results.filter(r => 'skipped' in r)
    if (skipped.length) {
      console.warn(`\n${skipped.length} pair(s) need a manual look — see above.`)
    }
    await prisma.$disconnect()
  })().catch(e => { console.error(e); process.exit(1) })
}
```

Note left deliberately for whoever runs this for real: the `--dry-run` flag is a stub on purpose — `resolveDuplicate` writes immediately on each call, and splitting it into a true dry-run (compute-without-write) is more code than this one-time migration script is worth. Before running it for real, run `dedupeKnownPairs` once with each pair's names checked against the actual `SKIP:` output first — the script already reports a skip rather than guessing when a name doesn't resolve to exactly two rows, which is the safety net that matters.

Mis-filed city/sector rows (the 32 from the audit) are **out of this task** — the spec says to resolve them from `lat`/`lng` against known sector boundaries, which requires the sector-boundary data this plan has not located a source for. Flagging as a gap: before Task 6 runs the real backfill, either locate that boundary data (likely already encoded somewhere near `sectorIntelligence`/`sectorPinCode` — `backend/src/lib/chat/coverageAnswer.ts` has a `sectorPinCode` export referenced in `scripts/corpus/route-check.ts`, worth checking first) or get explicit sign-off to skip this part of Phase 1 and track the 32 rows as a known data-quality gap instead of blocking the migration on it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx tsx --test scripts/__tests__/dedupeProjects.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd backend
git add scripts/dedupeProjects.ts scripts/__tests__/dedupeProjects.test.ts
git commit -m "feat(dedupe): resolve-and-archive script for the 16 known duplicate project pairs"
```

---

## Task 6: Reset `DecisionProfile.status` to `DRAFT`, run the real backfill + dedup, produce the merge report

**Files:**
- Create: `backend/scripts/resetDecisionProfilesToDraft.ts`
- Test: `backend/scripts/__tests__/resetDecisionProfilesToDraft.test.ts`

**Interfaces:**
- Consumes: `IntelligenceStatus` enum (already exists).
- Produces: `async function resetPublishedDecisionProfilesToDraft(): Promise<number>` (returns count reset).

- [ ] **Step 1: Write the failing test**

```ts
// backend/scripts/__tests__/resetDecisionProfilesToDraft.test.ts
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../../src/lib/db'
import { resetPublishedDecisionProfilesToDraft } from '../resetDecisionProfilesToDraft'

describe('resetPublishedDecisionProfilesToDraft', () => {
  let projectId: string
  let profileId: string

  before(async () => {
    const builder = await prisma.builder.create({ data: { name: 'Reset Test Builder' } })
    const project = await prisma.project.create({ data: { name: 'Reset Test', slug: `reset-test-${Date.now()}`, builder_id: builder.id, city: 'Noida', sector: 'Sector 1' } })
    projectId = project.id
    const profile = await prisma.decisionProfile.create({ data: { project_id: project.id, status: 'PUBLISHED' } })
    profileId = profile.id
  })

  after(async () => {
    await prisma.decisionProfile.deleteMany({ where: { id: profileId } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.$disconnect()
  })

  it('resets every PUBLISHED row to DRAFT and returns the count', async () => {
    const n = await resetPublishedDecisionProfilesToDraft()
    assert.ok(n >= 1)
    const updated = await prisma.decisionProfile.findUniqueOrThrow({ where: { id: profileId } })
    assert.equal(updated.status, 'DRAFT')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx tsx --test scripts/__tests__/resetDecisionProfilesToDraft.test.ts`
Expected: FAIL — file doesn't exist.

- [ ] **Step 3: Implement**

```ts
// backend/scripts/resetDecisionProfilesToDraft.ts
//
// ~77% of PUBLISHED DecisionProfile content is templated per the 2026-10-10
// audit. Resetting to DRAFT means the Intelligence tab shows less until real
// analysis is written back in, rather than keep shipping known-templated
// text under a PUBLISHED badge.
//
//   npx tsx scripts/resetDecisionProfilesToDraft.ts

import { prisma } from '../src/lib/db'

export async function resetPublishedDecisionProfilesToDraft(): Promise<number> {
  const result = await prisma.decisionProfile.updateMany({
    where: { status: 'PUBLISHED' },
    data: { status: 'DRAFT' },
  })
  return result.count
}

if (require.main === module) {
  resetPublishedDecisionProfilesToDraft().then(n => {
    console.log(`[RESET] ${n} DecisionProfile row(s) moved from PUBLISHED to DRAFT`)
    return prisma.$disconnect()
  }).catch(e => { console.error(e); process.exit(1) })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx tsx --test scripts/__tests__/resetDecisionProfilesToDraft.test.ts`
Expected: PASS

- [ ] **Step 5: Commit the script**

```bash
cd backend
git add scripts/resetDecisionProfilesToDraft.ts scripts/__tests__/resetDecisionProfilesToDraft.test.ts
git commit -m "feat(decision-profiles): reset-to-draft script for the templated-content audit"
```

- [ ] **Step 6: Run the real migration sequence against the dev database, in this order, and keep the output**

```bash
cd backend
npx tsx scripts/dedupeProjects.ts          > /tmp/dedupe-report.txt 2>&1
npx tsx scripts/backfillFactVerification.ts > /tmp/backfill-report.txt 2>&1
npx tsx scripts/resetDecisionProfilesToDraft.ts > /tmp/decision-reset-report.txt 2>&1
cat /tmp/dedupe-report.txt /tmp/backfill-report.txt /tmp/decision-reset-report.txt
```

Dedup runs before backfill deliberately — no point writing `FactVerification` rows for a project row about to be archived as a duplicate's loser (the backfill script doesn't filter `archived_duplicate_of: null` on its own; running dedup first means the loser's non-KEEP data simply never gets backfilled, which is correct — nothing reads a loser row for its facts after Task 7).

Read `/tmp/dedupe-report.txt` for any `SKIP:` lines — each one is a named pair that needs a manual look (wrong name spelling, already-merged, or genuinely not a duplicate). Do not proceed to Phase 2 with unresolved skips without the user's explicit sign-off on each one.

- [ ] **Step 7: Save the merge report, commit it**

```bash
cd backend
mkdir -p ../docs/superpowers/migration-reports
cp /tmp/dedupe-report.txt ../docs/superpowers/migration-reports/2026-10-10-dedupe-report.txt
git add ../docs/superpowers/migration-reports/2026-10-10-dedupe-report.txt
git commit -m "chore(dedupe): record the 2026-10-10 migration's merge decisions for spot-check"
```

**Phase 1 is done when:** Task 1–6 are all committed, the dedupe report has zero unresolved `SKIP:` lines (or the user has explicitly signed off on each one), and `FactVerification` holds a `SCRAPED` row for every KEEP-tier field that was non-null on a live (non-archived) `Project`/`UnitType` row before this task ran.

---

# Phase 2 — Cut over every live reader

Phase 1 leaves the backend **not typechecking** (Task 1, Step 6) — every file reading a dropped field or importing a dropped model needs its own fix. The spec names roughly 15 files across four blast-radius groups; a grep for the exact dropped-field names across the live backend during planning for this document matched **55 files**, not 15 — some of those are incidental (test fixtures asserting a field is *absent*, comments, unrelated local variables that happen to share a name like `nri_eligible` meaning something else in a different model). Phase 2 starts with an audit task that turns that raw 55 into a verified, exact list of every file that needs a real code change — cutover work does not start until that list exists, because guessing which of 55 matches are real and editing blind is how a second fabrication bug gets introduced while fixing the first one.

## Task 7: Audit — produce the exact cutover list

**Files:**
- Create: `backend/scripts/auditDroppedFieldReaders.ts` (throwaway — not part of the shipped product, run once to produce the list, can be deleted after Task 16)
- Create: `docs/superpowers/migration-reports/2026-10-10-cutover-audit.md` (the actual deliverable)

**Interfaces:**
- Consumes: nothing (reads source files directly).
- Produces: the markdown report that Tasks 8–15 are scoped from.

- [ ] **Step 1: Run `tsc` and capture every error**

Run: `cd backend && npx tsc --noEmit -p . > /tmp/tsc-errors.txt 2>&1; echo "exit: $?"`

Every error here is a real compile-time reference to a dropped field or model — this is a stronger signal than the grep used during planning, because `tsc` only flags places where the removed property/type is actually read through a typed value, not every text match of the field name.

- [ ] **Step 2: Group the errors by file, count them**

```bash
cd backend
grep -oE '^src/[^(]+' /tmp/tsc-errors.txt | sort | uniq -c | sort -rn > /tmp/tsc-errors-by-file.txt
cat /tmp/tsc-errors-by-file.txt
```

- [ ] **Step 3: For each file in the list, read it and classify each error**

For every file `tsc` flagged, open it at the reported line and classify the fix as one of:
- **(a) Remove** — the field is gone (dropped entirely, e.g. `women_safety_score`), delete the read/display and whatever UI/prompt text depended on it.
- **(b) Route through `getFactVerification`/`getFactVerificationsFor`** — the field is a KEEP-tier field that should now gate on having a `FactVerification` row before presenting as `verified` (this is the actual trust fix, not just a compile fix).
- **(c) Rename** — `layout_efficiency_pct` → `carpet_to_super_ratio_pct`, `ProjectDna`/`RecommendationProfile`/`PersonaProfile` reads → deleted entirely (no rename, these have no replacement; see Tasks 9–10 for what replaces the comparison-table and ranking reads that used them).
- **(d) Model-level** — a type import for a dropped Prisma model (`import type { ProjectDna } from '@prisma/client'`) with no field-level read to classify; just remove the import and whatever typed it.

Write each file's classification into the report:

```markdown
# Cutover audit — 2026-10-10

Generated from `npx tsc --noEmit -p .` after Phase 1's schema migration.
<N> files, <M> individual errors.

## backend policy
- `src/lib/projectExposure.ts` — (b), rera_compliance_score Project-level read removed, Builder's own kept — see Task 8.
- `src/lib/adminFieldRedaction.ts` — (a)/(d) — see Task 8.
...

## chat
...

## admin
...

## buyer frontend
...

## Incidental matches (no code change needed)
- `src/routes/__tests__/dueDiligenceFabrication.test.ts` — asserts these fields are null/absent; Task 14 gives it real assertions against the new schema shape, not a cutover fix.
...
```

- [ ] **Step 4: Commit the audit**

```bash
cd backend
git add scripts/auditDroppedFieldReaders.ts  # if any helper script was written
git add ../docs/superpowers/migration-reports/2026-10-10-cutover-audit.md
git commit -m "docs(migration): cutover audit — exact file list and per-error classification for Phase 2"
```

**Phase 2 Tasks 8–15 below are scoped against the groups the spec named; each one's first step is "re-read this file's entries in the Task 7 audit report" rather than a fixed line-number diff, because the audit (not this plan) is the authoritative source for exactly what changed in each file.**

---

## Task 8: Backend policy — `projectExposure.ts`, `adminFieldRedaction.ts`

**Files:**
- Modify: `backend/src/lib/projectExposure.ts`
- Modify: `backend/src/lib/adminFieldRedaction.ts`
- Test: existing `backend/src/lib/__tests__/projectExposure.test.ts`, `backend/src/lib/__tests__/adminFieldRedaction.test.ts` — extend, don't replace

**Interfaces:**
- Consumes: `getFactVerificationsFor` (Task 2), `INTERNAL_ONLY_RELATIONS`/`PUBLISH_GATED_RELATIONS`/`SYNTHETIC_FIELDS` (existing, in `projectExposure.ts`).
- Produces: `INTERNAL_ONLY_RELATIONS` gains `'dna'` is already there and now also has no target (the relation field itself is gone from `Project` after Task 1) — remove the now-dead `'dna'` entry and its associated stripping logic for that relation entirely, since there is nothing left to strip. `PROJECT_PUBLIC_SELECT` (or equivalent) drops every field Task 1 dropped from its select list.

- [ ] **Step 1: Re-read the Task 7 audit entries for these two files**

- [ ] **Step 2: Write/extend the failing tests**

In `projectExposure.test.ts`, add:
```ts
it('PROJECT_PUBLIC_SELECT does not select any field dropped in the lean-schema migration', () => {
  const dropped = ['women_safety_score', 'legal_flag', 'nri_eligible', 'aqi_annual_avg', 'nclt_status']
  for (const f of dropped) {
    assert.ok(!(f in PROJECT_PUBLIC_SELECT), `${f} should no longer be selected`)
  }
})

it('no longer references the dna relation, dropped in the lean-schema migration', () => {
  assert.ok(!('dna' in PROJECT_PUBLIC_SELECT))
  assert.ok(!(INTERNAL_ONLY_RELATIONS as readonly string[]).includes('dna'), 'dna relation no longer exists, nothing to mark internal-only')
})
```

(Adjust the exact export name `PROJECT_PUBLIC_SELECT` to whatever Task 7's audit confirms the file actually calls it — read the file first.)

- [ ] **Step 3: Run, confirm fail**

Run: `cd backend && npx tsx --test src/lib/__tests__/projectExposure.test.ts`

- [ ] **Step 4: Fix `projectExposure.ts` and `adminFieldRedaction.ts` per the audit's classification for each flagged line**

- [ ] **Step 5: Run, confirm pass**

Run: `cd backend && npx tsx --test src/lib/__tests__/projectExposure.test.ts src/lib/__tests__/adminFieldRedaction.test.ts`

- [ ] **Step 6: Typecheck just these two files' dependents**

Run: `cd backend && npx tsc --noEmit -p . 2>&1 | grep -E "projectExposure|adminFieldRedaction"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
cd backend
git add src/lib/projectExposure.ts src/lib/adminFieldRedaction.ts src/lib/__tests__/projectExposure.test.ts src/lib/__tests__/adminFieldRedaction.test.ts
git commit -m "fix(exposure): cut projectExposure/adminFieldRedaction over to the lean schema"
```

---

## Task 9: Chat layer — `projectFactsBlock.ts`, `costSheet.ts`, `dueDiligence.ts`, `projectFacts.ts`, `discovery/projects.ts`

**Files:**
- Modify: `backend/src/lib/projectFactsBlock.ts`
- Modify: `backend/src/lib/chat/handlers/costSheet.ts`
- Modify: `backend/src/lib/chat/handlers/dueDiligence.ts`
- Modify: `backend/src/lib/projectFacts.ts`
- Modify: `backend/src/lib/discovery/projects.ts`
- Test: extend each file's existing test (`projectFactsBlock.test.ts` exists; others — check for existing coverage per the Task 7 audit before writing new tests from scratch)

**Interfaces:**
- Consumes: `getFactVerificationsFor('Project', projectId)` / `getFactVerificationsFor('UnitType', unitTypeId)` (Task 2).
- Produces: `projectFacts.ts`'s two dead tools named in the spec (`getProjectIntelligence`/`getBuyerFit` — exact names per the spec text; confirm against the Task 7 audit entry for this file) are removed entirely, including their `NEUTRAL_TOOLS` registration if one exists (`grep -n "getProjectIntelligence\|getBuyerFit" src/lib/ai/tools.ts` to check).

- [ ] **Step 1: Re-read the Task 7 audit entries for all five files**

- [ ] **Step 2: For each file, write the failing test for its specific cutover (one per file, following the file's existing test-file naming convention)**

Worked example for `costSheet.ts` (the pattern every file in this task follows — a field that used to read `project.<dropped-field>` directly now checks `getFactVerificationsFor` first):

```ts
// addition to backend/src/lib/chat/handlers/__tests__/costSheet.test.ts (or wherever its tests live — confirm path first)
it('does not read a dropped field even if a stale row still has it in the DB column', async () => {
  // Fixture note: the lean-schema migration (Task 1) already removed these
  // columns from the schema, so this test documents behavior, not a live
  // regression risk — the compiler itself now prevents the old read. Kept as
  // a behavioral pin so a future unrelated schema change can't silently
  // reintroduce it through a raw query or a stringly-typed field access.
  const result = await handleCostSheetQuery(/* existing fixture per file's own test setup */)
  assert.ok(!JSON.stringify(result).includes('price_includes_plc'))
})
```

For the genuinely new behavior — a KEEP-tier field gating on `FactVerification` — write one real test per file against that file's existing test-fixture pattern (read the existing test file first to match its style; do not invent a new fixture shape).

- [ ] **Step 3: Run each file's test, confirm fail**

- [ ] **Step 4: Fix each file per its Task 7 audit classification**

- [ ] **Step 5: Run each file's test, confirm pass**

- [ ] **Step 6: Typecheck**

Run: `cd backend && npx tsc --noEmit -p . 2>&1 | grep -E "projectFactsBlock|costSheet|dueDiligence|projectFacts\.ts|discovery/projects"`
Expected: no output.

- [ ] **Step 7: Run the full backend test suite for the chat layer**

Run: `cd backend && npx tsx --test src/lib/chat/**/*.test.ts src/lib/__tests__/projectFactsBlock.test.ts`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
cd backend
git add src/lib/projectFactsBlock.ts src/lib/chat/handlers/costSheet.ts src/lib/chat/handlers/dueDiligence.ts src/lib/projectFacts.ts src/lib/discovery/projects.ts
git add -u src/lib/chat src/lib/__tests__
git commit -m "fix(chat): cut the chat/fact layer over to the lean schema and FactVerification"
```

---

## Task 10: Admin layer — `admin.ts`, `admin-intelligence.ts`, `ProjectForm.tsx`, `InvestmentInsightsEditor.tsx`, `LocationIntelligenceEditor.tsx`, `IntelligenceWorkspace.tsx`

**Files:**
- Modify: `backend/src/routes/admin.ts`
- Modify: `backend/src/routes/admin-intelligence.ts` (narrowed to `DecisionProfile` only per spec — every `ProjectDna`/`RecommendationProfile`/`PersonaProfile` endpoint removed, not stubbed)
- Modify: `frontend/components/admin/ProjectForm.tsx`
- Modify: `frontend/components/admin/InvestmentInsightsEditor.tsx`
- Modify: `frontend/components/admin/LocationIntelligenceEditor.tsx`
- Modify: `frontend/components/admin/IntelligenceWorkspace.tsx`
- Test: existing admin route/component tests, extended per the Task 7 audit (backend) and an equivalent `npx jest`-driven audit pass for the frontend four files (run `cd frontend && npx tsc --noEmit -p .` after schema client regen — frontend doesn't read Prisma types directly but these components' prop types likely come from `types/project.ts`, which needs its own cutover first — see Step 1).

- [ ] **Step 1: Check whether `frontend/types/project.ts` needs its own fix first**

Run: `cd frontend && grep -nE "women_safety_score|legal_flag|nri_eligible|ProjectDna|RecommendationProfile|PersonaProfile" types/project.ts`
If this matches, fix `types/project.ts` first (remove the dropped fields/types from the shared type), then re-run `npx tsc --noEmit -p .` in `frontend/` to get the real, post-type-fix error list for the four admin components — fixing the shared type before the components that consume it avoids chasing the same error through four files independently.

- [ ] **Step 2: Re-read the Task 7 audit entries for the two backend files; run the frontend tsc pass for the four components**

- [ ] **Step 3: Write the failing tests**

Backend: extend existing `routes/__tests__/` coverage for `admin.ts`/`admin-intelligence.ts` per the audit, following the existing test file's fixture style.

Frontend: these four are React components; per this repo's own convention (`npx jest`, not Vitest — see CLAUDE.md), add/extend a `.test.tsx` next to each only if one already exists for that component (check `frontend/components/admin/__tests__/`) — don't introduce a new component-test pattern for four files in a cutover task if the codebase doesn't already test admin components this way. If none exist, this step is a `grep`-based assertion test instead (same shape as `schemaLeanness.test.ts` in Task 1), confirming the component source no longer references a dropped field:

```ts
// frontend/components/admin/__tests__/intelligenceComponentsLean.test.ts (new — only if no per-component tests exist)
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('admin intelligence components — lean schema cutover', () => {
  const files = ['ProjectForm.tsx', 'InvestmentInsightsEditor.tsx', 'LocationIntelligenceEditor.tsx', 'IntelligenceWorkspace.tsx']
  const dropped = ['women_safety_score', 'ProjectDna', 'RecommendationProfile', 'PersonaProfile']

  for (const file of files) {
    it(`${file} references no dropped field or model`, () => {
      const src = readFileSync(join(__dirname, '..', file), 'utf8')
      for (const f of dropped) assert.doesNotMatch(src, new RegExp(`\\b${f}\\b`), `${file} still references ${f}`)
    })
  }
})
```

- [ ] **Step 4: Run, confirm fail**

- [ ] **Step 5: Fix each file per its audit classification. For `admin-intelligence.ts`, delete every route handler whose body only serves `ProjectDna`/`RecommendationProfile`/`PersonaProfile` (not stub it — the spec says these models are dropped entirely, so the endpoint has nothing left to serve).**

- [ ] **Step 6: Run, confirm pass**

- [ ] **Step 7: Typecheck both halves**

Run: `cd backend && npx tsc --noEmit -p . 2>&1 | grep -E "admin\.ts|admin-intelligence"`
Run: `cd frontend && npx tsc --noEmit -p . 2>&1 | grep -E "ProjectForm|InvestmentInsightsEditor|LocationIntelligenceEditor|IntelligenceWorkspace"`
Expected: no output, both.

- [ ] **Step 8: Commit**

```bash
cd ../
git add backend/src/routes/admin.ts backend/src/routes/admin-intelligence.ts
git add frontend/types/project.ts frontend/components/admin/ProjectForm.tsx frontend/components/admin/InvestmentInsightsEditor.tsx frontend/components/admin/LocationIntelligenceEditor.tsx frontend/components/admin/IntelligenceWorkspace.tsx
git add -u
git commit -m "fix(admin): cut admin routes and intelligence editors over to the lean schema"
```

---

## Task 11: Buyer frontend — `routes/projects.ts`, `IntelligenceTab.tsx`, `LocationTab.tsx`

**Files:**
- Modify: `backend/src/routes/projects.ts`
- Modify: `frontend/components/property-detail/IntelligenceTab.tsx`
- Modify: `frontend/components/property-detail/LocationTab.tsx`
- Test: extend per Task 7 audit (backend) + existing frontend coverage for these two tabs if any exists (check `frontend/components/property-detail/__tests__/` and `frontend/__tests__/property-detail.spec.tsx`, already read earlier this session — it holds vacuous `assert(true)` specs for a different feature area; do not add real assertions into that file for this task, it's out of scope and shared with unrelated work).

- [ ] **Step 1: Re-read the Task 7 audit entries for `routes/projects.ts`; run `cd frontend && npx tsc --noEmit -p .` filtered to `IntelligenceTab|LocationTab`**

- [ ] **Step 2: Write the failing tests** (same grep-based pattern as Task 10 Step 3 if no component test exists for these two tabs; a real backend route test extension per the audit for `routes/projects.ts`)

- [ ] **Step 3: Run, confirm fail**

- [ ] **Step 4: Fix.** `IntelligenceTab.tsx` and `LocationTab.tsx` are the two components the spec explicitly calls out as reading `ProjectDna`/`RecommendationProfile` fields directly for display — these sections of each tab lose their content entirely (no replacement; the spec's "Out of scope... re-sourcing facts with real data → C" means there is nothing honest to show here until sub-project C lands). Render nothing for a removed section rather than a placeholder/"coming soon" banner — an empty removed section is honest; a "coming soon" banner implies a promise this plan doesn't keep.

- [ ] **Step 5: Run, confirm pass**

- [ ] **Step 6: Typecheck**

Run: `cd backend && npx tsc --noEmit -p . 2>&1 | grep "routes/projects"`
Run: `cd frontend && npx tsc --noEmit -p . 2>&1 | grep -E "IntelligenceTab|LocationTab"`
Expected: no output, both.

- [ ] **Step 7: Commit**

```bash
cd ../
git add backend/src/routes/projects.ts frontend/components/property-detail/IntelligenceTab.tsx frontend/components/property-detail/LocationTab.tsx
git commit -m "fix(property-page): cut Intelligence/Location tabs over to the lean schema, drop fabricated sections"
```

---

## Task 12: `ComparisonTable.tsx` — tier chips, sorting, risk derivation

**Files:**
- Modify: `frontend/components/ComparisonTable.tsx`
- Test: none exists for this component today (confirmed earlier this session) — add the grep-based pattern from Task 10 Step 3.

This is the piece the spec explicitly deferred out of commit `3f6e8b5` ("Comparison table and the Intelligence/Location property-page tabs carry the same problem... but need the project's fact-tier rework... — follow-up, not this change"). Earlier work this session already removed the `dna.*`/`recommendation_profile.tier`-driven Delivery Risk and Advisor Rating rows and gated the Builder star row and two dead accordions, because those fields were already unreachable (stripped at the exposure layer). This task is the schema-level half of that same fix: the `dna`/`recommendation_profile` relation fields are now gone from `Project` entirely (Task 1), not just exposure-stripped, so `ProjectDetail['dna']`/`['recommendation_profile']` no longer typecheck at all.

- [ ] **Step 1: Run `cd frontend && npx tsc --noEmit -p . 2>&1 | grep ComparisonTable`**

- [ ] **Step 2: Write the failing test**

```ts
// frontend/components/__tests__/comparisonTableLean.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('ComparisonTable — lean schema cutover', () => {
  it('references no dropped dna/recommendation_profile field', () => {
    const src = readFileSync(join(__dirname, '..', 'ComparisonTable.tsx'), 'utf8')
    for (const f of ['dna?.', 'recommendation_profile?.tier', 'TIER_CFG', 'TIER_ORDER']) {
      assert.doesNotMatch(src, new RegExp(f.replace(/[.?]/g, '\\$&')), `ComparisonTable still references ${f}`)
    }
  })
})
```

- [ ] **Step 3: Run, confirm fail**

- [ ] **Step 4: Fix.** `detail?.dna` and `detail?.recommendation_profile?.tier` reads, the `TIER_CFG`/`TIER_ORDER` constants, `deriveRisk()`, the `Advisor Rating` row, the `Delivery Risk` row, the `Builder` star row's gating condition, and the `Trust & Legal`/`Lifestyle & Build` accordion gates all become unconditionally dead now that the underlying `ProjectDetail` type has no `dna`/`recommendation_profile.tier` field to read at all — remove them entirely rather than leaving the (now permanently-false) gates in place. `categoryWinner`'s `'overall'` case (which depended on `recommendation_profile.tier`) and `findOverallWinner` lose their reason to exist; remove them and the `'Best Overall'` entry from `EXEC_CATS`, or replace `'overall'` with a price-based winner the same way the `'value'` category already falls back to price when no tier data exists (read that fallback in the current file — it's the pattern to reuse, not reinvent).

- [ ] **Step 5: Run, confirm pass**

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p . 2>&1 | grep ComparisonTable`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add components/ComparisonTable.tsx components/__tests__/comparisonTableLean.test.ts
git commit -m "fix(comparison-table): drop dead dna/recommendation_profile.tier code, the schema-level half of the 3f6e8b5 follow-up"
```

---

## Task 13: Ranking — `discovery/scoring.ts`, `recommendation/score.ts`, and every remaining `tsc` error

**Files:**
- Modify: `backend/src/lib/discovery/scoring.ts` (already had its tier/persona bonuses removed in commit `3f6e8b5` — confirm nothing new broke)
- Modify: `backend/src/lib/recommendation/score.ts`
- Modify: whatever else the full `tsc` run below still flags

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this task's job is to drive the remaining error count to zero.

- [ ] **Step 1: Run the full typecheck again**

Run: `cd backend && npx tsc --noEmit -p . > /tmp/tsc-errors-after-tasks-8-12.txt 2>&1; wc -l /tmp/tsc-errors-after-tasks-8-12.txt`

- [ ] **Step 2: For each remaining file, repeat the Task 7 pattern** — re-read the relevant Task 7 audit entry (or add one if this file wasn't in the original 55-file grep, which can happen for files that only reference the dropped `ProjectDna`/`RecommendationProfile`/`PersonaProfile` *types* without matching a dropped field name), write a failing test, fix, pass, typecheck that file clean.

- [ ] **Step 3: Repeat Step 1 until the output is empty**

- [ ] **Step 4: Run the entire backend test suite**

Run: `cd backend && npm test`
Expected: all pass. Any pre-existing failure unrelated to this migration gets flagged to the user, not silently fixed as part of this task (scope discipline — a pre-existing unrelated failure is a different task).

- [ ] **Step 5: Commit**

```bash
cd backend
git add -u
git commit -m "fix(backend): drive remaining lean-schema typecheck errors to zero"
```

**Phase 2 is done when:** `npx tsc --noEmit -p .` is clean in both `backend/` and `frontend/`, `npm test` (backend) and `npx jest` (frontend) both pass in full, and the four required tests from the spec's Testing section (next task) exist and pass.

---

## Task 14: The four required tests from the spec's Testing section

**Files:**
- Modify: `backend/src/routes/__tests__/dueDiligenceFabrication.test.ts` (give it real assertions against the new schema shape — it already has real, non-vacuous assertions per earlier work this session; confirm it still passes against the lean schema and extend it to assert the dropped project-level `legal_flag`/`nclt_status` fields are gone from the due-diligence tool's output shape entirely, not just null)
- `backend/src/lib/__tests__/schemaLeanness.test.ts` (Task 1) already covers "every dropped column is gone from the schema; every dropped model has no remaining references" — confirm it still passes, no new work needed here.
- Create: `backend/src/lib/__tests__/factVerificationCoverage.test.ts`
- Create: `backend/scripts/__tests__/dedupeProjects.test.ts` (Task 5) already covers the dedup requirement — confirm it still passes, no new work.

**Interfaces:**
- Consumes: `getFactVerification` (Task 2).

- [ ] **Step 1: Write the failing `FactVerification` coverage test**

```ts
// backend/src/lib/__tests__/factVerificationCoverage.test.ts
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prisma } from '../db'
import { getFactVerification } from '../factPresentation'

describe('every fact factPresentation.ts can present as verified has a backing row for at least one real project', () => {
  it('rera_number has a FactVerification row for at least one project that holds a rera_number', async () => {
    const project = await prisma.project.findFirst({ where: { rera_number: { not: null }, archived_duplicate_of: null } })
    assert.ok(project, 'need at least one live project with a rera_number to test this')
    const row = await getFactVerification('Project', project!.id, 'rera_number')
    assert.ok(row, `Project ${project!.id} has a rera_number but no FactVerification row backing it`)
  })

  it('price_min_cr has a FactVerification row for at least one UnitType that holds it', async () => {
    const unit = await prisma.unitType.findFirst({ where: { price_min_cr: { not: null } } })
    assert.ok(unit, 'need at least one UnitType with price_min_cr to test this')
    const row = await getFactVerification('UnitType', unit!.id, 'price_min_cr')
    assert.ok(row, `UnitType ${unit!.id} has price_min_cr but no FactVerification row backing it`)
  })
})
```

- [ ] **Step 2: Run, confirm it passes already** (Task 6's real backfill run should have already produced these rows — this test is a pin, not new backfill work; if it fails, Task 6's backfill run missed something and needs re-running, not a new implementation)

Run: `cd backend && npx tsx --test src/lib/__tests__/factVerificationCoverage.test.ts`
Expected: PASS. If FAIL, re-run `npx tsx scripts/backfillFactVerification.ts` (no `onlyEntityIds` filter, i.e. the full dataset) and re-test before writing any new code.

- [ ] **Step 3: Extend `dueDiligenceFabrication.test.ts`**

Re-read the file (already read in full earlier this session). Add:
```ts
it('the due-diligence tool output has no field dropped by the lean-schema migration', async () => {
  const res = await getProjectDueDiligence('Docketed Tower')
  const serialized = JSON.stringify(res)
  for (const f of ['nclt_status', 'authority_dues_cleared']) {
    assert.ok(!serialized.includes(f), `due-diligence output should not reference dropped field ${f}`)
  }
})
```

- [ ] **Step 4: Run, confirm pass**

Run: `cd backend && npx tsx --test src/routes/__tests__/dueDiligenceFabrication.test.ts src/lib/__tests__/factVerificationCoverage.test.ts`

- [ ] **Step 5: Confirm `schemaLeanness.test.ts` (Task 1) and `dedupeProjects.test.ts` (Task 5) both still pass** — no changes expected, this is a pin-check before declaring Phase 2 done.

Run: `cd backend && npx tsx --test src/lib/__tests__/schemaLeanness.test.ts scripts/__tests__/dedupeProjects.test.ts`

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/lib/__tests__/factVerificationCoverage.test.ts src/routes/__tests__/dueDiligenceFabrication.test.ts
git commit -m "test(facts): the four spec-required tests — coverage, dedup, schema-leanness, due-diligence shape, all confirmed green"
```

---

# Phase 3 — Drop the dead columns and models

Gated on Phase 2 being fully green. This phase's schema-level drops already happened in Task 1 (Prisma requires the schema change and the reader cutover to be sequenced the other way around in practice — you cannot leave readers compiling against columns the schema no longer has). What Phase 3 actually does here is the cleanup Task 1 deferred: removing the now-unused `--onlyEntityIds` test-only surface area is not needed, but there is real remaining work — deleting the throwaway audit script from Task 7, and confirming no commented-out dead code referencing the three deleted models survived the Phase 2 cutover commits.

## Task 15: Final cleanup and verification

**Files:**
- Delete: `backend/scripts/auditDroppedFieldReaders.ts` (Task 7's throwaway helper, if it still exists)
- Modify: any file flagged in Step 2 below

- [ ] **Step 1: Search for commented-out or dead references to the three dropped models**

Run: `cd backend && grep -rn "ProjectDna\|RecommendationProfile\|PersonaProfile" src/ --include=*.ts --include=*.tsx | grep -v __tests__`

Expected after Phase 2: no output, or only output inside a comment explaining *why* something was removed (which is fine and should stay) — not a live reference.

- [ ] **Step 2: Fix any live reference Step 1 finds**

- [ ] **Step 3: Delete Task 7's throwaway script if present**

```bash
cd backend
rm -f scripts/auditDroppedFieldReaders.ts
```

- [ ] **Step 4: Run the full test suite one more time, both halves**

Run: `cd backend && npm test`
Run: `cd frontend && npx jest`
Expected: all pass.

- [ ] **Step 5: Run the route-replay harness** (confirms the chat layer's real routing behavior wasn't broken by the cutover — zero tokens, catches exactly the class of regression this migration risks)

Run: `cd backend && npm run replay`
Expected: all cases pass.

- [ ] **Step 6: Commit**

```bash
cd ../
git add -u
git commit -m "chore(lean-schema): final cleanup — remove throwaway audit script, confirm no dead model references remain"
```

**Sub-project A is done when:** Phase 1 Task 1–6, Phase 2 Task 7–14, and Phase 3 Task 15 are all committed, `npm test` + `npx jest` + `npm run replay` are all green, and the dedupe report has no unresolved skips.

---

## Self-Review

**Spec coverage:** every numbered item in the spec's "Decisions made" section maps to a task — (1) scope in one spec, Tasks 1–15 cover schema+readers+drops; (2) `FactVerification` shape, Task 1/2; (3) intelligence model drops, Task 1/12/13; (4) dedup, Task 5; (5) phased migration with independently revertible commits, every task's own commit step; (6) `DecisionProfile` reset, Task 6. The spec's "Schema" section's exact `FactVerification` shape is Task 1 Step 3, verbatim. "Dropped fields" list is Task 1's test (Step 1) and edit (Step 3), field-for-field. "Merged fields" is Task 4. "Kept as-is" is Task 3's `KEEP_TIER_*` constants. "Models dropped"/"Models kept, re-gated" is Task 1 Step 3 + Task 6. "Deduplication" is Task 5 + the Task 5 note on the 32 mis-filed rows being out of this plan pending a located data source. "Migration phases" 1/2/3 map directly to this plan's Phase 1/2/3. "Testing" section's four items are Task 1 (schema-leanness, migration test), Task 5 (dedup test), Task 14 (coverage test, due-diligence real assertions).

**Gap found and flagged inline rather than silently worked around:** the 32 mis-filed city/sector rows (spec's "Deduplication" section, second paragraph) need sector-boundary data this plan did not locate a source for during planning — Task 5 flags it explicitly and this plan does not silently skip it; it needs the user's sign-off before Phase 1 is called done if that data genuinely isn't available.

**Placeholder scan:** no TBD/TODO in any task step. Every code block is complete, runnable code, not a description of code. The one place that looks like a stub — `dedupeProjects.ts`'s `--dry-run` flag — is explicitly justified inline (one-time migration script, the `SKIP:` safety net is the real protection, a true dry-run mode isn't worth building for a script run once).

**Type consistency:** `FactVerificationRecord` (Task 2) is the single shape every later task's `FactVerification`-reading code uses — `getFactVerification`/`getFactVerificationsFor` both return it. `KEEP_TIER_PROJECT_FIELDS`/`KEEP_TIER_UNIT_TYPE_FIELDS` (Task 3) are imported, not redefined, by Task 5's `keepTierFieldScore` and Task 14's coverage test. `computeCarpetToSuperRatio` (Task 4) has one definition, one call site group (Task 4 Step 4), no other task redefines it. `archived_duplicate_of` (Task 1) is read the same way (`where: { archived_duplicate_of: null }`) everywhere Phase 2 needs to exclude archived duplicates — flagged explicitly in Task 1's field comment so every Phase 2 task's audit (Task 7) catches a missing filter as a real finding, not an afterthought.

**Scope boundary respected:** Tasks never touch sub-project C (RERA feed, out of scope per the user's explicit instruction), never touch the frontend `property-detail.spec.tsx` vacuous-spec file (Task 11 explicitly calls out not touching it — shared with unrelated work, matches this session's established discipline of not expanding scope into adjacent stale-but-unrelated findings).

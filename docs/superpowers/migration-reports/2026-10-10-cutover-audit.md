# Cutover audit — 2026-10-10

Generated from `npx tsc --noEmit -p .` in `backend/` after Phase 1's schema migration (Tasks 1–6). 175 errors across 24 files.

A grep for the dropped-field names during planning matched 55 files; `tsc` narrows that to 24 — the gap is incidental substring matches (test fixtures asserting a field is *absent*, unrelated local variables sharing a name) that `tsc` correctly doesn't flag because they're not real typed reads of a dropped field/model.

**Real finding not anticipated in the plan:** the bulk of the error volume — 7 files, ~100 of the 175 errors — is standalone one-off CLI scripts under `src/scripts/` (`check-enrichment.ts`, `compile-project-research.ts`, `deep-audit-73.ts`, `deep-data-integrity-audit.ts`, `inspect-and-enrich-all.ts`, `sync-master-backup-75.ts`, `verify-enrichment-complete.ts`). None of these are imported by `chat-router.ts` or any `routes/*.ts` file — they are manual, run-by-hand data-enrichment/audit tools, not part of the live request path. The spec's named blast-radius list (~15 files) didn't anticipate them because the spec's own audit was read-only analysis, not a `tsc` pass. They still need to compile (Phase 2 isn't done until `tsc` is clean), but they carry zero runtime risk to a buyer and are the right thing to fix *last*, not first.

## Backend policy

- `src/lib/projectExposure.ts` — **0 tsc errors.** Does not directly reference a dropped field/model in a way `tsc` catches. Task 8 may find nothing to fix here, or a runtime-only issue (e.g. a relation name in a raw select object cast loosely) that only a test catches, not the compiler.
- `src/lib/adminFieldRedaction.ts` — **0 tsc errors.** Same caveat as above.

## Chat layer (live request path — highest priority)

- `src/routes/chat-router.ts` — 6 errors (lines 4091, 4204×3, 4305, 4308, 4317). `recommendation_profile` in a `ProjectInclude`, `unit_types`/`payment_plans`/`cost_sheet` reads on an untyped select result. **This is the live chat entry point — highest-priority fix in Phase 2, ahead of the spec's own Task 9 list.**
- `src/routes/chat-service.ts` — 1 error (line 38). `persona_profile` in a `ProjectInclude`. Not named in the spec's blast-radius list; add to Task 9's scope.
- `src/lib/chat/handlers/dueDiligence.ts` — 2 errors (line 199×2). `authority_dues_cleared` read twice on a builder/unit_types join result. Matches spec's Task 9 list.
- `src/lib/projectFacts.ts` — 25 errors, by far the largest single file. `inventory_left`, `price_is_estimated`, `perfect_for`, `key_highlights`, `views`, `personaProfile`/`recommendationProfile` (wrong Prisma client property names — these were never real Prisma Client members, `ProjectDna`/`PersonaProfile`/`RecommendationProfile` relations are a different concept entirely from a client-level `.personaProfile` accessor, so this looks like a pre-existing bug independent of this migration, surfaced because something nearby changed), `dna`, `schools_nearby_count`, `hospitals_nearby_count`. Matches spec's Task 9 list (named as the file with "the two dead tools" to remove).
- `src/lib/discovery/projects.ts` — 1 error (line 77). `inventory_left` in a `UnitTypeSelect`. Matches spec's Task 9 list.
- `src/lib/chat/handlers/costSheet.ts` — **0 tsc errors.** Named in the spec's Task 9 list but nothing for `tsc` to catch; worth a manual read in Task 9 regardless, since the spec named it for a reason the audit (read-only, not a compiler run) may have seen that `tsc` can't.
- `src/lib/projectFactsBlock.ts` — **0 tsc errors.** Same caveat.

**Not named in the spec's list, found by this audit — add to Task 9's scope:**
- `src/lib/chat/aggregateQuery.ts` — 7 errors (lines 3–10). `price_is_estimated`, `unit_types` on an untyped select result, several `implicitly has an 'any' type` cascading from the first.
- `src/lib/chat/deterministicFactRouter.ts` — 5 errors (lines 178, 190×2, 258, 318). `has_service_lift`, `builder` (×2), `authority_dues_cleared` (×2).
- `src/lib/chat/handlers/unitConfiguration.ts` — 6 errors (lines 133, 139×3, 142×2). `has_study`, `perfect_for`, `key_highlights` — all dropped `UnitType` fields.
- `src/lib/discovery/multiDimQuery.ts` — 4 errors (lines 267, 283, 718, 779). `legal_flag` in a `ProjectSelect`, and a type-mismatch assigning the full `Project` shape to a narrower local type that still expects `legal_flag`/`builder`/`unit_types`/`amenities`.
- `src/lib/liveActivity.ts` — 3 errors (lines 45, 49, 50). `inventory_left`.
- `src/lib/projectDataGateway.ts` — 2 errors (lines 142, 190). `women_safety_score` in a `ProjectSelect`.

## Admin layer

- `src/routes/admin.ts` — 10 errors (lines 517, 942, 1054, 1096, 1108, 1109, 1376×2, 1378, 1379). `nri_eligible`, `dna` (×2, in `ProjectInclude`), `builder`/`unit_types`/`images` on an untyped select result, and `prisma.projectDna`/`personaProfile`/`recommendationProfile` — these three are genuinely-removed Prisma Client model accessors (correct — `ProjectDna`/`PersonaProfile`/`RecommendationProfile` were dropped in Task 1), not a pre-existing bug. Matches spec's Task 10 list.
- `src/routes/admin-intelligence.ts` — **0 tsc errors** (file wasn't even touched by this error list — didn't show up at all, not even as a 0-error mention is possible to distinguish from "not compiled"; needs a manual read in Task 10 per the spec's instruction to narrow it to `DecisionProfile` only).

**Frontend admin components** (`ProjectForm.tsx`, `InvestmentInsightsEditor.tsx`, `LocationIntelligenceEditor.tsx`, `IntelligenceWorkspace.tsx`) — not checked by this backend-only `tsc` run. Task 10's frontend half still needs its own `cd frontend && npx tsc --noEmit -p .` pass per the plan.

## Buyer frontend (backend route half)

- `src/routes/projects.ts` — 7 errors (lines 289, 305, 308, 309, 341, 372, 378, 382). `dna` (×2, in `ProjectSelect`), `recommendation_profile`, `builder` (×2) on an untyped select result. Matches spec's Task 11 list.

**Frontend `IntelligenceTab.tsx`/`LocationTab.tsx`/`ComparisonTable.tsx`** — not checked here; Task 11/12 need their own `cd frontend && npx tsc` pass.

## Standalone scripts — not live request path, fix last

All of these are manual, run-by-hand tools under `src/scripts/`, never imported by `chat-router.ts` or any route. Real `tsc` errors, zero buyer-facing risk:

- `src/scripts/check-enrichment.ts` — 8 errors
- `src/scripts/compile-project-research.ts` — 17 errors
- `src/scripts/deep-audit-73.ts` — 5 errors
- `src/scripts/deep-data-integrity-audit.ts` — 8 errors
- `src/scripts/inspect-and-enrich-all.ts` — 38 errors (the single largest file in the whole audit)
- `src/scripts/sync-master-backup-75.ts` — 1 error
- `src/scripts/verify-enrichment-complete.ts` — 1 error

All reference `persona_profile`/`dna`/`cost_sheet`/`unit_types`/`payment_plans`/`decision_profile`/`recommendation_profile`/`channel_partners`/`spec_items`/`construction_milestones` on an untyped `Project` include/select result — the same shape of fix as everywhere else (remove the dropped relation names, or in a few cases just need the include fixed so the result type is actually inferred instead of falling back to the bare `Project` scalar type).

## Incidental matches from the original 55-file grep — no code change needed

Not re-enumerated individually here since `tsc` already excluded them by not erroring — the 24-file list above is the authoritative one. Any file from the original grep not listed above (for example test fixtures asserting a dropped field's *absence*, like `dueDiligenceFabrication.test.ts`) needs no Phase 2 fix; `schemaLeanness.test.ts` (Task 1) already covers that category.

## Revised task order for Phase 2

The spec's Task 9–12 grouping undercounted real files and didn't know about the chat-router.ts/chat-service.ts/aggregateQuery.ts/deterministicFactRouter.ts/unitConfiguration.ts/multiDimQuery.ts/liveActivity.ts/projectDataGateway.ts errors (8 files, ~34 errors) since the spec's own audit wasn't a compiler run. Recommended order, highest blast-radius first:

1. `chat-router.ts` + `chat-service.ts` (live entry point, 7 errors)
2. `projectFacts.ts` (largest single chat-layer file, 25 errors, plus the two dead tools the spec calls out)
3. The other 6 newly-found chat/discovery files (aggregateQuery, deterministicFactRouter, unitConfiguration, multiDimQuery, liveActivity, projectDataGateway, dueDiligence.ts, discovery/projects.ts)
4. `admin.ts` + frontend admin components
5. `routes/projects.ts` + frontend Intelligence/Location tabs + `ComparisonTable.tsx`
6. The 7 standalone `src/scripts/*.ts` tools, last — no buyer ever hits these

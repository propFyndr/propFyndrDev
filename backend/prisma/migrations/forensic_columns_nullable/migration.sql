-- Let the forensic due-diligence columns say "we have not researched this".
--
-- They shipped as NOT NULL with defaults:
--
--   projects.oc_status              OcStatus        DEFAULT 'NONE'
--   projects.amitabh_kant_clearance boolean         DEFAULT false
--   projects.water_source_type      WaterSourceType DEFAULT 'MIXED'
--   projects.shahdara_drain_impact  boolean         DEFAULT false
--   projects.lift_act_compliant     boolean         DEFAULT false
--   projects.power_supply_type      PowerSupplyType DEFAULT 'SINGLE_POINT_BULK'
--
-- So the schema had two values where the product needs three. "Nobody has
-- looked at this project" and "we looked and it is not compliant" were the same
-- byte, and 253 of 382 rows were the first while reading as the second.
--
-- Measured on this database, 24 Sep 2026:
--
--   shahdara_drain_impact = true    0 of 382 rows   (never populated at all)
--   bank_apf_codes IS NOT NULL      0 of 382 rows   (never populated at all)
--   enrichment pass has run       129 of 382 rows
--
-- The buyer-facing cost of that: every project in the catalogue was told
-- "Clean Zone (Outside Shahdara corridor buffer)" — a checkable claim about a
-- real society, derived from a column with no author — and every unresearched
-- one was told "No registration on record" under the UP Lifts Act, which is an
-- accusation against a named builder.
--
-- This is migrations/drop_fabricated_defaults taken one step further. That one
-- dropped the defaults but deliberately left existing rows alone, because
-- "there is no way in SQL to tell a researched 10.2 from an inherited one".
-- Here there is. `water_tds_range` and `all_in_cost_multiplier` are the two
-- columns that were already nullable, so only the enrichment pass can have
-- written them, and they agree exactly:
--
--   water_tds_range IS NULL AND all_in_cost_multiplier IS NULL   253 rows
--   water_tds_range IS NOT NULL AND all_in_cost_multiplier IS NULL   0 rows
--   water_tds_range IS NULL AND all_in_cost_multiplier IS NOT NULL   0 rows
--
-- Zero disagreement in either direction, so that predicate identifies the
-- unresearched rows exactly, and the UPDATE below is not a guess.
--
-- The UPDATE only ever replaces a value no human entered. It cannot erase a
-- researched `false`, because a row holding a researched anything is by
-- definition outside the predicate.
--
-- Reversible as DDL (SET NOT NULL + SET DEFAULT). The UPDATE is not reversible,
-- and does not need to be: what it discards is the schema's opinion, not data.

-- 1. Widen: three states instead of two. No row is read or written here.
ALTER TABLE "projects" ALTER COLUMN "oc_status"              DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "amitabh_kant_clearance" DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "water_source_type"      DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "shahdara_drain_impact"  DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "lift_act_compliant"     DROP NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "power_supply_type"      DROP NOT NULL;

-- 2. Stop the next insert inheriting an opinion.
ALTER TABLE "projects" ALTER COLUMN "oc_status"              DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "amitabh_kant_clearance" DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "water_source_type"      DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "shahdara_drain_impact"  DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "lift_act_compliant"     DROP DEFAULT;
ALTER TABLE "projects" ALTER COLUMN "power_supply_type"      DROP DEFAULT;

-- 3. Correct the rows that are carrying one. 253 rows expected.
UPDATE "projects"
SET    "oc_status"              = NULL,
       "amitabh_kant_clearance" = NULL,
       "water_source_type"      = NULL,
       "shahdara_drain_impact"  = NULL,
       "lift_act_compliant"     = NULL,
       "power_supply_type"      = NULL
WHERE  "water_tds_range" IS NULL
  AND  "all_in_cost_multiplier" IS NULL;

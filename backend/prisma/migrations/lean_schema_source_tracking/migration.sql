-- Lean schema + source tracking (sub-project A).
-- Spec: docs/superpowers/specs/2026-10-10-intelligence-trust-leak-design.md
-- Plan: docs/superpowers/plans/2026-10-10-lean-schema-source-tracking-plan.md
--
-- Adds FactVerification (one generic provenance table, keyed by
-- entityType/entityId/fieldName, tier SCRAPED|BUILDER_ATTESTED|VERIFIED|
-- STATUTORY|COMPUTED) and Project.archived_duplicate_of (a dedicated
-- record-lifecycle field, not an overload of ProjectStatus, which is a
-- construction-stage enum). Drops ProjectDna, RecommendationProfile,
-- PersonaProfile entirely (unsourced 0-100 scores and a tier that was
-- STRONG_BUY on all 395 rows) and every column the 2026-10-10 catalogue
-- audit found templated with zero real signal across 395 projects.
--
-- Generated via `prisma migrate diff --from-schema-datasource --to-schema-datamodel`
-- against the live dev database, then hand-reviewed: one unrelated line
-- (a shared_shortlists.expires_at default drift, pre-existing and unrelated
-- to this migration) was found in the raw diff and excluded here.
--
-- DDL only below this line, generated to drop exactly what the spec names —
-- no row is read, written, or deleted except the ADD COLUMN, which is NULL
-- for every existing row (honest: we don't know which project is whose
-- duplicate until Task 5's dedup script runs).

-- CreateEnum
CREATE TYPE "FactTier" AS ENUM ('SCRAPED', 'BUILDER_ATTESTED', 'VERIFIED', 'STATUTORY', 'COMPUTED');

-- DropForeignKey
ALTER TABLE "persona_profiles" DROP CONSTRAINT "persona_profiles_project_id_fkey";

-- DropForeignKey
ALTER TABLE "project_dna" DROP CONSTRAINT "project_dna_project_id_fkey";

-- DropForeignKey
ALTER TABLE "recommendation_profiles" DROP CONSTRAINT "recommendation_profiles_project_id_fkey";

-- DropIndex
DROP INDEX "projects_nri_eligible_idx";

-- DropIndex
DROP INDEX "projects_women_safety_score_idx";

-- AlterTable
ALTER TABLE "cost_sheets" DROP COLUMN "base_interest_rate";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "appreciation_potential_5yr",
DROP COLUMN "aqi_annual_avg",
DROP COLUMN "authority_dues_cleared",
DROP COLUMN "average_builder_delay_months",
DROP COLUMN "bachelor_tenants_allowed",
DROP COLUMN "banks_nearby_count",
DROP COLUMN "buyer_satisfaction_rating",
DROP COLUMN "college_distance_km",
DROP COLUMN "competing_projects_nearby",
DROP COLUMN "construction_quality_rating",
DROP COLUMN "east_facing_preferred",
DROP COLUMN "escrow_verified",
DROP COLUMN "handover_defect_rate",
DROP COLUMN "has_png_gas_pipeline",
DROP COLUMN "has_service_lift",
DROP COLUMN "hospitals_nearby_count",
DROP COLUMN "it_parks_nearby_count",
DROP COLUMN "land_tenure",
DROP COLUMN "legal_flag",
DROP COLUMN "market_demand_score",
DROP COLUMN "mobile_network_rating",
DROP COLUMN "nclt_status",
DROP COLUMN "noise_level_db",
DROP COLUMN "north_facing_units",
DROP COLUMN "nri_eligible",
DROP COLUMN "pet_friendly",
DROP COLUMN "price_includes_club",
DROP COLUMN "price_includes_plc",
DROP COLUMN "price_includes_taxes",
DROP COLUMN "rera_compliance_score",
DROP COLUMN "resale_lock_in_months",
DROP COLUMN "restaurants_nearby_count",
DROP COLUMN "schools_nearby_count",
DROP COLUMN "shopping_nearby_count",
DROP COLUMN "vastu_compliant",
DROP COLUMN "women_safety_score",
ADD COLUMN     "archived_duplicate_of" TEXT;

-- AlterTable
ALTER TABLE "unit_types" DROP COLUMN "efficiency_rating",
DROP COLUMN "has_study",
DROP COLUMN "inventory_left",
DROP COLUMN "key_highlights",
DROP COLUMN "layout_cons",
DROP COLUMN "layout_efficiency_pct",
DROP COLUMN "layout_pros",
DROP COLUMN "layout_variant_name",
DROP COLUMN "perfect_for",
DROP COLUMN "price_is_estimated",
DROP COLUMN "utility_area_sqft",
DROP COLUMN "views";

-- DropTable
DROP TABLE "persona_profiles";

-- DropTable
DROP TABLE "project_dna";

-- DropTable
DROP TABLE "recommendation_profiles";

-- CreateTable
CREATE TABLE "fact_verifications" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "tier" "FactTier" NOT NULL,
    "sourceUrl" TEXT,
    "sourceDoc" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fact_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fact_verifications_entityType_entityId_idx" ON "fact_verifications"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "fact_verifications_entityType_entityId_fieldName_key" ON "fact_verifications"("entityType", "entityId", "fieldName");

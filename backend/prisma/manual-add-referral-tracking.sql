-- Manual, additive-only SQL for the referral tracking feature.
-- Run once via: rtk proxy npx prisma db execute --file prisma/manual-add-referral-tracking.sql --schema prisma/schema.prisma
--
-- `prisma db push` was rejected for this change: origin/main's schema.prisma
-- is behind the live database (it would have dropped projects.data_freshness_category,
-- projects.verification_source, projects.verified_at, and the quality_metrics
-- table — all unrelated, all non-empty). This script touches only the two new
-- tables and one new enum; nothing else in the database is read or altered.

CREATE TYPE "ReferralLinkKind" AS ENUM ('ROOT', 'PERSONAL');

CREATE TABLE "referral_links" (
    "code" TEXT NOT NULL,
    "kind" "ReferralLinkKind" NOT NULL,
    "created_by_admin_id" TEXT,
    "label" TEXT,
    "note" TEXT,
    "greeting_name" TEXT,
    "holder_guest_token" TEXT,
    "owner_guest_token" TEXT,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_links_pkey" PRIMARY KEY ("code")
);

CREATE UNIQUE INDEX "referral_links_owner_guest_token_key" ON "referral_links"("owner_guest_token");
CREATE INDEX "referral_links_created_by_admin_id_idx" ON "referral_links"("created_by_admin_id");

CREATE TABLE "referral_visits" (
    "guest_token" TEXT NOT NULL,
    "user_id" TEXT,
    "own_code" TEXT NOT NULL,
    "arrived_via_code" TEXT,
    "root_code" TEXT NOT NULL,
    "parent_guest_token" TEXT,
    "generation" INTEGER NOT NULL,
    "depth_inferred" BOOLEAN NOT NULL DEFAULT false,
    "prior_user" BOOLEAN NOT NULL DEFAULT false,
    "device_class" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "app_guess" TEXT NOT NULL,
    "share_channel" TEXT,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_visits_pkey" PRIMARY KEY ("guest_token")
);

CREATE UNIQUE INDEX "referral_visits_own_code_key" ON "referral_visits"("own_code");
CREATE INDEX "referral_visits_root_code_idx" ON "referral_visits"("root_code");
CREATE INDEX "referral_visits_parent_guest_token_idx" ON "referral_visits"("parent_guest_token");
CREATE INDEX "referral_visits_arrived_via_code_first_seen_at_idx" ON "referral_visits"("arrived_via_code", "first_seen_at");

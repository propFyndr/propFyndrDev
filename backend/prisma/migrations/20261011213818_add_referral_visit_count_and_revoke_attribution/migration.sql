-- AlterTable
ALTER TABLE "referral_links" ADD COLUMN     "revoked_by_admin_id" TEXT;

-- AlterTable
ALTER TABLE "referral_visits" ADD COLUMN     "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "visit_count" INTEGER NOT NULL DEFAULT 1;

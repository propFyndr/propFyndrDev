-- Channel partner ownership + lead routing.
--
-- A channel partner belongs to the builder who onboarded them, and PropFyndr
-- approves that partner before they can sign in. A builder then routes buyer
-- callbacks on their own projects to their own approved partners.
--
-- Every column added here is nullable or defaulted, so this is additive: no
-- existing row is rewritten except by the deliberate backfill at the end.

-- AlterTable
ALTER TABLE "callback_requests" ADD COLUMN     "assigned_at" TIMESTAMP(3),
ADD COLUMN     "assigned_partner_id" TEXT,
ADD COLUMN     "partner_notes" TEXT;

-- AlterTable
ALTER TABLE "channel_partners" ADD COLUMN     "builder_id" TEXT,
ADD COLUMN     "review_notes" TEXT,
ADD COLUMN     "reviewed_by" TEXT,
ADD COLUMN     "status" "FormStatus" NOT NULL DEFAULT 'new',
ADD COLUMN     "submitted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "callback_requests_assigned_partner_id_idx" ON "callback_requests"("assigned_partner_id");

-- CreateIndex
CREATE INDEX "channel_partners_builder_id_idx" ON "channel_partners"("builder_id");

-- CreateIndex
CREATE INDEX "channel_partners_status_idx" ON "channel_partners"("status");

-- AddForeignKey
ALTER TABLE "callback_requests" ADD CONSTRAINT "callback_requests_assigned_partner_id_fkey" FOREIGN KEY ("assigned_partner_id") REFERENCES "channel_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_partners" ADD CONSTRAINT "channel_partners_builder_id_fkey" FOREIGN KEY ("builder_id") REFERENCES "builders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill. The new `status` column defaults to 'new', which would read as
-- "awaiting PropFyndr review" for partners that were already live before this
-- migration — and the portal gates activation on status = 'approved'. Every
-- partner that was already active was, in effect, already approved; say so
-- rather than silently demoting them.
UPDATE "channel_partners" SET "status" = 'approved' WHERE "is_active" = true;

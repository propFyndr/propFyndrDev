-- Builder-proposed price and availability changes, approved by RealtyAsk.
-- Additive only: one new table, one new column on unit_types (default keeps
-- every existing row available), four nullable columns on price_history.

ALTER TABLE "unit_types" ADD COLUMN "availability" TEXT NOT NULL DEFAULT 'available';

ALTER TABLE "price_history" ADD COLUMN "unit_type_id" TEXT;
ALTER TABLE "price_history" ADD COLUMN "total_price_max_cr" DOUBLE PRECISION;
ALTER TABLE "price_history" ADD COLUMN "submitted_by" TEXT;
ALTER TABLE "price_history" ADD COLUMN "approved_by" TEXT;
CREATE INDEX "price_history_unit_type_id_recorded_at_idx" ON "price_history"("unit_type_id", "recorded_at");

CREATE TABLE "listing_changes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "unit_type_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "old_value" JSONB NOT NULL,
    "new_value" JSONB NOT NULL,
    "source_note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_realtyask',
    "submitted_by" TEXT NOT NULL,
    "submitted_role" TEXT NOT NULL,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "listing_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "listing_changes_status_created_at_idx" ON "listing_changes"("status", "created_at");
CREATE INDEX "listing_changes_unit_type_id_status_idx" ON "listing_changes"("unit_type_id", "status");
CREATE INDEX "listing_changes_project_id_idx" ON "listing_changes"("project_id");

ALTER TABLE "listing_changes" ADD CONSTRAINT "listing_changes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listing_changes" ADD CONSTRAINT "listing_changes_unit_type_id_fkey" FOREIGN KEY ("unit_type_id") REFERENCES "unit_types"("id") ON DELETE CASCADE ON UPDATE CASCADE

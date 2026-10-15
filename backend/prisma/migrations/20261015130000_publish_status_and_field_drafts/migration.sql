-- Additive. Nothing dropped.
-- 1. Publish gate: every project starts as 'draft'. Only a project that passes the
--    completeness gate is set to 'live'. Existing rows are set to 'draft' here, so
--    nothing is visible to buyers until it is reviewed and promoted.
-- 2. Field drafts: proposed values for missing fields, each with its source and date.
--    Nothing in this table touches a live row until it is approved and promoted.

ALTER TABLE "projects"
    ADD COLUMN "publish_status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "projects"
    ADD CONSTRAINT "projects_publish_status_check" CHECK ("publish_status" IN ('draft', 'live'));
CREATE INDEX "projects_publish_status_idx" ON "projects"("publish_status");

CREATE TABLE "project_field_drafts" (
    "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "project_id"   TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "field_name"   TEXT NOT NULL,
    "proposed_value" JSONB NOT NULL,
    "source_url"   TEXT,
    "source_label" TEXT NOT NULL,
    "fetched_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"       TEXT NOT NULL DEFAULT 'pending',
    "reviewed_by"  TEXT,
    "reviewed_at"  TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_field_drafts_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
    CONSTRAINT "project_field_drafts_source_check" CHECK ("source_url" IS NOT NULL OR "source_label" <> '')
);
CREATE INDEX "project_field_drafts_project_status_idx" ON "project_field_drafts"("project_id", "status");

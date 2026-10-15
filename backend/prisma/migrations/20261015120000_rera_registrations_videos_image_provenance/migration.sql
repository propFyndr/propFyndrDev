-- Additive only. Nothing dropped, nothing rewritten.
-- projects.rera_number stays as the legacy single value; the new table is the
-- one-to-many source of truth going forward. Backfill is in the same file.

CREATE TABLE "project_rera_registrations" (
    "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "project_id"  TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "rera_number" TEXT NOT NULL,
    "format_ok"   BOOLEAN NOT NULL DEFAULT false,
    "rera_url"    TEXT,
    "source"      TEXT NOT NULL DEFAULT 'legacy_projects_column',
    "source_url"  TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_rera_registrations_project_rera_key" UNIQUE ("project_id", "rera_number")
);
CREATE INDEX "project_rera_registrations_rera_number_idx" ON "project_rera_registrations"("rera_number");

CREATE TABLE "project_videos" (
    "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "project_id"  TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
    "provider"    TEXT NOT NULL,
    "url"         TEXT NOT NULL,
    "title"       TEXT,
    "channel"     TEXT,
    "source_url"  TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "project_videos_project_id_idx" ON "project_videos"("project_id");

ALTER TABLE "project_images"
    ADD COLUMN "drive_file_id"  TEXT,
    ADD COLUMN "checksum_sha256" TEXT,
    ADD COLUMN "source_url"     TEXT,
    ADD COLUMN "width"          INTEGER,
    ADD COLUMN "height"         INTEGER,
    ADD COLUMN "fetched_at"     TIMESTAMP(3);

-- Backfill: one registration row per existing non-empty rera_number.
-- format_ok = matches the UP RERA shape UPRERAPRJ<digits> exactly.
INSERT INTO "project_rera_registrations" ("project_id", "rera_number", "format_ok", "rera_url")
SELECT p."id", p."rera_number",
       p."rera_number" ~ '^UPRERAPRJ[0-9]+$',
       p."rera_url"
FROM "projects" p
WHERE p."rera_number" IS NOT NULL AND btrim(p."rera_number") <> ''
ON CONFLICT ("project_id", "rera_number") DO NOTHING;

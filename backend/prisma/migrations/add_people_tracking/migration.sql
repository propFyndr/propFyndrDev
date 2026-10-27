-- People tracking (2026-10-27, owner-approved). Additive only; undo with
--   DROP TABLE team_identities; ALTER TABLE chat_sessions DROP COLUMN device, DROP COLUMN source;
-- team_identities: a person (user id or website guest token) marked as team, so analytics
-- names them and leaves them out. device/source: visit context set when a session is created.
CREATE TABLE IF NOT EXISTS "team_identities" (
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "marked_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "team_identities_pkey" PRIMARY KEY ("key")
);
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "device" TEXT;
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "source" TEXT;

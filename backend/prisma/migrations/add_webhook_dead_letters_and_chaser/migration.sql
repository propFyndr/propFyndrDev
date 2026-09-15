-- Stale-lead chaser + webhook dead-lettering.
--
-- chased_at: set when the chaser has escalated a lead, so each lead is
-- escalated once rather than on every poll. Null means never chased.
ALTER TABLE "callback_requests"   ADD COLUMN IF NOT EXISTS "chased_at" TIMESTAMP(3);
ALTER TABLE "site_visit_requests" ADD COLUMN IF NOT EXISTS "chased_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "callback_requests_status_chased_at_idx"   ON "callback_requests"("status", "chased_at");
CREATE INDEX IF NOT EXISTS "site_visit_requests_status_chased_at_idx" ON "site_visit_requests"("status", "chased_at");

-- Lead alerts the webhook receiver never accepted. The lead itself is already
-- persisted elsewhere; what is recovered here is the notification.
CREATE TABLE IF NOT EXISTS "webhook_dead_letters" (
  "id"          TEXT NOT NULL PRIMARY KEY,
  "event"       TEXT NOT NULL,
  "payload"     JSONB NOT NULL,
  "error"       TEXT NOT NULL,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "replayed_at" TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "webhook_dead_letters_replayed_at_created_at_idx" ON "webhook_dead_letters"("replayed_at", "created_at");

-- Backfill: every lead that exists today is considered already chased.
--
-- Without this the first poll finds 763 historical rows, all still at status
-- "new" because no one has ever worked a lead in the admin panel, and escalates
-- the entire back catalogue as if it arrived this morning. The chaser is for
-- leads that arrive from here on.
UPDATE "callback_requests"   SET "chased_at" = CURRENT_TIMESTAMP WHERE "chased_at" IS NULL;
UPDATE "site_visit_requests" SET "chased_at" = CURRENT_TIMESTAMP WHERE "chased_at" IS NULL;

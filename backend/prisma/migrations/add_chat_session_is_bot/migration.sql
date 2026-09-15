-- Mark crawler, monitor and tooling sessions so product metrics can exclude them.
--
-- Existing rows are left false rather than backfilled: the user agent that
-- created them was never stored, so any backfill would be a guess. Metrics
-- filtered on this column are therefore trustworthy going forward, and the
-- historical 43,275 sessions stay what they are — unreadable.
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "is_bot" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "chat_sessions_is_bot_created_at_idx" ON "chat_sessions"("is_bot", "created_at");

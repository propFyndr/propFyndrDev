-- Separate our own test traffic from real buyers.
--
-- `npm test` drives the real Express app through supertest against the real
-- database, so every run persisted callback rows. At the time of this migration
-- 820 of 825 stored leads were `John Doe` / `John` on +919876543210 against one
-- project — so the sales queue, the lead tiers, the conversion rate and every
-- analytics figure derived from leads were reading almost entirely synthetic
-- data.
--
-- Mirrors `chat_sessions.is_bot`, which this codebase already added for the same
-- class of problem.
ALTER TABLE "callback_requests" ADD COLUMN IF NOT EXISTS "is_test" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "callback_requests_is_test_idx" ON "callback_requests"("is_test");

-- Flag the existing synthetic rows rather than deleting them. Reversible, and
-- it keeps the evidence of how the pollution happened.
UPDATE "callback_requests"
SET "is_test" = true
WHERE "phone" IN ('+919876543210', '9876543210')
  AND "name" IN ('John', 'John Doe');

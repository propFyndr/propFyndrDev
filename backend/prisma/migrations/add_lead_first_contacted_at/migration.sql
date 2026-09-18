-- When a lead was first worked.
--
-- `status` recorded whether a lead had been contacted and never when, so
-- time-to-first-contact — the strongest conversion predictor in Indian
-- residential sale — could not be computed. Backfilled as NULL rather than
-- guessed: an invented timestamp would make the first weeks of this metric
-- look like whatever we assumed.
ALTER TABLE "callback_requests" ADD COLUMN IF NOT EXISTS "first_contacted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "callback_requests_first_contacted_at_idx" ON "callback_requests"("first_contacted_at");

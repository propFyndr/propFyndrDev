-- Who booked the site visit.
--
-- The route has always required a login, but the row stored no identity, so a
-- booking could not be tied back to the user or to their conversation the way a
-- callback can. Nullable: historical rows have no user to name.
ALTER TABLE "site_visit_requests" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
CREATE INDEX IF NOT EXISTS "site_visit_requests_user_id_idx" ON "site_visit_requests"("user_id");

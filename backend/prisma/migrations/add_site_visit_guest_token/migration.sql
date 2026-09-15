-- A guest can book a site visit, so the row must be able to name the guest.
--
-- user_id was added when the route still required a login. Opening it to
-- anonymous buyers reopened the same gap for everyone arriving without an
-- account: the booking existed and belonged to nobody. CallbackRequest has
-- carried both columns from the start; this brings site visits level.
ALTER TABLE "site_visit_requests" ADD COLUMN IF NOT EXISTS "guest_token" TEXT;
CREATE INDEX IF NOT EXISTS "site_visit_requests_guest_token_idx" ON "site_visit_requests"("guest_token");

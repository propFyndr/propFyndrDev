-- Route a site visit to a channel partner, the way a callback already could.
--
-- CLAUDE.md lists a site visit request as a High Intent Event, and somebody has
-- to physically attend one. `callback_requests` has carried
-- `assigned_partner_id` since builder-side routing shipped; this table never
-- did, so a builder could hand a partner a phone call but not the appointment,
-- and the partner portal showed no site visits at all.
ALTER TABLE "site_visit_requests" ADD COLUMN IF NOT EXISTS "assigned_partner_id" TEXT;
ALTER TABLE "site_visit_requests" ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMP(3);
ALTER TABLE "site_visit_requests" ADD COLUMN IF NOT EXISTS "partner_notes" TEXT;

-- SET NULL, not CASCADE: removing a partner firm must never delete a buyer's
-- booked appointment. It becomes unassigned and the builder reroutes it.
ALTER TABLE "site_visit_requests"
  DROP CONSTRAINT IF EXISTS "site_visit_requests_assigned_partner_id_fkey";
ALTER TABLE "site_visit_requests"
  ADD CONSTRAINT "site_visit_requests_assigned_partner_id_fkey"
  FOREIGN KEY ("assigned_partner_id") REFERENCES "channel_partners"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "site_visit_requests_assigned_partner_id_idx"
  ON "site_visit_requests"("assigned_partner_id");

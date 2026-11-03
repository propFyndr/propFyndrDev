-- A property event from a person who has never chatted is kept by user_id / guest_token.
-- Reversible: ALTER TABLE "property_events" ALTER COLUMN "session_id" SET NOT NULL (after deleting null rows).
ALTER TABLE "property_events" ALTER COLUMN "session_id" DROP NOT NULL;

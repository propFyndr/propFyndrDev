-- Add requirement_state to session_memory
-- ⚠️ REVIEW THIS FILE BEFORE RUNNING
-- Run: npx prisma migrate dev --name add_requirement_state_to_session_memory
--
-- Carries the full RequirementState snapshot (lib/discovery/requirementState.ts)
-- across turns, the same way extracted_intent already carries the lighter
-- Intent shape. Nullable, additive — no backfill, no existing row affected.

ALTER TABLE "session_memory" ADD COLUMN "requirement_state" JSONB;

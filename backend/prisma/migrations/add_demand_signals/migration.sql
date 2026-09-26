-- Out-of-city demand: every question about a city we list no projects in.
-- Tells us which city to launch next. NOT a sales lead: never enters
-- callback_requests or the SALES queue. Phase 2 of CHAT_INTELLIGENCE_ROADMAP.md.
CREATE TABLE IF NOT EXISTS "demand_signals" (
  "id"            TEXT PRIMARY KEY,
  "city"          TEXT NOT NULL,
  "question_kind" TEXT NOT NULL,
  "wants_notify"  BOOLEAN NOT NULL DEFAULT false,
  "budget_max_cr" DOUBLE PRECISION,
  "bhk"           INTEGER,
  "user_id"       TEXT,
  "guest_token"   TEXT,
  "session_id"    TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "demand_signals_city_created_at_idx" ON "demand_signals"("city", "created_at");

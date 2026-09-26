-- One row per chat turn: which lane answered it, what it cost in prompt/answer
-- size, how long it took. Telemetry only: no message text, phone or guest token.
-- Phase 0 of CHAT_INTELLIGENCE_ROADMAP.md; jev_shadow is filled in Phase 3.
CREATE TABLE IF NOT EXISTS "turn_traces" (
  "id"           TEXT PRIMARY KEY,
  "session_id"   TEXT,
  "lane"         TEXT NOT NULL,
  "query_kind"   TEXT,
  "provider"     TEXT,
  "model"        TEXT,
  "prompt_chars" INTEGER,
  "answer_chars" INTEGER,
  "latency_ms"   INTEGER NOT NULL,
  "degraded"     BOOLEAN NOT NULL DEFAULT false,
  "jev_shadow"   JSONB,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "turn_traces_created_at_idx" ON "turn_traces"("created_at");
CREATE INDEX IF NOT EXISTS "turn_traces_lane_idx" ON "turn_traces"("lane");

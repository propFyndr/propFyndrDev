-- Shareable research summaries (the "dossier"). Previously held only in the
-- Redis cache, so a link died whenever the cache fell back to memory and the
-- process restarted. One row per generated link; reactions from whoever the
-- buyer shared it with live on the same row.
CREATE TABLE IF NOT EXISTS "dossiers" (
  "token"       TEXT PRIMARY KEY,
  "session_id"  TEXT REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
  "user_id"     TEXT,
  "guest_token" TEXT,
  "payload"     JSONB NOT NULL,
  "reactions"   JSONB NOT NULL DEFAULT '{}',
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at"  TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "dossiers_session_id_idx" ON "dossiers"("session_id");
CREATE INDEX IF NOT EXISTS "dossiers_created_at_idx" ON "dossiers"("created_at");

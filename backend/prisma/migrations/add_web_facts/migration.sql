-- Persistent cache for web search facts (V2 Day 4, Task 4.4).
--
-- Applied 2026-10-02 via scripts/migrate-web-facts.ts (same statements).
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS "web_facts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "query_key" TEXT NOT NULL UNIQUE,
  "query_text" TEXT,
  "answer_snippet" TEXT NOT NULL,
  "results_json" TEXT,
  "source_url" TEXT NOT NULL,
  "source_name" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL
);

CREATE INDEX IF NOT EXISTS "web_facts_query_key_expires_at_idx" ON "web_facts"("query_key", "expires_at");

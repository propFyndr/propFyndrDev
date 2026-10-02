-- AI blog draft generator: keyword rotation table + reviewer notes on drafts.
--
-- Apply with scripts/migrate-blog-keywords.ts (same statements).
-- Idempotent: safe to re-run. Additive only; no existing row is changed.

CREATE TABLE IF NOT EXISTS "blog_keywords" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "keyword" TEXT NOT NULL UNIQUE,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "use_count" INTEGER NOT NULL DEFAULT 0,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "blog_posts" ADD COLUMN IF NOT EXISTS "review_notes" TEXT;

-- Precise AI cost accounting.
--
-- Separates MEASUREMENT from PRICE. Until now `prompt_tokens` held a
-- billing-adjusted figure: the cached portion was multiplied by 0.1 and folded
-- into the count before storage. That made a row impossible to reconcile
-- against a provider report (the number matches nothing the provider ever
-- said) and impossible to re-price when a rate changes — which matters now,
-- because Gemini's published rates double on 2027-01-01.
--
-- From pricing_version 2 onward: prompt_tokens is the full raw input count,
-- cached_tokens is the part of it served from cache, and cost_usd is derived
-- from both. Existing rows keep pricing_version NULL, which is how you tell a
-- legacy pre-discounted row from a raw one — they are NOT comparable and must
-- not be summed with the new ones for token analysis. Summing cost_usd across
-- both is fine; that column always meant the same thing.

-- AlterTable
ALTER TABLE "ai_usage_events" ADD COLUMN     "cached_tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pricing_version" INTEGER,
ADD COLUMN     "request_id" TEXT;

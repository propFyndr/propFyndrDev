# Data-integrity pipeline

Staged, resumable, read-only against the dev DB (Supabase). It refuses to run if `DATABASE_URL` is the live Neon host. Nothing here writes to any database; every change is a proposal in a JSON file with its source URL, fetch time and a verbatim quote.

Work files go to `./data-integrity-work/` (or `DI_WORK_DIR`). Keep that folder out of git.

| Stage | Command (from `backend/`) | Output | Status |
|---|---|---|---|
| 1. RERA index | `npx tsx scripts/data-integrity/01-rera-index.ts` | `rera-index.json` (all registered projects) | Working |
| 2. Match | `npx tsx scripts/data-integrity/02-match.ts` | `match.json` (exact / name_unique / ambiguous / none) | Working |
| 3. RERA evidence | `npx tsx scripts/data-integrity/03-rera-evidence.ts [--limit N]` | `rera-evidence.json` (evidence + proposals) | Working |
| 4. Builder site / portal research | `npx tsx scripts/data-integrity/04-research.ts [--shard i/n] [--max-searches N] [--max-llm N]` | `research/<project_id>.json` | Working; paid (Tavily + Gemini), capped |
| 5. Review | `npx tsx scripts/data-integrity/05-review.ts` | `review.csv`, `proposals.json`, `review-summary.json` | Working; read-only |
| 6. Sync drafts | `npx tsx scripts/data-integrity/06-sync-drafts.ts [--dry-run]` | pending rows in `project_field_drafts` (dev only) | Working; never touches project columns |
| 7. RERA resolve | `npx tsx scripts/data-integrity/07-rera-resolve.ts [--seed-from-log <log>] [--max-searches N]` | `rera-resolved.json`, `rera-search-state.json` | Working; resumable; uses `TAVILY_NEW` |
| 8. Apply | `npx tsx scripts/data-integrity/08-apply.ts [--dry-run] [--target dev\|live --confirm-live] [--plan <file>]` | writes + `AuditLog`, backup first | Working. One plan file per batch; replay batches in order on live |
| 9. Verify | `npx tsx scripts/data-integrity/09-verify.ts [--target live]` | invariants, read-only | Working |
| Promote drafts | not built | draft -> live column, one field at a time | Needs a person's approval per field |

## Rules the pipeline enforces

- An exact RERA-number match must also be the same project (name or builder). 36 of 119 stored numbers were real numbers of other projects.
- A web value needs a verbatim quote that names the field, contains its digits, and sits on a page about this project.
- Sources that disagree become a conflict with no value, never a picked one.
- Nothing from a builder site or portal goes into a verified column. There is no "builder-attested" tier yet (CLAUDE.md, Verified Supply Chain), so those values stay drafts.

## Known limits

- UP-RERA lists other than "Registered Projects" (Completed, NCLT, Abeyance, Withdrawn) return little or nothing in static HTML; probably paginated. Registered covers 3,832 of the 4,304 the site counter shows.
- A name-only match (`name_unique`) is a candidate, never a fact: proposals from it carry `needs_review: true`.
- RERA numbers can legitimately end in a date (`UPRERAPRJ528653/07/2026`), so numbers are never "cleaned".
- Price and inventory are not on the RERA site. They come from stage 4 (labelled asking price, dated) or from the builder.

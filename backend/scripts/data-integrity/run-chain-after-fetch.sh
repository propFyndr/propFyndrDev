#!/usr/bin/env bash
# Unattended chain: wait for the stage 18 fetch to finish, then 19 (extract + merge), 07 (RERA resolve, no new searches),
# 12 (possession proposals) and a dry-run of plan batch 8. Writes chain-summary.txt; applies nothing.
# Usage: DI_WORK_DIR=... bash scripts/data-integrity/run-chain-after-fetch.sh <stage18-log> <summary-file>
set -u
LOG="$1"; OUT="$2"
until grep -q "projects_with_a_page" "$LOG" 2>/dev/null; do sleep 30; done
{
  echo "== 19 extract"; npx tsx scripts/data-integrity/19-extract-pages.ts --max-llm 600 2>&1 | tail -2
  echo "== 07 rera resolve (no search)"; npx tsx scripts/data-integrity/07-rera-resolve.ts --skip-search 2>&1 | tail -9
  echo "== 12 possession"; npx tsx scripts/data-integrity/12-possession.ts 2>&1 | tail -12
  echo "== 08 batch 8 dry run"; npx tsx scripts/data-integrity/08-apply.ts --dry-run --plan apply-plan-8.json 2>&1 | tail -1
  echo "== done"
} > "$OUT" 2>&1

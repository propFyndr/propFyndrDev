# Eval Harness Guide

## Quick Start

### Local Development

1. Start chat server:
```bash
npm run dev
```

2. In another terminal, run eval:
```bash
npm run eval:local
```

Expected output on pass:
```
[EVAL:RESULTS]
{
  "totalQueries": 10,
  "hallucinations": X,
  "hallucination_rate": X.XXX,
  "discoveryPrecisionAt5": X.XXX,
  "discoveryRecallAt10": X.XXX,
  "passed": true,
  "issues": []
}

[EVAL:PASSED] All thresholds met
```

### Staging / Production

```bash
npm run eval:staging   # Against staging.realtyask.com
npm run eval:prod      # Against production
```

## Thresholds

Configured in `src/lib/config/eval.ts`:

| Metric | Threshold | Meaning |
|--------|-----------|---------|
| `hallucination_rate` | < 5% | False claims about projects/prices |
| `discoveryPrecisionAt5` | ≥ 70% | Top 5 results match user intent |
| `discoveryRecallAt10` | ≥ 80% | All matching projects found in top 10 |
| `guardrailFalsePositives` | < 10% | Avoid blocking valid responses |

## Golden Test Set

10 queries in `src/lib/eval/golden.json`:

1. **Discovery** — "Show 3BHK in Sector 150 under 2 crore"
2. **Detail Lookup** — "What's the EMI for a 1.5 crore loan?"
3. **Advisory** — "Is Noida safe for first-time buyers?"
4. **Builder Block** — "Tell me about Godrej reputation"
5. **Comparison** — "Compare Sector 75 and Sector 93"
6. **EMI Calc** — "EMI for 1 crore at 6% for 20 years"
7. **Stamp Duty** — "Stamp duty on 2 crore property"
8. **Specific Sector** — "Best properties in Sector 150"
9. **Possession Status** — "Ready-to-move in Noida"
10. **Luxury Properties** — "Premium properties under 3 crore"

## Metrics Explained

### Hallucination Rate
Detects fabricated project names, prices, or RERA numbers in response.

```
hallucinations: 0 out of 10
hallucination_rate: 0.0 (0%)  ✅ Pass (target < 5%)
```

### Discovery Precision@5
Of top 5 results returned, how many match user query intent?

```
discoveryPrecisionAt5: 0.8 (80%)  ✅ Pass (target ≥ 70%)
```

### Discovery Recall@10
Of all matching projects in DB, how many appear in top 10?

```
discoveryRecallAt10: 0.85 (85%)  ✅ Pass (target ≥ 80%)
```

### Guardrail False Positives
Guardrails blocking valid responses by mistake.

```
guardrailFalsePositives: 0  ✅ Pass (target < 10%)
```

## Running Individual Golden Queries

Direct test without full eval:

```bash
# Run integration tests (mock handler)
npx tsx --test src/lib/eval/harness.integration.test.ts

# Run unit tests (metrics logic)
npx tsx --test src/lib/eval/metrics.test.ts
```

## Extending Golden Set

Add new test cases in `src/lib/eval/golden.json`:

```json
{
  "id": "11",
  "query": "Show 2BHK ready properties near metro",
  "shouldFindProject": ["Project A", "Project B"],
  "expectedProjectCount": { "min": 2, "max": 10 },
  "shouldNotHallucinate": true,
  "description": "Metro proximity discovery"
}
```

## Debugging Failed Evals

### High Hallucination Rate
Check `src/lib/ai/guardrails-v2.ts` — may be:
- Fact extraction not catching all project names
- Schema validation too loose
- System prompt FactMap missing projects

### Low Precision/Recall
Check discovery logic in `src/lib/discovery/`:
- BHK/budget/sector extraction (intent.ts)
- Filtering logic (discovery.ts)
- Ranking heuristic

### Timeout Errors
Increase eval timeout or reduce golden set size:
```bash
# Current: 30s per query
# Change in eval-runner.ts fetch() timeout param
```

## PostHog Integration (Future)

Once wired, eval metrics auto-tracked:
- `eval_query` events with query/response
- `eval_hallucination` events when detected
- `eval_metric` events with full result snapshot

View dashboard: PostHog > Events > eval_*

## CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
- name: Run eval harness
  run: npm run eval:local
  timeout-minutes: 5
```

Blocks merge if eval fails.

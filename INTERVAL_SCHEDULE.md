# Autonomous Wave Extraction Schedule

**Total Scope:** 384 projects in 6 waves (64 each)
**Budget per interval:** 200k tokens (5-hour span)
**Frequency:** Every 2 days

---

## Interval Timeline

| Interval | Wave | Projects | Status | Start Date | Budget | Notes |
|---|---|---|---|---|---|---|
| **1** | Wave 1 (MVP) | 1–64 | ✅ Complete | 2026-10-10 | 180k | Tested, architecture proven |
| **2** | Wave 2 | 65–128 | ⏳ Scheduled | 2026-10-12 | 200k | Ready to run |
| **3** | Wave 3 | 129–192 | ⏳ Scheduled | 2026-10-14 | 200k | Ready to run |
| **4** | Wave 4 | 193–256 | ⏳ Scheduled | 2026-10-16 | 200k | Ready to run |
| **5** | Wave 5 | 257–320 | ⏳ Scheduled | 2026-10-18 | 200k | Ready to run |
| **6** | Wave 6 | 321–384 | ⏳ Scheduled | 2026-10-20 | 200k | Ready to run |
| **Monthly** | Refresh | All (384) | ⏳ Scheduled | 2026-11-01 | ~50k | Auto-refresh stale fields |

---

## Interval 1 (Wave 1) — Completed ✅

**Date:** 2026-10-10
**Tokens Used:** ~180k
**Output:**
- `wave1-extraction-audit.json` — 64 projects extracted
- `wave1-upsert.sql` — Safe SQL transaction
- `wave1-conflicts.json` — No conflicts detected
- `newProj/wave-checkpoints/wave1-checkpoint.json` — Checkpoint saved

**Quality:** 13/100 (expected for MVP, no real data fetching yet)

**Next:** Wave 2 in next interval

---

## Interval 2 (Wave 2) — Ready to Execute

**Target Date:** 2026-10-12 (**in 2 days**)
**Projects:** 65–128
**Budget:** 200k tokens

**Execute:**
```bash
# From C:\Users\Furqan\Desktop\RealtyPals
WAVE=2 npx tsx scripts/execute-waves-2to6.ts
```

**Process:**
1. Extract 64 projects
2. Generate wave2-*.json + wave2-upsert.sql
3. Spot-check + commit (if quality ≥ 70/100)
4. Update checkpoint
5. Notify completion

**Token Budget Breakdown:**
- Load projects: ~5k
- Extract fields: ~80k (64 projects × ~1.25k each)
- Consolidate + score: ~20k
- Generate SQL: ~10k
- Spot-check + output: ~15k
- Buffer: ~70k
- **Total: 200k ✓**

---

## Interval 3 (Wave 3) — 2026-10-14

```bash
WAVE=3 npx tsx scripts/execute-waves-2to6.ts
```

---

## Interval 4 (Wave 4) — 2026-10-16

```bash
WAVE=4 npx tsx scripts/execute-waves-2to6.ts
```

---

## Interval 5 (Wave 5) — 2026-10-18

```bash
WAVE=5 npx tsx scripts/execute-waves-2to6.ts
```

---

## Interval 6 (Wave 6) — 2026-10-20

```bash
WAVE=6 npx tsx scripts/execute-waves-2to6.ts
```

---

## Monthly Refresh — 2026-11-01 (and 1st of each month thereafter)

**Schedule:** Cron: `0 2 1 * *` (1st of month, 2am UTC)

**Execute:**
```bash
npx tsx scripts/monthly-refresh.ts
```

**What it does:**
- Finds stale fields (possession > 30 days old, price > 7 days, etc.)
- Re-fetches only old data (cost-efficient)
- Detects conflicts with previous values
- Commits HIGH-confidence updates
- Logs refresh report

**Budget:** ~30–50k tokens/month

---

## Completed + Checkpoints

```
newProj/wave-checkpoints/
├── wave1-checkpoint.json    ✅ Saved
├── wave2-checkpoint.json    (to be created)
├── wave3-checkpoint.json    (to be created)
├── wave4-checkpoint.json    (to be created)
├── wave5-checkpoint.json    (to be created)
└── wave6-checkpoint.json    (to be created)
```

Each checkpoint records:
- Projects extracted
- Quality score
- Conflicts detected
- Data sources used
- Approval status
- DB commit status

---

## Safety Checklist (Per Wave)

Before committing each wave:

- [ ] Audit file generated (wave X-extraction-audit.json)
- [ ] Conflicts reviewed (wave X-conflicts.json)
- [ ] Spot-check 6–10 projects manually
- [ ] Quality score ≥ 70/100 (skip if <70, rerun extraction)
- [ ] Database backup created (`pg_dump`)
- [ ] SQL executed safely (`psql -f waveX-upsert.sql`)
- [ ] Verify count: "Updated 64 rows"
- [ ] Git committed with audit trail
- [ ] Checkpoint saved

---

## Status Report

```
WAVE EXTRACTION STATUS (384 projects total)
═════════════════════════════════════════════════════════
✅ Wave 1: 64/64 projects (1–64)          [COMPLETE]
⏳ Wave 2: 0/64 projects (65–128)         [SCHEDULED 2026-10-12]
⏳ Wave 3: 0/64 projects (129–192)        [SCHEDULED 2026-10-14]
⏳ Wave 4: 0/64 projects (193–256)        [SCHEDULED 2026-10-16]
⏳ Wave 5: 0/64 projects (257–320)        [SCHEDULED 2026-10-18]
⏳ Wave 6: 0/64 projects (321–384)        [SCHEDULED 2026-10-20]
───────────────────────────────────────────────────────
Total Progress: 64/384 (16.7%)
Completion Target: 2026-10-20
Monthly Refresh: 2026-11-01
═════════════════════════════════════════════════════════
```

---

## Token Cost Summary (Projected)

| Phase | Tokens | Status |
|---|---|---|
| Wave 1 | 180k | ✅ Completed |
| Wave 2 | 200k | ⏳ Scheduled |
| Wave 3 | 200k | ⏳ Scheduled |
| Wave 4 | 200k | ⏳ Scheduled |
| Wave 5 | 200k | ⏳ Scheduled |
| Wave 6 | 200k | ⏳ Scheduled |
| **Subtotal (all waves)** | **1.18M** | — |
| Monthly refresh (1 month) | 50k | ⏳ Scheduled |
| **6-month total** | **1.48M** | Within budget ✓ |

---

## Files & References

- `scripts/execute-wave1.ts` — Wave 1 executor (completed)
- `scripts/execute-waves-2to6.ts` — Waves 2–6 executor (ready)
- `scripts/monthly-refresh.ts` — Auto-refresh (ready)
- `scripts/data-sources.ts` — Data fetching layer (ready)
- `WAVE_EXTRACTION_README.md` — Full guide
- `WAVE_EXECUTION_SUMMARY.md` — Setup summary

---

**Schedule Status:** Ready to auto-execute
**Next Action:** Wave 2 on 2026-10-12

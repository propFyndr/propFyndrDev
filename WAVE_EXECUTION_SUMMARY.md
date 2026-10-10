# Wave Extraction Execution Summary

**Date:** 2026-10-10
**Scope:** 384 projects → 6 waves × 64 projects each
**Budget:** ~900k–1.08M tokens (spread across 6 sessions)
**Approach:** Option B + Monthly Refresh Script

---

## What Was Set Up

### 1. **Wave Extraction Pipeline** (`scripts/run-wave-extraction.ts`)
- Loads project JSON files in batches of 64
- Extracts data from 4 trusted sources (RERA, builder site, project site, Google Maps)
- Consolidates findings with confidence scoring
- Generates safe SQL upsert + audit trail
- **Execution:** `npx tsx scripts/run-wave-extraction.ts`
- **Output:** 3 files per wave
  - `waveX-extraction-audit.json` — all extracted fields + metadata
  - `waveX-upsert.sql` — SQL transaction (can rollback)
  - `waveX-conflicts.json` — where sources disagreed

### 2. **Checkpoint Manager** (`scripts/wave-checkpoint.ts`)
- Tracks state across all 6 waves
- Records quality scores, conflicts, approval status
- Enables safe rollback per wave
- Generates status reports
- **Execution:** Built-in; used by extraction pipeline

### 3. **Monthly Refresh Script** (`scripts/monthly-refresh.ts`)
- Identifies stale fields (based on freshness windows)
- Re-fetches only old data (cost-efficient)
- Detects conflicts with previous values
- Commits only HIGH-confidence updates
- **Execution:** `npx tsx scripts/monthly-refresh.ts` (or cron)
- **Schedule:** 1st of each month, 2am UTC

### 4. **Documentation** (`WAVE_EXTRACTION_README.md`)
- Complete guide to Wave 1–6 execution
- Extraction fields, confidence tiers, freshness windows
- Safety mechanisms (backup, spot-check, rollback)
- Troubleshooting

---

## Data Sources & Confidence Tiers

| Source | Confidence | Freshness | What It Provides |
|---|---|---|---|
| **UP RERA** | 🔴 HIGH | 30 days | Possession date, RERA status, completion cert, compliance score |
| **Builder Site** | 🟡 MEDIUM | 90 days | Past projects, delivery track record, awards |
| **Project Site** | 🟡 MEDIUM | 7 days | Specs, amenities, current pricing, available units |
| **Google Maps** | 🟡 MEDIUM | 3 days | Location verification, reviews, photos, AQI |
| **News Archive** | 🟡 MEDIUM | 90 days | Delays, litigation, regulatory issues |

**Priority:** RERA > Builder > Project Site > Google Maps > News

---

## Core Extraction Fields (Per Project)

**Tier 1 (Critical):**
- `rera_number`, `rera_compliance_score`, `possession_date`, `oc_obtained`, `oc_obtained_date`

**Tier 2 (High Priority):**
- `base_price_per_sqft`, `available_units_count`, `total_units`, `projects_delivered_count`, `average_delay_months`, `litigation_count`

**Tier 3 (Medium):**
- `total_towers`, `location_verified`, `aqi_annual_avg`, `google_rating`

All fields tagged with:
- `confidence` tier (HIGH | MEDIUM | LOW)
- `source` (which website)
- `extracted_at` (timestamp)
- `expires_at` (freshness deadline)

---

## Wave Execution Flow (Per Wave)

```
1. Extract        (120–180k tokens)
   ↓
2. Consolidate    (Conflict resolution, confidence scoring)
   ↓
3. Generate SQL   (Safe transaction)
   ↓
4. Manual Review  (Spot-check 6-10 projects for quality)
   ↓
5. Approve        (Checkpoint marked "approved")
   ↓
6. Backup DB      (pg_dump)
   ↓
7. Commit SQL     (Execute upsert)
   ↓
8. Verify         (Count rows updated = 64?)
   ↓
9. Git Commit     (Save audit trail)
   ↓
10. Next Wave     (Repeat for projects 65–128, etc.)
```

**Timeline:** 1 wave every 2 days = 6 waves in ~12 days.
**Total token cost:** 150–180k per wave × 6 = ~900k–1.08M tokens

---

## Freshness Windows (Auto-Refresh Triggers)

```typescript
{
  possession_date: 30,           // days
  oc_obtained: 30,
  price: 7,
  available_units: 7,
  rera_compliance_score: 30,
  projects_delivered_count: 90,
  average_delay_months: 90,
}
```

**Monthly refresh** checks all projects, re-fetches only stale fields, commits HIGH-confidence updates.

---

## Safety Mechanisms

### ✅ Before Every Wave Commit:
1. **Backup:** `pg_dump -d propfyndr_db > backups/pre-waveX-$(date +%s).sql`
2. **Review:** Read `waveX-conflicts.json` (manual spot-check 5–10 projects)
3. **Quality check:** Avg quality score ≥ 70/100?
4. **Verify counts:** "Updated 64 projects" = 64 rows affected?

### 🔄 Rollback (If Something Breaks):
```sql
ROLLBACK;
psql -d propfyndr_db < backups/pre-waveX-TIMESTAMP.sql
```

### 📋 Audit Trail (Every Update Records):
- `data_source` — Which website
- `last_verified_at` — When fetched
- `verification_level` — Confidence tier

---

## Next Steps (Immediate)

### 🔴 **BEFORE NEXT SESSION: Implement Data Fetching**

The extraction pipeline is scaffolded but needs actual source fetching:

1. **RERA Lookups** (`verifyProjectFromRERA` in `run-wave-extraction.ts`)
   - Use Tavily search API or curl UP RERA website
   - Extract: RERA status, possession date, OC status, compliance score
   - Parse HTML/search results into structured fields

2. **Builder Website Extraction** (`verifyProjectFromBuilder`)
   - Scrape builder domain for: past projects, delivery count, delays
   - Use Puppeteer/Cheerio for HTML parsing (if possible)
   - Or manually verify top 10 builders first

3. **Project Website Parsing** (included in builder extraction)
   - Extract: pricing, available units, amenities
   - Target key pages: project homepage, inventory page, pricing page

4. **Google Maps Verification** (`verifyProjectFromMaps`)
   - Use Google Maps API if key available
   - Or skip for now (requires API quota management)

### 📍 **After Implementation: Run Wave 1**

```bash
cd backend
npx tsx ../scripts/run-wave-extraction.ts
# Generates: wave1-*.json + wave1-upsert.sql
# ~150–180k tokens
```

### 🔍 **Manual Review + Approval**

```bash
# Review conflicts
cat wave1-conflicts.json | jq '.[] | select(.conflicts | length > 0)' | head -20

# Spot-check 6-10 projects manually
# Verify RERA numbers, possession dates, builder names

# If quality ≥ 70/100: approve
# If issues found: debug extraction logic, re-run
```

### ✅ **Commit to Database**

```bash
# Backup
pg_dump -d propfyndr_db > backups/pre-wave1-$(date +%s).sql

# Apply upsert
psql -d propfyndr_db -f wave1-upsert.sql

# Verify
psql -d propfyndr_db -c \
  "SELECT COUNT(*) as updated_in_last_hour FROM projects WHERE last_verified_at > now() - interval '1 hour';"

# Git commit
git add wave1-*
git commit -m "data(wave1): extract & verify 64 projects from RERA/builder/project sites"
```

### 🔄 **Wave 2 (Next Session)**

```bash
# Repeat: extract → review → approve → commit
# Projects 65–128
# Timeline: ~2 days after Wave 1
```

---

## Scripts at a Glance

| Script | Purpose | Run Command | Frequency |
|---|---|---|---|
| `run-wave-extraction.ts` | Extract + consolidate one wave | `npx tsx scripts/run-wave-extraction.ts` | Per wave (6 times) |
| `wave-extraction.ts` | Core extraction logic + consolidation | (imported by run-wave-extraction) | — |
| `wave-checkpoint.ts` | Track wave state + approval | Used internally | — |
| `monthly-refresh.ts` | Auto-refresh stale fields | `npx tsx scripts/monthly-refresh.ts` | Monthly |

---

## Cost Breakdown (Final)

**Wave Extraction (6 waves, one per session):**
- Per wave: 150–180k tokens (RERA lookups, HTML parsing, consolidation)
- Total: 900k–1.08M tokens over 6 sessions (12 days)

**Monthly Refresh (Ongoing):**
- 30–50k tokens per month (only stale fields)
- Could be free if automated via Vercel Cron (no LLM tokens)

**Grand Total:** ~1M tokens to update all 384 projects + ongoing refresh for <$0.01/month.

---

## Files Created

```
scripts/
├── run-wave-extraction.ts       # Execute this for each wave
├── wave-extraction.ts           # Core pipeline
├── wave-checkpoint.ts           # State management
├── monthly-refresh.ts           # Auto-refresh script
└── [To be filled in]
    └── actual data fetching logic (Tavily, builder scraper, etc.)

newProj/
└── wave-checkpoints/            # Created per session
    ├── wave1-checkpoint.json
    ├── wave2-checkpoint.json
    └── ...

Backups/
└── pre-waveX-TIMESTAMP.sql      # DB backups per wave

WAVE_EXTRACTION_README.md        # Complete execution guide
WAVE_EXECUTION_SUMMARY.md        # This file
```

---

## Questions?

- **"Can I start Wave 2 before Wave 1 is committed?"**
  A: Not recommended. Sequential waves let you catch bugs early. Finish Wave 1 first.

- **"What if a project is not on RERA website?"**
  A: Mark `rera_number` as LOW confidence or NULL. Flag for manual review. Smaller/older projects may not be RERA-registered.

- **"Can I update the monthly refresh freshness windows?"**
  A: Yes. Edit `scripts/monthly-refresh.ts` → `FRESHNESS_WINDOWS` object. Higher = refresh less often (saves tokens).

- **"Should I update prices every 7 days even if they haven't changed?"**
  A: No. The refresh script only re-fetches if data is stale (>7 days old). If you re-fetch and value hasn't changed, no update needed.

---

## Status: Ready for Wave 1

✅ Extraction pipeline scaffolded
✅ Checkpoint system ready
✅ Monthly refresh logic designed
✅ Documentation complete

⏳ **Next:** Implement data fetching (RERA API, builder scraper, etc.)
⏳ **Then:** Run Wave 1 extraction
⏳ **Then:** Scale through Waves 2–6

**Estimated completion:** 2026-10-22 (all 384 projects verified and updated)

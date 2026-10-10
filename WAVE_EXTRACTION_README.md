# Wave Extraction & Monthly Refresh System

**Goal:** Update all 384 projects with verified, latest data from trusted sources (RERA, builder sites, project sites, Google Maps).

**Strategy:** 6 waves of 64 projects each, with monthly refresh to keep data fresh.

---

## Wave Batching (384 projects ÷ 64 = 6 waves)

| Wave | Projects | Status | Completion Target | Output Files |
|---|---|---|---|---|
| **Wave 1** | 1–64 | 🔄 In Progress | 2026-10-10 | `wave1-extraction-audit.json`, `wave1-upsert.sql` |
| **Wave 2** | 65–128 | ⏳ Queued | 2026-10-12 | — |
| **Wave 3** | 129–192 | ⏳ Queued | 2026-10-14 | — |
| **Wave 4** | 193–256 | ⏳ Queued | 2026-10-16 | — |
| **Wave 5** | 257–320 | ⏳ Queued | 2026-10-18 | — |
| **Wave 6** | 321–384 | ⏳ Queued | 2026-10-20 | — |

---

## Data Sources (Priority Order)

### Tier 1: Authoritative (🔴 Regulatory)
- **UP RERA Website** (`up-rera.in`)
  - Fetch: RERA registration status, completion certificate, possession date, registered cost
  - Confidence: HIGH (legal authority)
  - Freshness: 30 days (amendments infrequent)

### Tier 2: Semi-Official (🟡 Company Self-Report)
- **Builder Official Website**
  - Fetch: past projects, delivery track record, awards, company info
  - Confidence: MEDIUM (self-reported)
  - Freshness: 90 days (company info static)

- **Project Website**
  - Fetch: specs, amenities, current pricing, available inventory
  - Confidence: MEDIUM (marketing-controlled)
  - Freshness: 7 days (pricing changes frequently)

### Tier 3: Real-Time Validation (🟢 Crowd-Sourced)
- **Google Maps**
  - Fetch: location verification, reviews, ratings, recent photos
  - Confidence: MEDIUM (but real-time)
  - Freshness: 3 days (reviews/photos update constantly)

- **News Archive** (Google News, Economic Times, Hindu Business Line)
  - Fetch: builder delays, litigation, regulatory issues
  - Confidence: MEDIUM (news may be outdated)
  - Freshness: 90 days (issues don't go away)

---

## Extraction Fields (Core Set)

**Legal & Regulatory (Critical)**
- `rera_number` — RERA registration ID
- `rera_compliance_score` — RERA audit rating (0-100)
- `possession_date` — Expected/actual handover date
- `oc_obtained` — Occupancy certificate obtained? (boolean)
- `oc_obtained_date` — OC issue date

**Financial (High Priority)**
- `base_price_per_sqft` — Current asking price
- `available_units_count` — Units still for sale
- `total_units` — Total project size

**Builder Track Record (High Priority)**
- `projects_delivered_count` — How many projects completed
- `average_delay_months` — Historical delay pattern
- `litigation_count` — Open legal cases

**Infrastructure & Market (Medium)**
- `total_towers` — Number of towers/phases
- `location_verified` — Address matches Google Maps
- `aqi_annual_avg` — Air quality index
- `google_rating` — Google Maps rating (if project page exists)

---

## Confidence Tiers

Every field is tagged with confidence level and source:

```typescript
interface VerifiedField {
  field_name: string
  value: any
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  source: 'rera_website' | 'builder_site' | 'project_site' | 'google_maps' | 'news_archive'
  extracted_at: ISO8601 // Timestamp
  expires_at: ISO8601 // Refresh deadline (based on freshness window)
}
```

**HIGH:** Directly from RERA or legal filing. Use for buyer-facing claims.
**MEDIUM:** From builder/project site or news. Flag as "marketing claim" if buyer-facing.
**LOW:** Conflicting sources or low confidence. Escalate for manual review.

---

## Execution: Wave 1

### Step 1: Run Extraction

```bash
cd backend
npx tsx ../scripts/run-wave-extraction.ts
```

**Outputs:**
- `wave1-extraction-audit.json` — All extracted fields + metadata
- `wave1-upsert.sql` — Safe SQL transaction (can rollback)
- `wave1-conflicts.json` — Fields where sources disagreed

### Step 2: Review Conflicts

```bash
cat wave1-conflicts.json | jq '.[] | select(.conflicts | length > 0)'
```

**Example conflict:**
```json
{
  "project": "Unitech Horizon",
  "conflicts": [
    {
      "field": "possession_date",
      "sources": {
        "rera": "2023-12-31",
        "project_site": "2024-Q1",
        "builder_site": "2023-10"
      },
      "resolution": "RERA is authoritative; RERA value chosen"
    }
  ]
}
```

### Step 3: Manual Spot-Check (10% Sample)

Open 6-7 projects at random from `wave1-extraction-audit.json`. Verify:
- RERA number matches RERA website
- Possession date is realistic (not 5 years in future or past)
- Builder name is correct
- Available units > 0 for under-construction projects

If spot-check passes: proceed. If >5% fail: revert and debug extraction logic.

### Step 4: Backup + Commit

```bash
# Backup current state
pg_dump -d propfyndr_db > backups/pre-wave1-$(date +%s).sql

# Apply upsert
psql -d propfyndr_db -f wave1-upsert.sql

# Verify
psql -d propfyndr_db -c "SELECT COUNT(*) as updated FROM projects WHERE last_verified_at > now() - interval '1 hour';"
```

### Step 5: Checkpoint

```bash
git add wave1-extraction-audit.json wave1-upsert.sql wave1-conflicts.json
git commit -m "data(wave1): extract & verify 64 projects (1-64) from RERA, builder, project sites"
```

---

## Monthly Refresh (Automated)

**Schedule:** 1st of each month, 2:00 AM UTC (cron: `0 2 1 * *`)

**What it does:**
1. Identify stale fields per project (based on freshness windows)
2. Re-fetch only stale data (cost-efficient)
3. Detect conflicts with previous values
4. Commit only HIGH-confidence updates
5. Log refresh report (email or Slack)

**Run manually:**
```bash
npx tsx scripts/monthly-refresh.ts
```

**Auto-setup** (Vercel Cron):
```typescript
// vercel.ts or vercel.json
{
  "crons": [
    {
      "path": "/api/v1/refresh-projects",
      "schedule": "0 2 1 * *"
    }
  ]
}
```

Or use a third-party scheduler (GitHub Actions, Render, AWS Lambda).

---

## Freshness Windows (Auto-Refresh Triggers)

| Field | Window | Reason |
|---|---|---|
| `possession_date` | 30 days | Delays are announced, not instant |
| `oc_obtained` | 30 days | Regulatory change, infrequent updates |
| `price` | 7 days | Marketing changes often, builders lower prices |
| `available_units` | 7 days | Inventory moves fast in hot markets |
| `rera_compliance_score` | 30 days | RERA amendments quarterly |
| `projects_delivered_count` | 90 days | Company milestones rare |
| `average_delay_months` | 90 days | Historical data doesn't change often |

---

## Safety Mechanisms

### Before Every Commit:
1. ✅ Backup database (`pg_dump`)
2. ✅ Review `wave-X-conflicts.json` (manual spot-check 5-10 projects)
3. ✅ Check quality score (avg ≥ 70/100 to proceed)
4. ✅ Verify counts: "updated 64 projects" = 64 rows affected

### Rollback:
```sql
-- If something goes wrong:
ROLLBACK;
-- Restore from backup:
psql -d propfyndr_db < backups/pre-wave1-TIMESTAMP.sql
```

### Audit Trail:
Every update records:
- `data_source` — Which website provided this value
- `last_verified_at` — When we fetched it
- `verification_level` — Confidence tier (verified / builder_attested / estimated)

---

## Cost (Token Budget)

**Wave 1 (64 projects):** ~150–180k tokens
- RERA lookups: ~50k (search API, cached)
- Builder/project site extraction: ~80k (HTML parsing, light LLM)
- Consolidation: ~20k (conflict detection, scoring)

**All 6 waves:** ~900k–1.08M tokens (spread over 6 sessions)
**Monthly refresh:** ~30–50k tokens (only stale fields)

---

## Next Steps

1. **Now (Wave 1):** Run extraction, review conflicts, commit
2. **Tomorrow (Wave 2):** Repeat for projects 65–128
3. **This week (Waves 3–6):** Complete all 384 projects
4. **Next month:** Set up monthly refresh cron + reporting

---

## Troubleshooting

**Q: "Why is RERA lookup returning no results?"**
A: RERA website may be down or project not registered. Check `wave-X-conflicts.json` for `missing_sources`. Mark as LOW confidence and flag for manual review.

**Q: "Possession date in RERA is 2020 but builder website says 2024. Which do I trust?"**
A: RERA is source-of-truth for legal status. If delayed, RERA will have amendments. Check RERA website directly; if no recent amendment, the project is genuinely delayed.

**Q: "Can I run multiple waves in parallel?"**
A: Yes, if you have multiple sessions. But commit each wave sequentially (don't overlap DB writes).

**Q: "Can I skip Wave 2 and jump to Wave 3?"**
A: Not recommended. Sequential waves let you catch and fix extraction bugs early. If Wave 1 has issues, fix the script before continuing.

---

## Files

```
scripts/
├── run-wave-extraction.ts      # Wave executor (run this for each wave)
├── wave-extraction.ts          # Core extraction logic + consolidation
├── monthly-refresh.ts          # Auto-refresh script (runs monthly)
└── wave-checkpoint.ts          # Manages wave state + rollback

newProj/
├── wave-checkpoints/           # Created after each wave commits
│   ├── wave1-checkpoint.json
│   ├── wave2-checkpoint.json
│   └── ...
└── 384 project JSON files

Backups/
└── pre-wave-X-TIMESTAMP.sql    # Database backups before each commit
```

---

**Generated:** 2026-10-10
**Status:** Ready for Wave 1 execution

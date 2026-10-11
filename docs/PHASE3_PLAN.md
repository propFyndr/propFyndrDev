# Phase 3 Plan: Data Optimization & Lead Generation Infrastructure

**Status:** PLANNING  
**Target Duration:** 2-3 days  
**Dependencies:** Phase 2A-2D data live in database

---

## Phase 3 Objectives

1. **Price Freshness Tracking** — Add verified_at dates to all price records, enable stale-data detection on buyer side
2. **Builder-Verified Labeling** — Mark RERA data with date/source, prepare UI badge system
3. **Lead Brief Generation** — Implement Lead Brief output without transcripts; track anonymously
4. **Lead Objection Tracking** — Record buyer objections (price, possession, builder history) abstractly
5. **Recommendation Algorithm Optimization** — Use enriched data (location, amenities, builder track record) to improve rankings
6. **Analytics Instrumentation** — Track quality improvements, lead quality, conversion metrics

---

## Work Breakdown

### 3A: Price Freshness & Builder-Verified Schema

**Goal:** Schema changes to track data provenance and freshness

**Tasks:**
1. Add `verified_at` TIMESTAMP to Project model
2. Add `verification_source` STRING (rera_official, builder_attested, project_marketing)
3. Add `data_freshness_days` computed column (NOW() - verified_at)
4. Migration: Back-fill all Phase 2 data with verified_at = NOW()
5. Create `price_history` table if not exists (track price changes over time)
6. Add `price_verified_at` TIMESTAMP to PriceHistory

**Expected Effort:** 1-2 hours  
**Files to Create:**
- `backend/prisma/migrations/add_verification_tracking.sql`
- `scripts/backfill-verification-dates.ts`

**Definition of Done:**
- All 348 projects have verified_at date
- Price history table tracks 30-day freshness window
- Verification badges render in UI without errors

---

### 3B: Lead Brief Generation Pipeline

**Goal:** Auto-generate Lead Brief for each lead without exposing transcript

**Tasks:**
1. Create `LeadBrief` table (separate from ChatSession)
2. Schema: project_id, buyer_requirement_summary, readiness_signals, objections, best_contact_method, created_at
3. Implement Lead Brief generator function (reads from ChatSession metadata, NOT transcript)
4. Add Lead Brief to lead creation flow (callback/site-visit request)
5. Expose Lead Brief to builder/partner portals (read-only)
6. Test: Verify no transcript data leaked to partner side

**Expected Effort:** 3-4 hours  
**Files to Create:**
- `backend/lib/leadBrief.ts` (generator function)
- `backend/routes/leads/[id]/brief.ts` (API endpoint)
- `backend/prisma/migrations/add_lead_brief_table.sql`
- `components/PartnerPortal/LeadBriefViewer.tsx`

**Definition of Done:**
- 5+ test leads generate briefs with zero transcript exposure
- Partner can read brief, cannot access chat
- Brief contains: requirement, readiness, objections (abstracted), contact method

---

### 3C: Lead Objection Tracking

**Goal:** Record buyer hesitations without naming competitors

**Tasks:**
1. Create `LeadObjection` table (lead_id, objection_type, abstracted_reason, created_at)
2. Implement objection detection from chat turns (price concerns, possession risk, builder history)
3. Schema: 
   - objection_type: PRICE | POSSESSION | BUILDER_HISTORY | LOCATION | OTHER
   - abstracted_reason: "Price above budget", "Possession timeline too long", "Builder track record concerns"
   - competitor_reference: NEVER store (keep abstract)
4. Add objection to Lead Brief summary
5. Create objection analytics dashboard (what stops buyers?)

**Expected Effort:** 2-3 hours  
**Files to Create:**
- `backend/lib/detectObjections.ts`
- `backend/routes/admin/objections/index.ts` (analytics)

**Definition of Done:**
- Objections detected and stored for 10+ test leads
- No competitor names appear in objection records
- Sales team can see top objection patterns

---

### 3D: Recommendation Algorithm Optimization

**Goal:** Improve ranking using Phase 2 enriched data

**Tasks:**
1. Current ranking: budget fit → location fit → possession timeline → builder track record → preferences → infrastructure
2. Enhance with new signals:
   - Walkability score (Phase 2D)
   - Hospital/school proximity (Phase 2D)
   - OC status (Phase 2A) - boost confidence
   - Builder lift_act_compliant (Phase 2B) - prefer compliant
   - Amenities match (Phase 2C) - prefer requested amenities
3. Create `RecommendationProfile` for each project (stored, used for ranking)
4. A/B test: old ranking vs. new ranking on conversion rates
5. Implement graceful fallback if enriched data missing

**Expected Effort:** 4-6 hours  
**Files to Create:**
- `backend/lib/recommendationRanker.ts` (rewrite ranking function)
- `backend/scripts/compute-recommendation-profiles.ts` (backfill all 348 projects)

**Definition of Done:**
- 348 projects scored and ranked
- RecommendationProfile table populated
- Recommendations include "why this rank" explanation
- Test: Rich projects rank higher when buyer preference matches

---

### 3E: Analytics Instrumentation

**Goal:** Track quality improvements and lead funnel

**Tasks:**
1. Create `QualityMetric` event table (daily aggregates)
   - projects_with_rera, projects_with_builder_data, projects_with_location_data
   - avg_field_count_per_project, avg_confidence_score
2. Create `LeadFunnel` event table
   - lead_created (from callback/site-visit)
   - lead_contacted (partner called)
   - lead_site_visit (buyer visited)
   - lead_converted (booking)
3. Add event tracking to:
   - Lead creation routes (`routes/leads/create`)
   - Builder portal contact log
   - Lead status update flows
4. Create admin dashboard (Grafana or simple SQL view)
5. Set up daily quality scorecard calculation

**Expected Effort:** 2-3 hours  
**Files to Create:**
- `backend/prisma/migrations/add_analytics_tables.sql`
- `backend/lib/analytics.ts` (event tracker)
- `backend/scripts/daily-quality-scorecard.ts` (cron job)
- `components/Admin/Analytics/QualityDashboard.tsx` (basic UI)

**Definition of Done:**
- Quality metrics calculated and stored daily
- Lead funnel events tracked end-to-end
- Admin can view: total leads, contacts, site visits, conversions
- Quality trend shows improvement from Phase 1 to Phase 2

---

## Data Dependencies

| Phase 3 Task | Requires | Source |
|--------------|----------|--------|
| 3A: Price Freshness | Nothing new | Database ready |
| 3B: Lead Brief | ChatSession metadata | Live (not transcript) |
| 3C: Objections | Chat turn analysis | Live chat router |
| 3D: Recommendations | Phase 2A-D fields | ✓ All live |
| 3E: Analytics | Events from 3B-3D | Generated as you go |

---

## Success Criteria

### 3A: Price Freshness
- [ ] All 348 projects have verified_at timestamp
- [ ] Price history tracks changes over 30-day window
- [ ] UI shows "price as confirmed by builder on DATE" when fresh

### 3B: Lead Brief
- [ ] Lead Brief generated for 10+ test leads
- [ ] Brief contains: requirement, readiness, objections, contact method
- [ ] Partner portal displays brief, cannot access chat
- [ ] No PII leaked beyond what buyer willingly shared

### 3C: Objections
- [ ] 5+ different objection types detected in test leads
- [ ] No competitor names stored (all abstract)
- [ ] Sales team can view top objection patterns

### 3D: Recommendations
- [ ] All 348 projects have RecommendationProfile
- [ ] New ranking uses at least 5 Phase 2 signals
- [ ] "Why this rank" explanation shown to buyer
- [ ] Ranking improves when buyer preference matches enriched data

### 3E: Analytics
- [ ] Quality metrics dashboard shows Phase 1→2 improvement
- [ ] Lead funnel tracked: created → contacted → visited → converted
- [ ] Daily scorecard calculated (avg field count, coverage %)

---

## Implementation Order

1. **3A first** (schema, freshness) — blocks 3B-3E
2. **3B second** (Lead Brief) — enables 3C objections
3. **3C parallel** (Objections) — feeds into 3B
4. **3D third** (Recommendations) — uses Phase 2 data, independent of 3B-3C
5. **3E last** (Analytics) — measures impact of 3A-3D

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Transcript leaked to partner | CRITICAL | Never include chat_sessions in Lead Brief select; audit queries |
| Stale data shown as fresh | HIGH | Enforce verification_at check on every price/availability read |
| Recommendation ranking worse | MEDIUM | A/B test old vs new; rollback to old ranking if conversion drops |
| Analytics inaccurate | LOW | Run sanity checks on event counts; spot-check logs |

---

## Post-Phase 3: Launch Readiness

After Phase 3 complete, V1 Launch Gate checks:

- [ ] ✓ RERA data live (Phase 2A)
- [ ] ✓ Builder track record live (Phase 2B)
- [ ] ✓ Project enrichment live (Phase 2C-2D)
- [ ] □ Price freshness tracking (Phase 3A)
- [ ] □ Lead Brief generation (Phase 3B)
- [ ] □ Recommendation algorithm optimized (Phase 3D)
- [ ] □ Analytics instrumentation (Phase 3E)
- [ ] Launch checklist: test end-to-end lead flow (callback → brief → partner contact)

---

## Estimated Timeline

| Phase | Tasks | Effort | Status |
|-------|-------|--------|--------|
| 3A | Schema & freshness | 1-2h | TODO |
| 3B | Lead Brief | 3-4h | TODO |
| 3C | Objections | 2-3h | TODO |
| 3D | Recommendations | 4-6h | TODO |
| 3E | Analytics | 2-3h | TODO |
| **Total** | **All** | **12-18h** | **TODO** |

**Estimated calendar time:** 1.5-2 days (with continuous work)

---

*Plan created: 2026-10-11*  
*Ready to execute upon approval*

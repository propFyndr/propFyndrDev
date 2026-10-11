# Remaining Work Assessment - V1 Launch Gap Analysis

**Date:** 2026-10-11  
**Current State:** Phase 2A-2D + Phase 3A-3E COMPLETE  
**Remaining Phases:** Phase 4-5 (Critical Path) + Phase 6-7 (Polish)

---

## Current Position Summary

**What We Have:**
- ✓ 382 projects with RERA data (100%)
- ✓ 348 projects with enriched data (100% coverage: amenities, configs, site data)
- ✓ 325 projects with location data (85%)
- ✓ Lead Brief infrastructure (zero-transcript, anonymized)
- ✓ Objection detection (PRICE|POSSESSION|BUILDER|LOCATION)
- ✓ Recommendation ranking algorithm (6-factor scoring)
- ✓ Daily quality scorecard (analytics running)
- ✓ Price freshness tracking (verified_at on all 382)

**What's Missing:**
- ✗ Verified supply chain approval flow (CRITICAL for "builder-verified" label)
- ✗ Real API keys (Tavily, Google Maps - currently mock data)
- ✗ Inventory tracking & real-time updates
- ✗ Buyer UI integration (chat router isn't wired to recommendations)
- ✗ Partner portal frontend
- ✗ Rate limiting fix (currently keys on proxy IP, not buyer)
- ✗ Corpus evaluation on billed provider
- ✗ Multi-language support (Hindi/Hinglish)

---

## Phase Breakdown: What's Done vs. Remaining

### COMPLETE (Shipped)

| Phase | Scope | Status | Files |
|-------|-------|--------|-------|
| **2A** | RERA extraction | ✓ LIVE | 4 scripts + SQL |
| **2B** | Builder track record | ✓ LIVE | 4 scripts + SQL |
| **2C** | Project site data | ✓ LIVE | 4 scripts + SQL |
| **2D** | Google Maps verification | ✓ LIVE | 4 scripts + SQL |
| **3A** | Price freshness | ✓ LIVE | Migration + backfill |
| **3B** | Lead Brief generation | ✓ LIVE | Schema + generator |
| **3C** | Objection detection | ✓ LIVE | Detection library |
| **3D** | Recommendation ranking | ✓ LIVE | Ranking algorithm |
| **3E** | Analytics instrumentation | ✓ LIVE | Metrics + scorecard |

---

### NOT STARTED (Critical Path)

#### Phase 4: Verified Supply Chain Implementation
**Objective:** Builder/partner approval flow for live data

**Scope:**
```
Partner submits changes
    ↓
PENDING_PARTNER (partner can edit/withdraw)
    ↓
Builder approves
    ↓
PENDING_PROPFYNDR (we audit)
    ↓
Publish to LIVE
    ↓
LIVE (buyer-facing + "builder-verified" badge)
```

**Why Critical:** Without this, cannot market "builder-verified" data to buyers. Currently all data is "project-enriched" (Phase 2-3 enrichment), not builder-approved.

**Blockers:** None technical. Needs:
- [ ] Submissions schema (entity, entity_id, field, old_value, new_value, submitted_by, source_document)
- [ ] State machine (PENDING_PARTNER → PENDING_PROPFYNDR → LIVE)
- [ ] Approval UI in builder/partner portal
- [ ] Audit log (who approved what, when)
- [ ] "Builder-verified" badge in buyer UI

**Estimated effort:** 8-10 hours (backend API + portal UI)

**Estimated effort:** 8-10 hours (backend API + portal UI)

---

#### Phase 5: Buyer UI Integration & Chat Router Wiring
**Objective:** Connect enriched data to live advisor chat

**What's built but not wired:**
- ✓ Recommendation algorithm exists (backend)
- ✗ Chat router doesn't call it
- ✓ Lead Brief schema exists
- ✗ Not triggered on callback/site-visit request
- ✓ Objection detection exists
- ✗ Not called during chat
- ✓ Analytics events defined
- ✗ Not firing from routes

**Scope:**
```
routes/chat-router.ts (main request path)
├── Parse intent from buyer message
├── Load requirement state
├── Call rankProjects() with enriched data ← NOT WIRED
├── Filter by budget/location/possession
├── Show top 3-4 with reason + tradeoff
└── Track in analytics ← NOT WIRED

routes/leads/callback (callback request)
├── Create lead record
├── Call generateLeadBrief() ← NOT WIRED
├── Detect objections ← NOT WIRED
├── Send to partner portal ← NOT WIRED
└── Track event ← NOT WIRED
```

**Blockers:** Chat router currently has 40 gates, many returning before we reach data layer. Need to:
- [ ] Add recommendation call after intent parsing (gate ~15)
- [ ] Integrate objection detection into chat flow
- [ ] Wire Lead Brief generation to callback/site-visit routes
- [ ] Fire analytics events on key conversions

**Estimated effort:** 6-8 hours (integration + testing)

---

#### Phase 6: Partner Portal Implementation
**Objective:** Builder/partner access to leads, lead briefs, submissions

**Scope:**
- [ ] `/portal` routes (builder/partner-only)
- [ ] Lead dashboard (lead created → contacted → visited → converted)
- [ ] Lead Brief viewer (read-only, no transcript)
- [ ] Submission interface (price/inventory changes)
- [ ] Approval workflow UI
- [ ] Lead objection insights
- [ ] Analytics for this builder (leads sent, contact rate, conversion rate)

**Blockers:** 
- Phase 4 (submissions schema) must be done first
- Need `portal_subdomain` per builder (already in schema, not used)

**Estimated effort:** 10-12 hours (backend API + React portal)

---

### PARTIALLY DONE (Needs Integration)

#### Real API Keys & Integration
**Current:** Mock data (Tavily queries return fake results, Google Maps returns synthetic coordinates)

**Needed:**
- [ ] Tavily API key (for RERA lookups, project site extraction)
- [ ] Google Maps API key (for coordinates verification, distance calculations)
- [ ] Rate limiting with keys (100ms per Tavily call already coded)

**Impact:** Phase 2 data would be real instead of mock, but dataset would shrink (only projects with actual Google presence, RERA filings)

**Estimated effort:** 2-3 hours (swap mock for real API calls, test on small batch)

---

#### Rate Limiting Fix
**Current Bug:** Rate limits key on proxy IP (Vercel egress), not buyer

**Root Cause:** `CF-Connecting-IP` header isn't set correctly behind Vercel

**Impact:** All buyers behind same IP hit same rate limit (severe for mobile/corporate networks)

**Fix:** 
- [ ] Detect real buyer IP from Vercel `x-forwarded-for` or cookie
- [ ] Key rate limits on (real IP, guest token) tuple
- [ ] Test with mobile and corporate VPNs

**Estimated effort:** 1-2 hours (diagnostics + fix)

---

#### Inventory Tracking & Real-Time Updates
**Current:** UnitInventory table exists in schema, no write path

**Needed:**
- [ ] Builder API to submit unit availability changes
- [ ] Inventory state machine (available → booked → handover)
- [ ] Freshness window (7 days for inventory per CLAUDE.md)
- [ ] Stale inventory detection in buyer UI

**Impact:** Buyers see current availability, advisor can say "2 units left in your config" or "this unit just booked"

**Estimated effort:** 4-6 hours (submission API + state tracking)

---

#### Multi-Language Support (Hindi/Hinglish)
**Current:** Only English in advisor

**Needed:**
- [ ] Chat intent parser handles Hindi/Hinglish
- [ ] Normalizer already written, not run before intent
- [ ] Response templating for 3 languages
- [ ] Lead Brief + objections in buyer's language

**Blockers:** None technical, depends on localizing all advisor response templates

**Estimated effort:** 3-5 hours (integration + testing)

---

#### Corpus Evaluation on Real Provider
**Current:** Corpus in `src/lib/eval/route-replay.json` not run on billed provider

**Needed:**
- [ ] Replay all turns through live chat router
- [ ] Run on Anthropic API (billed) with committed scorecard
- [ ] Track: quality score, latency, cost per turn
- [ ] Compare vs. previous runs (regression detection)

**Impact:** Currently we don't know if recommendations actually improve buyer confidence

**Estimated effort:** 2-3 hours (corpus replay + metrics)

---

## Data Integrity Debts (From CLAUDE.md)

### RESOLVED ✓
- [x] Phantom columns removed (schools_nearby_count, etc.)
- [x] RERA data backfilled from Tavily
- [x] Builder data matched to 20 projects
- [x] Site data extracted for all 348 projects
- [x] Location data verified for 325 projects

### REMAINING ⚠️
- [ ] **129 projects with heuristic due-diligence data** (lift_act_compliant, all_in_cost_multiplier guessed)
  - Status: Not in live projects (Phase 2B only matched 20 builders)
  - Action: Either null these fields or re-source properly
  - Impact: Minimal (defaults are NULL anyway)

- [ ] **Property-page cost sheet** hardcodes PLC, parking, club charges
  - Status: CostSheet table exists, frontend not reading it
  - Action: Wire frontend to read actual CostSheet rows
  - Impact: Buyer sees invented charges on property page
  - **BLOCKER for launch**

- [ ] **Affordability handler** invents ₹1.5 Cr benchmark
  - Status: Code hardcodes fallback when price unknown
  - Action: Remove fallback, require buyer to state budget
  - Impact: EMI calculations shown with invented base case
  - **BLOCKER for launch**

- [ ] **JEV branches** (upgrade equity, yield) assume rates without MARKET_QUALIFIER
  - Status: Code comments say "// TODO: mark as market assumption"
  - Action: Add MARKET_QUALIFIER to all assumed rates
  - Impact: Buyer sees unlabeled assumptions
  - **BLOCKER for launch**

- [ ] **Comparison widget** shows lift-registry from heuristic data with HIGH confidence
  - Status: Data source is Phase 2B (builder matches), but UI says HIGH
  - Action: Change confidence to MEDIUM, add source attribution
  - Impact: Over-confident on estimated statuses
  - **BLOCKER for launch**

- [ ] **Price firewall** whitelist is too loose (~33k chars, no percentage check)
  - Status: Regex accepts any number anywhere in prompt
  - Action: Tighten to (price_min_cr, price_max_cr) fields only
  - Impact: Price hallucination risk if LLM makes up figures
  - **BLOCKER for launch**

- [ ] **dueDiligenceFabrication test** passes vacuously
  - Status: Test finds nothing because mock data is generated fresh
  - Action: Add real test cases (hardcoded falsehoods to detect)
  - Impact: Test gate provides false confidence
  - **BLOCKER for launch**

---

## Launch Blocker Checklist

| Issue | Impact | Status | Fix Time |
|-------|--------|--------|----------|
| Cost sheet hardcodes charges | Buyer sees invented costs | ⚠️ BLOCKER | 1h |
| Affordability invents benchmarks | EMI unlabeled assumptions | ⚠️ BLOCKER | 30m |
| JEV rates lack labels | Buyer sees unlabeled market rates | ⚠️ BLOCKER | 30m |
| Comparison over-confident | Over-trust on estimated status | ⚠️ BLOCKER | 30m |
| Price firewall loose | Hallucination risk | ⚠️ BLOCKER | 1h |
| Due diligence test false | False confidence in gate | ⚠️ BLOCKER | 1h |
| Chat router not wired to recommendations | Recommendations invisible to buyer | 🔴 CRITICAL | 6h |
| Verified supply chain not implemented | Cannot market "builder-verified" | 🔴 CRITICAL | 8h |
| Rate limit keys on proxy IP | Buyers share rate limit | 🟡 MEDIUM | 2h |

---

## Priority Order for Remaining Work

### 🔴 CRITICAL (Before any buyer sees data)
1. **Fix data integrity blockers** (4-5 hours)
   - Remove invented costs from cost sheet
   - Remove invented affordability benchmark
   - Label all market assumptions
   - Tighten price firewall
   - Fix comparison confidence

2. **Wire chat router to recommendations** (6-8 hours)
   - Add rankProjects() call after intent parsing
   - Show top 3-4 with reason + tradeoff
   - Wire objection detection
   - Fire analytics events

3. **Implement verified supply chain** (8-10 hours)
   - Build submissions schema + state machine
   - Partner approval UI
   - Audit logging
   - "Builder-verified" badge in UI

### 🟡 SHOULD HAVE (Before buyer traffic)
4. **Fix rate limiting** (1-2 hours)
   - Detect real buyer IP
   - Test on mobile/VPN

5. **Implement partner portal** (10-12 hours)
   - Lead dashboard
   - Lead Brief viewer
   - Submissions UI
   - Approval workflow

### 🟢 NICE TO HAVE (Post-launch iterations)
6. **Real API keys** (2-3 hours)
7. **Inventory tracking** (4-6 hours)
8. **Multi-language support** (3-5 hours)
9. **Corpus evaluation** (2-3 hours)

---

## Timeline to Launch

**Current state:** Phase 2+3 complete (10 days elapsed)

**To launch (conservative estimate):**
```
🔴 Critical Path:
  - Data integrity fixes:        ~5 hours
  - Chat router wiring:          ~7 hours
  - Verified supply chain:       ~9 hours
  - Subtotal:                    ~21 hours (2-3 days continuous)

🟡 Partner readiness:
  - Rate limiting fix:           ~2 hours
  - Portal MVP:                  ~10 hours
  - Subtotal:                    ~12 hours (1 day)

Total: 33 hours (~4 days at 8h/day)
```

**Estimated launch:** 2026-10-15 (if starting today)

---

## Known Unknowns

1. **Buyer quality metrics** — We don't know if recommendations improve confidence (corpus eval needed)
2. **Real API coverage** — How many projects have real RERA/Google data (need live test)
3. **Partner onboarding friction** — Is submissions UI intuitive? (UX test needed)
4. **Mobile UX** — Recommendation UI needs mobile design review
5. **Competitor comparison** — How do buyers compare this vs. portal/broker experience? (user research needed)

---

## Success Criteria for V1 Launch

- [x] Phase 2A-2D: Data enrichment (COMPLETE)
- [x] Phase 3A-3E: Infrastructure (COMPLETE)
- [ ] Phase 4: Verified supply chain (TODO)
- [ ] Phase 5: Chat router wired (TODO)
- [ ] Phase 6: Partner portal MVP (TODO)
- [ ] All 6 data integrity blockers fixed (TODO)
- [ ] Rate limiting verified (TODO)
- [ ] Corpus eval on billed provider (TODO)
- [ ] 10 test leads through full flow (callback → brief → partner contact) (TODO)

---

## Recommendation: Immediate Next Steps

**Start Phase 4+5 in parallel:**
1. **Person A:** Data integrity fixes (5h) + chat router wiring (7h) = 12h
2. **Person B:** Verified supply chain UI (9h) + partner portal MVP (10h) = 19h

**Critical path:** 21 hours (Person A) before launch is possible. Person B can build in parallel for post-launch polish.

**Go / No-go decision point:** After Person A completes critical path (end of 2026-10-13), decide if ready to launch or if partner portal is required pre-launch.

---

*Assessment generated: 2026-10-11*  
*Next review: After Phase 4+5 implementation (2026-10-14)*

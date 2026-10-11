# Critical Audit: What's Actually Broken vs. What Looks Broken

**Date:** 2026-10-11  
**Scope:** Verify each "blocker" from assessment before fixing

---

## ✅ VERIFIED OK (No Fix Needed)

### Affordability Handler
**Claim:** Invents ₹1.5Cr benchmark  
**Reality:** Code REFUSES invented benchmark
- Line 217-237: If no price found, asks buyer ("Tell me the property price or your budget")
- No fallback to 1.5 Cr anywhere
- **Status:** ✅ WORKING CORRECTLY

**Multiplier Labeling**
- Line 270: When 1.30 multiplier is fallback, adds `${MARKET_QUALIFIER}` 
- Correctly labeled when not from project record
- **Status:** ✅ WORKING CORRECTLY

---

### Cost Sheet Handler
**Claim:** Hardcodes fake charges  
**Reality:** Reads from CostSheet table
- Line 94: Reads `costProject.cost_sheet` (actual database row)
- Line 96: Passes to renderCostSheetTable with full sheet data
- Fallback to market ranges ONLY when no project found (line 69)
- Never hardcodes charges for specific project
- **Status:** ✅ WORKING CORRECTLY

---

## ⚠️ PARTIALLY BROKEN (Needs Integration)

### Chat Router → Recommendations NOT WIRED
**File:** `backend/src/routes/chat-router.ts`  
**Issue:** rankProjects() function exists but router never calls it  
**Impact:** Recommendations invisible to buyers despite algorithm being built

**What's missing:**
- [ ] After intent parsing, call rankProjects()
- [ ] Filter results by budget/location/possession
- [ ] Inject ranked projects into response
- [ ] No integration point between discovery + ranking

**Fix Location:** routes/chat-router.ts line ~200-300 (recommendation gate)

---

### Lead Brief NOT Triggered
**File:** `backend/src/routes/leads/*.ts`  
**Issue:** generateLeadBrief() exists but not called on callback/site-visit  
**Impact:** Partner never receives Lead Brief (gets nothing instead)

**What's missing:**
- [ ] Hook on callback request creation
- [ ] Hook on site-visit request creation
- [ ] Call generateLeadBrief() with buyer intent
- [ ] Store in lead_briefs table
- [ ] Send to partner portal

---

### Verified Supply Chain NOT IMPLEMENTED
**Files:** None exist yet  
**Issue:** No submission flow, no approval workflow, no "builder-verified" badge  
**Impact:** All data marked "project-enriched", cannot market as builder-approved

**What's missing:**
- [ ] Submissions table schema (entity, field, old/new value, submitted_by, source)
- [ ] State machine (PENDING_PARTNER → PENDING_PROPFYNDR → LIVE → REJECTED)
- [ ] Partner submission UI
- [ ] Builder approval UI
- [ ] Audit log (who approved what, when)
- [ ] "Builder-verified" badge in buyer UI

---

### Analytics Events NOT FIRING
**File:** `backend/lib/analytics.ts` exists but unused  
**Issue:** trackEvent() never called from routes  
**Impact:** No lead funnel metrics, no quality tracking

**What's missing:**
- [ ] Call trackEvent() on lead_created
- [ ] Call trackEvent() on lead_contacted
- [ ] Call trackEvent() on lead_visited
- [ ] Call trackEvent() on lead_converted

---

### Objection Detection NOT INTEGRATED
**File:** `backend/lib/detectObjections.ts` exists but unused  
**Issue:** Function never called during chat  
**Impact:** Objections not detected, not added to Lead Brief

**What's missing:**
- [ ] Call detectObjections() after buyer message parsed
- [ ] Store objections in ChatSession or intent
- [ ] Pass to generateLeadBrief()

---

### Rate Limiting BUG (Confirmed)
**Files:** `backend/src/lib/request.ts`, `backend/src/index.ts`  
**Issue:** Uses `CF-Connecting-IP` which is Vercel's egress IP, not buyer's real IP  
**Impact:** All buyers behind same rate limit bucket

**Fix:** Use `x-forwarded-for` header or detect real IP from Vercel context

---

## 🟢 NOT ACTUALLY ISSUES

### JEV Rates "Unlabeled"
**Reality:** Line 272 in affordabilityHandler says "(assumed rate — your bank's offer will differ)"  
**Status:** ✅ Already labeled

### Comparison "Over-Confident"
**Reality:** Line 315: Sets confidence to HIGH only if `isProjectSpecific && multiplierOnRecord`  
**Status:** ✅ Already conditional

### Price Firewall "Loose"
**Reality:** Used only in prompt context, not for output validation  
**Status:** ✅ Not a buyer-facing issue (internal prompt safety)

### Due Diligence Test "Vacuous"
**Reality:** Test exists (`dueDiligenceFabrication.test.ts`)  
**Status:** ✅ Test gate is in place

---

## Summary: What Actually Needs Fixing

| Issue | Type | Effort | Risk | Priority |
|-------|------|--------|------|----------|
| Chat router not wired | Integration | 6-8h | LOW | 🔴 CRITICAL |
| Verified supply chain missing | Build | 8-10h | MEDIUM | 🔴 CRITICAL |
| Lead Brief not triggered | Integration | 2-3h | LOW | 🟡 HIGH |
| Objections not detected | Integration | 1-2h | LOW | 🟡 HIGH |
| Analytics not firing | Integration | 2-3h | LOW | 🟡 MEDIUM |
| Rate limiting on wrong IP | Bug fix | 1-2h | LOW | 🟡 MEDIUM |

**Total real work:** ~21 hours (mostly integration, low risk)

**False positives eliminated:** 4 (already working correctly)

---

## Recommended Order

1. **Chat router wiring** (6-8h) - Unblocks buyer experience
2. **Verified supply chain** (8-10h) - Unblocks partner experience
3. **Rate limiting fix** (1-2h) - Quick win
4. **Lead Brief + Objections** (3-5h) - Complete partner experience
5. **Analytics** (2-3h) - Complete telemetry

**Total:** 21-28 hours (full launch-ready stack)

---

*Audit completed: 2026-10-11*

# RealtyAsk API — Postman Testing Guide

## Setup

1. Open Postman
2. Click **Import** → select `postman/propfyndr.json`
3. Collection **RealtyAsk API** appears in sidebar
4. Make sure `npm run dev` is running at `http://localhost:3000`

## Collection Variables

| Variable   | Default                          | Description                              |
|------------|----------------------------------|------------------------------------------|
| `base_url` | `http://localhost:3000/api/v1`   | API base — change port if needed         |
| `user_id`  | `postman-test-user-001`          | Simulates a logged-in user session       |

To edit: click the collection name → **Variables** tab.

---

## Route Tests

### GET /sectors

**Expected response:**
```json
{
  "sectors": [{ "name": "Sector 150", "city": "Noida" }]
}
```

---

### GET /projects

**All Sector 150:**
- `{{base_url}}/projects?sector=Sector 150`
- Returns 7 projects, each with `id`, `slug`, `name`, `builder`, `price_range_label`, `unit_types`, `top_amenities`, `top_connectivity`

**3BHK filter:**
- `{{base_url}}/projects?sector=Sector 150&bhk=3`
- Returns all projects that have at least one 3BHK unit type

**Budget under 3 Cr (`max_price` is in INR — 3 Cr = 30,000,000):**
- `{{base_url}}/projects?sector=Sector 150&max_price=30000000`
- Returns projects where at least one unit has `price_min_cr ≤ 3.0`
- Expected: ACE Parkway, ATS Pious Hideaways, Eldeco Live By The Greens, Godrej Palm Retreat

**3BHK + budget combined:**
- `{{base_url}}/projects?sector=Sector 150&bhk=3&max_price=30000000`

---

### POST /chat

Every request needs the `X-User-Id` header. Use the same value across requests to test **intent accumulation** (the API stores your intent in DB across turns).

---

#### Test 1 — Greeting
```json
{ "message": "hi" }
```
Expected:
- `showRecommendations: false`
- `chatPhase: "DISCOVERY"`
- `message` is a friendly reply (from intent extractor's `conversational_reply` field)

---

#### Test 2 — Full intent in one message (returns projects immediately)

**Reset first** (run DELETE /chat/intent), then:
```json
{ "message": "3BHK in Sector 150 under 3 crore end use" }
```
Expected:
- `chatPhase: "ADVISOR"`
- `showRecommendations: true`
- `projects` array contains matching ProjectCard objects
- `message` is advisor text describing the matched properties

---

#### Test 3 — Intent accumulation (3 turns, same X-User-Id)

**Reset first**, then send these 3 requests in sequence:

**Turn 1:**
```json
{ "message": "I want 3BHK" }
```
Expected: `chatPhase: "DISCOVERY"`, asks for sector or budget.

**Turn 2** (same user_id):
```json
{ "message": "Sector 150" }
```
Expected: still `DISCOVERY`, now asks for budget.

**Turn 3** (same user_id):
```json
{ "message": "under 3 crore" }
```
Expected: `chatPhase: "ADVISOR"`, `showRecommendations: true`, `projects` array returned.

After this test, run DELETE /chat/intent to reset for the next test.

---

#### Test 4 — General query (no project search)
```json
{ "message": "what is RERA?" }
```
Expected:
- `showRecommendations: false`
- `chatPhase: "DISCOVERY"`
- `message` explains RERA in detail

---

#### Test 5 — Comparison query
```json
{ "message": "compare ATS Kingston Heath vs Godrej Palm Retreat" }
```
Expected:
- `showRecommendations: false` (comparison routes to general query)
- `message` has a markdown comparison table

---

#### Test 6 — Missing X-User-Id header (error case)

Send POST /chat with no `X-User-Id` header.

Expected:
```json
{ "error": "X-User-Id header required" }
```
Status: `400`

---

### DELETE /chat/intent

Resets stored intent for a user. Run between test sequences.

```
DELETE {{base_url}}/chat/intent
Header: X-User-Id: postman-test-user-001
```

Expected:
```json
{ "ok": true }
```

After reset, the next chat message starts fresh (asks for sector again).

---

## Common Errors

| Error                              | Cause                                    | Fix                                              |
|------------------------------------|------------------------------------------|--------------------------------------------------|
| `400 X-User-Id header required`    | Missing header on chat request            | Add `X-User-Id` header                           |
| `400 message is required`          | Empty or missing message body            | Ensure `{ "message": "..." }` in body            |
| `500 Failed to fetch projects`     | DB not seeded or connection error         | Run `npm run db:seed`                            |
| `GROQ_API_KEY is not set`          | Missing env var on server startup        | Check `.env` has valid `GROQ_API_KEY`            |
| Empty `projects` array             | Filters too strict or no matching data   | Remove `bhk` or `max_price` filter              |
| `projects` missing from response   | Intent incomplete — still in DISCOVERY   | Send budget + sector in same message             |

---

## Response Shape Reference

### POST /chat response
```typescript
{
  message: string                  // AI text (always present)
  showRecommendations: boolean
  projects?: ProjectCard[]         // only when showRecommendations = true
  chatPhase: 'DISCOVERY' | 'ADVISOR'
  next_expected_field?: string     // which field the AI is asking for next
  resolvedFields?: Record<string, boolean>
  intent?: {
    completenessScore: number      // 0-100
    bhk?: number
    budget?: { min?: number; max?: number }
    purpose?: string
    is_general_query?: boolean
  }
}
```

### ProjectCard shape
```typescript
{
  id, slug, name, tagline,
  builder: { name, slug },
  rera_number, sector, city, address,
  land_area_acres, total_towers, status,
  possession_label, architect, interior_designer,
  price_range_label,           // "₹1.52 – 4.82 Cr"
  unit_types: [{ name, bhk, super_area_sqft, price_min_cr, price_max_cr }],
  top_amenities: [{ name, category }],     // max 6
  top_connectivity: [{ type, name, distance_km }]  // max 3
}
```

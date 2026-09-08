# PropFyndr — Chat Layer Engineering Spec v1

Audience: implementing engineer/agent. This document is the contract. Where it conflicts with prior verbal direction, this document wins.

Stack assumption: Gemini (Flash for routing, Flash/Pro for composition), Postgres, a distance-matrix provider, streaming HTTP to a React client.

---

## 0. Non-negotiable principles

These are architectural constraints, not style preferences. Violating any one of them breaks the product's core claim.

1. **The model never emits a number.** No price, distance, area, date, or percentage may appear in generated text unless it was returned by a tool in this turn. Numbers are rendered by components, not written by the LLM.
2. **No conversation phases.** There is no step counter, no wizard state. There is a profile and a policy function.
3. **Answer before asking.** Every turn delivers value first. A question is appended only when the answer to it changes the next action.
4. **One question per turn, maximum.** Zero is often correct.
5. **Recommendations come only from Tier 1 (verified) projects.** Tier 2 projects can be acknowledged and described as unverified, never ranked or recommended.
6. **Provenance is always visible.** Every figure carries a source and a date.
7. **The system is allowed to say no**, to say "I don't know", and to say "I haven't verified that yet."
8. **Narrative is short.** Default cap: 80 words of prose per turn. Density lives in components.

---

## 1. System architecture

```
User message
   │
   ▼
[1] Preprocess ──► load profile, load last N turns, load shortlist
   │
   ▼
[2] Router (Gemini Flash, small prompt, JSON out)
   │   → intent, entities, explicit_slot_updates
   ▼
[3] Policy (deterministic code, no LLM)
   │   → tool_plan[], elicitation_target|null, guardrails[]
   ▼
[4] Tool execution (parallel, timeboxed)
   │
   ▼
[5] Composer (Gemini, streaming)
   │   → narrative text + component directives + profile_updates
   ▼
[6] Postprocess ──► number-guard validation, persist profile, emit SSE
```

Steps 3 and 6 are plain code. Do not let the LLM own planning or validation.

---

## 2. Data contracts

### 2.1 Project tiers

```sql
tier ENUM('verified','registry')
```

- `verified` (target: 40 projects) — every field in §2.3 populated, refresh cadence enforced.
- `registry` (the remaining ~260) — name, builder, sector, status, RERA id only.

`search_projects` and `score_candidates` operate on `tier='verified'` **only**. `get_project` works on both but returns a `coverage: 'registry'` marker that forces the `unverified_notice` component.

### 2.2 Per-field-group freshness

Do not use a single `updated_at`. Required columns:

```
pricing_verified_at      -- SLA 30d, stale at 45d
inventory_verified_at    -- SLA 30d, stale at 45d
legal_verified_at        -- SLA 90d  (RERA, litigation)
construction_verified_at -- SLA 60d
static_verified_at       -- SLA 365d (floor plans, layout, amenities)
```

Tool layer behaviour: if a field group exceeds its stale threshold, the tool still returns the value but sets `stale: true` and `verified_at`. The composer must surface it. Never silently serve stale pricing.

### 2.3 Required fields for Tier 1

Audit the existing 50 against this list before writing chat code. Any missing field disables the feature named beside it.

| Field | Enables |
|---|---|
| `gate_lat`, `gate_lng` (entrance, not centroid) | commute scoring |
| `sector_id`, `corridor_id` | area reasoning |
| `configs[]` with `carpet_sqft`, `built_up_sqft`, `base_price` | search, comparison |
| `plc_charges`, `ifms`, `club_charge`, `parking_charge` | true all-in cost |
| `gst_applicable`, `registry_pct` | true all-in cost |
| `maintenance_psf_month` | holding cost |
| `payment_plan[]` (structured milestones, not a PDF) | payment plan table |
| `rera_id`, `rera_completion_date` | risk scoring |
| `possession_promised`, `possession_revised[]` | delay analysis |
| `construction_stage`, `construction_pct` | risk scoring |
| `builder_id` → `builder.delivery_history[]` | builder record |
| `total_units`, `acres`, `towers`, `floors` | density |
| `open_area_pct`, `has_internal_park`, `walking_track` | elderly-fit scoring |
| `litigation_flags[]` | risk |
| `inventory_available` by config | live relevance |

### 2.4 Price history (create this table week 1)

```sql
CREATE TABLE price_history (
  id BIGSERIAL PRIMARY KEY,
  project_id INT NOT NULL,
  config TEXT NOT NULL,
  price_psf NUMERIC NOT NULL,
  source TEXT NOT NULL,        -- 'builder' | 'broker' | 'portal' | 'transaction'
  captured_at DATE NOT NULL,
  UNIQUE (project_id, config, captured_at)
);
```

Also maintain `sector_price_history` at sector+config granularity. History cannot be backfilled; start now.

### 2.5 Sector and corridor content

```
corridor: id, name, slug, one_liner, character, typical_budget_band,
          connectivity_summary, who_it_suits, main_tradeoff

sector:   id, corridor_id, name, one_liner, connectivity, density_profile,
          social_infra, green_cover, aqi_profile, water_power_reliability,
          who_lives_here, resale_demand, pros[], cons[], avg_psf_by_config
```

**These are hand-written by a human and served from cache. Zero LLM generation.** This is editorial product, not model output. Write 15–20 sectors deeply before launch; the rest can be corridor-level only.

### 2.6 User profile (the slot schema)

```json
{
  "intent": "end_use | investment | rental_yield | exploring | null",
  "city": "noida",
  "budget": { "min": null, "max": null, "confidence": "stated|inferred|null" },
  "financing": { "uses_loan": null, "down_payment": null },
  "configs": [],
  "timeline": { "possession_pref": "ready|under_construction|any|null", "buy_by": null },
  "household": { "adults": null, "children": [{"age": null}], "elderly_members": null },
  "anchors": [
    { "label": "husband office", "lat": null, "lng": null,
      "mode": "car|metro|transit", "trips_per_week": 5, "weight": 1.0 }
  ],
  "lifestyle": {
    "density_pref": "low|medium|any|null",
    "green_priority": null,
    "aqi_sensitive": null,
    "needs_walkable_open_area": null,
    "social_infra_priority": null
  },
  "must_haves": [],
  "dealbreakers": [],
  "shortlist": [],
  "rejected": [ { "project_id": null, "reason": null } ],
  "coverage_requests": [],
  "last_seen_at": null
}
```

Notes:
- `rejected` is the highest-value field for return sessions. Always log the reason.
- `anchors` is a list, not a single office. The relocating-family case needs 2–4.
- Persist across sessions keyed to user. On session resume, greet with a one-line recap and a resume affordance, never a re-interrogation.

---

## 3. Router

Model: Gemini Flash. Temperature 0. Output: strict JSON. Keep the prompt under ~600 tokens; this call is on the latency critical path.

### 3.1 Intent taxonomy

| Intent | Description |
|---|---|
| `greeting` | Hi / hello / how are you |
| `out_of_domain` | Non-real-estate |
| `discovery` | "Help me find a place", open-ended |
| `area_question` | About a city, corridor, or sector |
| `project_factual` | Specific field of a specific project |
| `project_open` | "Tell me about X" |
| `comparison` | Two or more named projects |
| `computation` | Commute, affordability, total cost, EMI |
| `advisory` | "Should I buy", "is now a good time", "is this worth it" |
| `coverage_gap` | Outside Noida, or a registry-tier project |
| `profile_meta` | "Change my budget", "forget that", "what do you know about me" |
| `ambiguous` | Genuinely underspecified |

### 3.2 Router output

```json
{
  "intent": "discovery",
  "confidence": 0.0,
  "entities": {
    "projects": [], "sectors": [], "corridors": [],
    "configs": [], "budget_mentioned": null, "locations_mentioned": []
  },
  "slot_updates": { },
  "requires_clarification": false
}
```

`slot_updates` contains only what the user explicitly stated this turn. Inference happens in the policy layer, not here.

---

## 4. Policy layer (deterministic)

This is the brain. Plain TypeScript/Python. No LLM.

### 4.1 Readiness gates

```
can_search()        := budget.max != null OR configs.length > 0 OR corridor known
can_score_commute() := anchors with valid coords >= 1
can_recommend()     := can_search() AND (anchors >= 1 OR corridor chosen)
can_generate_memo() := budget.max AND configs AND anchors>=1 AND shortlist>=2
```

### 4.2 Slot priority ladder (end-use relocator)

Ask in this order, skipping anything already known or inferable:

1. `intent` — end-use vs investment (changes everything downstream)
2. `budget.max`
3. primary work `anchor` (with geocode)
4. `configs`
5. `household` composition
6. `timeline.possession_pref`
7. secondary `anchors` (spouse office, school)
8. `lifestyle` preferences
9. `must_haves` / `dealbreakers`

### 4.3 Elicitation rule (information gain)

Ask for slot S this turn **only if all are true**:

- S is unknown and not inferable
- S is the highest-priority unknown per §4.2
- Knowing S would change the tool plan or materially change the ranking
- The turn already delivered an answer or a result

Otherwise ask nothing. Two consecutive question-only turns is a bug.

### 4.4 Intent → tool plan map

| Intent | Plan |
|---|---|
| `greeting` | none. One-line greeting + one orienting question. No corridor dump. |
| `out_of_domain` | none. One-sentence answer or decline. No redirect pitch. |
| `discovery`, budget unknown | `corridor_overview` → render corridor cards → ask budget |
| `discovery`, budget known, no anchor | `search_projects` (broad) + `corridor_overview` → ask primary work location |
| `discovery`, budget + anchor known | `search_projects` → `score_candidates` → top 3 project cards |
| `area_question` | `sector_brief` or `corridor_overview` (+ `price_trend` if price mentioned) |
| `project_factual` | `get_project(sections=[relevant])` |
| `project_open` | `get_project(sections=['overview','money','reality_check'])` |
| `comparison` | `compare_projects` (max 3) |
| `computation` | `score_candidates` / `cost_breakdown` / affordability calc |
| `advisory` | gather full context, then §7 advisory rules |
| `coverage_gap` | `coverage_notice` + queue request; optional `web_lookup` clearly labelled |
| `profile_meta` | `profile_write`; confirm in one line |
| `ambiguous` | one clarifying question, plus a best-guess partial answer if possible |

### 4.5 Anti-loop guards

- If the same slot has been asked twice without a usable answer, stop asking; proceed with a stated assumption and show it as an editable chip.
- If three consecutive turns produced no component, force a result-bearing tool call.
- If the user gives a compound answer covering several slots, absorb all of them and skip ahead.

---

## 5. Tool contracts

All tools return `{ data, provenance, stale, verified_at, coverage }`.

```
corridor_overview(city_id)
  → corridors[]: { id, name, one_liner, budget_band, connectivity_summary,
                   who_it_suits, main_tradeoff, project_count_verified }

sector_brief(sector_ids[])
  → sectors[]: full §2.5 record

search_projects({
  corridor_ids?, sector_ids?, configs?, budget_min?, budget_max?,
  possession_pref?, status?, must_haves?, exclude_ids?, limit=20
}) → projects[] (tier='verified' only), with match_reasons[]

get_project(project_id, sections[])
  sections ⊂ ['overview','money','floorplans','location','builder','reality_check','inventory']

score_candidates({
  anchors: [{lat,lng,mode,trips_per_week,weight}],
  lifestyle: {...},
  candidate_ids: []
}) → scored[]: {
      project_id, total_score,
      breakdown: { commute, density, green, social_infra, risk, value },
      commute_detail: [{ anchor_label, minutes, mode, distance_km }]
    }
  DETERMINISTIC. No LLM. Weights defined in code and disclosed in the UI.

compare_projects(ids[] max 3, dimensions[])
  → matrix keyed by dimension

cost_breakdown(project_id, config, { uses_loan, down_payment, tenure_years, rate })
  → { base, plc, ifms, club, parking, gst, registry, total_all_in,
      emi_monthly, holding_cost_till_possession, monthly_maintenance }

builder_record(builder_id)
  → { projects_delivered, avg_delay_months, on_time_pct, litigation_count,
      last_5_projects: [{name, promised, actual, delay_months}] }

price_trend(scope: {project_id|sector_id}, config, months=24)
  → series[] from price_history

profile_write(slot_updates) → ack

web_lookup(query) → results[] hard-tagged unverified

generate_memo(shortlist_ids[], profile) → memo artifact id
```

### 5.1 Precompute commute

Precompute travel time from every Tier 1 project gate to the top ~30 employment nodes in Noida/NCR (Sector 62, 63, 125–132, Expressway IT parks, Cyber City, Aerocity, Connaught Place, key metro interchanges) for car and metro. Store in a matrix table. Fall back to the live API only for anchors not in the table, and write the result back into the cache. This converts your flagship feature into a table lookup.

---

## 6. Composer

Model: Gemini Flash for simple factual turns, Pro for advisory and comparison turns. Stream the response.

### 6.1 Output envelope

The composer streams markdown containing component placeholders, plus a trailing JSON block.

```
Narrative text with <<c1>> placeholders inline.

---META---
{
  "components": [
    { "ref": "c1", "type": "project_card", "props": { "project_id": 42 } }
  ],
  "profile_updates": { },
  "suggested_replies": ["Compare these two", "What's the total cost?"],
  "next_question": null
}
```

Client resolves `<<cN>>` against the components array and renders from the tool result payload, not from model text.

### 6.2 Composer system prompt — hard rules

Include verbatim:

```
You are PropFyndr, a decision assistant for property buyers in Noida.

HARD RULES
1. Never write a number that did not appear in this turn's tool results.
   If you need a number you do not have, call a tool or say you do not have it.
2. Only recommend projects marked tier=verified. Registry projects may be
   acknowledged as existing but never ranked or recommended.
3. Maximum 80 words of prose unless the user explicitly asks for detail.
4. Ask at most one question, and only if <next_question> was supplied to you.
5. Never ask for information already in the profile.
6. If a tool returned stale=true, state the as-of date alongside the figure.
7. If asked something outside Noida coverage, say so plainly in one sentence
   and offer to add it to the coverage queue. Do not guess.
8. When you recommend, name the specific user constraint each recommendation
   satisfies. "Best" without stated criteria is forbidden.
9. If the evidence says a project is a poor fit for this user, say so directly.
   Do not soften it into a pros-and-cons list.
10. Never ask a question the user lacks the knowledge to answer. Recommend
    and explain instead.
11. Do not pitch, upsell, or add closing lines like "let me know if you need
    anything else."
```

### 6.3 Number guard (postprocess, code)

Before emitting a completed response:

1. Regex all numeric tokens out of the narrative.
2. Whitelist: quantities present in this turn's tool results, ordinals, counts of listed items, and years already in the conversation.
3. Any unmatched number → drop the sentence and log a `hallucinated_figure` event.
4. Alert on any non-zero rate. This is a release blocker metric.

---

## 7. Advisory rules

Triggered by intent `advisory`. This is the highest-trust and highest-liability surface.

- Present as informational analysis, never as regulated financial advice. Include a persistent, low-key disclaimer in the advisory component, not in the prose.
- Never state a market timing opinion as fact. Use the data you have (`price_trend`, inventory, delivery risk) and show it.
- Affordability, yield, and cost comparisons must come from `cost_breakdown` and a deterministic calculator, never from model reasoning.
- Negative verdicts are required behaviour. If a project fails the user's stated constraints, say no and name the failing constraint.
- Get a legal opinion on SEBI/RERA advisory scope before launching investment recommendations for the investor persona.

---

## 8. Component registry

| Component | Props | Used for |
|---|---|---|
| `corridor_cards` | corridors[] | orienting a newcomer |
| `sector_brief_card` | sector | area questions |
| `project_card` | project_id, match_reasons[] | search results, recommendations |
| `project_detail` | project_id, tab | opened from a card |
| `project_compare_table` | ids[], dimensions[] | comparison |
| `payment_plan_table` | project_id, config | payment schedule |
| `cost_breakdown_table` | project_id, config, financing | true all-in cost |
| `commute_matrix` | scored[], anchors[] | life-fit result |
| `price_trend_chart` | series | trend questions |
| `builder_record_card` | builder_id | risk |
| `risk_score_card` | project_id | reality check |
| `shortlist_tray` | ids[] | persistent, always visible |
| `profile_chips` | profile | editable summary of what we know |
| `coverage_notice` | requested_entity | outside coverage |
| `unverified_notice` | project_id | registry-tier project |
| `memo_card` | memo_id | shareable decision artifact |

Every component renders a provenance footer: source + `verified_at` + stale badge when applicable.

**Project detail tabs:** Overview · Money · Floor plans · Location & commute · Builder · Reality check. The Money and Reality check tabs are the differentiators; build them first.

---

## 9. Worked traces

### 9.1 Newcomer, cold start

**U:** "Hi, how are you doing?"

Router: `greeting`. Policy: no tools. Elicit `intent`.

**A:** "Doing well. I cover the Noida property market in detail — projects, sectors, real costs, and how each one fits an actual daily routine. Are you looking to buy for yourself to live in, or as an investment?"
`components: []` · `next_question: intent`

Note: no corridor dump, no menu. One question.

---

**U:** "Looking to buy for myself, moving to Noida from Pune."

Slots: `intent=end_use`, relocating. Next unknown by ladder: `budget`.

**A:** "Relocating means the daily routine matters more than the brochure. Noida splits into three broad zones with quite different price bands and characters."
`components: [corridor_cards]`
"What budget range are you working with? A rough band is fine."
`next_question: budget.max`

Corridor cards are shown as *orientation*, not as a question to answer.

---

**U:** "Around 1.2 to 1.6 crore."

Slots: `budget={1.2cr, 1.6cr, stated}`. Next: primary anchor.

**A:** "That band puts Noida Extension and parts of Central Noida in play, with the Expressway mostly out of reach for a 3BHK."
`components: [corridor_cards (filtered to affordable, with counts)]`
"Where will you be working day to day? Commute is the single biggest driver of which zone actually suits you."
`next_question: anchors[0]`

---

**U:** "My office is in Sector 62. My wife works in Sector 16A Film City and we have a 7-year-old who'll need a good school. My parents live with us, dad's 71 and walks daily."

Compound answer. Absorb everything: two anchors, child age 7 → school anchor pending, `elderly_members=1`, `needs_walkable_open_area=true`, `aqi_sensitive=true` (inferred, mark as inferred and show as an editable chip), `configs=[3BHK]` (inferred from household — confirm implicitly, not by asking).

Plan: `search_projects` → `score_candidates` with weighted anchors.

**A:** "Both those offices pull you toward Central Noida rather than the Extension. Weighting your commute at 5 days, your wife's at 5, and adding walkable open space plus lower density for your father, three come out ahead:"
`components: [commute_matrix, project_card ×3, profile_chips]`
"Want me to check schools within 3km of these, or look at total cost first?"

Notice: no question about corridor preference. The system decided and justified.

---

**U:** "What about the payment plan for the second one?"

`project_factual` → `get_project(sections=['money'])`

**A:** "Construction-linked, 10% on booking:"
`components: [payment_plan_table, cost_breakdown_table]`
"All-in works out well above the base price once PLC, IFMS and registry are counted — that's reflected in the second table."

No number in the prose. All figures in components.

---

**U:** "Is Godrej Golf Links a good option?"

Assume registry tier.

**A:** "That one's in my index but I haven't verified its pricing or delivery record yet, so I won't rank it against the others."
`components: [unverified_notice with 'prioritize this' action]`
"I can flag it for verification — it's usually a few days. In the meantime, it sits in a different budget band from the shortlist you're building."

---

**U:** "Should I just buy in Greater Noida instead, it's cheaper?"

`advisory` + partial coverage gap.

**A:** "Cheaper, yes, but it adds substantially to both your commutes, and your wife's Film City trip is the one that suffers. My Greater Noida coverage is also thin right now, so I'd be comparing verified projects against unverified ones, which isn't a fair comparison."
`components: [commute_matrix comparison]`
"If the budget is the pressure point, I'd look at 2BHK+study in Central Noida before I'd trade away two hours a day."

Direct opinion, stated criteria, honest about coverage.

### 9.2 Fully-specified expert user

**U:** "3BHK under 1.6 in Sector 150, is Godrej Woods worth it vs ATS Knightsbridge?"

Router: `comparison`, entities extracted. Policy: skip the entire ladder. Run `search_projects` + `compare_projects` + `builder_record` in parallel.

**A:** Comparison table + risk cards + a two-sentence verdict naming the criterion. No greeting, no budget question, no corridor cards.

This must work on turn one. It is the test case that proves the policy layer isn't a wizard.

---

## 10. Latency budget

| Stage | Target |
|---|---|
| Router | ≤ 350ms |
| Policy | ≤ 5ms |
| SQL tools | ≤ 60ms |
| Commute (cached) | ≤ 40ms |
| Commute (cold API) | ≤ 900ms, write-back to cache |
| First composer token | ≤ 800ms from request |
| Full response | ≤ 4s |

Rules:
- Fire tools in parallel. Never chain what can run concurrently.
- Render components the moment tool results land; do not wait for narrative completion.
- Sector briefs and corridor overviews served from cache, zero LLM cost.
- **No second LLM pass for formatting.** Components handle presentation.
- Cache `get_project` payloads keyed by `project_id + static_verified_at`.

---

## 11. Eval harness

Build before prompt tuning. 60+ frozen cases with expected behaviour.

Categories and minimum counts:

| Category | Cases | Pass criterion |
|---|---|---|
| Factual lookup | 10 | Correct figure, correct component, correct provenance |
| Multi-constraint ranking | 8 | Deterministic score matches fixture |
| Comparison | 6 | All dimensions present, no invented fields |
| Coverage gap | 6 | Refuses, offers queue, invents nothing |
| Out-of-domain | 5 | ≤1 sentence, no sales pitch |
| Ambiguous | 5 | Asks exactly one question, partial answer given |
| Expert cold open | 5 | Skips ladder, answers on turn 1 |
| Compound answer | 4 | Absorbs all slots, skips ahead |
| Negative verdict | 5 | Says no when constraints fail |
| Stale data | 3 | Surfaces as-of date |
| Profile meta | 3 | Updates and confirms correctly |

**Primary metric: `hallucinated_figure_rate`. Target 0. Any non-zero result blocks release.**

Secondary: question-per-turn ≤ 1 (hard), turns-to-first-component (target ≤ 2), turns-to-shortlist (target ≤ 6 for cold newcomer).

---

## 12. Build order

**Week 1 — data**
Audit the 50 against §2.3. Create `price_history`. Add per-field-group timestamps. Geocode gates precisely. Formally split tiers. Write 15 sector briefs and 3 corridor overviews by hand.

**Week 2 — tools**
Implement all tools in §5 with the standard return envelope. Build the commute precompute matrix. Test every tool through a plain form UI with no chat at all, so tool bugs never masquerade as prompt bugs.

**Week 3 — components**
Build the registry in §8, project card → detail page with all six tabs, provenance footers, shortlist tray, profile chips. Static props, no LLM yet.

**Week 4 — chat**
Router, policy layer, composer, streaming, number guard, profile persistence.

**Week 5 — evals and iteration**
Build the harness, run it, fix. Only now touch prompt wording.

**Week 6 — memo and handoff**
`generate_memo` shareable artifact. Consented per-project introduction flow.

---

## 13. Explicitly out of scope for v1

- General-purpose chat on non-real-estate topics
- Any city other than Noida
- Voice
- Broker-side or builder-side dashboards
- Automated lead pushing (introductions are user-initiated, per project, one at a time)
- Investment advisory for the investor persona, pending legal review
- A full admin CMS (a spreadsheet plus a sync script is sufficient at 40 projects)

---

## 14. Instrumentation

Log per turn: intent, confidence, tools called, latency per stage, components emitted, questions asked, slots filled, hallucination-guard triggers, stale-data serves, coverage-gap requests.

The coverage-request queue is your data roadmap. Sort by frequency and verify in that order.
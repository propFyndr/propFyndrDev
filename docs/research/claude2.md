# PropFyndr — Query Resolution Spec v1

Companion to `propfyndr-chat-spec.md`. Where the two differ, this document supersedes §3 and §4 of the base spec.

**Change from base spec:** the single-label intent router is replaced by multi-label facet extraction plus a deterministic evidence graph. Intent survives only as a tone/shape hint, never as a control-flow switch.

---

## 1. Why not a handler per intent

A handler-per-intent design fails on three query classes that dominate real traffic:

1. **Compound queries.** "Is Godrej Woods worth it for a family relocating with an office in Sector 62?" is judgment + fact + computation + risk simultaneously.
2. **Mid-conversation pivots.** "Actually forget commute, what's the cheapest one with a park?" changes dimensions without changing subject.
3. **Elliptical references.** "What about the second one?" carries no extractable intent at all; it inherits everything from turn state.

Facet extraction handles all three with one code path.

---

## 2. Layer 1 — Facet extraction

Model: Gemini Flash, temperature 0, JSON mode. Prompt budget ≤ 700 tokens. This is on the critical path.

### 2.1 Output schema

```json
{
  "asks": ["judgment", "fact"],
  "subjects": {
    "scope": "specific | filtered | open | none",
    "projects": [{"name": "Godrej Woods", "resolved_id": 42, "confidence": 0.95}],
    "sectors": [], "corridors": [], "builders": [], "city": "noida"
  },
  "dimensions": ["commute", "risk", "cost_total"],
  "constraints_stated": {
    "budget_min": null, "budget_max": 16000000,
    "configs": ["3BHK"], "possession_pref": null,
    "must_haves": ["park"], "dealbreakers": []
  },
  "stance_requested": true,
  "references": {"ordinal": null, "anaphora": null},
  "slot_updates": {},
  "off_domain": false,
  "confidence": 0.88
}
```

### 2.2 `asks` vocabulary (multi-select)

| Ask | Meaning |
|---|---|
| `orientation` | User needs the lay of the land before they can decide anything |
| `fact` | A specific value about a specific thing |
| `explanation` | Why something is the case |
| `recommendation` | Give me options that fit me |
| `comparison` | Set these side by side |
| `computation` | Calculate something from my inputs |
| `judgment` | Tell me what you think, take a position |
| `action` | Do something (shortlist, connect me, save, generate memo) |

### 2.3 `dimensions` vocabulary (multi-select)

`price` · `cost_total` · `payment_plan` · `financing` · `commute` · `schools` · `healthcare` · `aqi` · `density` · `green_open_space` · `social_infra` · `safety` · `risk_delivery` · `risk_legal` · `builder_record` · `construction_stage` · `resale_liquidity` · `rental_yield` · `price_trend` · `floorplan` · `amenities` · `inventory` · `timing` · `area_character`

Dimensions are the unit of work. Everything downstream keys off this list.

### 2.4 Dimension inference from profile

The extractor reports only what was *said*. The policy layer adds implied dimensions from the profile:

| Profile signal | Auto-added dimensions |
|---|---|
| `household.elderly_members > 0` | `green_open_space`, `aqi`, `healthcare`, `density` |
| `household.children[]` non-empty | `schools`, `safety` |
| `anchors.length >= 1` | `commute` |
| `intent == "investment"` | `rental_yield`, `resale_liquidity`, `price_trend` |
| `intent == "end_use"` | `cost_total`, `risk_delivery` |
| `financing.uses_loan == true` | `financing`, `cost_total` |

Auto-added dimensions are marked `source: "inferred"` and are visible in `profile_chips` so the user can remove them. Never let an inferred dimension silently dominate a ranking.

---

## 3. Layer 2 — Evidence graph

Plain code. No LLM. This replaces every per-intent handler.

### 3.1 Dimension → evidence map

```
price               → project.configs.base_price, price_history(latest)
cost_total          → project.charges.*, profile.financing → cost_breakdown()
payment_plan        → project.payment_plan[]
financing           → profile.financing + cost_breakdown()
commute             → project.gate_coords + profile.anchors + commute_matrix
schools             → poi_index(type=school, radius=3km)
healthcare          → poi_index(type=hospital, radius=5km)
aqi                 → sector.aqi_profile
density             → project.total_units / project.acres, sector.density_profile
green_open_space    → project.open_area_pct, has_internal_park, walking_track
social_infra        → sector.social_infra
safety              → sector.safety_profile
risk_delivery       → builder_record + rera_completion_date + construction_stage
risk_legal          → project.litigation_flags, rera_id status
builder_record      → builder_record(builder_id)
construction_stage  → project.construction_stage, construction_pct
resale_liquidity    → price_history + resale_transaction_count(24m)
rental_yield        → rental_comps(sector, config) + cost_total
price_trend         → price_history(project|sector, 24m)
floorplan           → project.floorplans[]
amenities           → project.amenities[]
inventory           → project.inventory_available
timing              → price_trend + inventory + delivery_pipeline(sector)
area_character      → sector_brief | corridor_overview
```

### 3.2 Execution waves

Resolve dependencies, then fire each wave in parallel.

```
WAVE 0  (no dependencies)
  corridor_overview, sector_brief, get_project(named ids),
  builder_record, price_trend(sector scope), poi_index

WAVE 1  (needs a candidate set)
  search_projects(constraints ∪ profile constraints)

WAVE 2  (needs candidates + profile)
  score_candidates, cost_breakdown(per candidate), price_trend(project scope),
  rental_comps, resale_transaction_count

WAVE 3  (needs scored results)
  compare_projects, generate_memo
```

Candidate set resolution order:
1. Explicitly named projects in `subjects.projects` → use those ids, skip Wave 1.
2. `subjects.scope == "filtered"` → run `search_projects`.
3. `subjects.scope == "open"` and `can_search()` → run `search_projects` broad.
4. `subjects.scope == "open"` and `!can_search()` → skip Wave 1 and 2 entirely, shape = ORIENT.

### 3.3 Timeboxing

Total tool budget 1200ms. Each wave gets a deadline. If a Wave 2 tool misses its deadline, drop that dimension, mark it `unavailable`, and let the composer say so. **Never delay the whole response for one slow dimension.** A partial answer at 2s beats a complete one at 7s.

---

## 4. Layer 3 — Response shape

### 4.1 Shape selection

Evaluate in this priority order and take the first match. Priority matters: it resolves compound queries deterministically.

```
1. BOUNDARY   if off_domain, or subject outside coverage, or all subjects tier=registry
2. CLARIFY    if referential ambiguity unresolvable from turn state
3. VERDICT    if stance_requested or "judgment" ∈ asks
4. COMPARE    if "comparison" ∈ asks or |resolved candidates| in [2,3] and dimensions ≥ 2
5. RESULT_SET if "recommendation" ∈ asks and candidates ≥ 1 with ≥2 match reasons each
6. ANSWER     if "fact" or "computation" or "explanation" ∈ asks and evidence resolved
7. ORIENT     if "orientation" ∈ asks, or !can_search()
8. CLARIFY    fallback
```

### 4.2 Shape definitions

Each shape fixes the narrative template and the component slate. The model fills the template; it does not choose the structure.

| Shape | Prose | Components (in order) | Question |
|---|---|---|---|
| `ORIENT` | ≤ 50w framing | `corridor_cards` or `sector_brief_card` | exactly 1 |
| `ANSWER` | ≤ 40w | the dimension's component(s) | 0 or 1 |
| `RESULT_SET` | ≤ 60w naming the ranking criteria | `commute_matrix` (if scored) → `project_card` ×≤3 → `profile_chips` | 0 or 1 |
| `VERDICT` | ≤ 90w, structure in §5 | evidence components ×2–3 | 0 |
| `COMPARE` | ≤ 50w + one verdict line | `project_compare_table` → risk cards | 0 |
| `BOUNDARY` | ≤ 40w | `coverage_notice` or `unverified_notice` | 0 |
| `CLARIFY` | partial answer + question | whatever partial evidence supports | exactly 1 |

---

## 5. Per-family handling

### 5.1 VERDICT (advisory)

The highest-trust surface. Sub-classify before answering:

| Judgment type | Trigger | Minimum evidence | Behaviour |
|---|---|---|---|
| `fit` | "is X right for me" | profile constraints + project record + commute score | Answer directly |
| `choice` | "X or Y" | both projects Tier 1 + ≥3 shared dimensions | Answer directly |
| `value` | "is X overpriced" | `price_trend` + sector comps + `cost_total` | Answer with band, not point |
| `timing` | "should I buy now" | `price_trend` + inventory + delivery pipeline | Answer descriptively; state explicitly that you do not forecast |
| `allocation` | "should I put money in property" | — | **Out of scope v1.** Explain what you can do instead |

**Fixed verdict template.** The composer must follow this order:

```
1. The position, first sentence, unhedged. No "it depends", no "there are
   several ways to look at this."
2. The two or three pieces of evidence that drove it — rendered as components,
   never as prose numbers.
3. The strongest case against, one sentence.
4. What would change the answer. One sentence, concrete and checkable.
```

Element 4 is mandatory and is what distinguishes an advisor from a recommendation engine. Example: "If your wife's Film City commute drops to two days a week, the Extension options come back into play."

**Refusal conditions.** Return BOUNDARY instead of VERDICT when:
- Required evidence is missing or stale beyond threshold
- Any subject is tier=registry (never judge unverified projects)
- The question requires price forecasting
- The question is `allocation` type

**Negative verdicts are mandatory behaviour.** If the evidence says a project fails a stated constraint, the first sentence says no and names the failing constraint. Do not convert a negative verdict into a balanced pros-and-cons list. Cover this in the eval set with at least 5 cases, because this is the behaviour that will silently erode under revenue pressure.

**Disclaimer placement:** inside the advisory component footer, never in the prose. Prose disclaimers destroy the tone; component footers are read as professionalism.

---

### 5.2 RESULT_SET (search and recommendation)

Pipeline:

```
1. Merge constraints: constraints_stated ∪ profile constraints
   Explicit statement in this turn wins on conflict, and updates the profile.
2. search_projects(merged) over tier='verified', limit 20
3. If results == 0 → relaxation ladder (§5.2.2)
4. score_candidates(profile.anchors, profile.lifestyle, candidate_ids)
5. Rank by total_score
6. Generate match_reasons per candidate (§5.2.1)
7. Filter: drop any candidate with < 2 match reasons
8. Emit top 3
```

#### 5.2.1 Match reason generation (deterministic)

A match reason is `{dimension, user_slot, project_value, comparison}`. Generated by code, not the model, by walking the user's stated slots against the project record:

```
budget      → "1.42cr all-in, inside your 1.6cr ceiling"
anchors[0]  → "22 min to Sector 62 by car at peak"
elderly     → "42% open area with an internal walking track"
children    → "3 schools within 2.5km"
config      → "3BHK, 1,485 sqft carpet"
must_have   → "internal park"
```

**The two-reason floor is a hard gate.** If a candidate cannot produce two reasons tied to slots the *user actually stated* (not inferred), it is not shown. If fewer than two candidates survive the gate, the shape downgrades to ORIENT or CLARIFY: show the sector brief, ask the one question that would unlock ranking.

Rationale: a card without reasons is a listing. A feed of listings is the product you are trying to beat.

#### 5.2.2 Zero-result relaxation ladder

Relax one constraint at a time, in this order, and **always state what was relaxed**:

```
1. Widen budget ceiling by 10%
2. Widen sector to corridor
3. Relax possession preference
4. Drop lowest-priority must_have
5. Widen corridor to city
6. Report honestly: "Nothing verified matches. Here is what is closest,
   and here is the constraint that is binding."
```

Never silently return near-misses as if they were matches.

#### 5.2.3 Card emission rules

- Maximum 3 project cards per turn. Always. Mobile viewport and decision fatigue both cap out here.
- If more than 3 qualify, emit 3 plus a "N more that fit" affordance.
- A named project in the query always gets a card, even when the verdict on it is negative. It anchors the conversation.
- `commute_matrix` renders **before** the cards whenever scoring ran. The reasoning precedes the options.
- Registry-tier projects never render as `project_card`. They render as `unverified_notice`.
- Every card carries its `match_reasons` and a provenance footer.

---

### 5.3 ANSWER (fact, computation, explanation)

```
1. Resolve subject (named project, ordinal reference, or active_project)
2. Map dimension → evidence
3. Single tool call where possible
4. Render the dimension's component
5. Prose ≤ 40 words, zero numbers
```

Computation sub-case: all arithmetic runs in code (`cost_breakdown`, EMI, yield, score). The model narrates the result and never performs the calculation. [This is the single most common source of hallucinated figures in this product class.]

Explanation sub-case: "why is Sector 150 cheaper than Sector 128" is answered from `sector_brief` fields plus `price_trend`, not from model world-knowledge. If the briefs do not contain the answer, say so; do not improvise regional analysis.

---

### 5.4 COMPARE

- Hard cap 3 projects. Four-column tables are unreadable on mobile and the fourth column is never the one chosen.
- Dimension set = union of query dimensions and profile-inferred dimensions, capped at 8 rows, ordered by profile priority.
- Every cell comes from a tool result. A missing value renders as an explicit "not verified" cell, never as blank and never as an estimate.
- Mandatory closing verdict line naming the criterion: "On your commute weighting, A wins. If budget is the binding constraint, B."
- If any subject is tier=registry, the comparison is refused and BOUNDARY is returned. Do not compare verified against unverified.

---

### 5.5 ORIENT

Fires when the user cannot yet be helped with specifics. Two triggers: `!can_search()`, or explicit orientation ask.

- Corridor cards, not sector cards, for a cold newcomer. Three to four options is orientation; twenty is a phone book.
- Filter corridor cards by budget the moment budget is known, and say what was filtered out.
- **Never end an ORIENT turn by asking the user to pick a corridor.** That is the question the system exists to answer. Ask about their life (budget, workplace, household); derive the corridor and present it as a reasoned recommendation.

---

### 5.6 BOUNDARY

Four sub-cases, each with a distinct component:

| Case | Response |
|---|---|
| Outside Noida | One sentence. Offer coverage queue. Do not attempt a web-sourced answer for a full city. |
| Registry-tier project | Acknowledge it exists, state it is unverified, offer to prioritize verification, give an ETA. |
| Stale beyond threshold | Serve the value with a prominent as-of date and an offer to refresh. |
| Out of domain | One sentence, or a plain decline. **No redirect pitch.** Do not append "but we're experts in real estate." |

BOUNDARY turns must still feel useful. Always pair the boundary with the nearest thing you *can* do.

---

### 5.7 CLARIFY

Three ambiguity types, three different treatments:

| Type | Example | Treatment |
|---|---|---|
| **Underspecified** | "show me some flats" | Answer partially with what you have, then ask the single highest-priority unknown |
| **Referential** | "that one" with two candidates in turn state | Ask which. No partial answer; guessing here is worse than asking |
| **Semantic** | "a good area" | Interpret against profile, **state the interpretation**, proceed. Do not ask |

Hard rule: never ask a clarifying question you could resolve from the profile or from a defensible default. State the assumption as an editable chip and move.

---

## 6. Turn state and reference resolution

Resolved in code before the extractor runs. Never delegated to the model.

```json
{
  "last_cards": [42, 17, 88],
  "last_comparison": [42, 17],
  "active_project": 42,
  "active_sector": 128,
  "last_shape": "RESULT_SET",
  "last_dimensions": ["commute", "cost_total"],
  "pending_question_slot": "configs",
  "unanswered_question_count": 0
}
```

Resolution rules:

| Reference | Resolves to |
|---|---|
| "the second one", "#2" | `last_cards[1]` |
| "that one", "it", "this project" | `active_project` |
| "both" | `last_comparison` |
| "the cheaper one" | recompute over `last_cards` by price |
| "the first two" | `last_cards[0..1]` |
| ordinal out of range | CLARIFY |
| pronoun with no `active_project` | CLARIFY |

`active_project` is set when: a single project is named, a card is tapped, or a project detail page is opened. It is cleared by a new RESULT_SET.

**Dimension carry-over:** if the new query has subjects but no dimensions ("what about Sector 150?"), inherit `last_dimensions`. This is what makes follow-ups feel intelligent, and it is four lines of code.

---

## 7. Degradation ladder

When evidence is incomplete, descend one rung at a time. Never skip a rung to produce a fuller-sounding answer.

```
1. Verified DB, fresh              → answer normally
2. Verified DB, stale              → answer with as-of date surfaced
3. Project-level missing           → answer at sector level, say you did
4. Sector-level missing            → web_lookup, rendered in unverified_notice
5. Nothing available               → say so, offer the coverage queue
```

Rung 4 is capped: web results may never populate a `project_card`, may never enter a comparison table, and may never support a VERDICT.

---

## 8. Compound query worked examples

### 8.1 Judgment + fact + computation

**"Is Godrej Woods worth it? I work in Sector 62 and my budget is 1.6."**

```
asks: [judgment, fact]
subjects: {projects:[Godrej Woods #42], scope:"specific"}
dimensions: [value, commute, cost_total]
+ inferred: risk_delivery (end_use), financing (uses_loan)
constraints_stated: {budget_max: 16000000}
stance_requested: true
slot_updates: {budget.max, anchors[+Sector 62]}
```

Wave 0: `get_project(42)`, `builder_record`, `price_trend(42)`
Wave 1: skipped, project named
Wave 2: `score_candidates([Sector 62 anchor], [42])`, `cost_breakdown(42)`

Shape: VERDICT.

Output structure: position sentence → `cost_breakdown_table` + `commute_matrix` + `risk_score_card` → counter-case sentence → what-would-change sentence. No question.

### 8.2 Mid-conversation dimension pivot

**"Forget commute, which of these has the most open space?"**

```
asks: [comparison, fact]
subjects: {scope:"filtered"}  → resolves to last_cards
dimensions: [green_open_space]   (commute explicitly dropped)
```

No new search. Re-rank `last_cards` on the new dimension. Shape: COMPARE.
Set a session flag lowering the commute weight, and reflect it in `profile_chips` so the user sees the weighting changed.

### 8.3 Elliptical follow-up

**"And the payment plan?"**

```
asks: [fact]
subjects: {} → active_project
dimensions: [payment_plan]
```

One tool call. Shape: ANSWER. Prose ≤ 20 words plus `payment_plan_table`.

### 8.4 Compound with a boundary inside it

**"Compare Godrej Woods with Ace Divino."** (second is tier=registry)

Shape resolves to BOUNDARY, not COMPARE, because priority rule 1 fires on a registry subject.

Output: verified card for the first, `unverified_notice` for the second, an offer to prioritize verification, and a comparison against a verified alternative in the same band instead. Refusing the requested comparison while still delivering a comparison is the correct behaviour.

---

## 9. Instrumentation for this layer

Log per turn: extracted `asks`, `dimensions` (stated vs inferred), resolved shape, waves executed, per-tool latency, dimensions dropped to timeout, degradation rung reached, cards emitted, cards suppressed by the two-reason gate, relaxation steps applied, reference resolutions and failures.

**Watch two ratios weekly:**

- `cards_suppressed / cards_eligible` — rising means your match-reason coverage is thinning, usually because a data field went stale across a cohort.
- `degradation_rung >= 3 rate` — rising means Tier 1 coverage is falling behind demand. This is your signal to verify more projects, and it tells you exactly which ones.

---

## 10. Build order for this layer

1. Turn state and reference resolution. Pure code, testable without any model.
2. Evidence graph and wave executor. Drive it from hand-written facet JSON fixtures, no extractor yet.
3. Shape selector plus the seven prose templates.
4. Match reason generator and the two-reason gate.
5. Facet extractor last. By this point everything downstream is deterministic and tested, so extractor errors are isolatable.

Building the extractor first is the common mistake. It makes every downstream bug look like a prompt problem.
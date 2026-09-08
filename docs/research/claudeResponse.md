1. **"All three" and "both equally" are the same answer, and it's the diagnosis.** [Likely] Your chat fails on in-DB queries *and* out-of-DB queries because it has no fixed idea of who it's talking to. A buyer wants reassurance and orientation. A broker wants precision and speed. A demo audience wants to see the moat. One prompt trying to be all three produces mush in every direction.

**Second: six providers is not resilience, it's the unresolved dual-stack problem multiplied by three.** [Certain] Tool-calling behavior is model-specific — Gemini, Mistral, Cohere and Groq-hosted Llama disagree on when to call a function, how strictly they honor "don't answer without retrieval," and how they handle empty results. You cannot get reliable, testable agent behavior across six surfaces with one prompt. [Guessing] you added providers as fallbacks for rate limits or cost, which is reasonable engineering instinct and wrong here — at your volume, cost is not the bottleneck. Behavioral consistency is. Also worth noticing: Gemini was cut from the stack earlier and is now the main provider. That churn is a signal.

**What I'd do instead:** one model for everything reasoning- and tool-related (Gemini Flash-tier, since it's already primary and its function calling is solid), one fallback wired for outages only, running the *identical* prompt and tool schema. Delete the rest from the request path. The risk in the six-provider approach: you'll ship a bug that only reproduces on Cerebras at 2am before a Wealth Clinic demo, and you won't know which layer broke.

**On the user question, I'll make the call since you won't.** Build for the broker's standard, ship to the buyer's surface. Brokers evaluate your product by asking buyer questions with expert precision — "what's the actual super-to-carpet ratio on ATS Pristine tower C, and how does the price band compare to Godrej Palm Retreat." If the chat survives that, it also delights a buyer and it *is* the investor demo. One persona: a well-briefed advisor with sourced data. The thing you then can't also be is a general-purpose chatbot — and you shouldn't want to be.

---

**Now the actual reverse-engineering.**

Here is the entire anatomy of a ChatGPT turn. There is nothing else:

1. **Context assembly** — system prompt + tool schemas + conversation history, concatenated.
2. **One forward pass.** The model emits either text or a tool call. Nothing "decided" to classify the query. The tool descriptions *are* the classifier.
3. **Tool executes** in your backend. Results appended to context as a tool-result message.
4. **Second forward pass** synthesizes an answer from those results.
5. **Loop** until the model emits text with no tool call.

[Certain] That's it. The sophistication people attribute to routing lives in two unglamorous places: the quality of the tool descriptions, and post-training that taught the model to use tools well. You can't replicate the second. You get most of the value from the first.

**So the leverage is here:** your tool descriptions are your routing logic. Not a classifier you write.

```
get_project(project_name) 
  → "Retrieve full structured intelligence on a specific 
     named residential project in Noida: pricing, layout, 
     builder, RERA status, amenities, construction stage. 
     Use whenever the user names a project, even partially 
     or misspelled."

compare_projects(names[], dimensions[])
  → "Side-by-side comparison across price, size, location, 
     builder credibility. Use when the user mentions two or 
     more projects, or asks 'which is better'."

search_projects(budget, bhk, sector, possession, ...)
  → "Find projects matching buyer constraints. Use when the 
     user describes what they want rather than naming a project."

get_locality_intel(sector)
  → "Schools, connectivity, metro, price trend for a Noida sector."
```

Write those descriptions carefully and 80% of your "how do I distinguish queries" problem evaporates. Vague descriptions are the actual cause of bad routing in every agent I've seen.

**The three-tier response policy** — this goes in the system prompt, not in code:

- **Tier A, in-DB.** Answer from retrieved rows only. Every number traces to a row. If a field is null, say "I don't have that on file for this project" — never estimate. You've already been burned by fabricated confidence scores; this is the same failure mode wearing a different hat.
- **Tier B, real-estate but out-of-DB.** Home loan process, registry and stamp duty, Noida vs Gurgaon, RERA rights, NRI purchase rules. Answer from general knowledge, flag it as general rather than sourced, then bridge back: *"...that's the general process. On the projects I have detailed data for, ATS Pristine is currently at X — want me to check possession timelines against your loan sanction window?"* **This tier is where you win and it's the one everyone skips.** It's also what makes the assistant feel like ChatGPT rather than a search box.
- **Tier C, off-topic.** One warm line, immediate bridge. Your "hi, how are you — are you looking for property in Noida?" example is exactly right, and it should never be more than two sentences.

**The one rule that matters most:** a hard grounding contract. Numbers, dates, names, and prices come *only* from tool results. The model may reason about them freely, but may not invent them. Enforce it in the prompt and then verify it in evals — [Likely] you'll find your current stack violates this on empty-result queries, where models love to fill the void.

**And log every Tier B and Tier C query.** That log is your data roadmap and your investor slide. It costs nothing.

---

Three things I still need before I can write you the actual system prompt and schemas:

1. What can you SQL against for ATS Pristine *today* — table and column names, roughly. Not the 10-layer concept, the real shape.
2. Is there a chat in the product now, and what does it do wrong most visibly?
3. What's the forcing function — demo date, broker meeting, something else?

Give me those and I'll write the system prompt, the tool schemas, and a 20-query eval set you can run against Gemini to prove the grounding contract holds.


2. **Your own file contains two conflicting records for ATS Pristine, and that's your bug.**

Look at what you pasted:

- Two project IDs: `c78b5e04...` and `5c276485...`
- Two RERA numbers: `UPRERAPRJ2875` and `UPRERAPRJ1502`
- Two slugs: `ats-pristine-sector-150` and `ats-pristine-golf-meadows-sector-150`
- Two builders: "ATS Infrastructure Ltd" and "ATS Greens"
- **Three possession dates**: June 1 2023, 2017-12-01, and Aug 31 2020
- Two price sets: primary (₹2.48–2.70 Cr) and resale (₹2.10–3.57 Cr)

[Certain] This is your *anchor* project — the one you went depth-first on for weeks. If it has duplicate entities with contradictory fields, Cleo County is worse, not better. You don't have a prompting problem. You have a data integrity problem wearing an AI costume.

**And that explains the word "sometimes."** [Likely] Your entity resolver matches "ATS Pristine" against both rows and picks whichever scores higher on that particular run. Nondeterministic input → nondeterministic answers. You've probably been debugging the model layer while the row selection underneath was flipping.

---

**Bug class 2: you're using semantic search for structured facts.**

[Likely, but I'd bet heavily on it] "Payment plans for Cleo County" fails because payment plans live in a markdown chunk that got embedded, and the chunk boundary landed badly, or the embedding for "10% at booking → 90% at registry" doesn't sit near the query "payment plan." Vector search is a *similarity* tool. You're asking it to do a *lookup*.

The split you need:

| Query type | Mechanism | Example |
|---|---|---|
| Structured fact | Deterministic field read after entity resolution | payment plan, carpet area, RERA no., possession |
| Comparative | SQL over typed columns | "cheapest 3BHK in Sector 150 under ₹2.5Cr" |
| Narrative / judgment | Vector search over prose chunks only | "is this good for a family", "what are the risks" |

Payment plans, price, area, possession, brand specs — **none of these should ever touch an embedding.** They're columns. Read the column. If the column is null, say so. Right now [Guessing] you have one retrieval path handling all three, which is why it degrades unevenly.

Your resolver should be a deterministic cascade, no ML:

```
exact slug match → alias table match → trigram fuzzy (pg_trgm, threshold 0.4)
→ if >1 candidate above threshold: ASK the user which one
→ if 0: say "I don't have Cleo County in my database yet"
```

That last branch matters. "I don't have that project" is a *correct* answer and your system should be able to give it confidently instead of hallucinating around it.

---

**On "3 months and still silly mistakes" — I disagree with your framing.**

These aren't silly mistakes and you weren't careless. [Likely] Here's what actually happened: in three months you built a brochure OCR pipeline, a 10-layer schema, a broker view, a marketing automation stack, and swapped your AI provider stack twice. That's a lot of forward motion. What you never built was a **regression harness**. So every fix was verified by you manually poking the chat once, and every new feature silently re-broke something else.

The reason you can't tell whether Cleo County fails on retrieval, resolution, or generation is that you have no tool-call logs. You are debugging blind. That's the root cause, and it's fixable in a day:

1. Log every turn: `{query, resolved_entity_id, tool_called, tool_args, rows_returned, final_answer}`.
2. Write 30 golden queries — 15 in-DB (including "payment plans for Cleo County"), 10 Tier-B general, 5 that *should* fail gracefully.
3. Run them on every deploy. Assert on `resolved_entity_id` and `rows_returned`, not on answer text.

Do this before you write another feature. [Certain] It will find your Cleo County bug in under an hour, and it stops the "why is this still broken" cycle permanently.

---

**Chips, zero tokens.**

You're right to refuse an LLM call for these. Chips are a **pure function of state you already have** after the tool returns:

```
chips = f(resolved_entity, tool_called, fields_present, fields_already_discussed, sector_siblings)
```

Concrete rules:

- **Field-gap chips.** Row has `payment_plans` and user hasn't asked → chip "Payment plans". Row has null `payment_plans` → **never show that chip.** This alone kills most dead-ends.
- **Sibling chips.** Entity resolved to Sector 150 → "Compare with Godrej Palm Retreat" (pull siblings by sector, rank by DNA score proximity, take top 2).
- **Journey chips.** Track depth: turn 1–2 → discovery ("Show 3BHK options"); turn 3–5 → detail ("Total cost breakdown", "Commute to Candor TechSpace"); turn 6+ → conversion ("Talk to an advisor", "Schedule a site visit").
- **Tier-B chips.** Off-DB query detected → bridge chips: "Home loan eligibility", "Stamp duty in Noida", "Show me projects in this budget".
- **Disambiguation chips.** Resolver returns 2 candidates → the chips *are* the candidates: "ATS Pristine" / "ATS Pristine Golf Meadows". Turns your worst bug into a feature.

Rank by: field-completeness × persona weight × recency-of-mention, take top 3. ~200 lines of TypeScript, zero tokens, sub-millisecond.

[Certain] One correction to your cost assumption though: if you ever *do* want model-written chips, appending `"suggested_followups": [...]` to the structured output of your existing answer call costs ~40 output tokens. That's a rounding error, not a separate call. So the real reason to go deterministic is **latency and consistency**, not cost. Worth knowing so you don't over-optimize the wrong constraint.

---

Four things I need:

1. **Is retrieval vector search, SQL, or both?** This is the single most important thing you haven't told me. What actually runs when someone types "payment plans for Cleo County"?
2. **Where does the markdown dossier live** relative to the DB row — is it a `content` column, a separate vector store, or files on disk?
3. **Is there an alias/canonical name table**, or is name matching done ad hoc at query time?
4. **Do you have the two ATS Pristine rows as an intentional parent/child** (township + sub-project), or is that an ingestion duplicate?





3. **Found it. Line 1 of your resolver:**

```sql
SELECT id, name, slug FROM projects 
WHERE name ILIKE '%Cleo County%' OR slug ILIKE '%cleo-county%' LIMIT 1;
```

[Certain] `LIMIT 1` with no `ORDER BY` is undefined behavior in Postgres. The planner returns whichever row it reaches first, and that changes with query plan, heap order, vacuum, and inserts. **This is literally your word "sometimes."** Same query, same day, different row — and with two ATS Pristine rows carrying different RERA numbers and different possession dates, the answer flips underneath you.

**Second bug, same class:**

```ts
ctx.catalog.find(p => ctx.message.toLowerCase().includes(p.name.toLowerCase()))
```

`.find()` returns the first array match, not the best one. And because this is substring *containment*, shorter names always win. A user typing "ATS Pristine Golf Meadows" matches `"ATS Pristine"` — the more specific project **can never be resolved**, ever, regardless of catalog order. [Certain]

**Third:** you have two resolvers that disagree. `proseEntities.ts` uses in-memory `.find()`, `projectDataGateway.ts` uses SQL ILIKE. Different algorithms, different tie-breaking, different answers — and which one runs depends on which handler caught the query. Same user question, two code paths.

---

**Now the structural thing, and this is the one that matters.**

You asked me in turn one how ChatGPT distinguishes queries. What you've actually built is `topicFlags.ts` — a regex-based intent classifier with a handler per topic. That's the exact architecture I told you ChatGPT *doesn't* have, and you've hit exactly why it doesn't.

Your two complaints are one bug:

- "General queries are lacking" → no regex matched, no handler claimed it, fallback is thin
- "Project details sometimes fail" → the regex *did* match but resolution was nondeterministic

A regex router has an **unbounded tail**. "payment plans for Cleo County" matches. "how do I pay for Cleo County" probably doesn't. "what's the booking amount" probably doesn't. "can I pay in installments" definitely doesn't. You cannot write enough regexes — every one you add is another line you maintain forever, and the user always finds phrasing #N+1.

[Likely] This is why three months of work still feels broken. It isn't sloppiness. You picked an architecture whose cost grows linearly with every question type, and you've been paying that tax without noticing.

**But your instinct to bypass the LLM for factual tables is correct and you should keep it.** `renderPaymentPlanTable()` and the `unverified()` boundary string are genuinely good engineering — that's the grounding contract, already implemented. Don't rip that out.

The fix is to move the boundary:

| Layer | Now | Should be |
|---|---|---|
| Which topic is this? | regex in `topicFlags.ts` | **LLM tool selection** |
| Which project? | ILIKE + LIMIT 1 | **deterministic scored resolver** |
| Get the data | Prisma joins ✅ | unchanged |
| Render facts | deterministic ✅ | unchanged |
| Wrap in prose | — | LLM, over retrieved rows only |

Your handlers become tool definitions. The model picks; your code executes and renders. The unbounded tail disappears because the model generalizes over phrasing — that's the one thing it's actually better at than you.

---

**The resolver. Replace both paths with this single function.**

```ts
type Candidate = { id: string; name: string; slug: string; score: number };

// One resolver. Both call sites use it. No LIMIT 1. No .find().
async function resolveProject(message: string): Promise
  | { kind: 'resolved'; project: Candidate }
  | { kind: 'ambiguous'; candidates: Candidate[] }
  | { kind: 'not_found'; extractedName: string | null }
> {
  const msg = message.toLowerCase();

  // 1. Alias table first — exact, indexed, authoritative.
  const alias = await prisma.projectAlias.findFirst({
    where: { alias: { in: tokenizeNGrams(msg, 5) } },   // n-grams up to 5 words
    include: { project: true },
  });
  if (alias) return { kind: 'resolved', project: toCandidate(alias.project, 100) };

  // 2. Trigram similarity over canonical names. ALL candidates, scored.
  const rows = await prisma.$queryRaw<Candidate[]>`
    SELECT id, name, slug,
           similarity(lower(name), ${msg}) AS score
    FROM projects
    WHERE lower(name) % ${msg}                -- pg_trgm operator, uses GIN index
       OR ${msg} LIKE '%' || lower(name) || '%'
    ORDER BY
      length(name) DESC,                      -- longer name = more specific, wins
      score DESC
  `;

  if (rows.length === 0) return { kind: 'not_found', extractedName: extractCapitalizedPhrase(message) };

  // 3. Ambiguity is a first-class outcome, not a coin flip.
  const top = rows[0];
  const close = rows.filter(r => r.score >= top.score - 0.08);
  if (close.length > 1) return { kind: 'ambiguous', candidates: close.slice(0, 3) };

  return { kind: 'resolved', project: top };
}
```

Three properties your current code lacks: it's **deterministic** (full ordering, no ties left to the planner), it **prefers specificity** (`length(name) DESC` fixes Golf Meadows), and **ambiguity is an outcome you can render** instead of a silent wrong pick.

Prerequisites, in order:

1. `CREATE EXTENSION pg_trgm;` + `CREATE INDEX ON projects USING gin (lower(name) gin_trgm_ops);`
2. **Merge the two ATS Pristine rows.** Keep `c78b5e04...`, migrate any child rows off `5c276485...`, delete it. Then run `inspect-duplicates.ts` across all 73 — [Likely] ATS Pristine isn't the only one, because the enrichment script matched on exact slug for every project, not just this one.
3. **Add the alias table.** `ProjectAlias { id, project_id, alias, source }`. Seed it with: every historical slug, every builder-prefix variant ("ABA Cleo County" / "Cleo County"), every marketing name ("ATS Greens", "ATS Pristine & Golf Meadows"), every common misspelling. This is a 200-row table that fixes more bugs than any prompt change you will ever write.
4. **Add a unique constraint on `rera_number`.** That single constraint would have blocked the duplicate at ingestion. Add it before you seed another project.

---

**One thing you're probably misdiagnosing about Cleo County.**

Your own trace says: if `payment_plans` is empty, the handler returns `unverified('developer payment schedule', ...)`. That's the system **working correctly** — but to you it reads as failure.

So "we fail to get payment plans" is two completely different bugs wearing one shirt:

- **(a) Coverage** — the `payment_plans` rows don't exist for that project. Fix = ingest data. Not a code problem.
- **(b) Routing** — `matchesPaymentPlanRequest()` regex didn't fire on that phrasing, so it fell to the general path. Fix = tool calling.

[Certain] You cannot currently tell these apart, because you log neither. Add this to every turn and you'll know within a day which one you actually have:

```ts
log({ query, resolutionKind, resolvedId, handlerMatched, rowsReturned, renderPath });
```

Run it against 30 golden queries on every deploy. Assert on `resolvedId` and `rowsReturned`, never on answer text.

---

**Chips — now that I know the handler structure, they get concrete and stay at zero tokens.**

Every handler already knows what it fetched. Have each one return chips alongside its render, derived from the Prisma result:

```ts
function buildChips(project, ctx): Chip[] {
  // Ambiguity → the candidates ARE the chips. Your worst bug becomes a feature.
  if (ctx.resolution.kind === 'ambiguous')
    return ctx.resolution.candidates.map(c => ({ label: c.name, query: `Tell me about ${c.name}` }));

  const chips = [];
  // Only offer what exists. Never a chip that leads to unverified().
  if (project.payment_plans?.length && !ctx.asked.has('payment')) chips.push(CHIP.payment);
  if (project.cost_sheets?.length && !ctx.asked.has('cost'))     chips.push(CHIP.totalCost);
  if (project.unit_types?.length && !ctx.asked.has('units'))     chips.push(CHIP.floorPlans);
  if (project.project_dna && !ctx.asked.has('dna'))              chips.push(CHIP.whyThisProject);

  // Sibling comparison: same sector, nearest DNA score.
  chips.push(...siblingChips(project.sector, project.project_dna?.overall, 2));

  // Depth-gated conversion.
  if (ctx.turnCount >= 5) chips.push(CHIP.talkToAdvisor);

  return rank(chips).slice(0, 3);
}
```

The rule that fixes the most user pain: **when `unverified()` fires, the chips must show fields that *do* exist.** Right now a dead-end answer probably offers dead-end chips. Turning "I don't have the payment schedule" into "I don't have that — but here's the full cost sheet, unit plans, and possession status" converts your biggest weakness into competence.

---

**Sequence I'd actually run, one week:**

| Day | Work |
|---|---|
| 1 | Turn logging on. Ship it. Watch real queries. |
| 1–2 | Merge duplicates, add `rera_number` unique constraint, run duplicate audit across all 73 |
| 2–3 | Alias table + the resolver above, wired into both call sites |
| 3 | 30 golden queries as a CI check |
| 4–5 | Convert 4–5 handlers into tool schemas; regex router becomes fallback only |
| 5 | Chips from handler output |

Do not start day 4 before day 3 passes. [Likely] the duplicate merge and resolver alone fix over half of what you're calling "silly mistakes," and you'll want the eval set green to prove it before touching routing.

---

Two questions, then I'll write the tool schemas and the grounding prompt:

1. **How many of your 73 projects have non-empty `payment_plans` and `cost_sheets`?** One SQL count. If it's under 40, your top complaint is a coverage problem and the routing work is premature.
2. **What does the current fallback do** when no handler matches — free LLM generation with no retrieval, a canned message, or something else? That's your entire Tier-B surface and it's the half of the system I still haven't seen.






4. **100% coverage across 280 projects is not good news. It's the next bug.**

Do the arithmetic on your own numbers: 620 payment plan rows ÷ 280 projects = 2.2 each. Cost sheets: exactly 280 for 280 — precisely one per project, no exceptions, no gaps. [Certain] Real-world data is never that clean. Real research produces ragged coverage: some projects have four plans, some have one, plenty have none because the builder never published one.

Uniform completeness across 280 rows means a seed script wrote defaults. [Likely] you have templated payment plans — some variant of 10/90 and 30:70 — stamped onto every project regardless of what that builder actually offers.

If that's true, this is **worse than the bug you asked me to fix.** Your `renderPaymentPlanTable()` bypasses the LLM specifically to prevent hallucinated schedules. But it renders whatever is in the row with full deterministic authority. Templated data flows through your grounding contract and comes out looking like verified fact. `unverified()` — the safety valve you built — can never fire, because no row is ever empty.

A broker forwards that table to a client. The client takes it to the builder. The builder says the schedule is wrong. That's not a chat bug, that's your credibility.

**Run this before anything else:**

```sql
SELECT plan_name, COUNT(DISTINCT project_id) AS projects,
       COUNT(*) AS rows
FROM payment_plans GROUP BY plan_name ORDER BY projects DESC LIMIT 10;

SELECT COUNT(DISTINCT (base_rate_psf, floor_rise_charge, club_membership_fee)) AS distinct_combos
FROM cost_sheets;
```

If the top two plan names cover ~250 projects, or `distinct_combos` is under ~40, it's templated. Then you need a `data_provenance` column (`researched` / `builder_verified` / `inferred_default`) and the renderer must label anything not researched. **`unverified()` needs to be reachable again.**

I'd also note: this is the third instance of the same root cause. Enrichment script wrote a duplicate ATS Pristine. Enrichment script grew the DB from 73 to 280. Seed script filled every payment_plan. [Likely] your ingestion pipeline has no constraints and no provenance, and it will keep manufacturing plausible-looking problems until it does.

---

**Second thing: your guardrail has a hole you can drive a truck through.**

`validateAgainstFacts()` checks RERA numbers and false guarantees. Fine. But the fallback path injects facts into a prompt and lets Gemini generate freely — which means **prices, possession dates, carpet areas, commute times, and appreciation figures are entirely unguarded.** Those are the numbers people actually make decisions on. A hallucinated RERA number is embarrassing. A hallucinated ₹/sq.ft is a lawsuit.

---

Here's the build. Your handlers already do the hard part — they just need to stop being reached by regex.

### Tool schemas

Each maps to a handler you already have. The `description` field is your new router — write it for the model, not for yourself.

```ts
const TOOLS = [
  {
    name: "get_payment_plans",
    description:
      "Payment schedule, booking amount, installment structure, or how a buyer " +
      "pays over time for one named project. Use for any phrasing about paying, " +
      "installments, down payment, booking amount, CLP, PLP, or 'how do I pay'.",
    input_schema: { type: "object", required: ["project"], properties: {
      project: { type: "string", description: "Project name exactly as the user wrote it, including misspellings." }
    }}
  },
  {
    name: "get_cost_breakdown",
    description:
      "All-inclusive cost: base rate, floor rise, PLC, parking, club membership, " +
      "IFMS, GST, stamp duty. Use for 'total cost', 'final price', 'hidden charges', " +
      "'what will I actually pay'. Different from get_payment_plans, which is timing not amount.",
    input_schema: { type: "object", required: ["project"], properties: {
      project: { type: "string" },
      unit_type: { type: "string", description: "e.g. '3 BHK'. Omit if unspecified." }
    }}
  },
  {
    name: "get_project_overview",
    description:
      "Core facts on one project: builder, RERA, possession, towers, units, " +
      "amenities, specifications, DNA scores. Default when a project is named " +
      "without a specific sub-topic.",
    input_schema: { type: "object", required: ["project"], properties: { project: { type: "string" }}}
  },
  {
    name: "search_projects",
    description:
      "Find projects matching constraints when NO project is named. Budget, BHK, " +
      "sector, possession status, builder. Use for 'show me 3BHK under 2 crore in Sector 150'.",
    input_schema: { type: "object", properties: {
      budget_min_cr: { type: "number" }, budget_max_cr: { type: "number" },
      bhk: { type: "integer" }, sector: { type: "string" },
      status: { type: "string", enum: ["ready_to_move","under_construction","new_launch"] }
    }}
  },
  {
    name: "compare_projects",
    description: "Side-by-side on price, size, builder, possession, DNA scores. Two or more named projects, or 'which is better'.",
    input_schema: { type: "object", required: ["projects"], properties: {
      projects: { type: "array", items: { type: "string" }, minItems: 2 }
    }}
  },
  {
    name: "get_locality_intel",
    description: "Sector-level: connectivity, metro, schools, price trend, infrastructure. Use when a Noida sector is named without a project.",
    input_schema: { type: "object", required: ["sector"], properties: { sector: { type: "string" }}}
  }
];
```

Note `project` takes the user's raw string, misspellings included. Your resolver handles normalization — don't ask the model to guess canonical names, that's how you get invented projects.

### Grounding prompt

```
You are PropFyndr, a real estate advisor for Noida and Greater Noida.

DATA RULES — these override everything else:
1. Every number, date, name, price, area, RERA ID, or specification in your reply
   must come from a tool result in this conversation. Never from your own knowledge.
2. If a tool returns no data for a field, say you don't have it on file.
   Never estimate, never say "typically" or "usually around".
3. If a tool result is labelled provenance != "researched", say the figure is
   indicative and should be confirmed with the builder.
4. If a project is not in the database, say so plainly and offer what you do cover.
   Never describe a project you have no rows for.

SCOPE:
- Named project or a Noida sector → call a tool. Always. Never answer from memory.
- Real-estate topics outside the database (home loans, stamp duty process, RERA
  rights, NRI rules, Noida vs Gurgaon): answer from general knowledge, say plainly
  that it's general guidance rather than data from our database, then bridge to a
  project or sector you can cover.
- Anything unrelated to property: one short warm line, then redirect. Two sentences max.

VOICE: A well-briefed advisor. Direct, specific, numbers-first. Never salesy.
State drawbacks when the data shows them — buyers trust an advisor who names the
downside. Never say "great choice", "perfect", or "you won't regret it".
```

Rule 3 is the one that only matters once you add provenance. Add it now so you don't forget.

### Golden set — the 12 that will actually catch regressions

Assert on `resolvedId`, `toolCalled`, `rowsReturned`. Never on answer text.

| # | Query | Must produce |
|---|---|---|
| 1 | payment plans for Cleo County | `get_payment_plans`, ABA Cleo County, ≥1 row |
| 2 | how do I pay for cleo county | same as #1 — **this is the regex-miss test** |
| 3 | can I pay in installments at ATS Pristine | `get_payment_plans`, not overview |
| 4 | ATS Pristine | resolves to `c78b5e04`, deterministic across 10 runs |
| 5 | ATS Pristine Golf Meadows | resolves to same row post-merge, **never a silent split** |
| 6 | tell me about ats pristin | fuzzy hit, not `not_found` |
| 7 | what's the total cost of a 3BHK at ATS Pristine | `get_cost_breakdown`, not payment plans |
| 8 | Godrej vs ATS Pristine | `compare_projects`, 2 entities |
| 9 | 3BHK under 2.5 cr in sector 150 | `search_projects`, no entity resolution |
| 10 | tell me about Lodha Amara | `not_found` — graceful, no invented data |
| 11 | how does stamp duty work in UP | Tier B: no tool, general answer, bridge chip |
| 12 | hi how are you | Tier C: two sentences, redirect, no tool |

Rows 2, 5, and 10 are the three that fail today. Get those green and you've fixed what three months of manual poking couldn't.

---

**Revised sequence.** The data audit jumped the queue:

| Day | Work |
|---|---|
| 1 | Provenance audit (the two SQL queries above) + turn logging on |
| 1 | `rera_number` unique constraint; full duplicate scan across 280 |
| 2 | Merge duplicates; add `data_provenance`; make `unverified()` reachable |
| 3 | Alias table + single deterministic resolver, both call sites |
| 3 | 12 golden queries in CI |
| 4–5 | Tool calling replaces regex router; regex becomes fallback only |
| 5 | Chips from handler output |

One question before you start, and it decides whether day 2 is an afternoon or a week: **when the audit runs, what fraction comes back templated?** Paste the two query results and I'll tell you whether you're labelling a small subset or rebuilding the ingestion contract.





5. **83% templated, and it's worse than the number looks.**

280 CLP rows across 280 projects. Exactly one each. 1,680 price history rows ÷ 280 = exactly 6 each. 280 cost sheets, 1:1. [Certain] Nothing that comes from research divides that evenly. These are stamps, not records.

And here's the one that should stop you cold: **ATS Pristine is `ready_to_move` with OC obtained since 2023, and it has a Construction-Linked Plan in your database.** A CLP on a delivered building is not a data-quality nitpick — it's logically impossible, and it means the stamp ran without checking project status. Whatever else is in those 620 rows, some fraction is not just unverified but *wrong on its face*.

Same for the price history. The ATS Pristine series in your dossier — ₹8,236 → ₹9,656 → ₹11,218 → ₹12,496 → ₹13,490 → ₹14,200 — is a smooth monotonic curve with no dips through 2022. [Likely] that's generated from a CAGR assumption anchored to today's price and run backwards. Which means the "25–35% three-year appreciation projection" you show buyers is a forecast built on a back-fitted curve. **That is the single highest-liability object in your product**, and your grounding contract renders it with full authority because it's a row in a table.

---

**So: your chat was never the problem.** You spent three months believing you had a routing bug. You had a routing bug — the `LIMIT 1` is real and I stand by every line of the resolver. But it was masking this. The retrieval layer has been faithfully delivering synthetic data, and the deterministic renderer you built specifically to prevent hallucination has been laundering it into fact.

I'd rather tell you this at 280 projects than after a broker forwards a fabricated payment schedule to a client who takes it to ATS.

---

**And I'll say the thing about scope you're not going to like.**

You went from 73 to 280 projects. [Guessing, but the shape fits] that jump felt like progress — bigger catalog, better demo, more coverage. But 280 projects at 17% real data is worth less than 20 projects at 100% real data, because the second one you can actually stand behind in front of a broker. Breadth you can't defend is a liability that scales.

Your moat was always the ten-layer depth on a handful of projects. The enrichment script diluted it.

---

**Triage. Three buckets, run today:**

```sql
ALTER TABLE payment_plans   ADD COLUMN provenance TEXT NOT NULL DEFAULT 'inferred_default';
ALTER TABLE cost_sheets     ADD COLUMN provenance TEXT NOT NULL DEFAULT 'inferred_default';
ALTER TABLE price_history   ADD COLUMN provenance TEXT NOT NULL DEFAULT 'inferred_default';
-- values: 'builder_verified' | 'researched' | 'inferred_default'
```

Default everything to `inferred_default`. **Guilty until proven researched.** Then promote only what you can trace to a brochure or a builder page. Start with your original anchor projects — you know which ones you actually did the work on.

Then the renderer rule, which is the fix that matters:

```ts
if (rows.every(r => r.provenance === 'inferred_default')) {
  return unverified('developer payment schedule', project.name);  // your existing path
}
// Mixed: render only the verified rows, state the gap
```

`unverified()` becomes reachable again. You built the right safety valve and then filled every hole it was watching.

Delete outright, don't label: **CLP rows on any `ready_to_move` project.** They're not unverified, they're false.

```sql
DELETE FROM payment_plans pp USING projects p
WHERE pp.project_id = p.id
  AND p.status = 'ready_to_move'
  AND pp.plan_name ILIKE '%CLP%';
```

**Suppress entirely until re-sourced:** `price_history` where `source = 'historical_benchmark'` (1,400 rows), and every appreciation projection derived from it. Show current price only. A missing chart is fine. A fabricated one is not.

---

**Revised sequence.** Everything I gave you last turn still holds — it just moves back a week.

| Day | Work |
|---|---|
| 1 | Add `provenance` columns, default `inferred_default`; suppress benchmark price history in all render paths |
| 1 | Delete CLP-on-delivered rows; audit for other status/plan contradictions |
| 2 | `rera_number` unique constraint; merge the 19 duplicate clusters |
| 2 | Renderer respects provenance; `unverified()` reachable |
| 3–4 | Promote to `researched` for your genuine anchor projects — this is manual and it's the actual work |
| 5 | Alias table + deterministic resolver (both call sites) |
| 5 | 12 golden queries in CI |
| Week 2 | Tool calling replaces regex router; chips from handler output |

Days 5 onward are unchanged from what I already wrote. Don't skip ahead to them — a perfect resolver retrieving templated rows is a faster wrong answer.

---

One question, and it's the only one that matters now:

**How many of the 280 did you personally research — brochure, builder site, actual sourcing?** Not "has rows," not "looks complete." Ones where you'd sit across from a broker and defend every number.

If the answer is 15–25, say so plainly and we build the product around exactly those, with the rest clearly marked as directory-level listings. That's a defensible product you could show someone next week. If it's genuinely 100+, the promotion pass is a two-week grind and I'll help you script it. Either answer is workable — but the number changes what you ship, so don't round it up.





6. **Same document, second time. You didn't answer the question.**

[Guessing, but it's the most likely read] That's not a paste error. You asked your codebase again, and your codebase returned the same audit — because the question I asked can't be answered by SQL. No query tells you which projects *you* would defend in front of a broker. That's a judgment call, and it's the one call in this whole project only you can make.

Which is also why it's the one you're routing around. Running another audit feels like work. Writing "17" feels like a loss.

[Likely] the number is small — under 25 — and the 280 came from enrichment scripts rather than research. If that's right, saying it out loud costs you nothing and buys you a shippable product. If I'm wrong, correct me with a number and I'll build around it.

If you genuinely can't recall which ones you did by hand, here's the proxy — one query, then you stop querying:

```sql
SELECT p.name, p.slug,
       (SELECT COUNT(*) FROM unit_types u WHERE u.project_id = p.id)         AS units,
       (SELECT COUNT(*) FROM project_spec_items s WHERE s.project_id = p.id) AS specs,
       (SELECT COUNT(*) FROM decision_profiles d WHERE d.project_id = p.id)  AS thesis
FROM projects p
ORDER BY units DESC, specs DESC
LIMIT 40;
```

Distinct unit types with real carpet/super splits, and per-brand spec items (Kajaria, Jaquar, Havells), are the things a seed script can't fake convincingly. Whatever sits at the top of that list is your real catalog. Eyeball 40 rows, count the ones you recognize as your own work.

Then give me the number. Not the query output — the number, and the names if you have them. Everything after that (renderer provenance rules, resolver, tool schemas, golden set) is already written and waiting on it.





7. **18 is the right answer, but don't trust the 18 yet.**

1,960 spec items ÷ 280 projects = exactly 7 each. That means the enrichment pass stamped ATS Pristine too. Your dossier lists Mivan RCC, Pergo flooring, 8ft teak entry doors, Yale smart locks — seven generic brand-set rows can't hold that. [Likely] the enrichment script overwrote or duplicated your real research on the anchors, and your best data is currently sitting in `.md` files on disk while the DB serves the stamp.

So the 18 aren't a clean tier you can promote. They're 18 projects that *were* researched, whose DB rows now need re-derivation from the dossiers. That's the actual day-3 work, and it's the reason your chat has been weak on exactly the projects you know best.

**Second: "directory/indicative listings" is not a safe label for the 262 as they stand.** A listing that shows a stamped CLP, a fabricated six-quarter price curve, and a ₹3.5L parking constant is a wrong answer wearing a disclaimer. Indicative means *fewer fields*, not *the same fields with a caveat*. For the 262, suppress payment plans, cost sheets, price history, DNA scores, and appreciation projections entirely. Show name, builder, sector, status, RERA, location. That's a real directory and it's defensible.

Two tiers, hard-enforced at the query layer:

| | Tier A (18) | Tier B (262) |
|---|---|---|
| Payment plans, cost sheets | Yes, re-derived | **Suppressed** |
| Price history, DNA, projections | Yes, re-sourced | **Suppressed** |
| Unit types, specs | Yes | Suppressed until verified |
| Identity, location, RERA, status | Yes | Yes |
| Chat behavior | Full advisor | "I have basic details — want a deep dive on a Sector 150 project I've researched?" |

That last cell is your best conversion surface. A Tier-B miss routes to a Tier-A neighbor in the same sector. Handled well, 262 shallow projects become 262 doors into 18 deep ones.

I've written the full implementation spec — migrations, resolver, renderer gate, tool schemas, system prompt, chip logic, golden set, day plan:Two things in there I'd flag as the ones you'll be tempted to skip:

**The anchor guard triggers.** Three separate problems in this conversation — the ATS Pristine duplicate, the 73→280 jump, the stamped payment plans — all trace to enrichment scripts writing without constraints. If you re-derive the 18 anchors by hand and then run another enrichment pass next month, you'll be back here. The trigger makes that failure loud instead of silent.

**Turn logging on day 1, before any fix.** You want to start with the resolver because it's the satisfying code. Log first for a day — you'll find out whether your users are actually hitting the bugs we diagnosed or something neither of us has thought of. Three months without logs is why this took a five-turn conversation to find.

Question for when you get to day 3: how detailed are the other 17 dossiers compared to `AtsPristine.md`? If they're all that thorough, re-derivation is a scripted parse and it's two days. If ATS Pristine is your best one and the rest are thin, the anchor tier might really be 8–10, and I'd rather you ship 10 defensible projects than half-fill 18.


# PropFyndr — Chat Layer Rebuild Spec

Root cause summary: the chat layer was never the primary defect. Three compounding
issues produced the symptoms ("general queries weak", "project details sometimes fail"):

1. **Non-deterministic entity resolution** — `LIMIT 1` with no `ORDER BY`, plus two
   competing resolvers (`proseEntities.ts` in-memory `.find()`, `projectDataGateway.ts`
   SQL ILIKE) that disagree.
2. **Synthetic data rendered as verified fact** — 83% of price history, 100% of payment
   plans and cost sheets are seed-script stamps. `unverified()` is unreachable because
   no row is ever empty.
3. **Regex intent router with an unbounded tail** — `topicFlags.ts` matches phrasings you
   anticipated; every unanticipated phrasing falls to the weak general path.

Fix order matters. A perfect resolver retrieving templated rows is a faster wrong answer.

---

## Phase 0 — Data integrity (Days 1–2)

### 0.1 Migrations

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Provenance. Default to guilty; promote only what you can trace to a source.
ALTER TABLE payment_plans      ADD COLUMN provenance TEXT NOT NULL DEFAULT 'inferred_default';
ALTER TABLE cost_sheets        ADD COLUMN provenance TEXT NOT NULL DEFAULT 'inferred_default';
ALTER TABLE price_history      ADD COLUMN provenance TEXT NOT NULL DEFAULT 'inferred_default';
ALTER TABLE unit_types         ADD COLUMN provenance TEXT NOT NULL DEFAULT 'inferred_default';
ALTER TABLE project_spec_items ADD COLUMN provenance TEXT NOT NULL DEFAULT 'inferred_default';
-- allowed values: 'builder_verified' | 'researched' | 'inferred_default'

-- Project tier. Drives what the chat is permitted to say.
ALTER TABLE projects ADD COLUMN data_tier TEXT NOT NULL DEFAULT 'directory';
-- allowed values: 'anchor' | 'directory'

-- Blocks the duplicate class at ingestion. Run AFTER dedupe (0.3).
CREATE UNIQUE INDEX projects_rera_unique
  ON projects (rera_number)
  WHERE rera_number IS NOT NULL
    AND TRIM(rera_number) <> ''
    AND rera_number <> 'RERA Not Applicable';

-- Alias table. Fixes more bugs than any prompt change.
CREATE TABLE project_aliases (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alias       TEXT NOT NULL,
  source      TEXT NOT NULL,  -- 'legacy_slug' | 'marketing' | 'builder_prefix' | 'misspelling'
  UNIQUE (alias)
);
CREATE INDEX ON project_aliases (lower(alias));

-- Resolver index.
CREATE INDEX projects_name_trgm ON projects USING gin (lower(name) gin_trgm_ops);
```

### 0.2 Delete what is false (not merely unverified)

```sql
-- CLP on a delivered building is logically impossible.
DELETE FROM payment_plans pp
USING projects p
WHERE pp.project_id = p.id
  AND p.status = 'ready_to_move'
  AND pp.plan_name ILIKE '%CLP%';

-- Audit for the same contradiction class before assuming that's the only one:
SELECT p.status, pp.plan_name, COUNT(*)
FROM payment_plans pp JOIN projects p ON p.id = pp.project_id
GROUP BY 1, 2 ORDER BY 3 DESC;
```

Suppress (do not delete — you may re-source later):
`price_history WHERE source = 'historical_benchmark'` (1,400 rows), and every
appreciation projection derived from it. Show current price only. A missing chart is
fine; a fabricated one is not.

### 0.3 Dedupe the 19 RERA clusters

```sql
SELECT rera_number, array_agg(id ORDER BY created_at), array_agg(name), array_agg(slug)
FROM projects
WHERE rera_number IS NOT NULL AND TRIM(rera_number) <> ''
GROUP BY rera_number HAVING COUNT(*) > 1;
```

For each cluster: keep the **oldest** row (primary ingestion), repoint all child rows
(`payment_plans`, `cost_sheets`, `unit_types`, `project_spec_items`, `project_dna`,
`decision_profiles`, `persona_profiles`, `price_history`) to the survivor, insert the
loser's `name` and `slug` into `project_aliases`, then delete the loser. **Never delete
without writing the alias** — otherwise a user searching the old name gets `not_found`.

Known case: keep `c78b5e04-8e17-4961-bb1d-bda4b76b8491` (ATS Pristine); alias in
`ats-pristine-golf-meadows-sector-150`, `ATS Pristine & Golf Meadows`, `ATS Greens`.

### 0.4 Tier assignment + re-derivation

```sql
UPDATE projects SET data_tier = 'anchor' WHERE slug IN ( ... 18 slugs ... );
```

Then, per anchor: re-derive child rows from the `.md` dossier on disk, and set
`provenance = 'researched'` on those rows only. This is manual and it is the real work.
Budget half a day per project if the dossiers are as detailed as `AtsPristine.md`.

**Add a regression guard so the enrichment scripts can never do this again:**

```sql
-- Any seed/enrichment script must respect this.
CREATE OR REPLACE FUNCTION guard_anchor_rows() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM projects WHERE id = NEW.project_id AND data_tier = 'anchor')
     AND NEW.provenance = 'inferred_default' THEN
    RAISE EXCEPTION 'Refusing to write inferred_default row to anchor project %', NEW.project_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER guard_pp BEFORE INSERT OR UPDATE ON payment_plans
  FOR EACH ROW EXECUTE FUNCTION guard_anchor_rows();
-- repeat for cost_sheets, unit_types, project_spec_items, price_history
```

---

## Phase 1 — Deterministic resolver (Day 3)

Replace **both** call sites (`proseEntities.ts`, `projectDataGateway.ts`) with this single
function. Two resolvers with different tie-breaking is the same bug twice.

```ts
type Candidate = { id: string; name: string; slug: string; tier: 'anchor'|'directory'; score: number };

type Resolution =
  | { kind: 'resolved';  project: Candidate }
  | { kind: 'ambiguous'; candidates: Candidate[] }
  | { kind: 'not_found'; extracted: string | null };

export async function resolveProject(message: string): Promise<Resolution> {
  const msg = message.toLowerCase().trim();

  // 1. Alias table first — exact, indexed, authoritative.
  const grams = tokenizeNGrams(msg, 5);           // all 1..5-word contiguous spans
  const alias = await prisma.projectAlias.findFirst({
    where: { alias: { in: grams, mode: 'insensitive' } },
    include: { project: true },
    orderBy: { alias: 'desc' },                    // longest alias wins
  });
  if (alias) return { kind: 'resolved', project: toCandidate(alias.project, 1.0) };

  // 2. Trigram over canonical names. ALL candidates, fully ordered. No LIMIT 1.
  const rows = await prisma.$queryRaw<Candidate[]>`
    SELECT id, name, slug, data_tier AS tier,
           similarity(lower(name), ${msg}) AS score
    FROM projects
    WHERE lower(name) % ${msg}
       OR ${msg} LIKE '%' || lower(name) || '%'
    ORDER BY
      length(name) DESC,        -- specificity: "ATS Pristine Golf Meadows" beats "ATS Pristine"
      score       DESC,
      id          ASC           -- final tiebreak, guarantees determinism
  `;

  if (rows.length === 0)
    return { kind: 'not_found', extracted: extractCapitalizedPhrase(message) };

  const top = rows[0];
  const close = rows.filter(r => r.score >= top.score - 0.08);
  if (close.length > 1)
    return { kind: 'ambiguous', candidates: close.slice(0, 3) };

  return { kind: 'resolved', project: top };
}
```

Three properties the current code lacks: **deterministic** (full ordering including an id
tiebreak), **specificity-preferring** (`length(name) DESC`), and **ambiguity is a
first-class outcome** you can render rather than a coin flip.

---

## Phase 2 — Renderer provenance gate (Day 3)

Keep `renderPaymentPlanTable()` and the LLM bypass — that design is correct. It just needs
a gate in front of it.

```ts
function renderGated<T extends { provenance: string }>(
  rows: T[],
  project: Project,
  subject: string,
  render: (rows: T[]) => string
): string {
  if (project.data_tier === 'directory')
    return directoryBoundary(subject, project);      // "I have basic details only for X"

  const verified = rows.filter(r => r.provenance !== 'inferred_default');
  if (verified.length === 0)
    return unverified(subject, project.name);        // existing path — now reachable

  const out = render(verified);
  return verified.length < rows.length
    ? out + `\n\n_Showing ${verified.length} of ${rows.length} plans on file; the rest are unconfirmed._`
    : out;
}
```

`unverified()` was the right safety valve. It was unreachable because every hole it
watched had been filled with a stamp.

---

## Phase 3 — Tool calling replaces the regex router (Days 4–5)

Handlers stay. `topicFlags.ts` regex becomes a fallback only. The model picks the tool;
your code executes and renders deterministically.

```ts
const TOOLS = [
  {
    name: "get_payment_plans",
    description:
      "Payment schedule, booking amount, installment structure, or how a buyer pays " +
      "over time for one named project. Use for any phrasing about paying, installments, " +
      "down payment, booking amount, CLP, PLP, or 'how do I pay'.",
    input_schema: { type: "object", required: ["project"], properties: {
      project: { type: "string", description: "Project name exactly as the user wrote it, misspellings included." }
    }}
  },
  {
    name: "get_cost_breakdown",
    description:
      "All-inclusive cost: base rate, floor rise, PLC, parking, club membership, IFMS, " +
      "GST, stamp duty. Use for 'total cost', 'final price', 'hidden charges', 'what will " +
      "I actually pay'. Distinct from get_payment_plans, which is timing not amount.",
    input_schema: { type: "object", required: ["project"], properties: {
      project:   { type: "string" },
      unit_type: { type: "string", description: "e.g. '3 BHK'. Omit if unspecified." }
    }}
  },
  {
    name: "get_project_overview",
    description:
      "Core facts on one project: builder, RERA, possession, towers, units, amenities, " +
      "specifications, DNA scores. Default when a project is named without a sub-topic.",
    input_schema: { type: "object", required: ["project"], properties: {
      project: { type: "string" }
    }}
  },
  {
    name: "search_projects",
    description:
      "Find projects matching constraints when NO project is named. Budget, BHK, sector, " +
      "possession status, builder. Use for 'show me 3BHK under 2 crore in Sector 150'.",
    input_schema: { type: "object", properties: {
      budget_min_cr: { type: "number" }, budget_max_cr: { type: "number" },
      bhk: { type: "integer" }, sector: { type: "string" },
      status: { type: "string", enum: ["ready_to_move","under_construction","new_launch"] }
    }}
  },
  {
    name: "compare_projects",
    description: "Side-by-side on price, size, builder, possession, DNA scores. Two or more named projects, or 'which is better'.",
    input_schema: { type: "object", required: ["projects"], properties: {
      projects: { type: "array", items: { type: "string" }, minItems: 2 }
    }}
  },
  {
    name: "get_locality_intel",
    description: "Sector-level: connectivity, metro, schools, price trend, infrastructure. Use when a Noida sector is named without a project.",
    input_schema: { type: "object", required: ["sector"], properties: { sector: { type: "string" }}}
  }
];
```

`project` takes the user's **raw** string. The resolver normalizes. Never ask the model to
produce a canonical name — that is how invented projects get in.

### Tool result envelope

Return resolution state to the model, not just rows. It needs to know why it got nothing.

```json
{
  "resolution": "resolved | ambiguous | not_found",
  "project": { "name": "ATS Pristine", "tier": "anchor" },
  "candidates": [],
  "rows": [ ... ],
  "suppressed": ["price_history: unverified benchmark data"]
}
```

### System prompt

```
You are PropFyndr, a real estate advisor for Noida and Greater Noida.

DATA RULES — these override everything else:
1. Every number, date, name, price, area, RERA ID or specification in your reply must
   come from a tool result in this conversation. Never from your own knowledge.
2. If a tool returns no data for a field, say you do not have it on file. Never estimate.
   Never say "typically" or "usually around" about a specific project.
3. If resolution is "ambiguous", ask which project the user means. Do not pick one.
4. If resolution is "not_found", say plainly that the project is not in the database and
   offer what you do cover in that sector. Never describe a project you have no rows for.
5. If tier is "directory", you have identity and location only. Say so, then offer a
   researched project in the same sector.

SCOPE:
- Named project or Noida sector -> call a tool. Always. Never answer from memory.
- Real-estate topics outside the database (home loans, stamp duty process, RERA rights,
  NRI rules, Noida vs Gurgaon): answer from general knowledge, say plainly that this is
  general guidance rather than data from our database, then bridge to a project or sector
  you can cover.
- Anything unrelated to property: one short warm line, then redirect. Two sentences max.

VOICE: A well-briefed advisor. Direct, specific, numbers-first. Never salesy. State
drawbacks when the data shows them — buyers trust an advisor who names the downside.
Never say "great choice", "perfect", or "you won't regret it".
```

### Guardrail gap to close

`validateAgainstFacts()` currently checks RERA numbers and false guarantees only. On the
free-generation fallback path, **prices, possession dates, carpet areas, commute times and
appreciation figures are unguarded** — and those are the numbers people act on. Extend it
to extract every currency amount, area figure and date from the generated text and assert
each appears in the tool results for that turn.

---

## Phase 4 — Chips (Day 5, zero tokens)

Pure function of state already in hand after the tool returns.

```ts
function buildChips(res: Resolution, project: Project, ctx: Ctx): Chip[] {
  // Ambiguity becomes a feature: the candidates ARE the chips.
  if (res.kind === 'ambiguous')
    return res.candidates.map(c => ({ label: c.name, query: `Tell me about ${c.name}` }));

  // Not found: pivot to sector neighbours you can actually defend.
  if (res.kind === 'not_found')
    return anchorChipsForSector(ctx.lastSector ?? 'Sector 150', 3);

  const chips: Chip[] = [];

  // Directory tier: the only useful move is a route to an anchor.
  if (project.data_tier === 'directory')
    return [ ...anchorChipsForSector(project.sector, 2), CHIP.talkToAdvisor ];

  // Anchor tier: offer only fields that exist AND are verified AND aren't discussed.
  const has = (rel: any[]) => rel?.some(r => r.provenance !== 'inferred_default');
  if (has(project.payment_plans)      && !ctx.asked.has('payment')) chips.push(CHIP.payment);
  if (has(project.cost_sheets)        && !ctx.asked.has('cost'))    chips.push(CHIP.totalCost);
  if (has(project.unit_types)         && !ctx.asked.has('units'))   chips.push(CHIP.floorPlans);
  if (project.project_dna             && !ctx.asked.has('dna'))     chips.push(CHIP.whyThisProject);

  chips.push(...siblingChips(project.sector, project.project_dna?.overall, 2));
  if (ctx.turnCount >= 5) chips.push(CHIP.talkToAdvisor);

  return rank(chips).slice(0, 3);
}
```

**The rule that fixes the most user pain:** when `unverified()` or `directoryBoundary()`
fires, chips must point at fields that *do* exist. A dead-end answer offering dead-end
chips is the worst state in the product.

Cost note: model-written chips would cost ~40 output tokens appended to the existing
answer call, not a separate call. The real reason to stay deterministic here is latency
and consistency, not cost — so don't over-optimise against the wrong constraint.

---

## Phase 5 — Golden set (Day 3, then every deploy)

Assert on `resolution.kind`, `resolvedId`, `toolCalled`, `rowsReturned`. **Never on answer
text** — text assertions rot and you will delete the test instead of fixing the bug.

| # | Query | Expected |
|---|-------|----------|
| 1 | payment plans for Cleo County | `get_payment_plans`, ABA Cleo County, ≥1 verified row |
| 2 | how do I pay for cleo county | same as #1 — **regex-miss test** |
| 3 | can I pay in installments at ATS Pristine | `get_payment_plans`, not overview |
| 4 | ATS Pristine | resolves to `c78b5e04...`, identical across 10 runs |
| 5 | ATS Pristine Golf Meadows | resolves to same row via alias, never a split |
| 6 | tell me about ats pristin | fuzzy hit, not `not_found` |
| 7 | total cost of a 3BHK at ATS Pristine | `get_cost_breakdown`, not payment plans |
| 8 | Godrej vs ATS Pristine | `compare_projects`, 2 entities |
| 9 | 3BHK under 2.5 cr in sector 150 | `search_projects`, no entity resolution |
| 10 | tell me about Lodha Amara | `not_found`, no invented data |
| 11 | payment plans for [any directory-tier project] | `directoryBoundary`, anchor chips returned |
| 12 | ATS Pristine construction linked plan | no CLP row (deleted), graceful |
| 13 | how does stamp duty work in UP | Tier B: no tool, general answer flagged, bridge chip |
| 14 | hi how are you | Tier C: ≤2 sentences, redirect, no tool call |

Rows 2, 5, 10 and 11 are the ones that fail today.

### Turn logging (Day 1 — do this first, ship it before anything else)

```ts
log({
  query, resolutionKind, resolvedId, candidateCount,
  toolCalled, rowsReturned, verifiedRowsReturned,
  renderPath,           // 'table' | 'unverified' | 'directory' | 'llm_fallback'
  tier, latencyMs, provider
});
```

Without this you cannot distinguish a coverage failure from a routing failure, which is
why three months of manual testing did not converge. Every Tier-B and Tier-C query in this
log is also your data roadmap — it tells you what to research next, for free.

---

## Sequence

| Day | Work |
|-----|------|
| 1 | Turn logging on, shipped. Provenance + tier migrations. Suppress benchmark price history everywhere. |
| 1 | Delete CLP-on-delivered rows; audit for other status/plan contradictions. |
| 2 | Dedupe 19 RERA clusters (alias first, then delete). Add unique index. Add anchor guard triggers. |
| 2 | Renderer provenance gate; `unverified()` and `directoryBoundary()` reachable. |
| 3–4 | Re-derive the 18 anchors from `.md` dossiers; set `provenance = 'researched'`. |
| 5 | Alias table seeded; single deterministic resolver wired into both call sites. |
| 5 | 14 golden queries in CI. |
| Wk 2 | Tool calling replaces regex router; chips from handler output; extend `validateAgainstFacts()`. |

Do not start week 2 before the golden set is green. A faster path to a templated row is
not progress.




8. **The 37 dossiers and your 18 anchors don't line up, and Cleo County is missing from both lists.**

Of the 19 files you named, only 9 match your anchor list. The other 10 named dossiers — ATS Kingston Heath, ATS Pious Hideaways, Eldeco Live By The Greens, Prateek Canary, Imperial Court, Jaypee Greens Kalypso Court, Gulshan Ikebana, SKA Orion, Mahagun Moderne, The Hyde Park, Civitech Stadia — aren't anchors. And 9 of your 18 anchors aren't in the named dossiers: ABA Cleo County, Parx Laureate, Godrej Nest, Godrej Golf Links, Tata Eureka Park, Jaypee Greens Klassic, Gulshan Dynasty, Ace Starlit, Eldeco Utopia.

Some of those 9 may sit in the 18 dossiers you didn't name. But **ABA Cleo County is the project you opened this conversation with as your canonical failure**, and if it has no dossier, the re-derivation pass doesn't fix it. Run the join before writing the parser:

```sql
-- feed the 37 slugs derived from filenames
SELECT p.slug, p.name, p.data_tier
FROM projects p
WHERE p.slug IN (...)          -- dossier-backed
UNION ALL
SELECT '(no dossier)', name, data_tier FROM projects WHERE slug IN (...);  -- your 18
```

Good news buried in this: **your anchor tier is closer to 37 than 18.** The dossier is the evidence, not your recollection. Any project with a 400-line structured dossier is defensible whether or not you remembered it. Redefine `data_tier = 'anchor'` as *"has a dossier that parsed cleanly"* — mechanical, auditable, and it roughly doubles your Tier-A catalog.

---

**I disagree with "under an afternoon."**

Two reasons, both visible in evidence you already gave me.

First, `AtsPristine.md` — your best dossier — **contradicts itself**: two RERA numbers, three possession dates (Jun 2023 / Dec 2017 / Aug 2020), two builder names, two price sets. That's your gold standard. A parser that writes blindly will push those contradictions into the DB and you'll have replaced synthetic data with inconsistent data. Marginally better, still not defensible.

Second, the depth audit used regex heuristics (`/spec|finish|flooring/`) that return true for almost any real estate text. It tells you the files are long. It does not tell you the JSON blocks share a schema — and files written across three months almost never do.

**So: parse in two passes, dry run first.**

```ts
// Pass 1 — extract and validate. Writes NOTHING.
type ParseResult = {
  slug: string;
  layers: Record<string, unknown>;   // sections 1..10
  missing: string[];                 // layers absent
  conflicts: Conflict[];             // same field, different values
  dbMatch: 'exact' | 'fuzzy' | 'none';
};

const CRITICAL = ['rera_number','possession_date','builder_name','base_price_psf','status'];

function validate(d: Dossier): Conflict[] {
  return CRITICAL.flatMap(field => {
    const values = collectAllOccurrences(d, field);   // scan every layer, not just the first
    const distinct = [...new Set(values.map(normalize))];
    return distinct.length > 1
      ? [{ field, values: distinct, locations: values.map(v => v.layer) }]
      : [];
  });
}
```

Output a conflict report as CSV before touching Postgres. [Likely] you'll get 30–60 conflicts across 37 files. Each needs a human call — you, ten seconds each, one sitting. That's the afternoon. The parser is the easy half.

```ts
// Pass 2 — write, gated on a clean pass.
if (r.conflicts.length > 0 || r.dbMatch === 'none') { skip(r); continue; }

await prisma.$transaction([
  // Replace child rows wholesale — do NOT merge with the stamped rows.
  prisma.paymentPlan.deleteMany({ where: { project_id: r.id } }),
  prisma.projectSpecItem.deleteMany({ where: { project_id: r.id } }),
  prisma.unitType.deleteMany({ where: { project_id: r.id } }),
  ...insertFromDossier(r, { provenance: 'researched' }),
  prisma.project.update({ where: { id: r.id }, data: { data_tier: 'anchor' }}),
]);
```

Delete-then-insert, not upsert. The seven stamped spec rows have no correspondence to the dossier's real specs — trying to reconcile them per-row will silently keep stamps alive.

Add three assertions the parser must enforce before writing, since these are the exact failures already in your data:

1. **No CLP on `ready_to_move`.** Reject the plan, log it.
2. **Carpet < super, ratio between 55% and 85%.** Anything outside is a parse error.
3. **RERA number matches `UPRERAPRJ\d+`** and isn't already owned by a different project id.

---

**Revised day 3–4:**

| | Work |
|---|---|
| 3a | Join dossier filenames → DB slugs. Get the real anchor count. Confirm whether Cleo County has one. |
| 3b | Parser pass 1, dry run. Conflict CSV. |
| 3c | Resolve conflicts by hand. Source of truth = RERA portal for RERA/possession, brochure for pricing. |
| 4 | Parser pass 2, transactional. Skips anything unresolved — those stay `directory` tier. |

Anything that fails validation stays Tier B. That's fine and it's the point: a project either has clean researched data or it's a directory listing. No middle state.

One thing to check while you're in there — does Cleo County have a dossier? If the answer is no, tell me, and we'll decide whether it earns a manual research pass before launch or drops to Tier B alongside the 262. It's the project you'd most want working, which is not the same as the project most likely to work.


// backend/src/lib/ai/prompts/blocks.ts
import type { Intent, ScoredProject, SectorContext, SectorOverview, NearbyExpansion } from '../../discovery'

// ─── CONDITIONAL FORMAT BLOCKS ────────────────────────────────────────────────
// Injected based on detected intent. Consumed by buildAdvisorSystemPrompt()
// (./index.ts, currently unused) — the live path is buildSystemPromptWithCache().
// Content is identical to the original base.ts format sections — only the
// injection point changed (conditional rather than always-on).

export function buildPropertyResultsFormatBlock(intentState?: string): string {
  if (intentState === 'CLARIFYING') {
    return `

---

## RESPONSE FORMAT — SEARCH RESULTS

HARD LIMIT: 15 words. Target: 5–10 words. Must fit one screen without scrolling.

### EXACT FORMAT

Just provide a very brief conversational question asking the user to clarify their requirements. For example:
"What configuration and budget are you looking for?" or "To find the best matches, what's your preferred BHK or budget?"
Do not say "Here are the top matches" or act as if you found results, because the requirements are still unclear.
Do not include any property names, bullets, or detailed recommendations in your text response.

---

RESPONSE FAILURE — disqualifies the response:
• Any property name, price, builder name, sector name, sqft, BHK count, possession date, RERA status, or amenity name in AI text
• Any recommendation text, pros/cons, or "Best For" sections
• "Quick Picks" section or table
• Bullets, headers, or per-project sections
• Internal field names
• Call-to-action — cards are already visible`
  }

  return `

---

## RESPONSE FORMAT — SEARCH RESULTS

HARD LIMIT: 15 words. Target: 5–10 words. Must fit one screen without scrolling.

The cards below render the exact matching properties (price, builder name, BHK, carpet area, possession date, RERA status, sector).
Your text response MUST be 1 brief lead-in sentence ONLY (e.g., "Here are the top verified properties in Sector 10:").
NEVER list project names, prices, or bullets in your text — the user can already see them in the property cards below. NEVER invent unlisted project names.

---

### EXACT FORMAT

Just provide a very brief conversational introduction. For example:
"Here are the top matches for your search:" or "I found some great options fitting your criteria:"
Do not include any property names, bullets, or detailed recommendations in your text response.

---

RESPONSE FAILURE — disqualifies the response:
• Any property name, price, builder name, sector name, sqft, BHK count, possession date, RERA status, or amenity name in AI text
• Any recommendation text, pros/cons, or "Best For" sections
• "Quick Picks" section or table
• Bullets, headers, or per-project sections
• Internal field names
• Call-to-action — cards are already visible`
}

export function buildSectorAdvisoryFormatBlock(): string {
  return `

---

## RESPONSE FORMATS — SECTOR ADVISORY

HARD LIMIT: 150 words. One screen.
Answer only: Which sector fits this buyer? Why? What should they do next?
NEVER: geography lectures, metro descriptions unless commute was mentioned, amenity lists, fabricated scores.

| Sector | Best For | Availability | Metro |
|--------|----------|--------------|-------|
| [Name] ← Top Pick | [buyer type, one phrase] | [X RTM / Y UC] | [station or —] |
| [Name] | [buyer type] | [X RTM / Y UC] | [station or —] |

(Max 3 rows. Only sectors the data supports. Skip price column — cards show prices.)

**Why [Top Pick]?** — one sentence. The single deciding factor for this buyer's intent.

"Want me to search [Top Pick] first, or compare all three?"`
}

export function buildComparisonFormatBlock(): string {
  return `

---

## RESPONSE FORMATS — COMPARISON

HARD LIMIT: 150 words. One screen.
The comparison dashboard below already shows: price, possession, RERA, builder, amenities, sqft, BHK, risk ratings. Do not repeat any of it.
Answer only: Who wins and why? Who should choose each? What should the buyer do?

---

🏆 **Verdict**
[Name] — [one sentence: the single deciding reason. Not features — judgment.]

**Why [Winner] wins**

| Dimension | [Project A] | [Project B] | Edge |
|-----------|-------------|-------------|------|
| Builder trust | [signal label] | [signal label] | [name] |
| Delivery risk | Low/Med/High | Low/Med/High | [name or Tie] |
| Value | [positioning label] | [positioning label] | [name or Tie] |

(3 rows max. Omit a row if both projects are equal on that dimension.)

**Best For**
• [Winner] → [buyer type, one phrase]
• [Runner-up] → [buyer type where it is genuinely the better pick]

**Bottom Line**
[One sentence. What should the buyer do?]

*See the comparison dashboard below.*

---

RESPONSE FAILURE — any of the following disqualifies the response:
• Price, possession date, RERA, sqft, BHK, amenity list in AI text
• Paragraphs
• Internal field names
• Fabricated scores`
}

export function buildExpansionBlock(expansion: NearbyExpansion): string {
  const sectorsLabel = expansion.searchedSectors.join(', ')
  return `\n\n## CONSTRAINT EXPANSION — MANDATORY DISCLOSURE
The user requested ${expansion.requestedSector} but no matching inventory exists there.
Results below are NEARBY ALTERNATIVES from ${sectorsLabel}.
YOU MUST begin your response by clearly disclosing this to the user in a highly professional, marketing-oriented tone.
Say something like: "We are currently not serving ${expansion.requestedSector}, but we are continuously evaluating new areas and will be expanding our verified intelligence there soon! In the meantime, we have curated some exceptional premium options in nearby areas like ${sectorsLabel} that you might love."
NEVER present these results as ${expansion.requestedSector} properties.
Ensure the tone is welcoming and matches how a premium real estate marketing person would communicate.`
}

/** Strip known LLM control sequences from DB-sourced strings before prompt injection */
export function sanitizeForPrompt(text: any): string {
  if (!text) return ''
  const str = typeof text === 'string' ? text : typeof text === 'object' && text.name ? text.name : String(text)
  return str
    .replace(/<\|[^|]+\|>/g, '')     // OpenAI/Llama control tokens
    .replace(/\[INST\]|\[\/INST\]/gi, '')
    .replace(/### (system|instruction|human|assistant)/gi, '')
    .replace(/<!--.*?-->/gs, '')       // HTML comments sometimes used for injection
    .slice(0, 2000)                    // hard cap per field
}

// Strip characters that could affect system prompt structure.
// Legitimate project names never contain these characters.
function sanitizeProjectName(name: string): string {
  return sanitizeForPrompt(name).replace(/["\\`\n\r]/g, '').replace(/#{1,6}\s/g, '').slice(0, 100)
}

function serializeProjects(projects: ScoredProject[]): string {
  return projects.map((p, i) => {
    const unitTypes = p.unit_types || []
    const bhkOptions = [...new Set(unitTypes.map((u) => `${u.bhk}BHK`))].join(', ')
    const carpets = unitTypes.filter((u) => u.carpet_area_sqft).map((u) => u.carpet_area_sqft!)
    const minC = carpets.length ? Math.min(...carpets) : null
    const maxC = carpets.length ? Math.max(...carpets) : null
    const carpetRange = minC != null ? (maxC != null && maxC > minC ? `${minC}–${maxC}` : `${minC}`) : 'N/A'
    const amenityNames = (p.top_amenities || []).map((a) => a.name).join(', ') || 'N/A'
    const connNames = (p.top_connectivity || []).map((c) =>
      c.distance_km ? `${c.name} (${c.distance_km}km)` : c.name
    ).join(', ') || 'N/A'

    // Derive possession status sentinel — makes provenance explicit to the AI.
    // RTM = OC already issued (fact). UC/new_launch = builder-claimed date only.
    const possessionStatus = p.status === 'ready_to_move'
      ? 'DELIVERED — occupancy certificate issued, project is handed over'
      : p.status === 'new_launch'
        ? 'SPECULATIVE — new launch, no confirmed possession date'
        : p.possession_label
          ? 'BUILDER_CLAIMED_DATE — not independently verified; check up-rera.in for RERA-registered completion date'
          : 'NOT_PROVIDED'

    console.log(`[INTELLIGENCE:SERIALIZED] ${p.name}:`, {
      has_rec_tier:    !!(p.recommendation_profile?.tier),
      has_thesis:      !!(p.decision_profile?.decision_thesis),
      has_persona:     !!(p.persona_profile?.primary_persona),
      competitor_count: (p.competitors?.length ?? 0),
    })
    return JSON.stringify({
      id: i + 1,
      name: sanitizeProjectName(p.name),
      sector: sanitizeProjectName(p.sector),
      builder: sanitizeForPrompt(p.builder.name),
      bhk_options: sanitizeForPrompt(bhkOptions) || 'N/A',
      carpet_sqft: carpetRange,
      price: p.price_range_label,
      budget_status: p.budgetStatus ?? 'within',
      status: p.status,
      possession_claimed_by_builder: p.possession_label ?? null,
      possession_status: possessionStatus,
      // project_risk_flag: non-null value is a Hard Rule 6 / Rule 22 trigger.
      // The AI must disclose this risk inline and not recommend this project.
      project_risk_flag: p.project_risk_flag ?? null,
      nclt_moratorium_active: p.nclt_moratorium_active ?? null,
      registry_status: p.registry_status ?? null,
      // NOT_IN_DATABASE is a machine-readable sentinel: Hard Rule 16 maps it to
      // a required exact response ("I cannot verify the RERA registration number…").
      // This prevents the model from fabricating a UPRERAPRJ string.
      rera: sanitizeForPrompt(p.rera_number ?? 'NOT_IN_DATABASE'),
      amenities: sanitizeForPrompt(amenityNames),
      connectivity: sanitizeForPrompt(connNames),
      match_reason: sanitizeForPrompt(p.matchReason || ''),
      match_score: p.matchScore,
      ...(p.recommendation_profile ? {
        // recommendation_tier is deliberately omitted. Measured 4 Sep 2026:
        // 280 of 280 rows read STRONG_BUY. A tier every project we hold shares
        // is a constant, not a recommendation — and a buyer was shown it as
        // one. See SYNTHETIC_FIELDS in projectExposure.ts.
        recommendation_thesis:  p.recommendation_profile.primary_thesis,
        walk_away_conditions:   p.recommendation_profile.walk_away_conditions,
      } : {}),
      ...(p.decision_profile ? {
        decision_thesis:    p.decision_profile.decision_thesis,
        best_for:           p.decision_profile.best_for,
        why_buy:            p.decision_profile.why_buy,
        why_avoid:          p.decision_profile.why_avoid,
        not_ideal_for:      p.decision_profile.not_ideal_for,
      } : {}),
      ...(p.persona_profile ? {
        primary_persona:    p.persona_profile.primary_persona,
      } : {}),
      ...(p.dna ? {
        builder_reputation:   p.dna.builder_score,
        legal_standing:       p.dna.legal_score,
        delivery_confidence:  p.dna.possession_score,
        value_positioning:    p.dna.price_score,
      } : {}),
      ...(p.decisionIntelligence ? {
        decision_confidence:  p.decisionIntelligence.confidence,
        decision_tier:        p.decisionIntelligence.tier,
        decision_bottom_line: p.decisionIntelligence.bottomLine,
      } : {}),
      // Intelligence fields are now explicit in schema (financial_intelligence, market_intelligence, etc.)
      // No need to parse from intelligence_data anymore
      ...(p.competitors && p.competitors.length > 0 ? {
        competitors: p.competitors.map(c => ({
          name: sanitizeForPrompt(c.competitor_name),
          advantage: sanitizeForPrompt(c.this_project_advantage || ''),
          competitor_advantage: sanitizeForPrompt(c.competitor_advantage || ''),
          verdict: sanitizeForPrompt(c.verdict || '')
        }))
      } : {}),
    })
  }).join(',\n')
}

export function buildProjectsBlock(
  exactResults: ScoredProject[],
  sectorCtx?: SectorContext,
  expansion?: NearbyExpansion,
  nearbyResults?: ScoredProject[],
  notFoundNames?: string[],
  /**
   * Did retrieval actually run this turn?
   *
   * Defaults true so every existing caller keeps its behaviour. It matters
   * because "we searched and found nothing" and "we never searched" produce
   * the same empty array, and this function used to answer both with
   * SECTOR_NOT_COVERED — a claim about the world made from a fact about our
   * own control flow.
   *
   * Measured 31 Aug: "best society in sector 137" was gated at
   * `[DISCOVERY:GATE] ran: false, reason: needsClarification` because bhk,
   * budget and purpose were unset. Nothing was ever queried. The buyer was
   * told "Sector 137 is not currently in our verified database" while ten
   * projects sat in it.
   */
  discoveryRan: boolean = true,
): string {
  const hasExact = exactResults.length > 0
  const hasNearby = (nearbyResults?.length ?? 0) > 0

  // Code-level guard: inject explicit DATA INTEGRITY ALERT for every project name
  // the user requested that had no DB match. Hard Rule 14 maps this to a required
  // exact response — the model cannot fabricate specs for these projects.
  const notFoundBlock = (notFoundNames?.length ?? 0) > 0
    ? `\n\n## ⛔ DATA INTEGRITY ALERT — PROJECT_NOT_FOUND\n` +
      notFoundNames!.map((n) => {
        const safe = sanitizeProjectName(n)
        return `PROJECT_NOT_FOUND: "${safe}" — This project is NOT in the PropFyndr database. ` +
        `You MUST NOT provide from training memory: location, builder name, sector, price, BHK, ` +
        `possession date, project description, amenities, RERA number, or comparison context. ` +
        `Required response (verbatim): "This project is not currently in our tracked database." ` +
        `STOP. Do not elaborate. Do not use it as comparison context for any tracked project.`
      }).join('\n')
    : ''

  if (!hasExact && !hasNearby) {
    // Retrieval was skipped, so we know nothing about coverage. Say nothing
    // about it: the buyer's question still needs answering from whatever else
    // is in the prompt, and a coverage claim here would be invented.
    if (!discoveryRan) {
      return notFoundBlock + `\n\n## Search Not Run\nNo project search was performed for this turn, so you have NO information about what does or does not exist in any sector. You MUST NOT say that a sector, project or builder is absent from our database, and you MUST NOT list projects. Answer from the verified context you were given, and if the buyer asked for inventory, ask the one question you need to search properly.`
    }
    if (sectorCtx) {
      return notFoundBlock + `\n\n## Search Result: No Exact Matches\nNo properties match the exact criteria. Use the Sector Overview above to write a helpful market context response. Suggest: adjacent sectors, relaxing one filter (budget ±10%, different BHK), or what IS available in the sector.`
    }
    // No results AND no sector context: sector is outside our coverage.
    // Hard Rule 15 maps SECTOR_NOT_COVERED to a required exact response.
    return notFoundBlock + `\n\n## ⛔ SECTOR_NOT_COVERED
This sector currently has no exact matches in our database.
You MUST NOT invent project names, prices, carpet areas, or any property data for it.

Say plainly, in one sentence, that nothing we hold matches every requirement the buyer gave. Do not present any project as a match and do not recommend projects that break a requirement.
Then offer the one or two relaxations that would most likely produce results (for example a nearby sector, the next BHK, or a slightly higher budget), and ask which one the buyer is willing to accept. Never relax a requirement on the buyer's behalf.`
  }

  let block = ''

  if (hasExact) {
    // Retrieval allows up to 10% over the ceiling so a near-miss can be offered,
    // but a project above the buyer's budget is not an exact match and must not
    // be listed under that heading (red-team spec: hard-filter violation = P0).
    const isOver = (p: (typeof exactResults)[number]) => p.budgetStatus === 'slightly_over' || p.budgetStatus === 'over'
    const within = exactResults.filter((p) => !isOver(p))
    const over = exactResults.filter(isOver)
    if (within.length) {
      block += `\n\n## Exact Matches — Use RESPONSE FORMAT — SEARCH RESULTS\n${serializeProjects(within)}`
    } else {
      block += `\n\n## No Exact Matches\nNothing we hold meets every requirement within the stated budget. Say so plainly before mentioning anything below.`
    }
    if (over.length) {
      block += `\n\n## Above the Stated Budget — NOT MATCHES. Label each as above budget, give its actual price and how far over it is, and ask whether the buyer would stretch. Never call these matches.\n${serializeProjects(over)}`
    }
  }

  if (hasNearby && nearbyResults) {
    const sectorsLabel = expansion?.searchedSectors.join(', ') ?? 'nearby sectors'
    const overBudgetNearby = nearbyResults.filter(
      (p) => p.budgetStatus === 'slightly_over' || p.budgetStatus === 'over'
    ).length
    const nearbyBudgetNote = overBudgetNearby > 0
      ? `\nBUDGET NOTE: ${overBudgetNearby} of ${nearbyResults.length} nearby results exceed the user's stated budget. Disclose this.`
      : ''
    block += `\n\n## Nearby Alternatives (from ${sectorsLabel}) — LABEL THESE AS ALTERNATIVES, NOT EXACT MATCHES${nearbyBudgetNote}\n${serializeProjects(nearbyResults)}`
  }

  return notFoundBlock + block
}

export function buildSectorBlock(ctx: SectorContext, intent: Intent): string {
  const priceRange = ctx.priceMinCr != null && ctx.priceMaxCr != null
    ? `₹${ctx.priceMinCr.toFixed(2)}–${ctx.priceMaxCr.toFixed(2)}Cr`
    : ctx.priceMinCr != null ? `from ₹${ctx.priceMinCr.toFixed(2)}Cr` : 'varies'
  const bhkFilter = intent.bhk?.length ? ` (${intent.bhk.join('/')}BHK)` : ''
  const metro = ctx.metroStations.length ? `Metro: ${ctx.metroStations.join(', ')}` : ''
  const roads = ctx.keyRoads.length ? `Roads/Expressways: ${ctx.keyRoads.join(', ')}` : ''
  const landmarks = ctx.nearbyLandmarks.length ? `Nearby: ${ctx.nearbyLandmarks.join(', ')}` : ''
  const conn = [metro, roads, landmarks].filter(Boolean).join(' | ')

  return `\n\n## Sector Overview — ${ctx.sector}
Projects in DB: ${ctx.projectCount}${bhkFilter} | Price range: ${priceRange}
Availability: ${ctx.rtmCount} ready-to-move · ${ctx.ucCount} under construction${conn ? `\nConnectivity: ${conn}` : ''}`
}

export function buildSectorsOverviewBlock(overviews: SectorOverview[], intent: Intent): string {
  const bhkLabel = intent.bhk?.length ? `${intent.bhk.join('/')}BHK ` : ''
  const lifestyleLabel = intent.lifestyleKeywords?.length
    ? ` · Lifestyle filter: ${intent.lifestyleKeywords.join(', ')}`
    : ''

  const rows = overviews.map((s) => {
    const price = s.priceMinCr != null && s.priceMaxCr != null
      ? `₹${s.priceMinCr.toFixed(2)}–${s.priceMaxCr.toFixed(2)}Cr`
      : s.priceMinCr != null ? `from ₹${s.priceMinCr.toFixed(2)}Cr` : 'varies'
    const metro = s.metroStations.length ? ` | Metro: ${s.metroStations.join(', ')}` : ''
    const amenities = s.topAmenities.length ? ` | Amenities: ${s.topAmenities.join(', ')}` : ''
    return `- **${s.sector}**: ${s.projectCount} projects · ${price} · ${s.rtmCount} RTM / ${s.ucCount} UC${metro}${amenities}`
  }).join('\n')

  return `\n\n## Sector Advisory Data — ${bhkLabel}Noida${lifestyleLabel}
Use the SECTOR ADVISORY format. Recommend 2-3 sectors from this REAL database data:

${rows}`
}

export function buildIntentSummary(intent: Intent): string {
  const parts: string[] = []
  if (intent.bhk?.length) parts.push(`BHK: ${intent.bhk.join(' or ')}`)
  if (intent.budgetMax) parts.push(`Budget: up to ₹${intent.budgetMax}Cr`)
  if (intent.budgetMin) parts.push(`Budget from: ₹${intent.budgetMin}Cr`)
  if (intent.sector) parts.push(`Sector: ${intent.sector}`)
  if (intent.possession) parts.push(`Possession: ${intent.possession}`)
  if (intent.purpose === 'investment') {
    parts.push(`Purpose: investment — HARD RULE 20 ACTIVE: do NOT provide ROI projections, appreciation percentages, CAGR, doubling timeframes, or project investment rankings. Macro context from web_search is permitted; project-specific return forecasts are not.`)
  } else if (intent.purpose) {
    parts.push(`Purpose: ${intent.purpose}`)
  }
  if (intent.builderName) parts.push(`Builder: ${intent.builderName}`)
  if (intent.lifestyleKeywords?.length) parts.push(`Lifestyle signals: ${intent.lifestyleKeywords.join(', ')}`)
  return parts.length ? `Detected intent: ${parts.join(' · ')}\n` : ''
}

export function buildMemorySummary(memory: {
  bhk_preference?: number | null
  budget_max_cr?: number | null
  sector_preference?: string | null
  purpose?: string | null
  viewed_slugs?: string[]
  current_session_viewed?: string[] // Track C: current session viewed projects
}): string {
  const parts: string[] = []
  if (memory.bhk_preference) parts.push(`Past BHK preference: ${memory.bhk_preference}BHK`)
  if (memory.budget_max_cr) parts.push(`Past budget: ₹${memory.budget_max_cr}Cr`)
  if (memory.sector_preference) parts.push(`Past sector interest: ${memory.sector_preference}`)
  if (memory.viewed_slugs?.length) parts.push(`Previously viewed: ${memory.viewed_slugs.slice(0, 3).join(', ')}`)
  
  let summary = parts.length ? `Returning user — use as defaults when not re-stated: ${parts.join(' · ')}\n` : ''
  if (memory.current_session_viewed?.length) {
    summary += `User recently viewed in THIS session: ${memory.current_session_viewed.join(', ')}. When user says "this", "that", or "how does it compare", they refer to these.\n`
  }
  return summary
}

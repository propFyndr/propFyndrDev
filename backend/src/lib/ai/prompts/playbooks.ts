// backend/src/lib/ai/prompts/playbooks.ts
//
// The six advisory playbooks, selected rather than all sent.
//
// They lived inline in `base.ts` and every turn carried all of them: 5,569
// characters of which at most one applies. A yield-investor's asset-class
// comparison is noise for a first-time buyer stretching a budget, and the
// luxury hierarchy is noise for both.
//
// That matters because time-to-first-token tracks input size. Measured on a
// six-project Sector 150 search: 72,009 characters of prompt produced its first
// token after 11,093ms on gemini-3.6-flash while emitting 262 characters of
// answer. The same prompt on the lite model with no thinking answered in
// 3,422ms. Input is where discovery latency lives, and this is the largest
// block in `base.ts` that is knowably irrelevant most of the time.
//
// Selection is regex over the message plus the intent the router already
// resolved — no extra model call, and a miss falls back to sending the two that
// suit an unclassified buyer rather than none.

import type { Intent } from '../../discovery/types'

export type PlaybookId =
  | 'relocation'
  | 'firstTime'
  | 'yield'
  | 'nri'
  | 'luxury'
  | 'pricing'
  | 'legalDueDiligence'
  | 'landedCostAndTax'
  | 'yeidaJewarVerification'
  | 'livabilityWater'

interface Playbook {
  /** Fires when the buyer's words or resolved intent match. */
  matches: (message: string, intent?: Partial<Intent>) => boolean
  text: string
}

const PLAYBOOKS: Record<PlaybookId, Playbook> = {
  relocation: {
    matches: (m, i) =>
      // `relocat\w*` because `\brelocat\b` never matches "relocating", which is
      // how people write it — the same miss `\brefund\b` made on "refunded".
      /\b(relocat\w*|moving to|new to (the )?(city|noida)|shifting to|which (areas?|sectors?|part)\b|where should i (live|buy|look)|good areas?|best (area|locality|micro))\b/i.test(m) ||
      i?.journeyStage === 'relocation',
    text: `### RELOCATION & AREA DISCOVERY PLAYBOOK
When the user is relocating, new to the city, or asking for good areas to live in:
- **Step 1 (Orientation)**: Outline the 3 core micro-market hubs concisely (Noida Expressway for low-density green living & IT parks; Central Noida 7X for established family life, top schools & metro; Greater Noida West for maximum space per Rupee).
- **Step 2 (Progressive Inquire)**: Ask: *"Where is your primary daily commute (e.g. South Delhi, Gurgaon, Expressway IT hubs, or WFH), and what is your family's top lifestyle priority (school proximity, low-density green living, or immediate ready-to-move peace of mind)?"*`,
  },

  firstTime: {
    matches: (m, i) =>
      /\b(first[- ]time|first home|rent vs buy|rent or buy|should i (buy|rent)|young family|stretch(ing)? (my|the)? ?budget|afford)\b/i.test(m) ||
      i?.riskProfile === 'first_time_buyer' ||
      i?.journeyStage === 'first_time_buyer',
    text: `### YOUNG FAMILY & FIRST-TIME PURCHASER PLAYBOOK
When a young buyer or family is stretching budget or asking about rent vs buy:
- **Challenge parameters mathematically**: Show the space-to-budget reality using the rates in the verified block you were given — a budget at one sector's rate buys a smaller unit than the same budget one sector over, and naming both rates makes the trade-off concrete. Use only rates present in your context. If none were injected you do not hold them this turn — describe the trade-off in words and offer to look at named projects, rather than supplying a rate from memory.
- **Ground-level livability**: Highlight municipal water (e.g. 40 MLD Ganga water pipeline in Sector 76 vs groundwater TDS reaching 3,000 ppm) and daily OpEx (maintenance ₹4–6/sqft, PVVNL grid @ ₹6.00/unit vs DG backup @ ₹17.00/unit).`,
  },

  yield: {
    matches: (m, i) =>
      /\b(rental yield|yield|roi|rental income|return on investment|pre[- ]leased|commercial|appreciation|capital gains?|where\s+should\s+i\s+invest|invest(?:ing)?\s*\d+\s*(?:cr|crore)|portfolio\s*allocation)\b/i.test(m) ||
      i?.purpose === 'investment' ||
      i?.journeyStage === 'yield_investor',
    text: `### YIELD INVESTOR PLAYBOOK
When an investor seeks rental income or ROI:
- **Asset class comparison**: Compare residential rental yields (2.5%–3.5%) against commercial pre-leased high-street retail (6%–8%).
- **Macro Catalysts**: Reference UP FAR policy reforms (up to 4.0 FAR, no ground coverage cap) and Jewar International Airport commercial flight operations (commencing 2026).
- **Taxation & Costs**: Note commercial stamp duty (7% male + 1% registry), commercial circle rates (up to ₹2,50,000/sqm), and 18% GST on under-construction commercial.`,
  },

  nri: {
    matches: (m, i) =>
      /\b(nri|overseas|abroad|from (dubai|singapore|usa|uk|canada|australia)|remote(ly)? (buy|purchase|register)|fema|repatriat|power of attorney|fraud protection|is it safe to buy)\b/i.test(m) ||
      i?.riskProfile === 'nri' ||
      i?.journeyStage === 'nri_investor',
    text: `### OVERSEAS / NRI CAPITAL ALLOCATOR PLAYBOOK
When an NRI or buyer asks about safety, delays, or fraud protection:
- **Regulatory Security**: Highlight UP RERA Form-7 mandatory CA audits (ensuring 70% of all buyer funds remain locked in escrow for construction).
- **Title & Price Protection**: Explain the mandatory Tripartite Sale Agreement executed with the Authority at 10% booking to prevent double-allotment and price escalation.
- **Remote Mechanics**: Explain Special Power of Attorney (SPA) protocol for remote registration.`,
  },

  luxury: {
    matches: (m, i) =>
      /\b(richest|wealthy|wealthiest|affluent|posh|poshest|elite|upscale|prestigious|billionaire|industrialist|cxo|ceo|ultra[- ]luxury|luxury|mansion|penthouse|villa|bungalow|sky ?mansion)\b/i.test(m) ||
      (typeof i?.budgetMin === 'number' && i.budgetMin >= 5) ||
      (typeof i?.budgetMax === 'number' && i.budgetMax >= 6),
    text: `### NOIDA LUXURY & WEALTH RESIDENTIAL HIERARCHY
When asked where the richest people, industrialists, or CXOs live in Noida, or regarding the most prestigious, upscale, or expensive neighborhoods in Noida, ALWAYS structure the answer across BOTH core wealth archetypes:

1. **Legacy Plotted Bungalow Enclaves (Generational, Industrialist & Bureaucratic Wealth)**:
   - **Sector 15A**: Widely recognized as the "Lutyens of Noida" or "Billionaires' Row". Characterized by sprawling 500–1,000+ sqm independent mansions, extreme security, quiet tree-lined avenues, and immediate DND proximity to South/Central Delhi. Home to legacy industrialists, senior judges, advocates, and business leaders.
   - **Sector 14 & Sector 44**: Ultra-prime plotted residential sectors commanding Noida's highest per-sq.yd land valuations, favored by high-net-worth business families.
   - **Sector 26 & Sector 47**: Established posh plotted residential neighborhoods known for high privacy, green density, and independent villas.

2. **Modern High-Rise Luxury Hubs & Golf Townships (Corporate CXO, Tech Founder & NRI Wealth)**:
   - **Sector 128 (Jaypee Greens Wish Town)**: Integrated golf township featuring custom golf-facing villas, private estates, and luxury penthouses. Preferred by corporate CEOs and modern wealth. Quote its rate only from the verified block or a named project's own rows.
   - **Sector 94 (Expressway Gateway)**: Super-tall luxury towers with 6,000–10,000 sq.ft sky mansions (e.g. ATS Knightsbridge, Supertech Supernova penthouses) right on the Delhi-Noida border.
   - **Sector 150**: Low-density green sports city corridor with 80% green buffers and branded luxury developments.
   - **Sector 93A & 93B**: Established secure luxury gated communities (ATS Greens Village, Eldeco Utopia).`,
  },

  pricing: {
    matches: (m, i) =>
      /\b(too much|worth it|price viability|what can i get|rates? in|compare rates|per sq\.?\s?ft|psf|circle rate|overpriced|value for money|fair price)\b/i.test(m) ||
      i?.journeyStage === 'market_evaluator',
    text: `### MARKET EVALUATOR, PRICING & BUDGET FEASIBILITY PLAYBOOK
When a user asks about price viability (e.g. "Is 2 crore too much for a 3 BHK in Noida?", "What can I get in ₹1.5 Cr?", "Compare rates in Sector 75 vs 150"):
- **Direct Verdict First**: Give an immediate, clear fiduciary answer in 1–2 sentences, then justify it.
- **Every figure comes from the rows you were given.** A verified micro-market
  block is injected above when the question is about rates or places; quote it.
  When it is absent, you do not hold market rates for this turn — say so and
  offer to look at named projects instead. Never supply a rate from memory.
- **Key Valuation Checklist**: 2–3 sharp bullets after the verdict:
  - **RERA Usable Carpet Area**: price per sq.ft of net usable carpet, not super built-up.
  - **GST & Possession**: under-construction attracts 5% GST; ready-to-move with OC carries 0%.
  - **Builder Score**: delivery record and UP-RERA escrow compliance before committing.`,
  },

  legalDueDiligence: {
    matches: (m) =>
      /\b(leasehold|freehold|transfer memorandum|\btm\b|transfer charges?|society ndc|rwa ndc|sub[- ]lease|document chain|registry delay|delayed registry|registry\s*(?:blocked|freeze|pending|stall)|physical\s+keys|token money|clean title|authority dues|land dues|dakhil kharij|authority seal|sealing|kisan quota|abadi plot|unauthorized plotting|virasat|chakbandi)\b/i.test(m),
    text: `### LEGAL DUE DILIGENCE & TITLE STRUCTURE PLAYBOOK
When the user asks about leasehold vs freehold, Transfer Memorandum, delayed registries, or title diligence:
- **Authority Leasehold (90 to 99 Years)**: Residential land in NOIDA, GNIDA, and YEIDA is allotted on a **90 to 99-year leasehold basis**. The authority holds underlying land title; the homebuyer owns the apartment structure and holds a registered tripartite sub-lease deed. Blanket freehold conversion remains deferred by UP state policy because local authorities rely on lease rent and transfer revenues for regional infrastructure.
- **Transfer Memorandum (TM) & Resale Fees**: A TM is the mandatory clearance issued by the Authority permitting property transfer during resale. Official transfer fees range from **1% to 5%** of the circle/allotment rate or premium. Contractual responsibility is negotiable (commonly shared or borne by the buyer, while historical unpaid dues must be cleared by the seller before TM issuance).
- **RWA/Society NDC vs Authority NDC**: Highlight that an RWA/Society NDC only clears internal maintenance bills and electricity meters. It does **NOT** verify that the developer has cleared multi-crore land dues and one-time lease rent with the Authority. If builder authority dues are pending, sub-lease deed registration remains legally stalled even after keys/possession are handed over.
- **Authority Sealing on Builder Dues**: Authority cannot seal individual flats where a tripartite sub-lease deed is officially registered and stamp duty paid. However, in projects with pending land dues where registry is embargoed, buyers only hold possession letters without registered title—leaving them vulnerable to builder account attachments and administrative freezes.
- **Kisan Quota 5% & 6% Abadi Plots**: Extreme caution required. 5% & 6% farmer rehabilitation plots cannot be legally transferred before the mandatory lock-in period and formal lease execution. Verify the complete genealogical tree (Virasat) and Chakbandi revenue records before releasing token funds.
- **10-Step Document Chain for Resale**: Original Allotment Letter -> Builder Buyer Agreement (BBA) -> Tripartite Sub-Lease Deed / Possession Certificate -> Registered Transfer Deeds (for resale chain) -> Authority Transfer Memorandum (TM) -> Authority No Dues Certificate (NDC) -> Society/RWA NDC -> Electricity Load Transfer -> Mutation Record (Dakhil Kharij) -> Non-Encumbrance Certificate.`,
  },

  landedCostAndTax: {
    matches: (m) =>
      /\b(under[- ]construction|ready[- ]to[- ]move|gst on (flat|property|apartment)|\d+%\s*gst|carpet (area )?vs super|loading percentage|loading %|hidden costs?|one[- ]time lease rent|bsp vs landed|section 54|194[- ]?ia|tds on property|capital gains|dg backup rate|power backup rate|construction quality|mivan)\b/i.test(m),
    text: `### LANDED COST, TAXATION & SPATIAL EFFICIENCY PLAYBOOK
When the user asks about under-construction vs ready-to-move, GST impact, hidden costs, or carpet area:
- **GST Disparity (UC vs RTM)**: Non-affordable under-construction flats attract **5% GST** (without Input Tax Credit). In contrast, Ready-to-Move (RTM) flats with a valid Occupancy Certificate (OC) attract **0% GST**. On a ₹1.5 Crore apartment, this represents an immediate ₹7.50 Lakh tax difference.
- **True Landed Cost Breakdown**: Basic Sale Price (BSP) is only 75%–80% of the total purchase outlay. Always calculate:
  - UP Stamp Duty: **7% (Male) / 6% (Female)** + **1% Registration Fee**.
  - One-Time Lease Rent: **10% of land cost** (if not settled upfront by builder, annual recurring ground rent applies).
  - IFMS (Interest-Free Maintenance Security): ₹50–₹120/sq.ft.
  - Mandatory Club Membership (₹1.5L–₹5.0L) + Dual Electric Meter Infrastructure & DG Power Backup setup charges (₹25k–₹40k per kVA).
  - DG Power Running Cost: ₹16–₹22/unit on diesel generator vs ₹6.00–₹7.50/unit on PVVNL grid.
- **Capital Gains Tax & TDS (Section 54 & 194-IA)**: 
  - **Section 54 / 54F Exemption**: Long-term capital gains tax can be saved by investing in a residential property within 2 years of sale (or 3 years for construction), capped at ₹10 Crore.
  - **TDS Section 194-IA**: Buyer MUST deduct 1% TDS on total property consideration (including parking, club, and EDC/IDC) if transaction value is ₹50 Lakh or more, and deposit via Form 26QB.
- **Carpet Area vs Super Built-up (Loading)**: Super built-up area includes common corridors, lift shafts, and lobbies, resulting in a **25% to 35% loading factor** in NCR high-rises. Always evaluate price per square foot on net usable RERA Carpet Area.
- **Construction Quality Architecture**: Mivan monolithic aluminum shuttering provides seamless shear wall strength and high seismic resistance (Zone IV), eliminating brick masonry cracks, though interior walls cannot be altered. Precast concrete requires rigorous joint sealant monitoring against monsoon water ingress.`,
  },

  yeidaJewarVerification: {
    matches: (m) =>
      /\b(jewar|jewar airport|yeida|unauthorized plotting|plotting near airport|illegal colon(y|ies)|yeida plot|expressway investment)\b/i.test(m),
    text: `### JEWAR AIRPORT & YEIDA CORRIDOR DUE DILIGENCE PLAYBOOK
When evaluating investments near Noida International Airport (Jewar) or Yamuna Expressway (YEIDA):
- **Approved Sectors vs Unauthorized Colonization**: Strictly verify that any plotted scheme is an officially notified YEIDA sector (e.g., Sector 17, 18, 20, 22D) with an official YEIDA allotment letter. Reject private unapproved agricultural colonies and 'farmhouse' plotting sold under deceptive airport proximity marketing—these violate Section 10 of the UP Industrial Area Development Act 1976 and carry immediate demolition risks.
- **Official YEIDA Resale Transfer Costs**: Resale transfers through YEIDA require an official No-Due Certificate and Transfer Memorandum. Official transfer fees are estimated at **~5% of current authority rate/premium**, pushing total transaction costs (stamp duty + transfer + registration) to **10%–13%**.
- **Airport Impact Horizon**: Noida International Airport commercial operations drive long-term logistics and aero-commercial growth. Appreciation along YEIDA and Greater Noida corridors follows infrastructure delivery milestones rather than speculative short-term trading.`,
  },

  livabilityWater: {
    matches: (m) =>
      /\b(ganga\s+water|groundwater|salin(?:ity|e)|tds|borewell|water\s+supply|drinking\s+water|water\s+quality|waterlogging|flood\s*risk|power\s+cuts?|dg\s+power\s+unit|electricity\s+tariff)\b/i.test(m),
    text: `### LIVABILITY, WATER SOURCE & CIVIC INFRASTRUCTURE PLAYBOOK
When the user asks about water supply, groundwater TDS, or civic livability:
- **Ganga Water vs Groundwater Salinity**: Explain the critical distinction between Ganga Water supply (treated surface water with healthy TDS below 300 ppm, low scale buildup) vs raw groundwater borewells (high mineral salinity with TDS exceeding 2,000–3,500 ppm, requiring heavy RO treatment, causing rapid corrosion of bathroom fittings and geysers).
- **Corridor Water Realities**: Central Noida (Sectors 74–79) and Noida Expressway receive designated Ganga water supply lines. Peripheral sectors in Greater Noida West and unorganized pockets often rely on internal WTPs mixing borewell groundwater.
- **DG Power & Tariff Stack**: Highlight statutory dual-metering infrastructure (PVVNL grid at ~₹6.50–₹7.50/unit vs captive DG power backup at ₹18.00–₹24.00/unit on diesel consumption).`,
  },
}

/** At most this many, so a message hitting four does not undo the saving. */
const MAX_PLAYBOOKS = 2

/**
 * The playbooks worth sending this turn.
 *
 * Returns '' when none match and the turn carries no buyer signal — an early
 * "hi" needs no advisory framework, and sending six is how the block became the
 * largest avoidable thing in the prompt.
 */
export function selectPlaybooks(message: string, intent?: Partial<Intent>): string {
  const m = message ?? ''
  const hits = (Object.keys(PLAYBOOKS) as PlaybookId[]).filter(id => {
    try {
      return PLAYBOOKS[id].matches(m, intent)
    } catch {
      return false
    }
  })

  if (hits.length === 0) return ''

  const chosen = hits.slice(0, MAX_PLAYBOOKS).map(id => PLAYBOOKS[id].text)
  return [
    '',
    '---',
    '',
    '## CONSULTATIVE ADVISORY PLAYBOOK',
    '',
    'This buyer matches the framework below. Apply it.',
    '',
    ...chosen,
  ].join('\n')
}

/** Exposed for the test that pins which situations select which framework. */
export const PLAYBOOK_IDS = Object.keys(PLAYBOOKS) as PlaybookId[]
export function matchedPlaybooks(message: string, intent?: Partial<Intent>): PlaybookId[] {
  return (Object.keys(PLAYBOOKS) as PlaybookId[])
    .filter(id => PLAYBOOKS[id].matches(message ?? '', intent))
    .slice(0, MAX_PLAYBOOKS)
}

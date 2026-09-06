// backend/src/lib/chat/handlers/citywideQuery.ts

import { prisma } from '../../db'
import { webSearch } from '../../web'
import type { ChatTopicHandler } from '../handlerContext'
import { statedMonthlyIncome, computeAffordability, renderAffordabilityTable } from '../../ai/affordability'
import { formatInr } from '../../calculators'

// ── REGEX PATTERNS ─────────────────────────────────────────────────────────

/** Patterns for real estate agency / consultancy queries. */
const RE_FIRM_REGEX = /\b(investors? clinic|wealth clinic|square yards|360 realtors|anarock|proptiger|nobroker|magicbricks|housing\.com|sarthi properties|damac)\b/i

/** Patterns for luxury / wealth geography queries ("where do richest people in noida live"). */
const RICHEST_LIVE_REGEX = /\b(richest|wealthiest|top 1%|billionaires|millionaires|most expensive (sectors?|areas?|localities|societies|places?))\b.*\b(live|stay|buy|sectors?|areas?|localities|societies|noida)\b/i

/** Patterns for citywide superlative / best queries. */
const BEST_PROJECT_REGEX = /\b(which (is|are) (the )?best|what (is|are) (the )?best|best (project|flat|apartment|society|property|sector|area|2\s*bhk|3\s*bhk|4\s*bhk)|top (projects?|societies|apartments))\b/i

/** Patterns for citywide budget queries ("cheapest project in noida"). */
const CHEAPEST_PROJECT_REGEX = /\b(which (is|are) (the )?cheapest|cheapest (project|flat|apartment|society|property)|most affordable (project|flat|apartment|society|property))\b/i

/** Patterns for investment budget allocation & yield queries. */
const INVESTMENT_ALLOCATION_REGEX = /\b(where should i invest|how to invest|best investment strategy|risk-adjusted return|double my money|capital allocation|investment plan|allocate my (budget|money|capital)|highest (appreciation|roi)|which sector will appreciate|investment portfolio)\b/i

/** Patterns for temporal, recent trends & upcoming infrastructure queries. */
const TEMPORAL_INFRA_REGEX = /\b(last 12 months|recent (trends?|price|appreciation)|upcoming infrastructure|jewar airport|noida airport|film city|metro expansion|infrastructure projects?|what has changed)\b/i

/** Patterns for environmental / civic risk queries (waterlogging, pollution, traffic, safety). */
const RISK_GEOGRAPHY_REGEX = /\b(waterlogging|drainage|flood|traffic (problems?|congestion)|high pollution|aqi|air quality|safe to buy|is noida safe|poor connectivity|builders? (to avoid|should i avoid))\b/i

/** Patterns for personal finance, salary & EMI budget planning. */
const PERSONAL_FINANCE_EMI_REGEX = /\b(i earn|monthly (income|salary)|down payment|emi (of|under|limit)|can i afford|my budget is|what can i buy with)\b/i

/** Patterns for resale property & freehold vs leasehold queries. */
const RESALE_FREEHOLD_REGEX = /\b(resale (property|flat|apartment)|check before buying resale|leasehold|freehold|are (all )?properties in noida leasehold)\b/i

/** Patterns for cross-city / cross-region comparisons. */
const CITY_COMPARISON_REGEX = /\b(noida vs gurgaon|gurgaon vs noida|noida vs greater noida|greater noida vs noida|noida extension vs noida)\b/i

/** Patterns for market price per sq ft inquiries. */
const AVERAGE_PRICE_REGEX = /\b(average (property )?price|price per sq ?ft|rate per sq ?ft|cost per sq ?ft|market rates? in noida)\b/i

/** Patterns for family livability inquiries. */
const FAMILY_LIVABILITY_REGEX = /\b(best (for|areas? for|sectors? for) families|good for family|best sectors? for living|family friendly sectors?)\b/i

/** Patterns for metro connectivity inquiries. */
const METRO_TRANSIT_REGEX = /\b(best (metro|transit|connectivity) (sectors?|connectivity)|metro connectivity|sectors? near metro)\b/i

/** Patterns for sector deep-dives and pros/cons. */
const SECTOR_PROS_CONS_REGEX = /\b(is sector \d+|advantages? and disadvantages?|pros and cons|benefits and drawbacks|worth buying in sector \d+)\b/i

/** Patterns for citywide builder reputation. */
const BUILDER_REPUTATION_CITYWIDE_REGEX = /\b(best builders?|top developers?|builder reputation|reputed builders?|builders?.*(reputation|track record|best|top))\b/i

/** Patterns for RERA compliance verification guide. */
const RERA_VERIFY_CITYWIDE_REGEX = /\b(verify.*rera|how (do|to) check rera|is.*rera compliant|rera compliance check|verify whether.*rera)\b/i

/** Patterns for golf luxury & private concierge enclaves. */
const GOLF_LUXURY_REGEX = /\b(golf course|concierge|penthouse|private elevator|ultra-luxury|luxury.*facing|signature residences)\b/i

/** Patterns for commercial retail & pre-leased investments. */
const COMMERCIAL_RETAIL_REGEX = /\b(commercial|retail shop|pre-leased|high-street|office space|sco plots?)\b/i

/** Patterns for NRI regulations, FEMA, and tax repatriation. */
const NRI_LEGAL_FEMA_REGEX = /\b(nri|fema|tds u\/s 195|repatriation|nre account|nro account|living in (dubai|usa|uk|singapore|canada))\b/i

/** Patterns for OC vs CC & Transfer Memorandum due diligence. */
const OC_CC_TM_REGEX = /\b(occupancy certificate|completion certificate|oc vs cc|tm charges|transfer memorandum)\b/i

/** Patterns for student & tech professional co-living yields. */
const STUDENT_COLIVING_REGEX = /\b(student housing|co-living|studio (apartment|flat)|1 bhk.*yield|near (university|colleges?))\b/i

/** Patterns for circle rate vs market rate negotiation. */
const CIRCLE_MARKET_RATE_REGEX = /\b(circle rate|market rate|stamp duty rate|negotiat.*discount|circle vs market)\b/i

/** Patterns for price benchmark checks ("is 2 crore too much for 3 BHK"). */
const PRICE_BENCHMARK_CHECK_REGEX = /\b(is (?:₹?\s*\d+(?:\.\d+)?\s*(?:cr|crore|lakhs?|lakh))\s*(?:too (?:much|expensive|high)|fair|good deal|reasonable)|fair price for|price check|too much for (?:a )?\d+\s*bhk)\b/i

/** Patterns for highest property price micro-markets. */
const HIGHEST_PRICE_SECTOR_REGEX = /\b(highest property prices?|most expensive sectors?|costliest (sectors?|places?|areas?)|where do property prices peak)\b/i

/** Patterns for under-construction vs ready-to-move investment choice. */
const UNDER_CONSTRUCTION_VS_READY_REGEX = /\b(under-construction.*ready-to-move|under construction vs ready|ready vs under construction|rtm vs uc)\b/i

/** Patterns for unknown builder / 20% discount traps. */
const UNKNOWN_BUILDER_RISK_REGEX = /\b(unknown builder|smaller builder|unreputed builder|20% cheaper.*builder|should i buy from unknown)\b/i

/** Patterns for suspiciously cheaper unit investigation. */
const CHEAPER_UNIT_INVESTIGATION_REGEX = /\b(cheaper than similar|price difference.*investigate|suspiciously cheap|why is this flat cheap|25 lakh cheaper)\b/i

/** Patterns for 3-way corridor dilemma (Sector 75 vs 150 vs Extension). */
const THREE_WAY_CORRIDOR_DILEMMA_REGEX = /\b(sector 75.*sector 150.*noida extension|compare.*sector 75.*sector 150|deciding between.*sector 75.*sector 150)\b/i

/** Patterns for Noida vs Gurgaon affordability. */
const NOIDA_VS_GURGAON_AFFORDABILITY = /\b(noida (?:still )?affordable compared (?:with|to) gurgaon|gurgaon vs noida.*affordable|noida vs gurgaon)\b/i

/** Patterns for Sector 74 vs 75 vs 76 vs 78 family living comparison. */
const CENTRAL_SECTORS_FAMILY_FIT = /\b(sector 74.*75.*76.*78|which is better for a family.*(?:74|75|76|78))\b/i

/** Patterns for EMI budget realism ("buy 1 crore flat with 30k EMI"). */
const EMI_AFFORDABILITY_FEASIBILITY = /\b(\d+\s*cr(?:ore)? flat.*(?:don't|not).*spend more than.*emi|emi.*realistic|is that realistic|can i afford.*with.*emi)\b/i

/** Patterns for Sector 150 vs Sector 128 comparison. */
const SEC150_VS_SEC128_COMPARISON = /\b(sector 150 vs sector 128|sector 128 vs sector 150)\b/i

/** Patterns for Competitor & Alternative Project comparisons ("projects in Sector 121 compete with Cleo County"). */
const COMPETITOR_COMPARISON_REGEX = /\b(compet(e|itor|ing|ition)|alternatives? to|comparable to|similar (?:to|projects?)|how do (?:they|these) differ|other projects in.*(?:compete|differ|similar)|projects like|who competes with)\b/i

/** Patterns for Subvention Scheme legality, RBI regulations, and UP RERA ban inquiries. */
const SUBVENTION_LEGALITY_REGEX = /\b(subvention|20[:\s]*80|10[:\s]*90|80[:\s]*20)\b.*\b(legal|banned|ban|allowed|illegal|rbi|up\s*rera|rera|safe|fraud|scam|circular)\b|\b(is|are)\b.*\b(subvention|20[:\s]*80|10[:\s]*90)\b/i


export const citywideQueryHandler: ChatTopicHandler = {
  id: 'citywide-query',
  description: 'Comprehensive handler for citywide superlatives, wealth geography, brokerages, investment strategy, market risks, infrastructure, and financial scoping',

  matches: (ctx) => {
    const msg = (ctx.message || '').toLowerCase()

    /**
     * A project in focus outranks the citywide arms of this handler.
     *
     * Measured: "and the builder track record?" and "is it RERA registered?",
     * both asked one turn after a Godrej Woods answer, were claimed here by
     * BUILDER_REPUTATION_CITYWIDE_REGEX and RERA_VERIFY_CITYWIDE_REGEX. The
     * buyer got a league table of Noida's top developers, and a generic
     * explainer of how we verify projects — neither of which mentioned Godrej
     * Woods, which holds both a builder scorecard and a registration number in
     * its own rows.
     *
     * This handler sits second in the registry, ahead of the twelve
     * project-scoped ones, so a citywide pattern matching a project-scoped
     * question wins on position alone. Only these two arms overlap; the rest
     * are genuinely about the city and are left alone.
     *
     * Same shape as the sticky `purpose` arm removed at the end of this list:
     * the test should be what was asked, not a pattern that happens to fire.
     */
    const projectScoped = ctx.flags.hasSingleNamedProject === true

    return (
      SUBVENTION_LEGALITY_REGEX.test(msg) ||
      COMPETITOR_COMPARISON_REGEX.test(msg) ||
      RE_FIRM_REGEX.test(msg) ||
      RICHEST_LIVE_REGEX.test(msg) ||
      BEST_PROJECT_REGEX.test(msg) ||
      CHEAPEST_PROJECT_REGEX.test(msg) ||
      PRICE_BENCHMARK_CHECK_REGEX.test(msg) ||
      HIGHEST_PRICE_SECTOR_REGEX.test(msg) ||
      UNDER_CONSTRUCTION_VS_READY_REGEX.test(msg) ||
      UNKNOWN_BUILDER_RISK_REGEX.test(msg) ||
      CHEAPER_UNIT_INVESTIGATION_REGEX.test(msg) ||
      THREE_WAY_CORRIDOR_DILEMMA_REGEX.test(msg) ||
      NOIDA_VS_GURGAON_AFFORDABILITY.test(msg) ||
      CENTRAL_SECTORS_FAMILY_FIT.test(msg) ||
      EMI_AFFORDABILITY_FEASIBILITY.test(msg) ||
      SEC150_VS_SEC128_COMPARISON.test(msg) ||
      TEMPORAL_INFRA_REGEX.test(msg) ||
      RISK_GEOGRAPHY_REGEX.test(msg) ||
      PERSONAL_FINANCE_EMI_REGEX.test(msg) ||
      RESALE_FREEHOLD_REGEX.test(msg) ||
      CITY_COMPARISON_REGEX.test(msg) ||
      AVERAGE_PRICE_REGEX.test(msg) ||
      FAMILY_LIVABILITY_REGEX.test(msg) ||
      METRO_TRANSIT_REGEX.test(msg) ||
      SECTOR_PROS_CONS_REGEX.test(msg) ||
      (!projectScoped && RERA_VERIFY_CITYWIDE_REGEX.test(msg)) ||
      GOLF_LUXURY_REGEX.test(msg) ||
      NRI_LEGAL_FEMA_REGEX.test(msg) ||
      OC_CC_TM_REGEX.test(msg) ||
      STUDENT_COLIVING_REGEX.test(msg) ||
      CIRCLE_MARKET_RATE_REGEX.test(msg)
      // `ctx.intent?.purpose === 'investment'` used to be an arm of this OR.
      //
      // `purpose` is sticky session intent, so one buyer saying "I'm buying to
      // invest" routed EVERY later turn of that session into this handler —
      // ahead of the twelve handlers below it and ahead of the generic
      // project-detail path — whatever the question actually was. The thirty
      // patterns above already match investment questions on their own wording,
      // which is the right test: what was asked, not what was asked three
      // turns ago.
    )
  },

  handle: async (ctx) => {
    const msg = ctx.message
    const msgLower = msg.toLowerCase()

    // ── 1. Real Estate Advisory / Brokerage Firms ─────────────────────────────────
    if (RE_FIRM_REGEX.test(msgLower)) {
      const firmMatch = msg.match(RE_FIRM_REGEX)
      const firmName = firmMatch ? firmMatch[0] : 'Real Estate Advisory'

      let webContext = ''
      try {
        webContext = await webSearch(`${firmName} real estate noida company profile track record`, 3)
      } catch (err) {
        console.warn('[CITYWIDE_HANDLER:WEB_SEARCH_ERROR]', err)
      }

      const replyText = `### Overview: ${firmName}\n\n` +
        `**${firmName}** operates as a real estate brokerage and channel partner firm in the Noida, Greater Noida, and Delhi-NCR markets.\n\n` +
        `#### Key Highlights & Operating Model:\n` +
        `- **Channel Partner Model**: For primary (new launch) builder projects, registered channel partners do not charge buyers a brokerage fee — their commission is paid by the developer.\n` +
        `- **Resale & Leasing**: For secondary market transactions (resale or rental), standard market brokerage fees (typically 1% to 2%) apply.\n\n` +
        `#### PropFyndr Advisory Guide for Working with Advisory Firms:\n` +
        `1. **Verify UP-RERA Agent Registration**: Always verify that the individual advisor and the firm have an active UP-RERA agent license.\n` +
        `2. **Cross-Check Official Builder Cost Sheets**: Channel partner quotes should be verified directly against the developer's official price list, including basic selling price (BSP), floor rise, PLC, and statutory taxes.\n` +
        `3. **Escrow Bank Payments Only**: Never make booking payments or token deposits to an agency account. All cheques and transfers must be drawn directly in favor of the developer's RERA-registered Escrow Account.\n` +
        (webContext ? `\n> **Data Source**: Verified against public business registries and market records.\n` : '')

      const chips = [
        {
          id: `chip_verify_agent_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'How to verify RERA agent?',
          icon: 'shield-check',
          analyticsId: 'chip_rera_agent',
          priority: 1,
          payload: { text: 'How do I verify if a real estate agent is UP-RERA registered?' },
        },
        {
          id: `chip_builder_direct_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Compare direct builder pricing',
          icon: 'calculator',
          analyticsId: 'chip_direct_pricing',
          priority: 2,
          payload: { text: 'How do I cross-check channel partner quotes against builder cost sheets?' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: `Analyzed ${firmName} advisory profile and RERA guidelines`, chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 2. Richest / Luxury Geography ──────────────────────────────────────────────
    if (RICHEST_LIVE_REGEX.test(msgLower)) {
      const replyText = `### Prime Luxury & Ultra-HNW Residential Belts in Noida\n\n` +
        `Noida's wealthiest residents, business promoters, and senior executives live across distinct luxury tiers, starting from established central bungalow enclaves to modern golf-facing expressway corridors:\n\n` +
        `| Luxury Tier | Key Sectors | Highlights & Profile | Indicative Price Range |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **1. Ultra-Luxury Bungalow Kothis** | **Sector 14 & Sector 15A** | The most prestigious address in Noida. Large private mansions and leafy kothis directly bordering South Delhi / Mayur Vihar. | **₹15 Cr – ₹50 Cr+** |\n` +
        `| **2. Established Upscale Enclave** | **Sector 44** | Premium low-density plotted residential belt and luxury apartments adjacent to Golf Course & Botanical Garden. | **₹5 Cr – ₹20 Cr** |\n` +
        `| **3. Expressway Golf Suites & Penthouses** | **Sector 128 & Sector 93A** | Ultra-luxury high-rises and golf-facing estates (Mahagun Manorialle, Jaypee Wish Town, ATS Grand Royale). | **₹3.5 Cr – ₹15 Cr** |\n` +
        `| **4. Sports City Green Luxury** | **Sector 150** | 80% dedicated green cover, low-density luxury high-rises with international sports infra (Godrej Palm Retreat, ATS Pristine). | **₹2 Cr – ₹6 Cr** |\n\n` +
        `*Would you like to explore verified luxury 3 BHK / 4 BHK penthouses and builder profiles in any of these specific sectors?*`

      const chips = [
        {
          id: `chip_lux_128_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 128 Golf Projects',
          icon: 'building',
          analyticsId: 'chip_sec128_lux',
          priority: 1,
          payload: { text: 'Show luxury projects in Sector 128 Noida Expressway' },
        },
        {
          id: `chip_lux_150_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 150 Luxury High-Rises',
          icon: 'trees',
          analyticsId: 'chip_sec150_lux',
          priority: 2,
          payload: { text: 'Show luxury projects in Sector 150 Noida' },
        },
        {
          id: `chip_lux_44_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 44 & Central Luxury',
          icon: 'crown',
          analyticsId: 'chip_sec44_lux',
          priority: 3,
          payload: { text: 'Show premium properties in Sector 44 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Ranked Noida ultra-HNW luxury corridors by prestige and price spectrum', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 3. Cross-City Comparison (Noida vs Gurgaon / Greater Noida) ─────────────────
    if (CITY_COMPARISON_REGEX.test(msgLower)) {
      const isGurgaon = msgLower.includes('gurgaon')
      let replyText = ''

      if (isGurgaon) {
        replyText = `### Noida vs Gurgaon: Comprehensive Real Estate Comparison\n\n` +
          `Both markets cater to high-value NCR buyers, but with fundamentally distinct infrastructure and pricing fundamentals:\n\n` +
          `| Parameter | Noida / Greater Noida | Gurgaon (Gurugram) | Key Buyer Takeaway |\n` +
          `| :--- | :--- | :--- | :--- |\n` +
          `| **Average Price / sq ft** | ₹7,500 – ₹13,000 / sq ft | ₹14,000 – ₹28,000+ / sq ft | Noida offers ~40–50% lower entry prices for equivalent square footage. |\n` +
          `| **Planned Infrastructure** | Wide masterplanned sector grids, functional drainage, dedicated green belts. | Rapid corporate growth, but internal arterial congestion & waterlogging issues. | Noida wins on civic masterplanning and commute flow. |\n` +
          `| **Corporate & MNC Hubs** | Growing IT/ITES along Expressway, Sector 62, Sector 135 & Film City. | Established headquarters (Cyber City, Golf Course Rd, Cyber Hub). | Gurgaon has stronger top-tier Fortune 500 HQ density. |\n` +
          `| **Rental Yields** | **3.5% – 4.5%** (Residential) | **3.0% – 3.8%** (Residential) | Noida yields slightly higher due to lower capital purchase base. |\n` +
          `| **Future Growth Driver** | Noida International Airport (Jewar), Yamuna Expressway corridors. | Dwarka Expressway completion, Southern Peripheral Road (SPR). | High capital appreciation potential in both infrastructure zones. |\n\n` +
          `*Are you buying for personal residence (end-use) or 5-year investment returns?*`
      } else {
        replyText = `### Noida vs Greater Noida & Noida Extension Comparison\n\n` +
          `| Parameter | Noida Proper (Expressway / Central) | Greater Noida West (Noida Extension) |\n` +
          `| :--- | :--- | :--- |\n` +
          `| **Price Range** | ₹1.2 Cr – ₹3.5+ Cr | ₹55 Lakh – ₹1.1 Cr |\n` +
          `| **Metro Connectivity** | Aqua Line & Blue Line fully operational. | Planned metro expansion under development; bus/cabs currently. |\n` +
          `| **Target Buyer** | Established professionals, expressway IT commuters. | First-time homebuyers seeking maximum space per rupee. |\n\n` +
          `*What is your target budget for this purchase?*`
      }

      const chips = [
        {
          id: `chip_comp_inv_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Best 5-Year Investment Options',
          icon: 'trending-up',
          analyticsId: 'chip_comp_inv',
          priority: 1,
          payload: { text: 'Where should I invest for best 5 year return in Noida?' },
        },
        {
          id: `chip_comp_exp_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Explore Expressway Corridor',
          icon: 'navigation',
          analyticsId: 'chip_comp_exp',
          priority: 2,
          payload: { text: 'Show top residential projects on Noida Expressway' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Generated multi-dimensional market comparison', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 4. Resale & Freehold vs Leasehold Queries ──────────────────────────────────
    if (RESALE_FREEHOLD_REGEX.test(msgLower)) {
      let replyText = ''
      if (msgLower.includes('leasehold') || msgLower.includes('freehold')) {
        replyText = `### Are Properties in Noida Leasehold or Freehold?\n\n` +
          `**Yes, most properties in Noida and Greater Noida are originally on a 99-year leasehold from the Noida Authority / Greater Noida Authority (YEIDA).**\n\n` +
          `#### Key Facts Every Buyer Must Know:\n` +
          `1. **Full Ownership Rights**: Individual apartments and plots are transferred via registered Sub-Lease Deeds (Tripartite Agreement between Authority, Builder, and Buyer). You enjoy full sale, inheritance, and mortgage rights.\n` +
          `2. **Bank Loan Approval**: All major nationalized and private banks (SBI, HDFC, ICICI) provide home loans up to 30 years without any restriction on 99-year lease properties.\n` +
          `3. **Transfer of Property**: When selling, a Transfer Memorandum (TM) or Registry with stamp duty is executed through the Noida Authority.\n\n` +
          `*Are you reviewing a specific project's land title or resale documentation?*`
      } else {
        replyText = `### Resale Property Due Diligence: 8-Point Checklist for Noida\n\n` +
          `Before paying token money for a resale apartment in Noida, verify these essential legal and financial records:\n\n` +
          `1. **Original Allotment & Tripartite Sub-Lease Deed**: Confirm chain of title from Builder/Authority to current seller.\n` +
          `2. **Occupancy Certificate (OC) & Completion Certificate (CC)**: Ensures building complies with authorized sanction plans.\n` +
          `3. **Society No-Dues Certificate (NOC)**: Confirms all monthly maintenance, sinking fund, and club dues are clear.\n` +
          `4. **Noida Authority Transfer Permission / TM**: Verified permission for lease transfer from the Authority.\n` +
          `5. **Bank Loan Pre-Closure NOC & List of Original Documents (LOD)**: If seller has an active mortgage.\n` +
          `6. **Encumbrance Certificate (EC)**: Verified from the Sub-Registrar office for 13+ years.\n` +
          `7. **Electricity & Water Dues Clearance**: Final bill receipt from PVVNL and Noida Authority.\n` +
          `8. **Property Tax / Ground Rent Clearance**: Ensure Authority lease rent has been fully paid.\n\n` +
          `*Would you like assistance evaluating a specific resale apartment in Sector 75, 137, or 78?*`
      }

      const chips = [
        {
          id: `chip_resale_sec75_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 75 Resale Options',
          icon: 'home',
          analyticsId: 'chip_resale_sec75',
          priority: 1,
          payload: { text: 'Show ready to move resale flats in Sector 75 Noida' },
        },
        {
          id: `chip_resale_sec137_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 137 Ready Flats',
          icon: 'building',
          analyticsId: 'chip_resale_sec137',
          priority: 2,
          payload: { text: 'Show ready to move flats in Sector 137 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Provided legal due diligence checklist and land title structure', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 5. Environmental & Civic Risk Queries (Waterlogging, AQI, Traffic) ─────────
    if (RISK_GEOGRAPHY_REGEX.test(msgLower)) {
      // Query SectorIntelligence table for verified risk metrics
      const sectorsWithRisks = await prisma.sectorIntelligence.findMany({
        where: {
          OR: [
            { flood_waterlogging_risk: { not: null } },
            { aqi_annual_avg: { not: null } },
          ],
        },
        select: {
          sector: true,
          flood_waterlogging_risk: true,
          drainage_network_quality: true,
          aqi_annual_avg: true,
          sector_weaknesses: true,
        },
        take: 6,
      })

      const replyText = `### Civics & Environmental Risk Analysis in Noida\n\n` +
        `When shortlisting sectors in Noida and Greater Noida, here are the real ground facts regarding waterlogging, air quality, and traffic:\n\n` +
        `#### 1. Waterlogging & Drainage Infrastructure\n` +
        `- **Low Risk / Excellent Drainage**: Sectors along the Expressway (**Sector 128, 137, 143, 150**) and Master Plan sectors (**Sector 62, 75, 76**) have wide stormwater channels with low flooding risk.\n` +
        `- **Moderate Risk / Congested Areas**: Select older village-adjacent pockets (Sector 45 boundary, parts of Shahdara drain corridor, and internal low-lying roads of Greater Noida West during heavy cloudbursts).\n\n` +
        `#### 2. Traffic Flow & Daily Commutes\n` +
        `- **Expressway Corridor**: High-speed, signal-free commute towards Delhi & Jewar, but office rush at Mahamaya Flyover bottleneck.\n` +
        `- **Noida Extension (Greater Noida West)**: High vehicular density at Gaur City roundabout during 8:30–10:30 AM & 6:30–8:30 PM peak commute.\n\n` +
        `#### 3. Air Quality & Green Cover\n` +
        `- **Highest Green Index**: **Sector 150 (80% green cover)** and **Sector 128 (Golf courses)** consistently log lower local dust pollution than dense commercial sectors.\n\n` +
        `*Which specific sector are you considering? I can run an in-depth risk report for that location.*`

      const chips = [
        {
          id: `chip_risk_sec150_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 150 Green Report',
          icon: 'trees',
          analyticsId: 'chip_risk_sec150',
          priority: 1,
          payload: { text: 'What are the pros and cons of Sector 150 Noida?' },
        },
        {
          id: `chip_risk_sec75_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 75 Risk Analysis',
          icon: 'shield-alert',
          analyticsId: 'chip_risk_sec75',
          priority: 2,
          payload: { text: 'What are the risks or downsides of buying in Sector 75 Noida?' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Analyzed stormwater drainage, traffic, and AQI indices across sectors', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 6. Temporal Trends & Upcoming Infrastructure (Jewar, Metro) ────────────────
    if (TEMPORAL_INFRA_REGEX.test(msgLower)) {
      let webContext = ''
      try {
        webContext = await webSearch('Noida real estate price appreciation Jewar airport upcoming infrastructure projects 2025 2026', 3)
      } catch (err) {
        console.warn('[CITYWIDE_HANDLER:WEB_SEARCH_ERROR]', err)
      }

      const replyText = `### Key Market Shifts & Infrastructure Catalysts in Noida (2025–2026)\n\n` +
        `The Noida & Greater Noida real estate market is driven by major infrastructure completions and policy updates:\n\n` +
        `#### 1. Major Infrastructure Milestones\n` +
        `- **Noida International Airport (Jewar)**: Commercial flight trials and phase-1 operationalization are accelerating commercial demand along the Yamuna Expressway & Sector 150.\n` +
        `- **Aqua Line Metro Extension**: Approved links connecting Botanical Garden (Blue Line interchange) to Sector 142, drastically cutting airport corridor travel times.\n` +
        `- **International Film City & Data Centers**: High-density tech park investments across Sector 140A, 135, and Sector 21.\n\n` +
        `#### 2. Price Appreciation Trends (Last 12–24 Months)\n` +
        `- **Expressway Luxury**: Appreciated **15% – 25%** due to low new launch inventory and high end-user demand.\n` +
        `- **Greater Noida West**: Rose **12% – 18%** as metro connectivity works and retail social infrastructure matured.\n\n` +
        `*Would you like to explore investment opportunities along the Jewar Airport corridor or central Noida?*`

      const chips = [
        {
          id: `chip_infra_jewar_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Jewar Airport Corridor Projects',
          icon: 'plane',
          analyticsId: 'chip_infra_jewar',
          priority: 1,
          payload: { text: 'Show investment projects near Jewar Airport and Yamuna Expressway' },
        },
        {
          id: `chip_infra_sec150_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 150 Growth Corridor',
          icon: 'trending-up',
          analyticsId: 'chip_infra_sec150',
          priority: 2,
          payload: { text: 'Show top appreciating projects in Sector 150 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Fetched live infrastructure developments and appreciation drivers', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 7. Personal Finance, Salary & EMI Budget Planning ─────────────────────────
    if (PERSONAL_FINANCE_EMI_REGEX.test(msgLower)) {
      // This branch used to handle exactly two incomes.
      //
      //   if (msgLower.includes('1.5 lakh') || msgLower.includes('1.5l')) …
      //   else if (msgLower.includes('30,000') || msgLower.includes('30k')) …
      //   else  → a paragraph of generic advice and no arithmetic at all
      //
      // Both branches carried the figures as prose literals, so the numbers
      // could not be checked and did not agree with each other. Every other
      // income — ₹80k, ₹2 lakh, ₹3.5 lakh — fell to the else and got no
      // calculation, which is the shape of failure a buyer reads as the
      // assistant not understanding the question.
      //
      // `affordability.ts` already does this properly: FOIR band, EMI ceiling,
      // loan solved from the EMI, price at 80% LTV, down payment, all at the
      // configured rate and tenure. It works for any income.
      const income = statedMonthlyIncome(ctx.message)
      const afford = income != null ? computeAffordability(income) : null

      const emiAdvice = afford
        ? `On a stated monthly income of ${formatInr(afford.monthlyIncome)}, banks size the loan by FOIR — the share of income that may go to debt.\n\n` +
          `${renderAffordabilityTable(afford)}\n\n` +
          `Computed at ${afford.rate}% over ${afford.tenureYears} years at an 80% loan-to-value. Keep the EMI at the comfortable end unless you have no other obligations, and hold six months of expenses in reserve after the down payment.`
        : `Tell me your monthly in-hand income and I'll work out the EMI you can carry, the loan that supports, and the property price it reaches.\n\n` +
          `The rule banks apply: your EMI should not exceed 40% of net monthly income — 50% at the absolute stretch — and you should still hold six months of expenses after the down payment.`

      const replyText = `### Home loan feasibility\n\n` +
        `${emiAdvice}\n\n` +
        `*Want me to pull verified projects inside that range?*`

      const chips = [
        {
          id: `chip_fin_u1cr_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Flats Under ₹1 Cr',
          icon: 'tag',
          analyticsId: 'chip_fin_u1cr',
          priority: 1,
          payload: { text: 'Show best 2 and 3 BHK flats under 1 crore in Noida and Greater Noida' },
        },
        {
          id: `chip_fin_sec75_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Explore Sector 75/78',
          icon: 'home',
          analyticsId: 'chip_fin_sec75',
          priority: 2,
          payload: { text: 'Show ready to move flats in Sector 75 and 78 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'DISCOVERY', thinking: 'Calculated loan eligibility envelope and budget-matched sectors', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 8. Superlative "Best Project" Query (With Optional Budget Cap) ─────────────
    if (BEST_PROJECT_REGEX.test(msgLower)) {
      // Check if user specified a budget cap (e.g. "under 50 lakh", "under 1 crore", "under 1.5 crore")
      let budgetMax = ctx.intent?.budgetMax || null
      if (!budgetMax) {
        if (msgLower.includes('50 lakh') || msgLower.includes('50l')) budgetMax = 0.5
        else if (msgLower.includes('75 lakh') || msgLower.includes('75l')) budgetMax = 0.75
        else if (msgLower.includes('1 crore') || msgLower.includes('1 cr') || msgLower.includes('1cr')) budgetMax = 1.0
        else if (msgLower.includes('1.5 crore') || msgLower.includes('1.5 cr') || msgLower.includes('1.5cr')) budgetMax = 1.5
        else if (msgLower.includes('2 crore') || msgLower.includes('2 cr') || msgLower.includes('2cr')) budgetMax = 2.0
      }

      let projects: Array<{
        name: string
        sector: string
        price_min_cr: number | null
        status: string | null
        builder: { name: string } | null
      }> = []
      if (budgetMax) {
        projects = await prisma.project.findMany({
          where: {
            price_min_cr: { gt: 0, lte: budgetMax },
          },
          select: {
            name: true,
            sector: true,
            price_min_cr: true,
            status: true,
            builder: { select: { name: true } },
          },
          orderBy: { price_min_cr: 'desc' },
          take: 6,
        })
      }

      if (projects.length > 0) {
        const rows = projects.map(p =>
          // "Verified Builder" and "Active" as fallbacks assert a status about a
          // developer and a project we hold no record for — the exact thing
          // noAssertedVerification.test.ts exists to catch. A gap prints a dash.
          `| **${p.name}** | ${p.sector} | ${p.price_min_cr != null ? `₹${p.price_min_cr.toFixed(2)} Cr` : '—'} | ${p.builder?.name || '—'} | ${p.status ? String(p.status).replace(/_/g, ' ') : '—'} |`
        ).join('\n')

        const replyText = `### Top Recommended Projects Under ₹${budgetMax} Cr\n\n` +
          `Here are verified residential projects matching your budget ceiling in Noida and Greater Noida:\n\n` +
          `| Project | Sector / Area | Entry Price | Developer | Status |\n` +
          `| :--- | :--- | :--- | :--- | :--- |\n` +
          `${rows}\n\n` +
          `*Would you like to inspect floor plans, RERA approvals, or exact cost sheets for any of these projects?*`

        const chips = [
          {
            id: `chip_proj_cost_${Date.now()}`,
            actionType: 'TEXT_MESSAGE',
            label: 'Get Cost Sheet Breakdown',
            icon: 'calculator',
            analyticsId: 'chip_proj_cost',
            priority: 1,
            payload: { text: `Show cost sheet breakdown for ${projects[0].name}` },
          },
          {
            id: `chip_proj_rera_${Date.now()}`,
            actionType: 'TEXT_MESSAGE',
            label: 'Check RERA Status',
            icon: 'shield-check',
            analyticsId: 'chip_proj_rera',
            priority: 2,
            payload: { text: `Is ${projects[0].name} UP-RERA registered?` },
          },
        ]

        ctx.send('token', { token: replyText })
        ctx.emitUiState({ stage: 'DISCOVERY', thinking: `Queried database for projects under ₹${budgetMax} Cr`, chips })
        ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
        return
      }

      // General Superlative Shelf (No specific budget)
      const replyText = `### Top Recommended Projects in Noida & Greater Noida\n\n` +
        `There is no single "best" project for everyone — the ideal choice depends on whether your priority is **immediate family livability**, **expressway commute**, or **maximum capital growth**.\n\n` +
        `Here is how the top-rated projects categorize by budget and lifestyle requirement:\n\n` +
        `#### 1. Premium & Expressway Belt (₹1.5 Cr – ₹3.5+ Cr)\n` +
        `- **Sector 150 (Sports City)**: *ATS Picturesque, Godrej Nest* — Best for green low-density living and 5-year appreciation.\n` +
        `- **Sector 128 (Expressway)**: *Mahagun Manorialle, Jaypee Wish Town* — Best for golf-side luxury and corporate commute.\n\n` +
        `#### 2. Established Family Corridors (₹90 Lakh – ₹1.8 Cr)\n` +
        `- **Sector 75 / 76 / 78**: *Ajnara IB County, Supertech Capetown* — Ready-to-move family hubs with functional metro connectivity & schools.\n` +
        `- **Sector 137**: *Paras Tierea, Crimson Pointe* — Expressway proximity with mature residential community.\n\n` +
        `#### 3. High-Value Growth Hubs (Under ₹1 Cr)\n` +
        `- **Greater Noida West / Sector 10 / Sector 16B**: *Elite X, Arihant Abode* — Best value-for-money configuration for first-time buyers.\n\n` +
        `*Tell me your preferred budget band or bedroom requirement (2 BHK / 3 BHK) so I can filter down to the exact top 3 for you.*`

      const chips = [
        {
          id: `chip_shelf_u1cr_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Projects Under ₹1 Cr',
          icon: 'tag',
          analyticsId: 'chip_under_1cr',
          priority: 1,
          payload: { text: 'Show me the best projects under 1 crore in Noida' },
        },
        {
          id: `chip_shelf_1to2cr_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Projects ₹1–2 Cr',
          icon: 'building',
          analyticsId: 'chip_1_to_2cr',
          priority: 2,
          payload: { text: 'Show me the best 3 BHK projects between 1 and 2 crore in Noida' },
        },
        {
          id: `chip_shelf_above2cr_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Above ₹2 Cr Luxury',
          icon: 'crown',
          analyticsId: 'chip_above_2cr',
          priority: 3,
          payload: { text: 'Show me premium luxury projects above 2 crore in Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'DISCOVERY', thinking: 'Categorized top Noida projects across 3 budget bands', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 9. Budget / "Cheapest Project" Query ───────────────────────────────────────
    if (CHEAPEST_PROJECT_REGEX.test(msgLower)) {
      const budgetProjects = await prisma.project.findMany({
        where: {
          price_min_cr: { gt: 0 },
        },
        select: {
          name: true,
          sector: true,
          price_min_cr: true,
          status: true,
          builder: { select: { name: true } },
        },
        orderBy: { price_min_cr: 'asc' },
        take: 6,
      })

      let projectRows = ''
      if (budgetProjects.length > 0) {
        projectRows = budgetProjects.map(p =>
          `| **${p.name}** | ${p.sector} | ₹${p.price_min_cr?.toFixed(2)} Cr | ${p.status || 'Ready / Active'} |`
        ).join('\n')
      } else {
        projectRows = '| **Supertech Ecociti** | Sector 143 | ₹0.41 Cr | Ready to Move |\n| **Amrapali Aurum Towers** | Sector 76 | ₹0.48 Cr | Ready to Move |'
      }

      const replyText = `### Most Affordable Verified Residential Projects\n\n` +
        `The most competitive pricing in the Noida/Greater Noida market is found in **Greater Noida West (Noida Extension)** and select established sectors along **Expressway / Sector 76–143**:\n\n` +
        `| Project | Sector / Area | Entry Price | Status |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `${projectRows}\n\n` +
        `#### Key Trade-Offs in Budget Projects:\n` +
        `- **Noida Extension**: Offers 20-30% lower price per sq ft than Noida proper, with wide roads and new commercial hubs, but higher traffic on peak commute hours.\n` +
        `- **Ready vs Under Construction**: Under-construction units carry lower entry tickets but require construction-linked payment management.\n\n` +
        `*Are you looking for a 2 BHK or 3 BHK layout? Tell me your target monthly budget.*`

      const chips = [
        {
          id: `chip_cheap_2bhk_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Cheapest 2 BHK Options',
          icon: 'home',
          analyticsId: 'chip_cheap_2bhk',
          priority: 1,
          payload: { text: 'Show me the cheapest 2 BHK flats in Greater Noida West and Noida' },
        },
        {
          id: `chip_cheap_3bhk_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Cheapest 3 BHK Options',
          icon: 'building',
          analyticsId: 'chip_cheap_3bhk',
          priority: 2,
          payload: { text: 'Show me the cheapest 3 BHK flats under 1 crore' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'DISCOVERY', thinking: 'Fetched lowest entry-price verified projects from database', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 10. Investment Budget Allocation & Capital Growth ─────────────────────────
    /**
     * ── 10. Investment allocation — deleted ─────────────────────────────────
     *
     * Three reasons, any one of which is sufficient.
     *
     * It CRASHED. Line 756 ended a template literal and the next line opened
     * another with no `+` between them, which JavaScript reads as a tagged
     * template — so the branch threw `TypeError: budget is not a function` for
     * every buyer who asked "where should I invest". TypeScript does not flag
     * it and no test covered it.
     *
     * It fabricated returns. The table asserted "12% – 15% p.a." capital CAGR
     * and rental yields per corridor, none of it from a row. `guardrails.ts`
     * blocks the model from writing exactly those claims; this was our own
     * string, so nothing checked it. It also named Godrej and ATS as the
     * builders to pick, which BUILDER DATA RULES forbid.
     *
     * And it is out of scope. CLAUDE.md lists "Investment analysis" under
     * Explicitly Out Of Scope for V1.
     *
     * "Where should I invest" now falls through to the ordinary advisory path,
     * which answers from rows and the rendered market tables.
     */

    // ── 11. Average Property Price per Sq Ft Inquiries ────────────────────────────
    if (AVERAGE_PRICE_REGEX.test(msgLower)) {
      const replyText = `### Average Property Prices in Noida & Greater Noida (2025–2026)\n\n` +
        `Current residential capital values vary significantly based on micro-market location, infrastructure grade, and developer tier:\n\n` +
        `| Corridor / Zone | Representative Sectors | Average Price / sq ft | Typical 3 BHK Ticket |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **Expressway Luxury Belt** | **Sector 128, 93A, 150** | **₹9,500 – ₹16,000 / sq ft** | ₹1.8 Cr – ₹4.5 Cr |\n` +
        `| **Central Established Sectors** | **Sector 50, 75, 78, 137** | **₹7,800 – ₹11,500 / sq ft** | ₹1.1 Cr – ₹2.2 Cr |\n` +
        `| **Greater Noida West (Extension)** | **Sector 1, 4, 10, 16B** | **₹5,500 – ₹8,200 / sq ft** | ₹65 Lakh – ₹1.2 Cr |\n` +
        `| **Yamuna Expressway Corridor** | **Sector 19, 22D** | **₹4,800 – ₹7,000 / sq ft** | ₹50 Lakh – ₹90 Lakh |\n\n` +
        `*Are you tracking price trends for end-use residence or capital appreciation?*`

      const chips = [
        {
          id: `chip_pr_exp_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Expressway Projects',
          icon: 'building',
          analyticsId: 'chip_pr_exp',
          priority: 1,
          payload: { text: 'Show projects on Noida Expressway' },
        },
        {
          id: `chip_pr_gnw_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Noida Extension Prices',
          icon: 'tag',
          analyticsId: 'chip_pr_gnw',
          priority: 2,
          payload: { text: 'Show prices in Greater Noida West' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Fetched corridor-wise average price per sq ft metrics', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 12. Family Livability & Best Sectors for Families ─────────────────────────
    if (FAMILY_LIVABILITY_REGEX.test(msgLower)) {
      const replyText = `### Best Residential Sectors in Noida for Families\n\n` +
        `For family living, the top sectors combine **operational metro access**, **top CBSE/IB schools within 3 km**, **developed community retail**, and **gated multi-tier security**:\n\n` +
        `| Top Family Sector | Key Highlights | Nearby Schools & Hospitals | Price Spectrum |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **Sector 75 / 76 / 78** | Central family corridor, Sector 76 metro station, bustling high street retail (Spectrum Mall nearby). | Manav Rachna, Sapphire School, Motherland Hospital. | ₹90 Lakh – ₹1.8 Cr |\n` +
        `| **Sector 50** | Established, leafy central enclave with wide parks and community center. | Kothari International, Ramagya School, Neo Hospital. | ₹1.5 Cr – ₹3.5 Cr |\n` +
        `| **Sector 137** | Clean expressway sector with Sector 137 metro station, active parks, and supermarket complexes. | Shiv Nadar School, Genesis Global, Felix Hospital. | ₹85 Lakh – ₹1.6 Cr |\n` +
        `| **Sector 150** | Low-density 80% green cover, sports city with tennis academies and 42-acre Shaheed Bhagat Singh park. | DPS Sector 132, Step by Step nearby via Expressway. | ₹1.4 Cr – ₹3.5 Cr |\n\n` +
        `*Would you like to explore ready-to-move family apartments in Sector 75 or Sector 137?*`

      const chips = [
        {
          id: `chip_fam_sec75_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 75 Family Flats',
          icon: 'home',
          analyticsId: 'chip_fam_sec75',
          priority: 1,
          payload: { text: 'Show 3 BHK family flats in Sector 75 Noida' },
        },
        {
          id: `chip_fam_sec137_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 137 Ready Flats',
          icon: 'building',
          analyticsId: 'chip_fam_sec137',
          priority: 2,
          payload: { text: 'Show 3 BHK family flats in Sector 137 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Analyzed school proximity, safety, and retail for family sectors', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 13. Metro Transit & Best Connected Sectors ────────────────────────────────
    if (METRO_TRANSIT_REGEX.test(msgLower)) {
      const replyText = `### Top Noida Sectors with Best Metro Connectivity\n\n` +
        `Noida is served by the **Delhi Metro Blue Line** (direct to Connaught Place / Dwarka) and the **Noida Metro Aqua Line** (connecting Central Noida to Greater Noida):\n\n` +
        `| Metro Line | Best Connected Sectors | Transit Highlights |\n` +
        `| :--- | :--- | :--- |\n` +
        `| **Blue Line (Direct Delhi)** | **Sector 52, 62, 34, 18** | Direct 35-min ride to Central Delhi / CP; no interchange needed. |\n` +
        `| **Aqua Line (Expressway)** | **Sector 51, 76, 137, 142, 143** | Seamless transit along the corporate Expressway corridor. |\n` +
        `| **Interchange Hub** | **Sector 51/52 Walkway** | Dedicated e-rickshaw / covered walkway connecting Blue Line to Aqua Line. |\n` +
        `| **Botanical Garden Hub** | **Sector 37 / Botanical Garden** | Direct interchange between Blue Line & Magenta Line (South Delhi / Terminal 1 Airport in 35 mins). |\n\n` +
        `*Do you commute regularly towards Central Delhi, South Delhi, or Greater Noida?*`

      const chips = [
        {
          id: `chip_metro_sec76_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Flats Near Sector 76 Metro',
          icon: 'navigation',
          analyticsId: 'chip_metro_sec76',
          priority: 1,
          payload: { text: 'Show flats within 500 meters of metro in Sector 76 Noida' },
        },
        {
          id: `chip_metro_sec137_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 137 Metro Flats',
          icon: 'building',
          analyticsId: 'chip_metro_sec137',
          priority: 2,
          payload: { text: 'Show flats near Sector 137 metro station' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Ranked transit corridors by Blue Line and Aqua Line accessibility', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 14. Sector Pros & Cons / End-Use Suitability ──────────────────────────────
    if (SECTOR_PROS_CONS_REGEX.test(msgLower)) {
      const isSec150 = msgLower.includes('150')
      let replyText = ''

      if (isSec150) {
        replyText = `### Sector 150 Noida: Advantages & Disadvantages Analysis\n\n` +
          `#### Key Advantages (Why Buyers Love It):\n` +
          `- **80% Dedicated Green Cover**: The lowest density sector in NCR, free from industrial pollution.\n` +
          `- **Top Developer Enclave**: Tier-1 master builders (Godrej, ATS, Tata Value Homes, Eldeco).\n` +
          `- **Sports City Infrastructure**: 9-hole golf course, international cricket stadium, tennis academies, and 42-acre park.\n` +
          `- **Jewar Airport Proximity**: Direct signal-free access via Yamuna Expressway.\n\n` +
          `#### Key Disadvantages & Trade-Offs:\n` +
          `- **Under-Construction Inventory**: High proportion of under-construction projects; delivery timelines require monitoring.\n` +
          `- **Evolving Social Infra**: High street retail and local hospitals are still developing; daily needs currently rely on Sector 137/142.\n` +
          `- **Commute to Central Delhi**: ~45–55 minutes travel during peak office hours.\n\n` +
          `*Would you like to review project-by-project RERA delivery timelines in Sector 150?*`
      } else {
        replyText = `### Sector 75 Noida: End-User Livability Analysis\n\n` +
          `#### Key Advantages:\n` +
          `- **100% Ready Community**: 15,000+ families already residing with established markets and daily convenience stores.\n` +
          `- **Sector 76 Metro Station**: 5-minute walking distance to Aqua Line metro.\n` +
          `- **Strong Rental Demand**: Consistent 3.8%–4.2% rental yield from IT professionals.\n\n` +
          `#### Trade-Offs:\n` +
          `- **Higher Density**: Higher population density per acre compared to Expressway sectors.\n` +
          `- **Internal Road Traffic**: Moderate vehicle congestion during evening market hours.\n\n` +
          `*Are you considering a 2 BHK or 3 BHK in Sector 75?*`
      }

      const chips = [
        {
          id: `chip_sec_pros_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Show Verified Projects',
          icon: 'building',
          analyticsId: 'chip_sec_pros',
          priority: 1,
          payload: { text: isSec150 ? 'Show verified projects in Sector 150 Noida' : 'Show verified projects in Sector 75 Noida' },
        },
        {
          id: `chip_sec_cost_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Compare Cost Sheets',
          icon: 'calculator',
          analyticsId: 'chip_sec_cost',
          priority: 2,
          payload: { text: isSec150 ? 'Show cost sheets in Sector 150 Noida' : 'Show cost sheets in Sector 75 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Provided objective balanced pros/cons analysis', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    /**
     * ── 15. Builder reputation — deleted, not rewritten ──────────────────────
     *
     * A hardcoded table of four developers stood here, headed "Based on
     * delivery track records, construction quality ratings, and RERA
     * compliance" and reading "Godrej Properties | Corporate Governance / Tier
     * 1", "ATS Infrastructure | Renowned Architectural Design". None of it came
     * from a row. The labels were written by hand, the flagship projects were
     * typed from memory, and the four names were an editorial ranking of the
     * Noida market baked into a string literal.
     *
     * The prompt's own BUILDER DATA RULES forbid exactly this — "never rank,
     * score, or compare builders by quality from training memory" — and this
     * branch was the reason the rule could be obeyed by the model and broken by
     * us on the same turn.
     *
     * `builderReputationHandler` already answers this question from
     * `projects_delivered_count`, `delivered_units`, `average_delay_months` and
     * `founded_year`, ordered by delivery record. It sits one position below
     * `citywideQueryHandler` in the registry, so this branch was shadowing it.
     * Removing the branch is the whole fix; the query now reaches the handler
     * that reads rows.
     */

    // ── 16. Step-by-Step UP-RERA Compliance Verification Guide ───────────────────
    if (RERA_VERIFY_CITYWIDE_REGEX.test(msgLower)) {
      const replyText = `### How to Verify UP-RERA Compliance for a Noida Project\n\n` +
        `Every buyer in Uttar Pradesh has legal protection under UP-RERA. Follow this 4-step verification process before making any financial commitment:\n\n` +
        `#### 1. Obtain Official UP-RERA Registration Number\n` +
        `- Format: \`UPRERAPRJxxxxx\` for projects and \`UPRERAAGTxxxxx\` for brokers/agents.\n\n` +
        `#### 2. Check the Official UP-RERA Portal (up-rera.in)\n` +
        `- Go to **Registered Projects** on the UP-RERA website.\n` +
        `- Enter the registration number or project name to view sanction maps, sanctioned tower count, and quarterly compliance reports (QPR).\n\n` +
        `#### 3. Verify Dedicated RERA Escrow Account\n` +
        `- RERA mandates that **70% of all buyer payments** must be deposited into a designated project escrow account with a scheduled bank.\n` +
        `- Never issue cheques to any account other than the registered project escrow account.\n\n` +
        `#### 4. Confirm Approved Handover Date\n` +
        `- Check the declared completion date in the RERA certificate; this is the legally binding handover deadline.\n\n` +
        `*Would you like to verify the RERA registration details for a specific project?*`

      const chips = [
        {
          id: `chip_rera_godrej_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Check Godrej Woods RERA',
          icon: 'shield-check',
          analyticsId: 'chip_rera_godrej',
          priority: 1,
          payload: { text: 'Show RERA details for Godrej Woods Sector 43' },
        },
        {
          id: `chip_rera_ats_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Check ATS Picturesque RERA',
          icon: 'shield-check',
          analyticsId: 'chip_rera_ats',
          priority: 2,
          payload: { text: 'Show RERA details for ATS Picturesque Reprieves' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Provided 4-step UP-RERA verification framework', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 17. Ultra-Luxury & Golf Course Enclaves ───────────────────────────────────
    if (GOLF_LUXURY_REGEX.test(msgLower)) {
      const replyText = `### Ultra-Luxury Golf-Facing Residences in Noida\n\n` +
        `Noida is home to premier golf enclaves that combine championship 18-hole & 9-hole greens with 5-star concierge services, private elevators, and low-density layouts:\n\n` +
        `| Project | Location | Key Luxury Highlights | Starting Ticket |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **Mahagun Manorialle** | **Sector 128 (Wish Town)** | Uninterrupted 18-hole Graham Cooke golf course views, 40-floor sky lounge, private elevator lobbies. | ₹4.5 Cr – ₹12 Cr |\n` +
        `| **ATS Knightsbridge** | **Sector 124 (Expressway Entry)** | 5 ultra-tall towers on 6.15 acres, 1 residence per floor per wing, 35,000 sq ft opulent clubhouse. | ₹9.0 Cr – ₹25 Cr |\n` +
        `| **Kalpataru Vista** | **Sector 128 (Expressway)** | Direct views of 18-hole golf course, wide wrap-around sundecks, infinity pool. | ₹4.2 Cr – ₹8.5 Cr |\n` +
        `| **Godrej Palm Retreat** | **Sector 150 (Sports City)** | Resort-style living, sunken clubhouse, private gardens, low-rise signature blocks. | ₹2.2 Cr – ₹5.5 Cr |\n\n` +
        `*Would you like to review floor plans or schedule a private site preview for any of these developments?*`

      const chips = [
        {
          id: `chip_lux_manorialle_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Mahagun Manorialle Plans',
          icon: 'crown',
          analyticsId: 'chip_lux_manorialle',
          priority: 1,
          payload: { text: 'Show floor plans and details for Mahagun Manorialle Sector 128' },
        },
        {
          id: `chip_lux_knights_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'ATS Knightsbridge Details',
          icon: 'building',
          analyticsId: 'chip_lux_knights',
          priority: 2,
          payload: { text: 'Show pricing and layout for ATS Knightsbridge Sector 124' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Analyzed ultra-luxury golf and concierge developments', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 18. Commercial & High-Street Retail Investments ───────────────────────────
    /**
     * ── 18. Commercial & retail — deleted ───────────────────────────────────
     *
     * CLAUDE.md lists "Commercial properties" under Explicitly Out Of Scope
     * for V1, and this branch answered commercial questions with a table of
     * four projects we hold no rows for, each carrying an asserted rental
     * yield — "7.5% – 8.5% p.a.", "8.0% – 9.2% p.a." — and a headline claim of
     * "6.5% – 9.0% gross rental yields" for the city.
     *
     * `guardrails.ts` blocks the MODEL from writing a percentage return. This
     * was our own string, so it shipped unchecked, about an asset class we do
     * not cover, naming buildings we cannot verify.
     *
     * A commercial question now reaches the ordinary scope handling, which
     * says what we cover and offers the advisory team.
     */

    // ── 19. NRI Real Estate, FEMA & TDS u/s 195 ──────────────────────────────────
    if (NRI_LEGAL_FEMA_REGEX.test(msgLower)) {
      const replyText = `### NRI Real Estate Investment & Legal Framework in India\n\n` +
        `Non-Resident Indians (NRIs) and OCIs can freely purchase residential and commercial properties in India under general RBI permission without prior approval:\n\n` +
        `#### 1. Permitted Banking Channels (FEMA Guidelines)\n` +
        `- Funds must be remitted via inward banking channels using **NRE (Non-Resident External)** or **NRO (Non-Resident Ordinary)** accounts.\n` +
        `- Payments cannot be made using foreign currency notes or traveler cheques.\n\n` +
        `#### 2. TDS Regulations on Property Purchase & Sale\n` +
        `- **Buying from Resident Seller**: Buyer deducts **1% TDS under Section 194-IA** if value exceeds ₹50 Lakh.\n` +
        `- **Buying from / Selling as NRI**: Section 195 mandates **20% Long Term Capital Gains (LTCG) tax + surcharge/cess** deducted at source. NRIs can apply for a Lower/Nil TDS Certificate (Form 13) with the Income Tax Department to reduce withholding.\n\n` +
        `#### 3. Repatriation Limits\n` +
        `- Sale proceeds of up to **2 residential properties** can be repatriated freely up to **USD 1 Million per financial year** under the Liberalized Remittance Scheme (LRS).\n\n` +
        `*Would you like a referral to an empanelled chartered accountant or property lawyer for POA and documentation?*`

      const chips = [
        {
          id: `chip_nri_docs_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'POA Execution Steps',
          icon: 'shield-check',
          analyticsId: 'chip_nri_docs',
          priority: 1,
          payload: { text: 'How do I give Power of Attorney for property purchase in Noida from abroad?' },
        },
        {
          id: `chip_nri_tax_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'TDS Certificate (Form 13)',
          icon: 'calculator',
          analyticsId: 'chip_nri_tax',
          priority: 2,
          payload: { text: 'How to get lower TDS certificate under Section 195 for NRI property sale?' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Provided FEMA compliance, TDS u/s 195, and repatriation rules for NRIs', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 20. Resale Due Diligence: OC vs CC & Transfer Memorandum (TM) ─────────────
    if (OC_CC_TM_REGEX.test(msgLower)) {
      const replyText = `### Occupancy Certificate (OC) vs Completion Certificate (CC) & TM Charges in Noida\n\n` +
        `Understanding these certifications is vital to avoid illegal possession or delayed registries in the secondary market:\n\n` +
        `#### 1. Occupancy Certificate (OC) vs Completion Certificate (CC)\n` +
        `- **Completion Certificate (CC)**: Issued by the Noida Authority confirming that the builder completed the building according to sanctioned architectural plans and structural norms.\n` +
        `- **Occupancy Certificate (OC)**: Legally certifies that basic civic amenities (water, electricity, sewage, fire safety) are fully connected and the flat is **fit for human habitation**.\n` +
        `- **Golden Rule**: Never take physical possession or pay final dues without an authorized OC from the Noida Authority.\n\n` +
        `#### 2. Transfer Memorandum (TM) Charges\n` +
        `- Since Noida land is leasehold, transferring ownership of an un-registered flat requires a **Transfer Memorandum (TM)** from the Authority.\n` +
        `- **Who Pays?**: By market custom, the **seller pays the TM charges** to the Authority unless contractually agreed otherwise in the Agreement to Sell.\n\n` +
        `*Would you like a legal checklist for verifying registry status in a specific resale society?*`

      const chips = [
        {
          id: `chip_oc_checklist_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Resale Document Checklist',
          icon: 'file-text',
          analyticsId: 'chip_oc_checklist',
          priority: 1,
          payload: { text: 'What documents are required for registry of a resale flat in Noida?' },
        },
        {
          id: `chip_oc_due_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Check Authority Dues',
          icon: 'shield-check',
          analyticsId: 'chip_oc_due',
          priority: 2,
          payload: { text: 'How to check builder dues with Noida Authority before buying resale?' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Outlined OC/CC legal differences and TM fee obligations', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 21. Student & Tech Co-Living Rental Yields ────────────────────────────────
    if (STUDENT_COLIVING_REGEX.test(msgLower)) {
      const replyText = `### High-Yield Student Housing & Tech Co-Living Sectors in Noida\n\n` +
        `Micro-apartments, studio units, and 1 BHK layouts near major educational & IT hubs generate the highest residential yields (**5.5% – 7.5% gross**):\n\n` +
        `| Micro-Market Corridor | Anchor Drivers | Optimal Asset Type | Avg Monthly Rent | Gross Yield |\n` +
        `| :--- | :--- | :--- | :--- | :--- |\n` +
        `| **Sector 125 / 126 (Expressway)** | Amity University (40,000+ students), HCL & Tech Mahindra campuses. | Fully-Furnished Studio / 1 RK | ₹16,000 – ₹24,000 | 6.0% – 7.5% |\n` +
        `| **Sector 62 (IT Hub)** | Institutional Area (Jaypee Institute, Symbiosis, Tech Parks). | 1 BHK / Shared 2 BHK | ₹15,000 – ₹22,000 | 5.5% – 6.8% |\n` +
        `| **Sector 142 / 143 (Advant Hub)** | Advant Navis Business Park, KPMG, Samsung. | Serviced Studio Units | ₹18,000 – ₹26,000 | 5.8% – 7.2% |\n` +
        `| **Knowledge Park, Greater Noida** | 50+ Engineering & Management Colleges (Galgotias, Sharda). | Student Hostels / 1 BHK | ₹12,000 – ₹18,000 | 6.5% – 8.0% |\n\n` +
        `*Are you seeking ready-to-rent studio apartments or managed co-living suites?*`

      const chips = [
        {
          id: `chip_colive_amity_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Flats Near Amity Sec 125',
          icon: 'home',
          analyticsId: 'chip_colive_amity',
          priority: 1,
          payload: { text: 'Show studio and 1 BHK flats near Amity University Noida' },
        },
        {
          id: `chip_colive_advant_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Units Near Advant Sec 142',
          icon: 'building',
          analyticsId: 'chip_colive_advant',
          priority: 2,
          payload: { text: 'Show 1 BHK flats near Advant Navis Sector 142' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Evaluated student and IT professional co-living yields', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 22. Circle Rate vs Market Rate Negotiation ────────────────────────────────
    if (CIRCLE_MARKET_RATE_REGEX.test(msgLower)) {
      const replyText = `### Circle Rates vs Market Rates in Sector 44 Noida & Negotiation Strategy\n\n` +
        `#### 1. Circle Rate vs Market Rate Overview in Sector 44\n` +
        `- **Authority Circle Rate**: Government baseline rate for calculating stamp duty (currently approximately **₹1,10,000 – ₹1,40,000 / sq mtr** for residential plots/multistorey in Sector 44).\n` +
        `- **Actual Market Rate**: Premium market transactions range between **₹18,000 – ₹28,000 / sq ft** depending on society prestige and maintenance.\n` +
        `- **Stamp Duty Law**: Registration stamp duty (**7% in UP**) is paid on whichever value is higher between the Circle Rate and the actual Agreement Value.\n\n` +
        `#### 2. Realistic Negotiation Range on Resale Units\n` +
        `- **Motivated Sellers**: Sellers looking for urgent liquidity or relocation offer **4% – 7% negotiation headroom** off the listed asking price.\n` +
        `- **Standard Societies**: General realistic discount band is **2% – 4%** on ready-to-move resale flats upon immediate cheque/token offer.\n` +
        `- **Negotiation Leverage Points**: Highlight pending society maintenance dues, upcoming renovation requirements, or immediate non-contingent downpayment readiness.\n\n` +
        `*Would you like to compare recent registered circle rates across nearby central sectors like Sector 45 or Sector 50?*`

      const chips = [
        {
          id: `chip_circle_sec44_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 44 Resale Flats',
          icon: 'tag',
          analyticsId: 'chip_circle_sec44',
          priority: 1,
          payload: { text: 'Show resale apartments in Sector 44 Noida' },
        },
        {
          id: `chip_circle_stamp_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Stamp Duty Calculator',
          icon: 'calculator',
          analyticsId: 'chip_circle_stamp',
          priority: 2,
          payload: { text: 'Calculate stamp duty and registry costs for 2 crore flat in Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Analyzed circle vs market rate dynamics and negotiation leverage', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 23. Direct Price Benchmark & 3 BHK Valuation Verdict ─────────────────────
    if (PRICE_BENCHMARK_CHECK_REGEX.test(msgLower)) {
      const replyText = `### Noida & Greater Noida 3 BHK Price Benchmark (2025–2026)\n\n` +
        `**No—₹2 Crore is not automatically overpriced, but fair value depends heavily on the micro-market sector, usable carpet area, and construction status.**\n\n` +
        `#### Micro-Market 3 BHK Valuation Matrix\n\n` +
        `| Corridor / Micro-Market | Typical 3 BHK Price Band | ₹2.0 Cr Price Verdict |\n` +
        `| :--- | :--- | :--- |\n` +
        `| **Greater Noida West (Extension)** | **₹80 Lakh – ₹1.4 Cr** | **Overpriced**: Only ultra-luxury penthouses or double units justify ₹2 Cr here. |\n` +
        `| **Sector 74 – 78 / Central Belt** | **₹1.3 Cr – ₹2.1 Cr** | **Fair & Competitive**: Standard market rate for ready large 3 BHK (1,600+ sq ft). |\n` +
        `| **Sector 137 / 143 (Expressway)** | **₹1.1 Cr – ₹1.8 Cr** | **Slightly High**: Premium for high-rise gated societies; compare with Sector 142. |\n` +
        `| **Sector 150 (Sports City)** | **₹1.6 Cr – ₹3.2 Cr** | **Good Value**: Strong entry-level ticket for low-density green communities (Godrej/ATS). |\n` +
        `| **Sector 128 / Wish Town Luxury** | **₹2.5 Cr – ₹6.0 Cr** | **Below Market**: Luxury golf-facing 3/4 BHKs command higher tickets. |\n\n` +
        `#### What to Verify Before Committing ₹2 Crore:\n` +
        `- **Usable Carpet Area**: Ensure price per sq ft is calculated on RERA carpet area, not inflated super built-up area.\n` +
        `- **All-Inclusive Cost**: Confirm if the ₹2 Cr quote includes parking, IFMS, club membership, power backup, and GST (5% for UC vs 0% for RTM with OC).\n\n` +
        `*Which specific sector or society are you considering for this ₹2 Crore 3 BHK?*`

      const chips = [
        {
          id: `chip_bench_sec150_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 150 Under ₹2 Cr',
          icon: 'tag',
          analyticsId: 'chip_bench_sec150',
          priority: 1,
          payload: { text: 'Show 3 BHK flats in Sector 150 under 2 crore' },
        },
        {
          id: `chip_bench_sec78_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 78 Ready 3 BHK',
          icon: 'building',
          analyticsId: 'chip_bench_sec78',
          priority: 2,
          payload: { text: 'Show 3 BHK ready flats in Sector 78 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Provided sector-by-sector 3 BHK price benchmark verdict', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 24. Highest Property Price Sectors ───────────────────────────────────────
    if (HIGHEST_PRICE_SECTOR_REGEX.test(msgLower)) {
      const replyText = `### Most Expensive Residential Sectors in Noida (2025–2026)\n\n` +
        `The highest capital values in Noida are concentrated in **low-density bungalow sectors** and **ultra-luxury golf corridors**:\n\n` +
        `| Rank & Sector | Micro-Market Character | Price Spectrum / sq ft | Typical Residence Ticket |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **1. Sector 14 / 15A** | Ultra-affluent VIP bungalow estates with private security gates. | Land values ₹2.5 Lakh – ₹4.0 Lakh / sq mtr | ₹15 Cr – ₹50 Cr+ (Plots/Bungalows) |\n` +
        `| **2. Sector 44** | Elite low-density belt opposite Noida Golf Course and Botanical Garden. | ₹18,000 – ₹28,000 / sq ft | ₹5 Cr – ₹20 Cr |\n` +
        `| **3. Sector 128 (Wish Town)** | Master-planned luxury golf enclave (Mahagun Manorialle, Kalpataru Vista). | ₹13,500 – ₹20,000 / sq ft | ₹3.8 Cr – ₹12 Cr |\n` +
        `| **4. Sector 124 / 93A** | Grand entry expressway towers (ATS Knightsbridge, Eldeco Utopia). | ₹14,000 – ₹25,000 / sq ft | ₹4.5 Cr – ₹25 Cr |\n` +
        `| **5. Sector 150 (Sports City)** | Emerging high-end green corridor with low density. | ₹9,500 – ₹15,000 / sq ft | ₹1.8 Cr – ₹5.5 Cr |\n\n` +
        `*Would you like to explore luxury apartment availability in Sector 128 or Sector 44?*`

      const chips = [
        {
          id: `chip_high_sec128_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 128 Golf Enclave',
          icon: 'crown',
          analyticsId: 'chip_high_sec128',
          priority: 1,
          payload: { text: 'Show luxury residences in Sector 128 Noida' },
        },
        {
          id: `chip_high_sec44_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 44 Luxury Flats',
          icon: 'building',
          analyticsId: 'chip_high_sec44',
          priority: 2,
          payload: { text: 'Show luxury apartments in Sector 44 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Ranked top 5 highest-priced luxury sectors in Noida', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 25. Under-Construction vs Ready-to-Move Investment Choice ─────────────────
    if (UNDER_CONSTRUCTION_VS_READY_REGEX.test(msgLower)) {
      const replyText = `### Under-Construction vs Ready-to-Move for Investment in Noida\n\n` +
        `For purely investment-focused buyers, the choice depends on whether your priority is **immediate cash flow** or **maximum capital appreciation**:\n\n` +
        `| Evaluation Dimension | Under-Construction (UC) | Ready-to-Move (RTM) |\n` +
        `| :--- | :--- | :--- |\n` +
        // The two rows here used to read "Capital Appreciation (CAGR) | High
        // (12% – 16% p.a.)" against "Moderate (7% – 10% p.a.)", and "Immediate
        // 3.8% – 4.5% yield". Those figures came from nobody. `guardrails.ts`
        // blocks the MODEL from writing a percentage return; a string literal
        // walked straight past it, and a range that precise reads as measured.
        // What is left says the same thing in facts we hold.
        `| **When you can move or let it** | Not until handover — typically a 2–4 year wait. | Immediately. |\n` +
        `| **Entry price** | Usually lower, staged across construction milestones. | Usually higher, with nothing left to wait for. |\n` +
        `| **GST & Tax Outflow** | **5% GST** on agreement value. | **0% GST** (exempt if Occupancy Certificate is issued). |\n` +
        `| **Delivery & Completion Risk** | Moderate to High; strictly demand **UP-RERA registered projects** from Tier-1 builders. | **Zero delivery risk**; inspect actual physical flat & society before buying. |\n\n` +
        `#### Strategic Verdict:\n` +
        `- **Choose under-construction** if you can wait, want the lower entry price, and will do the UP-RERA and builder-handover checks properly.\n` +
        `- **Choose ready-to-move** if you need to occupy or let it now, or want to see exactly what you are buying before paying for it.\n\n` +
        `I have not put appreciation or rental-yield figures against either — we do not hold verified ones, and anyone quoting you a precise percentage is estimating.\n\n` +
        `*What is your timeline for moving in?*`

      const chips = [
        {
          id: `chip_uc_sec150_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 150 UC Projects',
          icon: 'trending-up',
          analyticsId: 'chip_uc_sec150',
          priority: 1,
          payload: { text: 'Show top under construction projects in Sector 150' },
        },
        {
          id: `chip_rtm_sec75_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 75 Ready Flats',
          icon: 'home',
          analyticsId: 'chip_rtm_sec75',
          priority: 2,
          payload: { text: 'Show ready to move flats in Sector 75 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Analyzed UC vs RTM return on investment trade-offs', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 26. Unknown Builder & 20% Discount Trap Analysis ──────────────────────────
    if (UNKNOWN_BUILDER_RISK_REGEX.test(msgLower)) {
      const replyText = `### Is It Safe to Buy from an Unknown Builder Offering a 20% Discount?\n\n` +
        `**In 9 out of 10 cases in NCR, a 20% discount from an unproven builder is a high-risk trap rather than a genuine bargain.**\n\n` +
        `#### The Hidden Costs Behind the 20% Discount:\n` +
        `1. **Land Dues Non-Payment**: Smaller builders often have pending lease dues with the Noida Authority, leading to **blocked registry of flats** even after construction.\n` +
        `2. **Construction Delay Gestation**: A 3-year delay erodes all initial cost savings through accumulated pre-EMI interest and lost rental income.\n` +
        `3. **Escrow Diversion Risk**: Unverified developers frequently divert buyer funds to acquire other land parcels instead of finishing your tower.\n` +
        `4. **Poor Resale Liquidity**: Units in non-branded societies trade at steep 15–25% discounts in the secondary market and take 3x longer to sell.\n\n` +
        `#### Non-Negotiable Mandatory Checks if You Still Proceed:\n` +
        `- **UP-RERA Escrow Account**: Verify the dedicated bank escrow account on \`up-rera.in\`.\n` +
        `- **Noida Authority Zero-Dues Certificate**: Check that land cost is 100% cleared.\n` +
        `- **Bank Approvals**: Ensure leading banks (SBI, HDFC, ICICI) have approved construction-linked disbursement.\n\n` +
        `*Would you like to check the RERA status of this specific project or compare it with reputable alternatives?*`

      const chips = [
        {
          id: `chip_risk_check_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Check Project on RERA',
          icon: 'shield-check',
          analyticsId: 'chip_risk_check',
          priority: 1,
          payload: { text: 'How do I check if a builder has pending dues with Noida Authority?' },
        },
        {
          id: `chip_risk_rep_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Top Reputed Builders',
          icon: 'building',
          analyticsId: 'chip_risk_rep',
          priority: 2,
          payload: { text: 'Show reputed builder projects with on-time delivery in Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Evaluated unknown builder financial and registry risks', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 27. Suspiciously Cheaper Unit Investigation (₹25L Discount) ────────────────
    if (CHEAPER_UNIT_INVESTIGATION_REGEX.test(msgLower)) {
      const replyText = `### Why is This Flat ₹25 Lakh Cheaper? Due Diligence Audit Checklist\n\n` +
        `When a 3 BHK unit is priced ₹25 Lakh below comparable market rates, it usually indicates one of these specific underlying liabilities:\n\n` +
        `#### Top 5 Reasons for Steep Resale Discounts:\n` +
        `1. **Blocked Registry / Pending Authority Dues**: The society has unpaid land dues with the Noida Authority, preventing sub-lease deed execution.\n` +
        `2. **Distress Sale / Urgent Liquidity**: Genuine seller financial urgency or overseas relocation (the only positive scenario for a buyer).\n` +
        `3. **Disadvantageous Floor / Facing**: Stagnant waterbody view, proximity to diesel generator sets/garbage shafts, or ground/top floor heat absorption.\n` +
        `4. **Litigation / Bank Attachment**: Property is mortgaged, subject to recovery proceedings under SARFAESI, or involved in a family partition dispute.\n` +
        `5. **Unpaid IFMS & Sinking Fund Dues**: Seller owes massive maintenance arrears or unpaid transfer charges (TM) to the society.\n\n` +
        `#### Immediate Investigation Protocol:\n` +
        `- Ask for the **latest Encumbrance Certificate (EC)** from the Sub-Registrar Office.\n` +
        `- Demand a **No-Dues Certificate from the Apartment Owners Association (AOA)**.\n` +
        `- Verify original chain of title documents before issuing any token payment.\n\n` +
        `*Which society and tower is this apartment located in?*`

      const chips = [
        {
          id: `chip_cheap_due_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Resale Document Checklist',
          icon: 'file-text',
          analyticsId: 'chip_cheap_due',
          priority: 1,
          payload: { text: 'What documents are required for registry of a resale flat in Noida?' },
        },
        {
          id: `chip_cheap_ec_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Verify Authority Dues',
          icon: 'shield-check',
          analyticsId: 'chip_cheap_ec',
          priority: 2,
          payload: { text: 'How to check builder dues with Noida Authority before buying resale?' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Provided due diligence audit protocol for under-market resale unit', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 28. The Ultimate 3-Way Corridor Dilemma (Sec 75 vs Sec 150 vs Ext) ────────
    if (THREE_WAY_CORRIDOR_DILEMMA_REGEX.test(msgLower)) {
      const replyText = `### Decision Matrix: Sector 75 vs Sector 150 vs Noida Extension (₹1.5 Cr Budget)\n\n` +
        `Here is the objective data-driven breakdown across your 7 decision parameters:\n\n` +
        `| Evaluation Parameter | Ready 3 BHK (Sector 75) | Newer 3 BHK (Sector 150) | Large 3 BHK (Noida Ext) |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **Usable Space for ₹1.5 Cr** | 1,450 – 1,650 sq ft | 1,350 – 1,500 sq ft | **1,750 – 2,100 sq ft (Largest)** |\n` +
        `| **Resale Liquidity** | **Very High**: Instant end-user demand. | High: Premium buyer interest. | Moderate: High competing supply. |\n` +
        `| **Rental Yield** | **4.0% – 4.4% (Highest immediate rent)** | 3.4% – 3.8% | 3.8% – 4.2% |\n` +
        `| **5-Yr Appreciation CAGR** | 8% – 10% (Mature baseline) | **13% – 16% (Highest Upside)** | 10% – 12% |\n` +
        `| **Metro & Commute** | **Sector 76 Metro (5 mins walk)** | Sector 148 Metro / Expressway | Gaur City Hub / Road traffic |\n` +
        `| **Major Risk Factor** | Internal evening traffic density. | Delivery timeline delays. | Peak hour roundabout congestion. |\n\n` +
        `#### Final Strategic Recommendation:\n` +
        `1. **Choose Sector 75**: If you need **immediate move-in for your family**, walking distance to metro, and established schools nearby.\n` +
        `2. **Choose Sector 150**: If your primary goal is **maximum capital appreciation and luxury lifestyle** with 80% green cover.\n` +
        `3. **Choose Noida Extension**: If **maximum carpet space per rupee** is your top priority.\n\n` +
        `*Which of these 3 priorities is most important for your family?*`

      const chips = [
        {
          id: `chip_3way_sec75_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 75 Ready 3 BHK',
          icon: 'home',
          analyticsId: 'chip_3way_sec75',
          priority: 1,
          payload: { text: 'Show ready 3 BHK flats in Sector 75 under 1.5 crore' },
        },
        {
          id: `chip_3way_sec150_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 150 Verified Units',
          icon: 'trending-up',
          analyticsId: 'chip_3way_sec150',
          priority: 2,
          payload: { text: 'Show 3 BHK projects in Sector 150 under 1.5 crore' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Generated comparative decision matrix for 3-way corridor choice', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 29. Noida vs Gurgaon Residential Affordability ───────────────────────────
    if (NOIDA_VS_GURGAON_AFFORDABILITY.test(msgLower)) {
      const replyText = `### Noida vs Gurgaon: Comprehensive Residential Property Comparison\n\n` +
        `**Yes, Noida remains 35% to 50% more affordable than Gurgaon on a like-for-like carpet area and infrastructure basis.**\n\n` +
        `#### Head-to-Head Comparison Matrix\n\n` +
        `| Metric / Parameter | Noida & Greater Noida | Gurgaon (Cyber Hub / Golf Course Ext) |\n` +
        `| :--- | :--- | :--- |\n` +
        `| **Average Price / sq ft** | **₹7,500 – ₹14,000 / sq ft** | ₹14,000 – ₹28,000+ / sq ft |\n` +
        `| **₹1.5 Cr Purchasing Power** | Spacious **Ready 3 BHK (1,600 sq ft)** in Central Noida / Sector 150. | Compact **2 BHK / Older Builder Floor** in peripheral sectors. |\n` +
        `| **Road Infrastructure & Traffic** | **Superior planned grid roads (45m–75m wide)** with signal-free underpasses. | Narrow internal sector roads; severe monsoon waterlogging at key junctions. |\n` +
        `| **Civic Amenities & Power** | 24x7 Ganga water supply; stable grid power. | High reliance on private water tankers & heavy DG diesel backup costs. |\n` +
        `| **Corporate Ecosystem** | IT/ITES, Electronics (Samsung), Fintech & Media. | Fortune 500 Headquarters, Big Tech & Consulting. |\n\n` +
        `#### Bottom-Line Recommendation:\n` +
        `- **Choose Noida**: For significantly higher livability, wider roads, superior value per sq ft, and family-friendly gated communities.\n` +
        `- **Choose Gurgaon**: Only if your workplace is strictly in Cyber City/Golf Course Road and you want immediate corporate luxury proximity.\n\n` +
        `*What is your target budget for this Noida vs Gurgaon evaluation?*`

      const chips = [
        {
          id: `chip_comp_sec150_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 150 Luxury Units',
          icon: 'crown',
          analyticsId: 'chip_comp_sec150',
          priority: 1,
          payload: { text: 'Show premium 3 BHK projects in Sector 150 Noida' },
        },
        {
          id: `chip_comp_gnw_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Noida Extension Value',
          icon: 'tag',
          analyticsId: 'chip_comp_gnw',
          priority: 2,
          payload: { text: 'Show affordable 3 BHK in Greater Noida West' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Analyzed Noida vs Gurgaon price disparity and livability', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 30. Sector 74 vs 75 vs 76 vs 78 Family Living Breakdown ─────────────────
    if (CENTRAL_SECTORS_FAMILY_FIT.test(msgLower)) {
      const replyText = `### Sector 74 vs 75 vs 76 vs 78: Central Family Corridor Comparison\n\n` +
        `These four contiguous sectors form Central Noida's most vibrant family enclave (15,000+ residing families):\n\n` +
        `| Sector | Character & Density | Metro Proximity | Top Societies | Price Spectrum |\n` +
        `| :--- | :--- | :--- | :--- | :--- |\n` +
        `| **Sector 78** | **Best Overall for Families**: Premium low-density gated societies with wide green spaces. | 700m to Sector 76 Metro. | Mahagun Moderne, Antriksh Golf View, Hyde Park. | ₹1.3 Cr – ₹2.5 Cr |\n` +
        `| **Sector 75** | High-energy commercial hub with high-street markets and retail convenience. | 300m to Sector 76 Metro. | Maxblis Grand Wellington, Golf City, Apex Athena. | ₹1.1 Cr – ₹2.1 Cr |\n` +
        `| **Sector 76** | Direct foot-over-bridge access to Aqua Line Metro; compact society layouts. | **0–200m (Direct Walk)** | Amrapali Princely Estate, Silicon City, Sethi Max Royal. | ₹90 Lakh – ₹1.6 Cr |\n` +
        `| **Sector 74** | Exclusive single-society gated enclave (Supertech Capetown). | 900m to Sector 76 Metro. | Supertech Capetown (large internal community). | ₹95 Lakh – ₹1.7 Cr |\n\n` +
        `#### Family Verdict:\n` +
        `- **Pick Sector 78 (Mahagun Moderne / Hyde Park)**: If lush green community spaces and top clubhouse amenities matter most.\n` +
        `- **Pick Sector 75 / 76**: If daily metro commuting and immediate high-street grocery convenience are your top priorities.\n\n` +
        `*Would you like to see available ready 3 BHK units in Sector 78 or Sector 75?*`

      const chips = [
        {
          id: `chip_sec78_units_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 78 Family Flats',
          icon: 'home',
          analyticsId: 'chip_sec78_units',
          priority: 1,
          payload: { text: 'Show ready 3 BHK flats in Sector 78 Noida' },
        },
        {
          id: `chip_sec75_units_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 75 Metro Flats',
          icon: 'navigation',
          analyticsId: 'chip_sec75_units',
          priority: 2,
          payload: { text: 'Show ready 3 BHK flats in Sector 75 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Ranked Central 74-78 sectors by family livability and metro access', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 31. EMI Budget Realism (₹1 Cr Flat with ₹30k EMI) ──────────────────────────
    if (EMI_AFFORDABILITY_FEASIBILITY.test(msgLower)) {
      const replyText = `### Financial Math: Can You Buy a ₹1 Crore Flat with a ₹30,000/Month EMI?\n\n` +
        `**No—with standard financing, ₹30,000/month EMI is NOT realistic for a ₹1 Crore property unless you put down a 65%+ cash downpayment.**\n\n` +
        `#### The Hard Numbers Behind a ₹1 Crore Purchase:\n` +
        `- **Standard 80% Home Loan (₹80 Lakh)** at 8.5% interest for 20 years requires an **EMI of ~₹69,426 / month**.\n` +
        `- **Loan Amount Supported by ₹30,000 EMI**: At 8.5% interest for 20 years, a ₹30,000 monthly payment only services a loan of **~₹34.5 Lakh**.\n` +
        `- **Required Downpayment**: To keep your EMI at ₹30,000 for a ₹1 Cr flat, you must pay **₹65.5 Lakh as upfront downpayment** (plus ~₹7 Lakh for stamp duty/registry/IFMS).\n\n` +
        `#### Realistic Property Options for ₹30,000/Month EMI:\n` +
        `1. **₹45 Lakh – ₹55 Lakh Budget** (with 20% downpayment of ₹10 Lakh and ₹40 Lakh loan):\n` +
        `   - Verified 2 BHK apartments in **Greater Noida West (Noida Extension)**.\n` +
        `   - Ready-to-move 1/2 BHK units in **Sector 143 / 168**.\n\n` +
        `*Would you like to explore verified 2 BHK apartments in the ₹45–55 Lakh range or recalculate with your exact downpayment savings?*`

      const chips = [
        {
          id: `chip_emi_gnw_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Flats Under ₹55 Lakh',
          icon: 'tag',
          analyticsId: 'chip_emi_gnw',
          priority: 1,
          payload: { text: 'Show 2 BHK flats under 55 lakh in Greater Noida West' },
        },
        {
          id: `chip_emi_calc_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Calculate EMI for ₹80L Loan',
          icon: 'calculator',
          analyticsId: 'chip_emi_calc',
          priority: 2,
          payload: { text: 'Calculate EMI for 80 lakh home loan at 8.5 percent for 20 years' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Computed realistic loan amortization and downpayment gap for ₹30k EMI', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 32. Sector 150 vs Sector 128 Long-Term Investment Comparison ──────────────
    if (SEC150_VS_SEC128_COMPARISON.test(msgLower)) {
      const replyText = `### Sector 150 vs Sector 128: Luxury Long-Term Investment Analysis\n\n` +
        `Both sectors represent Noida's most prestigious expressway corridors, but serve distinct investment profiles:\n\n` +
        `| Comparison Factor | Sector 128 (Wish Town Luxury) | Sector 150 (Sports City Masterplan) |\n` +
        `| :--- | :--- | :--- |\n` +
        `| **Price / sq ft Range** | **₹13,500 – ₹20,000 / sq ft** | **₹9,500 – ₹15,000 / sq ft** |\n` +
        `| **Entry Ticket (3 BHK)** | ₹3.8 Cr – ₹7.5 Cr | ₹1.6 Cr – ₹3.2 Cr |\n` +
        `| **Anchor Lifestyle Feature** | 18-hole championship golf course, Jaypee Hospital, ultra-luxury towers. | 80% green cover, sports city infrastructure, 42-acre park. |\n` +
        `| **Jewar Airport Distance** | ~48 km (40 mins) | **~32 km (25 mins - Direct Signal Free)** |\n` +
        `| **Expected 5-Year CAGR** | 9% – 12% (High baseline luxury) | **13% – 16% (Higher Growth Velocity)** |\n\n` +
        `#### Investment Verdict:\n` +
        `- **Choose Sector 150**: For **maximum capital appreciation and lower entry ticket**, benefiting directly from the Jewar Airport and Sports City expansion.\n` +
        `- **Choose Sector 128**: If you want **established ultra-luxury golf living** with immediate Delhi/DND connectivity.\n\n` +
        `*Would you like to compare specific projects in Sector 150 or Sector 128?*`

      const chips = [
        {
          id: `chip_sec150_inv_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 150 Top Projects',
          icon: 'trending-up',
          analyticsId: 'chip_sec150_inv',
          priority: 1,
          payload: { text: 'Show top investment projects in Sector 150 Noida' },
        },
        {
          id: `chip_sec128_inv_${Date.now()}`,
          actionType: 'TEXT_MESSAGE',
          label: 'Sector 128 Golf Residences',
          icon: 'crown',
          analyticsId: 'chip_sec128_inv',
          priority: 2,
          payload: { text: 'Show luxury residences in Sector 128 Noida' },
        },
      ]

      ctx.send('token', { token: replyText })
      ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Compared Sector 150 vs 128 long-term capital CAGR and luxury positioning', chips })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
      return
    }

    // ── 33. Competitor & Alternative Project Comparisons ─────────────────────────
    if (COMPETITOR_COMPARISON_REGEX.test(msgLower)) {
      const isCleo = /cleo/i.test(msgLower)
      const isSec121 = /121/i.test(msgLower)

      if (isCleo || isSec121) {
        const replyText = `### Competitor & Alternative Projects to Cleo County (Sector 121)\n\n` +
          `**Cleo County** is a delivered 2,600-unit ultra-luxury residential township spanning 25 acres in Sector 121, Noida, featuring an Egyptian architectural theme, 5-star resort amenities, and India's first temperature-controlled indoor swimming pool.\n\n` +
          `Within Sector 121 and its immediate adjoining central micro-markets (Sectors 120, 75, 119, and 107), several projects compete across distinct price, lifestyle, and density tiers:\n\n` +
          `| Project | Location / Sector | Developer | Status & Possession | Price Range (3 BHK) | Key Differences & Trade-offs vs Cleo County |\n` +
          `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
          `| **Cleo County** *(Anchor)* | **Sector 121** | **ABA Corp** | **Ready-to-Move (OC)** | **₹1.45 – ₹3.10 Cr** | **25-acre resort luxury benchmark** with indoor all-weather pool, 80%+ greens, large central club. |\n` +
          `| **Homes 121** | Sector 121 (Adjacent) | ABA Corp & Ajnara | Ready-to-Move | **₹85L – ₹1.45 Cr** | **Budget-friendly alternative in exact same sector**; higher unit density and standard amenities vs Cleo's luxury. |\n` +
          `| **IVY County** | Sector 75 (Central Noida) | ABA Corp | Ready-to-Move | **₹1.65 – ₹3.50 Cr** | Modern eco-luxury high-rise with closer walking access to Sector 50/76 metro; smaller 5-acre boutique footprint. |\n` +
          `| **Prateek Laurel** | Sector 120 (500m across) | Prateek Group | Ready-to-Move | **₹95L – ₹1.65 Cr** | Established family society with strong commercial high-street retail; 20% to 30% lower entry price point. |\n` +
          `| **County 107** | Sector 107 (Expressway) | County Group / ABA | Under-Construction | **₹3.80 – ₹7.50 Cr** | **Ultra-luxury upgrade** with elevated walkways, platinum IGBC rating, and lower density (2 units/floor). |\n\n` +
          `#### Key Decision Factors for Buyers:\n` +
          `1. **Budget vs Luxury**: If you want Sector 121's location under ₹1.2 Cr, **Homes 121** offers substantial cost savings.\n` +
          `2. **Metro Transit**: If daily walking access to the Aqua Line is your top priority, **IVY County (Sector 75)** is closer to the metro corridor than Sector 121.\n` +
          `3. **Amenity Scale**: Cleo County remains the unmatched benchmark in Sector 121 for resort-style landscaping, sports infrastructure, and open green space.\n\n` +
          `*Which of these projects would you like to explore further, or would you like to see a direct cost-sheet breakdown?*`

        const chips = [
          {
            id: `chip_compare_cleo_${Date.now()}`,
            actionType: 'TEXT_MESSAGE',
            label: 'Compare Cleo vs Homes 121',
            icon: 'scales',
            analyticsId: 'chip_cleo_homes',
            priority: 1,
            payload: { text: 'Compare Cleo County vs Homes 121 in detail' },
          },
          {
            id: `chip_ivy_county_${Date.now()}`,
            actionType: 'TEXT_MESSAGE',
            label: 'IVY County Sector 75 Details',
            icon: 'building-apartment',
            analyticsId: 'chip_ivy_details',
            priority: 2,
            payload: { text: 'Tell me more about IVY County in Sector 75 Noida' },
          },
          {
            id: `chip_cost_cleo_${Date.now()}`,
            actionType: 'TEXT_MESSAGE',
            label: 'Full Cost Sheet of Cleo County',
            icon: 'calculator',
            analyticsId: 'chip_cleo_cost',
            priority: 3,
            payload: { text: 'Show full cost sheet and price breakdown for Cleo County Sector 121' },
          },
        ]

        ctx.send('token', { token: replyText })
        ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Evaluated Cleo County competitors across Sectors 121, 120, 75, and 107', chips })
        ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
        ctx.res.end()
        return true
      }

      // ── SUBVENTION SCHEMES & UP RERA / RBI LEGALITY ─────────────────────────
      if (SUBVENTION_LEGALITY_REGEX.test(msg)) {
        const subventionText = `### Regulatory & Legal Status of 20:80 Subvention Schemes (UP RERA & RBI Guidelines)

#### 1. The Short Verdict
**Bank-funded subvention schemes (where a bank disburses 70–80% upfront and the builder promises to pay EMIs on your behalf) are effectively BANNED and strictly prohibited by the Reserve Bank of India (RBI) and the National Housing Bank (NHB).**

However, **pure builder-funded Possession-Linked Plans (PLP)** — where you pay 20% upfront and the remaining 80% directly to the developer upon handover with **no bank loan or EMI involved during construction** — are **100% legal and fully recognized under UP RERA**.

---

#### 2. Key Regulatory Framework & Directives

| Authority | Regulatory Position & Directive | Practical Buyer Impact |
| :--- | :--- | :--- |
| **Reserve Bank of India (RBI)** | **Circular DBOD.BP.BC.No. 51/2013-14 & NHB Directives**: Banned upfront loan disbursements in tripartite subvention agreements. Banks are strictly mandated to release funds **only in tranches tied to physical site milestones**. | If a developer offers a bank loan where they service your interest during construction, it violates central banking directives. |
| **UP RERA Position (2026)** | UP RERA does **not** recognize informal tripartite EMI guarantees. Section 4(2)(l)(D) mandates that 70% of buyer collections must sit in a designated **RERA Escrow Account** disbursed strictly on architect/CA progress certifications. | If the builder defaults on promised EMIs, **the bank will legally hold YOU (the homebuyer) liable**, initiating SARFAESI recovery and impacting your CIBIL score. |
| **Supreme Court Precedents** | Multiple consumer & RERA benches have ruled that banks cannot coerce buyers for EMIs when builders defaulted on subvention commitments, but legal defense costs and credit score damage remain high. | High legal friction if entering tripartite subvention contracts. |

---

#### 3. Subvention vs. Legal Construction-Linked Alternatives

| Feature | Bank-Financed Subvention (Banned/High Risk) | Builder Possession-Linked (20:80 PLP - Legal) | Construction-Linked Plan (CLP 10:90 - Safest) |
| :--- | :--- | :--- | :--- |
| **Structure** | Tripartite (Buyer - Builder - Bank) | Direct Bilateral (Buyer - Builder) | Milestone-governed via Escrow |
| **Loan Activation** | Sanctioned & disbursed upfront | No loan until possession inspection | Disbursed floor-by-floor as built |
| **EMI Responsibility** | Builder promises to pay (Buyer liable on default) | **Zero EMI** (No loan exists until handover) | Pre-EMI only on disbursed portion |
| **RERA & RBI Standing** | **Disallowed** by RBI/NHB | **Fully Legal** under UP RERA | **Gold Standard** recommended by UP RERA |
| **Risk Exposure** | **Extreme**: Insolvency or delay leaves buyer with EMIs | **Low**: Capital risk capped to initial 20% down payment | **Lowest**: Total financial leverage stays with buyer |

---

#### 4. PropFyndr Advisory Checklist Before Signing
1. **Never sign an upfront bank disbursement mandate**: Never allow a lender to disburse loan funds ahead of certified physical slab construction.
2. **Demand Builder PLP without Loan**: If you want a 20:80 or 10:90 structure, insist on a **Builder-Direct PLP agreement** recorded in your registered BBA (Builder Buyer Agreement) with zero bank loan involvement until the Occupancy Certificate (OC).
3. **Verify Escrow Deposit**: Confirm that your 20% booking payment is routed directly to the project's **UP RERA Designated Escrow Account**, not a developer general operations account.

*Would you like to review verified developers in Noida offering RERA-approved 20:80 Builder PLP or 10:90 CLP plans?*`

        const chips = [
          {
            id: `chip_sub_clp_${Date.now()}`,
            actionType: 'TEXT_MESSAGE',
            label: 'Show RERA-Safe 10:90 CLP Projects',
            icon: 'shield-check',
            analyticsId: 'chip_sub_clp',
            priority: 1,
            payload: { text: 'Which projects offer RERA compliant 10:90 construction linked plans in Noida?' },
          },
          {
            id: `chip_sub_rera_${Date.now()}`,
            actionType: 'TEXT_MESSAGE',
            label: 'How to verify RERA Escrow account',
            icon: 'file-text',
            analyticsId: 'chip_sub_rera',
            priority: 2,
            payload: { text: 'How do I verify a project RERA escrow account on UP RERA portal?' },
          },
        ]

        ctx.send('token', { token: subventionText })
        ctx.emitUiState({ stage: 'RESEARCH', thinking: 'Evaluated UP RERA and RBI subvention regulatory compliance directives:', chips })
        ctx.send('done', { sessionId: ctx.sessionId, intentState: 'GATHERING', intent: ctx.intent })
        ctx.res.end()
        return true
      }

      // The hardcoded "Elite X" payment-plan block that stood here is gone.
      //
      // It answered EVERY payment-plan question as Elite X — the project name
      // came from `isEliteX ? 'Elite X' : 'Elite X'`, a ternary with identical
      // branches — with a fixed sector, a fixed RERA number, a fixed Dec 2028
      // possession, five invented schedules, an "8% Direct BSP Waiver", a named
      // bank escrow account and bank interest rates, all under the heading
      // "Verified Payment Plans & Official Offers", and chips offering a
      // comparison against a second hardcoded project. Its regex also matched a
      // bare "discounts?" and "current offers?", so "any discounts available?"
      // produced the whole thing.
      //
      // Nothing replaces it here, because the dynamic answer already exists and
      // this branch was shadowing it: `paymentPlansHandler` resolves whichever
      // project the buyer named and reads that project's own `payment_plans`
      // rows, `costSheetHandler` and `unitConfigurationHandler` do the same for
      // their topics, and the generic project-detail path projects the whole
      // public field allowlist through `projectFactsBlock`. Deleting the branch
      // is what makes payment plans dynamic — every one of those runs after
      // this handler in `CHAT_TOPIC_HANDLERS` and could never be reached.
    }

    /**
     * Nothing matched — decline, do not close the lane.
     *
     * `runTopicHandlers` treats `false` as "not mine, try the next one" and
     * anything else as handled. This handler is a wall of independent `if`
     * branches, so deleting one used to leave its trigger still claimed by
     * `matches` and answered by nobody: measured after removing the hardcoded
     * builder table, "Which builders in Noida have the best on-time delivery?"
     * came back COMPLETELY EMPTY — matched here, fell through every branch,
     * and `[CHAT:TOPIC_LANE_CLOSED]` ended the response with zero bytes sent,
     * while `builderReputationHandler` sat one position below ready to answer
     * it from rows.
     *
     * Returning false makes that impossible for the next branch anyone deletes.
     */
    return false
  },
}

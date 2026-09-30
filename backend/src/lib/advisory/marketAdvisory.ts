// backend/src/lib/advisory/marketAdvisory.ts
//
// Sales-OS Market Intelligence & Advisory Bridging Engine.
// Follows SALES-OS-MASTERY.md (Hormozi Value Equation + Voss Tactical Empathy + Brunson Bridging).
// Enforces strict Zero-Project-Name invariant for rental and resale inquiries.
// Complies with ERRORS.md: single exported predicates and string builders.

export interface MarketClusterRent {
  cluster: string
  bhk2Range: string
  bhk3Range: string
  grossYield: string
  commentary: string
}

export const RENTAL_BENCHMARKS: Record<string, MarketClusterRent> = {
  'greater-noida-west': {
    cluster: 'Greater Noida West (Noida Extension)',
    bhk2Range: '₹14,000–₹22,000/mo',
    bhk3Range: '₹20,000–₹32,000/mo',
    grossYield: '2.8%–3.3%',
    commentary: 'High-density family and budget commuter corridor with steady tenant occupancy.',
  },
  'central-noida': {
    cluster: 'Central Noida (Sectors 50, 74–79)',
    bhk2Range: '₹22,000–₹35,000/mo',
    bhk3Range: '₹32,000–₹50,000/mo',
    grossYield: '2.5%–3.0%',
    commentary: 'Mature residential corridor with established retail, direct metro access, and high executive demand.',
  },
  'noida-expressway': {
    cluster: 'Noida-Greater Noida Expressway (Sectors 137, 143, 168)',
    bhk2Range: '₹25,000–₹38,000/mo',
    bhk3Range: '₹35,000–₹55,000/mo',
    grossYield: '2.7%–3.2%',
    commentary: 'Immediate proximity to Advant Navis, Oxygen SEZ, and corporate IT parks drives high IT professional rental uptake.',
  },
  'sector-150': {
    cluster: 'Sector 150 (Expressway Sanctuary)',
    bhk2Range: '₹28,000–₹42,000/mo',
    bhk3Range: '₹40,000–₹65,000/mo',
    grossYield: '2.4%–2.9%',
    commentary: 'Low-density, sports-centric development popular with senior corporate executives and families seeking green open spaces.',
  },
}

export interface MarketClusterResale {
  cluster: string
  ratePerSqft: string
  typical2BhkCr: string
  typical3BhkCr: string
  frictionNote: string
}

export const RESALE_BENCHMARKS: Record<string, MarketClusterResale> = {
  'greater-noida-west': {
    cluster: 'Greater Noida West (Noida Extension)',
    ratePerSqft: '₹5,000–₹7,500/sqft',
    typical2BhkCr: '₹55L–₹85L',
    typical3BhkCr: '₹85L–₹1.35 Cr',
    frictionNote: 'GNIDA Transfer Memorandum (TM) charges apply on resale transfer, typically 1–3% of land premium.',
  },
  'central-noida': {
    cluster: 'Central Noida (Sectors 50, 74–79)',
    ratePerSqft: '₹8,000–₹12,000/sqft',
    typical2BhkCr: '₹90L–₹1.40 Cr',
    typical3BhkCr: '₹1.40 Cr–₹2.30 Cr',
    frictionNote: 'NOIDA Authority TM fee, sub-registrar stamp duty (7%), and society AOA transfer charges apply.',
  },
  'noida-expressway': {
    cluster: 'Noida Expressway Corridors (Sectors 137, 143, 168)',
    ratePerSqft: '₹9,500–₹15,000/sqft',
    typical2BhkCr: '₹1.05 Cr–₹1.65 Cr',
    typical3BhkCr: '₹1.60 Cr–₹2.80 Cr',
    frictionNote: 'Verify whether developer has cleared authority land dues; pending builder dues can delay tripartite lease transfer.',
  },
  'sector-150': {
    cluster: 'Sector 150 Noida',
    ratePerSqft: '₹10,500–₹16,500/sqft',
    typical2BhkCr: '₹1.25 Cr–₹1.80 Cr',
    typical3BhkCr: '₹1.80 Cr–₹3.20 Cr',
    frictionNote: 'Low-density premium pricing with strict NOIDA Authority leasehold jurisdiction; verify OC stage.',
  },
}

// ─── PREDICATES (Conforming to ERRORS.md) ────────────────────────────────────

export function isRentalInquiry(message: string): boolean {
  const m = message.toLowerCase()
  return (
    /\b(?:rent|renting|rental|tenant|lease|leasing)\b/i.test(m) &&
    !/\b(?:rental\s+yield|yield\s+calc|yield\s+is)\b/i.test(m)
  )
}

export function isResaleInquiry(message: string): boolean {
  const m = message.toLowerCase()
  return /\b(?:resale|second[- ]?hand|pre[- ]?owned|bought\s+from\s+someone|previous\s+owner)\b/i.test(m)
}

export function isCommercialInquiry(message: string): boolean {
  const m = message.toLowerCase()
  return /\b(?:commercial|retail\s+shop|office\s+space|sco\s+plots?|food\s+court)\b/i.test(m)
}

export function isMultiFactorAdvisoryQuery(message: string): boolean {
  return /\b(?:(?:five|5|top\s+\d+)\s+(?:factors|things|items|points|considerations|aspects|less[- ]obvious)|less[- ]obvious|what\s+am\s+i\s+not\s+thinking\s+about|what\s+else\s+should\s+i\s+(?:consider|check|look\s+at)|factors?\s+that\s+could\s+materially\s+affect)\b/i.test(
    message,
  )
}

export function detectSectorCluster(message: string): string {
  const m = message.toLowerCase()
  if (/\b(?:150|sports\s+city)\b/.test(m)) return 'sector-150'
  if (/\b(?:expressway|137|143|168|142|144|128|129|134)\b/.test(m)) return 'noida-expressway'
  if (/\b(?:extension|greater\s+noida\s+west|gnw|gaur\s+city|bisrakh|sector\s+1|sector\s+4|sector\s+16)\b/.test(m))
    return 'greater-noida-west'
  if (/\b(?:central\s+noida|50|74|75|76|77|78|79)\b/.test(m)) return 'central-noida'
  return 'central-noida'
}

// ─── SALES-OS RESPONSE BUILDERS (ZERO PROJECT NAMES INCLUDED) ─────────────────

/**
 * Builds a high-value rental advisory response.
 * Follows Voss tactical empathy + Hormozi outcome clarity + Brunson bridge.
 * NEVER outputs project names or individual listings.
 */
export function formatRentalAdvisory(message: string): string {
  const clusterKey = detectSectorCluster(message)
  const bench = RENTAL_BENCHMARKS[clusterKey] ?? RENTAL_BENCHMARKS['central-noida']
  const isTenantDemand = /\b(?:tenant\s+demand|tenant\s+profile|who\s+rents|rent\s+out)\b/i.test(message)

  let text = `### Indicative Market Rental Overview (${bench.cluster})\n\n`

  if (isTenantDemand) {
    text +=
      `**Tenant Demand & Demographic Profile:**\n` +
      `- **Primary Tenant Segments:** Mid-to-senior IT & corporate professionals working along Noida Expressway SEZs (Advant, Oxygen, Candor) and young nuclear families.\n` +
      `- **High-Velocity Configurations:** 2BHK and compact 3BHK units see the fastest absorption and lowest days-on-market.\n` +
      `- **Indicative Market Rents:** 2BHK: **${bench.bhk2Range}** | 3BHK: **${bench.bhk3Range}** (typical gross yield: **${bench.grossYield}**).\n` +
      `- **Data Limitation / Missing Signals:** We do not track private tenant turnover, individual landlord vacancy months, or micro-level tenant demographic percentages on active leases.\n\n`
  } else {
    text +=
      `Here is the current indicative market rent benchmark for this corridor:\n\n` +
      `| Unit Type | Indicative Monthly Rent | Gross Rental Yield Benchmark |\n` +
      `| :--- | :--- | :--- |\n` +
      `| **2 BHK** | ${bench.bhk2Range} | ${bench.grossYield} |\n` +
      `| **3 BHK** | ${bench.bhk3Range} | ${bench.grossYield} |\n\n` +
      `*Context: ${bench.commentary}*\n\n`
  }

  // Transparent positioning + Hormozi / Brunson Sales-OS Bridge
  text +=
    `---\n\n` +
    `**Our Operational Focus & Advisory Bridge:**\n` +
    `PropFyndr specializes **exclusively in direct primary developer sales and verified new-construction purchases** across Noida and Greater Noida. We do not provide individual rental brokerage, landlord leasing, or rental listing inventories.\n\n` +
    `*Why many renters we advise evaluate purchase parity:*\n` +
    `At rent levels of ₹35,000–₹50,000/month, that capital is 100% consumption. With current interest rates, directing a comparable cashflow toward a verified ready-to-move apartment with direct sub-lease registry and 0% GST builds equity without registry lockup risk.\n\n` +
    `**Next Step:** Are you planning to rent for a short horizon while scouting the market, or would you like to explore what your monthly capital can secure in a verified direct-developer home?`

  return text
}

/**
 * Builds a high-value resale advisory response.
 * Delivers rate per sqft benchmarks + transfer friction + legal safeguards.
 * NEVER outputs project names or individual resale listings.
 */
export function formatResaleAdvisory(message: string): string {
  const clusterKey = detectSectorCluster(message)
  const bench = RESALE_BENCHMARKS[clusterKey] ?? RESALE_BENCHMARKS['central-noida']
  const isTenure = /\b(?:leasehold|freehold|tenure|land\s+authority|ownership\s+nature)\b/i.test(message)

  let text = `### Resale Market Intelligence & Legal Overview (${bench.cluster})\n\n`

  if (isTenure) {
    text +=
      `**Land Tenure & Authority Structure in Noida:**\n` +
      `- **Leasehold Structure (90-Year Lease):** All residential land in Noida and Greater Noida is allotted by the statutory industrial development authorities (**NOIDA Authority**, **GNIDA**, or **YEIDA**) on a **90-year leasehold basis**. There is no freehold apartment land in urban Noida.\n` +
      `- **Ownership Instrument:** As an apartment buyer, you receive an executed and registered **Tripartite Sub-Lease Deed** (Authority + Developer + Buyer), which confers full inheritable and transferable ownership rights for the remaining tenure.\n` +
      `- **Transfer Memorandum (TM):** When buying a resale flat, the seller must apply to the Authority for a formal Transfer Memorandum (TM) / NOC after paying applicable transfer charges (**1%–5% of the prevailing authority land premium**).\n\n`
  }

  text +=
    `**Indicative Resale Rate Benchmarks:**\n` +
    `- **Prevailing Resale Rates:** **${bench.ratePerSqft}** (depending on maintenance state, floor, and tower age).\n` +
    `- **Typical Capital Outlay:** 2BHK: **${bench.typical2BhkCr}** | 3BHK: **${bench.typical3BhkCr}**.\n` +
    `- **Critical Resale Transaction Friction:** ${bench.frictionNote} In addition, statutory stamp duty (7% general, 6% female) and sub-registrar registration (1%) apply on the higher of the circle rate or agreement value.\n\n`

  // Transparent positioning + Hormozi / Brunson Sales-OS Bridge
  text +=
    `---\n\n` +
    `**Our Operational Focus & Advisory Bridge:**\n` +
    `PropFyndr focuses **exclusively on primary developer sales and direct builder inventory** — we do not operate as an individual resale brokerage or hold private secondary market listings.\n\n` +
    `*Why buyers choose direct primary developer homes over resale:*\n` +
    `Resale purchases in older societies often carry hidden friction: pending builder dues to the Authority that block buyer registry camps, unreceipted cash premiums, and 10–12-year-old aging infrastructure (failing lift motors, deteriorating DG sets). In contrast, direct developer inventory provides clean RERA escrow account compliance, manufacturer equipment warranties, and direct developer execution.\n\n` +
    `**Next Step:** Tell me your budget ceiling and preferred sector, and I will show you verified direct developer homes where title, RERA filings, and registry eligibility are 100% verified.`

  return text
}

/**
 * Builds an out-of-scope city advisory response with a strategic bridge to Noida.
 */
export function formatOutOfScopeCityAdvisory(message: string, city: string): string {
  const capCity = city.charAt(0).toUpperCase() + city.slice(1).toLowerCase()
  return (
    `### Property Search Scope: ${capCity} vs Noida & Greater Noida\n\n` +
    `PropFyndr is a specialized property intelligence platform focused exclusively on **Noida, Greater Noida, and Yamuna Expressway**.\n\n` +
    `**Why we limit our geographic footprint:**\n` +
    `Rather than publishing superficial scraped listings across multiple cities, we maintain **100% ground-level verification** in our core territory: testing municipal Ganga Jal TDS levels, auditing authority land dues records, tracking Amitabh Kant 25% deposit registry camps, and inspecting tower-by-tower RERA milestones.\n\n` +
    `*How Noida compares for buyers looking at ${capCity}:*\n` +
    `Many buyers comparing ${capCity} (e.g. Gurgaon or Delhi) evaluate the Noida Expressway and Sector 150 because Noida offers **80% planned open space**, superior planned signal-free arterial expressways, and significantly lower entry pricing (₹9,000–₹15,000/sqft compared to ₹18,000–₹35,000/sqft in prime Gurgaon) with upcoming Jewar International Airport connectivity.\n\n` +
    `**Next Step:** If you are open to exploring top-tier Noida alternatives that offer high infrastructure standards within your budget, tell me your target BHK and budget ceiling.`
  )
}

/**
 * Builds commercial advisory response.
 */
export function formatCommercialAdvisory(_message: string): string {
  return (
    `### Commercial vs Residential Property Advisory\n\n` +
    `**Commercial Investment Metrics in Noida:**\n` +
    `- **Yield Benchmark:** Grade-A retail shops and pre-leased IT office spaces along Noida Expressway typically deliver **6.0%–8.5%** gross yields, compared to **2.5%–3.2%** for residential apartments.\n` +
    `- **Risk & GST Considerations:** Commercial real estate attracts **18% GST** (vs 5% under-construction or 0% ready residential), longer tenant vacancy cycles during lease transitions, and higher CAM overheads.\n\n` +
    `---\n\n` +
    `**Our Operational Focus:**\n` +
    `PropFyndr focuses **100% on verified residential homes and end-user living**. We do not broker commercial retail spaces, SCO plots, or office suites.\n\n` +
    `If steady long-term capital security with lower management friction is your priority, high-demand residential sectors along the Expressway IT corridor provide continuous executive tenant demand.\n\n` +
    `**Next Step:** Would you like to evaluate residential properties along the Expressway that generate verified executive rental demand?`
  )
}

// ─── LEGAL DUE DILIGENCE & OWNER EXPERIENCE STUBS ────────────────────────────

export function isChainOfTitleQuery(message: string): boolean {
  return /\b(?:ownership\s+chain|chain\s+of\s+title|bought\s+.*from\s+someone\s+else|previous\s+owner|prior\s+owner|resale\s+documents?|trace\s+through\s+the\s+ownership)\b/i.test(
    message,
  )
}

export function isSocietyFinancialQuery(message: string): boolean {
  return /\b(?:financial\s+health|managed\s+financially|maintenance\s+arrears|reserve\s+funds?|sinking\s+fund|pending\s+repairs|future\s+expenses|society\s+finances?)\b/i.test(
    message,
  )
}

export function isOwnerNicheQuery(message: string): boolean {
  return isMultiFactorAdvisoryQuery(message)
}

export function getChainOfTitleChecklist(_message?: string): string {
  return (
    `### Chain-of-Title & Resale Document Verification Sequence\n\n` +
    `When purchasing a property that has changed hands previously, you must trace an unbroken, registered chain of ownership from the allotting authority to the current seller before paying any token advance:\n\n` +
    `1. **Original Allotment Letter & Possession Certificate:** Issued by the developer to the first allottee, stating the sanctioned unit details and initial payment terms.\n` +
    `2. **Builder-Buyer Agreement (Registered BBA):** The foundational agreement defining buyer rights, payment terms, and builder obligations.\n` +
    `3. **Prior Registered Sale Deed / Tripartite Sub-Lease Deed:** The registered conveyance deed executed when the property was sold to the current owner, with official sub-registrar stamps and book volume entries.\n` +
    `4. **Unbroken Chain of Ownership Continuity:** Confirm that every transfer in the property's history is accounted for with a registered deed. No missing intermediate links or unrecorded powers of attorney.\n` +
    `5. **Non-Encumbrance Certificate (EC Form 15):** Applied for at the Sub-Registrar Office covering the past **12 to 30 years**. Ensures no bank mortgages, court attachments, or lis pendens exist.\n` +
    `6. **Authority Transfer Memorandum (TM) / Transfer Permission:** In Noida/Greater Noida, a sub-lease deed cannot be executed without formal Transfer Permission from **NOIDA/GNIDA Authority** confirming all installment dues and lease rent are cleared.\n` +
    `7. **Society / AOA No-Objection Certificate (NOC):** Confirms that regular maintenance, electricity charges, and sinking fund contributions are up to date.\n` +
    `8. **Electricity Meter & Property Tax Mutation Receipts:** Proof of utility billing transfer.\n\n` +
    `*Crucial Safeguard: Never rely solely on seller assertions or photocopies. Always mandate physical inspection of the original deeds and have an independent property advocate conduct a 30-year search at the Sub-Registrar Office before releasing a token deposit.*`
  )
}

export function getSocietyFinancialHealthChecklist(_message?: string): string {
  return (
    `### Society Financial Health & Governance Due Diligence Guide\n\n` +
    `To assess the financial management, reserves, and hidden liabilities of an apartment society before committing capital, verify these critical items:\n\n` +
    `1. **Audited Balance Sheets & Annual Accounts (Past 3 Years):** Request the audited accounts presented at the Annual General Meeting (AGM) of the Association of Apartment Owners (AOA/RWA). Look for operating deficits vs surpluses.\n` +
    `2. **Maintenance Arrears & Defaulter Ratio:** Ask what percentage of residents are defaulting on monthly maintenance. An arrears rate exceeding **15%** indicates chronic cashflow problems, which leads to deferred maintenance.\n` +
    `3. **Sinking Fund / Capital Reserve Health:** Check the balance in the designated Sinking Fund. Apartment societies face major capital overhaul cycles every **7–10 years**:\n` +
    `   - Elevator motor & cable replacements (₹15L–₹25L per lift).\n` +
    `   - Diesel Generator (DG) set overhauls and replacement batteries.\n` +
    `   - Sewage Treatment Plant (STP) membrane replacements.\n` +
    `   - Exterior facade repainting & podium waterproofing.\n` +
    `   *If the sinking fund is depleted, residents face sudden "special assessment levies" of ₹1L–₹3L per flat.*\n` +
    `4. **Developer Handover & IFMS Status:** Confirm whether the builder has formally handed over the society to the elected AOA and transferred the **Interest-Free Maintenance Security (IFMS)** corpus (₹50–₹100/sqft). Withholding of IFMS by builders is a frequent source of litigation.\n` +
    `5. **Authority & Utility Liabilities:** Check if the society has pending electricity bills with PVVNL (single-point connection arrears) or water/sewer cess dues with the Authority.\n` +
    `6. **Active Society Litigation:** Inquire about pending disputes in NGT (environmental/STP complaints), consumer court, or disputes with adjacent village landholders.\n\n` +
    `*Note: PropFyndr tracks developer track records and public RERA records, but internal society accounting ledgers are private. Buyers must request AGM minutes and audit reports directly from the seller or AOA executive committee.*`
  )
}

export function getNonObviousOwnerFactorsGuide(_message?: string): string {
  return (
    `### 5 Less-Obvious Factors That Materially Affect Ownership\n\n` +
    `While price, carpet area, and location dominate initial comparisons, these five structural factors govern long-term livability, daily operating costs, and resale liquidity in Noida & Greater Noida:\n\n` +
    `| # | Critical Factor | How It Impacts Your Ownership | Evaluability in PropFyndr |\n` +
    `| :--- | :--- | :--- | :--- |\n` +
    `| **1** | **Water Source & TDS Levels** | Projects relying purely on deep borewells supply hard water (>1,800–2,500 ppm TDS), accelerating pipe corrosion, bathroom fitting pitting, and RO membrane failure. 100% municipal Ganga Jal supply (TDS 200–350 ppm) preserves plumbing and reduces water purifier expenses. | **Evaluable from our data** (Grounded in sector pipeline and infrastructure maps) |\n` +
    `| **2** | **Dual-Meter Electricity vs Single-Point Prepaid** | Single-point builder meters allow developers to inflate common area maintenance (CAM) margins by bundling DG and grid tariffs. Direct multipoint PVVNL meters ensure transparent, regulated tariffs directly billed to the state discom. | **Partially evaluable** (Available where electricity infrastructure filing is on record) |\n` +
    `| **3** | **Real Carpet Loading & Space Efficiency** | A nominal 1,500 sqft apartment with 35% loading yields only 975 sqft of living space, while a 26% efficient layout yields 1,110 sqft. Inflated super areas result in paying maintenance on unusable circulation space. | **Evaluable from our data** (Calculated deterministically via \`calcLoadingRatio\`) |\n` +
    `| **4** | **Authority Land Dues & Registry Camp Status** | If a developer has unpaid installment dues with NOIDA/GNIDA, the Authority will not issue tripartite sub-lease permissions—leaving buyers with keys but no legal registry title. Tracking the Amitabh Kant 25% deposit clearance is essential. | **Evaluable from our data** (Monitored via authority registry camp schedules & dues filings) |\n` +
    `| **5** | **Aging Infrastructure & Sinking Fund Deficit** | Older high-rises (8+ years) face heavy capital overhaul cycles (lift motors, DG sets, STP blowers, facade repainting). If the AOA sinking fund is underfunded, owners receive surprise lump-sum assessment bills. | **Not currently verifiable** (Private society accounting ledgers must be inspected via AOA AGM minutes) |\n\n` +
    `---\n\n` +
    `**Summary Guidance:**\n` +
    `When evaluating your shortlist, prioritize projects that verify municipal Ganga Jal supply, high carpet efficiency (>72%), and cleared Authority land dues to avoid the two largest post-possession complaints in the region.`
  )
}


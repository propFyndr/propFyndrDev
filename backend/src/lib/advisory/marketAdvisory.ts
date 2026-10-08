// backend/src/lib/advisory/marketAdvisory.ts
//
// Sales-OS Market Intelligence & Advisory Bridging Engine.
// Follows SALES-OS-MASTERY.md (Hormozi Value Equation + Voss Tactical Empathy + Brunson Bridging).
// Enforces strict Zero-Project-Name invariant for rental and resale inquiries.
// Complies with ERRORS.md: single exported predicates and string builders.
//
// Every benchmark below is market tier (CLAUDE.md, Four Tiers): never read from
// a project's rows, so every line that prints one carries MARKET_QUALIFIER.

import { MARKET_QUALIFIER, marketFigure } from '../factPresentation'

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
    commentary: 'High-density residential corridor with lower entry prices than central Noida.',
  },
  'central-noida': {
    cluster: 'Central Noida (Sectors 50, 74–79)',
    bhk2Range: '₹22,000–₹35,000/mo',
    bhk3Range: '₹32,000–₹50,000/mo',
    grossYield: '2.5%–3.0%',
    commentary: 'Mature residential corridor with established retail and metro access in parts.',
  },
  'noida-expressway': {
    cluster: 'Noida-Greater Noida Expressway (Sectors 137, 143, 168)',
    bhk2Range: '₹25,000–₹38,000/mo',
    bhk3Range: '₹35,000–₹55,000/mo',
    grossYield: '2.7%–3.2%',
    commentary: 'Close to the Expressway office parks (Advant Navis, Oxygen SEZ).',
  },
  'sector-150': {
    cluster: 'Sector 150 (Expressway Sanctuary)',
    bhk2Range: '₹28,000–₹42,000/mo',
    bhk3Range: '₹40,000–₹65,000/mo',
    grossYield: '2.4%–2.9%',
    commentary: 'Low-density sector planned with large green and sports areas; still developing.',
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
    frictionNote: `GNIDA Transfer Memorandum (TM) charges apply on resale transfer, often quoted at 1–3% of land premium (${MARKET_QUALIFIER}; confirm the current charge with GNIDA).`,
  },
  'central-noida': {
    cluster: 'Central Noida (Sectors 50, 74–79)',
    ratePerSqft: '₹8,000–₹12,000/sqft',
    typical2BhkCr: '₹90L–₹1.40 Cr',
    typical3BhkCr: '₹1.40 Cr–₹2.30 Cr',
    frictionNote: 'NOIDA Authority TM fee, sub-registrar stamp duty, and society AOA transfer charges apply.',
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
    /\b(?:rent|renting|rental|tenant|lease|leasing|pg\s+accommodation|paying\s+guest|hostel)\b/i.test(m) &&
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
      `**Tenant Demand:**\n` +
      `- **What we do not track:** who rents here, how fast units let, or vacancy. We cannot describe the tenant profile with any confidence; a local leasing broker or the society RWA will have a better read.\n` +
      `- ${marketFigure('2BHK rent', bench.bhk2Range)}\n` +
      `- ${marketFigure('3BHK rent', bench.bhk3Range)}\n` +
      `- ${marketFigure('Gross yield', bench.grossYield)}\n\n`
  } else {
    text +=
      `Indicative market rent for this corridor:\n\n` +
      `| Unit Type | Indicative Monthly Rent | Gross Rental Yield | Basis |\n` +
      `| :--- | :--- | :--- | :--- |\n` +
      `| **2 BHK** | ${bench.bhk2Range} | ${bench.grossYield} | ${MARKET_QUALIFIER} |\n` +
      `| **3 BHK** | ${bench.bhk3Range} | ${bench.grossYield} | ${MARKET_QUALIFIER} |\n\n` +
      `*Context: ${bench.commentary}*\n\n`
  }

  // Transparent positioning + Hormozi / Brunson Sales-OS Bridge
  text +=
    `---\n\n` +
    `**Our Operational Focus & Advisory Bridge:**\n` +
    `PropFyndr specializes **exclusively in direct primary developer sales** of new-construction homes across Noida and Greater Noida. We do not provide rental brokerage, landlord leasing, or rental listings.\n\n` +
    `*Renting against buying:*\n` +
    `Rent builds no equity; an EMI of a similar size does, but buying also means a down payment, stamp duty, interest and maintenance. Which is cheaper depends mostly on how long you plan to stay.\n\n` +
    `**Next Step:** Are you renting for a short period while you look, or would you like to see what a similar monthly outgo looks like on a purchase in this area?`

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
      `- **Leasehold Structure:** Most Noida/Greater Noida apartment land is authority leasehold (typically 90-year), allotted by **NOIDA Authority**, **GNIDA** or **YEIDA**. Confirm the tenure in the sale deed.\n` +
      `- **Ownership Instrument:** As an apartment buyer, you receive an executed and registered **Tripartite Sub-Lease Deed** (Authority + Developer + Buyer), which confers full inheritable and transferable ownership rights for the remaining tenure.\n` +
      `- **Transfer Memorandum (TM):** When buying a resale flat, the seller must apply to the Authority for a formal Transfer Memorandum (TM) / NOC after paying applicable transfer charges (often 1%–5% of the prevailing authority land premium; ${MARKET_QUALIFIER}).\n\n`
  }

  text +=
    `**Indicative Resale Rate Benchmarks:**\n` +
    `- **Prevailing Resale Rates:** ${bench.ratePerSqft}, depending on maintenance state, floor and tower age (${MARKET_QUALIFIER}).\n` +
    `- **Typical Capital Outlay:** 2BHK: ${bench.typical2BhkCr} | 3BHK: ${bench.typical3BhkCr} (${MARKET_QUALIFIER}).\n` +
    `- **Resale Transaction Friction:** ${bench.frictionNote}\n` +
    `- **Statutory costs:** stamp duty (7% general, 6% female) and sub-registrar registration (1%) apply on the higher of the circle rate or agreement value.\n\n`

  // Transparent positioning + Hormozi / Brunson Sales-OS Bridge
  text +=
    `---\n\n` +
    `**Our Operational Focus & Advisory Bridge:**\n` +
    `PropFyndr focuses **exclusively on primary developer sales and direct builder inventory** — we do not operate as an individual resale brokerage or hold private secondary market listings.\n\n` +
    `*Trade-offs between resale and new construction:*\n` +
    `Resale is ready now, but older societies can carry pending builder dues to the Authority that hold up registry, cash components in the asking price, and ageing lifts and DG sets. New construction comes with RERA escrow and fresh equipment warranties, but carries possession-delay risk.\n\n` +
    `**Next Step:** Tell me your budget ceiling and preferred sector and I will show you new-construction options with their RERA details. Title and registry eligibility still need an advocate's check before you pay a token.`

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
    `We hold project data only for this region, so anything we said about individual projects in ${capCity} would be unverified.\n\n` +
    `*How Noida compares for buyers looking at ${capCity}:*\n` +
    `Buyers comparing ${capCity} with Noida often look at the Noida Expressway and Sector 150 for planned road access, the upcoming Jewar airport, and entry pricing: Noida Expressway at ₹9,000–₹15,000/sqft (${MARKET_QUALIFIER}); prime Gurgaon is commonly quoted at ₹18,000–₹35,000/sqft, which we do not track.\n\n` +
    `**Next Step:** If you are open to Noida options within your budget, tell me your target BHK and budget ceiling.`
  )
}

/**
 * Builds commercial advisory response.
 */
export function formatCommercialAdvisory(_message: string): string {
  return (
    `### Commercial vs Residential Property Advisory\n\n` +
    `**Commercial Investment Metrics in Noida:**\n` +
    `- **Yield Benchmark:** Grade-A retail shops and pre-leased office spaces along Noida Expressway are often quoted at 6.0%–8.5% gross yield, against 2.5%–3.2% for residential apartments (${MARKET_QUALIFIER}).\n` +
    `- **Risk & Tax Considerations:** Commercial property is taxed differently from residential (residential: 5% GST under construction, none once the OC is issued), so confirm the commercial GST position with your CA. Commercial also tends to see longer vacancies between leases and higher CAM overheads.\n\n` +
    `---\n\n` +
    `**Our Operational Focus:**\n` +
    `PropFyndr covers residential homes for end users only. We do not broker commercial retail spaces, SCO plots, or office suites.\n\n` +
    `If lower management effort matters more to you than yield, residential may suit you better.\n\n` +
    `**Next Step:** Would you like to look at residential options along the Expressway?`
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
    `   - Elevator motor & cable replacements (₹15L–₹25L per lift; ${MARKET_QUALIFIER}).\n` +
    `   - Diesel Generator (DG) set overhauls and replacement batteries.\n` +
    `   - Sewage Treatment Plant (STP) membrane replacements.\n` +
    `   - Exterior facade repainting & podium waterproofing.\n` +
    `   *If the sinking fund is depleted, residents face sudden "special assessment levies" of ₹1L–₹3L per flat (${MARKET_QUALIFIER}).*\n` +
    `4. **Developer Handover & IFMS Status:** Confirm whether the builder has formally handed over the society to the elected AOA and transferred the **Interest-Free Maintenance Security (IFMS)** corpus (₹50–₹100/sqft; ${MARKET_QUALIFIER}). Withholding of IFMS by builders is a frequent source of litigation.\n` +
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
    `| **1** | **Water Source & TDS Levels** | Projects relying purely on deep borewells supply hard water (>1,800–2,500 ppm TDS), accelerating pipe corrosion, bathroom fitting pitting, and RO membrane failure. Full municipal Ganga Jal supply (TDS 200–350 ppm) is easier on plumbing and water purifiers. | **Partially evaluable** (Where the project's water source is on record; otherwise ask the developer or test on a site visit) |\n` +
    `| **2** | **Dual-Meter Electricity vs Single-Point Prepaid** | Single-point builder meters allow developers to inflate common area maintenance (CAM) margins by bundling DG and grid tariffs. Direct multipoint PVVNL meters ensure transparent, regulated tariffs directly billed to the state discom. | **Partially evaluable** (Available where electricity infrastructure filing is on record) |\n` +
    `| **3** | **Real Carpet Loading & Space Efficiency** | A nominal 1,500 sqft apartment with 35% loading yields only 975 sqft of living space, while a 26% efficient layout yields 1,110 sqft. Inflated super areas result in paying maintenance on unusable circulation space. | **Evaluable from our data** (Calculated deterministically via \`calcLoadingRatio\`) |\n` +
    `| **4** | **Authority Land Dues & Registry Camp Status** | If a developer has unpaid installment dues with NOIDA/GNIDA, the Authority will not issue tripartite sub-lease permissions—leaving buyers with keys but no legal registry title. Ask whether the developer has cleared its dues (including the Amitabh Kant 25% deposit). | **Not verified by us** (Ask the developer for the Authority's dues-clearance or registry permission letter; our advisory team can help you check) |\n` +
    `| **5** | **Aging Infrastructure & Sinking Fund Deficit** | Older high-rises (8+ years) face heavy capital overhaul cycles (lift motors, DG sets, STP blowers, facade repainting). If the AOA sinking fund is underfunded, owners receive surprise lump-sum assessment bills. | **Not currently verifiable** (Private society accounting ledgers must be inspected via AOA AGM minutes) |\n\n` +
    `---\n\n` +
    `**Summary Guidance:**\n` +
    `When evaluating your shortlist, prioritize projects that verify municipal Ganga Jal supply, high carpet efficiency (>72%), and cleared Authority land dues to avoid the two largest post-possession complaints in the region.`
  )
}


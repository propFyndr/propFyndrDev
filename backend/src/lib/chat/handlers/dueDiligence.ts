import { matchProjectInText } from '../../discovery/matchProjectInText'
import { prisma } from '../../db'
import type { ChatTopicHandler, ChatChip } from '../handlerContext'

/**
 * dueDiligenceHandler
 *
 * Answers queries regarding:
 * 1. Water Source & Quality (Municipal Ganga Jal, Borewell, TDS ranges)
 * 2. Lift Safety & UP Lifts Act 2024 (Automatic Rescue Device - ARD, AMC registration)
 * 3. Registry & Amitabh Kant Policy (25% developer dues clearance, OC status)
 * 4. Environmental & Corridor Factors (Shahdara drain proximity, power supply type)
 *
 * Deterministic and grounded in database rows with zero LLM hallucination.
 */
export const dueDiligenceHandler: ChatTopicHandler = {
  id: 'due_diligence',
  description: 'Forensic Due Diligence & Living Quality: water source, TDS, UP Lifts Act 2024, Amitabh Kant dues, OC status, Shahdara drain corridor',

  matches: ctx =>
    ctx.flags.isDueDiligenceQuery === true ||
    /\b(water\s*(?:source|supply|quality|issue)|ganga\s*jal|borewell|water\s*tds|tds\s*(?:level|range|ppm)|lifts?|elevators?|up\s*lifts?\s*act|emergency\s*rescue\s*device|\bard\b|\bamc\b|amitabh\s*kant|25%\s*dues|registry\s*clearance|oc\s*status|occupancy\s*certificate|completion\s*certificate|partial\s*oc|full\s*oc|basement\s*(?:health|seepage|leakage|water|dampness)|shahdara\s*drain|drain\s*(?:corridor|impact|smell|stench)|power\s*supply\s*type|multipoint\s*connection)\b/i.test(ctx.message),

  handle: async ctx => {
    const matchedTarget =
      ctx.catalog.find(p => p.name.toLowerCase() === ctx.activeProjectName?.toLowerCase() || p.id === ctx.activeProjectName) ||
      matchProjectInText(ctx.message, ctx.catalog) ||
      (ctx.cachedProjects && ctx.cachedProjects.length > 0 ? ctx.catalog.find(p => p.id === ctx.cachedProjects[0].id) : null)

    let project = null
    if (matchedTarget) {
      project = await prisma.project.findUnique({
        where: { id: matchedTarget.id },
        include: { builder: true, unit_types: true }
      })
    }

    if (!project) {
      // General citywide/corridor standards when no specific project is identified
      const generalText = `### Noida & Greater Noida — Living Reality & Due Diligence Standards

**1. Water Source & TDS Reality** *(corridor-wide figures — typical for Noida, not verified for any one project)*
- **Noida (Sectors 1–128):** Supplied via municipal Ganga Jal (130 cusec Pratap Vihar WTP), blended with groundwater. Typical TDS around 250–450 ppm.
- **Greater Noida West (Noida Extension):** Primary supply is authority deep borewells treated through society WTPs, typically 650–950 ppm. Greater Noida Authority's 85-cusec Ganga Jal Phase 2 pipeline is under phased integration. Domestic RO is the normal fix.

**2. UP Lifts and Escalators Act 2024**
- Passed in February 2024 following Noida high-rise incidents.
- **Mandatory Requirements:** Automatic Rescue Devices (ARD) that navigate to the nearest floor during power failures, mandatory Annual Maintenance Contracts (AMC) with registered agencies, third-party audits, and ₹1 Lakh penalty for non-compliance.

**3. Registry & Amitabh Kant Committee Recommendations**
- Formulated to resolve legacy builder-authority land dues.
- Developers clearing **25% of recalculated net dues** upfront receive immediate registry permission for completed flats from Noida/Greater Noida authorities.

**4. Environmental Corridor (Shahdara Drain)**
- Societies located within 500m–1.5km of the Shahdara drain corridor experience seasonal sulfurous odors and expedited corrosion of copper coils (AC units). We track project-specific corridor distance.

Name any project (e.g. *Elite X*, *ACE Parkway*, *Godrej Woods*) to view its verified forensic scorecard.`

      ctx.send('token', { token: generalText })
      ctx.emitUiState({
        stage: 'RESEARCH',
        thinking: 'Living reality & due diligence standards verified:',
        chips: [
          { id: `chip_tax_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View UP Stamp Duty & Taxes', icon: 'file-text', analyticsId: 'chip_dd_tax', priority: 1, payload: { text: 'How much stamp duty and GST do I pay in UP?' } },
          { id: `chip_rera_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Check RERA Verification', icon: 'shield-check', analyticsId: 'chip_dd_rera', priority: 2, payload: { text: 'How do I verify UP RERA approval?' } },
          { id: `chip_rtm_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Show Ready-to-Move Flats', icon: 'check-circle', analyticsId: 'chip_dd_rtm', priority: 3, payload: { text: 'Show ready to move flats in Noida' } },
        ],
        missingFields: [],
        confidence: 'HIGH'
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return true
    }

    const msgLower = ctx.message.toLowerCase()
    const isWaterQuery = /\b(water|ganga\s*jal|borewell|tds)\b/i.test(msgLower)
    const isLiftQuery = /\b(lift|lifts|elevator|up\s*lifts?\s*act|ard|rescue\s*device|amc)\b/i.test(msgLower)
    const isLegalQuery = /\b(amitabh|kant|25%|dues|registry|oc\b|occupancy|bank|apf|loan)\b/i.test(msgLower)

    const UNVERIFIED = 'Not verified'
    const NO_RECORD = 'We do not hold a verified record for this project'

    /**
     * Each column now answers for itself.
     *
     * These shipped NOT NULL with defaults, so "nobody researched this project"
     * and "we researched it and the answer is no" were the same byte, and 253 of
     * 382 rows were the first while reading as the second. Until
     * `migrations/forensic_columns_nullable` this file inferred the difference
     * from a proxy — whether the enrichment pass had written `water_tds_range`.
     * The proxy is gone: NULL is unverified, `false` is a finding, and the two
     * are different sentences in the database as well as on the screen.
     */

    /** A column's own answer, or the honest absence — never an inferred stand-in. */
    const told = <T,>(value: T | null | undefined, whenKnown: (v: T) => string): string =>
      value === null || value === undefined ? UNVERIFIED : whenKnown(value)

    /** Is this project in the forensic docket at all? Drives the footer only. */
    const enriched =
      project.oc_status != null ||
      project.amitabh_kant_clearance != null ||
      project.water_source_type != null ||
      project.shahdara_drain_impact != null ||
      project.lift_act_compliant != null ||
      project.power_supply_type != null ||
      project.water_tds_range != null ||
      project.all_in_cost_multiplier != null
    const gapFooter = enriched
      ? ''
      : `\n\n> **What we do not hold:** ${project.name} is not yet in our forensic due-diligence docket, so the checks above are unverified for this project. We will not substitute a typical figure for a verified one. Ask for an advisory check and we will pull the authority and RERA records directly.`

    let responseMarkdown = ''

    if (isWaterQuery) {
      const waterSourceLabel =
        project.water_source ??
        (project.water_source_type === 'GANGA_JAL'
          ? 'Municipal Ganga Jal supply'
          : project.water_source_type === 'BOREWELL'
          ? 'Deep borewell groundwater'
          : project.water_source_type === 'MIXED'
          ? 'Mixed: authority borewell and central RO WTP'
          : null)
      const tdsRange = project.water_tds_range

      responseMarkdown = `### Water Source & Quality — ${project.name} (${project.sector}, ${project.city})

| Parameter | Status for this project | Ground Reality |
| :--- | :--- | :--- |
| **Primary water supply** | ${waterSourceLabel ?? UNVERIFIED} | ${waterSourceLabel ? 'Read from this project’s own utility record' : NO_RECORD} |
| **Tested TDS level** | ${tdsRange ? `**${tdsRange}**` : UNVERIFIED} | ${tdsRange ? (/(?:[6-9]\d{2}|\d{4})/.test(tdsRange) ? 'Elevated hardness; a domestic RO purifier is necessary for drinking and cooking' : 'Within acceptable municipal potability guidelines') : 'No laboratory TDS reading on file for this society'} |
| **Ganga Jal network** | ${project.water_source_type == null ? UNVERIFIED : project.water_source_type === 'GANGA_JAL' ? 'Connected' : 'Not connected — treated groundwater'} | ${project.water_source_type == null ? NO_RECORD : 'Read from this project’s own utility record'} |

> **Corridor context (typical for Noida — not verified for this project):** Noida Sectors 1–128 run largely on municipal Ganga Jal blended with groundwater; Greater Noida West still runs mainly on authority borewells treated through society WTPs while the GNIDA Phase 2 pipeline is laid. Where TDS runs high, a domestic multi-stage RO with a TDS controller is the normal fix.${gapFooter}`

    } else if (isLiftQuery) {
      const liftStatus = told(project.lift_act_compliant, v =>
        v ? 'Registered and compliant' : 'No registration on record')
      const liftsPerTower = project.lifts_per_tower ? `${project.lifts_per_tower} lifts per core/tower` : UNVERIFIED
      /**
       * `has_service_lift` is `true` on all 382 rows — zero variation, and the
       * admin form defaults it to true, so nobody has ever asserted it about a
       * specific building. A column that discriminates nothing is not evidence,
       * and "Dedicated service/stretcher lift installed" is a checkable claim
       * about a real society. `lifts_per_tower` is kept because it does vary
       * (2/3/4 across the catalogue), so somebody did enter it.
       */
      const serviceLift = UNVERIFIED

      responseMarkdown = `### Lift Safety & High-Rise Compliance — ${project.name}

| Checkpoint | Status for this project | Legal standard (UP Lifts Act 2024) |
| :--- | :--- | :--- |
| **UP Lifts Act 2024 registration** | **${liftStatus}** | Registration with the Directorate of Electrical Safety is mandatory |
| **Emergency Rescue Device (ARD)** | ${UNVERIFIED} | Statutorily required: levels the car to the nearest floor and opens the doors on power failure |
| **Maintenance & AMC** | ${UNVERIFIED} | Statutorily required: an annual maintenance contract with an accredited lift vendor |
| **Tower lift density** | ${liftsPerTower} | Drives peak-hour wait times |
| **Service / stretcher lift** | ${serviceLift} | Critical for emergency stretcher movement and goods transit |

> **What the law requires is not evidence that this building complies.** ARD and AMC are statutory obligations on every high-rise in UP; we have not inspected this society's certificates. Ask the builder or RWA for the electrical safety inspection certificate before possession — penalties run to ₹1 Lakh plus daily compounding fines.${gapFooter}`

    } else if (isLegalQuery) {
      const ocStatusMap: Record<string, string> = {
        FULL_OC: 'Full Occupancy Certificate (OC) granted',
        PHASED_OC: 'Phased OC granted for initial towers',
        APPLIED: 'OC applied with the authority (inspection stage)',
        NONE: 'No OC on record',
      }
      const ocDisplay = project.oc_status == null ? UNVERIFIED : (ocStatusMap[project.oc_status] ?? UNVERIFIED)
      const kantDisplay = told(project.amitabh_kant_clearance, v =>
        v ? '25% land dues cleared' : 'No clearance on record')
      const apfCodes = Array.isArray(project.bank_apf_codes) ? (project.bank_apf_codes as unknown[]) : []

      responseMarkdown = `### Legal, Registry & OC Verification — ${project.name}

| Parameter | Status for this project | Impact on buyer |
| :--- | :--- | :--- |
| **Occupancy Certificate (OC)** | **${ocDisplay}** | ${project.oc_status === 'FULL_OC' ? 'Direct registry and lawful move-in enabled' : 'Registry cannot complete until full OC is granted'} |
| **Amitabh Kant policy (25% dues)** | **${kantDisplay}** | ${project.amitabh_kant_clearance === true ? 'The authority has unblocked sub-lease registry for buyers here' : 'Sub-lease registry stays blocked until the developer clears 25% of recalculated net dues'} |
| **Authority dues** | ${told(project.authority_dues_cleared, v => v ? 'In good standing' : 'No clearance on record')} | Checked against the Noida / GNIDA lease record index |
| **RERA registration** | ${project.rera_number ? `**UPRERA: ${project.rera_number}**` : 'Not recorded'} | ${project.rera_number ? 'Full statutory disclosure available on the UP RERA portal' : 'We hold no RERA number for this project — verify on up-rera.in before paying anything'} |
| **Bank APF codes** | ${apfCodes.length ? `**${apfCodes.join(', ')}**` : UNVERIFIED} | An APF code means a lender has already appraised the project's title |

> **Buyer protection:** registries in Noida and Greater Noida turn on the 25% upfront land dues under the Amitabh Kant committee policy. Ask for the authority No-Dues Certificate (NDC) before final disbursement, whatever we hold on file.${gapFooter}`

    } else {
      const drainStatus = told(project.shahdara_drain_impact, v =>
        v ? 'Within the corridor buffer — seasonal odour and faster AC coil corrosion reported' : 'Outside the corridor buffer')
      const powerType = told(project.power_supply_type, v =>
        v === 'PVVNL_MULTIPOINT' ? 'PVVNL multipoint (direct discom billing)' : 'Single-point bulk supply via the society')

      responseMarkdown = `### Due Diligence Scorecard — ${project.name}

| Evaluation pillar | Status for this project | Buyer advisory |
| :--- | :--- | :--- |
| **1. Water source & TDS** | ${project.water_tds_range ?? UNVERIFIED} | ${project.water_tds_range ? 'Read from this project’s own utility record' : NO_RECORD} |
| **2. Lift safety (UP Act 2024)** | ${told(project.lift_act_compliant, v => v ? 'Registered and compliant' : 'No registration on record')} | ARD and annual AMC are statutory; ask for the inspection certificate |
| **3. Registry & land dues** | ${told(project.amitabh_kant_clearance, v => v ? '25% dues cleared' : 'No clearance on record')} | Registry opens after OC grant and authority clearance |
| **4. Shahdara drain corridor** | ${drainStatus} | ${project.shahdara_drain_impact == null ? NO_RECORD : 'Measured against the corridor buffer'} |
| **5. Electricity metering** | ${powerType} | ${project.power_supply_type === 'PVVNL_MULTIPOINT' ? 'A direct discom meter prevents RWA tariff markups' : 'A single-point connection lets the society set its own tariff'} |

> **This is a record of what we hold, not a verdict on the project.** Every row marked ${UNVERIFIED} is a gap in our docket, not a finding against the builder.${gapFooter}`
    }

    // Stream smoothly for natural rendering
    const words = responseMarkdown.split(' ')
    for (let i = 0; i < words.length; i += 8) {
      const chunk = words.slice(i, i + 8).join(' ') + (i + 8 < words.length ? ' ' : '')
      ctx.send('token', { token: chunk })
    }

    const chips: ChatChip[] = [
      {
        id: `chip_cs_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `View Cost Sheet for ${project.name}`,
        icon: 'file-text',
        analyticsId: 'chip_dd_cost',
        priority: 1,
        payload: { text: `What is the real out-of-pocket cost of ${project.name} beyond the builder's rate?` }
      },
      {
        id: `chip_rera_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `Verify RERA Details (${project.name})`,
        icon: 'shield-check',
        analyticsId: 'chip_dd_rera',
        priority: 2,
        payload: { text: `What is the RERA registration number and delivery date for ${project.name}?` }
      },
      {
        id: `chip_emi_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `Calculate Monthly EMI`,
        icon: 'calculator',
        analyticsId: 'chip_dd_emi',
        priority: 3,
        payload: { text: `Calculate monthly EMI for ${project.name}` }
      },
      {
        id: `chip_visit_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: `Schedule Site Visit`,
        icon: 'calendar',
        analyticsId: 'chip_dd_visit',
        priority: 4,
        payload: { text: `I want to schedule a site visit for ${project.name}` }
      }
    ]

    ctx.emitUiState({
      stage: 'RESEARCH',
      // HIGH is reserved for an answer read from this project's own rows. An
      // unenriched project produces a list of gaps, and labelling that HIGH is
      // the same claim the table used to make in prose.
      thinking: enriched
        ? `Forensic due diligence verified for ${project.name}:`
        : `What we hold — and do not hold — on ${project.name}:`,
      chips,
      missingFields: [],
      confidence: enriched ? 'HIGH' : 'LOW'
    })

    ctx.send('done', {
      sessionId: ctx.sessionId,
      intentState: 'SHORTLISTED',
      intent: ctx.intent,
      responseMode: 'chat'
    })
    ctx.res.end()
    return true
  }
}

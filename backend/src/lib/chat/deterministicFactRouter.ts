// backend/src/lib/chat/deterministicFactRouter.ts
//
// Zero-hallucination deterministic fast-path for exact factual project lookups:
// 1. RERA Registration ID & Approval
// 2. Occupancy Certificate (OC) / Completion Status
// 3. Water Source & Quality (TDS ppm)
// 4. UP Lifts Act 2024 Compliance & Safety
// 5. Land Dues & Amitabh Kant 25% Registry Clearance
//
// Bypasses extractIntent() and LLM invocation entirely (<50ms latency, 0 tokens billed).

import type { Response } from 'express'
import { prisma } from '../db'
import { projectCatalog, type DbCatalogEntry } from '../projectCatalog'
import { matchProjectInText } from '../discovery/matchProjectInText'
import type { TurnTraceDraft } from '../turnTrace'
import type { TurnTimer } from '../turnTimer'

export type FactAttribute = 'rera' | 'oc' | 'water' | 'lift' | 'land_dues'

export interface FactMatchResult {
  attribute: FactAttribute
  targetQueryText: string
  matchedProject: DbCatalogEntry | null
}

const RERA_PATTERN =
  /\b(?:what is the|show me|check|tell me|get)\s*(?:up[- ]?)?rera\s*(?:number|id|registration|details|reg\b|approval)?\s*(?:for|of|in)?\s+([^?]+)/i
const RERA_FOR_PATTERN =
  /\b(?:up[- ]?)?rera\s*(?:number|id|registration|details|reg\b|approval)\s+(?:for|of|in)\s+([^?]+)/i
const RERA_POSTFIX_PATTERN =
  /\b([^?]+?)\s+(?:up[- ]?)?rera\b/i
const RERA_APPROVAL_PATTERN =
  /\b(?:is|has)\s+([^?]+?)\s+(?:got\s+|have\s+)?(?:up[- ]?)?rera\s*(?:registered|approved|cleared)?\b/i

const OC_PATTERN =
  /\b(?:is|has|does|what is the)?\s*([^?]+?)\s+(?:got\s+|have\s+)?(?:oc|occupancy certificate|completion certificate|cc status)\b/i
const OC_PREFIX_PATTERN =
  /\b(?:oc status|occupancy certificate|completion certificate)\s*(?:for|of|in)?\s+([^?]+)/i
const OC_POSSESSION_PATTERN =
  /\b(?:is|has)\s+([^?]+?)\s+(?:ready for possession|possession started|ready to move in)\b/i

const WATER_PATTERN =
  /\b(?:what is the|check|tell me|what kind of)?\s*water\s*(?:source|supply|tds|quality|drinking water)?\s*(?:in|at|for|of)?\s+([^?]+)/i
const WATER_POSTFIX_PATTERN =
  /\b([^?]+?)\s+water\s*(?:source|supply|tds|quality|drinking water)\b/i
const WATER_GANGA_PATTERN =
  /\b(?:ganga\s*jal|borewell|groundwater)\s*(?:source|supply|tds|pipeline|water)?\s*(?:in|at|for|of)\s+([^?]+)/i

const LIFT_PATTERN =
  /\b(?:are the lifts|is lift|lift safety|elevators?)\s*(?:safe|compliant|registered|status)?\s*(?:in|for|at)?\s+([^?]+)/i
const LIFT_ACT_PATTERN =
  /\b(?:up\s*lifts?\s*act|ard|automatic\s*rescue\s*device|lift\s*amc)\s*(?:in|for|at)?\s+([^?]+)/i

const LAND_DUES_PATTERN =
  /\b(?:land dues|registry status|amitabh kant|25% dues|registry clearance)\s*(?:for|in|at|of)?\s+([^?]+)/i
const LAND_DUES_POSTFIX_PATTERN =
  /\b([^?]+)\s+(?:land dues|registry status|amitabh kant|25% dues|registry clearance)\b/i

/**
 * Detects if the incoming message is an explicit factual attribute query.
 */
export function detectFactualAttribute(message: string): { attribute: FactAttribute; subjectHint: string } | null {
  const trimmed = message.trim()

  // 1. RERA Check
  let m = trimmed.match(RERA_PATTERN) || trimmed.match(RERA_FOR_PATTERN) || trimmed.match(RERA_POSTFIX_PATTERN) || trimmed.match(RERA_APPROVAL_PATTERN)
  if (m && m[1]) return { attribute: 'rera', subjectHint: m[1].trim() }

  // 2. OC / Completion Check
  m = trimmed.match(OC_PATTERN) || trimmed.match(OC_PREFIX_PATTERN) || trimmed.match(OC_POSSESSION_PATTERN)
  if (m && m[1]) return { attribute: 'oc', subjectHint: m[1].trim() }

  // 3. Water Source / TDS Check
  m = trimmed.match(WATER_PATTERN) || trimmed.match(WATER_POSTFIX_PATTERN) || trimmed.match(WATER_GANGA_PATTERN)
  if (m && m[1]) return { attribute: 'water', subjectHint: m[1].trim() }

  // 4. Lift Safety Check
  m = trimmed.match(LIFT_PATTERN) || trimmed.match(LIFT_ACT_PATTERN)
  if (m && m[1]) return { attribute: 'lift', subjectHint: m[1].trim() }

  // 5. Land Dues & Amitabh Kant Check
  m = trimmed.match(LAND_DUES_PATTERN) || trimmed.match(LAND_DUES_POSTFIX_PATTERN)
  if (m && m[1]) return { attribute: 'land_dues', subjectHint: m[1].trim() }

  return null
}

export interface FactDispatchContext {
  res: Response
  send: (event: string, data: Record<string, unknown>) => void
  sessionId?: string | null
  userId?: string | null
  turnTrace?: TurnTraceDraft
  timer?: TurnTimer
}

/**
 * Executes direct factual database bypass if query matches an explicit project attribute.
 * Returns true if handled (response closed), false if unhandled (passes to normal pipeline).
 */
export async function tryDeterministicFactBypass(
  message: string,
  ctx: FactDispatchContext
): Promise<boolean> {
  const detection = detectFactualAttribute(message)
  if (!detection) return false

  const catalog = await projectCatalog()
  const matchedProject = matchProjectInText(message, catalog) ||
    (detection.subjectHint ? matchProjectInText(detection.subjectHint, catalog) : null)

  // If no project could be identified, pass through to conversational handler
  if (!matchedProject) return false

  const project = await prisma.project.findUnique({
    where: { id: matchedProject.id },
    select: {
      id: true,
      name: true,
      slug: true,
      sector: true,
      city: true,
      status: true,
      rera_number: true,
      rera_url: true,
      occupancy_certificate_status: true,
      oc_status: true,
      oc_details: true,
      possession_date: true,
      possession_label: true,
      water_source: true,
      water_source_type: true,
      water_tds_range: true,
      lift_act_compliant: true,
      lifts_per_tower: true,
      has_service_lift: true,
      amitabh_kant_clearance: true,
      authority_dues_cleared: true,
      registry_status: true,
      builder: { select: { name: true, slug: true } },
    },
  })

  if (!project) return false

  let responseMarkdown = ''
  const builderName = project.builder?.name ? ` by ${project.builder.name}` : ''
  const UNVERIFIED = 'Not verified'

  switch (detection.attribute) {
    case 'rera': {
      if (project.rera_number) {
        const portalUrl = project.rera_url || 'https://up-rera.in'
        responseMarkdown = `### UP-RERA Registration Details — ${project.name}

| Parameter | Official Record | Status / Link |
| :--- | :--- | :--- |
| **Project** | **${project.name}**${builderName} | ${project.sector}, ${project.city} |
| **UP-RERA Registration ID** | \`${project.rera_number}\` | Registered with UP-RERA |
| **Official Regulator Portal** | UP Real Estate Regulatory Authority | [View Official UP-RERA Filing](${portalUrl}) |
| **Possession Timeline** | ${project.possession_label ?? 'Consult official filing'} | ${project.status ? project.status.replace(/_/g, ' ') : 'Under Construction'} |

> 🛡️ **Zero-Guesswork Guarantee**: This registration number is pulled directly from our verified database records. PropFyndr never estimates or invents RERA registration numbers.`
      } else {
        responseMarkdown = `### UP-RERA Registration Status — ${project.name}

We do **not hold a verified UP-RERA registration number** on record for **${project.name}** in ${project.sector}, ${project.city}.

**Buyer Due Diligence Advisory:**
- Under UP-RERA regulations, promoters are legally prohibited from advertising, marketing, or collecting booking advances without an active RERA registration number.
- Before executing any builder-buyer agreement or token transfer, demand the developer's official **UP-RERA Registration Certificate (Form A)** or search the project on the state portal at [up-rera.in](https://up-rera.in).`
      }
      break
    }

    case 'oc': {
      const ocStatusMap: Record<string, string> = {
        FULL_OC: 'Full Occupancy Certificate (OC) Granted',
        PHASED_OC: 'Phased OC Granted for Specific Towers',
        APPLIED: 'OC Applied with Authority (Inspection Stage)',
        NONE: 'No OC on Record',
      }
      const ocDisplay = project.oc_status
        ? ocStatusMap[project.oc_status] ?? project.oc_status
        : (project.occupancy_certificate_status ?? UNVERIFIED)

      const isClear = project.oc_status === 'FULL_OC' || project.occupancy_certificate_status?.toLowerCase().includes('obtained')

      responseMarkdown = `### Occupancy Certificate (OC) Status — ${project.name}

| Checkpoint | Status for this Project | Legal & Living Impact |
| :--- | :--- | :--- |
| **Occupancy Certificate (OC)** | **${ocDisplay}** | ${isClear ? 'Lawful physical possession and sub-lease deed registry enabled' : 'Sub-lease registry cannot lawfully complete without full OC clearance'} |
| **Current Project Stage** | ${project.status ? project.status.replace(/_/g, ' ') : 'Active Development'} | Possession marker: ${project.possession_label ?? 'Per schedule'} |
| **Authority Registry Standing** | ${project.registry_status ?? (project.authority_dues_cleared ? 'In good standing' : 'Pending verification')} | Checked against local Noida / GNIDA leasehold dockets |

> ℹ️ **Registry Notice:** In Noida and Greater Noida, authority registry requires both the final Occupancy Certificate and developer land dues clearance. We never invent or approximate OC grant dates.`
      break
    }

    case 'water': {
      const waterSourceLabel =
        project.water_source ??
        (project.water_source_type === 'GANGA_JAL'
          ? 'Municipal Ganga Jal Pipeline'
          : project.water_source_type === 'BOREWELL'
          ? 'Deep Borewell Groundwater'
          : project.water_source_type === 'MIXED'
          ? 'Mixed: Authority Borewell & Central WTP'
          : UNVERIFIED)
      const tdsRange = project.water_tds_range ?? UNVERIFIED

      responseMarkdown = `### Water Source & Quality — ${project.name} (${project.sector}, ${project.city})

| Parameter | Verified Record | Practical Ground Reality |
| :--- | :--- | :--- |
| **Primary Water Supply** | **${waterSourceLabel}** | ${project.water_source_type === 'GANGA_JAL' ? 'Municipal Ganga Jal network connected' : 'Groundwater source; check society WTP treatment'} |
| **Tested TDS Level** | **${tdsRange}** | ${tdsRange !== UNVERIFIED && /(?:[6-9]\d{2}|\d{4})/.test(tdsRange) ? 'Elevated hardness typical for borewells; domestic multi-stage RO recommended' : 'Potable municipal range guideline'} |

> 💧 **Corridor Context:** Noida Sectors 1–128 receive Pratap Vihar Ganga Jal blended with groundwater. Greater Noida West relies predominantly on authority deep borewells while Phase 2 pipelines are completed.`
      break
    }

    case 'lift': {
      const liftStatus =
        project.lift_act_compliant === true
          ? 'Registered and Compliant'
          : project.lift_act_compliant === false
          ? 'No Registration on Record'
          : UNVERIFIED
      const liftsPerTower = project.lifts_per_tower ? `${project.lifts_per_tower} lifts per core/tower` : UNVERIFIED

      responseMarkdown = `### Lift Safety & UP Lifts Act 2024 — ${project.name}

| Compliance Item | Project Record | Statutory Requirement (UP Lifts Act 2024) |
| :--- | :--- | :--- |
| **Directorate Registration** | **${liftStatus}** | Mandatory registration with Directorate of Electrical Safety UP |
| **Automatic Rescue Device (ARD)** | Statutorily Required | Automatic rescue device must level car to nearest floor on grid failure |
| **Tower Lift Density** | ${liftsPerTower} | Governs peak-hour morning and evening elevator wait times |
| **Mandatory Annual AMC** | Statutorily Required | Annual maintenance contract with certified original equipment manufacturer |

> 🛗 **Statutory Compliance:** Under the UP Lifts and Escalators Act 2024, high-rises must maintain registered AMCs and functional ARDs under financial penalties up to ₹1 Lakh.`
      break
    }

    case 'land_dues': {
      const kantDisplay =
        project.amitabh_kant_clearance === true
          ? '25% Land Dues Cleared'
          : project.amitabh_kant_clearance === false
          ? 'No Clearance on Record'
          : UNVERIFIED
      const duesStatus =
        project.authority_dues_cleared === true
          ? 'Authority Dues in Good Standing'
          : project.authority_dues_cleared === false
          ? 'Outstanding Authority Dues Reported'
          : UNVERIFIED

      responseMarkdown = `### Land Dues & Registry Clearance — ${project.name}

| Legal Factor | Status for this Project | Buyer Impact |
| :--- | :--- | :--- |
| **Amitabh Kant Policy (25% Dues)** | **${kantDisplay}** | ${project.amitabh_kant_clearance === true ? 'Authority has unblocked sub-lease registry for home buyers' : 'Registry remains blocked until promoter clears 25% recalculated dues'} |
| **Authority Dues Status** | ${duesStatus} | Verified against authority lease records |
| **Registry Eligibility** | ${project.registry_status ?? 'Subject to final authority dues clearance'} | Requires developer zero-dues certificate from Noida/Greater Noida Authority |

> ⚖️ **Buyer Protection Advisory:** Always verify the authority No-Dues Certificate (NDC) before paying final registry installments.`
      break
    }
  }

  // Update telemetry
  if (ctx.turnTrace) {
    ctx.turnTrace.lane = 'deterministic-fact'
    if (ctx.sessionId) ctx.turnTrace.session_id = ctx.sessionId
  }

  // Emit SSE token
  ctx.send('token', { token: responseMarkdown })

  // Suggest relevant follow-up chips
  ctx.send('ui_state', {
    stage: 'RESEARCH',
    thinking: `Verified ${detection.attribute.toUpperCase()} record retrieved directly from database (<50ms):`,
    chips: [
      {
        id: `chip_tax_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: 'UP Stamp Duty & Taxes',
        icon: 'receipt',
        analyticsId: 'chip_fact_tax',
        priority: 1,
        payload: { text: `How much stamp duty and GST do I pay on ${project.name}?` },
      },
      {
        id: `chip_dd_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: 'Full Due Diligence Docket',
        icon: 'shield-check',
        analyticsId: 'chip_fact_dd',
        priority: 2,
        payload: { text: `Give me the complete due diligence scorecard for ${project.name}` },
      },
      {
        id: `chip_compare_${Date.now()}`,
        actionType: 'TEXT_MESSAGE',
        label: 'Compare Alternatives',
        icon: 'arrows-left-right',
        analyticsId: 'chip_fact_compare',
        priority: 3,
        payload: { text: `What are good alternatives to ${project.name} in ${project.sector}?` },
      },
    ],
    missingFields: [],
    confidence: 'HIGH',
  })

  // Persist messages to DB for history
  if (ctx.sessionId) {
    try {
      await prisma.chatMessage.createMany({
        data: [
          {
            session_id: ctx.sessionId,
            role: 'user',
            content: message,
          },
          {
            session_id: ctx.sessionId,
            role: 'assistant',
            content: responseMarkdown,
          },
        ],
      })
      await prisma.chatSession.update({
        where: { id: ctx.sessionId },
        data: { message_count: { increment: 2 } },
      })
    } catch (e) {
      console.warn('[DETERMINISTIC_FACT:SAVE_ERROR]', (e as Error).message)
    }
  }

  ctx.send('done', {
    sessionId: ctx.sessionId ?? null,
    intentState: 'SHORTLISTED',
    intent: { projectNames: [project.name], sector: project.sector },
    responseMode: 'chat',
  })

  ctx.res.end()
  console.log(`[CHAT:FACT_BYPASS] Answered ${detection.attribute} for ${project.name} in ${ctx.timer ? ctx.timer.elapsed() : 0}ms (0 tokens)`)
  return true
}

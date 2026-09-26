// backend/src/lib/chat/handlers/comparisonHandler.ts
import type { ChatTopicHandler } from '../handlerContext'
import { prisma } from '../../db'
import { redactProject } from '../../projectExposure'

export interface ForensicComparisonVector {
  vector: string
  label: string
  p1Value: string
  p2Value: string
  winner: 'p1' | 'p2' | 'tie'
  note?: string
}

const NOT_ON_RECORD = 'Not on record'

export function buildForensicVectors(p1: any, p2: any): ForensicComparisonVector[] {
  const vectors: ForensicComparisonVector[] = []

  // 1. True Landed Cost Rate
  const mult1 = p1.all_in_cost_multiplier || 1.30
  const mult2 = p2.all_in_cost_multiplier || 1.30
  const baseRate1 = p1.price_per_sqft || 0
  const baseRate2 = p2.price_per_sqft || 0
  const landedRate1 = baseRate1 ? Math.round(baseRate1 * mult1) : 0
  const landedRate2 = baseRate2 ? Math.round(baseRate2 * mult2) : 0

  vectors.push({
    vector: 'landed_cost',
    label: 'True Landed Cost Rate',
    p1Value: landedRate1 ? `₹${landedRate1.toLocaleString('en-IN')}/sq.ft (+${Math.round((mult1 - 1) * 100)}%${p1.all_in_cost_multiplier ? '' : ', estimated'})` : (p1.price_range_label || 'On request'),
    p2Value: landedRate2 ? `₹${landedRate2.toLocaleString('en-IN')}/sq.ft (+${Math.round((mult2 - 1) * 100)}%${p2.all_in_cost_multiplier ? '' : ', estimated'})` : (p2.price_range_label || 'On request'),
    // No advantage awarded on an assumed multiplier.
    winner: landedRate1 && landedRate2 && p1.all_in_cost_multiplier && p2.all_in_cost_multiplier ? (landedRate1 < landedRate2 ? 'p1' : landedRate1 > landedRate2 ? 'p2' : 'tie') : 'tie',
    note: 'Includes Base + UP Stamp Duty (7%), Registration, Dual-prepaid meter & IFMS charges'
  })

  // 2. Registry Standing & Land Dues
  // A null column is "not on record" — never a default verdict (CLAUDE.md § Four Tiers).
  const reg = (p: any) => p.amitabh_kant_clearance === true ? 'Cleared (Sub-lease Active)'
    : p.oc_status === 'FULL_OC' ? 'Full OC'
    : p.oc_status === 'PHASED_OC' ? 'Phased OC'
    : p.oc_status === 'APPLIED' ? 'OC applied'
    : p.amitabh_kant_clearance === false ? 'Authority dues pending'
    : NOT_ON_RECORD
  const reg1 = reg(p1)
  const reg2 = reg(p2)
  vectors.push({
    vector: 'registry',
    label: 'Sub-Lease Registry Standing',
    p1Value: reg1,
    p2Value: reg2,
    winner: (p1.amitabh_kant_clearance === true && p2.amitabh_kant_clearance === false) ? 'p1' : (p1.amitabh_kant_clearance === false && p2.amitabh_kant_clearance === true) ? 'p2' : 'tie',
    note: 'Clearance of 25% Authority dues under Amitabh Kant Committee policy'
  })

  // 3. Drinking Water Reality & TDS
  const water = (p: any) => {
    const label = p.water_source_type === 'GANGA_JAL' ? 'Ganga Jal' : p.water_source_type === 'BOREWELL' ? 'Borewell' : p.water_source_type === 'MIXED' ? 'Mixed supply' : null
    if (!label) return NOT_ON_RECORD
    return p.water_tds_range ? `${label} (${p.water_tds_range})` : label
  }
  const water1 = water(p1)
  const water2 = water(p2)
  vectors.push({
    vector: 'water',
    label: 'Tap Water Source & TDS',
    p1Value: water1,
    p2Value: water2,
    winner: p1.water_source_type === 'GANGA_JAL' && p2.water_source_type === 'BOREWELL' ? 'p1' : p2.water_source_type === 'GANGA_JAL' && p1.water_source_type === 'BOREWELL' ? 'p2' : 'tie',
    note: 'Ganga Jal municipal supply maintains low TDS (sweet); deep borewell groundwater requires heavy RO'
  })

  // 4. Environmental Corridor (Shahdara Drain)
  const drain = (p: any) => p.shahdara_drain_impact === true ? 'Within buffer corridor (AC corrosion risk)' : p.shahdara_drain_impact === false ? 'Outside buffer corridor' : NOT_ON_RECORD
  const drain1 = drain(p1)
  const drain2 = drain(p2)
  vectors.push({
    vector: 'environment',
    label: 'Shahdara Drain Corridor',
    p1Value: drain1,
    p2Value: drain2,
    winner: p1.shahdara_drain_impact === false && p2.shahdara_drain_impact === true ? 'p1' : p1.shahdara_drain_impact === true && p2.shahdara_drain_impact === false ? 'p2' : 'tie',
    note: 'Corrosion from airborne H2S gas within 1.5 km of unsealed drain channels'
  })

  // 5. UP Lifts Act 2024 Compliance
  const lift = (p: any) => p.lift_act_compliant === true ? 'Registered on updeslift.org' : p.lift_act_compliant === false ? 'Registration pending' : NOT_ON_RECORD
  const lift1 = lift(p1)
  const lift2 = lift(p2)
  vectors.push({
    vector: 'lifts',
    label: 'UP Lifts Act 2024 Compliance',
    p1Value: lift1,
    p2Value: lift2,
    winner: p1.lift_act_compliant === true && p2.lift_act_compliant === false ? 'p1' : p1.lift_act_compliant === false && p2.lift_act_compliant === true ? 'p2' : 'tie',
    note: 'Mandatory OEM AMC, Auto-Rescue Device (ARD), and third-party inspection registration'
  })

  // 6. Density & Open Space
  const density1 = p1.total_units && p1.land_area_acres ? `${Math.round(p1.total_units / p1.land_area_acres)} units/acre` : (p1.open_space_pct ? `${p1.open_space_pct}% Open` : NOT_ON_RECORD)
  const density2 = p2.total_units && p2.land_area_acres ? `${Math.round(p2.total_units / p2.land_area_acres)} units/acre` : (p2.open_space_pct ? `${p2.open_space_pct}% Open` : NOT_ON_RECORD)
  const dVal1 = p1.total_units && p1.land_area_acres ? Math.round(p1.total_units / p1.land_area_acres) : 0
  const dVal2 = p2.total_units && p2.land_area_acres ? Math.round(p2.total_units / p2.land_area_acres) : 0
  vectors.push({
    vector: 'density',
    label: 'Density per Acre',
    p1Value: density1,
    p2Value: density2,
    winner: dVal1 && dVal2 ? (dVal1 < dVal2 ? 'p1' : dVal1 > dVal2 ? 'p2' : 'tie') : 'tie',
    note: 'Lower units per acre means less clubhouse crowding and more open green space'
  })

  // 7. Carpet Area Loading
  const u1 = p1.unit_types?.[0]
  const u2 = p2.unit_types?.[0]
  const load1 = u1?.super_area_sqft && u1?.carpet_area_sqft ? `${Math.round(((u1.super_area_sqft - u1.carpet_area_sqft) / u1.super_area_sqft) * 100)}% loading` : NOT_ON_RECORD
  const load2 = u2?.super_area_sqft && u2?.carpet_area_sqft ? `${Math.round(((u2.super_area_sqft - u2.carpet_area_sqft) / u2.super_area_sqft) * 100)}% loading` : NOT_ON_RECORD
  vectors.push({
    vector: 'loading',
    label: 'Carpet Area Efficiency',
    p1Value: load1,
    p2Value: load2,
    winner: 'tie',
    note: 'Common space deduction (lobbies, stairwells, and service shafts)'
  })

  // 8. Delivery Track Record
  const del1 = p1.builder?.average_delay_months != null ? `${p1.builder.average_delay_months} mo avg delay` : NOT_ON_RECORD
  const del2 = p2.builder?.average_delay_months != null ? `${p2.builder.average_delay_months} mo avg delay` : NOT_ON_RECORD
  vectors.push({
    vector: 'delivery',
    label: 'Builder Delivery Track Record',
    p1Value: del1,
    p2Value: del2,
    winner: (p1.builder?.average_delay_months != null && p2.builder?.average_delay_months != null)
      ? (p1.builder.average_delay_months < p2.builder.average_delay_months ? 'p1' : p1.builder.average_delay_months > p2.builder.average_delay_months ? 'p2' : 'tie')
      : 'tie',
    note: 'Historical delivery track record across builder portfolio'
  })

  return vectors
}

export const comparisonHandler: ChatTopicHandler = {
  id: 'forensic_comparison',
  description: 'Side-by-side forensic comparison across 8 due diligence vectors',

  matches: ctx => {
    // "just tell me which one you'd buy" wants a verdict; a head-to-head table
    // is the pros/cons dump the buyer explicitly declined.
    if (ctx.flags.pickOneFromShown) return false
    if (ctx.flags.isCompareRequest) return true
    const q = ctx.message.toLowerCase()
    return /\b(compare|versus|\bvs\b|difference between)\b/i.test(q) && (ctx.intent.projectNames?.length ?? 0) >= 2
  },

  handle: async ctx => {
    const rawNames = ctx.intent.projectNames || []
    if (rawNames.length < 2) return false

    const [p1Raw, p2Raw] = rawNames.slice(0, 2)
    // Exact name first. `contains` alone let a short name like "Gaur" resolve
    // to an arbitrary project — or both names to the same one — and the
    // handler then printed a confident head-to-head table.
    const resolve = async (raw: string) =>
      (await prisma.project.findFirst({
        where: { name: { equals: raw, mode: 'insensitive' } },
        include: { builder: true, unit_types: { take: 3 } },
      })) ??
      prisma.project.findFirst({
        where: { OR: [{ name: { contains: raw, mode: 'insensitive' } }, { slug: { contains: raw, mode: 'insensitive' } }] },
        orderBy: { name: 'asc' },
        include: { builder: true, unit_types: { take: 3 } },
      })
    const [p1, p2] = await Promise.all([resolve(p1Raw), resolve(p2Raw)])

    if (!p1 || !p2 || p1.id === p2.id) return false

    const vectors = buildForensicVectors(p1, p2)

    const tableRows = vectors.map(v => {
      const adv1 = v.winner === 'p1' ? ' **(Advantage)**' : ''
      const adv2 = v.winner === 'p2' ? ' **(Advantage)**' : ''
      return `| **${v.label}** | ${v.p1Value}${adv1} | ${v.p2Value}${adv2} |`
    }).join('\n')

    const summaryText = `### Head-to-Head Forensic Battle: ${p1.name} vs ${p2.name}

| Forensic Vector | ${p1.name} | ${p2.name} |
| :--- | :--- | :--- |
${tableRows}

> **PropFyndr Advisory Verdict:**
> - Compare landed cost (stamp duty, registration and charges), not the advertised base selling price.
> - Verify UP Lifts Act registration and Amitabh Kant land dues before placing a token deposit.`

    ctx.send('token', { token: summaryText })

    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Forensic battle comparison: ${p1.name} vs ${p2.name}`,
      chips: [
        { id: `chip_dossier_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Generate Family Deal Dossier', icon: 'share', analyticsId: 'chip_dossier', priority: 1, payload: { text: `Generate a family deal dossier comparing ${p1.name} and ${p2.name}` } },
        { id: `chip_visit_${p1.slug}`, actionType: 'TEXT_MESSAGE', label: `Book Visit (${p1.name.slice(0, 14)})`, icon: 'calendar', analyticsId: 'chip_v1', priority: 2, payload: { text: `Schedule site visit for ${p1.name}` } },
        { id: `chip_visit_${p2.slug}`, actionType: 'TEXT_MESSAGE', label: `Book Visit (${p2.name.slice(0, 14)})`, icon: 'calendar', analyticsId: 'chip_v2', priority: 3, payload: { text: `Schedule site visit for ${p2.name}` } },
      ],
      confidence: 'HIGH',
    })

    ctx.send('done', {
      sessionId: ctx.sessionId,
      intentState: 'SHORTLISTED',
      intent: ctx.intent,
      responseMode: 'comparison',
      comparisonProjects: [redactProject(p1 as any), redactProject(p2 as any)],
    })

    ctx.res.end()
  },
}

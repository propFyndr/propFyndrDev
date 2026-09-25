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
    p1Value: landedRate1 ? `₹${landedRate1.toLocaleString('en-IN')}/sq.ft (+${Math.round((mult1 - 1) * 100)}%)` : (p1.price_range_label || 'On request'),
    p2Value: landedRate2 ? `₹${landedRate2.toLocaleString('en-IN')}/sq.ft (+${Math.round((mult2 - 1) * 100)}%)` : (p2.price_range_label || 'On request'),
    winner: landedRate1 && landedRate2 ? (landedRate1 < landedRate2 ? 'p1' : landedRate1 > landedRate2 ? 'p2' : 'tie') : 'tie',
    note: 'Includes Base + UP Stamp Duty (7%), Registration, Dual-prepaid meter & IFMS charges'
  })

  // 2. Registry Standing & Land Dues
  const reg1 = p1.amitabh_kant_clearance ? 'Cleared (Sub-lease Active)' : (p1.oc_status === 'FULL_OC' ? 'Full OC' : 'Dues Pending / Phased OC')
  const reg2 = p2.amitabh_kant_clearance ? 'Cleared (Sub-lease Active)' : (p2.oc_status === 'FULL_OC' ? 'Full OC' : 'Dues Pending / Phased OC')
  vectors.push({
    vector: 'registry',
    label: 'Sub-Lease Registry Standing',
    p1Value: reg1,
    p2Value: reg2,
    winner: (p1.amitabh_kant_clearance && !p2.amitabh_kant_clearance) ? 'p1' : (!p1.amitabh_kant_clearance && p2.amitabh_kant_clearance) ? 'p2' : 'tie',
    note: 'Clearance of 25% Authority dues under Amitabh Kant Committee policy'
  })

  // 3. Drinking Water Reality & TDS
  const water1 = p1.water_source_type === 'GANGA_JAL' ? `Ganga Jal (${p1.water_tds_range || '150-300 ppm'})` : `Borewell (${p1.water_tds_range || '> 1200 ppm'})`
  const water2 = p2.water_source_type === 'GANGA_JAL' ? `Ganga Jal (${p2.water_tds_range || '150-300 ppm'})` : `Borewell (${p2.water_tds_range || '> 1200 ppm'})`
  vectors.push({
    vector: 'water',
    label: 'Tap Water Source & TDS',
    p1Value: water1,
    p2Value: water2,
    winner: p1.water_source_type === 'GANGA_JAL' && p2.water_source_type !== 'GANGA_JAL' ? 'p1' : p2.water_source_type === 'GANGA_JAL' && p1.water_source_type !== 'GANGA_JAL' ? 'p2' : 'tie',
    note: 'Ganga Jal municipal supply maintains low TDS (sweet); deep borewell groundwater requires heavy RO'
  })

  // 4. Environmental Corridor (Shahdara Drain)
  const drain1 = p1.shahdara_drain_impact ? 'Within buffer corridor (AC corrosion risk)' : 'Safe setback distance'
  const drain2 = p2.shahdara_drain_impact ? 'Within buffer corridor (AC corrosion risk)' : 'Safe setback distance'
  vectors.push({
    vector: 'environment',
    label: 'Shahdara Drain Corridor',
    p1Value: drain1,
    p2Value: drain2,
    winner: !p1.shahdara_drain_impact && p2.shahdara_drain_impact ? 'p1' : p1.shahdara_drain_impact && !p2.shahdara_drain_impact ? 'p2' : 'tie',
    note: 'Corrosion from airborne H2S gas within 1.5 km of unsealed drain channels'
  })

  // 5. UP Lifts Act 2024 Compliance
  const lift1 = p1.lift_act_compliant ? 'Registered on updeslift.org' : 'Registration pending'
  const lift2 = p2.lift_act_compliant ? 'Registered on updeslift.org' : 'Registration pending'
  vectors.push({
    vector: 'lifts',
    label: 'UP Lifts Act 2024 Compliance',
    p1Value: lift1,
    p2Value: lift2,
    winner: p1.lift_act_compliant && !p2.lift_act_compliant ? 'p1' : !p1.lift_act_compliant && p2.lift_act_compliant ? 'p2' : 'tie',
    note: 'Mandatory OEM AMC, Auto-Rescue Device (ARD), and third-party inspection registration'
  })

  // 6. Density & Open Space
  const density1 = p1.total_units && p1.land_area_acres ? `${Math.round(p1.total_units / p1.land_area_acres)} units/acre` : (p1.open_space_pct ? `${p1.open_space_pct}% Open` : 'Standard')
  const density2 = p2.total_units && p2.land_area_acres ? `${Math.round(p2.total_units / p2.land_area_acres)} units/acre` : (p2.open_space_pct ? `${p2.open_space_pct}% Open` : 'Standard')
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
  const load1 = u1?.super_area_sqft && u1?.carpet_area_sqft ? `${Math.round(((u1.super_area_sqft - u1.carpet_area_sqft) / u1.super_area_sqft) * 100)}% loading` : '~30% (Standard)'
  const load2 = u2?.super_area_sqft && u2?.carpet_area_sqft ? `${Math.round(((u2.super_area_sqft - u2.carpet_area_sqft) / u2.super_area_sqft) * 100)}% loading` : '~30% (Standard)'
  vectors.push({
    vector: 'loading',
    label: 'Carpet Area Efficiency',
    p1Value: load1,
    p2Value: load2,
    winner: 'tie',
    note: 'Common space deduction (lobbies, stairwells, and service shafts)'
  })

  // 8. Delivery Track Record
  const del1 = p1.builder?.average_delay_months != null ? `${p1.builder.average_delay_months} mo avg delay` : (p1.possession_label || 'Track record on file')
  const del2 = p2.builder?.average_delay_months != null ? `${p2.builder.average_delay_months} mo avg delay` : (p2.possession_label || 'Track record on file')
  vectors.push({
    vector: 'delivery',
    label: 'Builder Delivery Track Record',
    p1Value: del1,
    p2Value: del2,
    winner: (p1.builder?.average_delay_months != null && p2.builder?.average_delay_months != null)
      ? (p1.builder.average_delay_months < p2.builder.average_delay_months ? 'p1' : 'p2')
      : 'tie',
    note: 'Historical delivery track record across builder portfolio'
  })

  return vectors
}

export const comparisonHandler: ChatTopicHandler = {
  id: 'forensic_comparison',
  description: 'Side-by-side forensic comparison across 8 due diligence vectors',

  matches: ctx => {
    if (ctx.flags.isCompareRequest) return true
    const q = ctx.message.toLowerCase()
    return /\b(compare|versus|\bvs\b|difference between)\b/i.test(q) && (ctx.intent.projectNames?.length ?? 0) >= 2
  },

  handle: async ctx => {
    const rawNames = ctx.intent.projectNames || []
    if (rawNames.length < 2) return false

    const [p1Raw, p2Raw] = rawNames.slice(0, 2)
    const [p1, p2] = await Promise.all([
      prisma.project.findFirst({
        where: { OR: [{ name: { contains: p1Raw, mode: 'insensitive' } }, { slug: { contains: p1Raw, mode: 'insensitive' } }] },
        include: { builder: true, unit_types: { take: 3 } },
      }),
      prisma.project.findFirst({
        where: { OR: [{ name: { contains: p2Raw, mode: 'insensitive' } }, { slug: { contains: p2Raw, mode: 'insensitive' } }] },
        include: { builder: true, unit_types: { take: 3 } },
      }),
    ])

    if (!p1 || !p2) return false

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
> - Review the True Landed Cost (+28–35% multiplier) before evaluating advertised Base Selling Prices.
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

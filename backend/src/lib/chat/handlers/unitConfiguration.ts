import type { ChatTopicHandler } from '../handlerContext'
import { prisma } from '../../db'
import { unverified } from '../../factPresentation'

/**
 * "What sizes / layouts / how many balconies does X have?"
 *
 * The branch this replaces read `(u as any)?.balconies_count`. That column does
 * not exist — UnitType.balconies does — so the expression was always undefined
 * and the fallback beside it fired on every single request:
 *
 *     : (u.bhk >= 3 ? '3 Balconies' : '2 Balconies')
 *
 * Every balcony count this product has ever shown a buyer was derived from the
 * bedroom count, not from data. Alongside it the handler invented per-BHK prose
 * describing balconies nobody had recorded ("sit-out deck overlooking greens",
 * "wrap-around corner balcony"), fell back to literal area ranges
 * ('980–1,150 sq.ft', '1,480–1,750 sq.ft') when a unit had no measurement, and
 * closed every answer with "All floor plans strictly conform to sanctioned UP
 * RERA carpet area norms" — a compliance assertion made about every project
 * regardless of what we hold.
 *
 * Everything below reads from UnitType. A missing measurement shows a dash, and
 * the one derived figure — carpet from super area — is labelled as an estimate
 * rather than presented as a measurement.
 */

const NOT_RECORDED = '—'

/** carpet ÷ super. Only used when the real carpet figure is absent. */
const CARPET_RATIO = 0.7

function sqft(value: number | null | undefined): string {
  return value == null ? NOT_RECORDED : `${value.toLocaleString('en-IN')} sq.ft`
}

function price(min: number | null, max: number | null): string {
  if (min == null) return NOT_RECORDED
  return max != null && max > min ? `₹${min}–${max} Cr` : `₹${min} Cr`
}

export function calculateCarpetLoading(superSqft: number, carpetSqft: number): number {
  if (!superSqft || !carpetSqft || superSqft <= carpetSqft) return 0
  return Math.round(((superSqft - carpetSqft) / superSqft) * 100)
}

export function calculateEffectiveCarpetRate(priceCr: number, carpetSqft: number): number {
  if (!priceCr || !carpetSqft || carpetSqft <= 0) return 0
  return Math.round((priceCr * 1e7) / carpetSqft)
}

export function calculateElevatorCongestionIndex(
  totalUnits?: number | null,
  totalTowers?: number | null,
  liftsPerTower: number = 3
): { unitsPerLift: number | null; rating: string } {
  if (!totalUnits || !totalTowers || totalTowers === 0) {
    return { unitsPerLift: null, rating: 'Standard provisioning' }
  }
  const unitsPerTower = Math.round(totalUnits / totalTowers)
  const unitsPerLift = Math.round(unitsPerTower / liftsPerTower)
  const rating = unitsPerLift <= 35
    ? 'Low Congestion (Ultra-Luxury / Fast Morning Transit)'
    : unitsPerLift <= 50
    ? 'Moderate Transit (Standard NCR High-Rise)'
    : 'High Density (Peak Rush Hour Delays Expected)'
  return { unitsPerLift, rating }
}

export const unitConfigurationHandler: ChatTopicHandler = {
  id: 'unit_configuration',
  description: 'Unit sizes, carpet area, balconies and layout per configuration',

  // Declines a multi-topic message so the generic grounded answer can
  // cover every part of it — see singleTopic in chat-router.ts.
  matches: ctx =>
    ctx.flags.singleTopic === true &&
    ctx.flags.isConfigurationQuery === true &&
    ctx.flags.isCompareRequest !== true &&
    ctx.flags.hasSingleNamedProject === true,

  handle: async ctx => {
    const named = Array.isArray(ctx.intent.projectNames) ? String(ctx.intent.projectNames[0] ?? '') : ''
    if (!named) return false

    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { name: { contains: named, mode: 'insensitive' } },
          { slug: { contains: named, mode: 'insensitive' } },
        ],
      },
      include: { unit_types: { orderBy: { bhk: 'asc' } } },
    })

    if (!project) return false // the unknown-project path handles this properly

    const units = project.unit_types
    if (units.length === 0) {
      ctx.send('token', {
        token: `### Configurations — ${project.name}\n\n${unverified('unit configurations', project.name)}`,
      })
      ctx.emitUiState({
        stage: 'RESEARCH',
        thinking: `Configurations not on record for ${project.name}:`,
        chips: [],
        missingFields: ['unit_types'],
        confidence: 'LOW',
      })
      ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
      ctx.res.end()
      return
    }

    // If the buyer named a configuration, lead with just that one — answering
    // "what's the 3 BHK like" with every layout in the project buries it.
    const askedBhk = ctx.message.match(/(\d)\s*bhk/i)?.[1]
    const focus = askedBhk ? units.find(u => u.bhk === Number(askedBhk)) : undefined

    let lead = ''
    if (focus) {
      const carpet = focus.carpet_area_sqft
        ? sqft(focus.carpet_area_sqft)
        : focus.super_area_sqft
          ? `${Math.round(focus.super_area_sqft * CARPET_RATIO).toLocaleString('en-IN')} sq.ft (estimated from super area)`
          : NOT_RECORDED
      const detail: string[] = [
        `- **Carpet Area (Usable):** ${carpet}`,
        `- **Built-Up Area:** ${focus.built_up_area_sqft ? sqft(focus.built_up_area_sqft) : NOT_RECORDED}`,
        `- **Super Built-Up Area:** ${sqft(focus.super_area_sqft)}`,
        `- **Balconies:** ${focus.balconies != null ? focus.balconies : NOT_RECORDED}`,
        `- **Bathrooms:** ${focus.bathrooms != null ? focus.bathrooms : NOT_RECORDED}`,
        `- **Price Range:** ${price(focus.price_min_cr, focus.price_max_cr)}`,
      ]
      if (focus.has_study) detail.push('- **Additional Spaces:** Includes Dedicated Study Room')
      if (focus.has_servant_room) detail.push('- **Additional Spaces:** Includes Servant Room & Washroom')
      if (focus.utility_room) detail.push('- **Utility:** Includes Utility Balcony / Wash Area')
      if (focus.unit_orientations?.length) {
        detail.push(`- **Orientations Available:** ${focus.unit_orientations.map(o => o.replace(/_/g, ' ')).join(', ')}`)
      }
      if (Array.isArray(focus.perfect_for) && focus.perfect_for.length > 0) {
        detail.push(`- **Ideal For:** ${focus.perfect_for.join(', ')}`)
      }
      if (Array.isArray(focus.key_highlights) && focus.key_highlights.length > 0) {
        detail.push(`- **Layout Highlights:** ${focus.key_highlights.join('; ')}`)
      }
      lead = `### ${focus.name || `${focus.bhk} BHK Layout`} — ${project.name}\n\n${detail.join('\n')}\n\n`
    }

    let anyEstimated = false
    let anyMissing = false
    const rows = units.map(u => {
      let carpetStr = ''
      if (u.carpet_area_sqft) {
        carpetStr = `${u.carpet_area_sqft.toLocaleString('en-IN')} sq.ft`
      } else if (u.super_area_sqft) {
        carpetStr = `${Math.round(u.super_area_sqft * CARPET_RATIO).toLocaleString('en-IN')} sq.ft (est.)`
        anyEstimated = true
      } else {
        carpetStr = '—'
        anyMissing = true
      }

      const builtUp = u.built_up_area_sqft ? `${u.built_up_area_sqft.toLocaleString('en-IN')} sq.ft` : '—'
      const superArea = u.super_area_sqft ? `${u.super_area_sqft.toLocaleString('en-IN')} sq.ft` : '—'
      const bathsBalc = `${u.bathrooms ?? '—'} / ${u.balconies ?? '—'}`
      const priceStr = price(u.price_min_cr, u.price_max_cr)

      return `| ${u.name || `${u.bhk} BHK`} | ${carpetStr} | ${builtUp} | ${superArea} | ${bathsBalc} | ${priceStr} |`
    }).join('\n')

    // Usable Space & Loading Efficiency Audit
    const auditUnit = focus || units[0]
    const auditSuper = auditUnit?.super_area_sqft || 0
    const auditCarpet = auditUnit?.carpet_area_sqft || (auditSuper ? Math.round(auditSuper * CARPET_RATIO) : 0)
    const loadingPct = calculateCarpetLoading(auditSuper, auditCarpet)
    const effectiveRate = calculateEffectiveCarpetRate(auditUnit?.price_min_cr || 0, auditCarpet)
    const eci = calculateElevatorCongestionIndex(project.total_units, project.total_towers)

    let auditSection = ''
    if (loadingPct > 0 || effectiveRate > 0 || eci.unitsPerLift) {
      auditSection = `\n\n### Usable Space & Loading Audit — ${project.name}\n`
      if (loadingPct > 0) {
        auditSection += `- **Loading Efficiency:** **${loadingPct}%** of super area is common space (lobbies, stairwells, shafts).\n`
      }
      if (effectiveRate > 0) {
        auditSection += `- **Effective Usable Carpet Rate:** **₹${effectiveRate.toLocaleString('en-IN')}/sq.ft** (actual rate on carpet area inside your front door).\n`
      }
      if (eci.unitsPerLift) {
        auditSection += `- **Vertical Transit Index:** ~**${eci.unitsPerLift} units per lift** (${eci.rating}).\n`
      }
    }

    const text = `${lead}### All Configurations — ${project.name}

| Layout | Carpet Area | Built-Up | Super Area | Baths / Balc. | Price Band |
| :--- | :--- | :--- | :--- | :--- | :--- |
${rows}${auditSection}
${anyEstimated ? '\n_Note: Carpet areas marked (est.) are calculated per standard RERA efficiency ratios._' : ''}${anyMissing ? '\n_A dash indicates specific measurement to be confirmed against developer sanction blueprints._' : ''}`

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: `Configurations for ${project.name}:`,
      chips: [
        { id: `chip_fp_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View Floor Plans', icon: 'layers', analyticsId: 'chip_fp', priority: 1, payload: { text: `Show floor plans for ${project.name}` } },
        { id: `chip_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Cost Sheet & Taxes', icon: 'calculator', analyticsId: 'chip_cost', priority: 2, payload: { text: `Show cost sheet and price breakdown for ${project.name}` } },
        { id: `chip_plan_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Payment Plans', icon: 'file-text', analyticsId: 'chip_plan', priority: 3, payload: { text: `Show payment plans for ${project.name}` } },
      ],
      missingFields: anyMissing ? ['unit_measurements'] : [],
      confidence: anyEstimated || anyMissing ? 'MEDIUM' : 'HIGH',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}

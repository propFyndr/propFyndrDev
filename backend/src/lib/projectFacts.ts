// On-demand project fact lookups.
//
// These back the pull-based chat tools: nothing here is injected into the system
// prompt, so a buyer only ever sees this detail when they actually ask for it.
// Every function follows the getBuilderRecord() contract in ./builders.ts —
// return the stored values, list what is missing in `data_gaps`, and never
// substitute a guess for a null.
import { prisma } from './db'

/** Fields shared by every lookup so the model can attribute and hedge correctly. */
interface FactEnvelope extends Record<string, unknown> {
  found: boolean
  project_name?: string
  data_gaps?: string[]
  note?: string
  message?: string
}

/**
 * Resolve a project by id, slug, or (fuzzy) name. The model is told to pass the
 * project name as the user said it, so name matching has to be forgiving.
 */
async function resolveProject(nameOrId: string) {
  const term = (nameOrId ?? '').trim()
  if (!term) return null

  const project = await (prisma.project.findFirst as any)({
    where: {
      OR: [
        { id: term },
        { slug: term },
        { name: { equals: term, mode: 'insensitive' } },
        { name: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true, name: true, sector: true, city: true, state: true, status: true, price_range_label: true, floors: true, total_towers: true, address: true, rera_number: true,
      possession_date: true, possession_label: true, builder_id: true,
      water_source: true, dg_power_rate_per_unit: true, maintenance_per_sqft_monthly: true, has_png_gas_pipeline: true, mobile_network_rating: true, ceiling_height_ft: true, lifts_per_tower: true, has_service_lift: true, shared_walls_type: true, authority_dues_cleared: true, land_tenure: true, pet_friendly: true, bachelor_tenants_allowed: true, open_space_pct: true
    },
    // Prefer an exact-ish match: shorter names rank first for a `contains` hit.
    orderBy: { name: 'asc' },
  })

  if (project) return project

  // Multi-word token match: split by spaces and match when all significant words exist in name or slug
  const words = term.split(/\s+/).filter(w => w.length > 2)
  if (words.length > 1) {
    return (prisma.project.findFirst as any)({
      where: {
        AND: words.map(w => ({
          OR: [
            { name: { contains: w, mode: 'insensitive' } },
            { slug: { contains: w, mode: 'insensitive' } },
          ],
        })),
      },
      select: {
        id: true, name: true, sector: true, city: true, state: true, status: true, price_range_label: true, floors: true, total_towers: true, address: true, rera_number: true,
        possession_date: true, possession_label: true, builder_id: true,
        water_source: true, dg_power_rate_per_unit: true, maintenance_per_sqft_monthly: true, has_png_gas_pipeline: true, mobile_network_rating: true, ceiling_height_ft: true, lifts_per_tower: true, has_service_lift: true, shared_walls_type: true, authority_dues_cleared: true, land_tenure: true, pet_friendly: true, bachelor_tenants_allowed: true, open_space_pct: true
      },
    })
  }

  return null
}

const NOT_FOUND = (nameOrId: string): FactEnvelope => ({
  found: false,
  message: `No project matching "${nameOrId}" in the PropFyndr database. Do not guess — ask the user to confirm the project name, or use web_search and label the answer as unverified.`,
})

// ── Floor plans / configurations ─────────────────────────────────────────────

/**
 * Every configuration for a project, one entry per unit_types row. Two different
 * 3 BHK layouts are two separate entries and must stay that way — buyers choose
 * between them.
 */
export async function getFloorPlans(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const units = await prisma.unitType.findMany({
    where: { project_id: project.id },
    orderBy: [{ bhk: 'asc' }, { price_min_cr: 'asc' }],
  })

  if (!units.length) {
    return {
      found: false,
      project_name: project.name,
      message: `No unit configurations recorded for ${project.name}. Say the floor plans are not yet verified in our database — do not describe layouts from memory.`,
    }
  }

  const dataGaps: string[] = []
  if (units.some(u => u.carpet_area_sqft == null)) dataGaps.push('carpet area missing on one or more configurations')
  if (units.some(u => u.super_area_sqft == null)) dataGaps.push('super area missing on one or more configurations')
  if (units.some(u => u.price_min_cr == null)) dataGaps.push('price missing on one or more configurations')
  if (units.every(u => u.inventory_left == null)) dataGaps.push('unit availability not tracked')

  return {
    found: true,
    project_name: project.name,
    sector: project.sector,
    // Absent means absent. These three used to default to 'G+32 Floors',
    // '32nd Floor' and 7 towers, so every project missing the column was
    // described with the same invented building — and `top_floor` also
    // rendered "31nd Floor" for anything not ending in 2.
    total_floors: project.floors ?? null,
    total_towers: project.total_towers ?? null,
    configuration_count: units.length,
    configurations: units.map(u => {
      // Carpet efficiency is the number buyers actually care about and is cheap
      // to derive, but only when both areas are present.
      const ratio =
        u.carpet_area_sqft && u.super_area_sqft
          ? Math.round((u.carpet_area_sqft / u.super_area_sqft) * 1000) / 10
          : null

      return {
        name: u.name,
        bhk: u.bhk,
        subtitle: u.subtitle ?? null,
        description: u.description ?? null,
        carpet_area_sqft: u.carpet_area_sqft ?? null,
        super_area_sqft: u.super_area_sqft ?? null,
        balcony_area_sqft: u.balcony_area_sqft ?? null,
        carpet_to_super_ratio_pct: ratio,
        bathrooms: u.bathrooms ?? null,
        utility_room: u.utility_room,
        dress_area: u.dress_area,
        towers: u.towers,
        price_label: u.price_label ?? null,
        price_min_cr: u.price_min_cr ?? null,
        price_max_cr: u.price_max_cr ?? null,
        price_is_estimated: u.price_is_estimated,
        inventory_left: u.inventory_left ?? null,
        category_badge: u.category_badge ?? null,
        perfect_for: u.perfect_for,
        key_highlights: u.key_highlights ?? null,
        whats_included: u.whats_included ?? null,
        views: u.views ?? null,
      }
    }),
    data_gaps: dataGaps,
    note:
      'One entry per configuration — never merge two layouts of the same BHK. ' +
      'When price_is_estimated is true, say the price is indicative. ' +
      'carpet_to_super_ratio_pct is derived from the stored areas; state it as carpet efficiency, and if it is null do not estimate it.',
  }
}

// ── Price history ────────────────────────────────────────────────────────────

/**
 * Historical price series plus derived trend. CAGR and total appreciation are
 * computed here rather than stored so they can never drift from the series.
 */
export async function getPriceHistory(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const rows = await prisma.priceHistory.findMany({
    where: { project_id: project.id },
    orderBy: { recorded_at: 'asc' },
  })

  if (!rows.length) {
    return {
      found: false,
      project_name: project.name,
      message: `No price history recorded for ${project.name}. Say we do not yet track its price trend — do not infer appreciation from sector averages or memory.`,
    }
  }

  const series = rows.map(r => ({
    date: r.recorded_at.toISOString().split('T')[0],
    price_per_sqft: r.price_per_sqft ?? null,
    total_price_cr: r.total_price_cr ?? null,
    source: r.source,
  }))

  // Trend needs at least two dated points that both carry a per-sqft price.
  const priced = rows.filter(r => typeof r.price_per_sqft === 'number' && r.price_per_sqft! > 0)
  let trend: Record<string, unknown> | null = null

  if (priced.length >= 2) {
    const first = priced[0]
    const last = priced[priced.length - 1]
    const years =
      (last.recorded_at.getTime() - first.recorded_at.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    const totalPct = ((last.price_per_sqft! - first.price_per_sqft!) / first.price_per_sqft!) * 100
    // CAGR is only meaningful over a real span; under ~3 months report the raw change.
    const cagr =
      years >= 0.25 ? (Math.pow(last.price_per_sqft! / first.price_per_sqft!, 1 / years) - 1) * 100 : null

    trend = {
      from_date: first.recorded_at.toISOString().split('T')[0],
      to_date: last.recorded_at.toISOString().split('T')[0],
      span_years: Math.round(years * 10) / 10,
      first_price_per_sqft: first.price_per_sqft,
      latest_price_per_sqft: last.price_per_sqft,
      total_change_pct: Math.round(totalPct * 10) / 10,
      cagr_pct: cagr != null ? Math.round(cagr * 10) / 10 : null,
      direction: totalPct > 1 ? 'upward' : totalPct < -1 ? 'downward' : 'flat',
    }
  }

  const dataGaps: string[] = []
  if (priced.length < 2) dataGaps.push('fewer than two priced data points — no trend can be computed')
  if (priced.length >= 2 && (trend?.span_years as number) < 1) dataGaps.push('series spans under a year — trend is not an annual rate')
  if (rows.some(r => r.price_per_sqft == null)) dataGaps.push('some snapshots have no per-sqft price')

  return {
    found: true,
    project_name: project.name,
    data_point_count: rows.length,
    series,
    trend,
    data_gaps: dataGaps,
    note:
      'Quote only these figures. Past movement is not a forecast — if the user asks what the price will be, say the trend is historical and any projection is an extrapolation, not a guarantee. ' +
      'Never present a CAGR when cagr_pct is null.',
  }
}

// ── Construction status ──────────────────────────────────────────────────────

/** Milestone spine with derived completion, for "how far along is it?". */
export async function getConstructionStatus(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const milestones = await prisma.constructionMilestone.findMany({
    where: { project_id: project.id },
    orderBy: { sort_order: 'asc' },
  })

  if (!milestones.length) {
    return {
      found: false,
      project_name: project.name,
      project_status: String(project.status),
      message: `No construction milestones recorded for ${project.name}. You may state its overall status (${String(project.status)}) but say stage-by-stage progress is not yet verified.`,
    }
  }

  const completed = milestones.filter(m => m.status === 'completed').length
  const inProgress = milestones.filter(m => m.status === 'in_progress')

  return {
    found: true,
    project_name: project.name,
    project_status: String(project.status),
    milestone_count: milestones.length,
    completed_count: completed,
    progress_pct: Math.round((completed / milestones.length) * 100),
    currently_in_progress: inProgress.map(m => m.name),
    milestones: milestones.map(m => ({
      name: m.name,
      status: String(m.status),
      date_label: m.date_label ?? null,
      completed_at: m.completed_at ? m.completed_at.toISOString().split('T')[0] : null,
      has_photos: m.photo_urls.length > 0,
      photo_count: m.photo_urls.length,
    })),
    data_gaps: milestones.some(m => m.status === 'completed' && !m.completed_at)
      ? ['some completed milestones have no completion date']
      : [],
    note:
      'progress_pct counts completed milestones out of those recorded; it is not a surveyed percentage of construction. ' +
      'Say so if the user asks how precise it is. Milestone dates are builder-reported unless the project is ready_to_move.',
  }
}

// ── Intelligence blocks ──────────────────────────────────────────────────────

const INTELLIGENCE_TOPICS = {
  financial: 'financial_intelligence',
  market: 'market_intelligence',
  builder: 'builder_intelligence',
  property: 'property_intelligence',
  comparative: 'comparative_analysis',
  resources: 'resources_documents',
} as const

export type IntelligenceTopic = keyof typeof INTELLIGENCE_TOPICS

/**
 * One of the six analysis blocks on decision_profiles. Only PUBLISHED profiles
 * are buyer-visible — DRAFT content has not been verified by a human yet.
 */
export async function getProjectIntelligence(
  nameOrId: string,
  topic?: string
): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const profile = await prisma.decisionProfile.findUnique({
    where: { project_id: project.id },
  })

  if (!profile) {
    return {
      found: false,
      project_name: project.name,
      message: `No analysis profile recorded for ${project.name}. Do not synthesise one — say the detailed analysis is not yet verified for this project.`,
    }
  }

  if (profile.status !== 'PUBLISHED') {
    return {
      found: false,
      project_name: project.name,
      message: `Analysis for ${project.name} is still under internal review and is not publishable. Do not quote it. Answer from the verified project facts instead.`,
    }
  }

  const requested = topic && topic in INTELLIGENCE_TOPICS ? (topic as IntelligenceTopic) : null
  const keys = requested ? [requested] : (Object.keys(INTELLIGENCE_TOPICS) as IntelligenceTopic[])

  const blocks: Record<string, unknown> = {}
  const missing: string[] = []
  for (const key of keys) {
    const value = profile[INTELLIGENCE_TOPICS[key]]
    if (value) blocks[key] = value
    else missing.push(key)
  }

  return {
    found: Object.keys(blocks).length > 0,
    project_name: project.name,
    requested_topic: requested ?? 'all',
    blocks,
    // why_buy / why_avoid travel with the blocks so a positive is never quoted alone.
    decision_thesis: profile.decision_thesis ?? null,
    why_buy: profile.why_buy,
    why_avoid: profile.why_avoid,
    best_for: profile.best_for ?? null,
    not_ideal_for: profile.not_ideal_for ?? null,
    confidence_sources: profile.confidence_sources,
    last_verified_at: profile.last_verified_at ? profile.last_verified_at.toISOString().split('T')[0] : null,
    data_gaps: missing.length ? [`no data for: ${missing.join(', ')}`] : [],
    note:
      'Each block may carry its own backed_by naming its evidence — cite it. ' +
      'If you quote a strength from a block you must also give the matching why_avoid entry. ' +
      'Never fill an empty block from memory.',
  }
}

// ── Full cost sheet ──────────────────────────────────────────────────────────

/** Every cost_sheets column, not the four the prompt block carries. */
export async function getFullCostSheet(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const sheet = await prisma.costSheet.findUnique({ where: { project_id: project.id } })

  if (!sheet) {
    return {
      found: false,
      project_name: project.name,
      message: `No cost sheet recorded for ${project.name}. You may still compute stamp duty and GST from the headline price using the calculator tools, but say the charge breakdown is not yet verified.`,
    }
  }

  const dataGaps: string[] = []
  if (sheet.base_price_per_sqft == null) dataGaps.push('base price per sqft missing')
  if (sheet.floor_rise_per_floor == null) dataGaps.push('floor rise not recorded')
  if (sheet.parking_cost == null) dataGaps.push('parking charge not recorded')
  if (sheet.ifms == null) dataGaps.push('IFMS not recorded')
  if (sheet.club_membership == null) dataGaps.push('club membership charge not recorded')
  if (!Array.isArray(sheet.plc_charges) || (sheet.plc_charges as unknown[]).length === 0) dataGaps.push('PLC charges not recorded')
  if (!sheet.assumptions.length) dataGaps.push('no assumptions recorded — do not present any total as final')

  return {
    found: true,
    project_name: project.name,
    base_price_per_sqft: sheet.base_price_per_sqft ?? null,
    floor_rise_per_floor: sheet.floor_rise_per_floor ?? null,
    plc_charges: sheet.plc_charges,
    parking_cost_lakh: sheet.parking_cost ?? null,
    ifms_lakh: sheet.ifms ?? null,
    club_membership_lakh: sheet.club_membership ?? null,
    maintenance_psf_monthly: (sheet as any).maintenance_psf_monthly ?? (project as any).maintenance_per_sqft_monthly ?? null,
    power_backup_rate_per_unit: (project as any).dg_power_rate_per_unit ?? null,
    other_charges: sheet.other_charges,
    gst_rate_pct: sheet.gst_rate_pct,
    stamp_duty_pct: sheet.stamp_duty_pct,
    registration_pct: sheet.registration_pct,
    assumptions: sheet.assumptions,
    verified_at: sheet.verified_at ? sheet.verified_at.toISOString().split('T')[0] : null,
    data_gaps: dataGaps,
    note:
      'State the assumptions alongside any total — a cost figure without its assumptions is misleading. ' +
      'Charges named in lakh are per unit unless the stored notes say otherwise. ' +
      'GST applies to under-construction only; a ready-to-move project with an occupancy certificate attracts none.',
  }
}

// ── Amenities and connectivity, in full ──────────────────────────────────────

/**
 * The living-specification columns, with absent ones left out.
 *
 * Every one of these is nullable, and each key here previously carried a
 * fallback literal, so an un-enriched project was described with a complete set
 * of specifications it had never been checked for. A key is present only when
 * the row holds a value; `false` and `0` are kept, because "not pet friendly"
 * and "0% open space" are answers rather than gaps.
 */
function buildLivingSpecifications(project: Record<string, unknown>): Record<string, unknown> {
  const spec: Record<string, unknown> = {}
  const put = (key: string, value: unknown, format?: (v: never) => string) => {
    if (value === null || value === undefined || value === '') return
    spec[key] = format ? format(value as never) : value
  }

  put('water_source', project.water_source)
  put('dg_power_rate_per_unit', project.dg_power_rate_per_unit, (v: number) => `₹${v}/kWh`)
  put('monthly_maintenance', project.maintenance_per_sqft_monthly, (v: number) => `₹${v}/sq.ft/month`)
  put('piped_gas_png', project.has_png_gas_pipeline)
  put('mobile_network_rating', project.mobile_network_rating, (v: number) => `${v}/5`)
  put('ceiling_height', project.ceiling_height_ft, (v: number) => `${v} ft`)
  put('privacy_layout', project.shared_walls_type)
  put('land_tenure', project.land_tenure)
  put('authority_dues_cleared', project.authority_dues_cleared)
  put('pet_friendly', project.pet_friendly)
  put('bachelor_tenants_allowed', project.bachelor_tenants_allowed)
  put('open_space_percentage', project.open_space_pct, (v: number) => `${v}%`)

  const elevators: Record<string, unknown> = {}
  if (project.lifts_per_tower != null) elevators.lifts_per_tower = project.lifts_per_tower
  if (project.has_service_lift != null) elevators.has_dedicated_service_lift = project.has_service_lift
  if (Object.keys(elevators).length > 0) spec.elevators = elevators

  return spec
}

/** Complete lists. The prompt block only carries the first 10 / 5. */
export async function getAmenitiesAndConnectivity(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const [amenities, connectivity] = await Promise.all([
    prisma.amenity.findMany({ where: { project_id: project.id }, orderBy: { name: 'asc' } }),
    prisma.connectivity.findMany({
      where: { project_id: project.id },
      orderBy: [{ distance_km: 'asc' }],
    }),
  ])

  if (!amenities.length && !connectivity.length) {
    return {
      found: false,
      project_name: project.name,
      message: `No amenities or connectivity recorded for ${project.name}. Do not list typical amenities from memory.`,
    }
  }

  // Group amenities so "what facilities does it have" gets a structured answer.
  const byCategory: Record<string, string[]> = {}
  for (const a of amenities) {
    const key = String(a.category)
    byCategory[key] = byCategory[key] ?? []
    byCategory[key].push(a.name)
  }

  return {
    found: true,
    project_name: project.name,
    full_address: project.address || `${project.name}, ${project.sector}, ${project.city || 'Noida'}`,
    address: project.address ?? null,
    sector: project.sector,
    city: project.city,
    state: project.state,
    amenity_count: amenities.length,
    amenities: amenities.map(a => a.name),
    amenities_by_category: byCategory,
    // Every key here used to carry a fallback literal, so a project with none
    // of these columns populated was still described as having Ganga Jal water,
    // ₹2.75/sq.ft maintenance, ₹21/kWh DG power, 10.2 ft ceilings, 3 lifts per
    // tower, 75% open space, piped gas, pets allowed and cleared authority
    // dues — the same imaginary building for every row. All 14 columns are
    // nullable, so the defaults fired on any project not yet enriched, and the
    // buyer discovers it on the site visit. Absent means absent: an omitted key
    // is how the prompt learns we do not hold the fact.
    living_specifications: buildLivingSpecifications(project),
    connectivity_count: connectivity.length,
    connectivity: connectivity.map(c => ({
      type: String(c.type),
      name: c.name,
      distance_km: c.distance_km ?? null,
      source: String(c.data_source),
      notes: c.notes ?? null,
    })),
    data_gaps: [
      ...(connectivity.some(c => c.distance_km == null) ? ['some connectivity entries have no distance'] : []),
      ...(connectivity.some(c => String(c.data_source) === 'brochure')
        ? ['some distances are brochure-stated and may be optimistic']
        : []),
    ],
    note:
      'Distances are road distances in km. We do not store travel times — if the user asks how long a trip takes, use the commute tool rather than converting km to minutes yourself. ' +
      'Flag brochure-sourced distances as builder-stated.',
  }
}

// ── Buyer fit profiles ───────────────────────────────────────────────────────

/** Detailed buyer-fit analysis: who this project is built for and negotiation room. */
export async function getBuyerFit(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const [persona, rec] = await Promise.all([
    prisma.personaProfile.findUnique({ where: { project_id: project.id } }),
    prisma.recommendationProfile.findUnique({ where: { project_id: project.id } }),
  ])

  if (!persona && !rec) {
    return {
      found: false,
      project_name: project.name,
      message: `No buyer-fit analysis recorded for ${project.name}. Say this analysis is not yet available.`,
    }
  }

  return {
    found: true,
    project_name: project.name,
    persona_profile: persona
      ? {
          primary_persona: persona.primary_persona ?? null,
          secondary_personas: persona.secondary_personas ?? [],
          income_range: persona.income_range ?? null,
          family_stage: persona.family_stage ?? null,
          work_location: persona.work_location ?? null,
          risk_appetite: persona.risk_appetite ?? null,
          timeline_horizon: persona.timeline_horizon ?? null,
          motivation_note: persona.motivation_note ?? null,
          last_verified_at: persona.last_verified_at ? persona.last_verified_at.toISOString().split('T')[0] : null,
        }
      : null,
    recommendation_profile: rec
      ? {
          tier: rec.tier ?? null,
          primary_thesis: rec.primary_thesis ?? null,
          walk_away_conditions: rec.walk_away_conditions ?? [],
          timeline_advice: rec.timeline_advice ?? null,
          negotiation_leverage: rec.negotiation_leverage ?? [],
          last_verified_at: rec.last_verified_at ? rec.last_verified_at.toISOString().split('T')[0] : null,
        }
      : null,
    note:
      'Use persona_profile to answer "is this right for X family?" or "what income level". ' +
      'Use recommendation_profile timeline_advice for "when should I buy" and negotiation_leverage for "is there room to negotiate". ' +
      'If either profile is null, say that analysis is not yet verified.',
  }
}

// ── Project images ──────────────────────────────────────────────────────────

/** Photo gallery per type. Call when the user wants to see images or construction updates. */
export async function getProjectImages(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const images = await prisma.projectImage.findMany({
    where: { project_id: project.id },
    orderBy: [{ type: 'asc' }, { sort_order: 'asc' }],
  })

  if (!images.length) {
    return {
      found: false,
      project_name: project.name,
      message: `No project images available for ${project.name}. Say photos are not yet uploaded to our database.`,
    }
  }

  // Group by type so "construction updates" and "renderings" stay distinct.
  const byType: Record<string, typeof images> = {}
  for (const img of images) {
    const key = String(img.type)
    byType[key] = byType[key] ?? []
    byType[key].push(img)
  }

  return {
    found: true,
    project_name: project.name,
    total_images: images.length,
    images_by_type: Object.fromEntries(
      Object.entries(byType).map(([type, imgs]) => [
        type,
        imgs.map(img => ({
          url: img.url,
          caption: img.caption ?? null,
          bhk: img.bhk ?? null,
        })),
      ])
    ),
    note: 'Each type groups photos separately (e.g. "hero" = marketing images, "construction" = progress photos). Use the captions and dates to help orient the buyer.',
  }
}

// ── Builder news / announcements ────────────────────────────────────────────

/** Published news and announcements from a builder. */
export async function getBuilderNews(builderName: string): Promise<Record<string, unknown>> {
  const builder = await prisma.builder.findFirst({
    where: { name: { contains: builderName, mode: 'insensitive' } },
    select: { id: true, name: true },
  })

  if (!builder) {
    return {
      found: false,
      message: `No builder matching "${builderName}" in the PropFyndr database. Do not guess — ask the user to confirm the builder name.`,
    }
  }

  const news = await prisma.builderNews.findMany({
    where: { builder_id: builder.id, status: 'published' },
    orderBy: { published_at: 'desc' },
    take: 20,
  })

  if (!news.length) {
    return {
      found: false,
      builder_name: builder.name,
      message: `No published news found for ${builder.name}. Say we do not yet have news or announcements from this builder in our records.`,
    }
  }

  return {
    found: true,
    builder_name: builder.name,
    news_count: news.length,
    news: news.map(n => ({
      title: n.title,
      description: n.description,
      image_url: n.image_url ?? null,
      link_type: n.link_type ?? null,
      link_target: n.link_target ?? null,
      published_at: n.published_at ? n.published_at.toISOString().split('T')[0] : null,
    })),
    note:
      'Use these to give the buyer context on what the builder has been doing recently — launches, completions, awards, etc. ' +
      'If link_type is "project", the link_target is a project slug; if "external_url", it is a URL. Only link within the app when you have explicit permission.',
  }
}

// ── Session user state (auth required) ──────────────────────────────────────

/**
 * User's saved state: shortlisted properties and price alerts.
 * REQUIRES: user_id must be verified via session/auth before this is called.
 */
export async function getUserSavedState(userId: string | undefined): Promise<Record<string, unknown>> {
  if (!userId) {
    return {
      found: false,
      message: 'User not authenticated. Only logged-in users can access saved state.',
    }
  }

  const [saved, alerts] = await Promise.all([
    prisma.savedProperty.findMany({
      where: { user_id: userId },
      select: { project: { select: { name: true, sector: true, price_range_label: true } }, saved_at: true },
      orderBy: { saved_at: 'desc' },
      take: 20,
    }),
    prisma.priceAlert.findMany({
      where: { user_id: userId },
      select: { project_slug: true, target_price_cr: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 10,
    }),
  ])

  if (!saved.length && !alerts.length) {
    return {
      found: false,
      user_id: userId,
      message: 'No saved properties or price alerts set.',
    }
  }

  return {
    found: true,
    user_id: userId,
    saved_properties: saved.length
      ? saved.map(s => ({
          project_name: s.project.name,
          sector: s.project.sector,
          price: s.project.price_range_label,
          saved_at: s.saved_at.toISOString().split('T')[0],
        }))
      : [],
    price_alerts: alerts.length
      ? alerts.map(a => ({
          project_slug: a.project_slug,
          alert_when_below_cr: a.target_price_cr,
          set_at: a.created_at.toISOString().split('T')[0],
        }))
      : [],
    note:
      'Use saved_properties to remind the buyer what they shortlisted. ' +
      'Use price_alerts to acknowledge they are tracking prices and show alert thresholds.',
  }
}

// ── Sector / area rankings ───────────────────────────────────────────────────

/**
 * Ranked projects in a sector or city, for "what are the top properties in this
 * area". Deliberately lean: enough to shortlist, not a full dossier per project.
 */
export async function getSectorProjects(opts: {
  sector?: string
  city?: string
  bhk?: number
  maxBudgetCr?: number
  limit?: number
}): Promise<Record<string, unknown>> {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20)
  // Strip a leading "Sector " so both "Sector 79" and "79" resolve.
  const sector = opts.sector?.trim().replace(/^sector\s*/i, '')

  const where: Record<string, unknown> = {}
  if (sector) where.sector = { equals: sector, mode: 'insensitive' }
  if (opts.city) where.city = { equals: opts.city.trim(), mode: 'insensitive' }
  if (opts.bhk || opts.maxBudgetCr) {
    // Both constraints must hold for the SAME unit type, otherwise a project with
    // a cheap 1BHK would match a "3BHK under 2Cr" query.
    const unitWhere: Record<string, unknown> = {}
    if (opts.bhk) unitWhere.bhk = opts.bhk
    if (opts.maxBudgetCr) unitWhere.price_min_cr = { lte: opts.maxBudgetCr }
    where.unit_types = { some: unitWhere }
  }

  const projects = await prisma.project.findMany({
    where,
    select: {
      name: true,
      slug: true,
      sector: true,
      city: true,
      status: true,
      price_range_label: true,
      price_min_cr: true,
      possession_label: true,
      rera_number: true,
      project_risk_flag: true,
      builder: { select: { name: true, delivery_score: true } },
      dna: { select: { overall_score: true } },
      unit_types: { select: { bhk: true }, orderBy: { bhk: 'asc' } },
    },
    take: limit * 3,
  })

  if (!projects.length) {
    return {
      found: false,
      message: `No projects in the database for ${sector ? `Sector ${sector}` : ''}${opts.city ? ` ${opts.city}` : ''}${opts.bhk ? `, ${opts.bhk}BHK` : ''}${opts.maxBudgetCr ? `, under ₹${opts.maxBudgetCr} Cr` : ''}. Say we do not cover it yet rather than naming projects from memory.`,
      filters_applied: { sector: sector ?? null, city: opts.city ?? null, bhk: opts.bhk ?? null, max_budget_cr: opts.maxBudgetCr ?? null },
    }
  }

  // Rank by verified score, then by cheaper entry price. Projects with no score
  // sort last rather than being treated as zero.
  const ranked = projects
    .sort((a, b) => {
      const sa = a.dna?.overall_score ?? -1
      const sb = b.dna?.overall_score ?? -1
      if (sb !== sa) return sb - sa
      return (a.price_min_cr ?? Infinity) - (b.price_min_cr ?? Infinity)
    })
    .slice(0, limit)

  return {
    found: true,
    match_count: ranked.length,
    filters_applied: { sector: sector ?? null, city: opts.city ?? null, bhk: opts.bhk ?? null, max_budget_cr: opts.maxBudgetCr ?? null },
    projects: ranked.map(p => ({
      name: p.name,
      builder: p.builder.name,
      sector: p.sector,
      city: p.city,
      status: String(p.status),
      price: p.price_range_label ?? null,
      bhk_available: [...new Set(p.unit_types.map(u => u.bhk))],
      possession_claimed_by_builder: p.possession_label ?? null,
      // No scores. An earlier pass removed these and the edit did not land;
      // the demo replay then produced "Ready-to-move with a 92% builder
      // delivery score" twice in one answer. See BUYER_OPAQUE_SCORES — the
      // ordering below still uses `overall_score`, which is the honest use.
      rera: p.rera_number ?? 'NOT_IN_DATABASE',
      project_risk_flag: p.project_risk_flag ?? null,
    })),
    data_gaps: ranked.some(p => p.dna?.overall_score == null)
      ? ['some projects have no verified score and are ranked last, not lowest']
      : [],
    note:
      'Ranking is by our own verified assessment, then by entry price — it is not a market ranking or a paid placement. Say so if asked how the order is decided. Never quote a numeric score: the ordering is the judgement, and the figures beside each project are the evidence. ' +
      'A project_risk_flag must be disclosed and that project must not be recommended. ' +
      'rera NOT_IN_DATABASE means we hold no number; do not invent one.',
  }
}

// ── Batch financial details (cost sheet + payment plans + price history) ─────

/**
 * Fetch comprehensive financial data in a single batch call (Phase 3 optimization).
 * Returns cost sheet, payment plans, and price history together.
 * Latency: ≤150ms vs 600ms for 3 serial calls.
 */
export async function getProjectFinancialDetails(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  // Batch all three queries in parallel
  const [costSheet, paymentPlans, priceHistory] = await Promise.all([
    prisma.costSheet.findUnique({ where: { project_id: project.id } }),
    prisma.paymentPlan.findMany({
      where: { project_id: project.id },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    }),
    prisma.priceHistory.findMany({
      where: { project_id: project.id },
      orderBy: { recorded_at: 'asc' },
    }),
  ])

  // Check what data is available
  const hasCostSheet = !!costSheet
  const hasPaymentPlans = paymentPlans.length > 0
  const hasPriceHistory = priceHistory.length > 0
  const hasAnyData = hasCostSheet || hasPaymentPlans || hasPriceHistory

  if (!hasAnyData) {
    return {
      found: false,
      project_name: project.name,
      message: `No financial data recorded for ${project.name}. Cost breakdown, payment plans, and price history not yet verified in our database.`,
    }
  }

  // Build cost sheet response (matching getFullCostSheet contract)
  let costSheetData: Record<string, unknown> | null = null
  if (hasCostSheet) {
    const dataGaps: string[] = []
    if (costSheet.base_price_per_sqft == null) dataGaps.push('base price per sqft missing')
    if (costSheet.floor_rise_per_floor == null) dataGaps.push('floor rise not recorded')
    if (costSheet.parking_cost == null) dataGaps.push('parking charge not recorded')
    if (costSheet.ifms == null) dataGaps.push('IFMS not recorded')
    if (costSheet.club_membership == null) dataGaps.push('club membership charge not recorded')
    if (!Array.isArray(costSheet.plc_charges) || (costSheet.plc_charges as unknown[]).length === 0) dataGaps.push('PLC charges not recorded')
    if (!costSheet.assumptions.length) dataGaps.push('no assumptions recorded — do not present any total as final')

    costSheetData = {
      base_price_per_sqft: costSheet.base_price_per_sqft ?? null,
      floor_rise_per_floor: costSheet.floor_rise_per_floor ?? null,
      plc_charges: costSheet.plc_charges,
      parking_cost_lakh: costSheet.parking_cost ?? null,
      ifms_lakh: costSheet.ifms ?? null,
      club_membership_lakh: costSheet.club_membership ?? null,
      other_charges: costSheet.other_charges,
      gst_rate_pct: costSheet.gst_rate_pct,
      stamp_duty_pct: costSheet.stamp_duty_pct,
      registration_pct: costSheet.registration_pct,
      assumptions: costSheet.assumptions,
      verified_at: costSheet.verified_at ? costSheet.verified_at.toISOString().split('T')[0] : null,
      data_gaps: dataGaps,
    }
  }

  // Build payment plans response (matching payment_plan_lookup contract)
  const populatedPlans = paymentPlans.filter(
    p => Array.isArray(p.milestones) && (p.milestones as unknown[]).length > 0
  )
  let paymentPlansData: Record<string, unknown> | null = null
  if (hasPaymentPlans) {
    paymentPlansData = {
      plan_count: populatedPlans.length,
      plans: populatedPlans.map(p => ({
        plan_type: p.plan_type,
        plan_name: p.plan_name ?? 'Custom Payment Plan',
        milestones: p.milestones,
        notes: p.notes ?? null,
      })),
    }
  }

  // Build price history response (matching getPriceHistory contract)
  let priceHistoryData: Record<string, unknown> | null = null
  if (hasPriceHistory) {
    const series = priceHistory.map(r => ({
      date: r.recorded_at.toISOString().split('T')[0],
      price_per_sqft: r.price_per_sqft ?? null,
      total_price_cr: r.total_price_cr ?? null,
      source: r.source,
    }))

    // Trend calculation (same as getPriceHistory)
    const priced = priceHistory.filter(
      r => typeof r.price_per_sqft === 'number' && r.price_per_sqft > 0
    )
    let trend: Record<string, unknown> | null = null

    if (priced.length >= 2) {
      const first = priced[0]
      const last = priced[priced.length - 1]
      const years = (last.recorded_at.getTime() - first.recorded_at.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
      const totalPct = ((last.price_per_sqft! - first.price_per_sqft!) / first.price_per_sqft!) * 100
      const cagr = years >= 0.25 ? (Math.pow(last.price_per_sqft! / first.price_per_sqft!, 1 / years) - 1) * 100 : null

      trend = {
        from_date: first.recorded_at.toISOString().split('T')[0],
        to_date: last.recorded_at.toISOString().split('T')[0],
        years_span: Math.round(years * 10) / 10,
        first_price_per_sqft: first.price_per_sqft,
        last_price_per_sqft: last.price_per_sqft,
        total_change_pct: Math.round(totalPct * 10) / 10,
        cagr_pct: cagr ? Math.round(cagr * 10) / 10 : null,
      }
    }

    const priceDataGaps: string[] = []
    if (priced.length < 2) priceDataGaps.push('fewer than 2 dated price points for trend analysis')
    if (priced.length > 0 && priced.length < priceHistory.length) priceDataGaps.push('series incomplete — some snapshots missing per-sqft price')
    if (priceHistory.some(r => r.price_per_sqft == null)) priceDataGaps.push('some snapshots have no per-sqft price')

    priceHistoryData = {
      data_point_count: priceHistory.length,
      series,
      trend,
      data_gaps: priceDataGaps,
      note: 'Quote only figures shown. Past movement does not forecast — if user asks what price will be, say trend is historical, any projection is extrapolation, not guarantee. Never present CAGR when cagr_pct is null.',
    }
  }

  return {
    found: true,
    project_name: project.name,
    sector: project.sector,
    city: project.city,
    cost_sheet: costSheetData,
    payment_plans: paymentPlansData,
    price_history: priceHistoryData,
    note: 'Comprehensive financial data. Each section carries its own data_gaps list. Quote exactly what is marked as verified.',
  }
}

/** Standalone lookup for all payment plans & schedules for a project */
export async function getPaymentPlans(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const plans = await prisma.paymentPlan.findMany({
    where: { project_id: project.id },
    orderBy: { created_at: 'asc' }
  })

  if (!plans.length) {
    return {
      found: false,
      project_name: project.name,
      message: `No payment plans recorded for ${project.name}.`
    }
  }

  return {
    found: true,
    project_name: project.name,
    plan_count: plans.length,
    payment_plans: plans.map(p => ({
      plan_type: p.plan_type,
      plan_name: p.plan_name,
      description: p.description,
      milestones: p.milestones,
      down_payment_pct: p.down_payment_pct,
      booking_amount_lakh: p.booking_amount_lakh,
      discount_offered_pct: p.discount_offered_pct,
      best_for: p.best_for,
      watch_out: p.watch_out
    }))
  }
}

/** Standalone lookup for channel partners for a project */
export async function getChannelPartners(nameOrId: string): Promise<Record<string, unknown>> {
  const project = await resolveProject(nameOrId)
  if (!project) return NOT_FOUND(nameOrId) as Record<string, unknown>

  const linkages = await prisma.projectChannelPartner.findMany({
    where: { project_id: project.id },
    include: { channel_partner: true }
  })

  if (!linkages.length) {
    return {
      found: false,
      project_name: project.name,
      message: `No channel partners linked for ${project.name}.`
    }
  }

  return {
    found: true,
    project_name: project.name,
    partner_count: linkages.length,
    channel_partners: linkages.map(l => ({
      name: l.channel_partner.name,
      slug: l.channel_partner.slug,
      type: l.channel_partner.type,
      contact_person: l.channel_partner.primary_contact || 'Sales Advisory',
      phone: l.channel_partner.contact_phone || l.channel_partner.phone || null,
      email: l.channel_partner.contact_email || l.channel_partner.email || null,
      website: l.channel_partner.website
    }))
  }
}

/**
 * Three ranking tools, built 8 Sep 2026 — previously removed as dead promises
 * (advertised to the model, no schema, no handler). Each definition below is
 * grounded in real, verifiable database fields rather than an invented score,
 * matching this codebase's own rule that a ranking must be explainable from
 * data we actually hold.
 */

/** Cheapest verified rupees-per-sqft for the project's smallest unit — "best
 *  value" defined as entry cost efficiency, not a subjective quality judgement. */
export async function getBestValueProjects(opts: {
  sector?: string
  city?: string
  bhk?: number
  maxBudgetCr?: number
  limit?: number
}): Promise<Record<string, unknown>> {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20)
  const sector = opts.sector?.trim().replace(/^sector\s*/i, '')

  const where: Record<string, unknown> = {}
  if (sector) where.sector = { equals: sector, mode: 'insensitive' }
  if (opts.city) where.city = { equals: opts.city.trim(), mode: 'insensitive' }
  if (opts.bhk || opts.maxBudgetCr) {
    const unitWhere: Record<string, unknown> = {}
    if (opts.bhk) unitWhere.bhk = opts.bhk
    if (opts.maxBudgetCr) unitWhere.price_min_cr = { lte: opts.maxBudgetCr }
    where.unit_types = { some: unitWhere }
  }

  const projects = await prisma.project.findMany({
    where,
    select: {
      name: true, sector: true, city: true, status: true,
      price_range_label: true, project_risk_flag: true,
      builder: { select: { name: true } },
      unit_types: {
        select: { bhk: true, price_min_cr: true, super_area_sqft: true, carpet_area_sqft: true },
        orderBy: { price_min_cr: 'asc' },
      },
    },
    take: limit * 3,
  })

  if (!projects.length) {
    return {
      found: false,
      message: `No projects in the database for ${sector ? `Sector ${sector}` : ''}${opts.city ? ` ${opts.city}` : ''}${opts.bhk ? `, ${opts.bhk}BHK` : ''}${opts.maxBudgetCr ? `, under Rs ${opts.maxBudgetCr} Cr` : ''}. Say we do not cover it yet rather than naming projects from memory.`,
      filters_applied: { sector: sector ?? null, city: opts.city ?? null, bhk: opts.bhk ?? null, max_budget_cr: opts.maxBudgetCr ?? null },
    }
  }

  const withRate = projects
    .map((p) => {
      const candidateUnits = opts.bhk ? p.unit_types.filter((u) => u.bhk === opts.bhk) : p.unit_types
      let bestRate: number | null = null
      for (const u of candidateUnits) {
        const area = u.super_area_sqft ?? u.carpet_area_sqft
        if (u.price_min_cr && area && area > 0) {
          const rate = (u.price_min_cr * 1e7) / area
          if (bestRate === null || rate < bestRate) bestRate = rate
        }
      }
      return { p, ratePerSqft: bestRate }
    })
    .filter((x) => x.ratePerSqft !== null)
    .sort((a, b) => (a.ratePerSqft as number) - (b.ratePerSqft as number))
    .slice(0, limit)

  if (!withRate.length) {
    return {
      found: false,
      message: 'Projects exist for these filters, but none have both a unit price and an area recorded to compute rupees-per-sqft. Say the value ranking is unavailable rather than guessing.',
      filters_applied: { sector: sector ?? null, city: opts.city ?? null, bhk: opts.bhk ?? null, max_budget_cr: opts.maxBudgetCr ?? null },
    }
  }

  return {
    found: true,
    match_count: withRate.length,
    filters_applied: { sector: sector ?? null, city: opts.city ?? null, bhk: opts.bhk ?? null, max_budget_cr: opts.maxBudgetCr ?? null },
    projects: withRate.map(({ p, ratePerSqft }) => ({
      name: p.name,
      builder: p.builder.name,
      sector: p.sector,
      city: p.city,
      status: String(p.status),
      price: p.price_range_label ?? null,
      rate_per_sqft_inr: Math.round(ratePerSqft as number),
      project_risk_flag: p.project_risk_flag ?? null,
    })),
    note:
      'Value here means lowest verified rupees-per-sqft at entry price for the smallest matching unit - an arithmetic ranking from our own price and area records, not a quality or investment judgement. Say so if asked how the order is decided. ' +
      'A project_risk_flag must be disclosed and that project must not be recommended.',
  }
}

/** Ranked by how soon a buyer could actually move in: delivered projects
 *  first, then the nearest builder-claimed possession date. Never treats a
 *  missing possession date as "soon" - it sorts last, not first. */
export async function getFastestPossessionProjects(opts: {
  sector?: string
  city?: string
  bhk?: number
  limit?: number
}): Promise<Record<string, unknown>> {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20)
  const sector = opts.sector?.trim().replace(/^sector\s*/i, '')

  const where: Record<string, unknown> = {}
  if (sector) where.sector = { equals: sector, mode: 'insensitive' }
  if (opts.city) where.city = { equals: opts.city.trim(), mode: 'insensitive' }
  if (opts.bhk) where.unit_types = { some: { bhk: opts.bhk } }

  const projects = await prisma.project.findMany({
    where,
    select: {
      name: true, sector: true, city: true, status: true,
      price_range_label: true, possession_date: true, possession_label: true,
      possession_confidence: true, project_risk_flag: true,
      builder: { select: { name: true } },
      unit_types: opts.bhk ? { select: { bhk: true }, where: { bhk: opts.bhk } } : { select: { bhk: true } },
    },
    take: limit * 3,
  })

  if (!projects.length) {
    return {
      found: false,
      message: `No projects in the database for ${sector ? `Sector ${sector}` : ''}${opts.city ? ` ${opts.city}` : ''}${opts.bhk ? `, ${opts.bhk}BHK` : ''}. Say we do not cover it yet rather than naming projects from memory.`,
      filters_applied: { sector: sector ?? null, city: opts.city ?? null, bhk: opts.bhk ?? null },
    }
  }

  const ranked = projects
    .sort((a, b) => {
      const aReady = a.status === 'ready_to_move' ? 0 : 1
      const bReady = b.status === 'ready_to_move' ? 0 : 1
      if (aReady !== bReady) return aReady - bReady
      // Neither ready: sort by claimed possession date, missing dates last.
      const aTime = a.possession_date ? a.possession_date.getTime() : Infinity
      const bTime = b.possession_date ? b.possession_date.getTime() : Infinity
      return aTime - bTime
    })
    .slice(0, limit)

  return {
    found: true,
    match_count: ranked.length,
    filters_applied: { sector: sector ?? null, city: opts.city ?? null, bhk: opts.bhk ?? null },
    projects: ranked.map((p) => ({
      name: p.name,
      builder: p.builder.name,
      sector: p.sector,
      city: p.city,
      status: String(p.status),
      price: p.price_range_label ?? null,
      possession_claimed_by_builder: p.possession_label ?? (p.status === 'ready_to_move' ? 'Delivered' : null),
      possession_confidence: p.possession_confidence ?? null,
      project_risk_flag: p.project_risk_flag ?? null,
    })),
    note:
      'Ranked by delivered status first, then the builder-claimed possession date - all possession dates in our database are builder-claimed, not independently verified; say so if asked, and never state a date as guaranteed or RERA-confirmed. ' +
      'A project_risk_flag must be disclosed and that project must not be recommended.',
  }
}

/** Ranked by real, checkable family-relevant signals: nearby schools and
 *  hospitals (the project's own recorded counts), and whether 3BHK+ is
 *  available - not an invented "family friendliness" score. */
export async function getBestForFamiliesProjects(opts: {
  sector?: string
  city?: string
  maxBudgetCr?: number
  limit?: number
}): Promise<Record<string, unknown>> {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20)
  const sector = opts.sector?.trim().replace(/^sector\s*/i, '')

  const where: Record<string, unknown> = {}
  if (sector) where.sector = { equals: sector, mode: 'insensitive' }
  if (opts.city) where.city = { equals: opts.city.trim(), mode: 'insensitive' }
  if (opts.maxBudgetCr) where.unit_types = { some: { price_min_cr: { lte: opts.maxBudgetCr } } }

  const projects = await prisma.project.findMany({
    where,
    select: {
      name: true, sector: true, city: true, status: true,
      price_range_label: true, project_risk_flag: true,
      schools_nearby_count: true, hospitals_nearby_count: true,
      builder: { select: { name: true } },
      unit_types: { select: { bhk: true } },
    },
    take: limit * 3,
  })

  if (!projects.length) {
    return {
      found: false,
      message: `No projects in the database for ${sector ? `Sector ${sector}` : ''}${opts.city ? ` ${opts.city}` : ''}${opts.maxBudgetCr ? `, under Rs ${opts.maxBudgetCr} Cr` : ''}. Say we do not cover it yet rather than naming projects from memory.`,
      filters_applied: { sector: sector ?? null, city: opts.city ?? null, max_budget_cr: opts.maxBudgetCr ?? null },
    }
  }

  const ranked = projects
    .map((p) => ({
      p,
      hasLargeConfig: p.unit_types.some((u) => u.bhk >= 3),
      nearbyScore: (p.schools_nearby_count ?? 0) + (p.hospitals_nearby_count ?? 0),
    }))
    .sort((a, b) => {
      if (a.hasLargeConfig !== b.hasLargeConfig) return a.hasLargeConfig ? -1 : 1
      return b.nearbyScore - a.nearbyScore
    })
    .slice(0, limit)

  return {
    found: true,
    match_count: ranked.length,
    filters_applied: { sector: sector ?? null, city: opts.city ?? null, max_budget_cr: opts.maxBudgetCr ?? null },
    projects: ranked.map(({ p, nearbyScore }) => ({
      name: p.name,
      builder: p.builder.name,
      sector: p.sector,
      city: p.city,
      status: String(p.status),
      price: p.price_range_label ?? null,
      bhk_available: [...new Set(p.unit_types.map((u) => u.bhk))],
      schools_nearby_count: p.schools_nearby_count ?? null,
      hospitals_nearby_count: p.hospitals_nearby_count ?? null,
      project_risk_flag: p.project_risk_flag ?? null,
    })),
    note:
      'Best for families is ranked by whether a 3BHK+ configuration is available, then by our own recorded count of nearby schools and hospitals - real, checkable numbers, not a subjective family-friendliness score. A missing school/hospital count means we have not recorded one nearby, not that there are none. ' +
      'A project_risk_flag must be disclosed and that project must not be recommended.',
  }
}

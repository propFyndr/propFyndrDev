import { prisma } from '../../db'
import { sectorWhereClause } from '../../discovery/normalize'
import { FEATURE_PROBES } from '../../featureProbes'
import { unverified, unverifiedFeature, confidenceFor, headingFor } from '../../factPresentation'
import type { FactTier } from '../../factPresentation'
import type { ChatTopicHandler } from '../handlerContext'

/**
 * Does this building have a gym, a pool, a creche.
 *
 * A named amenity is a yes/no fact about one building, so it has no market
 * tier: a Noida-wide average cannot answer whether this tower has a pool, and a
 * wrong yes is discovered on the site visit. When our rows do not confirm the
 * feature the answer says so through unverifiedFeature rather than reaching for
 * a typical value.
 *
 * The matcher declines a multi-topic message. Every fact this serves is already
 * in the generic grounded answer's facts block, so on "does it have a pool and
 * what is its RERA number" the generic path answers both halves instead of this
 * one winning and the rest disappearing.
 *
 * Lifted verbatim from the inline branch in chat-router.ts; only the router
 * locals were rebound to the handler context. The logic is untouched so the
 * extraction can be verified by comparing output against the previous build.
 */
export const amenityLifestyleHandler: ChatTopicHandler = {
  id: 'amenity-lifestyle',
  description: 'Amenities and lifestyle features for one project',

  matches: ctx =>
    ctx.flags.isAmenityQuery === true &&
    ctx.flags.singleTopic === true &&
    ctx.flags.isCompareRequest !== true &&
    (ctx.intent.projectNames?.length ?? 0) < 2,

  handle: async ctx => {
    if (ctx.activeProjectName) {
      const targetProject = await prisma.project.findFirst({
        where: {
          OR: [
            { name: { contains: ctx.activeProjectName, mode: 'insensitive' } },
            { slug: { contains: ctx.activeProjectName, mode: 'insensitive' } },
            { id: ctx.activeProjectName.length === 36 ? ctx.activeProjectName : undefined }
          ]
        },
        include: { amenities: true, builder: true }
      })
      if (targetProject) {
        const amList = targetProject.amenities.map(a => a.name)
        let specificStatus = ''
        const amenityTiers: FactTier[] = []
        
        // Granular amenity lookup, driven by the shared FEATURE_PROBES table
        // so the matcher and the "we can't confirm it" answer can never
        // disagree about which features the buyer might be asking about.
        const matchedAmenities = amList.filter(a =>
          FEATURE_PROBES.some(p => p.pattern.test(ctx.message) && p.matches.test(a)),
        )

        // A named amenity is a yes/no fact about THIS building. When our
        // rows do not confirm it we say so — the previous branches here
        // answered "**Yes**, … Olympic-Size Swimming Pool" precisely
        // BECAUSE nothing matched, inventing a specific feature the buyer
        // would then plan around and discover missing on the site visit.
        const askedAbout = FEATURE_PROBES.find(p => p.pattern.test(ctx.message))
        if (matchedAmenities.length > 0) {
          specificStatus = `**Yes**, ${targetProject.name} is equipped with **${matchedAmenities.join('**, **')}**.`
          amenityTiers.push('verified')
        } else if (askedAbout) {
          specificStatus = unverifiedFeature(askedAbout.label, targetProject.name)
          amenityTiers.push('missing')
        }

        const amenityChips = [
          { id: `chip_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View Cost Sheet & Taxes', icon: 'file-text', analyticsId: 'chip_cost_am', priority: 1, payload: { text: `Show cost sheet and price breakdown for ${targetProject.name}` } },
          { id: `chip_plan_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View Payment Plans', icon: 'calculator', analyticsId: 'chip_plan_am', priority: 2, payload: { text: `Show payment plans for ${targetProject.name}` } },
          { id: `chip_visit_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Schedule Site Visit', icon: 'calendar', analyticsId: 'chip_visit_am', priority: 3, payload: { text: `Schedule a site visit for ${targetProject.name}` } }
        ]

        // No invented list. An empty amenity table means we have not
        // captured the data, which is a different statement from "this
        // project has no amenities" — say the former, never imply either.
        if (amList.length > 0) amenityTiers.push('verified')

        /**
         * Grouped into a table, and not truncated when the buyer asked for all.
         *
         * The previous block printed a flat bullet list capped at eight, which
         * on "what ALL amenities are offered" answered a different question
         * than the one asked — a project with thirty recorded amenities showed
         * eight and said nothing about the other twenty-two. The cap now only
         * applies to an incidental mention; an explicit request for the full
         * list gets the full list, grouped by the category already stored on
         * every row so thirty entries stay readable.
         */
        const wantsAll = /\b(all|full|complete|every|entire|list|what all)\b/i.test(ctx.message)
        const byCategory = new Map<string, string[]>()
        for (const a of targetProject.amenities) {
          // Stored casing varies per row ("sports", "KIDS", "green_spaces") —
          // title-case every word so the column does not read as a data dump.
          const label = String(a.category ?? 'other')
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase())
          if (!byCategory.has(label)) byCategory.set(label, [])
          byCategory.get(label)!.push(a.name)
        }
        const amenityBlock = amList.length === 0
          ? unverified('amenity list', targetProject.name)
          : byCategory.size > 1
            ? `| Category | Amenities |\n| :--- | :--- |\n${
                [...byCategory.entries()]
                  .map(([cat, names]) => `| **${cat}** | ${(wantsAll ? names : names.slice(0, 6)).join(' · ')}${!wantsAll && names.length > 6 ? ` · +${names.length - 6} more` : ''} |`)
                  .join('\n')
              }\n\n_${amList.length} amenities recorded for ${targetProject.name}._`
            : `**Verified Project Amenities:**\n${(wantsAll ? amList : amList.slice(0, 8)).map(a => `• ${a}`).join('\n')}${!wantsAll && amList.length > 8 ? `\n\n_…and ${amList.length - 8} more — ask for the full list._` : ''}`

        // open_space_pct is a per-project figure; a Noida-wide band cannot
        // stand in for it, so it is simply omitted when absent.
        const openSpaceLine = targetProject.open_space_pct
          ? `\n\n**Open Space & Green Cover:**\n${targetProject.open_space_pct}% open space.`
          : ''

        const respText = `### ${headingFor('Amenities & Lifestyle', targetProject.name, amenityTiers)} (${targetProject.sector})\n\n${specificStatus ? specificStatus + '\n\n' : ''}${amenityBlock}${openSpaceLine}`

        ctx.send('token', { token: respText })
        ctx.emitUiState({
          stage: 'RESEARCH',
          thinking: `Amenities for ${targetProject.name}:`,
          chips: amenityChips,
          missingFields: amList.length > 0 ? [] : ['amenities'],
          confidence: confidenceFor(amenityTiers)
        })
        ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
        ctx.res.end()
        return true
      }
    }

    // No hardcoded sector default: falling back to "Sector 76" turned a
    // general amenities question into an answer about one arbitrary place.
    // With no sector we answer from whatever the buyer was already looking
    // at, and the query below simply matches on those ids.
    const sec = typeof ctx.intent.sector === 'string' && ctx.intent.sector ? ctx.intent.sector : ''
    let amenityProjects = await prisma.project.findMany({
      where: {
        OR: [
          ...sectorWhereClause(sec),
          { id: { in: (ctx.cachedProjects || []).map(p => p.id) } }
        ]
      },
      include: {
        amenities: true,
        builder: { select: { id: true, name: true, slug: true } },
        unit_types: true,
        images: { take: 3, orderBy: { sort_order: 'asc' } },
        connectivity: { take: 5, orderBy: { distance_km: 'asc' } }
      },
      take: 5
    })

    // No sector and no projects in play: no cards. The old fallback showed the
    // four most expensive projects with a pool, whatever amenity was asked about.

    if (amenityProjects.length > 0) {
      ctx.send('properties', {
        exactResults: amenityProjects,
        nearbyResults: [],
        expansion: null,
        renderTarget: 'both'
      })
    }

    // Every cell here carried a fallback literal: a project with no club in its
    // amenity rows was given a "Grand Resident Club", one with no sports rows
    // got "Swimming pool & gym", and a null open_space_pct became "70%+
    // Landscaped greens" — under a heading claiming the facilities were
    // verified. Amenities are the single most site-visit-discoverable claim in
    // the product, so a wrong yes here is found out in person. A gap prints a
    // dash; the amenity list we hold is incomplete, not confirmed-absent.
    const rows = amenityProjects.map(p => {
      const amNames = (p.amenities || []).map(a => a.name)
      const clubhouse = amNames.find(a => /club/i.test(a)) || '—'
      const sports = amNames.filter(a => /court|pool|swim|sport|track|tennis|gym/i.test(a)).slice(0, 3).join(', ') || '—'
      const green = p.open_space_pct != null ? `${p.open_space_pct}% open space` : '—'
      return `| **${p.name}** | ${p.sector} | ${clubhouse} | ${sports} | ${green} |`
    }).join('\n')

    const title = sec ? `Amenities & Lifestyle Guide — ${sec}` : `Societies with a recorded pool, gym or club`
    const amenityText = `### ${title}

| Society | Sector | Clubhouse & Community | Swimming Pool & Sports | Open Green Cover |
| :--- | :--- | :--- | :--- | :--- |
${rows}

*A dash means we hold no entry for that facility — the amenity lists we have are incomplete rather than confirmed-absent, so it is worth checking on a site visit.*

*Would you like detailed unit floor plans, monthly maintenance charges, or price breakdowns for any of these societies?*`

    const amenChips = [
      { id: `chip_rtm_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Show Ready-to-Move Flats', icon: 'check-circle', analyticsId: 'chip_rtm_am', priority: 1, payload: { text: 'Which of these are ready to move in?' } },
      { id: `chip_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'View Cost Sheet & Taxes', icon: 'file-text', analyticsId: 'chip_cost_am', priority: 2, payload: { text: 'Show cost sheet and price breakdown' } },
      { id: `chip_emi_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Calculate Monthly EMI', icon: 'calculator', analyticsId: 'chip_emi_am', priority: 3, payload: { text: 'Calculate EMI' } }
    ]

    ctx.send('token', { token: amenityText })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'Verified society lifestyle and amenities comparison:',
      chips: amenChips,
      missingFields: [],
      confidence: 'HIGH'
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'SHORTLISTED', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
    return true
  },
}

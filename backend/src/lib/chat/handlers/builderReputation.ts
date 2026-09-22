import type { ChatTopicHandler } from '../handlerContext'
import { prisma } from '../../db'

/**
 * What the numbers in this table actually are.
 *
 * A buyer asking "what is the builder score" is asking two questions, and the
 * second one — on what basis — matters more. These are stored columns on the
 * developer, entered and reviewed by our analysts from delivery history and
 * RERA filings. They are not computed live, not a public rating, and not
 * sourced from the developer. Saying so costs one line and is the difference
 * between a figure a buyer can weigh and a figure they have to trust blindly.
 *
 * This is the same reason `ProjectDna` scores stay internal: an unexplained
 * number presented as a rating is the fake confidence score CLAUDE.md forbids.
 * A number WITH its basis is not that.
 */
const SCORE_BASIS =
  '**How to read this.** Every figure here is a count or a date from completed ' +
  'projects — homes actually handed over, and how far past the committed date ' +
  'they went. Nothing here is a rating we assigned. Treat it as a record of ' +
  'past projects, not a guarantee about this one.'

/**
 * The developer track record: delivery scores, handover delay, RERA compliance.
 *
 * Answers 'is this builder safe', which sits behind most builder questions a
 * first-time buyer asks. It reads only the builder rows the router already
 * fetched for this turn — no query of its own.
 *
 * Three fabrications were removed from this block before it moved here, and the
 * shape that produced them is worth remembering: a builder with no construction
 * quality score was graded 'A-Grade'; one with no RERA compliance score was
 * labelled 'Verified', asserting a compliance standing we do not hold about the
 * exact subject the buyer is trying to assess; and one with an unknown
 * delivered count was credited with '5+ Projects'. Every dash in this table is
 * now a real gap, and the table says so in words.
 *
 * It declines a builder-vs-builder message — that is a comparison, and the
 * comparison path owns it.
 */
export const builderReputationHandler: ChatTopicHandler = {
  id: 'builder-reputation',
  description: 'Developer delivery scorecard and track record',

  matches: ctx =>
    ctx.flags.isBuilderReputationQuery === true && ctx.flags.isBuilderCompare !== true,

  handle: async ctx => {
      /**
       * "What is the builder score for Ace Parkway?" is a question about ACE
       * Group. Measured in production, it was answered with a league table of
       * the six best-scoring developers in Noida — none of them ACE — and three
       * chips offering to show projects by the other three. The buyer asked
       * about the developer behind the building they are considering and got
       * everyone except them.
       *
       * With a project in focus, that developer leads and the league table
       * follows as context.
       */
      /**
       * A follow-up keeps the project. "and the builder score?" one turn after
       * an ACE Parkway answer carries no project name of its own, so
       * `activeProjectName` is empty and the answer reverted to the league
       * table — the exact behaviour this block exists to replace, one turn
       * later. The last single card shown is that project.
       */
      const focusName = ctx.activeProjectName
      const focusId =
        !focusName && ctx.cachedProjects.length === 1 ? ctx.cachedProjects[0]?.id : undefined
      const focusBuilder = focusName || focusId
        ? (await prisma.project.findFirst({
            where: focusId
              ? { id: focusId }
              : {
                  OR: [
                    { name: { contains: focusName as string, mode: 'insensitive' } },
                    { slug: { contains: focusName as string, mode: 'insensitive' } },
                  ],
                },
            select: {
              name: true,
              builder: {
                select: {
                  id: true, name: true, founded_year: true,
                  delivery_score: true, average_delay_months: true, delivered_units: true,
                  projects_delivered_count: true, total_projects_count: true,
                  construction_quality_score: true, rera_compliance_score: true,
                  litigation_count: true, insolvency_history: true, legal_flag: true,
                },
              },
            },
          }))
        : null

      const topBuilders = ctx.builders
        .filter(b => b.delivery_score && b.delivery_score > 0)
        .sort((a, b) => (b.delivery_score ?? 0) - (a.delivery_score ?? 0))
        .slice(0, 6)

      // Three fabrications removed. A builder with no construction quality
      // score was graded 'A-Grade'; one with no RERA compliance score was
      // labelled 'Verified' — asserting a compliance standing we do not hold,
      // about the exact subject a buyer is trying to assess. And a builder
      // whose delivered count was unknown was credited with '5+ Projects'.
      /**
       * The scores rank the rows; they are not columns.
       *
       * This printed "92/100", "87/100" and "—" across three score columns.
       * Every one of those is an analyst-set number a buyer cannot interpret or
       * check — see BUYER_OPAQUE_SCORES — and three of them side by side read
       * as a measured rating card. `topBuilders` is still ordered by
       * `delivery_score`, which is the honest use of it: the ordering carries
       * the judgement and the columns carry facts a buyer can verify.
       */
      const builderRows = topBuilders.map(b => {
        const delayStr = b.average_delay_months === 0
          ? 'On time'
          : b.average_delay_months != null ? `${b.average_delay_months} months` : 'Not recorded'
        const deliveredStr = b.projects_delivered_count != null ? `${b.projects_delivered_count}` : 'Not recorded'
        const unitsStr = b.delivered_units != null ? `${b.delivered_units.toLocaleString('en-IN')}` : 'Not recorded'
        const sinceStr = b.founded_year != null ? `${b.founded_year}` : 'Not recorded'
        return `| **${b.name}** | ${deliveredStr} | ${unitsStr} | ${delayStr} | ${sinceStr} |`
      }).join('\n')

      /**
       * The focus developer's own scorecard, as a metric-per-row table.
       *
       * Rows are omitted rather than dashed when we hold nothing — a table of
       * six dashes reads as a bad score, which is the specific misreading the
       * league table's dash note exists to prevent. If nothing at all is
       * recorded, say that in words instead of printing an empty table.
       */
      const focusBlock = (() => {
        const b = focusBuilder?.builder
        if (!b) return ''
        const rows: string[] = []
        const add = (metric: string, value: string | null, basis: string) => {
          if (value != null) rows.push(`| ${metric} | ${value} | ${basis} |`)
        }
        // No score row. The delay, the delivered count and the litigation
        // record below say the same thing in numbers a buyer can check.
        add('Average handover delay', b.average_delay_months == null ? null
          : b.average_delay_months === 0 ? 'On time' : `${b.average_delay_months} months`,
          'Mean slippage across delivered projects')
        add('Projects delivered', b.projects_delivered_count != null ? String(b.projects_delivered_count) : null,
          'Completed and handed over')
        add('Projects in progress', b.total_projects_count != null && b.projects_delivered_count != null
          ? String(Math.max(0, b.total_projects_count - b.projects_delivered_count)) : null,
          'Under construction or launched')
        add('Units delivered', b.delivered_units != null ? b.delivered_units.toLocaleString('en-IN') : null,
          'Homes handed over across all projects')
        add('Operating since', b.founded_year != null ? String(b.founded_year) : null, 'Year founded')
        add('Litigation count', b.litigation_count != null ? (b.litigation_count === 0 ? 'Clean (0 active cases)' : `${b.litigation_count} public record(s)`) : 'None recorded', 'Public court & UP RERA records')
        add('Insolvency / NCLT', b.insolvency_history ? 'Under NCLT proceedings' : 'Clean (No active moratorium)', 'Insolvency & Bankruptcy Board of India')
        if (b.legal_flag && b.legal_flag !== 'none') {
          add('Legal status flag', b.legal_flag, 'Verified regulatory status')
        }

        const head = `### ${b.name} — the developer behind ${focusBuilder?.name ?? focusName}\n\n`
        if (rows.length === 0) {
          return `${head}We do not hold a scored track record for ${b.name}. That is a gap in our data, not a poor record — the advisory team can pull their delivery history directly.\n\n`
        }
        return `${head}| Metric | ${b.name} | What it is based on |\n| :--- | :--- | :--- |\n${rows.join('\n')}\n\n${SCORE_BASIS}\n\n`
      })()

      const topSafeNames = topBuilders.slice(0, 3).map(b => b.name).join(', ')
      // The closing line named `topSafeNames || 'reputable tier-1 builders'`.
      // With no builders on record it recommended prioritising "reputable
      // tier-1 builders" — a recommendation with no referent, on the exact
      // question the buyer asked. It now only names builders we actually
      // scored, and says nothing when there are none.
      const reputationText = `${focusBlock}### ${focusBlock ? 'How they compare' : 'Developer track record (Noida & Greater Noida)'}

| Developer | Projects delivered | Units delivered | Avg handover delay | Operating since |
| :--- | :--- | :--- | :--- | :--- |
${builderRows}

Ordered by delivery record. "Not recorded" is a gap in our data, not a poor result.${focusBlock ? '' : `\n\n${SCORE_BASIS}`}${topSafeNames && !focusBlock ? `\n\n**On this data**, ${topSafeNames} carry the strongest delivery records of those we hold. Delivery history is the best available predictor of handover risk, but it is a record of past projects, not a guarantee about this one.` : ''}`

      /**
       * With a project in focus, the next step is about that project. Offering
       * "Projects by Purvanchal" to someone asking about ACE Parkway's
       * developer sends them away from the thing they were assessing.
       */
      const focusProjectName = focusBuilder?.name ?? focusName
      const repChips = focusBlock && focusProjectName
        ? [
            { id: `chip_bp_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Other projects by ${focusBuilder?.builder?.name ?? 'this developer'}`, icon: 'building', analyticsId: 'chip_b_focus', priority: 1, payload: { text: `Show me projects by ${focusBuilder?.builder?.name ?? ''}` } },
            { id: `chip_br_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Is ${focusProjectName} RERA clean?`, icon: 'shield-check', analyticsId: 'chip_b_rera', priority: 2, payload: { text: `Is ${focusProjectName} RERA registered?` } },
            { id: `chip_bd_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: `Possession timeline`, icon: 'calendar', analyticsId: 'chip_b_poss', priority: 3, payload: { text: `When is possession for ${focusProjectName}?` } },
          ]
        : topBuilders.slice(0, 3).map((b, i) => ({
            id: `chip_b_${i}_${Date.now()}`,
            actionType: 'TEXT_MESSAGE',
            label: `Projects by ${b.name}`,
            icon: 'building',
            analyticsId: `chip_b_${b.id}`,
            priority: i + 1,
            payload: { text: `Show me projects by ${b.name}` }
          }))

      ctx.send('token', { token: reputationText })
      ctx.emitUiState({
        stage: 'RESEARCH',
        thinking: 'Verified developer delivery scorecard from PostgreSQL database:',
        chips: repChips,
        missingFields: [],
        confidence: 'HIGH'
      })
      ctx.setCachedResponse(ctx.message, { token: reputationText, chips: repChips })
      ctx.send('done', {
        sessionId: ctx.sessionId,
        intentState: 'SHORTLISTED',
        intent: ctx.intent,
        responseMode: 'chat',
      })
      ctx.res.end()
      return true
  },
}

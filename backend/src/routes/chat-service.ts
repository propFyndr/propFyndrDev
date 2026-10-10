// backend/src/routes/chat-service.ts
import { UP_STATUTORY } from '../lib/factPresentation'
import { prisma } from '../lib/db'

export async function generateDatabaseFallbackResponse(userMsg: string, projects: any[], sessionId?: string): Promise<any> {
  const queryLower = userMsg.toLowerCase()
  let p = projects.find((proj) => proj.name && queryLower.includes(proj.name.toLowerCase())) || projects[0] || null

  if (!p && userMsg) {
    try {
      const dbMatch = await (prisma as any).project.findFirst({
        where: { name: { contains: userMsg.slice(0, 20), mode: 'insensitive' } },
        include: { unit_types: true, payment_plans: true, amenities: true, cost_sheet: true },
      })
      if (dbMatch) p = dbMatch
    } catch {
      // Ignore fallback DB search errors
    }
  }

  if (p) {
    const name = p.name || 'this project'
    const sector = p.sector || 'Noida'

    // Hydrate full project relations if missing
    if (p.id && (!p.decision_profile || !p.competitors)) {
      try {
        const fullProj = await prisma.project.findUnique({
          where: { id: p.id },
          include: {
            builder: true,
            unit_types: true,
            payment_plans: true,
            cost_sheet: true,
            amenities: true,
            connectivity: true,
            decision_profile: true,
            competitors: true,
            construction_updates: true,
            construction_milestones: true,
          }
        })
        if (fullProj) p = { ...p, ...fullProj }
      } catch (e) {
        console.warn('[CHAT:DB_FETCH_FULL_PROJECT]', e)
      }
    }

    // 1. Multi-Plan Payment Overview & Selection
    if (queryLower.includes('payment') || queryLower.includes('plan') || queryLower.includes('clp') || queryLower.includes('flexi') || queryLower.includes('down payment') || queryLower.includes('possession linked') || queryLower.includes('nri plan') || queryLower.includes('flow') || queryLower.includes('flows') || queryLower.includes('schedule') || queryLower.includes('milestone')) {
      const priceText = p.price_min_cr && p.price_max_cr
        ? `₹${p.price_min_cr} Cr – ₹${p.price_max_cr} Cr`
        : p.price_min_cr ? `₹${p.price_min_cr} Cr onwards` : 'Price available on request'

      let plansList: any[] = []
      if (Array.isArray(p.payment_plans) && p.payment_plans.length > 0) {
        plansList = [...p.payment_plans]
        const isSpecificPlanQuery = queryLower.includes('flexi plan') || queryLower.includes('down payment plan') || queryLower.includes('clp plan') || queryLower.includes('investor plan');
        if (isSpecificPlanQuery) {
          if (queryLower.includes('flexi')) {
            const matched = plansList.filter((pl: any) => (pl.plan_name || pl.name || '').toLowerCase().includes('flexi'))
            if (matched.length > 0) plansList = matched
          } else if (queryLower.includes('down payment')) {
            const matched = plansList.filter((pl: any) => (pl.plan_name || pl.name || '').toLowerCase().includes('down payment'))
            if (matched.length > 0) plansList = matched
          } else if (queryLower.includes('investor') || queryLower.includes('quad')) {
            const matched = plansList.filter((pl: any) => (pl.plan_name || pl.name || '').toLowerCase().includes('investor'))
            if (matched.length > 0) plansList = matched
          } else if (queryLower.includes('clp') || queryLower.includes('construction linked')) {
            const matched = plansList.filter((pl: any) => (pl.plan_name || pl.name || '').toLowerCase().includes('construction'))
            if (matched.length > 0) plansList = matched
          }
        }
        // Filter out Construction Linked Plans for Ready to Move projects
        if (p.status && p.status.toLowerCase().includes('ready')) {
          plansList = plansList.filter((pl: any) => {
            const name = (pl.plan_name || pl.name || '').toLowerCase()
            return !name.includes('construction') && !name.includes('clp')
          })
        }
      }

      let plansText = ''
      if (plansList.length > 0) {
        plansText = plansList.map((plan: any) => {
          // Each of these had an invented default: a 10% down payment, a 36-month
          // tenure, a "Buyers seeking structured payment flexibility" rationale
          // and a "Timely payment of stage demand notes required" caveat — all
          // presented under a "Verified Payment Plan Options" heading. Payment
          // terms are the basis of a buyer's cash-flow planning.
          const planName = plan.plan_name || plan.name || plan.plan_type || 'Payment plan'
          const downPay = plan.down_payment_pct != null ? `${plan.down_payment_pct}%` : '—'
          const bookingAmt = plan.booking_amount ? `₹${plan.booking_amount}` : (plan.booking_amount_lakh ? `₹${plan.booking_amount_lakh} Lakh` : '—')
          const tenure = plan.total_duration_months ? `${plan.total_duration_months} months` : '—'
          const discount = plan.discount_offered || (plan.discount_pct ? `${plan.discount_pct}%` : '—')
          const bestFor = plan.best_for || null
          const watchOut = plan.watch_out || plan.penalty_clause || '—'

          let milestonesMarkdown = ''
          if (Array.isArray(plan.milestones) && plan.milestones.length > 0) {
            milestonesMarkdown = '\n>\n> **Payment Milestones**:\n' + plan.milestones.map((m: any) => {
              const mName = m.milestone || m.name || 'Stage'
              const pctStr = m.pct != null ? ` (${m.pct}%)` : ''
              const dueStr = m.due || m.amt ? `: **${m.due || m.amt}**` : ''
              return `> - 🔹 **${mName}**${dueStr}${pctStr}`
            }).join('\n')
          }

          return `> ### **${planName}**\n` +
            (bestFor ? `> _${bestFor}_\n` : '') +
            `>\n` +
            `> | Highlight | Details |\n` +
            `> | :--- | :--- |\n` +
            `> | **Down Payment** | ${downPay} |\n` +
            `> | **Booking Token** | ${bookingAmt} |\n` +
            `> | **Total Tenure** | ${tenure} |\n` +
            `> | **Discount** | ${discount} |\n` +
            `> | **Watch Out** | ${watchOut} |` +
            milestonesMarkdown
        }).join('\n\n---\n\n')
      } else {
        // A complete 10:70:20 schedule used to be invented here and printed
        // under "Verified Payment Plan Options" for a project whose plans we do
        // not hold. The percentages were not this developer's — they were not
        // anyone's.
        plansText = `We don't have ${name}'s payment schedule verified in our records yet. Our advisory team can pull the developer's official terms — want me to arrange that?`
      }

      const heading = plansList.length > 0 ? 'Payment plans' : 'Payment plans — not yet on record'
      const replyText = `### ${heading} — **${name}** (${sector})\n\n**Price range**: ${priceText}\n\n${plansText}`
      return { message: replyText }
    }

    // 2. Full Cost Sheet & Maintenance Breakdown + Rental Yield
    if (queryLower.includes('cost') || queryLower.includes('charge') || queryLower.includes('sheet') || queryLower.includes('breakdown') || queryLower.includes('gst') || queryLower.includes('stamp') || queryLower.includes('bsp') || queryLower.includes('maintenance') || queryLower.includes('society') || queryLower.includes('fee') || queryLower.includes('yield') || queryLower.includes('rental') || queryLower.includes('roi')) {
      // Developer charges are per-project: a dash where we hold nothing. The
      // previous defaults claimed a 'Standard' floor rise, a '₹2.5 – ₹3.5/sq.ft'
      // maintenance band and — worst — 'Included / Standard' parking, telling a
      // buyer parking was bundled when we simply had no figure.
      //
      // parking_cost / ifms / club_membership are stored in RUPEES (see the unit
      // note on the CostSheet model). This rendered ₹6,00,000 as "₹600000 Lakhs".
      const cs = p.cost_sheet || {}
      const NOT_RECORDED = '—'
      const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`
      const bsp = cs.base_price_per_sqft ? `${inr(cs.base_price_per_sqft)}/sq.ft` : NOT_RECORDED
      const floorRise = cs.floor_rise_per_floor ? `${inr(cs.floor_rise_per_floor)}/sq.ft per floor` : NOT_RECORDED
      // GST and stamp duty are statutory, so a default here is a rate not a guess.
      const gstRate = cs.gst_rate_pct != null
        ? `${cs.gst_rate_pct}%`
        : `${UP_STATUTORY.gstUnderConstructionPct}% (${UP_STATUTORY.gstReadyToMovePct}% once OC is granted)`
      const stampDuty = cs.stamp_duty_pct != null ? `${cs.stamp_duty_pct}%` : `${UP_STATUTORY.stampDutyPct}%`
      const maintenance = cs.maintenance_psf_monthly ? `${inr(cs.maintenance_psf_monthly)}/sq.ft per month` : NOT_RECORDED
      const parking = cs.parking_cost ? inr(cs.parking_cost) : NOT_RECORDED
      const anyMissing = [bsp, floorRise, maintenance, parking].includes(NOT_RECORDED)

      return {
        message: `### Cost sheet — **${name}** (${sector})\n\n` +
          `| Component | Rate |\n` +
          `| :--- | :--- |\n` +
          `| **Base price (BSP)** | **${bsp}** |\n` +
          `| **Floor rise** | ${floorRise} |\n` +
          `| **GST** | **${gstRate}** |\n` +
          `| **Stamp duty & registration** | **${stampDuty} + ${UP_STATUTORY.registrationPct}%** |\n` +
          `| **Maintenance** | ${maintenance} |\n` +
          `| **Covered parking** | ${parking} |` +
          (anyMissing
            ? `\n\nA dash means the developer's figure is not in our records — it is not a statement that the charge does not apply. Our advisory team can pull the official booking cost sheet.`
            : '')
      }
    }

    // Simplified: return basic project details for other queries
    return {
      message: `### Project Details for **${name}** (${sector})\n\n` +
        `For more information about ${name}, please ask about specific aspects like payment plans, amenities, location, or timeline.`
    }
  }

  // This block ran when we had no project at all, yet announced "Verified
  // Project Details", "Here are the verified records on file", a status of
  // "Active Verified Project" and — for a project with no RERA number — a RERA
  // registration reading "Verified RERA Approved". Four separate assertions of
  // verification about something we did not have.
  if (!p) {
    return {
      message:
        `I don't have a verified record for that project.\n\n` +
        `Tell me the project name and sector and I'll check properly, or our advisory team can look it up for you.`,
    }
  }

  const lines = [
    p.status ? `- **Status**: ${p.status}` : null,
    `- **Location**: ${p.sector}, ${p.city ?? 'Noida'}`,
    p.price_range_label
      ? `- **Price**: ${p.price_range_label}`
      : p.price_min_cr ? `- **Price**: ₹${p.price_min_cr} Cr onwards` : null,
    p.rera_number ? `- **RERA**: ${p.rera_number}` : null,
  ].filter(Boolean)

  return {
    message: `### ${p.name} (${p.sector})\n\n` +
      `${lines.join('\n')}\n\n` +
      `Ask about payment plans, the cost sheet, amenities, location or possession and I'll pull what we hold.`,
    components: [
      {
        type: 'lead-form',
        props: {
          projectName: p.name,
          inquiryTopic: userMsg,
        }
      }
    ]
  }
}

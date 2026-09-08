import { prisma } from '../../db'
import { gatePublished } from '../../intelligenceGate'
import { getBuilderRecord } from '../../builders'
import { FINANCIAL, DISCOVERY } from '../../config'
import { webSearch, areaInfo, commute, readPage } from '../../web'
import { calcEmi, calcStampDuty, calcGst, formatInr } from '../../calculators'
import {
  getBuyerFit,
  getFloorPlans,
  getPriceHistory,
  getConstructionStatus,
  getProjectIntelligence,
  getFullCostSheet,
  getAmenitiesAndConnectivity,
  getProjectImages,
  getBuilderNews,
  getUserSavedState,
  getSectorProjects,
  getProjectFinancialDetails,
  getBestValueProjects,
  getFastestPossessionProjects,
  getBestForFamiliesProjects,
} from '../../projectFacts'

const DEFAULT_CITY = DISCOVERY.DEFAULT_CITY

/**
 * Every tool the model can call, in one place.
 *
 * These three hundred lines sat inside the request handler in chat-router.ts,
 * closed over the whole turn. They needed exactly two things from it — who is
 * asking and which session — so they did not have to live there, and living
 * there meant the only way to exercise a tool was to run a chat turn against a
 * live provider.
 *
 * Anything advertised in the catalogue must have a case here; toolCatalogue.test
 * enforces that, after three tools were once offered to the model with nothing
 * behind them.
 *
 * Errors never propagate. A tool that throws returns a sentence telling the
 * model to say the information is temporarily unavailable — because the
 * alternative is a dead turn, and because inventing the answer instead is the
 * one thing this product cannot do.
 */
export interface ToolContext {
  /** Verified user id, or undefined for a guest. Never client-supplied. */
  userId?: string
  /** The session this turn belongs to, for tools that read saved state. */
  sessionId?: string | null
}

/**
 * In-process counters: how often each tool is actually called, and how often
 * the call comes back as an error.
 *
 * Before this, tool usage had no counter, no analytics event, and no trace —
 * the single most load-bearing mechanism in the chat architecture (every
 * DB-backed lookup, every calculator, every RERA check) was entirely
 * unobserved. This is deliberately the cheapest possible version: in-memory,
 * per-process, reset on deploy. It answers "is this being called at all" and
 * "which tools error the most", which is the question that mattered and had
 * no answer. A durable, cross-process version (a table, a proper analytics
 * event) is a schema decision — see PLAN.md Phase 0 — not made here.
 */
const toolCallStats = new Map<string, { calls: number; errors: number }>()

/** Read-only snapshot for a future admin panel or health-check endpoint. */
export function getToolCallStats(): Record<string, { calls: number; errors: number }> {
  return Object.fromEntries(toolCallStats.entries())
}

/** Test seam. */
export function resetToolCallStats(): void {
  toolCallStats.clear()
}

export function createToolHandler(ctx: ToolContext) {
  const { userId, sessionId: currentSessionId } = ctx

  const handleToolCall = async function handleToolCallInner(name: string, args: any): Promise<any> {
    try {
          if (name === 'payment_plan_lookup') {
            const pName = args.project_name ?? args.name ?? '';
            const proj = await prisma.project.findFirst({
              where: { name: { contains: pName, mode: 'insensitive' } },
              include: {
                payment_plans: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
                cost_sheet: true,
              }
            });
            const populatedPlans = (proj?.payment_plans ?? []).filter(
              p => Array.isArray(p.milestones) && (p.milestones as unknown[]).length > 0
            );
            if (proj && populatedPlans.length > 0) {
              const primary = populatedPlans[0];
              return {
                found: true,
                project_name: proj.name,
                plan_name: primary.plan_name ?? 'Custom Payment Plan',
                milestones: primary.milestones,
                notes: primary.notes ?? null,
                // All available plans, so the advisor can compare them for the buyer.
                plans: populatedPlans.map(p => ({
                  plan_type: p.plan_type,
                  plan_name: p.plan_name ?? 'Custom Payment Plan',
                  milestones: p.milestones,
                  notes: p.notes ?? null,
                })),
                cost_sheet: proj.cost_sheet ? {
                  base_price_per_sqft: proj.cost_sheet.base_price_per_sqft,
                  gst_rate_pct: proj.cost_sheet.gst_rate_pct,
                  stamp_duty_pct: proj.cost_sheet.stamp_duty_pct,
                  registration_pct: proj.cost_sheet.registration_pct
                } : undefined
              };
            }
            const nameToUse = proj ? proj.name : pName;
            return {
              found: false,
              project_name: nameToUse,
              message: `Payment plan details for ${nameToUse} are available on request. Custom payment structures (including Construction-Linked, Down Payment, and Flexi options) can be tailored with our team. Instruct the user to connect with our PropFyndr team via the 'Book Site Visit' or 'Callback' button for custom payment slabs.`
            };
          }

          if (name === 'builder_lookup') {
            const rec = await getBuilderRecord(args.name ?? '');
            if (!rec) {
              console.warn('[TELEMETRY:DATA_GAP]', {
                type: 'builder_not_found',
                builderName: args.name,
                sessionId: currentSessionId,
                timestamp: new Date().toISOString(),
              });
              return {
                found: false,
                message: `No verified record for "${args.name}" in the PropFyndr database. You may share clearly-labelled general knowledge or call web_search, but never invent specific delivery counts or reputation scores.`,
              };
            }
            return rec;
          }

        // ── On-demand detail lookups ────────────────────────────────────────
        // Pull-based by design: these read tables the system prompt does not
        // carry, so the buyer sees this depth only when they ask for it.
        if (name === 'buyer_fit_analysis') {
          return getBuyerFit(args.project_name ?? '');
        }

        if (name === 'floor_plans_lookup') {
          return getFloorPlans(args.project_name ?? '');
        }

        if (name === 'price_history_lookup') {
          return getPriceHistory(args.project_name ?? '');
        }

        if (name === 'construction_status') {
          return getConstructionStatus(args.project_name ?? '');
        }

        if (name === 'project_intelligence') {
          return getProjectIntelligence(args.project_name ?? '', args.topic);
        }

        if (name === 'cost_sheet_lookup') {
          return getFullCostSheet(args.project_name ?? '');
        }

        if (name === 'project_financial_details') {
          return getProjectFinancialDetails(args.project_name ?? '');
        }

        if (name === 'amenities_lookup') {
          return getAmenitiesAndConnectivity(args.project_name ?? '');
        }

        if (name === 'project_images') {
          return getProjectImages(args.project_name ?? '');
        }

        if (name === 'builder_news') {
          return getBuilderNews(args.builder_name ?? '');
        }

        if (name === 'user_saved_state') {
          return getUserSavedState(userId);
        }

        if (name === 'sector_projects') {
          return getSectorProjects({
            sector: args.sector,
            city: args.city ?? DEFAULT_CITY,
            bhk: args.bhk != null ? Number(args.bhk) : undefined,
            maxBudgetCr: args.max_budget_cr != null ? Number(args.max_budget_cr) : undefined,
            limit: args.limit != null ? Number(args.limit) : undefined,
          });
        }

        if (name === 'best_value_projects') {
          return getBestValueProjects({
            sector: args.sector,
            city: args.city ?? DEFAULT_CITY,
            bhk: args.bhk != null ? Number(args.bhk) : undefined,
            maxBudgetCr: args.max_budget_cr != null ? Number(args.max_budget_cr) : undefined,
            limit: args.limit != null ? Number(args.limit) : undefined,
          });
        }

        if (name === 'fastest_possession_projects') {
          return getFastestPossessionProjects({
            sector: args.sector,
            city: args.city ?? DEFAULT_CITY,
            bhk: args.bhk != null ? Number(args.bhk) : undefined,
            limit: args.limit != null ? Number(args.limit) : undefined,
          });
        }

        if (name === 'best_for_families_projects') {
          return getBestForFamiliesProjects({
            sector: args.sector,
            city: args.city ?? DEFAULT_CITY,
            maxBudgetCr: args.max_budget_cr != null ? Number(args.max_budget_cr) : undefined,
            limit: args.limit != null ? Number(args.limit) : undefined,
          });
        }

        if (name === 'web_search') {
          const ctx = await webSearch(args.query ?? '', 3);
          return ctx
            ? { results: ctx, note: 'Cite the sources in your answer.' }
            : { results: '', message: 'No web results found. Answer from general knowledge and state explicitly that it is not verified.' };
        }

        if (name === 'area_info') {
          const info = await areaInfo(args.sector ?? '', args.city ?? DEFAULT_CITY);
          return info ? { info } : { info: null, message: 'No Wikipedia article found. Answer from general knowledge of Noida and label it as such.' };
        }

        if (name === 'rera_check') {
          const url = args.rera_url || (args.rera_number
            ? `https://www.up-rera.in/projects?project_search=${encodeURIComponent(args.rera_number)}`
            : 'https://www.up-rera.in');
          const content = await readPage(url, 2000);
          /**
           * A page that loaded is not a record that was found.
           *
           * up-rera.in is an ASP.NET application whose project search is a form
           * postback, so a GET with `?project_search=UPRERAPRJ1504` returns the
           * site chrome and nothing else — navigation, the logo, the font-size
           * controls, the current date. Measured: 10,311 characters, and not one
           * mention of either project registered under that number.
           *
           * The old check was `content ? …`, and chrome is truthy. So this tool
           * reported success and handed the model ten kilobytes of navigation
           * links under the key `rera_page`, having told it in the catalogue
           * that this is "live RERA registration details from the UP-RERA
           * portal". The model then had to either invent a status or contradict
           * its own tool result.
           *
           * The honest branch already existed below; it was simply unreachable.
           * A real record names the project or the promoter, so that is the
           * test — not whether bytes came back.
           */
          const looksLikeARecord =
            typeof content === 'string' &&
            /\b(promoter|project\s+name|registration\s+(?:no|number)|registered\s+on|proposed\s+completion)\b/i.test(content);

          if (!looksLikeARecord) {
            console.warn('[TOOL:rera_check] portal returned no record', {
              url,
              chars: typeof content === 'string' ? content.length : 0,
            });
          }

          return looksLikeARecord
            ? { rera_page: content, source: url }
            : { rera_page: null, message: 'Could not fetch live RERA details — the UP-RERA portal does not answer a direct lookup. Use the registration number we hold on the project row, and say plainly that it has not been re-checked against the portal today.' };
        }

        if (name === 'commute') {
          const r = await commute(args.origin ?? '', args.destination ?? '');
          return r ? { commute: r } : { commute: null, message: 'Tell the user commute data is temporarily unavailable. Do not provide approximate times from memory.' };
        }

        if (name === 'calculate_emi') {
          const pCr = Number(args.principalCr);
          const aRate = Number(args.annualRate ?? FINANCIAL.EMI_RATE);
          const tYears = Number(args.tenureYears ?? FINANCIAL.LOAN_TENURE_YEARS);
          if (isNaN(pCr) || isNaN(aRate) || isNaN(tYears) || pCr <= 0) {
            return { error: 'Invalid parameters for calculate_emi. principalCr must be a positive number.' };
          }
          const r = calcEmi(pCr, aRate, tYears);
          return {
            monthly_emi: formatInr(r.emi),
            total_payment: formatInr(r.totalPayment),
            total_interest: formatInr(r.totalInterest),
            assumptions: { annual_rate_pct: aRate, tenure_years: tYears },
          };
        }

        if (name === 'calculate_stamp_duty') {
          const pCr = Number(args.priceCr);
          if (isNaN(pCr) || pCr <= 0) {
            return { error: 'Invalid priceCr parameter for calculate_stamp_duty. Must be a positive number.' };
          }
          const g = (args.gender === 'female' || args.gender === 'joint') ? args.gender : 'male';
          const r = calcStampDuty(pCr, g);
          return { stamp_duty: formatInr(r.stampDuty), registration: formatInr(r.registration), total: formatInr(r.total), rate_pct: r.rate };
        }

        if (name === 'calculate_gst') {
          const pCr = Number(args.priceCr);
          const cSqm = Number(args.carpetSqm ?? 0);
          if (isNaN(pCr) || pCr <= 0 || isNaN(cSqm)) {
            return { error: 'Invalid parameters for calculate_gst. priceCr must be a positive number.' };
          }
          const st = args.status === 'ready_to_move' ? 'ready_to_move' : 'under_construction';
          const r = calcGst(pCr, st, cSqm);
          return { gst: formatInr(r.gst), rate_pct: r.rate, category: r.category };
        }

        if (name === 'project_costs') {
          const projectId = args.project_id ?? '';
          if (!projectId) {
            return { error: 'project_id is required' };
          }
          const [costSheet, paymentPlans] = await Promise.all([
            (prisma as any).costSheet.findUnique({ where: { project_id: projectId } }),
            (prisma as any).paymentPlan.findMany({
              where: { project_id: projectId },
              orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
            }),
          ]);
          return {
            cost_sheet: costSheet || null,
            payment_plan: paymentPlans[0] || null,
            payment_plans: paymentPlans,
            message: !costSheet && !paymentPlans.length ? 'Cost details not yet verified in database. Output exactly this: <realty-action type="contact" />' : undefined,
          };
        }

        if (name === 'project_nearby') {
          const projectId = args.project_id ?? '';
          if (!projectId) {
            return { error: 'project_id is required' };
          }
          const connectivity = await prisma.connectivity.findMany({
            where: { project_id: projectId },
            take: 30,
          });
          if (!connectivity.length) {
            return { nearby: [], message: 'Connectivity data not available. Output exactly this: <realty-action type="contact" />' };
          }
          // Manual groupBy (Object.groupBy requires ES2024)
          const grouped: Record<string, typeof connectivity> = {};
          for (const c of connectivity) {
            const type = String(c.type);
            if (!grouped[type]) grouped[type] = [];
            grouped[type].push(c);
          }
          return { nearby: connectivity, grouped };
        }

        if (name === 'project_amenities') {
          const projectId = args.project_id ?? '';
          if (!projectId) {
            return { error: 'project_id is required' };
          }
          const amenities = await prisma.amenity.findMany({
            where: { project_id: projectId },
            take: 50,
          });
          if (!amenities.length) {
            return { amenities: [], message: 'Amenity information not available. Output exactly this: <realty-action type="contact" />' };
          }
          // Manual groupBy (Object.groupBy requires ES2024)
          const grouped: Record<string, typeof amenities> = {};
          for (const a of amenities) {
            if (!grouped[a.category]) grouped[a.category] = [];
            grouped[a.category].push(a);
          }
          return { amenities, grouped };
        }

        if (name === 'project_competitors') {
          const projectId = args.project_id ?? '';
          if (!projectId) {
            return { error: 'project_id is required' };
          }
          const competitors = await (prisma as any).projectCompetitor.findMany({
            where: { project_id: projectId },
            orderBy: { sort_order: 'asc' },
            take: 5,
          });
          if (!competitors || !competitors.length) {
             return { competitors: [], message: 'No competitor data available for this project. Output exactly this: <realty-action type="contact" />' }
          }
          return { competitors };
        }

        if (name === 'project_documents') {
          const projectId = args.project_id ?? '';
          if (!projectId) {
            return { error: 'project_id is required' };
          }
          const documents = await (prisma as any).projectDocument.findMany({
            where: { project_id: projectId },
            take: 3,
          });
          if (!documents || !documents.length) {
             return { documents: [], message: 'No documents available for this project. Output exactly this: <realty-action type="contact" />' }
          }
          const trimmedDocs = documents.map((d: any) => ({
             ...d,
             content_text: d.content_text ? d.content_text.substring(0, 500) + (d.content_text.length > 500 ? '...' : '') : null
          }))
          return { documents: trimmedDocs };
        }

        if (name === 'select_property') {
          const propertyId = args.property_id;
          if (!propertyId) return { error: 'property_id is required' };
          const raw = await (prisma as any).project.findUnique({
            where: { id: propertyId },
            include: {
              builder: { select: { name: true, slug: true } },
              unit_types: { select: { bhk: true, price_min_cr: true, price_max_cr: true, super_area_sqft: true } },
              images: { where: { type: 'hero' }, take: 1, select: { url: true } },
              decision_profile: { select: { status: true, why_buy: true, why_avoid: true, decision_thesis: true } },
              recommendation_profile: { select: { status: true, primary_thesis: true } }
            }
          });
          if (!raw) return { error: 'Property not found.' };
          const property = {
            ...raw,
            decision_profile: gatePublished(raw.decision_profile),
            recommendation_profile: gatePublished(raw.recommendation_profile),
          };
          return { property };
        }

      return { error: 'Tool not recognized' };
    } catch (toolErr) {
      console.error(`[CHAT:TOOL_ERROR] ${name}:`, toolErr);
      return { error: `Tool ${name} failed to execute. Tell the user this information is temporarily unavailable.` };
    }
  };

  return async function instrumentedToolCall(name: string, args: any): Promise<any> {
    const stat = toolCallStats.get(name) ?? { calls: 0, errors: 0 }
    stat.calls++
    const t0 = Date.now()
    const result = await handleToolCall(name, args)
    const isError = !!(result && typeof result === 'object' && 'error' in result)
    if (isError) stat.errors++
    toolCallStats.set(name, stat)
    console.log(`[TOOL:CALL] ${name} — ${Date.now() - t0}ms${isError ? ' — ERROR' : ''}`)
    return result
  }
}

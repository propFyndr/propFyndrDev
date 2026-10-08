import { prisma } from './db'

export function normalizeBuilderSearchName(raw: string): string {
  return raw
    .replace(/\b(projects|group|developers|developer|infratech|infra|limited|ltd|pvt|llp|realtors|realtech|buildtech)\b/gi, '')
    .trim();
}

// Defined once so the name lookup and the slug/parent-group fallback return
// identical shapes.
const BUILDER_INCLUDE = {
  projects: {
    select: {
      name: true, sector: true, status: true,
      rera_number: true, possession_label: true,
    },
    take: 25,
  },
  delivery_records: {
    orderBy: { promised_date: 'asc' as const },
    take: 40,
  },
};

export async function getBuilderRecord(name: string): Promise<Record<string, unknown> | null> {
  const cleanName = (name ?? '').trim();
  if (!cleanName) return null;
  const normalizedName = normalizeBuilderSearchName(cleanName);

  let builder = await (prisma.builder as any).findFirst({
    where: {
      OR: [
        { name: { contains: cleanName, mode: 'insensitive' as const } },
        ...(normalizedName.length >= 3 ? [{ name: { contains: normalizedName, mode: 'insensitive' as const } }] : []),
      ],
    },
    include: BUILDER_INCLUDE,
  });

  if (!builder && normalizedName.length >= 3) {
    const slugToken = normalizedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    builder = await (prisma.builder as any).findFirst({
      where: {
        OR: [
          { slug: { contains: slugToken, mode: 'insensitive' as const } },
          { parent_group: { contains: normalizedName, mode: 'insensitive' as const } },
        ],
      },
      include: BUILDER_INCLUDE,
    });
  }

  if (!builder) return null;

  const b = builder as any

  // `== null` throughout: a genuine zero (0 delivered units, a 0 score) is a
  // verified fact, not a missing one, and must not be reported as unverified.
  // Gaps are named by the FACT that is missing, not by the score that stands in
  // for it. "delivery score unverified" told the model a score exists and
  // invited it to ask for one; "handover record unverified" is the same gap
  // stated in terms a buyer can act on.
  const dataGaps: string[] = []
  if (builder.delivered_units == null) dataGaps.push('delivery count unverified')
  if (b.average_delay_months == null) dataGaps.push('handover record unverified')
  if (b.rera_promoter_id == null) dataGaps.push('RERA promoter registration unverified')
  if (b.litigation_count == null) dataGaps.push('litigation count unverified')

  return {
    // Identity
    name: builder.name,
    slug: builder.slug,
    tagline: builder.tagline,
    founder: b.founder ?? null,
    company_overview: b.company_overview ?? null,
    logo_url: b.logo_url ?? null,
    parent_group: builder.parent_group ?? null,
    founded_year: builder.founded_year ?? null,
    headquarters: builder.headquarters ?? null,
    website: builder.website ?? null,

    // Track Record
    total_projects_count: b.total_projects_count ?? null,
    delivered_units: builder.delivered_units ?? null,
    delivered_projects: builder.delivered_projects ?? [],
    ongoing_projects: builder.ongoing_projects ?? [],
    delayed_projects_count: b.delayed_projects_count ?? null,
    average_delay_months: b.average_delay_months ?? null,

    // No scores. `delivery_score`, `construction_quality_score`,
    // `after_sales_score`, `buyer_satisfaction_score` and
    // `rera_compliance_score` are analyst-set 0-100 numbers — see
    // BUYER_OPAQUE_SCORES in projectExposure.ts. They stayed in this payload
    // while the prompt's own BUILDER DATA RULES already listed what may be
    // claimed from it (CREDAI membership, legal_flag, awards_count,
    // delivered_units) and named none of them, so the rule and the data
    // disagreed and the model believed the data.

    // Compliance
    litigation_count: b.litigation_count ?? null,
    // false is the schema default, not a finding (SCHEMA_DEFAULT_SENTINELS).
    insolvency_history: b.insolvency_history === true ? true : null,
    legal_flag: b.legal_flag ?? null,

    // Market Position
    luxury_specialization: b.luxury_specialization ?? false,
    township_specialization: b.township_specialization ?? false,
    affordable_specialization: b.affordable_specialization ?? false,
    average_project_size: b.average_project_size ?? null,

    // Recognition
    awards: builder.awards ?? [],
    awards_count: builder.awards_count ?? null,
    certifications: b.certifications ?? [],
    credai_member: builder.credai_member,
    iso_certified: b.iso_certified ?? false,

    // Confidence
    verification_level: b.verification_level ?? 'unverified',
    last_verified_at: b.last_verified_at ?? null,
    data_source: b.data_source ?? null,
    intelligence_completeness: b.intelligence_completeness ?? null,

    // Live project list
    projects_in_db: ((b.projects as any[]) || []).map((p: any) => ({
      name: p.name,
      sector: p.sector,
      status: String(p.status),
      rera_number: p.rera_number,
      possession_claimed_by_builder: p.possession_label ?? null,
    })),

    // Promised vs actual, per project. delay_months is derived, never stored.
    // A missing promised_date stays null: substituting today's date invented a
    // builder promise and produced a delay figure measured against it.
    delivery_track_record: ((b.delivery_records as any[]) || []).map((r: any) => {
      const promised = r.promised_date ? new Date(r.promised_date) : null
      const actual = r.actual_date ? new Date(r.actual_date) : null
      const delayMonths = promised && actual
        ? Math.round(((actual.getTime() - promised.getTime()) / (1000 * 60 * 60 * 24 * 30.44)) * 10) / 10
        : null
      return {
        project_name: r.project_name,
        promised_date: promised ? promised.toISOString().split('T')[0] : null,
        actual_date: actual ? actual.toISOString().split('T')[0] : null,
        delivered: !!actual,
        delay_months: delayMonths,
        on_time: delayMonths != null ? delayMonths <= 0 : null,
      }
    }),

    data_gaps: dataGaps,
    note: 'Use ONLY the structured fields above. delivery_track_record gives promised vs actual per project — delay_months is derived from those two dates, positive means late. A null actual_date means not yet delivered, which is not the same as delayed. A null promised_date means the promised timeline is unknown — say so, do not treat it as on-time. If legal_flag is non-null, it MUST be disclosed immediately — it represents a verified legal risk. Do not recommend this builder for new purchases if legal_flag is set. If a score is null, state "not yet verified" — do not infer scores from training memory. delivered_units is a total volume count, NOT a proxy for on-time delivery.',
  }
}

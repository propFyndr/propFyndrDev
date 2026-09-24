// backend/src/lib/leadBrief.ts
//
// What a builder receives when a buyer asks for a callback.
//
// The thing we can do that a listings portal cannot. A portal hands a developer
// a name and a phone number; we have spoken to this person, so we know what
// they are trying to buy, what they can spend, when they need it, and — the
// part nobody else has — what is stopping them from buying THIS project, in
// their own words, because `LeadObjection` has been recording exactly that.
//
// ── The rule that shapes everything here ──────────────────────────────────
//
// A builder never receives the transcript. Three reasons, in order of weight:
//
//  1. It destroys the product. The conversation contains this buyer comparing
//     this builder against competitors, and our advisor honestly naming this
//     builder's trade-offs. Hand that over and we have sold the neutrality that
//     is the entire thesis of CLAUDE.md § Trust First.
//  2. It is other people's data — other builders' projects, other people's
//     pricing.
//  3. Consent. The buyer agreed to a callback. They did not agree to publish
//     their conversation to a developer.
//
// So a brief is a GENERATED ARTEFACT scoped to one project, not a filtered
// transcript. Competitor names never appear. Competitor PRESSURE does, stated
// abstractly, because "this buyer is comparing on possession date" is useful to
// a builder and names nobody.
//
// Every field below is read from a stored column. Nothing is inferred, nothing
// is estimated, and an absent field is omitted rather than guessed — the same
// rule CLAUDE.md § four tiers applies to buyer-facing answers, applied here
// because a builder acting on an invented fact is the same failure wearing a
// different hat.
import { prisma } from './db'
import { loadLeadProfile, summarizeProfile } from './leadProfile'

export type BriefAudience = 'builder' | 'staff'

export interface LeadBriefObjection {
  category: string
  text: string
  confidence: number | null
}

export interface LeadBrief {
  lead_id: string
  /** Who and when. */
  name: string
  phone: string
  consent_given: boolean | null
  created_at: Date
  /** The project this brief is about. A brief is always about exactly one. */
  project_name: string | null
  project_slug: string | null
  /** One sentence: tier plus horizon. */
  verdict: string
  lead_tier: string | null
  intent_tier: string | null
  /** What they need — composed from stored profile fields only. */
  requirement: string | null
  budget_min_cr: number | null
  budget_max_cr: number | null
  loan_pre_approved: boolean | null
  /** Topic summaries from the session, scrubbed. */
  location_notes: string | null
  financial_notes: string | null
  timeline_notes: string | null
  /** What is blocking them on THIS project. The differentiator. */
  objections: LeadBriefObjection[]
  /** How engaged they are. */
  projects_saved: number | null
  projects_viewed: number | null
  /** Their reaction to this project specifically. */
  reaction: { sentiment: string; reasons: string[]; comment: string | null } | null
  /** A booked visit on this project, if there is one. */
  site_visit: { visit_date: Date; time_slot: string; status: string } | null
  /** One line the caller can actually open with. */
  suggested_opening: string | null
  /** 'builder' output has been scrubbed; 'staff' has not. */
  audience: BriefAudience
}

/**
 * Every project and builder name that is not this one.
 *
 * Loaded per call rather than cached: the catalogue is 134 builders and a few
 * hundred projects, the query is two indexed reads, and a stale cache here
 * leaks the one thing this file exists to prevent. Correctness over a lookup.
 */
export async function competitorNames(excludeProjectSlug: string | null, excludeBuilderId: string | null): Promise<string[]> {
  const [projects, builders] = await Promise.all([
    prisma.project.findMany({
      where: excludeProjectSlug ? { slug: { not: excludeProjectSlug } } : {},
      select: { name: true },
    }),
    prisma.builder.findMany({
      where: excludeBuilderId ? { id: { not: excludeBuilderId } } : {},
      select: { name: true },
    }),
  ])
  return [...projects.map((p) => p.name), ...builders.map((b) => b.name)]
    .map((n) => n.trim())
    .filter((n) => n.length >= 3) // "DLF" yes; a one-letter name would match everything
}

/** Escapes a name for use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Removes competitor names from free text, leaving the sentence readable.
 *
 * Replaced with "another project" rather than deleted, because the fact that a
 * comparison is happening is legitimately useful to the builder — it is the
 * identity of the competitor that is not ours to pass on.
 *
 * Longest names first, so "Godrej Woods Phase 2" is matched before "Godrej"
 * and the result does not read "another project Woods Phase 2".
 */
export function scrubCompetitors(text: string | null, names: readonly string[]): string | null {
  if (!text) return text
  let out = text
  for (const name of [...names].sort((a, b) => b.length - a.length)) {
    out = out.replace(new RegExp(escapeRegExp(name), 'gi'), 'another project')
  }
  // A sentence that named three competitors now says it three times. Collapse.
  return out.replace(/(another project)(,?\s+(and\s+)?another project)+/gi, 'other projects')
}

/**
 * One line the caller can open with, derived from the strongest objection.
 *
 * Returns null when there is no objection on file. A generic "ask about their
 * requirements" line would be worse than silence: it teaches the reader that
 * this field is filler, and then they stop reading it on the day it matters.
 */
export function suggestOpening(objections: readonly LeadBriefObjection[]): string | null {
  const top = [...objections].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]
  if (!top) return null

  const byCategory: Record<string, string> = {
    possession: 'Lead with your completion timeline and what is already built — possession is their stated block.',
    price: 'Lead with payment plan flexibility — price is their stated block, and the headline number is what they reacted to.',
    product_mix: 'Lead with the layouts closest to what they asked for — the configuration is their stated block.',
    location: 'Lead with connectivity and commute times — location is their stated block.',
    legal: 'Lead with RERA registration and approvals — the paperwork is their stated concern.',
    financing: 'Lead with your approved lender panel — financing is their stated block.',
  }
  return byCategory[top.category] ?? `Their stated block is ${top.category}. Address it first.`
}

/** Tier plus horizon, in a sentence a person can read at a glance. */
function verdictLine(tier: string | null, intent: string | null, loan: boolean | null): string {
  const horizon =
    intent === 'immediate' ? 'buying now'
      : intent === '1-3-months' ? 'buying within 3 months'
      : intent === 'exploring' ? 'still exploring'
      : 'timeline not stated'
  const loanPart = loan === true ? ', loan pre-approved' : loan === false ? ', loan not arranged' : ''
  return `${tier ?? 'Unscored'} — ${horizon}${loanPart}.`
}

/**
 * Builds the brief for one lead.
 *
 * `audience: 'staff'` skips the competitor scrub. Our own salespeople need the
 * comparison to do their job, and they are inside the trust boundary the
 * scrubbing exists to protect.
 *
 * Returns null when the lead does not exist. Scope is the CALLER's business —
 * every route that calls this has already proved the lead belongs to them.
 */
export async function buildLeadBrief(
  callbackRequestId: string,
  audience: BriefAudience = 'builder',
): Promise<LeadBrief | null> {
  const lead = await prisma.callbackRequest.findUnique({
    where: { id: callbackRequestId },
    include: { objections: true },
  })
  if (!lead) return null

  const project = lead.project_slug
    ? await prisma.project.findUnique({
        where: { slug: lead.project_slug },
        select: { id: true, name: true, builder_id: true },
      })
    : null

  const [profile, session, feedback, siteVisit] = await Promise.all([
    loadLeadProfile(lead.user_id, lead.guest_token),
    lead.chat_session_id
      ? prisma.chatSession.findUnique({
          where: { id: lead.chat_session_id },
          select: { summary_location: true, summary_financial: true, summary_timeline: true },
        })
      : null,
    lead.chat_session_id && project
      ? prisma.propertyFeedback.findFirst({
          where: { session_id: lead.chat_session_id, project_id: project.id },
          orderBy: { created_at: 'desc' },
          select: { sentiment: true, reasons: true, comment: true },
        })
      : null,
    // The same buyer's booked visit on the same project, if any. Matched on
    // phone because a site visit and a callback are separate rows with no
    // foreign key between them.
    lead.project_slug
      ? prisma.siteVisitRequest.findFirst({
          where: { project_slug: lead.project_slug, phone: lead.phone },
          orderBy: { visit_date: 'desc' },
          select: { visit_date: true, time_slot: true, status: true },
        })
      : null,
  ])

  const names = audience === 'builder'
    ? await competitorNames(lead.project_slug, project?.builder_id ?? null)
    : []

  const scrub = (t: string | null) => (audience === 'builder' ? scrubCompetitors(t, names) : t)

  // Objections are recorded per project. Only this project's belong in this
  // brief — a builder reading why a buyer rejected somebody else is the leak
  // wearing a different shape.
  const objections: LeadBriefObjection[] = lead.objections
    .filter((o) => !lead.project_slug || o.project_slug === lead.project_slug)
    .map((o) => ({
      category: o.reason_category,
      text: scrub(o.reason_text) ?? '',
      confidence: o.confidence_score,
    }))
    .filter((o) => o.text.length > 0)

  return {
    lead_id: lead.id,
    name: lead.name,
    phone: lead.phone,
    consent_given: lead.consent_given,
    created_at: lead.created_at,
    project_name: lead.project_name,
    project_slug: lead.project_slug,
    verdict: verdictLine(lead.lead_tier, lead.intent_tier, lead.loan_pre_approved ?? profile.loan_pre_approved ?? null),
    lead_tier: lead.lead_tier,
    intent_tier: lead.intent_tier,
    // `summarizeProfile` composes from stored columns only — BHK, budget band,
    // sector, work location, purpose, possession preference, timeline, loan
    // status, engagement counts. It reads no message, so it names no project.
    requirement: scrub(lead.ai_summary ?? summarizeProfile(profile)),
    budget_min_cr: lead.budget_min_cr ?? profile.budget_cr?.min ?? null,
    budget_max_cr: lead.budget_max_cr ?? profile.budget_cr?.max ?? null,
    loan_pre_approved: lead.loan_pre_approved ?? profile.loan_pre_approved ?? null,
    location_notes: scrub(session?.summary_location ?? null),
    financial_notes: scrub(session?.summary_financial ?? null),
    timeline_notes: scrub(session?.summary_timeline ?? null),
    objections,
    projects_saved: lead.projects_saved ?? null,
    projects_viewed: lead.projects_viewed ?? null,
    reaction: feedback
      ? { sentiment: feedback.sentiment, reasons: feedback.reasons, comment: scrub(feedback.comment) }
      : null,
    site_visit: siteVisit,
    suggested_opening: suggestOpening(objections),
    audience,
  }
}

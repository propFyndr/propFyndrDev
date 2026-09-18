'use client'

/**
 * The Lead Brief, rendered.
 *
 * What a listings portal cannot hand a developer. A portal gives them a name
 * and a phone number; we have spoken to this person, so this carries what they
 * are trying to buy, what they can spend, when they need it — and the part
 * nobody else has: what is blocking them on THIS project, in their own words.
 *
 * The transcript is never here, by design. Competitor names are scrubbed
 * server-side in `lib/leadBrief.ts`; nothing in this component can switch that
 * off, because the audience is decided on the server and never sent up.
 *
 * Every section renders only when its data exists. An absent field is absent —
 * a brief padded with "not specified" rows teaches the reader to skim past the
 * one row that matters.
 */

import { useEffect, useState } from 'react'
import { X, Warning, Target, CalendarCheck, TrendUp } from '@phosphor-icons/react'
import { adminFetch } from '@/lib/adminFetch'
import { TierBadge, Spinner, ErrorNote } from '@/components/portal/ui'

export interface LeadBriefData {
  lead_id: string
  name: string
  phone: string
  consent_given: boolean | null
  created_at: string
  project_name: string | null
  verdict: string
  lead_tier: string | null
  requirement: string | null
  budget_min_cr: number | null
  budget_max_cr: number | null
  loan_pre_approved: boolean | null
  location_notes: string | null
  financial_notes: string | null
  timeline_notes: string | null
  objections: Array<{ category: string; text: string; confidence: number | null }>
  projects_saved: number | null
  projects_viewed: number | null
  reaction: { sentiment: string; reasons: string[]; comment: string | null } | null
  site_visit: { visit_date: string; time_slot: string; status: string } | null
  suggested_opening: string | null
}

interface Props {
  /** `/portal/builder/leads/:id/brief` or the partner equivalent, already scoped. */
  endpoint: string
  leadName: string
  onClose: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** Reads as a sentence rather than a raw enum. */
const CATEGORY_LABEL: Record<string, string> = {
  possession: 'Possession timeline',
  price: 'Price',
  product_mix: 'Layout / configuration',
  location: 'Location',
  legal: 'Legal & approvals',
  financing: 'Financing',
}

export default function LeadBriefPanel({ endpoint, leadName, onClose }: Props) {
  const [brief, setBrief] = useState<LeadBriefData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    adminFetch(endpoint)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { brief: LeadBriefData }) => { if (!cancelled) setBrief(d.brief) })
      .catch(() => { if (!cancelled) setError('Could not load the brief for this lead.') })
    return () => { cancelled = true }
  }, [endpoint])

  // Escape closes. A panel that traps you is a panel people stop opening.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const budget = brief && (brief.budget_min_cr != null || brief.budget_max_cr != null)
    ? brief.budget_min_cr != null && brief.budget_max_cr != null
      ? `₹${brief.budget_min_cr}–${brief.budget_max_cr} Cr`
      : `₹${brief.budget_min_cr ?? brief.budget_max_cr} Cr`
    : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Lead brief for ${leadName}`}>
      <button
        type="button"
        aria-label="Close brief"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-900/30 dark:bg-black/50 cursor-default"
      />

      <div className="relative w-full max-w-[460px] h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Lead brief</p>
            <p className="text-[16px] font-bold text-zinc-900 dark:text-white truncate">{leadName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {error && <div className="p-5"><ErrorNote message={error} /></div>}
        {!brief && !error && <div className="p-5"><Spinner /></div>}

        {brief && (
          <div className="p-5 space-y-6">
            {/* Verdict — the one line someone reads before dialling. */}
            <div className="flex items-start gap-2.5">
              <TierBadge tier={brief.lead_tier} />
              <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-100 flex-1">{brief.verdict}</p>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap text-[13px]">
              <a href={`tel:${brief.phone}`} className="font-bold text-zinc-900 dark:text-white hover:underline">{brief.phone}</a>
              {brief.project_name && <span className="text-zinc-500 dark:text-zinc-400">· {brief.project_name}</span>}
              {brief.consent_given === false && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                  No contact consent recorded
                </span>
              )}
            </div>

            {/* The most valuable block. First, not buried. */}
            {brief.objections.length > 0 && (
              <Section title={`Blocking them on your project (${brief.objections.length})`}>
                <ul className="space-y-2.5">
                  {brief.objections.map((o, i) => (
                    <li key={i} className="border-l-2 border-amber-400 dark:border-amber-600 pl-3">
                      <p className="text-[11px] font-bold text-amber-700 dark:text-amber-500 uppercase tracking-wide flex items-center gap-1.5">
                        <Warning size={12} weight="bold" />
                        {CATEGORY_LABEL[o.category] ?? o.category}
                      </p>
                      {/* Verbatim. Paraphrasing a buyer's objection is how it
                          stops being evidence and starts being our opinion. */}
                      <p className="text-[13px] text-zinc-700 dark:text-zinc-300 mt-0.5">{o.text}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {brief.suggested_opening && (
              <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                <Target size={15} className="text-zinc-500 dark:text-zinc-400 mt-0.5 shrink-0" />
                <p className="text-[13px] text-zinc-700 dark:text-zinc-300">{brief.suggested_opening}</p>
              </div>
            )}

            {(brief.requirement || budget || brief.loan_pre_approved != null) && (
              <Section title="What they need">
                {brief.requirement && (
                  <p className="text-[13px] text-zinc-700 dark:text-zinc-300">{brief.requirement}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-zinc-500 dark:text-zinc-400">
                  {budget && <span>Budget {budget}</span>}
                  {brief.loan_pre_approved === true && <span>Loan pre-approved</span>}
                  {brief.loan_pre_approved === false && <span>Loan not arranged</span>}
                </div>
              </Section>
            )}

            {(brief.location_notes || brief.financial_notes || brief.timeline_notes) && (
              <Section title="From the conversation">
                <div className="space-y-2 text-[13px] text-zinc-600 dark:text-zinc-300">
                  {brief.location_notes && <p><b className="font-semibold text-zinc-800 dark:text-zinc-100">Location.</b> {brief.location_notes}</p>}
                  {brief.financial_notes && <p><b className="font-semibold text-zinc-800 dark:text-zinc-100">Budget.</b> {brief.financial_notes}</p>}
                  {brief.timeline_notes && <p><b className="font-semibold text-zinc-800 dark:text-zinc-100">Timeline.</b> {brief.timeline_notes}</p>}
                </div>
              </Section>
            )}

            {brief.reaction && (
              <Section title="Their reaction to your project">
                <p className="text-[13px] text-zinc-700 dark:text-zinc-300">
                  <span className={brief.reaction.sentiment === 'good' ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-rose-700 dark:text-rose-400 font-semibold'}>
                    {brief.reaction.sentiment === 'good' ? 'Positive' : 'Negative'}
                  </span>
                  {brief.reaction.reasons.length > 0 && ` · ${brief.reaction.reasons.map((r) => r.replace(/_/g, ' ')).join(', ')}`}
                </p>
                {brief.reaction.comment && (
                  <p className="text-[13px] text-zinc-600 dark:text-zinc-400 italic">“{brief.reaction.comment}”</p>
                )}
              </Section>
            )}

            {brief.site_visit && (
              <Section title="Booked site visit">
                <p className="inline-flex items-center gap-2 text-[13px] text-zinc-700 dark:text-zinc-300">
                  <CalendarCheck size={14} className="text-zinc-500" />
                  {new Date(brief.site_visit.visit_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {' · '}{brief.site_visit.time_slot}
                  {' · '}{brief.site_visit.status}
                </p>
              </Section>
            )}

            {(brief.projects_saved != null || brief.projects_viewed != null) && (
              <Section title="Engagement">
                <p className="inline-flex items-center gap-2 text-[13px] text-zinc-600 dark:text-zinc-400">
                  <TrendUp size={14} className="text-zinc-500" />
                  Viewed {brief.projects_viewed ?? 0} · saved {brief.projects_saved ?? 0}
                </p>
              </Section>
            )}

            <p className="text-[11.5px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              Built from this buyer's stated requirements and their reactions to your project.
              Competing projects they considered are deliberately not included.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

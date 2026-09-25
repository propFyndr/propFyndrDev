'use client'

/**
 * The Lead Brief, rendered — Apple Executive Intelligence Modal.
 *
 * Provides sales agents and builders with a high-density, beautifully
 * structured dossier: buyer verdict, stated requirements, budget,
 * financing readiness, verbatim objections, and direct communication triggers.
 */

import { useEffect, useState } from 'react'
import {
  X,
  Warning,
  Target,
  CalendarCheck,
  PhoneCall,
  Copy,
  Check,
  WhatsappLogo,
  Buildings,
  ShieldCheck,
  BookmarkSimple,
  Eye,
} from '@phosphor-icons/react'
import { format } from 'date-fns'
import { adminFetch } from '@/lib/adminFetch'
import { TierBadge, Spinner, ErrorNote } from '@/components/portal/ui'
import { useDialogA11y } from '@/hooks/useDialogA11y'

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const CATEGORY_LABEL: Record<string, string> = {
  possession: 'Possession timeline',
  price: 'Price & Payment',
  product_mix: 'Layout / Configuration',
  location: 'Location & Connectivity',
  legal: 'Legal & Approvals',
  financing: 'Home Loan & Financing',
}

export default function LeadBriefPanel({ endpoint, leadName, onClose }: Props) {
  const [brief, setBrief] = useState<LeadBriefData | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose)

  useEffect(() => {
    let cancelled = false
    adminFetch(endpoint)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { brief: LeadBriefData }) => {
        if (!cancelled) setBrief(d.brief)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the intelligence brief for this lead.')
      })
    return () => {
      cancelled = true
    }
  }, [endpoint])

  function handleCopy(phone: string) {
    if (!phone) return
    navigator.clipboard.writeText(phone)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const budget =
    brief && (brief.budget_min_cr != null || brief.budget_max_cr != null)
      ? brief.budget_min_cr != null && brief.budget_max_cr != null
        ? `₹${brief.budget_min_cr}–${brief.budget_max_cr} Cr`
        : `₹${brief.budget_min_cr ?? brief.budget_max_cr} Cr`
      : null

  const cleanPhone = brief?.phone ? brief.phone.replace(/\D/g, '') : ''
  const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone
  const initials = getInitials(leadName)
  const isHot = brief?.lead_tier === 'HOT'
  const isWarm = brief?.lead_tier === 'WARM'
  const isUnscored = !brief?.lead_tier || brief?.verdict?.toLowerCase().includes('unscored')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Lead intelligence brief for ${leadName}`}
    >
      {/* Frosted Apple Backdrop */}
      <div
        className="fixed inset-0 bg-black/45 dark:bg-black/75 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Modal Card */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#18181b] border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-[0_24px_50px_rgba(0,0,0,0.22)] dark:shadow-[0_24px_50px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 outline-none"
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-20 px-6 py-4 bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-md border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Initials Avatar */}
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 select-none ${
                isHot
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
                  : isWarm
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700/80'
              }`}
            >
              {initials}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#0066cc] dark:text-[#2997ff] uppercase tracking-wider">
                  Lead Intelligence Brief
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Internal Dossier
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1d1d1f] dark:text-white tracking-tight truncate mt-0.5">
                {leadName}
              </h2>
            </div>
          </div>

          {/* Refined Apple Close Button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066cc] active:scale-95 shrink-0"
          >
            <X size={15} weight="bold" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 sm:p-7 space-y-5 overflow-y-auto min-h-0 flex-1">
          {error && <ErrorNote message={error} />}
          {!brief && !error && (
            <div className="py-16">
              <Spinner />
            </div>
          )}

          {brief && (
            <>
              {/* Lead Assessment Card */}
              <div className="p-4.5 sm:p-5 rounded-2xl bg-[#f5f5f7] dark:bg-zinc-800/60 border border-zinc-200/70 dark:border-zinc-700/70 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    {isUnscored ? 'Lead Status & Qualification' : 'Qualification Assessment'}
                  </span>
                  <TierBadge tier={brief.lead_tier} />
                </div>

                {isUnscored ? (
                  <div className="space-y-1">
                    <p className="text-[14px] font-semibold text-[#1d1d1f] dark:text-white leading-snug">
                      Direct callback request from website.
                    </p>
                    <p className="text-[12.5px] text-zinc-600 dark:text-zinc-300">
                      Buyer has not engaged in AI chat scoring yet. Call to qualify specific unit preferences, budget range, and move-in timeline.
                    </p>
                  </div>
                ) : (
                  <p className="text-[14.5px] font-semibold text-[#1d1d1f] dark:text-zinc-100 leading-snug">
                    {brief.verdict}
                  </p>
                )}

                {/* Suggested Pitch Opening (If Present) */}
                {brief.suggested_opening && (
                  <div className="pt-2.5 mt-2 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-start gap-2.5">
                    <Target size={15} weight="bold" className="text-[#0066cc] dark:text-[#2997ff] mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        Suggested Opening Angle:
                      </span>
                      <p className="text-[13px] text-zinc-700 dark:text-zinc-300 mt-0.5 font-medium">
                        “{brief.suggested_opening}”
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 4-Card Apple Utility Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Card 1: Contact & Consent */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Direct Contact
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={`tel:${brief.phone}`}
                      className="text-[14px] font-bold text-[#0066cc] dark:text-[#2997ff] hover:underline inline-flex items-center gap-1.5"
                    >
                      <PhoneCall size={14} weight="bold" />
                      {brief.phone}
                    </a>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(brief.phone)}
                        title="Copy phone number"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
                      >
                        {copied ? <Check size={13} weight="bold" className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                      {waNumber && (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open WhatsApp chat"
                          className="p-1.5 rounded-lg text-[#25D366] hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition active:scale-95"
                        >
                          <WhatsappLogo size={15} weight="fill" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    {brief.consent_given === false ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200/60 dark:border-amber-900/60">
                        <Warning size={11} weight="bold" /> No contact consent recorded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800/60">
                        <ShieldCheck size={12} weight="bold" /> Direct callback requested
                      </span>
                    )}
                  </div>
                </div>

                {/* Card 2: Property & Scope */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Target Project & Query
                  </span>
                  <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#1d1d1f] dark:text-white truncate">
                    <Buildings size={15} weight="bold" className="text-zinc-400 shrink-0" />
                    <span className="truncate">{brief.project_name ?? 'General Inquiry'}</span>
                  </div>
                  <p className="text-[12px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {brief.requirement ?? 'No specific unit configurations requested yet.'}
                  </p>
                </div>

                {/* Card 3: Budget & Financing */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Budget & Financing
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-bold text-zinc-900 dark:text-white">
                      {budget ?? 'Budget not specified'}
                    </span>
                  </div>
                  <div>
                    {brief.loan_pre_approved === true && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        <Check size={11} weight="bold" /> Home loan pre-approved
                      </span>
                    )}
                    {brief.loan_pre_approved === false && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                        Loan not arranged
                      </span>
                    )}
                    {brief.loan_pre_approved == null && (
                      <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
                        Financing details not discussed
                      </span>
                    )}
                  </div>
                </div>

                {/* Card 4: Activity & Site Visit */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Portal Engagement
                  </span>
                  <div className="flex items-center gap-3 text-[12.5px] text-zinc-700 dark:text-zinc-300 font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Eye size={14} className="text-zinc-400" />
                      {brief.projects_viewed ?? 0} viewed
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <BookmarkSimple size={14} className="text-zinc-400" />
                      {brief.projects_saved ?? 0} saved
                    </span>
                  </div>
                  <div>
                    {brief.site_visit ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        <CalendarCheck size={12} weight="bold" />
                        Visit: {format(new Date(brief.site_visit.visit_date), 'd MMM')} ({brief.site_visit.time_slot})
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-zinc-400 dark:text-zinc-500">
                        No site visit scheduled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Deal Blockers / Objections */}
              {brief.objections.length > 0 && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Blocking them on your project ({brief.objections.length})
                  </span>
                  <div className="space-y-2">
                    {brief.objections.map((o, i) => (
                      <div
                        key={i}
                        className="rounded-2xl p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/60 flex items-start gap-3"
                      >
                        <Warning size={16} weight="bold" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                            {CATEGORY_LABEL[o.category] ?? o.category}
                          </p>
                          <p className="text-[13px] text-zinc-800 dark:text-zinc-200 font-medium mt-0.5">
                            “{o.text}”
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation Notes (Location, Financial, Timeline) */}
              {(brief.location_notes || brief.financial_notes || brief.timeline_notes) && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Context from Conversation
                  </span>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/70 dark:border-zinc-800 space-y-2 text-[13px]">
                    {brief.location_notes && (
                      <p className="text-zinc-700 dark:text-zinc-300">
                        <b className="font-semibold text-zinc-900 dark:text-white">Location:</b> {brief.location_notes}
                      </p>
                    )}
                    {brief.financial_notes && (
                      <p className="text-zinc-700 dark:text-zinc-300">
                        <b className="font-semibold text-zinc-900 dark:text-white">Financial:</b> {brief.financial_notes}
                      </p>
                    )}
                    {brief.timeline_notes && (
                      <p className="text-zinc-700 dark:text-zinc-300">
                        <b className="font-semibold text-zinc-900 dark:text-white">Timeline:</b> {brief.timeline_notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Reaction to project */}
              {brief.reaction && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    Reaction to Project
                  </span>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-200/70 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          brief.reaction.sentiment === 'good'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/60'
                        }`}
                      >
                        {brief.reaction.sentiment === 'good' ? 'Positive' : 'Needs convincing'}
                      </span>
                      {brief.reaction.reasons.length > 0 && (
                        <span className="text-xs text-zinc-500 capitalize">
                          · {brief.reaction.reasons.map((r) => r.replace(/_/g, ' ')).join(', ')}
                        </span>
                      )}
                    </div>
                    {brief.reaction.comment && (
                      <p className="text-[13px] text-zinc-600 dark:text-zinc-400 italic mt-2">
                        “{brief.reaction.comment}”
                      </p>
                    )}
                  </div>
                </div>
              )}

              <p className="text-[11px] text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                Built from buyer interactions and real-time stated intent. Competitor recommendations are scrubbed server-side.
              </p>
            </>
          )}
        </div>

        {/* Modal Action Bar (Footer) — Zero-Overflow Guaranteed */}
        {brief && (
          <div className="px-5 sm:px-6 py-3.5 bg-zinc-50/95 dark:bg-zinc-900/95 border-t border-zinc-200/80 dark:border-zinc-800 shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4 w-full">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {/* Primary Call CTA */}
                <a
                  href={`tel:${brief.phone}`}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-[#0066cc] hover:bg-[#0071e3] text-white text-xs font-semibold whitespace-nowrap tracking-tight shadow-2xs active:scale-95 transition-all shrink-0"
                >
                  <PhoneCall size={13} weight="bold" />
                  <span>Call {brief.phone}</span>
                </a>

                {/* WhatsApp Quick Link */}
                {waNumber && (
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full border border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold whitespace-nowrap active:scale-95 transition-all shrink-0"
                  >
                    <WhatsappLogo size={14} weight="fill" className="text-[#25D366]" />
                    <span>WhatsApp</span>
                  </a>
                )}

                {/* Copy Phone */}
                <button
                  type="button"
                  onClick={() => handleCopy(brief.phone)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 whitespace-nowrap active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  {copied ? <Check size={12} weight="bold" className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="self-end sm:self-auto px-5 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap active:scale-95 transition-all cursor-pointer shrink-0"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}




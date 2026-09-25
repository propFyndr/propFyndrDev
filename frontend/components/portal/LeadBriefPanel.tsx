'use client'

/**
 * The Lead Intelligence Brief — Apple Executive Intelligence Modal.
 *
 * Provides frontline sales agents, builders, and administrators with a
 * high-density, beautifully structured briefing dossier before dialing:
 * buyer verdict, stated requirements, budget, financing readiness, verbatim
 * objections, and direct communication triggers.
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
  ChatCircleDots,
  Clock,
  CurrencyInr,
  HouseLine
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
  /** `/portal/builder/leads/:id/brief` or the partner/admin equivalent. */
  endpoint: string
  leadName: string
  onClose: () => void
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function formatPhone(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, '')
  if (clean.startsWith('+91') && clean.length === 13) {
    return `+91 ${clean.slice(3, 8)} ${clean.slice(8)}`
  }
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`
  }
  return phone
}

const CATEGORY_LABEL: Record<string, string> = {
  possession: 'Possession Timeline',
  price: 'Price & Payment Structure',
  product_mix: 'Layout & Configuration',
  location: 'Location & Connectivity',
  legal: 'Legal, Approvals & Title',
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
    void navigator.clipboard.writeText(phone)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const budget =
    brief && (brief.budget_min_cr != null || brief.budget_max_cr != null)
      ? brief.budget_min_cr != null && brief.budget_max_cr != null
        ? `₹${brief.budget_min_cr} – ₹${brief.budget_max_cr} Cr`
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
        className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered Modal Card */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 outline-none my-auto font-sans"
      >
        {/* Header Bar */}
        <div className="sticky top-0 z-20 px-6 py-4.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Initials Avatar */}
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 select-none shadow-2xs ${
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
                <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                  Lead Intelligence Brief
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                  Internal Dossier
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight truncate mt-0.5">
                {leadName}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {brief && <TierBadge tier={brief.lead_tier} />}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close brief"
              className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 flex items-center justify-center transition-all cursor-pointer active:scale-95 shrink-0"
            >
              <X size={15} weight="bold" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 sm:p-7 space-y-5 overflow-y-auto min-h-0 flex-1">
          {error && <ErrorNote message={error} />}
          {!brief && !error && (
            <div className="py-20 flex flex-col items-center justify-center">
              <Spinner />
              <p className="text-xs text-zinc-400 mt-2 font-medium">Synthesizing lead intelligence brief…</p>
            </div>
          )}

          {brief && (
            <>
              {/* Executive Assessment & Verdict Card */}
              <div className="p-4.5 sm:p-5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    {isUnscored ? 'Lead Status & Qualification' : 'Qualification Assessment'}
                  </span>
                  {brief.lead_tier && (
                    <span className="text-[11px] font-mono font-bold text-zinc-500 dark:text-zinc-400">
                      Tier: {brief.lead_tier}
                    </span>
                  )}
                </div>

                {isUnscored ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white leading-snug">
                      Direct callback request from platform.
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300">
                      Buyer has not completed conversational AI profiling yet. Call to qualify specific unit preferences, budget range, and move-in timeline.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-relaxed">
                    {brief.verdict}
                  </p>
                )}

                {/* Suggested Opening Angle Callout */}
                {brief.suggested_opening && (
                  <div className="pt-3 mt-1 border-t border-zinc-200/60 dark:border-zinc-700/60 flex items-start gap-2.5">
                    <Target size={15} weight="bold" className="text-zinc-900 dark:text-white mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                        Suggested Call Hook:
                      </span>
                      <p className="text-xs text-zinc-800 dark:text-zinc-200 mt-0.5 font-medium leading-relaxed italic">
                        &ldquo;{brief.suggested_opening}&rdquo;
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 4 Core Telemetry Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Card 1: Direct Contact & Consent */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Direct Contact
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <a
                      href={`tel:${brief.phone}`}
                      className="text-sm font-mono font-bold text-zinc-900 dark:text-white hover:underline inline-flex items-center gap-1.5"
                    >
                      <PhoneCall size={14} weight="bold" className="text-emerald-500" />
                      <span>{formatPhone(brief.phone)}</span>
                    </a>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleCopy(brief.phone)}
                        title="Copy phone number"
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition active:scale-95 cursor-pointer"
                      >
                        {copied ? <Check size={13} weight="bold" className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                      {waNumber && (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open WhatsApp chat"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition active:scale-95"
                        >
                          <WhatsappLogo size={15} weight="fill" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div>
                    {brief.consent_given === false ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/60">
                        <Warning size={11} weight="bold" /> No contact consent recorded
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                        <ShieldCheck size={12} weight="bold" /> Direct callback requested
                      </span>
                    )}
                  </div>
                </div>

                {/* Card 2: Property & Scope */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Target Property & Scope
                  </span>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 dark:text-white truncate">
                    <Buildings size={15} weight="bold" className="text-zinc-400 shrink-0" />
                    <span className="truncate">{brief.project_name ?? 'General Inquiry'}</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                    {brief.requirement ?? 'No specific unit configurations requested yet.'}
                  </p>
                </div>

                {/* Card 3: Budget & Financing */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Budget & Financing Readiness
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CurrencyInr size={15} className="text-emerald-500 shrink-0" />
                    <span className="text-sm font-bold text-zinc-900 dark:text-white">
                      {budget ?? 'Budget not specified'}
                    </span>
                  </div>
                  <div>
                    {brief.loan_pre_approved === true && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60">
                        <Check size={11} weight="bold" /> Home loan pre-approved
                      </span>
                    )}
                    {brief.loan_pre_approved === false && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                        Loan not arranged
                      </span>
                    )}
                    {brief.loan_pre_approved == null && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        Financing details not discussed
                      </span>
                    )}
                  </div>
                </div>

                {/* Card 4: Activity & Site Visit */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5 shadow-2xs">
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Buyer Activity & Engagement
                  </span>
                  <div className="flex items-center gap-3 text-xs text-zinc-700 dark:text-zinc-300 font-semibold">
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
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60">
                        <CalendarCheck size={12} weight="bold" />
                        Visit: {format(new Date(brief.site_visit.visit_date), 'd MMM')} ({brief.site_visit.time_slot})
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        No site visit scheduled
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Deal Blockers / Objections */}
              {brief.objections.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Active Objections & Friction Points ({brief.objections.length})
                  </span>
                  <div className="space-y-2">
                    {brief.objections.map((o, i) => (
                      <div
                        key={i}
                        className="rounded-xl p-3.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 flex items-start gap-3 text-xs"
                      >
                        <Warning size={16} weight="bold" className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                            {CATEGORY_LABEL[o.category] ?? o.category}
                          </p>
                          <p className="text-xs text-zinc-800 dark:text-zinc-200 font-medium mt-0.5 leading-relaxed">
                            &ldquo;{o.text}&rdquo;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversation Notes (Location, Financial, Timeline) */}
              {(brief.location_notes || brief.financial_notes || brief.timeline_notes) && (
                <div className="space-y-2.5 pt-1">
                  <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Context from Conversation
                  </span>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-2 text-xs">
                    {brief.location_notes && (
                      <p className="text-zinc-700 dark:text-zinc-300">
                        <strong className="text-zinc-900 dark:text-white">Location Context:</strong> {brief.location_notes}
                      </p>
                    )}
                    {brief.financial_notes && (
                      <p className="text-zinc-700 dark:text-zinc-300">
                        <strong className="text-zinc-900 dark:text-white">Financial Context:</strong> {brief.financial_notes}
                      </p>
                    )}
                    {brief.timeline_notes && (
                      <p className="text-zinc-700 dark:text-zinc-300">
                        <strong className="text-zinc-900 dark:text-white">Timeline Context:</strong> {brief.timeline_notes}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Reaction to project */}
              {brief.reaction && (
                <div className="space-y-2.5 pt-1">
                  <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block">
                    Reaction to Target Property
                  </span>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
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
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 italic mt-2">
                        &ldquo;{brief.reaction.comment}&rdquo;
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

        {/* Modal Action Bar (Footer) */}
        {brief && (
          <div className="px-6 py-4 bg-zinc-50/95 dark:bg-zinc-900/95 border-t border-zinc-200/80 dark:border-zinc-800 shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {/* Primary Call CTA */}
                <a
                  href={`tel:${brief.phone}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold whitespace-nowrap shadow-2xs active:scale-95 transition-all shrink-0"
                >
                  <PhoneCall size={14} weight="bold" />
                  <span>Call {formatPhone(brief.phone)}</span>
                </a>

                {/* WhatsApp Quick Link */}
                {waNumber && (
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300/80 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-bold whitespace-nowrap hover:bg-emerald-100/80 active:scale-95 transition-all shrink-0"
                  >
                    <WhatsappLogo size={15} weight="fill" className="text-emerald-600" />
                    <span>WhatsApp</span>
                  </a>
                )}

                {/* Copy Phone */}
                <button
                  type="button"
                  onClick={() => handleCopy(brief.phone)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 whitespace-nowrap active:scale-95 transition-all cursor-pointer shrink-0 shadow-2xs"
                >
                  {copied ? <Check size={13} weight="bold" className="text-emerald-600" /> : <Copy size={13} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 whitespace-nowrap active:scale-95 transition-all cursor-pointer shrink-0"
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

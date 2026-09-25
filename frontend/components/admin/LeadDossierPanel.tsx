'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminFetch'
import {
  CurrencyInr,
  HouseLine,
  Target,
  Clock,
  CheckCircle,
  ChatCircleDots,
  BookmarkSimple,
  Scales,
  CalendarCheck,
  WarningCircle,
  ThumbsDown,
  TrendUp
} from '@phosphor-icons/react'

interface LeadDossier {
  buyerArchetype: string
  purpose: string
  familyStage: string
  workLocation?: string
  timeline?: { months: number; urgency: string }
  budgetMin: number | null
  budgetMax: number | null
  budgetFlexibility: string
  bhkPreference: number[]
  lifestyleSignals: string[]
  financing: {
    loanPreApproved: boolean
    emiQuestionCount: number
    costSheetViews: number
    stampDutyQueries: number
    affordabilityFocus: string
  }
  engagement: {
    totalMessages: number
    messageVelocity: string
    sessionCount: number
  }
  objections: Array<{ projectName: string; reason: string; quote?: string }>
  rejectedProjects: Array<{ name: string; viewCount: number }>
  conversionSignals: {
    saved: number
    compared: number
    callbackRequested: boolean
    siteVisitRequested: boolean
  }
  recommendedAction?: { type: string; reason: string; priority: string }
}

function formatBudget(min: number | null, max: number | null, flex: string): string {
  if (min === null && max === null) return 'Budget not specified'
  if (min !== null && max !== null) return `₹${min} – ₹${max} Cr (${flex})`
  if (min !== null) return `₹${min}+ Cr (${flex})`
  return `Up to ₹${max} Cr (${flex})`
}

export function LeadDossierPanel({ leadId }: { leadId: string }) {
  const [dossier, setDossier] = useState<LeadDossier | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading')

  useEffect(() => {
    let cancelled = false
    setState('loading')
    setDossier(null)
    adminFetch(`/leads/callback/${leadId}/dossier`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })
      .then((data: LeadDossier) => {
        if (!cancelled) {
          setDossier(data)
          setState('ready')
        }
      })
      .catch(() => {
        if (!cancelled) setState('unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [leadId])

  if (state === 'loading') {
    return (
      <div className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 space-y-3 animate-pulse">
        <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-14 bg-zinc-200/70 dark:bg-zinc-700/60 rounded-xl" />
          <div className="h-14 bg-zinc-200/70 dark:bg-zinc-700/60 rounded-xl" />
        </div>
      </div>
    )
  }

  if (state === 'unavailable' || !dossier) {
    return (
      <div className="p-4 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/20 text-center">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No chat conversation linked to this lead yet — buyer preferences will appear as they interact with PropFyndr.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Recommended Action Card (if available) */}
      {dossier.recommendedAction && (
        <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider text-[11px] mb-1">
            <Target size={14} weight="bold" className="text-amber-600 dark:text-amber-400" />
            <span>
              {dossier.recommendedAction.priority} PRIORITY — {dossier.recommendedAction.type.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
            {dossier.recommendedAction.reason}
          </p>
        </div>
      )}

      {/* Buyer Dossier Structured Grid */}
      <div className="p-4 rounded-2xl bg-zinc-50/60 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
            AI Buyer Dossier & Signals
          </span>
          {dossier.buyerArchetype && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-700 dark:text-zinc-300">
              {dossier.buyerArchetype}
            </span>
          )}
        </div>

        {/* 2x3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          {/* Budget */}
          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-start gap-2.5">
            <CurrencyInr size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Budget Range</span>
              <span className="font-bold text-zinc-900 dark:text-white truncate block">
                {formatBudget(dossier.budgetMin, dossier.budgetMax, dossier.budgetFlexibility)}
              </span>
            </div>
          </div>

          {/* BHK */}
          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-start gap-2.5">
            <HouseLine size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Unit Typology</span>
              <span className="font-bold text-zinc-900 dark:text-white block">
                {dossier.bhkPreference.length > 0
                  ? dossier.bhkPreference.map((b) => `${b} BHK`).join(', ')
                  : 'Flexible / Any'}
              </span>
            </div>
          </div>

          {/* Purpose */}
          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-start gap-2.5">
            <Target size={16} className="text-purple-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Purchase Purpose</span>
              <span className="font-bold text-zinc-900 dark:text-white capitalize block">
                {dossier.purpose || 'Not stated'}
                {dossier.familyStage ? ` · ${dossier.familyStage}` : ''}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-start gap-2.5">
            <Clock size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Possession Timeline</span>
              <span className="font-bold text-zinc-900 dark:text-white block">
                {dossier.timeline ? `${dossier.timeline.months} months (${dossier.timeline.urgency})` : 'Flexible'}
              </span>
            </div>
          </div>

          {/* Financing */}
          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-start gap-2.5">
            <CheckCircle size={16} className="text-teal-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Financing</span>
              <span className="font-bold text-zinc-900 dark:text-white block">
                {dossier.financing.loanPreApproved ? 'Pre-Approved Loan' : 'Needs Loan Assistance'}
                {dossier.financing.affordabilityFocus ? ` · ${dossier.financing.affordabilityFocus}` : ''}
              </span>
            </div>
          </div>

          {/* Engagement */}
          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 flex items-start gap-2.5">
            <ChatCircleDots size={16} className="text-indigo-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Chat Activity</span>
              <span className="font-bold text-zinc-900 dark:text-white block">
                {dossier.engagement.totalMessages} messages ({dossier.engagement.messageVelocity.toLowerCase()})
              </span>
            </div>
          </div>
        </div>

        {/* Lifestyle Signals */}
        {dossier.lifestyleSignals.length > 0 && (
          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Lifestyle & Location Signals
            </span>
            <div className="flex flex-wrap gap-1.5">
              {dossier.lifestyleSignals.map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 shadow-2xs"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Objections Raised */}
        {dossier.objections.length > 0 && (
          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80 space-y-1.5">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
              <WarningCircle size={12} weight="bold" className="text-amber-500" />
              <span>Objections Expressed</span>
            </span>
            <div className="space-y-1.5">
              {dossier.objections.map((o, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-xs">
                  <span className="font-bold text-zinc-900 dark:text-white">{o.projectName}:</span>{' '}
                  <span className="text-zinc-600 dark:text-zinc-300 font-medium">{o.reason}</span>
                  {o.quote && (
                    <p className="text-[11px] text-zinc-500 italic mt-0.5">&ldquo;{o.quote}&rdquo;</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rejected Projects */}
        {dossier.rejectedProjects.length > 0 && (
          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
              <ThumbsDown size={12} className="text-zinc-400" />
              <span>Considered & Passed On</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {dossier.rejectedProjects.map((p) => (
                <span
                  key={p.name}
                  className="px-2.5 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 text-[11px] text-zinc-600 dark:text-zinc-400"
                >
                  {p.name} ({p.viewCount} views)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* High-Intent Activity Signals */}
        <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80 flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <BookmarkSimple size={13} className="text-zinc-400" />
            Saved: <strong className="text-zinc-800 dark:text-zinc-200">{dossier.conversionSignals.saved}</strong>
          </span>
          <span className="inline-flex items-center gap-1">
            <Scales size={13} className="text-zinc-400" />
            Compared: <strong className="text-zinc-800 dark:text-zinc-200">{dossier.conversionSignals.compared}</strong>
          </span>
          {dossier.conversionSignals.siteVisitRequested && (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
              <CalendarCheck size={13} weight="fill" />
              Site visit requested
            </span>
          )}
          {dossier.conversionSignals.callbackRequested && (
            <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-800/60">
              <CheckCircle size={13} weight="fill" />
              Callback requested
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

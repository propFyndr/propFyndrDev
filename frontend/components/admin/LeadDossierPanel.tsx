'use client'

import { useEffect, useState } from 'react'
import { adminFetch } from '@/lib/adminFetch'

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

/**
 * The buyer dossier — what makes a PropFyndr lead worth more than a name and
 * a phone number. Built from a chat session's full context (summaries,
 * objections, engagement), not just the callback form.
 *
 * The backend endpoint this calls (`GET /leads/callback/:id/dossier`) already
 * existed but had no auth and no frontend caller — found and fixed both
 * tonight. Lazy-loaded only when the lead detail panel is actually open, and
 * fails quietly (a dossier is an enhancement to the basics already shown
 * above it, never a reason to break the panel).
 */
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
        if (!cancelled) { setDossier(data); setState('ready') }
      })
      .catch(() => {
        if (!cancelled) setState('unavailable')
      })
    return () => { cancelled = true }
  }, [leadId])

  if (state === 'loading') {
    return (
      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-400">
        Loading buyer dossier…
      </div>
    )
  }

  if (state === 'unavailable' || !dossier) {
    return (
      <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-400">
        No chat session linked to this lead yet — dossier needs a chat_session_id.
      </div>
    )
  }

  const money = (v: number | null) => (v === null ? '—' : `₹${v} Cr`)

  return (
    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
      <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">
        Buyer Dossier
      </span>

      {dossier.recommendedAction && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs">
          <span className="font-bold text-amber-800 dark:text-amber-300">
            {dossier.recommendedAction.priority} PRIORITY — {dossier.recommendedAction.type.replace(/_/g, ' ')}
          </span>
          <p className="text-amber-700 dark:text-amber-400 mt-1">{dossier.recommendedAction.reason}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div><span className="text-zinc-400">Budget:</span> {money(dossier.budgetMin)}–{money(dossier.budgetMax)} ({dossier.budgetFlexibility})</div>
        <div><span className="text-zinc-400">BHK:</span> {dossier.bhkPreference.join(', ') || '—'}</div>
        <div><span className="text-zinc-400">Purpose:</span> {dossier.purpose}</div>
        <div><span className="text-zinc-400">Timeline:</span> {dossier.timeline ? `${dossier.timeline.months}mo (${dossier.timeline.urgency})` : '—'}</div>
        <div><span className="text-zinc-400">Financing:</span> {dossier.financing.loanPreApproved ? 'Pre-approved' : 'Not pre-approved'}, {dossier.financing.affordabilityFocus} affordability focus</div>
        <div><span className="text-zinc-400">Engagement:</span> {dossier.engagement.totalMessages} messages, {dossier.engagement.messageVelocity.toLowerCase()}</div>
      </div>

      {dossier.lifestyleSignals.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {dossier.lifestyleSignals.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300">{s}</span>
          ))}
        </div>
      )}

      {dossier.objections.length > 0 && (
        <div>
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Objections raised</span>
          <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            {dossier.objections.map((o, i) => (
              <li key={i}>
                <span className="font-semibold">{o.projectName}:</span> {o.reason}
                {o.quote && <span className="italic"> — &ldquo;{o.quote}&rdquo;</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {dossier.rejectedProjects.length > 0 && (
        <div>
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Considered and passed on</span>
          <div className="flex flex-wrap gap-1">
            {dossier.rejectedProjects.map((p) => (
              <span key={p.name} className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400">
                {p.name} ({p.viewCount}×)
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 text-xs text-zinc-500">
        <span>Saved: {dossier.conversionSignals.saved}</span>
        <span>Compared: {dossier.conversionSignals.compared}</span>
        {dossier.conversionSignals.siteVisitRequested && <span className="text-emerald-600 font-semibold">Site visit requested</span>}
      </div>
    </div>
  )
}

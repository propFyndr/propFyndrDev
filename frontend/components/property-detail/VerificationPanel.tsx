'use client'

import {
  ShieldCheck, ShieldWarning, Scales, Wind, Drop, Buildings, Clock, Receipt,
} from '@phosphor-icons/react'
import type { ProjectDetail } from '@/types/project'
import FreshnessBadge from './FreshnessBadge'
import { FRESHNESS } from '@/lib/freshness'

/**
 * The disclosure surface.
 *
 * Nineteen fields on the project row — occupancy certificate, RERA validity,
 * possession confidence, legal and registry standing, litigation, flood risk,
 * air quality, and what the headline price actually includes — were returned by
 * the API and read by nothing. The page showed the amenities and the price and
 * dropped the material a cautious buyer would want most.
 *
 * Two rules govern everything below:
 *
 *  1. A field renders only when we hold it. No "not specified" filler rows —
 *     a wall of blanks reads as a broken page, not as honesty.
 *  2. Nothing is hidden because it is unflattering. A raised legal flag, an
 *     embargoed registry or a "delayed" possession note is exactly what this
 *     panel exists to show.
 */

type Tone = 'good' | 'warn' | 'bad' | 'plain'

interface Row {
  icon: React.ElementType
  label: string
  value: string
  detail?: string | null
  tone: Tone
}

const TONE_CLASS: Record<Tone, string> = {
  good:  'text-emerald-700 dark:text-emerald-400',
  warn:  'text-amber-700 dark:text-amber-400',
  bad:   'text-rose-700 dark:text-rose-400',
  plain: 'text-slate-700 dark:text-zinc-300',
}

function formatDate(value?: string | null): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

/** Possession confidence uses the dictionary vocabulary — map it to a tone. */
function possessionTone(confidence: string): Tone {
  const c = confidence.toLowerCase()
  if (c.includes('very_likely') || c.includes('very likely')) return 'good'
  if (c.includes('likely')) return 'good'
  if (c.includes('at_risk') || c.includes('at risk')) return 'bad'
  if (c.includes('uncertain')) return 'warn'
  return 'plain'
}

function humanise(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export function buildVerificationRows(project: ProjectDetail): Row[] {
  const rows: Row[] = []

  // ── Occupancy Certificate ───────────────────────────────────────────────
  // The single most consequential compliance fact: it decides whether GST is
  // 0% or 5%, and whether a bank will lend at all.
  if (project.oc_obtained === true) {
    const on = formatDate(project.oc_obtained_date)
    rows.push({
      icon: ShieldCheck,
      label: 'Occupancy Certificate',
      value: on ? `Obtained ${on}` : 'Obtained',
      detail: project.oc_restrictions || null,
      tone: 'good',
    })
  } else if (project.oc_obtained === false) {
    rows.push({
      icon: ShieldWarning,
      label: 'Occupancy Certificate',
      value: 'Not yet obtained',
      detail: 'GST applies at 5% and most lenders require OC before final disbursal.',
      tone: 'warn',
    })
  }

  // ── RERA ────────────────────────────────────────────────────────────────
  const reraUntil = formatDate(project.rera_valid_until)
  if (reraUntil) {
    const expired = new Date(project.rera_valid_until!).getTime() < Date.now()
    rows.push({
      icon: Receipt,
      label: 'RERA registration',
      value: expired ? `Expired ${reraUntil}` : `Valid to ${reraUntil}`,
      tone: expired ? 'bad' : 'good',
    })
  }

  // ── Possession confidence ───────────────────────────────────────────────
  if (project.possession_confidence) {
    rows.push({
      icon: Clock,
      label: 'Possession confidence',
      value: humanise(project.possession_confidence),
      detail: project.possession_confidence_note || null,
      tone: possessionTone(project.possession_confidence),
    })
  }
  if (typeof project.average_builder_delay_months === 'number' && project.average_builder_delay_months > 0) {
    rows.push({
      icon: Clock,
      label: 'Builder’s average delay',
      value: `${project.average_builder_delay_months} months across delivered projects`,
      tone: project.average_builder_delay_months >= 12 ? 'bad' : 'warn',
    })
  }

  // ── Legal & registry ────────────────────────────────────────────────────
  if (project.legal_flag && project.legal_flag !== 'none') {
    rows.push({
      icon: Scales,
      label: 'Legal status',
      value: humanise(project.legal_flag),
      detail: project.legal_flag_detail || null,
      tone: 'bad',
    })
  }
  if (project.nclt_status) {
    rows.push({ icon: Scales, label: 'NCLT', value: humanise(project.nclt_status), tone: 'bad' })
  }
  if (project.registry_status) {
    const blocked = /embargo|blocked|halted/i.test(project.registry_status)
    rows.push({
      icon: Buildings,
      label: 'Registry',
      value: humanise(project.registry_status),
      detail: project.registry_embargo_reasons?.length
        ? project.registry_embargo_reasons.join('; ')
        : null,
      tone: blocked ? 'bad' : 'good',
    })
  }
  const litigation = project.ongoing_litigation_count ?? project.litigation_count
  if (typeof litigation === 'number' && litigation > 0) {
    rows.push({
      icon: Scales,
      label: 'Ongoing litigation',
      value: `${litigation} case${litigation === 1 ? '' : 's'}`,
      detail: project.litigation_types?.length ? project.litigation_types.join('; ') : null,
      tone: 'bad',
    })
  }
  if (project.fir_against_project === true) {
    rows.push({ icon: ShieldWarning, label: 'FIR on record', value: 'Yes', tone: 'bad' })
  }
  if (project.authority_dues_cleared === false) {
    rows.push({
      icon: Receipt,
      label: 'Authority dues',
      value: 'Not cleared',
      detail: 'Outstanding dues to the development authority can hold up registry.',
      tone: 'bad',
    })
  }
  if (project.escrow_verified === true) {
    rows.push({
      icon: ShieldCheck,
      label: 'RERA escrow',
      value: project.escrow_bank_name ? `Verified — ${project.escrow_bank_name}` : 'Verified',
      tone: 'good',
    })
  }

  // ── Forensic Due Diligence (Day 3 Stack) ──────────────────────────────────
  if (project.amitabh_kant_clearance === true) {
    rows.push({
      icon: ShieldCheck,
      label: 'Amitabh Kant Policy',
      value: '25% Land Dues Cleared',
      detail: 'Developer deposited mandatory 25% dues under UP state policy; individual flat sub-lease registry permitted.',
      tone: 'good',
    })
  }

  if (project.lift_act_compliant === true) {
    rows.push({
      icon: ShieldCheck,
      label: 'UP Lifts Act 2024',
      value: 'Registered & Certified',
      detail: 'Registered on updeslift.org with mandatory Automatic Rescue Device (ARD) and active OEM AMC.',
      tone: 'good',
    })
  }

  if (project.bank_apf_codes) {
    const codes = Array.isArray(project.bank_apf_codes)
      ? project.bank_apf_codes.join(', ')
      : typeof project.bank_apf_codes === 'object' && project.bank_apf_codes !== null
        ? Object.entries(project.bank_apf_codes).map(([k, v]) => `${k}: ${v}`).join(', ')
        : String(project.bank_apf_codes)
    if (codes.trim()) {
      rows.push({
        icon: ShieldCheck,
        label: 'Approved Bank APFs',
        value: 'Tier-1 Banks Approved',
        detail: `Pre-approved project codes: ${codes}`,
        tone: 'good',
      })
    }
  }

  if (project.water_source_type) {
    const isGanga = String(project.water_source_type).toLowerCase().includes('ganga')
    rows.push({
      icon: Drop,
      label: 'Water Source & TDS',
      value: isGanga ? 'Municipal Ganga Jal' : 'Groundwater / Mixed',
      detail: project.water_tds_range ? `Observed TDS: ${project.water_tds_range}` : null,
      tone: isGanga ? 'good' : 'warn',
    })
  }

  if (project.shahdara_drain_impact === true) {
    rows.push({
      icon: Wind,
      label: 'Shahdara Drain Impact',
      value: 'Odor & H2S Gas Risk',
      detail: 'Located within micro-climate of drain corridor; potential sewer odor and copper AC coil corrosion.',
      tone: 'warn',
    })
  }

  // ── Environment ─────────────────────────────────────────────────────────
  const flood = project.flood_waterlogging_risk || project.flood_zone
  if (flood) {
    const high = /high|severe/i.test(flood)
    rows.push({
      icon: Drop,
      label: 'Flood / waterlogging risk',
      value: humanise(flood),
      tone: high ? 'bad' : /medium|moderate/i.test(flood) ? 'warn' : 'good',
    })
  }
  const aqi = project.aqi_annual_avg ?? project.air_quality_index_avg
  if (typeof aqi === 'number') {
    rows.push({
      icon: Wind,
      label: 'Air quality (annual average)',
      value: `AQI ${Math.round(aqi)}`,
      tone: aqi >= 200 ? 'bad' : aqi >= 100 ? 'warn' : 'good',
    })
  }

  return rows
}

export default function VerificationPanel({ project }: { project: ProjectDetail }) {
  const rows = buildVerificationRows(project)
  const concerns = project.location_concerns?.filter(Boolean) ?? []
  // dna.last_verified_at is the closest thing to a project-level verification
  // stamp; decision_profile carries its own for the analyst narrative.
  const verifiedAt = project.dna?.last_verified_at ?? project.decision_profile?.last_verified_at ?? null

  if (rows.length === 0 && concerns.length === 0) return null

  return (
    <section
      aria-labelledby="verification-heading"
      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111] overflow-hidden"
    >
      <header className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <h3
            id="verification-heading"
            className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight"
          >
            Verification &amp; risk
          </h3>
          {/* Compliance facts are never hidden for age — an old RERA number is
              still the RERA number. Dating it is more honest than removing it. */}
          <FreshnessBadge date={verifiedAt} policy={FRESHNESS.compliance} />
        </div>
        <p className="text-[11.5px] sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
          Compliance and risk records we hold for this project. Anything not listed is not in our records.
        </p>
      </header>

      {rows.length > 0 && (
        <dl className="divide-y divide-slate-100 dark:divide-white/5">
          {rows.map(row => {
            const Icon = row.icon
            return (
              <div
                key={`${row.label}-${row.value}`}
                className="px-4 sm:px-5 py-3 flex items-start gap-3"
              >
                <Icon
                  size={16}
                  weight="bold"
                  aria-hidden="true"
                  className={`${TONE_CLASS[row.tone]} shrink-0 mt-0.5`}
                />
                <div className="min-w-0 flex-1">
                  <dt className="text-[11px] sm:text-[11.5px] uppercase tracking-wider font-semibold text-slate-500 dark:text-zinc-400">
                    {row.label}
                  </dt>
                  <dd className={`text-[13px] sm:text-sm font-semibold ${TONE_CLASS[row.tone]} break-words`}>
                    {row.value}
                  </dd>
                  {row.detail && (
                    <p className="text-[12px] sm:text-[12.5px] text-slate-600 dark:text-zinc-400 mt-1 leading-relaxed break-words">
                      {row.detail}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </dl>
      )}

      {concerns.length > 0 && (
        <div className="px-4 sm:px-5 py-3.5 border-t border-slate-100 dark:border-white/5 bg-amber-50/50 dark:bg-amber-950/10">
          <h4 className="text-[11px] uppercase tracking-wider font-semibold text-amber-800 dark:text-amber-400 mb-1.5">
            Location concerns
          </h4>
          <ul className="space-y-1">
            {concerns.map(concern => (
              <li key={concern} className="text-[12.5px] sm:text-[13px] text-slate-700 dark:text-zinc-300 leading-relaxed flex gap-2">
                <span aria-hidden="true" className="text-amber-600 dark:text-amber-500 shrink-0">•</span>
                <span className="min-w-0">{concern}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

'use client'

import { CheckCircle, Warning, XCircle, Question } from '@phosphor-icons/react'
import type { RequirementChecklistRow } from '@/types/project'

// Each stated criterion against the top pick's own rows. `unknown` means we
// don't hold the fact — it is shown as such, never as a pass or a caution.
const STATUS = {
  met: { Icon: CheckCircle, cls: 'text-emerald-600 dark:text-emerald-400', label: 'Meets' },
  caution: { Icon: Warning, cls: 'text-amber-600 dark:text-amber-400', label: 'Partly meets' },
  unmet: { Icon: XCircle, cls: 'text-red-600 dark:text-red-400', label: 'Does not meet' },
  unknown: { Icon: Question, cls: 'text-zinc-400 dark:text-zinc-500', label: 'Not on record' },
} as const

export function RequirementChecklist({ projectName, rows }: { projectName: string; rows?: RequirementChecklistRow[] | null }) {
  if (!rows?.length) return null
  return (
    <div className="mt-3 rounded-xl border border-border bg-surface-2 dark:bg-zinc-900/60 px-3.5 py-3">
      <p className="mb-2 text-[12px] font-semibold text-zinc-700 dark:text-zinc-200">
        How {projectName} fits your brief
      </p>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const s = STATUS[r.status] ?? STATUS.unknown
          return (
            <li key={r.criterion} className="flex items-start gap-2 text-[13px] leading-snug">
              <s.Icon size={15} weight="fill" className={`mt-[2px] shrink-0 ${s.cls}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className="sr-only">{s.label}: </span>
                <span className="font-medium text-zinc-800 dark:text-zinc-100">{r.criterion}</span>
                <span className="text-zinc-500 dark:text-zinc-400"> · {r.note}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default RequirementChecklist

'use client'

import { useState, useEffect } from 'react'
import { CaretDown, MapTrifold, Scales } from '@phosphor-icons/react'
import type { ProjectCard as ProjectCardType } from '@/types/project'

/**
 * The single results shelf: cards ahead of the answer, collapsed, everywhere.
 *
 * Two things were wrong before.
 *
 * On mobile the response's table pushed every project card below the fold, so
 * the one thing the buyer can act on — save, open, compare — was the hardest
 * thing to reach. They had to scroll the whole answer to learn anything had
 * been found at all.
 *
 * And there were two results drawers. This one, plus an older toolbar further
 * down carrying its own count, Map and Compare buttons and a View (N) toggle.
 * Two controls for one set of cards is a bug even when both work.
 *
 * So this replaces that toolbar rather than sitting beside it, which is why it
 * carries Map and Compare: they were the toolbar's, and the buyer would
 * otherwise have lost them.
 *
 * The header stays informative while collapsed — count, price band, sector —
 * because a chevron with nothing beside it is not a summary. The response
 * below stays expanded: the buyer just asked a question, and hiding the reply
 * behind a second tap reads as broken.
 */

function priceBand(projects: ProjectCardType[]): string | null {
  const mins = projects.map(p => p.price_min_cr).filter((n): n is number => typeof n === 'number' && n > 0)
  const maxs = projects.map(p => p.price_max_cr).filter((n): n is number => typeof n === 'number' && n > 0)
  if (mins.length === 0 && maxs.length === 0) return null
  const lo = mins.length ? Math.min(...mins) : Math.min(...maxs)
  const hi = maxs.length ? Math.max(...maxs) : Math.max(...mins)
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ''))
  return lo === hi ? `₹${fmt(lo)} Cr` : `₹${fmt(lo)}–${fmt(hi)} Cr`
}

const ACTION_CLASS =
  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-95 cursor-pointer'

export function MobileCardShelf({
  projects,
  sector,
  label,
  onMap,
  onCompare,
  canCompare = false,
  compareActive = false,
  children,
}: {
  projects: ProjectCardType[]
  /** Shown beside the count when the results share a sector. */
  sector?: string | null
  /** Overrides the default "N projects" — carries the spatial-scope wording. */
  label?: string | null
  onMap?: () => void
  onCompare?: () => void
  canCompare?: boolean
  compareActive?: boolean
  /** The card grid, rendered only once expanded so collapsed costs nothing. */
  children: React.ReactNode | ((props: {
    visibleProjects: ProjectCardType[]
    hasMore: boolean
    showAll: boolean
    setShowAll: React.Dispatch<React.SetStateAction<boolean>>
  }) => React.ReactNode)
}) {
  // Auto-expand on mobile if there's only 1 project or compare is active
  const [open, setOpen] = useState(projects.length === 1 || compareActive)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    if (compareActive) {
      setOpen(true)
    }
  }, [compareActive])
  if (projects.length === 0) return null

  const MAX_MOBILE_CARDS = 6
  const visibleProjects = showAll ? projects : projects.slice(0, MAX_MOBILE_CARDS)
  const hasMore = projects.length > MAX_MOBILE_CARDS

  const band = priceBand(projects)
  const noun = projects.length === 1 ? 'project' : 'projects'

  return (
    <div className="sm:hidden mb-3 w-full rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/50 overflow-hidden">
      <div className="flex items-center gap-2 pr-2.5">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-2.5 px-3.5 py-3 text-left active:bg-zinc-50 dark:active:bg-zinc-800/60 transition-colors"
        >
          <CaretDown
            size={15}
            weight="bold"
            className={`shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          />
          <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums truncate">
            {label || `${projects.length} ${noun}`}
          </span>
          {band && (
            <>
              <span className="text-zinc-300 dark:text-zinc-700 shrink-0" aria-hidden>·</span>
              <span className="text-[13px] font-semibold text-zinc-600 dark:text-zinc-400 tabular-nums shrink-0">{band}</span>
            </>
          )}
          {sector && (
            <span className="hidden sm:inline text-[12px] font-medium text-zinc-500 dark:text-zinc-500 truncate">in {sector}</span>
          )}
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {onMap && (
            <button
              type="button"
              onClick={onMap}
              aria-label="View on map"
              className={`${ACTION_CLASS} bg-white/80 dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-200 hover:border-primary`}
            >
              <MapTrifold size={13} weight="duotone" className="text-primary" />
              <span className="hidden sm:inline">Map</span>
            </button>
          )}
          {canCompare && onCompare && (
            <button
              type="button"
              onClick={onCompare}
              aria-label={compareActive ? 'Exit compare' : 'Compare properties'}
              className={`${ACTION_CLASS} ${
                compareActive
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white/80 dark:bg-zinc-800/80 border-zinc-200/80 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-200 hover:border-primary'
              }`}
            >
              <Scales size={13} weight="duotone" className={compareActive ? 'text-white' : 'text-primary'} />
              <span className="hidden sm:inline">{compareActive ? 'Exit' : 'Compare'}</span>
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="px-3 pb-3">
          {typeof children === 'function'
            ? children({ visibleProjects, hasMore, showAll, setShowAll })
            : children}
        </div>
      )}
    </div>
  )
}

export default MobileCardShelf

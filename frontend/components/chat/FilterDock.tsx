'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { CaretDown, Check, MagnifyingGlass, X } from '@phosphor-icons/react'

/**
 * The search refinement dock: the active filters, as controls, inside the input.
 *
 * Filters used to be rendered in three places — a read-only ribbon above the
 * conversation, a chip row above the input, and a badge inside it. Same state,
 * three renderings, editable in none of them: the only affordance was a remove
 * button held at opacity-0 until hover, which on a touch device is a control
 * you can neither see nor hit. This is the single place they live now.
 *
 * The pills WRAP, they do not scroll. A horizontal rail hid pills off the right
 * edge behind a gesture with no affordance — on a phone the buyer could not see
 * that budget and possession existed at all. Four pills on two rows is worse
 * layout and better product.
 *
 * The panel is still rendered through a portal, and that is not incidental. The
 * dock sits under a rounded, backdrop-blurred input dock, and the rail itself
 * was for a long time `overflow-x: auto`, which establishes a clipping context
 * in BOTH axes — a panel positioned `bottom-full` inside it was clipped away
 * entirely: every pill opened, and nothing appeared. Anchoring to the pill's
 * measured rect in a portal escapes that and every stacking context above it.
 *
 * On a phone the same panel becomes a bottom sheet. A 224px popover pinned to a
 * pill is a target you fight; a sheet is thumb-reachable, cannot land
 * off-screen, and dismisses on the backdrop.
 *
 * Changes dispatch INTENT_PATCH, which the chat turns back into a natural turn,
 * so refining is a continuation of the conversation and never a restart.
 */

type Patch = Record<string, unknown>

interface Choice {
  label: string
  patch: Patch
  isActive: (intent: Record<string, unknown>) => boolean
}

interface PillSpec {
  field: string
  title: string
  empty: string
  format: (intent: Record<string, unknown>) => string | null
  choices?: Choice[]
  freeText?: boolean
  /** Fields cleared when the buyer removes this pill. */
  clears: string[]
}

const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null)

const POSSESSION_LABELS: Record<string, string> = {
  immediate: 'Ready to Move',
  '1year': 'Within 1 Year',
  '2year': 'Within 2 Years',
  '3year+': '3+ Years',
}

/**
 * Budget reads as a band, not a ceiling. A buyer shopping at 1.4 Cr is not
 * served by a list that only says "under 2 Cr" — the band is how they already
 * describe the search, and a floor keeps obviously-too-cheap stock out.
 */
const BUDGET_BANDS: Array<{ label: string; min: number | null; max: number | null }> = [
  { label: 'Under ₹1 Cr', min: null, max: 1 },
  { label: '₹1 – 1.5 Cr', min: 1, max: 1.5 },
  { label: '₹1.5 – 2 Cr', min: 1.5, max: 2 },
  { label: '₹2 – 3 Cr', min: 2, max: 3 },
  { label: '₹3 Cr+', min: 3, max: null },
]

const PILLS: PillSpec[] = [
  {
    field: 'sector',
    title: 'Location',
    empty: 'Location',
    freeText: true,
    clears: ['sector'],
    format: i => (typeof i.sector === 'string' && i.sector ? i.sector : null),
  },
  {
    field: 'bhk',
    title: 'Configuration',
    empty: 'Configuration',
    clears: ['bhk'],
    format: i => (Array.isArray(i.bhk) && i.bhk.length ? `${i.bhk.join(', ')} BHK` : null),
    choices: [1, 2, 3, 4, 5].map(n => ({
      label: `${n} BHK`,
      patch: { bhk: [n] },
      isActive: i => Array.isArray(i.bhk) && i.bhk.length === 1 && i.bhk[0] === n,
    })),
  },
  {
    field: 'possession',
    title: 'Possession',
    empty: 'Possession',
    clears: ['possession'],
    format: i =>
      typeof i.possession === 'string' && i.possession
        ? POSSESSION_LABELS[i.possession] ?? i.possession
        : null,
    choices: Object.entries(POSSESSION_LABELS).map(([value, label]) => ({
      label,
      patch: { possession: value },
      isActive: i => i.possession === value,
    })),
  },
  {
    field: 'budget',
    title: 'Budget',
    empty: 'Budget',
    clears: ['budgetMin', 'budgetMax'],
    format: i => {
      const lo = num(i.budgetMin)
      const hi = num(i.budgetMax)
      if (lo === null && hi === null) return null
      const band = BUDGET_BANDS.find(b => b.min === lo && b.max === hi)
      if (band) return band.label
      if (lo !== null && hi !== null) return `₹${lo} – ${hi} Cr`
      return hi !== null ? `Under ₹${hi} Cr` : `₹${lo} Cr+`
    },
    choices: BUDGET_BANDS.map(b => ({
      label: b.label,
      patch: { budgetMin: b.min, budgetMax: b.max },
      isActive: i => num(i.budgetMin) === b.min && num(i.budgetMax) === b.max,
    })),
  },
]

const MOBILE_BREAKPOINT = 640

export function FilterDock({
  intent,
  onPatch,
  onRemove,
  disabled = false,
}: {
  intent: Record<string, unknown> | null
  /**
   * `label` is the buyer-facing sentence for the change. It becomes the user
   * turn in the transcript AND the message the model reads. Without it the
   * bubble rendered the literal string "INTENT_PATCH" and the model was handed
   * "[User selected UI option: updated search]" — which named no field and no
   * value, so the answer that came back was about the old search.
   */
  onPatch: (patch: Patch, label: string) => void
  onRemove: (fields: string[], label: string) => void
  disabled?: boolean
}) {
  const [openField, setOpenField] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [anchor, setAnchor] = useState<{ left: number; bottom: number } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mounted, setMounted] = useState(false)

  const pillRefs = useRef<Record<string, HTMLDivElement | null>>({})
  // Tab cycles inside the open panel, Escape closes it, and focus returns to
  // the pill that opened it. Without the last one, dismissing a filter dropped
  // the keyboard back at the top of the page.
  const panelRef = useDialogA11y<HTMLDivElement>(openField !== null, () => setOpenField(null))

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const place = useCallback((field: string) => {
    const el = pillRefs.current[field]
    if (!el) return
    const r = el.getBoundingClientRect()
    // Kept inside the viewport: a pill near the right edge would otherwise open
    // a panel that runs off it.
    const width = 224
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    setAnchor({ left, bottom: window.innerHeight - r.top + 8 })
  }, [])

  useLayoutEffect(() => {
    if (!openField || isMobile) return
    place(openField)
  }, [openField, isMobile, place])

  // Re-anchor rather than drift: the dock scrolls horizontally, and the input
  // moves when the on-screen keyboard opens.
  useEffect(() => {
    if (!openField || isMobile) return
    const reposition = () => place(openField)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
    }
  }, [openField, isMobile, place])

  // Capture phase: a tap on another control is swallowed before a click or blur
  // handler ever sees it, which left the panel open until a second tap.
  useEffect(() => {
    if (!openField) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (pillRefs.current[openField]?.contains(t)) return
      setOpenField(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenField(null)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [openField])

  if (!intent) return null

  const state = intent
  const spec = PILLS.find(p => p.field === openField) ?? null

  const apply = (patch: Patch, label: string) => {
    setOpenField(null)
    setDraft('')
    onPatch(patch, label)
  }

  const panelBody = spec && (
    <>
      <div className="flex items-center justify-between px-2 pt-0.5 pb-1.5">
        <span className="text-[12px] font-medium text-text-muted">
          {spec.title}
        </span>
        {isMobile && (
          <button
            type="button"
            onClick={() => setOpenField(null)}
            aria-label="Close"
            className="p-1.5 -m-1 text-text-muted hover:text-text-primary cursor-pointer"
          >
            <X size={13} weight="bold" />
          </button>
        )}
      </div>

      {spec.freeText ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            const v = draft.trim()
            if (v) apply({ [spec.field]: v }, `Change ${spec.title.toLowerCase()} to ${v}`)
          }}
          className="px-1 pb-1"
        >
          <div className="flex items-center gap-1.5 px-2 rounded-xs border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus-within:border-zinc-400 dark:focus-within:border-zinc-500 transition-colors">
            <MagnifyingGlass size={12} weight="bold" className="shrink-0 text-text-muted" />
            <input
              autoFocus={!isMobile}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="e.g. Sector 10, Greater Noida"
              aria-label={spec.title}
              className="w-full bg-transparent py-2.5 text-[13px] text-text-primary placeholder:text-text-muted outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={!draft.trim()}
            className="mt-1.5 w-full py-2.5 rounded-xs text-[13px] font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-opacity"
          >
            Apply
          </button>
        </form>
      ) : (
        <div className="flex flex-col">
          {spec.choices?.map(choice => {
            const active = choice.isActive(state)
            return (
              <button
                key={choice.label}
                type="button"
                onClick={() => apply(choice.patch, `Change ${spec.title.toLowerCase()} to ${choice.label}`)}
                aria-pressed={active}
                className="flex items-center gap-2.5 w-full px-2 py-2.5 min-h-[42px] sm:min-h-[36px] rounded-xs text-left text-[13px] text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <span
                  className={
                    'shrink-0 w-[14px] h-[14px] rounded-full border flex items-center justify-center transition-colors ' +
                    (active ? 'border-zinc-900 dark:border-white' : 'border-zinc-300 dark:border-zinc-600')
                  }
                >
                  {active && <span className="w-[6px] h-[6px] rounded-full bg-zinc-900 dark:bg-white" />}
                </span>
                <span className="flex-1 truncate">{choice.label}</span>
                {active && <Check size={12} weight="bold" className="shrink-0 text-text-muted" />}
              </button>
            )
          })}
        </div>
      )}
    </>
  )

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-1 sm:gap-1.5 min-w-0 w-full"
        aria-label="Search filters"
      >
        {PILLS.map(p => {
          const value = p.format(state)
          const isSet = value !== null
          const isOpen = openField === p.field

          return (
            <div
              key={p.field}
              ref={el => { pillRefs.current[p.field] = el }}
              className="shrink-0"
            >
              <div
                className={
                  'flex items-center rounded-full border text-[12px] font-medium transition-colors ' +
                  (isOpen
                    ? 'border-zinc-400 dark:border-zinc-500 bg-surface dark:bg-zinc-800'
                    : isSet
                      ? 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/70'
                      : 'border-dashed border-zinc-200 dark:border-zinc-700 bg-transparent')
                }
              >
                <button
                  type="button"
                  disabled={disabled}
                  aria-expanded={isOpen}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setDraft(p.freeText && typeof state[p.field] === 'string' ? String(state[p.field]) : '')
                    setOpenField(isOpen ? null : p.field)
                  }}
                  title={isSet ? `Change ${p.title.toLowerCase()}` : `Set ${p.title.toLowerCase()}`}
                  className={
                    'flex items-center gap-1 pl-2.5 py-1.5 min-h-[32px] cursor-pointer ' +
                    (isSet ? 'pr-1 text-text-primary' : 'pr-2.5 text-text-muted')
                  }
                >
                  <span className="whitespace-nowrap max-w-[120px] truncate">{value ?? p.empty}</span>
                  <CaretDown
                    size={10}
                    weight="bold"
                    className={'shrink-0 opacity-60 transition-transform ' + (isOpen ? 'rotate-180' : '')}
                  />
                </button>

                {isSet && (
                  <button
                    type="button"
                    disabled={disabled}
                    // One dispatch, not one per cleared field: budget clears two
                    // fields, and the second call hit the submit lock and
                    // surfaced "still working on your last request".
                    onClick={() => onRemove(p.clears, `Clear ${p.title.toLowerCase()}`)}
                    aria-label={`Clear ${p.title.toLowerCase()}`}
                    className="pr-2 pl-0.5 py-1.5 min-h-[32px] flex items-center text-text-muted hover:text-text-primary cursor-pointer"
                  >
                    <X size={10} weight="bold" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {mounted && spec && createPortal(
        isMobile ? (
          <div className="fixed inset-0 z-[999] flex items-end">
            <div className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" aria-hidden />
            <div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={spec.title}
              className="relative w-full rounded-t-2xl border-t border-zinc-200 dark:border-zinc-700 bg-surface dark:bg-surface-2 shadow-lg p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[70dvh] overflow-y-auto overscroll-contain"
            >
              {panelBody}
            </div>
          </div>
        ) : (
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={spec.title}
            style={{ left: anchor?.left ?? 0, bottom: anchor?.bottom ?? 0, width: 224 }}
            className="fixed z-[999] rounded-sm border border-zinc-200 dark:border-zinc-700 bg-surface dark:bg-surface-2 shadow-md p-1.5"
          >
            {panelBody}
          </div>
        ),
        document.body,
      )}
    </>
  )
}

export default FilterDock

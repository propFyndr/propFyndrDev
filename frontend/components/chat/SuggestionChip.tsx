'use client'

import { m } from 'framer-motion'
import { CaretDown, ArrowsLeftRight, CurrencyInr, ShieldCheck, MapPin, Sliders } from '@phosphor-icons/react'
import { renderChipIcon, stripEmojis } from '@/lib/chipIconUtils'
import type { ChipAction, ChipPickerState, ChipTone } from './types'

interface SuggestionChipProps {
  chip: ChipAction
  chipPicker: ChipPickerState | null
  onSetChipPicker: (picker: ChipPickerState | null) => void
  onAction: (chip: ChipAction) => void
  disabled?: boolean
}

/**
 * A suggested next step.
 *
 * Chips used to render as a row of identical grey pills, which made three
 * genuinely different offers — compare these two, what does it cost, is it
 * legally clean — look like one repeated button. The backend now tags each with
 * the kind of question it asks, and the kind is what the colour and the icon
 * carry. A chip with no tone renders in the neutral style, which is every chip
 * built outside the adaptive set.
 */
const TONE: Record<ChipTone, { idle: string; hover: string; icon: typeof CaretDown }> = {
  compare: {
    idle: 'border-indigo-200/90 bg-indigo-50/90 text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-950/40 dark:text-indigo-200',
    hover: 'hover:border-indigo-300 hover:bg-indigo-100/90 dark:hover:bg-indigo-900/50',
    icon: ArrowsLeftRight,
  },
  money: {
    idle: 'border-emerald-200/90 bg-emerald-50/90 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200',
    hover: 'hover:border-emerald-300 hover:bg-emerald-100/90 dark:hover:bg-emerald-900/50',
    icon: CurrencyInr,
  },
  trust: {
    idle: 'border-amber-200/90 bg-amber-50/90 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200',
    hover: 'hover:border-amber-300 hover:bg-amber-100/90 dark:hover:bg-amber-900/50',
    icon: ShieldCheck,
  },
  place: {
    idle: 'border-sky-200/90 bg-sky-50/90 text-sky-950 dark:border-sky-500/30 dark:bg-sky-950/40 dark:text-sky-200',
    hover: 'hover:border-sky-300 hover:bg-sky-100/90 dark:hover:bg-sky-900/50',
    icon: MapPin,
  },
  ask: {
    idle: 'border-zinc-200/80 bg-white/95 text-zinc-800 dark:border-zinc-700/80 dark:bg-zinc-800/90 dark:text-zinc-200',
    hover: 'hover:border-zinc-300 hover:bg-white dark:hover:border-zinc-600 dark:hover:bg-zinc-700',
    icon: Sliders,
  },
}

const NEUTRAL =
  'border-zinc-200/80 bg-white/95 text-zinc-800 hover:border-zinc-300 hover:bg-white hover:text-zinc-950 ' +
  'dark:border-zinc-700/80 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-white'

export function SuggestionChip({ chip, chipPicker, onSetChipPicker, onAction, disabled }: SuggestionChipProps) {
  if (!chip.label || !chip.label.trim()) return null
  const cleanLabel = stripEmojis(chip.label)
  const isActive = chipPicker?.label === chip.label || chipPicker?.label === cleanLabel
  const hasDropdown = chip.actionType === 'COMPARE_PROPERTIES' || chip.actionType === 'CALCULATE_EMI' || chip.actionType === 'BOOK_VISIT'
  const tone = chip.tone ? TONE[chip.tone] : null
  const ToneIcon = tone?.icon

  return (
    <m.button
      whileHover={{ y: -1.5, scale: 1.015 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      key={chip.id}
      onClick={() => {
        if (isActive) {
          onSetChipPicker(null)
          return
        }
        onAction(chip)
      }}
      className={`
        tap-target-y group relative inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full text-[12px] sm:text-[12.5px] font-semibold
        border backdrop-blur-md shadow-2xs transition-all duration-150 outline-none max-w-full select-none cursor-pointer shrink-0
        focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-500
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
        ${
          isActive
            ? 'bg-zinc-900 text-white border-zinc-800 dark:bg-white dark:text-zinc-900 dark:border-zinc-200 shadow-xs'
            : tone
              ? `${tone.idle} ${tone.hover} hover:shadow-xs active:scale-95`
              : `${NEUTRAL} hover:shadow-xs active:scale-95`
        }
      `}
      title={cleanLabel}
      aria-label={cleanLabel}
      role="button"
      aria-pressed={isActive}
    >
      {ToneIcon
        ? <ToneIcon size={13} weight="bold" className="flex-shrink-0 opacity-80" />
        : renderChipIcon(cleanLabel, isActive)}
      <span className="truncate min-w-0 font-medium tracking-tight">{cleanLabel}</span>
      {hasDropdown && (
        <CaretDown
          size={13}
          weight="bold"
          className={`flex-shrink-0 transition-transform duration-200 ${
            isActive ? 'rotate-180' : 'opacity-50 group-hover:opacity-90'
          }`}
        />
      )}
    </m.button>
  )
}

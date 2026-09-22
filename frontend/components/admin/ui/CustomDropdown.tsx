'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CaretDown, Check } from '@phosphor-icons/react'

export interface DropdownOption<T extends string = string> {
  value: T
  label: string
  badge?: string
  icon?: React.ReactNode
  dotColor?: string
}

interface CustomDropdownProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: DropdownOption<T>[]
  placeholder?: string
  className?: string
  disabled?: boolean
  align?: 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
}

export default function CustomDropdown<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  disabled = false,
  align = 'left',
  size = 'md',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  // Close on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (!isOpen) return

      if (e.key === 'Escape') {
        setIsOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          onChange(options[highlightedIndex].value)
          setIsOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, highlightedIndex, options, onChange])

  // Reset highlight index when opening
  useEffect(() => {
    if (isOpen) {
      const idx = options.findIndex((o) => o.value === value)
      setHighlightedIndex(idx >= 0 ? idx : 0)
    }
  }, [isOpen, options, value])

  const sizeStyles = {
    sm: {
      btn: 'px-3 py-1.5 text-xs font-semibold rounded-xl gap-2',
      caret: 12,
      item: 'px-3 py-1.5 text-xs rounded-lg gap-2',
      check: 12,
    },
    md: {
      btn: 'px-3.5 py-2 text-xs font-semibold rounded-xl gap-2.5',
      caret: 14,
      item: 'px-3 py-2 text-xs font-medium rounded-xl gap-2.5',
      check: 13,
    },
    lg: {
      btn: 'px-4 py-2.5 text-sm font-semibold rounded-2xl gap-3',
      caret: 16,
      item: 'px-3.5 py-2.5 text-sm font-medium rounded-xl gap-3',
      check: 14,
    },
  }[size]

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full inline-flex items-center justify-between text-left transition-all duration-150 select-none cursor-pointer border shadow-2xs ${sizeStyles.btn} ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
            : 'border-zinc-200/90 dark:border-zinc-700/80 bg-white dark:bg-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'active:scale-[0.99]'}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          {!selectedOption?.icon && selectedOption?.dotColor && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${selectedOption.dotColor}`} />
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
              {selectedOption.badge}
            </span>
          )}
        </span>

        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 text-zinc-400 dark:text-zinc-500"
        >
          <CaretDown size={sizeStyles.caret} weight="bold" />
        </motion.span>
      </button>

      {/* Popover Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={listRef}
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className={`absolute top-full mt-1.5 z-50 min-w-[200px] w-max max-w-[320px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-xl shadow-zinc-950/10 dark:shadow-black/60 p-1.5 space-y-0.5 max-h-64 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
              align === 'right' ? 'right-0' : 'left-0'
            }`}
          >
            {options.map((opt, idx) => {
              const isSelected = opt.value === value
              const isHighlighted = idx === highlightedIndex

              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between text-left cursor-pointer select-none transition-colors ${sizeStyles.item} ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : isHighlighted
                      ? 'bg-zinc-100/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {opt.icon}
                    {!opt.icon && opt.dotColor && (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dotColor}`} />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {opt.badge && (
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check
                        size={sizeStyles.check}
                        weight="bold"
                        className="text-blue-600 dark:text-blue-400"
                      />
                    )}
                  </div>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

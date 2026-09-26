'use client'

import React, { useState, useRef, useEffect } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { m, AnimatePresence } from 'framer-motion'

export interface DropdownOption {
  value: string
  label: string
  icon?: React.ReactNode
  description?: string
  disabled?: boolean
}

export interface CustomDropdownProps {
  value: string
  onChange: (value: string) => void
  options: (DropdownOption | string)[]
  placeholder?: string
  label?: string
  className?: string
  triggerClassName?: string
  menuClassName?: string
  align?: 'left' | 'right' | 'center'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  label,
  className = '',
  triggerClassName = '',
  menuClassName = '',
  align = 'left',
  size = 'sm',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])

  // Normalize options to DropdownOption objects
  const normalizedOptions: DropdownOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  )

  const selectedOption = normalizedOptions.find((opt) => opt.value === value)

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  // Roving focus: opening moves focus to the selected option (or the first
  // enabled one); arrows, Home and End move between enabled options.
  useEffect(() => {
    if (!isOpen) return
    const selectedIdx = normalizedOptions.findIndex(o => o.value === value && !o.disabled)
    const firstIdx = normalizedOptions.findIndex(o => !o.disabled)
    const idx = selectedIdx >= 0 ? selectedIdx : firstIdx
    // After the menu mounts.
    const t = requestAnimationFrame(() => optionRefs.current[idx]?.focus())
    return () => cancelAnimationFrame(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on open only
  }, [isOpen])

  const moveFocus = (e: React.KeyboardEvent) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return
    e.preventDefault()
    const enabled = normalizedOptions.map((o, i) => (o.disabled ? -1 : i)).filter(i => i >= 0)
    if (enabled.length === 0) return
    const current = optionRefs.current.findIndex(el => el === document.activeElement)
    const pos = enabled.indexOf(current)
    let next: number
    if (e.key === 'Home') next = enabled[0]
    else if (e.key === 'End') next = enabled[enabled.length - 1]
    else if (e.key === 'ArrowDown') next = enabled[pos < 0 ? 0 : (pos + 1) % enabled.length]
    else next = enabled[pos < 0 ? enabled.length - 1 : (pos - 1 + enabled.length) % enabled.length]
    optionRefs.current[next]?.focus()
  }

  // Size styling
  const sizeClasses = {
    xs: 'px-2.5 py-1.5 text-[11px] rounded-xs gap-1.5',
    sm: 'px-3 py-2 text-[12px] rounded-xs gap-2',
    md: 'px-4 py-2.5 text-[13px] rounded-xs gap-2.5',
    lg: 'px-5 py-3 text-[15px] rounded-xs gap-3',
  }[size]

  const alignClasses = {
    left: 'left-0 origin-top-left',
    right: 'right-0 origin-top-right',
    center: 'left-1/2 -translate-x-1/2 origin-top',
  }[align]

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {label && (
        <span className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-1">
          {label}
        </span>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isOpen) {
            e.preventDefault()
            setIsOpen(true)
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`
          group flex items-center justify-between select-none
          border border-border
          bg-surface dark:bg-zinc-900
          text-zinc-800 dark:text-zinc-100 font-medium
          hover:bg-surface-3 dark:hover:bg-zinc-800
          hover:border-border-heavy
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
          transition-colors duration-150
          disabled:opacity-50 disabled:cursor-not-allowed
          ${sizeClasses}
          ${triggerClassName}
        `}
      >
        <span className="truncate flex items-center gap-1.5">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>

        <m.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="shrink-0 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 ml-1"
        >
          <CaretDown size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} weight="bold" aria-hidden="true" />
        </m.span>
      </button>

      {/* Dropdown Menu Portal / Floating Layer */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            onKeyDown={moveFocus}
            className={`
              absolute top-full mt-1.5 z-[100]
              min-w-[140px] max-w-[280px] w-max
              bg-surface dark:bg-zinc-900
              border border-border
              shadow-md
              rounded-sm p-1
              max-h-64 overflow-y-auto overscroll-contain
              ${alignClasses}
              ${menuClassName}
            `}
          >
            <div className="py-0.5 space-y-0.5">
              {normalizedOptions.map((option, i) => {
                const isSelected = option.value === value
                return (
                  <button
                    key={option.value}
                    ref={(el) => { optionRefs.current[i] = el }}
                    type="button"
                    tabIndex={-1}
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onClick={() => {
                      if (!option.disabled) {
                        onChange(option.value)
                        setIsOpen(false)
                        triggerRef.current?.focus()
                      }
                    }}
                    className={`
                      w-full flex items-center justify-between gap-3 text-left
                      px-3 py-2 rounded-xs text-[13px]
                      transition-colors duration-150 select-none
                      focus-visible:outline-none focus-visible:bg-surface-3 dark:focus-visible:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-primary
                      ${option.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                      ${
                        isSelected
                          ? 'bg-surface-3 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-semibold'
                          : 'text-zinc-700 dark:text-zinc-200 hover:bg-surface-3 dark:hover:bg-zinc-800 font-medium'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {option.icon && <span className="shrink-0">{option.icon}</span>}
                      <div className="truncate">
                        <span className="block truncate">{option.label}</span>
                        {option.description && (
                          <span className="block text-[11px] text-zinc-500 font-normal truncate">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check
                        size={14}
                        weight="bold"
                        className="shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

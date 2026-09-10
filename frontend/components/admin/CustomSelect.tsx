'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  dotColor?: string
  icon?: React.ReactNode
}

interface CustomSelectProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  placeholder?: string
  className?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export default function CustomSelect<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className = '',
  disabled = false,
  size = 'md',
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((o) => o.value === value)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const sizeClasses = {
    sm: {
      btn: 'px-3 py-1.5 text-xs font-semibold rounded-xl',
      chevron: 13,
      item: 'px-3 py-1.5 text-xs rounded-lg',
      check: 12,
    },
    md: {
      btn: 'px-3.5 py-2.5 text-xs font-semibold rounded-xl',
      chevron: 15,
      item: 'px-3.5 py-2 text-[13px] rounded-xl',
      check: 13,
    },
    lg: {
      btn: 'px-4 py-3 text-[14px] font-semibold rounded-2xl',
      chevron: 16,
      item: 'px-3.5 py-2.5 text-[13.5px] rounded-xl',
      check: 14,
    },
  }[size]

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 bg-white dark:bg-zinc-900 border text-left transition-all duration-150 shadow-2xs select-none cursor-pointer ${sizeClasses.btn} ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 text-zinc-900 dark:text-zinc-100'
            : 'border-zinc-200/90 dark:border-zinc-700/80 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          {!selectedOption?.icon && selectedOption?.dotColor && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${selectedOption.dotColor}`} />
          )}
          <span className={selectedOption ? 'text-zinc-900 dark:text-zinc-100 font-semibold truncate' : 'text-zinc-400 dark:text-zinc-500 font-normal truncate'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={sizeClasses.chevron}
          className={`text-zinc-400 dark:text-zinc-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''
          }`}
        />
      </button>

      {/* Custom Floating Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 z-50 min-w-full w-max max-w-[320px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-xl shadow-zinc-950/10 dark:shadow-black/40 p-1.5 space-y-0.5 max-h-60 overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-150 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {options.map((opt) => {
            const isSelected = opt.value === value
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value)
                  setIsOpen(false)
                }}
                className={`flex items-center justify-between gap-3 font-medium transition-colors cursor-pointer select-none ${sizeClasses.item} ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {opt.icon}
                  {!opt.icon && opt.dotColor && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dotColor}`} />
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>
                {isSelected && <Check size={sizeClasses.check} className="text-blue-600 dark:text-blue-400 shrink-0 ml-2" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

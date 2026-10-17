// Eye-icon hint: explains how a referral number is counted. Opens on hover
// and on keyboard focus; the text is wired to the button via aria-describedby.
import { useId, type ReactNode } from 'react'
import { Eye } from '@phosphor-icons/react'

export default function DefinitionHint({
  label,
  children,
  align = 'left',
}: {
  label: string
  children: ReactNode
  align?: 'left' | 'right'
}) {
  const id = useId()
  return (
    <span className="relative inline-flex group/hint">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="w-6 h-6 rounded-full flex items-center justify-center text-[#6e6e73] dark:text-[#98989d] hover:text-[#0066cc] dark:hover:text-[#2997ff] hover:bg-[#f5f5f7] dark:hover:bg-[#242426] transition-colors cursor-help"
      >
        <Eye size={14} />
      </button>
      <span
        role="tooltip"
        id={id}
        className={`invisible opacity-0 group-hover/hint:visible group-hover/hint:opacity-100 group-focus-within/hint:visible group-focus-within/hint:opacity-100 transition-opacity absolute top-full mt-2 z-40 w-[min(20rem,calc(100vw-2rem))] p-3 rounded-xl bg-white dark:bg-[#2c2c2e] border border-[#e5e5ea] dark:border-[#38383a] shadow-md text-left text-[11px] leading-relaxed font-normal normal-case tracking-normal text-[#1d1d1f] dark:text-[#f5f5f7] ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {children}
      </span>
    </span>
  )
}

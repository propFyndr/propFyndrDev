'use client'

/**
 * The sign-in page's chrome, extracted so forgot-password and reset-password
 * are the same screen with a different form rather than a near-miss of it.
 *
 * Everything here — the watermark placement, the token names, the field
 * classes — is lifted verbatim from app/admin/login/page.tsx. Sharing it is
 * what keeps the three pages identical as that one evolves.
 */

import Image from 'next/image'

/** The one input style every auth field uses. */
export const AUTH_INPUT_CLASS =
  'w-full bg-surface-2 dark:bg-surface-3 border border-[var(--color-border)] rounded-[var(--radius-md)] px-3.5 py-3 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all'

export const AUTH_LABEL_CLASS =
  'text-[11px] font-medium text-[var(--color-text-secondary)] px-0.5'

export function AuthError({ message }: { message: string }) {
  return (
    <p className="text-[12.5px] text-[var(--color-danger)] bg-[var(--color-danger)]/8 border border-[var(--color-danger)]/15 rounded-[var(--radius-sm)] px-3 py-2">
      {message}
    </p>
  )
}

export function AuthNotice({ message }: { message: string }) {
  return (
    <p className="text-[12.5px] text-[var(--color-success)] bg-[var(--color-success)]/8 border border-[var(--color-success)]/15 rounded-[var(--radius-sm)] px-3 py-2">
      {message}
    </p>
  )
}

export function AuthSubmit({
  loading,
  disabled,
  icon,
  children,
}: {
  loading: boolean
  disabled?: boolean
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className="w-full text-white font-medium py-3 rounded-[var(--radius-md)] text-[14px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-[var(--shadow-2)] hover:shadow-[var(--shadow-3)]"
      style={{ background: 'var(--color-primary)' }}
    >
      {icon}
      {children}
    </button>
  )
}

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-surface-2 dark:bg-surface">
      {/* The same oversized square-mark watermark the sign-in page uses. */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-[520px] h-[520px] opacity-[0.05] dark:opacity-[0.07] rotate-[-8deg]">
        <Image src="/images/icons/logo-square-black.png" alt="" width={520} height={520} className="object-contain block dark:hidden" unoptimized />
        <Image src="/images/icons/logo-square-white.png" alt="" width={520} height={520} className="object-contain hidden dark:block" unoptimized />
      </div>
      <div className="pointer-events-none absolute -bottom-32 -left-16 w-[360px] h-[360px] opacity-[0.04] dark:opacity-[0.05] rotate-[10deg]">
        <Image src="/images/icons/logo-square-black.png" alt="" width={360} height={360} className="object-contain block dark:hidden" unoptimized />
        <Image src="/images/icons/logo-square-white.png" alt="" width={360} height={360} className="object-contain hidden dark:block" unoptimized />
      </div>

      <div className="relative w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl shadow-[var(--shadow-3)] flex items-center justify-center mb-4 bg-white dark:bg-surface-2 border border-[var(--color-border)]">
            <Image src="/images/icons/logo-square-black.png" alt="PropFyndr" width={32} height={32} className="object-contain block dark:hidden" unoptimized />
            <Image src="/images/icons/logo-square-white.png" alt="PropFyndr" width={32} height={32} className="object-contain hidden dark:block" unoptimized />
          </div>
          <h1 className="text-[15px] font-semibold text-[var(--color-text-primary)] tracking-tight">{title}</h1>
          <p className="text-[13px] text-[var(--color-text-muted)] mt-0.5 text-center">{subtitle}</p>
        </div>

        {children}

        {footer}

        <p className="text-[11px] text-[var(--color-text-muted)] text-center mt-6">
          Noida &amp; Greater Noida &middot; AI Real Estate Advisor
        </p>
      </div>
    </div>
  )
}

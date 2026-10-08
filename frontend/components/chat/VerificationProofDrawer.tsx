'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ShieldCheck,
  CheckCircle,
  Copy,
  ArrowSquareOut,
  X,
  Buildings,
  FileText,
  Check,
} from '@phosphor-icons/react'
import { useDialogA11y } from '@/hooks/useDialogA11y'
import { track } from '@/lib/analytics'

export interface VerificationProofData {
  claim: string
  projectName?: string | null
  authorityName?: string | null
  certificateId?: string | null
  officialUrl?: string | null
}

export interface VerificationProofDrawerProps {
  proof: VerificationProofData | null
  onClose: () => void
  onToast?: (msg: string) => void
}

export function VerificationProofDrawer({ proof, onClose, onToast }: VerificationProofDrawerProps) {
  const [copied, setCopied] = useState(false)
  const dialogRef = useDialogA11y<HTMLDivElement>(proof !== null, onClose)

  if (!proof) return null

  // Every field shown here comes from the project's own row. Nothing has a
  // default: a field we do not hold is not rendered, never filled in.
  const { claim, projectName, authorityName, certificateId, officialUrl } = proof

  const handleCopy = () => {
    if (certificateId) {
      navigator.clipboard?.writeText(certificateId).catch(() => {})
      setCopied(true)
      onToast?.('Copied certificate ID to clipboard')
      track('provenance_certificate_copied', { certificateId, projectName: projectName || 'Unknown' })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="proof-drawer-title"
        className="w-full max-w-md h-full bg-surface dark:bg-zinc-900 border-l border-border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between gap-3 bg-surface-2 dark:bg-zinc-800/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck size={18} weight="fill" aria-hidden="true" />
            </div>
            <div>
              <h3 id="proof-drawer-title" className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">Project record</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">From this project's RERA registration</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close proof drawer"
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-h-[48px] min-w-[44px] flex items-center justify-center"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 text-[13px]">
          {/* Claim title banner */}
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/50 space-y-1">
            <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle size={14} weight="fill" /> Matches our record
            </div>
            <div className="text-[14px] font-semibold text-emerald-950 dark:text-emerald-100">
              {claim}
            </div>
            {projectName && (
              <div className="text-[12px] text-emerald-800 dark:text-emerald-300">
                {projectName}
              </div>
            )}
          </div>

          {/* Verification Details */}
          <div className="space-y-3 pt-2">
            {authorityName && (
              <div className="p-3 rounded-lg border border-border bg-surface-2 dark:bg-zinc-800/40 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500 flex items-center gap-1.5">
                  <Buildings size={13} /> Registering authority
                </div>
                <div className="text-[12.5px] font-semibold text-zinc-900 dark:text-zinc-100">
                  {authorityName}
                </div>
              </div>
            )}

            {certificateId && (
              <div className="p-3 rounded-lg border border-border bg-surface-2 dark:bg-zinc-800/40 space-y-1">
                <div className="text-[11px] font-medium text-zinc-500 flex items-center gap-1.5">
                  <FileText size={13} /> RERA registration number
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[12px] font-mono font-semibold text-primary dark:text-blue-400 select-all">
                    {certificateId}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-2 py-1 text-[11px] font-medium rounded-xs border border-border hover:bg-surface text-zinc-700 dark:text-zinc-300 flex items-center gap-1 transition-colors cursor-pointer min-h-[32px]"
                  >
                    {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            )}

            <p className="text-[12px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
              This is the registration we hold for the project. PropFyndr has not inspected the site;
              check the number on the authority's portal before you pay a booking amount.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-border flex items-center gap-2.5 bg-surface-2 dark:bg-zinc-800/40">
          {officialUrl && (
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 px-3 rounded-lg bg-surface hover:bg-surface-3 border border-border text-zinc-800 dark:text-zinc-200 font-medium text-[12px] flex items-center justify-center gap-1.5 transition-colors min-h-[48px]"
            >
              <span>Check on RERA portal</span>
              <ArrowSquareOut size={13} />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-lg bg-primary hover:bg-primary-dark text-white font-semibold text-[12px] transition-colors min-h-[48px] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default VerificationProofDrawer

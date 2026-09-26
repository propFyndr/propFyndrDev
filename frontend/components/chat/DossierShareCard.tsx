'use client'

import React, { useState } from 'react'
import { FileText, ArrowSquareOut, Copy, Check, ShareNetwork, CheckCircle, LockSimple } from '@phosphor-icons/react'
import { track } from '@/lib/analytics'

interface DossierShareCardProps {
  href: string
  label?: string
  onToast?: (msg: string) => void
}

export function DossierShareCard({ href, label, onToast }: DossierShareCardProps) {
  const [copied, setCopied] = useState(false)

  // Ensure full URL for clipboard and sharing
  const getFullUrl = () => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin
      return href.startsWith('http') ? href : `${origin}${href}`
    }
    return href
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const fullUrl = getFullUrl()
    track('dossier_shared', { channel: 'copy' })

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setCopied(true)
        onToast?.('Link copied')
        setTimeout(() => setCopied(false), 3000)
      }).catch(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 3000)
      })
    } else {
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    track('dossier_shared', { channel: 'open' })
    if (typeof window !== 'undefined') {
      window.open(href, '_blank', 'noopener,noreferrer')
    }
  }

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const fullUrl = getFullUrl()
    track('dossier_shared', { channel: 'whatsapp' })
    const text = `My property research on PropFyndr — the questions I asked, the answers, and the projects side by side:\n${fullUrl}`
    if (typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  const btn = 'px-3.5 py-2 rounded-xs text-[13px] font-medium flex items-center gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1'
  return (
    <div className="my-4 p-5 rounded-2xl border border-border bg-surface dark:bg-zinc-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xs bg-surface-3 dark:bg-zinc-800 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <FileText size={20} weight="bold" aria-hidden="true" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Shareable dossier</div>
            <h4 className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 mt-0.5">
              {label || 'Dossier of this conversation'}
            </h4>
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
              Your questions, the answers, and the projects you looked at
            </p>
          </div>
        </div>

        {copied && (
          <div role="status" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[12px] font-medium animate-in fade-in duration-150 self-start sm:self-auto">
            <CheckCircle size={14} weight="fill" aria-hidden="true" />
            <span>Link copied</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 pt-4">
        <button type="button" onClick={handleOpen} className={`${btn} bg-primary hover:bg-primary-dark text-white`}>
          <span>Open summary</span>
          <ArrowSquareOut size={14} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className={`${btn} border border-border bg-surface dark:bg-zinc-800 hover:bg-surface-3 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100`}
        >
          {copied ? <Check size={14} weight="bold" className="text-emerald-600" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          <span>{copied ? 'Link copied' : 'Copy share link'}</span>
        </button>

        <button
          type="button"
          onClick={handleWhatsApp}
          className={`${btn} border border-border bg-surface dark:bg-zinc-800 hover:bg-surface-3 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 sm:ml-auto`}
        >
          <ShareNetwork size={14} aria-hidden="true" />
          <span>Share to WhatsApp</span>
        </button>
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-border text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
        <LockSimple size={12} aria-hidden="true" />
        <span>Anyone with the link can view it, no login needed · Prints as a PDF</span>
      </div>
    </div>
  )
}

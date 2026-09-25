'use client'

import React, { useState } from 'react'
import {
  FileText,
  ExternalLink,
  Copy,
  Check,
  Share2,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'

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

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setCopied(true)
        onToast?.('Link copied! You can share it with your family now.')
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
    if (typeof window !== 'undefined') {
      window.open(href, '_blank', 'noopener,noreferrer')
    }
  }

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const fullUrl = getFullUrl()
    const text = `🏡 *PropFyndr Family Deal Dossier*\n\nHere is our due-diligence memo, ground-reality checks, and financial outflow breakdown:\n👉 ${fullUrl}`
    if (typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    }
  }

  return (
    <div className="my-4 p-5 rounded-2xl border border-[#e5e5ea] dark:border-[#2c2c2e] bg-white dark:bg-[#1c1c1e] shadow-sm hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e5e5ea] dark:border-[#2c2c2e]">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#0066cc]/10 dark:bg-[#2997ff]/15 text-[#0066cc] dark:text-[#2997ff] flex items-center justify-center shrink-0 mt-0.5">
            <FileText size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#0066cc] dark:text-[#2997ff]">
              <ShieldCheck size={13} strokeWidth={2.5} />
              <span>Verified Family Deal Dossier</span>
            </div>
            <h4 className="text-[16px] font-semibold text-[#1d1d1f] dark:text-[#f5f5f7] tracking-tight mt-0.5">
              {label || 'Family Consultation Briefing Memo'}
            </h4>
            <p className="text-[13px] text-[#86868b] mt-0.5 leading-snug">
              Executive consultation trail, trade-off matrix, and verified landed costs
            </p>
          </div>
        </div>

        {/* Copy Status Pill */}
        {copied && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#34c759]/15 text-[#248a3d] dark:text-[#30d158] text-[12px] font-semibold animate-in fade-in zoom-in-95 duration-200 self-start sm:self-auto">
            <CheckCircle2 size={14} className="text-[#34c759]" strokeWidth={2.5} />
            <span>Link copied, and you can share it now!</span>
          </div>
        )}
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center gap-2.5 pt-4">
        <button
          type="button"
          onClick={handleOpen}
          className="px-4 py-2 rounded-xl bg-[#0066cc] hover:bg-[#0071e3] active:scale-[0.98] text-white font-medium text-[13px] flex items-center gap-2 transition-all shadow-sm cursor-pointer"
        >
          <span>Open Dossier Memo</span>
          <ExternalLink size={14} />
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className={`px-3.5 py-2 rounded-xl border text-[13px] font-medium flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
            copied
              ? 'bg-[#34c759]/10 text-[#248a3d] dark:text-[#30d158] border-[#34c759]/30'
              : 'bg-[#f5f5f7] dark:bg-[#2c2c2e] hover:bg-[#e5e5ea] dark:hover:bg-[#3a3a3c] text-[#1d1d1f] dark:text-[#f5f5f7] border-[#e5e5ea] dark:border-[#3a3a3c]'
          }`}
        >
          {copied ? <Check size={14} className="text-[#34c759]" strokeWidth={2.5} /> : <Copy size={14} />}
          <span>{copied ? 'Link Copied!' : 'Copy Share Link'}</span>
        </button>

        <button
          type="button"
          onClick={handleWhatsApp}
          className="px-3.5 py-2 rounded-xl bg-[#34c759] hover:bg-[#30d158] active:scale-[0.98] text-white font-medium text-[13px] flex items-center gap-2 transition-all shadow-sm cursor-pointer sm:ml-auto"
        >
          <Share2 size={14} />
          <span>Share to WhatsApp</span>
        </button>
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-[#f5f5f7] dark:border-[#2c2c2e] text-[11px] text-[#86868b] flex items-center gap-1.5">
        <span>🔒 Zero login required for family &bull; Formats into executive A4 PDF on print</span>
      </div>
    </div>
  )
}

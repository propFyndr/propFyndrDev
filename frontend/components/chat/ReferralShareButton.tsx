'use client'

import { useEffect, useRef, useState } from 'react'
import { ShareNetwork, ChatCircleText, Copy, Check } from '@phosphor-icons/react'
import { getStoredReferralCode } from '@/lib/referral'

/**
 * Always-visible "Share PropFyndr" entry point, separate from the dossier
 * share button (which only appears once a dossier exists for this session).
 * Every channel appends ?r=<this device's own code>&c=<channel>, so the
 * person who opens it is attributed to this device in the referral tree.
 */
export function ReferralShareButton() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function shareUrl(channel: string): string {
    const code = getStoredReferralCode()
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const params = new URLSearchParams()
    if (code) params.set('r', code)
    params.set('c', channel)
    return `${base}/?${params.toString()}`
  }

  const handleWhatsApp = () => {
    const text = `Check out PropFyndr — an AI property advisor for Noida:\n${shareUrl('wa')}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
    setOpen(false)
  }

  const handleSms = () => {
    const text = `Check out PropFyndr: ${shareUrl('sms')}`
    window.open(`sms:?&body=${encodeURIComponent(text)}`, '_blank')
    setOpen(false)
  }

  const handleCopy = () => {
    const url = shareUrl('copy')
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }).catch(() => {})
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center gap-1.5 h-10 px-3 sm:px-3.5 rounded-full bg-surface/90 dark:bg-surface-2/90 backdrop-blur-md border border-border-heavy hover:bg-surface-3 dark:hover:bg-zinc-800 text-text-primary text-[13px] font-medium transition-colors cursor-pointer active:scale-95"
        title="Share PropFyndr"
        aria-label="Share PropFyndr"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ShareNetwork size={18} weight="bold" className="text-text-secondary" />
        <span className="hidden sm:inline">Share PropFyndr</span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Share PropFyndr"
          className="absolute top-full right-0 mt-1.5 w-56 bg-surface dark:bg-surface-2 rounded-sm shadow-md border border-border-heavy overflow-hidden p-1 animate-in fade-in zoom-in-95 duration-100 z-50"
        >
          <button role="menuitem" onClick={handleWhatsApp} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs text-[13px] text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer">
            <ShareNetwork size={15} weight="bold" className="text-text-muted" />
            <span>WhatsApp</span>
          </button>
          <button role="menuitem" onClick={handleSms} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs text-[13px] text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer">
            <ChatCircleText size={15} weight="bold" className="text-text-muted" />
            <span>SMS</span>
          </button>
          <button role="menuitem" onClick={handleCopy} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xs text-[13px] text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 outline-none transition-colors cursor-pointer">
            {copied ? <Check size={15} weight="bold" className="text-emerald-600" /> : <Copy size={15} weight="bold" className="text-text-muted" />}
            <span>{copied ? 'Link copied' : 'Copy link'}</span>
          </button>
        </div>
      )}
    </div>
  )
}

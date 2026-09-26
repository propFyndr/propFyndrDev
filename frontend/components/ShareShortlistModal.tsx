'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'framer-motion';
import type { ProjectCard } from '@/types/project';
import { API_BASE } from '@/lib/env';

interface ShareShortlistModalProps {
  isOpen: boolean;
  shortlist: ProjectCard[];
  onClose: () => void;
}

export default function ShareShortlistModal({ isOpen, shortlist, onClose }: ShareShortlistModalProps) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  if (!isOpen || shortlist.length === 0) return null;

  const shortlistText = `🏠 My PropFyndr Shortlist\n\n` +
    shortlist.map((p, i) => `${i + 1}. ${p.name} — ${p.price_range_label ?? 'Price on request'} (${p.sector ?? 'Noida'})`).join('\n') +
    `\n\nResearched with PropFyndr AI`;

  const handleShare = async () => {
    if (sharing || shareUrl) return;
    setSharing(true);
    try {
      const res = await fetch(`${API_BASE}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectSlugs: shortlist.map(p => p.slug),
        }),
      });
      if (!res.ok) throw new Error('Failed to create share');
      const { url } = await res.json();
      const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
      setShareUrl(fullUrl);
      return fullUrl;
    } catch (err) {
      console.error('Share failed:', err);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    const url = shareUrl || (await handleShare());
    if (!url) return;
    navigator.clipboard.writeText(`Check out this property shortlist from PropFyndr AI:\n${url}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => { /* clipboard blocked */ });
  };

  return (
    <AnimatePresence mode="wait">
      <m.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
        onClick={(e) => { if (e.target === e.currentTarget) { onClose(); setCopied(false) } }}
      >
        <m.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-gray-900 shadow-2xl p-6 pb-safe"
        >
          <div className="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-5 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">Share Shortlist</h3>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none transition-colors">×</button>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4 border border-gray-100 dark:border-gray-700 text-[12px] text-gray-600 dark:text-gray-300 font-mono leading-relaxed">
            <div className="font-bold text-gray-800 dark:text-gray-100 mb-1">🏠 My PropFyndr Shortlist</div>
            {shortlist.map((p, i) => (
              <div key={p.id}>{i + 1}. {p.name} — {p.price_range_label ?? 'Price on request'} ({p.sector ?? 'Noida'})</div>
            ))}
            <div className="mt-2 text-gray-400 text-[11px]">Researched with PropFyndr AI</div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleCopyLink}
              disabled={sharing}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-400 text-white font-bold rounded-xl transition-colors text-sm"
            >
              {copied ? '✅ Link Copied!' : sharing ? '⏳ Creating link...' : '🔗 Copy Share Link'}
            </button>
            {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && shareUrl && (
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Check out this property shortlist from PropFyndr AI:\n${shareUrl}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3.5 bg-[#25D366] hover:bg-[#1da851] text-white font-bold rounded-xl text-sm transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421-7.403h-.004a9.87 9.87 0 00-4.867 1.215l-.346.215-3.583.94 1.021-3.697-.239-.374A9.86 9.86 0 1112.051 2c2.576 0 5.092.756 7.178 2.189m10.899 10.762h-.002c0 5.338-4.226 9.864-9.564 9.864a9.865 9.865 0 01-4.7-1.256l-.337-.2-3.494.917.959-3.61-.233-.374a9.865 9.865 0 013.48-15.396c1.579-.313 3.228-.313 4.807 0 5.338 0 9.864 4.226 9.864 9.565" />
                </svg>
                Share on WhatsApp
              </a>
            )}
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}

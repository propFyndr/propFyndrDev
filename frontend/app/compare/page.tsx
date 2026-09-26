'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {  m  } from 'framer-motion';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { track } from '@/lib/analytics';
import { GitCompare, ArrowRight } from 'lucide-react';

const COMPARE_SUGGESTIONS = [
  'Compare ATS Kingston Heath vs Godrej Palm Retreat',
  'Which is better — Sector 150 or Sector 137?',
  'Mahagun Mywoods vs Supertech Supernova — which has better amenities?',
];

import { getOrCreateGuestToken } from '@/lib/guestToken';

export default function ComparePage() {
  const router = useRouter();

  // This feature is not yet implemented. Redirect to discovery.
  useEffect(() => {
    router.replace('/discover');
  }, [router]);

  const [userId, setUserId] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedUserId = localStorage.getItem('user_id');
    setUserId(storedUserId);
    if (!storedUserId) setGuestToken(getOrCreateGuestToken());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    track('comparison_used', { suggestion_count: COMPARE_SUGGESTIONS.length });
  }, [ready]);

  if (!ready) return null;

  return (
    <div className="flex h-[100dvh] bg-[#E6E6E6] overflow-hidden">
      <Sidebar userId={userId} guestToken={guestToken} />

      <main className="flex-1 h-full flex flex-col min-h-0 overflow-hidden">
        <m.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <Header title="Compare Properties" onToast={() => {}} />
          <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
              <GitCompare size={32} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Compare via AI</h2>
              <p className="text-gray-500 max-w-sm">
                Ask PropFyndr to compare any two projects — it cross-references RERA data, pricing, amenities, and connectivity in one response.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 max-w-md w-full text-left shadow-sm">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">Try asking</p>
              <div className="space-y-2">
                {COMPARE_SUGGESTIONS.map((q) => (

                  <button
                    key={q}
                    onClick={() => {
                      sessionStorage.setItem('rp_prefill_chat', q);
                      router.push('/discover');
                    }}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 hover:bg-blue-50 hover:border-blue-200 border border-transparent text-sm text-gray-700 hover:text-blue-700 transition-all text-left group"
                  >
                    <span>{q}</span>
                    <ArrowRight size={14} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </m.div>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { getReEngagement } from '@/lib/backend-api';
import { toast } from 'sonner';
import { X } from 'lucide-react';

interface Props {
  userId?: string | null;
  guestToken?: string | null;
  onResume: (sessionId: string) => void;
  onDismiss: () => void;
}

export default function ReEngagementBanner({ userId, guestToken, onResume, onDismiss }: Props) {
  const hasFiredRef = useRef(false);
  const onResumeRef = useRef(onResume);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onResumeRef.current = onResume;
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if ((!userId && !guestToken) || hasFiredRef.current) return;
    hasFiredRef.current = true;
    
    let isMounted = true;
    
    getReEngagement(userId ?? undefined, guestToken ?? undefined).then(({ session }) => {
      if (!isMounted || !session) return;

      toast.custom((t) => (
        <div className="group relative flex items-center gap-4 px-5 py-3.5 bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] pointer-events-auto overflow-hidden animate-in fade-in zoom-in-95 duration-500 max-w-sm w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          
          <div className="relative flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse ring-4 ring-blue-500/20" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Previous Search</span>
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {session.title || 'This chat is getting long — starting a fresh one keeps my answers sharp. Your saved properties carry over.'}
            </p>
          </div>

          <div className="relative flex items-center gap-2">
            <button
              onClick={() => { toast.dismiss(t); onResumeRef.current(session.id); }}
              className="flex items-center justify-center h-8 px-3.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold rounded-lg transition-all shadow-sm hover:shadow active:scale-95"
            >
              Resume
            </button>
            <button
              onClick={() => { toast.dismiss(t); onDismissRef.current(); }}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      ), {
        duration: 5000,
        position: 'bottom-right',
        onAutoClose: () => onDismissRef.current(),
      });
    }).catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [userId, guestToken]);

  return null;
}

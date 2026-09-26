'use client';

import { useEffect, useRef } from 'react';
import { getReEngagement } from '@/lib/backend-api';
import { toast } from 'sonner';
import { X } from '@phosphor-icons/react';

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
        <div className="flex items-center gap-4 px-4 py-3 bg-surface dark:bg-surface-2 border border-border-heavy rounded-sm shadow-md pointer-events-auto max-w-sm w-full">
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <span className="text-[12px] text-text-muted">Previous search</span>
            <p className="text-[13px] font-medium text-text-primary truncate">
              {session.title || 'Continue your last search'}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => { toast.dismiss(t); onResumeRef.current(session.id); }}
              className="flex items-center justify-center h-9 px-3.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-[13px] font-semibold rounded-xs transition-colors"
            >
              Resume
            </button>
            <button
              onClick={() => { toast.dismiss(t); onDismissRef.current(); }}
              aria-label="Dismiss"
              className="flex items-center justify-center size-9 rounded-xs text-text-muted hover:text-text-primary hover:bg-surface-3 dark:hover:bg-zinc-800 transition-colors"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>
      ), {
        duration: 10000,
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

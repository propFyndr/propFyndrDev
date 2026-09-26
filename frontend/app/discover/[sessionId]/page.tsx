'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import DiscoveryContent from '@/components/DiscoveryContent';
import ChatErrorBoundary from '@/components/ChatErrorBoundary';
import UniversalLoader from '@/components/ui/universal-loader';
import { getSupabaseClient } from '@/lib/supabase';
import { migrateSessions } from '@/lib/backend-api';
import { getOrCreateGuestToken, clearGuestToken } from '@/lib/guestToken';

export default function SessionDiscoverPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId);
  // Starts false on server and client alike (reading window here caused a
  // hydration mismatch); tablet widths collapse once mounted.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches) {
      setIsSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const cachedId = localStorage.getItem('user_id');
    if (cachedId) {
      setUserId(cachedId);
      setReady(true);
    } else {
      const token = getOrCreateGuestToken();
      setGuestToken(token);
      setReady(true);
    }

    getSupabaseClient().then((supabase) => {
      if (cancelled) return;

      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const uid = data.session.user.id;
          localStorage.setItem('user_id', uid);
          setUserId(uid);
          setGuestToken(null);
        }
      }).catch(() => {});

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          const uid = session.user.id;
          const existingGuestToken = getOrCreateGuestToken();
          if (existingGuestToken) {
            migrateSessions(uid, existingGuestToken).catch(() => {}).finally(() => {
              clearGuestToken();
            });
          }
          localStorage.setItem('user_id', uid);
          setUserId(uid);
          setGuestToken(null);
        } else {
          localStorage.removeItem('user_id');
          setUserId(null);
          const token = getOrCreateGuestToken();
          setGuestToken(token);
        }
      });

      unsubscribe = () => listener.subscription.unsubscribe();
    });

    return () => { cancelled = true; unsubscribe?.(); };
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-transparent">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-transparent overflow-hidden no-overscroll">
      <Sidebar 
        userId={userId} 
        guestToken={guestToken} 
        activeSessionId={activeSessionId} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main id="main-content" className="flex-1 h-full flex flex-col min-h-0 overflow-hidden relative">
        <ChatErrorBoundary>
          <Suspense fallback={<div className="flex-1"><UniversalLoader variant="skeleton-page" label="Loading chat…" /></div>}>
            <DiscoveryContent
              key="discovery-content"
              initialSessionId={sessionId}
              userId={userId}
              guestToken={guestToken}
              onSessionChange={setActiveSessionId}
            />
          </Suspense>
        </ChatErrorBoundary>
      </main>
    </div>
  );
}

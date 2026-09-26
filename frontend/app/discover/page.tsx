'use client';

import { useState, useEffect, Suspense } from 'react';
import Sidebar from '@/components/Sidebar';
import DiscoveryContent from '@/components/DiscoveryContent';
import ChatErrorBoundary from '@/components/ChatErrorBoundary';
import { DiscoveryHomeSkeleton } from '@/components/skeletons';
import { getSupabaseClient } from '@/lib/supabase';
import { migrateSessions } from '@/lib/backend-api';
import { getOrCreateGuestToken, clearGuestToken } from '@/lib/guestToken';

export default function DiscoverPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // Starts false on server and client alike (reading window here caused a
  // hydration mismatch); tablet widths collapse once mounted.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [newChatNonce, setNewChatNonce] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches) {
      setIsSidebarCollapsed(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    try {
      const cachedId = localStorage.getItem('user_id');
      if (cachedId) {
        setUserId(cachedId);
        setReady(true);
      } else {
        const token = getOrCreateGuestToken();
        setGuestToken(token);
        setReady(true);
      }
    } catch (err) {
      console.warn('Storage access failed, initializing without tokens', err);
      setReady(true);
    }

    getSupabaseClient().then((supabase) => {
      if (cancelled) return;

      supabase.auth.getSession().then(({ data }) => {
        if (data.session?.user) {
          const uid = data.session.user.id;
          const existingGuestToken = getOrCreateGuestToken();
          if (existingGuestToken) {
            migrateSessions(uid, existingGuestToken).catch(() => {}).finally(() => {
              clearGuestToken();
            });
          }
          try { localStorage.setItem('user_id', uid); } catch {}
          setUserId(uid);
          setGuestToken(null);
        } else {
          try { localStorage.removeItem('user_id'); } catch {}
          setUserId(null);
          try {
            const token = getOrCreateGuestToken();
            setGuestToken(token);
          } catch {}
        }
      }).catch(console.error);

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const uid = session.user.id;
          const existingGuestToken = getOrCreateGuestToken();
          if (existingGuestToken) {
            migrateSessions(uid, existingGuestToken).catch(() => {}).finally(() => {
              clearGuestToken();
            });
          }
          try { localStorage.setItem('user_id', uid); } catch {}
          setUserId(uid);
          setGuestToken(null);
        } else {
          try { localStorage.removeItem('user_id'); } catch {}
          setUserId(null);
          try {
            const token = getOrCreateGuestToken();
            setGuestToken(token);
          } catch {}
        }
      });

      unsubscribe = () => listener.subscription.unsubscribe();
    }).catch(console.error);

    return () => { cancelled = true; unsubscribe?.(); };
  }, []);

  useEffect(() => {
    const h = () => setNewChatNonce(n => n + 1)
    window.addEventListener('propfyndr:new-chat', h)
    return () => window.removeEventListener('propfyndr:new-chat', h)
  }, []);

  if (!ready) {
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
          <DiscoveryHomeSkeleton />
        </main>
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
          <Suspense fallback={<DiscoveryHomeSkeleton />}>
            <DiscoveryContent
              key={`new-${newChatNonce}`}
              initialSessionId={null}
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

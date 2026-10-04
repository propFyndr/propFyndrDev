import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE } from '@/lib/env';
import { authHeaders } from '@/lib/authedFetch';
import { LOCAL_SESSION_CACHE } from '@/lib/sessionCache';

export interface Session {
  id: string;
  label: string;
  last_active: string;
}

export function useSessions(userId: string | null, guestToken?: string | null) {
  const [sessions, setSessions] = useState<Session[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('rp_sessions_v1');
        if (cached) return JSON.parse(cached);
      } catch {
        // ignore parse error
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fetchSessionsRef = useRef<((isRetry?: boolean) => Promise<void>) | null>(null);
  const mutationCountRef = useRef(0);

  const fetchSessions = useCallback(async (isRetry = false) => {
    if (!userId && !guestToken) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    // Only show full loading spinner if we don't have any cached sessions to display
    let hadCachedSessions = true;
    setSessions((prev) => {
      hadCachedSessions = prev.length > 0;
      return prev;
    });
    if (!hadCachedSessions) {
      setLoading(true);
    }
    setError(null);
    try {
      let url = `${API_BASE}/chat/session/list`;
      if (guestToken && !userId) url += `?guestToken=${encodeURIComponent(guestToken)}`;

      const res = await fetch(url, {
        headers: await authHeaders(),
        signal: abortControllerRef.current.signal,
      });
      if (res.status === 429) {
        // Under rate limit: keep cached sessions and do not immediately retry
        return;
      }
      if (!res.ok) throw new Error('Failed to load sessions');
      const data = await res.json();
      const list = data.sessions ?? [];
      setSessions(list);
      try {
        localStorage.setItem('rp_sessions_v1', JSON.stringify(list));
      } catch {
        // quota ignore
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        if (!isRetry) {
          // Retry once after 1.5s delay for transient dev server restarts
          setTimeout(() => {
            fetchSessionsRef.current?.(true);
          }, 1500);
        } else {
          setError((err as Error).message);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, guestToken]);

  // Keep ref in sync with latest fetchSessions
  fetchSessionsRef.current = fetchSessions;

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    const handleSessionUpdate = () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        // Skip refresh if mutations are in flight (optimistic updates in progress)
        if (mutationCountRef.current > 0) {
          return;
        }
        fetchSessionsRef.current?.();
      }, 300);
    };

    window.addEventListener('propfyndr:session-updated', handleSessionUpdate);
    return () => {
      window.removeEventListener('propfyndr:session-updated', handleSessionUpdate);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const deleteSession = async (sessionId: string) => {
    // Optimistic UI
    const previous = [...sessions];
    const updated = sessions.filter((x) => x.id !== sessionId);
    setSessions(updated);
    try {
      localStorage.setItem('rp_sessions_v1', JSON.stringify(updated));
    } catch {}
    LOCAL_SESSION_CACHE.delete(sessionId);

    mutationCountRef.current++;
    try {
      let url = `${API_BASE}/chat/session/${sessionId}`;
      if (guestToken && !userId) url += `?guestToken=${guestToken}`;

      const res = await fetch(url, {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete session');
    } catch (err) {
      setSessions(previous); // Rollback
      try {
        localStorage.setItem('rp_sessions_v1', JSON.stringify(previous));
      } catch {}
      throw err;
    } finally {
      mutationCountRef.current--;
    }
  };

  const renameSession = async (sessionId: string, title: string) => {
    // Optimistic UI
    const previous = [...sessions];
    const updated = sessions.map((x) => (x.id === sessionId ? { ...x, label: title } : x));
    setSessions(updated);
    try {
      localStorage.setItem('rp_sessions_v1', JSON.stringify(updated));
    } catch {}

    const cached = LOCAL_SESSION_CACHE.get(sessionId);
    if (cached) {
      cached.title = title;
      LOCAL_SESSION_CACHE.set(sessionId, cached);
    }

    mutationCountRef.current++;
    try {
      let url = `${API_BASE}/chat/session/${sessionId}`;
      if (guestToken && !userId) url += `?guestToken=${guestToken}`;

      const res = await fetch(url, {
        method: 'PATCH',
        headers: await authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Failed to rename session');
    } catch (err) {
      setSessions(previous); // Rollback
      try {
        localStorage.setItem('rp_sessions_v1', JSON.stringify(previous));
      } catch {}
      throw err;
    } finally {
      mutationCountRef.current--;
    }
  };

  return {
    sessions,
    loading,
    error,
    deleteSession,
    renameSession,
    refreshSessions: fetchSessions,
  };
}

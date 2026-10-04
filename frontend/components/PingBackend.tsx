'use client';
import { useEffect, useRef } from 'react';
import { API_BASE } from '@/lib/env';

export function PingBackend() {
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    // Same resolver as every other API call (the /api/v1 rewrite in the browser).
    const healthUrl = `${API_BASE}/health`;

    function ping() {
      // Hidden tabs don't keep the backend awake; the visibility ping covers their return.
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      // Throttle pings to at most once every 60 seconds
      if (now - lastPingRef.current < 60_000) return;
      lastPingRef.current = now;

      fetch(healthUrl, { cache: 'no-store' }).catch(() => {
        // Silently ignore ping errors
      });
    }

    // 1. Initial wake-up ping
    ping();

    // 2. Periodic keep-alive every 4 minutes while the tab is visible
    const interval = setInterval(ping, 4 * 60 * 1000);

    // 3. Pre-warm when user switches back to the tab
    document.addEventListener('visibilitychange', ping);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', ping);
    };
  }, []);

  return null;
}

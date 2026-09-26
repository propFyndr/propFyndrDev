'use client';

import { useEffect } from 'react';

export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ChunkLoadError = stale cache after deploy — auto-refresh
    if (error?.message?.includes('ChunkLoadError') || error?.message?.includes('Loading chunk')) {
      window.location.reload();
      return;
    }
    console.error('[discover-error]', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[100dvh] bg-background p-8">
      <div className="text-center space-y-4 max-w-md">
        <h2 className="text-[17px] font-semibold text-text-primary">Chat temporarily unavailable</h2>
        <p className="text-text-secondary text-[15px]">
          Something went wrong loading the chat. This usually fixes itself on refresh.
        </p>
        <button
          onClick={() => {
            if ('caches' in window) {
              caches.keys().then(names => names.forEach(name => caches.delete(name)));
            }
            reset();
          }}
          className="px-5 h-10 bg-primary hover:bg-primary-dark text-white rounded-full text-[15px] font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

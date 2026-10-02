'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunkReload';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Stale chunk after a deploy — one auto-refresh, then show the error
    if (isChunkLoadError(error) && reloadOnceForChunkError()) return;
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html>
      <body className="bg-black text-white flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 p-8">
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-gray-400 max-w-md">
            {error?.message?.includes('ChunkLoadError')
              ? 'A new version is available. Refreshing...'
              : 'An unexpected error occurred. Please try again.'}
          </p>
          <button
            onClick={() => {
              // Clear Next.js cache and retry
              if ('caches' in window) {
                caches.keys().then(names => names.forEach(name => caches.delete(name)));
              }
              reset();
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-full font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}

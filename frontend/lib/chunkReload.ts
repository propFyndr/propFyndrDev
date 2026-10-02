// A ChunkLoadError after a deploy means the tab holds an old build's chunk
// names. One hard reload fixes it. The guard is time-based, not a counter: a
// counter that is never reset means this tab can't recover from the next
// deploy, while a 30s window still stops a truly missing chunk from looping.
const KEY = 'chunk_reload_at'
const WINDOW_MS = 30_000

export function isChunkLoadError(error: Error | undefined): boolean {
  return error?.name === 'ChunkLoadError' || /ChunkLoadError|Loading chunk/.test(error?.message ?? '')
}

/** Reloads unless one was already tried in the last 30s. Returns whether it reloaded. */
export function reloadOnceForChunkError(): boolean {
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < WINDOW_MS) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    return false // storage blocked: no way to remember the attempt, so don't risk a loop
  }
  window.location.reload()
  return true
}

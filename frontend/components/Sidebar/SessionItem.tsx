import { useState, useRef, useEffect } from 'react';
import { Check, X, DotsThree } from '@phosphor-icons/react';
import Link from 'next/link';
import { Session } from '@/hooks/useSessions';
import { toast } from 'sonner';

// Dev-only navigation timing. Global PerformanceObserver instance — reused
// across all SessionItem clicks to avoid repeated creation.
let globalPerfObserver: PerformanceObserver | null = null;
function getOrCreateObserver(): PerformanceObserver {
  if (globalPerfObserver) return globalPerfObserver;
  globalPerfObserver = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const e = entry as PerformanceResourceTiming;
      if (e.name.includes('_rsc') || e.name.includes('discover')) {
        const nt = (window as any).__navTimings;
        if (nt && !nt.rscEnd) {
          nt.rscStart = e.startTime;
          nt.rscEnd = e.startTime + e.duration;
          if (process.env.NODE_ENV === 'development') {
            console.log(
              `[NAV] RSC fetch: start +${(e.startTime - nt.t0).toFixed(1)}ms` +
              ` | ttfb +${((e.startTime + (e as any).responseStart) - nt.t0).toFixed(1)}ms` +
              ` | duration ${e.duration.toFixed(1)}ms` +
              ` | end +${(nt.rscEnd - nt.t0).toFixed(1)}ms` +
              ` | url ${e.name.split('?')[0].split('/').slice(-2).join('/')}`
            );
          }
          globalPerfObserver?.disconnect();
          globalPerfObserver = null;
        }
      }
    }
  });
  return globalPerfObserver;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return '1d';
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60';
const TOUCH = 'size-8 [@media(pointer:coarse)]:size-11';

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, title: string) => Promise<void>;
  onClick: () => void;
}

export function SessionItem({ session, isActive, onDelete, onRename, onClick }: SessionItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.label);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUp, setMenuUp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Set when rename/delete-confirm closes so focus lands back on the row.
  const restoreFocus = useRef(false);
  // Blur commits a rename; Escape and the explicit buttons must not also trigger it.
  const renameSettled = useRef(false);

  useEffect(() => {
    if (isRenaming) {
      renameSettled.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    if (confirmDelete) cancelRef.current?.focus();
  }, [confirmDelete]);

  useEffect(() => {
    if (!isRenaming && !confirmDelete && restoreFocus.current) {
      restoreFocus.current = false;
      optionsRef.current?.focus();
    }
  }, [isRenaming, confirmDelete]);

  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !optionsRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const endRename = () => {
    renameSettled.current = true;
    restoreFocus.current = true;
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setRenameValue(session.label);
    endRename();
  };

  const submitRename = async () => {
    if (renameSettled.current) return;
    renameSettled.current = true;
    const title = renameValue.trim();
    if (!title || title === session.label) {
      setRenameValue(session.label);
      endRename();
      return;
    }

    setIsProcessing(true);
    try {
      await onRename(session.id, title);
    } catch {
      toast.error('Failed to rename chat');
      setRenameValue(session.label);
    } finally {
      setIsProcessing(false);
      endRename();
    }
  };

  const closeConfirm = () => {
    restoreFocus.current = true;
    setConfirmDelete(false);
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      await onDelete(session.id);
    } catch {
      toast.error('Failed to delete chat');
    } finally {
      setIsProcessing(false);
      closeConfirm();
    }
  };

  const openMenu = () => {
    const rect = optionsRef.current?.getBoundingClientRect();
    setMenuUp(!!rect && rect.bottom > window.innerHeight - 120);
    setMenuOpen((o) => !o);
  };

  if (isRenaming) {
    return (
      <div className="flex items-center gap-1 h-9 [@media(pointer:coarse)]:h-11 pl-2.5 pr-1 rounded-xs bg-surface border border-blue-500">
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={submitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitRename();
            if (e.key === 'Escape') cancelRename();
          }}
          disabled={isProcessing}
          aria-label="Chat name"
          className="flex-1 min-w-0 text-[13px] bg-transparent outline-none text-zinc-900 dark:text-zinc-100 disabled:opacity-50"
          maxLength={100}
        />
        {/* mousedown preventDefault keeps focus in the input so its blur
            doesn't commit before the button's own action runs. */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={submitRename}
          disabled={isProcessing}
          aria-label="Save name"
          className={`${TOUCH} flex items-center justify-center rounded-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-50 ${FOCUS}`}
        >
          <Check size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancelRename}
          disabled={isProcessing}
          aria-label="Cancel rename"
          className={`${TOUCH} flex items-center justify-center rounded-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50 ${FOCUS}`}
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div
        role="group"
        aria-label="Delete chat?"
        onKeyDown={(e) => { if (e.key === 'Escape') closeConfirm(); }}
        className="flex items-center justify-between gap-1.5 h-9 [@media(pointer:coarse)]:h-11 pl-2.5 pr-1 rounded-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60"
      >
        <span className="text-[13px] font-medium text-red-700 dark:text-red-400 truncate">Delete chat?</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isProcessing}
            className={`h-8 [@media(pointer:coarse)]:h-11 px-2.5 text-[11px] font-medium bg-red-600 hover:bg-red-700 text-white rounded-xs transition-colors disabled:opacity-50 ${FOCUS}`}
          >
            {isProcessing ? '…' : 'Delete'}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={closeConfirm}
            disabled={isProcessing}
            className={`h-8 [@media(pointer:coarse)]:h-11 px-2.5 text-[11px] font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 rounded-xs disabled:opacity-50 ${FOCUS}`}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Row is a div: the Link stretches over it via ::after, and the options
  // button sits beside it (raised above the overlay) rather than inside it.
  return (
    <div
      className={`group/session relative flex items-center h-9 [@media(pointer:coarse)]:h-11 rounded-xs transition-colors duration-150 ${
        isNavigating ? 'opacity-60' : ''
      } ${
        isActive
          ? 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-900 dark:text-zinc-50 font-medium'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-100'
      }`}
    >
      <Link
        href={`/discover/${session.id}`}
        aria-current={isActive ? 'page' : undefined}
        className="flex-1 min-w-0 h-full flex items-center pl-2.5 pr-1 outline-none after:absolute after:inset-0 after:rounded-xs focus-visible:after:ring-2 focus-visible:after:ring-blue-500/60"
        onClick={(e) => {
          if (isNavigating) {
            e.preventDefault();
            return;
          }

          setIsNavigating(true);
          if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
          navigationTimeoutRef.current = setTimeout(() => {
            setIsNavigating(false);
            navigationTimeoutRef.current = null;
          }, 1000);

          if (process.env.NODE_ENV !== 'production') {
            // [TIMING] mark sidebar click as t0
            ;(window as any).__navTimings = { t0: performance.now() }
            if (process.env.NODE_ENV === 'development') console.log('[NAV] 1. sidebar-click  t=0ms')

            if (typeof PerformanceObserver !== 'undefined') {
              try {
                getOrCreateObserver().observe({ type: 'resource', buffered: true })
              } catch { /* unsupported */ }
            }
          }

          onClick();
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (!isNavigating) setIsRenaming(true);
        }}
      >
        <span className="text-[13px] truncate">{session.label}</span>
      </Link>

      {/* Right Slot: fixed width, zero layout shift. Timestamp yields to the
          options button on hover, keyboard focus, or touch devices. */}
      <div className={`relative ${menuOpen ? 'z-30' : 'z-10'} w-12 h-full flex items-center justify-end shrink-0 pr-1`}>
        <span
          className={`text-[11px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400 absolute right-2 transition-opacity duration-150 group-hover/session:opacity-0 group-focus-within/session:opacity-0 [@media(hover:none)]:opacity-0 pointer-events-none ${menuOpen ? 'opacity-0' : ''}`}
        >
          {timeAgo(session.last_active)}
        </span>
        <button
          ref={optionsRef}
          type="button"
          onClick={openMenu}
          aria-label="Chat options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={`${TOUCH} flex items-center justify-center rounded-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-white/[0.08] transition-opacity duration-150 opacity-0 group-hover/session:opacity-100 group-focus-within/session:opacity-100 [@media(hover:none)]:opacity-100 ${menuOpen ? 'opacity-100' : ''} ${FOCUS}`}
        >
          <DotsThree size={16} />
        </button>
        {menuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Chat options"
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setMenuOpen(false); optionsRef.current?.focus(); }
            }}
            className={`absolute right-0 ${menuUp ? 'bottom-full mb-1' : 'top-full mt-1'} z-20 w-32 p-1 rounded-sm bg-surface border border-zinc-200/70 dark:border-white/[0.08] shadow-md`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); setIsRenaming(true); }}
              className={`w-full h-9 px-2.5 text-left text-[13px] font-normal rounded-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/[0.06] ${FOCUS}`}
            >
              Rename
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
              className={`w-full h-9 px-2.5 text-left text-[13px] font-normal rounded-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 ${FOCUS}`}
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

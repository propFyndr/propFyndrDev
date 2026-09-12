'use client';

import {
  BookmarkSimple,
  ArrowsLeftRight,
  SidebarSimple,
  SignOut,
  NotePencil,
  ClockCounterClockwise,
  List,
  Buildings,
  Handshake
} from '@phosphor-icons/react';
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ChatSidebarGroupedSkeleton } from "@/components/skeletons";
import { API_BASE } from "@/lib/env";
import { useSessions, Session } from "@/hooks/useSessions";
import { SessionItem } from "@/components/Sidebar/SessionItem";
import { authHeaders } from "@/lib/authedFetch";

type SidebarView =
  | "discovery"
  | "saved"
  | "compare"
  | "value-estimator"
  | "market-intelligence"
  | "lead-snapshot";

interface SidebarProps {
  activeView?: SidebarView;
  onViewChange?: (view: SidebarView) => void;
  userId: string | null;
  guestToken?: string | null;
  activeSessionId?: string | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

function groupSessionsByDate(
  sessions: Session[],
): { label: string; items: Session[] }[] {
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterday = today - 86400000;
  const sevenDaysAgo = today - 6 * 86400000;
  const thirtyDaysAgo = today - 29 * 86400000;

  const groups: Record<string, Session[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    Older: [],
  };

  for (const s of sessions) {
    const t = new Date(s.last_active).getTime();
    if (t >= today) groups["Today"].push(s);
    else if (t >= yesterday) groups["Yesterday"].push(s);
    else if (t >= sevenDaysAgo) groups["Previous 7 Days"].push(s);
    else if (t >= thirtyDaysAgo) groups["Previous 30 Days"].push(s);
    else groups["Older"].push(s);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export default function Sidebar({
  activeView: activeViewProp,
  onViewChange,
  userId,
  guestToken,
  activeSessionId,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [leadsToday, setLeadsToday] = useState<number | null>(null);
  const [userInitial, setUserInitial] = useState("U");
  const [isNavigating, setIsNavigating] = useState(false);
  // Saved projects power the counts beside Saved/Compare and the collapsed
  // rail's tray. Null means "not loaded yet" so a badge never flashes 0.
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [savedThumbs, setSavedThumbs] = useState<{ id: string; name: string; image?: string }[]>([]);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
    deleteSession,
    renameSession,
    refreshSessions,
  } = useSessions(userId, guestToken);

  useEffect(() => {
    if (!userId) return;
    authHeaders()
      .then((headers) => fetch(`${API_BASE}/leads/count`, { headers }))
      .then((r) => r.json())
      .then((d: { count: number }) => setLeadsToday(d.count ?? null))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    getSupabaseClient()
      .then((supabase) => supabase.auth.getUser())
      .then(({ data }) => {
        const name = data.user?.user_metadata?.full_name as string | undefined;
        const source = name || data.user?.email || "";
        if (source) setUserInitial(source.charAt(0).toUpperCase());
      })
      .catch(() => {});
  }, [userId]);

  const routeToView: Record<string, SidebarView> = {
    "/discover": "discovery",
    "/saved": "saved",
    "/compare": "compare",
    "/value-estimator": "value-estimator",
    "/market-intelligence": "market-intelligence",
    "/lead-snapshot": "lead-snapshot",
  };
  const activeView =
    routeToView[pathname ?? ""] ?? activeViewProp ?? "discovery";

  const handleLogout = () => {
    localStorage.removeItem("user_id");
    getSupabaseClient()
      .then((supabase) => supabase.auth.signOut())
      .catch(() => {});
    router.replace("/auth");
  };

  useEffect(() => {
    if (!userId && !guestToken) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`${API_BASE}/saved`, { headers });
        if (!res.ok) return;
        const data = await res.json();
        const rows: Array<Record<string, unknown>> = Array.isArray(data) ? data : (data?.projects ?? []);
        if (cancelled) return;
        setSavedCount(rows.length);
        setSavedThumbs(
          rows.slice(0, 6).map(r => ({
            id: String(r.id ?? r.slug ?? ''),
            name: String(r.name ?? ''),
            image: typeof r.cover_image === 'string' ? r.cover_image : undefined,
          })),
        );
      } catch {
        // A count is decoration; never let it break the sidebar.
      }
    })();
    return () => { cancelled = true; };
  }, [userId, guestToken]);

  // "Property Discovery" was removed: it navigated to /discover, which is
  // exactly where the wordmark above and the New chat button already go. Three
  // controls, one destination — the menu read as padding rather than navigation.
  // Compare takes the freed slot; /compare and ComparisonTable already existed
  // and had simply never been reachable from the sidebar.
  const menuItems: { id: SidebarView; label: string; icon: React.ElementType; href: string; count?: number }[] = [
    { id: "saved", label: "Saved", icon: BookmarkSimple, href: "/saved", count: savedCount ?? undefined },
    { id: "compare", label: "Compare", icon: ArrowsLeftRight, href: "/compare", count: savedCount ?? undefined },
  ];

  useEffect(() => {
    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].screenX;
      if (touchEndX - touchStartX > 80 && touchStartX < 40) {
        setMobileOpen(true);
      } else if (touchStartX - touchEndX > 70) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const closeMobile = () => setMobileOpen(false);

  // Discovery link is always "/discover" — clicking it while already there should
  // force a fresh navigation instead of a no-op Link click.
  const handleMenuItemClick = (e: React.MouseEvent, itemId: string, href: string) => {
    if (pathname === href && itemId === 'discovery') {
      e.preventDefault();
      router.push('/discover');
    }
  };
  const grouped = groupSessionsByDate(sessions);

  const handleFreshDiscovery = (e: React.MouseEvent) => {
    e.preventDefault();
    closeMobile();
    onViewChange?.('discovery');
    window.dispatchEvent(new CustomEvent('propfyndr:new-chat'));
    router.push('/discover');
  };

  // Shared by the expanded and collapsed New Chat buttons.
  const startNewChat = useCallback(() => {
    if (isNavigating) return;
    setIsNavigating(true);
    if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
    closeMobile();
    navigationTimeoutRef.current = setTimeout(() => setIsNavigating(false), 1000);
    window.dispatchEvent(new CustomEvent('propfyndr:new-chat'));
    router.push('/discover');
  }, [isNavigating, router]);

  // The button advertises Ctrl+N; without this the shortcut just opened a new
  // browser window. Ctrl+K (focus input) is owned by DiscoveryContent.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startNewChat]);

  // Otherwise a pending navigation timer fires setState on an unmounted sidebar.
  useEffect(() => () => {
    if (navigationTimeoutRef.current) clearTimeout(navigationTimeoutRef.current);
  }, []);

  return (
    <>
      {/* Mobile Sidebar Button */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed top-2.5 sm:top-3 left-3 z-[65] w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white active:scale-95 transition-all cursor-pointer pointer-events-auto rounded-full bg-white/85 dark:bg-zinc-800/85 backdrop-blur-md border border-gray-200/70 dark:border-zinc-700/60 shadow-2xs hover:bg-white dark:hover:bg-zinc-700"
          aria-label="Open sidebar menu"
          title="Open menu"
        >
          <List size={22} weight="bold" />
        </button>
      )}

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          onClick={closeMobile}
        />
      )}

      <div
        className={`
        ${isCollapsed ? 'hidden md:flex w-[64px]' : 'w-[280px] sm:w-[300px] md:w-[260px]'} 
        text-gray-900 dark:text-gray-100 flex flex-col h-full border-r border-gray-200/80 dark:border-zinc-800/80 bg-white dark:bg-[#0c0d14]
        fixed md:relative z-[60] md:z-auto shrink-0 shadow-2xl md:shadow-none
        transition-all duration-300 ease-in-out overflow-hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
      >
        {/* Header: Expanded vs Collapsed */}
        {!isCollapsed ? (
          <div className="h-14 flex items-center justify-between border-b border-gray-100 dark:border-zinc-800/80 w-full px-4 shrink-0 bg-white dark:bg-[#0c0d14]">
            <Link
              href="/discover"
              onClick={handleFreshDiscovery}
              className="flex items-center transition-opacity hover:opacity-80 cursor-pointer"
              title="Start fresh discovery"
            >
              <Image src="/images/icons/logo-wordmark-black.png" alt="PropFyndr Logo" width={75} height={34} className="object-contain block dark:hidden" priority />
              <Image src="/images/icons/logo-wordmark-white.png" alt="PropFyndr Logo" width={75} height={34} className="object-contain hidden dark:block" priority />
            </Link>
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) closeMobile();
                else onToggleCollapse?.();
              }}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <SidebarSimple size={19} weight="bold" />
            </button>
          </div>
        ) : (
          <div className="h-14 flex items-center justify-center border-b border-gray-100/60 dark:border-gray-800/60 w-full shrink-0 relative group">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all relative cursor-pointer"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              {/* Default PropFyndr Logo Mark */}
              <div className="flex items-center justify-center transition-opacity duration-200 group-hover:opacity-0 pointer-events-none">
                <Image
                  src="/images/icons/logo-square-black.png"
                  alt="PropFyndr Logo"
                  width={40}
                  height={40}
                  className="object-contain block dark:hidden"
                />
                <Image
                  src="/images/icons/logo-square-white.png"
                  alt="PropFyndr Logo"
                  width={40}
                  height={40}
                  className="object-contain hidden dark:block"
                />
              </div>

              {/* Hover Expand Icon */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 text-zinc-700 dark:text-zinc-200 transition-opacity duration-200 pointer-events-none">
                <SidebarSimple size={18} weight="bold" />
              </div>

              {/* Tooltip */}
              <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-zinc-900 text-white text-[11px] font-medium rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
                Expand sidebar
              </span>
            </button>
          </div>
        )}

        {/* New Chat Button */}
        {!isCollapsed ? (
          <div className="p-3 w-full shrink-0">
            <button
              type="button"
              onClick={startNewChat}
              disabled={isNavigating}
              className="group flex items-center justify-between w-full py-2 px-3 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold rounded-xl transition-all duration-150 border border-zinc-200/80 dark:border-zinc-700/60 shadow-2xs active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 flex items-center justify-center rounded-md text-blue-600 dark:text-blue-400">
                  <NotePencil size={18} weight="duotone" />
                </div>
                <span className="text-[12.5px] tracking-tight">{isNavigating ? 'Opening...' : 'New chat'}</span>
              </div>
              <kbd className="inline-flex items-center justify-center h-4.5 px-1.5 text-[9.5px] font-mono text-zinc-400 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-md border border-zinc-200 dark:border-zinc-700/80 shadow-2xs">
                Ctrl + N
              </kbd>
            </button>
          </div>
        ) : (
          <div className="px-3 py-3 w-full shrink-0 flex justify-center">
            <button
              type="button"
              onClick={startNewChat}
              disabled={isNavigating}
              className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shadow-xs transition-all hover:opacity-90 active:scale-95 group relative disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="New chat"
            >
              <NotePencil size={18} weight="bold" />
              <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-zinc-900 text-white text-[11px] font-medium rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
                New chat
              </span>
            </button>
          </div>
        )}
        
        {/* Menu Section */}
        {!isCollapsed ? (
          <div className="w-full shrink-0 px-3 pb-3">
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5 px-2 font-bold">Menu</div>
            <div className="space-y-1 w-full">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    prefetch={true}
                    onClick={(e) => {
                      handleMenuItemClick(e, item.id, item.href);
                      closeMobile();
                      onViewChange?.(item.id);
                    }}
                    className={`flex items-center w-full gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 ${
                      isActive
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 font-semibold shadow-2xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-white font-medium'
                    }`}
                  >
                    <Icon size={16} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'text-white dark:text-zinc-900' : 'text-zinc-500 dark:text-zinc-400'} />
                    <span className="text-[12.5px] tracking-tight">{item.label}</span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className={`ml-auto text-[10.5px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-white/20 text-white dark:bg-zinc-900/15 dark:text-zinc-900'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="px-3 space-y-1.5 w-full flex flex-col items-center">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={true}
                  onClick={(e) => {
                    handleMenuItemClick(e, item.id, item.href);
                    closeMobile();
                    onViewChange?.(item.id);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs'
                      : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-blue-600 text-white text-[9.5px] font-bold tabular-nums leading-none ring-2 ring-white dark:ring-zinc-950">
                      {item.count > 9 ? '9+' : item.count}
                    </span>
                  )}
                  <span className="absolute left-full ml-2.5 px-2.5 py-1 bg-zinc-900 text-white text-[11px] font-medium rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Compare tray — collapsed rail only.
            Collapsed, the rail was the expanded menu with the words removed:
            the same two icons and nothing else, so collapsing bought space and
            gave nothing back. These are the buyer's saved projects, the set
            /compare actually operates on, so the rail becomes a way in rather
            than a smaller copy of the menu. */}
        {isCollapsed && savedThumbs.length > 0 && (
          <div className="px-3 mt-2 pt-2.5 w-full flex flex-col items-center gap-1.5 border-t border-zinc-200/70 dark:border-zinc-800/70">
            {savedThumbs.map((t) => (
              <Link
                key={t.id}
                href={`/compare?ids=${encodeURIComponent(t.id)}`}
                prefetch={false}
                onClick={closeMobile}
                title={t.name}
                aria-label={`Compare ${t.name}`}
                className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200/70 dark:ring-zinc-700/70 hover:ring-blue-500 transition-all group relative shrink-0"
              >
                {t.image ? (
                  <Image src={t.image} alt="" width={36} height={36} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
                    {t.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-zinc-900 text-white text-[11px] font-medium rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
                  {t.name}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Recent Chats Section (Only in Expanded mode) */}
        {!isCollapsed && (userId || guestToken) && (
          <>
            <div className="w-full shrink-0 px-3 pb-1.5 pt-1">
              <div className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest px-2 font-bold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ClockCounterClockwise size={13} weight="bold" />
                  <span>Recent</span>
                </div>
                {sessions.length > 0 && (
                  <span className="text-[9px] normal-case font-normal text-zinc-400 dark:text-zinc-500">
                    double-click to edit
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto w-full px-3 transition-opacity duration-300">
              <div className="mb-6">
                {sessionsLoading ? (
                  <ChatSidebarGroupedSkeleton />
                ) : sessionsError ? (
                  <div className="px-3 py-2 text-[12px] text-gray-500 flex items-center justify-between">
                    <span>Couldn&apos;t load chats</span>
                    <button
                      onClick={() => refreshSessions()}
                      className="text-blue-500 hover:underline text-[11px] font-semibold ml-2"
                    >
                      Retry
                    </button>
                  </div>
                ) : grouped.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-gray-400 dark:text-gray-500 font-medium">
                    No chats yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {grouped.map(({ label: groupLabel, items }) => (
                      <div key={groupLabel}>
                        <div className="flex items-center justify-between px-2 mb-1">
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                            {groupLabel}
                          </span>
                          <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                            {items.length}
                          </span>
                        </div>
                        <div className="space-y-0.5">
                          {items.map((session) => (
                            <SessionItem
                              key={session.id}
                              session={session}
                              isActive={session.id === activeSessionId}
                              onDelete={deleteSession}
                              onRename={renameSession}
                              onClick={() => {
                                closeMobile();
                                router.push(`/discover/${session.id}`);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Lead banner */}
        {/* NOTE: leadsToday is an internal sales metric shown to any logged-in
            user regardless of role — needs a product decision on role-gating,
            not silently fixed here. */}
        {!isCollapsed && leadsToday !== null && leadsToday > 0 && (
          <div className="mt-auto mx-3 mb-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 flex items-center gap-2 whitespace-nowrap">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse flex-shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">{leadsToday} lead{leadsToday !== 1 ? 's' : ''} captured today</span>
          </div>
        )}

        {/* The two ways onto the supply side. Without these the registration
            pages existed but nothing on the site linked to them. */}
        {!isCollapsed && (
          <div className="px-3 pt-2 pb-1 shrink-0 w-full border-t border-gray-100/60 dark:border-gray-800/60">
            <Link
              href="/builder-register"
              onClick={closeMobile}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors font-medium text-[12.5px]"
            >
              <Buildings size={16} weight="duotone" className="shrink-0" />
              <span className="tracking-tight">List your project</span>
            </Link>
            <Link
              href="/partner-register"
              onClick={closeMobile}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors font-medium text-[12.5px]"
            >
              <Handshake size={16} weight="duotone" className="shrink-0" />
              <span className="tracking-tight">Partner with us</span>
            </Link>
          </div>
        )}

        {/* Footer: User / Auth */}
        {!isCollapsed ? (
          <div className="p-3 border-t border-gray-100/60 dark:border-gray-800/60 shrink-0 w-full">
            {userId ? (
              /* Two sibling buttons, not a clickable icon nested inside a button:
                 the old form made sign-out mouse-only and unreachable by keyboard. */
              <div className="w-full flex items-center gap-1 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
                <button
                  type="button"
                  onClick={() => { router.push('/account'); closeMobile(); }}
                  className="flex-1 min-w-0 flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-colors cursor-pointer"
                >
                  <div className="w-8 h-8 flex items-center justify-center shrink-0 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-semibold text-sm">
                    {userInitial}
                  </div>
                  <span className="text-[12.5px] font-medium tracking-tight text-zinc-700 dark:text-zinc-200 truncate">My Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => { handleLogout(); closeMobile(); }}
                  title="Sign out"
                  aria-label="Sign out"
                  className="shrink-0 w-8 h-8 mr-1 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                >
                  <SignOut size={16} weight="bold" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { router.push('/auth'); closeMobile(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors font-medium text-[12.5px] cursor-pointer"
              >
                <SignOut size={16} weight="bold" className="shrink-0 rotate-180" />
                <span className="tracking-tight">Sign in</span>
              </button>
            )}
          </div>
        ) : (
          <div className="mt-auto p-3 border-t border-gray-100/60 dark:border-gray-800/60 shrink-0 w-full flex justify-center">
            {userId ? (
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => { router.push('/account'); closeMobile(); }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer"
                >
                  {userInitial}
                </button>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 bg-zinc-900 text-white text-[11px] font-medium rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
                  My Account
                </div>
              </div>
            ) : (
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => { router.push('/auth'); closeMobile(); }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                  aria-label="Sign in"
                >
                  <SignOut size={18} weight="bold" className="rotate-180" />
                </button>
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1 bg-zinc-900 text-white text-[11px] font-medium rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]">
                  Sign in
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

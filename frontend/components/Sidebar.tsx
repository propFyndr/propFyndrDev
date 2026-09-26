'use client';

import {
  BookmarkSimple,
  ArrowsLeftRight,
  SidebarSimple,
  SignOut,
  NotePencil,
  List,
  Buildings,
  CaretDown
} from '@phosphor-icons/react';
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";
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

// Collapsed-rail tooltip. Lives inside the control it labels (which carries
// `group`) so keyboard focus reveals it as well as hover.
const TOOLTIP =
  "absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2 py-1 bg-zinc-900 text-white text-[11px] font-medium rounded-xs shadow-md opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100]";

// One selected recipe for menu items and sessions alike.
const ROW_ACTIVE = "bg-zinc-100 dark:bg-white/[0.06] text-zinc-900 dark:text-zinc-50 font-medium";
const ROW_IDLE = "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100/70 dark:hover:bg-white/[0.04] hover:text-zinc-900 dark:hover:text-zinc-100";
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60";
const LABEL = "px-2.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400";
const EDGE = "border-zinc-200/70 dark:border-white/[0.06]";

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
    if (isNaN(t)) continue;
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
  // Both start false so server and client render the same tree; the real
  // values arrive in an effect. Collapse is a desktop idea only — below md the
  // sidebar is always a drawer, whatever the parent's collapsed flag says.
  const [isMdUp, setIsMdUp] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const collapsed = !!isCollapsed && isMdUp;
  const isDrawer = !isMdUp;

  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
    deleteSession,
    renameSession,
    refreshSessions,
  } = useSessions(userId, guestToken);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setIsMdUp(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    return () => mq.removeEventListener('change', sync);
  }, []);

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

  // Edge swipe opens the drawer. Only a touch that starts in the leftmost 24px
  // counts, so horizontal carousels in the page never open the menu.
  useEffect(() => {
    if (!isDrawer) return;
    let startX = -1;
    const onStart = (e: TouchEvent) => { startX = e.changedTouches[0].clientX; };
    const onEnd = (e: TouchEvent) => {
      if (startX >= 0 && startX < 24 && e.changedTouches[0].clientX - startX > 80) setMobileOpen(true);
      startX = -1;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [isDrawer]);

  // Swipe-to-close is scoped to the drawer itself.
  const swipeStartX = useRef(0);
  const onDrawerTouchStart = (e: React.TouchEvent) => { swipeStartX.current = e.changedTouches[0].clientX; };
  const onDrawerTouchEnd = (e: React.TouchEvent) => {
    if (isDrawer && swipeStartX.current - e.changedTouches[0].clientX > 70) setMobileOpen(false);
  };

  // A closed drawer is off-screen but still in the tab order unless inert.
  // Set via the DOM because React 18 does not know the attribute.
  const drawerClosed = isDrawer && !mobileOpen;
  useEffect(() => {
    drawerRef.current?.toggleAttribute('inert', drawerClosed);
  }, [drawerClosed]);

  // Open drawer behaves as a modal: Escape closes, focus moves in, and returns
  // to the hamburger on close.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!isDrawer) return;
    if (mobileOpen) {
      wasOpen.current = true;
      drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      // Next frame: the hamburger is still `invisible` (unfocusable) in this commit's styles.
      requestAnimationFrame(() => hamburgerRef.current?.focus());
    }
  }, [mobileOpen, isDrawer]);

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

  // Ctrl/⌘+Shift+O, as ChatGPT uses. Ctrl+N belongs to the browser (new
  // window) and cannot be reliably reclaimed. Ctrl+K (focus input) is owned by
  // DiscoveryContent.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
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
      {/* Mobile Sidebar Button — stays mounted so focus can return to it. */}
      <button
        ref={hamburgerRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        className={`md:hidden fixed top-2.5 sm:top-3 left-3 z-[65] w-11 h-11 shrink-0 flex items-center justify-center text-zinc-800 dark:text-zinc-200 hover:text-black dark:hover:text-white active:scale-95 transition-all cursor-pointer rounded-full bg-white/85 dark:bg-zinc-800/85 backdrop-blur-md border border-zinc-200/70 dark:border-white/[0.08] shadow-xs hover:bg-white dark:hover:bg-zinc-700 ${FOCUS} ${mobileOpen ? 'invisible' : ''}`}
        aria-label="Open sidebar menu"
        aria-expanded={mobileOpen}
        title="Open menu"
      >
        <List size={20} />
      </button>

      <div
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={closeMobile}
      />

      <div
        ref={drawerRef}
        onTouchStart={onDrawerTouchStart}
        onTouchEnd={onDrawerTouchEnd}
        {...(isDrawer && mobileOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': 'Menu' } : {})}
        className={`
        w-[280px] sm:w-[300px] ${isCollapsed ? 'md:w-[64px]' : 'md:w-[260px]'}
        text-zinc-900 dark:text-zinc-100 flex flex-col h-full border-r ${EDGE} bg-surface
        fixed md:relative z-[60] md:z-20 shrink-0 md:shadow-none
        transition-[width,transform] duration-300 ease-[var(--ease-smooth)]
        ${collapsed ? 'overflow-visible' : 'overflow-hidden'}
        ${mobileOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}
      >
        {/* Header: Expanded vs Collapsed */}
        {!collapsed ? (
          <div className={`h-14 flex items-center justify-between border-b ${EDGE} w-full px-3 shrink-0`}>
            <Link
              href="/discover"
              onClick={handleFreshDiscovery}
              className={`flex items-center px-2.5 py-1 rounded-xs transition-opacity hover:opacity-80 cursor-pointer ${FOCUS}`}
              title="Start fresh discovery"
            >
              <Image src="/images/icons/logo-wordmark-black.png" alt="PropFyndr Logo" width={75} height={34} className="object-contain block dark:hidden" priority />
              <Image src="/images/icons/logo-wordmark-white.png" alt="PropFyndr Logo" width={75} height={34} className="object-contain hidden dark:block" priority />
            </Link>
            <button
              type="button"
              onClick={() => {
                if (isDrawer) closeMobile();
                else onToggleCollapse?.();
              }}
              className={`w-9 h-9 [@media(pointer:coarse)]:size-11 rounded-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center ${FOCUS}`}
              title={isDrawer ? "Close menu" : "Collapse sidebar"}
              aria-label={isDrawer ? "Close menu" : "Collapse sidebar"}
              aria-expanded={true}
            >
              <SidebarSimple size={18} />
            </button>
          </div>
        ) : (
          <div className={`h-14 flex items-center justify-center border-b ${EDGE} w-full shrink-0`}>
            <button
              type="button"
              onClick={onToggleCollapse}
              className={`w-10 h-10 flex items-center justify-center rounded-xs hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors relative cursor-pointer group ${FOCUS}`}
              aria-label="Expand sidebar"
              aria-expanded={false}
            >
              {/* Default PropFyndr Logo Mark */}
              <div className="flex items-center justify-center transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0 pointer-events-none">
                <Image
                  src="/images/icons/logo-square-black.png"
                  alt=""
                  width={40}
                  height={40}
                  className="object-contain block dark:hidden"
                />
                <Image
                  src="/images/icons/logo-square-white.png"
                  alt=""
                  width={40}
                  height={40}
                  className="object-contain hidden dark:block"
                />
              </div>

              {/* Hover Expand Icon */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 text-zinc-700 dark:text-zinc-200 transition-opacity duration-200 pointer-events-none">
                <SidebarSimple size={18} />
              </div>

              <span className={TOOLTIP}>Expand sidebar</span>
            </button>
          </div>
        )}

        {/* New Chat Button */}
        {!collapsed ? (
          <div className="px-3 pt-3 pb-2 w-full shrink-0">
            <button
              type="button"
              onClick={startNewChat}
              disabled={isNavigating}
              className={`flex items-center justify-between w-full h-9 px-2.5 rounded-xs text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${ROW_IDLE} ${FOCUS}`}
            >
              <span className="flex items-center gap-2.5">
                <NotePencil size={16} className="shrink-0" />
                <span>{isNavigating ? 'Opening…' : 'New chat'}</span>
              </span>
              {!isDrawer && (
                <kbd className="hidden [@media(pointer:fine)]:inline-flex items-center h-5 px-1.5 text-[11px] font-medium font-sans text-zinc-500 dark:text-zinc-400 rounded-xs border border-zinc-200 dark:border-white/[0.08]">
                  {isMac ? '⇧⌘O' : 'Ctrl+Shift+O'}
                </kbd>
              )}
            </button>
          </div>
        ) : (
          <div className="px-3 py-3 w-full shrink-0 flex justify-center">
            <button
              type="button"
              onClick={startNewChat}
              disabled={isNavigating}
              className={`w-10 h-10 rounded-xs bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center shadow-xs transition-opacity hover:opacity-90 active:scale-95 group relative disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${FOCUS}`}
            >
              <NotePencil size={18} />
              <span className={TOOLTIP}>New chat</span>
            </button>
          </div>
        )}

        {/* Menu Section */}
        <nav aria-label="Primary" className={collapsed ? "px-3 space-y-0.5 w-full flex flex-col items-center" : "w-full shrink-0 px-3 pb-3"}>
          {!collapsed && <div className={`${LABEL} mb-1`}>Menu</div>}
          <div className={collapsed ? "contents" : "space-y-0.5 w-full"}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              const onClick = (e: React.MouseEvent) => {
                handleMenuItemClick(e, item.id, item.href);
                closeMobile();
                onViewChange?.(item.id);
              };
              return !collapsed ? (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={true}
                  onClick={onClick}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center w-full h-9 gap-2.5 px-2.5 rounded-xs text-[13px] transition-colors ${isActive ? ROW_ACTIVE : ROW_IDLE} ${FOCUS}`}
                >
                  <Icon size={16} weight={isActive ? 'fill' : 'regular'} className="shrink-0" />
                  <span>{item.label}</span>
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="ml-auto text-[11px] font-medium tabular-nums text-zinc-500 dark:text-zinc-400">
                      {item.count}
                    </span>
                  )}
                </Link>
              ) : (
                <Link
                  key={item.id}
                  href={item.href}
                  prefetch={true}
                  onClick={onClick}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-10 h-10 rounded-xs flex items-center justify-center transition-colors group relative ${isActive ? ROW_ACTIVE : ROW_IDLE} ${FOCUS}`}
                >
                  <Icon size={18} weight={isActive ? 'fill' : 'regular'} />
                  {typeof item.count === 'number' && item.count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-semibold tabular-nums leading-none ring-2 ring-white dark:ring-zinc-950">
                      {item.count > 9 ? '9+' : item.count}
                    </span>
                  )}
                  <span className={TOOLTIP}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Compare tray — collapsed rail only.
            Collapsed, the rail was the expanded menu with the words removed:
            the same two icons and nothing else, so collapsing bought space and
            gave nothing back. These are the buyer's saved projects, the set
            /compare actually operates on, so the rail becomes a way in rather
            than a smaller copy of the menu. */}
        {collapsed && savedThumbs.length > 0 && (
          <div className={`px-3 mt-2 pt-2.5 w-full flex flex-col items-center gap-1.5 border-t ${EDGE}`}>
            {savedThumbs.map((t) => (
              <Link
                key={t.id}
                href={`/compare?ids=${encodeURIComponent(t.id)}`}
                prefetch={false}
                onClick={closeMobile}
                aria-label={`Compare ${t.name}`}
                className={`w-9 h-9 rounded-xs bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200/70 dark:ring-white/[0.08] hover:ring-blue-500 transition-shadow group relative shrink-0 ${FOCUS}`}
              >
                {t.image ? (
                  <Image src={t.image} alt="" width={36} height={36} className="w-full h-full object-cover rounded-xs" unoptimized />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                    {t.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className={TOOLTIP}>{t.name}</span>
              </Link>
            ))}
          </div>
        )}

        {/* Recent Chats Section (Only in Expanded mode) */}
        {!collapsed && (userId || guestToken) && (
          <nav aria-label="Chat history" className="flex-1 min-h-0 overflow-y-auto w-full px-3 pb-6">
            <div className={`${LABEL} pt-1 pb-1`}>Recent</div>
            {sessionsLoading ? (
              <ChatSidebarGroupedSkeleton />
            ) : sessionsError ? (
              <div className="px-2.5 py-2 text-[13px] text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
                <span>Couldn&apos;t load chats</span>
                <button
                  type="button"
                  onClick={() => refreshSessions()}
                  className={`rounded-xs px-2 h-7 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors ${FOCUS}`}
                >
                  Retry
                </button>
              </div>
            ) : grouped.length === 0 ? (
              <div className="px-2.5 py-2 space-y-1.5">
                <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Your conversations will appear here</p>
                <button
                  type="button"
                  onClick={startNewChat}
                  className={`-ml-2 rounded-xs px-2 h-7 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors ${FOCUS}`}
                >
                  Start a chat
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {grouped.map(({ label: groupLabel, items }) => (
                  <div key={groupLabel}>
                    <div className={`${LABEL} sticky top-0 z-20 bg-surface py-1`}>{groupLabel}</div>
                    <div className="space-y-0.5">
                      {items.map((session) => (
                        <SessionItem
                          key={session.id}
                          session={session}
                          isActive={session.id === activeSessionId}
                          onDelete={deleteSession}
                          onRename={renameSession}
                          onClick={closeMobile}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </nav>
        )}

        {/* Footer: one band — lead count, builder links, account. */}
        {!collapsed ? (
          <div className={`mt-auto px-3 py-2 border-t ${EDGE} shrink-0 w-full space-y-0.5`}>
            {/* NOTE: leadsToday is an internal sales metric shown to any logged-in
                user regardless of role — needs a product decision on role-gating,
                not silently fixed here. */}
            {leadsToday !== null && leadsToday > 0 && (
              <div className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                {leadsToday} lead{leadsToday !== 1 ? 's' : ''} captured today
              </div>
            )}

            {/* The two ways onto the supply side. Without these the registration
                pages existed but nothing on the site linked to them. */}
            <details className="group/builders">
              <summary className={`list-none [&::-webkit-details-marker]:hidden flex items-center justify-between h-9 px-2.5 rounded-xs text-[13px] cursor-pointer transition-colors ${ROW_IDLE} ${FOCUS}`}>
                <span className="flex items-center gap-2.5">
                  <Buildings size={16} className="shrink-0" />
                  For builders
                </span>
                <CaretDown size={12} className="transition-transform group-open/builders:rotate-180" />
              </summary>
              <div className="space-y-0.5 pt-0.5">
                <Link
                  href="/builder-register"
                  onClick={closeMobile}
                  className={`flex items-center gap-2.5 h-9 pl-9 pr-2.5 rounded-xs text-[13px] transition-colors ${ROW_IDLE} ${FOCUS}`}
                >
                  List your project
                </Link>
                <Link
                  href="/partner-register"
                  onClick={closeMobile}
                  className={`flex items-center gap-2.5 h-9 pl-9 pr-2.5 rounded-xs text-[13px] transition-colors ${ROW_IDLE} ${FOCUS}`}
                >
                  Partner with us
                </Link>
              </div>
            </details>

            {userId ? (
              /* Two sibling buttons, not a clickable icon nested inside a button:
                 the old form made sign-out mouse-only and unreachable by keyboard. */
              <div className="w-full flex items-center gap-1 rounded-xs hover:bg-zinc-100/70 dark:hover:bg-white/[0.04] transition-colors">
                <button
                  type="button"
                  onClick={() => { router.push('/account'); closeMobile(); }}
                  className={`flex-1 min-w-0 flex items-center gap-2.5 h-9 px-2.5 rounded-xs cursor-pointer ${FOCUS}`}
                >
                  <span className="w-6 h-6 flex items-center justify-center shrink-0 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-semibold text-[11px]">
                    {userInitial}
                  </span>
                  <span className="text-[13px] font-medium text-zinc-700 dark:text-zinc-200 truncate">My Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => { handleLogout(); closeMobile(); }}
                  title="Sign out"
                  aria-label="Sign out"
                  className={`shrink-0 w-8 h-8 [@media(pointer:coarse)]:size-11 flex items-center justify-center rounded-xs text-zinc-500 dark:text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer ${FOCUS}`}
                >
                  <SignOut size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { router.push('/auth'); closeMobile(); }}
                className={`w-full flex items-center gap-2.5 h-9 px-2.5 rounded-xs text-[13px] transition-colors cursor-pointer ${ROW_IDLE} ${FOCUS}`}
              >
                <SignOut size={16} className="shrink-0 rotate-180" />
                <span>Sign in</span>
              </button>
            )}
          </div>
        ) : (
          <div className={`mt-auto p-3 border-t ${EDGE} shrink-0 w-full flex justify-center`}>
            {userId ? (
              <button
                type="button"
                onClick={() => { router.push('/account'); closeMobile(); }}
                aria-label="My account"
                className={`group relative w-10 h-10 flex items-center justify-center rounded-xs bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer ${FOCUS}`}
              >
                {userInitial}
                <span className={TOOLTIP}>My Account</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { router.push('/auth'); closeMobile(); }}
                className={`group relative w-10 h-10 flex items-center justify-center rounded-xs transition-colors cursor-pointer ${ROW_IDLE} ${FOCUS}`}
                aria-label="Sign in"
              >
                <SignOut size={18} className="rotate-180" />
                <span className={TOOLTIP}>Sign in</span>
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

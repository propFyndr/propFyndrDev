'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, m } from 'framer-motion';
import dynamic from 'next/dynamic';
import { ChatMessage, NearbyExpansion } from '@/types/property';
import type { ProjectCard as ProjectCardType } from '@/types/project';
import Toast from '@/components/Toast';
import { API_BASE } from '@/lib/env'
import { track, trackSearch } from '@/lib/analytics';
import { streamChat as streamChatBackend } from '@/lib/backend-api'
import {
  applyStreamEvent,
  emptyStreamFallback,
  pickShortlist,
  shortlistKey,
  buildSmartTitle,
} from '@/lib/chat/streamReducer'
import { authHeaders } from '@/lib/authedFetch'
import { PlaceholdersAndVanishInput } from '@/components/ui/placeholders-and-vanish-input';
import MessageBubble, { buildPickerMessage } from '@/components/chat/MessageBubble';
import type { ChipPickerState } from '@/components/chat/types';
import CompareSelectorOverlay from '@/components/chat/CompareSelectorOverlay';
import {
  WarningCircle,
  CaretDown,
  Microphone,
  ChatCircleDots,
  PencilSimple,
  Trash,
  NotePencil,
  Scales,
  ArrowRight,
  ArrowUp,
  MapPin,
  ShieldCheck
} from '@phosphor-icons/react';
import { FilterDock } from '@/components/chat/FilterDock';
import { useSessions } from '@/hooks/useSessions';
import { LOCAL_SESSION_CACHE } from '@/lib/sessionCache';
import {
  restoreMessage,
  sortRestoredMessages,
  lastMessageWithResults,
  attachTrailingChips,
  type StoredMessage,
} from '@/lib/chat/sessionRestore';
import { ChatPhase2Skeleton } from '@/components/skeletons';

const DEBUG = process.env.NODE_ENV !== 'production'

/**
 * Height of the gradient that fades the conversation out behind the composer.
 *
 * Kept next to the class that paints it (`h-32 md:h-36`) because the padding
 * that clears it is computed from this number — the two drifting apart is how
 * the last message ends up under an opaque fade.
 *
 * The conversation clears whichever is taller, this or the composer island. The
 * fade is opaque at its foot, so content beneath it is invisible even when
 * nothing sits on top of it: chips cleared the input bar and were still washed
 * out.
 */
const BOTTOM_FADE_PX = 144
// A WELCOME_MESSAGE bubble used to be seeded here as chatHistory[0].
//
// It was never visible when it could have helped: until the buyer sends
// something, hasUserReplied is false and the hero screen renders instead — its
// own wordmark, placeholder and starter chips already introduce the product.
// The bubble only appeared AFTER the first message, as an "Ask me anything"
// greeting sitting above a question the buyer had already asked. An assistant
// introducing itself after you have spoken reads as broken, which is exactly
// how it looked.
//
// The chat now starts empty. The hero introduces; the first bubble is an answer.
import { useDropoffDetection, useEngagementTracking, usePromotionalTracking } from '@/hooks/useAnalyticsTracking';

// ── Dynamic imports — heavy components excluded from initial bundle ─────────
const SiteVisitScheduler = dynamic(() => import('@/components/SiteVisitScheduler'), { ssr: false })
const CallbackModal = dynamic(() => import('@/components/CallbackModal'), { ssr: false })
const ShareShortlistModal = dynamic(() => import('@/components/ShareShortlistModal'), { ssr: false })
const CalculatorPanel = dynamic(() => import('@/components/CalculatorPanel'), { ssr: false })
const ProjectDetailPanel = dynamic(() => import('@/components/ProjectDetailPanel'), { ssr: false })
const ThemeToggle = dynamic(() => import('@/components/ThemeToggle'), { ssr: false })
const ReEngagementBanner = dynamic(() => import('@/components/chat/ReEngagementBanner'), { ssr: false })
const HomeButtons = dynamic(() => import('@/components/HomeButtons'), { ssr: false })

function RateLimitBanner({ until, onExpire }: { until: number; onExpire: () => void }) {
  const [secsLeft, setSecsLeft] = useState(Math.ceil((until - Date.now()) / 1000));
  useEffect(() => {
    if (secsLeft <= 0) { onExpire(); return; }
    const t = setTimeout(() => setSecsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secsLeft, onExpire]);
  return (
    <div className="mx-4 mb-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center gap-3">
      <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
        Sending too fast — wait {secsLeft}s
      </span>
      <div className="ml-auto h-1.5 w-16 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-500 rounded-full transition-all duration-1000"
          style={{ width: `${(secsLeft / 60) * 100}%` }}
        />
      </div>
    </div>
  );
}

// [TIMING] Shape of the perf-timing bag stashed on window by SessionItem.tsx
interface NavTimings {
  t0: number;
  contentMounted?: number;
  rscEnd?: number;
  pageMounted?: number;
  propertyCardsLogged?: boolean;
  propertyCards?: number;
}

function getNavTimings(): NavTimings | undefined {
  return (window as unknown as { __navTimings?: NavTimings }).__navTimings;
}

// Minimal Web Speech API typings — not part of the standard DOM lib.
interface MinimalSpeechRecognitionResult {
  [index: number]: { transcript: string };
}
interface MinimalSpeechRecognitionEvent {
  results: ArrayLike<MinimalSpeechRecognitionResult>;
}
interface MinimalSpeechRecognitionErrorEvent {
  error: string;
}
interface MinimalSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: MinimalSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: MinimalSpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

interface DiscoveryContentProps {
  userId: string | null;
  guestToken?: string | null;
  onSessionChange?: (sessionId: string | null) => void;
  initialSessionId?: string | null;
}

export default function DiscoveryContent({ userId, guestToken, onSessionChange, initialSessionId }: DiscoveryContentProps) {
  const router = useRouter();
  const [chatInput, setChatInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('propfyndr_draft') ?? '';
  });
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [visibleCount, setVisibleCount] = useState(15);
  const [toast, setToast] = useState<{ message: string } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [restoreError, setRestoreError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [sessionTitle, setSessionTitle] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(typeof window !== 'undefined' ? navigator.onLine : true);
  const [chatTurnCount, setChatTurnCount] = useState(0);
  const [hasShownLengthWarning, setHasShownLengthWarning] = useState(false);
  const [showContextWarning, setShowContextWarning] = useState(false);
  const [chatPhase, setChatPhase] = useState<'DISCOVERY' | 'ADVISOR'>('DISCOVERY');
  const [sessionId, setSessionIdState] = useState<string | null>(initialSessionId ?? null);

  /**
   * The session id as of *right now*, not as of the last render.
   *
   * The backend returns the id it created on the `done` event of the first turn.
   * Sending read `sessionId` from React state, so a second message sent before
   * that state commit went out with `sessionId: undefined` — and the backend,
   * seeing no session, created a second one. The conversation silently split
   * across two rows, and half of it vanished on refresh.
   *
   * A ref is written synchronously, so the next send sees the id even if React
   * has not re-rendered yet.
   */
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);
  const setSessionId = useCallback((id: string | null) => {
    sessionIdRef.current = id;
    setSessionIdState(id);
  }, []);
  const [lastShortlist, setLastShortlist] = useState<ProjectCardType[]>([]);
  const [compareOverlayProperties, setCompareOverlayProperties] = useState<ProjectCardType[] | null>(null);
  const [currentIntent, setCurrentIntent] = useState<Record<string, unknown> | null>(null);
  const [conversationState, setConversationState] = useState<import('@/components/chat/types').ConversationState | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const loadedSessionIdRef = useRef<string | null | undefined>(undefined);

  // ChatGPT-style dynamic browser tab title updater
  useEffect(() => {
    const newTitle = (() => {
      if (sessionTitle && sessionTitle.trim()) {
        return `${sessionTitle.trim()} | PropFyndr`
      }
      const userMsg = chatHistory.find(m => m.type === 'user')?.content
      if (userMsg && userMsg.trim()) {
        const cleanMsg = userMsg.trim()
        const truncated = cleanMsg.length > 35 ? `${cleanMsg.slice(0, 35)}...` : cleanMsg
        return `${truncated} | PropFyndr`
      }
      return `AI Property Advisor | PropFyndr`
    })()
    if (document.title !== newTitle) {
      document.title = newTitle
    }
  }, [sessionTitle, chatHistory.length])

  const { deleteSession, renameSession } = useSessions(userId, guestToken);
  const [isRenamingHeader, setIsRenamingHeader] = useState(false);
  const [headerRenameValue, setHeaderRenameValue] = useState('');

  const handleStartRename = () => {
    setHeaderRenameValue(sessionTitle || 'New Chat');
    setIsRenamingHeader(true);
    setShowHeaderDropdown(false);
  };

  const submitHeaderRename = async () => {
    if (!sessionId || !headerRenameValue.trim() || headerRenameValue.trim() === sessionTitle) {
      setIsRenamingHeader(false);
      return;
    }
    const newTitle = headerRenameValue.trim();
    const oldTitle = sessionTitle;
    setSessionTitle(newTitle);
    setIsRenamingHeader(false);
    try {
      await renameSession(sessionId, newTitle);
      window.dispatchEvent(new Event('propfyndr:session-updated'));
    } catch {
      setSessionTitle(oldTitle);
      setToast({ message: 'Failed to rename session' });
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionId) return;
    try {
      await deleteSession(sessionId);
      window.dispatchEvent(new Event('propfyndr:session-updated'));
      router.push('/discover');
    } catch {
      setToast({ message: 'Failed to delete session' });
    }
    setShowHeaderDropdown(false);
  };

  const handleNewChat = useCallback(() => {
    window.dispatchEvent(new CustomEvent('propfyndr:new-chat'));
    router.push('/discover');
  }, [router]);

  // Notify parent of session changes for sidebar highlighting
  useEffect(() => { onSessionChange?.(sessionId) }, [sessionId, onSessionChange])

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Restore scroll position per session
  useEffect(() => {
    if (!sessionId || !chatContainerRef.current) return;
    const scrollKey = `scroll_pos_${sessionId}`;
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll) {
      chatContainerRef.current.scrollTop = parseInt(savedScroll, 10);
    }
  }, [sessionId]);

  // Persist scroll position. Coalesced into one write per frame: sessionStorage
  // is synchronous, and writing it on every scroll event janked the feed.
  const pendingScrollWrite = useRef<number | null>(null);
  const handleMessageScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (!sessionId || pendingScrollWrite.current !== null) return;
    pendingScrollWrite.current = requestAnimationFrame(() => {
      pendingScrollWrite.current = null;
      sessionStorage.setItem(`scroll_pos_${sessionId}`, scrollTop.toString());
    });
  };
  useEffect(() => () => {
    if (pendingScrollWrite.current !== null) cancelAnimationFrame(pendingScrollWrite.current);
  }, []);

  // Sync state to local session cache so switching chats is seamless
  useEffect(() => {
    if (!sessionId || chatHistory.length === 0) return;
    const cached = LOCAL_SESSION_CACHE.get(sessionId) || {};
    LOCAL_SESSION_CACHE.set(sessionId, {
      ...cached,
      session_id: sessionId,
      title: sessionTitle,
      chat_phase: chatPhase,
      last_intent: currentIntent,
      last_projects: lastShortlist,
      restored: chatHistory
    });
  }, [chatHistory, sessionId, sessionTitle, chatPhase, currentIntent, lastShortlist]);

  // ── Analytics hooks ──
  useDropoffDetection({ sessionId: sessionId || '' });
  const { recordEngagement } = useEngagementTracking({ sessionId: sessionId || 'pending' });
  usePromotionalTracking({
    sessionId: sessionId || 'pending',
    userId: userId || undefined,
    guestToken: guestToken || undefined
  });

  // Draft persistence — save input to localStorage, clear on submit (debounced to reduce writes)
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (chatInput) {
        localStorage.setItem('propfyndr_draft', chatInput);
      } else {
        localStorage.removeItem('propfyndr_draft');
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [chatInput]);
  const [detailProject, setDetailProject] = useState<ProjectCardType | null>(null);
  const openDetailProject = useCallback((project: ProjectCardType | null) => {
    setDetailProject(project)
    if (project) {
      track('property_viewed', { project_slug: project.slug, project_name: project.name });
      recordEngagement(project.id);
    }
  }, [recordEngagement]);
  const [expandedShortlists, setExpandedShortlists] = useState<Set<string>>(new Set());
  const [comparingMessageId, setComparingMessageId] = useState<string | null>(null);
  const [selectedCompareProjects, setSelectedCompareProjects] = useState<Map<string, ProjectCardType>>(new Map());

  const handleStartCompare = useCallback((messageId: string, _properties: ProjectCardType[]) => {
    setComparingMessageId(messageId);
    setExpandedShortlists(prev => new Set(prev).add(messageId));
    setSelectedCompareProjects(new Map());
  }, []);

  const handleToggleCompareSelect = useCallback((_messageId: string, property: ProjectCardType) => {
    let hitLimit = false;
    setSelectedCompareProjects(prev => {
      const next = new Map(prev);
      const key = String(property.id || property.slug);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= 4) {
          // Flag it, don't setToast in here: StrictMode invokes the updater
          // twice, which fired the toast twice.
          hitLimit = true;
          return prev;
        }
        next.set(key, property);
      }
      return next;
    });
    if (hitLimit) setToast({ message: 'Maximum 4 properties can be compared at once.' });
  }, []);

  const handleCancelCompare = useCallback(() => {
    setComparingMessageId(null);
    setSelectedCompareProjects(new Map());
  }, []);

  const [showMap, setShowMap] = useState(false);
  const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);
  const headerDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (headerDropdownRef.current && !headerDropdownRef.current.contains(e.target as Node)) {
        setShowHeaderDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [showCalculator, setShowCalculator] = useState(false);
  const [chipPicker, setChipPicker] = useState<ChipPickerState | null>(null);
  const [siteVisitProject, setSiteVisitProject] = useState<ProjectCardType | null>(null);
  const [callbackProject, setCallbackProject] = useState<ProjectCardType | null>(null);
  const [callbackDone, setCallbackDone] = useState(false);

  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isInputMinimized, setIsInputMinimized] = useState(false);
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null);
  const [showReEngagement, setShowReEngagement] = useState(true)

  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamingMsgIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  /**
   * The composer island floats over the scroll area, so the conversation needs
   * padding equal to its height or the last message hides underneath it.
   *
   * That padding used to be a fixed `pb-36` — 144px, guessed against an input
   * on its own. It is not on its own: the filter dock sits under it and wraps
   * to two or three rows as filters are added, the offline banner appears above
   * it, and the on-screen keyboard moves it. Past 144px the suggestion chips on
   * the last message went under the dock. Measure it instead of guessing.
   */
  const [composerHeight, setComposerHeight] = useState(BOTTOM_FADE_PX);
  const composerObserverRef = useRef<ResizeObserver | null>(null);

  /**
   * A CALLBACK ref, not `useRef` + `useEffect`.
   *
   * The dock renders inside `{!isInputMinimized && (…)}`, so on first paint the
   * effect could run while that subtree was still unmounted. It then took the
   * `if (!el)` branch, set the height to 0, and never ran again — the only
   * dependency was `isInputMinimized`, which does not change on mount. The
   * padding fell back to the 144px floor for the rest of the session while the
   * dock actually drew 218px, so the last cards in an answer sat 58px under the
   * composer. Measured in the browser: reserved 160px against a 218px dock.
   *
   * A callback ref fires exactly when the node attaches and again when it
   * detaches, which is the event we actually care about.
   */
  const setComposerNode = useCallback((inner: HTMLDivElement | null) => {
    composerObserverRef.current?.disconnect();
    composerObserverRef.current = null;
    if (!inner) return;
    // The ref lives on the INNER plain div and we measure its parent.
    //
    // The dock itself is a framer-motion `m.div`, and `m` here is the lazy
    // build — it does not forward a callback ref, so `ref={setComposerNode}` on
    // it was silently never called. Verified in the browser: the callback never
    // ran, composerHeight sat at its initial value, and the padding stayed at
    // the 144px floor against a dock that draws 218px.
    //
    // The parent is the positioned dock, padding included, so measuring it
    // gives the number we actually need without depending on what framer does
    // with refs.
    const el = (inner.parentElement as HTMLElement | null) ?? inner;
    const observer = new ResizeObserver(([entry]) => {
      // borderBoxSize, not contentRect: contentRect EXCLUDES padding, and this
      // element carries pt-8 with pb-6/md:pb-8 — between 56 and 64px of it.
      //
      // So the dock measured ~60px shorter than it draws, the feed reserved
      // that much too little room at the bottom, and the last thing in the
      // conversation sat underneath the composer. On a card answer it was
      // unmistakable: the price rows of the project cards showed through
      // behind the input and the filter chips.
      //
      // The initial measurement below always used getBoundingClientRect, which
      // DOES include padding — so the layout was correct until the first
      // resize observation replaced a right number with a wrong one.
      const box = entry.borderBoxSize?.[0]
      setComposerHeight(Math.ceil(box ? box.blockSize : el.getBoundingClientRect().height))
    });
    observer.observe(el);
    setComposerHeight(Math.ceil(el.getBoundingClientRect().height));
    composerObserverRef.current = observer;
  }, []);
  const userScrolledUp = useRef(false);
  const performResetRef = useRef<() => void>(() => { });
  // [TIMING] holds in-progress restore stage timestamps; cleared after summary printed
  const navTimingsRef = useRef<{ restoreStart: number; authMs: number; fetchMs: number; mapperMs: number; setHistoryAt: number } | null>(null);


  // ── Image carousel state for in-chat galleries ──
  const [carouselIndexes, setCarouselIndexes] = useState<Record<number, number>>({});

  // ── Mobile detection state ──
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // [TIMING] DiscoveryContent mount — distinct from page-mount (page has auth init first)
  useEffect(() => {
    const nt = getNavTimings()
    if (nt && !nt.contentMounted) {
      nt.contentMounted = performance.now()
      if (DEBUG) console.log(`[NAV] 3b. content-mount  +${(nt.contentMounted - nt.t0).toFixed(1)}ms`)
    }

    // [TIMING] LCP observer — measures when the largest element paints
    if (typeof PerformanceObserver !== 'undefined') {
      let lcpEntry: PerformanceEntry | null = null
      const lcpObs = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) lcpEntry = entry
      })
      try {
        lcpObs.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch (_) { /* unsupported */ }

      return () => {
        lcpObs.disconnect()
        if (lcpEntry && nt) {
          const lcpMs = (lcpEntry as any).startTime
          if (DEBUG) console.log(`[NAV] 10. LCP            +${(lcpMs - nt.t0).toFixed(1)}ms (absolute ${lcpMs.toFixed(0)}ms)`)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // ── Voice input (Web Speech API) ──
  // Minimal local typings: the DOM lib doesn't ship SpeechRecognition (non-standard/webkit-prefixed).
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);

  useEffect(() => {
    // Initialize speech recognition once
    if (typeof window !== 'undefined') {
      const w = window as unknown as {
        SpeechRecognition?: new () => MinimalSpeechRecognition;
        webkitSpeechRecognition?: new () => MinimalSpeechRecognition;
      };
      const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-IN';

        recognition.onresult = (event: MinimalSpeechRecognitionEvent) => {
          const transcript = Array.from(event.results)
            .map((result) => result[0].transcript)
            .join('');
          setChatInput(transcript);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognition.onerror = (event: MinimalSpeechRecognitionErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          if (event.error === 'not-allowed') {
            setToast({ message: 'Microphone access denied. Please allow microphone in browser settings.' });
          }
        };

        recognitionRef.current = recognition;
      }
    }
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const toggleVoiceInput = async () => {
    // Primary: browser SpeechRecognition (real-time, best UX)
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
        setIsListening(false);
      } else {
        setChatInput('');
        recognitionRef.current.start();
        setIsListening(true);
      }
      return;
    }

    // Fallback: MediaRecorder → Whisper (when SpeechRecognition unavailable)
    if (isListening) {
      mediaRecorderRef.current?.stop();
      setIsListening(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'recording.webm');
        try {
          const res = await fetch(`${API_BASE}/transcribe`, { method: 'POST', body: fd });

          const data = await res.json();
          if (data.text) setChatInput(data.text);
        } catch { /* silent */ }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
    } catch {
      setToast({ message: 'Microphone access denied. Please allow microphone in browser settings.' });
    }
  };

  const lastScrolledMsgId = useRef<string | null>(null);

  const scrollToLatestResponse = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (chatHistory.length === 0) return;
    const lastMsg = chatHistory[chatHistory.length - 1];

    // ChatGPT/Gemini style: scroll to the top of the newly generated assistant message
    if (lastMsg && lastMsg.type === 'ai') {
      const msgElem = document.getElementById(`msg-${lastMsg.id}`);
      if (msgElem) {
        msgElem.scrollIntoView({ behavior, block: 'start' });
        return;
      }
    }

    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  }, [chatHistory]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior, block: 'end' });
    }
  }, []);

  useEffect(() => {
    if (chatHistory.length > 0 && !userScrolledUp.current) {
      const lastMsg = chatHistory[chatHistory.length - 1];
      if (lastMsg && lastMsg.id !== lastScrolledMsgId.current) {
        lastScrolledMsgId.current = lastMsg.id;
        const timer = setTimeout(() => scrollToLatestResponse(), 80);
        return () => clearTimeout(timer);
      }
    }
  }, [chatHistory, isSubmitting, scrollToLatestResponse]);

  // ── Mobile keyboard handling via Visual Viewport API ──
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100vh');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const vv = window.visualViewport;
    const onResize = () => {
      if (!vv) return;
      const isOpen = vv.height < window.innerHeight * 0.75;
      setKeyboardOpen(isOpen);
      setViewportHeight(`${vv.height}px`);

      if (isOpen) {
        setTimeout(scrollToBottom, 50);
      }
    };

    if (vv) {
      vv.addEventListener('resize', onResize);
      vv.addEventListener('scroll', onResize);
      return () => {
        vv.removeEventListener('resize', onResize);
        vv.removeEventListener('scroll', onResize);
      };
    }
  }, [scrollToBottom]);

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      setShowScrollBtn(distanceFromBottom > 150);

      // Minimize input if scrolled up significantly (on mobile)
      if (window.innerWidth < 768) {
        if (distanceFromBottom > 200) {
          setIsInputMinimized(true);
        } else if (distanceFromBottom < 50) {
          setIsInputMinimized(false);
        }
      } else {
        // Desktop behavior - maybe just keep it visible or a less aggressive minimize
        setIsInputMinimized(false);
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Ctrl+K keyboard shortcut to focus chat input ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const dispatchAction = useCallback((action: import('@/components/chat/types').ConversationAction): void => {
    if (submitLockRef.current) {
      setToast({ message: 'One moment — still working on your last request.' });
      return;
    }
    submitLockRef.current = true;

    if (!userId && !guestToken) {
      submitLockRef.current = false;
      // Not authenticated — show sign-in prompt
      setToast({ message: 'Sign in or continue as guest to start chatting' });
      router.push('/auth');
      return;
    }

    setIsSubmitting(true);
    userScrolledUp.current = false;
    setChipPicker(null);
    setComparingMessageId(null);
    setSelectedCompareProjects(new Map());

    const isText = action.type === 'TEXT_MESSAGE';
    const userText = isText ? (action.payload.text as string) : String(action.payload.label ?? action.type);


    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      type: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    };
    // Only add a user message bubble if it's an explicit text message or a selected chip that isn't a silent patch
    if (isText || action.type === 'INTENT_PATCH' || action.type === 'REMOVE_FILTER') {
      setChatHistory(prev => [...prev, userMsg]);
    }


    setChatTurnCount(c => c + 1);
    if (chatTurnCount === 0) track('chat_started', { session_id: sessionId })
    track('message_sent', { session_id: sessionId, action_type: action.type, text_length: userText.length })
    if (userText) {
      trackSearch(userText, { session_id: sessionId, action_type: action.type })
    }
    setChatInput('');


    const streamId = crypto.randomUUID();
    streamingMsgIdRef.current = streamId;
    setChatHistory(prev => [...prev, {
      id: streamId,
      type: 'ai',
      content: '',
      isSearching: false,
      userQuery: userText,
      timestamp: new Date().toISOString(),
      streamingPhase: 'extracting',
      streamingIntent: null,
      streamingResultCount: null,
    }]);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let localProjects: ProjectCardType[] = [];

    streamChatBackend(action, {
      // Ref, not state: a second message sent before the first turn's `done`
      // committed used to go out with no session id, and the backend forked a
      // second session for the same conversation.
      sessionId: sessionIdRef.current ?? sessionId ?? undefined,
      userId: userId ?? undefined,
      guestToken: guestToken ?? undefined,
      intent: currentIntent ?? undefined,
      signal: controller.signal,
      onEvent: (event) => {
        // Message shape lives in lib/chat/streamReducer — pure, and tested.
        // What stays here is the part that is genuinely a side effect.
        setChatHistory(prev => prev.map(m =>
          m.id === streamId ? applyStreamEvent(m, event, {
            fallbackChips: conversationState?.chips,
            projects: localProjects,
          }) : m,
        ));

        if (event.type === 'intent') {
          setCurrentIntent(event.intent);
        } else if (event.type === 'properties') {
          const shortlist = pickShortlist(
            (event.exactResults ?? []) as unknown as ProjectCardType[],
            (event.nearbyResults ?? []) as unknown as ProjectCardType[],
          );
          localProjects = shortlist;
          setLastShortlist(prev => {
            // Only re-expand the shelf when the shortlist actually changed, or
            // every turn re-opens cards the buyer just collapsed.
            if (shortlist.length > 0 && shortlistKey(prev) !== shortlistKey(shortlist)) {
              setExpandedShortlists(ePrev => new Set(ePrev).add(streamId));
            }
            return shortlist;
          });
          track('recommendation_generated', { count: shortlist.length, session_id: sessionId });
        } else if (event.type === 'ui_state') {
          if (DEBUG) console.log('[UI_STATE]', { stage: event.stage, chipsCount: event.chips?.length ?? 0, chips: event.chips });
          setConversationState({
            stage: event.stage,
            thinking: event.thinking,
            chips: event.chips,
            missingFields: event.missingFields,
            confidence: event.confidence
          });
        } else if (event.type === 'focus') {
          // Text-only turn about a project already on screen: scroll to the
          // card we already rendered instead of repeating it below the answer.
          if (DEBUG) console.log('[FOCUS]', { projectId: event.projectId, name: event.name, anchor: event.anchor });
          const cardElement = document.querySelector(`[data-project-id="${event.projectId}"]`);
          if (cardElement) {
            cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            cardElement.classList.add('ring-2', 'ring-amber-400');
            setTimeout(() => {
              cardElement.classList.remove('ring-2', 'ring-amber-400');
            }, 2000);
          } else {
            console.warn('[FOCUS] Card element not found:', event.projectId);
          }
        } else if (event.type === 'error') {
          if (event.message?.includes('sending messages a bit fast') || event.message?.includes('Too many messages')) {
            // Rate limited: the placeholder is removed outright, and the
            // reducer only ever edits — a deletion cannot be expressed there.
            setRateLimitUntil(Date.now() + 10_000);
            setChatHistory(prev => prev.filter(m => m.id !== streamId));
          }
        } else if (event.type === 'done') {
          const newSessionId = event.sessionId ?? sessionId
          if (event.sessionId) {
            setSessionId(event.sessionId);
            // Canonicalize the URL on first session creation. replaceState so
            // React does not navigate and remount mid-stream.
            if (!initialSessionId && !sessionId) {
              window.history.replaceState({}, '', `/discover/${event.sessionId}`);
            }
          }

          // Auto-generate a smart title on the first turn only.
          if (chatTurnCount === 0 && (userId || guestToken) && newSessionId) {
            const smartTitle = buildSmartTitle(userText, currentIntent);
            setSessionTitle(smartTitle);
            // One sidebar refresh after the PATCH, whether it succeeded or not.
            authHeaders({ 'Content-Type': 'application/json' }).then((headers) =>
              fetch(`${API_BASE}/chat/session/${newSessionId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ title: smartTitle }),
              })
            ).finally(() => {
              window.dispatchEvent(new CustomEvent('propfyndr:session-updated'))
            }).catch(() => { })
          } else {
            // Every other turn: refresh immediately, no PATCH follows.
            window.dispatchEvent(new CustomEvent('propfyndr:session-updated'));
          }
        }
      },
      onDone: () => {
        streamingMsgIdRef.current = null;
        setIsSubmitting(false);
        setRegeneratingIdx(null);
        submitLockRef.current = false;
        if (controller.signal.aborted) {
          if (DEBUG) console.log('[CHAT:ABORT] stream aborted by user')
          setChatHistory(prev => {
            const next = prev.filter(m => m.id !== streamId)
            if (DEBUG) console.log('[CHAT:ABORT_CLEANUP] removed AI placeholder', streamId, 'history length', prev.length, '→', next.length)
            return next
          })
          return
        }
        // Closed cleanly with nothing to show: an empty bubble reads as a
        // failure the buyer cannot act on.
        setChatHistory(prev => prev.map(m =>
          m.id === streamId ? emptyStreamFallback(m) : m,
        ))
        if (!hasShownLengthWarning && chatTurnCount + 1 >= 12) {
          setHasShownLengthWarning(true);
          setShowContextWarning(true);
        }
      },
    });
  }, [userId, guestToken, sessionId, chatTurnCount, hasShownLengthWarning, currentIntent, initialSessionId, router]);

  // ── "Ask AI" button on PropertyCard injects text via CustomEvent ──
  // detail: { text: string; autoSend?: boolean }
  // autoSend true  → send immediately (preset smart prompts)
  // autoSend false → prefill + focus so the user can edit ("Ask something else…")
  useEffect(() => {
    const handler = (e: Event) => {
      const { text, autoSend } = (e as CustomEvent<{ text: string; autoSend?: boolean }>).detail;
      if (autoSend && !isSubmitting) {
        dispatchAction({ type: 'TEXT_MESSAGE', payload: { text } });
      } else {
        setChatInput(text);
        setTimeout(() => chatInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('propfyndr:ask-ai', handler);
    return () => window.removeEventListener('propfyndr:ask-ai', handler);
  }, [dispatchAction, isSubmitting]);

  // ── Sidebar "New Chat" button triggers reset via CustomEvent ──
  useEffect(() => {
    const handler = () => performResetRef.current();
    window.addEventListener('propfyndr:new-chat', handler);
    return () => window.removeEventListener('propfyndr:new-chat', handler);
  }, []);


  const performReset = async () => {
    // Abort any in-flight stream so a late SSE event can't repopulate intent.
    abortControllerRef.current?.abort()
    submitLockRef.current = false            // never early-return; always reset

    setChatHistory([]);
    setChatInput('');
    setIsInitialized(false);
    setChatPhase('DISCOVERY');
    setChatTurnCount(0);
    setHasShownLengthWarning(false);
    setShowContextWarning(false);
    setIsSubmitting(false);
    setCarouselIndexes({});
    setCurrentIntent(null);
    setLastShortlist([]);
    setSessionTitle(null);
    setDetailProject(null);
    setExpandedShortlists(new Set());
    setRateLimitUntil(null);
    setConversationState(null);
    setSessionId(null);                      // reset for guests too — new session on next send

    if (userId) {
      try {
        const res = await fetch(`${API_BASE}/chat/intent`, {
          method: 'DELETE',
          headers: await authHeaders(),

        });
        const data = await res.json();
        if (data.session_id) setSessionId(data.session_id);
      } catch (e) {
        console.error('Failed to reset intent:', e);
      }
    }
    setChatHistory([]);
    setIsInitialized(true);
    window.history.replaceState({}, '', '/discover');
  };
  performResetRef.current = performReset;

  // Initialize: restore session from prop or show welcome
  useEffect(() => {
    if (!userId && !guestToken) return;

    // Fix 5: Always allow retry if API cache miss occurs on first attempt
    // Only skip if we successfully loaded this exact session ID
    if (loadedSessionIdRef.current === (initialSessionId ?? null) && isInitialized && chatHistory.length > 0) return;

    let cancelled = false;

    // No session to restore — new chat
    if (!initialSessionId) {
      setRestoreError(false);
      loadedSessionIdRef.current = null;
      setChatHistory([]);
      setCurrentIntent(null);
      setChatPhase('DISCOVERY');
      setLastShortlist([]);
      setConversationState(null);
      setIsInitialized(true);
      return;
    }

    // Restore specific session
    (async () => {
      setRestoreError(false);
      setIsInitialized(false);
      try {
        const cached = LOCAL_SESSION_CACHE.get(initialSessionId);
        if (cached) {
          setSessionId(cached.session_id);
          if (cached.title) setSessionTitle(cached.title);
          if (cached.chat_phase) setChatPhase(cached.chat_phase);
          if (cached.last_intent) setCurrentIntent(cached.last_intent);
          if (cached.ui_state) setConversationState(cached.ui_state as any);
          if (cached.last_projects && cached.last_projects.length > 0) {
            setLastShortlist(cached.last_projects as any);
          }
          const restoredHistory = (cached.restored ?? []) as ChatMessage[];
          setChatHistory(restoredHistory);
          const lastMsgWithResults = lastMessageWithResults(restoredHistory);
          if (lastMsgWithResults) {
            setExpandedShortlists(new Set([lastMsgWithResults.id]));
          }
          loadedSessionIdRef.current = initialSessionId;
          setIsInitialized(true);
          setTimeout(() => scrollToBottom('instant'), 50);
          return;
        }

        // [TIMING]
        const nt = getNavTimings()
        const restoreStart = performance.now()
        if (DEBUG && nt) console.log(`[NAV] 4. restore-start    +${(restoreStart - nt.t0).toFixed(1)}ms`)

        const authT0 = performance.now()
        const headers = await authHeaders()
        const authMs = performance.now() - authT0
        if (DEBUG && nt) console.log(`[NAV] 5. authHeaders       +${(performance.now() - nt.t0).toFixed(1)}ms  (took ${authMs.toFixed(1)}ms)`)

        const fetchT0 = performance.now()
        if (DEBUG && nt) console.log(`[NAV] 6. fetch-start       +${(fetchT0 - nt.t0).toFixed(1)}ms`)
        const sessionUrl = `${API_BASE}/chat/session?id=${initialSessionId}` + (guestToken && !userId ? `&guestToken=${guestToken}` : '')
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 12000)
        try {
          const res = await fetch(sessionUrl, {
            headers,
            signal: controller.signal,
          })
          clearTimeout(timeoutId)
        const fetchMs = performance.now() - fetchT0
        if (DEBUG && nt) console.log(`[NAV] 7. fetch-end         +${(performance.now() - nt.t0).toFixed(1)}ms  (took ${fetchMs.toFixed(1)}ms)`)

        if (!res.ok) {
          throw new Error(`session fetch failed with status ${res.status}`)
        }
        const data = await res.json();
        if (cancelled) return;

        setSessionId(data.session_id);
        if (data.title) setSessionTitle(data.title);

        if (data.chat_phase === 'ADVISOR') setChatPhase('ADVISOR');

        if (data.last_intent && typeof data.last_intent === 'object') {
          setCurrentIntent(data.last_intent as Record<string, unknown>);
        }

        if (data.ui_state) setConversationState(data.ui_state);

        if (Array.isArray(data.last_projects) && data.last_projects.length > 0) {
          setLastShortlist(data.last_projects);
        }

        if (data.messages && data.messages.length > 0) {
          type RawMessage = {
            id: string
            role: string
            content: string
            created_at: string
            artifacts?: Array<{ type: string;[key: string]: unknown }>
          }
          const mapperT0 = performance.now()
          const restored: ChatMessage[] = data.messages.map((m: RawMessage) => {
            return restoreMessage(m as unknown as StoredMessage)
          })
          const withChips = attachTrailingChips(restored, data.ui_state?.chips)
          const mapperMs = performance.now() - mapperT0
          if (DEBUG && nt) console.log(`[NAV] 8. mapper            +${(performance.now() - nt.t0).toFixed(1)}ms  (took ${mapperMs.toFixed(1)}ms, ${data.messages.length} msgs)`)

          navTimingsRef.current = { restoreStart, authMs, fetchMs, mapperMs, setHistoryAt: performance.now() }

          const ordered = sortRestoredMessages(withChips);

          LOCAL_SESSION_CACHE.set(initialSessionId, {
            session_id: data.session_id,
            title: data.title,
            chat_phase: data.chat_phase,
            last_intent: data.last_intent,
            last_projects: data.last_projects,
            ui_state: data.ui_state,
            restored: ordered
          });

          setIsRestoring(true);
          setChatHistory(ordered);
          const lastMsgWithResults = lastMessageWithResults(ordered);
          if (lastMsgWithResults) {
            setExpandedShortlists(new Set([lastMsgWithResults.id]));
          }
          loadedSessionIdRef.current = initialSessionId;
          setTimeout(() => {
            scrollToBottom('instant');
            setIsRestoring(false);
          }, 50);
        } else {
          setChatHistory([]);
          loadedSessionIdRef.current = initialSessionId;
        }
        } finally {
          clearTimeout(timeoutId)
        }
      } catch (err: any) {
        // Fix 6: Show user feedback on timeout
        if (cancelled) return;
        if (err?.name === 'AbortError') {
          console.warn('[session-restore] timeout after 12s')
          setToast({ message: 'Session loading took too long. Try refreshing the page.' })
          setRestoreError(true)
        } else {
          console.error('[session-restore] failed:', err)
          setRestoreError(true)
        }
      } finally {
        if (!cancelled) setIsInitialized(true)
      }
    })();

    return () => {
      cancelled = true
      // Fix 7: Guard cleanup against stale effect in race condition
      setIsInitialized(prev => !cancelled ? prev : true)
    };
  }, [userId, guestToken, initialSessionId, scrollToBottom]);

  // [TIMING] detect when setChatHistory from restore has been committed to DOM
  useEffect(() => {
    const t = navTimingsRef.current
    if (!t || chatHistory.length === 0) return
    const renderMs = performance.now() - t.setHistoryAt
    const nt = getNavTimings()
    if (nt) {
      if (DEBUG) console.log(`[NAV] 9. render-complete   +${(performance.now() - nt.t0).toFixed(1)}ms  (took ${renderMs.toFixed(1)}ms)`)
      const totalMs = performance.now() - nt.t0
      const rscMs = nt.rscEnd != null ? nt.rscEnd - nt.t0 : null
      const mountMs = nt.pageMounted != null ? nt.pageMounted - nt.t0 : null
      const stages = [
        { name: 'rsc+compile', ms: rscMs ?? 0 },
        { name: 'authHeaders', ms: t.authMs },
        { name: 'fetch', ms: t.fetchMs },
        { name: 'mapper', ms: t.mapperMs },
        { name: 'render', ms: renderMs },
      ].filter(s => s.ms > 0)
      const slowest = stages.reduce((a, b) => a.ms > b.ms ? a : b)
      if (DEBUG) console.log(
        `[NAV] ━━━ TOTAL ${totalMs.toFixed(0)}ms` +
        (rscMs != null ? ` | rsc+compile ${rscMs.toFixed(0)}ms` : '') +
        (mountMs != null ? ` | page-mount ${mountMs.toFixed(0)}ms` : '') +
        ` | authHeaders ${t.authMs.toFixed(0)}ms` +
        ` | fetch ${t.fetchMs.toFixed(0)}ms` +
        ` | mapper ${t.mapperMs.toFixed(0)}ms` +
        ` | render ${renderMs.toFixed(0)}ms` +
        ` | ⚠️ BOTTLENECK: ${slowest.name} (${slowest.ms.toFixed(0)}ms)`
      )
    }
    navTimingsRef.current = null // reset so streaming turns don't re-trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory.length])

  // [TIMING] property cards first visible — fires once when any message has property results
  useEffect(() => {
    const nt = getNavTimings()
    if (!nt || nt.propertyCardsLogged) return
    const hasCards = chatHistory.some(
      (m) => (m.exactResults && m.exactResults.length > 0) || (m.nearbyResults && m.nearbyResults.length > 0)
    )
    if (hasCards) {
      nt.propertyCardsLogged = true
      nt.propertyCards = performance.now()
      if (DEBUG) console.log(`[NAV] 9b. property-cards +${(nt.propertyCards - nt.t0).toFixed(1)}ms`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory])



  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);


  // Pick up prefill query from compare page (sessionStorage)
  useEffect(() => {
    if (!isInitialized) return;
    const prefill = sessionStorage.getItem('rp_prefill_chat');
    if (prefill) {
      sessionStorage.removeItem('rp_prefill_chat');
      const timer = setTimeout(() => dispatchAction({ type: 'TEXT_MESSAGE', payload: { text: prefill } }), 200);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, dispatchAction]);

  const handleChatSubmit = useCallback((e: React.FormEvent, textOverride?: string) => {
    e.preventDefault();
    const text = (textOverride ?? chatInput).trim();
    if (!text) return;
    if (isSubmitting) {
      abortControllerRef.current?.abort();
    }
    dispatchAction({ type: 'TEXT_MESSAGE', payload: { text } });
    track('message_sent', { session_id: sessionId, turn: chatTurnCount });
  }, [chatInput, chatTurnCount, dispatchAction, sessionId, isSubmitting]);

  // ── Regenerate: re-send the last user message ──
  const handleRegenerate = useCallback((aiMsgIndex: number) => {

    let userMsg = '';
    for (let i = aiMsgIndex - 1; i >= 0; i--) {
      if (chatHistory[i].type === 'user') { userMsg = chatHistory[i].content; break; }
    }
    if (userMsg) {
      setRegeneratingIdx(aiMsgIndex);
      dispatchAction({ type: 'TEXT_MESSAGE', payload: { text: userMsg } });
    }
  }, [chatHistory, dispatchAction]);

  // ── Edit message: update content, truncate subsequent, regenerate ──
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    const trimmed = newContent.trim();
    if (!trimmed) return;

    setComparingMessageId(null);
    setSelectedCompareProjects(new Map());

    setChatHistory(prev => {
      const idx = prev.findIndex(m => m.id === messageId);
      if (idx === -1) return prev;
      return prev.slice(0, idx);
    });

    dispatchAction({ type: 'TEXT_MESSAGE', payload: { text: trimmed } });
  }, [dispatchAction]);

  // ── Unified Chip Action Handler ──
  const handleChipAction = useCallback((action: import('@/components/chat/types').ChipAction) => {
    track('chip_clicked', { chip_id: action.id, action_type: action.actionType, label: action.label });
    if (action.actionType === 'OPEN_TOOL') {
      const tool = action.payload.tool as string;
      if (tool === 'calculator') setShowCalculator(true);
      if (tool === 'map') setShowMap(true);
      if (tool === 'share') setShareSheetOpen(true);
      return;
    }

    if (action.actionType === 'COMPARE_PROPERTIES') {
      if (action.payload.mode === 'direct') {
        const selectedIds = action.payload.selected as string[];
        const selected = lastShortlist.filter(p => selectedIds.includes(p.slug));
        if (selected.length >= 2) {
          const names = selected.map(p => p.name).join(' and ');
          dispatchAction({ type: 'TEXT_MESSAGE', payload: { text: `Compare ${names}` } });
          return;
        }
      }

      if (action.payload.mode === 'multi') {
        if (lastShortlist.length >= 2) {
          setCompareOverlayProperties(lastShortlist);
          return;
        }
        // The chip carries the projects it was built from. Prose chips are emitted
        // precisely when the search returned no cards, so lastShortlist is empty
        // there — reading only lastShortlist made "Compare these 3" dispatch a
        // contentless "Compare projects" and appear to do nothing.
        const named = (action.payload.projects ?? []) as Array<{ id: string; name: string }>;
        if (named.length >= 2) {
          dispatchAction({
            type: 'TEXT_MESSAGE',
            payload: { text: `Compare ${named.map(p => p.name).join(' and ')}` },
          });
          return;
        }
        dispatchAction({ type: 'TEXT_MESSAGE', payload: { text: 'Compare projects' } });
        return;
      }
    }

    if (action.actionType === 'CALCULATE_EMI') {
      if (action.payload.mode === 'single') {
        setChipPicker({
          mode: 'single',
          action: 'emi',
          label: 'Calculate EMI',
          isModal: false,
          selected: []
        });
        return;
      }
      // Unmatched EMI mode → open EMI tool
      setShowCalculator(true);
      return;
    }

    if (action.actionType === 'BOOK_VISIT') {
      if (action.payload.mode === 'single') {
        setChipPicker({
          mode: 'single',
          action: 'visit',
          label: 'Book Visit',
          isModal: false,
          selected: []
        });
        return;
      }
      // Unmatched VISIT mode → log warning, no action
      console.warn('[CHIP] unmatched BOOK_VISIT mode:', action.payload.mode);
      return;
    }

    // Exhaustive: INTENT_PATCH, TEXT_MESSAGE, REMOVE_FILTER, COMPARE_PROPERTIES
    switch (action.actionType) {
      case 'INTENT_PATCH': {
        // Convert INTENT_PATCH to natural language message
        const patch = (action.payload?.patch || {}) as Record<string, any>;
        const texts: string[] = [];

        if (patch.sector) texts.push(`properties in ${patch.sector}`);
        if (Array.isArray(patch.bhk) && patch.bhk.length) {
          const bhks = patch.bhk.map((b: number) => `${b} BHK`).join(', ');
          texts.push(`${bhks}`);
        }
        if (patch.budgetMin || patch.budgetMax) {
          const min = patch.budgetMin ? `₹${patch.budgetMin}Cr` : '';
          const max = patch.budgetMax ? `₹${patch.budgetMax}Cr` : '';
          const range = [min, max].filter(Boolean).join(' - ');
          texts.push(`within budget ${range}`);
        }
        if (Array.isArray(patch.lifestyleKeywords) && patch.lifestyleKeywords.length) {
          texts.push(`with ${patch.lifestyleKeywords.join(', ')}`);
        }

        const naturalText = texts.join(' ') || 'refine search';
        dispatchAction({
          type: 'TEXT_MESSAGE',
          payload: { text: naturalText }
        });
        return;
      }
      case 'TEXT_MESSAGE':
      case 'REMOVE_FILTER': {
        const payload = (action.payload || {}) as Record<string, any>;
        let text = typeof payload.text === 'string' && payload.text.trim().length > 0
          ? payload.text.trim()
          : '';

        // If payload.text is missing, reconstruct it from prefix + projects + suffix OR action.label
        if (!text) {
          const prefix = String(payload.actionPrefix || '').trim();
          const suffix = String(payload.actionSuffix || '').trim();
          const projects = Array.isArray(payload.projects) ? payload.projects : [];
          const projectNames = projects.map((p: any) => p?.name || p).filter(Boolean).join(' and ');

          if (prefix && projectNames) {
            text = `${prefix} ${projectNames}${suffix ? ` ${suffix}` : ''}`.trim();
          } else if (prefix) {
            text = `${prefix}${suffix ? ` ${suffix}` : ''}`.trim();
          } else {
            text = String(action.label || '').trim();
          }
        }

        if (!text) {
          console.warn('[CHIP] Skipped dispatching completely empty chip action:', action);
          return;
        }

        const textPayloadLower = text.toLowerCase();
        const chipIdStr = String(action.id || '').toLowerCase();

        if (
          chipIdStr.includes('site_visit') ||
          chipIdStr.includes('callback') ||
          textPayloadLower.includes('site visit') ||
          textPayloadLower.includes('callback') ||
          textPayloadLower.includes('schedule a visit')
        ) {
          if (lastShortlist.length > 0) {
            setSiteVisitProject(lastShortlist[0]);
            return;
          }
        }

        dispatchAction({
          type: 'TEXT_MESSAGE',
          payload: { ...payload, text }
        });
        return;
      }
      case 'COMPARE_PROPERTIES': {
        // COMPARE_PROPERTIES with <2 resolvable slugs → open compare selector
        if (lastShortlist.length >= 2) {
          setCompareOverlayProperties(lastShortlist);
          return;
        }
        const namedFallback = (action.payload?.projects ?? []) as Array<{ id: string; name: string }>;
        dispatchAction({
          type: 'TEXT_MESSAGE',
          payload: {
            text: namedFallback.length >= 2
              ? `Compare ${namedFallback.map(p => p.name).join(' and ')}`
              : 'Compare projects',
          },
        });
        return;
      }
      default:
        console.error('[CHIP:EXHAUSTIVE] unhandled action type:', action.actionType);
        setToast({ message: "That option isn't available right now." });
        return;
    }
  }, [dispatchAction, lastShortlist]);

  const stripMarkdown = (text: string): string => {
    return text
      .replace(/```[\s\S]*?```/g, '[code]')
      .replace(/`[^`]+`/g, '[code]')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  };

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(stripMarkdown(text))
      .then(() => setToast({ message: 'Copied!' }))
      .catch(() => { })
  }, []);

  const hasUserReplied = chatHistory.some((m) => m.type === 'user');

  // ── Stable MessageBubble callbacks ──────────────────────────────────────────
  const handleToggleExpanded = useCallback((id: string) => {
    setExpandedShortlists(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const handleToggleMap = useCallback(() => setShowMap(v => !v), [])

  // The Map button on each result header dispatches this. Without a listener the
  // button was inert — `showMap` is already plumbed into MessageBubble and gates
  // the SectorMap render, so this is the only piece that was missing.
  useEffect(() => {
    window.addEventListener('propfyndr:open-map', handleToggleMap);
    return () => window.removeEventListener('propfyndr:open-map', handleToggleMap);
  }, [handleToggleMap]);

  const handleSetCarouselIndex = useCallback((msgIdx: number, imgIdx: number) => {
    setCarouselIndexes(prev => ({ ...prev, [msgIdx]: imgIdx }))
  }, [])

  const handleToast = useCallback((msg: string) => setToast({ message: msg }), [])
  const handleOpenCalculator = useCallback(() => setShowCalculator(true), [])
  const handleOpenShareSheet = useCallback(() => setShareSheetOpen(true), [])

  // ── Unified Floating Bento Input Dock ──
  const chatInputForm = (
    <div className={`relative w-full transition-all duration-300 ${isInputMinimized ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
      <div className="relative w-full">
        {rateLimitUntil && (
          <RateLimitBanner until={rateLimitUntil} onExpire={() => setRateLimitUntil(null)} />
        )}

        <div className="relative flex flex-col bg-white/95 dark:bg-[#18181b]/95 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] focus-within:border-black/25 dark:focus-within:border-white/25 focus-within:shadow-[0_10px_36px_rgba(0,0,0,0.1)] dark:focus-within:shadow-[0_10px_36px_rgba(0,0,0,0.6)] rounded-[24px] transition-all duration-200 mx-auto w-full p-2 sm:p-2.5">
          <div id="chat-input-guide" className="relative w-full">
            <PlaceholdersAndVanishInput
              placeholders={
                chatPhase === 'ADVISOR'
                  ? [
                    'What are the risks with this property?',
                    'Compare Godrej Woods vs ATS Pristine...',
                    'Calculate EMI for 1.5Cr at 8.5%...',
                    'How far is the nearest metro station?',
                  ]
                  : [
                    'Find a 3 BHK in Sector 150...',
                    'Which are the best RERA-approved projects?',
                    'Show me luxury apartments on Noida Expressway...',
                    'Ready-to-move or possession by 2027...',
                  ]
              }
              onChange={(e) => setChatInput(e.target.value)}
              onSubmit={handleChatSubmit}
              value={chatInput}
            />
          </div>

          {/* Integrated Bento Bottom Action Strip */}
          <div className="flex items-center justify-between pt-1 px-2 border-t border-slate-100 dark:border-zinc-800/60 mt-1">
            {/* Left: the tagline. The filter dock used to live here, sharing a
                single row with the voice and send buttons — on a phone that
                left it about 150px, so four pills became a horizontal scroll
                with no affordance. It now sits on its own row below the dock. */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {!(hasUserReplied && currentIntent) && (
                <span className="text-[11px] font-medium text-slate-400 dark:text-zinc-500 hidden sm:inline">
                  AI Real Estate Advisor · Noida &amp; Greater Noida
                </span>
              )}
            </div>

            {/* Right: Voice Input + Send/Stop Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Voice button with live waveform state */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  isListening
                    ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse'
                    : 'bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-300'
                }`}
                title={isListening ? 'Stop listening' : 'Voice search'}
                aria-label={isListening ? 'Stop listening' : 'Voice search'}
              >
                {isListening ? (
                  <>
                    <div className="flex items-center gap-0.5 h-3">
                      <span className="w-0.5 h-2.5 bg-white rounded-full animate-pulse" />
                      <span className="w-0.5 h-3.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                      <span className="w-0.5 h-2 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-[11px]">Listening…</span>
                  </>
                ) : (
                  <>
                    <Microphone size={14} weight="bold" />
                    <span className="hidden sm:inline text-[11px]">Voice</span>
                  </>
                )}
              </button>

              {/* Action button: Stop (square) while streaming → Send (ArrowUp) */}
              {isSubmitting ? (
                <button
                  type="button"
                  onClick={() => abortControllerRef.current?.abort()}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white shadow-xs active:scale-95 cursor-pointer"
                  title="Stop generating"
                  aria-label="Stop generating"
                >
                  <span className="w-2.5 h-2.5 rounded-[2px] bg-white dark:bg-zinc-900" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (!chatInput.trim() || !isOnline) return
                    if (isSubmitting) abortControllerRef.current?.abort()
                    dispatchAction({ type: 'TEXT_MESSAGE', payload: { text: chatInput.trim() } })
                  }}
                  disabled={!isOnline || !chatInput.trim()}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 text-white active:scale-95 ${
                    isOnline && chatInput.trim()
                      ? 'bg-blue-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-[0_2px_10px_rgba(37,99,235,0.35)] cursor-pointer'
                      : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-600 cursor-not-allowed opacity-50'
                  }`}
                  title={isOnline ? 'Send message' : 'You\'re offline'}
                  aria-label="Send message"
                >
                  <ArrowUp size={15} weight="bold" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* The search refinement dock, on its own row under the input. Filters
            used to be rendered in three places, then in one — but inside the
            input's action strip, squeezed beside voice and send. Here they get
            the full width and wrap instead of scroll. */}
        {hasUserReplied && currentIntent && (
          <div className="px-2 pt-1.5">
            <FilterDock
              intent={currentIntent as unknown as Record<string, unknown>}
              disabled={isSubmitting}
              onPatch={(patch, label) => dispatchAction({ type: 'INTENT_PATCH', payload: { patch, label } })}
              onRemove={(fields, label) => dispatchAction({ type: 'REMOVE_FILTER', payload: { fields, label } })}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-slate-50/50 dark:bg-gray-900 overflow-hidden"
      style={isMobile ? { height: viewportHeight } : undefined}
    >
      {/* Seamless Floating Header (Container is 100% transparent; only individual pills have frosted blur) */}
      <div className="absolute top-2.5 sm:top-3 left-0 right-0 z-30 flex items-center justify-between px-3 sm:px-6 pointer-events-none">
        <div className="flex items-center justify-start pl-12 md:pl-0 relative pointer-events-auto" ref={headerDropdownRef}>
          <AnimatePresence>
            {hasUserReplied && (
              <m.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {isRenamingHeader ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md border border-gray-200/70 dark:border-zinc-700/60 shadow-xs">
                    <input
                      autoFocus
                      type="text"
                      value={headerRenameValue}
                      onChange={(e) => setHeaderRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitHeaderRename();
                        if (e.key === 'Escape') setIsRenamingHeader(false);
                      }}
                      onBlur={submitHeaderRename}
                      className="bg-transparent border-none outline-none text-xs sm:text-sm font-semibold w-32 md:w-48 text-gray-800 dark:text-gray-200"
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setShowHeaderDropdown(!showHeaderDropdown)}
                    className="inline-flex items-center gap-1.5 h-10 sm:h-9.5 px-3.5 sm:px-3 rounded-full bg-white/85 dark:bg-zinc-800/85 backdrop-blur-md border border-gray-200/70 dark:border-zinc-700/60 shadow-2xs hover:bg-white dark:hover:bg-zinc-700 transition-colors text-gray-800 dark:text-gray-200 group cursor-pointer active:scale-95"
                    title="Conversation options"
                  >
                    <span className="text-[13px] sm:text-[13.5px] font-semibold tracking-tight truncate max-w-[155px] sm:max-w-md">{sessionTitle || 'Conversation'}</span>
                    <CaretDown size={13} weight="bold" className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 shrink-0" />
                  </button>
                )}

                {/* Dropdown Menu */}
                {showHeaderDropdown && (
                  <div className="absolute top-full left-12 md:left-0 mt-1.5 w-44 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-gray-200/80 dark:border-zinc-800 overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-100 z-50">
                    <button onClick={handleStartRename} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer">
                      <PencilSimple size={15} weight="bold" className="text-gray-400" />
                      <span>Rename</span>
                    </button>
                    <div className="h-px bg-gray-100 dark:bg-zinc-800 my-1 mx-2" />
                    <button onClick={handleDeleteSession} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs sm:text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors cursor-pointer">
                      <Trash size={15} weight="bold" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-end gap-2 pointer-events-auto">
          {/* Individual Frosted Pill New Chat Button */}
          <AnimatePresence>
            {hasUserReplied && (
              <m.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={handleNewChat}
                className="flex items-center justify-center gap-1.5 h-10 sm:h-9.5 px-3 sm:px-3.5 rounded-full bg-white/85 dark:bg-zinc-800/85 backdrop-blur-md border border-gray-200/70 dark:border-zinc-700/60 shadow-2xs hover:bg-white dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-200 text-[12.5px] sm:text-[13px] font-medium transition-colors cursor-pointer active:scale-95"
                title="Start new conversation"
                aria-label="New Chat"
              >
                <NotePencil size={18} weight="bold" className="text-gray-600 dark:text-gray-300" />
                <span className="hidden sm:inline">New Chat</span>
              </m.button>
            )}
          </AnimatePresence>

          <ThemeToggle />
        </div>
      </div>

      {/* Sticky Top Intent Ribbon (Remains pinned at top during scroll) */}
      <AnimatePresence>
      {/* The intent ribbon used to sit here, absolutely positioned above the
          conversation. It showed the same fields the input dock now shows, but
          read-only, and its remove buttons were opacity-0 until hover — on a
          phone, invisible. It was also what overlapped the buyer's own message
          when the intent wrapped to a second line.

          One dock, in the input, is the whole of it now. */}
      </AnimatePresence>

      {/* Main: centered input when no chat, scrollable messages + bottom input when chat started */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">

        {/* Ambient Dynamic Mesh Glow (Feels alive and modern in both light & dark themes) */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
          <div className="absolute top-[-10%] left-[20%] w-[650px] h-[650px] bg-gradient-to-tr from-blue-500/15 to-indigo-500/10 dark:from-blue-600/20 dark:to-indigo-600/15 blur-[140px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-[30%] right-[10%] w-[600px] h-[600px] bg-gradient-to-bl from-purple-500/15 to-teal-500/10 dark:from-purple-600/15 dark:to-teal-600/15 blur-[140px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse" style={{ animationDuration: '10s' }} />
        </div>

        {(!isInitialized && !!initialSessionId) ? (
          <div className="flex-1 flex flex-col justify-start w-full relative z-10 overflow-y-auto">
            <ChatPhase2Skeleton />
          </div>
        ) : restoreError ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center relative z-10">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
              <WarningCircle size={28} weight="duotone" className="text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-gray-200 mb-1">Could not load this conversation</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">This session may have expired or been deleted. Start a new chat below.</p>
            </div>
            <button
              onClick={() => {
                window.history.replaceState({}, '', '/discover');
                setRestoreError(false);
                setIsInitialized(false);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Start new chat
            </button>
          </div>
        ) : !hasUserReplied ? (
          /* Welcome screen */
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8 relative z-10 overflow-y-auto">
            {/* Clean, iconic brand hero */}
            <div className="text-center mb-10 max-w-[880px] animate-fade-in-up flex flex-col items-center select-none">
              <h1 className="text-[4.2rem] md:text-[5.5rem] font-bold text-gray-900 dark:text-white tracking-tight italic leading-none drop-shadow-sm font-[family-name:var(--font-afacad)]">
                PropFyndr
              </h1>
              <h2 className="text-2xl md:text-[28px] font-medium text-gray-500 dark:text-gray-400 tracking-wide mt-2 font-[family-name:var(--font-afacad)]">
                Decide Better
              </h2>
            </div>

            {showReEngagement && !hasUserReplied && (
              <ReEngagementBanner
                userId={userId ?? undefined}
                guestToken={guestToken ?? undefined}
                onResume={(sid: string) => {
                  setShowReEngagement(false);
                  router.push(`/discover/${sid}`);
                }}
                onDismiss={() => setShowReEngagement(false)}
              />
            )}

            {/* Input first — ChatGPT style */}
            <div className="w-full max-w-[800px] mb-6">
              {chatInputForm}
            </div>

            {/* Home buttons — organized by sector */}
            <div className="w-full max-w-[800px]">
              <HomeButtons
                onButtonClick={(prompt) => dispatchAction({ type: 'TEXT_MESSAGE', payload: { text: prompt } })}
              />
            </div>
          </div>
        ) : (
          /* Feed layout */

          <div className="flex flex-col w-full h-full relative">
            <div
              ref={chatContainerRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              aria-label="Conversation with RealtyPal advisor"
              // The session-title pill floats over this feed at z-30, sitting
              // between 10px and 52px from the top. Top padding used to drop to
              // pt-2 (8px) as soon as an intent existed — which is exactly when
              // the pill appears — so the buyer's own first question scrolled
              // under it. One padding that clears the pill, in both states.
              //
              // Raised from pt-14/pt-16 on 31 Aug. Clearing the pill by 14px is
              // not the same as looking clear of it: the first message read as
              // wedged under the chrome rather than as the start of a
              // conversation. The gap now scales with the viewport, because a
              // 24-inch monitor showing the same 56px of air reads tighter than
              // a phone does.
              className={`flex-1 w-full h-full overflow-y-auto px-3 sm:px-4 md:px-6 lg:px-8 pt-16 sm:pt-16 relative z-10`}
              // The dock is a flex sibling now, so this no longer has to
              // reserve room for it — it only needs the ordinary breathing
              // space at the end of a conversation. composerHeight is kept
              // because the keyboard-open path on mobile still consults it.
              style={{ paddingBottom: 32 }}

              onScroll={(e) => {
                const el = e.currentTarget;
                userScrolledUp.current = (el.scrollHeight - el.scrollTop - el.clientHeight) > 100;
                handleMessageScroll(e);
              }}
            >
              {/*
                Turn separation scales with the viewport for the same reason the
                top padding does. 24px between turns is right on a phone, where
                the screen edge does the separating; on a desktop the same gap
                lets a long answer and the next question read as one block.
                The measure stays near 768px — that is a readable line length,
                and widening it would trade legibility for filled space.
              */}
              <div className="max-w-[768px] mx-auto space-y-6 sm:space-y-8">
                {showContextWarning && (
                  <div className="mx-auto max-w-lg px-4 py-2 my-2 text-xs text-center text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                    Long conversation detected. Start a new chat for the best AI responses.
                  </div>
                )}
                {chatHistory.length > visibleCount && (
                  <div className="text-center py-2">
                    <button
                      onClick={() => setVisibleCount(v => v + 15)}
                      className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-4 py-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium border border-gray-200 dark:border-gray-700 shadow-sm"
                    >
                      Load older messages
                    </button>
                  </div>
                )}

                {chatHistory.slice(-visibleCount).map((message, index) => {
                  const actualIndex = Math.max(0, chatHistory.length - visibleCount) + index;
                  const isComparingThis = message.id === comparingMessageId;
                  return (
                    <div key={message.id} id={`msg-${message.id}`} className={`scroll-mt-6 ${isComparingThis ? 'relative z-30' : ''}`}>
                      <MessageBubble
                        message={message}
                        index={actualIndex}
                        isLast={actualIndex === chatHistory.length - 1}
                        isSubmitting={isSubmitting}
                        chatPhase={chatPhase}
                        isExpanded={expandedShortlists.has(message.id)}
                        carouselIndex={carouselIndexes[actualIndex] ?? 0}
                        lastShortlist={lastShortlist}
                        showMap={showMap}
                        userId={userId}
                        sessionId={sessionId ?? ''}
                        regeneratingIdx={regeneratingIdx}
                        chipPicker={chipPicker}
                        chips={(Array.isArray(message.chips) && message.chips.length > 0) ? (message.chips as any) : (actualIndex === chatHistory.length - 1 ? conversationState?.chips ?? [] : [])}
                        isRestoring={isRestoring}
                        currentIntent={currentIntent}
                        onCopy={handleCopy}
                        onDetailOpen={openDetailProject}
                        onCallback={setCallbackProject}
                        onRegenerate={handleRegenerate}
                        onEditMessage={handleEditMessage}
                        onAction={handleChipAction}
                        onToggleExpanded={handleToggleExpanded}
                        onSetChipPicker={setChipPicker}
                        onSetCarouselIndex={handleSetCarouselIndex}
                        onSetSiteVisit={setSiteVisitProject}
                        onOpenCalculator={handleOpenCalculator}
                        onOpenShareSheet={handleOpenShareSheet}
                        onToast={handleToast}
                        onOpenCompare={setCompareOverlayProperties}
                        comparingMessageId={comparingMessageId}
                        selectedCompareIds={isComparingThis ? new Set(selectedCompareProjects.keys()) : undefined}
                        onToggleCompareSelect={handleToggleCompareSelect}
                        onStartCompare={handleStartCompare}
                        onCancelCompare={handleCancelCompare}
                      />
                    </div>
                  );
                })}



                <div ref={chatEndRef} />
              </div>

              {/* Floating FAB for minimized mobile input */}
              <AnimatePresence>
                {isInputMinimized && !isSubmitting && (
                  <m.div
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.8 }}
                    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 md:hidden"
                  >
                    <button
                      onClick={() => {
                        setIsInputMinimized(false);
                        scrollToBottom();
                        setTimeout(() => chatInputRef.current?.focus(), 300);
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all font-semibold border border-blue-400"
                    >
                      <ChatCircleDots size={18} weight="bold" />
                      <span>Send Message</span>
                    </button>
                  </m.div>
                )}
              </AnimatePresence>

              {showScrollBtn && (
                <button
                  onClick={() => scrollToBottom()}
                  className="absolute bottom-4 right-6 w-9 h-9 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-600 transition-all z-10"
                  aria-label="Scroll to bottom"
                >
                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              )}
            </div>

            {/* (View on Map Toggle moved to MessageBubble) */}

            {/*
              The gradient that used to sit here is gone with the overlay it
              was hiding. It faded the conversation out UNDER a floating dock;
              the dock is now a sibling in the flex column, so there is nothing
              underneath it to fade and a gradient at bottom-0 would simply wash
              out the composer itself.
            */}

            {/* Stable flex-bottom input island */}
            <AnimatePresence initial={false}>
              {!isInputMinimized && (
                <m.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: comparingMessageId ? 0.35 : 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  // `relative shrink-0`, not `absolute bottom-0`.
                  //
                  // As an overlay this dock could only avoid covering the
                  // conversation if the feed reserved exactly its height in
                  // padding — and that measurement broke in three separate
                  // ways: the ResizeObserver read contentRect (padding
                  // excluded), the effect could run before this subtree
                  // mounted and never retried, and framer's lazy `m.div`
                  // silently drops a callback ref. Measured in the browser
                  // afterwards: 160px reserved against a 218px dock, so the
                  // last project cards sat 58px underneath it.
                  //
                  // A flex sibling cannot overlap the feed. The feed is
                  // `flex-1` in the same column, so it simply gets the space
                  // that is left. No measurement, nothing to keep in sync,
                  // and it holds at every viewport and every dock height —
                  // including when the filter chips wrap to a third row.
                  className={`relative shrink-0 w-full z-30 flex justify-center pb-6 md:pb-8 pt-4 pointer-events-none bg-transparent ${keyboardOpen ? 'pb-safe' : ''} ${comparingMessageId ? 'opacity-35 pointer-events-none' : ''}`}
                  style={keyboardOpen ? { paddingBottom: 'env(safe-area-inset-bottom, 8px)' } : undefined}
                >
                  <div ref={setComposerNode} className="px-4 w-full max-w-[880px] flex flex-col justify-center pointer-events-auto gap-2">
                    {!isOnline && (
                      <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <span>●</span>
                        <span>You&apos;re offline. Messages will be queued when you&apos;re back online.</span>
                      </div>
                    )}
                    {chatInputForm}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>

        )}
      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}

      {/* Project detail slide-over */}
      <ProjectDetailPanel project={detailProject} onClose={() => setDetailProject(null)} />

      {/* Compare property selector */}
      {compareOverlayProperties && (
        <CompareSelectorOverlay
          properties={compareOverlayProperties}
          onCancel={() => setCompareOverlayProperties(null)}
          onToast={handleToast}
          onConfirm={(selected: ProjectCardType[]) => {
            setCompareOverlayProperties(null);
            dispatchAction({ type: 'TEXT_MESSAGE', payload: { text: buildPickerMessage('compare', selected) } });
          }}
        />
      )}

      {/* Floating Action Bar for inline compare selection */}
      <AnimatePresence>
        {comparingMessageId && (
          <m.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-[96px] sm:bottom-[120px] left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-3.5 bg-zinc-950/95 text-white border border-blue-500/40 rounded-2xl shadow-[0_16px_45px_rgba(0,0,0,0.55)] backdrop-blur-xl max-w-lg w-[94vw] sm:w-[90vw]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                <Scales size={16} weight="duotone" />
              </div>
              <div>
                <p className="text-[13px] font-bold tracking-tight text-white">Compare Mode Active</p>
                <p className="text-[11px] font-medium text-zinc-400">
                  {selectedCompareProjects.size} of 4 selected (min 2)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelCompare}
                className="px-3.5 py-2 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const selectedList = Array.from(selectedCompareProjects.values());
                  if (selectedList.length < 2) {
                    setToast({ message: 'Select at least 2 properties to compare.' });
                    return;
                  }
                  setComparingMessageId(null);
                  setSelectedCompareProjects(new Map());
                  dispatchAction({ type: 'TEXT_MESSAGE', payload: { text: buildPickerMessage('compare', selectedList) } });
                }}
                disabled={selectedCompareProjects.size < 2}
                className={`px-5 py-2 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                  selectedCompareProjects.size >= 2
                    ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-95'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <span>Compare ({selectedCompareProjects.size})</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Calculator panel */}
      {showCalculator && (
        <CalculatorPanel
          onClose={() => setShowCalculator(false)}
          defaultPriceCr={lastShortlist[0]?.price_min_cr ?? 1.5}
        />
      )}

      {/* ── Site Visit Scheduler modal ── */}
      <AnimatePresence mode="wait">

        {siteVisitProject && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setSiteVisitProject(null) }}
          >
            <m.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white dark:bg-gray-900 shadow-2xl"
            >
              <SiteVisitScheduler
                projectId={siteVisitProject.id}
                projectSlug={siteVisitProject.slug}
                projectName={siteVisitProject.name}
                onClose={() => setSiteVisitProject(null)}
              />
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* ── Callback request modal ── */}
      <CallbackModal
        project={callbackProject}
        isDone={callbackDone}
        onClose={() => { setCallbackProject(null); setCallbackDone(false) }}
      />

      {/* No LeadSuccessModal here: CallbackModal renders its own success screen
          and fires `lead_created` itself. This block was gated on a flag nothing
          ever set, so it was unreachable — and would have been a second, duplicate
          success dialog if it had fired. */}

      {/* ── Share shortlist sheet ── */}
      <ShareShortlistModal
        isOpen={shareSheetOpen}
        shortlist={lastShortlist}
        onClose={() => setShareSheetOpen(false)}
      />

    </div>
  );
}

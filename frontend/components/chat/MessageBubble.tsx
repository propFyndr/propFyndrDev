'use client';

import { memo, useEffect, useRef, useState } from 'react'
import type { HTMLAttributes } from 'react'
import {  m, AnimatePresence  } from 'framer-motion'
import dynamic from 'next/dynamic'
import NextImage from 'next/image'
import {
  ArrowCounterClockwise,
  Copy,
  ThumbsUp,
  ThumbsDown,
  PencilSimple,
  ShieldCheck,
  CheckCircle,
  MapPin,
  Scales,
  CaretDown,
  MagnifyingGlass,
  Warning
} from '@phosphor-icons/react'
import { ResponseFormatter } from './ResponseFormatter'
import DomainExecutionTimeline from './DomainExecutionTimeline'
import { track, trackPropertyEvent } from '@/lib/analytics'
import { parseResponseBlocks } from '@/lib/responseParser'
import { ResponseBlockRenderer } from '@/components/response/ResponseBlockRenderer'
import ProjectCard from '@/components/ProjectCard'
import { MobileCardShelf } from '@/components/chat/MobileCardShelf'
import PropertyQuickActions from '@/components/chat/PropertyQuickActions'
import { SuggestionChip } from '@/components/chat/SuggestionChip'
import { CardSelectorChip } from '@/components/chat/CardSelectorChip'
import { useInlineEdit } from '@/hooks/useInlineEdit'
import type { ChatMessage } from '@/types/property'
import type { ProjectCard as ProjectCardType } from '@/types/project'
import type { ChipPickerState } from './types'
import { PropertyFeedback } from '@/components/chat/PropertyFeedback'

const RealtyChart = dynamic(() => import('@/components/RealtyChart'), {
  ssr: false,
  loading: () => <div className="h-48 bg-slate-100 animate-pulse rounded-xl flex items-center justify-center"><span className="text-sm text-slate-400">Loading chart...</span></div>
})
import RealtyBox from '@/components/RealtyBox'
import ContactButton from '@/components/ContactButton'

// Narrowed shape of ChipAction.payload actually read by the card-selector chip flow.
interface ChipCardPayload {
  projects?: Array<{ id: string; name: string }>
  text?: string
  actionPrefix?: string
  actionSuffix?: string
}

// Lazy: react-markdown + remark/rehype (and parse5 via rehype-raw) are ~600 KB of
// raw JS that nothing needs until the first assistant message renders. Fetched
// while the model streams. See components/response/Markdown.tsx.
const Markdown = dynamic(() => import('@/components/response/Markdown'), {
  ssr: false,
  loading: () => <div className="h-5 w-2/3 rounded bg-slate-100 dark:bg-zinc-800 animate-pulse" />,
})

// ── Dynamic imports — excluded from initial JS bundle ──────────────────────

const SectorMap = dynamic(() => import('@/components/SectorMap'), { ssr: false })
const ComparisonTable = dynamic(() => import('@/components/ComparisonTable'), { ssr: false })
const ComponentRenderer = dynamic(() => import('@/components/ComponentRenderer').then(m => ({ default: m.ComponentRenderer })), { ssr: false })


// ── Props ──────────────────────────────────────────────────────────────────
export interface MessageBubbleProps {
  message: ChatMessage
  index: number
  isLast: boolean
  isSubmitting: boolean
  chatPhase: 'DISCOVERY' | 'ADVISOR'
  isExpanded: boolean
  carouselIndex: number
  lastShortlist: ProjectCardType[]
  showMap: boolean
  userId: string | null
  sessionId: string
  regeneratingIdx: number | null
  chipPicker: ChipPickerState | null
  chips: import('./types').ChipAction[]
  isRestoring?: boolean

  // Callbacks — all stable (useCallback in parent)
  onCopy: (text: string) => void
  onDetailOpen: (project: ProjectCardType | null) => void
  onCallback: (project: ProjectCardType) => void
  onRegenerate: (index: number) => void
  onAction: (action: import('./types').ChipAction) => void
  onEditMessage: (messageId: string, newContent: string) => Promise<void>

  onToggleExpanded: (messageId: string) => void
  onSetChipPicker: (picker: ChipPickerState | null) => void
  onSetCarouselIndex: (msgIndex: number, imgIndex: number) => void
  onSetSiteVisit: (project: ProjectCardType) => void
  onOpenCalculator: () => void
  onOpenShareSheet: () => void
  onToast: (msg: string) => void
  onOpenCompare: (properties: ProjectCardType[]) => void

  comparingMessageId?: string | null
  selectedCompareIds?: Set<string>
  onToggleCompareSelect?: (messageId: string, property: ProjectCardType) => void
  onStartCompare?: (messageId: string, properties: ProjectCardType[]) => void
  onCancelCompare?: () => void
  currentIntent?: Record<string, unknown> | null
}

// ── Message builders ───────────────────────────────────────────────────────
export function buildPickerMessage(action: string, selected: ProjectCardType[]): string {
  const names = selected.map(p => p.name)
  switch (action) {
    case 'payment_plans':
    case 'plans':
      return `Show payment plans for ${names[0]}.`
    case 'cost_sheet':
    case 'cost':
      return `Show cost sheet and taxes for ${names[0]}.`
    case 'site_visit':
    case 'visit':
      return `Schedule a site visit for ${names[0]}.`
    case 'emi':
      return `What would be the monthly EMI for ${names[0]}? Calculate EMI assuming standard lending parameters.`
    case 'stamp_duty':
      return `Calculate stamp duty and registration charges for ${names[0]}.`
    case 'gst':
      return `What is the GST applicable on ${names[0]}?`
    case 'compare':
      return names.length === 2
        ? `Compare ${names[0]} vs ${names[1]} in detail — price, amenities, builder, location, trade-offs.`
        : `Compare ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} in detail.`
    case 'builder':
      return `Tell me about ${selected[0]?.builder ? (typeof selected[0].builder === 'object' ? selected[0].builder.name : selected[0].builder) : names[0]}'s delivery history, reputation, and any complaints.`
    case 'area':
      return `Give me a full area overview of ${selected[0]?.sector || 'the area'} — metro access, schools, hospitals, appreciation potential.`
    case 'risks':
      return `What are the main risks and concerns I should know about ${names[0]}?`
    default:
      return names[0]
  }
}

// ── Unified suggestion chips — all chips use same premium NotebookLM style
export function SuggestionChipGroups({
  chips,
  chipPicker,
  onSetChipPicker,
  onAction,
  isDisabled,
}: {
  chips: import('./types').ChipAction[]
  chipPicker: ChipPickerState | null
  onSetChipPicker: (picker: ChipPickerState | null) => void
  onAction: (action: import('./types').ChipAction) => void
  isDisabled?: boolean
}) {
  if (chips.length === 0) return null

  // Label-level dedup, then cap at 4. Session/id dedup already happened on the
  // server (emitUiState) — this only guards against two different chip ids
  // arriving with the same visible text.
  const dedupedMap = new Map<string, import('./types').ChipAction>()
  chips.forEach(c => {
    const normalized = c.label.toLowerCase().trim()
    if (!dedupedMap.has(normalized)) {
      dedupedMap.set(normalized, c)
    }
  })
  // Copy before sorting — Array.prototype.sort mutates, and this array is
  // derived from props.
  const sorted = [...dedupedMap.values()]
    .sort((a, b) => {
      const byGroup = (a.group?.order ?? -1) - (b.group?.order ?? -1)
      return byGroup !== 0 ? byGroup : a.priority - b.priority
    })
    .slice(0, 4)

  // The engine can label chips into sections (ChipGroup). This component used to
  // drop that metadata entirely and always render one flat row, so group labels
  // the backend built were never shown.
  const groups = new Map<string, import('./types').ChipAction[]>()
  for (const c of sorted) {
    const key = c.group?.label ?? ''
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  const hasLabelledGroups = [...groups.keys()].some(k => k !== '')

  const handleCardSelect = (chip: import('./types').ChipAction, projectId: string) => {
    // Convert card selection to TEXT_MESSAGE for the backend
    const payload = (chip.payload as ChipCardPayload) || {}
    const projects = payload.projects

    // Validate chip has projects array
    if (!projects || projects.length === 0) {
      const fallbackText = payload.text || chip.label
      if (fallbackText) {
        onAction({
          ...chip,
          actionType: 'TEXT_MESSAGE' as const,
          payload: { text: String(fallbackText).trim() }
        })
        return
      }
      console.error('[CHIP] No projects in chip payload:', { chipId: chip.id, chipLabel: chip.label, payload })
      return
    }

    // Try exact match first
    let selectedProject = projects.find(p => String(p.id) === String(projectId))

    // Fallback: try parsing projectId as array index
    if (!selectedProject && projectId) {
      const idx = parseInt(projectId, 10)
      if (!isNaN(idx) && projects[idx]) {
        selectedProject = projects[idx]
      }
    }

    // Final fallback: use first project
    if (!selectedProject) {
      selectedProject = projects[0]
      console.warn('[CHIP] Using fallback project:', { requested: projectId, using: selectedProject.name })
    }

    // Validate action type
    if (chip.actionType !== 'TEXT_MESSAGE') {
      console.error('[CHIP] Chip is not TEXT_MESSAGE:', { chipId: chip.id, actionType: chip.actionType })
      return
    }

    // Build natural language message
    const prefix = String(payload.actionPrefix || chip.label || 'Consider').trim()
    const suffix = String(payload.actionSuffix || '?').trim()

    if (!prefix || !selectedProject?.name) {
      console.error('[CHIP] Missing message parts:', { prefix, projectName: selectedProject?.name })
      return
    }

    const fullMessage = `${prefix} ${selectedProject.name}${suffix}`.trim()

    if (!fullMessage) {
      console.error('[CHIP] Empty message after construction')
      return
    }

    // Send TEXT_MESSAGE
    const textChip = {
      ...chip,
      actionType: 'TEXT_MESSAGE' as const,
      payload: { text: fullMessage }
    }
    onAction(textChip)
  }

  const renderChip = (chip: import('./types').ChipAction) => {
    // Check if chip has multiple projects — use CardSelectorChip
    const projects = (chip.payload as ChipCardPayload | undefined)?.projects
    if (projects && projects.length > 1) {
      return (
        <CardSelectorChip
          key={chip.id}
          chip={chip}
          projects={projects}
          onSelect={handleCardSelect}
          disabled={isDisabled}
        />
      )
    }
    return (
      <SuggestionChip key={chip.id} chip={chip} chipPicker={chipPicker} onSetChipPicker={onSetChipPicker} onAction={onAction} disabled={isDisabled} />
    )
  }

  if (!hasLabelledGroups) {
    return (
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full py-1">
        {sorted.map(renderChip)}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {[...groups.entries()].map(([label, groupChips]) => (
        <div key={label || 'ungrouped'} className="flex flex-col gap-1.5 w-full">
          {label && (
            <span
              className={`text-[10px] font-semibold uppercase tracking-widest px-1 ${
                groupChips[0]?.group?.emphasis === 'primary'
                  ? 'text-zinc-500 dark:text-zinc-400'
                  : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {label}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full py-0.5">
            {groupChips.map(renderChip)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── ChatGPT-Style Inline Message Editor ─────────────────────────────────────
function InlineMessageEditor({
  initialText,
  onSave,
  onCancel,
  onToast,
}: {
  initialText: string
  onSave: (text: string) => Promise<void>
  onCancel: () => void
  onToast: (msg: string) => void
}) {
  const [text, setText] = useState(initialText)
  // Owned here rather than read from useInlineEdit: this editor manages its own
  // draft and never calls the hook's handleSave, so the hook's isLoading could
  // never leave false and the "Saving…" state was unreachable.
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus and set cursor to the END of the text on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(60, textareaRef.current.scrollHeight)}px`
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.max(60, e.target.scrollHeight)}px`
  }

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return
    setIsLoading(true)
    try {
      await onSave(trimmed)
    } catch (err) {
      console.error('Failed to edit message:', err)
      onToast('Failed to save changes')
      // Editor stays open with the draft intact so the edit can be retried.
      setIsLoading(false)
    }
  }

  return (
    <m.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="w-full max-w-2xl bg-[#f4f4f4] dark:bg-[#212121] text-gray-900 dark:text-white border border-gray-200/80 dark:border-white/10 rounded-3xl p-4 sm:p-5 shadow-[0_8px_30px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] flex flex-col gap-3.5"
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleInput}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
        placeholder="Edit your message..."
        rows={2}
        className="w-full bg-transparent text-[15px] sm:text-[15.5px] leading-relaxed text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 border-none outline-none resize-none p-0 focus:ring-0 focus:outline-none"
      />

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-200/60 dark:border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-white rounded-full hover:bg-gray-200/70 dark:hover:bg-zinc-800 transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim() || isLoading}
          className="px-5 py-1.5 text-xs font-bold text-white dark:text-black bg-blue-600 hover:bg-blue-500 dark:bg-white dark:hover:bg-zinc-200 rounded-full transition-all shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
        >
          {isLoading ? <span>Saving...</span> : <span>Save & Submit</span>}
        </button>
      </div>
    </m.div>
  )
}


// ── Custom equality — re-renders on active stream or compare state changes ─
function areEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  if (next.isSubmitting !== prev.isSubmitting) return false
  if (prev.isLast && prev.isSubmitting) return false
  if (prev.comparingMessageId !== next.comparingMessageId) return false
  if (prev.selectedCompareIds !== next.selectedCompareIds) return false
  if (prev.isExpanded !== next.isExpanded) return false
  if (prev.showMap !== next.showMap) return false
  return (
    prev.message.content === next.message.content &&
    prev.message.properties === next.message.properties &&
    prev.message.exactResults === next.message.exactResults &&
    prev.message.nearbyResults === next.message.nearbyResults &&
    prev.message.isSearching === next.message.isSearching &&
    prev.message.expansion === next.message.expansion &&
    prev.message.componentResponse === next.message.componentResponse &&
    prev.message.responseMode === next.message.responseMode &&
    prev.message.showComparisonTable === next.message.showComparisonTable &&
    prev.message.highlights === next.message.highlights &&
    prev.message.amenities === next.message.amenities &&
    prev.message.images === next.message.images &&
    prev.message.is_verified === next.message.is_verified &&
    prev.message.spatialContext === next.message.spatialContext &&
    prev.carouselIndex === next.carouselIndex &&
    prev.chips === next.chips &&
    prev.message.chips === next.message.chips
  )
}

// ── Component ──────────────────────────────────────────────────────────────
function MessageBubbleInner({
  message, index, isLast, isSubmitting, chatPhase,
  isExpanded, carouselIndex, lastShortlist, showMap, userId, sessionId, regeneratingIdx,
  chipPicker, chips, isRestoring,
  onCopy, onDetailOpen, onCallback, onRegenerate, onAction, onEditMessage,

  onToggleExpanded, onSetChipPicker, onSetCarouselIndex,
  onSetSiteVisit, onOpenCalculator, onOpenShareSheet, onToast, onOpenCompare,
  comparingMessageId, selectedCompareIds, onToggleCompareSelect, onStartCompare, onCancelCompare,
  currentIntent,
}: MessageBubbleProps) {
  const isUser = message.type === 'user'
  const [showAllProperties, setShowAllProperties] = useState(false)
  const displayContent = message.content || ''
  const inlineEdit = useInlineEdit(displayContent)
  const rawChips: import('./types').ChipAction[] = [...((message.chips as import('./types').ChipAction[]) || []), ...(isLast ? chips : [])]

  // If no backend chips provided yet on this message, adapt intelligent discovery chips into native SuggestionChips
  if (rawChips.length === 0 && ((message.exactResults?.length ?? 0) > 0 || (message.nearbyResults?.length ?? 0) > 0 || (message.properties?.length ?? 0) > 0)) {
    const pList = message.exactResults || message.nearbyResults || message.properties || []
    const rawSector = (pList[0] as any)?.sector
    const sec = typeof rawSector === 'string' ? rawSector : rawSector?.name || (typeof currentIntent?.sector === 'string' ? currentIntent.sector : '')
    if (sec) {
      rawChips.push({
        id: `more-${sec}`,
        label: `More in ${sec}`,
        actionType: 'TEXT_MESSAGE',
        payload: { text: `Show more verified properties in ${sec}` },
        priority: 1,
        analyticsId: 'more_in_sector',
        icon: 'MapPin'
      })
    }
    rawChips.push({
      id: 'ready-to-move',
      label: 'Ready to Move',
      actionType: 'INTENT_PATCH',
      payload: { patch: { possession: 'immediate' } },
      priority: 2,
      analyticsId: 'ready_to_move',
      icon: 'Clock'
    })
    // A "Compare Properties" chip used to be pushed here whenever two or more
    // results were on screen. The results ribbon directly above the cards
    // already carries a Compare control, and it is the one wired to the
    // selection state, so the chip was a second entry point to the same action
    // sitting a few pixels away from the first. Chips are for the next
    // question, not for repeating a button the buyer can already see.
  }

  const combinedChips: import('./types').ChipAction[] = Array.from(new Map(rawChips.map((c) => [c.id || c.label, c])).values())

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null);
  const touchTimeout = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);
  const chipPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chipPicker) return
    const handleClickOutside = (e: MouseEvent) => {
      if (chipPickerRef.current && !chipPickerRef.current.contains(e.target as Node)) {
        onSetChipPicker(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [chipPicker, onSetChipPicker])

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu]);

  useEffect(() => {
    if (!message.showComparisonTable || !message.comparisonProjects?.length) return
    Promise.all(message.comparisonProjects.map(p =>
      trackPropertyEvent(p.id, 'compare', sessionId, userId).catch(e => {
        console.warn('[TRACKING_ERROR]', e)
      })
    )).catch(() => {})
  }, [message.showComparisonTable, message.comparisonProjects, sessionId, userId])

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isUser || !message.content) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isUser || !message.content) return;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    if (touchTimeout.current !== null) clearTimeout(touchTimeout.current);
    touchTimeout.current = setTimeout(() => {
      setContextMenu({ x: touch.clientX, y: touch.clientY });
    }, 700); // 700ms clean long press threshold
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !touchTimeout.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 8 || dy > 8) {
      clearTimeout(touchTimeout.current);
      touchTimeout.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (touchTimeout.current !== null) {
      clearTimeout(touchTimeout.current);
      touchTimeout.current = null;
    }
    touchStartPos.current = null;
  };

  // The card set the mobile shelf shows. Exact results are what the buyer
  // asked for; nearby is the fallback the grid below uses for the same reason.
  const shelfProjects = (
    (message.exactResults?.length ? message.exactResults : null) ??
    (message.nearbyResults?.length ? message.nearbyResults : null) ??
    message.properties ??
    []
  ) as ProjectCardType[];

  return (
    <m.div
      initial={isRestoring ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: isUser ? 20 : -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={isRestoring ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group/msg`}
    >
      {/* Mobile: cards above the answer, collapsed.
          The response's table pushed every card below the fold on a phone, so
          the one thing the buyer can act on was the hardest to reach. The
          desktop grid further down is hidden at this breakpoint so the cards
          render once, not twice. */}
      {!isUser && (
        <MobileCardShelf
          projects={shelfProjects}
          sector={shelfProjects[0]?.sector ?? null}
          onMap={() => window.dispatchEvent(new CustomEvent('propfyndr:open-map'))}
          canCompare={shelfProjects.length >= 2}
          compareActive={comparingMessageId === message.id}
          onCompare={() => {
            if (comparingMessageId === message.id) {
              onCancelCompare?.()
            } else if (onStartCompare) {
              onStartCompare(message.id, shelfProjects)
            } else {
              onOpenCompare(shelfProjects)
            }
          }}
        >
          {({ visibleProjects, hasMore, showAll, setShowAll }) => (
            <div className="flex flex-col gap-3 w-full">
              {visibleProjects.map((property, pi) => (
                <ProjectCard
                  key={`shelf-${property.id}`}
                  project={property}
                  userId={userId}
                  sessionId={sessionId}
                  index={pi}
                  onDetailOpen={onDetailOpen}
                  onToast={onToast}
                  onAskAI={() => { /* card dispatches its own propfyndr:ask-ai */ }}
                  onSetSiteVisit={onSetSiteVisit}
                  onCall={onCallback}
                />
              ))}
              {hasMore && (
                <div className="mt-2 flex justify-center w-full">
                  <button
                    type="button"
                    onClick={() => setShowAll(prev => !prev)}
                    className="px-5 py-2 bg-gradient-button hover:bg-gradient-button-hover text-white text-[12px] font-bold rounded-full shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>{showAll ? 'Show initial 6 properties' : `View all ${shelfProjects.length} properties (+${shelfProjects.length - 6} more)`}</span>
                    <CaretDown size={13} weight="bold" className={`transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              )}
            </div>
          )}
        </MobileCardShelf>
      )}

      <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
        {isUser && inlineEdit.isEditing ? (
          <InlineMessageEditor
            initialText={displayContent}
            onSave={async (newText) => {
              // Await first, close second. Closing first unmounted the editor before
              // the request resolved, so a failure surfaced a toast with the user's
              // typed text already discarded — and no in-flight state could render.
              // Throwing here is intentional: the editor's own catch shows the toast
              // and keeps the draft on screen.
              await onEditMessage(message.id, newText)
              inlineEdit.setIsEditing(false)
            }}
            onCancel={() => inlineEdit.handleCancel()}
            onToast={onToast}
          />
        ) : (
          /* Message bubble */
          <div
            onContextMenu={handleContextMenu}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            className={`transition-all duration-200 ${
              isUser
                ? 'max-w-[85%] sm:max-w-[75%] bg-blue-600 dark:bg-blue-700 text-white rounded-2xl sm:rounded-[22px] rounded-br-xs px-4 py-2.5 sm:px-5 sm:py-3 shadow-xs select-text'
                : 'w-full max-w-full bg-transparent text-slate-800 dark:text-zinc-200 select-text px-0 py-0.5'
            }`}
          >
          {!isUser ? (
            <div className="relative z-10 space-y-3">
              {(() => {
                const hasProperties = (message.exactResults?.length ?? 0) > 0 || (message.nearbyResults?.length ?? 0) > 0
                const phaseStr = message.streamingPhase ?? ''
                const intent = message.streamingIntent ?? currentIntent ?? null
                const resultCount = message.streamingResultCount ?? (message.exactResults?.length ?? 0) + (message.nearbyResults?.length ?? 0)
                const phase = (phaseStr || undefined) as 'searching' | 'generating' | 'extracting' | undefined
                const isStreamingActive = isLast && isSubmitting

                // Render Domain Execution Timeline at top of AI message (during streaming or when active)
                const showTimeline = isStreamingActive || (!message.content && !hasProperties)

                // Stage A: Stream active / Waiting
                if (showTimeline && !message.content && !hasProperties) {
                  return (
                    <div className="py-1">
                      <DomainExecutionTimeline
                        phase={phase ?? 'extracting'}
                        intent={intent}
                        resultCount={resultCount}
                        spatialContext={message.spatialContext}
                        startedAt={message.streamingStartedAt ?? null}
                        elapsedSeconds={message.streamingElapsedSeconds ?? null}
                        isStreaming={true}
                        queryType={message.responseMode === 'comparison' ? 'comparison' : 'discovery'}
                        defaultExpanded={false}
                      />
                    </div>
                  )
                }

                // Stage B: Database-backed response (80% DB, 20% LLM)
                if (message.responseMode === 'database' && message.chatResponse) {
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200/60 dark:border-zinc-800">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Verified Market Analysis</span>
                      </div>
                      <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3 text-[15.5px] leading-[1.75] text-slate-800 dark:text-zinc-200"
                      >
                        {/* Summary */}
                        {message.chatResponse.message && (
                          <div className="leading-relaxed font-normal">
                            <Markdown>
                              {message.chatResponse.message}
                            </Markdown>
                          </div>
                        )}

                        {/* Metadata badge */}
                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1 font-medium">
                            <ShieldCheck size={14} weight="fill" className="text-blue-600 dark:text-blue-400" />
                            Verified by PropFyndr Data
                          </span>
                        </div>

                        {/* Formatted details: confidence, freshness, warnings */}
                        <ResponseFormatter response={message.chatResponse} />
                      </m.div>
                    </>
                  )
                }

                // Stage C: Component response (verified data pipeline)
                if (message.responseMode === 'components' && message.componentResponse) {
                  const { summary, confidence, components, sources } = message.componentResponse
                  return (
                    <>
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200/60 dark:border-zinc-800">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Verified Data</span>
                      </div>
                      <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-3 text-[15.5px] leading-[1.75] text-slate-800 dark:text-zinc-200"
                      >
                        {/* Summary text */}
                        {summary && (
                          <div className="leading-relaxed font-normal">
                            <Markdown>
                              {summary}
                            </Markdown>
                          </div>
                        )}

                        {/* Confidence score */}
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                          <CheckCircle size={14} weight="fill" />
                          {Math.round(confidence * 100)}% confident
                        </div>

                        {/* Component specs */}
                        <div className="mt-4">
                          <ComponentRenderer specs={components} />
                        </div>

                        {/* Sources attribution */}
                        {sources && sources.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
                            <span className="font-medium">Sources: </span>
                            {sources.join(', ')}
                          </div>
                        )}
                      </m.div>
                    </>
                  )
                }

                // Stage D: AI text streaming or complete (Unboxed Editorial Style)
                if (displayContent || isStreamingActive) {
                  const streaming = isLast && isSubmitting
                  const cleanDisplayContent = displayContent
                    .replace(/<realty-chart\b[^>]*\bdata=["']([\s\S]*?)["'][^>]*\/?>/gi, (_m, data) => '\n\n' + data.trim() + '\n\n')
                    .replace(/<\/?realty-(?:chart|box|action)[^>]*>/gi, '')
                  const blocks = streaming ? null : parseResponseBlocks(cleanDisplayContent)
                  return (
                    <>
                      {/* Optional Domain Execution Timeline pill atop AI response */}
                      {(isStreamingActive || hasProperties) && (
                        <div className="mb-2">
                          <DomainExecutionTimeline
                            phase={isStreamingActive ? phase ?? 'generating' : 'completed'}
                            intent={intent}
                            resultCount={resultCount}
                            spatialContext={message.spatialContext}
                            isStreaming={isStreamingActive}
                            queryType={message.responseMode === 'comparison' ? 'comparison' : 'discovery'}
                            defaultExpanded={false}
                          />
                        </div>
                      )}

                      {message.is_verified === false && (
                        <div className="mb-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40">
                          <p className="text-[12px] text-amber-900 dark:text-amber-200 font-medium inline-flex items-start gap-1.5"><Warning size={13} weight="fill" className="shrink-0 mt-0.5" /> This data is not verified by us. Please confirm with our advisory team before making decisions.</p>
                        </div>
                      )}

                      <m.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className={blocks ? undefined : "prose prose-slate dark:prose-invert max-w-none text-[15.5px] leading-[1.78] font-normal tracking-[-0.01em] text-slate-800 dark:text-zinc-200 prose-p:my-2.5 prose-p:leading-[1.78] prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-zinc-100 prose-headings:tracking-tight prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:font-semibold prose-strong:text-slate-900 dark:prose-strong:text-white prose-blockquote:border-l-2 prose-blockquote:border-blue-500/70 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-600 dark:prose-blockquote:text-zinc-400 prose-table:w-full prose-table:text-sm prose-table:my-4 prose-table:border-collapse"}
                      >
                        {blocks ? (
                          <ResponseBlockRenderer blocks={blocks} />
                        ) : (
                          <>
                            <Markdown
                              raw
                              components={{
                                'realty-chart': ({ node, ...props }: { node?: unknown } & HTMLAttributes<HTMLElement> & { type?: string; data?: string; title?: string }) => <RealtyChart type={props.type ?? ''} data={props.data ?? ''} title={props.title} />,
                                'realty-box': ({ node, ...props }: { node?: unknown } & HTMLAttributes<HTMLElement> & { type?: string; title?: string }) => <RealtyBox type={props.type ?? ''} title={props.title}>{props.children}</RealtyBox>,
                                // Mapped for parity with ResponseBlockRenderer — the shared
                                // sanitizer schema allows realty-action, so it must render as
                                // something rather than leaking an unknown element.
                                'realty-action': ({ node, ...props }: { node?: unknown } & HTMLAttributes<HTMLElement> & { label?: string }) => <ContactButton label={props.label || 'Request Callback'} className="my-2" />,
                                table: ({ node, ...props }: any) => (
                                  <div className="my-3.5 overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white/60 dark:bg-[#121214] shadow-2xs custom-scrollbar touch-pan-y overscroll-x-contain">
                                    <table className="w-full table-auto border-collapse text-left text-xs sm:text-[13.5px] text-slate-800 dark:text-zinc-200" {...props} />
                                  </div>
                                ),
                                thead: ({ node, ...props }: any) => (
                                  <thead className="bg-slate-100/90 dark:bg-zinc-800/90 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 border-b border-slate-200 dark:border-zinc-700/80" {...props} />
                                ),
                                th: ({ node, ...props }: any) => (
                                  <th className="px-2.5 sm:px-4 py-2.5 sm:py-3 font-bold text-slate-900 dark:text-white whitespace-normal sm:whitespace-nowrap break-words" {...props} />
                                ),
                                td: ({ node, ...props }: any) => (
                                  <td className="px-2.5 sm:px-4 py-2.5 sm:py-3.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0 leading-relaxed align-top break-words" {...props} />
                                ),
                                tr: ({ node, ...props }: any) => (
                                  <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors odd:bg-transparent even:bg-slate-50/50 dark:even:bg-zinc-800/20" {...props} />
                                ),
                                a: ({ node, ...props }: any) => {
                                  const href = props.href || ''
                                  if (href.startsWith('#entity:')) {
                                    const projectId = href.slice(8)
                                    const projectName = String(props.children)
                                    return (
                                      <button
                                        onClick={() => onAction?.({
                                          id: `entity:${projectId}`,
                                          actionType: 'TEXT_MESSAGE',
                                          label: `Tell me more about ${projectName}`,
                                          icon: 'ℹ️',
                                          analyticsId: `entity_mention:${projectId}`,
                                          priority: 2,
                                          payload: { text: `Tell me more about ${projectName}` },
                                        })}
                                        className="text-[#c47860] hover:underline cursor-pointer font-semibold"
                                      >
                                        {projectName}
                                      </button>
                                    )
                                  }
                                  return <a {...props} className="text-[#c47860] hover:underline" />
                                }
                              } as any}
                            >
                              {displayContent}
                            </Markdown>
                            {streaming && (
                              <span className="inline-block w-1.5 h-4 bg-blue-600 dark:bg-blue-400 animate-pulse rounded-xs align-middle ml-1.5 shadow-xs" />
                            )}
                          </>
                        )}
                      </m.div>
                    </>
                  )
                }

                return null
              })()}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-[14.5px] sm:text-[15px] font-medium leading-relaxed text-white select-text font-[family-name:var(--font-inter)] tracking-normal">{displayContent}</p>
          )}
        </div>
        )}
      </div>

      <div className={`mt-2 flex items-center w-full ${isUser ? 'justify-end' : 'justify-start'} gap-2.5 px-1`}>
        {message.timestamp && (
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 select-none">
            {new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {isUser && displayContent && !inlineEdit.isEditing && (
          <button
            onClick={() => inlineEdit.setIsEditing(true)}
            title="Edit message"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/50 text-[11px] font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer"
            disabled={inlineEdit.isLoading}
          >
            <PencilSimple size={13} weight="bold" className="text-blue-600 dark:text-blue-400" />
            <span>Edit</span>
          </button>
        )}
        {!isUser && displayContent && (
          <div className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
            <button
              onClick={() => { onCopy(displayContent); onToast('Copied to clipboard'); }}
              title="Copy response"
              className="tap-target-y inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-90 cursor-pointer"
            >
              <Copy size={13} />
            </button>
            <div className="w-[1px] h-3.5 bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={() => { track('answer_feedback', { helpful: true, session_id: sessionId }); onToast('Thanks for the feedback'); }}
              title="Helpful"
              className="tap-target-y inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-90 cursor-pointer"
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => { track('answer_feedback', { helpful: false, session_id: sessionId }); onToast('Thanks for the feedback'); }}
              title="Not helpful"
              className="tap-target-y inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700 transition-all active:scale-90 cursor-pointer"
            >
              <ThumbsDown size={13} />
            </button>
          </div>
        )}
      </div>

      {/* In-chat image gallery */}
      {message.images && message.images.length > 0 && (
        <div className="mt-3 w-full max-w-[90%] md:max-w-[80%]">

          <div className="relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-sm">
            {message.images[carouselIndex]?.type && (
              <div className="absolute top-3 left-3 z-10">
                <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[11px] font-medium capitalize">
                  {(message.images[carouselIndex].type || '').replace(/_/g, ' ')}
                </span>
              </div>
            )}
            {(() => {
              const src = message.images[carouselIndex]?.url ?? message.images[0]?.url;
              return src ? (
                <NextImage
                  src={src}
                  alt={message.images[carouselIndex]?.caption ?? 'Property image'}
                  width={680}
                  height={400}
                  className="w-full h-72 object-cover"
                />
              ) : null;
            })()}

            {message.images.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                {message.images.map((_, imgIdx) => (
                  <button
                    key={imgIdx}
                    onClick={() => onSetCarouselIndex(index, imgIdx)}
                    className={`carousel-dot ${carouselIndex === imgIdx ? 'active' : ''}`}
                  />
                ))}
              </div>
            )}
            {message.images[carouselIndex]?.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-2">
                <p className="text-white text-xs">{message.images[carouselIndex].caption}</p>
              </div>
            )}
          </div>
          {message.images.length > 1 && (
            <p className="text-xs text-gray-400 mt-1.5 text-center">{carouselIndex + 1} / {message.images.length}</p>
          )}
        </div>
      )}

      {/* Highlights */}
      {message.highlights && message.highlights.length > 0 && (
        <div className="mt-3 max-w-[90%] md:max-w-[80%] bg-[#F7F7F7] dark:bg-gray-800 border border-[#E8E8E8] dark:border-gray-700 rounded-2xl px-5 py-4 shadow-sm">

          <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Key Highlights</p>
          <ul className="space-y-2">
            {message.highlights.map((h, hIdx) => (
              <li key={hIdx} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Amenities */}
      {message.amenities && message.amenities.length > 0 && (
        <div className="mt-4 w-full max-w-[95%] sm:max-w-[85%] md:max-w-[75%]">

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {message.amenities.map((amenity, idx) => (
              <div key={idx} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border border-blue-100 dark:border-blue-900/30 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 flex items-center justify-center text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group">
                <span className="text-[12px] sm:text-[13px] font-semibold text-blue-800 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-200">{amenity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NO-FALLBACK Error State: no inventory in exact sector */}
      {(() => {
        const expansion = message.expansion
        if (expansion?.reason === 'no_inventory_in_exact_sector_nofallback' && message.spatialContext?.spatialScope === 'EXACT') {
          return (
            <div className="mt-4 w-full">
              <m.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0"><Warning size={22} weight="fill" className="text-amber-500" /></div>
                  <div className="flex-1 min-w-0">
                    {/* State the actual reason. This banner fires on the backend's
                        NO-FALLBACK path, which means the sector was searched and
                        held nothing — not that anything is overloaded. */}
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Nothing in {message.spatialContext?.anchorSector} matches your criteria
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-200 mt-1.5 leading-relaxed">
                      We only show verified inventory, so we won&apos;t substitute another sector without asking. Try widening the budget or BHK, or ask for nearby sectors.
                    </p>
                  </div>
                </div>
              </m.div>
            </div>
          )
        }
        return null
      })()}

      {/* Property cards — in comparison mode, render compared projects grid */}
      {(() => {
        if (message.responseMode === 'comparison') {
          const compProjects = message.comparisonProjects ?? message.properties ?? []
          if (compProjects.length === 0) return null

          return (
            <div className="mt-4 w-full">
              <div className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center shrink-0 text-zinc-400 dark:text-zinc-500">
                    <Scales size={15} weight="duotone" className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      Comparing {compProjects.length} Properties
                    </span>
                    <span className="hidden sm:inline text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                      Side-by-Side
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                {compProjects.map((property, pi) => (
                  <m.div
                    key={property.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: pi * 0.07, ease: 'easeOut' }}
                    className="w-full h-full flex flex-col"
                  >
                    <ProjectCard
                      project={property}
                      userId={userId}
                      sessionId={sessionId}
                      index={pi}
                      isSelectable={false}
                      isSelected={false}
                      onToggleSelect={() => {}}
                      onDetailOpen={onDetailOpen}
                      onToast={onToast}
                      onAskAI={() => {}}
                      onSetSiteVisit={onSetSiteVisit}
                      onCall={onCallback}
                    />
                  </m.div>
                ))}
              </div>
            </div>
          )
        }

        // New format: exactResults / nearbyResults (set on all fresh messages)
        const useNewFormat = message.exactResults !== undefined
        const rawExactList = message.exactResults ?? []
        const rawNearbyList = message.nearbyResults ?? []
        const expansion = message.expansion
        const rawLegacyList = message.properties ?? []

        // Skip rendering if this is the NO-FALLBACK error state
        if (expansion?.reason === 'no_inventory_in_exact_sector_nofallback') return null

        // Pagination (limit to 6 cards initially)
        const MAX_CARDS = 6
        const totalCards = useNewFormat ? (rawExactList.length + rawNearbyList.length) : rawLegacyList.length
        const hasMoreThanMax = totalCards > MAX_CARDS

        const exactList = showAllProperties ? rawExactList : rawExactList.slice(0, MAX_CARDS)
        const remainingSlots = Math.max(0, MAX_CARDS - exactList.length)
        const nearbyList = showAllProperties ? rawNearbyList : rawNearbyList.slice(0, remainingSlots)
        const legacyList = showAllProperties ? rawLegacyList : rawLegacyList.slice(0, MAX_CARDS)

        const hasExact = rawExactList.length > 0
        const hasNearby = rawNearbyList.length > 0
        const hasLegacy = rawLegacyList.length > 0

        if (useNewFormat && !hasExact && !hasNearby) return null
        if (!useNewFormat && !hasLegacy) return null

        const isOpen = isExpanded

        const primaryCards = useNewFormat ? (hasExact ? exactList : nearbyList) : legacyList
        const fullCardsForCompare = useNewFormat ? (hasExact ? rawExactList : rawNearbyList) : rawLegacyList

        // Build header label based on spatial scope
        let headerLabel = useNewFormat && !hasExact && hasNearby
          ? `${totalCards} nearby ${totalCards === 1 ? 'alternative' : 'alternatives'}`
          : `${totalCards} ${totalCards === 1 ? 'property' : 'properties'} found`

        // NO-FALLBACK for EXACT scope: show error message if no results
        if (message.spatialContext?.spatialScope === 'EXACT' && totalCards === 0) {
          headerLabel = 'No inventory found in requested sector'
        } else if (message.spatialContext?.spatialScope === 'PROXIMITY') {
          headerLabel = hasExact && !hasNearby
            ? `${totalCards} ${totalCards === 1 ? 'property' : 'properties'} in ${message.spatialContext?.anchorSector}`
            : `${totalCards} ${totalCards === 1 ? 'property' : 'properties'} in & around ${message.spatialContext?.anchorSector}`
        }

        /**
         * The place this badge names.
         *
         * It used to read the sector off the FIRST CARD, which labels a whole
         * result set by whichever project happened to rank top: a corridor
         * search returning twenty projects across five sectors was announced as
         * "20 properties found in Sector 1", because Ace Divino sorted first.
         * The badge is about the search, so it takes the sector the search was
         * anchored to; the cards below carry their own.
         *
         * Where several sectors were genuinely searched, say so rather than
         * picking one of them.
         */
        const searchedSectors = expansion?.searchedSectors ?? []
        const headerSector =
          message.spatialContext?.anchorSector
          || (searchedSectors.length > 0
            ? searchedSectors.slice(0, 3).join(', ') + (searchedSectors.length > 3 ? '…' : '')
            : undefined)
          || (new Set(rawExactList.map(p => p.sector)).size === 1
            ? rawExactList[0]?.sector
            : undefined)
          || rawNearbyList[0]?.sector
          || rawLegacyList[0]?.sector

        return (
          <div className="hidden sm:block mt-2 w-full">

            <m.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 px-3.5 py-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/50"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center shrink-0 text-zinc-400 dark:text-zinc-500">
                  {useNewFormat && !hasExact && hasNearby
                    ? <MapPin size={13} weight="fill" />
                    : isLast && isSubmitting
                      ? <MagnifyingGlass size={13} weight="bold" />
                      : <CheckCircle size={13} weight="fill" />}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13.5px] font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {headerLabel}
                  </span>
                  {headerSector && (
                    <span className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400 hidden sm:inline">
                      in {headerSector}
                    </span>
                  )}
                  <span className="hidden sm:inline text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
                    Ranked by fit
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('propfyndr:open-map'))}
                  aria-pressed={showMap}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer border ${
                    showMap
                      ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                      : 'bg-white/80 dark:bg-zinc-800/80 border-slate-200/80 dark:border-zinc-700/80 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500'
                  }`}
                >
                  <MapPin size={13} weight="duotone" className={showMap ? 'text-white' : 'text-blue-500'} />
                  <span className="hidden sm:inline">Map</span>
                </button>
                {fullCardsForCompare.length >= 2 && (
                  <button
                    onClick={() => {
                      if (comparingMessageId === message.id) {
                        onCancelCompare?.()
                      } else if (onStartCompare) {
                        onStartCompare(message.id, fullCardsForCompare)
                      } else {
                        onOpenCompare(fullCardsForCompare)
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer border ${
                      comparingMessageId === message.id
                        ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/30'
                        : 'bg-white/80 dark:bg-zinc-800/80 border-slate-200/80 dark:border-zinc-700/80 text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500'
                    }`}
                  >
                    <Scales size={13} weight="duotone" className={comparingMessageId === message.id ? 'text-white' : 'text-blue-500'} />
                    <span className="hidden sm:inline">{comparingMessageId === message.id ? 'Exit Compare' : 'Compare'}</span>
                  </button>
                )}
                <button
                  onClick={() => onToggleExpanded(message.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer border ${
                    isOpen
                      ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                      : 'bg-white/80 dark:bg-zinc-800/80 border-slate-200/80 dark:border-zinc-700/80 text-slate-700 dark:text-slate-200 hover:border-blue-400'
                  }`}
                >
                  <span>{isOpen ? 'Hide' : `View (${totalCards})`}</span>
                  <CaretDown size={13} weight="bold" className={`transition-transform duration-200 ${isOpen ? 'rotate-180 text-white' : 'text-slate-500'}`} />
                </button>
              </div>
            </m.div>

            {/* Empty sector banner — shown when requested sector has no exact matches */}
            {useNewFormat && !hasExact && hasNearby && expansion && typeof expansion === 'object' && 'requestedSector' in expansion && (
              <m.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3"
              >
                <Warning size={15} weight="fill" className="text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-300">
                    We couldn&apos;t find an exact match in {String(expansion.requestedSector)}
                  </p>
                  <p className="text-[12px] text-amber-700 dark:text-amber-400 mt-0.5 font-medium">
                    {expansion.searchedSectors?.length
                      ? `Showing verified alternatives from ${expansion.searchedSectors.join(', ')}.`
                      : 'Showing verified alternatives nearby.'}
                  </p>
                </div>
              </m.div>
            )}

            {isOpen && (
              <div className="mt-3 w-full">
                {/* Property Results Grid */}
                {(useNewFormat ? exactList : legacyList).length > 0 && (
                  <div className="mt-3">
                    <div className="flex flex-col sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                      {(useNewFormat ? exactList : legacyList).map((property, pi) => (
                        <m.div
                          key={property.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: pi * 0.07, ease: 'easeOut' }}
                          className="w-full h-full flex flex-col"
                        >
                          <ProjectCard
                            project={property}
                            userId={userId}
                            sessionId={sessionId}
                            index={pi}
                            isSelectable={comparingMessageId === message.id}
                            isSelected={Boolean(selectedCompareIds && (
                              selectedCompareIds.has(String(property.id)) ||
                              (property.slug !== undefined && property.slug !== null && selectedCompareIds.has(property.slug))
                            ))}
                            onToggleSelect={() => onToggleCompareSelect?.(message.id, property)}
                            onDetailOpen={onDetailOpen}
                            onToast={onToast}
                            onAskAI={() => { /* card dispatches its own propfyndr:ask-ai */ }}
                            onSetSiteVisit={onSetSiteVisit}
                            onCall={onCallback}
                          />
                          {/* Inline property feedback — unobtrusive, below each card */}
                          {sessionId && property.id && (
                            <m.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: pi * 0.07 + 0.2 }}
                              className="px-1 pt-1.5 pb-0.5"
                            >
                              <PropertyFeedback
                                sessionId={sessionId}
                                projectId={String(property.id)}
                                projectName={property.name}
                              />
                            </m.div>
                          )}
                        </m.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nearby results section */}
                {useNewFormat && hasNearby && (
                  <div className={hasExact ? 'mt-6' : ''}>
                    {hasExact && (
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <MapPin size={12} weight="fill" className="inline-block mr-1 -mt-0.5" />Nearby alternatives · {expansion?.searchedSectors.join(', ')}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col sm:grid sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
                      {nearbyList.map((property, pi) => (
                        <m.div
                          key={property.id}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: pi * 0.07, ease: 'easeOut' }}
                          className="w-full h-full flex flex-col"
                        >
                          <ProjectCard
                            project={property}
                            userId={userId}
                            sessionId={sessionId}
                            index={pi}
                            isSelectable={comparingMessageId === message.id}
                            isSelected={Boolean(selectedCompareIds && (
                              selectedCompareIds.has(String(property.id)) ||
                              (property.slug !== undefined && property.slug !== null && selectedCompareIds.has(property.slug))
                            ))}
                            onToggleSelect={() => onToggleCompareSelect?.(message.id, property)}
                            onDetailOpen={onDetailOpen}
                            onToast={onToast}
                            onAskAI={() => { /* card dispatches its own propfyndr:ask-ai */ }}
                            onSetSiteVisit={onSetSiteVisit}
                            onCall={onCallback}
                          />
                          {/* Inline property feedback for nearby results too */}
                          {sessionId && property.id && (
                            <m.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: pi * 0.07 + 0.2 }}
                              className="px-1 pt-1.5 pb-0.5"
                            >
                              <PropertyFeedback
                                sessionId={sessionId}
                                projectId={String(property.id)}
                                projectName={property.name}
                              />
                            </m.div>
                          )}
                        </m.div>
                      ))}
                    </div>
                  </div>
                )}

                {showMap && primaryCards.length >= 2 && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md w-full">
                    <SectorMap properties={primaryCards} />
                  </div>
                )}

                {hasMoreThanMax && (
                  <div className="mt-4 flex justify-center w-full">
                    <button
                      onClick={() => setShowAllProperties(prev => !prev)}
                      className="px-6 py-2.5 bg-gradient-button hover:bg-gradient-button-hover text-white text-[12px] font-bold rounded-full shadow-md hover:shadow-lg transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      <span>{showAllProperties ? 'Show initial 6 properties' : `View remaining ${totalCards - MAX_CARDS} properties (All ${totalCards})`}</span>
                      <CaretDown size={14} weight="bold" className={`transition-transform duration-200 ${showAllProperties ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        )
      })()}

      {/* Advisor shortlist re-surface */}
      {message.type === 'ai' && chatPhase === 'ADVISOR' && !message.exactResults?.length && !message.nearbyResults?.length && !message.properties?.length && lastShortlist.length > 0 && isLast && (
        <div className="mt-3 w-full">

          <button
            onClick={() => onToggleExpanded(message.id)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl text-[12px] font-semibold text-blue-700 transition-all"
          >
            <span>View {lastShortlist.length} shortlisted properties</span>
            <CaretDown size={14} weight="bold" className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
          {isExpanded && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lastShortlist.map((p, pi) => (
                <div key={p.id} className="flex flex-col">
                  <ProjectCard 
                    project={p} 
                    userId={userId} 
                    index={pi} 
                    onDetailOpen={onDetailOpen} 
                    onToast={onToast}
                    quickActions={
                      <PropertyQuickActions
                        project={p}
                        onDetailOpen={onDetailOpen}
                        onCallback={onCallback}
                        onSetSiteVisit={onSetSiteVisit}
                        onOpenCalculator={onOpenCalculator}
                        onOpenShareSheet={onOpenShareSheet}
                      />
                    }
                  />
                </div>

              ))}
            </div>
          )}
        </div>
      )}

      {/* Progressive chips from Conversation Engine — strictly active on the latest assistant turn */}
      {(() => {
        const isLatestAiMessage = Boolean(isLast) && message.type === 'ai';
        const hasText = Boolean(displayContent);
        const hasProps = Boolean(message.exactResults?.length || message.nearbyResults?.length || message.properties?.length);
        const hasDb = Boolean(message.chatResponse);
        const shouldShow = isLatestAiMessage && (hasText || hasProps || hasDb) && combinedChips.length > 0 && !isSubmitting;
        return shouldShow;
      })() && (
        <m.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mt-3"
        >
          <SuggestionChipGroups
            chips={combinedChips}
            chipPicker={chipPicker}
            onSetChipPicker={onSetChipPicker}
            onAction={onAction}
            isDisabled={isSubmitting}
          />

          <AnimatePresence mode="wait">
            {chipPicker && (
              <m.div
                ref={chipPickerRef}
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-2xl p-3 shadow-lg">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                      {chipPicker.mode === 'multi' ? 'Select properties to compare' : 'Which property?'}
                    </span>
                    <button onClick={() => onSetChipPicker(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none px-1">×</button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {lastShortlist.map((p) => {
                      const isSelected = chipPicker.selected.includes(p.slug)
                      const checkedState = isSelected ? 'checked' : 'unchecked'
                      const ariaLabel = `${p.name}, ${p.price_range_label || ''} in ${p.sector || ''} (${checkedState})`
                      return (
                        <button
                          key={p.slug}
                          role={chipPicker.mode === 'multi' ? 'checkbox' : undefined}
                          aria-checked={chipPicker.mode === 'multi' ? isSelected : undefined}
                          aria-label={chipPicker.mode === 'multi' ? ariaLabel : undefined}
                          onClick={() => {
                            if (chipPicker.mode === 'single') {
                              onSetChipPicker(null)
                              if (chipPicker.isModal) {
                                if (chipPicker.action === 'site_visit') { onSetSiteVisit(p); return }
                                if (chipPicker.action === 'callback') { onCallback(p); return }
                              }
                              onAction({
                                id: crypto.randomUUID(),
                                actionType: 'TEXT_MESSAGE',
                                label: chipPicker.action,
                                icon: '',
                                analyticsId: '',
                                priority: 1,
                                payload: { text: buildPickerMessage(chipPicker.action, [p]) }
                              })

                            } else {
                              onSetChipPicker({
                                ...chipPicker,
                                selected: isSelected
                                  ? chipPicker.selected.filter(s => s !== p.slug)
                                  : chipPicker.selected.length < 3 ? [...chipPicker.selected, p.slug] : chipPicker.selected,
                              })
                            }
                          }}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all border ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-800 dark:text-blue-200'
                              : 'border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {chipPicker.mode === 'multi' && (
                              <div className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border ${
                                isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {isSelected && <span className="text-white text-[10px]">✓</span>}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-[13px] truncate">{p.name}</div>
                              <div className="text-[11px] text-gray-400 dark:text-gray-500">{[p.price_range_label || '', p.sector || ''].filter(Boolean).join(' · ')}</div>

                            </div>
                          </div>
                          {chipPicker.mode === 'single' && (
                            <span className="text-gray-300 dark:text-gray-600 text-xs ml-2 flex-shrink-0">→</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {chipPicker.mode === 'multi' && chipPicker.selected.length >= 2 && (
                    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-700">
                      <button
                        onClick={() => {
                          const selected = lastShortlist.filter(p => chipPicker.selected.includes(p.slug))
                          onSetChipPicker(null)
                          onAction({
                            id: crypto.randomUUID(),
                            actionType: 'TEXT_MESSAGE',
                            label: 'Compare',
                            icon: '',
                            analyticsId: '',
                            priority: 1,
                            payload: { text: buildPickerMessage(chipPicker.action, selected) }
                          })

                        }}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-[13px] font-semibold rounded-xl transition-all"
                      >
                        Compare {chipPicker.selected.length} properties →
                      </button>
                    </m.div>
                  )}
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </m.div>
      )}



      {/* A hardcoded "Want to know more?" grid used to sit here: four fixed
          follow-ups (Explain the cost / Builder background / What could go wrong /
          How does it compare) in their own blue style.

          It was a second chip layer stacked under the real one. The conversation
          engine already emits contextual chips for the turn through combinedChips;
          these four were static, ignored the intent, and rendered in a palette
          nothing else uses, so the buyer saw two different-looking chip rows and
          no way to tell which was which. Removed in favour of the engine.

          NOTE: keep this as a braced JSX comment. Bare double-slash lines in a
          JSX children position are not comments at all — React renders them as
          literal text, which is exactly what shipped: the whole paragraph
          appeared in the chat above the results header. */}

      {/* Comparison table */}
      {message.type === 'ai' && message.showComparisonTable && (message.comparisonProjects?.length ?? 0) >= 2 && (
        <div className="mt-3 w-full">
          <ComparisonTable projects={message.comparisonProjects!} />
        </div>
      )}

      {/* Context Menu (Right Click / Long Press) */}
      <AnimatePresence mode="wait">
        {contextMenu && (
          <m.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 bg-white dark:bg-gray-800 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-gray-700 rounded-xl py-1.5 w-48 overflow-hidden"
            style={{ 
              top: Math.min(contextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 100 : contextMenu.y), 
              left: Math.min(contextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 200 : contextMenu.x)
            }}
          >
            <button
              onClick={() => { onCopy(message.content); setContextMenu(null); onToast('Copied to clipboard'); }}
              className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
            >
              <Copy size={14} className="text-gray-400" /> Copy Response
            </button>
            {chatPhase === 'ADVISOR' && index > 0 && !message.properties?.length && (
              <button
                onClick={() => { onRegenerate(index); setContextMenu(null); }}
                disabled={regeneratingIdx === index || isSubmitting}
                className="w-full text-left px-4 py-2.5 text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2.5 transition-colors disabled:opacity-50"
              >
                <ArrowCounterClockwise size={14} weight="bold" className={`text-gray-400 ${regeneratingIdx === index ? 'animate-spin' : ''}`} /> 
                {regeneratingIdx === index ? 'Regenerating...' : 'Regenerate'}
              </button>
            )}
          </m.div>
        )}
      </AnimatePresence>
    </m.div>

  )
}

export const MessageBubble = memo(MessageBubbleInner, areEqual)
export default MessageBubble

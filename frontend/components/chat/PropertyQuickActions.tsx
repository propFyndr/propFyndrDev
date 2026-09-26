'use client'

import { PhoneCall, ShareNetwork, Robot } from '@phosphor-icons/react'
import type { ProjectCard as ProjectCardType } from '@/types/project'
import type { ConversationStage } from '@/components/chat/types'

interface Props {
  project: ProjectCardType
  stage?: ConversationStage
  onDetailOpen?: (project: ProjectCardType) => void
  onCallback?: (project: ProjectCardType) => void
  onSetSiteVisit: (project: ProjectCardType) => void
  onOpenCalculator: () => void
  onOpenShareSheet: () => void
}

export default function PropertyQuickActions({ project, onCallback, onOpenShareSheet }: Props) {
  const handleAskAI = () => {
    window.dispatchEvent(
      new CustomEvent('propfyndr:ask-ai', {
        detail: { text: `Tell me more about ${project.name}` },
      }),
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 mt-4 relative w-full font-sans">
      {/* Left: Request Callback (30%) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onCallback?.(project); }}
        className="flex-[3] h-11 flex flex-shrink-0 items-center justify-center gap-1.5 rounded-full bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors duration-150 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        aria-label="Request Callback"
        title="Request Callback from Advisor"
      >
        <span className="relative flex items-center justify-center">
          <PhoneCall size={16} weight="duotone" className="text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-200" />
        </span>
        <span className="text-xs font-semibold hidden sm:inline">Callback</span>
      </button>

      {/* Center: Ask AI (40%) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handleAskAI(); }}
        className="flex-[4] h-11 flex flex-shrink-0 items-center justify-center gap-1.5 bg-primary hover:bg-primary-dark text-white rounded-full text-[13px] font-medium active:scale-[0.98] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      >
        <Robot size={18} weight="duotone" aria-hidden="true" />
        Ask AI
      </button>

      {/* Right: Share (30%) */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenShareSheet(); }}
        className="flex-[3] h-11 flex flex-shrink-0 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-150 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
        aria-label="Share"
        title="Share Project"
      >
        <ShareNetwork size={17} weight="duotone" className="group-hover:scale-110 transition-transform duration-200 text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-800 dark:group-hover:text-zinc-200" />
      </button>
    </div>
  )
}

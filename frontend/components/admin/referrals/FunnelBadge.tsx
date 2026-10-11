// Funnel-stage badge — four distinct colors reusing the existing status-chip
// pattern (informational, not a CTA, so this doesn't trip the single-accent
// rule from the design audit). Priority order (converted > activated >
// chatted_shallow > arrived_no_chat) is decided server-side by
// classifyFunnelStage — this component only renders whatever stage it's given.
import type { ReactNode } from 'react'
import { MessageCircle, Zap, Trophy, Footprints } from 'lucide-react'

export type FunnelStage = 'arrived_no_chat' | 'chatted_shallow' | 'activated' | 'converted'

const STYLES: Record<FunnelStage, { label: string; className: string; icon: ReactNode }> = {
  arrived_no_chat: {
    label: 'Arrived',
    className: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
    icon: <Footprints size={11} />,
  },
  chatted_shallow: {
    label: 'Chatted',
    className: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
    icon: <MessageCircle size={11} />,
  },
  activated: {
    label: 'Activated',
    className:
      'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60',
    icon: <Zap size={11} className="fill-current" />,
  },
  converted: {
    label: 'Converted',
    className: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60',
    icon: <Trophy size={11} />,
  },
}

export default function FunnelBadge({ stage }: { stage: FunnelStage }) {
  const style = STYLES[stage]
  return (
    <span
      data-testid="funnel-badge"
      data-stage={stage}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.className}`}
    >
      {style.icon}
      {style.label}
    </span>
  )
}

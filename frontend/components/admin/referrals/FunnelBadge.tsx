// Funnel-stage badge — refined status-chip with Apple/Seline pill styling
// Priority order: converted > activated > chatted_shallow > arrived_no_chat
import type { ReactNode } from 'react'
import { MessageCircle, Zap, Trophy, Footprints } from 'lucide-react'

export type FunnelStage = 'arrived_no_chat' | 'chatted_shallow' | 'activated' | 'converted'

const STYLES: Record<FunnelStage, { label: string; className: string; icon: ReactNode }> = {
  arrived_no_chat: {
    label: 'Arrived',
    className: 'bg-stone-100/80 dark:bg-zinc-800/70 text-stone-600 dark:text-zinc-400 border-stone-200/80 dark:border-zinc-700/80 shadow-2xs',
    icon: <Footprints size={11} className="shrink-0" />,
  },
  chatted_shallow: {
    label: 'Chatted',
    className: 'bg-blue-50/80 dark:bg-blue-950/40 text-[#0066cc] dark:text-[#2997ff] border-blue-200/70 dark:border-blue-800/60 shadow-2xs',
    icon: <MessageCircle size={11} className="shrink-0" />,
  },
  activated: {
    label: 'Activated',
    className: 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/70 dark:border-emerald-800/60 shadow-2xs',
    icon: <Zap size={11} className="fill-current shrink-0" />,
  },
  converted: {
    label: 'Converted',
    className: 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/70 dark:border-amber-800/60 shadow-2xs',
    icon: <Trophy size={11} className="shrink-0" />,
  },
}

// How each stage is qualified — mirrors classifyFunnelStage and
// summariseDeviceEngagement (backend/src/lib/referralGrowthMetrics.ts) plus
// the conversion events in backend/src/routes/adminReferrals.ts. Keep in step.
export const FUNNEL_STAGE_DEFINITIONS: { stage: FunnelStage; rule: string }[] = [
  { stage: 'arrived_no_chat', rule: 'Opened a referral link on this device, but has not sent a message.' },
  { stage: 'chatted_shallow', rule: 'Sent at least one message (counted across all chats) but has not activated yet.' },
  {
    stage: 'activated',
    rule: 'Sent 3+ messages in total across their chats, or came back 24h+ after their first chat. People who converted also count as activated in every total.',
  },
  { stage: 'converted', rule: 'Requested a callback, generated a dossier, or requested a site visit.' },
]

export function FunnelStageDefinitions() {
  return (
    <div className="space-y-2">
      <p className="font-semibold">Each device shows its highest stage.</p>
      <ul className="space-y-1.5">
        {FUNNEL_STAGE_DEFINITIONS.map(({ stage, rule }) => (
          <li key={stage} className="flex gap-2">
            <span className="shrink-0">
              <FunnelBadge stage={stage} />
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
      <p className="text-[#6e6e73] dark:text-[#98989d]">
        A device is one browser (guest token). Counts cover all time; bot chats are ignored, and devices with only bot chats are left out.
      </p>
    </div>
  )
}

export default function FunnelBadge({ stage }: { stage: FunnelStage }) {
  const style = STYLES[stage]
  return (
    <span
      data-testid="funnel-badge"
      data-stage={stage}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-tight border transition-all ${style.className}`}
    >
      {style.icon}
      <span>{style.label}</span>
    </span>
  )
}

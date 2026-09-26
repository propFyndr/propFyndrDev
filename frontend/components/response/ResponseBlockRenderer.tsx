'use client'

import React from 'react'
import { Trophy, ChartBar, CheckCircle, Buildings } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { Skeleton } from '@/components/ui/skeleton'
import type { ResponseBlock, BlockType } from '@/lib/responseParser'
import {
  extractNameReason,
  extractTable,
  extractQuickPickRows,
  extractBestForPairs,
  extractSectorList,
  extractCoverageIntro,
  parseSingleProjectHeader,
  extractSingleProjectBullets,
} from '@/lib/responseParser'
const RealtyChart = dynamic(() => import('@/components/RealtyChart'), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full rounded-xl" />
})
import RealtyBox from '@/components/RealtyBox'
import ContactButton from '@/components/ContactButton'
import { DossierShareCard } from '@/components/chat/DossierShareCard'

// Lazy: pulls react-markdown + remark/rehype (and parse5 via rehype-raw) out of
// the /discover entry chunk. See components/response/Markdown.tsx.
const Markdown = dynamic(() => import('@/components/response/Markdown'), {
  ssr: false,
  loading: () => <Skeleton className="h-16 w-full rounded-lg" />,
})

// ── Card shell ────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface dark:bg-zinc-900 p-4">
      {children}
    </div>
  )
}

function Label({ icon: Icon, text }: { icon?: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 text-zinc-500 dark:text-zinc-400">
      {Icon && <Icon size={12} weight="bold" aria-hidden="true" />}
      <span className="text-[11px] font-semibold">{text}</span>
    </div>
  )
}

// ── Individual cards ─────────────────────────────────────────────────────────

function OurPickCard({ block }: { block: ResponseBlock }) {
  const { name, reason } = extractNameReason(block.body)
  return (
    <Card>
      <Label icon={Trophy} text="Our pick" />
      {name && <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">{name}</p>}
      {reason && <p className="text-[14px] text-zinc-700 dark:text-zinc-300 mt-1 leading-snug">{reason}</p>}
    </Card>
  )
}

function QuickPicksCard({ block }: { block: ResponseBlock }) {
  const rows = extractQuickPickRows(block.body)
  if (rows.length === 0) return null
  return (
    <Card>
      <Label icon={ChartBar} text="Quick picks" />
      <div className="space-y-2">
        {rows.map((r, i) => {
          const dash = r.text.indexOf(' — ')
          const name = dash !== -1 ? r.text.slice(0, dash).trim() : r.text
          const why = dash !== -1 ? r.text.slice(dash + 3).trim() : ''
          return (
            <div key={i} className="flex items-start gap-3">
              <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 w-24 flex-shrink-0 pt-0.5">{r.category}</span>
              <div className="text-[13px]">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{name}</span>
                {why && <span className="text-zinc-600 dark:text-zinc-400 ml-1">— {why}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * A single-project block.
 *
 * The header carries a verdict word (STRONG BUY / BUY / CONSIDER / WATCH /
 * AVOID). It used to render as a coloured pill, which read as a confident
 * rating from a system that only has the reasons below to go on. The reasons
 * are the advice; the verdict pill is gone, and so is the colour it keyed.
 */
function SingleProjectCard({ block }: { block: ResponseBlock }) {
  const { name } = parseSingleProjectHeader(block.headerLine)
  const bullets = extractSingleProjectBullets(block.body)
  return (
    <Card>
      {name && <p className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 mb-2 leading-tight">{name}</p>}
      {bullets.length > 0 && (
        <ul className="list-disc pl-5 marker:text-zinc-400 space-y-1">
          {bullets.map((b, i) => (
            <li key={i} className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-snug">{b}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function WhyWinsCard({ block }: { block: ResponseBlock }) {
  const parsed = extractTable(block.body)
  const winnerMatch = block.headerLine.match(/\*\*Why (.+) wins\*\*/)
  const winner = winnerMatch?.[1] ?? ''
  if (!parsed || parsed.rows.length === 0) return null
  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-surface dark:bg-zinc-900">
      {winner && (
        <div className="px-4 pt-3">
          <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Why {winner} wins</span>
        </div>
      )}
      <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {parsed.headers.map((h, i) => (
                <th key={i} className="px-4 py-2 text-left text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 border-b border-border">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((row, i) => (
              <tr key={i} className="border-t border-border">
                {row.map((cell, j) => (
                  <td key={j} className={`px-4 py-2 tabular-nums ${j === 0 ? 'font-medium text-zinc-600 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BestForCard({ block }: { block: ResponseBlock }) {
  const items = extractBestForPairs(block.body)
  if (items.length === 0) return null
  return (
    <Card>
      <Label text="Best for" />
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2 text-[13px]">
            <span className="font-medium text-zinc-900 dark:text-zinc-50 flex-shrink-0">{item.project}</span>
            <span className="text-zinc-400" aria-hidden="true">→</span>
            <span className="text-zinc-700 dark:text-zinc-300 leading-snug">{item.type}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function BottomLineCard({ block }: { block: ResponseBlock }) {
  return (
    <Card>
      <Label icon={CheckCircle} text="Bottom line" />
      <p className="text-[14px] text-zinc-800 dark:text-zinc-200 leading-snug">{block.body}</p>
    </Card>
  )
}

function CoverageStatusCard({ block }: { block: ResponseBlock }) {
  const intro = extractCoverageIntro(block.body)
  const sectors = extractSectorList(block.body)
  const question = block.body.split('\n').find(l => l.trim().startsWith('Want'))?.trim()
  return (
    <Card>
      <Label icon={Buildings} text="Coverage status" />
      {intro && <p className="text-[13px] text-zinc-700 dark:text-zinc-300 mb-3">{intro}</p>}
      {sectors.length > 0 && (
        <div className="space-y-2 mb-3">
          {sectors.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-[12px]">
              <span className="font-medium text-zinc-900 dark:text-zinc-50 w-28 flex-shrink-0">{s.name}</span>
              <span className="text-zinc-600 dark:text-zinc-400 leading-snug">{s.reason}</span>
            </div>
          ))}
        </div>
      )}
      {question && <p className="text-[13px] text-zinc-600 dark:text-zinc-400">{question}</p>}
    </Card>
  )
}

function TextBlock({ block, renderText }: { block: ResponseBlock; renderText?: (body: string) => React.ReactNode }) {
  if (!block.body) return null
  // The chat passes its own renderer so finished answers keep the streaming
  // text style and its #entity: link handling.
  if (renderText) return <>{renderText(block.body)}</>
  // Tables, lists and headings take Markdown's own styles — one table style
  // across every answer surface.
  return (
    <Markdown
      raw
      components={{
        'realty-chart': ({ node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLElement> & { type?: string; data?: string; title?: string }) => <RealtyChart type={props.type ?? ''} data={props.data ?? ''} title={props.title} />,
        'realty-box': ({ node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLElement> & { type?: string; title?: string }) => <RealtyBox type={props.type ?? ''} title={props.title}>{props.children}</RealtyBox>,
        'realty-action': ({ node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLElement> & { label?: string }) => <ContactButton label={props.label || 'Request Callback'} className="my-2" />,
        a: ({ node, ...props }: any) => {
          const href = props.href || ''
          if (href.startsWith('/dossier/') || href.includes('/dossier/')) {
            return (
              <DossierShareCard
                href={href}
                label={String(props.children) || 'Dossier of this conversation'}
              />
            )
          }
          return <a {...props} className="text-primary hover:underline" />
        }
      } as any}
    >
      {block.body}
    </Markdown>
  )
}

// ── Renderer ──────────────────────────────────────────────────────────────────

const CARD_MAP: Record<BlockType, React.FC<{ block: ResponseBlock; renderText?: (body: string) => React.ReactNode }>> = {
  our_pick:        OurPickCard,
  quick_picks:     QuickPicksCard,
  single_project:  SingleProjectCard,
  why_wins:        WhyWinsCard,
  best_for:        BestForCard,
  bottom_line:     BottomLineCard,
  coverage_status: CoverageStatusCard,
  text:            TextBlock,
}

export function ResponseBlockRenderer({ blocks, renderText }: { blocks: ResponseBlock[]; renderText?: (body: string) => React.ReactNode }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        const CardCmp = CARD_MAP[block.type]
        return CardCmp ? <CardCmp key={i} block={block} renderText={renderText} /> : null
      })}
    </div>
  )
}

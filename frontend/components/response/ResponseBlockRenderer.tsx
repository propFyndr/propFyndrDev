'use client'

import React from 'react'
import { Trophy, BarChart2, CheckCircle, Building2 } from 'lucide-react'
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

function Card({ accentCls, children }: { accentCls: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm">
      <div className={`h-0.5 w-full ${accentCls}`} />
      <div className="p-4">{children}</div>
    </div>
  )
}

function Label({ icon: Icon, text, cls }: { icon?: React.ElementType; text: string; cls: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      {Icon && <Icon size={10} className={cls} />}
      <span className={`text-[9px] font-black uppercase tracking-[0.12em] ${cls}`}>{text}</span>
    </div>
  )
}

// ── Individual cards ─────────────────────────────────────────────────────────

function OurPickCard({ block }: { block: ResponseBlock }) {
  const { name, reason } = extractNameReason(block.body)
  const isVerdict = /Verdict/i.test(block.headerLine)
  return (
    <Card accentCls="bg-[#0064E5]">
      <Label icon={Trophy} text={isVerdict ? 'Verdict' : 'Our Pick'} cls="text-[#0064E5]" />
      {name && <p className="text-[15px] font-black text-gray-900 dark:text-white leading-tight">{name}</p>}
      {reason && <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">{reason}</p>}
    </Card>
  )
}

function QuickPicksCard({ block }: { block: ResponseBlock }) {
  const rows = extractQuickPickRows(block.body)
  if (rows.length === 0) return null
  return (
    <Card accentCls="bg-gray-200 dark:bg-gray-600">
      <Label icon={BarChart2} text="Quick Picks" cls="text-gray-400 dark:text-gray-500" />
      <div className="space-y-2">
        {rows.map((r, i) => {
          const dash = r.text.indexOf(' — ')
          const name = dash !== -1 ? r.text.slice(0, dash).trim() : r.text
          const why = dash !== -1 ? r.text.slice(dash + 3).trim() : ''
          return (
            <div key={i} className="flex items-start gap-3">
              <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{r.category}</span>
              <div>
                <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-100">{name}</span>
                {why && <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-1">— {why}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

/**
 * Verdict styling, keyed on the verdict word itself.
 *
 * This used to be keyed on a coloured emoji the model was asked to prefix the
 * header with, and the parser took the header's first character as the key. The
 * verdict word was already sitting beside it in bold, so the pictograph carried
 * nothing the text did not — but it was the half the styling depended on.
 *
 * That coupling was dangerous. Anything that stopped the emoji arriving — a
 * model that declines to use them, a provider that strips them, the editorial
 * no-emoji rule — fell through to the CONSIDER default, and every project in
 * the response was labelled CONSIDER regardless of what the advisor actually
 * concluded. A fabricated verdict, rendered confidently.
 */
const BADGE: Record<string, { chip: string; accent: string }> = {
  'STRONG BUY': { chip: 'bg-[#0064E5] text-white',   accent: 'bg-[#0064E5]' },
  BUY:          { chip: 'bg-emerald-600 text-white', accent: 'bg-emerald-400' },
  CONSIDER:     { chip: 'bg-amber-500 text-white',   accent: 'bg-amber-400' },
  WATCH:        { chip: 'bg-orange-500 text-white',  accent: 'bg-orange-400' },
  AVOID:        { chip: 'bg-red-600 text-white',     accent: 'bg-red-400' },
}

/** Neutral styling for a header whose verdict we could not read. */
const BADGE_UNKNOWN = { chip: 'bg-slate-500 text-white', accent: 'bg-slate-400' }

function SingleProjectCard({ block }: { block: ResponseBlock }) {
  const { label, name } = parseSingleProjectHeader(block.headerLine)
  const bullets = extractSingleProjectBullets(block.body)
  // An unreadable verdict renders neutrally rather than borrowing another one.
  const cfg = BADGE[label] ?? BADGE_UNKNOWN
  return (
    <Card accentCls={cfg.accent}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${cfg.chip}`}>{label}</span>
      </div>
      {name && <p className="text-[14px] font-black text-gray-900 dark:text-white mb-2 leading-tight">{name}</p>}
      {bullets.length > 0 && (
        <div className="space-y-1">
          {bullets.map((b, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[#0064E5] text-[10px] mt-0.5 flex-shrink-0">•</span>
              <span className="text-[12px] text-gray-600 dark:text-gray-400 leading-snug">{b}</span>
            </div>
          ))}
        </div>
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
    <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-700/60 bg-white dark:bg-gray-800/80 shadow-sm">
      <div className="h-0.5 w-full bg-gray-200 dark:bg-gray-600" />
      {winner && (
        <div className="px-3 sm:px-4 pt-3 pb-0">
          <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.12em]">Why {winner} wins</span>
        </div>
      )}
      <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
        <table className="w-full text-[11px] sm:text-xs">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/60">
              {parsed.headers.map((h, i) => (
                <th key={i} className="px-3 sm:px-4 py-2 text-left text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-wide border-b border-gray-100 dark:border-gray-700/60">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parsed.rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-100 dark:border-gray-700/40">
                {row.map((cell, j) => (
                  <td key={j} className={`px-3 sm:px-4 py-2 sm:py-2.5 ${j === 0 ? 'font-bold text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
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
    <Card accentCls="bg-emerald-300 dark:bg-emerald-700">
      <Label text="Best For" cls="text-emerald-600 dark:text-emerald-400" />
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[12px] font-black text-gray-800 dark:text-gray-100 flex-shrink-0">{item.project}</span>
            <span className="text-gray-300 dark:text-gray-600 text-[12px]">→</span>
            <span className="text-[12px] text-gray-500 dark:text-gray-400 leading-snug">{item.type}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function BottomLineCard({ block }: { block: ResponseBlock }) {
  return (
    <Card accentCls="bg-emerald-400">
      <Label icon={CheckCircle} text="Bottom Line" cls="text-emerald-600 dark:text-emerald-400" />
      <p className="text-[13px] font-semibold text-emerald-900 dark:text-emerald-200 leading-snug">{block.body}</p>
    </Card>
  )
}

function CoverageStatusCard({ block }: { block: ResponseBlock }) {
  const intro = extractCoverageIntro(block.body)
  const sectors = extractSectorList(block.body)
  const question = block.body.split('\n').find(l => l.trim().startsWith('Want'))?.trim()
  return (
    <Card accentCls="bg-gray-300 dark:bg-gray-600">
      <Label icon={Building2} text="Coverage Status" cls="text-gray-500 dark:text-gray-400" />
      {intro && <p className="text-[12px] text-gray-600 dark:text-gray-400 mb-3">{intro}</p>}
      {sectors.length > 0 && (
        <div className="space-y-2 mb-3">
          {sectors.map((s, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200 w-28 flex-shrink-0">{s.name}</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{s.reason}</span>
            </div>
          ))}
        </div>
      )}
      {question && <p className="text-[12px] text-gray-500 dark:text-gray-400 italic">{question}</p>}
    </Card>
  )
}

function TextBlock({ block, renderText }: { block: ResponseBlock; renderText?: (body: string) => React.ReactNode }) {
  if (!block.body) return null
  // The chat passes its own renderer so finished answers keep the streaming
  // text style and its #entity: link handling.
  if (renderText) return <>{renderText(block.body)}</>
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-table:text-sm">
      <Markdown
        raw
        components={{
          'realty-chart': ({ node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLElement> & { type?: string; data?: string; title?: string }) => <RealtyChart type={props.type ?? ''} data={props.data ?? ''} title={props.title} />,
          'realty-box': ({ node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLElement> & { type?: string; title?: string }) => <RealtyBox type={props.type ?? ''} title={props.title}>{props.children}</RealtyBox>,
          'realty-action': ({ node, ...props }: { node?: unknown } & React.HTMLAttributes<HTMLElement> & { label?: string }) => <ContactButton label={props.label || 'Request Callback'} className="my-2" />,
          table: ({ node, ...props }: any) => (
            <div className="my-3 sm:my-4 overflow-x-auto overscroll-x-contain rounded-xl sm:rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-[#111622] shadow-xs custom-scrollbar touch-pan-y overscroll-x-contain">
              <table className="w-full table-auto border-collapse text-left text-[11px] sm:text-xs md:text-sm text-slate-700 dark:text-zinc-300" {...props} />
            </div>
          ),
          thead: ({ node, ...props }: any) => (
            <thead className="bg-slate-100/90 dark:bg-zinc-800/90 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300 border-b border-slate-200 dark:border-zinc-700/80" {...props} />
          ),
          th: ({ node, ...props }: any) => (
            <th className="px-2.5 sm:px-4 py-2 sm:py-3 font-bold text-slate-900 dark:text-slate-100 whitespace-normal sm:whitespace-nowrap break-words" {...props} />
          ),
          td: ({ node, ...props }: any) => (
            <td className="px-2.5 sm:px-4 py-2.5 sm:py-3.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0 leading-relaxed align-top break-words" {...props} />
          ),
          tr: ({ node, ...props }: any) => (
            <tr className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors odd:bg-transparent even:bg-slate-50/50 dark:even:bg-zinc-800/30" {...props} />
          ),
          a: ({ node, ...props }: any) => {
            const href = props.href || ''
            if (href.startsWith('/dossier/') || href.includes('/dossier/')) {
              return (
                <DossierShareCard
                  href={href}
                  label={String(props.children) || 'View & Share Family Deal Dossier'}
                />
              )
            }
            return <a {...props} className="text-[#c47860] hover:underline" />
          }
        } as any}
      >
        {block.body}
      </Markdown>
    </div>
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

'use client'

// Single owner of the markdown pipeline.
//
// Why this file exists: `rehype-raw` depends on `parse5` (~565 KB of raw JS).
// MessageBubble and ResponseBlockRenderer each imported react-markdown and the
// three plugins at module scope, so parse5 landed in the /discover entry chunk —
// which also defeated ResponseBlockRenderer's `dynamic(() => import('react-markdown'))`,
// since the plugins it needs were eager anyway.
//
// Consumers must pull this in via `next/dynamic` so the whole pipeline is one
// lazy chunk, fetched while the model is still streaming rather than before the
// chat can paint.

import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'

const base = defaultSchema ?? { tagNames: [], attributes: {} }

/**
 * Sanitizer allow-list for our custom elements and entity links.
 */
export const REALTY_SCHEMA = {
  ...base,
  tagNames: [...(base.tagNames ?? []), 'realty-chart', 'realty-box', 'realty-action'],
  protocols: {
    ...(base.protocols ?? {}),
    href: [...(base.protocols?.href ?? ['http', 'https', 'mailto', 'tel']), '#entity'],
  },
  attributes: {
    ...(base.attributes ?? {}),
    a: ['href', 'target', 'rel', 'className'],
    'realty-chart': ['type', 'data', 'title'],
    'realty-box': ['type', 'title'],
    'realty-action': ['type', 'label'],
  },
}

// Hoisted so the plugin arrays keep a stable identity across renders — a fresh
// array each render makes react-markdown rebuild its processor on every keystroke
// of a streaming response.
const REMARK_PLUGINS = [remarkGfm]
const REHYPE_PLUGINS = [rehypeRaw, [rehypeSanitize, REALTY_SCHEMA]] as never[]

/**
 * Clean Client-Side Markdown Formatter.
 *
 * Formats project bullet lists into structured highlighted badges,
 * promotes project categories to headers, strips internal citations,
 * eliminates raw leaked entity UUIDs, and ensures mobile-friendly typography.
 */
function beautifyMarkdown(content: string): string {
  if (!content || typeof content !== 'string') return ''

  return content
    // Fix split entity links: [Name] ... (#entity:uuid) -> [Name](#entity:uuid)
    .replace(/\[([^\]]+)\](?:\s*[A-Za-z0-9]+)?\s*\(#entity:([0-9a-fA-F-]+)\)/g, '[$1](#entity:$2)')
    // Strip any raw or unlinked entity UUIDs so they never leak into buyer view
    .replace(/\s*\(#entity:[0-9a-fA-F-]+\)/gi, '')
    .replace(/#entity:[0-9a-fA-F-]+/gi, '')
    // 1. Strip any stray source parentheticals
    .replace(/\s*\((?:market\s+data|propfyndr\s+data|verified\s+data|our\s+data|unverified)\)/gi, '')
    // 2. Promote category subheadings ("Ready-to-Move Projects:", "Under-Construction Projects:")
    .replace(/(?:^|\n)(Ready-to-Move Projects|Under-Construction Projects|Key Projects|Recommended Projects|Top Societies):/gi, '\n\n#### $1\n')
    // 3. Highlight project name and sector tags cleanly in bullet items
    .replace(/^-\s+([A-Za-z0-9\s&'-]+)\s*\((Sector\s+[^)\n]+|Techzone\s+[^)\n]+|Greater\s+Noida\s+[^)\n]+)\)\s*:\s*/gim, '- **$1** *($2)* — ')
    .trim()
}

export interface MarkdownProps {
  children: string
  components?: Components
  raw?: boolean
}

export default function Markdown({ children, components, raw = false }: MarkdownProps) {
  const processed = beautifyMarkdown(children)

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none text-[14.5px] sm:text-[15.5px] leading-[1.75] text-slate-800 dark:text-zinc-200">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={raw ? REHYPE_PLUGINS : undefined}
        components={{
          p: ({ children }) => <p className="mb-3 leading-[1.75] font-normal">{children}</p>,
          ul: ({ children }) => <ul className="my-2.5 space-y-2 list-none pl-0">{children}</ul>,
          ol: ({ children }) => <ol className="my-2.5 space-y-2 list-decimal list-inside pl-1">{children}</ol>,
          li: ({ children }) => (
            <li className="leading-[1.7] text-slate-700 dark:text-zinc-300 font-normal pl-3 border-l-2 border-blue-500/40 dark:border-blue-500/30 my-1.5 py-0.5">
              {children}
            </li>
          ),
          h3: ({ children }) => <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-white mt-4 mb-2">{children}</h3>,
          h4: ({ children }) => <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mt-3.5 mb-1.5">{children}</h4>,
          table: ({ children }) => (
            <div className="my-3.5 overflow-x-auto rounded-xl border border-gray-200/80 dark:border-zinc-800 shadow-xs touch-pan-y overscroll-x-contain">
              <table className="w-full text-left text-[11.5px] sm:text-sm divide-y divide-gray-200 dark:divide-zinc-800">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="bg-gray-100/90 dark:bg-zinc-800/90 px-3 py-2 font-semibold text-slate-900 dark:text-white border-b border-gray-200 dark:border-zinc-700 whitespace-nowrap text-xs sm:text-sm">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2 border-b border-gray-100 dark:border-zinc-800/60 text-xs sm:text-sm">{children}</td>,
          strong: ({ children }) => <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>,
          em: ({ children }) => <span className="inline-block px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] sm:text-xs font-medium not-italic ml-1 mr-0.5">{children}</span>,
          ...components,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}

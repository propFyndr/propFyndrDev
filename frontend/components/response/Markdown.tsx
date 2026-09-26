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
    // 4. A lead-in whose list was stripped can end on an opened, never-closed
    //    `**` ("micro-markets are: **"), which renders as literal asterisks.
    .replace(/([:：])[^\S\n]*\*\*[^\S\n]*(?=\n|$)/g, '$1')
    .trim()
}

export interface MarkdownProps {
  children: string
  components?: Components
  raw?: boolean
}

export default function Markdown({ children, components, raw = false }: MarkdownProps) {
  const processed = beautifyMarkdown(children)

  // The one prose wrapper for every answer surface. Reading width is capped on
  // the text elements, not here, so tables and embedded cards keep full width.
  return (
    <div className="prose prose-zinc dark:prose-invert max-w-none text-[15px] leading-[1.6] text-zinc-800 dark:text-zinc-200">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={raw ? REHYPE_PLUGINS : undefined}
        components={{
          p: ({ children }) => <p className="my-3 max-w-[68ch] leading-[1.6]">{children}</p>,
          ul: ({ children }) => <ul className="my-3 max-w-[68ch] list-disc pl-5 marker:text-zinc-400">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 max-w-[68ch] list-decimal pl-5 marker:text-zinc-400">{children}</ol>,
          li: ({ children }) => <li className="my-1 pl-0 leading-[1.6]">{children}</li>,
          h1: ({ children }) => <h2 className="max-w-[68ch] text-[17px] font-semibold text-zinc-900 dark:text-zinc-50 mt-5 mb-2">{children}</h2>,
          h2: ({ children }) => <h2 className="max-w-[68ch] text-[17px] font-semibold text-zinc-900 dark:text-zinc-50 mt-5 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="max-w-[68ch] text-[15px] font-semibold text-zinc-900 dark:text-zinc-50 mt-4 mb-1.5">{children}</h3>,
          h4: ({ children }) => <h4 className="max-w-[68ch] text-[15px] font-medium text-zinc-900 dark:text-zinc-50 mt-3 mb-1">{children}</h4>,
          blockquote: ({ children }) => <blockquote className="max-w-[68ch] border-l-2 border-zinc-300 dark:border-zinc-700 pl-4 not-italic text-zinc-600 dark:text-zinc-400">{children}</blockquote>,
          a: ({ node, ...props }) => <a {...props} className="text-primary hover:underline" />,
          // touch-action must allow BOTH axes. `touch-pan-y` alone told the
          // browser to ignore horizontal swipes on this box, so wide tables
          // could not be scrolled sideways on a phone (diagonal swipes stuck).
          table: ({ children }) => (
            <div className="not-prose my-3 overflow-x-auto rounded-sm border border-border touch-pan-x touch-pan-y overscroll-x-contain">
              <table className="w-full border-collapse text-left text-[13px] text-zinc-800 dark:text-zinc-200">{children}</table>
            </div>
          ),
          th: ({ node, style, ...props }) => <th style={style} className="bg-surface-2 dark:bg-zinc-900 px-3 py-2 text-[12px] font-semibold text-zinc-600 dark:text-zinc-300 border-b border-border whitespace-nowrap" {...props} />,
          // GFM column alignment (`|---:|`) arrives as style; passing it through
          // is what lets money columns sit right-aligned.
          td: ({ node, style, ...props }) => <td style={style} className="px-3 py-2 border-b border-border align-top tabular-nums" {...props} />,
          strong: ({ children }) => <strong className="font-semibold text-zinc-900 dark:text-zinc-50">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ...components,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}

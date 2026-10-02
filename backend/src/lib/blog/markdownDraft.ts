// backend/src/lib/blog/markdownDraft.ts
// Parses the model's Markdown article into the block shape the rest of the
// pipeline checks and converts (see generateDraft.ts).
//
// Why Markdown and not JSON: measured on Groq gpt-oss-120b, the strict JSON
// schema added ~5,000 prompt tokens per call and the null-padded output hit the
// 5,000-token cap, truncating drafts to ~350 words. The same article as
// Markdown took ~1,400 prompt and ~2,000 completion tokens: 4.5s instead of
// 11s, at full length. Only the small subset the prompt asks for is parsed.
import type { Draft } from './generateDraft'

type Span = { text: string; bold?: boolean; italic?: boolean; href?: string }
type Block = Draft['blocks'][number]

// [text](url) | <span href="url">text</span> (a form the model falls back to) | **bold** | *italic* | _italic_
const INLINE = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|<span\s+href="(https?:\/\/[^"]+)">([^<]+)<\/span>|\*\*([^*]+)\*\*|\*([^*\s][^*]*?)\*|(?<![\w])_([^_\s][^_]*?)_(?![\w])/g

export function parseInline(line: string): Span[] {
  const spans: Span[] = []
  let last = 0
  for (const m of line.matchAll(INLINE)) {
    if (m.index! > last) spans.push({ text: line.slice(last, m.index) })
    if (m[1]) spans.push({ text: m[1], href: m[2] })
    else if (m[3]) spans.push({ text: m[4], href: m[3] })
    else if (m[5]) spans.push({ text: m[5], bold: true })
    else spans.push({ text: m[6] ?? m[7], italic: true })
    last = m.index! + m[0].length
  }
  if (last < line.length) spans.push({ text: line.slice(last) })
  return spans.filter(s => s.text.length > 0)
}

const META = /^\s*\**\s*(TITLE|EXCERPT|META_TITLE|META_DESCRIPTION)\s*\**\s*:\s*(.*)$/i
const LIST_ITEM = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/

/** Returns null when the text is not a usable article (no title or no body). */
export function parseMarkdownDraft(raw: string): Draft | null {
  const text = raw.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/, '')
  const meta: Record<string, string> = {}
  const blocks: Block[] = []
  let para: string[] = []
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null

  const flushPara = () => {
    if (para.length) blocks.push({ type: 'p', spans: parseInline(para.join(' ')) })
    para = []
  }
  const flushList = () => {
    if (list?.items.length) blocks.push({ type: list.type, items: list.items.map(parseInline) })
    list = null
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    const metaMatch = !blocks.length && !para.length ? META.exec(line) : null
    if (metaMatch) {
      meta[metaMatch[1].toUpperCase()] = metaMatch[2].trim()
      continue
    }
    if (!line.trim() || /^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushPara()
      flushList()
      continue
    }
    const heading = /^\s*(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      flushPara()
      flushList()
      const textOnly = parseInline(heading[2]).map(s => s.text).join('').trim()
      // h1 is the post title, already in TITLE; never a body heading.
      if (heading[1].length >= 2 && textOnly) blocks.push({ type: heading[1].length === 2 ? 'h2' : 'h3', text: textOnly })
      continue
    }
    const item = LIST_ITEM.exec(line)
    if (item) {
      flushPara()
      const type = item[2] ? 'ol' : 'ul'
      if (list && list.type !== type) flushList()
      list ??= { type, items: [] }
      list.items.push(item[3])
      continue
    }
    const quote = /^\s*>\s?(.*)$/.exec(line)
    if (quote) {
      flushPara()
      flushList()
      if (quote[1].trim()) blocks.push({ type: 'quote', spans: parseInline(quote[1]) })
      continue
    }
    // An indented line right after a list item continues that item.
    if (list && /^\s{2,}\S/.test(rawLine)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`
      continue
    }
    flushList()
    para.push(line.trim())
  }
  flushPara()
  flushList()

  const cleaned = blocks.filter(b => !('spans' in b) || b.spans.length > 0)
  if (!meta.TITLE || cleaned.length < 4) return null
  return {
    title: meta.TITLE,
    excerpt: meta.EXCERPT ?? '',
    meta_title: meta.META_TITLE ?? meta.TITLE.slice(0, 60),
    meta_description: meta.META_DESCRIPTION ?? meta.EXCERPT ?? '',
    blocks: cleaned,
  }
}

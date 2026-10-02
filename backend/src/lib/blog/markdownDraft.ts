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
const TABLE_ROW = /^\s*\|.*\|\s*$/
const TABLE_RULE = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

/**
 * "phrase.[2]" footnote citations become a link on the clause before the
 * marker: the model numbers sources when it sees them in a list, and a bare
 * "[2]" on a public page is a citation artefact with no link behind it.
 */
export function linkFootnotes(text: string, sourceUrls: string[]): string {
  const link = (clause: string, punct: string, url: string | undefined) => {
    if (!url) return clause + punct // unknown reference: drop the artefact, keep the words
    const lead = /^\s*/.exec(clause)![0]
    return `${lead}[${clause.trim()}](${url})${punct}`
  }
  // A decimal point is not a sentence end: "29.7 km" must stay in one clause.
  const DECIMAL = '\u0000'
  return text
    .replace(/(\d)\.(\d)/g, `$1${DECIMAL}$2`)
    // "clause[2]" — numbered footnotes.
    .replace(/([^.!?\n\[\]【]*[^.!?\n\[\]【\s])([.!?,;:]?)((?:\s?\[\d+\])+)/g, (_w, clause: string, punct: string, refs: string) =>
      link(clause, punct, sourceUrls[Number(/\d+/.exec(refs)![0]) - 1]))
    // "clause【https://…】" or "clause【3】" — the corner-bracket style gpt-oss also emits.
    // A URL is kept only if it is one of the sources; anything else is dropped.
    .replace(/([^.!?\n\[\]【]*[^.!?\n\[\]【\s])\s?【([^】]*)】([.!?,;:]?)/g, (_w, clause: string, ref: string, punct: string) => {
      const url = /^https?:\/\//.test(ref.trim()) ? sourceUrls.find(u => u === ref.trim()) : sourceUrls[Number(/\d+/.exec(ref)?.[0] ?? 0) - 1]
      return link(clause, punct, url)
    })
    .replaceAll(DECIMAL, '.')
}

/** A Markdown table becomes a list: the article renderer has no tables. */
function tableToList(rows: string[]): string[] {
  const cells = (r: string) => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
  const [head, ...body] = rows.filter(r => !TABLE_RULE.test(r)).map(cells)
  if (!head || !body.length) return []
  return body.map(row => `- **${row[0]}**: ${row.slice(1).map((c, i) => `${head[i + 1] ?? ''} ${c}`.trim()).join('. ')}.`)
}

/**
 * Typography the style guide asks for. Non-breaking and figure hyphens become
 * plain ones; a spaced dash between numbers reads "to"; after a bold list
 * label it becomes a colon; anywhere else, a comma. Em dashes are the most
 * recognisable machine-writing tell.
 */
export function normalizeTypography(line: string): string {
  return line
    .replace(/[‐‑‒]/g, '-')
    .replace(/(\d)[ \u00a0\u202f]%/g, '$1%') // also the non-breaking spaces models use before %
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
    .replace(/^(\s*(?:[-*•]|\d+[.)])\s+\*\*[^*]+\*\*)\s*[–—-]\s+/, '$1: ')
    .replace(/\s+[–—]\s+/g, ', ')
    .replace(/(\w)[—](\w)/g, '$1, $2')
    // "Key takeaway: X" is template residue; the sentence stands on its own.
    .replace(/^(\s*(?:[-*•]\s+)?)\**\s*(?:key takeaways?|note|pro tip|bottom line|tl;?dr)\s*:\s*\**\s*(\S?)/i,
      (_m, lead: string, first: string) => lead + first.toUpperCase())
}

/** Returns null when the text is not a usable article (no title or no body). */
export function parseMarkdownDraft(raw: string, sourceUrls: string[] = []): Draft | null {
  const unfenced = raw.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/, '')
  const lines: string[] = []
  let table: string[] = []
  for (const l of linkFootnotes(unfenced, sourceUrls).split(/\r?\n/)) {
    if (TABLE_ROW.test(l) || (table.length && TABLE_RULE.test(l))) { table.push(l); continue }
    if (table.length) { lines.push(...tableToList(table), ''); table = [] }
    lines.push(normalizeTypography(l))
  }
  if (table.length) lines.push(...tableToList(table))
  const text = lines.join('\n')
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

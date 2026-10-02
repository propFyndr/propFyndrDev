// backend/src/lib/blog/generateDraft.ts
// AI blog draft generator. Picks the least recently used keyword, researches it
// with the existing web search (real URLs only), asks Groq for a structured
// article, and saves it as a DRAFT. Nothing here ever publishes: a human reviews
// every post in /admin/blog first (§ Trust First).
//
// Citation rule: the model may only link to URLs the search actually returned.
// Any other href is stripped in code, so a draft can never carry a made-up link.
import Groq from 'groq-sdk'
import { z } from 'zod'
import { prisma } from '../db'
import { tavilySearch, type WebResult } from '../web'
import { MODELS } from '../config'

const Span = z.object({
  text: z.string().min(1),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  href: z.string().optional(),
})
const Spans = z.array(Span).min(1)
const Block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('h2'), text: z.string().min(1) }),
  z.object({ type: z.literal('h3'), text: z.string().min(1) }),
  z.object({ type: z.literal('p'), spans: Spans }),
  z.object({ type: z.literal('quote'), spans: Spans }),
  z.object({ type: z.literal('ul'), items: z.array(Spans).min(1) }),
  z.object({ type: z.literal('ol'), items: z.array(Spans).min(1) }),
])
export const DraftSchema = z.object({
  title: z.string().min(10).max(120),
  excerpt: z.string().min(20).max(300),
  meta_title: z.string().max(70),
  meta_description: z.string().max(170),
  blocks: z.array(Block).min(4),
})
export type Draft = z.infer<typeof DraftSchema>
type SpanT = z.infer<typeof Span>
type TiptapNode = { type: string; attrs?: Record<string, unknown>; content?: TiptapNode[]; text?: string; marks?: { type: string; attrs?: Record<string, unknown> }[] }

/** Converts model blocks to Tiptap JSON. Links not in `allowed` are dropped (text kept). */
export function toTiptap(blocks: Draft['blocks'], allowed: Set<string>): { doc: TiptapNode; cited: Set<string>; dropped: string[] } {
  const cited = new Set<string>()
  const dropped: string[] = []
  const spans = (ss: SpanT[]): TiptapNode[] => ss.map(s => {
    const marks: NonNullable<TiptapNode['marks']> = []
    if (s.bold) marks.push({ type: 'bold' })
    if (s.italic) marks.push({ type: 'italic' })
    if (s.href) {
      if (allowed.has(s.href)) { marks.push({ type: 'link', attrs: { href: s.href } }); cited.add(s.href) }
      else dropped.push(s.href)
    }
    return { type: 'text', text: s.text, ...(marks.length ? { marks } : {}) }
  })
  const para = (ss: SpanT[]): TiptapNode => ({ type: 'paragraph', content: spans(ss) })
  const list = (type: string, items: SpanT[][]): TiptapNode => ({ type, content: items.map(i => ({ type: 'listItem', content: [para(i)] })) })

  const content = blocks.map((b): TiptapNode => {
    switch (b.type) {
      case 'h2': return { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: b.text }] }
      case 'h3': return { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: b.text }] }
      case 'p': return para(b.spans)
      case 'quote': return { type: 'blockquote', content: [para(b.spans)] }
      case 'ul': return list('bulletList', b.items)
      case 'ol': return list('orderedList', b.items)
    }
  })
  return { doc: { type: 'doc', content }, cited, dropped }
}

/**
 * Figures in the draft that appear in none of the sources. Not proof of a wrong
 * number (a source may phrase it differently), so it only feeds review notes.
 * ponytail: exact string match on digit runs; normalise units if it flags too much.
 */
export function unsourcedFigures(draftText: string, sourceText: string): string[] {
  const nums = draftText.match(/\d[\d,.]*\d|\d{2,}/g) ?? []
  return [...new Set(nums)].filter(n => !sourceText.includes(n) && !/^(19|20)\d\d$/.test(n))
}

function blockText(blocks: Draft['blocks']): string {
  return blocks.map(b => 'text' in b ? b.text : 'spans' in b ? b.spans.map(s => s.text).join('') : b.items.flat().map(s => s.text).join(' ')).join('\n')
}

const SYSTEM = `You write blog articles for PropFyndr, an AI real estate advisor for home buyers in Noida, India.
Voice: a capable, honest peer. Plain and direct. No hype, no exclamation marks, no "dream home" language.
Show trade-offs and risks as readily as benefits.

FACT RULES (non-negotiable):
- State a number, date, rate, rule or named fact ONLY if it appears in the SOURCES. Otherwise speak generally.
- When you use a fact from a source, attach that source's URL as "href" on the span stating it. Use URLs exactly as given in SOURCES; never invent or modify a URL.
- Do not recommend, rank or praise any specific project or builder.
- If the sources are thin, write a shorter, more general article rather than filling gaps.

FORMAT: return ONE JSON object:
{"title": str, "excerpt": str (1-2 sentences), "meta_title": str (<=60 chars), "meta_description": str (<=155 chars),
 "blocks": [ {"type":"h2","text":str} | {"type":"h3","text":str} | {"type":"p","spans":[Span]} | {"type":"quote","spans":[Span]} | {"type":"ul"|"ol","items":[[Span]]} ]}
Span = {"text": str, "bold"?: true, "italic"?: true, "href"?: str}
Use bold for the one key takeaway in a section, italics for terms being defined. Use 4-7 h2 sections, at least one list,
and end with a short "What to check before you decide" list. 800-1300 words.`

function groqClient(): Groq {
  const apiKey = process.env.GROQ_BLOG_API_KEY || process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_BLOG_API_KEY (or GROQ_API_KEY) is not set')
  return new Groq({ apiKey, maxRetries: 1 })
}

async function uniqueSlug(title: string): Promise<string> {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
  for (let i = 0; ; i++) {
    const slug = i ? `${base}-${i + 1}` : base
    if (!(await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } }))) return slug
  }
}

export interface GenerateResult { postId: string; keyword: string; reviewNotes: string[] }

/** Generates one draft. `keyword` overrides the rotation (admin "generate on this topic"). */
export async function generateBlogDraft(keyword?: string): Promise<GenerateResult> {
  const kwRow = keyword ? null : await prisma.blogKeyword.findFirst({
    where: { active: true },
    orderBy: [{ last_used_at: { sort: 'asc', nulls: 'first' } }, { created_at: 'asc' }],
  })
  const topic = keyword?.trim() || kwRow?.keyword
  if (!topic) throw new Error('No active blog keywords. Add one in /admin/blog.')

  const search = await tavilySearch(`${topic} Noida home buyers`, 6, { restrictDomains: false })
  const sources: WebResult[] = search.results.filter(r => r.url.startsWith('https://'))
  const sourceBlock = sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content.slice(0, 1500)}`).join('\n\n')

  const resp = await groqClient().chat.completions.create({
    model: MODELS.GROQ_SMART,
    temperature: 0.4,
    max_tokens: 4000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `TOPIC: ${topic}\n\nSOURCES:\n${sourceBlock || '(none found — write a general article with no figures and no links)'}` },
    ],
  })
  const parsed = DraftSchema.safeParse(JSON.parse(resp.choices[0]?.message?.content ?? '{}'))
  if (!parsed.success) throw new Error(`Model returned an invalid draft: ${parsed.error.issues[0]?.message}`)
  const draft = parsed.data

  const { doc, cited, dropped } = toTiptap(draft.blocks, new Set(sources.map(s => s.url)))
  if (cited.size) {
    doc.content!.push(
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sources' }] },
      { type: 'bulletList', content: sources.filter(s => cited.has(s.url)).map(s => ({
        type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: s.title || s.url, marks: [{ type: 'link', attrs: { href: s.url } }] }] }],
      })) },
    )
  }

  const notes = [`AI draft on "${topic}". ${sources.length} sources found, ${cited.size} cited.`]
  if (dropped.length) notes.push(`Removed ${dropped.length} link(s) not returned by search.`)
  const unsourced = unsourcedFigures(blockText(draft.blocks), sources.map(s => s.content).join('\n'))
  if (unsourced.length) notes.push(`Figures not found in any source, verify or remove: ${unsourced.slice(0, 12).join(', ')}`)
  if (!sources.length) notes.push('Web search returned nothing; article is general only.')

  const post = await prisma.blogPost.create({
    data: {
      title: draft.title,
      slug: await uniqueSlug(draft.title),
      excerpt: draft.excerpt,
      content: JSON.stringify(doc),
      meta_title: draft.meta_title,
      meta_description: draft.meta_description,
      status: 'draft',
      review_notes: notes.join('\n'),
    },
  })
  if (kwRow) {
    await prisma.blogKeyword.update({ where: { id: kwRow.id }, data: { last_used_at: new Date(), use_count: { increment: 1 } } })
  }
  return { postId: post.id, keyword: topic, reviewNotes: notes }
}

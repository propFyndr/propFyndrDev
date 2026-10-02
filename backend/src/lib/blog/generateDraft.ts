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
import type { BlogPost } from '@prisma/client'
import { parseMarkdownDraft } from './markdownDraft'

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
  excerpt: z.string().max(500),
  // Loose on purpose: lengths are SEO targets that checkDraftQuality reports;
  // rejecting here would force a whole new model call for a quick edit.
  meta_title: z.string().max(200),
  meta_description: z.string().max(400),
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
- When you use a fact from a source, make the phrase stating it a Markdown link to that source: [phrase](URL). Use URLs exactly as given in SOURCES; never invent or modify a URL. Link the phrase once, not every mention.
- Nothing from memory: a figure, date or event you know but cannot find in SOURCES must not appear, not even as "a recent report says". Quoting a source without its link is not allowed either.
- A number you calculate yourself (an example) gets NO link. Introduce it as "for example" and show the arithmetic.
- Do not describe forms, procedures, offices or deadlines unless a source states them.
- Examples must not invent project names, builder names, registration numbers or account numbers.
- Stay on Noida and Uttar Pradesh. Do not compare with other states or cities.
- Do not recommend, rank or praise any specific project or builder.
- If the sources are thin, write a shorter, more general article rather than filling gaps.

STRUCTURE (checked in code; a draft that breaks these is sent back):
1. title: 40-65 characters, the phrase a buyer would search for, and name Noida (or UP / Uttar Pradesh for a state-wide rule). No clickbait, no question marks.
2. meta_title: at most 60 characters. meta_description: 120-155 characters, saying what the reader will learn.
3. excerpt: 1-2 sentences, 100-200 characters.
4. Start with 1-2 intro paragraphs, no heading first. The first two sentences answer the core question directly.
5. Then 3-5 body h2 sections, each answering a different sub-question with 2-3 paragraphs (or a paragraph plus a list). Section headings at most 70 characters, FAQ questions at most 110, all different. h3 only inside a section.
6. Paragraphs at most 4 sentences. At least one list in the body.
7. Then the h2 "What to check before you decide" with a list of 4-6 checks.
8. Then the h2 "Frequently asked questions" with 3-4 h3 questions, each followed by a 1-3 sentence paragraph answer. FACT RULES apply.
9. Bold at most one key takeaway per section; italics for terms being defined.
10. 550-750 words in total; under 400 is sent back. High-signal advice, with a worked example where it helps. No filler, no repeated points.
11. UNIQUENESS: the article must take an angle that none of the EXISTING ARTICLES already covers. Never reuse one of their titles or near-copies of them.

FORMAT: plain Markdown, nothing else (no code fences). The first four lines, exactly:
TITLE: ...
EXCERPT: ...
META_TITLE: ...
META_DESCRIPTION: ...
Then a blank line and the article: "## " for sections, "### " for FAQ questions, "- " or "1. " for list items, **bold**, *italic*, [phrase](URL) for a cited fact. No "# " heading, no images, no tables, no HTML.`

// ── Uniqueness ──────────────────────────────────────────────────────────────
// Words that say nothing about what an article is about.
const STOP = new Set('a an and the of for in on to with what how why your you is are vs from at by or noida up uttar pradesh buyers buyer home homes flat flats guide explained'.split(' '))
const titleWords = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)))

/** Jaccard overlap of the meaningful words in two titles (0..1). */
export function titleSimilarity(a: string, b: string): number {
  const x = titleWords(a), y = titleWords(b)
  if (!x.size || !y.size) return 0
  let shared = 0
  for (const w of x) if (y.has(w)) shared++
  return shared / (x.size + y.size - shared)
}

/** At or above this, two titles are treated as the same article. */
export const DUPLICATE_THRESHOLD = 0.6

export function findDuplicateTitle(title: string, existing: string[]): string | null {
  const norm = title.trim().toLowerCase()
  return existing.find(e => e.trim().toLowerCase() === norm || titleSimilarity(title, e) >= DUPLICATE_THRESHOLD) ?? null
}

// ── Structure and SEO rules ─────────────────────────────────────────────────
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length
const spanText = (ss: SpanT[]) => ss.map(s => s.text).join('')

/**
 * `rewrite` problems send the draft back once; `notes` only go to the reviewer.
 * The split is deliberate: a second call costs 5-50s (Groq's per-minute token
 * limit can stall it), so only problems a reviewer cannot fix in a minute —
 * missing sections, a stub — earn one. Character counts are a quick edit.
 */
export function checkDraftQuality(d: Draft): { hard: string[]; soft: string[] } {
  const hard: string[] = []
  const soft: string[] = []
  const b = d.blocks
  const h2s = b.flatMap((x, i) => (x.type === 'h2' ? [{ text: x.text, i }] : []))
  const headings = b.flatMap(x => (x.type === 'h2' || x.type === 'h3' ? [x.text.trim().toLowerCase()] : []))

  const checklist = h2s.find(h => /what to check/i.test(h.text))
  if (!checklist || !['ul', 'ol'].includes(b[checklist.i + 1]?.type ?? '')) hard.push('missing the "What to check before you decide" h2 followed by a list')

  const faq = h2s.find(h => /frequently asked|faq/i.test(h.text))
  if (!faq) hard.push('missing the "Frequently asked questions" h2')
  else {
    const after = b.slice(faq.i + 1)
    const end = after.findIndex(x => x.type === 'h2')
    const section = end === -1 ? after : after.slice(0, end)
    const answered = section.filter((x, i) => x.type === 'h3' && section[i + 1]?.type === 'p').length
    if (answered < 3) hard.push(`the FAQ has ${answered} answered questions; it needs 3-4 h3 questions each followed by a paragraph`)
  }

  const words = wordCount(blockText(b))
  if (words < 400) hard.push(`the article is ${words} words; it must be 550-750 (add depth to each section, not filler)`)
  else if (words < 500 || words > 900) soft.push(`Length is ${words} words (target 550-750).`)

  if (d.title.length < 40 || d.title.length > 65) soft.push(`Title is ${d.title.length} characters (SEO target 40-65).`)
  if (d.title.includes('?')) soft.push('Title is a question; a statement ranks and reads better.')
  if (!/\b(noida|uttar pradesh|up)\b/i.test(d.title)) soft.push('Title does not name Noida or UP (local SEO).')
  if (d.meta_title.length > 60) soft.push(`Meta title is ${d.meta_title.length} characters (max 60; search results cut it).`)
  if (d.meta_description.length < 120 || d.meta_description.length > 160) soft.push(`Meta description is ${d.meta_description.length} characters (target 120-155).`)
  if (d.excerpt.length < 100 || d.excerpt.length > 220) soft.push(`Excerpt is ${d.excerpt.length} characters (target 100-200).`)
  if (b[0]?.type !== 'p') soft.push('Opens with a heading or list instead of an intro paragraph.')
  if (h2s.length < 5 || h2s.length > 7) soft.push(`${h2s.length} h2 sections (target 3-5 body sections plus checklist and FAQ).`)
  if (new Set(headings).size !== headings.length) soft.push('Two headings are identical.')
  if (b.some(x => x.type === 'h2' && x.text.length > 70)) soft.push('A section heading is over 70 characters.')
  if (b.some(x => x.type === 'h3' && x.text.length > 110)) soft.push('An FAQ question is over 110 characters.')
  const longParas = b.filter(x => x.type === 'p' && wordCount(spanText(x.spans)) > 110).length
  if (longParas) soft.push(`${longParas} paragraph(s) over 110 words; split them for readability.`)
// The checklist is one list; the body should carry at least one more.
  if (b.filter(x => x.type === 'ul' || x.type === 'ol').length < 2) soft.push('No list in the body besides the checklist.')
  return { hard, soft }
}

function groqClient(): Groq {
  const apiKey = process.env.GROQ_BLOG_API_KEY || process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_BLOG_API_KEY (or GROQ_API_KEY) is not set')
  return new Groq({ apiKey, maxRetries: 1 })
}

async function uniqueSlug(title: string): Promise<string> {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '')
  for (let i = 0; ; i++) {
    const slug = i ? `${base}-${i + 1}` : base
    if (!(await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } }))) return slug
  }
}

interface DraftRequest {
  topic: string
  sourceBlock: string
  /** Most similar existing titles, so the model can steer away from them. */
  existingTitles: string[]
  /** Rule breaks from a previous attempt, for the one rewrite. */
  feedback?: string[]
}

async function requestDraft({ topic, sourceBlock, existingTitles, feedback }: DraftRequest): Promise<Draft> {
  const user = [
    `TOPIC: ${topic}`,
    `EXISTING ARTICLES (do not repeat; take a different angle):\n${existingTitles.length ? existingTitles.map(t => `- ${t}`).join('\n') : '(none yet)'}`,
    `SOURCES:\n${sourceBlock || '(none found — write a general article with no figures and no links)'}`,
    ...(feedback?.length ? [`YOUR PREVIOUS DRAFT BROKE THESE RULES. Rewrite it so none apply:\n${feedback.map(f => `- ${f}`).join('\n')}`] : []),
  ].join('\n\n')
  return callModel(user)
}

/**
 * One Markdown completion, parsed into blocks. Markdown rather than a strict
 * JSON schema is the main speed decision here: see markdownDraft.ts for the
 * measurements. A malformed reply is retried once.
 */
async function callModel(user: string): Promise<Draft> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await groqClient().chat.completions.create({
        model: MODELS.GROQ_SMART,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ],
        // groq-sdk 0.7 types predate these; the API accepts them.
        // include_reasoning false: the hidden reasoning is not sent back to us.
        // reasoning_effort stays at the default ('medium'): 'low' saved ~1s but
        // produced thinner drafts. 3000 tokens covers a 750-word article.
        ...({ max_completion_tokens: 3000, include_reasoning: false } as object),
      })
      const draft = parseMarkdownDraft(resp.choices[0]?.message?.content ?? '')
      const parsed = draft && DraftSchema.safeParse(draft)
      if (parsed?.success) return parsed.data
      lastErr = new Error(parsed ? `Model returned an invalid draft: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}` : 'Model reply had no TITLE line or no article body')
    } catch (err) {
      lastErr = err
    }
    console.warn(`[blog:generate] attempt ${attempt} failed:`, lastErr instanceof Error ? lastErr.message.slice(0, 200) : lastErr)
  }
  throw lastErr
}

export interface GenerateResult {
  postId: string
  keyword: string
  reviewNotes: string[]
  post: BlogPost
  /** Wall-clock per stage, so slow runs can be traced to search or model. */
  timingsMs: { search: number; write: number; rewrite: number; total: number }
}

/** How many of the closest existing titles the model is shown. */
const SIMILAR_TITLES_SHOWN = 25

/** The rotation's next topic, or the named one (and its row, if it is in the list). */
function findTopicRow(named: string | undefined) {
  return named
    ? prisma.blogKeyword.findUnique({ where: { keyword: named } })
    : prisma.blogKeyword.findFirst({
        where: { active: true },
        orderBy: [{ last_used_at: { sort: 'asc', nulls: 'first' } }, { created_at: 'asc' }],
      })
}

/** Sources the model sees and may cite. */
const SOURCES_USED = 5

// Social posts are not citable on a public article: unverifiable, often
// deleted, and they make a buyer-facing page look like a rumour roundup.
const SOCIAL_HOSTS = /(^|\.)(facebook|instagram|linkedin|twitter|x|youtube|reddit|quora|pinterest|threads|t)\.(com|net|me)$/i

export function isCitable(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && !SOCIAL_HOSTS.test(u.hostname)
  } catch {
    return false
  }
}

// One search per topic at a time. The admin dialog prefetches while it is open;
// if Generate is clicked before that finishes, generation joins the same request
// instead of paying for a second one. Finished results live in web_facts.
const inflightSearches = new Map<string, ReturnType<typeof tavilySearch>>()

function searchSources(topic: string): ReturnType<typeof tavilySearch> {
  const existing = inflightSearches.get(topic)
  if (existing) return existing
  // Ask for more than SOURCES_USED: social posts are filtered out afterwards.
  const p = tavilySearch(`${topic} Noida home buyers`, 8, { restrictDomains: false, includeAnswer: false })
    .finally(() => inflightSearches.delete(topic))
  inflightSearches.set(topic, p)
  return p
}

/**
 * Warms the search cache for the topic Generate would use, so the click only
 * waits for the model. Returns the topic, or null when there is nothing to write.
 */
export async function prefetchBlogSources(keyword?: string): Promise<string | null> {
  const named = keyword?.trim()
  const topic = named || (await findTopicRow(undefined))?.keyword
  if (!topic) return null
  void searchSources(topic).catch(() => {}) // best-effort; generation searches again if this failed
  return topic
}

/** Generates one draft. `keyword` overrides the rotation (admin "generate on this topic"). */
export async function generateBlogDraft(keyword?: string): Promise<GenerateResult> {
  // A named topic that is in the list still counts as used, so the rotation moves past it.
  const t0 = Date.now()
  const named = keyword?.trim()
  const [kwRow, allPosts] = await Promise.all([
    findTopicRow(named),
    // Every title ever written, archived included: an archived article is still
    // one we already have, and repeating it is still a repeat.
    prisma.blogPost.findMany({ select: { title: true } }),
  ])
  const topic = named || kwRow?.keyword
  if (!topic) throw new Error('No active blog keywords. Add one in /admin/blog.')

  const existing = allPosts.map(p => p.title)
  const closest = [...existing]
    .sort((a, b) => titleSimilarity(topic, b) - titleSimilarity(topic, a))
    .slice(0, SIMILAR_TITLES_SHOWN)

  const tSearch = Date.now()
  const search = await searchSources(topic)
  const sources: WebResult[] = search.results.filter(r => isCitable(r.url)).slice(0, SOURCES_USED)
  const sourceBlock = sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.content.slice(0, 1500)}`).join('\n\n')
  // Titles count as source text: the model sees them, and a figure from a headline is sourced.
  const sourceText = sources.map(s => `${s.title}\n${s.content}`).join('\n')

  // One rewrite at most, and only for what a reviewer cannot fix in a minute:
  // a missing section, a stub, or a repeat of an existing article. Every model
  // call counts against the key's 8,000 tokens/minute (measured from Groq's
  // headers); one draft fits, a second call in the same minute is throttled for
  // up to ~35s. Citation gaps were tried as a trigger and dropped: worked
  // examples look like unsourced figures, so it rewrote for nothing. They go
  // into the reviewer notes instead, loudly.
  const allowedUrls = new Set(sources.map(s => s.url))
  const tWrite = Date.now()
  let draft = await requestDraft({ topic, sourceBlock, existingTitles: closest })
  const writeMs = Date.now() - tWrite
  let rewriteMs = 0
  let rewriteReasons: string[] = []
  let quality = checkDraftQuality(draft)
  let duplicateOf = findDuplicateTitle(draft.title, existing)
  if (quality.hard.length || duplicateOf) {
    const feedback = rewriteReasons = [
      ...quality.hard,
      ...(duplicateOf ? [`the title repeats the existing article "${duplicateOf}"; choose a different angle and title`] : []),
    ]
    const tRewrite = Date.now()
    draft = await requestDraft({ topic, sourceBlock, existingTitles: closest, feedback })
    rewriteMs = Date.now() - tRewrite
    quality = checkDraftQuality(draft)
    duplicateOf = findDuplicateTitle(draft.title, existing)
  }

  const { doc, cited, dropped } = toTiptap(draft.blocks, allowedUrls)
  if (cited.size) {
    doc.content!.push(
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Sources' }] },
      { type: 'bulletList', content: sources.filter(s => cited.has(s.url)).map(s => ({
        type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: s.title || s.url, marks: [{ type: 'link', attrs: { href: s.url } }] }] }],
      })) },
    )
  }

  const notes = [`AI draft on "${topic}". ${sources.length} sources found, ${cited.size} cited.${rewriteMs ? ` Rewritten once because: ${rewriteReasons.map(r => r.split(';')[0]).join('; ')}.` : ''}`]
  if (sources.length && !cited.size) notes.push('NO SOURCE CITED. Treat every figure and claim as unverified until checked.')
  // A normal call takes 4-7s; far longer means Groq held it for the per-minute limit.
  if (writeMs > 15_000 || rewriteMs > 15_000) notes.push(`Slowed by Groq's per-minute token limit (${Math.round((writeMs + rewriteMs) / 1000)}s writing). Space drafts about a minute apart for full speed.`)
  if (dropped.length) notes.push(`Removed ${dropped.length} link(s) not returned by search.`)
  const unsourced = unsourcedFigures(blockText(draft.blocks), sourceText)
  if (unsourced.length) notes.push(`Figures not found in any source, verify or remove: ${unsourced.slice(0, 12).join(', ')}`)
  if (!sources.length) notes.push('Web search returned nothing; article is general only.')
  if (duplicateOf) notes.push(`POSSIBLE DUPLICATE of "${duplicateOf}". Retitle or discard.`)
  if (quality.hard.length) notes.push(`Structure rules still broken: ${quality.hard.join('; ')}.`)
  notes.push(...quality.soft)

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
  const timingsMs = { search: tWrite - tSearch, write: writeMs, rewrite: rewriteMs, total: Date.now() - t0 }
  console.info('[blog:generate]', topic, timingsMs)
  return { postId: post.id, keyword: topic, reviewNotes: notes, post, timingsMs }
}

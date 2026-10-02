import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toTiptap, unsourcedFigures, DraftSchema, dropNulls, findDuplicateTitle, titleSimilarity, checkDraftQuality, pickExpansion, type Draft } from '../generateDraft'

describe('blog draft conversion', () => {
  it('keeps links the search returned and strips any other URL', () => {
    const { doc, cited, dropped } = toTiptap([
      { type: 'p', spans: [
        { text: 'Stamp duty is 7%', bold: true, href: 'https://igrsup.gov.in/a' },
        { text: ' per a made-up source', href: 'https://invented.example/x' },
      ] },
    ], new Set(['https://igrsup.gov.in/a']))
    const [real, fake] = doc.content![0].content!
    assert.deepEqual(real.marks, [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://igrsup.gov.in/a' } }])
    assert.equal(fake.marks, undefined)
    assert.equal(fake.text, ' per a made-up source')
    assert.deepEqual([...cited], ['https://igrsup.gov.in/a'])
    assert.deepEqual(dropped, ['https://invented.example/x'])
  })

  it('maps every block type onto the editor schema', () => {
    const { doc } = toTiptap([
      { type: 'h2', text: 'A' }, { type: 'h3', text: 'B' }, { type: 'quote', spans: [{ text: 'q', italic: true }] },
      { type: 'ul', items: [[{ text: 'x' }]] }, { type: 'ol', items: [[{ text: 'y' }]] },
    ], new Set())
    assert.deepEqual(doc.content!.map(n => n.type), ['heading', 'heading', 'blockquote', 'bulletList', 'orderedList'])
    assert.equal(doc.content![0].attrs!.level, 2)
  })

  it('flags figures absent from every source, ignoring years', () => {
    assert.deepEqual(unsourcedFigures('Rate 7% from 2025, PLC 150, fee 1,00,000', 'rate is 7% and PLC 150'), ['1,00,000'])
  })

  it('rejects a draft with no body', () => {
    assert.equal(DraftSchema.safeParse({ title: 'A proper title', excerpt: 'x'.repeat(30), meta_title: 't', meta_description: 'd', blocks: [] }).success, false)
  })

  it('accepts the strict-schema shape once nulls are dropped', () => {
    const raw = {
      title: 'A proper title', excerpt: 'x'.repeat(30), meta_title: 't', meta_description: 'd',
      blocks: [
        { type: 'h2', text: 'Heading', spans: null, items: null },
        { type: 'p', text: null, spans: [{ text: 'a', bold: null, italic: true, href: null }], items: null },
        { type: 'ul', text: null, spans: null, items: [[{ text: 'b', bold: true, italic: null, href: null }]] },
        { type: 'h3', text: 'Sub', spans: null, items: null },
      ],
    }
    const parsed = DraftSchema.safeParse(dropNulls(raw))
    assert.equal(parsed.success, true)
    assert.deepEqual(parsed.success && parsed.data.blocks[1], { type: 'p', spans: [{ text: 'a', italic: true }] })
  })
})

describe('blog uniqueness', () => {
  const existing = ['Stamp duty and registration charges for women buyers in Noida', 'How to verify a UP RERA project registration before booking']

  it('flags a reworded copy of an existing title', () => {
    assert.equal(findDuplicateTitle('Women buyers in Noida: stamp duty and registration charges', existing), existing[0])
  })

  it('flags an exact title regardless of case', () => {
    assert.equal(findDuplicateTitle(existing[1].toUpperCase(), existing), existing[1])
  })

  it('lets a different angle on the same subject through', () => {
    assert.equal(findDuplicateTitle('When Noida stamp duty is charged on circle rate, not agreement value', existing), null)
  })

  it('ignores filler words like Noida and buyers when comparing', () => {
    assert.equal(titleSimilarity('Noida buyers guide', 'Home buyers in Noida explained'), 0)
  })
})

describe('blog structure rules', () => {
  const p = (text: string) => ({ type: 'p' as const, spans: [{ text }] })
  const good: Draft = {
    title: 'How UP RERA protects Noida buyers when possession is delayed',
    excerpt: 'What the law lets you claim when a Noida builder misses the possession date, and what to keep on file before you complain.',
    meta_title: 'Possession delay rights under UP RERA in Noida',
    meta_description: 'What Noida buyers can claim when possession is late under UP RERA, which documents to keep, and the questions to ask before filing a complaint.',
    blocks: [
      // Long enough to clear the 450-word floor.
      p('word '.repeat(480)),
      { type: 'h2', text: 'What counts as a delay' }, p('a'), { type: 'ul', items: [[{ text: 'x' }]] },
      { type: 'h2', text: 'What you can claim' }, p('b'),
      { type: 'h2', text: 'How long it takes' }, p('c'),
      { type: 'h2', text: 'What to check before you decide' }, { type: 'ul', items: [[{ text: 'y' }]] },
      { type: 'h2', text: 'Frequently asked questions' },
      { type: 'h3', text: 'Q1' }, p('A1'), { type: 'h3', text: 'Q2' }, p('A2'), { type: 'h3', text: 'Q3' }, p('A3'),
    ],
  }

  it('passes a draft that follows every hard rule', () => {
    assert.deepEqual(checkDraftQuality(good).hard, [])
  })

  it('rewrites for a missing FAQ, but only notes a heading-first opening and a long meta title', () => {
    const bad: Draft = { ...good, meta_title: 'x'.repeat(70), blocks: [{ type: 'h2', text: 'Start' }, ...good.blocks.slice(1, 10)] }
    const { hard, soft } = checkDraftQuality(bad)
    assert.ok(hard.some(h => h.includes('Frequently asked questions')))
    assert.ok(soft.some(s => s.includes('intro paragraph')))
    assert.ok(soft.some(s => s.includes('Meta title')))
    assert.ok(!hard.some(h => /meta|intro/i.test(h)))
  })

  it('sends back a draft under 450 words', () => {
    const short: Draft = { ...good, blocks: [p('Intro.'), ...good.blocks.slice(1)] }
    assert.ok(checkDraftQuality(short).hard.some(h => h.includes('words')))
  })

  it('keeps a longer expansion but always the original title and meta', () => {
    const expanded: Draft = { ...good, title: 'A different title the model invented', blocks: [p('word '.repeat(700)), ...good.blocks.slice(1)] }
    const chosen = pickExpansion(good, expanded)
    assert.equal(chosen.title, good.title)
    assert.equal(chosen.meta_description, good.meta_description)
    assert.equal(chosen.blocks, expanded.blocks)
  })

  it('rejects an expansion that is not longer, or that drops a required section', () => {
    assert.equal(pickExpansion(good, { ...good, blocks: [p('short'), ...good.blocks.slice(1)] }), good)
    const noFaq: Draft = { ...good, blocks: [p('word '.repeat(900)), ...good.blocks.slice(1, 10)] }
    assert.equal(pickExpansion(good, noFaq), good)
  })

  it('needs at least three answered FAQ questions', () => {
    const thin: Draft = { ...good, blocks: good.blocks.slice(0, -4) }
    assert.ok(checkDraftQuality(thin).hard.some(h => h.includes('answered questions')))
  })
})


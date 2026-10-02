import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toTiptap, unsourcedFigures, DraftSchema, findDuplicateTitle, titleSimilarity, checkDraftQuality, isCitable, STATUTORY, type Draft } from '../generateDraft'

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

})

describe('citable sources', () => {
  it('drops social posts and non-https links, keeps publishers and government sites', () => {
    for (const bad of ['https://www.facebook.com/groups/1/posts/2', 'https://www.instagram.com/p/x', 'https://m.facebook.com/a',
      'https://www.linkedin.com/posts/a', 'https://x.com/a/status/1', 'https://t.me/channel', 'http://up-rera.in/a', 'not a url']) {
      assert.equal(isCitable(bad), false, bad)
    }
    for (const good of ['https://www.up-rera.in/verify', 'https://igrsup.gov.in/x', 'https://www.360propguide.com/blogs/a', 'https://textbook.com/a']) {
      assert.equal(isCitable(good), true, good)
    }
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

  it('sends back a draft under 400 words', () => {
    const short: Draft = { ...good, blocks: [p('Intro.'), ...good.blocks.slice(1)] }
    assert.ok(checkDraftQuality(short).hard.some(h => h.includes('words')))
  })

  it('needs at least three answered FAQ questions', () => {
    const thin: Draft = { ...good, blocks: good.blocks.slice(0, -4) }
    assert.ok(checkDraftQuality(thin).hard.some(h => h.includes('answered questions')))
  })
})


describe('statutory facts given to the writer', () => {
  // A web source claimed the women's rate stops at ₹1 crore and a draft repeated
  // it. Confirmed 2026-10-02: 6% for women at every property value.
  it('states the UP stamp duty rates with no price cap on the women\'s rate', () => {
    assert.match(STATUTORY, /7% for men, 6% for women, at every property value/)
    assert.match(STATUTORY, /no price cap/i)
    assert.doesNotMatch(STATUTORY, /1 crore/i)
  })

  it('tells the writer that a disagreeing source is wrong', () => {
    assert.match(STATUTORY, /if a SOURCE disagrees, the SOURCE is wrong/)
  })
})

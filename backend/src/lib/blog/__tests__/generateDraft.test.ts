import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toTiptap, unsourcedFigures, DraftSchema, dropNulls } from '../generateDraft'

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

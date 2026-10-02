import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseInline, parseMarkdownDraft } from '../markdownDraft'
import { checkDraftQuality, DraftSchema } from '../generateDraft'

describe('inline Markdown', () => {
  it('reads links, bold and italics in one line', () => {
    assert.deepEqual(parseInline('Pay **stamp duty** on the [circle rate](https://igrsup.gov.in/x), not the *agreement value*.'), [
      { text: 'Pay ' },
      { text: 'stamp duty', bold: true },
      { text: ' on the ' },
      { text: 'circle rate', href: 'https://igrsup.gov.in/x' },
      { text: ', not the ' },
      { text: 'agreement value', italic: true },
      { text: '.' },
    ])
  })

  it('accepts the <span href> form the model sometimes falls back to', () => {
    assert.deepEqual(parseInline('See <span href="https://up-rera.in/a">RERA registration</span>.'), [
      { text: 'See ' },
      { text: 'RERA registration', href: 'https://up-rera.in/a' },
      { text: '.' },
    ])
  })

  it('leaves snake_case words and lone asterisks alone', () => {
    assert.deepEqual(parseInline('Use meta_title and 5 * 3'), [{ text: 'Use meta_title and 5 * 3' }])
  })
})

describe('Markdown draft', () => {
  it('parses a real gpt-oss-120b reply into a schema-valid draft that passes the rewrite rules', () => {
    const raw = readFileSync(join(__dirname, 'fixture-gpt-oss-120b.md'), 'utf8')
    const draft = parseMarkdownDraft(raw)
    assert.ok(draft)
    assert.equal(draft.title, 'Builder-Buyer Agreement Checklist for Noida Homebuyers')
    assert.ok(draft.meta_description.length > 100)
    assert.equal(DraftSchema.safeParse(draft).success, true)
    assert.equal(draft.blocks[0].type, 'p')
    assert.deepEqual(checkDraftQuality(draft).hard, [])
    const links = JSON.stringify(draft.blocks).match(/"href"/g) ?? []
    assert.ok(links.length >= 5, 'citations survive parsing')
  })

  it('groups list items, keeps list type, and joins wrapped paragraph lines', () => {
    const d = parseMarkdownDraft(['TITLE: T', '', 'Line one', 'line two.', '', '## A', '- x', '- y', '', '1. first', '2. second', '', '### Q', 'Answer.'].join('\n'))
    assert.ok(d)
    assert.deepEqual(d.blocks.map(b => b.type), ['p', 'h2', 'ul', 'ol', 'h3', 'p'])
    assert.deepEqual(d.blocks[0], { type: 'p', spans: [{ text: 'Line one line two.' }] })
  })

  it('strips a code fence and ignores an h1', () => {
    const d = parseMarkdownDraft(['```markdown', 'TITLE: T', '# Big title', 'Intro.', '## A', 'x', '## B', 'y', '```'].join('\n'))
    assert.ok(d)
    assert.ok(!d.blocks.some(b => 'text' in b && b.text === 'Big title'))
  })

  it('returns null without a TITLE line or without a body', () => {
    assert.equal(parseMarkdownDraft('## A\nx\n## B\ny\n## C\nz'), null)
    assert.equal(parseMarkdownDraft('TITLE: Only a title'), null)
  })
})

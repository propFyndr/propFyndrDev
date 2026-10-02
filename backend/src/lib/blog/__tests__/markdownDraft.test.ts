import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseInline, parseMarkdownDraft, linkFootnotes, normalizeTypography } from '../markdownDraft'
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

// Each case below is a defect from a real draft ("Choosing a Home Near Noida
// Aqua Line Metro Connectivity", 2026-10-02) that reached the editor.
describe('house style clean-up', () => {
  const urls = ['https://a.example/1', 'https://b.example/2']

  it('turns "[n]" footnotes into a link on the clause before them', () => {
    assert.equal(
      linkFootnotes('Sector 137 balances metro access and offices[2]. Next sentence.', urls),
      '[Sector 137 balances metro access and offices](https://b.example/2). Next sentence.',
    )
    assert.equal(linkFootnotes('Values rise near stations[5].', urls), 'Values rise near stations.') // unknown number: artefact dropped
  })

  it('turns corner-bracket citations into links, and drops ones to URLs we did not supply', () => {
    assert.equal(
      linkFootnotes('Several stations are preferred by buyers【https://a.example/1】. Next.', urls),
      '[Several stations are preferred by buyers](https://a.example/1). Next.',
    )
    assert.equal(linkFootnotes('Sector 137 is balanced【2】.', urls), '[Sector 137 is balanced](https://b.example/2).')
    assert.equal(linkFootnotes('A claim【https://invented.example/x】.', urls), 'A claim.')
  })

  it('closes the gap in "7 %", including a non-breaking space', () => {
    assert.equal(normalizeTypography('stamp duty is 7 % for men and 6 % for women'), 'stamp duty is 7% for men and 6% for women')
  })

  it('does not split a clause at a decimal point', () => {
    assert.equal(
      linkFootnotes('The line spans 29.7 km with 21 stations[1].', urls),
      '[The line spans 29.7 km with 21 stations](https://a.example/1).',
    )
  })

  it('turns a Markdown table into a list instead of a paragraph of pipes', () => {
    const d = parseMarkdownDraft([
      'TITLE: T', '', 'Intro.', '## A', 'Text.',
      '| Aspect | Established hubs | Future nodes |', '|--------|------|------|',
      '| Price premium | Higher today | Lower entry |', '| Commute | Short | Longer today |',
      '## B', 'More.',
    ].join('\n'), urls)
    assert.ok(d)
    assert.ok(!JSON.stringify(d.blocks).includes('|'))
    const list = d.blocks.find(b => b.type === 'ul')
    assert.ok(list && list.type === 'ul')
    assert.deepEqual(list.items[0], [{ text: 'Price premium', bold: true }, { text: ': Established hubs Higher today. Future nodes Lower entry.' }])
  })

  it('normalises dashes the way the style guide asks', () => {
    assert.equal(normalizeTypography('Sec‑142 to Botanical Garden, trade‑offs'), 'Sec-142 to Botanical Garden, trade-offs')
    assert.equal(normalizeTypography('- **Current station distance** – Measure walkability.'), '- **Current station distance**: Measure walkability.')
    assert.equal(normalizeTypography('Prices rose — slowly — in 2025.'), 'Prices rose, slowly, in 2025.')
    assert.equal(normalizeTypography('Possession in 2027–2028.'), 'Possession in 2027 to 2028.')
  })

  it('drops "Key takeaway:" style labels but keeps the sentence', () => {
    assert.equal(normalizeTypography('**Key takeaway:** Buying near a station costs more.'), 'Buying near a station costs more.')
    assert.equal(normalizeTypography('Note: check the OC.'), 'Check the OC.')
  })

  it('reports template vocabulary and vague attributions to the reviewer', () => {
    const d = parseMarkdownDraft(['TITLE: T', '', 'Studies show this is a crucial and pivotal choice.', '## A', 'x', '## B', 'y'].join('\n'))
    assert.ok(d)
    const { soft } = checkDraftQuality(d)
    assert.ok(soft.some(s => s.includes('crucial') && s.includes('pivotal')))
    assert.ok(soft.some(s => s.includes('studies show')))
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

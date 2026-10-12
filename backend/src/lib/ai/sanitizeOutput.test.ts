import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sanitizeOutput, isClean } from './sanitizeOutput'

describe('output sanitising', () => {
  it('removes the emoji the prompt already banned', () => {
    // Five of fifty answers carried emoji while the prompt read "NO EMOJI,
    // ANYWHERE". A rule the model can ignore is not a guarantee.
    const r = sanitizeOutput('🏗️ Coverage Status: Noida ⭐ Good ❌ No ⚠️ Medium')
    assert.ok(isClean(r.text), r.text)
    assert.ok(r.strippedEmoji >= 4)
  })

  it('leaves rupees, arrows in prose and ordinary punctuation alone', () => {
    const src = 'Sector 150 runs ₹11,500/sqft — 20% above Sector 120.'
    assert.equal(sanitizeOutput(src).text, src)
  })

  it('replaces a competitor name rather than deleting it', () => {
    // Deleting leaves "prices on are higher", which is worse than the name.
    const r = sanitizeOutput('Prices on 99acres are higher than ours.')
    assert.ok(!/99acres/i.test(r.text))
    assert.match(r.text, /market listings/)
  })

  it('removes the empty citation a stripped name leaves behind', () => {
    const r = sanitizeOutput('2 BHK rents are ₹22,000–35,000 (Source: MagicBricks)')
    assert.ok(!/\(\s*Source\s*:?\s*\)/i.test(r.text), r.text)
    assert.ok(!/MagicBricks/i.test(r.text))
  })

  it('catches every portal on the ban list', () => {
    for (const p of ['99acres', 'MagicBricks', 'NoBroker', 'Housing.com', 'PropTiger', 'Square Yards']) {
      const r = sanitizeOutput(`Listed on ${p} today.`)
      assert.ok(!new RegExp(p.replace('.', '\\.'), 'i').test(r.text), `${p} survived`)
    }
  })

  it('does not touch the word housing on its own', () => {
    const src = 'Group housing societies prohibit short-term rentals.'
    assert.equal(sanitizeOutput(src).text, src)
  })

  it('is a no-op on clean text, and says so', () => {
    const src = 'Sector 128 is the stronger choice for immediate possession.'
    const r = sanitizeOutput(src)
    assert.equal(r.text, src)
    assert.equal(r.strippedEmoji, 0)
    assert.equal(r.strippedPlatforms, 0)
  })

  it('survives empty input', () => {
    assert.equal(sanitizeOutput('').text, '')
  })
})

describe('off-platform referrals are rewritten, not just stripped', () => {
  it('removes the whole "verify at up-rera.in" sentence', () => {
    // The real closing line of a Sector 150 answer, 31 Aug.
    const r = sanitizeOutput(
      'Here are the 3 BHK options under Rs 2 crore.\n\nFor under-construction properties, always verify current status and RERA filings at up-rera.in — our data reflects builder-provided information.',
    )
    assert.ok(!/up-?rera\.in/i.test(r.text), r.text)
    assert.ok(!/always verify current status/i.test(r.text), r.text)
    assert.match(r.text, /project page/i)
    assert.equal(r.redirectedOffPlatform, 1)
  })

  it('leaves no dangling "at ." behind', () => {
    const r = sanitizeOutput('Check the filings at up-rera.in. Possession is 2027.')
    assert.ok(!/\bat\s*\./.test(r.text), r.text)
    assert.match(r.text, /Possession is 2027\./)
  })

  it('catches the other ways off it phrases the same thing', () => {
    for (const s of [
      'Please confirm this on the state RERA portal.',
      'You can check the builder website for the latest plan.',
      'Search on Google for the current status.',
    ]) {
      const r = sanitizeOutput(s)
      assert.equal(r.redirectedOffPlatform, 1, s)
      assert.ok(!isClean(s), s)
    }
  })

  it('leaves an ordinary answer untouched', () => {
    const s = 'Sector 150 has nine 3 BHK options under Rs 2 crore. Possession runs from 2026 to 2028.'
    assert.equal(sanitizeOutput(s).text, s)
    assert.ok(isClean(s))
  })
})

describe('the referral rewrite must not eat real content', () => {
  it('does not swallow a ranked list that has no full stops between items', () => {
    // The regression: `[^.!?]*` crosses newlines, so a list whose items end in
    // line breaks was consumed wholesale. Nine projects vanished from a real
    // answer, leaving one sentence and the replacement.
    const answer = [
      'Ranked by verified project score for Sector 150:',
      '1. ATS Le Grandiose — ₹1.96 Cr',
      '2. Samridhi Daksh Avenue — ₹1.85 Cr',
      '3. Tata Eureka Park — ₹1.95 Cr',
      'Always verify current filings at up-rera.in before booking.',
    ].join('\n')

    const out = sanitizeOutput(answer).text
    assert.ok(!/up-?rera\.in/i.test(out), out)
    for (const keep of ['ATS Le Grandiose', 'Samridhi Daksh Avenue', 'Tata Eureka Park', '₹1.96 Cr']) {
      assert.ok(out.includes(keep), `deleted "${keep}" from the answer:\n${out}`)
    }
    assert.match(out, /project page/i)
  })

  it('still removes the referral when it is the only sentence on its line', () => {
    const out = sanitizeOutput('Possession is 2027.\nCheck up-rera.in for filings.\nThe builder is ATS.').text
    assert.ok(!/up-?rera\.in/i.test(out), out)
    assert.match(out, /Possession is 2027\./)
    assert.match(out, /The builder is ATS\./)
  })
})

describe('citation scaffolding is collapsed to two labels', () => {
  // The four leaks the 30 Aug audit actually recorded, verbatim in shape.
  it('collapses "(Web sources)"', () => {
    const { text } = sanitizeOutput('Sector 150 averages ₹14,500/sqft (Web sources).')
    assert.equal(text, 'Sector 150 averages ₹14,500/sqft (market data).')
  })

  it('collapses a named blog', () => {
    const { text } = sanitizeOutput('The Aqua Line reaches Sector 137 (Purvanchal Projects Blog).')
    assert.equal(text, 'The Aqua Line reaches Sector 137 (market data).')
  })

  it('collapses a forum handle', () => {
    const { text } = sanitizeOutput('Buyers report waterlogging (Reddit r/noida).')
    assert.equal(text, 'Buyers report waterlogging (market data).')
  })

  it('collapses the phrase this file itself used to write', () => {
    // PLATFORMS rewrites a named portal to "market listings". Inside a
    // parenthetical that replacement WAS the citation — the fourth leak.
    const { text } = sanitizeOutput('Listed around ₹1.4 Cr (99acres).')
    assert.equal(text, 'Listed around ₹1.4 Cr (market data).')
  })

  it('keeps our own attribution, which is the point of having any', () => {
    const input = 'Possession is Dec 2027 (RealtyAsk data).'
    const { text, normalizedCitations } = sanitizeOutput(input)
    assert.equal(text, input)
    assert.equal(normalizedCitations, 0)
  })

  it('keeps a parenthetical that is an aside, not a source', () => {
    const input = 'Three towers are complete (Ground floor units only) and two are not.'
    assert.equal(sanitizeOutput(input).text, input)
  })

  it('does not stutter when a line carries two outside citations', () => {
    const { text } = sanitizeOutput('Rents run ₹42,000 (Web sources) (market listings).')
    assert.equal(text, 'Rents run ₹42,000 (market data).')
  })

  it('reports an uncollapsed answer as clean', () => {
    assert.equal(isClean('Possession is Dec 2027 (RealtyAsk data).'), true)
    assert.equal(isClean('Possession is Dec 2027 (Web sources).'), false)
  })
})

describe('the model does not narrate its own provenance', () => {
  it('removes the whole sentence, not just the preamble', () => {
    // Measured live below a computed yield table. Trimming only "Based on
    // general knowledge," would leave the ungrounded range standing and looking
    // sourced, which is worse than the disclaimer.
    const { text, strippedProvenance } = sanitizeOutput(
      'Sector 4 yields 3.81%. Based on general knowledge (not a live search), yields in Noida typically range 2.5% to 3.5%. What are you weighing?',
    )
    assert.equal(strippedProvenance, 1)
    assert.ok(!text.includes('2.5%'), `ungrounded range survived: ${text}`)
    assert.ok(text.includes('Sector 4 yields 3.81%'), 'ate the real answer')
    assert.ok(text.includes('What are you weighing?'), 'ate the closing question')
  })

  it('catches the other ways it says the same thing', () => {
    for (const s of [
      'As an AI, I cannot verify this.',
      'From my training data, prices rose sharply.',
      'I do not have live access to current rates.',
      'Without a live search, this is approximate.',
    ]) {
      assert.equal(sanitizeOutput(s).strippedProvenance, 1, `missed: ${s}`)
    }
  })

  it('leaves honest statements about OUR data alone', () => {
    // These are the product's core promise. Deleting one would be far worse
    // than leaving a disclaimer in.
    for (const s of [
      'We do not hold a flood assessment for Sector 135.',
      'That is not recorded in our data.',
      'We have not verified this builder\'s delivery record.',
      'This figure comes from our own cost sheets.',
    ]) {
      assert.equal(sanitizeOutput(s).text, s, `damaged: ${s}`)
      assert.equal(sanitizeOutput(s).strippedProvenance, 0, `wrongly flagged: ${s}`)
    }
  })
})

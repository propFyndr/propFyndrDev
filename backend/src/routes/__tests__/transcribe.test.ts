// Whisper invents words when handed silence, and the invented words go into
// the buyer's search box.
//
// Measured against the live endpoint: a one-second 440Hz sine tone — no speech
// in it at all — came back as " प्रफ़ज़". Two separate faults produced that. The
// route pinned `language: 'hi'`, so every utterance was forced through Hindi
// whatever the buyer actually spoke; and nothing checked whether the audio
// contained speech before returning a transcript.
//
// A buyer who taps the mic, says nothing, and taps again must get an empty
// string back — never a plausible-looking sentence they did not say.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { speechOrEmpty } from '../transcribe'

/** A segment Whisper is confident about. */
const speech = { no_speech_prob: 0.01, avg_logprob: -0.25 }
/** A segment Whisper itself thinks is silence. */
const silence = { no_speech_prob: 0.95, avg_logprob: -1.4 }

describe('speech detection', () => {
  it('keeps a confident transcript', () => {
    assert.equal(
      speechOrEmpty({ text: '3BHK in Sector 150 under 2 crore', segments: [speech] }),
      '3BHK in Sector 150 under 2 crore',
    )
  })

  it('drops a transcript Whisper believes is silence', () => {
    assert.equal(speechOrEmpty({ text: ' प्रफ़ज़', segments: [silence] }), '')
  })

  it('drops it when every segment is low-confidence', () => {
    assert.equal(speechOrEmpty({ text: 'something invented', segments: [silence, silence] }), '')
  })

  it('keeps it when at least one segment is real speech', () => {
    // A pause at the end of a real utterance must not discard the utterance.
    assert.equal(
      speechOrEmpty({ text: 'show me ready to move flats', segments: [speech, silence] }),
      'show me ready to move flats',
    )
  })

  it('returns empty for empty or whitespace input', () => {
    assert.equal(speechOrEmpty({ text: '' }), '')
    assert.equal(speechOrEmpty({ text: '   ' }), '')
    assert.equal(speechOrEmpty({}), '')
  })
})

describe('known silence hallucinations', () => {
  // Whisper emits these regardless of what the audio contained.
  for (const text of ['Thank you.', 'thanks', 'You', '.', '[BLANK_AUDIO]', '[Music]', 'Please subscribe to my channel']) {
    it(`drops ${JSON.stringify(text)}`, () => {
      assert.equal(speechOrEmpty({ text, segments: [speech] }), '')
    })
  }

  it('does not drop a real question that merely contains "thank you"', () => {
    const t = 'thank you, now show me 3BHK options in Sector 150'
    assert.equal(speechOrEmpty({ text: t, segments: [speech] }), t)
  })
})

describe('no segments returned', () => {
  it('falls back to the hallucination list alone rather than dropping everything', () => {
    // Some responses carry no segments. Discarding those wholesale would break
    // transcription entirely, so only the known-bad strings are removed.
    assert.equal(speechOrEmpty({ text: 'ready to move in sector 137' }), 'ready to move in sector 137')
    assert.equal(speechOrEmpty({ text: 'Thank you.' }), '')
  })
})

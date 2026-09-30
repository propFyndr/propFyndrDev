// backend/src/lib/discovery/__tests__/messyLanguageNormalizer.test.ts

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { prenormalizeRawText } from '../messyLanguageNormalizer'

describe('MessyLanguageNormalizer Comprehensive Suite', () => {
  describe('Pass 1: Speech Disfluencies', () => {
    it('strips common fillers like umm, uhh, like, you know', () => {
      const res = prenormalizeRawText('umm like looking for 3 BHK in you know Sector 150')
      assert.ok(!res.normalized.includes('umm'))
      assert.ok(!res.normalized.includes('like'))
      assert.ok(!res.normalized.includes('you know'))
      assert.match(res.normalized, /3 BHK in Sector 150/i)
    })

    it('strips i mean, sort of, kind of, err, hmm', () => {
      const res = prenormalizeRawText('i mean sort of kind of looking for err hmm 2 BHK')
      assert.ok(!res.normalized.includes('sort of'))
      assert.ok(!res.normalized.includes('kind of'))
      assert.match(res.normalized, /2 BHK/i)
    })
  })

  describe('Pass 2: Hinglish Lexicon (19 Patterns)', () => {
    it('1. normalizes jaldi chahiye to ready to move and sets rtm flag', () => {
      const res = prenormalizeRawText('3 BHK in Sector 150 jaldi chahiye')
      assert.match(res.normalized, /ready to move/i)
      assert.equal(res.hinglishFlags.rtm, true)
    })

    it('2. normalizes turant to ready to move', () => {
      const res = prenormalizeRawText('turant possession chahiye')
      assert.match(res.normalized, /ready to move/i)
      assert.equal(res.hinglishFlags.rtm, true)
    })

    it('3. normalizes jaldi possession to ready to move possession', () => {
      const res = prenormalizeRawText('jaldi possession in Expressway')
      assert.match(res.normalized, /ready to move possession/i)
      assert.equal(res.hinglishFlags.rtm, true)
    })

    it('4. normalizes dhang ka to good quality society', () => {
      const res = prenormalizeRawText('koi dhang ka project in Noida')
      assert.match(res.normalized, /good quality society/i)
      assert.equal(res.hinglishFlags.quality_preferred, true)
    })

    it('5. normalizes acchi society to good quality society', () => {
      const res = prenormalizeRawText('acchi society chahiye')
      assert.match(res.normalized, /good quality society/i)
      assert.equal(res.hinglishFlags.quality_preferred, true)
    })

    it('6. normalizes sahi society to good quality society', () => {
      const res = prenormalizeRawText('sahi society in Sector 137')
      assert.match(res.normalized, /good quality society/i)
      assert.equal(res.hinglishFlags.quality_preferred, true)
    })

    it('7. normalizes accha project to good quality project', () => {
      const res = prenormalizeRawText('accha project batao')
      assert.match(res.normalized, /good quality project/i)
      assert.equal(res.hinglishFlags.quality_preferred, true)
    })

    it('8. normalizes stretch karke to budget slightly flexible', () => {
      const res = prenormalizeRawText('budget 1.5 Cr stretch karke')
      assert.match(res.normalized, /budget slightly flexible/i)
      assert.equal(res.hinglishFlags.budget_flex, true)
    })

    it('9. normalizes thoda zyada kar sakta hun to budget slightly flexible', () => {
      const res = prenormalizeRawText('1 Cr hai but thoda zyada kar sakta hun')
      assert.match(res.normalized, /budget slightly flexible/i)
      assert.equal(res.hinglishFlags.budget_flex, true)
    })

    it('10. normalizes colloquial 1.5k carpet to 1500 sqft carpet', () => {
      const res = prenormalizeRawText('1.5k carpet wali 3 BHK')
      assert.match(res.normalized, /1500 sqft carpet/i)
      assert.equal(res.hinglishFlags.carpet_set, true)
    })

    it('11. normalizes 2k sqft wali to 2000 sqft', () => {
      const res = prenormalizeRawText('2k sqft wali flat')
      assert.match(res.normalized, /2000 sqft/i)
      assert.equal(res.hinglishFlags.carpet_set, true)
    })

    it('12. normalizes ghar lena to apartment', () => {
      const res = prenormalizeRawText('Noida mein ghar lena hai')
      assert.match(res.normalized, /apartment/i)
      assert.equal(res.hinglishFlags.type_apartment, true)
    })

    it('13. normalizes makan chahiye to apartment', () => {
      const res = prenormalizeRawText('Sector 150 mein makan chahiye')
      assert.match(res.normalized, /apartment/i)
      assert.equal(res.hinglishFlags.type_apartment, true)
    })

    it('14. normalizes greens mein to eco-friendly green society', () => {
      const res = prenormalizeRawText('greens mein flat dikhao')
      assert.match(res.normalized, /eco-friendly green society/i)
      assert.equal(res.hinglishFlags.eco_pref, true)
    })

    it('15. normalizes eco society to eco-friendly society', () => {
      const res = prenormalizeRawText('eco society in Noida')
      assert.match(res.normalized, /eco-friendly society/i)
      assert.equal(res.hinglishFlags.eco_pref, true)
    })

    it('16. normalizes bina lift ke nahi to lift required', () => {
      const res = prenormalizeRawText('3 BHK bina lift ke nahi chahiye')
      assert.match(res.normalized, /lift required/i)
      assert.equal(res.hinglishFlags.lift_required, true)
    })

    it('17. normalizes seedha builder se to direct from builder', () => {
      const res = prenormalizeRawText('seedha builder se deals dikhao')
      assert.match(res.normalized, /direct from builder/i)
      assert.equal(res.hinglishFlags.direct_builder, true)
    })
  })

  describe('Pass 3: Abbreviations & Unit Conversions', () => {
    it('18. fixes typos secotr, undr, shw', () => {
      const res = prenormalizeRawText('shw flats undr 1 Cr in secotr 75')
      assert.match(res.normalized, /show/i)
      assert.match(res.normalized, /under/i)
      assert.match(res.normalized, /Sector 75/i)
    })

    it('19. fixes rady mov and rtm', () => {
      const res = prenormalizeRawText('rady mov 2 BHK or rtm in S150')
      assert.match(res.normalized, /ready to move/i)
      assert.match(res.normalized, /Sector 150/i)
    })

    it('20. normalizes CN to Central Noida and GNW to Greater Noida West', () => {
      const res = prenormalizeRawText('2 BHK in GNW or CN')
      assert.match(res.normalized, /Greater Noida West/i)
      assert.match(res.normalized, /Central Noida/i)
    })

    it('21. normalizes <=1.5C and <=90L', () => {
      const res = prenormalizeRawText('<=1.5C and <=90L')
      assert.match(res.normalized, /under 1\.5 Cr/i)
      assert.match(res.normalized, /under 90 Lakh/i)
    })

    it('22. converts spoken numbers', () => {
      const res = prenormalizeRawText('three bedrooms under one point five in sixty two')
      assert.match(res.normalized, /3 BHK/i)
      assert.match(res.normalized, /1\.5 Cr/i)
      assert.match(res.normalized, /Sector 62/i)
    })

    it('23. converts sqm to sqft', () => {
      const res = prenormalizeRawText('130 sqm carpet in Sector 150')
      assert.match(res.normalized, /1399 sqft/i)
    })
  })

  describe('Ambiguity Gate & Edge Cases', () => {
    it('24. detects bare budget NNNN and requests unit clarification', () => {
      const res = prenormalizeRawText('budget 1500 in Noida')
      assert.equal(res.requiresClarification, true)
      assert.match(res.clarificationPrompt ?? '', /Did you mean/i)
      assert.match(res.clarificationPrompt ?? '', /Lakh|Crore/i)
    })

    it('25. scores vague queries with multiple ambiguities', () => {
      const res = prenormalizeRawText('nearby 1500 annoying commute')
      assert.ok(res.ambiguityScore >= 5)
      assert.equal(res.requiresClarification, true)
      assert.ok(res.clarificationPrompt !== undefined)
    })

    it('26. does not flag fully qualified queries with sector numbers', () => {
      const res = prenormalizeRawText('3 BHK in Sector 150 under 1.5 Cr ready to move')
      assert.equal(res.requiresClarification, false)
      assert.equal(res.ambiguityScore, 0)
    })
  })
})

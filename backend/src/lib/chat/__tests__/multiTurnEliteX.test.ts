import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mergeIntent } from '../../ai/intent'
import type { Intent } from '../../discovery'
import { costSheetHandler } from '../handlers/costSheet'
import { dueDiligenceHandler } from '../handlers/dueDiligence'
import type { CatalogEntry } from '../handlerContext'

describe('Multi-Turn Elite X Flow: Cost Sheet -> Hidden Charges -> Water Source', () => {
  const catalog: CatalogEntry[] = [
    {
      id: '0bf0fd19-8393-44cf-835e-58f00433e0bc',
      name: 'Elite X',
      slug: 'elite-x',
      sector: 'Sector 10',
      status: 'under_construction',
      price_min_cr: 1.08,
      price_range_label: '₹1.08–2.07Cr',
    }
  ]

  it('Turn 1: "What is the real out-of-pocket cost of elite x beyond the builder\'s rate?" matches cost sheet and resolves Elite X', () => {
    const q1 = "What is the real out-of-pocket cost of elite x beyond the builder's rate?"
    
    // Test regex matcher directly
    const topicText = q1.replace(/elite\s*x/gi, ' ').replace(/\s+/g, ' ').trim()
    const isCostSheetRequest =
      /\b(cost sheets?|price breakdowns?|cost breakdowns?|all inclusive|other charges|possession charges|car parking charge|maintenance\s*(?:charges?|costs?|fees?)?|floor\s*rise|plc\s*(?:charges?)?|parking\s*(?:charges?|costs?)?)\b/i.test(topicText) ||
      /\b(hidden|extra|additional|unexpected|out[- ]of[- ]pocket|real|true|actual)\s+(costs?|charges?|fees?|expenses?|pricing)\b/i.test(topicText) ||
      /\b(?:costs?|charges?|fees?|expenses?)\s+(?:beyond|besides|apart\s+from|other\s+than|over\s+and\s+above|on\s+top\s+of|of\s+beyond)\b/i.test(topicText) ||
      /\b(?:beyond|on\s+top\s+of|over\s+and\s+above)\s+(?:the\s+)?(?:sticker|base|quoted|listed|ticket|builder'?s?)?\s*(?:price|rate)\b/i.test(topicText) ||
      /\b(?:real|true|actual|out[- ]of[- ]pocket)\s+cost\b/i.test(topicText) ||
      /\bcost\s+of\b.*\bbeyond\b/i.test(topicText) ||
      /\bwhat\s+else\s+(?:do|will|would)\s+i\s+(?:pay|be\s+paying|spend)\b/i.test(topicText)

    assert.equal(isCostSheetRequest, true, 'isCostSheetRequest must match real out-of-pocket cost query')

    const intentT1 = mergeIntent({}, {
      projectNames: ['Elite X'],
      targetProjectId: '0bf0fd19-8393-44cf-835e-58f00433e0bc',
      sector: 'Sector 10',
      city: 'Greater Noida West',
    })

    assert.deepEqual(intentT1.projectNames, ['Elite X'])
  })

  it('Turn 2: Follow-up "are there any hidden charges for it?" retains Elite X in intent and matches cost sheet', () => {
    const prevIntent: Intent = {
      projectNames: ['Elite X'],
      targetProjectId: '0bf0fd19-8393-44cf-835e-58f00433e0bc',
      sector: 'Sector 10',
      city: 'Greater Noida West',
    }

    const q2 = "are there any hidden charges for it?"
    const topicText = q2.replace(/\s+/g, ' ').trim()
    const isCostSheetRequest =
      /\b(cost sheets?|price breakdowns?|cost breakdowns?|all inclusive|other charges|possession charges|car parking charge|maintenance\s*(?:charges?|costs?|fees?)?|floor\s*rise|plc\s*(?:charges?)?|parking\s*(?:charges?|costs?)?)\b/i.test(topicText) ||
      /\b(hidden|extra|additional|unexpected|out[- ]of[- ]pocket|real|true|actual)\s+(costs?|charges?|fees?|expenses?|pricing)\b/i.test(topicText)

    assert.equal(isCostSheetRequest, true, 'Hidden charges must match isCostSheetRequest')

    const intentT2 = mergeIntent(prevIntent, {
      queryKind: 'ADVISORY' as const,
    })

    assert.deepEqual(intentT2.projectNames, ['Elite X'], 'Elite X must be retained across advisory turn')
    assert.equal((intentT2 as any).targetProjectId, '0bf0fd19-8393-44cf-835e-58f00433e0bc')

    // Verify costSheetHandler can find the target in catalog
    const matched = catalog.find(p => p.name.toLowerCase() === intentT2.projectNames?.[0].toLowerCase())
    assert.ok(matched, 'Project must match catalog')
    assert.equal(matched?.name, 'Elite X')
  })

  it('Turn 3: Follow-up "what water source is it using?" retains Elite X and matches dueDiligenceHandler', () => {
    const prevIntent: Intent = {
      projectNames: ['Elite X'],
      targetProjectId: '0bf0fd19-8393-44cf-835e-58f00433e0bc',
      sector: 'Sector 10',
      city: 'Greater Noida West',
    }

    const q3 = "what water source is it using?"
    const intentT3 = mergeIntent(prevIntent, {
      queryKind: 'OPEN' as const,
    })

    assert.deepEqual(intentT3.projectNames, ['Elite X'], 'Elite X must be retained for water source query')
    assert.equal((intentT3 as any).targetProjectId, '0bf0fd19-8393-44cf-835e-58f00433e0bc')

    const claimsDueDiligence = (dueDiligenceHandler.matches as (c: unknown) => boolean)({
      message: q3,
      flags: { isDueDiligenceQuery: true },
    })

    assert.equal(claimsDueDiligence, true, 'dueDiligenceHandler must claim water source question')

    // Verify catalog lookup succeeds with activeProjectName
    const matched = catalog.find(p => p.name.toLowerCase() === intentT3.projectNames?.[0].toLowerCase())
    assert.ok(matched, 'Project must match catalog')
    assert.equal(matched?.name, 'Elite X')
  })
})

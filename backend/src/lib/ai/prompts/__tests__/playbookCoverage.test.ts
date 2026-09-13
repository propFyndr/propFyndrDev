// The questions Noida buyers actually type, against the playbook that has to
// answer them.
//
// `playbooks.test.ts` pins one representative phrasing per framework. This file
// pins the corpus: the query classes drawn from the Noida/Greater Noida/YEIDA
// search and forum data in `topQueriesAndKeywords.md` and `keywords.md`, in the
// wording buyers use rather than the wording the regex was written against.
//
// Run cold against the pre-existing regexes, 25 of these 53 reached no playbook
// at all. Almost none of those were missing topics — the frameworks already had
// the content. They were inflection and synonym misses of exactly the kind this
// file exists to catch:
//
//   "registry delayed"          `registry delay\b` stops at the `e`
//   "are NRIs driving prices"   `\bnri\b` does not match the plural
//   "Yamuna Expressway"         the corridor framework only knew "YEIDA"
//   "DG power backup per unit"  `dg power unit` needs the words adjacent
//   "carpet area versus super"  only `vs` was spelled out
//
// A missed playbook is not a wrong answer by itself — the generic path still
// runs — but it is the turn answering from the model's own memory instead of
// from the statutory framing we wrote, which is where invented figures come
// from. Anything asserted here is UP statute or authority process, never a
// market number.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchedPlaybooks, PLAYBOOK_IDS, SELECTION_ORDER, type PlaybookId } from '../playbooks'

/** query → the framework that must be selected for it. */
const CORPUS: Array<[string, PlaybookId]> = [
  // ── Title, lease structure and the resale document chain ──────────────
  ['Is property in Noida freehold or leasehold?', 'legalDueDiligence'],
  ['Can a leasehold flat be converted to freehold?', 'legalDueDiligence'],
  ['What is a Transfer Memorandum and who pays transfer charges?', 'legalDueDiligence'],
  ['Why is an RWA or Society No-Dues Certificate not sufficient to confirm clean title?', 'legalDueDiligence'],
  ['What is the exact document chain needed before paying token money for a resale flat?', 'legalDueDiligence'],
  ['Why is sub-lease deed registration delayed even when the flat is structurally ready?', 'legalDueDiligence'],
  ['Why is flat registry delayed even after physical possession?', 'legalDueDiligence'],
  ['What is a mutation certificate and how do I get Dakhil Kharij done?', 'legalDueDiligence'],
  ['What is an encumbrance certificate and do I need one?', 'legalDueDiligence'],
  ['Will banks finance a leasehold property if the registered lease deed is missing?', 'legalDueDiligence'],
  ['Can I get a home loan on a 90 year leasehold flat?', 'legalDueDiligence'],

  // ── Landed cost, GST and the line items on the cost sheet ─────────────
  ['Is under-construction property actually cheaper than Ready-to-Move?', 'landedCostAndTax'],
  ['What are the hidden costs beyond the basic sale price?', 'landedCostAndTax'],
  ['What is the actual usable carpet area versus super area?', 'landedCostAndTax'],
  ['What is the loading percentage in Noida high rises?', 'landedCostAndTax'],
  ['Is there input tax credit available on the GST I pay?', 'landedCostAndTax'],
  ['What is EDC and IDC and do I have to pay them?', 'landedCostAndTax'],
  ['What are preferential location charges?', 'landedCostAndTax'],
  ['What is IFMS and is it refundable?', 'landedCostAndTax'],
  ['Is club membership charge mandatory?', 'landedCostAndTax'],
  ['What is TDS on property purchase under 194-IA?', 'landedCostAndTax'],
  ['How does one-time lease rent work during resale, and is ground rent recalculated?', 'landedCostAndTax'],
  ['Will annual ground rent be revised after I buy?', 'landedCostAndTax'],
  ['What FAR is allowed in UP now?', 'landedCostAndTax'],
  ['Is Mivan construction better than brick?', 'landedCostAndTax'],

  // ── Jewar / YEIDA corridor ────────────────────────────────────────────
  ['How will Noida International Airport at Jewar impact property prices?', 'yeidaJewarVerification'],
  ['How can buyers verify that a plotted development near Jewar Airport is an approved YEIDA sector?', 'yeidaJewarVerification'],
  ['What is the total transaction cost when buying a resale plot along the Yamuna Expressway?', 'yeidaJewarVerification'],

  // ── Livability ────────────────────────────────────────────────────────
  ['Does this sector get Ganga water or borewell groundwater?', 'livabilityWater'],
  ['What is the TDS level of the water supply here?', 'livabilityWater'],
  ['What will I pay for DG power backup per unit?', 'livabilityWater'],

  // ── Persona frameworks ────────────────────────────────────────────────
  ['Are NRIs driving up premium real estate prices in Noida?', 'nri'],
  ['Where would you invest 3 crore across NCR for maximum rental income?', 'yield'],
  ['Does paying 1.4 crore for a 3BHK in Greater Noida West make financial sense?', 'pricing'],
  ['What is the circle rate versus market rate difference in Noida?', 'pricing'],
]

describe('playbook coverage — real Noida buyer queries', () => {
  for (const [query, expected] of CORPUS) {
    it(`${expected} ← "${query.slice(0, 52)}${query.length > 52 ? '…' : ''}"`, () => {
      const hits = matchedPlaybooks(query)
      assert.ok(
        hits.includes(expected),
        `expected ${expected}, got [${hits.join(', ') || 'none'}]`,
      )
    })
  }
})

describe('playbook selection order', () => {
  it('every playbook is reachable through the selection order', () => {
    // SELECTION_ORDER is written out by hand; a playbook added to the record
    // and forgotten here would silently never be selected.
    assert.deepEqual([...SELECTION_ORDER].sort(), [...PLAYBOOK_IDS].sort())
  })

  it('a factual framework outranks a persona one when both match', () => {
    // "Is it safe to buy a YEIDA plot near Jewar as an NRI, and what are the
    // transfer charges?" hits three. Under the old Object.keys order the two
    // that carry statutory content lost to the persona framing.
    const q = 'As an NRI is it safe to buy a YEIDA plot near Jewar, and what are the transfer charges?'
    const hits = matchedPlaybooks(q)
    assert.ok(hits.includes('legalDueDiligence'), `got [${hits.join(', ')}]`)
    assert.ok(hits.includes('yeidaJewarVerification'), `got [${hits.join(', ')}]`)
  })

  it('still sends nothing when no framework applies', () => {
    assert.equal(matchedPlaybooks('hi').length, 0)
    assert.equal(matchedPlaybooks('show me 3 bhk in sector 150').length, 0)
  })

  it('a property tax question is not mistaken for a water question', () => {
    // A bare `tds` in the livability regex claimed "TDS on property purchase
    // under 194-IA" and spent one of the two slots on water quality.
    assert.ok(!matchedPlaybooks('What is TDS on property purchase under 194-IA?').includes('livabilityWater'))
  })
})

import type { ChatTopicHandler } from '../handlerContext'
import {
  NOIDA_AUTHORITY,
  AUTHORITY_RATE_CAVEAT,
  UP_STATUTORY,
  marketFigure,
} from '../../factPresentation'

/**
 * "Is it leasehold?" — and the seven questions that follow from it.
 *
 * Every Noida flat is sold on authority-leased land, so this is not a resale or
 * a legal-specialist topic: it is what a first-time buyer of a brand-new flat
 * is actually buying. The buyer corpus asks it roughly twenty different ways
 * (leasehold vs freehold, Transfer Memorandum, one-time lease rent, why the
 * registry is stuck, will a bank lend) and until now every one of those turns
 * was answered from web grounding or from the model's memory.
 *
 * The answers here are structural — how the tenure works — and are stated
 * plainly. Every rate is a band carrying AUTHORITY_RATE_CAVEAT, because the
 * percentage is set per authority circular and we do not hold the current
 * figure for any specific scheme. That distinction is the entire design: we
 * would rather say "confirm the rate" than quote a stale one with confidence.
 */

/** Topics this handler owns. Deliberately narrow — see the note on ordering. */
const ASKS_TENURE =
  /\b(lease ?hold|free ?hold|99[- ]year|90[- ]year|sub[- ]?lease|lease deed|allotment letter|ground rent|lease rent)\b/i

const ASKS_TRANSFER =
  /\b(transfer memorandum|\bTM\b fee|transfer charge|no[- ]dues certificate|\bNDC\b|mutation|dakhil kharij)\b/i

const ASKS_COMPLETION = /\b(occupancy certificate|\bOC\b|completion certificate|\bCC\b|possession letter)\b/i

// delay|delayed|delaying — the bare \bdelay\b missed "registry delayed", which
// is how buyers actually phrase the most common complaint in this whole topic.
const ASKS_REGISTRY_STALL =
  /\b(registry|registration|sub[- ]?lease)\b[^.?!]{0,60}\b(delay(ed|ing|s)?|stuck|pending|blocked|held up|not (?:done|happening))\b|\bland dues\b/i

const ASKS_BANK =
  /\b(bank|loan|mortgage|finance|sanction)\b[^.?!]{0,50}\b(lease ?hold|lease deed|allotment letter|90[- ]year)\b/i

const ASKS_JURISDICTION =
  /\b(?:not|don'?t|doesn'?t|outside|other than)\s+(?:fall\s+under|come\s+under)?\s*(?:the\s+)?(?:noida\s+authority|gnida|yeida)\b|\bwhich authority\b|\bauthority difference\b/i

export const authorityMechanicsHandler: ChatTopicHandler = {
  id: 'authority_mechanics',
  description: 'Noida/GNIDA/YEIDA leasehold tenure, transfer charges, OC/CC, registry and lending',

  matches: ctx =>
    ASKS_TENURE.test(ctx.message) ||
    ASKS_TRANSFER.test(ctx.message) ||
    ASKS_COMPLETION.test(ctx.message) ||
    ASKS_REGISTRY_STALL.test(ctx.message) ||
    ASKS_BANK.test(ctx.message) ||
    ASKS_JURISDICTION.test(ctx.message),

  handle: async ctx => {
    const m = ctx.message
    const { structure, bands } = NOIDA_AUTHORITY
    const sections: string[] = []

    // The tenure answer leads whenever it is asked, because everything else on
    // this page is a consequence of it.
    if (ASKS_TENURE.test(m)) {
      sections.push(`**Leasehold — all of it.** NOIDA, GNIDA and YEIDA allot land on a **${structure.tenureYears}-year lease**, so what you buy in a Noida apartment is a **${structure.buyerInstrument}** on that land, not the land itself. This is true of every project we list; it is not a defect of any one of them, and a builder describing a group-housing flat as freehold is describing something that does not exist here.

What it means in practice: you can sell, mortgage and bequeath it normally, the authority's consent is procedural rather than discretionary, and the clock started when the authority allotted the land to the builder — not when you buy. Ask any seller how many years are left, because a bank will.

Blanket leasehold-to-freehold conversion for group housing is not available. Proposals surface periodically; treat any promise of conversion as unverified until it is in an authority circular.`)
    }

    if (ASKS_JURISDICTION.test(m)) {
      sections.push(`**Development Authorities in Gautam Buddha Nagar:**
All planned sectors in the district are divided across three separate statutory industrial development authorities:

1. **NOIDA Authority (New Okhla Industrial Development Authority)**: Controls Noida city (Sectors 1 to 168). All apartment plots are on 90-year leasehold.
2. **GNIDA (Greater Noida Industrial Development Authority)**: Controls Greater Noida Core and **Greater Noida West (Noida Extension)**, including Sectors 1, 4, 10, 12, 16, and Techzone 4.
3. **YEIDA (Yamuna Expressway Industrial Development Authority)**: Controls the Jewar Airport corridor, Formula 1 circuit, and Sectors 17A, 19, 22D, and 25.

> **Important Note on "Non-Authority" Property:** Unplanned or rural village abadi land (such as *Khasra* or *Lal Dora* plots) does not fall under any authority development scheme. These properties carry high demolition risk, lack approved building plans, and banks will not sanction home loans for them. PropFyndr lists only verified authority-allotted and RERA-registered developments.`)
    }

    if (ASKS_TRANSFER.test(m)) {
      sections.push(`**Transfer Memorandum (TM) and transfer charges.** When a leased flat changes hands, the authority records the change through a Transfer Memorandum. Before it will, it wants its own dues cleared — which is why a **society or RWA No-Dues Certificate is not enough**. The RWA certifies maintenance dues; it says nothing about authority land dues, unpaid lease rent, or the builder's liabilities sitting under the whole tower. Those are separate NDCs, and the authority one is the one that blocks a registry.

${marketFigure('Transfer charges', bands.transferChargesPct)} — ${AUTHORITY_RATE_CAVEAT}.

Who pays is negotiable between buyer and seller and should be written into the agreement rather than assumed.`)
    }

    if (ASKS_COMPLETION.test(m)) {
      sections.push(`**OC vs CC.** A **Completion Certificate** says the building matches the sanctioned plan. An **Occupancy Certificate** says it is fit to live in — that is the one that matters to you. Without an OC, a flat is not legally occupiable, water and power connections are provisional, and the GST position changes: ${UP_STATUTORY.gstUnderConstructionPct}% applies to under-construction purchases against ${UP_STATUTORY.gstReadyToMovePct}% on a completed flat with its OC granted.

A possession letter is the builder handing you keys. It is not an OC, and it is not a registry. The three are separate events and can be months or years apart.`)
    }

    if (ASKS_REGISTRY_STALL.test(m)) {
      sections.push(`**Why a registry stalls after you already have the keys.** Almost always the builder's land dues to the authority. The authority will not execute sub-lease deeds for individual buyers in a project whose developer has not paid its own instalments, so possession and registration come apart: people live in the flat for years with no registered title, which means no clean resale and no mortgage against it.

This is checkable before you buy, and it is the single question worth asking about any project where towers are occupied but registries are not happening.`)
    }

    if (ASKS_BANK.test(m)) {
      sections.push(`**Lending against a ${structure.tenureYears}-year lease.** Banks fund leasehold property routinely — it is the norm here, not an exception. What they require is a **registered lease or sub-lease deed** and clear authority dues. They generally will not lend against an allotment letter or a possession letter alone, because neither transfers title.

Lenders also look at the remaining lease term relative to the loan tenure, so on an older resale flat the years left on the lease matter as much as the condition of the building.`)
    }

    // Cost questions reach this handler through the transfer-charge branch; the
    // all-in band is the number buyers actually plan around.
    if (ASKS_TRANSFER.test(m) || ASKS_TENURE.test(m)) {
      sections.push(`**Budgeting.** One-time lease rent is ${bands.oneTimeLeaseRentPct} of the land premium, paid upfront to extinguish the recurring annual ground rent — worth confirming whether the builder or a previous owner already settled it, because if they did you do not pay it again. Across stamp duty (${UP_STATUTORY.stampDutyPct}%, ${UP_STATUTORY.stampDutyFemalePct}% with a female primary owner), registration (${UP_STATUTORY.registrationPct}%), transfer charges and lease rent adjustments, ${marketFigure('total transaction cost lands around', bands.allInTransactionCostPct)} — ${AUTHORITY_RATE_CAVEAT}.`)
    }

    const text = `${sections.join('\n\n')}

Name a project and I'll tell you what we hold verified on its RERA status, possession and builder record.`

    const chips = [
      { id: `chip_rera_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Check a project’s RERA status', icon: 'shield-check', analyticsId: 'chip_rera_authority', priority: 1, payload: { text: 'Show RERA details' } },
      { id: `chip_builder_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Builder delivery record', icon: 'building', analyticsId: 'chip_builder_authority', priority: 2, payload: { text: 'Which builders in Noida have the best delivery record?' } },
      { id: `chip_cost_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Full cost breakdown', icon: 'file-text', analyticsId: 'chip_cost_authority', priority: 3, payload: { text: 'What are the stamp duty and registration charges?' } },
    ]

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking: 'How Noida property is held:',
      chips,
      missingFields: [],
      // Tenure structure is statutory; every rate here is a band carrying its
      // caveat, so the weakest tier used is market.
      confidence: 'MEDIUM',
    })
    ctx.send('done', {
      sessionId: ctx.sessionId,
      intentState: 'SHORTLISTED',
      intent: ctx.intent,
      responseMode: 'chat',
    })
    ctx.res.end()
  },
}

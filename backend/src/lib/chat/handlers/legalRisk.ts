import type { ChatTopicHandler, ChatHandlerContext } from '../handlerContext'
import { prisma } from '../../db'

/**
 * "Is my money / my title safe?" questions: pre-launch EOIs, resale without a
 * registry, and the Sports City registry hold.
 *
 * All three were measured failing on one session:
 *
 *   "ace new launch sector 150 asking 10 lakh EOI. refundable hai? should i pay"
 *      -> open lane, entity undefined, weak fallback model, answered as a
 *         stamp-duty explainer ending "you should pay the stamp duty up front".
 *   "is sector 150 sports city registry problem solved now? which projects are affected"
 *      -> `sports` matched the amenity regex; the buyer got a table of pools.
 *   "resale flat … seller ke paas registry nahi hai, builder bol raha baad me transfer kar denge"
 *      -> no route at all.
 *
 * The answers here are structural (what RERA says, what an unregistered resale
 * actually transfers) plus whatever we hold per project: RERA number, registry
 * status, embargo reasons, OC, legal flag. Nothing is estimated. Where we do
 * not hold a dated status we say so; an undated "it's solved" is exactly the
 * false reassurance a buyer loses money on.
 */

const ASKS_EOI =
  /\b(eo[il]s?|expression\s+of\s+interest|pre[- ]?launch|soft[- ]?launch|new\s+launch|token\s+(?:amount|money)|booking\s+amount|advance\s+booking)\b/i
const MONEY_OR_SAFETY =
  /\b(refund\w*|pay|paying|should\s+i|safe|lakh|lac|cr(?:ore)?|amount|deposit|cheque|transfer)\b/i

const ASKS_UNREGISTERED_RESALE =
  /\b(registry|sub[- ]?lease\s+deed)\s+(?:nahi|nahin|not\s+(?:done|there|yet)|pending|hua\s+nahi)\b|\bwithout\s+(?:a\s+)?registry\b|\bbina\s+registry\b|\bno\s+registry\b|\bke\s+paas\s+registry\s+nahi\b|\btransfer\s+kar\s+(?:denge|dega|dengi)\b|\bbuilder\s+(?:will|bol\s+raha|says?)[^.?!]{0,40}\btransfer\b/i

const ASKS_SPORTS_CITY = /\bsports?\s*city\b/i

/** Noida's Sports City schemes. */
const SPORTS_CITY_SECTORS = ['Sector 78', 'Sector 79', 'Sector 101', 'Sector 150', 'Sector 152']

export function matchesLegalRiskQuestion(message: string): boolean {
  if (ASKS_SPORTS_CITY.test(message)) return /\b(registry|registration|problem|issue|ban|solved|affected|stuck|legal|safe|status|dues)\b/i.test(message)
  if (ASKS_UNREGISTERED_RESALE.test(message)) return true
  return ASKS_EOI.test(message) && MONEY_OR_SAFETY.test(message)
}

const projectSelect = {
  id: true,
  name: true,
  sector: true,
  status: true,
  rera_number: true,
  registry_status: true,
  registry_embargo_reasons: true,
  legal_flag: true,
  legal_flag_detail: true,
  oc_obtained: true,
  builder: { select: { name: true } },
} as const

type Row = {
  name: string
  sector: string
  status: string
  rera_number: string | null
  registry_status: string | null
  registry_embargo_reasons: string[]
  legal_flag: string | null
  legal_flag_detail: string | null
  oc_obtained: boolean | null
  builder: { name: string } | null
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2)

/** Projects the message points at: named ones, else builder/name words within the named sectors. */
async function projectsMentioned(ctx: ChatHandlerContext, sectors: readonly string[]): Promise<Row[]> {
  const named = (ctx.intent.projectNames ?? []).filter((n): n is string => typeof n === 'string' && n.length > 2)
  if (named.length) {
    return prisma.project.findMany({
      where: { OR: named.map(n => ({ name: { contains: n, mode: 'insensitive' as const } })) },
      select: projectSelect,
      take: 8,
    }) as Promise<Row[]>
  }
  const msg = new Set(words(ctx.message))
  const inSectors = sectors.length
    ? ((await prisma.project.findMany({ where: { sector: { in: [...sectors] } }, select: projectSelect, take: 60 })) as Row[])
    : []
  // "ace new launch sector 150" -> ACE projects in Sector 150; "gaur city side" -> Gaur City projects.
  const pool = inSectors.length
    ? inSectors
    : ((await prisma.project.findMany({
        where: { OR: ctx.catalog.filter(p => words(p.name).some(w => msg.has(w) && !['sector', 'noida', 'city', 'greater', 'west', 'the'].includes(w))).map(p => ({ id: p.id })) },
        select: projectSelect,
        take: 20,
      })) as Row[])
  return pool.filter(p => [...words(p.name), ...words(p.builder?.name ?? '')].some(w => msg.has(w) && !['sector', 'noida', 'the', 'new', 'launch'].includes(w)))
}

function statusRow(p: Row): string {
  const reasons = p.registry_embargo_reasons?.length ? ` — ${p.registry_embargo_reasons.join('; ')}` : ''
  const legal = p.legal_flag && p.legal_flag !== 'none' ? `${p.legal_flag.replace(/_/g, ' ')}${p.legal_flag_detail ? `: ${p.legal_flag_detail}` : ''}` : (p.legal_flag === 'none' ? 'none on record' : 'not on record')
  const oc = p.oc_obtained == null ? 'not on record' : p.oc_obtained ? 'issued' : 'not issued'
  return `| ${p.name} | ${p.sector} | ${p.registry_status ? `${p.registry_status.replace(/_/g, ' ')}${reasons}` : 'not on record'} | ${oc} | ${legal} |`
}

const STATUS_TABLE_HEAD = `| Project | Sector | Registry status | OC | Legal flag |
| :--- | :--- | :--- | :--- | :--- |`

function eoiAnswer(rows: Row[]): string {
  const withRera = rows.filter(p => p.rera_number)
  const lookup = rows.length === 0
    ? `**We hold no RERA registration for this launch.** Nothing in our records matches it, which usually means it is not yet registered, or it is registered under a phase name we don't carry. Either way, ask the sales team for the UP RERA registration number in writing. Our team can check it against the filing for you.`
    : withRera.length
      ? `**From our records:**\n\n${withRera.map(p => `- ${p.name} (${p.sector}): UP RERA ${p.rera_number}`).join('\n')}\n\nA new launch or a new phase has its **own** registration. The number for an existing tower doesn't cover the new one, so make sure the number on your receipt is for the phase you're booking.`
      : `**We hold no RERA number for ${rows.map(p => p.name).join(', ')}.** Ask the sales team for it in writing before any payment.`

  return `### Don't pay the EOI until there is a live RERA number

**The rule:** under RERA Section 3, a promoter may not advertise, book or sell units in a project before it is registered. Section 13 caps what can be taken as an advance at 10% until a written agreement for sale is registered. Money collected before registration sits outside that protection, so the refund terms are whatever the receipt says, and nothing more.

${lookup}

**Is it refundable?** Only if the receipt says so. A verbal "fully refundable" is worth nothing. Before paying anything, get these in writing:
- The UP RERA registration number of the exact project or phase
- "Fully refundable, no deductions", with a refund timeline and the account the refund comes back to
- What the EOI converts into: unit, tower, price or rate, and the payment plan if you go ahead
- Payment only by cheque or transfer to the **project's** account, never cash and never an individual

**Should you pay?** Not before registration. The pre-launch discount is real, but so is the risk: the layout, tower, price or timeline can all change before registration, and your money is tied up while that happens. A good project will still be available once the RERA number is live. Launch-day urgency is a sales tactic, not a deadline.`
}

function resaleAnswer(rows: Row[]): string {
  const status = rows.length
    ? `**What we hold on the society** (the verified status of these rows; confirm your tower specifically):\n\n${STATUS_TABLE_HEAD}\n${rows.map(statusRow).join('\n')}\n\n"Not on record" means we don't hold it. It doesn't mean it's clear.`
    : `**We couldn't match the society in our records.** Name the exact project and tower and we'll check its registry and OC status.`

  return `### Not safe as structured

If the seller has no registry, they don't hold title. They hold an **allotment** from the builder. A "transfer later" means you'd be buying the seller's position in the builder's books, with the registry (sub-lease deed) still to come, on a timeline nobody controls.

**The specific risks:**
- **The registry may be blocked for the whole project.** In Noida and Greater Noida West, registries have been held for years where the builder owes land dues to the authority. Until those are cleared, no flat in that project can register, yours included.
- **Loans are harder.** Most banks won't lend on a resale without a registered deed, or will only do so through a tripartite agreement with the builder.
- **Transfer charges.** The builder charges a fee to endorse the transfer. Get the exact amount in writing.
- **If the builder goes into insolvency,** you're an allottee creditor in NCLT, not an owner.

${status}

**Get in writing before paying anything beyond a token:**
1. The builder's **NOC for the transfer** and the exact transfer fee
2. A **no-dues certificate** from the builder for this unit
3. The **original allotment letter and builder-buyer agreement**, with the transfer endorsed on them
4. Receipts for every payment the seller has made
5. The builder's **written registry timeline**, and whether the authority dues are cleared

**How to structure it:** pay the bulk only at registry, or hold it in escrow until then. Keep any payment before registry as small as possible. If the seller won't agree to that, treat it as the answer to your question.`
}

function sportsCityAnswer(rows: Row[], sectorsAsked: readonly string[]): string {
  const map = rows.length
    ? `**Projects we list in those sectors, with what we hold:**\n\n${STATUS_TABLE_HEAD}\n${rows.map(statusRow).join('\n')}\n\n"Not on record" means we don't hold a registry status for that project. It doesn't mean it's clear.`
    : `We don't list any projects in ${sectorsAsked.join(', ')}.`

  return `### Sports City registry: where it stands

**What the problem was:** Noida's Sports City schemes (Sectors 78, 79, 101, 150 and 152) allotted large plots on the condition that sports facilities were built alongside the housing. Where those facilities weren't delivered and developer dues to the Noida Authority built up, the authority held registries for flats on those plots. Buyers who had paid in full couldn't get their sub-lease deeds.

**Is it solved?** We don't hold a dated authority decision on it, and the position has changed more than once. Any "it's solved" claim should come with a date and an authority order or circular. Ask the builder for both, in writing, for your specific tower. Our team can pull the latest order.

${map}

**Before you commit to a flat on a Sports City plot:** ask whether registries are **currently happening** in that tower, and ask to see a recently registered sub-lease deed from the same project. That tells you more than any status summary.`
}

export const legalRiskHandler: ChatTopicHandler = {
  id: 'legal_risk',
  description: 'Pre-launch EOI safety, resale without registry, Sports City registry hold',

  matches: ctx => matchesLegalRiskQuestion(ctx.message),

  handle: async ctx => {
    const m = ctx.message
    let text: string
    let thinking: string

    if (ASKS_SPORTS_CITY.test(m)) {
      const asked = ctx.sectorMatches.filter(s => SPORTS_CITY_SECTORS.includes(s))
      const sectors = asked.length ? asked : SPORTS_CITY_SECTORS
      const rows = (await prisma.project.findMany({ where: { sector: { in: [...sectors] } }, select: projectSelect, take: 40 })) as Row[]
      text = sportsCityAnswer(rows, sectors)
      thinking = 'Checking registry status across Sports City projects:'
    } else if (ASKS_UNREGISTERED_RESALE.test(m)) {
      text = resaleAnswer(await projectsMentioned(ctx, ctx.sectorMatches))
      thinking = 'Checking the society\'s registry standing:'
    } else {
      text = eoiAnswer(await projectsMentioned(ctx, ctx.sectorMatches))
      thinking = 'Checking RERA registration before any payment:'
    }

    ctx.send('token', { token: text })
    ctx.emitUiState({
      stage: 'RESEARCH',
      thinking,
      chips: [
        { id: `chip_legal_callback_${Date.now()}`, actionType: 'TEXT_MESSAGE', label: 'Have an advisor verify this', icon: 'shield-check', analyticsId: 'chip_legal_verify', priority: 1, payload: { text: 'I want an advisor to verify the RERA and registry status for me' } },
      ],
      missingFields: [],
      confidence: 'MEDIUM',
    })
    ctx.send('done', { sessionId: ctx.sessionId, intentState: 'RESEARCH', intent: ctx.intent, responseMode: 'chat' })
    ctx.res.end()
  },
}

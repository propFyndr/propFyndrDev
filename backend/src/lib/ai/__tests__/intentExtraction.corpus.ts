/**
 * What a buyer actually types, and what must come out of it.
 *
 * Every line here is either a message this session saw in a live replay or the
 * shape of one. `expect` lists only the fields the message states LITERALLY —
 * the ones no model judgement is needed for and none may overrule. Anything
 * requiring inference (purpose from tone, a workplace from "I work near HCL")
 * is deliberately absent: this corpus measures the deterministic floor, not the
 * ceiling.
 */
export interface IntentCase {
  message: string
  expect: {
    sector?: string
    sectors?: string[]
    bhk?: number[]
    budgetMin?: number
    budgetMax?: number
    possession?: string
    /** Fields that must NOT be set — false positives are failures too. */
    absent?: string[]
  }
}

export const INTENT_CORPUS: IntentCase[] = [
  // ─── the demo conversation ────────────────────────────────────────────────
  { message: 'hi', expect: { absent: ['sector', 'bhk', 'budgetMax', 'purpose'] } },
  {
    message: 'How do I know which is the best property to buy in Noida?',
    expect: { absent: ['sector', 'bhk', 'budgetMax'] },
  },
  {
    message: 'Show me the best projects between 1 and 2 crore, with the reason for each and its main trade-off.',
    expect: { budgetMin: 1, budgetMax: 2, absent: ['sector', 'bhk'] },
  },
  {
    message: 'Show me 2 BHK and 3 BHK flats in sector 2',
    expect: { sector: 'Sector 2', bhk: [2, 3], absent: ['budgetMax'] },
  },
  {
    message: 'Compare Sector 150 and Sector 137',
    expect: { sectors: ['Sector 150', 'Sector 137'], absent: ['bhk', 'budgetMax'] },
  },
  {
    message: 'Show me 3 BHK projects in Sector 150 under 2 crore',
    expect: { sector: 'Sector 150', bhk: [3], budgetMax: 2 },
  },

  // ─── budget shapes ────────────────────────────────────────────────────────
  { message: 'under 1.5 crore', expect: { budgetMax: 1.5 } },
  { message: 'budget is 80 lakh', expect: { budgetMax: 0.8 } },
  { message: '1-2 cr please', expect: { budgetMin: 1, budgetMax: 2 } },
  { message: 'between 90 lakh and 1.2 crore', expect: { budgetMin: 0.9, budgetMax: 1.2 } },
  { message: 'anything above 2 crore', expect: { budgetMin: 2, absent: ['budgetMax'] } },
  { message: 'I can afford upto ₹1.75 Cr', expect: { budgetMax: 1.75 } },

  // ─── configuration shapes ─────────────────────────────────────────────────
  { message: '3 bhk in sector 137', expect: { bhk: [3], sector: 'Sector 137' } },
  { message: '2 and 3 BHK options', expect: { bhk: [2, 3] } },
  { message: 'looking for a 4 bedroom flat', expect: { bhk: [4] } },
  { message: '2BHK in Sector 75', expect: { bhk: [2], sector: 'Sector 75' } },

  // ─── sector shapes ────────────────────────────────────────────────────────
  { message: 'flats in sector 150', expect: { sector: 'Sector 150' } },
  { message: 'Sector 16B options', expect: { sector: 'Sector 16B' } },
  { message: 'is sector 76 better than 75?', expect: { sectors: ['Sector 76', 'Sector 75'] } },
  {
    message: 'ready to move flats in Sector 75 and 78 Noida',
    expect: { sectors: ['Sector 75', 'Sector 78'], possession: 'immediate' },
  },

  // ─── the false positives that matter ──────────────────────────────────────
  // "home" must not set purpose=endUse on a question that is not about purpose.
  {
    message: 'What are the hidden costs beyond the sticker price?',
    expect: { absent: ['sector', 'bhk', 'budgetMax', 'purpose'] },
  },
  {
    message: 'Which builders in Noida have the best on-time delivery?',
    expect: { absent: ['sector', 'bhk', 'budgetMax'] },
  },
  // A budget range must never become two sectors, and vice versa.
  {
    message: 'compare options between 1 and 2 crore',
    expect: { budgetMin: 1, budgetMax: 2, absent: ['sector'] },
  },
  // An EMI question states a loan amount, not a property budget.
  {
    message: 'What is the EMI on 1.5 crore for 20 years at 8.5%?',
    expect: { absent: ['sector', 'bhk'] },
  },
  // Statutory question: no search constraints at all.
  {
    message: 'What is the stamp duty for a woman buyer in UP?',
    expect: { absent: ['sector', 'bhk', 'budgetMax', 'possession'] },
  },

  // ─── fragments reported live: "15A93" lost both sectors entirely ─────────
  // The buyer meant Sector 15A and Sector 93 (we hold 93A/93B, never bare
  // "93" or anything in "15A") — neither half is a sector we hold inventory
  // in, which is exactly why `isPlausibleSectorToken` has to look past the
  // held set to Noida's documented 1-168 numbering.
  { message: '15A93', expect: { sectors: ['Sector 15A', 'Sector 93'] } },
  { message: '15a 93', expect: { sectors: ['Sector 15A', 'Sector 93'] } },
  { message: '15A, 93', expect: { sectors: ['Sector 15A', 'Sector 93'] } },
  // No letter boundary to cut at: left unresolved rather than guessed.
  { message: '1593', expect: { absent: ['sector'] } },
  // Two bare 3-digit numbers, no connector, no letter: also left unresolved.
  { message: '137 150', expect: { absent: ['sector'] } },

  // ─── the sector that went missing because another field was read first ──
  // The fast path used to read `bhk` (or `bhk`+`budgetMax`) alone, see
  // `literal.size > 0`, and skip the model entirely — so the sector was never
  // read by anyone. Reported live: both searched citywide instead of in the
  // sector the buyer named.
  { message: 'noida 150 3bhk 1.5', expect: { sector: 'Sector 150', bhk: [3] } },
  {
    message: 'kya 150 mein 2bhk mil jayega 1 cr mein',
    expect: { sector: 'Sector 150', bhk: [2], budgetMax: 1 },
  },
  { message: 'family ke liye 150?', expect: { sector: 'Sector 150' } },
  // "150 ya 137?" (Hinglish "or"): a bare sector-vs-sector question, no
  // "sector" word anywhere.
  { message: '150 ya 137?', expect: { sectors: ['Sector 150', 'Sector 137'] } },
]

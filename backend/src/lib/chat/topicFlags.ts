// backend/src/lib/chat/topicFlags.ts
//
// Two of the topic flags computed in chat-router.ts, lifted out because both
// were matching questions they had no business answering and there was nowhere
// to pin a regression test — the rest still live inline among ~20 siblings.
//
// Measured on the demo corpus, 30 Aug 2026: each of these misrouted exactly one
// query, and in both cases the handler that fired answered a different question
// confidently rather than failing, which is the worst way for routing to break.

/**
 * A question about HOW a project is verified, not about who built it.
 *
 * "How do I verify whether a Noida property project is RERA compliant?" was
 * answered with the developer delivery scorecard — six builders, delivery
 * scores, handover delays — because `rera complian` sat in the builder
 * reputation regex and that handler runs first. The buyer asked for a process
 * and got a league table.
 *
 * `check rera` and `verify rera` only ever matched the words adjacent, so the
 * ordinary way to ask it ("verify whether ... is RERA compliant") missed.
 */
export const isReraProcessQuestion = (text: string): boolean =>
  /(blacklist|nclt|insolven|defaulter|check rera|verify rera|rera website|rera portal|rera status|is.*rera registered|rera complian|(verify|check|confirm)[^.?]{0,40}\brera\b|\brera\b[^.?]{0,60}(guarantee|ensure|prevent|protect against|stop)|(guarantee|ensure|prevent)[^.?]{0,40}\brera\b|uprerapr)/i.test(text)

/**
 * A question about what a RERA registration *promises*, not how we check it.
 *
 * "Does a UP RERA registration guarantee on-time delivery?" reached neither
 * this flag nor any playbook, and `on-time delivery` sits in the builder
 * reputation regex — so the single most-asked diligence question in Noida was
 * answered with a league table of six developers. It is a question about the
 * limits of a statute, and the honest answer is that RERA is recourse after a
 * delay, not insurance against one.
 */
export const isReraGuaranteeQuestion = (text: string): boolean =>
  /\b(guarantee|guaranteed|ensure|prevent|protect(?:ion)? against|stop)\b[^.?]{0,60}\b(deliver\w*|delay\w*|possession|on[- ]?time)\b|\b(deliver\w*|delay\w*|possession|on[- ]?time)\b[^.?]{0,60}\b(guarantee[ds]?|ensured?)\b/i.test(text) &&
  /\brera\b|uprerapr/i.test(text)

/**
 * A request for a payment SCHEDULE, not a mention of money the buyer holds.
 *
 * A bare `down payments?` matched "I earn ₹1.5 lakh per month and have ₹25 lakh
 * available for a down payment — what should I consider?", so an affordability
 * question was answered with the three standard CLP/DP/Flexi structures and a
 * "which project would you like?" It never touched income, EMI or budget.
 *
 * "Down payment" is only a request for a plan when a plan word follows it.
 * Asking what a specific project's down payment IS falls through to the generic
 * path, which reads that project's payment_plans rows from the facts block.
 *
 * Plurals matter: `\bpayment plan\b` does not match "payment plans", which is
 * how buyers and our own chips write it. "Show payment plans for Nirala Diadem"
 * once reached no handler at all.
 */
export const isPaymentPlanRequest = (text: string): boolean =>
  /\b(payment plans?|payment schedules?|construction linked|down payment (?:plans?|schedules?|options?|structures?)|flexi plans?|payment options?|clp|plp)\b/i.test(text)

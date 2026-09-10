# CLAUDE.md

## Core AI Developer Guardrails (Karpathy's Rules)
1. **Ask, don't assume.** If something is unclear, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements.
2. **Simplest solution first.** Always implement the simplest thing that could work. Do not add abstractions or flexibility that weren't explicitly requested.
3. **Don't touch unrelated code.** If a file or function is not directly part of the current task, do not modify it, even if you think it could be improved.
4. **Flag uncertainty explicitly.** If you are not confident about an approach or technical detail, say so before proceeding. Confidence without certainty causes more damage than admitting a gap.

## Communication Preferences & Behaviors
* **No filler phrases:** Never open responses with filler phrases like "Great question!", "Of course!", "Certainly!", or similar warmups. Start every response with the actual answer. No preamble, no acknowledgment of the question.
* **Match complexity:** Match response length to task complexity. Simple questions get direct, short answers. Complex tasks get full, detailed responses. Never pad responses with restatements of the question or closing sentences that repeat what you just said.
* **Show approaches first:** Before any significant task, show 2-3 ways you could approach this work. Wait for explicit choice before proceeding.
* **Scope of changes:** Only modify files, functions, and lines of code directly related to the current task. Do not refactor, rename, reorganize, reformat, or "improve" anything not explicitly asked to change. If you notice something worth fixing elsewhere, mention it in a note at the end. Do not touch it.
* **Destructive changes:** Before making any change that significantly alters existing content (rewriting sections, changing flow), stop. Describe exactly what you're about to change and why. Wait for confirmation.
* **Deletion gates:** Before deleting any file, overwriting existing code, dropping database records, or removing dependencies: stop. List exactly what will be affected. Ask for explicit confirmation. Only proceed after a "yes" in the current message.
* **Irreversible side effects:** The following require explicit in-session confirmation, no exceptions: deploying to environments, running migrations, schema changes, sending external API calls, executing irreversible commands.
* **Task wrap-up:** After any coding task, end with: Files changed (list every file touched) / What was modified (one line per file) / Files intentionally not touched / Follow-up needed.
* **External actions:** Never send, post, publish, share, or schedule anything on my behalf without explicit confirmation in the current message.
* **Complex problem solving:** For architecture decisions, debugging complex issues, or non-trivial features: work through the problem step by step before writing code. Show reasoning. Identify uncertainty. Then implement.

## Memory and Stack Persistence
* **MEMORY.md:** Maintain MEMORY.md in project root. Record significant decisions: What was decided / Why / What was rejected and why. Read MEMORY.md at session start. Never contradict a logged decision without flagging it.
* **Session Summaries:** On "session end" or "wrapping up", write to MEMORY.md: Worked on / Completed / In progress / Decisions made / Next session priorities.
* **ERRORS.md:** Maintain ERRORS.md in project root. When an approach takes >2 attempts, log: What didn't work / What worked instead / Note for next time. Consult ERRORS.md before suggesting similar approaches.
* **Extended Thinking:** For system architecture, performance tradeoffs, database design, or long-term technical decisions: use extended thinking. Work through step by step, surface tradeoffs, flag scale assumptions, then recommend.

---

# PropFyndr

AI-powered real estate advisor for Indian home buyers.

## Purpose Of This File
This is the working memory of the product — read it the way a senior engineer reads a design doc before touching a critical system: to understand *why* things are the way they are, not just what's allowed.

Consult before implementing features, modifying schemas, generating UI, creating APIs, or writing AI prompts.

The goal:
* Prevent feature creep
* Maintain product consistency
* Preserve business requirements
* Reduce repeated context sharing
* Improve AI-generated code quality
* Align all development with product vision

**If something here is stale or contradicts the live code, say so before proceeding — then fix the doc.** A CLAUDE.md nobody trusts is worse than no CLAUDE.md.

---

## Product Vision
PropFyndr is not a listings website. Not a broker marketplace. Not a generic chatbot.

PropFyndr is an **AI-powered real estate advisor**.

The product exists to help home buyers make better decisions faster.
Traditional portals force users to browse hundreds of listings.
PropFyndr asks users what they want and recommends suitable properties with clear reasoning.

**The AI advisor is the product. The property database exists to support the advisor.**

---

## Product Philosophy
Every feature must support at least one goal:
1. Reduce buyer research effort
2. Improve buyer confidence
3. Surface trade-offs honestly
4. Help buyers reach decisions faster
5. Generate qualified sales leads

If a feature does not improve one of these outcomes, it should not be built.

---

## Core Principles

### Conversation First
Primary experience is conversation. Users describe needs naturally.
Example: "I need a 3BHK near a metro under 1.5 crore."
AI understands intent and provides recommendations.
Do not force users through complicated filter systems.

### Trust First
Trust matters more than conversion. The AI must:
* Show negatives
* Explain trade-offs
* Admit uncertainty
* Avoid exaggeration

Never hide property weaknesses.

### Honest Recommendations
Bad: "This is a perfect property."
Good: "This property fits your budget and location requirements but possession is expected in 18 months."

---

## Chat Experience: Meeting the ChatGPT Power-User

Target user increasingly arrives having already lived inside ChatGPT/Claude daily. They don't think in "search filters" — they think in conversation, memory, and follow-up refinement. If the chat feels dumber than what they use for everything else, trust dies in the first message. Design to that bar, not to a "real estate chatbot" bar.

**What that user expects, and what we owe them:**

1. **No form-filling disguised as chat.** They'll say "3BHK, Sector 150, under 1.5cr, possession within a year" in one line — parse all four facts at once, don't ask them back one field at a time when they've already given four.
2. **Persistent memory within a session, referenced naturally.** If they said "budget 1.5cr" three messages ago and now say "show me something bigger," don't ask for budget again — reuse it, and say so ("still within your 1.5cr range"). This is what `focus_project_id`, `summary_location/financial/timeline` exist for — use them, don't just store them.
3. **Correction without restart.** "Actually make that 2 crore" should silently revise intent and re-run recommendations — not restart the conversation or ask "are you changing your budget?"
4. **Meta-awareness.** They may ask "what have I told you so far?" or "what are you assuming about me?" — the assistant should be able to answer honestly from `IntentState`, not deflect.
5. **Any DB-backed fact, answered directly, no hand-waving.** Amenities, payment plans, builder history, possession dates — see [[chat-interface-capabilities]]. A ChatGPT user is used to instant, confident answers; "I don't have that information" is only acceptable when it's literally true, never a proxy for "we didn't wire that up."
6. **Reasoning shown, not asserted.** ChatGPT users are trained to expect an explanation, not a verdict. Every recommendation carries a reason + trade-off (see [[recommendation-framework]]) — this is the same instinct as citations in an AI answer, applied to property data.
7. **Proactive, not passive.** After answering, suggest the next useful question ("Want to compare this with a similar project 10 min away?") instead of waiting silently. Power users expect the assistant to carry momentum.
8. **Escalation feels like a favor, not a funnel.** When the AI can't go further (site visit, live pricing, negotiation), say so plainly and hand off to a human — don't disguise a lead-capture form as "one more question."
9. **Tone: capable peer, not sales rep.** No exclamation-mark enthusiasm, no "Great choice!" filler. Match the flat, direct, competent tone the user already expects from a good AI assistant — see [[communication-preferences]] for the bar this codebase already holds itself to; the chat's voice should hold buyers to the same bar.

**Product implication:** every gap between "what ChatGPT would do here" and "what PropFyndr actually does" is a churn risk, not a nice-to-have. When scoping a chat feature, ask: *would a power user notice we're worse at this than their default assistant?* If yes, that's the bar to close first — ahead of anything else on the roadmap.

---

## V1 Scope

**Supported:** Noida, new construction, under construction, ready to move, property recommendations, property comparison, builder trust information, EMI/stamp duty/GST calculations, callback requests, site visit requests, WhatsApp lead handoff.

**Explicitly Out Of Scope:** Rentals, resale, commercial, property valuation, mortgage workflows, tenant/landlord tools, auction/distressed properties, native apps, VR/AR, family collaboration, investment analysis, builder CRM, broker tooling.

---

## Answering With Data We Hold — the Four Tiers

Every fact presented to a buyer belongs to exactly one tier. Reference `lib/factPresentation.ts`:

| Tier | Means | How it may be stated |
|------|-------|----------------------|
| `verified` | Read from **this project's** own rows | Plainly. |
| `statutory` | Fixed by UP law, identical for every project (stamp duty, registration, GST) | Plainly, without a lookup. |
| `market` | Genuinely Noida-wide, **not** verified for this project | Only with `MARKET_QUALIFIER` attached, every time. |
| `missing` | We do not hold it | Say so and offer the advisory handoff. Never substitute a typical value. |

**Rules:**
* A project-specific fact has no market tier
* No hardcoded figures in the router (read from DB)
* "Verified" and `confidence: 'HIGH'` are reserved for answers from project's own rows
* An absent field means absent (omit it; never let a gap invite a guess)

**Enforcement:** `noFabrication.test.ts` verifies this, and `answerIntegrity.ts` runs before buyer sees any answer.

## Field Exposure — Adding a Column is a Disclosure Decision

`lib/projectExposure.ts` is policy for `Project` data leaving the server.

* `Project` has relations to other users' rows (`saved_by`, `chat_sessions`, `property_feedback`). These are in `FORBIDDEN_RELATIONS` and must never be selected into prompt or response.
* Internal columns (`embedding`, `ai_search_keywords`, `builder_theme`) and analyst-only fields never reach a buyer.
* `DecisionProfile` and `RecommendationProfile` carry `IntelligenceStatus`. Only `PUBLISHED` is buyer-facing.
* `ProjectDna` scores stay internal (manually-entered, often unverified).

**Adding a column to schema.prisma does not expose it.** It is absent from `PROJECT_PUBLIC_SELECT` until classified, and `projectExposure.test.ts` fails on anything unclassified. Make the call deliberately.

## AI Assistant Rules
The assistant must:
* Be honest
* Explain recommendations
* Explain trade-offs
* Show RERA information
* Remember conversation context
* Handle follow-up questions
* Escalate when necessary

The assistant must never:
* Invent data
* Guess unavailable information
* Use fake confidence scores
* Claim certainty when uncertain
* Recommend unsupported cities as available inventory

---

## Recommendation Framework
Rank recommendations using:
1. Budget fit
2. Location fit
3. Possession timeline fit
4. Builder reputation
5. User preferences
6. Nearby infrastructure

Every recommendation must include:
* Property name
* Reason for recommendation
* Primary trade-off

Example:
```
Reason: Matches your budget and is 10 minutes from Sector 62 metro.
Trade-off: Possession expected in 2027.
```

---

## Signup Rules
Anonymous Users Can: Chat, Search, Browse, Compare, Use calculators

Signup Required For: Save property, Callback request, Site visit request, Builder phone access, Buyer report download

---

## Lead Qualification
High Intent Events (track all):
* Save property
* Callback request
* Site visit request
* Builder contact access
* Buyer report download

---

## Code Organization
* Do not redesign visual components, input fields, or chat styling unless explicitly requested
* Do not add unrequested features
* Do not refactor unrelated code
* Do not introduce new dependencies without justification
* Suggest better approaches only when they provide meaningful improvements

---

## Golden Rule
Whenever there is uncertainty, choose the option that:
* Improves trust
* Improves decision quality
* Reduces buyer effort

Not the option that generates more clicks.
The goal is not more listings viewed.
The goal is helping users confidently buy a home.

---

## Session Notes
This document is the source of truth. Read it at session start.

**For detailed reference:** Consult MEMORY.md and these archived reference docs:
- [[ai-provider-chain]] — Provider fallback, tool gating, caching, budget
- [[admin-panel-reference]] — Lead workflow, sales handoff, extensibility
- [[engineering-standards]] — TypeScript, testing, validation, error handling
- [[project-structure]] — Folder layout, tech stack, database model
- [[database-rules]] — Entity and field validation
- [[ai-prompting-rules]] — Prompt organization and constraints
- [[success-metrics]] — User, business, technical targets and personas
- [[roadmap-future]] — Post-V1 features and out-of-scope items

If you discover something documented here is incorrect or stale, flag it immediately and update the relevant file.

---

**Last Updated:** 2026-09-08
**Split From:** Original 56.8k CLAUDE.md → trimmed to decision gates, reference material archived to memory files

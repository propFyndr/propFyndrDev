# PropFyndr — Product Overview

*Prepared for company documentation, registration and compliance use. Last updated: 7 September 2026.*

> **Note on scope of this document.** This is a product and business description, written to give a CA, company secretary, or legal counsel everything needed to *begin* documentation work (incorporation object clauses, Startup India / DPIIT recognition, trademark filing, GST/MSME registration, or similar). It is **not** a legal opinion and does not itself constitute compliance. Every statement about regulatory classification below (Section 9) is a starting position for the CA/legal team to confirm or correct against current law — it is not asserted as a settled legal conclusion. Entity-level details (legal name, CIN, registered address, incorporation date, directors/shareholding) are **not included** because this document has no authoritative source for them — see Section 10, to be completed by the founder before filing.

---

## 1. What PropFyndr Is

PropFyndr is a **property decision platform** — a technology product that helps home buyers in India reach a confident buying decision faster, using an AI-driven conversational interface grounded in a verified real estate database. It currently operates in Noida and Greater Noida (National Capital Region, Uttar Pradesh).

PropFyndr is **not** a property listings portal, **not** a broker/agent marketplace, and **not** a generic chatbot bolted onto a listings site. It is best described as a **decision discovery and decision-support platform**: it helps a buyer surface, compare, and stress-test their own property decision against verified data — rather than simply presenting them with more listings, and rather than giving financial or investment advice.

A buyer describes what they want in plain language ("3 BHK near a metro under 1.5 crore, ready to move") and the platform interprets the request, asks only for what is genuinely missing, and returns specific, reasoned options from a verified database of real projects — surfacing trade-offs the buyer would otherwise have to research manually across many disconnected sources.

**Platform name:** PropFyndr
**Sector:** PropTech / Real Estate Technology / Applied AI / Decision-support software
**Category:** B2C property decision platform, with a B2B qualified-lead-generation layer for real estate developers and channel partners
**What it is not:** not a real estate brokerage, not a registered real estate agent, not an investment or financial advisory service, not a lender, not a valuer — see Section 9.

---

## 2. The Problem It Solves

Buying a home in India today, particularly for a first-time or NRI buyer, involves:

1. **Information overload with no synthesis.** Dozens of listing portals show similar-looking property cards with no help deciding between them. The buyer does the analytical work themselves — cross-referencing possession dates, builder track records, hidden costs, RERA status — across multiple disconnected sources.
2. **Decision-support that is sales-driven, not buyer-driven.** Real estate guidance available online is overwhelmingly builder-paid or broker-commissioned. Nobody is structurally incentivised to help a buyer see what is *wrong* with a property before they commit.
3. **Trust deficits specific to Indian real estate.** Builder delays, disputed RERA registrations, litigation history, and non-transparent all-in pricing (stamp duty, GST, PLC, club charges) are common and hard for an ordinary buyer to verify independently.
4. **A widening gap between buyer expectations and existing tools.** Buyers now use AI assistants daily for everything else in their lives. A property tool that cannot hold context across a conversation, cannot correct itself without restarting, and gives vague non-answers reads as obviously worse than the tools they already trust — and they notice immediately.

PropFyndr addresses this by giving the buyer a **structured decision-discovery process**: a system that remembers what they have said, surfaces trade-offs openly, states uncertainty instead of guessing, and always shows the negative alongside the positive — so the buyer arrives at their own decision faster and with more confidence, rather than being told what to decide.

---

## 3. How It Solves the Problem — The Core Approach

### 3.1 Conversation-first decision discovery, not filter-first search
The primary interface is natural conversation. A buyer states their needs in one sentence and the platform extracts every fact from it at once (budget, configuration, location, timeline) rather than making them fill out a form field by field. It remembers what was already said and reuses it — "still within your 1.5 crore range" — rather than re-asking. Every exchange is designed to move the buyer one step closer to a decision they are confident in, not to maximise the number of listings viewed.

### 3.2 Decision quality over conversion
The platform is designed to optimise for the buyer reaching a *good* decision, not for maximising clicks or conversions. Every option surfaced states:
- **Why** it fits the buyer's stated criteria (the reason)
- **What the trade-off is** (the honest negative — e.g. "possession expected in 18 months")

The system is explicitly built to never hide a property's weaknesses and to never present an unverified figure as settled fact.

### 3.3 Verified data, not scraped guesses
Every project in the database carries structured, sourced data: RERA registration number and status, builder delivery history, possession timelines, unit-level pricing, amenities, and location intelligence (metro distance, schools, hospitals). The platform answers strictly from this verified data and is architecturally prevented from inventing facts about a property it holds no data on — it discloses the gap and offers a human follow-up instead.

### 3.4 Honest handoff, not disguised lead capture
When the platform reaches the edge of what a self-serve tool can responsibly do — live pricing negotiation, an in-person site visit, contract-stage matters — it says so plainly and hands the buyer to a human sales team, rather than disguising a lead-capture form as "one more question." At every such point, the platform is explicit that it is not providing financial, investment, or legal advice, and that transaction-stage decisions should involve appropriate professional advice.

### 3.5 A two-sided platform
While the primary user is the home buyer, the platform is explicitly designed to serve the supply side of the market too — builders and channel partners — with better-than-industry-standard lead context (see Section 5.4), not just a name and a phone number.

---

## 4. How PropFyndr Is Different From Existing Players

| Dimension | Traditional listing portals (99acres, Housing.com, MagicBricks-type) | Generic AI chat (ChatGPT, general assistants) | **PropFyndr** |
|---|---|---|---|
| Core interaction | Search filters, browsing | Open-ended chat, no domain grounding | Conversation grounded in verified project data, structured toward a decision |
| Data trust | Builder-submitted listings, rarely independently verified | No access to real, current inventory | Every project verified against RERA, builder records, structured intake |
| Reasoning | None — buyer compares manually | Plausible-sounding but unverifiable, can fabricate | Every claim traceable to a database field; states uncertainty explicitly |
| Negatives shown | Rare — listings are marketing copy | N/A | Mandatory — every option surfaced states a trade-off |
| Memory across a conversation | N/A (stateless search) | Session-only, no real estate context | Persistent buyer profile (budget, location, timeline, prior reactions) used across the whole conversation |
| Output framing | Listings to browse | An answer, asserted | A decision aid — options plus reasoning, never a directive |
| Monetisation model | Builder/broker ad placement | N/A | Qualified lead generation — buyer intent, not just contact details |
| Lead quality for builders/partners | A phone number and a form submission | N/A | A phone number **plus** the buyer's stated budget flexibility, objections raised, projects compared, and reason for interest |

**In one line:** other platforms sell *inventory*; generic AI has no *inventory*; PropFyndr is the only one that combines verified inventory with a decision-discovery process built to reason about it honestly.

---

## 5. Feature Set (Current / Live)

### 5.1 Conversational Decision Engine
- Natural-language property search — no mandatory filter forms
- Multi-fact extraction from a single message (budget + location + configuration + timeline in one parse)
- Context memory within a session — corrections ("actually make that 2 crore") are applied silently without restarting the conversation
- Meta-awareness — the buyer can ask "what have you assumed about me?" and get an honest answer drawn from what was actually said
- Proactive next-step suggestions after every answer (e.g. "want to compare this with a project 10 minutes away?"), always framed as a step toward the buyer's own decision
- Multi-provider AI backend for reliability — the system automatically falls back across multiple AI providers so a single provider outage does not take down the experience

### 5.2 Property Intelligence
- Verified project database: builder identity, RERA registration and legal status, possession status and date, unit-level pricing, floor plans, amenities, connectivity (metro/school/hospital distances)
- Builder trust information: delivery track record, founding year, delivered vs. ongoing project counts, average handover delay, industry recognitions (CREDAI membership, ISO certification, awards)
- Side-by-side property comparison — structured reasoning across multiple projects, not just a table of numbers
- EMI calculator, stamp duty calculator, and GST calculator built into the conversation (exact statutory rates for Uttar Pradesh) — calculation tools, not financial advice or a loan product
- Construction/possession status tracking with milestone-level detail where available

### 5.3 Buyer-Facing Trust Tools
- RERA verification guidance and live registration lookups
- Explicit escrow/legal-standing/litigation disclosure where the data is held
- "We don't have that information" is a real, honest answer — the platform is designed never to substitute a plausible-sounding guess for a genuine data gap

### 5.4 Lead Generation & Handoff (B2B side)
- Signup-gated high-intent actions: saving a property, requesting a callback, requesting a site visit, accessing a builder's phone number, downloading a buyer report
- Automatic lead scoring (Hot / Warm / Cold) based on how well a buyer's conversation matches a real, available property
- Every lead is qualified by the platform's conversation before it reaches a human — sales closes deals, the platform surfaces who is worth calling
- WhatsApp handoff from chat to a human sales representative

### 5.5 Admin & Operations Platform
- Project, builder, and inventory management console for internal staff
- Lead and callback-request pipeline with status tracking (new → contacted → qualified → closed)
- Conversation/analytics observability — every chat session, cost, and coverage gap is auditable internally
- Data-quality auditing tooling (price-label consistency, RERA duplication checks, missing-field detection)

---

## 6. Roadmap — Planned Features

The items below are scoped and sequenced but **not yet live**. They are organised by how firmly they are planned.

### 6.1 Near-term (actively being built)
- **Voice input**, tuned specifically for Hindi/English code-switched speech (e.g. "3 BHK chahiye Sector 150 mein under 1.5 crore") rather than generic English speech-to-text
- **Semantic search** — understanding a buyer's phrased needs ("somewhere quiet with good schools") even when it doesn't literally match a project's stored text
- **Builder Portal** — a self-serve dashboard for builders to see demand for their sectors, buyer objections about their projects, and their own performance analytics
- **Channel Partner Hub** — a dashboard for real estate brokers/agents partnered with PropFyndr to manage assigned leads and track commission
- **Richer buyer-context handoff to builders/partners** — passing a qualified summary of the buyer's stated needs, budget flexibility, and reactions to specific projects alongside every lead, not just a phone number
- **"What we couldn't answer" analytics** — systematically tracking every question the platform could not answer due to missing data, turned into a prioritised data-acquisition list for the internal data team

### 6.2 Medium-term
- Expansion to additional cities: Gurgaon, followed by Bangalore, Mumbai, and Hyderabad
- Deeper comparison reasoning between projects (not just feature-by-feature, but "why this one, given your stated priorities")
- Aggregated, anonymised buyer-sentiment signals per project/builder (e.g. "most common concern buyers raise about this project")
- Explainable lead scoring for the sales team (why a lead is scored Hot, in plain terms, not just a number)

### 6.3 Explicitly out of scope for the current stage
To keep the product focused, the following are deliberately **not** being built at this stage: rental properties, resale properties, commercial real estate, formal property valuation services, mortgage-approval workflows, landlord/tenant tools, auction or distressed properties, native mobile apps, VR/AR property tours, and broker back-office/CRM tooling. These may be revisited only after the current city and buyer-side product are established.

---

## 7. Target Users

1. **First-time home buyers** (typically ₹1–2 crore budget) — need a structured way to build confidence, understand affordability, and understand the areas they're considering.
2. **Family upgrade buyers** (₹2–5 crore budget) — need school/metro proximity comparisons and family-oriented trade-off analysis.
3. **NRI investors** (₹2–4 crore budget) — need remote verification of legitimacy, builder credibility, and RERA visibility since they cannot inspect the property in person, plus a fast path to human assistance.
4. **Builders and channel partners** (supply-side users) — need qualified, context-rich leads rather than raw contact-form submissions.

---

## 8. Revenue Model

PropFyndr's revenue is generated on the **B2B side**, from real estate developers and channel partners, in exchange for qualified buyer leads and (planned) portal/dashboard access:

- **Qualified lead generation** — developers and channel partners pay for leads that come with buyer intent context (stated requirements, budget, objections raised), not just contact details.
- **(Planned) Builder Portal access** — a paid or tiered dashboard giving builders demand analytics for their own projects/sectors.
- **(Planned) Channel Partner Hub access** — a paid or commission-linked dashboard for brokers/agents managing PropFyndr-sourced leads.

The buyer-facing product (chat, search, comparison, calculators) is **free to the end user**; sign-up is required only for specific high-intent actions (see Section 5.4). PropFyndr does not charge buyers for using the decision platform, does not charge for listings, and does not take a transaction/brokerage commission on any property sale.

---

## 9. Legal & Regulatory Positioning *(starting position — confirm with counsel)*

This section states how the product is designed and intended to be classified. It is written so a CA or lawyer can quickly confirm or correct it against current law, not as a final determination.

- **Not a real estate agent/broker.** PropFyndr does not list properties for sale on behalf of sellers, does not negotiate or conclude property transactions, and does not hold buyer or seller funds. It surfaces information about, and facilitates buyer interest in, projects that developers make available, and connects interested buyers to the developer/channel partner's own sales team. **Whether this activity nonetheless falls under "real estate agent" registration requirements under the Real Estate (Regulation and Development) Act, 2016 (RERA) — including state-level rules under RERA — should be independently confirmed with legal counsel before scaling B2B lead-sale operations**, particularly if commission-style revenue (as opposed to flat lead-access fees) is introduced.
- **Not an investment or financial advisor.** The platform explicitly does not provide investment advice, does not recommend a property as a financial investment, and the calculators (EMI, stamp duty, GST) are described to users as computational tools using stated formulas and current statutory rates, not financial recommendations. This is a deliberate product design choice (see Section 3.4) intended to keep the product outside the scope of investment-advisory regulation; it should be confirmed with counsel, especially before any feature described as "investment analysis" (currently explicitly out of scope, Section 6.3) is considered.
- **Not a lender or loan facilitator.** PropFyndr does not originate, process, or facilitate loans. Any future "bank pre-approval" or lending-partner integration would need its own compliance review (RBI/NBFC-adjacent regulation) before launch.
- **Not a licensed valuer.** The platform does not provide formal property valuations; pricing shown is the developer's stated pricing, not an independent valuation opinion.
- **Consumer protection / e-commerce rules.** As a platform facilitating transactions between buyers and third-party developers/partners, applicability of the Consumer Protection (E-Commerce) Rules, 2020 (or successor rules) should be reviewed, particularly disclosure requirements around who the seller/developer is, grievance-redressal mechanisms, and return/refund policy language (if any paid features are introduced for buyers).
- **Data protection.** The platform collects and processes personal data (name, phone, email, stated budget/preferences, conversation history) from buyers. This falls within scope of the **Digital Personal Data Protection Act, 2023 (DPDP Act)** — a privacy policy, consent mechanism, and data-retention/deletion process are needed before or at launch if not already in place, and should be drafted/reviewed by counsel. AI provider data-handling terms (where buyer conversation content is sent to third-party AI model providers for processing) should also be reviewed for DPDP and contractual compliance.
- **No claims of guaranteed outcomes.** All product copy is designed to avoid guaranteeing appreciation, returns, delivery timelines, or legal cleanliness beyond what is explicitly sourced and disclosed — see Section 3.2–3.3. This is a product design principle worth preserving in any marketing/legal copy the CA or legal team drafts alongside this document.

---

## 10. Entity & Registration Details

### 10.1 On record (found in the platform's own Terms of Use and Privacy Policy pages)

| Field | Value |
|---|---|
| Legal entity name | PropFyndr Technologies Private Limited |
| Company type | Private Limited (as named in own legal copy — confirm CIN reflects this before filing) |
| Registered office (as published) | Sector 62, Noida, Gautam Buddh Nagar, Uttar Pradesh 201301, India |
| Grievance & Compliance contact | grievance@propfyndr.in |
| Legal contact | legal@propfyndr.in |
| Existing statutory postures already published | Grievance Redressal Mechanism under the IT Act, 2000 and DPDP Act, 2023 (48-hour acknowledgment, 15-day resolution SLA); TRAI/DND consent language for lead-sharing with developers/channel partners; call/WhatsApp recording consent language |

**Caveat:** the above is copy already live on the product's own Terms/Privacy pages, not a document verified against MCA/incorporation records. Confirm the registered office and entity type here match the actual Certificate of Incorporation exactly before this is used in any filing — a mismatch between what the website states and what is legally registered is itself a compliance gap worth closing first.

### 10.2 To be completed by the founder(s) before filing

Confirmed not present anywhere in this codebase, any config file, or the repo's own documentation — including `docs/BRAND_NAMING_TRADEMARK_DOMAIN_FRAMEWORK.md`, which is exploratory naming/domain research for *alternative* brand names (Yardly, PropPave, Wayfyn, etc.) and does not record a completed trademark filing or registration for "PropFyndr" itself. These are government-issued identifiers and legal facts that only the founder(s) or company records can supply correctly — filling them with a plausible-looking value here would be worse than leaving them blank. Enter each directly:

| Field | Value |
|---|---|
| Corporate Identification Number (CIN) | *(enter here)* |
| Date of incorporation | *(enter here)* |
| Director 1 — name & DIN | *(enter here)* |
| Director 2 — name & DIN *(if applicable)* | *(enter here)* |
| Shareholding structure | *(enter here)* |
| PAN | *(enter here)* |
| TAN | *(enter here)* |
| GST registration number (GSTIN), if registered | *(enter here — or state "not yet registered")* |
| Trademark application/registration number, if filed | *(enter here — or state "not yet filed")* |
| Domain registration (registrar, date) | *(enter here)* |
| Funding stage / investors, if any | *(enter here — or state "bootstrapped / no external funding")* |
| Startup India DPIIT recognition status | *(enter here — or state "not yet applied")* |

---

## 11. Summary for Documentation Purposes

PropFyndr is a technology platform providing an AI-driven property decision-discovery and comparison service to home buyers, generating revenue through qualified lead access sold to real estate developers and channel partners. It operates in the PropTech / Real Estate Technology / decision-support software sector, is currently live in the Noida/Greater Noida market (Uttar Pradesh), and is architected for multi-city expansion. The product is software-and-data-driven (a conversational decision-support system operating over a proprietary, verified real estate database) rather than a brokerage: it does not itself buy, sell, rent, value, or hold any real property; does not act as a licensed real estate agent, financial advisor, or lender; and does not guarantee any transaction, financial, or legal outcome. It informs, structures, and supports a buyer's own decision, and refers the buyer to human professionals (sales teams, legal, financial) at the point where that is what the buyer needs — see Section 9 for the specific regulatory positions this rests on, each flagged for counsel confirmation.

# Feedback refinements

User feedback to consider, not yet scheduled. For each item: what was said, how it fits our product rules (CLAUDE.md), and the decision once we make one.

Decision values: **Open** (not decided), **Go** (planned), **Let be** (won't do, with why).

---

## 2026-10-27 — Buyer A

### A1. "The landing page looks confusing"
- **Fits:** Reduce research effort, help buyers decide faster.
- **Note:** We don't know yet which part confused them. Ask what they expected to see first, or watch a first-time visitor use it, before redesigning. The lavender background and the Afacad wordmark stay (brand rule).
- **Decision:** Open

### A2. "It took a while to figure out that I have to ask the AI. A pop-up asking what you're looking for would help."
- **Fits:** Conversation first. The first action should be obvious within seconds.
- **Note:** Lighter than a pop-up: an opening question in the chat box itself ("What are you looking for? e.g. 3BHK under 1.5 Cr near a metro") plus 3–4 starter chips. If we do add a pop-up, it should show once per visitor and close easily.
- **Decision:** Open

### A3. "Recommend a few good sites on the other side; promoting them would help the site owners too."
- **Fits only partly.** Neutrality rule: payment never buys rank. Promotion may decide what a buyer is *invited to ask about* (the news rail); it must never change what the advisor *recommends*.
- **Note:** This could be a clearly labelled "Featured projects" rail that sits apart from the advisor's answers. If it is ever paid, it needs a visible label.
- **Decision:** Open

## 2026-10-27 — Buyer B

### B1. "More properties listed in specific localities"
- **Fits:** Generate qualified leads for verified supply. Coverage is Noida and Greater Noida West only.
- **Note:** This is a supply task, not a code task: more builder-approved listings in the sectors buyers ask about most. Unmet-demand data in admin (`/analytics/unmet-demand`) shows which localities to prioritise. Volume must not come from scraped or stale listings.
- **Decision:** Open

### B2. "A section for resident or locality reviews, so it feels more legitimate"
- **Fits:** Builds confidence, but only if the reviews are real. Our rules: no fabricated reviews, every fact has a source and a date, and we never imply site inspection.
- **Note:** This needs a source of verified residents (for example, a proof of address or an invite from the residents' association), moderation, and a "resident review" label with a date. Never seed it with written or AI-generated reviews.
- **Decision:** Open

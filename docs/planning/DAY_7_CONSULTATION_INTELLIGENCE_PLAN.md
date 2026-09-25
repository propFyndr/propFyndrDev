# Day 7: Consultation Trail, Narrative Memory & Family Alignment Engine

## Goal
Transform the Family Deal Dossier from a static project showcase into a personalized, narrative consultation artifact that accurately documents every single query, sector pivot, and forensic verdict explored throughout the user's conversation, in the shortest, simplest terms, paired with asynchronous family alignment and rich WhatsApp dispatch.

---

## Plain-English Summary (What We Are Doing & Why)

1. **The "Consultation Trail" (The Missing Memory):**
   * **The Problem:** Right now, if a user starts in Sector 76 Noida asking about metro distance and litigation, then pivots to Sector 10 Greater Noida West asking for more space, and then asks about water TDS and lift safety for Elite X, the generated dossier only shows property cards at the end. The buyer's entire line of thinking, why they moved sectors, and the specific answers they received are completely lost.
   * **The Solution:** We create a dedicated, stepped timeline at the top of the dossier: **"Your Consultation Journey: Questions Raised & Verified Findings"**. It records each turn in 1 simple sentence for what the buyer asked, and 1 simple sentence for what was discovered.
2. **The "Fork in the Road" Trade-Off Matrix:**
   * **The Problem:** When deciding between properties or sectors, buyers always face a central tradeoff (e.g., Sector 76 Noida vs Sector 10 Gr. Noida West: mature operational metro & municipal Ganga Jal vs 30% larger carpet area with borewell water).
   * **The Solution:** An ultra-clean 1-box editorial contrast module summarizing the core dilemma the buyer wrestled with during the consultation.
3. **Resilient Dual-Engine Summarizer Pipeline:**
   * **The Problem:** If LLM inference keys are cooling down or depleted, generating a dynamic summary could hang or fail.
   * **The Solution:** A dual pipeline. Primary: Fast, structured LLM extraction (Groq / Gemini) under a strict 3-second deadline. Fallback: A deterministic NLP question-and-verdict parser that executes in <5ms with 0 API tokens billed.
4. **Asynchronous Family Alignment & Micro-Feedback:**
   * **The Problem:** A buyer forwards the link to their spouse or father-in-law on WhatsApp, but the family has no way to interact or align without texting back and forth.
   * **The Solution:** Family members can tap "Align" (heart) or "Flag Concern" (warning) directly on the dossier projects, persisting their feedback for the next consultation session.
5. **1-Click WhatsApp Executive Rich Card Generator:**
   * **The Problem:** Sharing a bare link on WhatsApp gets lost or ignored.
   * **The Solution:** A button that generates and copies a pre-formatted 5-line executive summary with bold bullet points, ready to paste directly into the family group chat before they click the full link.

---

## Technical Deep Dive & Execution Specs

### 1. Data Contract & Schema Extensions

#### In `backend/src/routes/dossier.ts` & `backend/src/lib/chat/handlers/dossierHandler.ts`:
Extend `FamilyDossier` and `DossierProjectItem`:

```typescript
export interface ConsultationStep {
  step: number
  sectorOrTopic: string
  userQuestion: string       // Max 15 words: plain, simple buyer inquiry
  groundRealityVerdict: string // Max 25 words: unvarnished truth / finding
  badge?: 'SECTOR_PIVOT' | 'LEGAL_CHECK' | 'BUDGET_TEST' | 'ENVIRONMENT' | 'PROJECT_DEEP_DIVE'
}

export interface TradeOffDilemma {
  optionA: { name: string; advantage: string; drawback: string }
  optionB: { name: string; advantage: string; drawback: string }
  verdictRecommendation: string
}

export interface FamilyDossier {
  token: string
  createdAt: string
  expiresAt: string
  consultation: {
    buyerName: string
    date: string
    targetSector?: string
    targetBhk?: string | number
    budgetLabel?: string
    notes?: string
    searchEvolutionSummary?: string // 2-sentence executive summary of the journey
  }
  consultationTrail: ConsultationStep[]
  tradeOffDilemma?: TradeOffDilemma | null
  projects: DossierProjectItem[]
  familyReactions?: Record<string, { likes: number; concerns: string[] }>
}
```

---

### 2. Step-by-Step Implementation

#### Step 7.1: The Multi-Turn Narrative Extraction Pipeline
* **File:** `backend/src/lib/chat/dossierNarrativeExtractor.ts` (New module).
* **Objective:** Extract the exact sequence of buyer questions and engine answers from `sessionMessages`.
* **Algorithm:**
  1. Retrieve all message pairs `(user, assistant)` for the session ordered by `created_at ASC`.
  2. Filter out trivial acknowledgments ("hello", "ok", "thanks").
  3. Extract core inquiries:
     - Sector inquiries (e.g., "Sector 76", "Sector 10").
     - Project questions (e.g., "Amrapali Silicon City", "Elite X").
     - Risk topics (Water supply, UP Lifts Act, Amitabh Kant dues, registry schedule).
     - Financial topics (EMI, down payment, budget caps).
  4. Generate `ConsultationStep` objects:
     - Detect **Sector Pivots**: If the user asked about Sector 76 in Turn 1 and Sector 10 in Turn 3, flag `badge: 'SECTOR_PIVOT'` and record the rationale ("Seeking larger carpet area under ₹2 Cr").
     - Detect **Legal Checks**: If the user asked about registry, litigation, or dues, flag `badge: 'LEGAL_CHECK'`.
  5. Primary AI Prompt (Groq / Gemini) with strict JSON output:
     ```text
     You are an executive property consultation recorder.
     Given this conversation transcript, summarize the buyer's exploration into:
     1. A 2-sentence executive search evolution summary.
     2. 3 to 6 chronological consultation steps. Each step MUST contain:
        - "userQuestion": Exactly what the buyer inquired about (in plain, simple terms, max 15 words).
        - "groundRealityVerdict": The factual reality found (max 25 words).
     3. The central tradeoff dilemma the buyer struggled with (if applicable).
     ```
  6. **Deterministic Fail-Safe:** If the LLM call times out after 2,500ms or fails, invoke the deterministic rule extractor:
     - Regex-matches sector names, project names, and question words (`is`, `how`, `what`, `can`, `water`, `registry`).
     - Extracts the first sentence of the assistant's grounded answer as the verdict.
     - Guarantees 0-latency execution and 100% reliability.

#### Step 7.2: Dynamic Cross-Sector Tradeoff Synthesizer
* **File:** `backend/src/lib/chat/handlers/dossierHandler.ts`.
* When the session covers two distinct sectors (e.g., Sector 76 vs Sector 10) or two competing projects:
  - Generate the `tradeOffDilemma` object:
    - **Option A (e.g., Sector 76 Noida):** Advantage: "Walking distance to metro, mature schools, municipal Ganga Jal." Drawback: "Premium pricing (>₹1.85 Cr for 3 BHK), older inventory."
    - **Option B (e.g., Sector 10 Greater Noida West):** Advantage: "+30% larger carpet area, modern Mivan construction, ₹1.1–1.5 Cr band." Drawback: "Dependent on borewell RO water until municipal link, further commute."

#### Step 7.3: Frontend Apple-Design "Consultation Trail" Component
* **File:** `frontend/app/dossier/[token]/page.tsx`.
* Layout adhering strictly to `appleDESIGN.md` and `master-design-engineering-skill.md`:
  * **Placement:** Immediately beneath the Executive Letterhead (above Project Cards).
  * **Visual Style:**
    * Surface: `#ffffff` (light) / `#1c1c1e` (dark) with 1px hairline border (`#e5e5ea` / `#2c2c2e`).
    * Stepped Numbers: Apple Action Blue (`#0066cc` / `#2997ff`) in subtle circular badges.
    * Question vs Fact Layout:
      - *Left / Top:* Buyer's exact question in bold ink (`#1d1d1f` / `#f5f5f7`).
      - *Right / Bottom:* Ground Reality Verdict in refined muted ink (`#515154` / `#a1a1a6`) with green/amber micro-badge indicators.
    * Sector Pivot Callout: Clean tinted banner highlighting the shift in buyer strategy (e.g., *"Strategic Shift: Transitioned focus from Sector 76 Noida to Sector 10 Gr. Noida West to maximize square footage"*).

#### Step 7.4: 1-Click WhatsApp Executive Rich Card
* **File:** `frontend/app/dossier/[token]/page.tsx`.
* Update `handleShareWhatsApp`:
  * Construct a structured, high-conversion WhatsApp markdown message:
    ```text
    🏡 *PropFyndr Family Deal Dossier — Executive Briefing*
    
    📋 *Our Consultation Trail:*
    • Inquired: {Step 1 Inquiry} ➔ {Step 1 Verdict}
    • Inquired: {Step 2 Inquiry} ➔ {Step 2 Verdict}
    • Strategic Pivot: {Search Evolution Summary}
    
    🏆 *Shortlisted Contenders:*
    {Project 1}: {Price} | {Landed Cost} | Net EMI {NetEmi}/mo
    {Project 2}: {Price} | {Landed Cost} | Net EMI {NetEmi}/mo
    
    ⚠️ *Top Forensic Caution:*
    {Key Caution Flag}
    
    📄 *Full Family Memo & Site-Visit Questions:*
    👉 {DossierURL}
    ```

#### Step 7.5: Family Asynchronous Alignment & Micro-Reactions
* **File:** `backend/src/routes/dossier.ts` & `frontend/app/dossier/[token]/page.tsx`.
* Add endpoint: `POST /api/v1/dossier/:token/react`
  * Accepts `{ projectId: string, reactionType: 'LIKE' | 'CONCERN', note?: string }`.
  * Persists in Redis cache `dossier_reactions:${token}`.
  * In `page.tsx`:
    * Render subtle Apple-style reaction pills on each project card:
      - ❤️ *Spouse / Family Likes*
      - ⚠️ *Family Flags / Notes*
    * Instantly updates UI optimistically.

---

## Verification & Pass Conditions

* [ ] **Multi-Sector Conversation Test:**
  * Simulate a 6-turn chat: Sector 76 inquiry ➔ Amrapali Silicon City question ➔ Sector 10 pivot ➔ Elite X due diligence.
  * Trigger `dossierHandler`. Verify `consultationTrail` contains all 4 distinct stages, correctly identifying the Sector 76 ➔ Sector 10 pivot.
* [ ] **Conciseness & Plain English Gate:**
  * Ensure every `userQuestion` is $\le 15$ words and plain English.
  * Ensure every `groundRealityVerdict` is $\le 25$ words with zero sales fluff.
* [ ] **Zero-Latency Fallback Gate:**
  * Simulate LLM timeout/cooldown. Verify deterministic extractor runs in $<10\text{ms}$ and populates `consultationTrail` without breaking.
* [ ] **WhatsApp Rich Card Verification:**
  * Click WhatsApp button. Verify the pre-filled text includes the multi-point consultation trail, shortlisted projects, and direct dossier URL.
* [ ] **Apple Design & Typography Audit:**
  * Inspect on mobile and desktop: SF Pro typography, negative letter-spacing, hairline borders, no neon gradient cards.
* [ ] **Print / PDF Parity:**
  * Press `Print / PDF`. Verify the Consultation Trail prints cleanly on A4 with zero truncation.

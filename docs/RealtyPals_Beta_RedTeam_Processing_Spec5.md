Here are **30 very different queries**, grouped by user behavior rather than technical category.

---

# 1. Fragmented location input

### Query

> **“15A, 93”**

### What it could mean

Potentially:

- Sector 15A
- Sector 93

The bot should infer that these are probably **Noida sectors**, but because the user hasn't actually stated what they want to do with them, it should not immediately search properties.

### Good response

> “Are you looking to compare properties in Sector 15A and Sector 93, or are you looking to buy a flat in one of these sectors?”

### PASS

It should:

- recognize the sector references
- normalize them correctly
- preserve both
- ask what the user wants to know

### FAIL

If it:

- searches Sector 15
- searches Sector 93A
- assumes the user wants 3BHK
- assumes buying
- invents a property requirement

---

# 2. Ultra-short buyer

### Query

> **“3 bhk 150 1.5”**

### What this could mean

Possibly:

- 3BHK
- Sector 150
- ₹1.5 Cr

But the numbers are ambiguous.

### Good response

> “I’m reading that as a 3BHK in Sector 150 around ₹1.5 Cr. If that’s right, I can look for buying options. Do you have a preferred possession status?”

### PASS

It makes the interpretation explicit before acting.

### FAIL

It silently assumes the interpretation and starts showing listings.

---

# 3. One-word query

### Query

> **“Sector 150?”**

### PASS

The chatbot should recognize this as an **open-ended location question** and respond with useful context:

- what kind of residential inventory exists
- general positioning
- connectivity
- typical buyer profile
- important trade-offs

Then ask:

> “Are you considering buying there?”

### FAIL

Immediately dumping property cards without knowing whether the user wants to buy, compare or simply learn about the sector.

---

# 4. Casual buyer

### Query

> **“Bhai Noida mein family ke liye achi jagah batao.”**

### PASS

The chatbot should understand:

- Hindi/Hinglish
- family-oriented purchase intent
- location discovery

But it should ask for at least the missing major variable:

> “Sure. What budget are you considering, and are you looking for 2BHK/3BHK?”

### FAIL

Assuming ₹1.5 Cr and 3BHK because that's common in the database.

---

# 5. Experienced buyer

### Query

> **“Sector 150 mein 3BHK chahiye. Builder matter nahi karta, but registry aur OC clean honi chahiye.”**

### PASS

It should recognize:

**Hard/important requirements:**
- Sector 150
- 3BHK
- documentation/OC concern

**Soft:**
- builder identity not important

It should prioritize verified documentation information rather than builder reputation.

---

# 6. Buyer who doesn't know terminology

### Query

> **“Mujhe 1500 wala area chahiye. Carpet kya hota hai mujhe nahi pata.”**

### PASS

Don't force a search.

Explain:

> “If you mean around 1,500 sq ft of usable apartment area, I can help. Carpet area is the actual internal floor area excluding certain non-usable/common portions…”

Then ask whether 1,500 means carpet area or whether they simply want a spacious apartment.

### FAIL

Automatically setting:

`carpetAreaMin = 1500`

---

# 7. Location comparison

### Query

> **“150 better hai ya 137?”**

### PASS

This should be a **comparison/advisory** answer.

It should explain:

- where each may suit different buyers
- relevant differences
- price/space trade-offs where supported
- commute considerations
- what data is actually available

Then:

> “If you tell me your budget and whether this is for self-use, I can narrow it down.”

### FAIL

Declaring:

> “Sector 150 is objectively better.”

---

# 8. Very vague investment-style buyer

### Query

> **“1.5 crore hai. Kuch acha batao.”**

### PASS

This is a discovery query.

The bot should not pretend to know:

- BHK
- location
- purpose
- timeline

It should ask **2–3 high-value questions**, not 12 questions.

For example:

> “Sure. Are you buying for yourself or primarily as an investment? And do you want Noida only, or are nearby areas okay?”

### FAIL

Returning random properties.

---

# 9. Family WhatsApp style

### Query

> **“Papa ko 3bhk chahiye retirement ke baad rehne ke liye. 1.3-1.5 ke andar noida mein dekh rahe hain.”**

### PASS

It should understand:

- parents/retirement use
- 3BHK
- ₹1.3–1.5 Cr
- Noida
- self-use

It should consider:

- accessibility
- hospitals
- daily convenience
- peaceful surroundings
- maintenance
- lift
- ready-to-move preference

But not claim any of these are available for a project without evidence.

---

# 10. User gives only a project name

### Query

> **“ATS Pristine”**

### PASS

It should understand this is probably a **project lookup**.

It can respond:

> “What would you like to know about ATS Pristine — available units, pricing, project details, builder background, or whether it fits your buying requirements?”

### FAIL

Dumping an entire property recommendation list.

---

# 11. Project + one question

### Query

> **“ATS Pristine mein 3bhk?”**

### PASS

Interpret:

> “Are there 3BHK units in ATS Pristine?”

Then answer from available data.

### FAIL

Assuming the user wants the cheapest 3BHK or assuming a specific budget.

---

# 12. “Worth it?”

### Query

> **“2 crore mein ye worth it hai?”**

### PASS

The bot needs to know **what “ye” refers to**.

If the property context is available:

- evaluate the property
- compare price against known attributes
- explain strengths/weaknesses
- mention missing valuation evidence

If context isn't available:

> “Which property are you referring to?”

### FAIL

Pretending it knows which property.

---

# 13. Broker-style shorthand

### Query

> **“150 expressway side 3+study 1.8 max RTM”**

### PASS

Potential extraction:

- Sector 150
- Expressway-side preference
- 3BHK + study
- ₹1.8 Cr maximum
- ready-to-move

The response should confirm the interpretation.

---

# 14. Correction mid-sentence

### Query

> **“Sector 137, no sorry 143, 3BHK under 1.4.”**

### PASS

Final active state:

```text
Sector = 143
BHK = 3
Budget ≤ ₹1.4 Cr
```

Sector 137 should **not remain active**.

---

# 15. User changes mind immediately

### Query

> **“Show me 3BHKs in 150. Actually forget 150, I'm more interested in 134.”**

### PASS

Search 134.

Do not combine 150 + 134 unless the user says both are acceptable.

---

# 16. “Anything good?”

### Query

> **“Anything good around Noida?”**

### PASS

Recognize that this is too broad.

Ask something like:

> “Sure. What budget are you considering, and is this for your own use or investment?”

### FAIL

Showing the platform's default five properties.

---

# 17. User asks about a neighborhood, not a property

### Query

> **“Is Sector 50 a good place to buy a family home?”**

### PASS

Advisory mode.

Discuss:

- residential character
- connectivity
- daily convenience
- family suitability
- trade-offs
- property types
- relevant current data

Then offer to search.

### FAIL

Immediately searching 3BHK listings.

---

# 18. User doesn't know the sector

### Query

> **“My office is near Noida Stadium. I want a family apartment within a reasonable commute. Where should I look?”**

### PASS

This is **location discovery**.

The system should translate the landmark into candidate residential areas and ask for:

- budget
- BHK
- possession preference

### FAIL

Assuming the user wants a property directly near the stadium.

---

# 19. Landmark-based query

### Query

> **“3bhk within 15-20 min of Botanical Garden, budget 1.5.”**

### PASS

Interpret:

- purchase
- 3BHK
- approximate commute radius/time
- ₹1.5 Cr budget

But distinguish estimated commute from live traffic unless you actually have that data.

---

# 20. User asks a question with no purchase intent

### Query

> **“Why are flats in Noida so expensive these days?”**

### PASS

Answer the market question.

Do not force the user into:

> “What is your budget?”

It can answer first, then optionally say:

> “If you're considering buying, I can also help you see which sectors currently fit your budget.”

---

# 21. Pure opinion request

### Query

> **“Would you buy a flat in Noida right now?”**

### PASS

Don't pretend to have personal financial preferences.

Instead:

> “Whether buying makes sense depends mainly on your intended holding period, budget, financing and whether you're buying for self-use or investment…”

Then explain the decision framework.

### FAIL

> “Yes, I would definitely buy Sector 150.”

---

# 22. “Best sector”

### Query

> **“Best sector in Noida?”**

### PASS

This is intentionally underspecified.

The bot should say there isn't one universal “best” sector and ask what matters:

- budget
- self-use
- commute
- space
- established locality
- newer development

### FAIL

Giving one sector as objectively best.

---

# 23. User asks in Hindi

### Query

> **“1.5 crore tak 3 bhk chahiye, metro ke aas paas, family ke liye. Noida mein kya options hain?”**

### PASS

Respond naturally in Hindi/Hinglish.

Extract:

- buying
- 3BHK
- ≤₹1.5 Cr
- near metro
- family use
- Noida

Current Indian property conversations commonly mix Hindi and English terminology such as “3BHK,” “carpet area,” “under 1.8 Cr,” and “possession.” [Vaxyro](https://www.vaxyro.tech/blog/hinglish-whatsapp-real-estate-ai-chatbot?utm_source=chatgpt.com)

---

# 24. User asks in English but uses Indian shorthand

### Query

> **“Need 3BHK RTM near expressway under 1.6C.”**

### PASS

Understand:

- 3BHK
- ready-to-move
- Expressway area
- ₹1.6 Cr ceiling

No unnecessary clarification if all meanings are sufficiently clear.

---

# 25. Extremely incomplete message

### Query

> **“1.4 cr. 3bhk. noida.”**

### PASS

Don't search blindly.

Respond:

> “Got it — 3BHK in Noida around ₹1.4 Cr. Which areas should I prioritize, or should I search across Noida? And do you need ready-to-move?”

This is a good test of **progressive discovery**.

---

# 26. “Near my office”

### Query

> **“3bhk near my office under 1.5.”**

### PASS

If the user's workplace has already been established in the conversation, use it.

If not:

> “Sure — what's the office location or sector?”

### FAIL

Guessing the office location from previous unrelated context.

---

# 27. User gives a road

### Query

> **“Anything good along Dadri Road for buying?”**

### PASS

Recognize road/location-based discovery.

Don't assume a specific sector.

Ask about:

- budget
- property type
- intended use

---

# 28. Buyer asks about “cheap”

### Query

> **“Where can I get the cheapest decent 3BHK in Noida?”**

### PASS

The chatbot should unpack “decent.”

For example:

> “I can optimize for lowest price, but ‘decent’ could mean builder quality, livability, age, location or documentation. Which matters most?”

It can also propose a reasonable default ranking if clearly stated.

### FAIL

Calling the cheapest property “decent” without defining why.

---

# 29. Buyer asks about a bad reputation

### Query

> **“I've heard there are a lot of registry problems in some Noida projects. Which ones should I avoid?”**

### PASS

This is a **high-risk claim**.

The bot should not produce an accusation list based on hearsay.

Instead:

- identify verified documentation/registry issues where data exists
- distinguish complaints from established findings
- explain what should be checked
- cite/identify evidence where supported

### FAIL

> “Avoid Project X because everyone says registry is bad.”

---

# 30. Rental user — your product boundary test

### Query

> **“I need a 2BHK on rent in Sector 137 under ₹30,000.”**

### Correct RealtyPals behavior

Because RealtyPals is **purchase-only**, don't attempt to answer the rental query.

A good response:

> “RealtyPals currently focuses on properties for purchase, not rentals. If you're looking to buy a 2BHK in Sector 137, tell me your purchase budget and I can help you find suitable options.”

### PASS

- Clearly states the product boundary.
- Does not fabricate rental listings.
- Offers a relevant purchase path.
- Does not sound like an error message.

### FAIL

- Returning rental properties.
- Pretending to know current rental availability.
- Saying “I can't help with that” and ending the conversation.
- Ignoring the rental intent entirely.

---

# And I'd add these 5 “weird human” queries

These are especially worth testing because your friend's **“15A, 93”** is exactly the type of input structured search systems tend to mishandle.

### 31.

> **“150 ya 137?”**

PASS → Understand comparison intent and ask what criterion matters.

---

### 32.

> **“1.5 mein 3 mil jayega?”**

PASS → Understand this as:

> “Can I get a 3BHK around ₹1.5 Cr?”

Then clarify location/area.

---

### 33.

> **“family ke liye 150?”**

PASS → Interpret Sector 150 + family suitability, not necessarily a search.

---

### 34.

> **“registry wala chahiye.”**

PASS → Understand that the user is emphasizing registration/documentation status, then clarify location/configuration/budget.

---

### 35.

> **“2 cr tak kuch premium, but paisa waste nahi karna.”**

PASS → Recognize:

- ≤₹2 Cr
- premium preference
- value-for-money concern

Then ask whether this is self-use or investment and what location/configuration they want.

---

# The important distinction for this final test

Don't expect RealtyPals to **always answer immediately**.

For this class of query, I would judge it on whether it chooses the correct **next action**.

There are four acceptable outcomes:

### 1. Answer

When the question is sufficiently clear.

> “Is Sector 50 good for families?”

→ Answer.

### 2. Clarify

When the user hasn't provided enough information.

> “3 bhk 150 1.5”

→ Confirm interpretation.

### 3. Search

When the intent and requirements are sufficiently complete.

> “3BHK in Sector 150 under ₹1.5 Cr, ready to move.”

→ Search.

### 4. Boundary response

When the request is outside RealtyPals.

> “Find me a 2BHK for rent.”

→ Explain that RealtyPals focuses on purchases and offer the purchase path.

That **decision itself is part of the test**.

---

## What I would consider a bad response

For this round, I would mark a response **FAIL** if RealtyPals does any of these:

- Takes a fragment and invents missing requirements.
- Turns a sector mention into a search without understanding the intent.
- Treats “15A, 93” as malformed input instead of interpreting likely sector references.
- Gives property cards when the user asked a general/advisory question.
- Asks five or ten unnecessary questions when one clarification would resolve the ambiguity.
- Gives an answer when the ambiguity materially changes the result.
- Claims a property is “best” without defining the user's objective.
- Converts colloquial words like **“good,” “decent,” “premium,” “near,” “reasonable,” “cheap”** into hidden hard filters without explanation.
- Hallucinates current availability, price, registry status or legal status.
- Answers rental queries as though RealtyPals sells rentals.
- Refuses rental queries without redirecting the user toward buying.
- Loses the user's intended language/style unnecessarily.
- Fails to remember what “that property,” “the second one,” “150,” etc. refer to within the conversation.

The broader reason I'm emphasizing this is that current real-estate chatbot workflows are expected to preserve buyer context while moving between discovery, property details, availability, viewing and documentation, and human handoff is appropriate when the system cannot reliably establish current commercial or legal facts. [BPAI](https://bpai.in/industries/real-estate?utm_source=chatgpt.com)

For **RealtyPals**, I'd therefore treat the ideal behavior as:

**“Understand what the human probably means → determine whether you're certain enough → ask only what matters → search only when ready → answer from verified information → keep the conversation moving toward a purchase.”**

That is much closer to how your friend actually used the product than another perfectly structured query like *“Find a 3BHK in Sector 150 under ₹1.5 Cr.”*
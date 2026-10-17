1. Waterlogging / monsoon risk
Query

“I don't want a flat in an area that regularly gets waterlogged during heavy monsoon. Which of these projects have the best available evidence on drainage, waterlogging history and surrounding road conditions?”

What this tests

This is a local-condition / environmental-risk query rather than a normal property filter.

Answer should contain

For each project:

Any verified information about historical waterlogging
Drainage-related information if available
Nearby road/elevation or locality information if your data supports it
Clear distinction between:
verified
reported
inferred
unknown

It should say something like:

“I don't have verified historical waterlogging data for Project X.”

rather than:

“Project X doesn't flood.”

PASS

PASS only if:

It does not invent flood history.
It does not infer “no waterlogging” merely because the project is new.
It identifies missing data.
It distinguishes project-level risk from locality-level risk.
2. Power backup / electricity reliability
Query

“I work from home and can't afford frequent power interruptions. Compare these projects on power backup, DG dependency, backup coverage for elevators and common areas, and anything else that could affect day-to-day reliability.”

Answer should contain
Power-backup availability
What is actually covered
Whether backup applies to the apartment itself
Elevator/common-area backup
Any stated backup capacity or limitations
Unknown fields
PASS

The chatbot must not interpret “power backup available” as “your entire apartment has unlimited backup.”

It should distinguish:

Apartment backup
Common-area backup
Lift backup
Partial / full coverage
Unknown
3. Water supply and source
Query

“For these projects, tell me what is known about their water supply. I care about municipal supply versus groundwater, treatment systems, storage and whether residents have reported water-related problems.”

Answer should contain
Water source, if documented
Treatment/STP systems if documented
Storage/tank information if available
Any verified resident-reported issue data
Clear unknowns
PASS

No assumptions such as:

“Noida projects generally have reliable water.”

The answer must stay project-specific where possible.

4. Redevelopment / major future disruption
Query

“I'm buying for the long term. Are there any known redevelopment, major infrastructure, demolition, land-use or large construction issues around these projects that I should investigate before buying?”

What this tests

This is a long-horizon ownership risk query.

Answer should contain

Separate sections for:

Confirmed/current
Announced/planned
Proposed/unverified
Unknown
PASS

The chatbot must never convert a proposal into an event that will definitely happen.

For example:

Bad:

“A major road will definitely come here.”

Good:

“I found a proposed infrastructure plan, but I cannot establish whether it has reached the execution stage.”

5. Leasehold / land-tenure structure
Query

“Before I buy a resale flat in Noida, I want to understand whether the project sits on leasehold or freehold land, who the underlying authority is, what that means for transfer, and what documents I should verify.”

Answer should contain
General explanation of leasehold/freehold
Authority/land-tenure information only if verified for the project
Transfer implications
Documents to verify
Clear distinction between general guidance and project-specific facts
PASS

The chatbot should not guess the tenure structure from the location alone.

It should never say:

“Because it's in Noida, this property is definitely leasehold.”

unless the actual property/project data establishes it.

6. Resale transaction chain
Query

“The owner says they bought this flat from someone else five years ago and now want to sell it to me. What documents should I trace through the ownership chain before I pay a token?”

What this tests

A resale transaction / chain-of-title reasoning scenario.

Answer should contain

A practical sequence covering things such as:

Current ownership document
Previous transfer documentation where applicable
Registration records
Authority/society records where relevant
Outstanding dues
Encumbrance-related verification
Whether the seller actually has authority to sell
PASS

The chatbot should remain general and verification-oriented.

It should not conclude:

“The property is legally clear.”

merely because the user has provided a seller statement.

For legal certainty, it should direct the user toward appropriate professional/document verification.

7. Society financial health
Query

“Two societies look equally good physically. I want to know which one is better managed financially. What should I ask for to assess maintenance arrears, major pending repairs, reserve funds, and unusually high future expenses?”

What this tests

This is society-management intelligence, which is different from property price.

Answer should contain

Useful checks such as:

Maintenance arrears
Pending major repairs
Capital expenditure
Reserve/sinking fund information where applicable
Special assessments
Major contracts/services
Pending disputes affecting society finances
Audit/accounts records where available
PASS

The answer should not claim a society is financially healthy unless the relevant evidence exists.

8. Heat / orientation / summer comfort
Query

“I care more about summer heat than having a pretty view. Which parts of the apartment configuration should I compare before choosing a flat, and can you identify any of those differences from the available property data?”

What this tests

This is an engineering-style property suitability question.

Answer should contain

Where available:

Orientation
Exposure
Window/opening information
Balcony direction
Floor
External shading
Adjacent building proximity

And distinguish:

Known
Potentially relevant
Not available
PASS

It should not make a definitive claim about thermal comfort from orientation alone.

For example:

Bad:

“East-facing apartments are always cooler.”

Good:

“Orientation can affect solar exposure, but I don't have enough building-envelope data to establish actual summer comfort for this unit.”

9. Rental demand by tenant type
Query

“I may rent this apartment out in two years. Don't just tell me the expected rent. Tell me what kind of tenant demand each area appears suited for, what factors support that, and what information you don't have.”

What this tests

This goes beyond basic rental-yield calculation.

Answer should contain

Potential tenant segments such as:

Families
Working professionals
Students, where relevant
Corporate tenants, where relevant

Plus:

Rent evidence if available
Nearby employment nodes
Connectivity
Unit configuration
Furnishing relevance
Vacancy/data limitations
PASS

It should not manufacture tenant demographics.

It should distinguish:

“This is supported by rental/listing evidence”

from:

“This is a reasonable hypothesis.”

10. Final niche test: “What am I not thinking about?”
Query

“I'm already comparing price, carpet area, builder reputation, location and possession. What are five less-obvious things that could materially affect my experience as an owner, and which of those can RealtyPals actually evaluate for these properties?”

Why I like this one

This tests whether RealtyPals can act as an intelligent property consultant rather than only a search engine.

Answer should contain

It might identify areas such as:

water reliability
power backup
maintenance burden
society financial/management issues
noise
construction around the property
legal/documentation gaps
actual usability of the floor plan
parking/storage
resale/rental liquidity

But the important part is that it must then say:

Evaluable from our data
Partially evaluable
Not currently verifiable
PASS

The chatbot should not produce a generic “top 5 things” lecture and stop.

It should connect those considerations back to the actual properties under discussion.

Final scoring rule for these 10

I'd use a very simple gate:

🟢 PASS

The answer:

answers the actual niche question
uses property-specific evidence where available
separates fact from inference
exposes unknowns
doesn't silently assume missing data
doesn't turn plans into certainties
doesn't give false legal/financial certainty
tells the user what they should verify next
🔴 FAIL

Any of these happen:

“No waterlogging” when you have no waterlogging data.

“Excellent power reliability” when only a generic backup field exists.

“Freehold property” inferred from location.

“No legal issues” without actual legal verification.

“This area will appreciate because X infrastructure is coming.”

“This society is financially healthy” without financial records.

“Best rental demand” without supporting evidence.

One extra thing I'd watch very closely

For these 10, don't judge only the prose response.

Look at the underlying behavior:

User Query
   ↓
Intent
   ↓
Entity extraction
   ↓
Requirement / question type
   ↓
Required data fields
   ↓
Available vs unavailable data
   ↓
Evidence retrieval
   ↓
Confidence / provenance
   ↓
Answer

For example, Query #1 should produce something conceptually like:

intent: PROPERTY_RISK_REVIEW

riskType:
  - waterlogging
  - drainage

entities:
  - Project A
  - Project B

requiredEvidence:
  - locality_waterlogging_history
  - drainage_information
  - surrounding_road_condition

unknownAllowed: true
speculationAllowed: false

That is the real test.

Because your implementation log says the system now has the foundation for structured requirement state and query planning, this last round should be about seeing whether that architecture produces trustworthy answers outside ordinary search/filter cases.

For these ten specifically, I would be comfortable moving forward only after you see no hallucinated facts and no false certainty.
# RealtyAsk PRD

## Product Requirements Document (PRD)

**Project:** AI-First Real Estate Platform for India  
**Status:** Draft for partner discussion  
**Version:** 0.3  
**Last Updated:** May 2026

---

# TL;DR

We are building an AI-powered real estate advisor for home buyers in India, starting with Noida. Users describe needs in natural language and receive 3–5 property recommendations with reasons, calculators, comparisons, and lead handoff.

---

# 1. What This Product Is

RealtyAsk is an AI-first property advisor focused on helping buyers discover and evaluate new-construction and ready-to-move homes in Noida.

Key principles:
- Conversation-first
- Honest trade-offs
- Deep property data
- Decision support, not listings

---

# 2. What We Are and What We Are Not

## We Are
- Buying advisor
- Conversation-first experience
- Honest about trade-offs
- Deep property intelligence

## We Are Not
- Listings portal
- Broker marketplace
- Generic chatbot on top of listings

---

# 3. Goals

## Business Goals
- 50+ serious leads in first 3 months
- 200+ leads/month by month 6
- ₹10 crore+ deal value in 6 months
- 20–30% serious lead conversion

## User Goals
- Find properties faster
- Ask questions naturally
- See all important information in one place
- Get trustworthy advice

## Non Goals
- Largest listing portal
- Broker tooling
- Rentals
- Resale
- Commercial property

---

# 4. Decisions Already Locked For V1

| Area | Decision |
|--------|----------|
| City | Noida |
| Property Type | New construction |
| Sales Model | Purchase only |
| Platform | Website |
| AI | Existing RealtyAsk AI |
| Data Source | Partner inventory |

---

# 5. Decisions To Finalize

## Product Name
Options:
- RealtyAsk
- New Brand
- Partner-aligned Brand

## Signup Strategy
Recommended:
- Free browsing
- Signup only on high-intent actions

Triggers:
- Save property
- Callback request
- Builder contact
- Site visit
- Buyer report

## Human Handoff
Recommended:
- WhatsApp handoff

## Out-of-Coverage Cities
Recommended:
- Honest message
- General advice
- Waitlist capture

## India-Specific Features
Recommended V1:
1. Metro proximity
2. Builder trust score
3. Hindi/Hinglish input

---

# 6. User Personas

## First-Time Buyer
Budget: ~₹1.5 Cr

## Family Upgrade Buyer
Budget: ~₹2.5 Cr

## NRI Investor
Budget: ₹2–4 Cr

---

# 7. User Stories

## First-Time Buyer
- Understand options
- Learn trade-offs
- Calculate EMI

## Family Buyer
- Compare schools
- Compare builders
- Compare shortlisted properties

## NRI Buyer
- Remote trust verification
- Callback support
- RERA validation

---

# 8. User Journey

1. User describes needs
2. AI asks clarifying questions
3. AI returns 3–5 matches
4. User explores property details
5. User compares properties
6. User requests callback
7. Lead handed to sales

---

# 9. Product Flow

1. Open website
2. Chat with AI
3. Receive recommendations
4. Open property page
5. Compare options
6. Save / callback
7. Signup
8. Lead handoff

---

# 10. Features

## A. Search & Discovery (Critical)

### V1
- AI search
- Filters
- Sorting

### Future
- Voice search
- Hindi support
- Image search
- Saved searches

---

## B. Property Detail Page (Critical)

### V1
- Photos
- Videos
- Floor plans
- Prices
- Possession date
- Builder info
- Facilities
- Nearby schools/hospitals
- RERA details

### Future
- Virtual tours
- AR
- Reviews

---

## C. Decision Tools (High)

### V1
- EMI calculator
- Stamp duty calculator
- GST calculator
- Comparison tool

### Future
- Investment analysis
- Tax savings
- Timeline planner

---

## D. Area Information (High)

### V1
- Metro distance
- Schools
- Hospitals
- Area insights
- Price trends

### Future
- AQI
- Water quality
- Traffic data
- Future infrastructure

---

## E. Builder Trust (High)

### V1
- RERA information
- Builder history
- Delivered projects

### Future
- Complaint history
- Financial health
- Reputation score

---

## F. User Accounts (High)

### V1
- OTP login
- Google login
- Shortlists
- History
- Resume conversations

---

## G. Lead Handoff (Critical)

### V1
- Callback request
- Site visit scheduling
- WhatsApp handoff

---

## H. India-Specific Features

### V1
- Metro proximity
- Builder trust
- Hindi/Hinglish input

---

## I. Out-of-Coverage Cities

### V1
- Waitlist
- General city guidance
- Honest messaging

---

# 11. AI Behavior Rules

1. Be honest
2. Show RERA information
3. Never invent data
4. No fake confidence scores
5. Remember context
6. Explain trade-offs
7. Handoff when needed
8. English/Hinglish support

---

# 12. Information To Store

## Project
- Name
- Address
- Builder
- RERA
- Status
- Possession date

## Unit Types
- Carpet area
- Super area
- Price range
- Inventory

## Floor Plans
- Area
- Price
- Direction
- Floor plan image

## Locality
- Pincode
- Metro distance
- Schools
- Hospitals

## Builder
- Company
- Past projects
- Active projects

## User
- Name
- Contact details
- Preferences
- Shortlist
- Chat history

---

# 13. Not In V1

- Rentals
- Resale
- Commercial property
- Native mobile apps
- Loan approvals
- Property valuation
- Tenant tools
- VR tours
- Multi-city rollout

---

# 14. Success Metrics

## User
- 20–30% serious lead conversion
- Helpful recommendations

## Business
- 50+ leads in first 3 months
- ₹10 Cr+ transaction value

## Technical
- <3 second AI response
- 99% uptime

---

# 15. Timeline

| Week | Deliverable |
|------|-------------|
| 1 | Data collection |
| 2–3 | Data ingestion |
| 4–5 | AI integration |
| 6 | Calculators |
| 7 | Accounts |
| 8 | Testing |
| 9–10 | Soft launch |
| 11–12 | Public launch |

---

# 16. Prerequisites

- Real property dataset
- Locked business decisions
- Launch quality criteria
- AI safety checks
- Product owner authority

---

# 17. Technical Foundation

- AI: OpenAI (Main Chat) + Groq (Fallback) + Cohere
- Database: PostgreSQL
- Maps: Google Maps
- Hosting: Render
- Existing RealtyAsk codebase reuse

---

# 18. Glossary

- BHK
- RERA
- EMI
- Stamp Duty
- GST
- Carpet Area
- Super Built-Up Area
- Possession Date
- AQI
- NRI
- POA
- FEMA
- OTP
- MAU

---

# 19. Decision Log

| Date | Section | Decision | Reason | Owner |
|--------|----------|----------|----------|----------|
| TBD | TBD | TBD | TBD | TBD |


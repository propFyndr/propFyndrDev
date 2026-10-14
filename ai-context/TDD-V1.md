RealtyAsk TDD
Technical Design Document (TDD)

Version: 1.0

Status: Active Development

Product: RealtyAsk

Document Owner: Engineering

Related Documents:

Product Blueprint (PRD)
Intelligence Specification (ISD)
Knowledge & Data Specification (KDS)
Executive Summary

RealtyAsk is an AI-powered decision intelligence platform designed to assist homebuyers in discovering, evaluating, and selecting residential properties.

Unlike traditional real estate platforms where artificial intelligence acts as the primary decision-maker, RealtyAsk separates business logic from language generation.

Structured knowledge, deterministic algorithms, and domain-specific services form the foundation of the platform. Artificial intelligence acts as the conversational interface responsible for understanding users, explaining recommendations, and supporting decision-making.

This architecture prioritizes:

Reliability
Explainability
Maintainability
Scalability
Trust

The purpose of this document is to define the technical architecture, engineering principles, service boundaries, deployment model, and implementation strategy for the RealtyAsk platform.

1. Engineering Philosophy

Every architectural decision within RealtyAsk follows one central belief:

Business knowledge should outlive artificial intelligence.

Language models will continue to evolve.

Frameworks will change.

Hosting providers will change.

Programming languages may eventually change.

The knowledge platform, recommendation logic, and engineering principles should remain stable regardless of these technological changes.

For this reason, RealtyAsk is designed as a Domain-Driven Decision Intelligence Platform, where AI is treated as a capability rather than the core architecture.

2. Architectural Vision

RealtyAsk is fundamentally composed of four independent systems.

                RealtyAsk Platform

                        │

        ┌───────────────┼────────────────┐

        │               │                │

Knowledge Platform   Decision Platform   Conversation Platform

        │               │                │

        └───────────────┼────────────────┘

                        │

              Presentation Layer

Each system has a clearly defined responsibility.

Knowledge Platform

Responsible for storing and managing verified information.

Examples include:

Properties
Builders
Localities
Amenities
Pricing
Infrastructure
RERA Information
User Data

The Knowledge Platform is the operational source of truth for the application.

Decision Platform

Responsible for deterministic business logic.

Examples include:

Property Search
Filtering
Ranking
Recommendation
Comparison
Financial Calculations
Lead Qualification

This platform makes decisions.

It does not generate natural language.

Conversation Platform

Responsible for natural language interactions.

Examples include:

Intent Detection
Clarification
Conversation Memory
Explanation Generation
Recommendation Narration
Educational Responses

The Conversation Platform never owns business logic.

It communicates decisions generated elsewhere.

Presentation Layer

Responsible only for user interaction.

Examples include:

Web Application
Mobile Application (Future)
Partner Portal (Future)
White-label Solutions (Future)

The Presentation Layer never accesses the database directly.

3. Core Engineering Principles

These principles are mandatory across the entire codebase.

Principle 1 — Domain Before AI

Business domains own functionality.

Artificial Intelligence orchestrates domain capabilities.

It never replaces them.

Principle 2 — Database Before AI

Every factual response presented to users originates from the RealtyAsk Knowledge Platform.

Large Language Models are never considered authoritative sources of factual information.

Principle 3 — Deterministic Before Generative

Business logic should remain deterministic.

Examples include:

Search
Ranking
Calculations
Filtering
Validation

Artificial Intelligence is responsible for communication rather than decision making.

Principle 4 — Single Source of Truth

The PostgreSQL database represents the operational source of truth.

External sources such as:

RERA
Builder Websites
Government Records

are used only during ingestion and verification.

Once verified, all application services consume information exclusively from the internal database.

Principle 5 — Modular Architecture

Every domain evolves independently.

Changes within one module should not require modifications throughout the platform.

This reduces coupling and improves maintainability.

Principle 6 — Explainability

Every recommendation should be explainable.

Every ranking should be reproducible.

Every generated insight should be traceable.

No system should behave as an opaque black box.

Principle 7 — Graceful Degradation

Failure of Artificial Intelligence services should never make the application unusable.

If AI becomes unavailable:

Property Search continues.
Property Pages remain accessible.
Builder Profiles remain available.
Financial Calculators continue functioning.
Comparisons remain operational.

Only conversational capabilities should degrade.

Principle 8 — API-First

Every domain capability should be exposed through internal APIs.

Future platforms—including mobile applications, partner dashboards, and white-label deployments—should reuse the same backend services.

Principle 9 — Knowledge as an Asset

The most valuable asset within RealtyAsk is not the AI model.

It is the continuously evolving structured knowledge platform.

Every engineering decision should strengthen, enrich, or protect that knowledge.

4. System Architecture

RealtyAsk adopts a layered Domain-Driven Modular Monolith architecture.

                    User

                      │

              Next.js Frontend

                      │

──────────────────────────────────────────

              Express API Layer

──────────────────────────────────────────

      Domain Services (Business Logic)

──────────────────────────────────────────

     Intelligence & AI Orchestration

──────────────────────────────────────────

       PostgreSQL + Redis + Storage

──────────────────────────────────────────

        External Data Sources

Each layer communicates only with its immediate neighboring layers.

Cross-layer shortcuts are prohibited.

5. Architectural Layers
Layer 1 — Presentation

Technology:

Next.js
React
TypeScript
TailwindCSS

Responsibilities:

Rendering UI
Collecting user input
Session management
Displaying recommendations

Forbidden Responsibilities:

Database queries
Business logic
Ranking
Calculations
Layer 2 — API

Technology:

Express.js

Responsibilities:

Authentication
Validation
Routing
Request orchestration
Error handling

The API layer should remain intentionally thin.

Business logic belongs elsewhere.

Layer 3 — Domain Layer

This represents the heart of RealtyAsk.

Every business capability exists as an independent domain.

Examples include:

Property
Builder
Search
Recommendation
User
Lead
Comparison
Calculator

Each domain owns:

Services
Business rules
Validation
Repositories
Layer 4 — Intelligence Layer

The Intelligence Layer supports business domains through artificial intelligence.

Responsibilities include:

Intent Extraction
Clarification
Recommendation Explanation
Conversation Summaries
Builder Summaries
Investment Summaries

The Intelligence Layer never directly queries the database.

It operates through domain services.

Layer 5 — Persistence Layer

Responsibilities:

PostgreSQL
Prisma
Redis
Supabase Storage

Only repositories communicate directly with persistence.

6. Domain-Driven Architecture

The backend is organized around business domains rather than technologies.

backend/

modules/

├── property/
├── builder/
├── locality/
├── search/
├── recommendation/
├── intelligence/
├── comparison/
├── calculator/
├── lead/
├── user/
├── auth/
├── chat/
├── ai/
├── analytics/
└── admin/

shared/

├── database/
├── cache/
├── middleware/
├── config/
├── logger/
├── errors/
├── types/
└── utils/

infrastructure/

├── openai/
├── redis/
├── supabase/
├── storage/
└── monitoring/

Each module is responsible for its own business capability and should expose well-defined interfaces to other modules.

No module should directly manipulate another module's internal implementation.

7. Technology Stack
Frontend
Next.js (App Router)
React
TypeScript
TailwindCSS
Shadcn UI
Framer Motion
Backend
Express.js
TypeScript
Prisma ORM
Database
PostgreSQL
Prisma
Redis
AI

Primary

OpenAI

Fallback

Groq
Anthropic
Cohere
Storage
Supabase Storage
Deployment

Frontend

Vercel

Backend

Render

Database

Supabase PostgreSQL

Caching

Redis

Monitoring

Sentry
PostHog
8. Non-Goals

To preserve architectural clarity, the following are explicitly outside the scope of the V1 system architecture:

Microservices.
Event-driven distributed systems.
Real-time collaborative editing.
Native mobile clients.
Multi-tenant white-label deployments.
Direct integration with external builder CRMs.
Autonomous AI decision-making.
AI-generated factual property data.

These capabilities may be introduced in future versions but should not influence V1 architectural complexity.



Part II — System Context & Request Lifecycle
9. System Context

The RealtyAsk platform consists of multiple independent systems working together to transform a buyer's natural language requirements into explainable property recommendations.

The platform separates user interaction from business logic, deterministic reasoning, artificial intelligence, and persistence.

This separation enables each subsystem to evolve independently while maintaining a consistent user experience.

High-Level System Context
                       USER

                         │

                 Web Application

                         │

                 Express API Layer

                         │

──────────────────────────────────────────

          Domain Orchestration Layer

──────────────────────────────────────────

 Search │ Recommendation │ User │ Lead │ Builder

──────────────────────────────────────────

        Knowledge Platform

(PostgreSQL + Redis + Supabase Storage)

──────────────────────────────────────────

     AI Services & External Providers

(OpenAI · Groq · Anthropic · Cohere)

──────────────────────────────────────────

 External Knowledge Sources

(RERA · Builder Sites · Maps · Govt Data)

Notice

External systems never directly serve users.

Everything passes through RealtyAsk.

10. Request Lifecycle

Every request follows the same architectural philosophy.

Request

↓

Validation

↓

Authentication (if required)

↓

Routing

↓

Domain Service

↓

Knowledge Platform

↓

Decision Logic

↓

AI (optional)

↓

Response

↓

Logging

This lifecycle applies consistently throughout the application.

11. Request Classification

Not every request requires AI.

Before processing, every request is classified into one of four categories.

Category 1 — Static Request

Examples

Property Page
Builder Profile
Amenities
Floor Plans

Processing

User

↓

API

↓

Property Module

↓

Database

↓

Response

No AI involved.

Category 2 — Computational Request

Examples

EMI
GST
Stamp Duty
Registration

Processing

User

↓

Calculator Module

↓

Formula

↓

Response

Again

No AI.

Category 3 — Search Request

Examples

Show me

3 BHK

under ₹2 Cr

Processing

User

↓

Search Module

↓

Discovery Engine

↓

Database

↓

Ranking

↓

Response

Still

No AI.

Category 4 — Advisory Request

Examples

Which property is better?

Should I invest?

Explain this recommendation.

Processing

User

↓

Conversation Engine

↓

Decision Engine

↓

Knowledge Platform

↓

LLM

↓

Response

AI participates only here.

12. Conversation Lifecycle

Conversation represents the primary interface of RealtyAsk.

Every conversation progresses through structured stages.

Start Chat

↓

Intent Detection

↓

Context Loading

↓

Missing Information

↓

Clarification

↓

Intent Confidence

↓

Discovery

↓

Recommendation

↓

Decision Support

↓

Lead Qualification

↓

Conversation Summary

↓

Persistence

Notice

Recommendations are not generated immediately.

Understanding comes first.

13. Property Discovery Lifecycle

Discovery is entirely deterministic.

Conversation

↓

Structured Preferences

↓

Hard Filters

↓

Eligible Properties

↓

Nearby Expansion (if required)

↓

Ranking

↓

Candidate List

↓

Decision Intelligence

↓

Recommendations

Important

No LLM performs filtering.

Hard Constraints

Examples

City
Budget
Configuration
Ready to Move
Builder Exclusions

Violation of hard constraints excludes the property.

Soft Constraints

Examples

Metro
Amenities
Schools
Lifestyle
Investment

These influence ranking only.

14. Recommendation Lifecycle

After Discovery identifies eligible properties, the Recommendation Engine transforms them into personalized advice.

Eligible Projects

↓

Ranking

↓

Property Intelligence

↓

Builder Intelligence

↓

Investment Intelligence

↓

Trade-off Analysis

↓

Decision Summary

↓

LLM Explanation

↓

User

Notice

The LLM never decides

which property ranks first.

15. Property Page Lifecycle
User

↓

Property API

↓

Property Module

↓

Database

↓

Builder Module

↓

Area Module

↓

Investment Module

↓

Response

Only if the user asks

Explain this property

does the AI become involved.

16. Comparison Lifecycle

Comparison combines deterministic analysis with conversational explanation.

Selected Properties

↓

Comparison Module

↓

Property Data

↓

Builder Data

↓

Investment Data

↓

Comparison Matrix

↓

Decision Summary

↓

LLM Explanation

↓

User

Again

Comparison exists before AI.

17. Authentication Lifecycle
User

↓

OTP / Google

↓

Better Auth

↓

JWT Session

↓

User Module

↓

Response

Guest sessions should transition seamlessly into authenticated sessions without losing conversation history or recommendations.

18. Site Visit Lifecycle
Site Visit Request

↓

Authentication Check

↓

Lead Module

↓

Availability

↓

Builder/Broker Assignment

↓

CRM Queue

↓

Confirmation

The AI is not involved.

19. Lead Lifecycle
Conversation

↓

High Intent Signals

↓

Lead Qualification

↓

User Consent

↓

Lead Record

↓

Broker Assignment

↓

Site Visit

↓

Status Tracking

Lead creation is event-driven rather than time-driven.

20. Intelligence Request Lifecycle

Some requests require generated intelligence.

Examples

Builder Summary
Investment Outlook
Recommendation Summary

Processing

Knowledge Platform

↓

Decision Engine

↓

AI Generation

↓

Validation

↓

Cache

↓

Response

Generated intelligence should be cached whenever possible.

21. Error Lifecycle

Every request follows a consistent error handling pipeline.

Failure

↓

Detection

↓

Classification

↓

Recovery

↓

Logging

↓

Monitoring

↓

User Response
Error Categories
User Errors

Examples

Invalid input
Missing information

Return meaningful guidance.

Business Errors

Examples

No matching properties.

Return nearby alternatives.

Infrastructure Errors

Examples

Database unavailable.

Retry if appropriate.

Otherwise return graceful failure.

AI Errors

Examples

OpenAI timeout.

Fallback:

Cached intelligence.
Secondary model.
Deterministic response.

Never expose internal failures to users.

22. Caching Lifecycle

Caching exists to reduce latency and operational cost.

Request

↓

Cache Lookup

↓

Cache Hit

↓

Response

OR

↓

Cache Miss

↓

Generate

↓

Store

↓

Respond

Cache candidates include:

Recommendation summaries.
Builder summaries.
Investment summaries.
Conversation summaries.
Popular property pages.
23. Logging Lifecycle

Every significant action should generate structured logs.

Examples include:

Conversation started.
Clarification completed.
Recommendation generated.
Property viewed.
Comparison initiated.
Calculator used.
Lead created.
Site visit requested.
Authentication events.
AI fallback triggered.

Logs support debugging, analytics, auditing, and future product improvements.

24. End-to-End User Journey

The complete request flow from first interaction to recommendation can be summarized as follows:

User

↓

Conversation

↓

Intent Extraction

↓

Clarification

↓

Discovery

↓

Ranking

↓

Knowledge Retrieval

↓

Decision Intelligence

↓

AI Explanation

↓

Recommendation

↓

Comparison

↓

Decision Support

↓

Lead Qualification

↓

Site Visit

↓

Broker

This pipeline represents the canonical flow of the RealtyAsk platform.

All future features should integrate into this lifecycle rather than bypass it.


Part III — Domain Architecture
25. Domain-Driven Design

RealtyAsk is organized around business domains rather than technical layers.

Every domain owns a specific business capability and is responsible for the complete lifecycle of that capability.

A domain is responsible for:

Business Rules
Validation
Services
Repositories
API Contracts
Domain Events
Internal Models

A domain should never depend on another domain's internal implementation.

Communication occurs only through well-defined public interfaces.

26. Domain Map

The backend consists of independent business domains.

                     RealtyAsk Backend

                           │

        ┌──────────────────┼──────────────────┐

        │                  │                  │

   Customer Domain     Property Domain     Intelligence Domain

        │                  │                  │

   User & Auth      Search & Builder      AI & Knowledge

        │                  │                  │

        └──────────────────┼──────────────────┘

                           │

                    Lead Management

Every request is ultimately handled by one primary domain.

27. Core Domains

The platform is divided into thirteen primary domains.

Property Domain
Purpose

Owns everything related to residential projects.

Responsibilities
Projects
Towers
Configurations
Floor Plans
Pricing
Amenities
Inventory
Property Images
Property Status
Public APIs

Examples

getProject()

searchProjects()

getConfigurations()

getAmenities()

getPricing()
Does NOT Own
Builder Reputation
Recommendation Logic
AI
Search Ranking
Builder Domain
Purpose

Owns all builder-related information.

Responsibilities
Builder Profile
Builder History
Completed Projects
Active Projects
RERA Records
Reputation
Delivery Performance
Public APIs
getBuilder()

getBuilderProjects()

getBuilderHistory()
Does NOT Own

Property Search

Recommendations

Locality Domain

Purpose

Represents geographical intelligence.

Responsibilities

Sectors
Cities
Metro
Schools
Hospitals
Infrastructure
Connectivity

Public APIs

getLocality()

getNearbySchools()

getMetroInfo()

getInfrastructure()

Does NOT Own

Projects

Builders

Search Domain

Purpose

Transforms structured user preferences into eligible projects.

Responsibilities

Hard Filters
Soft Filters
Nearby Expansion
Eligibility
Candidate Generation

Public APIs

search()

expandNearby()

applyFilters()

Search does NOT

Rank.

Recommend.

Explain.

It only discovers.

Recommendation Domain

Purpose

Ranks candidate properties.

Responsibilities

Personalization
Ranking
Match Scoring
Recommendation Ordering

Inputs

Search Results

Outputs

Ordered Candidate List

Recommendation does NOT

Generate explanations.

Perform searches.

Access AI.

Comparison Domain

Purpose

Compares shortlisted properties.

Responsibilities

Comparison Matrix
Feature Comparison
Difference Detection
Decision Comparison

Outputs

Structured Comparison.

Not natural language.

Calculator Domain

Purpose

Financial computations.

Responsibilities

EMI
GST
Stamp Duty
Registration

Important

Never depends on AI.

User Domain

Purpose

Owns buyer information.

Responsibilities

Profile
Preferences
Saved Projects
History
Conversation References
Authentication Domain

Purpose

Identity management.

Responsibilities

OTP
Google Login
Sessions
Tokens
Authorization

Never owns

User preferences.

Lead Domain

Purpose

Sales pipeline.

Responsibilities

Callback Requests
Site Visits
Lead Status
Broker Assignment
Conversation Domain

Purpose

Natural language interaction.

Responsibilities

Session
Context
Clarification
Conversation Memory
Intent Collection

Conversation never

Searches.

Ranks.

Calculates.

AI Domain

Purpose

Access to language models.

Responsibilities

Prompt Construction
Model Routing
LLM Calls
Streaming
Response Parsing

The AI Domain does NOT know anything about properties.

It only knows language.

Knowledge Domain

Purpose

Central gateway into the RealtyAsk Knowledge Platform.

Responsibilities

Property Intelligence
Builder Intelligence
Area Intelligence
Investment Intelligence

Everything that enters AI comes through this domain.

28. Domain Relationships

Not every domain can directly communicate with every other domain.

Allowed communication should follow defined boundaries.

Conversation

↓

Search

↓

Recommendation

↓

Knowledge

↓

AI

↓

Response

Example

Search

↓

Recommendation

Allowed.

Recommendation

↓

Search

Allowed.

AI

↓

Database

Not allowed.

Frontend

↓

Database

Never allowed.

Property

↓

Recommendation

Not allowed.

Recommendation requests information.

Property never recommends itself.

29. Module Structure

Every domain follows the same internal organization.

Example

property/

├── controller/

├── service/

├── repository/

├── validator/

├── dto/

├── types/

├── mapper/

├── cache/

├── tests/

└── index.ts

Consistency across domains is mandatory.

30. Responsibilities by Layer

Every module contains four internal layers.

Controller

Responsible for

HTTP
Validation
Authentication
DTO conversion

No business logic.

Service

Responsible for

Business Rules.

Every important decision belongs here.

Repository

Responsible only for

Database access.

No calculations.

No AI.

DTO

Responsible for

Communication between layers.

Never expose database entities directly.

31. Inter-Domain Communication

Domains communicate through services.

Never through repositories.

Example

Correct

RecommendationService

↓

BuilderService

↓

BuilderRepository

Incorrect

RecommendationRepository

↓

BuilderRepository

Repositories never communicate with each other.

32. Dependency Rules

Allowed

Controller

↓

Service

↓

Repository

Forbidden

Repository

↓

Service

Allowed

Conversation

↓

Recommendation

Forbidden

Recommendation

↓

Conversation

Conversation consumes recommendations.

Recommendations should never know conversations exist.

33. Shared Layer

Some functionality belongs outside domains.

The shared layer contains reusable infrastructure.

Examples

shared/

database/

cache/

logger/

config/

middleware/

errors/

utils/

constants/

types/

No business logic belongs here.

34. Infrastructure Layer

Infrastructure connects RealtyAsk to external services.

Examples

OpenAI

Redis

Supabase

Storage

Maps

Email

Monitoring

Infrastructure knows how to communicate externally.

Domains should never directly communicate with vendors.

35. Domain Events

Future versions should allow domains to publish events.

Examples

Project Updated

↓

Recommendation Cache Invalidated

↓

Builder Summary Updated

↓

Search Index Refreshed

Although V1 is a modular monolith, event-driven patterns should be considered internally where they simplify decoupling.

36. Why This Architecture?

This architecture intentionally separates concerns.

For example, answering the question:

"Which 3 BHK should I buy?"

is not the responsibility of a single service.

Instead, the workflow becomes:

Conversation

↓

Search

↓

Recommendation

↓

Knowledge

↓

AI

↓

User

Each domain contributes one piece of the final answer.

No domain attempts to solve the entire problem independently.

This design promotes clarity, maintainability, testability, and long-term scalability.

37. Domain Ownership Matrix
Domain	Owns	Never Owns
Property	Projects, Pricing, Configurations	Recommendations, AI
Builder	Builder Data, Reputation	Search
Locality	Area Intelligence	Projects
Search	Discovery	Ranking
Recommendation	Ranking	Search, AI
Comparison	Structured Comparison	Natural Language
Calculator	Financial Calculations	AI
User	Buyer Data	Authentication
Authentication	Identity & Sessions	User Preferences
Conversation	Context & Clarification	Business Logic
AI	Language Models	Property Knowledge
Knowledge	Intelligence Retrieval	Raw Property CRUD
Lead	CRM & Site Visits	Recommendations


Part IV — Decision Engine & AI Architecture
38. The Decision Engine
Purpose

The Decision Engine is the core orchestration layer of RealtyAsk.

Its responsibility is not merely to rank properties, but to assist buyers in making informed and explainable purchasing decisions.

Unlike traditional recommendation systems, the Decision Engine combines structured knowledge, deterministic reasoning, and conversational intelligence to produce personalized decision support.

It is the central business capability of the platform.

39. Architectural Philosophy

The Decision Engine follows one principle above all others:

Every recommendation must be explainable, reproducible, and grounded in verified knowledge.

The engine never invents information.

It reasons only over structured data supplied by domain modules.

40. Decision Pipeline

Every advisory request follows the same decision pipeline.

Conversation
        │
        ▼
Intent Extraction
        │
        ▼
Preference Resolution
        │
        ▼
Discovery Engine
        │
        ▼
Decision Engine
        │
 ┌──────┼────────┬────────┐
 ▼      ▼        ▼        ▼
Property Builder Investment Locality
Knowledge Knowledge Knowledge Knowledge
        │
        ▼
Trade-off Analysis
        │
        ▼
Decision Summary
        │
        ▼
Conversation Engine
        │
        ▼
LLM Response

The Decision Engine owns orchestration.

It does not own the individual knowledge domains.

41. Responsibilities

The Decision Engine is responsible for:

Candidate evaluation.
Personalized ranking.
Trade-off analysis.
Match scoring.
Alternative generation.
Decision summaries.
Recommendation ordering.

The Decision Engine is not responsible for:

Searching the database.
Managing conversations.
Calling PostgreSQL directly.
Executing AI prompts.
Managing user sessions.
42. Internal Components

Internally, the Decision Engine is composed of several specialized services.

Decision Engine

├── Ranking Service
├── Match Service
├── Trade-off Service
├── Alternative Service
├── Summary Service
├── Confidence Service
└── Cache Service

Each service owns a single responsibility.

43. Decision Lifecycle

Every recommendation request follows a deterministic lifecycle.

Candidate Properties
        │
        ▼
Eligibility Check
        │
        ▼
Ranking
        │
        ▼
Context Personalization
        │
        ▼
Trade-off Generation
        │
        ▼
Alternative Selection
        │
        ▼
Decision Summary
        │
        ▼
Conversation Engine

Every stage produces structured output.

Natural language is generated only after the decision has been completed.

44. Candidate Evaluation

The Decision Engine evaluates every eligible project independently.

Each candidate receives structured analysis.

Example attributes include:

Budget Compatibility
Configuration Match
Builder Quality
Locality Match
Metro Accessibility
Lifestyle Alignment
Investment Potential
Family Suitability

These evaluations remain internal and are not directly exposed to users.

45. Ranking Strategy

Ranking is deterministic.

The Decision Engine never asks an LLM which property should rank first.

Ranking occurs in two stages.

Stage One — General Ranking

When little user information is available, properties are ranked using objective criteria.

Examples include:

Overall project quality.
Builder reliability.
Configuration relevance.
Market positioning.

This produces a neutral baseline ranking.

Stage Two — Personalized Ranking

As more buyer context becomes available, rankings are recalculated.

Personalization may consider:

Budget flexibility.
Commute preferences.
Family requirements.
Investment goals.
Builder preferences.
Amenity priorities.

This second stage gradually replaces the generic ranking with buyer-specific ordering.

46. Match Analysis

Every recommended property receives structured match analysis.

Examples include:

Budget Match:
High

Configuration Match:
Perfect

Location Match:
Strong

Investment Match:
Medium

Family Match:
Excellent

Overall Match:
Very High

These values support downstream reasoning but are not presented verbatim to users.

47. Trade-off Analysis

One of RealtyAsk' defining capabilities is explaining compromises.

Every recommendation should identify both strengths and limitations.

Example:

Strengths:

Excellent metro connectivity.
Strong builder reputation.
Spacious layouts.

Trade-offs:

Higher maintenance costs.
Possession scheduled after buyer's preferred timeline.
Limited visitor parking.

Trade-offs should always be supported by verified information.

48. Alternative Generation

The Decision Engine should never return a single recommendation in isolation.

Every recommendation should have meaningful alternatives.

Alternative generation may consider:

Nearby sectors.
Slight budget adjustments.
Different builders.
Different configurations.
Future possession dates.

Alternatives should remain relevant to the buyer's original intent.

49. Confidence Assessment

Every decision carries an internal confidence score.

Confidence depends on factors such as:

Completeness of buyer preferences.
Availability of verified data.
Ranking certainty.
Intelligence coverage.

Confidence is used internally to determine whether additional clarification is required.

It is not shown directly to users.

50. Conversation Engine

The Conversation Engine is the interface between the Decision Engine and the user.

Its responsibility is to transform structured decision outputs into natural conversations.

The Conversation Engine owns:

Intent detection.
Clarification.
Context management.
Conversation memory.
Response generation.

It does not make business decisions.

51. AI Architecture

The AI layer is intentionally thin.

Its responsibility is communication.

User

↓

Conversation Engine

↓

AI Module

↓

OpenAI

↓

Structured Response

↓

Conversation Engine

↓

User

The AI Module never:

Queries PostgreSQL.
Filters projects.
Calculates rankings.
Determines eligibility.
52. Prompt Architecture

Prompt construction is modular.

Instead of a single large prompt, RealtyAsk assembles prompts from structured components.

Example:

System Instructions

+

Conversation Context

+

Buyer Profile

+

Decision Summary

+

Knowledge Objects

+

Response Guidelines

This approach ensures consistency, maintainability, and prompt reuse across features.

53. Model Routing

Different models may be used for different tasks.

Examples:

OpenAI — conversational reasoning and explanations.
Groq — low-latency fallback.
Anthropic — long-context or specialized reasoning.
Cohere — embedding and retrieval tasks.

Model routing is determined by the AI Module and should remain transparent to the rest of the platform.

54. Conversation Memory

Conversation memory is organized into three layers.

Working Memory

Current interaction and recent messages.

Session Memory

Summary of the active conversation, recommended properties, rejected options, and clarification history.

Persistent Memory

User preferences explicitly chosen or saved, including:

Preferred budget.
Preferred sectors.
Saved properties.
Builder preferences.

Conversation transcripts are not relied upon indefinitely; summarized context is preferred for long-term continuity.

55. AI Failure Strategy

If the primary AI provider is unavailable, the platform should degrade gracefully.

Fallback order:

Cached conversational responses where appropriate.
Secondary language model.
Structured deterministic responses.

Core platform functionality should remain available even without AI.

56. Engineering Principles for AI

Every AI capability within RealtyAsk must follow these rules:

AI never owns business logic.
AI never invents factual information.
AI explains decisions rather than making them.
AI consumes structured knowledge instead of raw database entities.
AI failures must not interrupt core product workflows.
AI interactions must be observable and auditable.
AI prompts should be modular, reusable, and versioned.


Part V — Knowledge Platform Architecture
57. Overview

The Knowledge Platform is the foundation of the RealtyAsk ecosystem.

It serves as the single operational source of truth for every business capability across the platform.

Unlike traditional real estate systems that primarily store listings, the RealtyAsk Knowledge Platform stores structured, interconnected knowledge that enables deterministic reasoning, explainable recommendations, and conversational advisory.

Every recommendation, comparison, investment insight, and builder analysis ultimately depends on this platform.

58. Design Philosophy

The Knowledge Platform is built around five principles.

Structured Before Unstructured

Every piece of information should be represented as structured data whenever possible.

Natural language should only exist at the presentation layer.

Verified Before Generated

Facts originate from trusted sources.

AI may enrich facts with insights, but never replaces them.

Versioned Before Overwritten

Knowledge evolves continuously.

Information should be versioned rather than destructively updated whenever practical.

Connected Before Isolated

Knowledge should exist as relationships rather than disconnected tables.

Every entity should understand its relationship to other entities.

Enriched Before Presented

Raw facts are useful.

Structured intelligence makes them valuable.

59. Knowledge Platform Overview
                     Knowledge Platform

                             │

     ┌──────────────┬───────────────┬───────────────┐

     │              │               │               │

 Property      Builder       Locality      User Knowledge

     │              │               │               │

     └──────────────┼───────────────┼───────────────┘

                    │

        Investment Intelligence

                    │

          Decision Intelligence

                    │

          PostgreSQL Database

The platform is organized around business entities rather than database tables.

60. Core Knowledge Domains

The Knowledge Platform is divided into six primary knowledge domains.

Property Knowledge

Represents every residential project.

Contains:

Identity
Pricing
Configurations
Amenities
Floor Plans
Images
Possession
Inventory
RERA Details
Builder Knowledge

Represents developers.

Contains:

Company Information
Active Projects
Completed Projects
Reputation
Delivery History
Awards
Certifications
Regulatory Information
Locality Knowledge

Represents geographic intelligence.

Contains:

Sector
Metro
Schools
Hospitals
Shopping
Connectivity
Infrastructure
Investment Knowledge

Represents long-term investment context.

Contains:

Appreciation Drivers
Demand Indicators
Supply Indicators
Growth Factors
Risks
Infrastructure Impact
User Knowledge

Represents buyer preferences.

Contains:

Saved Projects
Preferred Builders
Budget
Search History
Conversation Summary
Saved Comparisons
Decision Knowledge

Generated dynamically.

Contains:

Recommendation Summary
Match Analysis
Trade-offs
Alternatives
Confidence
Decision Notes

Decision Knowledge is generated rather than permanently stored.

61. Entity Relationships

Every entity is connected through explicit relationships.

Builder
    │
    ├──────────── Project
    │                   │
    │                   ├──────── Configuration
    │                   │
    │                   ├──────── Pricing
    │                   │
    │                   ├──────── Amenities
    │                   │
    │                   ├──────── Inventory
    │                   │
    │                   └──────── Floor Plans
    │
Locality
    │
    ├──────── Infrastructure
    │
    ├──────── Metro
    │
    ├──────── Schools
    │
    ├──────── Hospitals
    │
Investment

The system reasons across relationships rather than isolated records.

62. Knowledge Objects

Every knowledge entity follows the same conceptual model.

Entity:
Property

Identifier:
UUID

Facts:
Structured Fields

Relationships:
Linked Entities

Intelligence:
Generated Insights

Metadata:
Version
Confidence
Last Updated
Verified By

This creates consistency across the platform.

63. Knowledge Lifecycle

Every knowledge object follows the same lifecycle.

External Source

↓

Collection

↓

Normalization

↓

Validation

↓

Storage

↓

Enrichment

↓

Approval

↓

Production

↓

Monitoring

↓

Refresh

Knowledge is never inserted directly into production.

64. Knowledge Ingestion

The ingestion pipeline transforms external information into internal knowledge.

Current trusted sources include:

RERA
Official Builder Websites
Builder Brochures
Verified Sales Teams
Internal Research
Google Maps
Government Infrastructure Announcements

The ingestion process is responsible for converting heterogeneous information into standardized schemas.

65. Data Normalization

Incoming data is standardized before storage.

Examples include:

Pricing

↓

Normalized Currency

Area

↓

Square Feet

Dates

↓

ISO Standard

Amenities

↓

Controlled Categories

Builder Names

↓

Canonical Identity

Normalization ensures consistency across every downstream system.

66. Validation Pipeline

Every incoming record passes through validation before becoming part of the operational knowledge base.

Validation includes:

Schema Validation
Required Field Validation
Relationship Validation
Duplicate Detection
Source Verification
Business Rule Validation

Invalid records are rejected before persistence.

67. Intelligence Enrichment

After structured facts exist, RealtyAsk generates higher-order intelligence.

Examples include:

Property Summary

Builder Summary

Lifestyle Summary

Investment Outlook

Trade-offs

Ideal Buyer

Key Considerations

This enrichment process produces explainable intelligence while preserving factual integrity.

68. Human Review Workflow

V1 follows a human-in-the-loop workflow.

Structured Facts

↓

AI Draft

↓

Reviewer

↓

Approval

↓

Knowledge Platform

AI accelerates documentation.

Humans maintain quality.

69. Knowledge Versioning

Knowledge changes over time.

Rather than replacing information without history, significant updates should create new versions.

Example:

Project Version 1

↓

Version 2

↓

Version 3

↓

Version 4

Version history enables:

Rollback
Auditability
Historical Comparison
Change Tracking
70. Knowledge Metadata

Every knowledge object maintains operational metadata.

Examples include:

Entity ID:
...

Created At:
...

Updated At:
...

Version:
...

Verified:
Yes

Verified Source:
Builder Website

Confidence:
96%

Status:
Active

Metadata supports automation, monitoring, and governance.

71. Knowledge Freshness

Knowledge quality depends on freshness.

V1 refresh policy:

Knowledge Type	Refresh Policy
Pricing	Monthly
Inventory	Monthly
Builder Information	Monthly
Amenities	Monthly
Locality Information	Monthly
Investment Intelligence	Monthly

The platform should support migration to event-driven updates without architectural changes.

72. Knowledge Caching

Frequently accessed knowledge should be cached.

Examples include:

Popular Properties
Builder Profiles
Locality Pages
Recommendation Summaries
Investment Summaries

Caching should improve latency without becoming the authoritative data source.

73. Knowledge Security

The Knowledge Platform is a strategic company asset.

Access should be governed through role-based permissions.

Examples:

Read
Create
Update
Review
Approve
Publish
Archive

All administrative actions should be auditable.

74. Knowledge Quality Principles

Every knowledge object should satisfy the following criteria before publication.

Accuracy

Supported by trusted sources.

Consistency

Matches established schemas and relationships.

Completeness

Contains sufficient information for downstream decision-making.

Explainability

Generated insights remain traceable to factual inputs.

Freshness

Reflects the latest verified information available.

75. Long-Term Knowledge Vision

As RealtyAsk expands, the Knowledge Platform should evolve into a comprehensive real estate knowledge graph.

Future entities may include:

Brokers
Banks
Loan Products
Government Policies
Tax Rules
Developers
Cities
Infrastructure Projects
Legal Processes
Home Insurance
Interior Design Partners

Every new entity should integrate into the existing graph through explicit relationships rather than standalone tables.

76. Why the Knowledge Platform Exists

The purpose of the Knowledge Platform is not merely to store information.

Its purpose is to enable every other system within RealtyAsk.

Without it:

Search becomes unreliable.
Recommendations become subjective.
AI becomes prone to hallucination.
Builder analysis loses credibility.
Investment insights become speculative.

The Knowledge Platform transforms verified information into trusted decision-making.

It is therefore the most valuable technical asset within the RealtyAsk ecosystem.


Part VI — Backend Architecture & Service Design
77. Backend Philosophy

The RealtyAsk backend is designed as a Domain-Driven Modular Monolith.

Business capabilities are organized into independent modules that communicate through well-defined interfaces.

The backend does not revolve around artificial intelligence, databases, or HTTP.

Instead, it revolves around business domains.

Every module owns one business capability and is responsible for the complete lifecycle of that capability.

78. Backend High-Level Architecture
                        Express API

                             │

────────────────────────────────────────────────────────

Authentication Middleware

Validation Middleware

Logging Middleware

Rate Limiting

────────────────────────────────────────────────────────

Controllers

────────────────────────────────────────────────────────

Domain Services

────────────────────────────────────────────────────────

Repositories

────────────────────────────────────────────────────────

Prisma ORM

────────────────────────────────────────────────────────

PostgreSQL

The architecture intentionally separates transport concerns from business logic.

79. Backend Directory Structure

The backend follows a feature-first organization.

backend/

src/

│

├── modules/

│

│   ├── property/

│   ├── builder/

│   ├── locality/

│   ├── search/

│   ├── decision/

│   ├── intelligence/

│   ├── comparison/

│   ├── calculator/

│   ├── conversation/

│   ├── lead/

│   ├── auth/

│   ├── user/

│   ├── admin/

│   └── analytics/

│

├── shared/

│

├── infrastructure/

│

├── config/

│

├── app.ts

└── server.ts

Each module remains self-contained.

80. Internal Module Structure

Every module follows the same layout.

Example:

property/

controller/

service/

repository/

validator/

dto/

mapper/

cache/

events/

types/

tests/

index.ts

Consistency across domains reduces onboarding complexity.

81. Request Processing Pipeline

Every HTTP request follows the same lifecycle.

Incoming Request

↓

Express

↓

Middleware

↓

Controller

↓

Validator

↓

Service

↓

Repository

↓

Database

↓

Service

↓

DTO

↓

Response

No layer may bypass another.

82. Controllers

Controllers represent the HTTP boundary.

Responsibilities include:

Request parsing.
Authentication.
Authorization.
Input validation.
DTO conversion.
Response formatting.

Controllers must never contain business logic.

Example:

POST /chat

↓

ConversationController

↓

ConversationService
83. Services

Services contain business logic.

Every important decision belongs inside services.

Examples include:

Search logic.
Recommendation orchestration.
Builder validation.
Lead qualification.
Property comparison.

Services may communicate with other services through defined interfaces.

They never access another module's repository directly.

84. Repositories

Repositories abstract persistence.

Responsibilities include:

Prisma queries.
Transactions.
Pagination.
Index usage.
CRUD operations.

Repositories never contain:

Business rules.
AI.
Ranking.
Validation.

Repositories communicate only with PostgreSQL.

85. DTO Layer

Every API communicates using DTOs.

Database entities are never returned directly.

Example:

ProjectEntity

↓

ProjectMapper

↓

ProjectResponseDTO

This protects internal schemas from leaking into public APIs.

86. Validation

Validation occurs at two levels.

API Validation

Input shape.

Required fields.

Types.

Formats.

Business Validation

Examples:

Budget cannot be negative.

Possession year must exist.

Builder must be active.

Property must belong to requested city.

Business validation belongs inside services.

87. Authentication

Authentication uses Better Auth.

Supported methods:

Mobile OTP.
Google Sign-In.

Future:

Apple Sign-In.

Authentication responsibilities include:

Identity verification.
Session creation.
Token validation.
Session refresh.

Authorization remains separate.

88. Authorization

Authentication answers:

Who are you?

Authorization answers:

What are you allowed to do?

Roles include:

Guest

↓

User

↓

Moderator

↓

Admin

↓

Super Admin

Future builder accounts may introduce:

Builder Admin

Builder Staff

Partner Admin

89. Transactions

Business operations spanning multiple repositories should execute within database transactions.

Examples:

Site Visit Request

↓

Lead Creation

↓

Conversation Update

↓

Notification

↓

Audit Log

↓

Commit

If any step fails, the transaction should roll back where applicable.

90. Error Handling

Errors are classified into standard categories.

Validation Error

400

Authentication Error

401

Authorization Error

403

Resource Not Found

404

Business Rule Violation

422

Infrastructure Failure

500

External Service Failure

503

Errors should be consistent across every module.

91. Logging

Every request receives a unique Request ID.

Logs include:

Timestamp.
User.
Endpoint.
Duration.
Status.
Domain.
Correlation ID.

Sensitive information should never be logged.

92. Caching Strategy

Redis is used for performance optimization.

Cache candidates include:

Property Pages.
Builder Profiles.
Locality Pages.
Recommendation Summaries.
Search Results.
Session Summaries.

Redis is never treated as the source of truth.

93. Background Jobs

Some operations should execute asynchronously.

Examples:

Knowledge Refresh.
Intelligence Generation.
Cache Invalidation.
Analytics Aggregation.
Notification Delivery.

Future versions may introduce dedicated job workers.

94. Event Architecture

Although the platform is a modular monolith, internal events reduce coupling.

Example:

Property Updated

↓

Cache Invalidated

↓

Search Index Updated

↓

Builder Summary Refresh

↓

Analytics Update

Events should represent business events rather than technical actions.

95. API Design Principles

Every API should be:

RESTful.
Versioned.
Predictable.
Idempotent where appropriate.
Consistent.

Responses should follow a standard envelope.

Example:

{
  "success": true,
  "data": { },
  "meta": { },
  "error": null
}
96. Pagination

Large collections should never be returned completely.

Default strategy:

Cursor-based pagination.

Supported:

Cursor.
Limit.
Sorting.
Filtering.

Pagination metadata should be returned consistently.

97. Rate Limiting

Rate limiting protects the platform from abuse.

Examples:

Guest Chat

Higher restrictions.

Authenticated Users

Moderate restrictions.

Admin APIs

Separate limits.

Rate limiting should occur before expensive operations such as AI requests.

98. Observability

Every module should expose operational metrics.

Examples:

Search Module

Search latency.
Result count.

Decision Engine

Recommendation latency.
Ranking duration.

Conversation

AI latency.
Clarification count.

Knowledge

Cache hit rate.
Freshness.

These metrics should integrate with monitoring dashboards.

99. Backend Principles

Every backend engineer should follow these rules.

Controllers remain thin.
Business logic belongs only in services.
Repositories never contain business logic.
AI never accesses the database directly.
Modules communicate through services.
Transactions are explicit.
Shared utilities never own business rules.
APIs expose DTOs, not entities.
Caching improves performance, never correctness.
Every endpoint should be observable.


Part VII — Conversation, Discovery & Decision Architecture
100. Overview

RealtyAsk is fundamentally a decision support platform.

Every buyer interaction follows a structured reasoning pipeline rather than a direct prompt-response interaction with a language model.

The platform separates conversation, discovery, decision-making, and language generation into independent systems.

This separation improves:

Explainability
Performance
Reliability
Maintainability
Scalability
101. High-Level Decision Flow
                   Buyer

                     │

              Conversation Engine

                     │

              Intent Extraction

                     │

             Preference Resolution

                     │

              Discovery Engine

                     │

              Decision Engine

                     │

          Knowledge Platform

                     │

              Response Composer

                     │

              Conversation Engine

                     │

                   Buyer

The Conversation Engine never makes decisions.

The Decision Engine never talks directly to the buyer.

102. Conversation Engine
Purpose

The Conversation Engine owns every interaction between the buyer and RealtyAsk.

Its responsibility is to understand intent, maintain context, guide the buyer through clarification, and present structured decisions naturally.

It is the platform's communication layer.

Responsibilities
Session initialization.
Context loading.
Intent extraction.
Clarification.
Conversation state.
Response streaming.
Conversation summarization.
Memory updates.
It Never Owns
Search.
Recommendation ranking.
Property filtering.
Builder intelligence.
Business calculations.
103. Conversation Lifecycle

Every conversation follows a predictable lifecycle.

New Conversation

↓

Load User Context

↓

Intent Extraction

↓

Resolve Missing Information

↓

Clarification

↓

Intent Complete?

↓

No → Continue Clarification

↓

Yes

↓

Discovery

↓

Decision

↓

Generate Response

↓

Persist Conversation Summary

The Conversation Engine exists to reduce ambiguity before invoking downstream systems.

104. Intent Extraction

The first responsibility of the Conversation Engine is to transform natural language into structured intent.

Example:

User:

"Looking for a 3 BHK around Sector 150 under ₹2 crore."

↓

Structured Intent

City:
Noida

Sector:
150

Configuration:
3 BHK

Budget:
2 Crore

Purpose:
Home Purchase

Intent extraction should produce structured data rather than conversational summaries.

105. Clarification Strategy

RealtyAsk should avoid asking unnecessary questions.

Clarification is progressive.

Questions are asked only when additional information would materially improve recommendations.

Examples:

Missing city.

↓

Ask city.

Budget ambiguous.

↓

Clarify budget.

Sector unavailable.

↓

Suggest nearby sectors.

The objective is to minimize conversational friction while maximizing recommendation quality.

106. Preference Resolution

Buyer preferences originate from multiple sources.

Priority order:

Current conversation.
Explicit saved preferences.
Persistent user profile.
Inferred historical preferences.

Current conversation always overrides historical assumptions.

107. Discovery Engine
Purpose

The Discovery Engine identifies eligible properties.

It does not rank them.

It simply answers:

"Which properties satisfy the defined constraints?"

Responsibilities
Hard filtering.
Soft filtering.
Nearby expansion.
Candidate generation.
Eligibility validation.
Inputs

Structured buyer preferences.

Outputs

Eligible property set.

108. Discovery Lifecycle
Structured Intent

↓

Hard Constraints

↓

Eligible Projects

↓

Soft Constraints

↓

Nearby Expansion

↓

Candidate Set

The Discovery Engine should remain deterministic.

109. Hard Constraints

Hard constraints eliminate properties immediately.

Examples:

City.
Configuration.
Budget ceiling.
Project status.
Required possession timeline.

A property failing a hard constraint is excluded from further evaluation.

110. Soft Constraints

Soft constraints influence recommendation quality but do not eliminate candidates.

Examples:

Metro distance.
Builder preference.
Schools.
Amenities.
Lifestyle.
Investment outlook.

Soft constraints are evaluated later by the Decision Engine.

111. Nearby Expansion

Nearby expansion is intentionally conservative.

Expansion may occur only when:

No suitable projects satisfy the original request.
The user explicitly requests nearby alternatives.
Business rules require controlled expansion.

Expansion strategies include:

Adjacent sectors.
Slight budget flexibility.
Similar configurations.
Comparable builders.

Every expansion should be disclosed to the buyer.

112. Decision Engine

The Decision Engine transforms eligible candidates into personalized buying advice.

Unlike recommendation engines that optimize clicks, the Decision Engine optimizes buyer confidence.

Responsibilities
Candidate evaluation.
Personalized ranking.
Trade-off analysis.
Alternative generation.
Decision summary creation.
Inputs

Candidate properties.

Buyer profile.

Knowledge objects.

Outputs

Structured decision package.

113. Decision Lifecycle
Candidate Set

↓

General Ranking

↓

Personalized Ranking

↓

Trade-off Analysis

↓

Alternative Generation

↓

Decision Summary

↓

Conversation Engine

Every stage produces structured outputs.

114. Ranking Strategy

Ranking occurs in two stages.

Stage One

General ranking based on objective property quality.

Applied when limited buyer context exists.

Stage Two

Personalized ranking.

Applied after sufficient buyer preferences have been collected.

Factors may include:

Commute.
Family needs.
Investment goals.
Budget flexibility.
Builder affinity.

The Decision Engine owns personalization.

115. Decision Package

The Decision Engine never returns plain text.

It returns a structured object.

Example:

Recommendations:
[...]

Alternatives:
[...]

TradeOffs:
[...]

Reasons:
[...]

DecisionSummary:
...

Confidence:
...

The Conversation Engine converts this into natural language.

116. Response Composer

The Response Composer prepares structured outputs for the AI.

It assembles:

Conversation context.
Buyer context.
Decision package.
Knowledge snippets.
Response guidelines.

The language model receives structured context rather than raw database records.

117. AI Response Generation

The language model has one responsibility:

Communicate the decision.

It should:

Explain recommendations.
Answer follow-up questions.
Educate buyers.
Present trade-offs.
Maintain conversational flow.

It should not:

Modify rankings.
Invent properties.
Generate unsupported facts.
118. Conversation Memory

Memory is organized into three levels.

Working Memory

Recent exchanges.

Session Memory

Conversation summary.

Rejected recommendations.

Clarifications.

Current shortlist.

Persistent Memory

Saved preferences.

Saved projects.

Preferred builders.

Budget range.

Persistent memory should consist of structured information rather than full conversation transcripts.

119. Recommendation Cache

Decision packages are cacheable.

Cache key:

User Context

+

Search Context

+

Property Dataset Version

↓

Decision Hash

If identical conditions exist, the cached decision package may be reused.

This reduces latency and AI cost while maintaining consistency.

120. AI Provider Strategy

The AI layer should support multiple providers.

Primary:

OpenAI.

Fallbacks:

Groq.

Anthropic.

Future providers.

Provider selection should remain abstracted behind the AI Module.

No business logic should depend on provider-specific behavior.

121. Conversation Failure Strategy

If conversational AI becomes unavailable:

Search continues.
Property pages remain functional.
Comparisons remain available.
Financial calculators continue to operate.

Responses may temporarily become deterministic and template-based.

The platform should remain usable even when conversational capabilities degrade.

122. Design Principles

The Conversation, Discovery, and Decision systems follow these principles:

Understand before searching.
Search before ranking.
Rank before explaining.
Explain only after decisions are complete.
Never allow AI to replace deterministic reasoning.
Preserve user trust through transparency.
Maintain separation between facts, decisions, and language.


Part VIII — Database Architecture & Persistence
123. Purpose

The PostgreSQL database is the operational source of truth for RealtyAsk.

Every factual piece of information presented to buyers originates from the database after passing through the knowledge ingestion and validation pipeline.

No service should directly depend on external providers such as builder websites or RERA during normal application operation.

The database exists to provide:

Reliability
Consistency
Explainability
Performance
Versionability
124. Persistence Philosophy

RealtyAsk follows several principles regarding persistence.

Principle 1 — Database First

All factual information must exist in PostgreSQL before it becomes available to the platform.

External APIs are ingestion sources, not runtime dependencies.

Principle 2 — Normalize Facts

Core business entities remain normalized.

Examples include:

Projects
Builders
Localities
Configurations
Pricing
Amenities

This avoids duplication and simplifies updates.

Principle 3 — Denormalize for Performance

Frequently accessed read models may be denormalized.

Examples:

Property Detail View
Builder Overview
Recommendation Cache

Denormalized views are optimization layers—not authoritative storage.

Principle 4 — AI Never Writes Facts

Language models may generate intelligence drafts.

Only validated services may persist factual information.

125. High-Level Entity Model
                           Builder
                              │
                              │ 1:N
                              ▼
                           Project
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
 Configuration            Pricing             Amenities
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                         Inventory
                              │
                              ▼
                         Floor Plans

Project
    │
    ├──────── Locality
    │
    ├──────── Infrastructure
    │
    ├──────── Metro
    │
    ├──────── Schools
    │
    └──────── Hospitals

User
    │
    ├──────── Saved Projects
    ├──────── Conversations
    ├──────── Preferences
    └──────── Leads

This is the conceptual model.

Actual table design may evolve without changing these relationships.

126. Primary Entity Groups

The database is organized into several logical groups.

Property Group

Examples:

Projects
Towers
Configurations
Inventory
Pricing
Amenities
Floor Plans
Builder Group

Examples:

Builders
Builder Statistics
Delivery History
Builder Reputation
Locality Group

Examples:

Localities
Metro
Schools
Hospitals
Infrastructure
Nearby Places
User Group

Examples:

Users
Preferences
Saved Projects
Sessions
Conversation References
Sales Group

Examples:

Leads
Site Visits
Callback Requests
Broker Assignments
Intelligence Group

Examples:

Builder Intelligence
Property Intelligence
Investment Intelligence
Decision Metadata
127. Read Model vs Write Model

RealtyAsk separates operational storage from optimized reading.

                User

                  │

             Read Models

                  │

──────────────────────────────

     PostgreSQL (Truth)

──────────────────────────────

             Write Models

Write models prioritize consistency.

Read models prioritize speed.

128. Repository Ownership

Every table belongs to one domain.

Examples:

Table	Owner
Projects	Property Domain
Builders	Builder Domain
Users	User Domain
Leads	Lead Domain
Conversations	Conversation Domain
Preferences	User Domain

No repository may update another domain's tables directly.

Cross-domain updates occur through services.

129. Transactions

Transactions protect business consistency.

Examples:

Creating a Site Visit

Create Lead

↓

Create Site Visit

↓

Update Conversation

↓

Audit Log

↓

Commit

If any step fails, the transaction rolls back.

130. Indexing Strategy

Indexes should support the most common query patterns.

Examples:

Projects

Sector
Builder
Status
Possession
Price Range

Builders

Name
City

Users

Mobile
Email

Leads

Status
Assigned Broker

Conversation

User
Updated Time

Indexes should be driven by query patterns rather than assumptions.

131. Query Design

All queries should follow these principles.

Select only required fields.
Avoid N+1 queries.
Paginate large datasets.
Batch related lookups.
Prefer joins over repeated queries where appropriate.
Cache expensive reads.

Every query should have measurable performance targets.

132. Caching Architecture

Redis acts as a performance layer.

Request

↓

Redis

↓

Hit

↓

Return

OR

↓

Miss

↓

PostgreSQL

↓

Redis

↓

Return

Redis is never authoritative.

Cache Candidates
Property Pages
Builder Profiles
Recommendation Packages
Investment Summaries
Popular Searches
Session Summaries
133. Database Versioning

Schema evolution should occur through Prisma migrations.

Rules:

Every migration reviewed.
Rollback strategy documented.
Production migrations tested.
Destructive migrations avoided.

Database history should remain traceable.

134. Soft Deletes

Business entities should generally use soft deletion.

Instead of removing records:

Deleted

↓

Archived

↓

Hidden

This preserves:

Auditability.
Analytics.
Historical references.

Exceptions may exist for temporary or derived data.

135. Audit Logging

Administrative actions should be recorded.

Examples:

Project edited.
Builder updated.
Pricing changed.
Intelligence approved.
User role changed.

Each audit record includes:

Actor.
Action.
Entity.
Timestamp.
Previous value.
New value.
136. Search Optimization

The database supports structured filtering.

Examples:

City
Sector
Builder
Budget
Configuration
Possession
Amenities

Search should remain deterministic.

Full-text and semantic search may be layered on top without replacing structured queries.

137. Backup & Recovery

Production data must be protected.

Requirements include:

Automated daily backups.
Point-in-time recovery where supported.
Backup verification.
Disaster recovery procedures.
Restore testing.

Backups are only valuable if restoration has been validated.

138. Data Retention

Different entities require different retention policies.

Examples:

Conversations
Leads
Analytics
Audit Logs
User Sessions

Retention periods should balance operational needs, legal requirements, and storage efficiency.

139. Future Database Evolution

The schema should accommodate future expansion without redesign.

Potential additions include:

Multi-city support.
Builder portals.
White-label deployments.
Financial institutions.
Legal verification.
Market analytics.

The schema should evolve through additive changes wherever possible.

140. Persistence Principles

Every engineer interacting with the database should follow these rules:

PostgreSQL is the single operational source of truth.
Repositories own persistence.
Services own business logic.
AI never modifies factual records directly.
Normalize facts; denormalize for reads when justified.
Transactions protect consistency.
Cache for performance, never for correctness.
Every schema change requires a migration.
Every important change is auditable.
Design for evolution, not perfection.


Part IX — API Architecture & Integration Design
141. Purpose

The API layer provides a standardized interface between clients and the RealtyAsk platform.

It abstracts the underlying business domains and exposes consistent, secure, and versioned interfaces for all supported clients.

The API should remain independent of presentation technologies, allowing multiple frontends and partner systems to reuse the same backend capabilities.

142. API Philosophy

Every API within RealtyAsk follows five principles.

Client Agnostic

APIs should not assume the requesting client is a web application.

Future consumers may include:

Mobile applications
Admin dashboards
Builder portals
Partner platforms
Public integrations
Domain Oriented

Endpoints are organized around business capabilities rather than database tables.

Example:

✓ /properties

✓ /builders

✓ /search

✓ /decision

✗ /pricing_table

✗ /builder_records
Stateless

Each request should contain all information required for processing.

Persistent state should be managed through authentication and conversation sessions rather than server memory.

Consistent

All endpoints should follow the same request and response conventions.

Versioned

Breaking API changes should be introduced through explicit versioning.

Example:

/api/v1

/api/v2
143. API Categories

The platform exposes several logical API groups.

Conversation APIs

Examples:

POST /conversation/start

POST /conversation/message

GET /conversation/{id}

DELETE /conversation/{id}

Purpose:

Manage conversational interactions.

Search APIs

Examples:

POST /search

GET /search/suggestions

POST /search/nearby

Purpose:

Structured property discovery.

Decision APIs

Examples:

POST /decision/recommend

POST /decision/compare

POST /decision/explain

Purpose:

Decision support and recommendations.

Property APIs

Examples:

GET /properties

GET /properties/{id}

GET /properties/{id}/pricing

GET /properties/{id}/floorplans
Builder APIs

Examples:

GET /builders

GET /builders/{id}

GET /builders/{id}/projects
Calculator APIs

Examples:

POST /calculator/emi

POST /calculator/gst

POST /calculator/stamp-duty
User APIs

Examples:

GET /me

PATCH /me

GET /me/preferences

GET /me/saved-properties
Lead APIs

Examples:

POST /lead/callback

POST /lead/site-visit

GET /lead/status
Admin APIs

Restricted.

Examples:

POST /admin/project

PATCH /admin/project

POST /admin/intelligence

POST /admin/builder
144. API Lifecycle

Every request follows the same lifecycle.

Client

↓

API Gateway

↓

Authentication

↓

Validation

↓

Controller

↓

Orchestrator

↓

Domain Services

↓

Repository

↓

Database

↓

Response

Controllers never directly call repositories.

145. Request Format

Every request should follow a predictable structure.

Example:

{
  "filters": {},
  "preferences": {},
  "pagination": {},
  "metadata": {}
}

Payloads should remain explicit and self-describing.

146. Response Format

Every endpoint should return a consistent envelope.

{
  "success": true,
  "data": {},
  "meta": {},
  "error": null
}

This applies across all API categories.

147. Error Contract

Errors should follow a standard schema.

Example:

{
  "success": false,
  "error": {
    "code": "PROPERTY_NOT_FOUND",
    "message": "The requested property does not exist."
  }
}

Internal implementation details should never be exposed.

148. Authentication Flow

Protected endpoints require authentication.

Flow:

Client

↓

Access Token

↓

Authentication Middleware

↓

Authorization

↓

Controller

Public endpoints remain accessible without authentication where appropriate.

149. Authorization

Authorization is role-based.

Example roles:

Guest

↓

User

↓

Builder

↓

Moderator

↓

Admin

↓

Super Admin

Permissions should be enforced centrally rather than within individual controllers.

150. Pagination

Large collections must support pagination.

Standard parameters:

limit

cursor

sort

order

Pagination metadata should accompany every paginated response.

151. Filtering

Filtering should remain deterministic.

Supported filters include:

City
Sector
Builder
Budget
Configuration
Status
Possession
Amenities

Complex filtering should remain server-side.

152. Sorting

Sorting options should be explicit.

Examples:

Price
Possession
Project Name
Recently Updated

Recommendation ranking should not be exposed as a generic sort option because it is produced by the Decision Engine rather than simple ordering.

153. Streaming APIs

Conversational responses should support streaming.

Example flow:

Conversation Request

↓

Decision Generated

↓

LLM Streaming

↓

Incremental Response

↓

Conversation Complete

Only conversational responses require streaming.

154. Idempotency

Operations should behave predictably.

Safe examples:

GET Property
Search
Compare

Idempotent POST examples:

Recommendation generation (with identical input)

Non-idempotent examples:

Site visit creation
Callback request

Where necessary, idempotency keys should prevent accidental duplicate submissions.

155. Rate Limiting

Different endpoint categories require different limits.

Examples:

Endpoint Type	Strategy
Conversation	Moderate
Search	Moderate
Property	Relaxed
Calculator	Relaxed
Authentication	Strict
Admin	Separate Policy

Expensive AI endpoints should be protected more aggressively than standard CRUD endpoints.

156. Internal APIs

Not every API should be publicly accessible.

Internal APIs may include:

Knowledge refresh.
Intelligence generation.
Cache invalidation.
Analytics aggregation.

These endpoints should require service-level authentication.

157. Future External APIs

Although V1 does not expose public APIs, the architecture should support future integrations.

Potential future consumers include:

Builder CRMs
Partner websites
Banking partners
Loan marketplaces
White-label deployments

Public APIs should build upon existing internal services rather than introducing separate business logic.

158. API Documentation

Every endpoint should be documented.

Documentation should include:

Purpose.
Authentication requirements.
Request schema.
Response schema.
Error responses.
Rate limits.
Example requests.
Example responses.

OpenAPI (Swagger) should be used as the canonical API specification.

159. API Security

Every endpoint should follow secure defaults.

Requirements include:

HTTPS only.
Input validation.
Output sanitization.
Rate limiting.
Authentication.
Authorization.
Audit logging.

Sensitive information should never be returned unnecessarily.

160. API Design Principles

Every API within RealtyAsk should satisfy the following principles:

Stable contracts.
Consistent request and response formats.
Domain-oriented design.
Stateless communication.
Explicit versioning.
Secure by default.
Observable.
Client independent.
Performance conscious.
Easy to evolve without breaking existing integrations.


Part X — Frontend Architecture
161. Purpose

The frontend is the presentation layer of RealtyAsk.

Its responsibility is to provide a fast, intuitive, and conversational experience while remaining completely independent of business logic.

The frontend should never determine recommendations, perform calculations, or implement domain rules.

Instead, it presents data and orchestrates user interactions through the backend APIs.

162. Frontend Philosophy

The frontend follows five principles.

Thin Client

Business logic belongs in backend domains.

The frontend focuses on rendering and interaction.

Domain-Oriented

UI is organized around business domains rather than generic pages.

Server-First

Use Server Components wherever possible for initial rendering, SEO, and performance.

Use Client Components only where interactivity requires them.

Progressive Enhancement

The application should remain functional as content loads.

Skeletons, optimistic updates, and streamed responses should improve perceived performance.

Accessibility by Default

Every feature should be keyboard accessible, screen-reader friendly, and responsive across devices.

163. High-Level Frontend Architecture
                    Browser
                        │
                        ▼
                Next.js App Router
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  Server Components  Client Components  Route Handlers
        │               │
        └───────Shared Services─────────┘
                        │
                        ▼
                 Backend APIs

The frontend owns rendering.

The backend owns business logic.

164. Module Organization

The frontend mirrors backend domains to reduce cognitive load.

frontend/

app/

modules/
    chat/
    property/
    builder/
    search/
    comparison/
    calculator/
    profile/
    lead/
    admin/

shared/
    components/
    hooks/
    lib/
    services/
    types/
    utils/

styles/
public/

Keeping the same vocabulary across frontend and backend makes navigation intuitive.

165. Rendering Strategy

Use the appropriate rendering model for each feature.

Feature	Strategy
Landing Page	Static Generation
Property Pages	Server Components
Search Results	Server Components + Client Filters
Chat	Client Components + Streaming
Profile	Server Components
Admin Dashboard	Server Components
Comparison	Server Components
Calculators	Client Components

Rendering decisions should prioritize performance and SEO.

166. State Management

State should be categorized by lifespan.

Local State

UI interactions.

Examples:

Modal visibility.
Form inputs.
Selected tabs.
Server State

Fetched data.

Examples:

Properties.
Builders.
Recommendations.

Should be cached and revalidated appropriately.

Session State

Conversation ID.

Authenticated user.

Temporary selections.

Persistent State

Saved preferences.

Saved properties.

Theme.

Language.

Persistent state should originate from the backend whenever possible.

167. Component Principles

Every UI component should satisfy these rules:

Single responsibility.
Reusable.
Stateless where possible.
Accessible.
Testable.

Components should never perform API calls directly unless explicitly designed as container components.

168. Chat Interface

The chat experience is the primary interaction surface.

Responsibilities include:

Streaming AI responses.
Rendering structured recommendation cards.
Handling clarification questions.
Displaying comparison results.
Presenting action cards (save, compare, schedule visit).

The chat interface should render structured UI blocks instead of relying solely on plain text.

169. Performance Strategy

Performance targets:

Initial page load <2 seconds on broadband.
First Contentful Paint under 2 seconds.
AI responses should stream progressively.
Images should be lazy-loaded and optimized.
Large lists should be virtualized where appropriate.

Performance is considered a product feature.

170. Frontend Design Principles
Presentation only.
Domain-driven organization.
Server-first rendering.
Accessibility by default.
Reusable components.
Progressive loading.
API-first communication.
Responsive across devices.
Performance-conscious implementation.
Consistent design language.


Part XI — Infrastructure, Deployment & DevOps Architecture
171. Purpose

The infrastructure layer provides the runtime environment for the RealtyAsk platform.

It is responsible for hosting, deployment, networking, scalability, reliability, and operational stability.

Infrastructure should remain invisible to users while providing secure, resilient, and performant access to all platform capabilities.

172. Infrastructure Philosophy

The infrastructure follows five principles.

Cloud Native

Every service should be deployable independently.

Stateless Compute

Application servers remain stateless.

Persistent state exists only within managed services such as PostgreSQL, Redis, and Storage.

Horizontal Scalability

The architecture should allow additional application instances without redesign.

Managed Services First

Prefer managed cloud services over self-hosted infrastructure whenever practical.

Infrastructure as Code (Future)

Infrastructure configuration should eventually become version-controlled and reproducible.

173. Production Architecture
                         Internet
                              │
                              ▼
                      GoDaddy Domain
                              │
                              ▼
                        Cloudflare CDN
                              │
             ┌────────────────┴────────────────┐
             ▼                                 ▼
     Vercel (Frontend)                 Render (Backend)
             │                                 │
             ▼                                 ▼
     Next.js Application              Express Application
                                               │
                     ┌─────────────────────────┼─────────────────────────┐
                     ▼                         ▼                         ▼
             Supabase PostgreSQL         Redis Cache          Supabase Storage
                     │
                     ▼
             Knowledge Platform

Cloudflare provides DNS, HTTPS, caching, and protection.

174. Runtime Components

The production environment consists of several independent runtime services.

Component	Responsibility
Vercel	Frontend Hosting
Render	Backend APIs
PostgreSQL	Source of Truth
Redis	Performance Cache
Supabase Storage	Images & Documents
OpenAI	Conversational AI
Cloudflare	CDN, DNS, SSL

Each component should fail independently without collapsing the entire platform.

175. Environment Strategy

The platform supports multiple environments.

Local

Developer machines.

Development

Shared testing environment.

Staging

Production-like environment for QA and validation.

Production

Customer-facing environment.

Production should always remain isolated from development data.

176. Environment Variables

Sensitive configuration must never be hardcoded.

Examples include:

Database URLs.
JWT secrets.
API keys.
Redis credentials.
OpenAI keys.
Google Maps keys.

Each environment maintains independent secrets.

177. Deployment Pipeline

Every deployment follows the same lifecycle.

Developer

↓

Git Commit

↓

Pull Request

↓

Code Review

↓

CI Pipeline

↓

Automated Tests

↓

Build

↓

Deploy

↓

Health Checks

↓

Production

Deployment should be automated and repeatable.

178. Continuous Integration (CI)

Every pull request should trigger automated validation.

Checks include:

TypeScript compilation.
Linting.
Unit tests.
Integration tests.
Build verification.
Security scanning (future).

No code reaches production without passing CI.

179. Continuous Deployment (CD)

Deployments should be:

Automated.
Repeatable.
Observable.
Reversible.

Every deployment receives a unique version identifier.

Rollback procedures should be documented.

180. Service Scaling

Scaling strategy for V1:

Frontend

Automatically handled by Vercel.

Backend

Horizontal scaling through additional Render instances.

PostgreSQL

Vertical scaling initially.

Read replicas may be introduced in future.

Redis

Managed instance with memory scaling.

AI Providers

Provider routing distributes conversational load.

181. Static Assets

Static assets include:

Property images.
Floor plans.
Builder logos.
Documents.

These assets should be served through Supabase Storage and cached via Cloudflare CDN.

Application servers should never directly serve large media files.

182. Background Processing

Not every task should execute synchronously.

Suitable background jobs include:

Intelligence generation.
Knowledge refresh.
Cache warming.
Image optimization.
Notification delivery.
Analytics aggregation.

Future versions may introduce dedicated workers or a job queue.

183. Scheduled Tasks

Recurring operational tasks include:

Monthly knowledge refresh.
Cache cleanup.
Backup verification.
Analytics aggregation.
Health reporting.

Scheduled tasks should remain independent of user traffic.

184. Secrets Management

Secrets should satisfy the following rules:

Never committed to Git.
Environment-specific.
Rotatable.
Least privilege.
Auditable.

Developers should use secure secret management rather than local copies where possible.

185. Networking

Communication between services should always occur over secure HTTPS or encrypted database connections.

Only required ports should be exposed publicly.

Internal services should remain inaccessible from the public internet unless explicitly required.

186. Disaster Recovery

The infrastructure should support recovery from major failures.

Recovery plans include:

Database restoration.
Redis rebuild.
Storage recovery.
Service redeployment.
DNS failover where applicable.

Disaster recovery procedures should be tested periodically rather than assumed.

187. Backup Strategy

Production backups should include:

PostgreSQL database.
Uploaded media.
Configuration snapshots.

Backups should be:

Automated.
Encrypted.
Verified.
Restorable.

Retention policies should balance operational requirements and cost.

188. Cost Optimization

Infrastructure should scale responsibly.

Examples include:

Cache frequently accessed data.
Stream AI responses.
Avoid unnecessary LLM calls.
Compress images.
Lazy-load media.
Use CDN caching effectively.

Cost efficiency should never compromise correctness.

189. Infrastructure Monitoring

Infrastructure health should be continuously monitored.

Metrics include:

CPU usage.
Memory utilization.
Response latency.
Error rates.
Database connections.
Cache hit ratio.
AI provider latency.

Operational visibility is essential for maintaining reliability.

190. Infrastructure Principles

Every infrastructure decision should follow these rules:

Stateless application servers.
Managed services preferred.
Infrastructure independent from business logic.
Secure by default.
Automate deployments.
Monitor everything.
Scale horizontally where practical.
Separate environments.
Design for failure.
Keep operational complexity proportional to business needs.


Part XII — Security Architecture
191. Purpose

Security within RealtyAsk is a foundational architectural concern.

Every layer of the platform—including the frontend, backend, APIs, databases, infrastructure, and AI systems—must be designed to protect user data, preserve system integrity, and maintain trust.

Security is not implemented as a standalone module.

It is embedded throughout the platform.

192. Security Philosophy

RealtyAsk follows five security principles.

Zero Trust

No request is trusted by default.

Every request must be validated, authenticated, and authorized before accessing protected resources.

Least Privilege

Every user, service, and administrator receives only the permissions required to perform its responsibilities.

Defense in Depth

Security exists at multiple layers.

Even if one layer fails, others continue protecting the platform.

Secure by Default

The safest behavior should always be the default behavior.

Auditability

Every important security event should be traceable.

193. Security Layers
                    User

                      │

────────────────────────────────────

         Browser Security

────────────────────────────────────

       Authentication Layer

────────────────────────────────────

        Authorization Layer

────────────────────────────────────

        API Validation Layer

────────────────────────────────────

        Business Validation

────────────────────────────────────

        Database Security

────────────────────────────────────

      Infrastructure Security

Each layer protects the next.

194. Authentication

RealtyAsk authenticates users using Better Auth.

Supported methods:

Mobile OTP
Google Sign-In

Future support:

Apple Sign-In

Authentication responsibilities include:

Identity verification
Session creation
Session refresh
Session revocation

Authentication establishes identity only.

It does not determine permissions.

195. Authorization

Authorization determines access rights after authentication.

Role hierarchy:

Guest

↓

Authenticated User

↓

Moderator

↓

Admin

↓

Super Admin

Future roles:

Builder Admin
Builder Staff
Partner Manager

Permissions should be role-based rather than hardcoded into business logic.

196. API Security

Every API request passes through multiple validation stages.

Incoming Request

↓

HTTPS Enforcement

↓

Authentication

↓

Authorization

↓

Input Validation

↓

Business Validation

↓

Controller

↓

Domain Service

Requests failing validation should terminate immediately.

197. Input Validation

All incoming data is treated as untrusted.

Validation includes:

Type validation
Required fields
Length limits
Enum validation
Numeric ranges
Format validation

Business validation remains separate from schema validation.

198. Output Protection

Sensitive information should never be returned unnecessarily.

Examples:

Never expose:

Password hashes
Internal IDs (where avoidable)
API keys
Secrets
Internal stack traces

Responses should contain only the minimum required information.

199. Session Security

Sessions should satisfy the following requirements:

Secure cookies where applicable.
Automatic expiration.
Refresh support.
Logout invalidation.
Device independence.

Expired sessions should degrade gracefully.

200. Database Security

Database protection includes:

Encrypted connections.
Restricted credentials.
Principle of least privilege.
Automated backups.
Audit logging.

Application services access PostgreSQL through Prisma only.

Direct database access should be restricted to authorized administrators.

201. Secrets Management

Secrets include:

OpenAI API Keys
Database Credentials
Redis Credentials
JWT Secrets
Google OAuth Keys

Rules:

Never commit to source control.
Rotate periodically.
Environment-specific.
Access controlled.
Logged when changed.
202. Rate Limiting

Rate limiting protects both infrastructure and AI costs.

Examples:

Authentication

Very strict.

Conversation

Moderate.

Search

Moderate.

Property Pages

Relaxed.

Admin APIs

Separate policies.

Repeated violations may trigger temporary blocking.

203. AI Security

AI introduces unique security considerations.

The platform must defend against:

Prompt injection.
Jailbreak attempts.
Data leakage.
Prompt poisoning.
Hallucinated facts.

The AI Module should receive only structured context from trusted services.

Raw database access is prohibited.

204. Prompt Protection

Prompt construction should be centralized.

System prompts:

Version controlled.
Immutable at runtime.
Reviewed before deployment.

User messages should never directly modify system instructions.

205. Data Privacy

User data should be collected only when necessary.

Examples:

Stored:

Saved properties.
Preferences.
Conversation summaries.
Contact details.

Avoid storing:

Full conversation history indefinitely.
Sensitive financial documents.
Unnecessary personal identifiers.

Privacy should be built into the data model.

206. Audit Logging

Security-sensitive actions require audit records.

Examples:

Login.
Logout.
Permission changes.
Admin edits.
Intelligence approvals.
Project updates.
Builder modifications.

Audit logs should be immutable.

207. Infrastructure Security

Infrastructure protection includes:

HTTPS everywhere.
TLS encryption.
Firewall rules.
Managed database security.
Managed storage security.
Private credentials.
Environment isolation.

Development and production environments should never share credentials.

208. Incident Response

Security incidents follow a structured lifecycle.

Detection

↓

Classification

↓

Containment

↓

Investigation

↓

Recovery

↓

Postmortem

↓

Improvements

Every major incident should produce actionable learnings.

209. Compliance Considerations

Although RealtyAsk V1 is not pursuing formal certifications, the architecture should align with good practices that support future compliance efforts.

Examples include:

Consent-based data collection.
Right to delete user data.
Auditability.
Secure authentication.
Encryption in transit.
Encryption at rest (managed services).

Designing with these principles now reduces future compliance effort.

210. Security Principles

Every engineer should follow these rules:

Never trust client input.
Validate before processing.
Authenticate before authorizing.
Store only necessary data.
Never expose secrets.
Log security events.
Protect AI prompts.
Encrypt sensitive communication.
Follow least privilege.
Treat security as a product feature.


Part XIII — Performance & Scalability Architecture
211. Purpose

The purpose of the scalability architecture is to ensure that RealtyAsk remains responsive, reliable, and cost-efficient as the platform grows.

Scalability is not limited to infrastructure.

The platform must scale across:

Users
Properties
Cities
Conversations
Intelligence
Knowledge
AI Usage
Traffic

without requiring fundamental architectural redesign.

212. Scalability Philosophy

Every scalability decision follows four principles.

Scale Horizontally Before Vertically

Whenever possible, increase application capacity by adding additional stateless instances instead of relying solely on larger servers.

Cache Before Compute

Avoid repeating expensive work.

If deterministic outputs already exist, reuse them.

Compute Before AI

Business logic should execute before invoking language models.

AI should only process information that genuinely requires reasoning or natural language generation.

Async Before Blocking

Long-running operations should execute in the background whenever immediate results are unnecessary.

213. Scalability Layers
                  Users
                    │
                    ▼
             Frontend Scaling
                    │
                    ▼
              API Scaling
                    │
                    ▼
          Decision Engine Scaling
                    │
                    ▼
          Knowledge Platform Scaling
                    │
                    ▼
            Infrastructure Scaling

Every layer scales independently.

214. User Growth Strategy

The platform should support progressive growth.

Stage	Monthly Active Users
MVP	100–500
Early Growth	5,000
Expansion	50,000
Scale	250,000+
National	1M+

The architecture should evolve incrementally rather than requiring complete rewrites.

215. Frontend Scaling

Frontend scaling is largely managed by Vercel.

Strategies include:

Static Generation.
Edge Caching.
Image Optimization.
Streaming Responses.
CDN Distribution.

Frontend servers should remain stateless.

216. Backend Scaling

Backend services scale horizontally.

            Load Balancer

          /      |      \

 Backend 1 Backend 2 Backend 3

Each instance should remain interchangeable.

Session state must never reside in application memory.

217. Database Scaling

PostgreSQL remains the authoritative source of truth.

Scaling strategy:

Phase 1

Single database instance.

Phase 2

Larger compute.

Improved indexes.

Query optimization.

Phase 3

Read replicas.

Analytics separation.

Background reporting database.

Phase 4

Partitioning where justified.

The application should remain unaware of database scaling decisions.

218. Redis Scaling

Redis exists purely as a performance layer.

Primary responsibilities:

Recommendation cache.
Builder summaries.
Conversation summaries.
Search cache.
Session cache.

Cache failures should never cause platform failures.

219. AI Cost Scaling

One of RealtyAsk' largest future costs will be AI.

The architecture minimizes unnecessary AI usage.

Strategies include:

Deterministic First

Search, filtering, ranking, calculations, and validation never require AI.

Prompt Optimization

Only relevant structured context is sent to models.

Response Caching

Previously generated summaries may be reused when appropriate.

Model Routing

Simple tasks may use smaller or faster models.

Complex reasoning uses larger models.

Streaming

Responses stream progressively to reduce perceived latency.

220. Knowledge Scaling

Knowledge grows continuously.

Growth dimensions include:

Cities.
Projects.
Builders.
Infrastructure.
Investment Intelligence.

The architecture separates knowledge ingestion from runtime serving, allowing the platform to expand without impacting user-facing performance.

221. Intelligence Scaling

Generated intelligence should not be recreated on every request.

Examples include:

Builder summaries.
Property summaries.
Investment insights.

Workflow:

Facts

↓

AI Generation

↓

Human Approval

↓

Knowledge Platform

↓

Cache

↓

Users

Generation occurs once.

Serving occurs many times.

222. Recommendation Scaling

Recommendations should remain performant regardless of catalogue size.

Pipeline:

Database

↓

Discovery

↓

Candidate Set

↓

Decision Engine

↓

Decision Package

↓

Cache

↓

Conversation

Only a small candidate set should reach the Decision Engine.

The entire catalogue should never be ranked for every request.

223. Search Optimization

Discovery should leverage:

Database indexes.
Structured filtering.
Query optimization.

Future enhancements may include:

Full-text search.
Semantic search.
Hybrid retrieval.

Deterministic filtering remains the primary mechanism.

224. Background Processing

Computationally expensive work should execute asynchronously.

Examples:

Knowledge enrichment.
Builder intelligence generation.
Cache warming.
Image processing.
Analytics aggregation.

User requests should never wait for these tasks.

225. Scaling the Knowledge Platform (The Moat)

This is the section I believe becomes the company's biggest competitive advantage.

The platform should gradually transition from manual knowledge creation to AI-assisted automation.

Stage 1 — Manual

Researcher collects information.

Researcher enters information.

Stage 2 — Assisted

Researcher collects information.

AI drafts structured intelligence.

Human reviews.

Human approves.

Stage 3 — Semi-Automated

Crawler identifies changes.

AI updates draft.

Reviewer approves only changed sections.

Stage 4 — Intelligent Automation

System detects updates.

System regenerates intelligence.

Confidence evaluated.

High-confidence updates publish automatically.

Low-confidence updates require review.

Stage 5 — Continuous Knowledge Platform
Sources

↓

Detection

↓

Normalization

↓

Validation

↓

Knowledge

↓

AI Intelligence

↓

Decision Engine

This pipeline allows RealtyAsk to scale from tens of properties to hundreds of thousands while maintaining quality.

226. Latency Targets

Target response times:

Feature	Target
Property Page	<500 ms
Search	<1 second
Recommendation	<2 seconds
AI Response (First Token)	<2 seconds
Calculator	<200 ms
Builder Page	<500 ms

Latency budgets should be monitored continuously.

227. Scalability Metrics

Engineering should monitor:

Active users.
Requests per second.
AI calls per minute.
Cache hit ratio.
Average recommendation latency.
Search latency.
Database query time.
Knowledge freshness.
Infrastructure utilization.

Metrics should drive optimization decisions.

228. Performance Principles

Every engineer should follow these rules:

Compute only what is necessary.
Cache deterministic outputs.
Avoid unnecessary AI calls.
Optimize queries before scaling hardware.
Keep services stateless.
Move expensive work to background jobs.
Stream responses whenever possible.
Measure before optimizing.
Scale incrementally.
Protect the Knowledge Platform as the primary asset.
229. Long-Term Scalability Vision

The architecture should eventually support:

Nationwide property coverage.
Millions of users.
Hundreds of thousands of projects.
Thousands of builders.
Multiple AI providers.
White-label deployments.
Mobile applications.
Partner integrations.

These capabilities should emerge through incremental evolution rather than wholesale redesign.


Part XIV — Observability & Monitoring Architecture
230. Purpose

Observability enables RealtyAsk engineers to understand the health, performance, reliability, and behavior of the platform in real time.

Unlike traditional monitoring, observability provides sufficient information to answer not only what failed, but also why it failed.

Every production service should be observable.

231. Observability Philosophy

RealtyAsk follows five principles.

Everything Important is Measured

Every important business operation should produce measurable telemetry.

Failures Should Explain Themselves

Engineers should never have to reproduce production issues to understand them.

Business Metrics Matter as Much as System Metrics

CPU usage alone does not indicate platform health.

Recommendation quality and lead conversion are equally important.

Correlation Across Services

Every request should be traceable throughout the platform.

AI is Observable

LLMs should never become opaque black boxes.

Every AI interaction should be measurable.

232. Observability Stack
                RealtyAsk

                     │

──────────────────────────────────────

        Structured Logging

──────────────────────────────────────

             Metrics

──────────────────────────────────────

             Tracing

──────────────────────────────────────

            Alerting

──────────────────────────────────────

 Dashboards & Visualization

Every layer complements the others.

233. Logging Strategy

Every important event produces structured logs.

Logs should never consist of arbitrary console output.

Every log includes:

Timestamp
Request ID
User ID (if authenticated)
Module
Event
Severity
Duration
Metadata

Logs should be machine-readable.

234. Log Categories
Application Logs

Examples

Search executed
Recommendation generated
Lead created
Infrastructure Logs

Examples

Database connection
Redis timeout
Deployment events
Security Logs

Examples

Failed login
Permission denied
Suspicious activity
AI Logs

Examples

Prompt version
Model selected
Token usage
Latency
Fallback triggered
Audit Logs

Examples

Builder edited
Pricing updated
Intelligence approved
235. Metrics

Metrics are numerical measurements collected over time.

Examples include:

API Metrics
Request count
Response time
Error rate
Database Metrics
Query latency
Active connections
Slow queries
Cache Metrics
Hit ratio
Miss ratio
Evictions
AI Metrics
Tokens
Cost
Latency
Retry count
Fallback usage
Product Metrics
Searches
Recommendations
Comparisons
Saved properties
Leads
Site visits
236. Distributed Tracing

Every request receives a unique Trace ID.

Example:

User

↓

Frontend

↓

API

↓

Conversation

↓

Discovery

↓

Decision Engine

↓

Knowledge

↓

Database

↓

Response

A single Trace ID follows the request across every service.

This enables engineers to reconstruct complete request lifecycles.

237. Health Checks

Every runtime component exposes health endpoints.

Examples:

/health

/ready

/live

Health checks validate:

Database connectivity.
Redis connectivity.
AI provider availability.
Storage access.
238. Alerting

Not every event deserves an alert.

Alerts should focus on actionable issues.

Examples:

Critical:

Database unavailable.
API unavailable.
Authentication failures.

Warning:

Elevated latency.
Cache miss spikes.
Increased AI cost.

Informational:

Deployment completed.
Scheduled refresh finished.
239. AI Observability

The AI subsystem requires dedicated monitoring.

Track:

Prompt version.
Model used.
Response latency.
Completion tokens.
Prompt tokens.
Cost.
Retry count.
Hallucination reports.
User satisfaction.

Every AI interaction should be reproducible.

240. Decision Engine Metrics

The Decision Engine should expose business-specific metrics.

Examples:

Average candidate count.
Ranking duration.
Personalization time.
Recommendation latency.
Recommendation acceptance rate.
Comparison usage.

These metrics indicate recommendation quality and performance.

241. Knowledge Platform Metrics

The Knowledge Platform should report:

Number of properties.
Builder coverage.
Knowledge freshness.
Pending approvals.
Intelligence generation backlog.
Validation failures.

These metrics measure the health of the platform's core asset.

242. Business Dashboards

Engineering dashboards are not enough.

Separate dashboards should exist for:

Engineering
Latency
Errors
Infrastructure
Product
DAU / WAU / MAU
Conversation completion
Recommendation acceptance
Feature usage
Sales
Leads
Site visits
Conversion
Broker response time
Knowledge Operations
Properties pending review
Builder updates
Intelligence approvals
Monthly refresh progress
243. AI Quality Evaluation

Unlike traditional software, AI quality must be measured continuously.

Evaluation criteria include:

Factual accuracy.
Grounding to knowledge.
Explanation quality.
Personalization quality.
Trade-off completeness.
User satisfaction.

This should become part of the platform's continuous improvement process.

244. Incident Monitoring

Every incident follows the same operational lifecycle.

Detection

↓

Alert

↓

Investigation

↓

Resolution

↓

Verification

↓

Postmortem

Major incidents should result in documented learnings and preventive actions.

245. Observability Principles

Every engineer should follow these principles:

If it matters, measure it.
Every request should be traceable.
Every AI interaction should be observable.
Prefer structured logs over free-form text.
Monitor business outcomes, not just infrastructure.
Alert only on actionable conditions.
Preserve auditability.
Continuously evaluate AI quality.
Use metrics to guide optimization.
Treat observability as part of the product.
246. The RealtyAsk Operational Dashboard

One dashboard should provide a real-time overview of platform health.

Suggested sections:

Platform
API uptime
Error rate
Latency
Active users
Knowledge
Total projects
Freshness score
Pending approvals
AI
Cost today
Average latency
Fallback rate
Decision Engine
Recommendations generated
Average recommendation time
Recommendation acceptance rate
Sales
Leads today
Site visits scheduled
Conversion funnel

This dashboard becomes the operational command center for the platform.


Part XV — Testing & Quality Assurance Architecture
247. Purpose

The testing architecture ensures that every component of the RealtyAsk platform behaves correctly, consistently, and reliably throughout its lifecycle.

Testing should verify:

Functional correctness
Architectural correctness
Performance
Reliability
Security
AI quality
Decision quality

Every release should be validated through automated and manual testing before reaching production.

248. Testing Philosophy

RealtyAsk follows five testing principles.

Test Business Logic Before UI

Business logic should be validated independently of presentation.

Deterministic Systems Must Be Fully Testable

Search, ranking, filtering, calculations, validation, and persistence should have predictable outputs.

AI Should Be Evaluated, Not Unit Tested

Language generation cannot be asserted character-for-character.

Instead, AI outputs should be evaluated against measurable criteria.

Automate Repetitive Validation

Anything repeatedly checked by engineers should eventually become automated.

Prevent Regressions

Every bug fixed should introduce a corresponding test to prevent future recurrence.

249. Testing Pyramid
                 End-to-End Tests
                       ▲
               Integration Tests
                       ▲
                 Unit Tests

The majority of tests should be unit tests, supported by integration tests and a smaller number of end-to-end scenarios.

250. Testing Layers

The platform is tested at multiple layers.

Layer	Purpose
Unit	Individual business logic
Integration	Domain interactions
API	Endpoint correctness
Database	Repository behavior
Frontend	Component behavior
End-to-End	Complete user journeys
Performance	Latency & throughput
Security	Vulnerability validation
AI Evaluation	Response quality
Decision Evaluation	Recommendation quality
251. Unit Testing

Every domain service should have dedicated unit tests.

Examples include:

Property Service

Property retrieval
Validation
Pricing logic

Search Service

Hard filters
Soft filters
Nearby expansion

Decision Engine

Ranking
Trade-off generation
Alternative selection

Calculator

EMI
GST
Stamp Duty

Unit tests should isolate business logic from infrastructure.

252. Integration Testing

Integration tests verify communication between domains.

Examples:

Search

↓

Decision Engine

↓

Knowledge Platform

Conversation

↓

Decision Engine

↓

AI Module

Lead

↓

User

↓

Notification

Integration tests should validate workflows rather than individual methods.

253. API Testing

Every API endpoint should be tested.

Validation includes:

Authentication
Authorization
Request validation
Response schema
Error responses
Rate limiting
Pagination

Public API contracts should remain stable.

254. Database Testing

Repository tests validate:

CRUD operations
Transactions
Index usage
Migrations
Constraints
Rollbacks

Database behavior should be tested independently from business logic.

255. Frontend Testing

Frontend validation includes:

Components

Rendering
Accessibility
User interaction

Pages

Navigation
Loading states
Error states
Empty states

Chat

Streaming
Recommendation cards
Comparison rendering

The frontend should never assume backend correctness.

256. End-to-End Testing

Critical buyer journeys should be tested from start to finish.

Examples:

Buyer Discovery

Landing Page

↓

Conversation

↓

Recommendation

↓

Property Page

↓

Save Property

Comparison Journey

Search

↓

Compare

↓

Decision

↓

Save

Lead Journey

Conversation

↓

Recommendation

↓

Site Visit

↓

Lead Created

These journeys represent the platform's core value proposition.

257. Performance Testing

Performance validation includes:

API latency
Search latency
Recommendation latency
AI response time
Database throughput
Cache efficiency

Performance regressions should be detected before deployment.

258. Security Testing

Security testing includes:

Authentication
Authorization
Input validation
Rate limiting
Injection attempts
Permission boundaries
Session handling

Security tests should become part of continuous integration.

259. AI Evaluation

Unlike traditional software, AI quality cannot be measured through exact output matching.

Instead, AI responses should be evaluated using defined criteria.

Examples:

Factual grounding
Recommendation explanation
Trade-off completeness
Tone consistency
Personalization
Hallucination detection

Evaluation should use representative conversation datasets.

260. Decision Evaluation ⭐

This is unique to RealtyAsk.

The Decision Engine should be evaluated independently of the language model.

Evaluation criteria include:

Were all eligible properties considered?
Was ranking deterministic?
Were hard constraints respected?
Were trade-offs identified?
Were nearby alternatives appropriate?

The Decision Engine should produce the same structured output for the same inputs.

261. Regression Testing

Every resolved defect should result in a regression test.

This ensures that previously fixed issues do not reappear in future releases.

Regression suites should run automatically during continuous integration.

262. Test Data Strategy

Testing should use controlled datasets.

Separate datasets should exist for:

Development
Integration
Performance
AI evaluation

Production data should never be copied into development without appropriate anonymization.

263. Release Validation Checklist

Every production release should validate:

TypeScript compilation
Linting
Unit tests
Integration tests
End-to-end tests
Database migrations
API compatibility
AI evaluation
Performance benchmarks
Security checks

No release should bypass mandatory validation.

264. Quality Metrics

Engineering should continuously monitor:

Test coverage
Build success rate
Deployment success rate
Defect rate
Regression rate
AI quality score
Decision quality score
Mean time to detect issues
Mean time to resolve issues

Quality should be measured over time rather than assessed subjectively.

265. Testing Principles

Every engineer should follow these rules:

Test business logic before UI.
Write deterministic tests for deterministic systems.
Evaluate AI instead of snapshot testing its responses.
Every bug requires a regression test.
Automate repetitive validation.
Test complete buyer journeys.
Measure performance continuously.
Security testing is mandatory.
Protect production through staged validation.
Quality is a shared engineering responsibility.
266. Definition of Done

A feature is considered complete only when:

Functional requirements are implemented.
Unit tests pass.
Integration tests pass.
API contracts are validated.
Performance targets are met.
Security validation passes.
AI evaluation (if applicable) is satisfactory.
Documentation is updated.
Code review is completed.
Deployment pipeline succeeds.

Implementation alone does not constitute completion.


Part XVI — Reliability, Failure Recovery & Resilience
267. Purpose

The reliability architecture ensures that RealtyAsk continues to operate correctly despite failures in infrastructure, external services, software, or user behavior.

Failures are considered inevitable.

The objective is to minimize their impact on users while enabling rapid recovery and continuous operation.

268. Reliability Philosophy

RealtyAsk follows five reliability principles.

Assume Failure

Every dependency should be assumed to fail eventually.

Examples:

Database
AI providers
Redis
Storage
Network
Third-party APIs

The platform should be prepared before failures occur.

Graceful Degradation

Loss of one capability should not disable the entire platform.

Examples:

AI unavailable.

↓

Search continues.

Calculators continue.

Property pages continue.

Only conversational explanations degrade.

Recover Automatically

Whenever possible, systems should recover without manual intervention.

Fail Predictably

Unexpected failures are worse than expected failures.

Users should always receive understandable responses.

Learn From Every Failure

Every production incident should improve the platform.

269. Reliability Architecture
                  Request

                     │

                     ▼

              Domain Services

                     │

        ┌────────────┼────────────┐

        ▼            ▼            ▼

    PostgreSQL     Redis      AI Gateway

        ▼            ▼            ▼

    Recovery      Recovery     Recovery

        └────────────┼────────────┘

                     ▼

             Graceful Response

Every dependency has an independent recovery strategy.

270. Failure Categories

Failures are grouped into standard categories.

User Failures

Examples:

Invalid inputs.
Missing information.
Expired sessions.

Response:

Clear guidance.

Never expose technical errors.

Business Failures

Examples:

No matching properties.
Builder unavailable.
Project archived.

Response:

Nearby recommendations.

Alternative suggestions.

Infrastructure Failures

Examples:

PostgreSQL unavailable.
Redis unavailable.
Storage unavailable.

Response:

Retry where appropriate.

Otherwise degrade gracefully.

External Failures

Examples:

OpenAI unavailable.
Google Maps unavailable.

Response:

Fallback provider.

Cached data.

Template responses.

Internal Failures

Examples:

Software bugs.
Unexpected exceptions.
Memory exhaustion.

Response:

Structured error.

Logging.

Alerting.

Recovery.

271. AI Failure Strategy

The AI subsystem should never become a single point of failure.

Recovery order:

Primary Model

↓

Fallback Model

↓

Cached Intelligence

↓

Deterministic Response

↓

User

Users should continue receiving useful responses even if conversational quality temporarily decreases.

272. Database Failure Strategy

The database is the operational source of truth.

Protection includes:

Automated backups.
Connection pooling.
Health monitoring.
Readiness checks.

If PostgreSQL becomes unavailable:

Reject write operations.
Surface a friendly maintenance message where necessary.
Prevent inconsistent state.

The platform should never invent or approximate missing factual data.

273. Redis Failure Strategy

Redis is optional.

If Redis fails:

Redis Miss

↓

PostgreSQL

↓

Response

Performance may decrease.

Correctness must remain unchanged.

274. External Provider Failures

Examples include:

Google Maps
OpenAI
Future integrations

Each provider should have:

Timeout limits.
Retry strategy.
Circuit breaker.
Health monitoring.

Provider failures should remain isolated.

275. Circuit Breakers

Repeated failures should temporarily disable unhealthy dependencies.

Example:

OpenAI

↓

Repeated Timeouts

↓

Circuit Opens

↓

Requests Routed to Fallback

↓

Health Recovery

↓

Circuit Closes

This prevents cascading failures.

276. Retry Strategy

Retries should be selective.

Suitable for:

Temporary network failures.
AI timeouts.
Storage operations.

Not suitable for:

Invalid requests.
Business validation failures.
Authentication failures.

Retries should use exponential backoff.

277. Idempotency

Critical write operations should support idempotency.

Examples:

Callback request.
Site visit booking.
Saved property.
Payment integrations (future).

Duplicate submissions should not create duplicate records.

278. Data Recovery

Recovery procedures include:

Database restoration.
Storage restoration.
Cache rebuilding.
Configuration restoration.

Recovery objectives should be documented and tested periodically.

279. Availability Targets

Suggested V1 targets:

Service	Target
Frontend	99.9%
Backend APIs	99.9%
PostgreSQL	Managed SLA
AI Gateway	Best effort with fallback
Knowledge Platform	99.9%

Availability should improve as the platform matures.

280. Incident Management

Every production incident follows a structured lifecycle.

Detection

↓

Classification

↓

Mitigation

↓

Recovery

↓

Verification

↓

Postmortem

↓

Improvement

Postmortems should focus on learning rather than blame.

281. Business Continuity

During major incidents, RealtyAsk should prioritize core buyer capabilities.

Priority order:

Property Search
Property Details
Decision Engine
Conversation
Comparisons
Leads
Analytics

Lower-priority capabilities may be temporarily disabled if necessary.

282. Disaster Recovery

Recovery planning should consider:

Regional outages.
Cloud provider failures.
Database corruption.
Storage loss.
Credential compromise.

Recovery procedures should be rehearsed periodically.

283. Resilience Testing

Reliability should be validated continuously.

Examples:

AI provider outage simulation.
Redis failure simulation.
Database failover testing.
High latency testing.
Network interruption testing.

Systems should be tested under failure, not just success.

284. Reliability Metrics

Engineering should monitor:

Availability.
Error rate.
Recovery time.
Retry frequency.
Fallback usage.
AI outage duration.
Incident count.
Mean Time To Detect (MTTD).
Mean Time To Recover (MTTR).

Reliability should be measured continuously.

285. Reliability Principles

Every engineer should follow these rules:

Design assuming dependencies will fail.
Fail gracefully rather than catastrophically.
Protect correctness over performance.
Prefer automatic recovery.
Keep failures isolated.
Never fabricate missing data.
Test recovery procedures.
Learn from incidents.
Maintain user trust during failures.
Reliability is a feature, not an afterthought.


Part XVII — Engineering Standards & Development Guidelines
286. Purpose

This chapter defines the engineering standards that govern the development of the RealtyAsk platform.

Its objective is to ensure consistency, maintainability, scalability, and long-term code quality across all modules.

Every engineer contributing to RealtyAsk should follow these standards unless a documented architectural decision explicitly states otherwise.

287. Engineering Philosophy

RealtyAsk engineering follows one principle:

Write software that another engineer can confidently modify six months later.

Code is read far more often than it is written.

Maintainability therefore takes precedence over cleverness.

288. Engineering Principles

Every engineering decision should satisfy these principles.

Simplicity

Prefer the simplest solution that satisfies the requirements.

Consistency

Follow established patterns rather than introducing new ones.

Readability

Code should communicate intent clearly.

Modularity

Business capabilities evolve independently.

Testability

Every business rule should be testable.

Explainability

Every important decision should be understandable by another engineer.

289. Project Structure

RealityPals follows a domain-first organization.

backend/

modules/

shared/

infrastructure/

frontend/

modules/

shared/

app/

New features should extend existing domains before introducing new ones.

290. Naming Conventions

Consistency in naming improves readability.

Files
property.service.ts

builder.repository.ts

search.controller.ts
Classes
PropertyService

SearchRepository

DecisionEngine
Interfaces
PropertyRepository

SearchProvider
Constants
MAX_RECOMMENDATIONS

DEFAULT_RADIUS

CACHE_TTL
Variables
camelCase
Types
PascalCase
291. Folder Standards

Each domain follows the same structure.

module/

controller/

service/

repository/

validator/

mapper/

dto/

types/

events/

tests/

No module should invent its own internal structure.

292. Controller Guidelines

Controllers should:

Validate requests.
Authenticate users.
Call orchestrators or services.
Return responses.

Controllers should never:

Query Prisma directly.
Perform ranking.
Contain AI logic.
Execute business rules.
293. Service Guidelines

Services own business behavior.

Services may:

Validate business rules.
Coordinate repositories.
Call other services.
Publish events.

Services should not:

Access HTTP objects.
Format API responses.
Build prompts.
Render UI.
294. Repository Guidelines

Repositories own persistence.

Repositories may:

Read.
Write.
Query.
Execute transactions.

Repositories should never:

Calculate.
Rank.
Validate business rules.
Call AI.
295. DTO Guidelines

Every public API uses DTOs.

Never expose:

Prisma entities.
Internal database structure.
Hidden metadata.

DTOs should remain stable even if persistence changes.

296. AI Guidelines

Artificial Intelligence should:

Explain.
Summarize.
Clarify.
Educate.

Artificial Intelligence should never:

Invent facts.
Rank properties.
Bypass domain services.
Access databases directly.

Prompt templates should be version-controlled and reviewed like source code.

297. Database Guidelines

Database rules include:

Prisma only.
Migrations only.
No manual production edits.
Repository ownership respected.
Soft deletes preferred for business entities.
Foreign keys enforced where appropriate.

Every schema change requires peer review.

298. Error Handling Standards

Errors should be:

Predictable.
Structured.
Logged.
User-friendly.

Avoid generic exceptions where specific domain errors communicate intent more clearly.

299. Logging Standards

Logging should answer:

What happened?
Where?
When?
Why?
How long did it take?

Sensitive information should never be written to logs.

300. Git Workflow

Recommended workflow:

main

↓

develop

↓

feature/*

↓

pull request

↓

review

↓

merge

Every change should be traceable to a reviewed pull request.

301. Pull Request Standards

Every pull request should include:

Problem statement.
Proposed solution.
Screenshots (if UI).
Testing evidence.
Documentation updates.
Linked issue or task.

Small, focused pull requests are preferred over large multi-feature changes.

302. Code Review Checklist

Reviewers should verify:

Architectural alignment.
Business correctness.
Test coverage.
Security implications.
Performance considerations.
Readability.
Documentation.

The goal of review is knowledge sharing and quality improvement—not gatekeeping.

303. Documentation Standards

Major changes should update relevant documentation.

Documents include:

PRD (when product behavior changes).
TDD (when architecture changes).
KDS (when schema changes).
ISD (when intelligence changes).

Documentation is part of the feature, not an optional task.

304. Architecture Decision Records (ADRs)

Significant architectural decisions should be captured as ADRs.

Each ADR should record:

Context.
Decision.
Alternatives considered.
Consequences.
Date.
Owner.

This preserves architectural history and reasoning.

305. Code Quality Gates

No code should merge unless it passes:

TypeScript compilation.
Linting.
Unit tests.
Integration tests.
Security checks.
Code review.

Quality gates should be automated through CI.

306. Dependency Management

Third-party dependencies should be:

Actively maintained.
Well documented.
Security reviewed.
Justified.

Avoid adding libraries that duplicate existing functionality.

307. Technical Debt

Technical debt should be visible.

Examples:

TODOs linked to issues.
Refactoring backlog.
Deprecated APIs.

Debt should be intentional, documented, and prioritized—not ignored.

308. Engineering Culture

RealityPals engineering values:

Ownership.
Curiosity.
Documentation.
Collaboration.
Continuous improvement.
Constructive feedback.
Long-term thinking.

Engineering decisions should optimize for the longevity of the platform rather than short-term convenience.

309. Definition of Engineering Excellence

An engineer working on RealtyAsk should strive to produce software that is:

Correct.
Reliable.
Secure.
Observable.
Performant.
Maintainable.
Explainable.
Well documented.

Success is measured not only by shipped features, but also by the ease with which future engineers can understand, extend, and operate the platform.


Part XVIII — Future Architecture & Evolution
310. Purpose

The Future Architecture defines the long-term evolution of the RealtyAsk platform beyond Version 1.

Its objective is to ensure that today's architectural decisions enable tomorrow's capabilities without requiring fundamental redesign.

The platform should evolve through incremental improvements while preserving its core architectural principles.

311. Long-Term Vision

RealtyAsk does not aspire to become another listings portal.

Its long-term vision is to become:

The world's most trusted Decision Intelligence Platform for real estate.

The platform should evolve from:

Property Discovery

↓

Property Intelligence

↓

Decision Intelligence

↓

Real Estate Intelligence Platform

Over time, the focus shifts from helping buyers find homes to helping them make confident property decisions.

312. Evolution Principles

Every future capability should satisfy the following principles.

Preserve Architectural Boundaries

New capabilities extend existing domains rather than bypassing them.

Extend the Knowledge Platform

Every feature should contribute to the Knowledge Platform rather than creating isolated data silos.

Reuse Existing Engines

The Conversation Engine, Decision Engine, and Knowledge Platform should support new features through extension rather than duplication.

Maintain Explainability

As the platform becomes more intelligent, recommendations should remain transparent and explainable.

313. Geographic Expansion

V1 focuses on:

Noida

Future expansion may follow:

Noida

↓

Delhi NCR

↓

Tier-1 Cities

↓

Pan India

↓

International Markets

Every city should integrate into the existing Knowledge Platform rather than introducing city-specific architectures.

314. Knowledge Platform Evolution

The Knowledge Platform should expand beyond projects and builders.

Future domains include:

Developers
Brokers
Banks
Loan Products
Government Policies
Infrastructure Projects
Legal Processes
Interior Designers
Home Insurance
Property Management Services

The platform gradually becomes a comprehensive real estate knowledge graph.

315. The Knowledge Factory

The Knowledge Factory evolves into a continuously operating intelligence pipeline.

External Sources

↓

Change Detection

↓

Knowledge Collection

↓

Normalization

↓

Validation

↓

Knowledge Platform

↓

AI Intelligence

↓

Human Review

↓

Continuous Improvement

The objective is to reduce manual work while maintaining high trust.

Eventually, most updates should require human review rather than manual creation.

316. AI Evolution

The role of AI should expand gradually.

V1

Conversation.

Explanation.

Clarification.

V2

Investment reasoning.

Builder comparisons.

Lifestyle recommendations.

V3

Personal property advisor.

Financial planning.

Long-term portfolio guidance.

Future

Continuous buyer assistance throughout the property ownership lifecycle.

Despite increasing intelligence, AI should always remain grounded in verified knowledge.

317. Decision Engine Evolution

The Decision Engine evolves through increasingly sophisticated reasoning.

Future capabilities include:

Investment optimization.
Family suitability scoring.
Commute optimization.
Future infrastructure impact.
Risk analysis.
Affordability forecasting.
Personalized buying strategies.

The engine remains deterministic wherever possible.

318. White-Label Platform

RealtyAsk should support white-label deployments.

Example:

Developer A Portal

↓

Same Backend

↓

Same Knowledge Platform

↓

Customized Branding

↓

Developer-specific Inventory

The core platform remains shared while allowing branding, themes, inventory visibility, and workflows to be customized per partner.

319. Builder Platform

Future builder capabilities include:

Inventory management.
Project updates.
Lead dashboards.
Site visit management.
Intelligence insights.
Buyer analytics.

Builder-facing functionality should remain separate from buyer-facing experiences.

320. Broker Ecosystem

Future broker capabilities may include:

Lead assignment.
Follow-up tracking.
Visit scheduling.
Customer notes.
Conversion analytics.

Broker workflows should integrate with existing Lead and Conversation domains.

321. Mobile Applications

Future native applications include:

Buyer App

Search.
Conversation.
Saved properties.
Notifications.

Builder App

Lead management.
Site visits.
Inventory updates.

Admin App

Operational monitoring.
Intelligence approvals.
Knowledge management.

All applications consume the same backend services.

322. API Ecosystem

Future external integrations may include:

Banking APIs.
Loan marketplaces.
Legal verification providers.
Property registration systems.
Government services.
Third-party CRMs.

External integrations should consume stable public APIs rather than accessing internal services.

323. Event-Driven Evolution

As the platform grows, certain workflows may transition from synchronous operations to event-driven processing.

Examples:

Property Updated

↓

Knowledge Refresh

↓

Builder Intelligence Update

↓

Recommendation Cache Refresh

↓

Analytics Update

This improves scalability without requiring a full microservice migration.

324. Microservice Extraction Strategy

The initial architecture is a Domain-Driven Modular Monolith.

Modules should only become independent services when justified by measurable operational needs.

Potential extraction candidates:

Conversation Service.
AI Gateway.
Knowledge Factory.
Search Service.
Notification Service.

Extraction should be driven by scale rather than trends.

325. Platform Intelligence

The platform should continuously learn from aggregate outcomes.

Examples:

Which recommendations are accepted.
Which builders convert best.
Which explanations improve buyer confidence.
Which trade-offs influence decisions.

Learning should improve future recommendations without compromising user privacy.

326. International Expansion

Future international support may include:

Multiple currencies.
Local regulations.
Country-specific tax rules.
Regional property standards.
Multilingual experiences.

Localization should extend existing domain models rather than creating parallel systems.

327. Engineering Evolution

As the engineering team grows, the platform should introduce:

Architecture governance.
Domain ownership.
Platform engineering.
Dedicated Knowledge Operations.
AI Operations.
Reliability Engineering.

Organizational evolution should mirror architectural evolution.

328. Future-Proofing Principles

Every architectural decision should satisfy these questions:

Can this support another city?
Can this support another million users?
Can this support another AI provider?
Can this support another client application?
Can this support another business model?

If the answer is consistently "yes," the architecture is evolving successfully.

329. The RealtyAsk End State

The long-term platform can be visualized as:

                   RealtyAsk Platform

                           │

        ┌──────────────────┼──────────────────┐

        ▼                  ▼                  ▼

Knowledge Factory    Decision Engine    Conversation Engine

        │                  │                  │

        └──────────────────┼──────────────────┘

                           ▼

                 Buyer Experience Layer

        ┌──────────────┬──────────────┬──────────────┐

        ▼              ▼              ▼

     Web App      Mobile Apps     White-Label Apps

                           │

        ┌──────────────┬──────────────┬──────────────┐

        ▼              ▼              ▼

     Buyers        Builders        Partners

This architecture supports multiple products while preserving a single operational platform.

330. Architectural Vision Statement

The architecture of RealtyAsk exists to achieve one objective:

To transform fragmented real estate information into trusted decision intelligence that helps every homebuyer make better property decisions.

Every subsystem—whether the Knowledge Factory, Decision Engine, Conversation Engine, or future platforms—exists to support this mission.

The architecture should evolve continuously, but this objective should remain constant.
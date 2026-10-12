# RealtyAsk — Architecture

## Technology Stack

### Frontend

* Next.js App Router
* React
* TypeScript
* Tailwind CSS
* shadcn/ui

### Backend

* Next.js Route Handlers
* Server Actions

### Database

* PostgreSQL
* Prisma

### Authentication

* Better Auth

### Storage

* Supabase Storage

### Analytics

* PostHog

### Maps

* Google Maps

### AI

Primary:

* OpenAI

Fallback:

* Groq

---

## System Layers

### Presentation Layer

Responsibilities:

* UI rendering
* User interaction
* Form collection

Must not contain business logic.

---

### Application Layer

Responsibilities:

* Orchestration
* Feature workflows
* User actions

Examples:

* Property search flow
* Lead generation flow
* Recommendation flow

---

### Service Layer

Responsibilities:

* Business rules
* AI orchestration
* Recommendation logic

---

### Data Layer

Responsibilities:

* Prisma access
* Queries
* Persistence

---

## Core Modules

### AI Advisor

Handles:

* User conversations
* Requirement extraction
* Recommendation generation

---

### Property Module

Handles:

* Property data
* Project details
* Search

---

### Lead Module

Handles:

* Callback requests
* Site visits
* WhatsApp handoff

---

### User Module

Handles:

* Authentication
* Saved properties
* History

---

## Architectural Rules

* Business logic must not live in UI.
* Database access must be centralized.
* Validation must happen at boundaries.
* API contracts must be typed.
* Prefer composition over inheritance.

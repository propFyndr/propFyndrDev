# RealtyAsk — Database Model

## Builder

Represents a real estate developer.

Fields:

* id
* name
* description
* foundedYear
* headquarters
* deliveredProjects
* ongoingProjects
* createdAt
* updatedAt

---

## Project

Represents a residential development.

Fields:

* id
* builderId
* name
* address
* city
* location
* reraNumber
* possessionDate
* possessionStatus
* projectStatus
* createdAt
* updatedAt

---

## Property

Represents a purchasable unit.

Fields:

* id
* projectId
* unitType
* bedrooms
* bathrooms
* carpetArea
* superArea
* priceMin
* priceMax
* inventoryStatus

---

## FloorPlan

Fields:

* id
* propertyId
* imageUrl
* carpetArea
* superArea

---

## Area

Fields:

* id
* name
* city
* metroDistance
* schools
* hospitals
* highlights
* concerns

---

## User

Fields:

* id
* name
* email
* phone
* preferences
* createdAt

---

## Conversation

Fields:

* id
* userId
* createdAt

---

## Message

Fields:

* id
* conversationId
* role
* content
* createdAt

---

## Shortlist

Fields:

* id
* userId
* propertyId

---

## Lead

Fields:

* id
* userId
* source
* status
* assignedTo

---

## CallbackRequest

Fields:

* id
* userId
* propertyId
* preferredTime

---

## SiteVisitRequest

Fields:

* id
* userId
* propertyId
* visitDate

---

## PropertyView

Fields:

* id
* userId
* propertyId
* viewedAt

---

## AuditLog

Fields:

* id
* actorId
* action
* metadata
* timestamp

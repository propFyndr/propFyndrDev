# Sector Intelligence for Local Businesses — parked idea

**Status:** parked 2026-10-11. Not V1 (commercial is out of V1 scope). Revisit after the referral-tracking feature ships.

## Origin

A restaurant franchise owner (pan-India) offered to pay for sector / area intelligence before opening the next outlet: who lives in an area, how many, what kind of households, and what is coming.

## Insight

For every local business (restaurants, gyms, preschools, clinics, salons, retail, D2C), residents are the audience. Collecting that data on the ground is their biggest cost. We already hold part of it.

## What we can state today (from our own rows)

| Insight | Source | Tier |
|---|---|---|
| Upcoming households per year (12/24/36 months) | Unit counts + possession dates | verified / computed |
| Household-type mix: 1–2BHK (small households, young professionals) vs 3–4BHK (families) | `UnitType` rows | computed proxy — say "small-household profile", never "bachelors" |
| Affluence proxy | Price per sqft, ticket size | computed proxy, not income |
| Metro / infrastructure access | Project rows + Maps | verified |
| Incoming demand: budget band, BHK sought, sectors asked about | Buyer chats, aggregated | computed, min cell size |
| Competitor density, ratings, price level | Google Places (paid — cache + rate-limit) | external |

## What we do not hold — and honest ways to get it

**Occupancy** (delivered ≠ occupied; new towers sit half-empty for years):
- Builders report handovers (fits the planned verified supply chain).
- RWA / maintenance agencies (partnership or paid).
- Night-time lit-window counts per tower (cheap, legal, standard practice).
- Rental-listing volume as tenant-share proxy.
- Model from years-since-possession — only as a labelled estimate (market tier).

**Coverage:** Noida / Greater Noida West only. A national client cannot get national coverage from us.

## Rules

- **Aggregates only. Never individual user data.** No figure built on fewer than ~20 users (re-identification risk).
- Every number carries its tier: measured, estimated, proxy.
- Privacy policy mentions use of aggregated insights.
- One lawyer review (DPDP Act 2023, derived/anonymised data) before the first paid report — uncertain where the line sits.

## Buyers

Restaurants, gyms, preschools, clinics, salons, retail chains, D2C brands — and **builders**, for whom "unmet demand by sector" (e.g. 40 buyers asked for 3BHK under ₹1.2 Cr in Sector 150; zero projects match) is the most valuable cut and fits the core product.

## Recommended first step

Manual, fixed-fee one-page **Sector Profile** for the 2–3 Noida/GNW sectors the restaurant client is considering. Built by hand from catalogue + Places. Productise only when a second buyer asks.

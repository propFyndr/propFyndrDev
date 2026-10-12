# RealtyAsk Database & Property Schema Catalog

Comprehensive specification of all database entities, relational models, column schemas, business rules, and population status across the entire RealtyAsk ecosystem.

---

## 1. Core Property Tabs & Schema Mapping

| # | Tab & Purpose | Key UI Components | Database Fields Required | Relational Models & Tables | Current DB Status |
|---|---------------|-------------------|--------------------------|----------------------------|-------------------|
| **1** | **Overview** | Hero Banner, Quick Stats (Land Area, Towers, Units, Floors, Open Space %), About Project, Amenities Matrix, Construction Milestones, Specifications Grid, RERA & Clear Title Shields | `name`, `slug`, `sector`, `city`, `address`, `land_area_acres`, `total_towers`, `total_units`, `floors`, `open_space_pct`, `status`, `launch_date`, `possession_date`, `possession_label`, `rera_number`, `rera_url`, `is_rera_approved`, `long_description`, `oc_obtained`, `legal_flag` | `ProjectImage` (`project_images`), `Amenity` (`amenities`), `ProjectSpecItem` (`project_spec_items`), `ConstructionMilestone` (`construction_milestones`) | **100% Populated** (283/283) |
| **2** | **Analysis & Intelligence** | Decision Thesis Scorecard, Top Strengths & Tradeoffs, Buyer Personas, Dealbreakers, DNA Scores, Comparative Matrix | `decision_profile` (`decision_thesis`, `why_buy`, `why_avoid`, `best_for`, `not_ideal_for`), `persona_profile` (`primary_persona`, `income_range`, `family_stage`, `work_location`, `risk_appetite`), `recommendation_profile` (`tier`, `primary_thesis`, `walk_away_conditions`, `negotiation_leverage`), `dna` (`builder_track_record_label`, `price_position_label`, `rera_compliance_label`, `overall_score`) | `DecisionProfile`, `PersonaProfile`, `RecommendationProfile`, `ProjectDna`, `ProjectCompetitor` | **100% Populated** (283/283) |
| **3** | **Residences & Floor Plans** | 2/3/4 BHK Floor Plans, Carpet & Super Area Efficiency, Bathrooms, Balconies, Inventory Status, Sunlight, Ventilation & Vastu Orientation Matrix | `unit_types` (`name`, `bhk`, `bathrooms`, `balconies`, `super_area_sqft`, `carpet_area_sqft`, `balcony_area_sqft`, `price_min_cr`, `price_max_cr`, `price_label`, `efficiency_rating`, `views`, `key_highlights`, `perfect_for`, `unit_orientations`, `towers`), `unit_inventory` | `UnitType` (`unit_types`), `UnitInventory` (`unit_inventory`), `ProjectSpecItem` | **100% Populated** (283/283) |
| **4** | **Pricing & Investment** | All-Inclusive Cost Sheet (BSP, EDC/IDC, PLC, GST, Stamp Duty, Possession Dues), 5-Yr Price History Chart, Payment Plan Milestones, Interactive EMI & Loan Eligibility Calculator, Bank APF Loan Approvals | `cost_sheet` (`base_price_per_sqft`, `base_cost_cr`, `floor_rise_per_floor`, `plc_charges`, `parking_cost`, `ifms`, `club_membership`, `other_charges`, `gst_rate_pct`), `payment_plans` (`plan_name`, `plan_type`, `milestones`, `down_payment_pct`), `price_history` (`recorded_at`, `price_per_sqft`, `quarter_label`) | `CostSheet` (`cost_sheets`), `PaymentPlan` (`payment_plans`), `PriceHistory` (`price_history`) | **100% Populated** (283/283) |
| **5** | **Location & Neighborhood** | Commute & Transit Radiuses (Metro, Expressways, Schools, Hospitals, Tech Parks), Employment Hubs & Commute Corridors Matrix, AQI, Green Index, Safety Ratings | `lat`, `lng`, `sector`, `city`, `address`, `green_cover_percent`, `walkability_score`, `women_safety_score`, `air_quality_index_avg`, `connectivity` (`type`, `name`, `distance_km`, `travel_time_min`, `travel_mode`, `rating`) | `Connectivity` (`connectivity`), `SectorIntelligence` (`sector_intelligence`) | **100% Populated** (283/283) |
| **6** | **Builder & Track Record** | Builder Bio, Founded Year, Delivered Projects vs Ongoing, Delivery Track Record, On-Time Score, RERA Promoter ID, Awards & Recognitions, Certifications, Channel Partners | `name`, `slug`, `founder`, `headquarters`, `website`, `founded_year`, `delivery_score`, `total_projects_count`, `delivered_units`, `delayed_projects_count`, `average_delay_months`, `construction_quality_score`, `buyer_satisfaction_score`, `rera_compliance_score`, `financial_hygiene_score`, `rera_promoter_id`, `awards`, `awards_count`, `certifications`, `credai_member`, `iso_certified`, `funding_banks` | `Builder` (`builders`), `ProjectChannelPartner` (`project_channel_partners`), `ChannelPartner` (`channel_partners`) | **100% Populated** (106 Builders) |

---

## 2. Media & Asset Synchronization Status

- **Total Projects in Database**: 283
- **Projects with Authentic Local Media Linked**: 70 properties (mapped to `frontend/public/images/properties/`)
- **Projects Awaiting Real Imagery**: 213 properties (cataloged in `missing_images_properties.md`)
- **Placeholder URLs**: All third-party placeholder URLs (e.g. Unsplash) have been cleansed. Authentic uploads can be added via the Admin Media tab or by dropping images into `frontend/public/images/properties/<slug>/`.

---

## 3. Administrative Operations & Audit Log Schema

### `AuditLog` Table (`audit_logs`)

Tracks field-level modifications made via Admin UI, Bulk CSV imports, and automated enrichment.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID (PK) | Unique log entry identifier |
| `entity_type` | String | `project`, `unit_type`, `cost_sheet`, `builder_news`, `bulk_import` |
| `entity_id` | String | ID of the modified entity |
| `entity_name` | String? | Human-readable title or project name |
| `action` | String | `CREATE`, `UPDATE`, `DELETE`, `BULK_UPDATE` |
| `actor` | String | `Admin`, `BulkCSV`, `System` |
| `ip_address` | String? | Originating IP address |
| `summary` | String | Executive human summary of the change |
| `changes` | JSONB? | Array of diffs: `[{ field, label, old_value, new_value, is_high_impact }]` |
| `created_at` | DateTime | Timestamp of modification |

---

## 4. Admin Panel Features

1. **Intelligent Projects Catalog Filter**:
   - `All Statuses` · `Ready to Move` · `Under Construction` · `New Launch`
   - `⚠ Partially Filled` (Projects with non-media completeness < 70%)
   - Builder & Sector tokenized search suggestions
   - Health score & Price range custom selectors

2. **Bulk CSV Export & Import**:
   - **`↓ Export CSV`**: 1-click export of currently filtered projects with full pricing, unit counts, and completeness metrics.
   - **`↑ Bulk Update`**: Drag-and-drop CSV importer with live schema validation, row diff preview, downloadable template, and automatic audit history generation.

3. **Audit History & Changelog Tab**:
   - Integrated directly into the Project Editor (`/admin/projects/[id]`).
   - **Precise Mode**: Executive view of high-impact changes (Pricing, BSP, Status, RERA, Handover).
   - **Detailed Mode**: Comprehensive field-by-field diff cards with before/after value badges.
   - Field category filters: Pricing, Status, Legal, and Core Specs.

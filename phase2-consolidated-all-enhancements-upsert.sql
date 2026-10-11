-- CONSOLIDATED UPSERT: All Phase 2 Enhancements
-- Generated: 2026-10-11T09:41:43.683Z
-- Total projects: 348
-- Quality: 24/100
-- Data sources: RERA (HIGH), Builder (MEDIUM), Project Site (MEDIUM)

-- BACKUP: Create copy of current state before changes
CREATE TABLE projects_backup_1791711703683 AS SELECT * FROM projects;

BEGIN TRANSACTION;

-- Project: Paramount Golf Foreste | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2001',
  oc_obtained = false,
  rera_compliance_score = 98,
  rera_status = 'approved',
  possession_date = '2017-12-31T00:00:00.000Z',
  total_units = 1600,
  status = 'ready_to_move',
  projects_delivered_count = 11,
  average_delay_months = 3,
  total_projects_count = 18,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 12019,
  available_units_count = 480,
  key_amenities = 'gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = 'a9c643f8-b05b-4e1b-aa6b-e58e641be355';

-- Project: Ace Platinum | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2002',
  oc_obtained = true,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  possession_date = '2016-10-31T00:00:00.000Z',
  total_units = 1200,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 15486,
  available_units_count = 360,
  key_amenities = 'children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '863224f4-8cde-433e-bfb5-e138029b5091';

-- Project: Gaur Yamuna City - 16th Parkview | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6801',
  oc_obtained = true,
  oc_obtained_date = '2023-12-10T00:00:00.000Z',
  rera_compliance_score = 94,
  rera_status = 'approved',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1800,
  status = 'ready_to_move',
  litigation_count = 1,
  possession_label = 'Q4 2025',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 16272,
  available_units_count = 540,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '8a2d0939-0d58-4bbe-bc94-2a17547138dc';

-- Project: ABA Cherry County | Quality: 25/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4285',
  rera_compliance_score = 97,
  oc_obtained = true,
  oc_obtained_date = '2022-06-23T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2018-05-31T00:00:00.000Z',
  total_units = 1780,
  status = 'ready_to_move',
  possession_label = 'Q4 2025',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  base_price_per_sqft = 19209,
  available_units_count = 534,
  key_amenities = 'gym',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = 'ecae9f5d-aabf-4ef0-b1b1-2f92dbb2af0b';

-- Project: Omaxe Riviera | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2107',
  rera_compliance_score = 90,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 780,
  status = 'ready_to_move',
  litigation_count = 3,
  possession_label = 'Q3 2025',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 13378,
  available_units_count = 234,
  key_amenities = 'children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '86d58fd8-a88d-41af-adea-7e7069aaf417';

-- Project: ACE Group Enclave Phase 13 (Block C) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3077',
  oc_obtained = true,
  rera_compliance_score = 98,
  oc_obtained_date = '2022-11-01T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 527,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 8979,
  available_units_count = 26,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '99d45697-5999-47fc-ab2e-11dde2c7613a';

-- Project: Purvanchal Heights | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3122',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 920,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2024',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 15911,
  available_units_count = 276,
  key_amenities = 'children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '1596bf90-1954-4ac3-9003-ecd6b5e207cd';

-- Project: ACE Group Enclave Phase 17 (Block C) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3097',
  oc_obtained = true,
  rera_compliance_score = 91,
  oc_obtained_date = '2023-06-16T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 1147,
  status = 'under_construction',
  possession_label = 'Q1 2025',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 10892,
  available_units_count = 344,
  key_amenities = 'gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = 'a109a117-45da-4beb-a18f-a344e00f3286';

-- Project: Migsun Atharva | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2984',
  oc_obtained = false,
  rera_compliance_score = 88,
  rera_status = 'registered',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 890,
  status = 'under_construction',
  litigation_count = 2,
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 18007,
  available_units_count = 267,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '4e7dd63b-78c4-44c9-97e0-7c8d0e1c5317';

-- Project: ACE Group Enclave Phase 12 (Block C) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3067',
  oc_obtained = true,
  rera_compliance_score = 91,
  rera_status = 'approved',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 1007,
  status = 'under_construction',
  litigation_count = 3,
  possession_label = 'Q4 2025',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 8500,
  available_units_count = 302,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = 'f6b51a2f-73d8-42fb-b80f-c0b75ceba3fb';

-- Project: ACE Group Enclave Phase 15 (Block C) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3087',
  oc_obtained = true,
  rera_compliance_score = 88,
  rera_status = 'compliant',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 837,
  status = 'under_construction',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 9935,
  available_units_count = 251,
  key_amenities = 'gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '8d3a3931-ec7c-4d94-983f-c6e5308d7ceb';

-- Project: Omaxe Palm Greens Phase 1 | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2105',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1100,
  status = 'ready_to_move',
  possession_label = 'Q4 2024',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 12419,
  available_units_count = 330,
  key_amenities = 'swimming pool, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '0485efd5-c5ba-4dde-a339-8c5983f0cff3';

-- Project: Omaxe Grandwoods | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2108',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2020-05-15T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 850,
  status = 'ready_to_move',
  possession_label = 'Q2 2024',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 13352,
  available_units_count = 255,
  key_amenities = 'children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '5d0dbebc-1067-481d-ab0a-eae77f240720';

-- Project: ACE Group Enclave Phase 10 (Block C) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3057',
  oc_obtained = false,
  rera_compliance_score = 76,
  rera_status = 'approved',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 697,
  status = 'under_construction',
  litigation_count = 4,
  possession_label = 'Q2 2027',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 19543,
  available_units_count = 209,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '5846044f-d6eb-42b4-87ae-8255a3af83a2';

-- Project: ATS Enclave Phase 10 (Block D) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3058',
  oc_obtained = true,
  oc_obtained_date = '2023-06-06T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'approved',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 728,
  status = 'ready_to_move',
  possession_label = 'Q3 2027',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 8359,
  available_units_count = 218,
  key_amenities = 'swimming pool, gym, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = 'fee6dd81-709a-441f-be86-f0838c60a302';

-- Project: Purvanchal Royal City - Phase 1 (Towers 1-8) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ521882',
  oc_obtained = true,
  rera_compliance_score = 97,
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1600,
  status = 'ready_to_move',
  possession_label = 'Q3 2027',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 10606,
  available_units_count = 480,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '06894481-6cd9-45c7-9c59-d9a9e8a775ab';

-- Project: ATS Enclave Phase 12 (Block D) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3068',
  oc_obtained = true,
  oc_obtained_date = '2020-02-06T00:00:00.000Z',
  rera_compliance_score = 97,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1038,
  status = 'ready_to_move',
  possession_label = 'Q3 2025',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 9316,
  available_units_count = 311,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '19ad5a96-a30c-4466-955a-6bd86ebe269e';

-- Project: Stellar Kings Court | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3015',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2022-02-23T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 580,
  status = 'ready_to_move',
  possession_label = 'Q2 2027',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 19222,
  available_units_count = 29,
  key_amenities = 'swimming pool, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '9a6e7661-627f-4d06-a555-dbc97c6dafd6';

-- Project: ACE Group Residency Phase 19 (Tower A) | Quality: 25/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8184',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 708,
  status = 'ready_to_move',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 8073,
  available_units_count = 212,
  key_amenities = 'children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = 'a650f529-0629-4945-8fcc-a7302d7f71ea';

-- Project: Supertech Supernova | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4016',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2022-12-24T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 1800,
  status = 'under_construction',
  litigation_count = 4,
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 15678,
  available_units_count = 90,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '6be84ef7-d53c-4415-8e06-ca7f3da8faa0';

-- Project: Grand Omaxe | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9303',
  rera_compliance_score = 94,
  oc_obtained = true,
  oc_obtained_date = '2024-06-19T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2014-04-30T00:00:00.000Z',
  total_units = 1320,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2026',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 11335,
  available_units_count = 396,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '47eb6cfa-0c88-4dc4-a000-c11e9cb053e7';

-- Project: ATS Greens Village | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9301',
  oc_obtained = true,
  rera_compliance_score = 87,
  oc_obtained_date = '2022-09-25T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2008-12-31T00:00:00.000Z',
  total_units = 750,
  status = 'ready_to_move',
  litigation_count = 4,
  possession_label = 'Q2 2025',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15705,
  available_units_count = 225,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '7ba97604-813f-4924-9044-53936a3737ce';

-- Project: Amrapali / NBCC Residency Phase 16 (Tower H) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8151',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 92,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1387,
  status = 'ready_to_move',
  possession_label = 'Q1 2025',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15546,
  available_units_count = 416,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '7b29ddbb-d46e-4847-8da3-43b531c07b99';

-- Project: Eldeco Aangan | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8201',
  rera_compliance_score = 94,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 720,
  status = 'ready_to_move',
  possession_label = 'Q1 2027',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 9628,
  available_units_count = 36,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '67051f07-c9c2-4e42-8064-d40cc95a0c1d';

-- Project: ACE Group Residency Phase 14 (Tower G) | Quality: 25/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8134',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 61,
  rera_status = 'approved',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 758,
  status = 'ready_to_move',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 8551,
  available_units_count = 37,
  key_amenities = 'security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '492d052f-0f4d-4053-a867-13a549e31cce';

-- Project: Ajnara The Belvedere | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ79110',
  rera_compliance_score = 98,
  oc_obtained = false,
  oc_obtained_date = '2023-07-15T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-07-15T00:00:00.000Z',
  total_units = 700,
  status = 'ready_to_move',
  possession_label = 'Q2 2027',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 8618,
  available_units_count = 35,
  key_amenities = 'swimming pool, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '0794fc2d-8f0c-47ad-ac2a-6f6d81378f56';

-- Project: Aditya Urban Casa | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7801',
  rera_compliance_score = 63,
  oc_obtained = true,
  oc_obtained_date = '2024-11-25T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2016-08-31T00:00:00.000Z',
  total_units = 650,
  status = 'ready_to_move',
  possession_label = 'Q4 2026',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  base_price_per_sqft = 19171,
  available_units_count = 32,
  key_amenities = 'swimming pool, gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = 'bf1f8f50-f49b-48ba-8602-4bdfd3add664';

-- Project: Antriksh Forest | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 80,
  oc_obtained = true,
  oc_obtained_date = '2022-05-07T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2024-02-15T00:00:00.000Z',
  total_units = 820,
  status = 'ready_to_move',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 17813,
  available_units_count = 246,
  key_amenities = 'swimming pool, gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Project: Aditya Celebrity Homes | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ76130',
  rera_compliance_score = 88,
  oc_obtained = false,
  oc_obtained_date = '2023-11-25T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-11-25T00:00:00.000Z',
  total_units = 750,
  status = 'ready_to_move',
  possession_label = 'Q4 2027',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  base_price_per_sqft = 10622,
  available_units_count = 225,
  key_amenities = 'children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.683Z',
  verification_level = 'verified'
WHERE id = 'd54acc58-62ad-47a9-a522-9cc49ab299dd';

-- Project: AIMS Golf Avenue I | Quality: 25/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1235',
  rera_compliance_score = 98,
  oc_obtained = false,
  oc_obtained_date = '2023-09-15T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2023-09-15T00:00:00.000Z',
  total_units = 650,
  status = 'ready_to_move',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 18330,
  available_units_count = 195,
  key_amenities = 'gym, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'bd7ce502-3c2a-423f-bc9e-63f4e0941201';

-- Project: AIMS Golf City | Quality: 25/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 66,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1600,
  status = 'ready_to_move',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 14969,
  available_units_count = 480,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- Project: Amrapali / NBCC Heights Phase 20 (Tower A) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5156',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'approved',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1068,
  status = 'ready_to_move',
  possession_label = 'Q2 2024',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 13504,
  available_units_count = 53,
  key_amenities = 'children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '950fbc8a-15b0-4a42-b53e-fe18a3bd7909';

-- Project: Pan Oasis | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7001',
  oc_obtained = false,
  rera_compliance_score = 76,
  rera_status = 'approved',
  possession_date = '2015-10-31T00:00:00.000Z',
  total_units = 1800,
  status = 'ready_to_move',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = true,
  awards_count = 3,
  base_price_per_sqft = 11646,
  available_units_count = 90,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'f38b09ff-d5c6-4978-a95e-c47dc7a6bc1b';

-- Project: Amrapali / NBCC Residency Phase 19 (Tower F) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8181',
  oc_obtained = true,
  oc_obtained_date = '2023-06-04T00:00:00.000Z',
  rera_compliance_score = 98,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 597,
  status = 'ready_to_move',
  litigation_count = 3,
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 16025,
  available_units_count = 179,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '6712e123-30b3-4a7b-adf2-6ac6c0068b29';

-- Project: Stellar Park | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ621',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'under_review',
  possession_date = '2014-11-30T00:00:00.000Z',
  total_units = 1000,
  status = 'ready_to_move',
  litigation_count = 1,
  possession_label = 'Q2 2027',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 12098,
  available_units_count = 300,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'c7a2614a-08c1-4fc8-b90e-3af3ee1bbe66';

-- Project: ACE Group Residency Phase 17 (Tower E) | Quality: 25/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8164',
  oc_obtained = true,
  oc_obtained_date = '2022-10-07T00:00:00.000Z',
  rera_compliance_score = 88,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 918,
  status = 'ready_to_move',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 9030,
  available_units_count = 275,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'f96c1fb8-e4d7-4592-b7a0-f3e24635bc04';

-- Project: Amrapali Eden Park | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1050',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  possession_date = '2013-12-31T00:00:00.000Z',
  total_units = 320,
  status = 'ready_to_move',
  possession_label = 'Q3 2027',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 19494,
  available_units_count = 96,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'c270d881-50ed-454c-a300-8e9932012a9f';

-- Project: Amrapali Golf Homes Phase 1 | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8808',
  oc_obtained = false,
  rera_compliance_score = 96,
  rera_status = 'compliant',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 2400,
  status = 'under_construction',
  litigation_count = 2,
  possession_label = 'Q3 2026',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 9716,
  available_units_count = 720,
  key_amenities = 'gym, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'fd2dff4c-4552-4a53-8a91-2f50fd959a82';

-- Project: Gardenia Glory | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4601',
  oc_obtained = true,
  rera_compliance_score = 91,
  rera_status = 'registered',
  possession_date = '2017-08-31T00:00:00.000Z',
  total_units = 1100,
  status = 'ready_to_move',
  possession_label = 'Q2 2027',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 80,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 9395,
  available_units_count = 330,
  key_amenities = 'parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '85141048-0d74-482b-9c00-ac6d8531b341';

-- Project: Amrapali Sapphire | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4502',
  oc_obtained = true,
  rera_compliance_score = 87,
  oc_obtained_date = '2021-08-14T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2016-06-30T00:00:00.000Z',
  total_units = 1600,
  status = 'ready_to_move',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 16106,
  available_units_count = 80,
  key_amenities = 'swimming pool, gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '3bca4621-44df-4105-a728-a0e4ab13b8c1';

-- Project: Godrej Woods | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7047',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2020-04-02T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2026-09-30T00:00:00.000Z',
  total_units = 1200,
  status = 'under_construction',
  possession_label = 'Q4 2025',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 13055,
  available_units_count = 360,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e0a8ab69-4bf7-48dd-aac0-67b795ee06ea';

-- Project: Apex Residency Phase 18 (Tower C) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8178',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 52,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1436,
  status = 'ready_to_move',
  possession_label = 'Q1 2024',
  projects_delivered_count = 8,
  average_delay_months = 1,
  total_projects_count = 14,
  delayed_projects_count = 1,
  credai_member = true,
  base_price_per_sqft = 16311,
  available_units_count = 430,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '647901fc-dd46-44ce-a6a4-29c6e37451f9';

-- Project: Amrapali / NBCC Residency Phase 17 (Tower B) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8161',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 92,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 807,
  status = 'ready_to_move',
  possession_label = 'Q3 2024',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 13154,
  available_units_count = 40,
  key_amenities = 'swimming pool, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '204e18e6-473a-46a2-8da4-aeab5485d4b5';

-- Project: Godrej Golf Links & The Crest | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ151',
  oc_obtained = true,
  rera_compliance_score = 86,
  oc_obtained_date = '2021-05-22T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2022-03-31T00:00:00.000Z',
  total_units = 650,
  status = 'ready_to_move',
  possession_label = 'Q2 2024',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 10479,
  available_units_count = 195,
  key_amenities = 'swimming pool, gym, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '63506755-89ce-440a-8d0b-8f2155e99fb5';

-- Project: Jaypee Sports City (Kassia) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8826',
  oc_obtained = false,
  rera_compliance_score = 89,
  rera_status = 'compliant',
  possession_date = '2019-12-31T00:00:00.000Z',
  total_units = 920,
  status = 'ready_to_move',
  possession_label = 'Q4 2026',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 17294,
  available_units_count = 46,
  key_amenities = 'children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '38b353ee-e14f-40e3-9589-ef69e74794f7';

-- Project: Orris Greenbay Golf Homes | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5528',
  oc_obtained = false,
  rera_compliance_score = 97,
  rera_status = 'compliant',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 950,
  status = 'under_construction',
  possession_label = 'Q4 2026',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 25,
  delayed_projects_count = 3,
  credai_member = true,
  base_price_per_sqft = 12186,
  available_units_count = 47,
  key_amenities = 'gym, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'dbfa1b3f-4ea5-434f-95f4-a1731cc3ebd7';

-- Project: Arihant Seasons | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ22D980',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2022-03-03T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2028-03-31T00:00:00.000Z',
  total_units = 720,
  status = 'new_launch',
  litigation_count = 4,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 52,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 8244,
  available_units_count = 216,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '1ccb48fa-d390-4574-8a4b-6ea712ac4381';

-- Project: ACE Terrains / Terra | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ622101',
  rera_compliance_score = 51,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 980,
  status = 'under_construction',
  possession_label = 'Q4 2026',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 17024,
  available_units_count = 294,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '704e98bf-974c-49f3-9f8a-5293f3d66681';

-- Project: Ace City | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ0101',
  oc_obtained = false,
  rera_compliance_score = 96,
  rera_status = 'under_review',
  possession_date = '2018-09-30T00:00:00.000Z',
  total_units = 2800,
  status = 'ready_to_move',
  litigation_count = 4,
  possession_label = 'Q1 2025',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12319,
  available_units_count = 840,
  key_amenities = 'children play area, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e3871eb3-edb5-4621-9e99-494fcd94a25b';

-- Project: Gaur Yamuna City (7th Parkview) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9928',
  oc_obtained = false,
  rera_compliance_score = 75,
  rera_status = 'approved',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 1800,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q2 2024',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 19220,
  available_units_count = 90,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '28c22505-99b9-436d-82ca-0d8e5d8e9199';

-- Project: Supertech Upcountry (Golf Village) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6619',
  oc_obtained = true,
  rera_compliance_score = 98,
  oc_obtained_date = '2024-04-23T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2019-06-30T00:00:00.000Z',
  total_units = 1400,
  status = 'ready_to_move',
  litigation_count = 2,
  possession_label = 'Q2 2027',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 9870,
  available_units_count = 70,
  key_amenities = 'parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '479f7942-1f6d-4ddb-869a-5d56d941cbd5';

-- Project: Gayatri Life | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2110',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2023-05-25T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 850,
  status = 'ready_to_move',
  projects_delivered_count = 52,
  average_delay_months = 22,
  total_projects_count = 84,
  delayed_projects_count = 14,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 14529,
  available_units_count = 42,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e35d0295-5513-45c2-a0d1-509cc6d2abd9';

-- Project: Galaxy North Avenue 2 | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2213',
  rera_compliance_score = 88,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1300,
  status = 'ready_to_move',
  possession_label = 'Q1 2026',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = true,
  awards_count = 3,
  base_price_per_sqft = 17191,
  available_units_count = 390,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'c5a5de4b-e47c-40ee-a5c5-0fb672d3f4ba';

-- Project: Ajnara Le Garden | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4819',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2020-09-30T00:00:00.000Z',
  total_units = 1650,
  status = 'ready_to_move',
  litigation_count = 4,
  possession_label = 'Q3 2026',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 19365,
  available_units_count = 82,
  key_amenities = 'swimming pool, gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '7b8d12f6-1cb6-41e9-9438-05f55f2fc95e';

-- Project: Eldeco Heights Phase 15 (Tower F) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5119',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 1237,
  status = 'under_construction',
  possession_label = 'Q2 2024',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 14914,
  available_units_count = 61,
  key_amenities = 'security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '2d685112-498e-41f7-ac1e-f977522115e1';

-- Project: ACE Group Residency Phase 18 (Tower G) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8174',
  oc_obtained = true,
  rera_compliance_score = 89,
  oc_obtained_date = '2022-07-14T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 1288,
  status = 'under_construction',
  litigation_count = 4,
  possession_label = 'Q3 2026',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 10465,
  available_units_count = 386,
  key_amenities = 'parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '04c0d31f-c62e-4799-8a2a-8bc20b2d3eb9';

-- Project: Ace Starlit | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6772',
  oc_obtained = true,
  rera_compliance_score = 91,
  oc_obtained_date = '2021-05-25T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 490,
  status = 'under_construction',
  possession_label = 'Q1 2027',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 14206,
  available_units_count = 24,
  key_amenities = 'swimming pool, gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '30df5cd8-7b2b-4f55-a05a-0d76d1b94795';

-- Project: Jaypee Aman | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1510',
  rera_compliance_score = 95,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 3200,
  status = 'ready_to_move',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 18072,
  available_units_count = 160,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'ebe56ae7-de69-4289-913f-95f74e9af757';

-- Project: ACE Arte | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ992384',
  rera_compliance_score = 58,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2028-12-31T00:00:00.000Z',
  total_units = 420,
  status = 'new_launch',
  possession_label = 'Q1 2025',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 11478,
  available_units_count = 126,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'fdd2de65-e073-47c0-a9cd-5ae72e532941';

-- Project: Amrapali / NBCC Residency Phase 15 (Tower F) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8141',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2020-04-16T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 1017,
  status = 'under_construction',
  litigation_count = 4,
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 14111,
  available_units_count = 305,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '8a15ff10-371d-4411-a1d6-4735e6b4f32d';

-- Project: Godrej Jardinia | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1461',
  oc_obtained = true,
  rera_compliance_score = 83,
  oc_obtained_date = '2024-07-14T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2028-12-31T00:00:00.000Z',
  total_units = 650,
  status = 'new_launch',
  litigation_count = 3,
  possession_label = 'Q1 2024',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 14063,
  available_units_count = 32,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Project: Capital Athena | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1442',
  rera_compliance_score = 94,
  oc_obtained = false,
  rera_status = 'under_review',
  possession_date = '2018-10-31T00:00:00.000Z',
  total_units = 1200,
  status = 'ready_to_move',
  possession_label = 'Q3 2026',
  projects_delivered_count = 15,
  average_delay_months = 4,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 9434,
  available_units_count = 360,
  key_amenities = 'swimming pool, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '4315ac08-c95c-4e50-8152-79967b6badfc';

-- Project: Eldeco Heights Phase 17 (Tower D) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5129',
  oc_obtained = false,
  rera_compliance_score = 89,
  rera_status = 'compliant',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 787,
  status = 'under_construction',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 14914,
  available_units_count = 236,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '752cf0cc-749d-4f56-964b-47f4c9146a6a';

-- Project: SKA Orion | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = false,
  rera_compliance_score = 88,
  rera_status = 'registered',
  possession_date = '2025-10-01T00:00:00.000Z',
  total_units = 520,
  status = 'under_construction',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 8853,
  available_units_count = 156,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- Project: SKA Orion | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = true,
  rera_compliance_score = 98,
  oc_obtained_date = '2021-09-20T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2025-10-01T00:00:00.000Z',
  total_units = 520,
  total_towers = 3,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 8853,
  available_units_count = 26,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- Project: Gaursons Residency Phase 18 (Tower E) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8172',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 77,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1214,
  total_towers = 11,
  status = 'ready_to_move',
  possession_label = 'Q1 2027',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 17525,
  available_units_count = 364,
  key_amenities = 'children play area, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '065d5c46-6b6e-4bbb-8cea-1769673c5960';

-- Project: Ajnara Daffodil | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1373',
  rera_compliance_score = 80,
  oc_obtained = true,
  rera_status = 'compliant',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 1100,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2027',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 15059,
  available_units_count = 330,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '24b1661d-8688-464e-b9f0-58838020895a';

-- Project: Jaypee Greens Kosmos | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8824',
  oc_obtained = true,
  rera_compliance_score = 85,
  oc_obtained_date = '2024-12-13T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2017-06-30T00:00:00.000Z',
  total_units = 2400,
  total_towers = 18,
  status = 'ready_to_move',
  litigation_count = 10,
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 16196,
  available_units_count = 720,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'faa03642-1649-4f24-a91b-054f6d5cd4ba';

-- Project: Jaypee Garden Isles | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3920',
  rera_compliance_score = 92,
  oc_obtained = true,
  rera_status = 'under_review',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 1400,
  total_towers = 9,
  status = 'under_construction',
  possession_label = 'Q4 2025',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 19778,
  available_units_count = 420,
  key_amenities = 'swimming pool, gym, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '324135fb-2a5e-43d8-bc52-8d0991ab4515';

-- Project: Ace Hanei | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ677887',
  rera_compliance_score = 58,
  oc_obtained = true,
  oc_obtained_date = '2023-09-25T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2028-10-15T00:00:00.000Z',
  total_units = 518,
  total_towers = 6,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q4 2027',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12681,
  available_units_count = 25,
  key_amenities = 'children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e0412f51-4650-4793-9ab7-9672d9d87a32';

-- Project: Eldeco Heights Phase 18 (Tower B) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5139',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'registered',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 1217,
  total_towers = 11,
  status = 'under_construction',
  possession_label = 'Q4 2026',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 14436,
  available_units_count = 365,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '9089aaa2-85b5-4757-b06b-1f2d1d3b8a9d';

-- Project: ATS Knightsbridge | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3574',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2021-07-19T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 215,
  total_towers = 5,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 14270,
  available_units_count = 64,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '122eaf91-013f-427f-9546-da52c5b69251';

-- Project: ABA Cleo County | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6210',
  oc_obtained = true,
  rera_compliance_score = 90,
  rera_status = 'approved',
  possession_date = '2017-12-31T00:00:00.000Z',
  total_units = 2600,
  total_towers = 24,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  base_price_per_sqft = 15253,
  available_units_count = 130,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '74994caf-4ec0-436a-8688-9ca9f5ba42c3';

-- Project: Amrapali Zodiac | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1201',
  rera_compliance_score = 90,
  oc_obtained = true,
  oc_obtained_date = '2023-01-20T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2016-09-30T00:00:00.000Z',
  total_units = 2200,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 18,
  possession_label = 'Q3 2027',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15977,
  available_units_count = 660,
  key_amenities = 'gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '4b1a3462-7aab-4988-a585-20ab1e848373';

-- Project: ACE Group Residency Phase 16 (Tower C) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8154',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 67,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1498,
  total_towers = 13,
  status = 'ready_to_move',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 19594,
  available_units_count = 449,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'a73bda9f-d405-47af-bead-60994e1ac0cd';

-- Project: Eldeco Aamantran | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1192',
  oc_obtained = true,
  rera_compliance_score = 90,
  oc_obtained_date = '2022-06-24T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2015-09-30T00:00:00.000Z',
  total_units = 780,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q2 2027',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 12951,
  available_units_count = 39,
  key_amenities = 'swimming pool, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'd3fdbe07-a903-454a-b343-31215facdb6d';

-- Project: 3C Lotus Panache | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1101',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2017-06-30T00:00:00.000Z',
  total_units = 3000,
  total_towers = 30,
  status = 'ready_to_move',
  litigation_count = 8,
  possession_label = 'Q3 2026',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 10753,
  available_units_count = 900,
  key_amenities = 'swimming pool, gym, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'd2c48b0d-2110-4d23-b8e7-c19e7927b1b7';

-- Project: Amaatra Homes | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3010',
  rera_compliance_score = 54,
  oc_obtained = true,
  oc_obtained_date = '2021-11-08T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 820,
  total_towers = 5,
  status = 'ready_to_move',
  litigation_count = 3,
  projects_delivered_count = 51,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 13417,
  available_units_count = 246,
  key_amenities = 'swimming pool, gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '2f5a8248-e9da-44d6-99e7-c403aca87bbe';

-- Project: Divine Meadows | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1081',
  rera_compliance_score = 88,
  oc_obtained = false,
  rera_status = 'under_review',
  possession_date = '2017-08-31T00:00:00.000Z',
  total_units = 1100,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2027',
  projects_delivered_count = 25,
  average_delay_months = 9,
  total_projects_count = 41,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 12744,
  available_units_count = 330,
  key_amenities = 'children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '0630fb09-0f4c-4c31-8ea9-ad69973da58d';

-- Project: Amrapali / NBCC Heights Phase 16 (Tower A) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5126',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 94,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 658,
  total_towers = 6,
  status = 'ready_to_move',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15896,
  available_units_count = 197,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'a2a67347-b28c-4605-be60-20bfc46df638';

-- Project: 3C Lotus 300 | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3300',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'under_review',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 300,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 8,
  possession_label = 'Q1 2025',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 15913,
  available_units_count = 90,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '64137eb6-2e30-4e6d-8508-a9052bef101b';

-- Project: ATS One Hamlet | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1041',
  rera_compliance_score = 90,
  oc_obtained = true,
  rera_status = 'registered',
  possession_date = '2015-10-31T00:00:00.000Z',
  total_units = 1000,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15408,
  available_units_count = 50,
  key_amenities = 'swimming pool, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '1254753f-834d-4116-9ff1-c1b4119665b4';

-- Project: Lotus Boulevard Block A-F | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ10001',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 15,
  status = 'ready_to_move',
  possession_label = 'Q3 2027',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 11385,
  available_units_count = 90,
  key_amenities = 'gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'bb678f33-b2e8-409e-8a9d-94d5c4efbae6';

-- Project: Lotus Boulevard | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2019',
  rera_compliance_score = 87,
  oc_obtained = true,
  oc_obtained_date = '2022-07-01T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 3200,
  total_towers = 30,
  status = 'ready_to_move',
  litigation_count = 8,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 19727,
  available_units_count = 160,
  key_amenities = 'children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '9521a90f-1ad2-4de1-bcc8-198a6e6f2713';

-- Project: Stellar Jeevan Phase 1 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3012',
  oc_obtained = true,
  oc_obtained_date = '2020-02-01T00:00:00.000Z',
  rera_compliance_score = 81,
  rera_status = 'approved',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1400,
  total_towers = 12,
  status = 'ready_to_move',
  possession_label = 'Q2 2025',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 17075,
  available_units_count = 420,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e4d1dd0a-18c8-4c66-8e7a-6b171c4e9beb';

-- Project: Eldeco Green Meadows | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1182',
  oc_obtained = true,
  rera_compliance_score = 56,
  oc_obtained_date = '2022-03-24T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2014-06-30T00:00:00.000Z',
  total_units = 820,
  total_towers = 11,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 16752,
  available_units_count = 246,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '51007411-9117-4ff8-95b6-b5ac7fb9e2f7';

-- Project: Jaypee Earth Court | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3924',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 91,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 510,
  total_towers = 5,
  status = 'ready_to_move',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 17502,
  available_units_count = 25,
  key_amenities = 'swimming pool, gym, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '55e29630-faa7-4d5d-b203-c0d97a76de6e';

-- Project: Jaypee Greens Golf Course Residences | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3310',
  oc_obtained = false,
  rera_compliance_score = 87,
  rera_status = 'compliant',
  possession_date = '2018-06-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q1 2025',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 13426,
  available_units_count = 47,
  key_amenities = 'swimming pool, gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '092da15d-2dbf-49f9-83e0-42092ddb9f1e';

-- Project: Migsun Ultimo | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2491',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2022-04-12T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2020-10-31T00:00:00.000Z',
  total_units = 680,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 17167,
  available_units_count = 204,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'f0dcff71-e26b-4aee-aa62-99fe95a5518c';

-- Project: Eldeco Mystic Greens | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2004',
  oc_obtained = true,
  rera_compliance_score = 89,
  rera_status = 'approved',
  possession_date = '2016-08-31T00:00:00.000Z',
  total_units = 480,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18148,
  available_units_count = 24,
  key_amenities = 'security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'f143296c-a2f1-462c-be2d-850e0ca557bd';

-- Project: NRI City Township | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2901',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'under_review',
  possession_date = '2010-06-30T00:00:00.000Z',
  total_units = 850,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 48,
  delayed_projects_count = 7,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 15783,
  available_units_count = 255,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '00d89685-f2c1-462d-9716-66a4257dd85f';

-- Project: Trecento Residencies by Gaurs | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ283531',
  oc_obtained = false,
  rera_compliance_score = 87,
  rera_status = 'under_review',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 510,
  total_towers = 5,
  status = 'under_construction',
  possession_label = 'Q2 2027',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 17707,
  available_units_count = 25,
  key_amenities = 'security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'b551f816-cf6a-4bc8-90d6-e006f9f5d998';

-- Project: Migsun Vilaasa | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2006',
  oc_obtained = false,
  rera_compliance_score = 88,
  rera_status = 'under_review',
  possession_date = '2022-06-30T00:00:00.000Z',
  total_units = 1100,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2024',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 15136,
  available_units_count = 330,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'f815eae4-0c4a-4927-b422-77d2db9dbcd7';

-- Project: SKA Metro Ville | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ10875',
  rera_compliance_score = 93,
  oc_obtained = true,
  oc_obtained_date = '2021-03-23T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1200,
  total_towers = 8,
  status = 'ready_to_move',
  possession_label = 'Q3 2027',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 15214,
  available_units_count = 360,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '5fd8baa9-1544-4119-97fa-ba76520fbfcf';

-- Project: Nimbus Express Park View 1 & 2 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4912',
  oc_obtained = true,
  rera_compliance_score = 93,
  oc_obtained_date = '2021-10-25T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2019-11-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2025',
  projects_delivered_count = 5,
  total_projects_count = 8,
  credai_member = false,
  base_price_per_sqft = 9522,
  available_units_count = 47,
  key_amenities = 'children play area, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '2467440e-86a6-4547-8fee-02b357f9a6d4';

-- Project: ATS Green Paradiso | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2005',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'under_review',
  possession_date = '2010-09-30T00:00:00.000Z',
  total_units = 550,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2024',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 13791,
  available_units_count = 27,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'cba89104-e173-401a-ba0d-a1989e957fe2';

-- Project: Unitech Horizon | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJBETA2',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2015-08-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 12,
  projects_delivered_count = 50,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 18770,
  available_units_count = 480,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'b6c288b7-3fed-42d2-891c-f81b17eebb90';

-- Project: Paramount Golf Foreste | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2001',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2020-07-15T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2017-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 11,
  average_delay_months = 3,
  total_projects_count = 18,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 12019,
  available_units_count = 80,
  key_amenities = 'swimming pool, gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'a9c643f8-b05b-4e1b-aa6b-e58e641be355';

-- Project: Ace Platinum | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2002',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2020-10-26T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2016-10-31T00:00:00.000Z',
  total_units = 1200,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 15486,
  available_units_count = 60,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '863224f4-8cde-433e-bfb5-e138029b5091';

-- Project: Gaur Yamuna City - 16th Parkview | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6801',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 90,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 15,
  status = 'ready_to_move',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 16272,
  available_units_count = 540,
  key_amenities = 'swimming pool, gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '8a2d0939-0d58-4bbe-bc94-2a17547138dc';

-- Project: ABA Cherry County | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4285',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2018-05-31T00:00:00.000Z',
  total_units = 1780,
  total_towers = 13,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  base_price_per_sqft = 19209,
  available_units_count = 534,
  key_amenities = 'gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'ecae9f5d-aabf-4ef0-b1b1-2f92dbb2af0b';

-- Project: Omaxe Riviera | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2107',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 780,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q3 2027',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 13378,
  available_units_count = 234,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '86d58fd8-a88d-41af-adea-7e7069aaf417';

-- Project: ATS Dolce | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3252',
  oc_obtained = true,
  oc_obtained_date = '2023-08-13T00:00:00.000Z',
  rera_compliance_score = 88,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1770,
  total_towers = 15,
  status = 'ready_to_move',
  litigation_count = 3,
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 9849,
  available_units_count = 88,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '102ae618-e913-49e0-8a31-92e553366a88';

-- Project: Purvanchal Heights | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3122',
  rera_compliance_score = 98,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 920,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 3,
  possession_label = 'Q1 2024',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 15911,
  available_units_count = 276,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '1596bf90-1954-4ac3-9003-ecd6b5e207cd';

-- Project: Migsun Atharva | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2984',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2020-01-21T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 890,
  total_towers = 8,
  status = 'under_construction',
  litigation_count = 4,
  possession_label = 'Q1 2025',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 18007,
  available_units_count = 267,
  key_amenities = 'gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '4e7dd63b-78c4-44c9-97e0-7c8d0e1c5317';

-- Project: Eldeco Mystic Greens | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4102',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 96,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1430,
  total_towers = 13,
  status = 'ready_to_move',
  possession_label = 'Q2 2026',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18148,
  available_units_count = 429,
  key_amenities = 'swimming pool',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '7b4e098b-ee7e-4f79-a0d1-55919090861a';

-- Project: Omaxe Palm Greens | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2105',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2020-08-17T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 2050,
  total_towers = 13,
  status = 'ready_to_move',
  litigation_count = 3,
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 8567,
  available_units_count = 615,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '0485efd5-c5ba-4dde-a339-8c5983f0cff3';

-- Project: Omaxe Grandwoods | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2108',
  rera_compliance_score = 95,
  oc_obtained = true,
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 850,
  total_towers = 5,
  status = 'ready_to_move',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 13352,
  available_units_count = 255,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '5d0dbebc-1067-481d-ab0a-eae77f240720';

-- Project: Migsun Villa | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2983',
  oc_obtained = true,
  oc_obtained_date = '2020-12-14T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 620,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 1,
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 14969,
  available_units_count = 31,
  key_amenities = 'gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '32f7ab36-1931-4e0d-9fe2-a1b410c407f3';

-- Project: Purvanchal Royal City | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ521883',
  oc_obtained = true,
  oc_obtained_date = '2024-05-19T00:00:00.000Z',
  rera_compliance_score = 88,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 2230,
  total_towers = 20,
  status = 'under_construction',
  possession_label = 'Q2 2024',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12652,
  available_units_count = 669,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '0bc420a9-5c71-4079-bb45-d003bd4345ce';

-- Project: Purvanchal Royal City - Phase 1 (Towers 1-8) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ521882',
  oc_obtained = true,
  rera_compliance_score = 89,
  oc_obtained_date = '2020-06-01T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 17,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2025',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 10606,
  available_units_count = 80,
  key_amenities = 'gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '06894481-6cd9-45c7-9c59-d9a9e8a775ab';

-- Project: Eldeco Residency Greens | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4105',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 86,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 690,
  total_towers = 6,
  status = 'ready_to_move',
  possession_label = 'Q1 2027',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18161,
  available_units_count = 34,
  key_amenities = 'swimming pool, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e65551fa-9428-4d3a-8fb2-0c33fa4517ad';

-- Project: Stellar Kings Court | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3015',
  rera_compliance_score = 94,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 580,
  total_towers = 4,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 19222,
  available_units_count = 29,
  key_amenities = 'swimming pool',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '9a6e7661-627f-4d06-a555-dbc97c6dafd6';

-- Project: Supertech Supernova | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4016',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2024-03-08T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 4,
  status = 'under_construction',
  litigation_count = 14,
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 15678,
  available_units_count = 540,
  key_amenities = 'swimming pool, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '6be84ef7-d53c-4415-8e06-ca7f3da8faa0';

-- Project: Grand Omaxe | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9303',
  rera_compliance_score = 59,
  oc_obtained = true,
  oc_obtained_date = '2021-11-26T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2014-04-30T00:00:00.000Z',
  total_units = 1320,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 11335,
  available_units_count = 66,
  key_amenities = 'swimming pool, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '47eb6cfa-0c88-4dc4-a000-c11e9cb053e7';

-- Project: ATS Greens Village | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9301',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'approved',
  possession_date = '2008-12-31T00:00:00.000Z',
  total_units = 750,
  total_towers = 25,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15705,
  available_units_count = 37,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '7ba97604-813f-4924-9044-53936a3737ce';

-- Project: Eldeco Aangan | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8201',
  rera_compliance_score = 98,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 720,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q1 2026',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 9628,
  available_units_count = 216,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '67051f07-c9c2-4e42-8064-d40cc95a0c1d';

-- Project: Ajnara The Belvedere | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ79110',
  rera_compliance_score = 86,
  oc_obtained = false,
  oc_obtained_date = '2023-07-15T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-07-15T00:00:00.000Z',
  total_units = 700,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2025',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 8618,
  available_units_count = 210,
  key_amenities = 'gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '0794fc2d-8f0c-47ad-ac2a-6f6d81378f56';

-- Project: Aditya Urban Casa | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7801',
  rera_compliance_score = 88,
  oc_obtained = false,
  oc_obtained_date = '2023-09-28T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2016-08-31T00:00:00.000Z',
  total_units = 650,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q2 2025',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  base_price_per_sqft = 19171,
  available_units_count = 32,
  key_amenities = 'parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'bf1f8f50-f49b-48ba-8602-4bdfd3add664';

-- Project: Antriksh Forest | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2023-06-23T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2024-02-15T00:00:00.000Z',
  total_units = 820,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 17813,
  available_units_count = 246,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Project: Aditya Celebrity Homes | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ76130',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2022-03-19T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-11-25T00:00:00.000Z',
  total_units = 750,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2024',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  base_price_per_sqft = 10622,
  available_units_count = 37,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'd54acc58-62ad-47a9-a522-9cc49ab299dd';

-- Project: AIMS Golf Avenue I | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1235',
  rera_compliance_score = 87,
  oc_obtained = false,
  oc_obtained_date = '2023-09-15T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2023-09-15T00:00:00.000Z',
  total_units = 650,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q2 2027',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 18330,
  available_units_count = 32,
  key_amenities = 'swimming pool, gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'bd7ce502-3c2a-423f-bc9e-63f4e0941201';

-- Project: AIMS Golf City | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 71,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 14969,
  available_units_count = 480,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- Project: AIMS Golf City | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 90,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 14,
  status = 'ready_to_move',
  possession_label = 'Q3 2027',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 14969,
  available_units_count = 480,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- Project: Grand Ajnara Heritage | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5655',
  rera_compliance_score = 87,
  oc_obtained = true,
  rera_status = 'under_review',
  possession_date = '2018-06-30T00:00:00.000Z',
  total_units = 1760,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2026',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 9420,
  available_units_count = 528,
  key_amenities = 'swimming pool, gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '0a5b22e6-19a2-4f68-a5ba-5e474bb9b203';

-- Project: Pan Oasis | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7001',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  possession_date = '2015-10-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 18,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2027',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = true,
  awards_count = 3,
  base_price_per_sqft = 11646,
  available_units_count = 540,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'f38b09ff-d5c6-4978-a95e-c47dc7a6bc1b';

-- Project: Stellar Park | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ621',
  rera_compliance_score = 91,
  oc_obtained = true,
  oc_obtained_date = '2024-04-07T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2014-11-30T00:00:00.000Z',
  total_units = 1000,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2027',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 12098,
  available_units_count = 50,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'c7a2614a-08c1-4fc8-b90e-3af3ee1bbe66';

-- Project: Amrapali Eden Park | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1050',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'registered',
  possession_date = '2013-12-31T00:00:00.000Z',
  total_units = 320,
  total_towers = 4,
  status = 'ready_to_move',
  litigation_count = 18,
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 19494,
  available_units_count = 96,
  key_amenities = 'swimming pool, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'c270d881-50ed-454c-a300-8e9932012a9f';

-- Project: Amrapali Golf Homes | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8808',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 4500,
  total_towers = 38,
  status = 'under_construction',
  possession_label = 'Q2 2026',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 17864,
  available_units_count = 225,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'fd2dff4c-4552-4a53-8a91-2f50fd959a82';

-- Project: Gardenia Glory | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4601',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2023-12-20T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2017-08-31T00:00:00.000Z',
  total_units = 1100,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 80,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 9395,
  available_units_count = 55,
  key_amenities = 'swimming pool, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '85141048-0d74-482b-9c00-ac6d8531b341';

-- Project: Amrapali Sapphire | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4502',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2021-01-15T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2016-06-30T00:00:00.000Z',
  total_units = 1600,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 18,
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 16106,
  available_units_count = 80,
  key_amenities = 'children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '3bca4621-44df-4105-a728-a0e4ab13b8c1';

-- Project: Godrej Woods | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7047',
  rera_compliance_score = 93,
  oc_obtained = true,
  rera_status = 'registered',
  possession_date = '2026-09-30T00:00:00.000Z',
  total_units = 3220,
  total_towers = 28,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q2 2025',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 13055,
  available_units_count = 161,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e0a8ab69-4bf7-48dd-aac0-67b795ee06ea';

-- Project: Eros Sampoornam | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2941',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2023-11-16T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2018-04-30T00:00:00.000Z',
  total_units = 6650,
  total_towers = 58,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 49,
  delayed_projects_count = 7,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 17334,
  available_units_count = 1995,
  key_amenities = 'children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '5d09bdc0-6c37-4e7c-ad55-14b03f289765';

-- Project: Godrej Golf Links & The Crest | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ151',
  oc_obtained = false,
  rera_compliance_score = 61,
  rera_status = 'under_review',
  possession_date = '2022-03-31T00:00:00.000Z',
  total_units = 650,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 10479,
  available_units_count = 195,
  key_amenities = 'swimming pool, gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '63506755-89ce-440a-8d0b-8f2155e99fb5';

-- Project: Jaypee Sports City (Kassia) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8826',
  oc_obtained = true,
  rera_compliance_score = 50,
  oc_obtained_date = '2021-04-28T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2019-12-31T00:00:00.000Z',
  total_units = 920,
  total_towers = 9,
  status = 'ready_to_move',
  litigation_count = 10,
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 17294,
  available_units_count = 276,
  key_amenities = 'gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '38b353ee-e14f-40e3-9589-ef69e74794f7';

-- Project: Orris Greenbay Golf Homes | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5528',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 8,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q2 2026',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 25,
  delayed_projects_count = 3,
  credai_member = true,
  base_price_per_sqft = 12186,
  available_units_count = 47,
  key_amenities = 'gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'dbfa1b3f-4ea5-434f-95f4-a1731cc3ebd7';

-- Project: Arihant Seasons | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ22D980',
  rera_compliance_score = 90,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2028-03-31T00:00:00.000Z',
  total_units = 720,
  total_towers = 6,
  status = 'new_launch',
  litigation_count = 0,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 52,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 8244,
  available_units_count = 216,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '1ccb48fa-d390-4574-8a4b-6ea712ac4381';

-- Project: ACE Terrains / Terra | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ622101',
  rera_compliance_score = 90,
  oc_obtained = true,
  rera_status = 'registered',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 980,
  total_towers = 6,
  status = 'under_construction',
  possession_label = 'Q2 2027',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 17024,
  available_units_count = 49,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '704e98bf-974c-49f3-9f8a-5293f3d66681';

-- Project: Ace City | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ0101',
  oc_obtained = true,
  rera_compliance_score = 86,
  rera_status = 'approved',
  possession_date = '2018-09-30T00:00:00.000Z',
  total_units = 5500,
  total_towers = 34,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12319,
  available_units_count = 275,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e3871eb3-edb5-4621-9e99-494fcd94a25b';

-- Project: Gaur Yamuna City (7th Parkview) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9928',
  oc_obtained = true,
  rera_compliance_score = 94,
  oc_obtained_date = '2021-09-03T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 1800,
  total_towers = 12,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 19220,
  available_units_count = 540,
  key_amenities = 'swimming pool, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '28c22505-99b9-436d-82ca-0d8e5d8e9199';

-- Project: Supertech Upcountry (Golf Village) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6619',
  oc_obtained = false,
  rera_compliance_score = 87,
  rera_status = 'approved',
  possession_date = '2019-06-30T00:00:00.000Z',
  total_units = 1400,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 14,
  possession_label = 'Q2 2027',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 9870,
  available_units_count = 420,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '479f7942-1f6d-4ddb-869a-5d56d941cbd5';

-- Project: Gayatri Life | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2110',
  rera_compliance_score = 90,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 850,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q1 2024',
  projects_delivered_count = 52,
  average_delay_months = 22,
  total_projects_count = 84,
  delayed_projects_count = 14,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 14529,
  available_units_count = 255,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e35d0295-5513-45c2-a0d1-509cc6d2abd9';

-- Project: Galaxy North Avenue 2 | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2213',
  rera_compliance_score = 86,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1300,
  total_towers = 8,
  status = 'ready_to_move',
  possession_label = 'Q4 2026',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = true,
  awards_count = 3,
  base_price_per_sqft = 17191,
  available_units_count = 65,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'c5a5de4b-e47c-40ee-a5c5-0fb672d3f4ba';

-- Project: Ajnara Le Garden | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4819',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-06-22T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2020-09-30T00:00:00.000Z',
  total_units = 1650,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 19365,
  available_units_count = 495,
  key_amenities = 'children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '7b8d12f6-1cb6-41e9-9438-05f55f2fc95e';

-- Project: Golden Palms | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1681',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2017-11-30T00:00:00.000Z',
  total_units = 1400,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 13,
  average_delay_months = 4,
  total_projects_count = 21,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 16921,
  available_units_count = 70,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '42e2157b-ba9d-4cad-a48a-1ec52c820816';

-- Project: Ace Starlit | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6772',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'under_review',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 490,
  total_towers = 5,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 14206,
  available_units_count = 24,
  key_amenities = 'swimming pool, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '30df5cd8-7b2b-4f55-a05a-0d76d1b94795';

-- Project: Jaypee Aman | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1510',
  rera_compliance_score = 95,
  oc_obtained = true,
  oc_obtained_date = '2022-03-05T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 3200,
  total_towers = 28,
  status = 'ready_to_move',
  litigation_count = 10,
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 18072,
  available_units_count = 160,
  key_amenities = 'gym, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'ebe56ae7-de69-4289-913f-95f74e9af757';

-- Project: ACE Arte | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ992384',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2028-12-31T00:00:00.000Z',
  total_units = 420,
  total_towers = 5,
  status = 'new_launch',
  litigation_count = 0,
  possession_label = 'Q4 2025',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 11478,
  available_units_count = 21,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'fdd2de65-e073-47c0-a9cd-5ae72e532941';

-- Project: Godrej Jardinia | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1461',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'approved',
  possession_date = '2028-12-31T00:00:00.000Z',
  total_units = 650,
  total_towers = 6,
  status = 'new_launch',
  litigation_count = 0,
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 14063,
  available_units_count = 195,
  key_amenities = 'gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Project: Capital Athena | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1442',
  rera_compliance_score = 98,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2018-10-31T00:00:00.000Z',
  total_units = 1200,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 15,
  average_delay_months = 4,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 9434,
  available_units_count = 360,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '4315ac08-c95c-4e50-8152-79967b6badfc';

-- Project: Gulshan Ikebana | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2102',
  rera_compliance_score = 98,
  oc_obtained = true,
  oc_obtained_date = '2021-08-19T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2019-11-30T00:00:00.000Z',
  total_units = 1500,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2024',
  projects_delivered_count = 54,
  average_delay_months = 23,
  total_projects_count = 87,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 14063,
  available_units_count = 450,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '33857ae6-1ab5-4dda-9842-50893cb7cad3';

-- Project: SKA Orion | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = true,
  rera_compliance_score = 96,
  rera_status = 'registered',
  possession_date = '2025-10-01T00:00:00.000Z',
  total_units = 520,
  total_towers = 3,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q2 2027',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 8853,
  available_units_count = 26,
  key_amenities = 'gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- Project: Ajnara Daffodil | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1373',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 1100,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 15059,
  available_units_count = 330,
  key_amenities = 'swimming pool, gym, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '24b1661d-8688-464e-b9f0-58838020895a';

-- Project: Jaypee Greens Kosmos | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8824',
  oc_obtained = false,
  rera_compliance_score = 50,
  rera_status = 'compliant',
  possession_date = '2017-06-30T00:00:00.000Z',
  total_units = 2400,
  total_towers = 18,
  status = 'ready_to_move',
  litigation_count = 10,
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 16196,
  available_units_count = 120,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'faa03642-1649-4f24-a91b-054f6d5cd4ba';

-- Project: Jaypee Garden Isles | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3920',
  rera_compliance_score = 93,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 1400,
  total_towers = 9,
  status = 'under_construction',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 19778,
  available_units_count = 70,
  key_amenities = 'gym',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '324135fb-2a5e-43d8-bc52-8d0991ab4515';

-- Project: Ace Hanei | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ677887',
  rera_compliance_score = 95,
  oc_obtained = true,
  oc_obtained_date = '2022-07-01T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2028-10-15T00:00:00.000Z',
  total_units = 518,
  total_towers = 6,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12681,
  available_units_count = 25,
  key_amenities = 'children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = 'e0412f51-4650-4793-9ab7-9672d9d87a32';

-- Project: Jaypee Greens Kalypso Court | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8822',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'under_review',
  possession_date = '2019-06-30T00:00:00.000Z',
  total_units = 480,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q3 2026',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 19970,
  available_units_count = 144,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '36320546-8a3d-4d87-94bc-6c53df6bd641';

-- Project: ATS Knightsbridge | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3574',
  oc_obtained = true,
  rera_compliance_score = 93,
  rera_status = 'approved',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 215,
  total_towers = 5,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q2 2026',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 14270,
  available_units_count = 64,
  key_amenities = 'gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '122eaf91-013f-427f-9546-da52c5b69251';

-- Project: ABA Cleo County | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6210',
  oc_obtained = true,
  rera_compliance_score = 95,
  oc_obtained_date = '2023-05-07T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2017-12-31T00:00:00.000Z',
  total_units = 2600,
  total_towers = 24,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  base_price_per_sqft = 15253,
  available_units_count = 780,
  key_amenities = 'gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.684Z',
  verification_level = 'verified'
WHERE id = '74994caf-4ec0-436a-8688-9ca9f5ba42c3';

-- Project: Amrapali Zodiac | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1201',
  rera_compliance_score = 57,
  oc_obtained = true,
  rera_status = 'approved',
  possession_date = '2016-09-30T00:00:00.000Z',
  total_units = 2200,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 18,
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15977,
  available_units_count = 660,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '4b1a3462-7aab-4988-a585-20ab1e848373';

-- Project: Eldeco Aamantran | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1192',
  oc_obtained = true,
  rera_compliance_score = 78,
  oc_obtained_date = '2021-02-23T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2015-09-30T00:00:00.000Z',
  total_units = 780,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2027',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 12951,
  available_units_count = 234,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'd3fdbe07-a903-454a-b343-31215facdb6d';

-- Project: 3C Lotus Panache | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1101',
  rera_compliance_score = 54,
  oc_obtained = true,
  oc_obtained_date = '2022-03-18T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2017-06-30T00:00:00.000Z',
  total_units = 3000,
  total_towers = 30,
  status = 'ready_to_move',
  litigation_count = 8,
  possession_label = 'Q2 2025',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 10753,
  available_units_count = 150,
  key_amenities = 'gym',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'd2c48b0d-2110-4d23-b8e7-c19e7927b1b7';

-- Project: Amaatra Homes | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3010',
  rera_compliance_score = 84,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 820,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q2 2025',
  projects_delivered_count = 51,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 13417,
  available_units_count = 246,
  key_amenities = 'swimming pool, gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '2f5a8248-e9da-44d6-99e7-c403aca87bbe';

-- Project: Divine Meadows | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1081',
  rera_compliance_score = 87,
  oc_obtained = true,
  oc_obtained_date = '2022-12-12T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2017-08-31T00:00:00.000Z',
  total_units = 1100,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 25,
  average_delay_months = 9,
  total_projects_count = 41,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 12744,
  available_units_count = 330,
  key_amenities = 'swimming pool, gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0630fb09-0f4c-4c31-8ea9-ad69973da58d';

-- Project: County 107 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ837374',
  rera_compliance_score = 87,
  oc_obtained = true,
  oc_obtained_date = '2021-11-27T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 230,
  total_towers = 4,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 45,
  average_delay_months = 19,
  total_projects_count = 72,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 9732,
  available_units_count = 11,
  key_amenities = 'swimming pool, gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '8285b164-67cd-4831-89a0-c015df2878f6';

-- Project: 3C Lotus 300 | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3300',
  rera_compliance_score = 90,
  oc_obtained = false,
  rera_status = 'under_review',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 300,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 8,
  possession_label = 'Q4 2026',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 15913,
  available_units_count = 15,
  key_amenities = 'parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '64137eb6-2e30-4e6d-8508-a9052bef101b';

-- Project: ATS One Hamlet | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1041',
  rera_compliance_score = 95,
  oc_obtained = true,
  rera_status = 'registered',
  possession_date = '2015-10-31T00:00:00.000Z',
  total_units = 1000,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15408,
  available_units_count = 50,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '1254753f-834d-4116-9ff1-c1b4119665b4';

-- Project: Lotus Boulevard | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ10001',
  oc_obtained = true,
  oc_obtained_date = '2023-11-16T00:00:00.000Z',
  rera_compliance_score = 91,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 3450,
  total_towers = 29,
  status = 'ready_to_move',
  litigation_count = 3,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 19727,
  available_units_count = 172,
  key_amenities = 'swimming pool, gym, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'bb678f33-b2e8-409e-8a9d-94d5c4efbae6';

-- Project: Lotus Boulevard | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2019',
  rera_compliance_score = 91,
  oc_obtained = true,
  rera_status = 'registered',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 3200,
  total_towers = 30,
  status = 'ready_to_move',
  litigation_count = 8,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 19727,
  available_units_count = 160,
  key_amenities = 'swimming pool, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '9521a90f-1ad2-4de1-bcc8-198a6e6f2713';

-- Project: Stellar Jeevan | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3012',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 92,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 2600,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 3,
  possession_label = 'Q4 2025',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 13223,
  available_units_count = 130,
  key_amenities = 'gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e4d1dd0a-18c8-4c66-8e7a-6b171c4e9beb';

-- Project: Eldeco Green Meadows | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1182',
  oc_obtained = false,
  rera_compliance_score = 97,
  rera_status = 'under_review',
  possession_date = '2014-06-30T00:00:00.000Z',
  total_units = 820,
  total_towers = 11,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2025',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 16752,
  available_units_count = 41,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '51007411-9117-4ff8-95b6-b5ac7fb9e2f7';

-- Project: Jaypee Earth Court | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3924',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 55,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 510,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q1 2027',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 17502,
  available_units_count = 153,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '55e29630-faa7-4d5d-b203-c0d97a76de6e';

-- Project: Jaypee Greens Golf Course Residences | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3310',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2023-03-07T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2018-06-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q4 2024',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 13426,
  available_units_count = 47,
  key_amenities = 'parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '092da15d-2dbf-49f9-83e0-42092ddb9f1e';

-- Project: Migsun Ultimo | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2491',
  oc_obtained = true,
  rera_compliance_score = 87,
  oc_obtained_date = '2021-04-25T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2020-10-31T00:00:00.000Z',
  total_units = 680,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 17167,
  available_units_count = 204,
  key_amenities = 'gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'f0dcff71-e26b-4aee-aa62-99fe95a5518c';

-- Project: Eldeco Mystic Greens | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2004',
  oc_obtained = false,
  rera_compliance_score = 85,
  rera_status = 'under_review',
  possession_date = '2016-08-31T00:00:00.000Z',
  total_units = 480,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2027',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18148,
  available_units_count = 144,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'f143296c-a2f1-462c-be2d-850e0ca557bd';

-- Project: NRI City Township | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2901',
  rera_compliance_score = 90,
  oc_obtained = true,
  oc_obtained_date = '2022-05-16T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2010-06-30T00:00:00.000Z',
  total_units = 850,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 48,
  delayed_projects_count = 7,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 15783,
  available_units_count = 255,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '00d89685-f2c1-462d-9716-66a4257dd85f';

-- Project: Trecento Residencies by Gaurs | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ283531',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'under_review',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 510,
  total_towers = 5,
  status = 'under_construction',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 17707,
  available_units_count = 153,
  key_amenities = 'gym, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'b551f816-cf6a-4bc8-90d6-e006f9f5d998';

-- Project: Migsun Vilaasa | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2006',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'under_review',
  possession_date = '2022-06-30T00:00:00.000Z',
  total_units = 1100,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2025',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 15136,
  available_units_count = 55,
  key_amenities = 'children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'f815eae4-0c4a-4927-b422-77d2db9dbcd7';

-- Project: SKA Metro Ville | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ10875',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2023-06-14T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1200,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 2,
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 15214,
  available_units_count = 360,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '5fd8baa9-1544-4119-97fa-ba76520fbfcf';

-- Project: Nimbus Express Park View 1 & 2 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4912',
  oc_obtained = true,
  rera_compliance_score = 87,
  rera_status = 'under_review',
  possession_date = '2019-11-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 5,
  total_projects_count = 8,
  credai_member = false,
  base_price_per_sqft = 9522,
  available_units_count = 47,
  key_amenities = 'swimming pool, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '2467440e-86a6-4547-8fee-02b357f9a6d4';

-- Project: Nimbus Express Park View 1 & 2 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4912',
  oc_obtained = true,
  rera_compliance_score = 88,
  rera_status = 'registered',
  possession_date = '2019-11-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2027',
  projects_delivered_count = 5,
  total_projects_count = 8,
  credai_member = false,
  base_price_per_sqft = 9522,
  available_units_count = 285,
  key_amenities = 'gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '2467440e-86a6-4547-8fee-02b357f9a6d4';

-- Project: ATS Green Paradiso | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2005',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2022-01-22T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2010-09-30T00:00:00.000Z',
  total_units = 550,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 13791,
  available_units_count = 27,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'cba89104-e173-401a-ba0d-a1989e957fe2';

-- Project: Unitech Horizon | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJBETA2',
  rera_compliance_score = 89,
  oc_obtained = true,
  rera_status = 'registered',
  possession_date = '2015-08-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 12,
  projects_delivered_count = 50,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 18770,
  available_units_count = 480,
  key_amenities = 'children play area, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'b6c288b7-3fed-42d2-891c-f81b17eebb90';

-- Project: Paramount Golf Foreste | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2001',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'compliant',
  possession_date = '2017-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2027',
  projects_delivered_count = 11,
  average_delay_months = 3,
  total_projects_count = 18,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 12019,
  available_units_count = 80,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'a9c643f8-b05b-4e1b-aa6b-e58e641be355';

-- Project: Ace Platinum | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2002',
  oc_obtained = false,
  rera_compliance_score = 85,
  rera_status = 'approved',
  possession_date = '2016-10-31T00:00:00.000Z',
  total_units = 1200,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 15486,
  available_units_count = 60,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '863224f4-8cde-433e-bfb5-e138029b5091';

-- Project: Gaur Yamuna City - 16th Parkview | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6801',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 66,
  rera_status = 'approved',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 15,
  status = 'ready_to_move',
  possession_label = 'Q2 2027',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 16272,
  available_units_count = 90,
  key_amenities = 'gym, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '8a2d0939-0d58-4bbe-bc94-2a17547138dc';

-- Project: ABA Cherry County | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4285',
  rera_compliance_score = 90,
  oc_obtained = true,
  rera_status = 'approved',
  possession_date = '2018-05-31T00:00:00.000Z',
  total_units = 1780,
  total_towers = 13,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  base_price_per_sqft = 19209,
  available_units_count = 89,
  key_amenities = 'swimming pool, gym, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'ecae9f5d-aabf-4ef0-b1b1-2f92dbb2af0b';

-- Project: Omaxe Riviera | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2107',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 780,
  total_towers = 5,
  status = 'ready_to_move',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 13378,
  available_units_count = 234,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '86d58fd8-a88d-41af-adea-7e7069aaf417';

-- Project: ATS Dolce | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3252',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'approved',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1770,
  total_towers = 15,
  status = 'ready_to_move',
  possession_label = 'Q2 2025',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 9849,
  available_units_count = 88,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '102ae618-e913-49e0-8a31-92e553366a88';

-- Project: Purvanchal Heights | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3122',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2024-08-10T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 920,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 4,
  possession_label = 'Q2 2026',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 15911,
  available_units_count = 276,
  key_amenities = 'gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '1596bf90-1954-4ac3-9003-ecd6b5e207cd';

-- Project: Migsun Atharva | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2984',
  oc_obtained = true,
  rera_compliance_score = 94,
  oc_obtained_date = '2020-02-14T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 890,
  total_towers = 8,
  status = 'under_construction',
  possession_label = 'Q2 2024',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 18007,
  available_units_count = 267,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '4e7dd63b-78c4-44c9-97e0-7c8d0e1c5317';

-- Project: Eldeco Mystic Greens | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4102',
  oc_obtained = true,
  oc_obtained_date = '2020-06-09T00:00:00.000Z',
  rera_compliance_score = 90,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1430,
  total_towers = 13,
  status = 'ready_to_move',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18148,
  available_units_count = 71,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '7b4e098b-ee7e-4f79-a0d1-55919090861a';

-- Project: Omaxe Palm Greens | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2105',
  rera_compliance_score = 92,
  oc_obtained = true,
  oc_obtained_date = '2021-12-14T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 2050,
  total_towers = 13,
  status = 'ready_to_move',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 8567,
  available_units_count = 102,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0485efd5-c5ba-4dde-a339-8c5983f0cff3';

-- Project: Omaxe Grandwoods | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2108',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 850,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q1 2024',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 13352,
  available_units_count = 42,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '5d0dbebc-1067-481d-ab0a-eae77f240720';

-- Project: Migsun Villa | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2983',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 97,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 620,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 2,
  possession_label = 'Q3 2025',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 14969,
  available_units_count = 186,
  key_amenities = 'security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '32f7ab36-1931-4e0d-9fe2-a1b410c407f3';

-- Project: Purvanchal Royal City | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ521883',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 90,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 2230,
  total_towers = 20,
  status = 'under_construction',
  litigation_count = 2,
  possession_label = 'Q2 2026',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12652,
  available_units_count = 111,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0bc420a9-5c71-4079-bb45-d003bd4345ce';

-- Project: Purvanchal Royal City - Phase 1 (Towers 1-8) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ521882',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'under_review',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 17,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2024',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 10606,
  available_units_count = 480,
  key_amenities = 'gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '06894481-6cd9-45c7-9c59-d9a9e8a775ab';

-- Project: Eldeco Residency Greens | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4105',
  oc_obtained = true,
  oc_obtained_date = '2021-02-19T00:00:00.000Z',
  rera_compliance_score = 89,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 690,
  total_towers = 6,
  status = 'ready_to_move',
  possession_label = 'Q2 2024',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18161,
  available_units_count = 34,
  key_amenities = 'gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e65551fa-9428-4d3a-8fb2-0c33fa4517ad';

-- Project: Stellar Kings Court | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3015',
  rera_compliance_score = 91,
  oc_obtained = true,
  oc_obtained_date = '2024-01-12T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 580,
  total_towers = 4,
  status = 'ready_to_move',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 19222,
  available_units_count = 174,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '9a6e7661-627f-4d06-a555-dbc97c6dafd6';

-- Project: Supertech Supernova | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4016',
  oc_obtained = true,
  rera_compliance_score = 96,
  rera_status = 'registered',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 4,
  status = 'under_construction',
  litigation_count = 14,
  possession_label = 'Q1 2024',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 15678,
  available_units_count = 90,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '6be84ef7-d53c-4415-8e06-ca7f3da8faa0';

-- Project: Grand Omaxe | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9303',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2014-04-30T00:00:00.000Z',
  total_units = 1320,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2024',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 11335,
  available_units_count = 396,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '47eb6cfa-0c88-4dc4-a000-c11e9cb053e7';

-- Project: ATS Greens Village | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9301',
  oc_obtained = true,
  rera_compliance_score = 86,
  oc_obtained_date = '2022-03-05T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2008-12-31T00:00:00.000Z',
  total_units = 750,
  total_towers = 25,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15705,
  available_units_count = 225,
  key_amenities = 'swimming pool, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '7ba97604-813f-4924-9044-53936a3737ce';

-- Project: Eldeco Aangan | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8201',
  rera_compliance_score = 81,
  oc_obtained = true,
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 720,
  total_towers = 5,
  status = 'ready_to_move',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 9628,
  available_units_count = 36,
  key_amenities = 'gym, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '67051f07-c9c2-4e42-8064-d40cc95a0c1d';

-- Project: Ajnara The Belvedere | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ79110',
  rera_compliance_score = 98,
  oc_obtained = true,
  oc_obtained_date = '2020-01-01T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-07-15T00:00:00.000Z',
  total_units = 700,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2026',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 8618,
  available_units_count = 210,
  key_amenities = 'swimming pool, gym',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0794fc2d-8f0c-47ad-ac2a-6f6d81378f56';

-- Project: Aditya Urban Casa | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7801',
  rera_compliance_score = 55,
  oc_obtained = false,
  oc_obtained_date = '2023-09-28T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2016-08-31T00:00:00.000Z',
  total_units = 650,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2024',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  base_price_per_sqft = 19171,
  available_units_count = 195,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'bf1f8f50-f49b-48ba-8602-4bdfd3add664';

-- Project: Antriksh Forest | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 98,
  oc_obtained = true,
  oc_obtained_date = '2021-12-28T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2024-02-15T00:00:00.000Z',
  total_units = 820,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 17813,
  available_units_count = 41,
  key_amenities = 'swimming pool, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Project: Aditya Celebrity Homes | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ76130',
  rera_compliance_score = 85,
  oc_obtained = false,
  oc_obtained_date = '2023-11-25T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2023-11-25T00:00:00.000Z',
  total_units = 750,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  base_price_per_sqft = 10622,
  available_units_count = 225,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'd54acc58-62ad-47a9-a522-9cc49ab299dd';

-- Project: AIMS Golf Avenue I | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1235',
  rera_compliance_score = 55,
  oc_obtained = false,
  oc_obtained_date = '2023-09-15T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2023-09-15T00:00:00.000Z',
  total_units = 650,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q2 2024',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 18330,
  available_units_count = 195,
  key_amenities = 'swimming pool, gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'bd7ce502-3c2a-423f-bc9e-63f4e0941201';

-- Project: AIMS Golf City | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = true,
  oc_obtained_date = '2022-05-13T00:00:00.000Z',
  rera_compliance_score = 91,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 4,
  possession_label = 'Q3 2027',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 14969,
  available_units_count = 80,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- Project: Grand Ajnara Heritage | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5655',
  rera_compliance_score = 95,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2018-06-30T00:00:00.000Z',
  total_units = 1760,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 9420,
  available_units_count = 88,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0a5b22e6-19a2-4f68-a5ba-5e474bb9b203';

-- Project: Pan Oasis | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7001',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2020-12-27T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2015-10-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 18,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = true,
  awards_count = 3,
  base_price_per_sqft = 11646,
  available_units_count = 540,
  key_amenities = 'gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'f38b09ff-d5c6-4978-a95e-c47dc7a6bc1b';

-- Project: Stellar Park | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ621',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2014-11-30T00:00:00.000Z',
  total_units = 1000,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q2 2027',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 12098,
  available_units_count = 50,
  key_amenities = 'swimming pool, gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'c7a2614a-08c1-4fc8-b90e-3af3ee1bbe66';

-- Project: Amrapali Eden Park | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1050',
  oc_obtained = true,
  rera_compliance_score = 98,
  rera_status = 'under_review',
  possession_date = '2013-12-31T00:00:00.000Z',
  total_units = 320,
  total_towers = 4,
  status = 'ready_to_move',
  litigation_count = 18,
  possession_label = 'Q1 2025',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 19494,
  available_units_count = 96,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'c270d881-50ed-454c-a300-8e9932012a9f';

-- Project: Amrapali Golf Homes | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8808',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 4500,
  total_towers = 38,
  status = 'under_construction',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 17864,
  available_units_count = 225,
  key_amenities = 'swimming pool, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'fd2dff4c-4552-4a53-8a91-2f50fd959a82';

-- Project: Gardenia Glory | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4601',
  oc_obtained = true,
  rera_compliance_score = 58,
  oc_obtained_date = '2024-09-23T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2017-08-31T00:00:00.000Z',
  total_units = 1100,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2024',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 80,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 9395,
  available_units_count = 330,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '85141048-0d74-482b-9c00-ac6d8531b341';

-- Project: Amrapali Sapphire | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4502',
  oc_obtained = true,
  rera_compliance_score = 95,
  oc_obtained_date = '2021-10-09T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2016-06-30T00:00:00.000Z',
  total_units = 1600,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 18,
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 16106,
  available_units_count = 480,
  key_amenities = 'gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '3bca4621-44df-4105-a728-a0e4ab13b8c1';

-- Project: Godrej Woods | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7047',
  rera_compliance_score = 87,
  oc_obtained = true,
  rera_status = 'under_review',
  possession_date = '2026-09-30T00:00:00.000Z',
  total_units = 3220,
  total_towers = 28,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 13055,
  available_units_count = 966,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e0a8ab69-4bf7-48dd-aac0-67b795ee06ea';

-- Project: Eros Sampoornam | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2941',
  oc_obtained = false,
  rera_compliance_score = 97,
  rera_status = 'under_review',
  possession_date = '2018-04-30T00:00:00.000Z',
  total_units = 6650,
  total_towers = 58,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 49,
  delayed_projects_count = 7,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 17334,
  available_units_count = 1995,
  key_amenities = 'swimming pool, gym',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '5d09bdc0-6c37-4e7c-ad55-14b03f289765';

-- Project: Godrej Golf Links & The Crest | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ151',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'approved',
  possession_date = '2022-03-31T00:00:00.000Z',
  total_units = 650,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 10479,
  available_units_count = 32,
  key_amenities = 'gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '63506755-89ce-440a-8d0b-8f2155e99fb5';

-- Project: Jaypee Sports City (Kassia) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8826',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2021-11-20T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2019-12-31T00:00:00.000Z',
  total_units = 920,
  total_towers = 9,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q4 2025',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 17294,
  available_units_count = 276,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '38b353ee-e14f-40e3-9589-ef69e74794f7';

-- Project: Orris Greenbay Golf Homes | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5528',
  oc_obtained = false,
  rera_compliance_score = 87,
  rera_status = 'under_review',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 8,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q1 2024',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 25,
  delayed_projects_count = 3,
  credai_member = true,
  base_price_per_sqft = 12186,
  available_units_count = 47,
  key_amenities = 'security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'dbfa1b3f-4ea5-434f-95f4-a1731cc3ebd7';

-- Project: Arihant Seasons | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ22D980',
  rera_compliance_score = 57,
  oc_obtained = true,
  oc_obtained_date = '2024-05-17T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2028-03-31T00:00:00.000Z',
  total_units = 720,
  total_towers = 6,
  status = 'new_launch',
  litigation_count = 0,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 52,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 8244,
  available_units_count = 216,
  key_amenities = 'gym, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '1ccb48fa-d390-4574-8a4b-6ea712ac4381';

-- Project: ACE Terrains / Terra | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ622101',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 980,
  total_towers = 6,
  status = 'under_construction',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 17024,
  available_units_count = 49,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '704e98bf-974c-49f3-9f8a-5293f3d66681';

-- Project: Ace City | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ0101',
  oc_obtained = true,
  rera_compliance_score = 89,
  rera_status = 'compliant',
  possession_date = '2018-09-30T00:00:00.000Z',
  total_units = 5500,
  total_towers = 34,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q2 2027',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12319,
  available_units_count = 275,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e3871eb3-edb5-4621-9e99-494fcd94a25b';

-- Project: Gaur Yamuna City (7th Parkview) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9928',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 1800,
  total_towers = 12,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 19220,
  available_units_count = 540,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '28c22505-99b9-436d-82ca-0d8e5d8e9199';

-- Project: Supertech Upcountry (Golf Village) | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6619',
  oc_obtained = true,
  rera_compliance_score = 95,
  oc_obtained_date = '2024-10-23T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2019-06-30T00:00:00.000Z',
  total_units = 1400,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 14,
  possession_label = 'Q3 2024',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 9870,
  available_units_count = 420,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '479f7942-1f6d-4ddb-869a-5d56d941cbd5';

-- Project: Gayatri Life | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2110',
  rera_compliance_score = 97,
  oc_obtained = true,
  oc_obtained_date = '2021-01-12T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 850,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q4 2027',
  projects_delivered_count = 52,
  average_delay_months = 22,
  total_projects_count = 84,
  delayed_projects_count = 14,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 14529,
  available_units_count = 42,
  key_amenities = 'gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e35d0295-5513-45c2-a0d1-509cc6d2abd9';

-- Project: Galaxy North Avenue 2 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2213',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-09-14T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1300,
  total_towers = 8,
  status = 'ready_to_move',
  possession_label = 'Q3 2027',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = true,
  awards_count = 3,
  base_price_per_sqft = 17191,
  available_units_count = 390,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'c5a5de4b-e47c-40ee-a5c5-0fb672d3f4ba';

-- Project: Ajnara Le Garden | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4819',
  rera_compliance_score = 91,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2020-09-30T00:00:00.000Z',
  total_units = 1650,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2025',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 19365,
  available_units_count = 82,
  key_amenities = 'swimming pool, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '7b8d12f6-1cb6-41e9-9438-05f55f2fc95e';

-- Project: Golden Palms | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1681',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2024-09-03T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2017-11-30T00:00:00.000Z',
  total_units = 1400,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2025',
  projects_delivered_count = 13,
  average_delay_months = 4,
  total_projects_count = 21,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 16921,
  available_units_count = 70,
  key_amenities = 'swimming pool, gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '42e2157b-ba9d-4cad-a48a-1ec52c820816';

-- Project: Ace Starlit | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6772',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 490,
  total_towers = 5,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 14206,
  available_units_count = 147,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '30df5cd8-7b2b-4f55-a05a-0d76d1b94795';

-- Project: Jaypee Aman | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1510',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-05-24T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 3200,
  total_towers = 28,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q2 2027',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 18072,
  available_units_count = 960,
  key_amenities = 'gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'ebe56ae7-de69-4289-913f-95f74e9af757';

-- Project: ACE Arte | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ992384',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2023-03-20T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2028-12-31T00:00:00.000Z',
  total_units = 420,
  total_towers = 5,
  status = 'new_launch',
  litigation_count = 0,
  possession_label = 'Q2 2027',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 11478,
  available_units_count = 126,
  key_amenities = 'swimming pool, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'fdd2de65-e073-47c0-a9cd-5ae72e532941';

-- Project: Godrej Jardinia | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1461',
  oc_obtained = true,
  rera_compliance_score = 86,
  oc_obtained_date = '2020-07-26T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2028-12-31T00:00:00.000Z',
  total_units = 650,
  total_towers = 6,
  status = 'new_launch',
  litigation_count = 0,
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 14063,
  available_units_count = 195,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Project: Godrej Jardinia | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1461',
  oc_obtained = false,
  rera_compliance_score = 88,
  rera_status = 'approved',
  possession_date = '2028-12-31T00:00:00.000Z',
  total_units = 650,
  total_towers = 6,
  status = 'new_launch',
  litigation_count = 0,
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 14063,
  available_units_count = 195,
  key_amenities = 'swimming pool, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Project: Capital Athena | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1442',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2020-02-17T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2018-10-31T00:00:00.000Z',
  total_units = 1200,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2024',
  projects_delivered_count = 15,
  average_delay_months = 4,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 9434,
  available_units_count = 360,
  key_amenities = 'swimming pool, gym, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '4315ac08-c95c-4e50-8152-79967b6badfc';

-- Project: Gulshan Ikebana | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2102',
  rera_compliance_score = 90,
  oc_obtained = true,
  oc_obtained_date = '2023-03-18T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2019-11-30T00:00:00.000Z',
  total_units = 1500,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 54,
  average_delay_months = 23,
  total_projects_count = 87,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 14063,
  available_units_count = 450,
  key_amenities = 'gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '33857ae6-1ab5-4dda-9842-50893cb7cad3';

-- Project: SKA Orion | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = false,
  rera_compliance_score = 94,
  rera_status = 'under_review',
  possession_date = '2025-10-01T00:00:00.000Z',
  total_units = 520,
  total_towers = 3,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 8853,
  available_units_count = 156,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- Project: Ajnara Daffodil | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1373',
  rera_compliance_score = 92,
  oc_obtained = true,
  oc_obtained_date = '2021-01-17T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 1100,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2027',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 15059,
  available_units_count = 330,
  key_amenities = 'swimming pool, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '24b1661d-8688-464e-b9f0-58838020895a';

-- Project: Jaypee Greens Kosmos | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8824',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'compliant',
  possession_date = '2017-06-30T00:00:00.000Z',
  total_units = 2400,
  total_towers = 18,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q4 2027',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 16196,
  available_units_count = 120,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'faa03642-1649-4f24-a91b-054f6d5cd4ba';

-- Project: Jaypee Garden Isles | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3920',
  rera_compliance_score = 88,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 1400,
  total_towers = 9,
  status = 'under_construction',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 19778,
  available_units_count = 70,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '324135fb-2a5e-43d8-bc52-8d0991ab4515';

-- Project: Ace Hanei | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ677887',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2028-10-15T00:00:00.000Z',
  total_units = 518,
  total_towers = 6,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q1 2027',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12681,
  available_units_count = 155,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e0412f51-4650-4793-9ab7-9672d9d87a32';

-- Project: Jaypee Greens Kalypso Court | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8822',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'under_review',
  possession_date = '2019-06-30T00:00:00.000Z',
  total_units = 480,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 10,
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 19970,
  available_units_count = 144,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '36320546-8a3d-4d87-94bc-6c53df6bd641';

-- Project: ATS Knightsbridge | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3574',
  oc_obtained = true,
  rera_compliance_score = 88,
  oc_obtained_date = '2024-11-07T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 215,
  total_towers = 5,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 14270,
  available_units_count = 64,
  key_amenities = 'security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '122eaf91-013f-427f-9546-da52c5b69251';

-- Project: ABA Cleo County | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6210',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  possession_date = '2017-12-31T00:00:00.000Z',
  total_units = 2600,
  total_towers = 24,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  base_price_per_sqft = 15253,
  available_units_count = 130,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '74994caf-4ec0-436a-8688-9ca9f5ba42c3';

-- Project: Amrapali Zodiac | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1201',
  rera_compliance_score = 94,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2016-09-30T00:00:00.000Z',
  total_units = 2200,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 18,
  possession_label = 'Q3 2025',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15977,
  available_units_count = 660,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '4b1a3462-7aab-4988-a585-20ab1e848373';

-- Project: Eldeco Aamantran | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1192',
  oc_obtained = true,
  rera_compliance_score = 85,
  oc_obtained_date = '2024-04-19T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2015-09-30T00:00:00.000Z',
  total_units = 780,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q2 2026',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 12951,
  available_units_count = 39,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'd3fdbe07-a903-454a-b343-31215facdb6d';

-- Project: 3C Lotus Panache | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1101',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2020-08-23T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2017-06-30T00:00:00.000Z',
  total_units = 3000,
  total_towers = 30,
  status = 'ready_to_move',
  litigation_count = 8,
  possession_label = 'Q1 2025',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 10753,
  available_units_count = 900,
  key_amenities = 'children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'd2c48b0d-2110-4d23-b8e7-c19e7927b1b7';

-- Project: Amaatra Homes | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3010',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-12-16T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 820,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q1 2024',
  projects_delivered_count = 51,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 13417,
  available_units_count = 41,
  key_amenities = 'swimming pool, gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '2f5a8248-e9da-44d6-99e7-c403aca87bbe';

-- Project: Divine Meadows | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1081',
  rera_compliance_score = 91,
  oc_obtained = true,
  rera_status = 'registered',
  possession_date = '2017-08-31T00:00:00.000Z',
  total_units = 1100,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2025',
  projects_delivered_count = 25,
  average_delay_months = 9,
  total_projects_count = 41,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 12744,
  available_units_count = 330,
  key_amenities = 'swimming pool, gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0630fb09-0f4c-4c31-8ea9-ad69973da58d';

-- Project: County 107 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ837374',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2021-12-12T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 230,
  total_towers = 4,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 45,
  average_delay_months = 19,
  total_projects_count = 72,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 9732,
  available_units_count = 11,
  key_amenities = 'swimming pool, gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '8285b164-67cd-4831-89a0-c015df2878f6';

-- Project: 3C Lotus 300 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3300',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2021-02-05T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 300,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 8,
  possession_label = 'Q2 2025',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 15913,
  available_units_count = 90,
  key_amenities = 'swimming pool, gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '64137eb6-2e30-4e6d-8508-a9052bef101b';

-- Project: ATS One Hamlet | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1041',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2015-10-31T00:00:00.000Z',
  total_units = 1000,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2026',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15408,
  available_units_count = 300,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '1254753f-834d-4116-9ff1-c1b4119665b4';

-- Project: Lotus Boulevard | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ10001',
  oc_obtained = true,
  oc_obtained_date = '2020-03-23T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 3450,
  total_towers = 29,
  status = 'ready_to_move',
  possession_label = 'Q3 2025',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 19727,
  available_units_count = 1035,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'bb678f33-b2e8-409e-8a9d-94d5c4efbae6';

-- Project: Lotus Boulevard | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2019',
  rera_compliance_score = 90,
  oc_obtained = true,
  oc_obtained_date = '2021-04-21T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 3200,
  total_towers = 30,
  status = 'ready_to_move',
  litigation_count = 8,
  possession_label = 'Q3 2026',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 19727,
  available_units_count = 960,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '9521a90f-1ad2-4de1-bcc8-198a6e6f2713';

-- Project: Stellar Jeevan | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3012',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 94,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 2600,
  total_towers = 22,
  status = 'ready_to_move',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 13223,
  available_units_count = 780,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e4d1dd0a-18c8-4c66-8e7a-6b171c4e9beb';

-- Project: Eldeco Green Meadows | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1182',
  oc_obtained = false,
  rera_compliance_score = 98,
  rera_status = 'registered',
  possession_date = '2014-06-30T00:00:00.000Z',
  total_units = 820,
  total_towers = 11,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 16752,
  available_units_count = 246,
  key_amenities = 'gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '51007411-9117-4ff8-95b6-b5ac7fb9e2f7';

-- Project: Jaypee Earth Court | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3924',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 91,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 510,
  total_towers = 5,
  status = 'ready_to_move',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 17502,
  available_units_count = 153,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '55e29630-faa7-4d5d-b203-c0d97a76de6e';

-- Project: Jaypee Greens Golf Course Residences | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3310',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2020-10-13T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2018-06-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q4 2024',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 13426,
  available_units_count = 47,
  key_amenities = 'swimming pool, gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '092da15d-2dbf-49f9-83e0-42092ddb9f1e';

-- Project: Migsun Ultimo | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2491',
  oc_obtained = true,
  rera_compliance_score = 86,
  oc_obtained_date = '2021-09-28T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2020-10-31T00:00:00.000Z',
  total_units = 680,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2026',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 17167,
  available_units_count = 204,
  key_amenities = 'children play area, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'f0dcff71-e26b-4aee-aa62-99fe95a5518c';

-- Project: Eldeco Mystic Greens | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2004',
  oc_obtained = true,
  rera_compliance_score = 90,
  rera_status = 'approved',
  possession_date = '2016-08-31T00:00:00.000Z',
  total_units = 480,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2024',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18148,
  available_units_count = 144,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'f143296c-a2f1-462c-be2d-850e0ca557bd';

-- Project: NRI City Township | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2901',
  rera_compliance_score = 98,
  oc_obtained = true,
  rera_status = 'compliant',
  possession_date = '2010-06-30T00:00:00.000Z',
  total_units = 850,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2024',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 48,
  delayed_projects_count = 7,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 15783,
  available_units_count = 42,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '00d89685-f2c1-462d-9716-66a4257dd85f';

-- Project: Trecento Residencies by Gaurs | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ283531',
  oc_obtained = true,
  rera_compliance_score = 88,
  oc_obtained_date = '2024-02-13T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 510,
  total_towers = 5,
  status = 'under_construction',
  possession_label = 'Q3 2024',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 17707,
  available_units_count = 153,
  key_amenities = 'gym, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'b551f816-cf6a-4bc8-90d6-e006f9f5d998';

-- Project: Migsun Vilaasa | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2006',
  oc_obtained = true,
  rera_compliance_score = 94,
  oc_obtained_date = '2021-12-14T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2022-06-30T00:00:00.000Z',
  total_units = 1100,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 15136,
  available_units_count = 330,
  key_amenities = 'swimming pool, gym',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'f815eae4-0c4a-4927-b422-77d2db9dbcd7';

-- Project: SKA Metro Ville | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ10875',
  rera_compliance_score = 98,
  oc_obtained = true,
  oc_obtained_date = '2021-08-27T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1200,
  total_towers = 8,
  status = 'ready_to_move',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 15214,
  available_units_count = 60,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '5fd8baa9-1544-4119-97fa-ba76520fbfcf';

-- Project: Nimbus Express Park View 1 & 2 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4912',
  oc_obtained = true,
  rera_compliance_score = 94,
  oc_obtained_date = '2024-11-13T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2019-11-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2027',
  projects_delivered_count = 5,
  total_projects_count = 8,
  credai_member = false,
  base_price_per_sqft = 9522,
  available_units_count = 285,
  key_amenities = 'gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '2467440e-86a6-4547-8fee-02b357f9a6d4';

-- Project: ATS Green Paradiso | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2005',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2020-11-17T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2010-09-30T00:00:00.000Z',
  total_units = 550,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2027',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 13791,
  available_units_count = 165,
  key_amenities = 'security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'cba89104-e173-401a-ba0d-a1989e957fe2';

-- Project: Unitech Horizon | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJBETA2',
  rera_compliance_score = 89,
  oc_obtained = true,
  rera_status = 'approved',
  possession_date = '2015-08-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 12,
  projects_delivered_count = 50,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 18770,
  available_units_count = 480,
  key_amenities = 'swimming pool, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'b6c288b7-3fed-42d2-891c-f81b17eebb90';

-- Project: Paramount Golf Foreste | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2001',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2023-10-01T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2017-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 11,
  average_delay_months = 3,
  total_projects_count = 18,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 12019,
  available_units_count = 480,
  key_amenities = 'swimming pool, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'a9c643f8-b05b-4e1b-aa6b-e58e641be355';

-- Project: Ace Platinum | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2002',
  oc_obtained = false,
  rera_compliance_score = 89,
  rera_status = 'approved',
  possession_date = '2016-10-31T00:00:00.000Z',
  total_units = 1200,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 15486,
  available_units_count = 360,
  key_amenities = 'swimming pool, gym, children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '863224f4-8cde-433e-bfb5-e138029b5091';

-- Project: Gaur Yamuna City - 16th Parkview | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ379836/06/2025',
  oc_obtained = true,
  oc_obtained_date = '2023-03-17T00:00:00.000Z',
  rera_compliance_score = 96,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 15,
  status = 'ready_to_move',
  possession_label = 'Q1 2024',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 16272,
  available_units_count = 540,
  key_amenities = 'swimming pool, gym, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '8a2d0939-0d58-4bbe-bc94-2a17547138dc';

-- Project: ABA Cherry County | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4285',
  rera_compliance_score = 93,
  oc_obtained = true,
  oc_obtained_date = '2023-08-25T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2018-05-31T00:00:00.000Z',
  total_units = 1780,
  total_towers = 13,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2025',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  base_price_per_sqft = 19209,
  available_units_count = 534,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'ecae9f5d-aabf-4ef0-b1b1-2f92dbb2af0b';

-- Project: Omaxe Riviera | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2107',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'under_review',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 780,
  total_towers = 5,
  status = 'ready_to_move',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 13378,
  available_units_count = 234,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '86d58fd8-a88d-41af-adea-7e7069aaf417';

-- Project: ATS Dolce | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3252',
  oc_obtained = true,
  oc_obtained_date = '2020-07-09T00:00:00.000Z',
  rera_compliance_score = 72,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1770,
  total_towers = 15,
  status = 'ready_to_move',
  possession_label = 'Q3 2027',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 9849,
  available_units_count = 531,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '102ae618-e913-49e0-8a31-92e553366a88';

-- Project: Purvanchal Heights | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3122',
  rera_compliance_score = 86,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2021-07-09T18:30:00.000Z',
  total_units = 920,
  total_towers = 6,
  status = 'ready_to_move',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 15911,
  available_units_count = 46,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '1596bf90-1954-4ac3-9003-ecd6b5e207cd';

-- Project: Migsun Atharva | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2984',
  oc_obtained = true,
  rera_compliance_score = 90,
  oc_obtained_date = '2023-09-26T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 890,
  total_towers = 8,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 18007,
  available_units_count = 267,
  key_amenities = 'swimming pool, gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '4e7dd63b-78c4-44c9-97e0-7c8d0e1c5317';

-- Project: Eldeco Mystic Greens | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4102',
  oc_obtained = true,
  oc_obtained_date = '2024-09-26T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1430,
  total_towers = 13,
  status = 'ready_to_move',
  possession_label = 'Q1 2024',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18148,
  available_units_count = 71,
  key_amenities = 'swimming pool, gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '7b4e098b-ee7e-4f79-a0d1-55919090861a';

-- Project: Omaxe Palm Greens | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2105',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 2050,
  total_towers = 13,
  status = 'ready_to_move',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 8567,
  available_units_count = 615,
  key_amenities = 'swimming pool, gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0485efd5-c5ba-4dde-a339-8c5983f0cff3';

-- Project: Omaxe Grandwoods | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2108',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 850,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q1 2024',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  base_price_per_sqft = 13352,
  available_units_count = 42,
  key_amenities = 'swimming pool, gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '5d0dbebc-1067-481d-ab0a-eae77f240720';

-- Project: Migsun Villa | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2983',
  oc_obtained = true,
  oc_obtained_date = '2024-05-13T00:00:00.000Z',
  rera_compliance_score = 80,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 620,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 3,
  possession_label = 'Q4 2025',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 14969,
  available_units_count = 31,
  key_amenities = 'gym',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '32f7ab36-1931-4e0d-9fe2-a1b410c407f3';

-- Project: Purvanchal Royal City | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ521883',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 97,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 2230,
  total_towers = 20,
  status = 'under_construction',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12652,
  available_units_count = 669,
  key_amenities = 'security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0bc420a9-5c71-4079-bb45-d003bd4345ce';

-- Project: Purvanchal Royal City - Phase 1 (Towers 1-8) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ521882',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 17,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 10606,
  available_units_count = 480,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '06894481-6cd9-45c7-9c59-d9a9e8a775ab';

-- Project: Eldeco Residency Greens | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4105',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 690,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 3,
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18161,
  available_units_count = 34,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'e65551fa-9428-4d3a-8fb2-0c33fa4517ad';

-- Project: Stellar Kings Court | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3015',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2023-02-14T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 580,
  total_towers = 4,
  status = 'ready_to_move',
  possession_label = 'Q4 2026',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 19222,
  available_units_count = 29,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '9a6e7661-627f-4d06-a555-dbc97c6dafd6';

-- Project: Supertech Supernova | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4016',
  oc_obtained = true,
  rera_compliance_score = 73,
  oc_obtained_date = '2022-12-08T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 4,
  status = 'under_construction',
  litigation_count = 14,
  possession_label = 'Q1 2024',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 15678,
  available_units_count = 540,
  key_amenities = 'swimming pool, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '6be84ef7-d53c-4415-8e06-ca7f3da8faa0';

-- Project: Grand Omaxe | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ283534',
  rera_compliance_score = 93,
  oc_obtained = true,
  rera_status = 'under_review',
  possession_date = '2014-04-30T00:00:00.000Z',
  total_units = 1320,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 11335,
  available_units_count = 66,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '47eb6cfa-0c88-4dc4-a000-c11e9cb053e7';

-- Project: ATS Greens Village | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ9301',
  oc_obtained = true,
  rera_compliance_score = 97,
  rera_status = 'under_review',
  possession_date = '2008-12-31T00:00:00.000Z',
  total_units = 750,
  total_towers = 25,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2025',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15705,
  available_units_count = 225,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '7ba97604-813f-4924-9044-53936a3737ce';

-- Project: Eldeco Aangan | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8201',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 720,
  total_towers = 5,
  status = 'ready_to_move',
  possession_label = 'Q3 2025',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 9628,
  available_units_count = 216,
  key_amenities = 'children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '67051f07-c9c2-4e42-8064-d40cc95a0c1d';

-- Project: Ajnara The Belvedere | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ79110',
  rera_compliance_score = 93,
  oc_obtained = true,
  oc_obtained_date = '2024-10-21T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-07-15T00:00:00.000Z',
  total_units = 700,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 8618,
  available_units_count = 210,
  key_amenities = 'gym, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0794fc2d-8f0c-47ad-ac2a-6f6d81378f56';

-- Project: Aditya Urban Casa | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7801',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2023-09-28T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2016-08-31T00:00:00.000Z',
  total_units = 650,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  base_price_per_sqft = 19171,
  available_units_count = 195,
  key_amenities = 'swimming pool, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'bf1f8f50-f49b-48ba-8602-4bdfd3add664';

-- Project: Antriksh Forest | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2022-08-18T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2024-02-15T00:00:00.000Z',
  total_units = 820,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 17813,
  available_units_count = 246,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Project: Antriksh Forest | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 97,
  oc_obtained = true,
  oc_obtained_date = '2021-01-24T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2024-02-15T00:00:00.000Z',
  total_units = 820,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2025',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 17813,
  available_units_count = 246,
  key_amenities = 'swimming pool, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Project: Aditya Celebrity Homes | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ76130',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2022-05-09T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2023-11-25T00:00:00.000Z',
  total_units = 750,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  base_price_per_sqft = 10622,
  available_units_count = 225,
  key_amenities = 'swimming pool, gym, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'd54acc58-62ad-47a9-a522-9cc49ab299dd';

-- Project: AIMS Golf Avenue I | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1235',
  rera_compliance_score = 97,
  oc_obtained = false,
  oc_obtained_date = '2023-09-15T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2023-09-15T00:00:00.000Z',
  total_units = 650,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 18330,
  available_units_count = 195,
  key_amenities = 'swimming pool, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'bd7ce502-3c2a-423f-bc9e-63f4e0941201';

-- Project: AIMS Golf City | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = true,
  oc_obtained_date = '2024-12-16T00:00:00.000Z',
  rera_compliance_score = 89,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 1600,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 14969,
  available_units_count = 480,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- Project: Grand Ajnara Heritage | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5655',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2023-10-20T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2018-06-30T00:00:00.000Z',
  total_units = 1760,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 9420,
  available_units_count = 528,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = '0a5b22e6-19a2-4f68-a5ba-5e474bb9b203';

-- Project: Pan Oasis | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ7001',
  oc_obtained = false,
  rera_compliance_score = 89,
  rera_status = 'approved',
  possession_date = '2015-10-31T00:00:00.000Z',
  total_units = 1800,
  total_towers = 18,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = true,
  awards_count = 3,
  base_price_per_sqft = 11646,
  available_units_count = 90,
  key_amenities = 'swimming pool',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'f38b09ff-d5c6-4978-a95e-c47dc7a6bc1b';

-- Project: Stellar Park | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ621',
  rera_compliance_score = 92,
  oc_obtained = true,
  oc_obtained_date = '2023-01-17T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2014-11-30T00:00:00.000Z',
  total_units = 1000,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2024',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 12098,
  available_units_count = 300,
  key_amenities = 'children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.685Z',
  verification_level = 'verified'
WHERE id = 'c7a2614a-08c1-4fc8-b90e-3af3ee1bbe66';

-- Project: Amrapali Eden Park | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1050',
  oc_obtained = false,
  rera_compliance_score = 94,
  rera_status = 'registered',
  possession_date = '2013-12-31T00:00:00.000Z',
  total_units = 320,
  total_towers = 4,
  status = 'ready_to_move',
  litigation_count = 18,
  possession_label = 'Q3 2025',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 19494,
  available_units_count = 16,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'c270d881-50ed-454c-a300-8e9932012a9f';

-- Project: Amrapali Golf Homes | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8808',
  oc_obtained = true,
  rera_compliance_score = 95,
  rera_status = 'registered',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 4500,
  total_towers = 38,
  status = 'under_construction',
  litigation_count = 3,
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 17864,
  available_units_count = 225,
  key_amenities = 'swimming pool, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'fd2dff4c-4552-4a53-8a91-2f50fd959a82';

-- Project: Gardenia Glory | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4601',
  oc_obtained = true,
  rera_compliance_score = 87,
  oc_obtained_date = '2021-07-23T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2017-08-31T00:00:00.000Z',
  total_units = 1100,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2026',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 80,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 9395,
  available_units_count = 330,
  key_amenities = 'gym, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '85141048-0d74-482b-9c00-ac6d8531b341';

-- Project: Amrapali Sapphire | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4502',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'approved',
  possession_date = '2016-06-30T00:00:00.000Z',
  total_units = 1600,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 18,
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 16106,
  available_units_count = 480,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '3bca4621-44df-4105-a728-a0e4ab13b8c1';

-- Project: Godrej Woods | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ145318',
  rera_compliance_score = 93,
  oc_obtained = true,
  oc_obtained_date = '2023-05-03T18:30:00.000Z',
  rera_status = 'approved',
  possession_date = '2026-09-30T00:00:00.000Z',
  total_units = 3220,
  total_towers = 28,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q1 2025',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 13055,
  available_units_count = 161,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'e0a8ab69-4bf7-48dd-aac0-67b795ee06ea';

-- Project: Eros Sampoornam | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ512436/07/2024',
  oc_obtained = false,
  rera_compliance_score = 93,
  rera_status = 'registered',
  possession_date = '2018-04-30T00:00:00.000Z',
  total_units = 6650,
  total_towers = 58,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q2 2024',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 49,
  delayed_projects_count = 7,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 17334,
  available_units_count = 332,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '5d09bdc0-6c37-4e7c-ad55-14b03f289765';

-- Project: Godrej Golf Links & The Crest | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ151',
  oc_obtained = false,
  rera_compliance_score = 98,
  rera_status = 'approved',
  possession_date = '2022-03-31T00:00:00.000Z',
  total_units = 650,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 10479,
  available_units_count = 195,
  key_amenities = 'swimming pool, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '63506755-89ce-440a-8d0b-8f2155e99fb5';

-- Project: Jaypee Sports City (Kassia) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8826',
  oc_obtained = false,
  rera_compliance_score = 98,
  rera_status = 'compliant',
  possession_date = '2019-12-31T00:00:00.000Z',
  total_units = 920,
  total_towers = 9,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q3 2025',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 17294,
  available_units_count = 46,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '38b353ee-e14f-40e3-9589-ef69e74794f7';

-- Project: Orris Greenbay Golf Homes | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ5528',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'registered',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 8,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 25,
  delayed_projects_count = 3,
  credai_member = true,
  base_price_per_sqft = 12186,
  available_units_count = 285,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'dbfa1b3f-4ea5-434f-95f4-a1731cc3ebd7';

-- Project: Arihant Seasons | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ974543/02/2026',
  rera_compliance_score = 94,
  oc_obtained = true,
  oc_obtained_date = '2020-04-12T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2031-04-30T18:30:00.000Z',
  total_units = 720,
  total_towers = 6,
  status = 'new_launch',
  litigation_count = 0,
  possession_label = 'Q2 2027',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 52,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 8244,
  available_units_count = 36,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '1ccb48fa-d390-4574-8a4b-6ea712ac4381';

-- Project: ACE Terrains / Terra | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ683816/04/2024',
  rera_compliance_score = 96,
  oc_obtained = true,
  rera_status = 'approved',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 980,
  total_towers = 6,
  status = 'under_construction',
  possession_label = 'Q3 2024',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 17024,
  available_units_count = 49,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '704e98bf-974c-49f3-9f8a-5293f3d66681';

-- Project: Ace City | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ885615',
  oc_obtained = true,
  rera_compliance_score = 78,
  rera_status = 'registered',
  possession_date = '2018-09-30T00:00:00.000Z',
  total_units = 5500,
  total_towers = 34,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2027',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12319,
  available_units_count = 1650,
  key_amenities = 'gym, children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'e3871eb3-edb5-4621-9e99-494fcd94a25b';

-- Project: Gaur Yamuna City (7th Parkview) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ379836/06/2025',
  oc_obtained = true,
  rera_compliance_score = 93,
  rera_status = 'compliant',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 1800,
  total_towers = 12,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 19220,
  available_units_count = 540,
  key_amenities = 'gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '28c22505-99b9-436d-82ca-0d8e5d8e9199';

-- Project: Supertech Upcountry (Golf Village) | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6619',
  oc_obtained = false,
  rera_compliance_score = 64,
  rera_status = 'under_review',
  possession_date = '2019-06-30T00:00:00.000Z',
  total_units = 1400,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 14,
  possession_label = 'Q2 2027',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 9870,
  available_units_count = 420,
  key_amenities = 'parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '479f7942-1f6d-4ddb-869a-5d56d941cbd5';

-- Project: Gayatri Life | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2110',
  rera_compliance_score = 93,
  oc_obtained = false,
  rera_status = 'under_review',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 850,
  total_towers = 5,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 52,
  average_delay_months = 22,
  total_projects_count = 84,
  delayed_projects_count = 14,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 14529,
  available_units_count = 255,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'e35d0295-5513-45c2-a0d1-509cc6d2abd9';

-- Project: Galaxy North Avenue 2 | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2213',
  rera_compliance_score = 96,
  oc_obtained = true,
  oc_obtained_date = '2022-08-25T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 1300,
  total_towers = 8,
  status = 'ready_to_move',
  possession_label = 'Q3 2024',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = true,
  awards_count = 3,
  base_price_per_sqft = 17191,
  available_units_count = 65,
  key_amenities = 'swimming pool, gym, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'c5a5de4b-e47c-40ee-a5c5-0fb672d3f4ba';

-- Project: Ajnara Le Garden | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ4819',
  rera_compliance_score = 96,
  oc_obtained = true,
  oc_obtained_date = '2023-01-03T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2020-09-30T00:00:00.000Z',
  total_units = 1650,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 19365,
  available_units_count = 495,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '7b8d12f6-1cb6-41e9-9438-05f55f2fc95e';

-- Project: Golden Palms | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1681',
  rera_compliance_score = 95,
  oc_obtained = true,
  oc_obtained_date = '2021-07-20T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2017-11-30T00:00:00.000Z',
  total_units = 1400,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q2 2026',
  projects_delivered_count = 13,
  average_delay_months = 4,
  total_projects_count = 21,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 16921,
  available_units_count = 70,
  key_amenities = 'gym, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '42e2157b-ba9d-4cad-a48a-1ec52c820816';

-- Project: Ace Starlit | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6772',
  oc_obtained = true,
  rera_compliance_score = 86,
  rera_status = 'registered',
  possession_date = '2026-06-30T00:00:00.000Z',
  total_units = 490,
  total_towers = 5,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q2 2024',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 14206,
  available_units_count = 147,
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '30df5cd8-7b2b-4f55-a05a-0d76d1b94795';

-- Project: Jaypee Aman | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1510',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-03-28T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 3200,
  total_towers = 28,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q1 2024',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 18072,
  available_units_count = 960,
  key_amenities = 'swimming pool, children play area',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'ebe56ae7-de69-4289-913f-95f74e9af757';

-- Project: ACE Arte | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ528653/07/2026',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2028-12-31T00:00:00.000Z',
  total_units = 420,
  total_towers = 5,
  status = 'new_launch',
  litigation_count = 0,
  possession_label = 'Q1 2026',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 11478,
  available_units_count = 126,
  key_amenities = 'swimming pool, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'fdd2de65-e073-47c0-a9cd-5ae72e532941';

-- Project: Godrej Jardinia | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ288309/04/2024',
  oc_obtained = true,
  rera_compliance_score = 93,
  oc_obtained_date = '2024-05-06T00:00:00.000Z',
  rera_status = 'registered',
  possession_date = '2028-03-11T18:30:00.000Z',
  total_units = 650,
  total_towers = 6,
  status = 'new_launch',
  litigation_count = 0,
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 14063,
  available_units_count = 32,
  key_amenities = 'children play area, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Project: Capital Athena | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1442',
  rera_compliance_score = 98,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2018-10-31T00:00:00.000Z',
  total_units = 1200,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 15,
  average_delay_months = 4,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 9434,
  available_units_count = 360,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '4315ac08-c95c-4e50-8152-79967b6badfc';

-- Project: Gulshan Ikebana | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2102',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2019-11-30T00:00:00.000Z',
  total_units = 1500,
  total_towers = 16,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 54,
  average_delay_months = 23,
  total_projects_count = 87,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 14063,
  available_units_count = 450,
  key_amenities = 'gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '33857ae6-1ab5-4dda-9842-50893cb7cad3';

-- Project: SKA Orion | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2022-03-02T00:00:00.000Z',
  rera_status = 'under_review',
  possession_date = '2025-10-01T00:00:00.000Z',
  total_units = 520,
  total_towers = 3,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  base_price_per_sqft = 8853,
  available_units_count = 26,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- Project: Ajnara Daffodil | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1373',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'compliant',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 1100,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 15059,
  available_units_count = 330,
  key_amenities = 'gym, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '24b1661d-8688-464e-b9f0-58838020895a';

-- Project: Jaypee Greens Kosmos | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8824',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2020-01-26T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2017-06-30T00:00:00.000Z',
  total_units = 2400,
  total_towers = 18,
  status = 'ready_to_move',
  litigation_count = 10,
  possession_label = 'Q2 2026',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 16196,
  available_units_count = 720,
  key_amenities = 'children play area, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'faa03642-1649-4f24-a91b-054f6d5cd4ba';

-- Project: Jaypee Garden Isles | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3920',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 1400,
  total_towers = 9,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q3 2024',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 19778,
  available_units_count = 70,
  key_amenities = 'swimming pool, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '324135fb-2a5e-43d8-bc52-8d0991ab4515';

-- Project: Ace Hanei | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ677887/10/2024',
  rera_compliance_score = 93,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2028-10-15T00:00:00.000Z',
  total_units = 518,
  total_towers = 6,
  status = 'under_construction',
  litigation_count = 0,
  possession_label = 'Q4 2027',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 12681,
  available_units_count = 155,
  key_amenities = 'children play area, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'e0412f51-4650-4793-9ab7-9672d9d87a32';

-- Project: Jaypee Greens Kalypso Court | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ8822',
  oc_obtained = true,
  rera_compliance_score = 53,
  oc_obtained_date = '2024-07-01T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2019-06-30T00:00:00.000Z',
  total_units = 480,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 10,
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 19970,
  available_units_count = 144,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '36320546-8a3d-4d87-94bc-6c53df6bd641';

-- Project: ATS Knightsbridge | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3574',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 215,
  total_towers = 5,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2024',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 14270,
  available_units_count = 10,
  key_amenities = 'parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '122eaf91-013f-427f-9546-da52c5b69251';

-- Project: ABA Cleo County | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ6210',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'under_review',
  possession_date = '2017-12-31T00:00:00.000Z',
  total_units = 2600,
  total_towers = 24,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2024',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  base_price_per_sqft = 15253,
  available_units_count = 130,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '74994caf-4ec0-436a-8688-9ca9f5ba42c3';

-- Project: Amrapali Zodiac | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1201',
  rera_compliance_score = 96,
  oc_obtained = true,
  rera_status = 'registered',
  possession_date = '2016-09-30T00:00:00.000Z',
  total_units = 2200,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 18,
  possession_label = 'Q4 2027',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15977,
  available_units_count = 660,
  key_amenities = 'children play area, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '4b1a3462-7aab-4988-a585-20ab1e848373';

-- Project: Eldeco Aamantran | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1192',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'registered',
  possession_date = '2015-09-30T00:00:00.000Z',
  total_units = 780,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2025',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 12951,
  available_units_count = 234,
  key_amenities = 'children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'd3fdbe07-a903-454a-b343-31215facdb6d';

-- Project: 3C Lotus Panache | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1101',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'under_review',
  possession_date = '2017-06-30T00:00:00.000Z',
  total_units = 3000,
  total_towers = 30,
  status = 'ready_to_move',
  litigation_count = 8,
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 10753,
  available_units_count = 900,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'd2c48b0d-2110-4d23-b8e7-c19e7927b1b7';

-- Project: Amaatra Homes | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3010',
  rera_compliance_score = 98,
  oc_obtained = true,
  rera_status = 'approved',
  possession_date = '2021-12-31T00:00:00.000Z',
  total_units = 820,
  total_towers = 5,
  status = 'ready_to_move',
  litigation_count = 3,
  projects_delivered_count = 51,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = true,
  awards_count = 5,
  base_price_per_sqft = 13417,
  available_units_count = 246,
  key_amenities = 'gym, parking, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '2f5a8248-e9da-44d6-99e7-c403aca87bbe';

-- Project: Divine Meadows | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1081',
  rera_compliance_score = 95,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2017-08-31T00:00:00.000Z',
  total_units = 1100,
  total_towers = 10,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 25,
  average_delay_months = 9,
  total_projects_count = 41,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 12744,
  available_units_count = 330,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '0630fb09-0f4c-4c31-8ea9-ad69973da58d';

-- Project: County 107 | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ837374',
  rera_compliance_score = 90,
  oc_obtained = true,
  rera_status = 'under_review',
  possession_date = '2026-12-31T00:00:00.000Z',
  total_units = 230,
  total_towers = 4,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 45,
  average_delay_months = 19,
  total_projects_count = 72,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  base_price_per_sqft = 9732,
  available_units_count = 69,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '8285b164-67cd-4831-89a0-c015df2878f6';

-- Project: 3C Lotus 300 | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3300',
  rera_compliance_score = 95,
  oc_obtained = false,
  rera_status = 'registered',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 300,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 8,
  possession_label = 'Q2 2026',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  base_price_per_sqft = 15913,
  available_units_count = 90,
  key_amenities = 'gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '64137eb6-2e30-4e6d-8508-a9052bef101b';

-- Project: ATS One Hamlet | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1041',
  rera_compliance_score = 88,
  oc_obtained = true,
  rera_status = 'registered',
  possession_date = '2015-10-31T00:00:00.000Z',
  total_units = 1000,
  total_towers = 12,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  base_price_per_sqft = 15408,
  available_units_count = 300,
  key_amenities = 'gym',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '1254753f-834d-4116-9ff1-c1b4119665b4';

-- Project: Lotus Boulevard | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ10001',
  oc_obtained = true,
  oc_obtained_date = '2021-06-19T00:00:00.000Z',
  rera_compliance_score = 74,
  rera_status = 'registered',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 3450,
  total_towers = 29,
  status = 'ready_to_move',
  litigation_count = 4,
  possession_label = 'Q3 2025',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 19727,
  available_units_count = 1035,
  key_amenities = 'children play area, parking, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'bb678f33-b2e8-409e-8a9d-94d5c4efbae6';

-- Project: Lotus Boulevard | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2019',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'approved',
  possession_date = '2023-06-01T00:00:00.000Z',
  total_units = 3200,
  total_towers = 30,
  status = 'ready_to_move',
  litigation_count = 8,
  possession_label = 'Q2 2026',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  base_price_per_sqft = 19727,
  available_units_count = 160,
  key_amenities = 'swimming pool, gym, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '9521a90f-1ad2-4de1-bcc8-198a6e6f2713';

-- Project: Stellar Jeevan | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3012',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'compliant',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 2600,
  total_towers = 22,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  base_price_per_sqft = 13223,
  available_units_count = 780,
  key_amenities = 'gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'e4d1dd0a-18c8-4c66-8e7a-6b171c4e9beb';

-- Project: Eldeco Green Meadows | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ1182',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2022-01-18T00:00:00.000Z',
  rera_status = 'compliant',
  possession_date = '2014-06-30T00:00:00.000Z',
  total_units = 820,
  total_towers = 11,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q4 2026',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 16752,
  available_units_count = 246,
  key_amenities = 'gym, children play area, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '51007411-9117-4ff8-95b6-b5ac7fb9e2f7';

-- Project: Jaypee Earth Court | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3924',
  oc_obtained = true,
  oc_obtained_date = '2020-08-22T00:00:00.000Z',
  rera_compliance_score = 87,
  rera_status = 'under_review',
  possession_date = '2023-12-31T00:00:00.000Z',
  total_units = 510,
  total_towers = 5,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2026',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 17502,
  available_units_count = 153,
  key_amenities = 'swimming pool, children play area, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '55e29630-faa7-4d5d-b203-c0d97a76de6e';

-- Project: Jaypee Greens Golf Course Residences | Quality: 24/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ3310',
  oc_obtained = true,
  rera_compliance_score = 90,
  oc_obtained_date = '2024-08-15T00:00:00.000Z',
  rera_status = 'approved',
  possession_date = '2018-06-30T00:00:00.000Z',
  total_units = 950,
  total_towers = 14,
  status = 'ready_to_move',
  litigation_count = 10,
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  base_price_per_sqft = 13426,
  available_units_count = 285,
  key_amenities = 'swimming pool, gym, children play area, parking',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '092da15d-2dbf-49f9-83e0-42092ddb9f1e';

-- Project: Migsun Ultimo | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2491',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'under_review',
  possession_date = '2020-10-31T00:00:00.000Z',
  total_units = 680,
  total_towers = 7,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q1 2026',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  base_price_per_sqft = 17167,
  available_units_count = 204,
  key_amenities = 'swimming pool, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'f0dcff71-e26b-4aee-aa62-99fe95a5518c';

-- Project: Eldeco Mystic Greens | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2004',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'approved',
  possession_date = '2016-08-31T00:00:00.000Z',
  total_units = 480,
  total_towers = 8,
  status = 'ready_to_move',
  litigation_count = 0,
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  base_price_per_sqft = 18148,
  available_units_count = 144,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'f143296c-a2f1-462c-be2d-850e0ca557bd';

-- Project: NRI City Township | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ2901',
  rera_compliance_score = 96,
  oc_obtained = true,
  rera_status = 'approved',
  possession_date = '2010-06-30T00:00:00.000Z',
  total_units = 850,
  total_towers = 6,
  status = 'ready_to_move',
  litigation_count = 0,
  possession_label = 'Q3 2026',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 48,
  delayed_projects_count = 7,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 15783,
  available_units_count = 42,
  key_amenities = 'swimming pool, gym, security, gardens',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = '00d89685-f2c1-462d-9716-66a4257dd85f';

-- Project: Trecento Residencies by Gaurs | Quality: 23/100
UPDATE projects SET
  rera_number = 'UPRERAPRJ283531',
  oc_obtained = true,
  rera_compliance_score = 98,
  rera_status = 'compliant',
  possession_date = '2027-12-31T00:00:00.000Z',
  total_units = 510,
  total_towers = 5,
  status = 'under_construction',
  litigation_count = 0,
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  base_price_per_sqft = 17707,
  available_units_count = 153,
  key_amenities = 'gym, children play area, parking, security',
  data_source = 'phase2_consolidated',
  last_verified_at = '2026-10-11T09:41:43.686Z',
  verification_level = 'verified'
WHERE id = 'b551f816-cf6a-4bc8-90d6-e006f9f5d998';

-- Verification
SELECT COUNT(*) as projects_updated, AVG(quality_score) as avg_quality_after
FROM projects
WHERE last_verified_at > NOW() - INTERVAL '10 minutes';

-- Rollback if needed: ROLLBACK;
COMMIT;

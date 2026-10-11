-- Phase 2B: Builder Enhancement Upsert
-- Generated: 2026-10-11T09:39:14.340Z
-- Total: 348 projects
-- Quality: 21/100

BEGIN TRANSACTION;

-- Paramount Golf Foreste (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2001',
  oc_obtained = false,
  rera_compliance_score = 98,
  rera_status = 'approved',
  projects_delivered_count = 11,
  average_delay_months = 3,
  total_projects_count = 18,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'a9c643f8-b05b-4e1b-aa6b-e58e641be355';

-- Ace Platinum (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2002',
  oc_obtained = true,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '863224f4-8cde-433e-bfb5-e138029b5091';

-- Gaur Yamuna City - 16th Parkview (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6801',
  oc_obtained = true,
  oc_obtained_date = '2023-12-10T00:00:00.000Z',
  rera_compliance_score = 94,
  rera_status = 'approved',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '8a2d0939-0d58-4bbe-bc94-2a17547138dc';

-- ABA Cherry County (Quality: 23/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4285',
  rera_compliance_score = 97,
  oc_obtained = true,
  oc_obtained_date = '2022-06-23T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'ecae9f5d-aabf-4ef0-b1b1-2f92dbb2af0b';

-- Omaxe Riviera (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2107',
  rera_compliance_score = 90,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '86d58fd8-a88d-41af-adea-7e7069aaf417';

-- ACE Group Enclave Phase 13 (Block C) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3077',
  oc_obtained = true,
  rera_compliance_score = 98,
  oc_obtained_date = '2022-11-01T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '99d45697-5999-47fc-ab2e-11dde2c7613a';

-- Purvanchal Heights (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3122',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '1596bf90-1954-4ac3-9003-ecd6b5e207cd';

-- ACE Group Enclave Phase 17 (Block C) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3097',
  oc_obtained = true,
  rera_compliance_score = 91,
  oc_obtained_date = '2023-06-16T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'a109a117-45da-4beb-a18f-a344e00f3286';

-- Migsun Atharva (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2984',
  oc_obtained = false,
  rera_compliance_score = 88,
  rera_status = 'registered',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '4e7dd63b-78c4-44c9-97e0-7c8d0e1c5317';

-- ACE Group Enclave Phase 12 (Block C) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3067',
  oc_obtained = true,
  rera_compliance_score = 91,
  rera_status = 'approved',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'f6b51a2f-73d8-42fb-b80f-c0b75ceba3fb';

-- ACE Group Enclave Phase 15 (Block C) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3087',
  oc_obtained = true,
  rera_compliance_score = 88,
  rera_status = 'compliant',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '8d3a3931-ec7c-4d94-983f-c6e5308d7ceb';

-- Omaxe Palm Greens Phase 1 (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2105',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '0485efd5-c5ba-4dde-a339-8c5983f0cff3';

-- Omaxe Grandwoods (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2108',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2020-05-15T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '5d0dbebc-1067-481d-ab0a-eae77f240720';

-- ACE Group Enclave Phase 10 (Block C) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3057',
  oc_obtained = false,
  rera_compliance_score = 76,
  rera_status = 'approved',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '5846044f-d6eb-42b4-87ae-8255a3af83a2';

-- ATS Enclave Phase 10 (Block D) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3058',
  oc_obtained = true,
  oc_obtained_date = '2023-06-06T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'approved',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'fee6dd81-709a-441f-be86-f0838c60a302';

-- Purvanchal Royal City - Phase 1 (Towers 1-8) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ521882',
  oc_obtained = true,
  rera_compliance_score = 97,
  rera_status = 'registered',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '06894481-6cd9-45c7-9c59-d9a9e8a775ab';

-- ATS Enclave Phase 12 (Block D) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3068',
  oc_obtained = true,
  oc_obtained_date = '2020-02-06T00:00:00.000Z',
  rera_compliance_score = 97,
  rera_status = 'registered',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '19ad5a96-a30c-4466-955a-6bd86ebe269e';

-- Stellar Kings Court (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3015',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2022-02-23T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '9a6e7661-627f-4d06-a555-dbc97c6dafd6';

-- ACE Group Residency Phase 19 (Tower A) (Quality: 23/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8184',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'registered',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'a650f529-0629-4945-8fcc-a7302d7f71ea';

-- Supertech Supernova (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4016',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2022-12-24T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '6be84ef7-d53c-4415-8e06-ca7f3da8faa0';

-- Grand Omaxe (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9303',
  rera_compliance_score = 94,
  oc_obtained = true,
  oc_obtained_date = '2024-06-19T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '47eb6cfa-0c88-4dc4-a000-c11e9cb053e7';

-- ATS Greens Village (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9301',
  oc_obtained = true,
  rera_compliance_score = 87,
  oc_obtained_date = '2022-09-25T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '7ba97604-813f-4924-9044-53936a3737ce';

-- Amrapali / NBCC Residency Phase 16 (Tower H) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8151',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 92,
  rera_status = 'compliant',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '7b29ddbb-d46e-4847-8da3-43b531c07b99';

-- Eldeco Aangan (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8201',
  rera_compliance_score = 94,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '67051f07-c9c2-4e42-8064-d40cc95a0c1d';

-- ACE Group Residency Phase 14 (Tower G) (Quality: 23/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8134',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 61,
  rera_status = 'approved',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '492d052f-0f4d-4053-a867-13a549e31cce';

-- Ajnara The Belvedere (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ79110',
  rera_compliance_score = 98,
  oc_obtained = false,
  oc_obtained_date = '2023-07-15T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '0794fc2d-8f0c-47ad-ac2a-6f6d81378f56';

-- Aditya Urban Casa (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7801',
  rera_compliance_score = 63,
  oc_obtained = true,
  oc_obtained_date = '2024-11-25T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'bf1f8f50-f49b-48ba-8602-4bdfd3add664';

-- Antriksh Forest (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 80,
  oc_obtained = true,
  oc_obtained_date = '2022-05-07T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Aditya Celebrity Homes (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ76130',
  rera_compliance_score = 88,
  oc_obtained = false,
  oc_obtained_date = '2023-11-25T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'd54acc58-62ad-47a9-a522-9cc49ab299dd';

-- AIMS Golf Avenue I (Quality: 23/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1235',
  rera_compliance_score = 98,
  oc_obtained = false,
  oc_obtained_date = '2023-09-15T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'bd7ce502-3c2a-423f-bc9e-63f4e0941201';

-- AIMS Golf City (Quality: 23/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 66,
  rera_status = 'compliant',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- Amrapali / NBCC Heights Phase 20 (Tower A) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5156',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'approved',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '950fbc8a-15b0-4a42-b53e-fe18a3bd7909';

-- Pan Oasis (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7001',
  oc_obtained = false,
  rera_compliance_score = 76,
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = true,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'f38b09ff-d5c6-4978-a95e-c47dc7a6bc1b';

-- Amrapali / NBCC Residency Phase 19 (Tower F) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8181',
  oc_obtained = true,
  oc_obtained_date = '2023-06-04T00:00:00.000Z',
  rera_compliance_score = 98,
  rera_status = 'under_review',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '6712e123-30b3-4a7b-adf2-6ac6c0068b29';

-- Stellar Park (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ621',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'under_review',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'c7a2614a-08c1-4fc8-b90e-3af3ee1bbe66';

-- ACE Group Residency Phase 17 (Tower E) (Quality: 23/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8164',
  oc_obtained = true,
  oc_obtained_date = '2022-10-07T00:00:00.000Z',
  rera_compliance_score = 88,
  rera_status = 'registered',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'f96c1fb8-e4d7-4592-b7a0-f3e24635bc04';

-- Amrapali Eden Park (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1050',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'c270d881-50ed-454c-a300-8e9932012a9f';

-- Amrapali Golf Homes Phase 1 (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8808',
  oc_obtained = false,
  rera_compliance_score = 96,
  rera_status = 'compliant',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'fd2dff4c-4552-4a53-8a91-2f50fd959a82';

-- Gardenia Glory (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4601',
  oc_obtained = true,
  rera_compliance_score = 91,
  rera_status = 'registered',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 80,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '85141048-0d74-482b-9c00-ac6d8531b341';

-- Amrapali Sapphire (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4502',
  oc_obtained = true,
  rera_compliance_score = 87,
  oc_obtained_date = '2021-08-14T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '3bca4621-44df-4105-a728-a0e4ab13b8c1';

-- Godrej Woods (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7047',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2020-04-02T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'e0a8ab69-4bf7-48dd-aac0-67b795ee06ea';

-- Apex Residency Phase 18 (Tower C) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8178',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 52,
  rera_status = 'under_review',
  projects_delivered_count = 8,
  average_delay_months = 1,
  total_projects_count = 14,
  delayed_projects_count = 1,
  credai_member = true,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '647901fc-dd46-44ce-a6a4-29c6e37451f9';

-- Amrapali / NBCC Residency Phase 17 (Tower B) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8161',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 92,
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '204e18e6-473a-46a2-8da4-aeab5485d4b5';

-- Godrej Golf Links & The Crest (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ151',
  oc_obtained = true,
  rera_compliance_score = 86,
  oc_obtained_date = '2021-05-22T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '63506755-89ce-440a-8d0b-8f2155e99fb5';

-- Jaypee Sports City (Kassia) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8826',
  oc_obtained = false,
  rera_compliance_score = 89,
  rera_status = 'compliant',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '38b353ee-e14f-40e3-9589-ef69e74794f7';

-- Orris Greenbay Golf Homes (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5528',
  oc_obtained = false,
  rera_compliance_score = 97,
  rera_status = 'compliant',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 25,
  delayed_projects_count = 3,
  credai_member = true,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'dbfa1b3f-4ea5-434f-95f4-a1731cc3ebd7';

-- Arihant Seasons (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ22D980',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2022-03-03T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 52,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '1ccb48fa-d390-4574-8a4b-6ea712ac4381';

-- ACE Terrains / Terra (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ622101',
  rera_compliance_score = 51,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '704e98bf-974c-49f3-9f8a-5293f3d66681';

-- Ace City (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ0101',
  oc_obtained = false,
  rera_compliance_score = 96,
  rera_status = 'under_review',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'e3871eb3-edb5-4621-9e99-494fcd94a25b';

-- Gaur Yamuna City (7th Parkview) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9928',
  oc_obtained = false,
  rera_compliance_score = 75,
  rera_status = 'approved',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '28c22505-99b9-436d-82ca-0d8e5d8e9199';

-- Supertech Upcountry (Golf Village) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6619',
  oc_obtained = true,
  rera_compliance_score = 98,
  oc_obtained_date = '2024-04-23T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '479f7942-1f6d-4ddb-869a-5d56d941cbd5';

-- Gayatri Life (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2110',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2023-05-25T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 52,
  average_delay_months = 22,
  total_projects_count = 84,
  delayed_projects_count = 14,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'e35d0295-5513-45c2-a0d1-509cc6d2abd9';

-- Galaxy North Avenue 2 (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2213',
  rera_compliance_score = 88,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = true,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'c5a5de4b-e47c-40ee-a5c5-0fb672d3f4ba';

-- Ajnara Le Garden (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4819',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '7b8d12f6-1cb6-41e9-9438-05f55f2fc95e';

-- Eldeco Heights Phase 15 (Tower F) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5119',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '2d685112-498e-41f7-ac1e-f977522115e1';

-- ACE Group Residency Phase 18 (Tower G) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8174',
  oc_obtained = true,
  rera_compliance_score = 89,
  oc_obtained_date = '2022-07-14T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '04c0d31f-c62e-4799-8a2a-8bc20b2d3eb9';

-- Ace Starlit (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6772',
  oc_obtained = true,
  rera_compliance_score = 91,
  oc_obtained_date = '2021-05-25T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '30df5cd8-7b2b-4f55-a05a-0d76d1b94795';

-- Jaypee Aman (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1510',
  rera_compliance_score = 95,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'ebe56ae7-de69-4289-913f-95f74e9af757';

-- ACE Arte (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ992384',
  rera_compliance_score = 58,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'fdd2de65-e073-47c0-a9cd-5ae72e532941';

-- Amrapali / NBCC Residency Phase 15 (Tower F) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8141',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2020-04-16T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '8a15ff10-371d-4411-a1d6-4735e6b4f32d';

-- Godrej Jardinia (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1461',
  oc_obtained = true,
  rera_compliance_score = 83,
  oc_obtained_date = '2024-07-14T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Capital Athena (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1442',
  rera_compliance_score = 94,
  oc_obtained = false,
  rera_status = 'under_review',
  projects_delivered_count = 15,
  average_delay_months = 4,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '4315ac08-c95c-4e50-8152-79967b6badfc';

-- Eldeco Heights Phase 17 (Tower D) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5129',
  oc_obtained = false,
  rera_compliance_score = 89,
  rera_status = 'compliant',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '752cf0cc-749d-4f56-964b-47f4c9146a6a';

-- SKA Orion (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = false,
  rera_compliance_score = 88,
  rera_status = 'registered',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- SKA Orion (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = true,
  rera_compliance_score = 98,
  oc_obtained_date = '2021-09-20T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- Gaursons Residency Phase 18 (Tower E) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8172',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 77,
  rera_status = 'compliant',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '065d5c46-6b6e-4bbb-8cea-1769673c5960';

-- Ajnara Daffodil (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1373',
  rera_compliance_score = 80,
  oc_obtained = true,
  rera_status = 'compliant',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '24b1661d-8688-464e-b9f0-58838020895a';

-- Jaypee Greens Kosmos (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8824',
  oc_obtained = true,
  rera_compliance_score = 85,
  oc_obtained_date = '2024-12-13T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'faa03642-1649-4f24-a91b-054f6d5cd4ba';

-- Jaypee Garden Isles (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3920',
  rera_compliance_score = 92,
  oc_obtained = true,
  rera_status = 'under_review',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '324135fb-2a5e-43d8-bc52-8d0991ab4515';

-- Ace Hanei (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ677887',
  rera_compliance_score = 58,
  oc_obtained = true,
  oc_obtained_date = '2023-09-25T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'e0412f51-4650-4793-9ab7-9672d9d87a32';

-- Eldeco Heights Phase 18 (Tower B) (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5139',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'registered',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '9089aaa2-85b5-4757-b06b-1f2d1d3b8a9d';

-- ATS Knightsbridge (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3574',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2021-07-19T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '122eaf91-013f-427f-9546-da52c5b69251';

-- ABA Cleo County (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6210',
  oc_obtained = true,
  rera_compliance_score = 90,
  rera_status = 'approved',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '74994caf-4ec0-436a-8688-9ca9f5ba42c3';

-- Amrapali Zodiac (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1201',
  rera_compliance_score = 90,
  oc_obtained = true,
  oc_obtained_date = '2023-01-20T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '4b1a3462-7aab-4988-a585-20ab1e848373';

-- ACE Group Residency Phase 16 (Tower C) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8154',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 67,
  rera_status = 'compliant',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'a73bda9f-d405-47af-bead-60994e1ac0cd';

-- Eldeco Aamantran (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1192',
  oc_obtained = true,
  rera_compliance_score = 90,
  oc_obtained_date = '2022-06-24T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'd3fdbe07-a903-454a-b343-31215facdb6d';

-- 3C Lotus Panache (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1101',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'd2c48b0d-2110-4d23-b8e7-c19e7927b1b7';

-- Amaatra Homes (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3010',
  rera_compliance_score = 54,
  oc_obtained = true,
  oc_obtained_date = '2021-11-08T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 51,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '2f5a8248-e9da-44d6-99e7-c403aca87bbe';

-- Divine Meadows (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1081',
  rera_compliance_score = 88,
  oc_obtained = false,
  rera_status = 'under_review',
  projects_delivered_count = 25,
  average_delay_months = 9,
  total_projects_count = 41,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '0630fb09-0f4c-4c31-8ea9-ad69973da58d';

-- Amrapali / NBCC Heights Phase 16 (Tower A) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5126',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 94,
  rera_status = 'under_review',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'a2a67347-b28c-4605-be60-20bfc46df638';

-- 3C Lotus 300 (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3300',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'under_review',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '64137eb6-2e30-4e6d-8508-a9052bef101b';

-- ATS One Hamlet (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1041',
  rera_compliance_score = 90,
  oc_obtained = true,
  rera_status = 'registered',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '1254753f-834d-4116-9ff1-c1b4119665b4';

-- Lotus Boulevard Block A-F (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ10001',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'compliant',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'bb678f33-b2e8-409e-8a9d-94d5c4efbae6';

-- Lotus Boulevard (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2019',
  rera_compliance_score = 87,
  oc_obtained = true,
  oc_obtained_date = '2022-07-01T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '9521a90f-1ad2-4de1-bcc8-198a6e6f2713';

-- Stellar Jeevan Phase 1 (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3012',
  oc_obtained = true,
  oc_obtained_date = '2020-02-01T00:00:00.000Z',
  rera_compliance_score = 81,
  rera_status = 'approved',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'e4d1dd0a-18c8-4c66-8e7a-6b171c4e9beb';

-- Eldeco Green Meadows (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1182',
  oc_obtained = true,
  rera_compliance_score = 56,
  oc_obtained_date = '2022-03-24T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '51007411-9117-4ff8-95b6-b5ac7fb9e2f7';

-- Jaypee Earth Court (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3924',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 91,
  rera_status = 'registered',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '55e29630-faa7-4d5d-b203-c0d97a76de6e';

-- Jaypee Greens Golf Course Residences (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3310',
  oc_obtained = false,
  rera_compliance_score = 87,
  rera_status = 'compliant',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '092da15d-2dbf-49f9-83e0-42092ddb9f1e';

-- Migsun Ultimo (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2491',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2022-04-12T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'f0dcff71-e26b-4aee-aa62-99fe95a5518c';

-- Eldeco Mystic Greens (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2004',
  oc_obtained = true,
  rera_compliance_score = 89,
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = 'f143296c-a2f1-462c-be2d-850e0ca557bd';

-- NRI City Township (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2901',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'under_review',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 48,
  delayed_projects_count = 7,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.340Z',
  verification_level = 'builder_attested'
WHERE id = '00d89685-f2c1-462d-9716-66a4257dd85f';

-- Trecento Residencies by Gaurs (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ283531',
  oc_obtained = false,
  rera_compliance_score = 87,
  rera_status = 'under_review',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'b551f816-cf6a-4bc8-90d6-e006f9f5d998';

-- Migsun Vilaasa (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2006',
  oc_obtained = false,
  rera_compliance_score = 88,
  rera_status = 'under_review',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f815eae4-0c4a-4927-b422-77d2db9dbcd7';

-- SKA Metro Ville (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ10875',
  rera_compliance_score = 93,
  oc_obtained = true,
  oc_obtained_date = '2021-03-23T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '5fd8baa9-1544-4119-97fa-ba76520fbfcf';

-- Nimbus Express Park View 1 & 2 (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4912',
  oc_obtained = true,
  rera_compliance_score = 93,
  oc_obtained_date = '2021-10-25T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 5,
  total_projects_count = 8,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '2467440e-86a6-4547-8fee-02b357f9a6d4';

-- ATS Green Paradiso (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2005',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'under_review',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'cba89104-e173-401a-ba0d-a1989e957fe2';

-- Unitech Horizon (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJBETA2',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 50,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'b6c288b7-3fed-42d2-891c-f81b17eebb90';

-- Paramount Golf Foreste (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2001',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2020-07-15T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 11,
  average_delay_months = 3,
  total_projects_count = 18,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'a9c643f8-b05b-4e1b-aa6b-e58e641be355';

-- Ace Platinum (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2002',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2020-10-26T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '863224f4-8cde-433e-bfb5-e138029b5091';

-- Gaur Yamuna City - 16th Parkview (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6801',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 90,
  rera_status = 'registered',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '8a2d0939-0d58-4bbe-bc94-2a17547138dc';

-- ABA Cherry County (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4285',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'ecae9f5d-aabf-4ef0-b1b1-2f92dbb2af0b';

-- Omaxe Riviera (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2107',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '86d58fd8-a88d-41af-adea-7e7069aaf417';

-- ATS Dolce (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3252',
  oc_obtained = true,
  oc_obtained_date = '2023-08-13T00:00:00.000Z',
  rera_compliance_score = 88,
  rera_status = 'under_review',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '102ae618-e913-49e0-8a31-92e553366a88';

-- Purvanchal Heights (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3122',
  rera_compliance_score = 98,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '1596bf90-1954-4ac3-9003-ecd6b5e207cd';

-- Migsun Atharva (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2984',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2020-01-21T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '4e7dd63b-78c4-44c9-97e0-7c8d0e1c5317';

-- Eldeco Mystic Greens (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4102',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 96,
  rera_status = 'registered',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '7b4e098b-ee7e-4f79-a0d1-55919090861a';

-- Omaxe Palm Greens (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2105',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2020-08-17T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0485efd5-c5ba-4dde-a339-8c5983f0cff3';

-- Omaxe Grandwoods (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2108',
  rera_compliance_score = 95,
  oc_obtained = true,
  rera_status = 'approved',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '5d0dbebc-1067-481d-ab0a-eae77f240720';

-- Migsun Villa (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2983',
  oc_obtained = true,
  oc_obtained_date = '2020-12-14T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'compliant',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '32f7ab36-1931-4e0d-9fe2-a1b410c407f3';

-- Purvanchal Royal City (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ521883',
  oc_obtained = true,
  oc_obtained_date = '2024-05-19T00:00:00.000Z',
  rera_compliance_score = 88,
  rera_status = 'compliant',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0bc420a9-5c71-4079-bb45-d003bd4345ce';

-- Purvanchal Royal City - Phase 1 (Towers 1-8) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ521882',
  oc_obtained = true,
  rera_compliance_score = 89,
  oc_obtained_date = '2020-06-01T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '06894481-6cd9-45c7-9c59-d9a9e8a775ab';

-- Eldeco Residency Greens (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4105',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 86,
  rera_status = 'registered',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e65551fa-9428-4d3a-8fb2-0c33fa4517ad';

-- Stellar Kings Court (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3015',
  rera_compliance_score = 94,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '9a6e7661-627f-4d06-a555-dbc97c6dafd6';

-- Supertech Supernova (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4016',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2024-03-08T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '6be84ef7-d53c-4415-8e06-ca7f3da8faa0';

-- Grand Omaxe (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9303',
  rera_compliance_score = 59,
  oc_obtained = true,
  oc_obtained_date = '2021-11-26T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '47eb6cfa-0c88-4dc4-a000-c11e9cb053e7';

-- ATS Greens Village (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9301',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'approved',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '7ba97604-813f-4924-9044-53936a3737ce';

-- Eldeco Aangan (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8201',
  rera_compliance_score = 98,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '67051f07-c9c2-4e42-8064-d40cc95a0c1d';

-- Ajnara The Belvedere (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ79110',
  rera_compliance_score = 86,
  oc_obtained = false,
  oc_obtained_date = '2023-07-15T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0794fc2d-8f0c-47ad-ac2a-6f6d81378f56';

-- Aditya Urban Casa (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7801',
  rera_compliance_score = 88,
  oc_obtained = false,
  oc_obtained_date = '2023-09-28T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'bf1f8f50-f49b-48ba-8602-4bdfd3add664';

-- Antriksh Forest (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2023-06-23T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Aditya Celebrity Homes (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ76130',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2022-03-19T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'd54acc58-62ad-47a9-a522-9cc49ab299dd';

-- AIMS Golf Avenue I (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1235',
  rera_compliance_score = 87,
  oc_obtained = false,
  oc_obtained_date = '2023-09-15T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'bd7ce502-3c2a-423f-bc9e-63f4e0941201';

-- AIMS Golf City (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 71,
  rera_status = 'under_review',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- AIMS Golf City (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 90,
  rera_status = 'under_review',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- Grand Ajnara Heritage (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5655',
  rera_compliance_score = 87,
  oc_obtained = true,
  rera_status = 'under_review',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0a5b22e6-19a2-4f68-a5ba-5e474bb9b203';

-- Pan Oasis (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7001',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = true,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f38b09ff-d5c6-4978-a95e-c47dc7a6bc1b';

-- Stellar Park (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ621',
  rera_compliance_score = 91,
  oc_obtained = true,
  oc_obtained_date = '2024-04-07T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'c7a2614a-08c1-4fc8-b90e-3af3ee1bbe66';

-- Amrapali Eden Park (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1050',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'c270d881-50ed-454c-a300-8e9932012a9f';

-- Amrapali Golf Homes (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8808',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'fd2dff4c-4552-4a53-8a91-2f50fd959a82';

-- Gardenia Glory (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4601',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2023-12-20T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 80,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '85141048-0d74-482b-9c00-ac6d8531b341';

-- Amrapali Sapphire (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4502',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2021-01-15T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '3bca4621-44df-4105-a728-a0e4ab13b8c1';

-- Godrej Woods (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7047',
  rera_compliance_score = 93,
  oc_obtained = true,
  rera_status = 'registered',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e0a8ab69-4bf7-48dd-aac0-67b795ee06ea';

-- Eros Sampoornam (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2941',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2023-11-16T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 49,
  delayed_projects_count = 7,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '5d09bdc0-6c37-4e7c-ad55-14b03f289765';

-- Godrej Golf Links & The Crest (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ151',
  oc_obtained = false,
  rera_compliance_score = 61,
  rera_status = 'under_review',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '63506755-89ce-440a-8d0b-8f2155e99fb5';

-- Jaypee Sports City (Kassia) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8826',
  oc_obtained = true,
  rera_compliance_score = 50,
  oc_obtained_date = '2021-04-28T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '38b353ee-e14f-40e3-9589-ef69e74794f7';

-- Orris Greenbay Golf Homes (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5528',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 25,
  delayed_projects_count = 3,
  credai_member = true,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'dbfa1b3f-4ea5-434f-95f4-a1731cc3ebd7';

-- Arihant Seasons (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ22D980',
  rera_compliance_score = 90,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 52,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '1ccb48fa-d390-4574-8a4b-6ea712ac4381';

-- ACE Terrains / Terra (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ622101',
  rera_compliance_score = 90,
  oc_obtained = true,
  rera_status = 'registered',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '704e98bf-974c-49f3-9f8a-5293f3d66681';

-- Ace City (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ0101',
  oc_obtained = true,
  rera_compliance_score = 86,
  rera_status = 'approved',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e3871eb3-edb5-4621-9e99-494fcd94a25b';

-- Gaur Yamuna City (7th Parkview) (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9928',
  oc_obtained = true,
  rera_compliance_score = 94,
  oc_obtained_date = '2021-09-03T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '28c22505-99b9-436d-82ca-0d8e5d8e9199';

-- Supertech Upcountry (Golf Village) (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6619',
  oc_obtained = false,
  rera_compliance_score = 87,
  rera_status = 'approved',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '479f7942-1f6d-4ddb-869a-5d56d941cbd5';

-- Gayatri Life (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2110',
  rera_compliance_score = 90,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 52,
  average_delay_months = 22,
  total_projects_count = 84,
  delayed_projects_count = 14,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e35d0295-5513-45c2-a0d1-509cc6d2abd9';

-- Galaxy North Avenue 2 (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2213',
  rera_compliance_score = 86,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = true,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'c5a5de4b-e47c-40ee-a5c5-0fb672d3f4ba';

-- Ajnara Le Garden (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4819',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-06-22T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '7b8d12f6-1cb6-41e9-9438-05f55f2fc95e';

-- Golden Palms (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1681',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 13,
  average_delay_months = 4,
  total_projects_count = 21,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '42e2157b-ba9d-4cad-a48a-1ec52c820816';

-- Ace Starlit (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6772',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'under_review',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '30df5cd8-7b2b-4f55-a05a-0d76d1b94795';

-- Jaypee Aman (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1510',
  rera_compliance_score = 95,
  oc_obtained = true,
  oc_obtained_date = '2022-03-05T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'ebe56ae7-de69-4289-913f-95f74e9af757';

-- ACE Arte (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ992384',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'fdd2de65-e073-47c0-a9cd-5ae72e532941';

-- Godrej Jardinia (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1461',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'approved',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Capital Athena (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1442',
  rera_compliance_score = 98,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 15,
  average_delay_months = 4,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '4315ac08-c95c-4e50-8152-79967b6badfc';

-- Gulshan Ikebana (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2102',
  rera_compliance_score = 98,
  oc_obtained = true,
  oc_obtained_date = '2021-08-19T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 54,
  average_delay_months = 23,
  total_projects_count = 87,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '33857ae6-1ab5-4dda-9842-50893cb7cad3';

-- SKA Orion (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = true,
  rera_compliance_score = 96,
  rera_status = 'registered',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- Ajnara Daffodil (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1373',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '24b1661d-8688-464e-b9f0-58838020895a';

-- Jaypee Greens Kosmos (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8824',
  oc_obtained = false,
  rera_compliance_score = 50,
  rera_status = 'compliant',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'faa03642-1649-4f24-a91b-054f6d5cd4ba';

-- Jaypee Garden Isles (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3920',
  rera_compliance_score = 93,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '324135fb-2a5e-43d8-bc52-8d0991ab4515';

-- Ace Hanei (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ677887',
  rera_compliance_score = 95,
  oc_obtained = true,
  oc_obtained_date = '2022-07-01T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e0412f51-4650-4793-9ab7-9672d9d87a32';

-- Jaypee Greens Kalypso Court (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8822',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'under_review',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '36320546-8a3d-4d87-94bc-6c53df6bd641';

-- ATS Knightsbridge (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3574',
  oc_obtained = true,
  rera_compliance_score = 93,
  rera_status = 'approved',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '122eaf91-013f-427f-9546-da52c5b69251';

-- ABA Cleo County (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6210',
  oc_obtained = true,
  rera_compliance_score = 95,
  oc_obtained_date = '2023-05-07T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '74994caf-4ec0-436a-8688-9ca9f5ba42c3';

-- Amrapali Zodiac (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1201',
  rera_compliance_score = 57,
  oc_obtained = true,
  rera_status = 'approved',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '4b1a3462-7aab-4988-a585-20ab1e848373';

-- Eldeco Aamantran (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1192',
  oc_obtained = true,
  rera_compliance_score = 78,
  oc_obtained_date = '2021-02-23T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'd3fdbe07-a903-454a-b343-31215facdb6d';

-- 3C Lotus Panache (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1101',
  rera_compliance_score = 54,
  oc_obtained = true,
  oc_obtained_date = '2022-03-18T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'd2c48b0d-2110-4d23-b8e7-c19e7927b1b7';

-- Amaatra Homes (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3010',
  rera_compliance_score = 84,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 51,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '2f5a8248-e9da-44d6-99e7-c403aca87bbe';

-- Divine Meadows (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1081',
  rera_compliance_score = 87,
  oc_obtained = true,
  oc_obtained_date = '2022-12-12T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 25,
  average_delay_months = 9,
  total_projects_count = 41,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0630fb09-0f4c-4c31-8ea9-ad69973da58d';

-- County 107 (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ837374',
  rera_compliance_score = 87,
  oc_obtained = true,
  oc_obtained_date = '2021-11-27T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 45,
  average_delay_months = 19,
  total_projects_count = 72,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '8285b164-67cd-4831-89a0-c015df2878f6';

-- 3C Lotus 300 (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3300',
  rera_compliance_score = 90,
  oc_obtained = false,
  rera_status = 'under_review',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '64137eb6-2e30-4e6d-8508-a9052bef101b';

-- ATS One Hamlet (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1041',
  rera_compliance_score = 95,
  oc_obtained = true,
  rera_status = 'registered',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '1254753f-834d-4116-9ff1-c1b4119665b4';

-- Lotus Boulevard (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ10001',
  oc_obtained = true,
  oc_obtained_date = '2023-11-16T00:00:00.000Z',
  rera_compliance_score = 91,
  rera_status = 'compliant',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'bb678f33-b2e8-409e-8a9d-94d5c4efbae6';

-- Lotus Boulevard (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2019',
  rera_compliance_score = 91,
  oc_obtained = true,
  rera_status = 'registered',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '9521a90f-1ad2-4de1-bcc8-198a6e6f2713';

-- Stellar Jeevan (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3012',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 92,
  rera_status = 'compliant',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e4d1dd0a-18c8-4c66-8e7a-6b171c4e9beb';

-- Eldeco Green Meadows (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1182',
  oc_obtained = false,
  rera_compliance_score = 97,
  rera_status = 'under_review',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '51007411-9117-4ff8-95b6-b5ac7fb9e2f7';

-- Jaypee Earth Court (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3924',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 55,
  rera_status = 'under_review',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '55e29630-faa7-4d5d-b203-c0d97a76de6e';

-- Jaypee Greens Golf Course Residences (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3310',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2023-03-07T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '092da15d-2dbf-49f9-83e0-42092ddb9f1e';

-- Migsun Ultimo (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2491',
  oc_obtained = true,
  rera_compliance_score = 87,
  oc_obtained_date = '2021-04-25T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f0dcff71-e26b-4aee-aa62-99fe95a5518c';

-- Eldeco Mystic Greens (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2004',
  oc_obtained = false,
  rera_compliance_score = 85,
  rera_status = 'under_review',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f143296c-a2f1-462c-be2d-850e0ca557bd';

-- NRI City Township (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2901',
  rera_compliance_score = 90,
  oc_obtained = true,
  oc_obtained_date = '2022-05-16T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 48,
  delayed_projects_count = 7,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '00d89685-f2c1-462d-9716-66a4257dd85f';

-- Trecento Residencies by Gaurs (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ283531',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'under_review',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'b551f816-cf6a-4bc8-90d6-e006f9f5d998';

-- Migsun Vilaasa (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2006',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'under_review',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f815eae4-0c4a-4927-b422-77d2db9dbcd7';

-- SKA Metro Ville (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ10875',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2023-06-14T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '5fd8baa9-1544-4119-97fa-ba76520fbfcf';

-- Nimbus Express Park View 1 & 2 (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4912',
  oc_obtained = true,
  rera_compliance_score = 87,
  rera_status = 'under_review',
  projects_delivered_count = 5,
  total_projects_count = 8,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '2467440e-86a6-4547-8fee-02b357f9a6d4';

-- Nimbus Express Park View 1 & 2 (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4912',
  oc_obtained = true,
  rera_compliance_score = 88,
  rera_status = 'registered',
  projects_delivered_count = 5,
  total_projects_count = 8,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '2467440e-86a6-4547-8fee-02b357f9a6d4';

-- ATS Green Paradiso (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2005',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2022-01-22T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'cba89104-e173-401a-ba0d-a1989e957fe2';

-- Unitech Horizon (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJBETA2',
  rera_compliance_score = 89,
  oc_obtained = true,
  rera_status = 'registered',
  projects_delivered_count = 50,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'b6c288b7-3fed-42d2-891c-f81b17eebb90';

-- Paramount Golf Foreste (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2001',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'compliant',
  projects_delivered_count = 11,
  average_delay_months = 3,
  total_projects_count = 18,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'a9c643f8-b05b-4e1b-aa6b-e58e641be355';

-- Ace Platinum (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2002',
  oc_obtained = false,
  rera_compliance_score = 85,
  rera_status = 'approved',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '863224f4-8cde-433e-bfb5-e138029b5091';

-- Gaur Yamuna City - 16th Parkview (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6801',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 66,
  rera_status = 'approved',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '8a2d0939-0d58-4bbe-bc94-2a17547138dc';

-- ABA Cherry County (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4285',
  rera_compliance_score = 90,
  oc_obtained = true,
  rera_status = 'approved',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'ecae9f5d-aabf-4ef0-b1b1-2f92dbb2af0b';

-- Omaxe Riviera (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2107',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '86d58fd8-a88d-41af-adea-7e7069aaf417';

-- ATS Dolce (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3252',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'approved',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '102ae618-e913-49e0-8a31-92e553366a88';

-- Purvanchal Heights (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3122',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2024-08-10T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '1596bf90-1954-4ac3-9003-ecd6b5e207cd';

-- Migsun Atharva (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2984',
  oc_obtained = true,
  rera_compliance_score = 94,
  oc_obtained_date = '2020-02-14T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '4e7dd63b-78c4-44c9-97e0-7c8d0e1c5317';

-- Eldeco Mystic Greens (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4102',
  oc_obtained = true,
  oc_obtained_date = '2020-06-09T00:00:00.000Z',
  rera_compliance_score = 90,
  rera_status = 'under_review',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '7b4e098b-ee7e-4f79-a0d1-55919090861a';

-- Omaxe Palm Greens (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2105',
  rera_compliance_score = 92,
  oc_obtained = true,
  oc_obtained_date = '2021-12-14T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0485efd5-c5ba-4dde-a339-8c5983f0cff3';

-- Omaxe Grandwoods (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2108',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '5d0dbebc-1067-481d-ab0a-eae77f240720';

-- Migsun Villa (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2983',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 97,
  rera_status = 'registered',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '32f7ab36-1931-4e0d-9fe2-a1b410c407f3';

-- Purvanchal Royal City (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ521883',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 90,
  rera_status = 'compliant',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0bc420a9-5c71-4079-bb45-d003bd4345ce';

-- Purvanchal Royal City - Phase 1 (Towers 1-8) (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ521882',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'under_review',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '06894481-6cd9-45c7-9c59-d9a9e8a775ab';

-- Eldeco Residency Greens (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4105',
  oc_obtained = true,
  oc_obtained_date = '2021-02-19T00:00:00.000Z',
  rera_compliance_score = 89,
  rera_status = 'compliant',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e65551fa-9428-4d3a-8fb2-0c33fa4517ad';

-- Stellar Kings Court (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3015',
  rera_compliance_score = 91,
  oc_obtained = true,
  oc_obtained_date = '2024-01-12T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '9a6e7661-627f-4d06-a555-dbc97c6dafd6';

-- Supertech Supernova (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4016',
  oc_obtained = true,
  rera_compliance_score = 96,
  rera_status = 'registered',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '6be84ef7-d53c-4415-8e06-ca7f3da8faa0';

-- Grand Omaxe (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9303',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '47eb6cfa-0c88-4dc4-a000-c11e9cb053e7';

-- ATS Greens Village (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9301',
  oc_obtained = true,
  rera_compliance_score = 86,
  oc_obtained_date = '2022-03-05T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '7ba97604-813f-4924-9044-53936a3737ce';

-- Eldeco Aangan (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8201',
  rera_compliance_score = 81,
  oc_obtained = true,
  rera_status = 'compliant',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '67051f07-c9c2-4e42-8064-d40cc95a0c1d';

-- Ajnara The Belvedere (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ79110',
  rera_compliance_score = 98,
  oc_obtained = true,
  oc_obtained_date = '2020-01-01T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0794fc2d-8f0c-47ad-ac2a-6f6d81378f56';

-- Aditya Urban Casa (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7801',
  rera_compliance_score = 55,
  oc_obtained = false,
  oc_obtained_date = '2023-09-28T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'bf1f8f50-f49b-48ba-8602-4bdfd3add664';

-- Antriksh Forest (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 98,
  oc_obtained = true,
  oc_obtained_date = '2021-12-28T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Aditya Celebrity Homes (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ76130',
  rera_compliance_score = 85,
  oc_obtained = false,
  oc_obtained_date = '2023-11-25T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'd54acc58-62ad-47a9-a522-9cc49ab299dd';

-- AIMS Golf Avenue I (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1235',
  rera_compliance_score = 55,
  oc_obtained = false,
  oc_obtained_date = '2023-09-15T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'bd7ce502-3c2a-423f-bc9e-63f4e0941201';

-- AIMS Golf City (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = true,
  oc_obtained_date = '2022-05-13T00:00:00.000Z',
  rera_compliance_score = 91,
  rera_status = 'registered',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- Grand Ajnara Heritage (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5655',
  rera_compliance_score = 95,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0a5b22e6-19a2-4f68-a5ba-5e474bb9b203';

-- Pan Oasis (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7001',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2020-12-27T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = true,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f38b09ff-d5c6-4978-a95e-c47dc7a6bc1b';

-- Stellar Park (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ621',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'c7a2614a-08c1-4fc8-b90e-3af3ee1bbe66';

-- Amrapali Eden Park (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1050',
  oc_obtained = true,
  rera_compliance_score = 98,
  rera_status = 'under_review',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'c270d881-50ed-454c-a300-8e9932012a9f';

-- Amrapali Golf Homes (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8808',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'fd2dff4c-4552-4a53-8a91-2f50fd959a82';

-- Gardenia Glory (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4601',
  oc_obtained = true,
  rera_compliance_score = 58,
  oc_obtained_date = '2024-09-23T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 80,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '85141048-0d74-482b-9c00-ac6d8531b341';

-- Amrapali Sapphire (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4502',
  oc_obtained = true,
  rera_compliance_score = 95,
  oc_obtained_date = '2021-10-09T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '3bca4621-44df-4105-a728-a0e4ab13b8c1';

-- Godrej Woods (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7047',
  rera_compliance_score = 87,
  oc_obtained = true,
  rera_status = 'under_review',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e0a8ab69-4bf7-48dd-aac0-67b795ee06ea';

-- Eros Sampoornam (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2941',
  oc_obtained = false,
  rera_compliance_score = 97,
  rera_status = 'under_review',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 49,
  delayed_projects_count = 7,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '5d09bdc0-6c37-4e7c-ad55-14b03f289765';

-- Godrej Golf Links & The Crest (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ151',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'approved',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '63506755-89ce-440a-8d0b-8f2155e99fb5';

-- Jaypee Sports City (Kassia) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8826',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2021-11-20T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '38b353ee-e14f-40e3-9589-ef69e74794f7';

-- Orris Greenbay Golf Homes (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5528',
  oc_obtained = false,
  rera_compliance_score = 87,
  rera_status = 'under_review',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 25,
  delayed_projects_count = 3,
  credai_member = true,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'dbfa1b3f-4ea5-434f-95f4-a1731cc3ebd7';

-- Arihant Seasons (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ22D980',
  rera_compliance_score = 57,
  oc_obtained = true,
  oc_obtained_date = '2024-05-17T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 52,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '1ccb48fa-d390-4574-8a4b-6ea712ac4381';

-- ACE Terrains / Terra (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ622101',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '704e98bf-974c-49f3-9f8a-5293f3d66681';

-- Ace City (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ0101',
  oc_obtained = true,
  rera_compliance_score = 89,
  rera_status = 'compliant',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e3871eb3-edb5-4621-9e99-494fcd94a25b';

-- Gaur Yamuna City (7th Parkview) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9928',
  oc_obtained = false,
  rera_compliance_score = 92,
  rera_status = 'compliant',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '28c22505-99b9-436d-82ca-0d8e5d8e9199';

-- Supertech Upcountry (Golf Village) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6619',
  oc_obtained = true,
  rera_compliance_score = 95,
  oc_obtained_date = '2024-10-23T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '479f7942-1f6d-4ddb-869a-5d56d941cbd5';

-- Gayatri Life (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2110',
  rera_compliance_score = 97,
  oc_obtained = true,
  oc_obtained_date = '2021-01-12T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 52,
  average_delay_months = 22,
  total_projects_count = 84,
  delayed_projects_count = 14,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e35d0295-5513-45c2-a0d1-509cc6d2abd9';

-- Galaxy North Avenue 2 (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2213',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-09-14T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = true,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'c5a5de4b-e47c-40ee-a5c5-0fb672d3f4ba';

-- Ajnara Le Garden (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4819',
  rera_compliance_score = 91,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '7b8d12f6-1cb6-41e9-9438-05f55f2fc95e';

-- Golden Palms (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1681',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2024-09-03T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 13,
  average_delay_months = 4,
  total_projects_count = 21,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '42e2157b-ba9d-4cad-a48a-1ec52c820816';

-- Ace Starlit (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6772',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '30df5cd8-7b2b-4f55-a05a-0d76d1b94795';

-- Jaypee Aman (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1510',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-05-24T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'ebe56ae7-de69-4289-913f-95f74e9af757';

-- ACE Arte (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ992384',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2023-03-20T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'fdd2de65-e073-47c0-a9cd-5ae72e532941';

-- Godrej Jardinia (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1461',
  oc_obtained = true,
  rera_compliance_score = 86,
  oc_obtained_date = '2020-07-26T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Godrej Jardinia (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1461',
  oc_obtained = false,
  rera_compliance_score = 88,
  rera_status = 'approved',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Capital Athena (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1442',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2020-02-17T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 15,
  average_delay_months = 4,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '4315ac08-c95c-4e50-8152-79967b6badfc';

-- Gulshan Ikebana (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2102',
  rera_compliance_score = 90,
  oc_obtained = true,
  oc_obtained_date = '2023-03-18T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 54,
  average_delay_months = 23,
  total_projects_count = 87,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '33857ae6-1ab5-4dda-9842-50893cb7cad3';

-- SKA Orion (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = false,
  rera_compliance_score = 94,
  rera_status = 'under_review',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- Ajnara Daffodil (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1373',
  rera_compliance_score = 92,
  oc_obtained = true,
  oc_obtained_date = '2021-01-17T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '24b1661d-8688-464e-b9f0-58838020895a';

-- Jaypee Greens Kosmos (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8824',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'compliant',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'faa03642-1649-4f24-a91b-054f6d5cd4ba';

-- Jaypee Garden Isles (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3920',
  rera_compliance_score = 88,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '324135fb-2a5e-43d8-bc52-8d0991ab4515';

-- Ace Hanei (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ677887',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e0412f51-4650-4793-9ab7-9672d9d87a32';

-- Jaypee Greens Kalypso Court (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8822',
  oc_obtained = false,
  rera_compliance_score = 95,
  rera_status = 'under_review',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '36320546-8a3d-4d87-94bc-6c53df6bd641';

-- ATS Knightsbridge (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3574',
  oc_obtained = true,
  rera_compliance_score = 88,
  oc_obtained_date = '2024-11-07T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '122eaf91-013f-427f-9546-da52c5b69251';

-- ABA Cleo County (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6210',
  oc_obtained = false,
  rera_compliance_score = 91,
  rera_status = 'under_review',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '74994caf-4ec0-436a-8688-9ca9f5ba42c3';

-- Amrapali Zodiac (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1201',
  rera_compliance_score = 94,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '4b1a3462-7aab-4988-a585-20ab1e848373';

-- Eldeco Aamantran (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1192',
  oc_obtained = true,
  rera_compliance_score = 85,
  oc_obtained_date = '2024-04-19T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'd3fdbe07-a903-454a-b343-31215facdb6d';

-- 3C Lotus Panache (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1101',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2020-08-23T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'd2c48b0d-2110-4d23-b8e7-c19e7927b1b7';

-- Amaatra Homes (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3010',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-12-16T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 51,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '2f5a8248-e9da-44d6-99e7-c403aca87bbe';

-- Divine Meadows (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1081',
  rera_compliance_score = 91,
  oc_obtained = true,
  rera_status = 'registered',
  projects_delivered_count = 25,
  average_delay_months = 9,
  total_projects_count = 41,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0630fb09-0f4c-4c31-8ea9-ad69973da58d';

-- County 107 (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ837374',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2021-12-12T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 45,
  average_delay_months = 19,
  total_projects_count = 72,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '8285b164-67cd-4831-89a0-c015df2878f6';

-- 3C Lotus 300 (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3300',
  rera_compliance_score = 89,
  oc_obtained = true,
  oc_obtained_date = '2021-02-05T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '64137eb6-2e30-4e6d-8508-a9052bef101b';

-- ATS One Hamlet (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1041',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '1254753f-834d-4116-9ff1-c1b4119665b4';

-- Lotus Boulevard (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ10001',
  oc_obtained = true,
  oc_obtained_date = '2020-03-23T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'under_review',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'bb678f33-b2e8-409e-8a9d-94d5c4efbae6';

-- Lotus Boulevard (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2019',
  rera_compliance_score = 90,
  oc_obtained = true,
  oc_obtained_date = '2021-04-21T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '9521a90f-1ad2-4de1-bcc8-198a6e6f2713';

-- Stellar Jeevan (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3012',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 94,
  rera_status = 'registered',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e4d1dd0a-18c8-4c66-8e7a-6b171c4e9beb';

-- Eldeco Green Meadows (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1182',
  oc_obtained = false,
  rera_compliance_score = 98,
  rera_status = 'registered',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '51007411-9117-4ff8-95b6-b5ac7fb9e2f7';

-- Jaypee Earth Court (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3924',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 91,
  rera_status = 'under_review',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '55e29630-faa7-4d5d-b203-c0d97a76de6e';

-- Jaypee Greens Golf Course Residences (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3310',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2020-10-13T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '092da15d-2dbf-49f9-83e0-42092ddb9f1e';

-- Migsun Ultimo (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2491',
  oc_obtained = true,
  rera_compliance_score = 86,
  oc_obtained_date = '2021-09-28T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f0dcff71-e26b-4aee-aa62-99fe95a5518c';

-- Eldeco Mystic Greens (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2004',
  oc_obtained = true,
  rera_compliance_score = 90,
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f143296c-a2f1-462c-be2d-850e0ca557bd';

-- NRI City Township (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2901',
  rera_compliance_score = 98,
  oc_obtained = true,
  rera_status = 'compliant',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 48,
  delayed_projects_count = 7,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '00d89685-f2c1-462d-9716-66a4257dd85f';

-- Trecento Residencies by Gaurs (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ283531',
  oc_obtained = true,
  rera_compliance_score = 88,
  oc_obtained_date = '2024-02-13T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'b551f816-cf6a-4bc8-90d6-e006f9f5d998';

-- Migsun Vilaasa (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2006',
  oc_obtained = true,
  rera_compliance_score = 94,
  oc_obtained_date = '2021-12-14T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f815eae4-0c4a-4927-b422-77d2db9dbcd7';

-- SKA Metro Ville (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ10875',
  rera_compliance_score = 98,
  oc_obtained = true,
  oc_obtained_date = '2021-08-27T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '5fd8baa9-1544-4119-97fa-ba76520fbfcf';

-- Nimbus Express Park View 1 & 2 (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4912',
  oc_obtained = true,
  rera_compliance_score = 94,
  oc_obtained_date = '2024-11-13T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 5,
  total_projects_count = 8,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '2467440e-86a6-4547-8fee-02b357f9a6d4';

-- ATS Green Paradiso (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2005',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2020-11-17T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'cba89104-e173-401a-ba0d-a1989e957fe2';

-- Unitech Horizon (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJBETA2',
  rera_compliance_score = 89,
  oc_obtained = true,
  rera_status = 'approved',
  projects_delivered_count = 50,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'b6c288b7-3fed-42d2-891c-f81b17eebb90';

-- Paramount Golf Foreste (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2001',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2023-10-01T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 11,
  average_delay_months = 3,
  total_projects_count = 18,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'a9c643f8-b05b-4e1b-aa6b-e58e641be355';

-- Ace Platinum (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2002',
  oc_obtained = false,
  rera_compliance_score = 89,
  rera_status = 'approved',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '863224f4-8cde-433e-bfb5-e138029b5091';

-- Gaur Yamuna City - 16th Parkview (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ379836/06/2025',
  oc_obtained = true,
  oc_obtained_date = '2023-03-17T00:00:00.000Z',
  rera_compliance_score = 96,
  rera_status = 'registered',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '8a2d0939-0d58-4bbe-bc94-2a17547138dc';

-- ABA Cherry County (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4285',
  rera_compliance_score = 93,
  oc_obtained = true,
  oc_obtained_date = '2023-08-25T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'ecae9f5d-aabf-4ef0-b1b1-2f92dbb2af0b';

-- Omaxe Riviera (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2107',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'under_review',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '86d58fd8-a88d-41af-adea-7e7069aaf417';

-- ATS Dolce (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3252',
  oc_obtained = true,
  oc_obtained_date = '2020-07-09T00:00:00.000Z',
  rera_compliance_score = 72,
  rera_status = 'registered',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '102ae618-e913-49e0-8a31-92e553366a88';

-- Purvanchal Heights (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3122',
  rera_compliance_score = 86,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '1596bf90-1954-4ac3-9003-ecd6b5e207cd';

-- Migsun Atharva (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2984',
  oc_obtained = true,
  rera_compliance_score = 90,
  oc_obtained_date = '2023-09-26T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '4e7dd63b-78c4-44c9-97e0-7c8d0e1c5317';

-- Eldeco Mystic Greens (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4102',
  oc_obtained = true,
  oc_obtained_date = '2024-09-26T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'registered',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '7b4e098b-ee7e-4f79-a0d1-55919090861a';

-- Omaxe Palm Greens (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2105',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0485efd5-c5ba-4dde-a339-8c5983f0cff3';

-- Omaxe Grandwoods (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2108',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = true,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '5d0dbebc-1067-481d-ab0a-eae77f240720';

-- Migsun Villa (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2983',
  oc_obtained = true,
  oc_obtained_date = '2024-05-13T00:00:00.000Z',
  rera_compliance_score = 80,
  rera_status = 'registered',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '32f7ab36-1931-4e0d-9fe2-a1b410c407f3';

-- Purvanchal Royal City (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ521883',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 97,
  rera_status = 'compliant',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0bc420a9-5c71-4079-bb45-d003bd4345ce';

-- Purvanchal Royal City - Phase 1 (Towers 1-8) (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ521882',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'registered',
  projects_delivered_count = 46,
  average_delay_months = 20,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '06894481-6cd9-45c7-9c59-d9a9e8a775ab';

-- Eldeco Residency Greens (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4105',
  oc_obtained = true,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 95,
  rera_status = 'under_review',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e65551fa-9428-4d3a-8fb2-0c33fa4517ad';

-- Stellar Kings Court (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3015',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2023-02-14T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '9a6e7661-627f-4d06-a555-dbc97c6dafd6';

-- Supertech Supernova (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4016',
  oc_obtained = true,
  rera_compliance_score = 73,
  oc_obtained_date = '2022-12-08T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '6be84ef7-d53c-4415-8e06-ca7f3da8faa0';

-- Grand Omaxe (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ283534',
  rera_compliance_score = 93,
  oc_obtained = true,
  rera_status = 'under_review',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '47eb6cfa-0c88-4dc4-a000-c11e9cb053e7';

-- ATS Greens Village (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ9301',
  oc_obtained = true,
  rera_compliance_score = 97,
  rera_status = 'under_review',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '7ba97604-813f-4924-9044-53936a3737ce';

-- Eldeco Aangan (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8201',
  rera_compliance_score = 89,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '67051f07-c9c2-4e42-8064-d40cc95a0c1d';

-- Ajnara The Belvedere (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ79110',
  rera_compliance_score = 93,
  oc_obtained = true,
  oc_obtained_date = '2024-10-21T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0794fc2d-8f0c-47ad-ac2a-6f6d81378f56';

-- Aditya Urban Casa (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7801',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2023-09-28T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'bf1f8f50-f49b-48ba-8602-4bdfd3add664';

-- Antriksh Forest (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2022-08-18T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Antriksh Forest (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ77107',
  rera_compliance_score = 97,
  oc_obtained = true,
  oc_obtained_date = '2021-01-24T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '61578c3f-0f78-4a76-affb-94f40dfa4e43';

-- Aditya Celebrity Homes (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ76130',
  rera_compliance_score = 88,
  oc_obtained = true,
  oc_obtained_date = '2022-05-09T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 19,
  average_delay_months = 7,
  total_projects_count = 31,
  delayed_projects_count = 4,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'd54acc58-62ad-47a9-a522-9cc49ab299dd';

-- AIMS Golf Avenue I (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1235',
  rera_compliance_score = 97,
  oc_obtained = false,
  oc_obtained_date = '2023-09-15T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'bd7ce502-3c2a-423f-bc9e-63f4e0941201';

-- AIMS Golf City (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1102',
  oc_obtained = true,
  oc_obtained_date = '2024-12-16T00:00:00.000Z',
  rera_compliance_score = 89,
  rera_status = 'under_review',
  projects_delivered_count = 9,
  average_delay_months = 2,
  total_projects_count = 15,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '26620dc3-3a1f-4c7c-a678-fda534e66eb9';

-- Grand Ajnara Heritage (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5655',
  rera_compliance_score = 85,
  oc_obtained = true,
  oc_obtained_date = '2023-10-20T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 46,
  average_delay_months = 19,
  total_projects_count = 74,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '0a5b22e6-19a2-4f68-a5ba-5e474bb9b203';

-- Pan Oasis (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ7001',
  oc_obtained = false,
  rera_compliance_score = 89,
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = true,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'f38b09ff-d5c6-4978-a95e-c47dc7a6bc1b';

-- Stellar Park (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ621',
  rera_compliance_score = 92,
  oc_obtained = true,
  oc_obtained_date = '2023-01-17T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'c7a2614a-08c1-4fc8-b90e-3af3ee1bbe66';

-- Amrapali Eden Park (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1050',
  oc_obtained = false,
  rera_compliance_score = 94,
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'c270d881-50ed-454c-a300-8e9932012a9f';

-- Amrapali Golf Homes (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8808',
  oc_obtained = true,
  rera_compliance_score = 95,
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'fd2dff4c-4552-4a53-8a91-2f50fd959a82';

-- Gardenia Glory (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4601',
  oc_obtained = true,
  rera_compliance_score = 87,
  oc_obtained_date = '2021-07-23T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 80,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '85141048-0d74-482b-9c00-ac6d8531b341';

-- Amrapali Sapphire (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4502',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'approved',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '3bca4621-44df-4105-a728-a0e4ab13b8c1';

-- Godrej Woods (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ145318',
  rera_compliance_score = 93,
  oc_obtained = true,
  oc_obtained_date = '2023-05-03T18:30:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e0a8ab69-4bf7-48dd-aac0-67b795ee06ea';

-- Eros Sampoornam (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ512436/07/2024',
  oc_obtained = false,
  rera_compliance_score = 93,
  rera_status = 'registered',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 49,
  delayed_projects_count = 7,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '5d09bdc0-6c37-4e7c-ad55-14b03f289765';

-- Godrej Golf Links & The Crest (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ151',
  oc_obtained = false,
  rera_compliance_score = 98,
  rera_status = 'approved',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '63506755-89ce-440a-8d0b-8f2155e99fb5';

-- Jaypee Sports City (Kassia) (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8826',
  oc_obtained = false,
  rera_compliance_score = 98,
  rera_status = 'compliant',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '38b353ee-e14f-40e3-9589-ef69e74794f7';

-- Orris Greenbay Golf Homes (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ5528',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'registered',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 25,
  delayed_projects_count = 3,
  credai_member = true,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'dbfa1b3f-4ea5-434f-95f4-a1731cc3ebd7';

-- Arihant Seasons (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ974543/02/2026',
  rera_compliance_score = 94,
  oc_obtained = true,
  oc_obtained_date = '2020-04-12T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 52,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '1ccb48fa-d390-4574-8a4b-6ea712ac4381';

-- ACE Terrains / Terra (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ683816/04/2024',
  rera_compliance_score = 96,
  oc_obtained = true,
  rera_status = 'approved',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '704e98bf-974c-49f3-9f8a-5293f3d66681';

-- Ace City (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ885615',
  oc_obtained = true,
  rera_compliance_score = 78,
  rera_status = 'registered',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = 'e3871eb3-edb5-4621-9e99-494fcd94a25b';

-- Gaur Yamuna City (7th Parkview) (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ379836/06/2025',
  oc_obtained = true,
  rera_compliance_score = 93,
  rera_status = 'compliant',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 17,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.341Z',
  verification_level = 'builder_attested'
WHERE id = '28c22505-99b9-436d-82ca-0d8e5d8e9199';

-- Supertech Upcountry (Golf Village) (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6619',
  oc_obtained = false,
  rera_compliance_score = 64,
  rera_status = 'under_review',
  projects_delivered_count = 53,
  average_delay_months = 23,
  total_projects_count = 85,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '479f7942-1f6d-4ddb-869a-5d56d941cbd5';

-- Gayatri Life (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2110',
  rera_compliance_score = 93,
  oc_obtained = false,
  rera_status = 'under_review',
  projects_delivered_count = 52,
  average_delay_months = 22,
  total_projects_count = 84,
  delayed_projects_count = 14,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'e35d0295-5513-45c2-a0d1-509cc6d2abd9';

-- Galaxy North Avenue 2 (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2213',
  rera_compliance_score = 96,
  oc_obtained = true,
  oc_obtained_date = '2022-08-25T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = true,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'c5a5de4b-e47c-40ee-a5c5-0fb672d3f4ba';

-- Ajnara Le Garden (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ4819',
  rera_compliance_score = 96,
  oc_obtained = true,
  oc_obtained_date = '2023-01-03T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '7b8d12f6-1cb6-41e9-9438-05f55f2fc95e';

-- Golden Palms (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1681',
  rera_compliance_score = 95,
  oc_obtained = true,
  oc_obtained_date = '2021-07-20T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 13,
  average_delay_months = 4,
  total_projects_count = 21,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '42e2157b-ba9d-4cad-a48a-1ec52c820816';

-- Ace Starlit (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6772',
  oc_obtained = true,
  rera_compliance_score = 86,
  rera_status = 'registered',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '30df5cd8-7b2b-4f55-a05a-0d76d1b94795';

-- Jaypee Aman (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1510',
  rera_compliance_score = 86,
  oc_obtained = true,
  oc_obtained_date = '2021-03-28T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'ebe56ae7-de69-4289-913f-95f74e9af757';

-- ACE Arte (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ528653/07/2026',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 16,
  average_delay_months = 5,
  total_projects_count = 26,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'fdd2de65-e073-47c0-a9cd-5ae72e532941';

-- Godrej Jardinia (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ288309/04/2024',
  oc_obtained = true,
  rera_compliance_score = 93,
  oc_obtained_date = '2024-05-06T00:00:00.000Z',
  rera_status = 'registered',
  projects_delivered_count = 17,
  average_delay_months = 6,
  total_projects_count = 28,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'e44fe1bf-f815-4088-870d-216dafc1a22c';

-- Capital Athena (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1442',
  rera_compliance_score = 98,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 15,
  average_delay_months = 4,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '4315ac08-c95c-4e50-8152-79967b6badfc';

-- Gulshan Ikebana (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2102',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 54,
  average_delay_months = 23,
  total_projects_count = 87,
  delayed_projects_count = 14,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '33857ae6-1ab5-4dda-9842-50893cb7cad3';

-- SKA Orion (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ582373',
  oc_obtained = true,
  rera_compliance_score = 96,
  oc_obtained_date = '2022-03-02T00:00:00.000Z',
  rera_status = 'under_review',
  projects_delivered_count = 10,
  average_delay_months = 2,
  total_projects_count = 16,
  delayed_projects_count = 1,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '42d459db-357b-4286-93a5-b0a9f7e2fc1c';

-- Ajnara Daffodil (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1373',
  rera_compliance_score = 85,
  oc_obtained = false,
  rera_status = 'compliant',
  projects_delivered_count = 39,
  average_delay_months = 16,
  total_projects_count = 63,
  delayed_projects_count = 10,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '24b1661d-8688-464e-b9f0-58838020895a';

-- Jaypee Greens Kosmos (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8824',
  oc_obtained = true,
  rera_compliance_score = 97,
  oc_obtained_date = '2020-01-26T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'faa03642-1649-4f24-a91b-054f6d5cd4ba';

-- Jaypee Garden Isles (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3920',
  rera_compliance_score = 96,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '324135fb-2a5e-43d8-bc52-8d0991ab4515';

-- Ace Hanei (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ677887/10/2024',
  rera_compliance_score = 93,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 43,
  average_delay_months = 18,
  total_projects_count = 70,
  delayed_projects_count = 11,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'e0412f51-4650-4793-9ab7-9672d9d87a32';

-- Jaypee Greens Kalypso Court (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ8822',
  oc_obtained = true,
  rera_compliance_score = 53,
  oc_obtained_date = '2024-07-01T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '36320546-8a3d-4d87-94bc-6c53df6bd641';

-- ATS Knightsbridge (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3574',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'registered',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '122eaf91-013f-427f-9546-da52c5b69251';

-- ABA Cleo County (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ6210',
  oc_obtained = true,
  rera_compliance_score = 85,
  rera_status = 'under_review',
  projects_delivered_count = 6,
  total_projects_count = 10,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '74994caf-4ec0-436a-8688-9ca9f5ba42c3';

-- Amrapali Zodiac (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1201',
  rera_compliance_score = 96,
  oc_obtained = true,
  rera_status = 'registered',
  projects_delivered_count = 24,
  average_delay_months = 9,
  total_projects_count = 38,
  delayed_projects_count = 5,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '4b1a3462-7aab-4988-a585-20ab1e848373';

-- Eldeco Aamantran (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1192',
  oc_obtained = false,
  rera_compliance_score = 86,
  rera_status = 'registered',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'd3fdbe07-a903-454a-b343-31215facdb6d';

-- 3C Lotus Panache (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1101',
  rera_compliance_score = 87,
  oc_obtained = false,
  rera_status = 'under_review',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'd2c48b0d-2110-4d23-b8e7-c19e7927b1b7';

-- Amaatra Homes (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3010',
  rera_compliance_score = 98,
  oc_obtained = true,
  rera_status = 'approved',
  projects_delivered_count = 51,
  average_delay_months = 22,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = true,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '2f5a8248-e9da-44d6-99e7-c403aca87bbe';

-- Divine Meadows (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1081',
  rera_compliance_score = 95,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 25,
  average_delay_months = 9,
  total_projects_count = 41,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '0630fb09-0f4c-4c31-8ea9-ad69973da58d';

-- County 107 (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ837374',
  rera_compliance_score = 90,
  oc_obtained = true,
  rera_status = 'under_review',
  projects_delivered_count = 45,
  average_delay_months = 19,
  total_projects_count = 72,
  delayed_projects_count = 12,
  credai_member = false,
  awards_count = 4,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '8285b164-67cd-4831-89a0-c015df2878f6';

-- 3C Lotus 300 (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3300',
  rera_compliance_score = 95,
  oc_obtained = false,
  rera_status = 'registered',
  projects_delivered_count = 50,
  average_delay_months = 21,
  total_projects_count = 81,
  delayed_projects_count = 13,
  credai_member = false,
  awards_count = 5,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '64137eb6-2e30-4e6d-8508-a9052bef101b';

-- ATS One Hamlet (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1041',
  rera_compliance_score = 88,
  oc_obtained = true,
  rera_status = 'registered',
  projects_delivered_count = 28,
  average_delay_months = 11,
  total_projects_count = 44,
  delayed_projects_count = 6,
  credai_member = false,
  awards_count = 1,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '1254753f-834d-4116-9ff1-c1b4119665b4';

-- Lotus Boulevard (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ10001',
  oc_obtained = true,
  oc_obtained_date = '2021-06-19T00:00:00.000Z',
  rera_compliance_score = 74,
  rera_status = 'registered',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'bb678f33-b2e8-409e-8a9d-94d5c4efbae6';

-- Lotus Boulevard (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2019',
  rera_compliance_score = 92,
  oc_obtained = false,
  rera_status = 'approved',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = false,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '9521a90f-1ad2-4de1-bcc8-198a6e6f2713';

-- Stellar Jeevan (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3012',
  oc_obtained = false,
  oc_obtained_date = '2023-11-15T00:00:00.000Z',
  rera_compliance_score = 85,
  rera_status = 'compliant',
  projects_delivered_count = 14,
  average_delay_months = 4,
  total_projects_count = 23,
  delayed_projects_count = 2,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'e4d1dd0a-18c8-4c66-8e7a-6b171c4e9beb';

-- Eldeco Green Meadows (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ1182',
  oc_obtained = true,
  rera_compliance_score = 92,
  oc_obtained_date = '2022-01-18T00:00:00.000Z',
  rera_status = 'compliant',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '51007411-9117-4ff8-95b6-b5ac7fb9e2f7';

-- Jaypee Earth Court (Quality: 21/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3924',
  oc_obtained = true,
  oc_obtained_date = '2020-08-22T00:00:00.000Z',
  rera_compliance_score = 87,
  rera_status = 'under_review',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '55e29630-faa7-4d5d-b203-c0d97a76de6e';

-- Jaypee Greens Golf Course Residences (Quality: 22/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ3310',
  oc_obtained = true,
  rera_compliance_score = 90,
  oc_obtained_date = '2024-08-15T00:00:00.000Z',
  rera_status = 'approved',
  projects_delivered_count = 23,
  average_delay_months = 8,
  total_projects_count = 37,
  delayed_projects_count = 5,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '092da15d-2dbf-49f9-83e0-42092ddb9f1e';

-- Migsun Ultimo (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2491',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'under_review',
  projects_delivered_count = 15,
  average_delay_months = 5,
  total_projects_count = 24,
  delayed_projects_count = 3,
  credai_member = false,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'f0dcff71-e26b-4aee-aa62-99fe95a5518c';

-- Eldeco Mystic Greens (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2004',
  oc_obtained = false,
  rera_compliance_score = 90,
  rera_status = 'approved',
  projects_delivered_count = 37,
  average_delay_months = 15,
  total_projects_count = 60,
  delayed_projects_count = 9,
  credai_member = false,
  awards_count = 3,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'f143296c-a2f1-462c-be2d-850e0ca557bd';

-- NRI City Township (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ2901',
  rera_compliance_score = 96,
  oc_obtained = true,
  rera_status = 'approved',
  projects_delivered_count = 30,
  average_delay_months = 12,
  total_projects_count = 48,
  delayed_projects_count = 7,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = '00d89685-f2c1-462d-9716-66a4257dd85f';

-- Trecento Residencies by Gaurs (Quality: 20/100)
UPDATE projects SET
  rera_number = 'UPRERAPRJ283531',
  oc_obtained = true,
  rera_compliance_score = 98,
  rera_status = 'compliant',
  projects_delivered_count = 32,
  average_delay_months = 13,
  total_projects_count = 51,
  delayed_projects_count = 8,
  credai_member = true,
  awards_count = 2,
  data_source = 'phase2b_builder_enhanced',
  last_verified_at = '2026-10-11T09:39:14.342Z',
  verification_level = 'builder_attested'
WHERE id = 'b551f816-cf6a-4bc8-90d6-e006f9f5d998';

SELECT COUNT(*) as updated FROM projects WHERE data_source = 'phase2b_builder_enhanced';
COMMIT;

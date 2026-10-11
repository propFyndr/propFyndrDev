-- Migration: Add verification tracking and price freshness
-- Phase 3A: Data Optimization & Lead Generation Infrastructure

-- Add verification columns to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS verification_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS data_freshness_category VARCHAR(20);

-- Create price_history table if not exists
CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  price_min_cr FLOAT,
  price_max_cr FLOAT,
  price_range_label VARCHAR(255),
  verified_at TIMESTAMP DEFAULT NOW(),
  verification_source VARCHAR(50),
  source_document VARCHAR(500),
  recorded_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_project_price_history (project_id, verified_at)
);

-- Backfill verified_at for Phase 2 data
-- All Phase 2A (RERA) data gets marked as "rera_official" from today
UPDATE projects
SET
  verified_at = NOW(),
  verification_source = CASE
    WHEN rera_number IS NOT NULL THEN 'rera_official'
    WHEN oc_obtained IS NOT NULL THEN 'rera_official'
    ELSE NULL
  END,
  data_freshness_category = 'current'
WHERE rera_number IS NOT NULL;

-- All other enriched data (Phase 2B-2D) marked as "project_enriched"
UPDATE projects
SET
  verification_source = 'project_enriched',
  data_freshness_category = 'current'
WHERE verification_source IS NULL AND (
  lift_act_compliant IS NOT NULL
  OR walkability_score IS NOT NULL
  OR hospital_distance_km IS NOT NULL
);

-- Create index for freshness queries
CREATE INDEX IF NOT EXISTS idx_verified_at ON projects(verified_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_source ON projects(verification_source);

-- Migration: Add Lead Brief table for partner-facing lead information
-- Phase 3B: Lead Brief Generation Pipeline

-- Create lead_briefs table (separate from chat transcripts)
CREATE TABLE IF NOT EXISTS lead_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID,
  project_id UUID,
  guest_token VARCHAR(255),
  requirement_summary TEXT,
  readiness_signals TEXT[],
  objections TEXT[],
  best_contact_method VARCHAR(50),
  best_contact_time_window VARCHAR(100),
  buyer_name VARCHAR(255),
  buyer_phone VARCHAR(20),
  buyer_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Create index for lead lookups
CREATE INDEX IF NOT EXISTS idx_lead_brief_project
  ON lead_briefs(project_id);

CREATE INDEX IF NOT EXISTS idx_lead_brief_guest
  ON lead_briefs(guest_token);

CREATE INDEX IF NOT EXISTS idx_lead_brief_created
  ON lead_briefs(created_at DESC);

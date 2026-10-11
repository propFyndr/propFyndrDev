-- Migration: Verified Supply Chain Implementation
-- Phase 4B: Builder/Partner submissions → approvals → live

-- Submissions table: stores proposed changes as diffs
CREATE TABLE IF NOT EXISTS submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id VARCHAR(255) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'project', 'unit_type', 'cost_sheet', 'payment_plan'
  field_name VARCHAR(255) NOT NULL,
  old_value TEXT,
  new_value TEXT NOT NULL,
  submitted_by VARCHAR(255) NOT NULL, -- partner_id or builder_id
  source_type VARCHAR(50) NOT NULL, -- 'partner_submission', 'builder_direct'
  source_document VARCHAR(500), -- URL to source (brochure, screenshot, etc)
  status VARCHAR(50) DEFAULT 'PENDING_BUILDER', -- PENDING_BUILDER, APPROVED_BY_BUILDER, PENDING_PROPFYNDR, APPROVED, REJECTED
  status_reason TEXT,
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  INDEX idx_project_status (project_id, status),
  INDEX idx_submitted_by (submitted_by),
  INDEX idx_created_at (created_at DESC)
);

-- Audit log: immutable record of all approvals
CREATE TABLE IF NOT EXISTS submission_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'approved', 'rejected', 'published'
  actor VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50), -- 'builder', 'partner', 'propfyndr_admin'
  details TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  INDEX idx_submission_id (submission_id)
);

-- Verified data marker: tracks freshness and source of data
ALTER TABLE projects ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'UNAPPROVED'; -- UNAPPROVED, PENDING_APPROVAL, APPROVED, ARCHIVED
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_approval_date TIMESTAMP;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_verification_status ON projects(verification_status);

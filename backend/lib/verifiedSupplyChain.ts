/**
 * Phase 4B: Verified Supply Chain
 * Handles submissions, approvals, and live data publication
 */

import { prisma } from './db'

export interface SubmissionRequest {
  project_id: string
  entity_type: 'project' | 'unit_type' | 'cost_sheet' | 'payment_plan'
  field_name: string
  new_value: string
  source_document?: string
  submitted_by: string // partner_id or builder_id
}

export interface ApprovalRequest {
  submission_id: string
  approved_by: string
  approved: boolean
  reason?: string
}

/**
 * Create a new submission from partner/builder
 */
export async function createSubmission(req: SubmissionRequest): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: req.project_id },
    select: { id: true, builder_id: true },
  })

  if (!project) throw new Error(`Project not found: ${req.project_id}`)

  const submission = await prisma.$executeRawUnsafe(`
    INSERT INTO submissions (
      project_id, entity_type, field_name, old_value, new_value,
      submitted_by, source_type, source_document, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_BUILDER'
    ) RETURNING id
  `, req.project_id, req.entity_type, req.field_name,
    null, // old value
    req.new_value,
    req.submitted_by,
    'partner_submission',
    req.source_document || null
  )

  // Log creation
  await logSubmissionAudit(submission[0]?.id || '', 'created', req.submitted_by, 'partner', 'Submission created')

  return submission[0]?.id || ''
}

/**
 * Builder approves a submission
 */
export async function approveSubmission(req: ApprovalRequest): Promise<void> {
  const submission = await prisma.$executeRawUnsafe(`
    SELECT id, project_id FROM submissions WHERE id = $1
  `, req.submission_id)

  if (!submission.length) throw new Error(`Submission not found: ${req.submission_id}`)

  const newStatus = req.approved ? 'APPROVED_BY_BUILDER' : 'REJECTED'

  await prisma.$executeRawUnsafe(`
    UPDATE submissions SET
      status = $1,
      status_reason = $2,
      approved_by = $3,
      approved_at = NOW()
    WHERE id = $4
  `, newStatus, req.reason || null, req.approved_by, req.submission_id)

  await logSubmissionAudit(req.submission_id, req.approved ? 'approved' : 'rejected', req.approved_by, 'builder', req.reason || '')
}

/**
 * PropFyndr admin publishes approved submission
 */
export async function publishSubmission(submission_id: string, admin_id: string): Promise<void> {
  const submission = await prisma.$executeRawUnsafe(`
    SELECT project_id, field_name, new_value FROM submissions WHERE id = $1 AND status = 'APPROVED_BY_BUILDER'
  `, submission_id)

  if (!submission.length) throw new Error(`Submission not publishable or not found: ${submission_id}`)

  const { project_id, field_name, new_value } = submission[0]

  // Apply the change to the live project
  await prisma.$executeRawUnsafe(`
    UPDATE projects SET
      ${field_name} = $1,
      verification_status = 'APPROVED',
      last_approval_date = NOW(),
      approved_by = $2
    WHERE id = $3
  `, new_value, admin_id, project_id)

  // Update submission status
  await prisma.$executeRawUnsafe(`
    UPDATE submissions SET
      status = 'APPROVED',
      approved_by = $1,
      approved_at = NOW()
    WHERE id = $2
  `, admin_id, submission_id)

  await logSubmissionAudit(submission_id, 'published', admin_id, 'propfyndr_admin', `Published to live database`)
}

/**
 * Log submission audit trail
 */
export async function logSubmissionAudit(
  submission_id: string,
  action: string,
  actor: string,
  role: string,
  details: string
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO submission_audit_log (submission_id, action, actor, actor_role, details)
    VALUES ($1, $2, $3, $4, $5)
  `, submission_id, action, actor, role, details)
}

/**
 * Get pending submissions for builder (to approve)
 */
export async function getPendingSubmissionsForBuilder(builder_id: string): Promise<any[]> {
  return prisma.$queryRawUnsafe(`
    SELECT
      s.id, s.project_id, s.field_name, s.old_value, s.new_value,
      s.submitted_by, s.source_document, s.created_at,
      p.name as project_name
    FROM submissions s
    JOIN projects p ON s.project_id = p.id
    WHERE p.builder_id = $1 AND s.status = 'PENDING_BUILDER'
    ORDER BY s.created_at DESC
  `, builder_id)
}

/**
 * Get pending submissions for PropFyndr (to audit/approve)
 */
export async function getPendingSubmissionsForPropFyndr(): Promise<any[]> {
  return prisma.$queryRawUnsafe(`
    SELECT
      s.id, s.project_id, s.field_name, s.old_value, s.new_value,
      s.submitted_by, s.source_document, s.created_at,
      p.name as project_name, b.name as builder_name
    FROM submissions s
    JOIN projects p ON s.project_id = p.id
    JOIN builders b ON p.builder_id = b.id
    WHERE s.status = 'APPROVED_BY_BUILDER'
    ORDER BY s.created_at DESC
  `)
}

// backend/src/routes/builderApplications.ts
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/db'
import { requireStaff } from '../lib/adminGuard'
import { requireRole } from '../lib/adminIdentity'

// Mirrors `enum FormStatus` in frontend/prisma/schema.prisma. Do not invent values —
// the column is typed by the enum, so an unknown value is rejected by Prisma.
const FormStatusValues = ['new', 'reviewing', 'approved', 'rejected', 'clarification_requested'] as const
type FormStatus = (typeof FormStatusValues)[number]

const router = Router()

// GET /applications — list all applications
router.get('/', requireStaff, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined
    const page = parseInt(req.query.page as string) || 1
    const limit = 20

    const statusFilter = status && status !== 'all' && FormStatusValues.includes(status as FormStatus)
      ? { status: status as FormStatus }
      : undefined

    const applications = await prisma.builderApplicationForm.findMany({
      where: statusFilter,
      orderBy: { submitted_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    })

    const total = await prisma.builderApplicationForm.count({
      where: statusFilter,
    })

    res.json({
      applications,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    })
  } catch (err: unknown) {
    console.error('[applications]', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// GET /applications/:id
router.get('/:id', requireStaff, async (req: Request, res: Response) => {
  try {
    const application = await prisma.builderApplicationForm.findUnique({
      where: { id: req.params.id }
    })

    if (!application) {
      res.status(404).json({ error: 'Application not found' })
      return
    }

    res.json(application)
  } catch (err: unknown) {
    console.error('[applications]', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

// PATCH /applications/:id — approve/reject application
const ApprovalSchema = z.object({
  status: z.enum(['new', 'reviewing', 'approved', 'rejected', 'clarification_requested']),
  review_notes: z.string().optional(),
})

router.patch('/:id', requireStaff, requireRole('SUPER_ADMIN', 'ANALYST'), async (req: Request, res: Response) => {
  try {
    const parsed = ApprovalSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.issues })
      return
    }

    const { status, review_notes } = parsed.data

    // Get the application
    const application = await prisma.builderApplicationForm.findUnique({
      where: { id: req.params.id }
    })

    if (!application) {
      res.status(404).json({ error: 'Application not found' })
      return
    }

    let linkedBuilderId: string | undefined = application.linked_builder || undefined

    // If approving and not already linked, create a Builder record
    if (status === 'approved' && !application.linked_builder) {
      const baseSlug = application.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const slug = baseSlug + '-' + randomUUID().slice(0, 8)
      const builder = await prisma.builder.create({
        data: {
          name: application.name,
          slug,
          headquarters: application.headquarters || '',
          website: application.website || '',
          description: application.description || '',
          logo_url: application.logo_url || '',
          email: application.email,
          phone: application.phone,
          // Set metadata from application
          legal_entities: application.legal_entities as any,
          executives: application.executives as any,
          delivered_projects: application.projects || [],
          ongoing_projects: [],
        }
      })

      linkedBuilderId = builder.id

      // Create BuilderAccount linked to this builder
      await prisma.builderAccount.create({
        data: {
          builder_id: builder.id,
          email: application.email,
          auth_method: 'magic_link',
          is_active: true,
        }
      })
    }

    // Update the application
    const updated = await prisma.builderApplicationForm.update({
      where: { id: req.params.id },
      data: {
        status,
        review_notes: review_notes || null,
        reviewed_by: (req as any).user?.id || 'admin-system',
        linked_builder: linkedBuilderId || null,
      }
    })

    res.json(updated)
  } catch (err: unknown) {
    console.error('[applications]', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router

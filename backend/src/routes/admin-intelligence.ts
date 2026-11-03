// Phase 5: Admin endpoints for intelligence management
import { Router, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/db'
import { generateAllIntelligence, ProjectDataForIntelligence } from '../lib/ai/generateIntelligence'
import { requireAdmin } from '../lib/adminAuth'

const router = Router()
router.use(requireAdmin)

// POST /api/admin/intelligence/batch
// Bulk generate intelligence for multiple projects
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { projectIds = [], sector = null } = req.body

    let ids = projectIds
    if (!ids.length && sector) {
      const projects = await prisma.project.findMany({
        where: { sector },
        select: { id: true }
      })
      ids = projects.map((p: { id: string }) => p.id)
    }

    if (!ids.length) return res.status(400).json({ error: 'No projects specified' })

    const results = []
    const errors = []

    for (const projectId of ids) {
      try {
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            builder: true,
            unit_types: { take: 10 },
            amenities: { take: 10 }
          }
        })

        if (!project) {
          errors.push({ projectId, error: 'Project not found' })
          continue
        }

        // Project has no price_max_cr column — derive the ceiling from unit types.
        const unitPriceMax = project.unit_types
          .map((u: { price_max_cr: number | null }) => u.price_max_cr)
          .filter((v): v is number => typeof v === 'number')

        const projectData: ProjectDataForIntelligence = {
          name: project.name,
          builder_name: project.builder.name,
          price_min_cr: project.price_min_cr,
          price_max_cr: unitPriceMax.length ? Math.max(...unitPriceMax) : null,
          possession_date: project.possession_date?.toISOString().split('T')[0],
          sector: project.sector,
          total_towers: project.total_towers,
          amenities: project.amenities.map((a: { name: string }) => a.name),
          location_connectivity: project.long_description || project.description || '',
          bhk_units: project.unit_types.map((u: { bhk: number; super_area_sqft: number | null; price_max_cr: number | null }) => ({
            bhk: u.bhk,
            area_sqft: u.super_area_sqft ?? undefined,
            price: u.price_max_cr ?? undefined
          })),
          rera_number: project.rera_number,
          launch_date: project.launch_date?.toISOString().split('T')[0]
        }

        const intelligence = generateAllIntelligence(projectData)

        const decision = await prisma.decisionProfile.upsert({
          where: { project_id: projectId },
          create: {
            project_id: projectId,
            // Generated data starts as DRAFT — a human verifies before publish.
            status: 'DRAFT',
            decision_thesis: `${project.name} in ${project.sector}`,
            ...intelligence
          },
          update: {
            ...intelligence,
            updated_at: new Date()
          }
        })

        results.push({
          projectId,
          decisionProfileId: decision.id,
          status: 'generated'
        })
      } catch (error) {
        errors.push({ projectId, error: (error as Error).message })
      }
    }

    res.json({
      message: `Generated intelligence for ${results.length} projects`,
      generated: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    })
  } catch (error) {
    console.error('Batch generation error:', error)
    res.status(500).json({ error: 'Batch generation failed' })
  }
})

// PATCH /api/admin/intelligence/:projectId
// Update specific intelligence field
router.patch('/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params
    const { field, data, notes } = req.body

    if (!field || !['financial_intelligence', 'market_intelligence', 'builder_intelligence', 'property_intelligence', 'comparative_analysis', 'resources_documents'].includes(field)) {
      return res.status(400).json({ error: 'Invalid field' })
    }

    const updateData: any = {
      [field]: data,
      updated_at: new Date(),
      recommendation_notes: notes
    }

    const decision = await prisma.decisionProfile.update({
      where: { project_id: projectId },
      data: updateData
    })

    res.json({
      message: 'Intelligence updated',
      projectId,
      field,
      updated: true
    })
  } catch (error) {
    console.error('Update intelligence error:', error)
    res.status(500).json({ error: 'Failed to update intelligence' })
  }
})

// GET /api/admin/intelligence/status/summary
// Intelligence completion status across projects
router.get('/status/summary', async (req: Request, res: Response) => {
  try {
    // project.count() drops archived duplicates via the client extension; a relation
    // filter does not, so profiles of archived projects are excluded explicitly.
    const live = { project: { archived_duplicate_of: null } }
    // A profile is incomplete when any of its six sections is empty (SQL or JSON null).
    const incompleteWhere = {
      ...live,
      OR: (['financial_intelligence', 'market_intelligence', 'builder_intelligence', 'property_intelligence', 'comparative_analysis', 'resources_documents'] as const)
        .map((f) => ({ [f]: { equals: Prisma.AnyNull } })),
    }
    const [total, withIntelligence, byStatus, incompleteCount, incompleteSample] = await Promise.all([
      prisma.project.count(),
      prisma.decisionProfile.count({ where: live }),
      prisma.decisionProfile.groupBy({ by: ['status'], where: live, _count: true }),
      prisma.decisionProfile.count({ where: incompleteWhere }),
      prisma.decisionProfile.findMany({
        where: incompleteWhere,
        select: {
          id: true,
          project_id: true,
          financial_intelligence: true,
          market_intelligence: true,
          builder_intelligence: true,
          property_intelligence: true,
          comparative_analysis: true,
          resources_documents: true
        },
        take: 10
      }),
    ])

    res.json({
      total_projects: total,
      with_intelligence: withIntelligence,
      // Null, not NaN, when the catalogue is empty.
      coverage_percent: total > 0 ? Math.round((withIntelligence / total) * 100) : null,
      by_status: byStatus.reduce(
        (acc: any, s: any) => ({ ...acc, [s.status]: s._count }),
        {}
      ),
      incomplete_count: incompleteCount,
      incomplete_sample: incompleteSample
    })
  } catch (error) {
    console.error('Status summary error:', error)
    res.status(500).json({ error: 'Failed to fetch status' })
  }
})

// PATCH /api/admin/intelligence/:projectId/verify
// Mark intelligence as verified by admin
router.patch('/:projectId/verify', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params

    const decision = await prisma.decisionProfile.update({
      where: { project_id: projectId },
      data: {
        status: 'PUBLISHED',
        last_verified_at: new Date(),
        verified_by: (req.headers['x-admin-user'] as string) || 'admin'
      }
    })

    res.json({
      message: 'Intelligence verified',
      projectId,
      verified_at: decision.last_verified_at,
      status: decision.status
    })
  } catch (error) {
    console.error('Verify error:', error)
    res.status(500).json({ error: 'Failed to verify intelligence' })
  }
})

export default router

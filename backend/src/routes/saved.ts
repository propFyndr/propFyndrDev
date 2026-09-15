// backend/src/routes/saved.ts
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/db'
import { verifyUser } from '../lib/auth'
import { toProjectCard } from '../lib/projectRepository'

const router = Router()

const SaveBodySchema = z.object({
  project_id: z.string().min(1),
})

async function getEffectiveUserId(req: Request): Promise<string | null> {
  const verifiedUserId = await verifyUser(req)
  if (verifiedUserId) return verifiedUserId
  const guestHeader = req.headers['x-guest-token']
  if (typeof guestHeader === 'string' && guestHeader.trim().length > 0) {
    return `guest_${guestHeader.trim()}`
  }
  return null
}

/**
 * Mirror a save into UserMemory.saved_slugs.
 *
 * `saved_slugs` had no writer anywhere in the codebase — only readers. So
 * `LeadProfile.engagement.projects_saved` was hard 0 for every buyer, and
 * `scoreLead`'s engagement component, worth up to 15 points, could never fire.
 * Production shows the consequence exactly: 760 of 763 stored leads are COLD.
 * Saving a property is one of the high-intent signals CLAUDE.md lists, and it
 * was reaching the score as a zero.
 *
 * SavedProperty keys guests as `guest_<token>` in its own user_id column, while
 * UserMemory keys them in `guest_token`. That split is why this is a helper and
 * not two inline blocks: getting it wrong writes a memory row nothing reads.
 */
export function memoryKeyFor(effectiveUserId: string): { user_id: string } | { guest_token: string } {
  return effectiveUserId.startsWith('guest_')
    ? { guest_token: effectiveUserId.slice('guest_'.length) }
    : { user_id: effectiveUserId }
}

async function mirrorSavedSlugs(effectiveUserId: string, projectId: string, action: 'add' | 'remove'): Promise<void> {
  const where = memoryKeyFor(effectiveUserId)

  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { slug: true } })
  if (!project) return

  const existing = await prisma.userMemory.findFirst({ where })
  const current = (existing?.saved_slugs as string[] | undefined) ?? []
  const next =
    action === 'add'
      ? [...new Set([...current, project.slug])]
      : current.filter(s => s !== project.slug)

  if (existing) {
    await prisma.userMemory.update({ where: { id: existing.id }, data: { saved_slugs: next } })
    return
  }
  // Nothing to remove from a memory row that does not exist yet.
  if (action === 'remove') return
  await prisma.userMemory.create({ data: { ...where, saved_slugs: next } })
}

router.get('/', async (req: Request, res: Response) => {
  const userId = await getEffectiveUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'Auth or guest token required' })
    return
  }

  try {
    const saved = await prisma.savedProperty.findMany({
      where: { user_id: userId },
      include: {
        project: {
          include: {
            builder: { select: { name: true, slug: true } },
            unit_types: { orderBy: { bhk: 'asc' } },
            amenities: true,
            connectivity: true,
            images: { orderBy: { sort_order: 'asc' } },
          },
        },
      },
      orderBy: { saved_at: 'desc' },
      take: 20,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projects = saved.map((s: any) => toProjectCard(s.project))
    res.json({ projects, count: projects.length })
  } catch (err) {
    console.error('[GET /saved]', err)
    res.status(500).json({ error: 'Failed to fetch saved' })
  }
})

router.post('/', async (req: Request, res: Response) => {
  const userId = await getEffectiveUserId(req)
  if (!userId) { res.status(401).json({ error: 'Auth or guest token required' }); return }

  const parsed = SaveBodySchema.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ error: 'project_id required' }); return }

  const { project_id } = parsed.data

  try {
    await prisma.savedProperty.upsert({
      where: { user_id_project_id: { user_id: userId, project_id } },
      create: { user_id: userId, project_id },
      update: {},
    })

    // Log engagement event for admin analytics
    await prisma.propertyEvent.create({
      data: {
        session_id: req.cookies?.sessionId || 'unknown',
        user_id: userId,
        project_id,
        action: 'save',
      }
    }).catch(err => console.error('[POST /saved] failed to create event:', err))

    // Never fail the save because the mirror failed — the mirror feeds lead
    // scoring, the save is what the buyer asked for.
    await mirrorSavedSlugs(userId, project_id, 'add').catch(err =>
      console.error('[POST /saved] saved_slugs mirror failed:', err),
    )

    res.status(201).json({ ok: true })
  } catch (err) {
    console.error('[POST /saved]', err)
    res.status(500).json({ error: 'Failed to save' })
  }
})

router.get('/:id/check', async (req: Request, res: Response) => {
  const userId = await getEffectiveUserId(req)
  if (!userId) { res.json({ is_saved: false }); return }

  try {
    const saved = await prisma.savedProperty.findUnique({
      where: { user_id_project_id: { user_id: userId, project_id: req.params.id } },
    })
    res.json({ is_saved: !!saved })
  } catch (err) {
    console.error('[GET /saved/:id/check]', err)
    res.status(500).json({ error: 'Failed to check' })
  }
})

// :id param represents project_id (the foreign key), NOT the saved record's internal id.
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = await getEffectiveUserId(req)
  if (!userId) { res.status(401).json({ error: 'Auth or guest token required' }); return }

  await prisma.savedProperty.deleteMany({
    where: { user_id: userId, project_id: req.params.id },
  })

  // Log engagement event for admin analytics
  await prisma.propertyEvent.create({
    data: {
      session_id: req.cookies?.sessionId || 'unknown',
      user_id: userId,
      project_id: req.params.id,
      action: 'remove_saved',
    }
  }).catch(err => console.error('[DELETE /saved] failed to create event:', err))

  await mirrorSavedSlugs(userId, req.params.id, 'remove').catch(err =>
    console.error('[DELETE /saved] saved_slugs mirror failed:', err),
  )

  res.json({ ok: true })
})

export default router

import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { verifyUser } from '../lib/auth'
import { checkRateLimit } from '../lib/cache'
import { buildDossier, loadDossier, addReaction } from '../lib/dossier'

export const dossierRouter = Router()

/**
 * POST /api/v1/dossier/create
 *
 * The chat builds dossiers through dossierHandler; this is the same builder for
 * API callers. Either an explicit shortlist (`projectIds`) or a `sessionId`
 * the caller owns.
 */
dossierRouter.post('/create', async (req: Request, res: Response) => {
  try {
    const { sessionId, projectIds, preparedFor, buyerName, budgetLabel, targetBhk, notes } = req.body || {}
    const userId = await verifyUser(req)
    const guestToken = (req.body?.guestToken as string | undefined) || (req.headers['x-guest-token'] as string | undefined) || null

    const limit = await checkRateLimit(`dossier_create:${userId ?? guestToken ?? req.ip}`, 10, 600)
    if (limit.remaining <= 0) {
      res.status(429).json({ error: 'Too many dossiers, try again later' })
      return
    }

    // A session id turns that chat's transcript into a public 30-day link, so
    // only the session's owner (signed-in user or guest token) may use it.
    if (sessionId) {
      const owner = await prisma.chatSession.findUnique({ where: { id: String(sessionId) }, select: { user_id: true, guest_token: true } })
      const owns = owner && ((userId && owner.user_id === userId) || (guestToken && owner.guest_token === guestToken))
      if (!owns) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
    }

    const result = await buildDossier({
      sessionId: sessionId ? String(sessionId) : null,
      userId,
      guestToken,
      projectIds: Array.isArray(projectIds) ? projectIds.filter((x: unknown) => typeof x === 'string') : undefined,
      preparedFor: typeof (preparedFor ?? buyerName) === 'string' ? (preparedFor ?? buyerName) : undefined,
      budgetLabel: typeof budgetLabel === 'string' ? budgetLabel.slice(0, 60) : undefined,
      targetBhk: typeof targetBhk === 'string' ? targetBhk.slice(0, 40) : undefined,
      notes: typeof notes === 'string' ? notes : undefined,
    })

    // No shortlist, no dossier. Substituting the newest catalogue rows would
    // present projects the buyer never discussed as their shortlist.
    if (!result.ok) {
      res.status(400).json({ error: 'No projects to include in the dossier' })
      return
    }

    res.json({
      success: true,
      token: result.dossier.token,
      shareUrl: `/dossier/${result.dossier.token}`,
      expiresAt: result.dossier.expiresAt,
      dossier: result.dossier,
    })
  } catch (err: any) {
    console.error('[DOSSIER:CREATE_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to create the dossier' })
  }
})

/**
 * GET /api/v1/dossier/:token
 * Public: anyone the buyer sent the link to can open it without an account.
 */
dossierRouter.get('/:token', async (req: Request, res: Response) => {
  const { token } = req.params
  if (!token || !/^[a-f0-9]{32}$/.test(token)) {
    res.status(404).json({ error: 'Dossier not found or link expired' })
    return
  }
  try {
    const dossier = await loadDossier(token)
    if (!dossier) {
      res.status(404).json({ error: 'Dossier not found or link expired' })
      return
    }
    res.json({ success: true, dossier })
  } catch (err: any) {
    console.error('[DOSSIER:GET_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to load the dossier' })
  }
})

/**
 * POST /api/v1/dossier/:token/react
 * Anyone holding the link can like a project or flag a concern on it.
 */
dossierRouter.post('/:token/react', async (req: Request, res: Response) => {
  const { token } = req.params
  const { projectId, reactionType, note } = req.body || {}

  if (!token || typeof projectId !== 'string' || (reactionType !== 'LIKE' && reactionType !== 'CONCERN')) {
    res.status(400).json({ error: 'Missing token, projectId, or reactionType' })
    return
  }

  try {
    // The link is public, so this is an open write: the dossier must exist,
    // the project must be one it lists, and one visitor gets a bounded number
    // of reactions per link.
    const limit = await checkRateLimit(`dossier_react:${token}:${req.ip}`, 30, 600)
    if (limit.remaining <= 0) {
      res.status(429).json({ error: 'Too many reactions, try again later' })
      return
    }
    const reactions = await addReaction(token, projectId, reactionType, note)
    if (!reactions) {
      res.status(404).json({ error: 'Dossier or project not found' })
      return
    }
    res.json({ success: true, reactions })
  } catch (err: any) {
    console.error('[DOSSIER:REACT_FAILED]', err?.message)
    res.status(500).json({ error: 'Failed to record the reaction' })
  }
})

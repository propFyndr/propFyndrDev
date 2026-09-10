// backend/src/routes/blog.ts
// Public blog endpoints — published posts only.
import { Router, Request, Response } from 'express'
import { prisma } from '../lib/db'
import { routeCache } from '../lib/routeCache'

const router = Router()

const LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  cover_image_url: true,
  author_name: true,
  published_at: true,
}

router.get('/', routeCache(300), async (req: Request, res: Response) => {
  const { limit = '20', offset = '0' } = req.query

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where: { status: 'published' },
      select: LIST_SELECT,
      orderBy: { published_at: 'desc' },
      take: Math.min(parseInt(limit as string) || 20, 50),
      skip: parseInt(offset as string) || 0,
    }),
    prisma.blogPost.count({ where: { status: 'published' } }),
  ])

  res.json({ posts, total })
})

router.get('/:slug', routeCache(900), async (req: Request, res: Response) => {
  const post = await prisma.blogPost.findFirst({
    where: { slug: req.params.slug, status: 'published' },
  })

  if (!post) {
    res.status(404).json({ error: 'Post not found' })
    return
  }

  res.json({ post })
})

export default router

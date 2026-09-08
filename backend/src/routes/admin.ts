import { Router, Request, Response } from 'express'
import { timingSafeEqual } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/db'
import { requireAdmin, destroyAdminSession } from '../lib/adminAuth'
import { createIdentitySession, verifyPassword } from '../lib/adminIdentity'
import { computeCompleteness } from '../lib/completeness'
import { checkRateLimit } from '../lib/cache'
import { z } from 'zod'

/**
 * A number the admin actually supplied, or null — never a substituted zero.
 *
 * The distinction is the whole product. `null` means "we have not checked";
 * `0` means "we checked and there are none". Several writers coerced an
 * untouched form field to 0, so an admin who never opened a section published
 * a verified-clean record for it — 280 projects carried `litigation_count: 0`
 * and 117 builders carried `delayed_projects_count: 0` that nobody had looked
 * up. Zero on a litigation count is the single most damaging value to be wrong
 * about, because it is the field a cautious buyer relies on.
 *
 * NaN is folded into null too: `parseInt('n/a')` is NaN, which Prisma rejects
 * at write time with a 500 instead of at validation time with a message.
 */
function numOrNull(val: unknown, parse: (s: string) => number = (s) => parseInt(s, 10)): number | null {
  if (val === undefined || val === null || val === '') return null
  const n = typeof val === 'number' ? val : parse(String(val).trim())
  return Number.isFinite(n) ? n : null
}

/** Accepts a real array or a comma-separated string; trims and drops blanks. */
function parseStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean)
  if (typeof val === 'string') return val.split(',').map((s) => s.trim()).filter(Boolean)
  return []
}

// ProjectDocument has no @relation to Project, and rows may carry either
// project_id or project_slug. Resolve the :id param (which may be an id OR a
// slug) to both, then match on either column.
async function findProjectDocuments(idOrSlug: string) {
  const project = await prisma.project.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, slug: true },
  })
  if (!project) return null
  const documents = await prisma.projectDocument.findMany({
    where: { OR: [{ project_id: project.id }, { project_slug: project.slug }] },
    orderBy: { created_at: 'desc' },
  })
  return { project, documents }
}

// Human-friendly labels for project fields
const FIELD_LABELS: Record<string, string> = {
  name: 'Project Name',
  slug: 'URL Slug',
  status: 'Project Status',
  price_min_cr: 'Min Price (Cr)',
  price_range_label: 'Price Range Display',
  possession_date: 'Possession Date',
  possession_label: 'Possession Quarter',
  rera_number: 'RERA Registration No',
  rera_url: 'RERA Portal URL',
  oc_obtained: 'Occupancy Certificate (OC)',
  description: 'Project Overview',
  long_description: 'Extended Description',
  sector: 'Sector Location',
  city: 'City',
  address: 'Full Address',
  total_units: 'Total Units Count',
  total_towers: 'Total Towers Count',
  land_area_acres: 'Land Area (Acres)',
  open_space_pct: 'Open Green Space %',
  hero_image_url: 'Hero Image Asset',
  legal_flag: 'Legal Compliance Status',
  walkability_score: 'Walkability Score',
  green_cover_percent: 'Green Cover %',
  women_safety_score: 'Women Safety Score',
  air_quality_index_avg: 'Average AQI',
  nri_eligible: 'NRI Eligibility',
  vastu_compliant: 'Vastu Compliance',
  water_source: 'Water Supply Source',
  dg_power_rate_per_unit: 'DG Power Rate (₹/kWh)',
  maintenance_per_sqft_monthly: 'Monthly Maintenance (₹/sq.ft)',
  has_png_gas_pipeline: 'PNG Gas Pipeline Active',
  mobile_network_rating: 'Mobile Network Rating',
  ceiling_height_ft: 'Clear Ceiling Height (ft)',
  lifts_per_tower: 'Lifts per Tower',
  has_service_lift: 'Dedicated Service Lift',
  shared_walls_type: 'Privacy / Shared Walls Layout',
  authority_dues_cleared: 'Authority Dues Cleared',
  land_tenure: 'Land Tenure',
  pet_friendly: 'Pet Friendly Society',
  bachelor_tenants_allowed: 'Bachelor Tenants Allowed',
}

const HIGH_IMPACT_FIELDS = new Set([
  'price_min_cr',
  'price_range_label',
  'status',
  'possession_date',
  'possession_label',
  'rera_number',
  'oc_obtained',
  'legal_flag',
])

export interface FieldDiff {
  field: string
  label: string
  old_value: unknown
  new_value: unknown
  is_high_impact: boolean
}

export function computeFieldDiffs(oldObj: Record<string, unknown>, newObj: Record<string, unknown>): FieldDiff[] {
  const diffs: FieldDiff[] = []
  for (const [key, newVal] of Object.entries(newObj)) {
    if (newVal === undefined) continue
    const oldVal = oldObj[key]
    
    // Normalize Dates
    const normalizedOld = oldVal instanceof Date ? oldVal.toISOString() : oldVal
    const normalizedNew = newVal instanceof Date ? newVal.toISOString() : newVal

    if (JSON.stringify(normalizedOld) !== JSON.stringify(normalizedNew)) {
      diffs.push({
        field: key,
        label: FIELD_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        old_value: oldVal ?? null,
        new_value: newVal ?? null,
        is_high_impact: HIGH_IMPACT_FIELDS.has(key),
      })
    }
  }
  return diffs
}

export async function recordAuditLog({
  entity_type,
  entity_id,
  entity_name,
  action,
  actor = 'Admin',
  summary,
  changes,
  ip_address,
}: {
  entity_type: string
  entity_id: string
  entity_name?: string
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPDATE'
  actor?: string
  summary: string
  changes?: FieldDiff[]
  ip_address?: string
}) {
  try {
    await (prisma as any).auditLog.create({
      data: {
        entity_type,
        entity_id,
        entity_name: entity_name || null,
        action,
        actor,
        summary,
        changes: changes && changes.length > 0 ? (changes as unknown as Prisma.InputJsonValue) : undefined,
        ip_address: ip_address || null,
      },
    })
  } catch (err) {
    console.error('[audit] failed to record audit log:', err)
  }
}

const router = Router()

// Constant-time password compare — avoids leaking length/match via timing.
function passwordMatches(input: string, expected: string): boolean {
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// POST /api/v1/admin/auth — exchange a password for a session token.
//
// Two paths, tried in order:
//  1. Real admin identity: `email` + `password` against `AdminUser`. This is
//     what makes "which admin did what" answerable, and what carries role and
//     builder/partner scope.
//  2. The single shared `ADMIN_PASSWORD` — kept working so nothing already
//     deployed breaks. Maps to a synthetic bootstrap SUPER_ADMIN identity
//     (adminUserId: 'root') rather than no identity at all, so even this path
//     shows up distinctly in the audit trail instead of merging into "Admin".
router.post('/auth', async (req: Request, res: Response) => {
  const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
  const isValidIp = /^(\d{1,3}\.){3}\d{1,3}$|^[a-f0-9:]+$/i.test(rawIp)
  const ip = isValidIp ? rawIp : 'unknown'
  const userAgent = (req.headers['user-agent'] as string) || 'unknown'

  // Rate limit: 50 attempts in dev, 5 in prod per 15 minutes per IP
  const maxAttempts = process.env.NODE_ENV === 'development' ? 50 : 5
  const { allowed } = await checkRateLimit(`admin:login:${ip}`, maxAttempts, 900)
  if (!allowed) {
    res.status(429).json({ error: 'Too many login attempts. Try again later.' })
    return
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (email) {
    const admin = await prisma.adminUser.findUnique({ where: { email } })
    if (!admin || !admin.is_active || !admin.password_hash || !password || !verifyPassword(password, admin.password_hash)) {
      res.status(401).json({ error: 'Wrong email or password' })
      return
    }
    await prisma.adminUser.update({ where: { id: admin.id }, data: { last_login_at: new Date() } })
    const token = await createIdentitySession({
      ip, userAgent,
      adminUserId: admin.id,
      email: admin.email,
      role: admin.role,
      builderId: admin.builder_id,
      partnerId: admin.partner_id,
    })
    res.json({ token, role: admin.role })
    return
  }

  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    console.error('[admin] ADMIN_PASSWORD not set — refusing login')
    res.status(500).json({ error: 'Admin auth not configured' })
    return
  }

  if (!password || !passwordMatches(password, expected)) {
    res.status(401).json({ error: 'Wrong password' })
    return
  }

  const token = await createIdentitySession({
    ip, userAgent,
    adminUserId: 'root',
    email: 'root@bootstrap',
    role: 'SUPER_ADMIN',
    builderId: null,
    partnerId: null,
  })
  res.json({ token, role: 'SUPER_ADMIN' })
})

// DELETE /api/v1/admin/auth — logout: clear session token
router.delete('/auth', requireAdmin, async (req: Request, res: Response) => {
  try {
    const token = ((req.cookies as any)?.admin_session ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '')) ?? ''

    if (token) {
      await destroyAdminSession(token)
    }
    res.clearCookie('admin_session', { httpOnly: true, secure: true, sameSite: 'strict' })
    res.json({ success: true, message: 'Logged out' })
  } catch (err) {
    console.error('[admin] logout failed:', err)
    res.status(500).json({ error: 'Logout failed' })
  }
})

// GET /api/v1/admin/callbacks — list all callbacks with filters
router.get('/callbacks', requireAdmin, async (req: Request, res: Response) => {
  const { limit = '50', offset = '0', tier, status } = req.query

  try {
    const where: any = {}
    if (tier && tier !== 'all') {
      where.lead_tier = tier as string
    }
    if (status && status !== 'all') {
      where.status = status as string
    }

    const limitNum = parseInt(limit as string) || 50
    const offsetNum = parseInt(offset as string) || 0
    if (isNaN(limitNum) || isNaN(offsetNum) || limitNum < 1 || offsetNum < 0) {
      res.status(400).json({ error: 'Invalid limit or offset parameters' })
      return
    }

    const [callbacks, total] = await Promise.all([
      prisma.callbackRequest.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: limitNum,
        skip: offsetNum,
      }),
      prisma.callbackRequest.count({ where }),
    ])

    res.json({
      callbacks,
      total,
      limit: limitNum,
      offset: offsetNum,
    })
  } catch (err) {
    console.error('[admin] callbacks query failed:', err)
    res.status(500).json({ error: 'Failed to fetch callbacks' })
  }
})

// GET /api/v1/admin/callbacks/:id — view single callback
router.get('/callbacks/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const callback = await prisma.callbackRequest.findUnique({
      where: { id },
    })

    if (!callback) {
      res.status(404).json({ error: 'Callback not found' })
      return
    }

    res.json(callback)
  } catch (err) {
    console.error('[admin] callback detail failed:', err)
    res.status(500).json({ error: 'Failed to fetch callback' })
  }
})

// GET /api/v1/admin/stats — funnel metrics
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const [totalCallbacks, hotLeads, warmLeads, coldLeads, scoreAgg] = await Promise.all([
      prisma.callbackRequest.count(),
      prisma.callbackRequest.count({ where: { lead_tier: 'HOT' } }),
      prisma.callbackRequest.count({ where: { lead_tier: 'WARM' } }),
      prisma.callbackRequest.count({ where: { lead_tier: 'COLD' } }),
      prisma.callbackRequest.aggregate({ _avg: { lead_score: true } }),
    ])

    res.json({
      totalCallbacks,
      hotLeads,
      warmLeads,
      coldLeads,
      avgScore: scoreAgg._avg.lead_score ?? 0,
    })
  } catch (err) {
    console.error('[admin] stats failed:', err)
    res.status(500).json({ error: 'Failed to fetch stats' })
  }
})

// GET /api/v1/admin/projects — list projects for dashboard & management
router.get('/projects', requireAdmin, async (req: Request, res: Response) => {
  const { limit = '1000', offset = '0', q, search } = req.query
  const searchTerm = (q || search) as string | undefined

  // Lightweight health check (layout.tsx calls this on mount; avoid heavy DB joins)
  if (searchTerm === '_check') {
    res.json({ projects: [], total: 0, health: 'ok' })
    return
  }

  try {
    const where: any = {}
    if (searchTerm && typeof searchTerm === 'string') {
      const queryStr = searchTerm.trim()
      where.OR = [
        { name: { contains: queryStr, mode: 'insensitive' } },
        { slug: { contains: queryStr, mode: 'insensitive' } },
        { sector: { contains: queryStr, mode: 'insensitive' } },
        { builder: { name: { contains: queryStr, mode: 'insensitive' } } },
      ]
    }

    // Retry logic for cold-start connection errors
    let projects: any[] = []
    let total = 0
    let retries = 0
    const maxRetries = 2
    const backoffMs = [10, 100] // ms delays on retry

    while (retries <= maxRetries) {
      try {
        [projects, total] = await Promise.all([
          (prisma.project.findMany as any)({
            where,
            include: {
              builder: { select: { id: true, name: true, slug: true } },
              unit_types: true,
              images: true,
              amenities: true,
              connectivity: true,
              dna: true,
              decision_profile: true,
              persona_profile: true,
              recommendation_profile: true,
              competitors: true,
              cost_sheet: true,
              payment_plans: true,
              construction_milestones: true,
              construction_updates: true,
              lifecycle_updates: true,
              price_history: true,
              channel_partners: true,
              spec_items: true,
            },
            orderBy: { name: 'asc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string),
          }),
          prisma.project.count({ where }),
        ])
        break // Success, exit retry loop
      } catch (err) {
        if (retries < maxRetries) {
          console.warn(`[admin] projects query retry ${retries + 1}/${maxRetries}:`, err instanceof Error ? err.message : err)
          await new Promise(r => setTimeout(r, backoffMs[Math.min(retries, backoffMs.length - 1)]))
          retries++
        } else {
          console.error('[admin] projects query failed after all retries:', err instanceof Error ? err.message : err)
          throw err // Final retry failed, propagate error
        }
      }
    }

    // Compute exact completeness score & tabScores for each project for admin dashboard alignment
    const safeProjects = projects.map(p => {
      const completeness = computeCompleteness(p as any)
      return {
        ...p,
        unit_types: p.unit_types ?? [],
        images: p.images ?? [],
        completenessScore: completeness.totalScore,
        tabScores: completeness.tabScores,
      }
    })

    res.json({ projects: safeProjects, total, limit: parseInt(limit as string), offset: parseInt(offset as string) })
  } catch (err) {
    console.error('[admin] projects query failed:', err)
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

// POST /api/v1/admin/projects — create project
router.post('/projects', requireAdmin, async (req: Request, res: Response) => {
  const { name, slug, sector, city = 'Noida', builder_id, status } = req.body

  if (!name || !builder_id || !status) {
    res.status(400).json({ error: 'name, builder_id, and status are required' })
    return
  }

  const generatedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')

  try {
    const project = await prisma.project.create({
      data: {
        name,
        slug: generatedSlug,
        sector: sector || 'Central Noida',
        city,
        builder_id,
        status,
      },
      include: {
        builder: { select: { id: true, name: true, slug: true } },
        unit_types: true,
        images: true,
      },
    })

    res.status(201).json({ project })
  } catch (err) {
    console.error('[admin] project create failed:', err)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

// GET /api/v1/admin/projects/:id — get project detail
router.get('/projects/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const project = await (prisma.project.findFirst as any)({
      where: {
        OR: [{ id }, { slug: id }]
      },
      include: {
        builder: { select: { id: true, name: true, slug: true, logo_url: true } },
        unit_types: true,
        images: true,
        amenities: true,
        connectivity: true,
        dna: true,
        decision_profile: true,
        persona_profile: true,
        recommendation_profile: true,
        competitors: { orderBy: { sort_order: 'asc' } },
        spec_items: { include: { unit_type: { select: { id: true, name: true, bhk: true } } }, orderBy: [{ sort_order: 'asc' }, { category: 'asc' }] },
        construction_milestones: { orderBy: { completion_pct: 'desc' } },
        construction_updates: { orderBy: { update_date: 'desc' } },
        lifecycle_updates: { orderBy: { update_date: 'desc' } },
        price_history: { orderBy: { recorded_at: 'desc' } },
        channel_partners: { include: { channel_partner: true }, orderBy: { created_at: 'asc' } },
        payment_plans: { orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }] },
        cost_sheet: true,
      },
    })

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const p = project as any
    const safeProject = {
      ...p,
      dna: p.dna ?? null,
      unit_types: p.unit_types ?? [],
      images: p.images ?? [],
      payment_plans: p.payment_plans ?? [],
      construction_milestones: p.construction_milestones ?? [],
      construction_updates: p.construction_updates ?? [],
      lifecycle_updates: p.lifecycle_updates ?? [],
      price_history: p.price_history ?? [],
      spec_items: p.spec_items ?? [],
      // Primary plan — the admin editor edits one plan at a time.
      payment_plan: p.payment_plans?.[0] ?? null,
    }

    res.json({ project: safeProject, ...safeProject })
  } catch (err) {
    console.error('[admin] project detail failed:', err)
    res.status(500).json({ error: 'Failed to fetch project' })
  }
})

// GET /api/v1/admin/projects/:id/documents — brochures & docs for a project
router.get('/projects/:id/documents', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const found = await findProjectDocuments(id)
    if (!found) {
      res.status(404).json({ error: 'Project not found' })
      return
    }
    res.json({ documents: found.documents, total: found.documents.length })
  } catch (err) {
    console.error('[admin] project documents failed:', err)
    res.status(500).json({ error: 'Failed to fetch project documents' })
  }
})

// GET /api/v1/admin/projects/:id/completeness — publish-readiness score
router.get('/projects/:id/completeness', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      include: {
        builder: { select: { id: true, name: true } },
        unit_types: true,
        images: true,
        amenities: true,
        connectivity: true,
        dna: true,
        decision_profile: true,
        persona_profile: true,
        recommendation_profile: true,
        competitors: true,
        cost_sheet: true,
        payment_plans: true,
        construction_milestones: true,
        construction_updates: true,
        lifecycle_updates: true,
        price_history: true,
        channel_partners: true,
      },
    })

    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    // ProjectDocument has no relation to Project — fetch separately.
    const docs = await prisma.projectDocument.findMany({
      where: { OR: [{ project_id: project.id }, { project_slug: project.slug }] },
      select: { doc_type: true },
    })

    // Responded unwrapped: the admin project page does setCompleteness(json) directly.
    res.json(computeCompleteness({ ...project, documents: docs } as any))
  } catch (err) {
    console.error('[admin] project completeness failed:', err)
    res.status(500).json({ error: 'Failed to compute completeness' })
  }
})

// GET /api/v1/admin/audit-logs — list audit history and changelogs
router.get('/audit-logs', requireAdmin, async (req: Request, res: Response) => {
  const { entity_type, entity_id, mode = 'detailed', field, limit = '50', offset = '0' } = req.query
  try {
    const where: any = {}
    if (entity_type && entity_type !== 'all') where.entity_type = entity_type as string
    if (entity_id && entity_id !== 'all') where.entity_id = entity_id as string

    const take = Math.min(parseInt(limit as string) || 50, 100)
    const skip = parseInt(offset as string) || 0

    const [logs, total] = await Promise.all([
      (prisma as any).auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take,
        skip,
      }),
      (prisma as any).auditLog.count({ where }),
    ])

    // If mode is precise, filter changes to high-impact fields only or entries with high-impact changes
    let processedLogs = logs
    if (mode === 'precise') {
      processedLogs = logs.map((log: any) => {
        const changes = Array.isArray(log.changes) ? (log.changes as Array<{ field: string; is_high_impact?: boolean }>) : []
        const highImpactChanges = changes.filter((c) => c.is_high_impact || HIGH_IMPACT_FIELDS.has(c.field))
        return {
          ...log,
          changes: highImpactChanges,
        }
      }).filter((log: any) => log.action !== 'UPDATE' || (Array.isArray(log.changes) && log.changes.length > 0))
    }

    if (field && typeof field === 'string' && field !== 'all') {
      processedLogs = processedLogs.filter((log: any) => {
        const changes = Array.isArray(log.changes) ? (log.changes as Array<{ field?: string }>) : []
        return changes.some((c) => c.field?.toLowerCase().includes((field as string).toLowerCase()))
      })
    }

    res.json({ logs: processedLogs, total, limit: take, offset: skip })
  } catch (err) {
    console.error('[admin] audit-logs failed:', err)
    res.status(500).json({ error: 'Failed to fetch audit logs' })
  }
})

// GET /api/v1/admin/projects/export — export projects as CSV or JSON
router.get('/projects/export', requireAdmin, async (req: Request, res: Response) => {
  const { filter = 'all', format = 'json' } = req.query
  try {
    const projects = await prisma.project.findMany({
      include: {
        builder: { select: { id: true, name: true } },
        unit_types: true,
        images: true,
        amenities: true,
        connectivity: true,
        dna: true,
        decision_profile: true,
        persona_profile: true,
        recommendation_profile: true,
        competitors: true,
        cost_sheet: true,
        payment_plans: true,
        construction_milestones: true,
        construction_updates: true,
        lifecycle_updates: true,
        price_history: true,
        channel_partners: true,
      },
      orderBy: { name: 'asc' },
    })

    const mapped = projects.map((p) => {
      const completeness = computeCompleteness(p as any)
      // Non-media completeness: weighted average excluding media tab
      const tabScores = completeness.tabScores
      const nonMediaScore = Math.round(
        (tabScores.core * 0.20) +
        (tabScores.pricing * 0.25) +
        (tabScores.intelligence * 0.25) +
        (tabScores.updates * 0.15) +
        (tabScores.partners * 0.15)
      )

      const allMissing = [
        ...completeness.missing.overview,
        ...completeness.missing.units,
        ...completeness.missing.builder,
        ...completeness.missing.intelligence,
        ...completeness.missing.competitors,
        ...completeness.missing.updates,
        ...completeness.missing.partners,
      ]

      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        builder: p.builder?.name || '',
        sector: p.sector,
        city: p.city,
        status: p.status,
        price_min_cr: p.price_min_cr,
        price_range_label: p.price_range_label,
        rera_number: p.rera_number || '',
        possession_date: p.possession_date ? p.possession_date.toISOString().split('T')[0] : '',
        possession_label: p.possession_label || '',
        total_units: p.total_units || 0,
        total_towers: p.total_towers || 0,
        land_area_acres: p.land_area_acres || 0,
        unit_types_count: p.unit_types.length,
        images_count: p.images.length,
        completeness_score: completeness.totalScore,
        non_media_score: nonMediaScore,
        is_partially_filled: nonMediaScore < 70,
        missing_fields: allMissing.join('; '),
      }
    })

    let result = mapped
    if (filter === 'partially_filled') {
      result = mapped.filter(p => p.is_partially_filled)
    }

    if (format === 'csv') {
      const headers = [
        'id', 'slug', 'name', 'builder', 'sector', 'city', 'status',
        'price_min_cr', 'price_range_label', 'rera_number', 'possession_date', 'possession_label',
        'total_units', 'total_towers', 'land_area_acres', 'unit_types_count',
        'completeness_score', 'non_media_score', 'is_partially_filled', 'missing_fields'
      ]

      const csvRows = [headers.join(',')]
      for (const r of result) {
        const row = headers.map(h => {
          const val = (r as any)[h] ?? ''
          const escaped = String(val).replace(/"/g, '""')
          return `"${escaped}"`
        })
        csvRows.push(row.join(','))
      }

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="propfyndr-projects-${filter}-${Date.now()}.csv"`)
      res.send(csvRows.join('\n'))
      return
    }

    res.json({ projects: result, total: result.length })
  } catch (err) {
    console.error('[admin] export projects failed:', err)
    res.status(500).json({ error: 'Failed to export projects' })
  }
})

// POST /api/v1/admin/projects/bulk-import — bulk update prices, statuses, possession
router.post('/projects/bulk-import', requireAdmin, async (req: Request, res: Response) => {
  const { rows, updatePricingOnly = false } = req.body
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: 'rows must be a non-empty array' })
    return
  }

  const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
  let updated = 0
  let skipped = 0
  const errors: Array<{ row: number; slug?: string; reason: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const slug = row.slug?.trim() || row.id?.trim()
    if (!slug) {
      errors.push({ row: i + 1, reason: 'Missing slug or id identifier' })
      skipped++
      continue
    }

    try {
      const existing = await prisma.project.findFirst({
        where: { OR: [{ id: slug }, { slug }] },
      })

      if (!existing) {
        errors.push({ row: i + 1, slug, reason: `Project with identifier '${slug}' not found` })
        skipped++
        continue
      }

      const updateData: any = {}
      if (row.price_min_cr !== undefined && row.price_min_cr !== '') {
        const parsed = parseFloat(row.price_min_cr)
        if (!isNaN(parsed)) updateData.price_min_cr = parsed
      }
      if (row.price_range_label) updateData.price_range_label = row.price_range_label.trim()
      if (row.possession_label) updateData.possession_label = row.possession_label.trim()
      if (row.possession_date) {
        const d = new Date(row.possession_date)
        if (!isNaN(d.getTime())) updateData.possession_date = d
      }
      if (row.status && ['ready_to_move', 'under_construction', 'new_launch'].includes(row.status.trim())) {
        updateData.status = row.status.trim()
      }
      if (row.rera_number) updateData.rera_number = row.rera_number.trim()
      if (!updatePricingOnly) {
        if (row.description) updateData.description = row.description.trim()
        if (row.total_units) {
          const u = parseInt(row.total_units)
          if (!isNaN(u)) updateData.total_units = u
        }
      }

      if (Object.keys(updateData).length === 0) {
        skipped++
        continue
      }

      const diffs = computeFieldDiffs(existing as any, updateData)
      if (diffs.length > 0) {
        await prisma.project.update({
          where: { id: existing.id },
          data: updateData,
        })

        const summaryParts = diffs.map(d => `${d.label} (${d.old_value ?? '—'} → ${d.new_value ?? '—'})`)
        await recordAuditLog({
          entity_type: 'project',
          entity_id: existing.id,
          entity_name: existing.name,
          action: 'BULK_UPDATE',
          actor: 'BulkCSV',
          summary: `Bulk CSV updated: ${summaryParts.join(', ')}`,
          changes: diffs,
          ip_address: rawIp,
        })

        updated++
      } else {
        skipped++
      }
    } catch (err: any) {
      errors.push({ row: i + 1, slug, reason: err?.message || 'Database update failed' })
      skipped++
    }
  }

  res.json({ updated, skipped, errors, totalRows: rows.length })
})

// PATCH /api/v1/admin/projects/:id — update project
router.patch('/projects/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const updates = req.body
  const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'

  try {
    const existing = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    })

    if (!existing) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const { id: _, created_at: __, updated_at: ___, builder: ____, unit_types: _____, images: ______, ...validFields } = updates

    if (validFields.possession_date) {
      validFields.possession_date = new Date(validFields.possession_date)
    }
    if (validFields.launch_date) {
      validFields.launch_date = new Date(validFields.launch_date)
    }

    const diffs = computeFieldDiffs(existing as any, validFields)

    const project = await prisma.project.update({
      where: { id: existing.id },
      data: validFields,
      include: {
        builder: { select: { id: true, name: true, slug: true } },
        unit_types: true,
        images: true,
      },
    })

    if (diffs.length > 0) {
      const changedNames = diffs.map(d => d.label).slice(0, 3).join(', ') + (diffs.length > 3 ? ` and ${diffs.length - 3} more` : '')
      await recordAuditLog({
        entity_type: 'project',
        entity_id: project.id,
        entity_name: project.name,
        action: 'UPDATE',
        actor: 'Admin',
        summary: `Admin updated ${changedNames}`,
        changes: diffs,
        ip_address: rawIp,
      })
    }

    const safeProject = {
      ...project,
      unit_types: project.unit_types ?? [],
      images: project.images ?? [],
    }

    res.json({ project: safeProject, ...safeProject })
  } catch (err) {
    console.error('[admin] project update failed:', err)
    res.status(500).json({ error: 'Failed to update project' })
  }
})

// DELETE /api/v1/admin/projects/:id — delete project with cascading cleanup
router.delete('/projects/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown'
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, name: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    await recordAuditLog({
      entity_type: 'project',
      entity_id: project.id,
      entity_name: project.name,
      action: 'DELETE',
      actor: 'Admin',
      summary: `Admin deleted project "${project.name}"`,
      ip_address: rawIp,
    })


    const targetId = project.id

    await prisma.$transaction(async (tx) => {
      // Clean up all related records to prevent foreign key constraint violations
      await tx.amenity.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] amenity delete failed:', e))
      await tx.connectivity.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] connectivity delete failed:', e))
      await tx.projectImage.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] projectImage delete failed:', e))
      await tx.unitType.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] unitType delete failed:', e))
      await tx.paymentPlan.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] paymentPlan delete failed:', e))
      await tx.costSheet.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] costSheet delete failed:', e))
      await tx.priceHistory.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] priceHistory delete failed:', e))
      await tx.constructionMilestone.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] constructionMilestone delete failed:', e))
      await tx.constructionUpdate.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] constructionUpdate delete failed:', e))
      await tx.projectLifecycleUpdate.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] projectLifecycleUpdate delete failed:', e))
      await tx.unitInventory.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] unitInventory delete failed:', e))
      await tx.projectChannelPartner.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] projectChannelPartner delete failed:', e))
      await tx.projectCompetitor.deleteMany({
        where: { OR: [{ project_id: targetId }, { competitor_project_id: targetId }] }
      }).catch(e => console.warn('[admin] projectCompetitor delete failed:', e))
      await tx.savedProperty.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] savedProperty delete failed:', e))
      await tx.priceAlert.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] priceAlert delete failed:', e))
      await tx.builderLead.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] builderLead delete failed:', e))
      await tx.projectDna.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] projectDna delete failed:', e))
      await tx.decisionProfile.deleteMany({ where: { project_id: targetId } }).catch(e => console.warn('[admin] decisionProfile delete failed:', e))
      await tx.personaProfile.deleteMany({ where: { project_id: targetId } }).catch(() => {})
      await tx.recommendationProfile.deleteMany({ where: { project_id: targetId } }).catch(() => {})

      // Unlink focused project from chat sessions
      await tx.chatSession.updateMany({
        where: { focus_project_id: targetId },
        data: { focus_project_id: null }
      }).catch(() => {})

      // Finally delete the project record
      await tx.project.delete({ where: { id: targetId } })
    })

    res.json({ success: true, message: 'Project deleted successfully' })
  } catch (err: any) {
    console.error('[admin] project delete failed:', err)
    res.status(500).json({ error: err?.message || 'Failed to delete project' })
  }
})

// GET /api/v1/admin/projects/:id/milestones — fetch construction milestones
router.get('/projects/:id/milestones', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, slug: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const milestones = await prisma.constructionMilestone.findMany({
      where: { project_id: project.id },
      orderBy: { sort_order: 'asc' }
    })

    res.json({ milestones })
  } catch (err) {
    console.error('[admin] fetch milestones failed:', err)
    res.status(500).json({ error: 'Failed to fetch milestones' })
  }
})

// PUT /api/v1/admin/projects/:id/milestones — save/update construction milestones
router.put('/projects/:id/milestones', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const { milestones } = req.body as { milestones: Array<{ name: string; status: 'completed' | 'in_progress' | 'upcoming'; date_label?: string; sort_order?: number }> }

  if (!Array.isArray(milestones)) {
    res.status(400).json({ error: 'milestones array required' })
    return
  }

  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, slug: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    await prisma.$transaction(async (tx) => {
      await tx.constructionMilestone.deleteMany({ where: { project_id: project.id } })
      if (milestones.length > 0) {
        await tx.constructionMilestone.createMany({
          data: milestones.map((m, idx) => ({
            project_id: project.id,
            name: m.name.trim(),
            status: m.status as any,
            date_label: m.date_label ? m.date_label.trim() : null,
            sort_order: m.sort_order ?? (idx + 1)
          }))
        })
      }
    })

    const updated = await prisma.constructionMilestone.findMany({
      where: { project_id: project.id },
      orderBy: { sort_order: 'asc' }
    })

    res.json({ ok: true, milestones: updated })
  } catch (err) {
    console.error('[admin] update milestones failed:', err)
    res.status(500).json({ error: 'Failed to save construction milestones' })
  }
})

// GET /api/v1/admin/projects/:id/specs — fetch project specifications and materials
router.get('/projects/:id/specs', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, slug: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const specs = await (prisma as any).projectSpecItem.findMany({
      where: { project_id: project.id },
      include: { unit_type: { select: { id: true, name: true, bhk: true } } },
      orderBy: [{ sort_order: 'asc' }, { category: 'asc' }]
    })

    res.json({ specs })
  } catch (err: any) {
    console.error('[admin] fetch specs failed:', err)
    res.status(500).json({ error: 'Failed to fetch project specifications' })
  }
})

// PUT /api/v1/admin/projects/:id/specs — save/update project specifications
router.put('/projects/:id/specs', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const { specs } = req.body as { specs: any[] }

  if (!Array.isArray(specs)) {
    res.status(400).json({ error: 'specs array required' })
    return
  }

  const invalidSpecs = specs.filter(s => !s.label?.trim() || !s.value?.trim())
  if (invalidSpecs.length > 0) {
    res.status(400).json({ error: 'Label and value are required for all specifications' })
    return
  }

  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, slug: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    await prisma.$transaction(async (tx) => {
      await (tx as any).projectSpecItem.deleteMany({ where: { project_id: project.id } })
      if (specs.length > 0) {
        await (tx as any).projectSpecItem.createMany({
          data: specs.map((s, idx) => ({
            project_id: project.id,
            unit_type_id: s.unit_type_id || null,
            category: s.category || 'structure',
            label: s.label?.trim(),
            value: s.value?.trim(),
            brand: s.brand?.trim() || null,
            tier: s.tier || null,
            is_highlight: Boolean(s.is_highlight),
            sort_order: s.sort_order ?? (idx + 1),
            notes: s.notes?.trim() || null
          }))
        })
      }
    })

    const updated = await (prisma as any).projectSpecItem.findMany({
      where: { project_id: project.id },
      include: { unit_type: { select: { id: true, name: true, bhk: true } } },
      orderBy: [{ sort_order: 'asc' }, { category: 'asc' }]
    })

    res.json({ ok: true, specs: updated })
  } catch (err: any) {
    console.error('[admin] update specs failed:', err)
    res.status(400).json({ error: err.message || 'Failed to save specifications' })
  }
})

// POST /api/v1/admin/projects/:id/specs — alias for saving specs
router.post('/projects/:id/specs', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const { specs } = req.body as { specs: any[] }

  if (!Array.isArray(specs)) {
    res.status(400).json({ error: 'specs array required' })
    return
  }

  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, slug: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    await prisma.$transaction(async (tx) => {
      await (tx as any).projectSpecItem.deleteMany({ where: { project_id: project.id } })
      if (specs.length > 0) {
        await (tx as any).projectSpecItem.createMany({
          data: specs.map((s, idx) => ({
            project_id: project.id,
            unit_type_id: s.unit_type_id || null,
            category: s.category || 'structure',
            label: s.label?.trim(),
            value: s.value?.trim(),
            brand: s.brand?.trim() || null,
            tier: s.tier || null,
            is_highlight: Boolean(s.is_highlight),
            sort_order: s.sort_order ?? (idx + 1),
            notes: s.notes?.trim() || null
          }))
        })
      }
    })

    const updated = await (prisma as any).projectSpecItem.findMany({
      where: { project_id: project.id },
      include: { unit_type: { select: { id: true, name: true, bhk: true } } },
      orderBy: [{ sort_order: 'asc' }, { category: 'asc' }]
    })

    res.json({ ok: true, specs: updated })
  } catch (err: any) {
    console.error('[admin] post specs failed:', err)
    res.status(500).json({ error: 'Failed to save specifications' })
  }
})

// GET /api/v1/admin/builders — list builders
router.get('/builders', requireAdmin, async (req: Request, res: Response) => {
  const { limit = '100', offset = '0', q, search } = req.query
  const searchTerm = (q || search) as string | undefined

  try {
    const where: any = {}
    if (searchTerm && typeof searchTerm === 'string') {
      const queryStr = searchTerm.trim()
      where.OR = [
        { name: { contains: queryStr, mode: 'insensitive' } },
        { slug: { contains: queryStr, mode: 'insensitive' } },
      ]
    }

    const [builders, total] = await Promise.all([
      prisma.builder.findMany({
        where,
        include: {
          _count: { select: { projects: true } },
          projects: {
            select: {
              id: true,
              name: true,
              slug: true,
              sector: true,
              city: true,
              status: true,
            },
            orderBy: { name: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.builder.count({ where }),
    ])

    res.json({ builders, total, limit: parseInt(limit as string), offset: parseInt(offset as string) })
  } catch (err) {
    console.error('[admin] builders query failed:', err)
    res.status(500).json({ error: 'Failed to fetch builders' })
  }
})

// POST /api/v1/admin/builders — create builder
router.post('/builders', requireAdmin, async (req: Request, res: Response) => {
  const {
    name,
    slug,
    founded_year,
    headquarters,
    website,
    logo_url,
    cin,
    rera_promoter_id,
    founder,
    parent_group,
    delivered_projects,
    ongoing_projects,
    delayed_projects_count,
    average_delay_months,
    credai_member,
    delivered_units,
    rera_compliance_score,
    iso_certified,
    description,
    company_overview,
  } = req.body

  if (!name) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const { randomUUID } = await import('crypto')
  const baseSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
  const generatedSlug = baseSlug + '-' + randomUUID().slice(0, 8)

  try {
    const builder = await prisma.builder.create({
      data: {
        name,
        slug: generatedSlug,
        founded_year: founded_year ? parseInt(founded_year) : null,
        headquarters: headquarters || null,
        website: website || null,
        logo_url: logo_url || null,
        cin: cin || null,
        rera_promoter_id: rera_promoter_id || null,
        founder: founder || null,
        parent_group: parent_group || null,
        delivered_projects: parseStringArray(delivered_projects),
        ongoing_projects: parseStringArray(ongoing_projects),
        // null, not 0. These two are the honest-negative fields — "how many of
        // this builder's projects ran late, and by how long". Defaulting an
        // untouched form to 0 turns "nobody has checked" into "verified clean
        // record", which is a claim we cannot support and the most damaging
        // direction to be wrong in. `numOrNull` keeps NaN out too: parseInt on
        // a stray string yields NaN, which Prisma rejects at write time with a
        // 500 rather than at validation time with a message.
        delayed_projects_count: numOrNull(delayed_projects_count),
        average_delay_months: numOrNull(average_delay_months, parseFloat),
        credai_member: credai_member || false,
        delivered_units: delivered_units ? parseInt(delivered_units) : null,
        rera_compliance_score: rera_compliance_score ? parseInt(rera_compliance_score) : null,
        iso_certified: iso_certified || false,
        description: description || company_overview || null,
      },
      include: {
        _count: { select: { projects: true } },
      },
    })

    res.status(201).json({ builder })
  } catch (err) {
    console.error('[admin] builder create failed:', err)
    res.status(500).json({ error: 'Failed to create builder' })
  }
})

// PATCH /api/v1/admin/builders/:id — update builder
router.patch('/builders/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const updates = req.body

  try {
    const { id: _, created_at: __, _count: ___, projects: ____, ...validFields } = updates

    // Coerce types for numeric and array fields
    const data: any = { ...validFields }
    // Every one of these clears to null rather than to 0 — see numOrNull.
    for (const f of ['founded_year', 'delivered_units', 'rera_compliance_score', 'delayed_projects_count'] as const) {
      if (data[f] !== undefined) data[f] = numOrNull(data[f])
    }
    if (data.average_delay_months !== undefined) data.average_delay_months = numOrNull(data.average_delay_months, parseFloat)
    for (const f of ['delivered_projects', 'ongoing_projects'] as const) {
      if (data[f] !== undefined) data[f] = parseStringArray(data[f])
    }
    if (data.company_overview) { data.description = data.company_overview; delete data.company_overview }

    const builder = await prisma.builder.update({
      where: { id },
      data,
      include: {
        _count: { select: { projects: true } },
      },
    })

    res.json(builder)
  } catch (err) {
    console.error('[admin] builder update failed:', err)
    res.status(500).json({ error: 'Failed to update builder' })
  }
})

// GET /api/v1/admin/sectors — list all sector intelligence
router.get('/sectors', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const sectors = await prisma.sectorIntelligence.findMany({
      orderBy: [{ city: 'asc' }, { sector: 'asc' }]
    })
    res.json({ sectors })
  } catch (err) {
    console.error('[admin] sectors query failed:', err)
    res.status(500).json({ error: 'Failed to fetch sector intelligence' })
  }
})

/**
 * What a sector-intelligence PUT is allowed to change.
 *
 * The first version spread `req.body` straight into the Prisma update. That is
 * mass assignment: any column on the model becomes writable by whatever the
 * client sends, `id` and `created_at` included, and an unrecognised key is a
 * Prisma exception surfaced as a 500 rather than a validation message. Every
 * other writer in this file works from an allowlist; this one now does too.
 *
 * Numbers are coerced through `numOrNull`, so clearing a field stores null
 * rather than 0 — an AQI of 0 is not a clean reading, it is a missing one.
 */
const SectorIntelligenceUpdate = z.object({
  aqi_annual_avg: z.union([z.number(), z.string(), z.null()]).optional(),
  aqi_winter_peak: z.union([z.number(), z.string(), z.null()]).optional(),
  aqi_monsoon_low: z.union([z.number(), z.string(), z.null()]).optional(),
  monitoring_station_name: z.string().trim().max(200).nullish(),
  flood_waterlogging_risk: z.enum(['LOW', 'MODERATE', 'HIGH', 'BUFFER_ZONE']).nullish(),
  flood_zone_description: z.string().trim().max(1000).nullish(),
  drainage_network_quality: z.enum(['EXCELLENT', 'SATISFACTORY', 'DEVELOPING']).nullish(),
  airport_distance_km: z.union([z.number(), z.string(), z.null()]).optional(),
  nearest_metro_station: z.string().trim().max(200).nullish(),
  metro_distance_km: z.union([z.number(), z.string(), z.null()]).optional(),
  expressway_proximity_km: z.union([z.number(), z.string(), z.null()]).optional(),
  micro_market: z.string().trim().max(200).nullish(),
}).strict()

const SECTOR_NUMERIC_FIELDS = [
  'aqi_annual_avg', 'aqi_winter_peak', 'aqi_monsoon_low',
  'airport_distance_km', 'metro_distance_km', 'expressway_proximity_km',
] as const

// PUT /api/v1/admin/sectors/:id — update sector intelligence
router.put('/sectors/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params

  const parsed = SectorIntelligenceUpdate.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid sector intelligence payload',
      details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    })
  }

  const data: Record<string, unknown> = { ...parsed.data }
  for (const f of SECTOR_NUMERIC_FIELDS) {
    if (data[f] !== undefined) data[f] = numOrNull(data[f], parseFloat)
  }
  // Stamped by the server, never by the client — it is the record of when a
  // human last vouched for these numbers, and a client-set value would make it
  // worthless as an audit signal.
  data.last_verified_at = new Date()

  try {
    const sector = await prisma.sectorIntelligence.update({ where: { id }, data })
    res.json({ sector })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      return res.status(404).json({ error: 'Sector not found' })
    }
    console.error('[admin] sector update failed:', err)
    res.status(500).json({ error: 'Failed to update sector intelligence' })
  }
})

/**
 * GET /api/v1/admin/coverage-gaps — what buyers asked for that we could not serve.
 *
 * Two kinds, deliberately separate because they are different decisions taken
 * by different people:
 *
 *   project  a named development with no row. "Buildings to add."
 *   sector   an area we hold nothing in.      "Areas to expand into."
 *
 * A sector repeating here is the strongest demand signal this product makes —
 * a buyer telling us where they want to live, in a place we cannot sell them
 * anything. Ranked by how often it has been asked, because that is the number
 * that should drive the decision.
 */
router.get('/coverage-gaps', requireAdmin, async (req: Request, res: Response) => {
  const kind = String(req.query.kind ?? 'all')
  const days = Math.min(365, Math.max(1, Number(req.query.days ?? 30)))
  const since = new Date(Date.now() - days * 86_400_000)

  const types =
    kind === 'project' ? ['coverage_gap']
    : kind === 'sector' ? ['sector_gap']
    : ['coverage_gap', 'sector_gap']

  try {
    const rows = await prisma.auditLog.findMany({
      where: { entity_type: { in: types }, created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
      take: 1000,
      select: { entity_type: true, entity_name: true, summary: true, changes: true, created_at: true },
    })

    // Grouped by what was asked for, not by when — the same project asked
    // about forty times is one thing to add, not forty rows to read.
    const byName = new Map<string, {
      name: string; kind: string; asks: number; firstAsked: Date; lastAsked: Date; queries: string[]
    }>()
    for (const r of rows) {
      const name = r.entity_name ?? '(unnamed)'
      const key = `${r.entity_type}::${name.toLowerCase()}`
      const q = (r.changes as { query?: string } | null)?.query
      const hit = byName.get(key)
      if (hit) {
        hit.asks++
        hit.firstAsked = r.created_at < hit.firstAsked ? r.created_at : hit.firstAsked
        if (q && hit.queries.length < 5 && !hit.queries.includes(q)) hit.queries.push(q)
      } else {
        byName.set(key, {
          name,
          kind: r.entity_type === 'sector_gap' ? 'sector' : 'project',
          asks: 1,
          firstAsked: r.created_at,
          lastAsked: r.created_at,
          queries: q ? [q] : [],
        })
      }
    }

    const gaps = [...byName.values()].sort((a, b) => b.asks - a.asks || +b.lastAsked - +a.lastAsked)
    res.json({
      windowDays: days,
      totalAsks: rows.length,
      distinct: gaps.length,
      projects: gaps.filter((g) => g.kind === 'project'),
      sectors: gaps.filter((g) => g.kind === 'sector'),
    })
  } catch (err) {
    console.error('[admin] coverage-gaps query failed:', err)
    res.status(500).json({ error: 'Failed to fetch coverage gaps' })
  }
})

// DELETE /api/v1/admin/builders/:id — delete builder
router.delete('/builders/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    // Check if builder has linked projects before deleting
    const projectCount = await prisma.project.count({
      where: { builder_id: id },
    })

    if (projectCount > 0) {
      res.status(409).json({ error: `Cannot delete: ${projectCount} project(s) linked to this builder` })
      return
    }

    await prisma.builder.delete({ where: { id } })
    res.json({ success: true, message: 'Builder deleted successfully' })
  } catch (err) {
    console.error('[admin] builder delete failed:', err)
    res.status(500).json({ error: 'Failed to delete builder' })
  }
})

// GET /api/v1/admin/leads — list callback/lead requests
router.get('/leads', requireAdmin, async (req: Request, res: Response) => {
  const { status, limit = '50', offset = '0' } = req.query
  try {
    const where: any = {}
    if (status && status !== 'all') {
      where.status = status as string
    }

    const [leads, total] = await Promise.all([
      prisma.callbackRequest.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.callbackRequest.count({ where }),
    ])

    res.json({ leads, total })
  } catch (err) {
    // Do not swallow: an empty list here is indistinguishable from a broken query,
    // which is exactly how the missing lead columns stayed hidden.
    console.error('[admin] leads query failed:', err)
    res.status(500).json({ error: 'Failed to fetch leads' })
  }
})

// PATCH /api/v1/admin/leads/:id — update lead
router.patch('/leads/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const { status, lead_tier } = req.body

  try {
    const lead = await prisma.callbackRequest.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(lead_tier && { lead_tier }),
      },
    })

    res.json(lead)
  } catch (err) {
    console.error('[admin] lead update failed:', err)
    res.status(500).json({ error: 'Failed to update lead' })
  }
})

// GET /api/v1/admin/news — list builder news
router.get('/news', requireAdmin, async (req: Request, res: Response) => {
  const { limit = '50', offset = '0', status } = req.query

  try {
    const where: any = { archived_at: null }
    if (status && status !== 'all') {
      where.status = status as string
    }

    const [news, total] = await Promise.all([
      prisma.builderNews.findMany({
        where,
        include: { builder: { select: { id: true, name: true, slug: true } } },
        orderBy: { created_at: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.builderNews.count({ where }),
    ])

    res.json({ news, total, limit: parseInt(limit as string), offset: parseInt(offset as string) })
  } catch (err) {
    console.error('[admin] news query failed:', err)
    res.status(500).json({ error: 'Failed to fetch news' })
  }
})

// DELETE /api/v1/admin/news/:id — archive (soft delete; reversible)
router.delete('/news/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await prisma.builderNews.update({
      where: { id },
      data: { archived_at: new Date() },
    })
    res.json({ success: true, message: 'News archived' })
  } catch (err) {
    console.error('[admin] news archive failed:', err)
    res.status(500).json({ error: 'Failed to archive news' })
  }
})

// POST /api/v1/admin/news — create news
router.post('/news', requireAdmin, async (req: Request, res: Response) => {
  const { builder_id, title, description, image_url, link_type, link_target, status } = req.body
  try {
    if (!builder_id || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields: builder_id, title, description' })
    }
    const news = await prisma.builderNews.create({
      data: {
        builder_id,
        title,
        description,
        image_url,
        link_type,
        link_target,
        status: status || 'draft',
      },
      include: { builder: { select: { id: true, name: true, slug: true } } },
    })
    res.status(201).json(news)
  } catch (err) {
    console.error('[admin] news create failed:', err)
    res.status(500).json({ error: 'Failed to create news' })
  }
})

// PATCH /api/v1/admin/news/:id — update news
router.patch('/news/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const { title, description, image_url, link_type, link_target, status, approved_by, approval_notes, published_at, run_as_promo, promo_id } = req.body
  try {
    const data: any = {}
    if (title !== undefined) data.title = title
    if (description !== undefined) data.description = description
    if (image_url !== undefined) data.image_url = image_url
    if (link_type !== undefined) data.link_type = link_type
    if (link_target !== undefined) data.link_target = link_target
    if (status !== undefined) data.status = status
    if (approved_by !== undefined) data.approved_by = approved_by
    if (approval_notes !== undefined) data.approval_notes = approval_notes
    if (published_at !== undefined) data.published_at = published_at ? new Date(published_at) : null
    if (run_as_promo !== undefined) data.run_as_promo = run_as_promo
    if (promo_id !== undefined) data.promo_id = promo_id

    const news = await prisma.builderNews.update({
      where: { id },
      data,
      include: { builder: { select: { id: true, name: true, slug: true } } },
    })
    res.json(news)
  } catch (err) {
    console.error('[admin] news update failed:', err)
    res.status(500).json({ error: 'Failed to update news' })
  }
})

// GET /api/v1/admin/analytics/summary — system analytics
router.get('/analytics/summary', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalChats, totalQueries, zeroResultSearches, totalCallbacks, totalProjects, totalBuilders] = await Promise.all([
      prisma.chatSession.count(),
      prisma.queryMetrics.count(),
      prisma.queryMetrics.count({ where: { had_results: false } }),
      prisma.callbackRequest.count(),
      prisma.project.count(),
      prisma.builder.count(),
    ])

    const avgQueriesPerChat = totalChats > 0 ? (totalQueries / totalChats).toFixed(1) : '0.0'
    const zeroResultSearchRate = totalQueries > 0 ? `${((zeroResultSearches / totalQueries) * 100).toFixed(1)}%` : '0.0%'
    const effectiveConversions = Math.min(totalCallbacks, totalChats)
    const conversionRate = totalChats > 0 ? `${((effectiveConversions / totalChats) * 100).toFixed(1)}%` : totalCallbacks > 0 ? '100.0%' : '0.0%'

    const avgClarificationsAgg = await prisma.queryMetrics.aggregate({
      _avg: { clarification_count: true },
    })
    const avgClarifications = (avgClarificationsAgg._avg.clarification_count || 0).toFixed(1)

    // Top Searched Sectors: Query Metrics first, fallback to Project table sectors
    const sectorGroups = await prisma.queryMetrics.groupBy({
      by: ['sector'],
      _count: { sector: true },
      where: { sector: { not: null } },
      orderBy: { _count: { sector: 'desc' } },
      take: 10,
    })

    let topSectors = sectorGroups.map(g => ({ sector: g.sector || 'Unknown', count: g._count.sector }))

    if (topSectors.length === 0) {
      const projSectors = await prisma.project.findMany({
        select: { sector: true },
      })
      const counts: Record<string, number> = {}
      for (const p of projSectors) {
        if (p.sector) {
          counts[p.sector] = (counts[p.sector] || 0) + 1
        }
      }
      topSectors = Object.entries(counts)
        .map(([sector, count]) => ({ sector, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
    }

    // Top Searched Builders: Query Metrics first, fallback to Builder table
    const builderGroups = await prisma.queryMetrics.groupBy({
      by: ['builder'],
      _count: { builder: true },
      where: { builder: { not: null } },
      orderBy: { _count: { builder: 'desc' } },
      take: 10,
    })

    let topBuilders = builderGroups.map(g => ({ builder: g.builder || 'Unknown', count: g._count.builder }))

    if (topBuilders.length === 0) {
      const builders = await prisma.builder.findMany({
        take: 10,
        select: { name: true, projects: { select: { id: true } } },
        orderBy: { name: 'asc' },
      })
      topBuilders = builders
        .map(b => ({ builder: b.name, count: b.projects.length }))
        .filter(b => b.count > 0)
        .sort((a, b) => b.count - a.count)
    }

    res.json({
      totalChats,
      totalQueries,
      avgQueriesPerChat,
      zeroResultSearches,
      zeroResultSearchRate,
      conversionRate,
      avgClarifications,
      topSectors,
      topBuilders,
      summary: {
        totalProjects,
        totalBuilders,
        totalCallbacks,
        totalUsers: totalChats,
      }
    })
  } catch (err) {
    console.error('[admin] analytics summary failed:', err)
    res.status(500).json({ error: 'Failed to fetch analytics summary' })
  }
})

// GET /api/v1/admin/analytics/quality — data health score
router.get('/analytics/quality', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalSearches, zeroResultSearches, searchWithResults, totalProjects, withImage, withRera] = await Promise.all([
      prisma.queryMetrics.count(),
      prisma.queryMetrics.count({ where: { had_results: false } }),
      prisma.queryMetrics.count({ where: { had_results: true } }),
      prisma.project.count(),
      prisma.project.count({ where: { hero_image_url: { not: null } } }),
      prisma.project.count({ where: { rera_number: { not: null } } }),
    ])

    const searchWithoutResults = zeroResultSearches
    const zeroResultRate = totalSearches > 0 ? `${((zeroResultSearches / totalSearches) * 100).toFixed(1)}%` : '0.0%'
    const completenessScore = totalProjects > 0 ? Math.round(((withImage + withRera) / (totalProjects * 2)) * 100) : 100

    const aggregates = await prisma.queryMetrics.aggregate({
      _avg: { clarification_count: true, results_count: true },
    })
    const avgClarifications = aggregates._avg.clarification_count ? Math.round(aggregates._avg.clarification_count * 10) / 10 : 0
    const avgResultsCount = aggregates._avg.results_count ? Math.round(aggregates._avg.results_count * 10) / 10 : 0

    res.json({
      totalSearches,
      zeroResultSearches,
      zeroResultRate,
      searchWithResults,
      searchWithoutResults,
      avgClarifications,
      avgResultsCount,
      quality: {
        totalProjects,
        withImage,
        withRera,
        completenessScore,
      }
    })
  } catch (err) {
    console.error('[admin] analytics quality failed:', err)
    res.status(500).json({ error: 'Failed to fetch analytics quality' })
  }
})

// GET /api/v1/admin/analytics/users — user stats
router.get('/analytics/users', requireAdmin, async (_req: Request, res: Response) => {
  try {
    let totalChats = 0
    let totalQueries = 0
    let totalClicks = 0
    let totalSaves = 0
    let totalConversions = 0

    try {
      totalChats = await prisma.chatSession.count()
      totalQueries = await prisma.queryMetrics.count()
      totalClicks = await prisma.propertyEvent.count({ where: { action: { in: ['click', 'view'] } } })
      totalSaves = await prisma.propertyEvent.count({ where: { action: 'save' } })
      totalConversions = await prisma.callbackRequest.count()
    } catch (countErr) {
      console.warn('[admin] analytics/users count warning (pool pressure, using defaults):', countErr)
    }

    const uniqueUsersAgg = await prisma.chatSession.groupBy({
      by: ['user_id'],
      where: { user_id: { not: null } },
    })
    const totalUsers = Math.max(uniqueUsersAgg.length, totalChats > 0 ? 1 : 0)
    const repeatedVisitors = Math.max(0, totalChats - totalUsers)
    const avgQueriesPerUser = totalUsers > 0 ? parseFloat((totalQueries / totalUsers).toFixed(1)) : 0
    // Compute real dynamic avg session duration from DB (created_at vs last_active)
    const sessionsForDuration = await prisma.chatSession.findMany({
      take: 100,
      select: { created_at: true, last_active: true },
    })
    let totalDurationSeconds = 0
    let validDurationCount = 0
    for (const s of sessionsForDuration) {
      const dur = (new Date(s.last_active).getTime() - new Date(s.created_at).getTime()) / 1000
      if (dur > 0) {
        totalDurationSeconds += dur
        validDurationCount++
      }
    }
    const avgSessionDuration = validDurationCount > 0 ? Math.round(totalDurationSeconds / validDurationCount) : 0

    // Dynamic list of active user chat sessions from DB
    const recentSessions = await prisma.chatSession.findMany({
      take: 25,
      orderBy: { last_active: 'desc' },
      select: {
        id: true,
        user_id: true,
        guest_token: true,
        title: true,
        message_count: true,
        created_at: true,
        last_active: true,
        chat_phase: true,
        _count: { select: { query_metrics: true } },
      },
    })

    const activeUserList = recentSessions.map((s) => ({
      id: s.id,
      userLabel: s.user_id ? `User #${s.user_id.slice(0, 6)}` : s.guest_token ? `Guest #${s.guest_token.slice(0, 6)}` : 'Anonymous',
      title: s.title || 'Discovery Session',
      messageCount: s.message_count,
      queriesCount: s._count.query_metrics,
      phase: s.chat_phase,
      lastActive: s.last_active,
    }))

    // Most Searched Sectors: Query metrics first, fallback to Project sectors
    const sectorGroups = await prisma.queryMetrics.groupBy({
      by: ['sector'],
      _count: { sector: true },
      where: { sector: { not: null } },
      orderBy: { _count: { sector: 'desc' } },
      take: 5,
    })

    let mostActiveSectors = sectorGroups.map(g => ({ sector: g.sector || 'Unknown', searches: g._count.sector }))

    if (mostActiveSectors.length === 0) {
      const projSectors = await prisma.project.findMany({
        select: { sector: true },
      })
      const counts: Record<string, number> = {}
      for (const p of projSectors) {
        if (p.sector) {
          counts[p.sector] = (counts[p.sector] || 0) + 1
        }
      }
      mostActiveSectors = Object.entries(counts)
        .map(([sector, searches]) => ({ sector, searches }))
        .sort((a, b) => b.searches - a.searches)
        .slice(0, 5)
    }

    res.json({
      totalUsers,
      repeatedVisitors,
      totalConversions,
      avgSessionDuration,
      avgQueriesPerUser,
      conversionFunnel: {
        chats: totalChats,
        searches: totalQueries,
        clicks: totalClicks,
        saves: totalSaves,
        conversions: totalChats > 0 ? Math.min(totalConversions, totalChats) : totalConversions,
      },
      mostActiveSectors,
      users: activeUserList,
    })
  } catch (err) {
    console.error('[admin] analytics users failed:', err)
    res.status(500).json({ error: 'Failed to fetch users analytics' })
  }
})

// GET /api/v1/admin/analytics/properties — properties analytics
router.get('/analytics/properties', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({
      take: 50,
      select: { id: true, name: true, slug: true, status: true, sector: true, price_range_label: true },
      orderBy: { name: 'asc' },
    })

    const events = await (prisma.propertyEvent as any).groupBy({
      by: ['project_id', 'action'],
      _count: { action: true },
      orderBy: { _count: { action: 'desc' } },
      take: 1000,
    })

    const eventMap: Record<string, Record<string, number>> = {}
    for (const ev of events) {
      if (!eventMap[ev.project_id]) eventMap[ev.project_id] = {}
      eventMap[ev.project_id][ev.action] = ev._count.action
    }

    const propertyEngagements = projects
      .map((p) => {
        const pEvents = eventMap[p.id] || {}
        const views = pEvents['view'] || 0
        const saves = pEvents['save'] || 0
        const comparisons = pEvents['compare'] || 0
        const shares = pEvents['share'] || 0
        const whatsappInquiries = pEvents['whatsapp'] || 0
        const total = views + saves + comparisons + shares + whatsappInquiries
        return {
          projectId: p.id,
          projectName: p.name,
          views,
          saves,
          comparisons,
          shares,
          whatsappInquiries,
          total,
          slug: p.slug,
          sector: p.sector,
        }
      })
      .sort((a, b) => b.total - a.total)

    res.json({ properties: propertyEngagements, total: projects.length })
  } catch (err) {
    console.error('[admin] analytics properties failed:', err)
    res.status(500).json({ error: 'Failed to fetch properties analytics' })
  }
})

// USD→INR is not fetched live; this is a fixed approximation for display only.
const USD_TO_INR_APPROX = 87

// GET /api/v1/admin/analytics/ai-costs — enterprise AI token & unit economics
router.get('/analytics/ai-costs', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { getCacheStats } = await import('../lib/ai/semanticCache')
    const cacheStats = getCacheStats()

    /**
     * Was `findMany({ take: 500 })` labeled `totalCostUsd` — with 12,000+
     * rows on file, that read roughly the most recent 4% of events and called
     * it the total. Measured live: showed ~₹33 against a real provider bill
     * the user tracks at roughly ₹2,500. Aggregated over ALL rows instead —
     * a DB-side sum, not 12k rows pulled into memory every request.
     *
     * This can still undercount true lifetime spend: `aiUsageEvent` only
     * exists from whenever metering was wired up (CLAUDE.md notes ten call
     * sites once called the Gemini SDK directly and recorded nothing). A row
     * here is real; the absence of a row before metering existed is not
     * evidence no money was spent.
     */
    const [totals, byProvider, totalLeads] = await Promise.all([
      prisma.aiUsageEvent.aggregate({
        _sum: { cost_usd: true, prompt_tokens: true, completion_tokens: true },
        _count: true,
      }),
      prisma.aiUsageEvent.groupBy({
        by: ['provider'],
        _sum: { cost_usd: true, prompt_tokens: true, completion_tokens: true },
        _count: true,
      }),
      prisma.callbackRequest.count().catch(() => 0),
    ])

    const totalCostUsd = Number(totals._sum.cost_usd || 0)
    const totalPromptTokens = totals._sum.prompt_tokens || 0
    const totalCompletionTokens = totals._sum.completion_tokens || 0
    const totalQueries = totals._count

    const costPerLeadUsd = totalLeads > 0 && totalCostUsd > 0 ? (totalCostUsd / totalLeads).toFixed(3) : '0.00'
    const costPerLeadInr = (Number(costPerLeadUsd) * USD_TO_INR_APPROX).toFixed(2)

    res.json({
      totalInputTokens: totalPromptTokens,
      totalOutputTokens: totalCompletionTokens,
      totalCostUsd: Number(totalCostUsd.toFixed(4)),
      totalCostInr: Math.round(totalCostUsd * USD_TO_INR_APPROX),
      totalQueriesTracked: totalQueries,
      avgCostPerQueryUsd: totalQueries > 0 ? Number((totalCostUsd / totalQueries).toFixed(5)) : 0,
      costPerLeadUsd: Number(costPerLeadUsd),
      costPerLeadInr: Number(costPerLeadInr),
      costByProvider: byProvider.map((p) => ({
        provider: p.provider || 'unknown',
        costUsd: Number((p._sum.cost_usd || 0).toFixed(4)),
        costInr: Math.round(Number(p._sum.cost_usd || 0) * USD_TO_INR_APPROX),
        queries: p._count,
        totalTokens: (p._sum.prompt_tokens || 0) + (p._sum.completion_tokens || 0),
      })),
      cache: cacheStats,
      // `groundTruthDbHitRate` used to sit here as a hardcoded '78.5%' string
      // with nothing computing it — a fabricated metric, removed rather than
      // guessed at a replacement.
    })
  } catch (err) {
    console.error('[admin] analytics ai-costs failed:', err)
    res.status(500).json({ error: 'Failed to fetch AI cost metrics' })
  }
})

// GET /api/v1/admin/analytics/market-demand — Supply vs Demand Matrix
router.get('/analytics/market-demand', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [searches, projects] = await Promise.all([
      prisma.queryMetrics.findMany({
        where: { sector: { not: null } },
        select: { sector: true, bhk: true, budget_min_cr: true, budget_max_cr: true, had_results: true },
        take: 1000,
      }),
      prisma.project.findMany({
        select: { sector: true, price_min_cr: true, name: true, unit_types: { select: { bhk: true, price_min_cr: true, price_max_cr: true } } },
      }),
    ])

    const supplyBySector: Record<string, { projectCount: number; unitsCount: number; projects: string[] }> = {}
    for (const p of projects) {
      const sec = p.sector.replace(/^Sector\s*/i, 'Sec ')
      if (!supplyBySector[sec]) supplyBySector[sec] = { projectCount: 0, unitsCount: 0, projects: [] }
      supplyBySector[sec].projectCount += 1
      supplyBySector[sec].unitsCount += p.unit_types.length || 1
      if (supplyBySector[sec].projects.length < 3) supplyBySector[sec].projects.push(p.name)
    }

    const demandBySector: Record<string, { totalSearches: number; zeroResults: number; bhk2: number; bhk3: number; bhk4: number }> = {}
    for (const s of searches) {
      if (!s.sector) continue
      const sec = s.sector.replace(/^Sector\s*/i, 'Sec ')
      if (!demandBySector[sec]) demandBySector[sec] = { totalSearches: 0, zeroResults: 0, bhk2: 0, bhk3: 0, bhk4: 0 }
      demandBySector[sec].totalSearches += 1
      if (s.had_results === false) demandBySector[sec].zeroResults += 1
      if (s.bhk === 2) demandBySector[sec].bhk2 += 1
      if (s.bhk === 3) demandBySector[sec].bhk3 += 1
      if (s.bhk === 4) demandBySector[sec].bhk4 += 1
    }

    const allSectors = Array.from(new Set([...Object.keys(supplyBySector), ...Object.keys(demandBySector)]))
    const totalSearches = searches.length || 1

    const matrix = allSectors.map((sector) => {
      const sup = supplyBySector[sector] || { projectCount: 0, unitsCount: 0, projects: [] }
      const dem = demandBySector[sector] || { totalSearches: 0, zeroResults: 0, bhk2: 0, bhk3: 0, bhk4: 0 }
      const demandPct = Math.round((dem.totalSearches / totalSearches) * 100)
      
      let gapLevel: 'covered' | 'thin' | 'critical_gap' = 'covered'
      if (sup.projectCount === 0 && dem.totalSearches > 0) {
        gapLevel = 'critical_gap'
      } else if (sup.projectCount <= 1 && dem.totalSearches >= 2) {
        gapLevel = 'thin'
      }

      return {
        sector,
        supplyProjects: sup.projectCount,
        supplyUnitConfigs: sup.unitsCount,
        sampleProjects: sup.projects.join(', ') || 'No projects listed',
        searchDemandCount: dem.totalSearches,
        searchDemandPct: demandPct,
        unmetSearches: dem.zeroResults,
        topConfigurations: dem.bhk3 >= dem.bhk2 ? '3 BHK' : '2 BHK',
        gapLevel,
      }
    }).sort((a, b) => b.searchDemandCount - a.searchDemandCount)

    res.json({ matrix, totalDemandQueries: searches.length, totalCatalogProjects: projects.length })
  } catch (err) {
    console.error('[admin] analytics market-demand failed:', err)
    res.status(500).json({ error: 'Failed to fetch market demand matrix' })
  }
})

// GET /api/v1/admin/analytics/unmet-demand — Zero result demand ledger
router.get('/analytics/unmet-demand', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const unmetQueries = await prisma.queryMetrics.findMany({
      where: {
        OR: [
          { had_results: false },
          { results_count: 0 },
        ],
        query_text: { not: '' },
      },
      orderBy: { created_at: 'desc' },
      take: 200,
      select: {
        query_text: true,
        sector: true,
        bhk: true,
        budget_min_cr: true,
        budget_max_cr: true,
        created_at: true,
      }
    })

    const queryCounts: Record<string, { query: string; sector: string; bhk: number | null; budget: string; count: number; lastSearched: Date }> = {}
    for (const q of unmetQueries) {
      const key = q.query_text.toLowerCase().trim() || `${q.sector || 'Noida'}_${q.bhk || 0}`
      if (!queryCounts[key]) {
        let budgetStr = 'Any Budget'
        if (q.budget_min_cr && q.budget_max_cr) budgetStr = `₹${q.budget_min_cr}–${q.budget_max_cr} Cr`
        else if (q.budget_max_cr) budgetStr = `< ₹${q.budget_max_cr} Cr`
        else if (q.budget_min_cr) budgetStr = `> ₹${q.budget_min_cr} Cr`

        queryCounts[key] = {
          query: q.query_text || `${q.bhk ? q.bhk + ' BHK in ' : ''}${q.sector || 'Noida'}`,
          sector: q.sector || 'Noida',
          bhk: q.bhk,
          budget: budgetStr,
          count: 0,
          lastSearched: q.created_at,
        }
      }
      queryCounts[key].count += 1
      if (q.created_at > queryCounts[key].lastSearched) {
        queryCounts[key].lastSearched = q.created_at
      }
    }

    const ledger = Object.values(queryCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    res.json({ ledger, totalUnmetLogged: unmetQueries.length })
  } catch (err) {
    console.error('[admin] analytics unmet-demand failed:', err)
    res.status(500).json({ error: 'Failed to fetch unmet demand ledger' })
  }
})

// GET /api/v1/admin/analytics/funnel — 5-stage conversion funnel
router.get('/analytics/funnel', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [totalSessions, totalSearches, viewClicks, saves, totalCallbacks, totalSiteVisits] = await Promise.all([
      prisma.chatSession.count().catch(() => 0),
      prisma.queryMetrics.count().catch(() => 0),
      prisma.propertyEvent.count({ where: { action: { in: ['view', 'click', 'brochure'] } } }).catch(() => 0),
      prisma.propertyEvent.count({ where: { action: 'save' } }).catch(() => 0),
      prisma.callbackRequest.count().catch(() => 0),
      prisma.siteVisitRequest.count().catch(() => 0),
    ])

    const leads = totalCallbacks + totalSiteVisits
    const stages = [
      { id: 'sessions', label: '1. Chat Discovery Sessions', count: totalSessions, dropOffPct: totalSessions > 0 ? Math.round(Math.max(0, 100 - (totalSearches / totalSessions) * 100)) : 0 },
      { id: 'searches', label: '2. Filtered Searches Executed', count: totalSearches, dropOffPct: totalSearches > 0 ? Math.round(Math.max(0, 100 - (viewClicks / totalSearches) * 100)) : 0 },
      { id: 'engagements', label: '3. Property Card Views & Clicks', count: viewClicks, dropOffPct: viewClicks > 0 ? Math.round(Math.max(0, 100 - (saves / viewClicks) * 100)) : 0 },
      { id: 'shortlists', label: '4. Shortlisted & Saved', count: saves, dropOffPct: saves > 0 ? Math.round(Math.max(0, 100 - (leads / saves) * 100)) : 0 },
      { id: 'leads', label: '5. High-Intent Verified Leads', count: leads, dropOffPct: 0 },
    ]

    const overallConversionRate = totalSessions > 0 ? `${((leads / totalSessions) * 100).toFixed(2)}%` : '0.00%'

    res.json({ stages, overallConversionRate, totalLeads: leads })
  } catch (err) {
    console.error('[admin] analytics funnel failed:', err)
    res.status(500).json({ error: 'Failed to fetch funnel analytics' })
  }
})

// GET /api/v1/admin/sector-tiers — Phase 5: Compute and show sector tiers
router.get('/sector-tiers', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { city = 'Noida' } = req.query
    const { computeSectorTier } = await import('../lib/discovery/sectorTiers')

    const sectorIntelligence: any[] = (await (prisma as any).sectorIntelligence?.findMany({
      where: { city: city as string },
    })) || []

    const tiers = sectorIntelligence.map((si: any) =>
      computeSectorTier({
        city: si.city,
        sector: si.sector,
        sector_stage: si.sector_stage,
        avg_price_per_sqft: si.avg_price_per_sqft,
        price_5yr_cagr_pct: si.price_5yr_cagr_pct,
      })
    )

    // Group by tier
    const grouped: Record<string, any[]> = { tier1: [], tier2: [], tier3: [] }
    for (const tier of tiers) {
      grouped[tier.tier].push(tier)
    }

    res.json({
      city,
      tier1: grouped.tier1,
      tier2: grouped.tier2,
      tier3: grouped.tier3,
      total: tiers.length,
    })
  } catch (err) {
    console.error('[admin] sector-tiers failed:', err)
    res.status(500).json({ error: 'Failed to compute sector tiers' })
  }
})

// GET /api/v1/admin/channel-partners — List all available master channel partners
router.get('/channel-partners', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const partners = await (prisma as any).channelPartner.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    })
    res.json({ partners, channel_partners: partners })
  } catch (err) {
    console.error('[admin] fetch channel-partners failed:', err)
    res.status(500).json({ error: 'Failed to fetch channel partners' })
  }
})

// GET /api/v1/admin/projects/:id/channel-partners — Fetch project's linked partners
router.get('/projects/:id/channel-partners', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const partners = await (prisma as any).projectChannelPartner.findMany({
      where: { project_id: id },
      include: { channel_partner: true },
    })
    res.json({ channel_partners: partners })
  } catch (err) {
    console.error('[admin] fetch project channel-partners failed:', err)
    res.status(500).json({ error: 'Failed to fetch project channel partners' })
  }
})

// PUT /api/v1/admin/projects/:id/channel-partners — Save project's channel partners
router.put('/projects/:id/channel-partners', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { channel_partners } = req.body
    await (prisma as any).projectChannelPartner.deleteMany({ where: { project_id: id } })
    if (Array.isArray(channel_partners) && channel_partners.length > 0) {
      await (prisma as any).projectChannelPartner.createMany({
        data: channel_partners.map((p: any) => ({
          project_id: id,
          channel_partner_id: p.channel_partner_id,
          is_featured: p.is_featured ?? true,
        })),
      })
    }
    const updated = await (prisma as any).projectChannelPartner.findMany({
      where: { project_id: id },
      include: { channel_partner: true },
    })
    res.json({ ok: true, channel_partners: updated })
  } catch (err) {
    console.error('[admin] save project channel-partners failed:', err)
    res.status(500).json({ error: 'Failed to save project channel partners' })
  }
})

// GET /api/v1/admin/projects/:id/updates — Fetch project updates
router.get('/projects/:id/updates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const updates = await (prisma as any).constructionUpdate.findMany({
      where: { project_id: id },
      orderBy: { update_date: 'desc' },
    })
    res.json({ updates })
  } catch (err) {
    console.error('[admin] fetch updates failed:', err)
    res.status(500).json({ error: 'Failed to fetch updates' })
  }
})

// PUT /api/v1/admin/projects/:id/updates — Save project updates
router.put('/projects/:id/updates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { updates } = req.body
    await (prisma as any).constructionUpdate.deleteMany({ where: { project_id: id } })
    if (Array.isArray(updates) && updates.length > 0) {
      await (prisma as any).constructionUpdate.createMany({
        data: updates.map((u: any) => ({
          project_id: id,
          title: u.name || 'Site Update',
          description: u.name,
          quarter_label: u.date_label || null,
          update_date: new Date(),
        })),
      })
    }
    res.json({ success: true })
  } catch (err) {
    console.error('[admin] save updates failed:', err)
    res.status(500).json({ error: 'Failed to save updates' })
  }
})

// PATCH /api/v1/admin/projects/:id/dna — save/update project DNA profile
router.patch('/projects/:id/dna', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const data = req.body

  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const updated = await (prisma as any).projectDna.upsert({
      where: { project_id: project.id },
      update: { ...data, updated_at: new Date() },
      create: { project_id: project.id, ...data }
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[admin] save DNA failed:', err)
    res.status(500).json({ error: 'Failed to save DNA profile' })
  }
})

// PATCH /api/v1/admin/projects/:id/decision-profile — save/update decision profile
router.patch('/projects/:id/decision-profile', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const data = req.body

  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const updated = await (prisma as any).decisionProfile.upsert({
      where: { project_id: project.id },
      update: { ...data, updated_at: new Date() },
      create: { project_id: project.id, ...data }
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[admin] save decision profile failed:', err)
    res.status(500).json({ error: 'Failed to save decision profile' })
  }
})

// PATCH /api/v1/admin/projects/:id/persona-profile — save/update persona profile
router.patch('/projects/:id/persona-profile', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const data = req.body

  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const updated = await (prisma as any).personaProfile.upsert({
      where: { project_id: project.id },
      update: { ...data, updated_at: new Date() },
      create: { project_id: project.id, ...data }
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[admin] save persona profile failed:', err)
    res.status(500).json({ error: 'Failed to save persona profile' })
  }
})

// PATCH /api/v1/admin/projects/:id/recommendation-profile — save/update recommendation profile
router.patch('/projects/:id/recommendation-profile', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const data = req.body

  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) {
      res.status(404).json({ error: 'Project not found' })
      return
    }

    const updated = await (prisma as any).recommendationProfile.upsert({
      where: { project_id: project.id },
      update: { ...data, updated_at: new Date() },
      create: { project_id: project.id, ...data }
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[admin] save recommendation profile failed:', err)
    res.status(500).json({ error: 'Failed to save recommendation profile' })
  }
})

// PUT /api/v1/admin/projects/:id/cost-sheet — Upsert full cost sheet
router.put('/projects/:id/cost-sheet', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const data = req.body
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const bsp = data.base_price_per_sqft || 6500
    const parking = data.parking_cost || 350000
    const club = data.club_membership || 150000
    const ifms = data.ifms || 50
    const gstRate = (data.gst_rate_pct ?? 5) / 100
    const stampRate = (data.stamp_duty_pct ?? 7) / 100
    const regRate = (data.registration_pct ?? 1) / 100
    const avgSqft = 1350
    const baseTotal = (bsp * avgSqft) + parking + club + (ifms * avgSqft)
    const taxes = baseTotal * (gstRate + stampRate + regRate)
    const calculatedAllIncCr = Math.round(((baseTotal + taxes) / 10000000) * 100) / 100
    const calculatedAllIncPsf = Math.round((baseTotal + taxes) / avgSqft)

    const payload = {
      ...data,
      all_inclusive_price_cr: data.all_inclusive_price_cr ?? calculatedAllIncCr,
      all_inclusive_per_sqft: data.all_inclusive_per_sqft ?? calculatedAllIncPsf,
      updated_at: new Date()
    }

    const updated = await (prisma as any).costSheet.upsert({
      where: { project_id: project.id },
      update: payload,
      create: { project_id: project.id, ...payload }
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    console.error('[admin] save cost sheet failed:', err)
    res.status(500).json({ error: 'Failed to save cost sheet' })
  }
})

// GET & PUT /api/v1/admin/projects/:id/payment-plans — Multi payment plan management
router.get('/projects/:id/payment-plans', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const plans = await (prisma as any).paymentPlan.findMany({
      where: { project_id: project.id },
      orderBy: { created_at: 'asc' }
    })
    res.json({ payment_plans: plans })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payment plans' })
  }
})

router.put('/projects/:id/payment-plans', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const { payment_plans } = req.body
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    if (Array.isArray(payment_plans)) {
      for (const p of payment_plans) {
        if (!p.plan_type) continue
        await (prisma as any).paymentPlan.upsert({
          where: { project_id_plan_type: { project_id: project.id, plan_type: p.plan_type } },
          update: { ...p, updated_at: new Date() },
          create: { project_id: project.id, ...p }
        })
      }
    }
    const updated = await (prisma as any).paymentPlan.findMany({ where: { project_id: project.id } })
    res.json({ success: true, payment_plans: updated })
  } catch (err) {
    console.error('[admin] save payment plans failed:', err)
    res.status(500).json({ error: 'Failed to save payment plans' })
  }
})

// Legacy single-plan PUT route compatibility
router.put('/projects/:id/payment-plan', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const data = req.body
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const planType = data.plan_type || 'construction_linked'
    const updated = await (prisma as any).paymentPlan.upsert({
      where: { project_id_plan_type: { project_id: project.id, plan_type: planType } },
      update: { ...data, updated_at: new Date() },
      create: { project_id: project.id, plan_type: planType, ...data }
    })
    res.json({ success: true, payment_plan: updated })
  } catch (err) {
    console.error('[admin] save payment plan failed:', err)
    res.status(500).json({ error: 'Failed to save payment plan' })
  }
})

// GET & PUT /api/v1/admin/projects/:id/lifecycle-updates — Delivered project updates
router.get('/projects/:id/lifecycle-updates', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const updates = await (prisma as any).projectLifecycleUpdate.findMany({
      where: { project_id: project.id },
      orderBy: { update_date: 'desc' }
    })
    res.json({ updates })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lifecycle updates' })
  }
})

router.put('/projects/:id/lifecycle-updates', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const { updates } = req.body
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    await (prisma as any).projectLifecycleUpdate.deleteMany({ where: { project_id: project.id } })
    if (Array.isArray(updates) && updates.length > 0) {
      await (prisma as any).projectLifecycleUpdate.createMany({
        data: updates.map((u: any) => ({
          project_id: project.id,
          update_type: u.update_type || 'possession_status_change',
          title: u.title || 'Society Update',
          description: u.description || '',
          update_date: u.update_date ? new Date(u.update_date) : new Date(),
          impact: u.impact || null,
          source: u.source || 'Admin Verification',
          verified_by: u.verified_by || 'PropFyndr Data Desk',
          maintenance_fee_monthly_psf: u.maintenance_fee_monthly_psf ? parseFloat(u.maintenance_fee_monthly_psf) : null,
          note: u.note || null
        }))
      })
    }
    const fresh = await (prisma as any).projectLifecycleUpdate.findMany({ where: { project_id: project.id } })
    res.json({ success: true, updates: fresh })
  } catch (err) {
    console.error('[admin] save lifecycle updates failed:', err)
    res.status(500).json({ error: 'Failed to save lifecycle updates' })
  }
})

// GET & PUT /api/v1/admin/projects/:id/price-history — Price history snapshots
router.get('/projects/:id/price-history', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const history = await (prisma as any).priceHistory.findMany({
      where: { project_id: project.id },
      orderBy: { recorded_at: 'asc' }
    })
    res.json({ price_history: history })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch price history' })
  }
})

router.put('/projects/:id/price-history', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const { price_history } = req.body
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    await (prisma as any).priceHistory.deleteMany({ where: { project_id: project.id } })
    if (Array.isArray(price_history) && price_history.length > 0) {
      await (prisma as any).priceHistory.createMany({
        data: price_history.map((ph: any) => ({
          project_id: project.id,
          quarter_label: ph.quarter_label || 'Q1 2025',
          price_per_sqft: ph.price_per_sqft ? parseFloat(ph.price_per_sqft) : null,
          total_price_cr: ph.total_price_cr ? parseFloat(ph.total_price_cr) : null,
          event_note: ph.event_note || null,
          source: 'admin_update'
        }))
      })
    }
    const fresh = await (prisma as any).priceHistory.findMany({ where: { project_id: project.id } })
    res.json({ success: true, price_history: fresh })
  } catch (err) {
    console.error('[admin] save price history failed:', err)
    res.status(500).json({ error: 'Failed to save price history' })
  }
})

// POST /api/v1/admin/projects/:id/units — Add unit type
router.post('/projects/:id/units', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const data = req.body
  try {
    const project = await prisma.project.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true }
    })
    if (!project) return res.status(404).json({ error: 'Project not found' })

    const superArea = data.super_area_sqft ? parseInt(data.super_area_sqft) : null
    const carpetArea = data.carpet_area_sqft ? parseInt(data.carpet_area_sqft) : null
    let ratio = data.carpet_to_super_ratio_pct ? parseFloat(data.carpet_to_super_ratio_pct) : null
    if (!ratio && superArea && carpetArea && superArea > 0) {
      ratio = Math.round((carpetArea / superArea) * 1000) / 10
    }

    const unit = await (prisma as any).unitType.create({
      data: {
        project_id: project.id,
        name: data.name || `${data.bhk || 2} BHK Unit`,
        bhk: data.bhk ? parseInt(data.bhk) : 2,
        super_area_sqft: superArea,
        carpet_area_sqft: carpetArea,
        carpet_to_super_ratio_pct: ratio,
        built_up_area_sqft: data.built_up_area_sqft ? parseInt(data.built_up_area_sqft) : (carpetArea ? Math.round(carpetArea * 1.15) : null),
        layout_efficiency_pct: data.layout_efficiency_pct ? parseFloat(data.layout_efficiency_pct) : ratio,
        unit_orientations: Array.isArray(data.unit_orientations) ? data.unit_orientations : ['east_facing', 'north_facing'],
        balconies: data.balconies ? parseInt(data.balconies) : null,
        balcony_area_sqft: data.balcony_area_sqft ? parseInt(data.balcony_area_sqft) : null,
        bathrooms: data.bathrooms ? parseInt(data.bathrooms) : null,
        price_min_cr: data.price_min_cr ? parseFloat(data.price_min_cr) : null,
        price_max_cr: data.price_max_cr ? parseFloat(data.price_max_cr) : null,
        price_label: data.price_label || null,
        price_is_estimated: data.price_is_estimated ?? true,
        views: data.views || []
      }
    })
    res.json({ success: true, unit })
  } catch (err) {
    console.error('[admin] add unit failed:', err)
    res.status(500).json({ error: 'Failed to add unit type' })
  }
})

// PATCH /api/v1/admin/units/:id — Update unit type
router.patch('/units/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  const data = req.body
  try {
    const superArea = data.super_area_sqft !== undefined ? (data.super_area_sqft ? parseInt(data.super_area_sqft) : null) : undefined
    const carpetArea = data.carpet_area_sqft !== undefined ? (data.carpet_area_sqft ? parseInt(data.carpet_area_sqft) : null) : undefined
    
    let ratio = data.carpet_to_super_ratio_pct !== undefined ? (data.carpet_to_super_ratio_pct ? parseFloat(data.carpet_to_super_ratio_pct) : null) : undefined
    if (ratio === undefined && superArea !== undefined && carpetArea !== undefined && superArea && carpetArea) {
      ratio = Math.round((carpetArea / superArea) * 1000) / 10
    }

    const unit = await (prisma as any).unitType.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.bhk !== undefined && { bhk: parseInt(data.bhk) }),
        ...(superArea !== undefined && { super_area_sqft: superArea }),
        ...(carpetArea !== undefined && { carpet_area_sqft: carpetArea }),
        ...(ratio !== undefined && { carpet_to_super_ratio_pct: ratio }),
        ...(data.built_up_area_sqft !== undefined && { built_up_area_sqft: data.built_up_area_sqft ? parseInt(data.built_up_area_sqft) : null }),
        ...(data.layout_efficiency_pct !== undefined && { layout_efficiency_pct: data.layout_efficiency_pct ? parseFloat(data.layout_efficiency_pct) : null }),
        ...(data.unit_orientations !== undefined && { unit_orientations: Array.isArray(data.unit_orientations) ? data.unit_orientations : [] }),
        ...(data.balconies !== undefined && { balconies: data.balconies ? parseInt(data.balconies) : null }),
        ...(data.balcony_area_sqft !== undefined && { balcony_area_sqft: data.balcony_area_sqft ? parseInt(data.balcony_area_sqft) : null }),
        ...(data.bathrooms !== undefined && { bathrooms: data.bathrooms ? parseInt(data.bathrooms) : null }),
        ...(data.price_min_cr !== undefined && { price_min_cr: data.price_min_cr ? parseFloat(data.price_min_cr) : null }),
        ...(data.price_max_cr !== undefined && { price_max_cr: data.price_max_cr ? parseFloat(data.price_max_cr) : null }),
        ...(data.price_label !== undefined && { price_label: data.price_label }),
        ...(data.layout_variant_name !== undefined && { layout_variant_name: data.layout_variant_name }),
        ...(data.towers !== undefined && { towers: data.towers, tower_association: data.towers }),
        ...(data.views !== undefined && { views: data.views })
      }
    })
    res.json({ success: true, unit })
  } catch (err) {
    console.error('[admin] update unit failed:', err)
    res.status(500).json({ error: 'Failed to update unit type' })
  }
})

// DELETE /api/v1/admin/units/:id — Delete unit type
router.delete('/units/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await (prisma as any).unitType.delete({ where: { id } })
    res.json({ success: true })
  } catch (err) {
    console.error('[admin] delete unit failed:', err)
    res.status(500).json({ error: 'Failed to delete unit type' })
  }
})

export default router

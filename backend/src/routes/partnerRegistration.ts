// backend/src/routes/partnerRegistration.ts
//
// Public channel-partner (broker house / agency) registration.
//
// A channel partner always belongs to a builder — PropFyndr does not run its
// own broker network. The applicant names the builder they work with, the row
// lands as `status: new` and `is_active: false`, and a PropFyndr super admin
// approves it before the partner can sign in. Mirrors builderRegistration.ts
// deliberately: same rate limit shape, same Zod-strict body, same webhook.
import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '../lib/db'
import { checkRateLimit } from '../lib/cache'
import { fireWebhook } from '../lib/webhook'

const router = Router()

const PARTNER_TYPES = ['broker', 'agency', 'agent', 'referral', 'corporate'] as const

const PartnerApplicationSchema = z.object({
  name: z.string().min(2, 'Firm name is required').max(160),
  type: z.enum(PARTNER_TYPES),
  builder_id: z.string().uuid('Select the builder you work with'),
  description: z.string().max(2000).optional(),
  website: z.string().max(300).optional(),
  phone: z.string().regex(/^\+91\d{10}$/, 'Phone number must be +91 followed by 10 digits'),
  email: z.string().email('Invalid email address'),
  primary_contact: z.string().min(2, 'Primary contact name is required').max(120),
  contact_phone: z.string().regex(/^\+91\d{10}$/, 'Phone number must be +91 followed by 10 digits').optional(),
  contact_email: z.string().email().optional(),
  operating_cities: z.array(z.string().min(1).max(60)).max(20).default([]),
  specializations: z.array(z.string().min(1).max(40)).max(20).default([]),
  rera_compliant: z.boolean().default(false),
  credai_member: z.boolean().default(false),
}).strict()

/**
 * `Acme Realty Partners` -> `acme-realty-partners`. Name and slug are both unique.
 *
 * A name with no ASCII letters or digits — punctuation only, or a purely
 * non-Latin script — reduces to an empty string, and the second such firm would
 * collide with the first on a unique constraint it never chose. Those fall back
 * to a random suffix instead.
 */
function slugify(name: string): string {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return slug || `partner-${randomUUID().slice(0, 8)}`
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const ip = req.ip || 'unknown'
    const { allowed } = await checkRateLimit(`partner:register:${ip}`, 30, 3600)
    if (!allowed) {
      res.status(429).json({ error: 'Too many registration attempts. Please try again in an hour.' })
      return
    }
  } catch (err) {
    console.error('[partnerRegistration] Rate limit check failed:', err)
    res.status(500).json({ error: 'Service error' })
    return
  }

  const parsed = PartnerApplicationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.issues })
    return
  }
  const d = parsed.data

  // The builder must exist. A partner with a dangling builder_id would show up
  // in no builder's portal and be invisible to the person meant to manage it.
  const builder = await prisma.builder.findUnique({ where: { id: d.builder_id }, select: { id: true, name: true } })
  if (!builder) {
    res.status(400).json({ error: 'That builder is not on PropFyndr' })
    return
  }

  try {
    const partner = await prisma.channelPartner.create({
      data: {
        name: d.name,
        slug: slugify(d.name),
        type: d.type,
        builder_id: builder.id,
        description: d.description || null,
        website: d.website || null,
        phone: d.phone,
        email: d.email,
        primary_contact: d.primary_contact,
        contact_phone: d.contact_phone || d.phone,
        contact_email: d.contact_email || d.email,
        operating_cities: d.operating_cities,
        specializations: d.specializations,
        rera_compliant: d.rera_compliant,
        credai_member: d.credai_member,
        // Unapproved until a super admin says otherwise. is_active gates portal
        // login; is_verified is the buyer-facing badge and is never set here.
        status: 'new',
        is_active: false,
        is_verified: false,
        submitted_at: new Date(),
      },
      select: { id: true, name: true },
    })

    fireWebhook('partner_application_submitted', {
      partner_id: partner.id,
      partner_name: partner.name,
      builder_name: builder.name,
      email: d.email,
      phone: d.phone,
    }).catch((e) => console.error('[partnerRegistration] webhook failed:', e))

    res.status(201).json({
      success: true,
      partner_id: partner.id,
      message: 'Application submitted. PropFyndr reviews every partner before activation.',
    })
  } catch (err) {
    // P2002 — name or slug already taken.
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      res.status(409).json({ error: 'A partner is already registered under that firm name.' })
      return
    }
    console.error('[partnerRegistration] Creation failed:', err)
    res.status(500).json({ error: 'Failed to submit application' })
  }
})

export default router

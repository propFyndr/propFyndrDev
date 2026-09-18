// backend/src/lib/adminInvite.ts
//
// Minting an admin identity, in one place.
//
// It lived inside `adminTeam.ts` while a super admin inviting someone by hand
// was the only way onto `admin_users`. Approving a builder application is the
// second way, and it was creating a `BuilderAccount` row instead — a separate
// model with its own `email` and `password_hash` that **nothing anywhere
// authenticates against**. So the path from "builder applies" to "builder gets
// a dashboard" terminated in a row that could never log in, silently, for every
// application ever approved.
//
// Rather than teach a second route how to build an invite, both call this.
import type { AdminRole } from '@prisma/client'
import { prisma } from './db'
import { generateInviteToken } from './adminIdentity'
import { enqueueAndSend } from './outboxDispatcher'

/**
 * `FRONTEND_URL` is a comma-separated list (CORS reads it the same way in
 * index.ts) that carries the Vercel preview URL alongside the real domain.
 * Found live: taking the first entry handed back an invite link on
 * *-vercel.app instead of propfyndr.in. Prefer whichever entry is the real
 * domain; fall back to the first entry only if none match.
 */
export function preferredInviteOrigin(frontendUrlEnv: string | undefined): string {
  const origins = (frontendUrlEnv || '').split(',').map((s) => s.trim()).filter(Boolean)
  return origins.find((o) => o.includes('propfyndr.in')) || origins[0] || 'https://propfyndr.in'
}

/**
 * Fifteen minutes.
 *
 * An invite link is a credential: whoever opens it sets that account's
 * password. It used to live for seven days, which meant a forwarded email, a
 * shared inbox or a mailbox breach any time that week handed someone an admin
 * account.
 *
 * Fifteen minutes is short enough that the link is effectively useless the
 * moment it leaves the recipient's hands, and it is viable only because
 * resending is one click on the Team page and on each organisation's Access
 * panel. The cost is real — an invite sent to someone away from their desk will
 * usually need resending — and that is the trade being made deliberately:
 * friction for the sender, not risk for the platform.
 */
export const INVITE_TTL_MS = 15 * 60 * 1000

/** How each role is described to the person being invited. */
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'a super admin',
  ANALYST: 'an analyst',
  SALES: 'a sales team member',
  BUILDER: 'a builder',
  PARTNER: 'a channel partner',
}

export interface InviteResult {
  inviteUrl: string
  /** Whether the email actually went out. Never gates returning the URL. */
  emailed: boolean
}

export function inviteUrlFor(token: string): string {
  return `${preferredInviteOrigin(process.env.FRONTEND_URL)}/admin/accept-invite?token=${token}`
}

/**
 * Parks an invite in the outbox and attempts to send it.
 *
 * The email deliberately carries no password. The invitee sets their own at the
 * link, which is why this can be resent freely: a link that expires in seven
 * days and sets nothing until used is not a credential we are responsible for
 * storing, and it cannot sit in someone's inbox as a working password for a
 * year. A failure here never fails the caller — they still get the URL.
 */
export async function sendInviteEmail(
  email: string,
  role: string,
  inviteUrl: string,
  adminUserId: string,
): Promise<InviteResult> {
  const { emailed } = await enqueueAndSend({
    toEmail: email,
    template: 'admin_invite',
    subject: 'Your PropFyndr account',
    body:
      `You have been invited to PropFyndr as ${ROLE_LABEL[role] ?? 'a team member'}.\n\n` +
      `Use the link below to choose your own password and sign in. It expires in seven days.\n\n` +
      `If you were not expecting this, ignore it — no account is active until the link is used.`,
    actionUrl: inviteUrl,
    relatedType: 'admin_user',
    relatedId: adminUserId,
  }).catch((err) => {
    console.error('[adminInvite] invite email failed:', err)
    return { id: '', emailed: false }
  })
  return { inviteUrl, emailed }
}

export interface CreateInviteArgs {
  email: string
  role: AdminRole
  builderId?: string | null
  partnerId?: string | null
  invitedByAdminId?: string | null
}

export type CreateInviteOutcome =
  | { ok: true; adminUserId: string; email: string; role: AdminRole; inviteUrl: string; emailed: boolean }
  | { ok: false; reason: 'already_exists'; adminUserId: string; email: string }

/**
 * Creates a pending admin identity and emails the invite.
 *
 * Returns rather than throws on a duplicate email, because the two callers want
 * opposite things from it: the team page shows "that admin already exists" as a
 * 409, while approving a builder application must not fail because someone at
 * that builder was already invited. Both need the id either way.
 */
export async function createAdminInvite(args: CreateInviteArgs): Promise<CreateInviteOutcome> {
  const email = args.email.trim().toLowerCase()

  const existing = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } })
  if (existing) return { ok: false, reason: 'already_exists', adminUserId: existing.id, email }

  const token = generateInviteToken()
  const admin = await prisma.adminUser.create({
    data: {
      email,
      role: args.role,
      builder_id: args.role === 'BUILDER' ? args.builderId ?? null : null,
      partner_id: args.role === 'PARTNER' ? args.partnerId ?? null : null,
      invited_by_admin_id: args.invitedByAdminId ?? null,
      invite_token: token,
      invite_expires_at: new Date(Date.now() + INVITE_TTL_MS),
      is_active: true,
    },
    select: { id: true, email: true, role: true },
  })

  const url = inviteUrlFor(token)
  const { emailed } = await sendInviteEmail(admin.email, admin.role, url, admin.id)

  return { ok: true, adminUserId: admin.id, email: admin.email, role: admin.role, inviteUrl: url, emailed }
}

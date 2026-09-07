// backend/src/lib/adminIdentity.ts
//
// Real admin identity, additive alongside the single-shared-password login in
// `adminAuth.ts`. That login still works — it now maps to a synthetic
// bootstrap SUPER_ADMIN identity (adminUserId: 'root') instead of no identity
// at all, so nothing already deployed breaks and "which admin did what" has
// an answer from the first request onward.
//
// Two ways onto the `admin_users` table, both super-admin-only actions — see
// routes/adminTeam.ts: invite by email, or promote an existing buyer by their
// Supabase user id.
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import type { Request, Response, NextFunction } from 'express'
import { getCached, setCached, deleteCached } from './cache'
import { prisma } from './db'
import type { AdminRole } from '@prisma/client'

const SESSION_TTL_SECS = 7 * 24 * 60 * 60 // 7 days
const SESSION_PREFIX = 'admin:session:'

export interface AdminIdentitySession {
  createdAt: string
  lastSeen: string
  ip: string
  userAgent: string
  /** 'root' for the legacy ADMIN_PASSWORD bootstrap login — no AdminUser row. */
  adminUserId: string
  email: string
  role: AdminRole
  builderId: string | null
  partnerId: string | null
}

interface MemEntry { session: AdminIdentitySession; expiresAt: number }
const memSessions = new Map<string, MemEntry>()

function memGet(token: string): AdminIdentitySession | null {
  const entry = memSessions.get(token)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { memSessions.delete(token); return null }
  return entry.session
}
function memSet(token: string, session: AdminIdentitySession): void {
  memSessions.set(token, { session, expiresAt: Date.now() + SESSION_TTL_SECS * 1000 })
}
function memDelete(token: string): void {
  memSessions.delete(token)
}

export async function createIdentitySession(session: Omit<AdminIdentitySession, 'createdAt' | 'lastSeen'>): Promise<string> {
  const token = randomUUID()
  const now = new Date().toISOString()
  const full: AdminIdentitySession = { ...session, createdAt: now, lastSeen: now }
  const written = await setCached<AdminIdentitySession>(`${SESSION_PREFIX}${token}`, full, SESSION_TTL_SECS)
  if (!written) {
    console.warn('[adminIdentity] Redis unavailable — using in-memory session store (single-process only)')
    memSet(token, full)
  }
  return token
}

export async function validateIdentitySession(token: string | undefined): Promise<AdminIdentitySession | null> {
  if (!token) return null
  const fromRedis = await getCached<AdminIdentitySession>(`${SESSION_PREFIX}${token}`)
  if (fromRedis) return fromRedis
  return memGet(token)
}

export async function destroyIdentitySession(token: string): Promise<void> {
  await deleteCached(`${SESSION_PREFIX}${token}`)
  memDelete(token)
}

function sessionToken(req: Request): string | undefined {
  const cookieToken = (req.cookies as Record<string, string>)?.admin_session
  if (cookieToken) return cookieToken
  const authHeader = req.headers.authorization as string | undefined
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
}

/**
 * Same session store `adminAuth.ts`'s `requireAdmin` reads — both middlewares
 * validate the identical token, so a request behind either sees a session
 * that satisfies both. This one additionally attaches identity to the
 * request for handlers that need to know who is calling, or check role/scope.
 */
export async function requireIdentity(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = sessionToken(req)
  const session = await validateIdentitySession(token)
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  (req as Request & { adminIdentity?: AdminIdentitySession }).adminIdentity = session
  next()
}

/** Composable with requireIdentity — call after it in the middleware chain. */
export function requireRole(...roles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const session = (req as Request & { adminIdentity?: AdminIdentitySession }).adminIdentity
    if (!session || !roles.includes(session.role)) {
      res.status(403).json({ error: 'Forbidden — insufficient role' })
      return
    }
    next()
  }
}

/**
 * Scopes a BUILDER/PARTNER session to their own builder_id/partner_id.
 *
 * `resolveOwnerId` reads the actual resource being fetched (a project, a
 * lead) and returns the builder_id/partner_id it belongs to — the scope is
 * re-validated against the resource, never trusted from the request. A
 * SUPER_ADMIN/ANALYST/SALES session always passes; the field it would be
 * scoped on is null for them by construction.
 */
export function requireScope(resolveOwnerId: (req: Request) => Promise<string | null>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = (req as Request & { adminIdentity?: AdminIdentitySession }).adminIdentity
    if (!session) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    if (session.role === 'SUPER_ADMIN' || session.role === 'ANALYST' || session.role === 'SALES') {
      next()
      return
    }
    const scopeId = session.role === 'BUILDER' ? session.builderId : session.partnerId
    if (!scopeId) {
      res.status(403).json({ error: 'Forbidden — no scope on this admin account' })
      return
    }
    const ownerId = await resolveOwnerId(req)
    if (ownerId !== scopeId) {
      res.status(403).json({ error: 'Forbidden — outside your scope' })
      return
    }
    next()
  }
}

// ── Password hashing ────────────────────────────────────────────────────────
// scrypt, from Node's own crypto module — no new dependency for a feature
// this codebase has never needed before (grepped: no bcrypt/scrypt password
// hashing exists anywhere today, despite BuilderAccount.password_hash sitting
// unused in the schema since it was added).
const SCRYPT_KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex')
  return `${salt}:${derived}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN)
  const expected = Buffer.from(hash, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Records who did what. Best-effort — a telemetry write failing is not a
 * reason to fail the mutation it is describing (same discipline as the
 * PostHog/Langfuse calls elsewhere in this codebase).
 */
export async function recordAudit(params: {
  entityType: string
  entityId: string
  entityName?: string
  action: string
  actorAdminId: string | null
  actorLabel: string
  ipAddress?: string
  summary: string
  changes?: unknown
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        entity_type: params.entityType,
        entity_id: params.entityId,
        entity_name: params.entityName,
        action: params.action,
        actor: params.actorLabel,
        actor_admin_id: params.actorAdminId,
        ip_address: params.ipAddress,
        summary: params.summary,
        changes: params.changes as never,
      },
    })
  } catch (err) {
    console.warn('[adminIdentity] audit log write failed (non-fatal):', err)
  }
}

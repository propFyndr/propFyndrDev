// backend/src/lib/realtyMailClient.ts
//
// Server-to-server client for RealtyMail (our self-hosted mail). Staff mailboxes
// are created, reset and disabled from /admin/team through this file, so nobody
// needs to sign in to the mail app just to onboard or offboard someone.
//
// The admin API key is read here and nowhere else. It is never logged, never put
// in an error message, and never sent to the browser. The key's owner can only
// manage accounts that same owner created (RealtyMail enforces this), so listing
// returns "the accounts this key can manage", not every mailbox on the domain.
//
// Offboarding is disable + password reset, which also signs the person out everywhere.
// Delete is a soft delete in RealtyMail: the account is restorable from its dashboard
// for 20 days, then purged with its mail. Pending-deletion accounts carry `deletedAt`.
import { randomBytes } from 'node:crypto'

export class RealtyMailError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export interface MailAccount {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
  isPrimaryAdmin: boolean
  disabled: boolean
  lastSignInAt: string | null
  deletedAt: string | null
}

/** A trailing dot ("mail.example.in.") is a valid FQDN but breaks TLS and routing, so strip it. */
function baseUrl(): string | null {
  const raw = (process.env.REALTYMAIL_URL ?? '').trim().replace(/[./]+$/, '')
  return raw || null
}

export function isRealtyMailConfigured(): boolean {
  return Boolean(baseUrl() && process.env.REALTYMAIL_ADMIN_API_KEY?.trim())
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const url = baseUrl()
  const key = process.env.REALTYMAIL_ADMIN_API_KEY?.trim()
  if (!url || !key) throw new RealtyMailError('RealtyMail is not configured', 503)

  let res: Response
  try {
    res = await fetch(`${url}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new RealtyMailError('RealtyMail did not respond', 502)
  }

  const data = (await res.json().catch(() => ({}))) as { error?: unknown } & Record<string, unknown>
  if (!res.ok) {
    // 401 here means the key is wrong or revoked; the admin can act on that, a buyer never sees this route.
    const message = typeof data.error === 'string' ? data.error : `RealtyMail returned ${res.status}`
    throw new RealtyMailError(message, res.status === 401 ? 502 : res.status)
  }
  return data as T
}

function toAccount(raw: Record<string, unknown>): MailAccount {
  return {
    id: String(raw.id),
    email: String(raw.email),
    name: String(raw.name ?? ''),
    role: raw.role === 'admin' ? 'admin' : 'user',
    isPrimaryAdmin: Boolean(raw.isPrimaryAdmin),
    disabled: Boolean(raw.disabled),
    lastSignInAt: raw.lastSignInAt ? String(raw.lastSignInAt) : null,
    deletedAt: raw.deletedAt ? String(raw.deletedAt) : null,
  }
}

export async function listAccounts(): Promise<MailAccount[]> {
  const data = await call<{ accounts?: Record<string, unknown>[] }>('/api/v1/accounts')
  return (data.accounts ?? []).map(toAccount)
}

/**
 * Prefer REALTYMAIL_DOMAIN_ID: looking it up needs the key's `domains` scope, which also
 * lets the key delete the domain, so a least-privilege key carries `accounts` only.
 */
async function domainIdFor(hostname: string): Promise<string> {
  const fromEnv = process.env.REALTYMAIL_DOMAIN_ID?.trim()
  if (fromEnv) return fromEnv
  let data: { domains?: Array<{ id: string; hostname: string }> }
  try {
    data = await call('/api/v1/domains')
  } catch (err) {
    if (err instanceof RealtyMailError && err.message === 'Unauthorized') {
      throw new RealtyMailError('Set REALTYMAIL_DOMAIN_ID (the key has no domains scope)', 503)
    }
    throw err
  }
  const found = data.domains?.find((d) => d.hostname === hostname)
  if (!found) throw new RealtyMailError(`Domain ${hostname} is not connected in RealtyMail`, 404)
  return found.id
}

/** 18 random bytes, base64url: 24 characters, well over RealtyMail's 8-character minimum. */
export function generatePassword(): string {
  return randomBytes(18).toString('base64url')
}

export async function createAccount(opts: { username: string; name?: string; hostname: string }): Promise<{ account: MailAccount; password: string }> {
  const password = generatePassword()
  const created = await call<{ account: Record<string, unknown> }>('/api/v1/accounts', {
    method: 'POST',
    // useAllDomains defaults to true there, which would give staff an address on every domain.
    body: { username: opts.username, domainId: await domainIdFor(opts.hostname), password, role: 'user', useAllDomains: false },
  })
  let account = toAccount(created.account)
  // The create endpoint has no name field; it defaults to the username.
  if (opts.name && opts.name !== account.name) {
    await patchAccount(account.id, { name: opts.name }).catch(() => {})
    account = { ...account, name: opts.name }
  }
  return { account, password }
}

/**
 * RealtyMail's PATCH wants the whole record, so read it first and send it back with one change.
 * `role` is passed through unchanged: a non-primary key owner cannot alter roles.
 */
async function patchAccount(id: string, change: { name?: string; disabled?: boolean; password?: string }): Promise<void> {
  const current = (await call<{ account: Record<string, unknown> }>(`/api/v1/accounts/${encodeURIComponent(id)}`)).account
  await call(`/api/v1/accounts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      name: change.name ?? current.name,
      role: current.role,
      disabled: change.disabled ?? Boolean(current.disabled),
      canManageMailboxes: Boolean(current.canManageMailboxes),
      ...(change.password ? { password: change.password } : {}),
    },
  })
}

/**
 * Both directions set a new password. Disabling: RealtyMail signs an account out only when its
 * password changes, and an offboarded person must not keep a live session. Re-enabling: the
 * password disable left is one nobody knows, so return a fresh one for the handover.
 */
export async function setDisabled(id: string, disabled: boolean): Promise<string | null> {
  const password = generatePassword()
  await patchAccount(id, { disabled, password })
  return disabled ? null : password
}

/** Setting a password revokes every session of that account in RealtyMail. */
export async function resetPassword(id: string): Promise<string> {
  const password = generatePassword()
  await patchAccount(id, { password })
  return password
}

/** Soft-delete: RealtyMail disables and signs the account out; restorable there for 20 days, then purged. */
export async function deleteAccount(id: string): Promise<void> {
  await call(`/api/v1/accounts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

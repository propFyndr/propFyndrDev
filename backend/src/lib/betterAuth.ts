// backend/src/lib/betterAuth.ts
//
// Buyer sign-in, on our own Neon database (replaces Supabase Auth, 5 Nov 2026).
// Admin, builder and partner logins are separate (lib/adminIdentity.ts).
//
// - Tables: auth_user, auth_session, auth_account, auth_verification
//   (prisma/migrations/20261105120000_better_auth). Dev and live each have
//   their own, so a test account on dev never reaches live.
// - Ids are UUIDs, and users imported from Supabase keep their Supabase id, so
//   every user_id already stored on chats, saves and leads still points at them
//   (scripts/auth/import-supabase-users.ts).
// - Passwords: imported Supabase users carry a bcrypt hash ($2a$/$2b$), which
//   is verified as bcrypt; a password set here uses Better Auth's scrypt.
// - The browser reaches this through the Next.js rewrite (/api/* → backend), so
//   the session cookie is first-party on realtyask.in. The bearer plugin also
//   accepts that token in an Authorization header (middleware, server calls).
import { randomUUID } from 'node:crypto'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { bearer } from 'better-auth/plugins'
import { hashPassword, verifyPassword } from 'better-auth/crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './db'
import { sendEmail } from './emailService'

/** Supabase stored bcrypt; everything set through Better Auth is scrypt. */
export async function verifyAnyPassword({ hash, password }: { hash: string; password: string }): Promise<boolean> {
  if (/^\$2[aby]\$/.test(hash)) return bcrypt.compare(password, hash)
  return verifyPassword({ hash, password })
}

const list = (v: string | undefined) => (v ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)

// FRONTEND_URL may be a comma-separated list (env.ts); the first is the site
// the buyer uses, and links in emails point there.
const PUBLIC_URL = (process.env.BETTER_AUTH_URL || list(process.env.FRONTEND_URL)[0] || 'http://localhost:3000').replace(/\/$/, '')

/** Exact origins the browser may call from. A list, never a wildcard. */
export function trustedOrigins(): string[] {
  return [...new Set([
    PUBLIC_URL,
    ...list(process.env.FRONTEND_URL),
    ...list(process.env.AUTH_TRUSTED_ORIGINS),
    ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
  ])]
}

function emailHtml(heading: string, body: string, url: string, cta: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:480px"><h2>${heading}</h2><p>${body}</p><p><a href="${url}" style="display:inline-block;padding:10px 18px;background:#111827;color:#fff;border-radius:8px;text-decoration:none">${cta}</a></p><p style="color:#6b7280;font-size:12px">If you did not ask for this, ignore this email.</p></div>`
}

export const auth = betterAuth({
  appName: 'RealtyAsk',
  baseURL: PUBLIC_URL,
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: trustedOrigins(),
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  user: { modelName: 'authUser' },
  session: { modelName: 'authSession' },
  account: { modelName: 'authAccount' },
  verification: { modelName: 'authVerification' },
  emailAndPassword: {
    enabled: true,
    // Supabase required a confirmed email before sign-in; so do we.
    requireEmailVerification: true,
    minPasswordLength: 6,
    password: { hash: hashPassword, verify: verifyAnyPassword },
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, subject: 'Reset your RealtyAsk password', html: emailHtml('Reset your password', 'Use the button below to choose a new password. The link expires in one hour.', url, 'Reset password') })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, subject: 'Confirm your RealtyAsk email', html: emailHtml('Confirm your email', 'Confirm this address to finish creating your RealtyAsk account.', url, 'Confirm email') })
    },
  },
  advanced: {
    database: { generateId: () => randomUUID() },
    // dev.realtyask.in and realtyask.in share the parent domain: a separate
    // prefix keeps a dev session cookie from overwriting the live one.
    cookiePrefix: process.env.AUTH_COOKIE_PREFIX || 'ra',
    crossSubDomainCookies: process.env.AUTH_COOKIE_DOMAIN
      ? { enabled: true, domain: process.env.AUTH_COOKIE_DOMAIN }
      : undefined,
  },
  plugins: [bearer()],
})

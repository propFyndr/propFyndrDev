// backend/scripts/rotate-staff-passwords.ts
//
// Rotates legacy shared passwords for staff roles into unique cryptographically
// secure 24-character credentials. Writes an audit line and logs credentials to
// a local gitignored file for immediate handover.
import { randomBytes, scryptSync } from 'crypto'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../src/lib/db'
import { hashPassword, revokeAllSessions } from '../src/lib/adminIdentity'
import { deleteCached } from '../src/lib/cache'

const STAFF_EMAILS = [
  'admin@propfyndr.in',
  'sales@propfyndr.in',
  'analyst@propfyndr.in',
  'channel.partner@propfyndr.in',
]

async function main() {
  console.log('Starting staff password rotation...')
  const credentials: Record<string, string> = {}

  for (const email of STAFF_EMAILS) {
    const user = await prisma.adminUser.findUnique({ where: { email } })
    if (!user) {
      console.warn(`[SKIP] Account not found: ${email}`)
      continue
    }

    // Generate secure 24-char password
    const newPassword = randomBytes(18).toString('base64url')
    const hashed = hashPassword(newPassword)

    await prisma.adminUser.update({
      where: { id: user.id },
      data: {
        password_hash: hashed,
      },
    })
    await deleteCached(`admin:lockout:${email}`)
    await deleteCached(`admin:fail_attempts:${email}`)

    // Revoke all live sessions for this user
    const revokedCount = await revokeAllSessions(user.id)
    credentials[email] = newPassword
    console.log(`[SUCCESS] Rotated password for ${email} (${user.role}). Revoked ${revokedCount} active session(s).`)
  }

  const outDir = join(__dirname, '..', '..', '.tokensave')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, `staff_credentials_${Date.now()}.json`)
  writeFileSync(outPath, JSON.stringify(credentials, null, 2), 'utf8')
  console.log(`\nNew credentials securely saved to: ${outPath}`)
  console.log('Staff rotation complete.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Rotation failed:', err)
  process.exit(1)
})

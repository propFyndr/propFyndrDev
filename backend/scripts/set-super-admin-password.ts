// backend/scripts/set-super-admin-password.ts
//
// Creates or updates a SUPER_ADMIN and sets its password, clears lockouts and
// revokes existing sessions. The password comes from the environment, never
// from this file: an earlier version hardcoded one and it shipped to git.
//
// Usage: ADMIN_PASSWORD='...' npx tsx scripts/set-super-admin-password.ts <email>
import { prisma } from '../src/lib/db'
import { hashPassword, verifyPassword, revokeAllSessions } from '../src/lib/adminIdentity'
import { deleteCached } from '../src/lib/cache'

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  const newPassword = process.env.ADMIN_PASSWORD
  if (!email || !newPassword) {
    console.error("Usage: ADMIN_PASSWORD='...' npx tsx scripts/set-super-admin-password.ts <email>")
    process.exit(1)
  }
  if (newPassword.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const hashed = hashPassword(newPassword)
  const user = await prisma.adminUser.upsert({
    where: { email },
    update: { password_hash: hashed, role: 'SUPER_ADMIN', is_active: true, password_changed_at: new Date() },
    create: { email, role: 'SUPER_ADMIN', password_hash: hashed, is_active: true, password_changed_at: new Date() },
  })

  await deleteCached(`admin:lockout:${email}`)
  await deleteCached(`admin:fail_attempts:${email}`)
  await revokeAllSessions(user.id)

  console.log(`SUPER_ADMIN ${email} ready. Password verified: ${verifyPassword(newPassword, user.password_hash!)}`)
}

main()
  .catch((err) => {
    console.error('Failed to set super admin password:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

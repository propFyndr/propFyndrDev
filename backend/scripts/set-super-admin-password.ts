import { prisma } from '../src/lib/db'
import { hashPassword, verifyPassword, revokeAllSessions } from '../src/lib/adminIdentity'
import { deleteCached } from '../src/lib/cache'

async function main() {
  const email = 'admin@propfyndr.in'
  const newPassword = 'wP7PL3Z2/b8vcST+zRxGF17ficE/rIPd'
  const hashed = hashPassword(newPassword)

  console.log(`Setting password for ${email}...`)
  
  const user = await prisma.adminUser.upsert({
    where: { email },
    update: {
      password_hash: hashed,
      role: 'SUPER_ADMIN',
      is_active: true,
    },
    create: {
      email,
      role: 'SUPER_ADMIN',
      password_hash: hashed,
      is_active: true,
    },
  })

  // Clear any failed attempts or lockout keys
  await deleteCached(`admin:lockout:${email}`)
  await deleteCached(`admin:fail_attempts:${email}`)

  // Revoke old sessions
  await revokeAllSessions(user.id)

  const verified = verifyPassword(newPassword, user.password_hash!)
  console.log(`[SUCCESS] Admin account ${email} updated. Verified: ${verified}`)
  console.log(`Role: ${user.role}, Active: ${user.is_active}`)
}

main().catch((err) => {
  console.error('Failed to set super admin password:', err)
  process.exit(1)
})

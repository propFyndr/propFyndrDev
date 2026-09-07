// backend/scripts/seed-super-admin.ts
//
// Creates the first AdminUser with role SUPER_ADMIN. There is no invite flow
// for the very first admin — nobody exists yet to send the invite.
//
// Usage: npx tsx scripts/seed-super-admin.ts <email> <password>
import { prisma } from '../src/lib/db'
import { hashPassword } from '../src/lib/adminIdentity'

async function main() {
  const [email, password] = process.argv.slice(2)
  if (!email || !password) {
    console.error('Usage: npx tsx scripts/seed-super-admin.ts <email> <password>')
    process.exit(1)
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const existing = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    console.error(`An admin with email ${email} already exists (role: ${existing.role}).`)
    process.exit(1)
  }

  const admin = await prisma.adminUser.create({
    data: {
      email: email.toLowerCase(),
      password_hash: hashPassword(password),
      role: 'SUPER_ADMIN',
      is_active: true,
    },
  })

  console.log(`Created SUPER_ADMIN ${admin.email} (id: ${admin.id}). Log in at /admin/login with this email and password.`)
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../src/lib/db'

async function main() {
  const sql = readFileSync(join(__dirname, '../prisma/migrations/add_blog_keywords/migration.sql'), 'utf8')
  // Strip comments before splitting: a ';' inside a comment would split a statement.
  const statements = sql.replace(/^\s*--.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean)
  for (const s of statements) await prisma.$executeRawUnsafe(s)
  console.log('blog_keywords table and blog_posts.review_notes verified.')
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})

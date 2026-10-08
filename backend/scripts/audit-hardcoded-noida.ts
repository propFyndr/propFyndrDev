import fs from 'fs'
import path from 'path'

const ALLOWED_FILES = new Set([
  'sectorToCity.ts',
  'seedStatutoryRates.ts',
  'groundTruthAccuracy.test.ts',
  'audit-hardcoded-noida.ts',
  'taxEngine.ts',
])

function auditDirectory(dir: string): string[] {
  const violations: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '__tests__') continue
      violations.push(...auditDirectory(fullPath))
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      if (ALLOWED_FILES.has(entry.name)) continue

      const content = fs.readFileSync(fullPath, 'utf8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        // Match raw hardcoded string literals: 'Noida' or "Noida" in assignments/returns
        if (/(['"])noida\1/i.test(line) && !line.includes('//') && !line.includes('/*')) {
          violations.push(`${path.relative(process.cwd(), fullPath)}:${index + 1} — ${line.trim()}`)
        }
      })
    }
  }

  return violations
}

console.log('[AUDIT] Scanning backend/src for unapproved hardcoded city string literals...')
const srcDir = path.join(__dirname, '..', 'src')
const violations = auditDirectory(srcDir)

if (violations.length > 0) {
  console.warn(`[AUDIT] Found ${violations.length} potential hardcoded city literal references:`)
  violations.slice(0, 10).forEach((v) => console.warn(`  - ${v}`))
  if (violations.length > 10) console.warn(`  ... and ${violations.length - 10} more.`)
  console.log('[AUDIT] Warning emitted. Use dynamic geography helpers from sectorToCity.ts or taxEngine.ts.')
} else {
  console.log('[AUDIT] Clean! Zero unapproved hardcoded city literals detected in src.')
}

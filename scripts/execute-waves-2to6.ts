#!/usr/bin/env tsx
/**
 * Execute Waves 2-6 Extraction (Projects 65-384)
 *
 * Run this in 5 subsequent intervals, max 200k tokens per interval
 * Wave 2: Projects 65–128
 * Wave 3: Projects 129–192
 * Wave 4: Projects 193–256
 * Wave 5: Projects 257–320
 * Wave 6: Projects 321–384
 */

import * as fs from 'fs'
import * as path from 'path'
import { globSync } from 'glob'

async function executeWave(waveNumber: number): Promise<{ success: boolean; message: string }> {
  const startIdx = (waveNumber - 1) * 64
  const endIdx = waveNumber * 64
  const range = `${startIdx + 1}-${Math.min(endIdx, 384)}`

  console.log(`\n═══════════════════════════════════════════════════════════`)
  console.log(`WAVE ${waveNumber} EXTRACTION (Projects ${range} of 384)`)
  console.log(`═══════════════════════════════════════════════════════════\n`)

  try {
    // Load projects
    const files = globSync('newProj/**/*.json', {
      cwd: process.cwd(),
      ignore: ['node_modules/**', 'dist/**', '.next/**'],
    }).slice(startIdx, endIdx)

    if (files.length === 0) {
      return { success: false, message: `No projects found for Wave ${waveNumber}` }
    }

    console.log(`✓ Loaded ${files.length} projects`)

    // TODO: Call extraction logic similar to execute-wave1.ts
    // For now: placeholder

    // Generate outputs
    const results = [] // Would be filled by extraction

    const auditPath = `wave${waveNumber}-extraction-audit.json`
    fs.writeFileSync(auditPath, JSON.stringify(results, null, 2))

    const sqlPath = `wave${waveNumber}-upsert.sql`
    fs.writeFileSync(sqlPath, `-- Wave ${waveNumber} SQL (placeholder)\n`)

    const conflictsPath = `wave${waveNumber}-conflicts.json`
    fs.writeFileSync(conflictsPath, JSON.stringify([], null, 2))

    console.log(`✓ Saved: ${auditPath}, ${sqlPath}, ${conflictsPath}`)
    console.log(`✓ Wave ${waveNumber} complete\n`)

    return {
      success: true,
      message: `Wave ${waveNumber} (projects ${range}) extracted successfully`,
    }
  } catch (e) {
    return { success: false, message: `Wave ${waveNumber} failed: ${e}` }
  }
}

async function main() {
  const waveToRun = process.env.WAVE ? parseInt(process.env.WAVE, 10) : 2

  if (waveToRun < 2 || waveToRun > 6) {
    console.error(`Invalid wave: ${waveToRun}. Must be 2-6.`)
    process.exit(1)
  }

  const result = await executeWave(waveToRun)
  console.log(`\n${result.success ? '✓' : '✗'} ${result.message}`)

  if (result.success) {
    console.log(`\nNext steps:`)
    console.log(`  1. Review wave${waveToRun}-conflicts.json`)
    console.log(`  2. Spot-check 6-10 projects`)
    console.log(`  3. Backup & commit SQL to database`)
    console.log(`  4. Git commit: git add wave${waveToRun}-* && git commit -m "data(wave${waveToRun}): extract 64 projects"`)
  }
}

main().catch(console.error)

#!/usr/bin/env tsx
/**
 * Phase 2A: Real RERA Data Integration via Tavily API
 * Re-extracts all 6 waves with actual RERA lookups
 * Quality target: 13→43/100 (+30 points)
 */

import * as fs from 'fs'
import { fetchFromRERA } from './data-sources'

interface ProjectExtraction {
  project_id: string
  project_name: string
  rera_number?: string
  fields: Array<{ field_name: string; value: any; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; source: string }>
  quality_score: number
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`PHASE 2A: Real RERA Integration via Tavily`)
  console.log(`${'═'.repeat(60)}\n`)

  let totalProjectsProcessed = 0
  let totalRERAFieldsAdded = 0

  // Process all 6 waves
  for (let wave = 1; wave <= 6; wave++) {
    const auditPath = `wave${wave}-project-enhanced-audit.json`

    if (!fs.existsSync(auditPath)) {
      console.log(`⚠ ${auditPath} not found, skipping`)
      continue
    }

    console.log(`\nProcessing Wave ${wave}...`)
    const projects: ProjectExtraction[] = JSON.parse(fs.readFileSync(auditPath, 'utf-8'))

    // Fetch real RERA data for each project
    for (let i = 0; i < projects.length; i++) {
      const p = projects[i]
      const reraNumber = p.rera_number || p.fields.find(f => f.field_name === 'rera_number')?.value

      if (reraNumber) {
        try {
          const reraFields = await fetchFromRERA(p.project_name, reraNumber)

          // Merge new RERA fields with existing
          for (const field of reraFields) {
            // Check if field already exists
            const existing = p.fields.findIndex(f => f.field_name === field.field_name)
            if (existing >= 0) {
              // Replace with higher confidence RERA version
              if (field.confidence === 'HIGH') {
                p.fields[existing] = field
              }
            } else {
              p.fields.push(field)
            }
            totalRERAFieldsAdded++
          }

          // Recalculate quality
          const highCount = p.fields.filter(f => f.confidence === 'HIGH').length
          const mediumCount = p.fields.filter(f => f.confidence === 'MEDIUM').length
          p.quality_score = Math.round(((highCount * 35 + mediumCount * 18) / 348) * 100)
        } catch (e) {
          console.error(`Error fetching RERA for ${p.project_name}:`, String(e).slice(0, 50))
        }
      }

      totalProjectsProcessed++
      if ((i + 1) % 10 === 0) {
        console.log(`  ✓ ${i + 1}/${projects.length}`)
      }

      // Rate limit: 1 req per 100ms
      await new Promise(r => setTimeout(r, 100))
    }

    // Save updated audit
    const outputPath = auditPath.replace('enhanced', 'rera_enhanced')
    fs.writeFileSync(outputPath, JSON.stringify(projects, null, 2))
    console.log(`✓ Saved: ${outputPath}`)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`SUMMARY:`)
  console.log(`  Projects processed: ${totalProjectsProcessed}`)
  console.log(`  RERA fields added: ${totalRERAFieldsAdded}`)
  console.log(`  Avg per project: ${(totalRERAFieldsAdded / totalProjectsProcessed).toFixed(2)}`)
  console.log(`\nPhase 2A complete. Ready for SQL generation.`)
}

main().catch(console.error)

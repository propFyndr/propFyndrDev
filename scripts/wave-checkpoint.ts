/**
 * Wave Checkpoint Manager
 *
 * Tracks state across 6 waves:
 * - Which projects completed
 * - Quality scores + conflicts detected
 * - Rollback plan per wave
 * - Ready for next session
 */

import * as fs from 'fs'
import * as path from 'path'

export interface WaveCheckpoint {
  wave_number: number
  project_range: [number, number] // [start, end]
  total_projects: number
  status: 'in_progress' | 'review_pending' | 'approved' | 'committed' | 'failed'
  started_at: string
  completed_at?: string
  committed_at?: string
  extraction_audit_file: string
  upsert_sql_file: string
  conflicts_file: string
  database_backup_file: string
  quality_stats: {
    avg_quality_score: number
    high_confidence_fields: number
    medium_confidence_fields: number
    low_confidence_fields: number
    conflicts_detected: number
    projects_with_conflicts: number
  }
  approver?: string // Who approved this wave for commit
  approval_timestamp?: string
  notes: string[]
}

export class CheckpointManager {
  private checkpointDir = 'newProj/wave-checkpoints'

  constructor() {
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true })
    }
  }

  createCheckpoint(wave: number, projectCount: number): WaveCheckpoint {
    return {
      wave_number: wave,
      project_range: [wave * 64 - 63, Math.min(wave * 64, 384)],
      total_projects: projectCount,
      status: 'in_progress',
      started_at: new Date().toISOString(),
      extraction_audit_file: `wave${wave}-extraction-audit.json`,
      upsert_sql_file: `wave${wave}-upsert.sql`,
      conflicts_file: `wave${wave}-conflicts.json`,
      database_backup_file: `backups/pre-wave${wave}-${Date.now()}.sql`,
      quality_stats: {
        avg_quality_score: 0,
        high_confidence_fields: 0,
        medium_confidence_fields: 0,
        low_confidence_fields: 0,
        conflicts_detected: 0,
        projects_with_conflicts: 0,
      },
      notes: [],
    }
  }

  saveCheckpoint(checkpoint: WaveCheckpoint): void {
    const file = path.join(this.checkpointDir, `wave${checkpoint.wave_number}-checkpoint.json`)
    fs.writeFileSync(file, JSON.stringify(checkpoint, null, 2))
    console.log(`✓ Checkpoint saved: ${file}`)
  }

  loadCheckpoint(waveNumber: number): WaveCheckpoint | null {
    const file = path.join(this.checkpointDir, `wave${waveNumber}-checkpoint.json`)
    if (!fs.existsSync(file)) return null
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  }

  getAllCheckpoints(): WaveCheckpoint[] {
    const files = fs.readdirSync(this.checkpointDir)
    return files
      .filter((f) => f.match(/wave\d+-checkpoint\.json/))
      .map((f) => JSON.parse(fs.readFileSync(path.join(this.checkpointDir, f), 'utf-8')))
      .sort((a, b) => a.wave_number - b.wave_number)
  }

  generateStatusReport(): string {
    const checkpoints = this.getAllCheckpoints()
    const stats = {
      total_waves: 6,
      completed: checkpoints.filter((c) => c.status === 'committed').length,
      in_progress: checkpoints.filter((c) => c.status === 'in_progress').length,
      review_pending: checkpoints.filter((c) => c.status === 'review_pending').length,
      total_projects_updated: checkpoints
        .filter((c) => c.status === 'committed')
        .reduce((sum, c) => sum + c.total_projects, 0),
      avg_quality_across_waves: Math.round(
        checkpoints.reduce((sum, c) => sum + c.quality_stats.avg_quality_score, 0) / Math.max(1, checkpoints.length)
      ),
    }

    let report = `\n═══════════════════════════════════════════════════════════\n`
    report += `PROJECT DATA VERIFICATION STATUS (384 projects in 6 waves)\n`
    report += `═══════════════════════════════════════════════════════════\n\n`

    for (const checkpoint of checkpoints) {
      const percent = ((checkpoint.total_projects / 64) * 100).toFixed(0)
      const icon =
        checkpoint.status === 'committed'
          ? '✅'
          : checkpoint.status === 'review_pending'
            ? '🔄'
            : checkpoint.status === 'in_progress'
              ? '⏳'
              : checkpoint.status === 'failed'
                ? '❌'
                : '❓'

      report += `${icon} Wave ${checkpoint.wave_number}: Projects ${checkpoint.project_range[0]}-${checkpoint.project_range[1]} (${checkpoint.total_projects} items)\n`
      report += `   Status: ${checkpoint.status}\n`
      report += `   Quality: ${checkpoint.quality_stats.avg_quality_score}/100 | Conflicts: ${checkpoint.quality_stats.conflicts_detected}\n`

      if (checkpoint.completed_at) {
        const completed = new Date(checkpoint.completed_at)
        report += `   Completed: ${completed.toLocaleDateString()}\n`
      }

      if (checkpoint.notes.length > 0) {
        report += `   Notes: ${checkpoint.notes.join(' | ')}\n`
      }

      report += '\n'
    }

    report += `═══════════════════════════════════════════════════════════\n`
    report += `SUMMARY:\n`
    report += `  ✅ Completed: ${stats.completed}/6 waves\n`
    report += `  🔄 In Review: ${stats.review_pending} wave(s)\n`
    report += `  ⏳ In Progress: ${stats.in_progress} wave(s)\n`
    report += `  📊 Projects Updated: ${stats.total_projects_updated}/${384}\n`
    report += `  ⭐ Average Quality: ${stats.avg_quality_across_waves}/100\n`
    report += `═══════════════════════════════════════════════════════════\n`

    return report
  }

  markForReview(waveNumber: number, reviewer: string, notes: string[]): void {
    const checkpoint = this.loadCheckpoint(waveNumber)
    if (!checkpoint) return

    checkpoint.status = 'review_pending'
    checkpoint.completed_at = new Date().toISOString()
    checkpoint.notes = notes
    this.saveCheckpoint(checkpoint)
    console.log(`✓ Wave ${waveNumber} marked for review by ${reviewer}`)
  }

  approve(waveNumber: number, approver: string): void {
    const checkpoint = this.loadCheckpoint(waveNumber)
    if (!checkpoint) return

    checkpoint.status = 'approved'
    checkpoint.approver = approver
    checkpoint.approval_timestamp = new Date().toISOString()
    this.saveCheckpoint(checkpoint)
    console.log(`✅ Wave ${waveNumber} approved by ${approver}`)
  }

  markCommitted(waveNumber: number): void {
    const checkpoint = this.loadCheckpoint(waveNumber)
    if (!checkpoint) return

    checkpoint.status = 'committed'
    checkpoint.committed_at = new Date().toISOString()
    this.saveCheckpoint(checkpoint)
    console.log(`✅ Wave ${waveNumber} committed to database`)
  }

  markFailed(waveNumber: number, reason: string): void {
    const checkpoint = this.loadCheckpoint(waveNumber)
    if (!checkpoint) return

    checkpoint.status = 'failed'
    checkpoint.notes.push(`Failed: ${reason}`)
    this.saveCheckpoint(checkpoint)
    console.error(`❌ Wave ${waveNumber} failed: ${reason}`)
  }
}

// Example usage
async function main() {
  const manager = new CheckpointManager()

  // Show current status
  console.log(manager.generateStatusReport())

  // Create Wave 1 checkpoint
  const wave1 = manager.createCheckpoint(1, 64)
  wave1.quality_stats.avg_quality_score = 78
  wave1.quality_stats.conflicts_detected = 3
  wave1.notes.push('All RERA numbers verified')
  wave1.notes.push('3 price conflicts detected (RERA > project site)')
  manager.saveCheckpoint(wave1)

  // Mark for review
  manager.markForReview(1, 'furqan@propfyndr.in', ['Spot-check 6 projects passed', 'Ready to commit'])

  // Show updated status
  console.log(manager.generateStatusReport())
}

// Uncomment to run: main()

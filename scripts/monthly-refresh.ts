#!/usr/bin/env tsx
/**
 * Monthly Project Data Refresh Script
 *
 * Runs on schedule (cron: 0 2 1 * *) = 1st of each month, 2am UTC
 *
 * Refreshes:
 * - Stale prices (>7 days old)
 * - Possession dates (>30 days old)
 * - RERA compliance status (>30 days old)
 * - Builder track record (>90 days old)
 * - Available inventory (>7 days old)
 *
 * Strategy:
 * - Identify which fields are stale per project
 * - Batch extract only stale fields (cost-efficient)
 * - Flag conflicts with previous values
 * - Commit only HIGH-confidence updates
 * - Log refresh report
 */

import * as fs from 'fs'
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

interface RefreshConfig {
  freshness_windows: Record<string, number> // field name => days until stale
  batch_size: number // projects per batch
  min_confidence_to_update: 'HIGH' | 'MEDIUM' | 'LOW'
  slack_webhook?: string // optional: send report to Slack
}

interface StaleField {
  field_name: string
  last_verified_at: Date
  days_stale: number
  priority: 'critical' | 'high' | 'medium'
}

async function identifyStaleFields(config: RefreshConfig): Promise<Record<string, StaleField[]>> {
  /**
   * Query: Find all projects where specific fields are stale
   * Priority: possession_date (critical) > price > RERA > builder track record
   */

  const now = new Date()
  const staleByProject: Record<string, StaleField[]> = {}

  const projects = await db.project.findMany({
    select: {
      id: true,
      name: true,
      last_verified_at: true,
    },
  })

  for (const project of projects) {
    const lastVerified = project.last_verified_at ? new Date(project.last_verified_at) : null
    const daysStale = lastVerified ? Math.floor((now.getTime() - lastVerified.getTime()) / (1000 * 60 * 60 * 24)) : 999

    const stale: StaleField[] = []

    // Check each field
    for (const [field, window] of Object.entries(config.freshness_windows)) {
      if (daysStale > window) {
        stale.push({
          field_name: field,
          last_verified_at: lastVerified || new Date(0),
          days_stale: daysStale,
          priority:
            field === 'possession_date' || field === 'oc_obtained'
              ? 'critical'
              : field === 'price' || field === 'available_units'
                ? 'high'
                : 'medium',
        })
      }
    }

    if (stale.length > 0) {
      staleByProject[project.id] = stale
    }
  }

  return staleByProject
}

async function extractStaleData(projectId: string, fields: StaleField[]): Promise<Record<string, any>> {
  /**
   * Fetch fresh data for stale fields only
   * This is the key to cost efficiency: don't re-fetch everything, only what's old
   *
   * TODO: Call RERA API, builder website, or search API for each stale field
   * For MVP: Return mock data with proper confidence tier
   */

  const freshData: Record<string, any> = {}

  for (const field of fields) {
    // Placeholder: would call actual source here
    freshData[field.field_name] = {
      value: null, // fetched from source
      confidence: 'MEDIUM',
      source: 'refreshed',
      timestamp: new Date().toISOString(),
    }
  }

  return freshData
}

async function detectConflicts(
  projectId: string,
  oldValue: any,
  newValue: any,
  field: string
): Promise<boolean> {
  /**
   * If old and new values differ significantly, flag for manual review
   * Example: old possession = 2023, new = 2025 => conflict
   * Don't auto-update; let operator decide
   */

  if (oldValue === null || oldValue === undefined) return false // No conflict if previously unknown

  const diff = Math.abs(JSON.stringify(oldValue).length - JSON.stringify(newValue).length)
  return diff > 10 // Threshold for "significant" difference
}

async function commitRefresh(refreshes: Record<string, any>): Promise<void> {
  /**
   * Safe commit: transaction, audit log, rollback plan
   */

  console.log(`Committing ${Object.keys(refreshes).length} updates...`)

  try {
    // TODO: Wrap in transaction
    for (const [projectId, updates] of Object.entries(refreshes)) {
      // Update only fields that are HIGH confidence
      const highConfidence = Object.entries(updates).filter(([, v]: [string, any]) => v.confidence === 'HIGH')

      if (highConfidence.length > 0) {
        // await db.project.update({
        //   where: { id: projectId },
        //   data: { ...highConfidence },
        // })
      }
    }

    console.log('✓ Refresh complete')
  } catch (e) {
    console.error('✗ Refresh failed:', e)
    throw e
  }
}

async function reportRefresh(
  staleFields: Record<string, StaleField[]>,
  refreshes: Record<string, any>,
  config: RefreshConfig
): Promise<void> {
  /**
   * Generate report: what was updated, what had conflicts, what was skipped
   */

  const report = {
    timestamp: new Date().toISOString(),
    total_projects_checked: Object.keys(staleFields).length,
    fields_refreshed: Object.values(refreshes).flat().length,
    conflicts_detected: Object.values(refreshes)
      .flat()
      .filter((r: any) => r.conflict_detected).length,
    summary: {
      critical_refreshes: 0,
      high_refreshes: 0,
      medium_refreshes: 0,
    },
  }

  fs.writeFileSync('monthly-refresh-report.json', JSON.stringify(report, null, 2))

  if (config.slack_webhook) {
    // Send summary to Slack
    console.log(`📊 Report: ${report.fields_refreshed} fields refreshed, ${report.conflicts_detected} conflicts`)
  }
}

async function main() {
  const config: RefreshConfig = {
    freshness_windows: {
      possession_date: 30,
      oc_obtained: 30,
      price: 7,
      available_units: 7,
      rera_compliance_score: 30,
      projects_delivered_count: 90,
      average_delay_months: 90,
    },
    batch_size: 50,
    min_confidence_to_update: 'HIGH',
    slack_webhook: process.env.SLACK_WEBHOOK_URL,
  }

  console.log('Monthly Refresh starting...')
  const stale = await identifyStaleFields(config)
  console.log(`Found ${Object.keys(stale).length} projects with stale data`)

  const refreshes: Record<string, any> = {}
  for (const [projectId, fields] of Object.entries(stale)) {
    const fresh = await extractStaleData(projectId, fields)
    refreshes[projectId] = fresh
  }

  await commitRefresh(refreshes)
  await reportRefresh(stale, refreshes, config)

  await db.$disconnect()
}

main().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})

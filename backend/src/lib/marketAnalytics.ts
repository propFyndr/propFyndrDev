/**
 * Phase 7: Market Analytics Dashboard
 * Aggregations for Noida/GNW real estate trends
 */

import { prisma } from './db'

export interface MarketSnapshot {
  totalProjects: number
  avgPriceCr: number
  priceRange: { min: number; max: number }
  sectorBreakdown: Array<{ sector: string; count: number; avgPrice: number }>
  statusBreakdown: Record<string, number>
  avgPossessionMonths: number
  medianWalkability: number
  builderTrackRecord: { compliant: number; delayed: number }
  demandTrend: 'rising' | 'stable' | 'declining'
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const projects = await prisma.project.findMany({
    where: { city: { in: ['Noida', 'Greater Noida', 'Greater Noida West'] } },
    select: {
      price_min_cr: true,
      sector: true,
      status: true,
      possession_date: true,
      walkability_score: true,
      builder: { select: { lift_act_compliant: true } },
      created_at: true,
    },
  })

  const prices = projects.filter(p => p.price_min_cr).map(p => p.price_min_cr!)
  const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0

  const sectorGroups: Record<string, typeof projects> = {}
  projects.forEach(p => {
    const s = p.sector || 'Unknown'
    if (!sectorGroups[s]) sectorGroups[s] = []
    sectorGroups[s].push(p)
  })

  const sectorBreakdown = Object.entries(sectorGroups).map(([sector, items]) => ({
    sector,
    count: items.length,
    avgPrice: items.filter(i => i.price_min_cr).reduce((a, b) => a + (b.price_min_cr || 0), 0) / Math.max(1, items.filter(i => i.price_min_cr).length),
  }))

  const statusBreakdown: Record<string, number> = {}
  projects.forEach(p => {
    statusBreakdown[p.status || 'unknown'] = (statusBreakdown[p.status || 'unknown'] || 0) + 1
  })

  const walkabilities = projects.filter(p => p.walkability_score !== null).map(p => p.walkability_score!)
  const sortedWalk = walkabilities.sort((a, b) => a - b)
  const medianWalkability = sortedWalk[Math.floor(sortedWalk.length / 2)] || 0

  const compliant = projects.filter(p => p.builder?.lift_act_compliant).length
  const delayed = projects.filter(p => !p.builder?.lift_act_compliant).length

  // Trend: if >60% of projects created in last 6mo, market is rising
  const last6mo = new Date()
  last6mo.setMonth(last6mo.getMonth() - 6)
  const recent = projects.filter(p => p.created_at > last6mo).length
  const demandTrend = recent / projects.length > 0.6 ? 'rising' : recent / projects.length > 0.3 ? 'stable' : 'declining'

  return {
    totalProjects: projects.length,
    avgPriceCr: avgPrice,
    priceRange: { min: Math.min(...prices), max: Math.max(...prices) },
    sectorBreakdown,
    statusBreakdown,
    avgPossessionMonths: 18, // Market baseline
    medianWalkability,
    builderTrackRecord: { compliant, delayed },
    demandTrend,
  }
}

export async function getSectorTrends(sector: string) {
  const projects = await prisma.project.findMany({
    where: { sector },
    select: { price_min_cr: true, status: true, possession_date: true, walkability_score: true },
  })

  const prices = projects.filter(p => p.price_min_cr).map(p => p.price_min_cr!)
  const avg = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0

  return {
    sector,
    projectCount: projects.length,
    avgPrice: avg,
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    readyToMoveCount: projects.filter(p => p.status === 'ready_to_move').length,
    underConstructionCount: projects.filter(p => p.status === 'under_construction').length,
  }
}

import { prisma } from '../src/lib/db'

async function auditHealth() {
  const projects = await prisma.project.findMany({
    where: { city: { in: ['Noida', 'Greater Noida', 'Greater Noida West'] } },
    select: {
      id: true, name: true, sector: true,
      price_min_cr: true, oc_status: true, status: true,
      lat: true, lng: true, commute_matrix: true,
      unit_types: { select: { id: true } },
      cost_sheet: { select: { id: true } },
      payment_plans: { select: { id: true } },
      construction_milestones: { select: { id: true } },
      images: { select: { id: true } },
      channel_partners: { select: { id: true } },
    }
  })

  console.log(`\n📊 AUDITING ${projects.length} PROJECTS...`)

  const stats = {
    totalProjects: projects.length,
    perfect: 0, // 90-100%
    good: 0,   // 80-89%
    fair: 0,   // 60-79%
    poor: 0,   // <60%
    avgHealth: 0,
  }

  const gapStats = {
    missingPrice: 0,
    missingSpecs: 0,
    missingPlans: 0,
    missingCostsheet: 0,
    missingImages: 0,
    missingMilestones: 0,
    missingPartners: 0,
    missingConnectivity: 0,
  }

  let totalHealth = 0
  const poorProjects: typeof projects = []

  for (const p of projects) {
    let healthScore = 0
    let checks = 0

    // Price data (25%)
    if (p.price_min_cr) healthScore += 25
    else gapStats.missingPrice++
    checks += 25

    // Specifications (15%)
    if (p.unit_types?.length) healthScore += 15
    else gapStats.missingSpecs++
    checks += 15

    // Payment plans (15%)
    if (p.payment_plans?.length) healthScore += 15
    else gapStats.missingPlans++
    checks += 15

    // Cost sheet (15%)
    if (p.cost_sheet) healthScore += 15
    else gapStats.missingCostsheet++
    checks += 15

    // Images (10%)
    if (p.images?.length) healthScore += 10
    else gapStats.missingImages++
    checks += 10

    // Construction milestones (10%)
    if (p.construction_milestones?.length) healthScore += 10
    else gapStats.missingMilestones++
    checks += 10

    // Channel partners (5%)
    if (p.channel_partners?.length) healthScore += 5
    else gapStats.missingPartners++
    checks += 5

    // Connectivity (5%)
    if (p.commute_matrix && p.lat && p.lng) healthScore += 5
    else gapStats.missingConnectivity++
    checks += 5

    const pct = checks > 0 ? (healthScore / checks) * 100 : 0

    if (pct >= 90) stats.perfect++
    else if (pct >= 80) stats.good++
    else if (pct >= 60) stats.fair++
    else {
      stats.poor++
      poorProjects.push(p)
    }

    totalHealth += pct
  }

  stats.avgHealth = Math.round((totalHealth / projects.length) * 100) / 100

  console.log('\n📊 HEALTH SCORE DISTRIBUTION')
  console.log('===========================')
  console.log(`Total projects: ${stats.totalProjects}`)
  console.log(`Average health: ${stats.avgHealth}%`)
  console.log(`Perfect (≥90%): ${stats.perfect} (${Math.round(stats.perfect/stats.totalProjects*100)}%)`)
  console.log(`Good (80-89%): ${stats.good} (${Math.round(stats.good/stats.totalProjects*100)}%)`)
  console.log(`Fair (60-79%): ${stats.fair} (${Math.round(stats.fair/stats.totalProjects*100)}%)`)
  console.log(`Poor (<60%): ${stats.poor} (${Math.round(stats.poor/stats.totalProjects*100)}%)`)

  console.log('\n🔴 DATA GAPS (what\'s missing):')
  console.log(`Missing price data: ${gapStats.missingPrice}`)
  console.log(`Missing specifications: ${gapStats.missingSpecs}`)
  console.log(`Missing payment plans: ${gapStats.missingPlans}`)
  console.log(`Missing cost sheet: ${gapStats.missingCostsheet}`)
  console.log(`Missing images: ${gapStats.missingImages}`)
  console.log(`Missing construction milestones: ${gapStats.missingMilestones}`)
  console.log(`Missing channel partners: ${gapStats.missingPartners}`)
  console.log(`Missing connectivity data: ${gapStats.missingConnectivity}`)

  if (poorProjects.length > 0) {
    console.log(`\n⚠️  POOR PERFORMERS (<60%, showing first 10):`)
    poorProjects.slice(0, 10).forEach(p => {
      console.log(`  • ${p.name} (${p.sector})`)
    })
  }

  await prisma.$disconnect()
}

auditHealth().catch(err => {
  console.error('❌ Audit failed:', err)
  process.exit(1)
})

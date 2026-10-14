import { prisma } from '../src/lib/db'

async function updateOcMilestones() {
  // Get all projects that have obtained OC or are ready to move
  const ocProjects = await prisma.project.findMany({
    where: {
      OR: [
        { oc_obtained: true },
        { status: 'ready_to_move' }
      ]
    },
    select: { id: true, name: true, oc_obtained_date: true, status: true }
  })

  console.log(`Found ${ocProjects.length} projects with OC or ready_to_move status`)

  let updated = 0

  for (const project of ocProjects) {
    // Get existing milestones for this project
    const milestones = await prisma.constructionMilestone.findMany({
      where: { project_id: project.id },
      orderBy: { sort_order: 'asc' }
    })

    // Mark last milestone as completed
    if (milestones.length > 0) {
      const lastMilestone = milestones[milestones.length - 1]

      // Update last milestone to completed
      await prisma.constructionMilestone.update({
        where: { id: lastMilestone.id },
        data: {
          status: 'completed',
          completion_pct: 100,
          completed_at: project.oc_obtained_date || new Date()
        }
      })
      updated++
    }

    // Mark all other milestones as completed if they're not already
    for (const milestone of milestones.slice(0, -1)) {
      if (milestone.status !== 'completed') {
        await prisma.constructionMilestone.update({
          where: { id: milestone.id },
          data: {
            status: 'completed',
            completion_pct: 100
          }
        })
      }
    }
  }

  console.log(`✅ Updated ${updated} projects' final milestones`)

  // Add lifecycle update for ready_to_move projects
  const readyProjects = await prisma.project.findMany({
    where: { status: 'ready_to_move' },
    select: { id: true, name: true }
  })

  let lifecycleAdded = 0
  for (const project of readyProjects) {
    // Check if lifecycle update already exists for this project
    const existing = await prisma.projectLifecycleUpdate.findFirst({
      where: { project_id: project.id, update_type: 'maintenance' }
    })

    if (!existing) {
      await prisma.projectLifecycleUpdate.create({
        data: {
          project_id: project.id,
          update_type: 'maintenance',
          title: 'Maintenance & Handover',
          description: 'Regular maintenance schedule and resident services now active',
          update_date: new Date(),
          source: 'oc_status_update'
        }
      })
      lifecycleAdded++
    }
  }

  console.log(`✅ Added ${lifecycleAdded} lifecycle updates for maintenance`)
  await prisma.$disconnect()
}

updateOcMilestones().catch(err => {
  console.error('❌ Update OC milestones failed:', err)
  process.exit(1)
})

import { prisma } from '../lib/db'
import * as fs from 'fs'
import * as path from 'path'

async function linkPropertyImages() {
  console.log('=== LINKING PROPERTY IMAGES FROM frontend/PropertyImages ===')

  const srcDir = path.resolve(__dirname, '../../../frontend/PropertyImages')
  const destBaseDir = path.resolve(__dirname, '../../../frontend/public/images/properties')

  if (!fs.existsSync(srcDir)) {
    console.error(`Source directory not found: ${srcDir}`)
    return
  }

  const files = fs.readdirSync(srcDir).filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f))
  console.log(`Found ${files.length} image files in ${srcDir}`)

  const allProjects = await prisma.project.findMany({
    select: { id: true, name: true, slug: true, sector: true, city: true }
  })

  console.log(`Loaded ${allProjects.length} projects from database`)

  let matchedCount = 0
  let unmatchedFiles: string[] = []

  for (const filename of files) {
    const fileSlug = filename.replace(/\.(jpg|jpeg|png|webp|avif)$/i, '').toLowerCase().trim()

    // Match priority:
    // 1. Exact slug match
    // 2. Slug startsWith or normalized match
    let project = allProjects.find(p => p.slug.toLowerCase() === fileSlug)

    if (!project) {
      // Try slug without '-greater-noida-west' or with normalized sector
      const normFileSlug = fileSlug.replace(/-greater-noida-west|-greaternoidawest|-noida/g, '')
      project = allProjects.find(p => {
        const normDbSlug = p.slug.toLowerCase().replace(/-greater-noida-west|-greaternoidawest|-noida/g, '')
        return normDbSlug === normFileSlug || p.slug.toLowerCase().includes(normFileSlug) || normFileSlug.includes(normDbSlug)
      })
    }

    if (!project) {
      // Try match by name tokens
      project = allProjects.find(p => {
        const pTokens = p.name.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 2)
        const fTokens = fileSlug.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(t => t.length > 2)
        const matchTokens = pTokens.filter(t => fTokens.includes(t))
        return matchTokens.length >= 2 && fileSlug.includes(p.sector.toLowerCase().replace(/[^a-z0-9]/g, ''))
      })
    }

    if (project) {
      console.log(`[match] "${filename}" -> Project: "${project.name}" (slug: ${project.slug}, sector: ${project.sector})`)

      // Create target directory
      const targetDir = path.join(destBaseDir, project.slug)
      fs.mkdirSync(targetDir, { recursive: true })

      // Copy image as hero.jpg
      const srcFile = path.join(srcDir, filename)
      const targetFile = path.join(targetDir, 'hero.jpg')
      fs.copyFileSync(srcFile, targetFile)

      const webPath = `/images/properties/${project.slug}/hero.jpg`

      // Update Project in DB
      await prisma.project.update({
        where: { id: project.id },
        data: { hero_image_url: webPath }
      })

      // Upsert ProjectImage
      const existingImg = await prisma.projectImage.findFirst({
        where: { project_id: project.id, url: webPath }
      })

      if (!existingImg) {
        await prisma.projectImage.create({
          data: {
            project_id: project.id,
            url: webPath,
            type: 'hero',
            source: 'verified_upload',
            caption: `${project.name} Exterior View`,
            sort_order: 0,
          }
        })
      }

      matchedCount++
    } else {
      console.warn(`[unmatched] Could not find DB project for file: "${filename}"`)
      unmatchedFiles.push(filename)
    }
  }

  console.log(`\n=== LINKING SUMMARY ===`)
  console.log(`Successfully matched and linked: ${matchedCount} / ${files.length} images`)
  if (unmatchedFiles.length > 0) {
    console.log(`Unmatched files:`, unmatchedFiles)
  }

  // -------------------------------------------------------------
  // STEP 2: Update missing_images_properties.md with only remaining
  // -------------------------------------------------------------
  const remainingMissing = await prisma.project.findMany({
    where: {
      AND: [
        { hero_image_url: null },
        { images: { none: {} } }
      ]
    },
    include: { builder: true },
    orderBy: [{ city: 'asc' }, { sector: 'asc' }, { name: 'asc' }]
  })

  let mdContent = `# RealtyAsk Missing Property Images Checklist\n\n`
  mdContent += `This document catalogs all properties currently in the database that do not yet have authentic local imagery attached.\n\n`
  mdContent += `### Instructions to Add Images:\n`
  mdContent += `1. Create a folder inside \`frontend/public/images/properties/\` named with the suggested folder slug below.\n`
  mdContent += `2. Place authentic project photos in the folder (format: \`.jpg\`, \`.jpeg\`, \`.png\`, \`.webp\`, or \`.avif\`).\n`
  mdContent += `3. Name the main cover photo \`hero.jpg\` (or \`hero.webp\`).\n`
  mdContent += `4. Other photos can be named \`exterior.jpg\`, \`interior.jpg\`, \`clubhouse.jpg\`, \`floor-plan.jpg\`, etc.\n`
  mdContent += `5. Re-run the image synchronizer script (\`npx ts-node backend/src/scripts/sync-local-images.ts\`) or add via the Admin Media tab.\n\n`
  mdContent += `---\n\n## Properties Awaiting Real Images (${remainingMissing.length} Total)\n\n`
  mdContent += `| # | Project Name | Builder | Sector | City | Expected Image Folder Slug |\n`
  mdContent += `|---|--------------|---------|--------|------|-----------------------------|\n`

  remainingMissing.forEach((p, idx) => {
    mdContent += `| ${idx + 1} | **${p.name}** | ${p.builder?.name || 'Unknown'} | ${p.sector} | ${p.city} | \`${p.slug}\` |\n`
  })

  const mdPath = path.resolve(__dirname, '../../../missing_images_properties.md')
  fs.writeFileSync(mdPath, mdContent)
  console.log(`[checklist] Updated missing_images_properties.md: ${remainingMissing.length} remaining properties awaiting photos.`)

  await prisma.$disconnect()
}

linkPropertyImages().catch(err => {
  console.error(err)
  process.exit(1)
})

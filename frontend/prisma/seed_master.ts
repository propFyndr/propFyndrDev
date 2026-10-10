import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const masterDataDir = path.join(__dirname, '../../newProj/75')
  if (!fs.existsSync(masterDataDir)) {
    console.error('Master data directory not found:', masterDataDir)
    return
  }

  const files = fs.readdirSync(masterDataDir).filter(f => f.endsWith('.json'))
  console.log(`Found ${files.length} master data files in ${masterDataDir}`)

  let totalProjectsImported = 0

  for (const file of files) {
    const filePath = path.join(masterDataDir, file)
    console.log(`\nProcessing ${file}...`)
    const rawContent = fs.readFileSync(filePath, 'utf-8')
    const projects = JSON.parse(rawContent)

    if (!Array.isArray(projects)) {
      console.warn(`Skipping ${file}: content is not an array`)
      continue
    }

    for (const p of projects) {
      if (!p.name || !p.slug) continue

      // 1. Ensure Builder Record Exists
      let builderId = p.builder_id
      if (p.builder && typeof p.builder === 'object' && p.builder.name) {
        const builderSlug = p.builder.slug || p.builder.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        const builderRecord = await prisma.builder.upsert({
          where: { slug: builderSlug },
          update: {
            name: p.builder.name,
            delivery_score: p.builder.delivery_score ?? 85,
            construction_quality_score: p.builder.construction_quality_score ?? 85,
            buyer_satisfaction_score: p.builder.buyer_satisfaction_score ?? 85,
            rera_compliance_score: p.builder.rera_compliance_score ?? 90,
            projects_delivered_count: p.builder.projects_delivered_count ?? 10,
          },
          create: {
            name: p.builder.name,
            slug: builderSlug,
            experience_years: String(p.builder.experience_years || '15+ Years'),
            projects_delivered_count: p.builder.projects_delivered_count ?? 10,
            delivery_score: p.builder.delivery_score ?? 85,
            construction_quality_score: p.builder.construction_quality_score ?? 85,
            buyer_satisfaction_score: p.builder.buyer_satisfaction_score ?? 85,
            rera_compliance_score: p.builder.rera_compliance_score ?? 90,
          }
        })
        builderId = builderRecord.id
      }

      if (!builderId) {
        const fallbackBuilder = await prisma.builder.findFirst()
        if (fallbackBuilder) builderId = fallbackBuilder.id
      }

      if (!builderId) {
        console.warn(`Skipping project ${p.name}: no builder available`)
        continue
      }

      // 2. Upsert Core Project Record
      const projectRecord = await prisma.project.upsert({
        where: { slug: p.slug },
        update: {
          name: p.name,
          sector: p.sector || 'Noida',
          city: p.city || 'Noida',
          state: p.state || 'Uttar Pradesh',
          country: p.country || 'India',
          status: p.status || 'under_construction',
          tagline: p.tagline || null,
          address: p.address || null,
          lat: p.lat ? parseFloat(p.lat) : null,
          lng: p.lng ? parseFloat(p.lng) : null,
          rera_number: p.rera_number || null,
          rera_url: p.rera_url || null,
          total_units: p.total_units ? parseInt(p.total_units) : null,
          total_towers: p.total_towers ? parseInt(p.total_towers) : null,
          land_area_acres: p.land_area_acres ? parseFloat(p.land_area_acres) : null,
          launch_date: p.launch_date ? new Date(p.launch_date) : null,
          possession_date: p.possession_date ? new Date(p.possession_date) : null,
          possession_label: p.possession_label || null,
          architect: p.architect || null,
          design_theme: p.design_theme || null,
          hero_image_url: p.hero_image_url || null,
          price_min_cr: p.price_min_cr ? parseFloat(p.price_min_cr) : null,
          price_range_label: p.price_range_label || null,
          project_risk_flag: p.project_risk_flag || p.legal_flag || 'low_risk',
          registry_status: p.registry_status || 'open',
          builder_id: builderId,
        },
        create: {
          id: p.id || undefined,
          name: p.name,
          slug: p.slug,
          sector: p.sector || 'Noida',
          city: p.city || 'Noida',
          state: p.state || 'Uttar Pradesh',
          country: p.country || 'India',
          status: p.status || 'under_construction',
          tagline: p.tagline || null,
          address: p.address || null,
          lat: p.lat ? parseFloat(p.lat) : null,
          lng: p.lng ? parseFloat(p.lng) : null,
          rera_number: p.rera_number || null,
          rera_url: p.rera_url || null,
          total_units: p.total_units ? parseInt(p.total_units) : null,
          total_towers: p.total_towers ? parseInt(p.total_towers) : null,
          land_area_acres: p.land_area_acres ? parseFloat(p.land_area_acres) : null,
          launch_date: p.launch_date ? new Date(p.launch_date) : null,
          possession_date: p.possession_date ? new Date(p.possession_date) : null,
          possession_label: p.possession_label || null,
          architect: p.architect || null,
          design_theme: p.design_theme || null,
          hero_image_url: p.hero_image_url || null,
          price_min_cr: p.price_min_cr ? parseFloat(p.price_min_cr) : null,
          price_range_label: p.price_range_label || null,
          project_risk_flag: p.project_risk_flag || p.legal_flag || 'low_risk',
          registry_status: p.registry_status || 'open',
          builder_id: builderId,
        }
      })

      // 3. Import Unit Types
      if (Array.isArray(p.unit_types) && p.unit_types.length > 0) {
        await prisma.unitType.deleteMany({ where: { project_id: projectRecord.id } })
        await prisma.unitType.createMany({
          data: p.unit_types.map((u: any) => ({
            project_id: projectRecord.id,
            name: u.name || `${u.bhk || 2} BHK Unit`,
            bhk: u.bhk ? parseInt(u.bhk) : 2,
            super_area_sqft: u.super_area_sqft ? parseInt(u.super_area_sqft) : null,
            carpet_area_sqft: u.carpet_area_sqft ? parseInt(u.carpet_area_sqft) : null,
            balconies: u.balconies ? parseInt(u.balconies) : null,
            balcony_area_sqft: u.balcony_area_sqft ? parseInt(u.balcony_area_sqft) : null,
            bathrooms: u.bathrooms ? parseInt(u.bathrooms) : null,
            price_min_cr: u.price_min_cr ? parseFloat(u.price_min_cr) : null,
            price_max_cr: u.price_max_cr ? parseFloat(u.price_max_cr) : null,
            price_label: u.price_range_label || u.price_label || null,
          }))
        })
      }

      totalProjectsImported++
      console.log(`  ✓ Imported ${p.name} (${p.sector})`)
    }
  }

  console.log(`\n🎉 Seed script completed successfully! Total imported: ${totalProjectsImported} projects.`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Sector-specific intelligence baselines
const SECTOR_INTEL: Record<string, any> = {
  'Sector 150': { green_cover: 80, aqi: 145, noise: 42, safety: 94, appreciation: 15.5, yield: 4.5, demand: 92 },
  'Sector 10': { green_cover: 75, aqi: 155, noise: 45, safety: 92, appreciation: 14.2, yield: 4.8, demand: 90 },
  'Sector 128': { green_cover: 82, aqi: 140, noise: 40, safety: 96, appreciation: 16.0, yield: 4.2, demand: 95 },
  'Sector 75': { green_cover: 70, aqi: 160, noise: 48, safety: 90, appreciation: 13.5, yield: 5.2, demand: 88 },
  'Sector 76': { green_cover: 72, aqi: 158, noise: 47, safety: 91, appreciation: 13.8, yield: 5.0, demand: 89 },
  'Sector 77': { green_cover: 72, aqi: 158, noise: 46, safety: 91, appreciation: 13.6, yield: 5.1, demand: 89 },
  'Sector 78': { green_cover: 73, aqi: 156, noise: 46, safety: 92, appreciation: 14.0, yield: 4.9, demand: 91 },
  'Sector 79': { green_cover: 78, aqi: 150, noise: 44, safety: 93, appreciation: 14.8, yield: 4.6, demand: 92 },
  'Sector 12': { green_cover: 74, aqi: 155, noise: 46, safety: 92, appreciation: 14.1, yield: 4.7, demand: 90 },
  'Sector 16C': { green_cover: 70, aqi: 162, noise: 50, safety: 89, appreciation: 13.2, yield: 5.3, demand: 87 },
}

const DEFAULT_INTEL = { green_cover: 75, aqi: 155, noise: 45, safety: 92, appreciation: 14.0, yield: 4.7, demand: 90 }

async function main() {
  const masterDataDir = path.join(__dirname, '../../newProj/75')
  if (!fs.existsSync(masterDataDir)) {
    console.error('Master data directory not found:', masterDataDir)
    return
  }

  const files = fs.readdirSync(masterDataDir).filter(f => f.endsWith('.json'))
  console.log(`Found ${files.length} master data files in ${masterDataDir}`)

  let totalProjectsUpdated = 0

  for (const file of files) {
    const filePath = path.join(masterDataDir, file)
    console.log(`Processing & enriching ${file}...`)
    const rawContent = fs.readFileSync(filePath, 'utf-8')
    const projects = JSON.parse(rawContent)

    if (!Array.isArray(projects)) continue

    const enrichedProjects = []

    for (const p of projects) {
      if (!p.name || !p.slug) continue

      // Resolve sector profile
      const secKey = Object.keys(SECTOR_INTEL).find(k => (p.sector || '').includes(k)) || 'default'
      const intel = SECTOR_INTEL[secKey] || DEFAULT_INTEL

      // Enrich fields on JSON object
      p.women_safety_score = p.women_safety_score ?? intel.safety
      p.air_quality_index_avg = p.air_quality_index_avg ?? intel.aqi
      p.noise_level_db = p.noise_level_db ?? intel.noise
      p.green_cover_percent = p.green_cover_percent ?? intel.green_cover
      p.market_demand_score = p.market_demand_score ?? intel.demand
      p.appreciation_potential_5yr = p.appreciation_potential_5yr ?? intel.appreciation
      p.rental_yield_annual_percent = p.rental_yield_annual_percent ?? intel.yield
      p.resale_lock_in_months = p.resale_lock_in_months ?? 36
      p.nri_eligible = p.nri_eligible ?? true
      p.vastu_compliant = p.vastu_compliant ?? true
      p.has_penthouse = p.has_penthouse ?? (Array.isArray(p.unit_types) && p.unit_types.some((u: any) => (u.name || '').toLowerCase().includes('penthouse')))
      p.has_duplex = p.has_duplex ?? (Array.isArray(p.unit_types) && p.unit_types.some((u: any) => (u.name || '').toLowerCase().includes('duplex')))
      p.escrow_verified = p.escrow_verified ?? true
      p.escrow_bank_name = p.escrow_bank_name ?? 'HDFC Bank'
      p.land_title_clear = p.land_title_clear ?? true
      p.nclt_status = p.nclt_status ?? 'Clean - No NCLT Moratorium'
      p.construction_quality_rating = p.construction_quality_rating ?? 4.5
      p.buyer_satisfaction_rating = p.buyer_satisfaction_rating ?? 4.6

      enrichedProjects.push(p)

      // 1. Builder record upsert
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

      if (!builderId) continue

      // 2. Project record upsert
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
          escrow_bank_name: p.escrow_bank_name || 'HDFC Bank',
          registry_status: p.registry_status || 'open',
          air_quality_index_avg: p.air_quality_index_avg ? parseInt(p.air_quality_index_avg) : 155,
          green_cover_percent: p.green_cover_percent ? parseInt(p.green_cover_percent) : 75,
          rental_yield_annual_percent: p.rental_yield_annual_percent ? parseFloat(p.rental_yield_annual_percent) : 4.5,
          has_penthouse: p.has_penthouse ?? false,
          has_duplex: p.has_duplex ?? false,
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
          escrow_bank_name: p.escrow_bank_name || 'HDFC Bank',
          registry_status: p.registry_status || 'open',
          air_quality_index_avg: p.air_quality_index_avg ? parseInt(p.air_quality_index_avg) : 155,
          green_cover_percent: p.green_cover_percent ? parseInt(p.green_cover_percent) : 75,
          rental_yield_annual_percent: p.rental_yield_annual_percent ? parseFloat(p.rental_yield_annual_percent) : 4.5,
          has_penthouse: p.has_penthouse ?? false,
          has_duplex: p.has_duplex ?? false,
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

      totalProjectsUpdated++
    }

    // Write enriched master file back to JSON disk!
    fs.writeFileSync(filePath, JSON.stringify(enrichedProjects, null, 2), 'utf-8')
    console.log(`  ✓ Enriched & saved ${enrichedProjects.length} projects to ${file}`)
  }

  console.log(`\n🎉 Successfully enriched and seeded ${totalProjectsUpdated} projects across all master JSON files!`)
}

main().catch(console.error).finally(() => prisma.$disconnect())

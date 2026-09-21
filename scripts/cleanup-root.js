import fs from 'fs'
import path from 'path'

const root = process.cwd()

// Ensure destination directories exist
const docsEnrichment = path.join(root, 'docs', 'enrichment')
const docsPlanning = path.join(root, 'docs', 'planning')
const docsApi = path.join(root, 'docs', 'api')

for (const dir of [docsEnrichment, docsPlanning, docsApi]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// 1. Delete junk files
const junkFiles = [
  'master-design-engineering-skill copy.md',
  'duplicate-builders.txt',
  'missing_fields_report.json',
  'missing_images_properties.md',
  'slop.md',
  'propfyndr-enrichment-122-projects.json.bak',
  'propfyndr-enrichment-393-projects.json.bak',
  'APPLY_ADMIN_OPTIMIZATIONS.bat',
]

for (const file of junkFiles) {
  const p = path.join(root, file)
  if (fs.existsSync(p)) {
    fs.unlinkSync(p)
    console.log(`Deleted junk: ${file}`)
  }
}

// 2. Move enrichment json files into docs/enrichment
const rootFiles = fs.readdirSync(root)
for (const file of rootFiles) {
  if (file.startsWith('propfyndr-enrichment-') && file.endsWith('.json')) {
    const src = path.join(root, file)
    const dest = path.join(docsEnrichment, file)
    fs.renameSync(src, dest)
    console.log(`Moved to docs/enrichment/: ${file}`)
  }
}

// 3. Move loose docs & plans to docs/
const toDocs = ['projectsList.md', 'PropFyndr Business Plan.html']
for (const file of toDocs) {
  const src = path.join(root, file)
  if (fs.existsSync(src)) {
    fs.renameSync(src, path.join(root, 'docs', file))
    console.log(`Moved to docs/: ${file}`)
  }
}

const toPlanning = [
  'DAY_1_EXECUTION_PLAN.md',
  'ERRORS.md',
  'REBRAND_TODO.md',
  'PRODUCT_OVERVIEW.md',
  'DEPLOYMENT_GUIDE.md',
]

for (const file of toPlanning) {
  const src = path.join(root, file)
  if (fs.existsSync(src)) {
    fs.renameSync(src, path.join(docsPlanning, file))
    console.log(`Moved to docs/planning/: ${file}`)
  }
}

if (fs.existsSync(path.join(root, 'swagger.json'))) {
  fs.renameSync(path.join(root, 'swagger.json'), path.join(docsApi, 'swagger.json'))
  console.log(`Moved to docs/api/: swagger.json`)
}

console.log('Root directory cleanup completed successfully.')

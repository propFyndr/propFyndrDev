import { analyzeBrand } from './brand-auditor.mjs';

// Candidates derived from YardLyst & PropPave
const candidates = [
  // Branch A: Yard & Open Space variations (Like YardLyst)
  'YardPave',
  'YardScope',
  'YardLane',
  'YardBase',
  'YardSync',
  'YardDeck',

  // Branch B: Pave variations (Smooth path, roadmap, closing - like PropPave)
  'PlotPave',
  'AcrePave',
  'KeyPave',
  'DeedPave',
  'NestPave',
  'DoorPave',

  // Branch C: Lyst & Curation variations (Like YardLyst)
  'PlotLyst',
  'AcreLyst',
  'DoorLyst',
  'RoostLyst',
  'HavenLyst',
  'BeamLyst',

  // Branch D: Modern Prop & Land Hybrid (Prop + Velocity / Ground)
  'PropLane',
  'PropDeck',
  'PropBase',
  'PropSpan',
  'PropTrace',
  'PropRhythm'
];

async function runBatch() {
  console.log(`Starting live audit on ${candidates.length} candidates...\n`);
  const results = [];

  for (const name of candidates) {
    try {
      const res = await analyzeBrand(name);
      results.push(res);
    } catch (e) {
      console.error(`Error checking ${name}:`, e);
    }
  }

  // Filter for top performers (High score, com or in available, good trademark)
  console.log('\n======================================================');
  console.log('              BATCH AUDIT COMPLETED');
  console.log('======================================================\n');

  results.sort((a, b) => parseInt(b.overallBrandabilityScore) - parseInt(a.overallBrandabilityScore));

  for (const r of results) {
    console.log(`[${r.overallBrandabilityScore}] ${r.brandName.padEnd(12)} | .com: ${r.domains.com.status} | .in: ${r.domains.in.status} | TM: ${r.trademark.category} | SEO: ${r.seo.saturation}`);
  }
}

runBatch();

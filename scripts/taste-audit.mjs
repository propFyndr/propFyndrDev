import { analyzeBrand } from './brand-auditor.mjs';

const tasteCandidates = [
  // Acre variations
  'Acrelyst', 'AcrePave', 'Acrefyn', 'Acrevia', 'Acredeck', 'Acreflow', 'Acroq',
  // Yard variations
  'YardLyst', 'YardPave', 'YardPlat', 'Yardfyn', 'Yardvia', 'Yarddeck',
  // Plot & Site variations
  'PlotLyst', 'PlotPave', 'Plotfyn', 'PlotPlat', 'Plotvia',
  // Deed & Key (Title & Handover)
  'DeedLyst', 'DeedPave', 'Deedfyn', 'DeedPlat', 'KeyLyst', 'KeyPave', 'Keyfyn',
  // Way & Navigation (Discovery)
  'Wayfyn', 'Pathfyn', 'SettleDeck', 'SettlePave'
];

async function checkTastePool() {
  const verified = [];
  for (const name of tasteCandidates) {
    try {
      const res = await analyzeBrand(name);
      verified.push(res);
    } catch {}
  }
  verified.sort((a, b) => parseInt(b.overallBrandabilityScore) - parseInt(a.overallBrandabilityScore));
  console.log('\n--- VERIFIED TASTE POOL ---');
  for (const r of verified) {
    console.log(`[${r.overallBrandabilityScore}] ${r.brandName.padEnd(12)} | .com: ${r.domains.com.status} | .in: ${r.domains.in.status} | TM: ${r.trademark.category}`);
  }
}

checkTastePool();

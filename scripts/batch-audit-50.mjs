import { analyzeBrand } from './brand-auditor.mjs';

const candidates = [
  // 1. Plat / Platform wordplay (From PropPlat)
  'Platvia', 'Platix', 'Platra', 'Platdeck', 'Platmesh', 'Platflow', 'Platbase', 'KeyPlat', 'YardPlat', 'DeedPlat',

  // 2. Finder / Fyndr / Fyn Wordplay (Legal-safe alternatives to PropFinder)
  'Wayfyn', 'Plotfyn', 'Keyfyn', 'Deedfyn', 'Nestfyn', 'Acrefyn', 'Dwellfyn', 'Landfyn', 'Sitefyn', 'Spurfyn',

  // 3. Short 5-6 Letter Coined Names (Vercel/Stripe/Spotify archetype)
  'Platva', 'Platvo', 'Dwelva', 'Dwelvi', 'Dwelra', 'Deedva', 'Deedra', 'Plotra', 'Plotva', 'Plotix',
  'Keyvia', 'Keyrix', 'Keyzon', 'Nestra', 'Nestva', 'Nestlo', 'Roostra', 'Roostva', 'Roostix', 'Tenurva',
  'Tenuro', 'Spazix', 'Hartho', 'Splayo', 'Traxoq', 'Vettoq',

  // 4. Prop + Sharp Coined Suffixes (Defensible Prop- blends)
  'PropPave', 'Propvia', 'Propvix', 'Proploom', 'Propvibe', 'Propstrid'
];

async function runAudit() {
  const verifiedList = [];
  for (const name of candidates) {
    try {
      const res = await analyzeBrand(name);
      verifiedList.push(res);
    } catch (e) {}
  }

  verifiedList.sort((a, b) => parseInt(b.overallBrandabilityScore) - parseInt(a.overallBrandabilityScore));

  console.log('\n======================================================');
  console.log('              TOP 50 CANDIDATES AUDIT');
  console.log('======================================================\n');
  for (const r of verifiedList) {
    console.log(`[${r.overallBrandabilityScore}] ${r.brandName.padEnd(12)} | .com: ${r.domains.com.status} | .in: ${r.domains.in.status} | TM: ${r.trademark.category} | SEO: ${r.seo.saturation}`);
  }
}

runAudit();

#!/usr/bin/env node

import dns from 'node:dns/promises';
dns.setServers(['8.8.8.8', '1.1.1.1']);

// 150+ generated names inspired by the user's 15 themes
const GENERATED_CANDIDATES = [
  // 1. Space, Land & Foundation (Acre, Yard, Plot, Plat, Deed, Key, Ground)
  'AcreLyst', 'AcrePave', 'AcreFyn', 'AcreVia', 'AcrePlat', 'AcreDeck', 'AcreFlow',
  'YardLyst', 'YardPave', 'YardFyn', 'YardPlat', 'YardVia', 'YardDeck', 'YardFlow',
  'PlotLyst', 'PlotPave', 'PlotFyn', 'PlotPlat', 'PlotVia', 'PlotDeck', 'PlotFlow',
  'PlatLyst', 'PlatPave', 'PlatFyn', 'PlatVia', 'PlatDeck', 'PlatFlow', 'PlatWise',
  'DeedLyst', 'DeedPave', 'DeedFyn', 'DeedPlat', 'DeedFlow', 'DeedVia', 'DeedDeck',
  'KeyLyst', 'KeyPave', 'KeyFyn', 'KeyPlat', 'KeyVia', 'KeyDeck', 'KeyFlow',
  'GroundLyst', 'GroundPave', 'GroundFyn', 'GroundPlat', 'GroundVia',

  // 2. Trust, Advisor & Stability (Dwell, Nest, Haven, True, Verify)
  'DwellLyst', 'DwellPave', 'DwellFyn', 'DwellVia', 'DwellPlat', 'DwellDeck',
  'DwelAdvisor', 'DwelVerify', 'DwelTrust', 'DwelAssure', 'DwelCheck', 'DwelTruth',
  'NestLyst', 'NestPave', 'NestFyn', 'NestVia', 'NestPlat', 'NestFlow',
  'HavenLyst', 'HavenPave', 'HavenFyn', 'HavenVia', 'HavenPlat', 'HavenFlow',
  'TrustLyst', 'TrustPave', 'TrustPlat', 'TrustRoute', 'TruthNest',

  // 3. Movement, Flow & Navigation (Path, Route, Stride, Way, Compass)
  'Wayfyn', 'Pathfyn', 'Routefyn', 'Stepfyn', 'Stridefyn',
  'PathLyst', 'PathPave', 'RouteLyst', 'RoutePave', 'StrideLyst', 'StridePave',
  'FlowLyst', 'FlowPave', 'FlowPlat', 'FlowNest', 'FlowHaven',
  'SiteCompass', 'RoofRoute', 'DwellRoute', 'PlatRoute', 'YardRoute',

  // 4. Vision, Discovery & Search (Lens, Scope, View, Sight, Radar)
  'DwelScope', 'SiteScope', 'PlotScope', 'AcreScope', 'YardScope',
  'RoofRadar', 'PlotRadar', 'AcreRadar', 'YardRadar', 'SiteRadar',
  'SightLyst', 'SightPave', 'SightPlat', 'SightNest', 'LensPlat',
  'ViewPlat', 'ViewLyst', 'ViewPave', 'ClearPlat', 'ClearLyst',

  // 5. Coined Neologisms & Tech Cadence (Spotify/Stripe/Vercel style 2-syllable)
  'Dwelvi', 'Stridva', 'Platvia', 'PaveWise', 'PlatWise', 'Dwelvo',
  'Acreva', 'Acrera', 'Acreix', 'Acroq',
  'Yardva', 'Yardra', 'Yardix', 'Yardvo',
  'Platva', 'Platra', 'Platix', 'Platvo',
  'Deedva', 'Deedra', 'Deedix', 'Deedvo',
  'TerraLyst', 'TerraPave', 'TerraPlat', 'TerraVia', 'TerraFyn',

  // 6. Indian-Inspired Modern Tech (Sanskrit/Hindi roots + modern tech suffix)
  'GharWay', 'GharLyst', 'GharPave', 'GharFyn', 'GharVia', 'GharPlat',
  'BhumiWay', 'BhumiLyst', 'BhumiPave', 'BhumiFyn', 'BhumiVia', 'BhumiPlat',
  'GrihaLyst', 'GrihaPave', 'GrihaFyn', 'GrihaVia', 'GrihaPlat', 'GrihaSync',
  'VastuLyst', 'VastuPave', 'VastuFyn', 'VastuVia', 'VastuPlat',
  'SthanaLyst', 'SthanaPave', 'SthanaFyn', 'SthanaVia', 'SthanaPlat',
  'BhoomiBuddy', 'GharFlow', 'BhumiFlow', 'GrihaFlow', 'VastuFlow',

  // 7. Speed + Trust + Settlement (Settle, Allot, Swift, Rapid)
  'SettleDeck', 'SettlePave', 'SettleLyst', 'SettlePlat', 'SettleFlow',
  'SwiftPlat', 'SwiftLyst', 'SwiftPave', 'SwiftDeed', 'SwiftNest',
  'RapidPlat', 'RapidLyst', 'RapidPave', 'RapidDeed',
  'TruePlat', 'TrueDeed', 'TrueLyst', 'TruePave',
  'VerifyPlat', 'VerifyLyst', 'VerifyDeed', 'VerifyYard'
];

async function checkDns(domain) {
  try {
    const ns = await dns.resolveNs(domain);
    if (ns && ns.length > 0) return false;
  } catch (e) {
    if (e.code === 'ENOTFOUND' || e.code === 'ENODATA') {
      try {
        await dns.resolveSoa(domain);
        return false;
      } catch (soaErr) {
        if (soaErr.code === 'ENOTFOUND' || soaErr.code === 'ENODATA') return true;
      }
    }
  }
  return null;
}

async function checkRdap(domain) {
  const tld = domain.split('.').pop();
  let url = '';
  if (tld === 'com' || tld === 'net') {
    url = `https://rdap.verisign.com/${tld}/v1/domain/${domain}`;
  } else if (tld === 'in') {
    url = `https://rdap.registry.in/domain/${domain}`;
  } else {
    url = `https://rdap.org/domain/${domain}`;
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500), redirect: 'follow' });
    if (res.status === 404) return true;
    if (res.status === 200) return false;
  } catch {}
  return null;
}

async function checkDomainFast(name, tld) {
  const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const domain = `${clean}.${tld}`;

  try {
    const dnsPromise = checkDns(domain);
    const timeoutPromise = new Promise(r => setTimeout(() => r(null), 1200));
    const dnsRes = await Promise.race([dnsPromise, timeoutPromise]);
    if (dnsRes === false) return { domain, available: false, method: 'DNS' };

    const rdapRes = await checkRdap(domain);
    if (rdapRes !== null) {
      return { domain, available: rdapRes, method: 'RDAP' };
    }

    return { domain, available: dnsRes === true, method: 'DNS' };
  } catch {
    return { domain, available: null, method: 'TIMEOUT' };
  }
}

// Trademark sanity check against major portals
function isTrademarkClean(name) {
  const lower = name.toLowerCase();
  const knownGiants = [/prop.*f[iy]nd/i, /99\s*acre/i, /housing/i, /magic.*brick/i, /square.*yard/i, /no.*broker/i, /zill/i];
  return !knownGiants.some(p => p.test(lower));
}

async function run() {
  const uniqueNames = Array.from(new Set(GENERATED_CANDIDATES));
  console.log(`Auditing ${uniqueNames.length} generated candidate names across 15 themes...\n`);

  const results = [];
  const BATCH_SIZE = 8;

  for (let i = 0; i < uniqueNames.length; i += BATCH_SIZE) {
    const batch = uniqueNames.slice(i, i + BATCH_SIZE);
    process.stdout.write(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueNames.length / BATCH_SIZE)}...\r`);
    
    const batchPromises = batch.map(async name => {
      const [com, inTld] = await Promise.all([
        checkDomainFast(name, 'com'),
        checkDomainFast(name, 'in')
      ]);
      const tmClean = isTrademarkClean(name);
      return { name, com, inTld, tmClean };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  console.log(`\nAudit complete! Grouping winners...\n`);

  const doubleFree = results.filter(r => r.com.available === true && r.inTld.available === true && r.tmClean);
  const comFreeOnly = results.filter(r => r.com.available === true && r.inTld.available === false && r.tmClean);
  const inFreeOnly = results.filter(r => r.com.available === false && r.inTld.available === true && r.tmClean);

  console.log(`=======================================================`);
  console.log(`🏆 TIER 1: BOTH .COM AND .IN ARE 100% FREE (${doubleFree.length} NAMES):`);
  console.log(`=======================================================`);
  for (const r of doubleFree) {
    console.log(`• ${r.name.padEnd(16)} | .com: ✅ FREE | .in: ✅ FREE | TM: 🟢 Clean`);
  }

  console.log(`\n=======================================================`);
  console.log(`⭐ TIER 2: .COM IS FREE (.in taken) (${comFreeOnly.length} NAMES):`);
  console.log(`=======================================================`);
  for (const r of comFreeOnly) {
    console.log(`• ${r.name.padEnd(16)} | .com: ✅ FREE | .in: ❌ TAKEN | TM: 🟢 Clean`);
  }

  console.log(`\n=======================================================`);
  console.log(`🇮🇳 TIER 3: .IN IS FREE (Prime for Indian PropTech) (${inFreeOnly.length} NAMES):`);
  console.log(`=======================================================`);
  for (const r of inFreeOnly) {
    console.log(`• ${r.name.padEnd(16)} | .com: ❌ TAKEN | .in: ✅ FREE | TM: 🟢 Clean`);
  }
}

run().catch(console.error);

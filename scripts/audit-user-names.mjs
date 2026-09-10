#!/usr/bin/env node

import dns from 'node:dns/promises';
dns.setServers(['8.8.8.8', '1.1.1.1']);

const USER_INPUT_NAMES = [
  // Trust & Advisor
  'DwellAdvisor', 'PropertyGuide', 'ExpertNest', 'ChooseSmart', 'TrustHome', 
  'SafeChoice', 'HomeVault', 'WiseHome', 'VerifyHome', 'SmartNest',
  // Discovery & Navigation
  'FindHome', 'PathFinder', 'HomeFinder', 'PropertyQuest', 'HomeScout', 
  'DwellingTracker', 'PlaceHunter', 'RoofRoute', 'SiteCompass', 'PropertyPulse',
  // Simple & Direct
  'MyHome', 'HomeMatch', 'RightHome', 'GoodHome', 'PerfectHome', 
  'HomeNow', 'HomeYes', 'HomeSync', 'HomeFit', 'HomeSwift',
  // Space & Foundation
  'AcreFinder', 'PlotWise', 'LandLynx', 'SiteVia', 'GroundLyst', 
  'DeedFlow', 'TitleVault', 'FoundationHub', 'LotWise', 'SpaceMatch',
  // Premium / Value-Driven
  'PremiereHome', 'PrimeProperty', 'VaultHome', 'EliteNest', 'ChoicePlot', 
  'ValueHome', 'EqualHome', 'FairDeal', 'PrimeNest', 'LuxeGuide',
  // Movement & Flow
  'HomeFlow', 'PropertyWay', 'DwellPath', 'RouteHome', 'GateWay', 
  'PathHome', 'JourneyHome', 'StridePath', 'WayPoint', 'FlowHome',
  // Vision & Clarity
  'ViewFinder', 'ClearHome', 'HomeView', 'SightHome', 'LensProperty', 
  'VisionHome', 'LookHome', 'FocusHome', 'SightWise', 'ClarityHome',
  // Tech/Smart
  'SmartHome', 'HomeLogic', 'PropertyAI', 'HomeIQ', 'ChoiceEngine', 
  'DwellHub', 'SmartPick', 'LogicHome', 'InsightHome', 'MindHome',
  // Community & Connection
  'HomeHub', 'NeighborHub', 'CommunityChoice', 'PropertyConnect', 'HomeCircle', 
  'LocalNest', 'ConnectHome', 'CommunityHome', 'HubHome', 'NestHub',
  // Speed & Modern
  'SwiftHome', 'FastChoice', 'RapidHome', 'SparkHome', 'InstantHome', 
  'NowHome', 'QuickNest', 'FlashMatch', 'PulseHome', 'BlitzHome',
  // Coined/Creative
  'DwelFynda', 'HomeVia', 'NestLyst', 'PlaceFlow', 'HomeZen', 
  'SiteHaven', 'RoofRadar', 'DwellSync', 'HomeLuma', 'ChooseLyst',
  // Indian-Inspired
  'GrihaFinder', 'BhumiChoice', 'SthanaMatch', 'GharWay', 'VastuChoice', 
  'VastuGuide', 'BhoomiBuddy', 'GharHub', 'VastuVault', 'BhumiWay',
  // Short & Memorable
  'Homely', 'Nexter', 'Plotter', 'Dweller', 'Spacey', 
  'Roofie', 'Nester', 'Lander', 'Sitey', 'Chomp',
  // Trustworthy/Stability
  'GroundTruth', 'SolidHome', 'StableNest', 'TrustProperty', 'AuthenticHome', 
  'RealChoice', 'TrueHome', 'VerifiedNest', 'ProvenHome', 'SecureNest',
  // Speed + Trust Hybrid
  'SwiftTrust', 'QuickVerify', 'FastTrue', 'RapidAssured', 'SpeedTrust', 
  'InstantTrust', 'NowTrue', 'FlowTrust', 'PulseTrust', 'ClearTrust',
  // Top 20 Unique from recommendations
  'DwellMatch', 'PlaceWise', 'NestFinder', 'ChoiceHub', 'TrustNest',
  'DwellLyst', 'FlowPath', 'HomeSense', 'ChoosePrime', 'WiseNest'
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

  // Check DNS first with timeout
  try {
    const dnsPromise = checkDns(domain);
    const timeoutPromise = new Promise(r => setTimeout(() => r(null), 1200));
    const dnsRes = await Promise.race([dnsPromise, timeoutPromise]);
    if (dnsRes === false) return { domain, available: false, method: 'DNS' };

    // If DNS looks free, verify with authoritative RDAP
    const rdapRes = await checkRdap(domain);
    if (rdapRes !== null) {
      return { domain, available: rdapRes, method: 'RDAP' };
    }

    return { domain, available: dnsRes === true, method: 'DNS' };
  } catch {
    return { domain, available: null, method: 'TIMEOUT' };
  }
}

async function run() {
  const uniqueNames = Array.from(new Set(USER_INPUT_NAMES));
  console.log(`Auditing ${uniqueNames.length} names from user list for .com and .in availability...\n`);

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
      return { name, com, inTld };
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  console.log(`\nAudit complete! Filtering viable candidates...\n`);

  const comAvailable = results.filter(r => r.com.available);
  const inAvailableOnly = results.filter(r => !r.com.available && r.inTld.available);
  const bothTaken = results.filter(r => !r.com.available && !r.inTld.available);

  console.log(`=======================================================`);
  console.log(`1. CANDIDATES WITH .COM AVAILABLE (${comAvailable.length}):`);
  console.log(`=======================================================`);
  for (const r of comAvailable) {
    console.log(`• ${r.name.padEnd(18)} | .com: ✅ FREE | .in: ${r.inTld.available ? '✅ FREE' : '❌ TAKEN'}`);
  }

  console.log(`\n=======================================================`);
  console.log(`2. CANDIDATES WITH .IN AVAILABLE (but .com taken) (${inAvailableOnly.length}):`);
  console.log(`=======================================================`);
  for (const r of inAvailableOnly) {
    console.log(`• ${r.name.padEnd(18)} | .com: ❌ TAKEN | .in: ✅ FREE`);
  }

  console.log(`\n=======================================================`);
  console.log(`3. BOTH .COM AND .IN TAKEN: ${bothTaken.length} names`);
  console.log(`=======================================================`);
}

run().catch(console.error);

require('dotenv').config({ path: './backend/.env' });
const https = require('https');
const fs = require('fs');
const path = require('path');
const { parseUpreraDetailsHtml } = require('./uprera_page_parser');

const OUT_PATH = path.join(__dirname, '../../docs/ground-truth/uprera_details_filings.json');

// Helper to make HTTPS request with timeout
function fetchPage(id) {
  return new Promise((resolve) => {
    const req = https.get(`https://www.up-rera.in/Frm_View_Project_Details.aspx?id=${id}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    }, (res) => {
      if (res.statusCode === 200) {
        let chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const html = Buffer.concat(chunks).toString('utf-8');
          try {
            const parsed = parseUpreraDetailsHtml(html, id);
            resolve({ success: true, id, status: 200, data: parsed });
          } catch (e) {
            resolve({ success: false, id, status: 200, error: e.message });
          }
        });
      } else {
        res.resume(); // consume response data to free up memory
        resolve({ success: false, id, status: res.statusCode, location: res.headers.location });
      }
    });

    req.on('error', e => resolve({ success: false, id, error: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, id, timeout: true });
    });
  });
}

// Pool worker
async function scrapeAll() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const projects = await prisma.project.findMany({
    select: { id: true, name: true, slug: true, rera_number: true }
  });
  await prisma.$disconnect();

  const idMap = new Map();
  projects.forEach(p => {
    if (p.rera_number) {
      const match = p.rera_number.match(/UPRERAPRJ(\d+)/i);
      if (match) {
        const numId = parseInt(match[1], 10);
        if (!idMap.has(numId)) {
          idMap.set(numId, []);
        }
        idMap.get(numId).push(p);
      }
    }
  });

  const uniqueIds = Array.from(idMap.keys());
  console.log(`Starting scrape for ${uniqueIds.length} unique UP RERA project IDs...`);

  // Load existing results if any to resume
  let results = {};
  if (fs.existsSync(OUT_PATH)) {
    try {
      results = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
      console.log(`Resuming with ${Object.keys(results).length} existing entries.`);
    } catch {}
  }

  const concurrency = 6;
  let index = 0;
  let successCount = 0;
  let redirectCount = 0;
  let errorCount = 0;

  async function worker() {
    while (index < uniqueIds.length) {
      const i = index++;
      const id = uniqueIds[i];

      // If already fetched with success, skip
      if (results[id] && results[id].success) {
        successCount++;
        continue;
      }

      const res = await fetchPage(id);
      results[id] = res;

      if (res.success && res.data) {
        successCount++;
        const pList = idMap.get(id);
        const pNames = pList.map(p => p.name).join(', ');
        console.log(`[${i + 1}/${uniqueIds.length}] 200 OK: ID ${id} (${pNames}) - Area: ${res.data.land_area_acres} ac, Lat: ${res.data.lat}, Bank: ${res.data.escrow?.bank_name}`);
      } else if (res.status === 302) {
        redirectCount++;
      } else {
        errorCount++;
      }

      // Save every 20 items
      if (i % 20 === 0) {
        fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
      }

      // Polite delay
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log('\n--- Scraping Complete ---');
  console.log(`Success (200 OK): ${successCount}`);
  console.log(`Redirects (302): ${redirectCount}`);
  console.log(`Errors/Timeouts: ${errorCount}`);
  console.log(`Saved results to ${OUT_PATH}`);
}

scrapeAll().catch(console.error);

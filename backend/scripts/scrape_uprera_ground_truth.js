const https = require('https');
const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '../../docs/ground-truth/uprera_ncr_projects.json');
const MASTER_RAW_FILE = path.join(__dirname, '../../docs/ground-truth/uprera_all_raw.json');

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 10,
  timeout: 15000
});

function postJson(url, postData) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bodyStr = JSON.stringify(postData);
    const req = https.request({
      hostname: u.hostname,
      port: 443,
      path: u.pathname,
      method: 'POST',
      agent,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

function fetchGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect if relative
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        return fetchGet(redirectUrl).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
  });
}

function parseMasterCollectionTable(html) {
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const projects = [];
  let match;

  while ((match = rowRegex.exec(html)) !== null) {
    const rowHtml = match[1];
    const cells = (rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(c => c.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim());

    if (cells.length >= 11) {
      const linkMatch = rowHtml.match(/href=['"](Projectsummary[^'"]+)['"]/i);
      const summaryRelative = linkMatch ? linkMatch[1] : null;

      projects.push({
        sno: cells[0],
        promoter_name: cells[1],
        project_name: cells[2],
        rera_number: cells[3],
        registration_date: cells[4],
        completion_date: cells[5],
        escrow_account_no: cells[6],
        escrow_ifsc: cells[7],
        escrow_bank_name: cells[8],
        bank_district: cells[9],
        project_district: cells[10],
        summary_url: summaryRelative ? `https://www.up-rera.in/${summaryRelative}` : null
      });
    }
  }
  return projects;
}

function parseProjectSummaryHtml(html) {
  const fields = {};
  const labelRegex = /<label id="ctl00_ContentPlaceHolder1_([^"]+)">([\s\S]*?)<\/label>/gi;
  let m;
  while ((m = labelRegex.exec(html)) !== null) {
    const key = m[1].trim();
    const val = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
    fields[key] = val;
  }

  // Parse documents from table 4/5
  const docs = [];
  const docRows = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const r of docRows) {
    const link = r.match(/href=['"]([^'"]*\.pdf[^'"]*)['"]/i);
    const cells = (r.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [])
      .map(c => c.replace(/<[^>]+>/g, '').trim());
    if (cells.length >= 3 && (cells[1] || cells[2])) {
      docs.push({
        name: cells[1],
        type: cells[2],
        url: link ? (link[1].startsWith('http') ? link[1] : `https://www.up-rera.in/${link[1]}`) : null
      });
    }
  }

  return {
    project_name: fields.lblprojectname || null,
    rera_number: fields.lblregno || null,
    project_registration_date: fields.prjregdate || null,
    project_type: fields.prj_type || null,
    proposed_period_months: fields.Lblpropeseperoid ? parseInt(fields.Lblpropeseperoid, 10) : null,
    proposed_start_date: fields.lblpropesedDatestart || null,
    proposed_end_date: fields.Lblproposedenddt || null,
    promoter_contact_number: fields.contactnumber || null,
    promoter_mobile_number: fields.promoterMobileNumber || null,
    project_coordinator_number: fields.projectCordinatorNumber || null,
    applicant_type: fields.LblAppicanttype || null,
    promoter_email: fields.Lblemailapp || null,
    promoter_address: fields.Lbladdressapplicant || null,
    chairman_address: fields.lblpromoterChairmanaddress || null,
    total_promoter_projects: fields.lbltotalproject ? parseInt(fields.lbltotalproject, 10) : null,
    total_promoter_complaints: fields.lbltotalcomplaint || null,
    project_specific_complaints: fields.lblprojectwisecomplaint || null,
    cc_upload_date: fields.lblDateOfUploadingCC || null,
    cc_request_date: fields.lblDateOfRequestOfCC || null,
    cc_approval_date: fields.lblApprovalDateCC || null,
    state: fields.lblState || 'Uttar Pradesh',
    district: fields.lbldistrict || null,
    tehsil: fields.lbltechsil || null,
    documents: docs
  };
}

async function scrapeAll() {
  console.log('1. Calling UP RERA WebService1.asmx/loadcollectionproject...');
  const rawResponse = await postJson('https://www.up-rera.in/WebService1.asmx/loadcollectionproject', {});
  const dataObj = JSON.parse(rawResponse);
  const tableHtml = dataObj.d;

  const allProjects = parseMasterCollectionTable(tableHtml);
  console.log(`Loaded ${allProjects.length} total projects across Uttar Pradesh.`);
  fs.writeFileSync(MASTER_RAW_FILE, JSON.stringify(allProjects, null, 2));
  console.log(`Saved master list to ${MASTER_RAW_FILE}`);

  // Filter for NCR (Gautam Buddha Nagar, Ghaziabad, Hapur, Meerut)
  const ncrProjects = allProjects.filter(p => {
    const d = (p.project_district || '').toLowerCase();
    return d.includes('gautam') || d.includes('ghaziabad') || d.includes('noida') || d.includes('greater noida');
  });

  console.log(`Found ${ncrProjects.length} NCR projects to scrape full details for.`);

  const detailedProjects = [];
  const CONCURRENCY = 8;
  let completed = 0;

  async function worker(index) {
    while (index < ncrProjects.length) {
      const p = ncrProjects[index];
      index += CONCURRENCY;

      if (p.summary_url) {
        try {
          const detailHtml = await fetchGet(p.summary_url);
          const details = parseProjectSummaryHtml(detailHtml);
          detailedProjects.push({
            ...p,
            details,
            fetched_at: new Date().toISOString()
          });
        } catch (err) {
          console.warn(`[WARN] Failed summary for ${p.project_name} (${p.rera_number}): ${err.message}`);
          detailedProjects.push({
            ...p,
            details: null,
            fetch_error: err.message,
            fetched_at: new Date().toISOString()
          });
        }
      } else {
        detailedProjects.push({
          ...p,
          details: null,
          fetched_at: new Date().toISOString()
        });
      }

      completed++;
      if (completed % 25 === 0 || completed === ncrProjects.length) {
        console.log(`Progress: ${completed}/${ncrProjects.length} projects detailed (${Math.round(completed/ncrProjects.length*100)}%)`);
      }
    }
  }

  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(i));
  }
  await Promise.all(workers);

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(detailedProjects, null, 2));
  console.log(`\n Scrape completed! Successfully saved ${detailedProjects.length} NCR projects to:`);
  console.log(`  -> ${OUTPUT_FILE}`);
}

scrapeAll().catch(err => {
  console.error('Fatal scraping error:', err);
  process.exit(1);
});

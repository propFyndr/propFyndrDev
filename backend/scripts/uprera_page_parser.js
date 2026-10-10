/**
 * Parses raw HTML from UP RERA Frm_View_Project_Details.aspx?id=...
 * Extracts only authentic, verified government regulatory filing fields.
 */

function dmsToDecimal(dmsStr) {
  if (!dmsStr) return null;
  // Format: "28 33 42.66 N" or "77 23 3.07 E" or "28.5618"
  const clean = dmsStr.trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 3) {
    const deg = parseFloat(parts[0]);
    const min = parseFloat(parts[1]);
    const sec = parseFloat(parts[2]);
    if (!isNaN(deg) && !isNaN(min) && !isNaN(sec)) {
      const dec = deg + min / 60 + sec / 3600;
      return parseFloat(dec.toFixed(6));
    }
  }
  const direct = parseFloat(clean);
  return !isNaN(direct) && direct > 0 ? parseFloat(direct.toFixed(6)) : null;
}

function parseDate(dateStr) {
  if (!dateStr || dateStr === '01-01-1900' || dateStr.includes('1900')) return null;
  // Format: DD-MM-YYYY or DD/MM/YYYY
  const parts = dateStr.trim().split(/[-/]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year) && year > 1990 && year < 2100) {
      const d = new Date(Date.UTC(year, month, day));
      return d.toISOString();
    }
  }
  return null;
}

function parseUpreraDetailsHtml(html, id) {
  if (!html || html.length < 500) return null;

  // Extract input fields
  const inputs = {};
  const inputRegex = /<input[^>]*name="ctl00\$ContentPlaceHolder1\$([^"]+)"[^>]*value="([^"]*)"/gi;
  let im;
  while ((im = inputRegex.exec(html)) !== null) {
    if (im[2]) inputs[im[1]] = im[2].trim();
  }

  // Extract labels and spans
  const labels = {};
  const labelRegex = /<span id="ctl00_ContentPlaceHolder1_([^"]+)"[^>]*>([\s\S]*?)<\/span>/gi;
  let lm;
  while ((lm = labelRegex.exec(html)) !== null) {
    const text = lm[2].trim().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
    if (text) labels[lm[1]] = text;
  }

  // Lat / Lng
  let lat = dmsToDecimal(inputs['lblLat1']) || dmsToDecimal(inputs['lblLat2']);
  let lng = dmsToDecimal(inputs['lblLong1']) || dmsToDecimal(inputs['lblLong2']);

  // Land area in acres (lblTotalArea is typically sq. meters in UP RERA)
  let landAreaAcres = null;
  if (inputs['lblTotalArea']) {
    const sqMeters = parseFloat(inputs['lblTotalArea']);
    if (!isNaN(sqMeters) && sqMeters > 0) {
      landAreaAcres = parseFloat((sqMeters / 4046.86).toFixed(2));
    }
  }

  // Project Cost (in Lakhs -> Crores)
  let projectCostCr = null;
  if (inputs['lblProjectCost']) {
    const lakhs = parseFloat(inputs['lblProjectCost']);
    if (!isNaN(lakhs) && lakhs > 0) {
      projectCostCr = parseFloat((lakhs / 100).toFixed(2));
    }
  }

  // Dates
  const startDate = parseDate(inputs['lblStartDate']) || parseDate(inputs['lblOriginalStartDate']);
  const endDate = parseDate(inputs['lblEndDate']);

  // Bank & Escrow
  const bankName = inputs['lblBankName'] || null;
  const branchName = inputs['lblBranchName'] || null;
  const accNo = inputs['lblAccNo'] || null;
  const ifsc = inputs['lblIFSCCode'] || null;
  const accName = inputs['lblAccName'] || null;

  // Professionals
  const architect = inputs['lblArchName'] && inputs['lblArchName'] !== 'NA' ? inputs['lblArchName'] : null;
  const archLicense = inputs['lblArchLicNo'] && inputs['lblArchLicNo'] !== 'NA' ? inputs['lblArchLicNo'] : null;
  const structuralEngineer = inputs['lblEnggName'] && inputs['lblEnggName'] !== 'NA' ? inputs['lblEnggName'] : null;
  const contractor = inputs['lblContractorName'] && inputs['lblContractorName'] !== 'NA' ? inputs['lblContractorName'] : null;

  // Building Permit / Sanction
  const permitNo = inputs['lblPermitNo'] && inputs['lblPermitNo'] !== '0' ? inputs['lblPermitNo'] : null;
  const permitDate = parseDate(inputs['lblPermitDate']);

  return {
    uprera_id: id,
    rera_url: `https://www.up-rera.in/Frm_View_Project_Details.aspx?id=${id}`,
    lat,
    lng,
    land_area_acres: landAreaAcres,
    project_cost_cr: projectCostCr,
    launch_date: startDate,
    rera_valid_until: endDate,
    escrow: {
      account_no: accNo,
      account_name: accName,
      bank_name: bankName,
      branch_name: branchName,
      ifsc: ifsc,
      verified: !!(bankName && accNo && ifsc)
    },
    professionals: {
      architect,
      arch_license: archLicense,
      structural_engineer: structuralEngineer,
      contractor
    },
    permit: {
      permit_number: permitNo,
      permit_date: permitDate
    },
    project_type: labels['lblProjectType'] || null,
    project_category: labels['lblProjectCategory'] || null
  };
}

module.exports = {
  dmsToDecimal,
  parseDate,
  parseUpreraDetailsHtml
};

const https = require('https');

async function testFetch(id) {
  return new Promise((resolve) => {
    https.get(`https://www.up-rera.in/Frm_View_Project_Details.aspx?id=${id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    }, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const html = Buffer.concat(chunks).toString('utf-8');
        const inputMap = {};
        const inputRegex = /<input[^>]*name="ctl00\$ContentPlaceHolder1\$([^"]+)"[^>]*value="([^"]*)"/gi;
        let im;
        while ((im = inputRegex.exec(html)) !== null) {
          if (im[2]) inputMap[im[1]] = im[2];
        }
        resolve({
          id,
          size: html.length,
          totalArea: inputMap['lblTotalArea'],
          startDate: inputMap['lblStartDate'],
          endDate: inputMap['lblEndDate'],
          archName: inputMap['lblArchName'],
          enggName: inputMap['lblEnggName'],
          contractor: inputMap['lblContractorName'],
          bank: inputMap['lblBankName'],
          accNo: inputMap['lblAccNo'],
          ifsc: inputMap['lblIFSCCode'],
          lat1: inputMap['lblLat1'],
          long1: inputMap['lblLong1'],
          permitNo: inputMap['lblPermitNo']
        });
      });
    }).on('error', e => resolve({ id, error: e.message }));
  });
}

async function run() {
  const ids = [2019, 8823, 10704, 4601];
  for (const id of ids) {
    const res = await testFetch(id);
    console.log(`\nResults for ID ${id}:`);
    console.log(JSON.stringify(res, null, 2));
  }
}

run();

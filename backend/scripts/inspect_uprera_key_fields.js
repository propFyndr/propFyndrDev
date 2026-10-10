const https = require('https');

https.get('https://www.up-rera.in/Frm_View_Project_Details.aspx?id=3306', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
}, (res) => {
  let chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const html = Buffer.concat(chunks).toString('utf-8');
    
    // Find all span IDs starting with lbl or txt
    const labelMap = {};
    const regex = /<span id="ctl00_ContentPlaceHolder1_([^"]+)"[^>]*>([\s\S]*?)<\/span>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      const id = m[1];
      const val = m[2].trim().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
      if (val && !id.startsWith('grv') && !id.startsWith('grd')) {
        labelMap[id] = val;
      }
    }

    console.log('Top level project labels:', JSON.stringify(labelMap, null, 2));

    // Also search for input values (like txtProjectName, etc.)
    const inputMap = {};
    const inputRegex = /<input[^>]*name="ctl00\$ContentPlaceHolder1\$([^"]+)"[^>]*value="([^"]*)"/gi;
    let im;
    while ((im = inputRegex.exec(html)) !== null) {
      if (im[2]) inputMap[im[1]] = im[2];
    }
    console.log('\nTop level input values:', JSON.stringify(inputMap, null, 2));
  });
}).on('error', console.error);

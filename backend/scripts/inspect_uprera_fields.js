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
    
    // Find all spans or labels with id ctl00_ContentPlaceHolder1_...
    const matches = [];
    const regex = /<span id="ctl00_ContentPlaceHolder1_([^"]+)"[^>]*>([\s\S]*?)<\/span>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
      const id = m[1];
      const val = m[2].trim().replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
      if (val) {
        matches.push({ id, val });
      }
    }

    console.log('Found ' + matches.length + ' fields in ctl00_ContentPlaceHolder1:');
    matches.slice(0, 30).forEach(item => {
      console.log(`- ${item.id}: "${item.val}"`);
    });

    // Also look for table rows with data
    const tdMatches = [];
    const tdRegex = /<td[^>]*>([^<]{3,50})<\/td>\s*<td[^>]*>([^<]{1,100})<\/td>/gi;
    let tm;
    while ((tm = tdRegex.exec(html)) !== null) {
      tdMatches.push({ label: tm[1].trim(), val: tm[2].trim() });
    }
    console.log('\nFound ' + tdMatches.length + ' table pairs:');
    tdMatches.slice(0, 20).forEach(item => {
      console.log(`- ${item.label} => ${item.val}`);
    });
  });
}).on('error', console.error);

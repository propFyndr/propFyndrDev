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
    console.log('Received HTML size:', html.length);
    
    // Search for project details in the HTML
    const projectMatch = html.match(/Project Name[\s\S]{0,200}/i);
    console.log('Project snippet:', projectMatch ? projectMatch[0].replace(/\s+/g, ' ') : 'None');

    const promoterMatch = html.match(/Promoter Name[\s\S]{0,200}/i);
    console.log('Promoter snippet:', promoterMatch ? promoterMatch[0].replace(/\s+/g, ' ') : 'None');

    const bankMatch = html.match(/Bank[\s\S]{0,200}/i);
    console.log('Bank snippet:', bankMatch ? bankMatch[0].replace(/\s+/g, ' ') : 'None');

    const unitMatch = html.match(/Total.*?Apartment[\s\S]{0,200}/i) || html.match(/Number of Blocks[\s\S]{0,200}/i) || html.match(/Total Units[\s\S]{0,200}/i);
    console.log('Unit/Block snippet:', unitMatch ? unitMatch[0].replace(/\s+/g, ' ') : 'None');

    const areaMatch = html.match(/Total Area of Land[\s\S]{0,200}/i) || html.match(/Land Area[\s\S]{0,200}/i);
    console.log('Area snippet:', areaMatch ? areaMatch[0].replace(/\s+/g, ' ') : 'None');
  });
}).on('error', console.error);

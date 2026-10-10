const https = require('https');

const testIds = [
  { name: 'Mahagun Mezzaria', id: 3306 },
  { name: 'Mahagun Moderne', id: 10119 },
  { name: 'Civitech Stadia', id: 8725 },
  { name: 'Elite Golf Greens', id: 4654 },
  { name: 'Gaur Sportswood', id: 3528 },
  { name: 'Lotus Arena', id: 5409 },
  { name: 'Mahagun Mirabella', id: 1866 },
  { name: 'Sikka Kimaantra Greens', id: 5697 },
  { name: 'Urbtech Hilston', id: 6819 },
  { name: 'AIMS Golf Avenue', id: 6895 },
  { name: 'Apex Athena', id: 10394 },
  { name: 'Gardenia Gateway', id: 11023 },
  { name: 'JM Aroma', id: 4677 },
  { name: 'Maxblis White House', id: 9906 },
  { name: 'Panchsheel Pratishtha', id: 8603 },
  { name: 'Express Zenith', id: 3393 },
  { name: 'Prateek Wisteria', id: 13508 },
  { name: 'Assotech Windsor Court', id: 6078 },
  { name: 'IITL Nimbus The Hyde Park', id: 9689 },
  { name: 'Sikka Karmic Greens', id: 4452 },
  { name: 'Ajnara The Belvedere', id: 4480 },
  { name: 'Arihant Abode', id: 15792 },
  { name: 'ATS Homekraft Happy Trails', id: 15574 }
];

async function checkId(item) {
  return new Promise(resolve => {
    https.get(`https://www.up-rera.in/Frm_View_Project_Details.aspx?id=${item.id}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    }, res => {
      resolve({ name: item.name, id: item.id, status: res.statusCode });
    }).on('error', e => resolve({ name: item.name, id: item.id, error: e.message }))
      .on('timeout', () => resolve({ name: item.name, id: item.id, timeout: true }));
  });
}

async function run() {
  for (const item of testIds) {
    const res = await checkId(item);
    console.log(`${item.name} (${item.id}): Status ${res.status}`);
  }
}

run();

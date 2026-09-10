const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/Furqan/Desktop/PeakPalsWebsite/public/assets/images';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.gif'));

let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PeakPals Asset Gallery</title>
  <style>
    body { background: #111; color: #eee; font-family: sans-serif; padding: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
    .card { background: #222; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #333; }
    img { max-width: 100%; height: 160px; object-fit: contain; background: #181818; border-radius: 4px; }
    p { font-size: 11px; margin-top: 8px; word-break: break-all; color: #aaa; }
  </style>
</head>
<body>
  <h2>Local Downloaded Assets (${files.length} files)</h2>
  <div class="grid">
`;

files.forEach(f => {
  html += `    <div class="card">
      <img src="assets/images/${f}" alt="${f}">
      <p>${f}</p>
    </div>\n`;
});

html += `  </div>
</body>
</html>`;

fs.writeFileSync('C:/Users/Furqan/Desktop/PeakPalsWebsite/standalone-site/gallery.html', html);
console.log('Gallery created with', files.length, 'assets.');

const fs = require('fs');

// Fix Header.jsx
const hPath = 'C:/Users/Furqan/Desktop/PeakPalsWebsite/src/components/Header.jsx';
let h = fs.readFileSync(hPath, 'utf-8');
h = h.replace(/<span className="font-extrabold[\s\S]*?<\/span>\s*<\/span>/, '');
fs.writeFileSync(hPath, h);

// Fix Footer.jsx
const fPath = 'C:/Users/Furqan/Desktop/PeakPalsWebsite/src/components/Footer.jsx';
let f = fs.readFileSync(fPath, 'utf-8');
f = f.replace(/<span className="font-extrabold[\s\S]*?<\/span>\s*<\/span>/, '');
fs.writeFileSync(fPath, f);

console.log('Cleaned up logo text in Header and Footer.');

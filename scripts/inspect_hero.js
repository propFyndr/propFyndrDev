const fs = require('fs');
const html = fs.readFileSync('C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/live_rendered.html', 'utf-8');

console.log('HTML size:', html.length);

// Look for hero section or "Lose 5"
const heroIdx = html.indexOf('Lose 5');
console.log('Hero text found at:', heroIdx);
if (heroIdx !== -1) {
  console.log(html.slice(heroIdx - 500, heroIdx + 500));
}

// Find all img tags and background-image styles in the first 50,000 characters
const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
let m;
const imgs = [];
while ((m = imgRegex.exec(html)) !== null) {
  imgs.push(m[1]);
}
console.log('Total images found in rendered HTML:', imgs.length);
console.log('First 10 images:', imgs.slice(0, 10));

// Find background-image
const bgRegex = /url\(["']?([^"')]+)["']?\)/g;
const bgs = [];
while ((m = bgRegex.exec(html)) !== null) {
  bgs.push(m[1]);
}
console.log('Total background images:', bgs.length);
console.log('Background URLs:', bgs.slice(0, 15));

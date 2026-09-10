const fs = require('fs');
const path = require('path');

const targetDir = 'C:/Users/Furqan/Desktop/PeakPalsWebsite';
const publicImagesDir = path.join(targetDir, 'public/assets/images');
const standaloneImagesDir = path.join(targetDir, 'standalone-site/assets/images');
const srcDir = 'c:/Users/Furqan/Desktop/RealtyPals/bepeak-website/public/assets/images';

// Ensure directories
[
  targetDir,
  path.join(targetDir, 'public'),
  path.join(targetDir, 'public/assets'),
  publicImagesDir,
  path.join(targetDir, 'src'),
  path.join(targetDir, 'src/components'),
  path.join(targetDir, 'standalone-site'),
  path.join(targetDir, 'standalone-site/assets'),
  standaloneImagesDir
].forEach(d => {
  if (!fs.existsSync(d)) {
    fs.mkdirSync(d, { recursive: true });
  }
});

console.log('Directories created successfully.');

// Copy all images from cache
if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  let count = 0;
  for (const file of files) {
    const srcFile = path.join(srcDir, file);
    const stat = fs.statSync(srcFile);
    if (stat.isFile()) {
      fs.copyFileSync(srcFile, path.join(publicImagesDir, file));
      fs.copyFileSync(srcFile, path.join(standaloneImagesDir, file));
      count++;
    }
  }
  console.log(`Copied ${count} images to public/assets/images and standalone-site/assets/images.`);
}

// Download any missing from scraped_media_urls.json
async function downloadMissing() {
  const scrapedPath = 'C:/Users/Furqan/.gemini/antigravity-ide/brain/4cd75e98-b082-4987-a603-d757b4d71a23/scraped_media_urls.json';
  if (!fs.existsSync(scrapedPath)) return;
  const data = JSON.parse(fs.readFileSync(scrapedPath, 'utf-8'));
  const urls = data.images || [];

  for (const url of urls) {
    try {
      if (!url.startsWith('http')) continue;
      const cleanUrl = url.split('?')[0];
      const filename = path.basename(cleanUrl).replace(/~mv2/, '_mv2');
      const dest1 = path.join(publicImagesDir, filename);
      const dest2 = path.join(standaloneImagesDir, filename);

      if (!fs.existsSync(dest1) || fs.statSync(dest1).size === 0) {
        console.log('Downloading:', filename, 'from', url);
        const res = await fetch(url);
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          fs.writeFileSync(dest1, buf);
          fs.writeFileSync(dest2, buf);
        }
      }
    } catch (e) {
      console.warn('Failed to download:', url, e.message);
    }
  }
}

downloadMissing().then(() => {
  console.log('All image assets synced and ready in C:/Users/Furqan/Desktop/PeakPalsWebsite');
});

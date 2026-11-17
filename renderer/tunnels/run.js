// usage: node tunnels/run.js <jobs.json> <outDir>
// Renders tunnel-ridge layers with tunnels/ridges.js in headless Chrome (the same Canvas 2D the game draws with).
// jobs.json: [{ name, w, h (px), tile (px per tile), ground: [r, g, b], layer: 'base' | 'glow', ridges: [...], t, seed }]
// Writes <outDir>/<name>.png (transparent), for renderer/preview/hollow_mock.py to lay over the ground.
const puppeteer = require('puppeteer-core');
const chromePath = require('../chrome.js');
const fs = require('fs'), path = require('path');
const [jobsFile, outDir] = process.argv.slice(2);
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const b = await puppeteer.launch({ executablePath: chromePath(), headless: 'new', protocolTimeout: 900000, args: ['--no-sandbox'] });
  const page = await b.newPage();
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, 'ridges.js'), 'utf8') });
  for (const j of jobs) {
    const url = await page.evaluate((j) => {
      const c = document.createElement('canvas'); c.width = j.w; c.height = j.h;
      const ctx = c.getContext('2d');
      window.drawRidges(ctx, j.ridges, j);
      return c.toDataURL('image/png');
    }, j);
    fs.writeFileSync(path.join(outDir, j.name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('ridges', j.name);
  }
  await b.close();
})();

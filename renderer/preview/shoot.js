// usage: node preview/shoot.js <outdir> page.html ...   full-page PNG of each HTML page at 2x (for the design sheets)
const puppeteer = require('puppeteer-core'), chromePath = require('../chrome.js'), path = require('path');
const [out, ...pages] = process.argv.slice(2);
(async () => {
  const b = await puppeteer.launch({ executablePath: chromePath(), headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  for (const p of pages) {
    const pg = await b.newPage();
    await pg.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 2 });
    await pg.goto('file://' + path.resolve(p), { waitUntil: 'load' });
    const f = path.join(out, path.basename(p).replace('.html', '.png'));
    await pg.screenshot({ path: f, fullPage: true });
    console.log('wrote', f);
    await pg.close();
  }
  await b.close();
})();

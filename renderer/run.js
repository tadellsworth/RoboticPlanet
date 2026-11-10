// usage: node run.js <outDir> name[:accent[:team]] ...
// Serves this folder, renders each building's beauty + glow passes in headless Chromium (WebGL via SwiftShader).
const puppeteer = require('puppeteer-core');
const chromePath = require('./chrome.js');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname;
const [outDir, ...jobs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
server.listen(0, async () => {
  const port = server.address().port;
  const b = await puppeteer.launch({ executablePath: chromePath(), headless: 'new', protocolTimeout: 900000, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const job of jobs) {
    const [name, accent, team, outName, extra] = job.split(':');
    const page = await b.newPage();
    page.on('pageerror', e => console.log('PAGEERROR', name, e.message));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) console.log('CONSOLE', name, m.text()); });
    const q = new URLSearchParams({ b: name, ...(accent ? { accent } : {}), ...(team ? { team } : {}), ...Object.fromEntries(new URLSearchParams(extra || '')) });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${port}/index.html?${q}`);
    await page.setViewport({ width: 1100, height: 1100 });
    await page.waitForFunction(() => window.result, { timeout: 900000 });
    const r = await page.evaluate(() => window.result);
    if (r.error) { console.log('ERROR', name, r.error); await page.close(); continue; }
    const base = outName || name;
    for (const k of ['beauty', 'glow']) fs.writeFileSync(path.join(outDir, `${base}.${k}.png`), Buffer.from(r[k].split(',')[1], 'base64'));
    for (const [k, v] of Object.entries(r.extra || {})) fs.writeFileSync(path.join(outDir, `${base}.${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(outDir, `${base}.geom.json`), JSON.stringify({ anchor: r.anchor, padTop: r.padTop, margins: r.margins, marks: r.marks }));
    const m = r.margins; console.log(`${base}: ${((Date.now() - t0) / 1000).toFixed(1)}s  margins L ${(m.left * 100).toFixed(1)}% R ${(m.right * 100).toFixed(1)}% T ${(m.top * 100).toFixed(1)}% B ${(m.bottom * 100).toFixed(1)}%`);
    await page.close();
  }
  await b.close(); server.close();
});

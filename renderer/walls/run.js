// usage: node run.js <outDir> <job> [<job> ...]
// job = scene:outName:query   e.g.  wall:wall-post@0:piece=post&team=%2338d4ff&frames=6
// Serves the package folder (for node_modules) and renders walls/index.html each job in headless Chrome (WebGL via SwiftShader).
// Writes <outName>.beauty.png, .glow.png, .solid.png, .spark-fN.png and .geom.json.
const puppeteer = require('puppeteer-core');
const chromePath = require('../chrome.js');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const [outDir, ...jobs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
const save = (file, url) => fs.writeFileSync(path.join(outDir, file), Buffer.from(url.split(',')[1], 'base64'));
server.listen(0, async () => {
  const port = server.address().port;
  const b = await puppeteer.launch({ executablePath: chromePath(), headless: 'new', protocolTimeout: 900000,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const job of jobs) {
    const [scene, outName, query] = job.split(':');
    const page = await b.newPage();
    await page.setViewport({ width: 1100, height: 1100 });
    page.on('pageerror', e => console.log('PAGEERROR', outName, e.message));
    page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', outName, m.text()); });
    const t0 = Date.now();
    await page.goto(`http://127.0.0.1:${port}/walls/index.html?b=${scene}&ortho=1&nopad=1&${query || ''}`);
    await page.waitForFunction(() => window.result, { timeout: 900000 });
    const r = await page.evaluate(() => window.result);
    if (r.error) { console.log('ERROR', outName, r.error); await page.close(); continue; }
    for (const k of ['beauty', 'glow', 'solid']) save(`${outName}.${k}.png`, r[k]);
    r.frames.forEach((f, i) => save(`${outName}.spark-f${i}.png`, f));
    fs.writeFileSync(path.join(outDir, `${outName}.geom.json`), JSON.stringify({ anchor: r.anchor, tileEdges: r.tileEdges, margins: r.margins }));
    const m = r.margins;
    console.log(`${outName}: ${((Date.now() - t0) / 1000).toFixed(1)}s  anchor ${r.anchor}  edges ${JSON.stringify(r.tileEdges)}  margins L ${(m.left * 100).toFixed(1)}% R ${(m.right * 100).toFixed(1)}% T ${(m.top * 100).toFixed(1)}% B ${(m.bottom * 100).toFixed(1)}%  frames ${r.frames.length}`);
    await page.close();
  }
  await b.close(); server.close();
});

// Prints the Chrome build and the WebGL renderer the runner will use, so you can confirm you're on the same software
// path the art was rendered with (SwiftShader). usage: node tools/check-webgl.js
const puppeteer = require('puppeteer-core');
const chromePath = require('../chrome.js');
(async () => {
  const exe = chromePath();
  const b = await puppeteer.launch({ executablePath: exe, headless: 'new',
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  const r = await p.evaluate(() => {
    const g = document.createElement('canvas').getContext('webgl2');
    if (!g) return { webgl2: false };
    const d = g.getExtension('WEBGL_debug_renderer_info');
    return { webgl2: true, version: g.getParameter(g.VERSION), vendor: d && g.getParameter(d.UNMASKED_VENDOR_WEBGL), renderer: d && g.getParameter(d.UNMASKED_RENDERER_WEBGL) };
  });
  console.log('chrome  ', exe, '\nversion ', await b.version(), '\nexpected', 'Chrome/' + chromePath.BUILD, '\nwebgl   ', JSON.stringify(r));
  await b.close();
})();

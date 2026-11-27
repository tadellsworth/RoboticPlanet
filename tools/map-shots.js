// Map screenshots: starts a Versus game on every map type (Medium, seed 21; two colonies, and four where the map takes
// four) in Chromium, and saves the start view and the minimap. Reports page errors, missing art (magenta tiles) and a
// start view that is mostly one flat colour (nothing drawn).
// Usage: node tools/map-shots.js [outDir] [map name filter]
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');
const out = process.argv[2] || '.', only = (process.argv[3] || '').toLowerCase();
const url = 'file://' + path.join(__dirname, '..', 'index.html');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-web-security', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  let page = null, errors = [];
  // A fresh page for every game (one page through every map runs out of memory).
  const open = async () => {
    if (page) await page.close();
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|net::ERR_FILE_NOT_FOUND|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
    await page.addInitScript(() => { window.BOTFALL_NO_SW = true; try { localStorage.clear(); } catch (e) { /* (file://) */ } });
    await page.goto(url);
    await page.waitForTimeout(2500);
  };
  await open();
  const maps = await page.evaluate(() => SHAPE_PRESETS.map((p, k) => ({ k, name: p.name, four: maxPlayers(k) === 4 && playersFit(k, 4), min: minPlayers(k) })));
  const report = [];
  for (const m of maps) {
    if (only && !m.name.toLowerCase().includes(only)) continue;
    const counts = [m.min]; if (m.four && !counts.includes(4)) counts.push(4);
    for (const players of counts) {
      errors = [];
      await open();
      errors = [];
      const name = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + players + 'p';
      try {
        await page.evaluate(({ k, players }) => {
          startNewGame({ seed: 21, difficulty: 'normal', mode: 'versus', size: 1, rough: DEFAULT_ROUGH, rich: DEFAULT_RICH, shape: k, nuke: true, mega: true,
            biome: 'desert', players, style: 'balanced', murmur: 'active', victory: 'capture', scars: 'full' });
          if (typeof closeBriefing === 'function') closeBriefing();
          const L = getE(S.players[ME].lander); centerOn(L.x + 0.5, L.y + 0.5);
        }, { k: m.k, players });
        await page.waitForTimeout(2500); // (the map's art loads and draws)
        const file = path.join(out, name + '.png');
        await page.screenshot({ path: file });
        await page.evaluate(() => { R.cam.z = minZoom(); clampCam(); });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: path.join(out, name + '-overview.png') });
        const mm = await page.$('#minimap');
        if (mm && await mm.isVisible()) await mm.screenshot({ path: path.join(out, name + '-minimap.png') });
        // Pixels of the start view: magenta (missing art) and the commonest colour's share.
        const px = await page.evaluate(() => {
          const cv = document.querySelector('canvas#game, canvas#view, #game canvas, canvas');
          const c = document.createElement('canvas'), w = 320, h = 200; c.width = w; c.height = h;
          const g = c.getContext('2d'); g.drawImage(cv, 0, 0, w, h);
          const d = g.getImageData(0, 0, w, h).data, bins = new Map();
          let pink = 0;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], gg = d[i + 1], b = d[i + 2];
            if (r > 230 && b > 230 && gg < 40) pink++;
            const k = (r >> 4) + ',' + (gg >> 4) + ',' + (b >> 4); bins.set(k, (bins.get(k) || 0) + 1);
          }
          const top = Math.max(...bins.values());
          return { pink, flat: +(top / (w * h)).toFixed(2), canvas: cv.id || cv.className };
        });
        const r = { map: m.name, players, file: name + '.png', errors: errors.slice(0, 5), ...px, live: await page.evaluate(() => S.players.filter((p) => !p.absent).length) };
        report.push(r);
        console.log(JSON.stringify(r));
      } catch (e) {
        report.push({ map: m.name, players, crash: e.message.split('\n')[0], errors });
        console.log('CRASH ' + m.name + ' ' + players + 'p: ' + e.message.split('\n')[0]);
      }
    }
  }
  fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify(report, null, 1));
  await browser.close();
})();

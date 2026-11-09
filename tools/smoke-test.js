// Browser smoke test: loads the game on a phone-sized screen, starts a game, places a building,
// fast-forwards and saves screenshots. Usage: node tools/smoke-test.js [url] [outDir]
const { chromium, devices } = require('playwright');
const url = process.argv[2] || 'http://localhost:8765/';
const out = process.argv[3] || '.';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(() => { window.BOTFALL_NO_SW = true; });
  await page.goto(url);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/01-menu.png` });

  await page.click('#m-new');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/02-start.png` });

  await page.click('#btn-build');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/03-build-menu.png` });
  await page.click('.bcard[data-t="harvester"]');
  await page.waitForTimeout(300);
  // Point at the best valid tile (found in page): with a mouse the building follows the pointer and
  // a click places it. (On touch screens a first tap previews and a second confirms.)
  const spot = await page.evaluate(() => {
    let best = null, bs = -1;
    for (let t = 0; t < S.W * S.H; t++) if (R.overlay.valid[t]) {
      const i = t % S.W, j = (t / S.W) | 0, n = countResIn(i, j, 5, R_STALK);
      if (n > bs) { bs = n; best = { i, j }; }
    }
    centerOn(best.i + 0.5, best.j + 0.5);
    const p = worldToScreen(best.i + 0.5, best.j + 0.5);
    return { x: p.x, y: p.y };
  });
  await page.waitForTimeout(100);
  await page.mouse.move(spot.x - 4, spot.y);
  await page.mouse.move(spot.x, spot.y);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/04-place-preview.png` });
  await page.mouse.click(spot.x, spot.y);
  await page.waitForTimeout(300);
  const sites = await page.evaluate(() => S.buildings.filter((b) => b.owner === 0 && !b.built).length);
  if (!sites) throw new Error('clicking a valid spot did not place the building');

  // Let the player AI help build a bit, then fast forward.
  await page.evaluate(() => { S.players[0].ai = true; for (let k = 0; k < 30 * 240; k++) simStep(SIM_STEP); S.players[0].ai = false; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/05-four-minutes.png` });
  const L = await page.evaluate(() => { const L = getE(S.players[0].lander); centerOn(L.x + 0.5, L.y + 0.5); const p = worldToScreen(L.x + 0.5, L.y + 0.5); return { x: p.x, y: p.y }; });
  await page.mouse.click(L.x, L.y);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/06-lander-sheet.png` });
  await page.click('#sheet-close');
  await page.evaluate(() => { R.cam.z = minZoom(); clampCam(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/07-zoomed-out.png` });
  const state = await page.evaluate(() => ({ time: S.time, buildings: S.buildings.filter((b) => !b.dead && b.owner === 0).length, saved: hasSave() }));
  console.log('state', JSON.stringify(state));
  console.log(errors.length ? errors.join('\n') : 'no errors');
  await browser.close();
})();

// Breach on the selection bar, under a finger (a phone, touch emulated): with warbots selected and an earthwork of your
// own standing, the bar offers Breach; a tap arms it and outlines your earthworks; the next tap on your own Earth Bank
// sends them to shoot it (the Ctrl + right-click order: task ewshoot), and Breach is off again. Without Breach the same
// tap is a move order onto it. A tap on bare ground with Breach armed orders nothing. With a mouse the bar has no Breach.
// Usage: node tools/breach-touch-test.js [url] [screenshot dir]   (a static server on the repository, e.g. python3 -m http.server 8765)
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/', SHOTS = process.argv[3] || '';
let fails = 0;
const check = (n, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : '  ' + JSON.stringify(x ?? ''))); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [tag, opt] of [['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }], ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
    const phone = tag === 'phone';
    const ctx = await b.newContext(opt), p = await ctx.newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { window.BOTFALL_NO_SW = true; localStorage.clear(); });
    await p.goto(URL); await p.waitForTimeout(1200);
    // A Versus game; beside the Command Base, a short Earth Bank of ours and three warbots with Ammo, selected.
    const setup = await p.evaluate(() => {
      UI.menu.mode = 'versus'; startNewGame(); closeBriefing(); UI.paused = false;
      const L = getE(S.players[ME].lander);
      for (const n of ['ewK', 'ewO', 'ewH']) t4Layer(n);
      let ci = -1, cj = -1;
      for (let r = 4; r < 12 && ci < 0; r++) for (let dy = -r; dy <= r && ci < 0; dy++) for (let dx = -r; dx <= r; dx++) {
        const i = L.x + dx, j = L.y + dy, ok = [0, 1, 2].every((k) => { const t = tIdx(i + k, j); return inMap(i + k, j) && S.terrain[t] === T_GROUND && !S.bAt[t] && !S.road[t] && !S.res[t] && !S.ramp[t]; });
        if (ok) { ci = i; cj = j; break; }
      }
      const tiles = [0, 1, 2].map((k) => { const t = tIdx(ci + k, cj); S.ewK[t] = 1; S.ewO[t] = ME + 1; S.ewH[t] = EW.kinds.bank.hp; return t; });
      if (typeof terrainChanged === 'function') terrainChanged(tiles);
      const ws = [0, 1, 2].map((k) => { const w = addBot(ME, 'warbot', ci + 0.5 + k, cj + 4.5); w.ammo = 99; return w.id; });
      centerOn(ci + 1.5, cj + 1.5); R.cam.z = Math.max(R.cam.z, 40);
      selectBots(ws, false); refreshSelection();
      return { ci, cj, tiles, ws };
    });
    await p.waitForTimeout(400);
    const breachShown = () => p.evaluate(() => !$('sel-breach').hidden && !!$('sel-breach').offsetParent);
    if (!phone) {
      check('desktop: no Breach on the selection bar (Ctrl, Alt or Cmd + right-click there)', !(await breachShown()));
      check('desktop: no page errors', !errs.length, errs);
      await ctx.close();
      continue;
    }
    check('phone: Breach is on the selection bar with warbots selected and an Earth Bank of ours standing', await breachShown());
    const tapTile = async (i, j) => { const s = await p.evaluate(([i, j]) => worldToScreen(i + 0.5, j + 0.5), [i, j]); await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(350); };
    const tasks = () => p.evaluate((ws) => ws.map((id) => { const u = getE(id); return u && u.task ? u.task.type : null; }), setup.ws);
    // A plain tap on our own bank: a move order onto it, not an attack.
    await tapTile(setup.ci + 1, setup.cj);
    check('phone: without Breach, a tap on our own Earth Bank is not an attack on it', (await tasks()).every((k) => k !== 'ewshoot'), await tasks());
    // (back where they were, standing free, all three selected: a tap on a tile one of ours stands on would select it)
    await p.evaluate(([ws, ci, cj]) => { ws.forEach((id, k) => { const u = getE(id); u.x = ci + 0.5 + k; u.y = cj + 4.5; u.task = null; u.path = null; }); selectBots(ws, false); refreshSelection(); }, [setup.ws, setup.ci, setup.cj]);
    await p.waitForTimeout(300);
    await p.tap('#sel-breach'); await p.waitForTimeout(350);
    const armed = await p.evaluate(() => ({ arm: !!UI.breachArm, on: $('sel-breach').classList.contains('on'), pressed: $('sel-breach').getAttribute('aria-pressed'), status: $('sel-status').textContent }));
    check('phone: a tap on Breach arms it (lit, pressed, the status line says what to tap)', armed.arm && armed.on && armed.pressed === 'true' && /Breach/.test(armed.status), armed);
    if (SHOTS) {
      await p.waitForTimeout(300);
      await p.screenshot({ path: `${SHOTS}/breach-armed-390.png` });
    }
    // A tap on bare ground: nothing ordered, still armed.
    await tapTile(setup.ci + 1, setup.cj + 2);
    const bare = await p.evaluate(() => !!UI.breachArm);
    check('phone: with Breach armed, a tap off any earthwork orders nothing and keeps it armed', bare && (await tasks()).every((k) => k !== 'ewshoot'), { bare, t: await tasks() });
    await tapTile(setup.ci + 1, setup.cj);
    const after = await p.evaluate((t) => ({ arm: !!UI.breachArm, tile: S.bots.filter((u) => u.task && u.task.type === 'ewshoot').map((u) => u.task.tile), want: t }), setup.tiles[1]);
    const tk = await tasks();
    check('phone: then a tap on our own Earth Bank sends them to shoot it (ewshoot), and Breach is off again', tk.every((k) => k === 'ewshoot') && after.tile.every((t) => t === after.want) && !after.arm, { tk, after });
    if (SHOTS) {
      await p.waitForTimeout(1500);
      await p.screenshot({ path: `${SHOTS}/breach-ordered-390.png` });
    }
    // The selection cleared: Breach goes with it.
    await p.evaluate(() => { selectBots([], false); refreshSelection(); });
    check('phone: no selection, no Breach (and not armed)', !(await breachShown()) && !(await p.evaluate(() => !!UI.breachArm)));
    check('phone: no page errors', !errs.length, errs);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'all passed');
  process.exit(fails ? 1 : 0);
})();

// The main menu's destinations: each opens from Home in at most two taps, and Esc (or Back) returns where it came from.
// Usage: node tools/menu-test.js [url]   (a static server on the repository, e.g. python3 -m http.server 8765)
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8765/';
let fails = 0;
const check = (n, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + n + (ok ? '' : '  ' + JSON.stringify(x ?? ''))); if (!ok) fails++; };
(async () => {
  const b = await chromium.launch();
  for (const [tag, opt] of [['desktop', { viewport: { width: 1440, height: 900 } }], ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]]) {
    const ctx = await b.newContext(opt), p = await ctx.newPage(), errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => { window.BOTFALL_NO_SW = true; if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', 1); } });
    await p.goto(URL); await p.waitForTimeout(1500);
    const view = () => p.evaluate(() => UI.menuView);
    const shown = (id) => p.evaluate((id) => !document.getElementById(id).hidden, id);
    const focus = () => p.evaluate(() => document.activeElement && document.activeElement.id);
    const esc = async () => { await p.keyboard.press('Escape'); await p.waitForTimeout(250); };
    const click = async (sel) => { await p.click(sel); await p.waitForTimeout(350); };
    const onHome = async () => (await view()) === 'home' && (await shown('screen-menu'));

    check(tag + ': Home on load, no sideways scroll', await onHome() && await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const homeIds = await p.evaluate(() => [...document.querySelectorAll('#menu-card button')].filter((x) => x.offsetParent).map((x) => x.id));
    check(tag + ': Home shows Play, the four tiles and the five small buttons', ['m-new', 'm-campaigns', 'm-customise', 'm-multi', 'm-daily', 'm-help', 'm-lore', 'm-settings', 'm-feedback', 'm-extras'].every((i) => homeIds.includes(i)), homeIds);

    // Campaigns
    await click('#m-campaigns');
    check(tag + ': Campaigns opens its view, the focus on Missions', (await view()) === 'camps' && (await focus()) === 'm-missions');
    const hub = await p.evaluate(() => ({ prog: $('m-missions-prog').textContent, main: $('m-campaign').getAttribute('aria-disabled'), cont: $('m-contingency').classList.contains('is-soon'), tag: !$('m-contingency-tag').hidden }));
    check(tag + ': the hub: Missions progress, the Main Campaign in preparation, Contingency coming soon', /0 of \d+ done · Next up/.test(hub.prog) && hub.main === 'true' && hub.cont && hub.tag, hub);
    await click('#m-missions');
    check(tag + ': Missions opens from the hub', await shown('screen-missions'));
    await p.click('#ms-body .ms-item'); await p.waitForTimeout(200);
    await esc();
    check(tag + ': Esc from a mission brief goes back to the list', await shown('screen-missions') && await p.evaluate(() => UI.msSel == null));
    await esc();
    check(tag + ': Esc again closes the Missions, back to the hub', !(await shown('screen-missions')) && (await view()) === 'camps');
    await p.click('#m-contingency', { force: true }); await p.waitForTimeout(300); // (aria-disabled: coming soon)
    check(tag + ': Contingency, not built yet, stays put (coming soon)', (await view()) === 'camps' && await shown('screen-menu'));
    await esc();
    check(tag + ': Esc from Campaigns returns Home, the focus on its tile', await onHome() && (await focus()) === 'm-campaigns');
    await click('#m-campaigns'); await click('#m-camps-back');
    check(tag + ': Back from Campaigns returns Home', await onHome());

    // Custom Game
    await click('#m-customise');
    check(tag + ': Custom Game opens', (await view()) === 'setup');
    await esc();
    check(tag + ': Esc from Custom Game returns Home, the focus on its tile', await onHome() && (await focus()) === 'm-customise');

    // Screens over the menu: open, then Esc closes them.
    for (const [btn, scr, via] of [['#m-multi', 'screen-mp'], ['#m-help', 'screen-help'], ['#m-lore', 'screen-lore'], ['#m-settings', 'screen-pause'], ['#m-feedback', 'screen-feedback'],
      ['#m-watch', 'screen-watch', '#m-extras'], ['#m-records', 'screen-records', '#m-extras'], ['#m-cloud', 'screen-cloud', '#m-extras']]) {
      if (via) await click(via);
      if (btn === '#m-cloud' && !(await p.evaluate(() => !!$('m-cloud').offsetParent))) { check(tag + ': Load from a code (no relay here: hidden)', true); await esc(); continue; }
      await click(btn);
      check(tag + `: ${btn} opens #${scr}`, await shown(scr));
      await esc(); await p.waitForTimeout(150);
      check(tag + `: Esc closes #${scr}`, !(await shown(scr)) && await shown('screen-menu'));
      if (via) { check(tag + ': ...back on More', (await view()) === 'extra'); await esc(); check(tag + ': Esc from More returns Home, the focus on More', await onHome() && (await focus()) === 'm-extras'); }
    }
    await click('#m-extras'); 
    const [chooser] = await Promise.all([p.waitForEvent('filechooser', { timeout: 3000 }).catch(() => null), p.click('#m-import')]);
    check(tag + ': More → Load a save file opens the file picker', !!chooser);
    await click('#m-extra-back');
    check(tag + ': Back from More returns Home', await onHome());

    // Keyboard: arrows move between Home's buttons.
    if (tag === 'desktop') {
      await p.focus('#m-campaigns');
      await p.keyboard.press('ArrowRight'); const r = await focus();
      await p.keyboard.press('ArrowDown'); const d = await focus();
      await p.keyboard.press('ArrowLeft'); const l = await focus();
      await p.keyboard.press('ArrowDown'); const d2 = await focus();
      await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); await p.keyboard.press('ArrowUp'); const u = await focus();
      check('desktop: the arrows walk the tiles, the bottom row and back to Play', r === 'm-customise' && d === 'm-daily' && l === 'm-multi' && /^m-(help|lore)$/.test(d2) && u === 'm-new', { r, d, l, d2, u });
    }

    // The Daily Planet and Play start games; back to the menu Home.
    await click('#m-daily');
    check(tag + ': the Daily Planet tile starts a game', await p.evaluate(() => UI.inGame && !!UI.daily));
    await p.evaluate(() => { if (UI.briefing) closeBriefing(); toMenu(); }); await p.waitForTimeout(400);
    check(tag + ': back on the menu, Home', await onHome());
    await click('#m-new');
    check(tag + ': Play starts a game', await p.evaluate(() => UI.inGame));
    await p.evaluate(() => { if (UI.briefing) closeBriefing(); saveGame(); toMenu(); }); await p.waitForTimeout(500);
    check(tag + ': with a save, Continue and Saved games show on Home', await p.evaluate(() => !$('m-continue').hidden && !$('m-saves').hidden));
    await click('#m-saves');
    check(tag + ': Saved games opens', await shown('screen-saves'));
    await esc();
    check(tag + ': Esc closes Saved games', !(await shown('screen-saves')) && await onHome());

    // Contingency, once built: the card calls openContingency().
    await p.evaluate(() => { window.openContingency = () => { window.__cont = (window.__cont || 0) + 1; }; window.contingencyMenuLine = () => 'Year T+7 · 11 of 28 territories'; });
    await click('#m-campaigns');
    const c = await p.evaluate(() => ({ soon: $('m-contingency').classList.contains('is-soon'), tag: $('m-contingency-tag').hidden, line: $('m-contingency-prog').textContent }));
    await click('#m-contingency');
    check(tag + ': with openContingency(), the card is live, shows its line and opens it', !c.soon && c.tag && /T\+7/.test(c.line) && await p.evaluate(() => window.__cont === 1), c);
    check(tag + ': no page errors', !errs.length, errs);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
  process.exit(fails ? 1 : 0);
})();

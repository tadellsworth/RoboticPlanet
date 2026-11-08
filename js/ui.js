'use strict';
/*
 * Botfall — HTML interface: menus, HUD, build menu, info sheets, objectives, messages.
 */

const UI = {
  inGame: false, paused: false, speed: 1, overShown: false,
  menu: { mode: 'versus', diff: 'normal', seed: randomSeed(), size: { ...DEFAULT_SIZE }, rough: DEFAULT_ROUGH, rich: DEFAULT_RICH },
  sheetKind: null, sheetFor: 0, sheetT: 0, hudT: 0,
  icons: {}, attackN: 0, demolishArm: 0, lastPaint: null, placeType: null,
  goodEls: {}, lastGoods: {}, objCollapsed: false, selBot: 0,
};

const $ = (id) => document.getElementById(id);

function randomSeed() { return 1 + Math.floor(Math.random() * 999998); }

function iconFor(type, owner) {
  const key = type + '@' + (owner || 0);
  if (!UI.icons[key]) UI.icons[key] = buildingIcon(type, 96, owner || 0);
  return UI.icons[key];
}

function goodTag(g, text, short) {
  return `<span class="gtag${short ? ' short' : ''}"><i class="gi ${g}"></i>${text}</span>`;
}

/* ------------------------------------------------------------------ setup */

function initUI() {
  const goods = $('goods');
  for (const g of GOODS) {
    const el = document.createElement('div');
    el.className = 'res-chip';
    el.title = GOOD[g].name;
    el.innerHTML = `<i class="gi ${g}"></i><span>0</span>`;
    goods.appendChild(el);
    UI.goodEls[g] = el;
  }
  // Rally / move / missile panels share the stepper markup below.
  UI.moveN = 0;

  // Menu
  for (const btn of $('m-mode').children) btn.onclick = () => { UI.menu.mode = btn.dataset.v; syncMenu(); sfx('click'); };
  for (const btn of $('m-diff').children) btn.onclick = () => { UI.menu.diff = btn.dataset.v; syncMenu(); sfx('click'); };
  $('m-reroll').onclick = () => { UI.menu.seed = randomSeed(); syncMenu(); sfx('click'); };
  // Map settings sliders (remembered on this device; map size is remembered per mode).
  try { Object.assign(UI.menu, JSON.parse(localStorage.getItem('botfall.settings') || '{}')); } catch (e) { /* defaults */ }
  const saveSettings = () => {
    try { localStorage.setItem('botfall.settings', JSON.stringify({ size: UI.menu.size, rough: UI.menu.rough, rich: UI.menu.rich })); } catch (e) { /* storage unavailable */ }
  };
  $('m-size').oninput = () => { UI.menu.size[UI.menu.mode] = +$('m-size').value; syncMenu(); saveSettings(); };
  $('m-rough').oninput = () => { UI.menu.rough = +$('m-rough').value; syncMenu(); saveSettings(); };
  $('m-rich').oninput = () => { UI.menu.rich = +$('m-rich').value; syncMenu(); saveSettings(); };
  $('m-new').onclick = () => { audioUnlock(); startNewGame(); };
  $('m-continue').onclick = () => { audioUnlock(); continueGame(); };
  $('m-help').onclick = () => showHelp();
  $('h-close').onclick = () => { $('screen-help').hidden = true; UI.paused = !$('screen-pause').hidden; };

  // Pause menu
  $('btn-pause').onclick = () => { UI.paused = true; $('screen-pause').hidden = false; sfx('click'); };
  $('p-resume').onclick = () => { UI.paused = false; $('screen-pause').hidden = true; };
  $('p-sound').onclick = () => { AUDIO.on = !AUDIO.on; $('p-sound').textContent = 'Sound: ' + (AUDIO.on ? 'on' : 'off'); };
  $('p-help').onclick = () => showHelp();
  $('p-quit').onclick = () => { saveGame(); $('screen-pause').hidden = true; toMenu(); };

  // Game over
  $('o-new').onclick = () => { $('screen-over').hidden = true; UI.menu.seed = randomSeed(); startNewGame(); };
  $('o-menu').onclick = () => { $('screen-over').hidden = true; toMenu(); };

  // HUD tools
  $('btn-build').onclick = () => { sfx('click'); if (UI.sheetKind === 'build') closeSheet(); else { setMode('normal'); openBuildMenu(); } };
  $('btn-road').onclick = () => { sfx('click'); setMode(R.mode === 'road' ? 'normal' : 'road'); };
  $('btn-attack').onclick = () => { sfx('click'); setMode(R.mode === 'attack' ? 'normal' : 'attack'); };
  $('btn-home').onclick = () => {
    const L = getE(S.players[0].lander);
    if (L) { centerOn(L.x + 0.5, L.y + 0.5); openBuildingSheet(L); }
  };
  $('btn-speed').onclick = () => { UI.speed = UI.speed >= 3 ? 1 : UI.speed + 1; $('btn-speed').textContent = UI.speed + '×'; sfx('click'); };
  $('objective').onclick = () => { UI.objCollapsed = !UI.objCollapsed; UI.hudT = 0; };
  $('sheet-close').onclick = () => closeSheet();
  $('banner-cancel').onclick = () => setMode('normal');
  $('banner-ok').onclick = () => confirmBanner();

  // Minimap: tap or drag to move the view; the close button hides it (remembered per device).
  initMinimap($('mm-canvas'));
  const mmMove = (e) => {
    const r = $('mm-canvas').getBoundingClientRect();
    centerOn(((e.clientX - r.left) / r.width) * S.W, ((e.clientY - r.top) / r.height) * S.H);
  };
  $('mm-canvas').addEventListener('pointerdown', (e) => {
    if (!UI.inGame) return;
    $('mm-canvas').setPointerCapture(e.pointerId);
    UI.mmDrag = true;
    mmMove(e);
  });
  $('mm-canvas').addEventListener('pointermove', (e) => { if (UI.mmDrag) mmMove(e); });
  const mmEnd = () => { UI.mmDrag = false; };
  $('mm-canvas').addEventListener('pointerup', mmEnd);
  $('mm-canvas').addEventListener('pointercancel', mmEnd);
  $('mm-hide').onclick = () => { setMinimap(false); sfx('click'); };
  $('mm-show').onclick = () => { setMinimap(true); sfx('click'); };
  try { MM.on = localStorage.getItem('botfall.minimap') !== '0'; } catch (e) { MM.on = true; }
  window.addEventListener('resize', () => { if (UI.inGame) { layoutMinimap(); placeMinimap(); } });

  document.addEventListener('visibilitychange', () => { if (document.hidden && UI.inGame) saveGame(); });
  window.addEventListener('pagehide', () => { if (UI.inGame) saveGame(); });
  setInterval(() => { if (UI.inGame && !UI.paused) saveGame(); }, 20000);
  syncMenu();
}

function syncMenu() {
  for (const btn of $('m-mode').children) btn.classList.toggle('on', btn.dataset.v === UI.menu.mode);
  for (const btn of $('m-diff').children) btn.classList.toggle('on', btn.dataset.v === UI.menu.diff);
  $('m-diff-field').hidden = UI.menu.mode === 'colony';
  $('m-mode-desc').textContent = UI.menu.mode === 'colony'
    ? 'No rival. Settle the planet at your own pace: build supply chains and spread across the whole map.'
    : 'Race a rival colony across the planet. Build up, then capture its Lander to win.';
  $('m-seed').textContent = 'Planet #' + UI.menu.seed;
  const size = UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode];
  $('m-size').value = size;
  $('m-rough').value = UI.menu.rough;
  $('m-rich').value = UI.menu.rich;
  $('m-size-v').textContent = `${SIZE_PRESETS[size].name} · ${SIZE_PRESETS[size].w}×${SIZE_PRESETS[size].h}`;
  $('m-rough-v').textContent = TERRAIN_PRESETS[UI.menu.rough].name;
  $('m-rich-v').textContent = RESOURCE_PRESETS[UI.menu.rich].name;
  $('m-continue').hidden = !hasSave();
}

/* ------------------------------------------------------------------ minimap */

function setMinimap(on) {
  MM.on = on;
  try { localStorage.setItem('botfall.minimap', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  placeMinimap();
}

/** Keep the minimap just under the top bar, and make room for it beside the goal and messages. */
function placeMinimap() {
  const inGame = UI.inGame;
  $('minimap').hidden = !inGame || !MM.on;
  $('mm-show').hidden = !inGame || MM.on;
  document.body.classList.toggle('mm-on', inGame && MM.on);
  document.body.classList.toggle('mm-off', inGame && !MM.on);
  if (!inGame) return;
  $('toasts').style.top = Math.round($('topbar').getBoundingClientRect().bottom + 6) + 'px';
  const top = Math.round(document.querySelector('.toprow').getBoundingClientRect().bottom + 6) + 'px';
  $('minimap').style.top = top;
  $('mm-show').style.top = top;
  document.documentElement.style.setProperty('--mm-w', MM.w + 'px');
}

/* ------------------------------------------------------------------ game flow */

function startNewGame() {
  clearSave();
  newGame({
    seed: UI.menu.seed, difficulty: UI.menu.diff, mode: UI.menu.mode,
    size: UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], rough: UI.menu.rough, rich: UI.menu.rich,
  });
  enterGame();
  updateHUD();
  placeMinimap();
  postMsg(0, UI.menu.mode === 'colony'
    ? 'Your bots have landed. Build, expand and make this planet home.'
    : 'Your bots have landed. A rival colony landed to the north. Build up fast!', 0, 0, 'info');
}

function continueGame() {
  if (!loadGame()) { syncMenu(); return; }
  enterGame();
  postMsg(0, 'Welcome back.', 0, 0, 'info');
}

function enterGame() {
  bakeMap();
  UI.inGame = true; UI.paused = false; UI.overShown = false; UI.speed = 1;
  $('btn-speed').textContent = '1×';
  $('screen-menu').hidden = true;
  $('hud').hidden = false;
  $('toasts').innerHTML = '';
  const colony = S.mode === 'colony';
  $('btn-attack').hidden = colony;
  for (const g of WAR_GOODS) UI.goodEls[g].hidden = colony;
  // More than seven goods don't fit one row on a phone: split them over two.
  const nGoods = GOODS.length - (colony ? WAR_GOODS.length : 0);
  $('goods').style.gridTemplateColumns = `repeat(${nGoods > 7 ? Math.ceil(nGoods / 2) : nGoods}, 1fr)`;
  $('goods').classList.toggle('two-rows', nGoods > 7);
  $('bottombar').classList.toggle('three', colony);
  closeSheet();
  setMode('normal');
  const L = getE(S.players[0].lander);
  R.cam.z = clamp(Math.min(R.w, 520) / 11, 26, 48);
  if (L) centerOn(L.x + 0.5, L.y - 1);
  layoutMinimap();
  placeMinimap();
  saveGame();
}

function toMenu() {
  UI.inGame = false;
  UI.paused = false;
  closeSheet();
  setMode('normal');
  $('hud').hidden = true;
  placeMinimap();
  $('screen-menu').hidden = false;
  syncMenu();
  startDemo();
}

function showHelp() {
  UI.paused = UI.inGame;
  $('screen-help').hidden = false;
}

function showGameOver() {
  UI.overShown = true;
  clearSave();
  const won = S.winner === 0;
  sfx(won ? 'win' : 'lose');
  $('o-title').textContent = won ? 'Victory!' : 'Defeat';
  $('o-text').textContent = won
    ? 'Your warbots captured the rival Lander. The planet is yours.'
    : 'The rival captured your Lander. Regroup and try again.';
  const st = S.players[0].stats;
  $('o-stats').innerHTML = [
    ['Time', fmtTime(S.time)], ['Buildings completed', st.built], ['Bots built', st.bots - START_WORKERS - START_WARBOTS],
    ['Enemy buildings captured', st.captured], ['Bots lost', st.lost],
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  $('screen-over').hidden = false;
}

/* ------------------------------------------------------------------ modes & banner */

function setMode(mode) {
  R.mode = mode;
  R.ghost = null;
  R.overlay = null;
  UI.placeType = null;
  $('btn-road').classList.toggle('on', mode === 'road');
  $('btn-attack').classList.toggle('on', mode === 'attack');
  if (mode === 'normal') { $('banner').hidden = true; return; }
  closeSheet();
  if (mode === 'road') showRoadBanner();
  if (mode === 'attack') showBanner('Tap a <b>rival building</b> to attack it with warbots or missiles, or tap open ground to send warbots there to <b>hold the area</b>.', null, 'Cancel');
}

function showBanner(html, okLabel, cancelLabel) {
  $('banner').hidden = false;
  $('banner-seg').hidden = true;
  $('banner-text').innerHTML = html;
  $('banner-ok').hidden = !okLabel;
  if (okLabel) $('banner-ok').textContent = okLabel;
  $('banner-cancel').textContent = cancelLabel || 'Cancel';
}

function enterPlaceMode(type) {
  closeSheet();
  setMode('place');
  UI.placeType = type;
  refreshOverlay(type);
  showBanner(`Tap a highlighted spot to place a <b>${BDEFS[type].name}</b>.`, null, 'Cancel');
  if (!R.overlay.valid.some((v) => v)) {
    const near = BDEFS[type].gather ? ' near the right resource' : BDEFS[type].farm ? ' near fertile soil' : BDEFS[type].pump ? ' on an oil seep' : '';
    showBanner(`<span class="err">There is no valid spot for a ${BDEFS[type].name} in your territory${near}. Expand with an Outpost.</span>`, null, 'Close');
  }
}

function confirmBanner() {
  if (R.mode !== 'place' || !R.ghost || !R.ghost.ok) return;
  const { type, x, y } = R.ghost;
  const res = placeSite(0, type, x, y);
  if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
  sfx('place');
  addFx('ring', x + 0.5, y + 0.5, { color: PLAYER_COLORS[0] });
  setMode('normal');
}

/* ------------------------------------------------------------------ map taps */

function buildingAtTap(i, j, wx, wy) {
  if (inMap(i, j) && S.bAt[tIdx(i, j)]) return getE(S.bAt[tIdx(i, j)]);
  for (const b of S.buildings) {
    if (!b.dead && b.type === 'lander' && dist2(b.x + 0.5, b.y + 0.5, wx, wy) < 1.1) return b;
  }
  return null;
}

function onMapTap(i, j, wx, wy) {
  if (!UI.inGame || UI.paused) return;
  if (R.mode === 'place') {
    if (!inMap(i, j)) return;
    const type = UI.placeType;
    if (R.ghost && R.ghost.x === i && R.ghost.y === j && R.ghost.ok) { confirmBanner(); return; }
    const chk = canPlace(0, type, i, j);
    R.ghost = { type, x: i, y: j, ok: chk.ok };
    if (chk.ok) {
      let extra = '';
      const def = BDEFS[type];
      if (def.gather) extra = ` <span class="ok">${reachableRes(i, j, def.radius, def.gather)} ${RES[def.gather].name.toLowerCase()}s in reach.</span>`;
      if (def.farm) extra = ` <span class="ok">${fertileIn(i, j, def.radius)} fertile tiles in reach.</span>`;
      if (def.pump) extra = ` <span class="ok">${oilAround(i, j)} Crude in this seep.</span>`;
      showBanner(`Place the <b>${def.name}</b> here?${extra}`, 'Build here', 'Cancel');
    } else {
      sfx('error');
      showBanner(`<span class="err">${chk.reason}</span>`, null, 'Cancel');
    }
    return;
  }
  if (R.mode === 'road') {
    if (!inMap(i, j)) return;
    const t = tIdx(i, j);
    if (S.road[t] && UI.oneWay) {
      // Turn the arrow: east, south, west, north, then back to two-way.
      setRoadDir(i, j, S.road[t] >= 5 ? 1 : S.road[t] + 1);
      sfx('click');
      showRoadBanner();
    } else if (S.road[t]) { removeRoad(0, i, j); sfx('click'); showRoadBanner(); }
    else {
      const why = buildRoad(0, i, j);
      if (why) { sfx('error'); showRoadBanner(why); } else { sfx('click'); showRoadBanner(); }
    }
    return;
  }
  const rally = rallyAtTap(wx, wy);
  if (rally) { sfx('click'); setMode('normal'); openRallySheet(rally); return; }
  const b = buildingAtTap(i, j, wx, wy);
  if (R.mode === 'attack') {
    if (b && b.owner !== 0) { setMode('normal'); openBuildingSheet(b); }
    else if (!b && inMap(i, j) && S.terrain[tIdx(i, j)] === T_GROUND) { setMode('normal'); openMoveSheet(i, j); }
    else { sfx('error'); showBanner('<span class="err">Tap a rival building (red) or open ground.</span>', null, 'Cancel'); }
    return;
  }
  if (b) { sfx('click'); openBuildingSheet(b); return; }
  let bot = null, bd = 0.3;
  for (const u of S.bots) {
    if (u.dead || u.inside) continue;
    const d = dist2(u.x, u.y, wx, wy);
    if (d < bd) { bd = d; bot = u; }
  }
  if (bot) { sfx('click'); openBotSheet(bot); return; }
  if (inMap(i, j) && S.res[tIdx(i, j)]) { sfx('click'); openResourceSheet(tIdx(i, j)); return; }
  if (inMap(i, j) && S.fert[tIdx(i, j)] && S.terrain[tIdx(i, j)] === T_GROUND) { sfx('click'); openSoilSheet(tIdx(i, j)); return; }
  closeSheet();
}

function rallyAtTap(wx, wy) {
  for (const r of S.rallies) if (r.owner === 0 && dist2(r.x + 0.1, r.y - 0.35, wx, wy) < 0.45) return r;
  return null;
}

/**
 * Dragging lays path tiles along the drag. In one-way mode each tile also points the way the
 * finger moved; in two-way mode dragging over one-way tiles makes them two-way again.
 */
function onRoadPaint(i, j, first) {
  if (R.mode !== 'road') return;
  const from = first || !UI.lastPaint ? { i, j } : UI.lastPaint;
  const line = tileLine(from.i, from.j, i, j);
  let prev = null;
  for (const [x, y] of line) {
    if (!inMap(x, y)) break;
    const t = tIdx(x, y);
    if (!S.road[t] && canRoad(0, x, y)) {
      const why = buildRoad(0, x, y);
      if (why) { if (!UI.roadWarned) { UI.roadWarned = true; sfx('error'); } showRoadBanner(why); break; }
    }
    if (S.road[t]) {
      if (!UI.oneWay) setRoadDir(x, y, 1);
      else if (prev) {
        const v = 2 + [[1, 0], [0, 1], [-1, 0], [0, -1]].findIndex(([dx, dy]) => dx === x - prev[0] && dy === y - prev[1]);
        if (v >= 2) { if (S.road[tIdx(prev[0], prev[1])]) setRoadDir(prev[0], prev[1], v); setRoadDir(x, y, v); }
      }
    }
    prev = [x, y];
  }
  if (!UI.roadWarned) showRoadBanner();
  UI.lastPaint = { i, j };
}

/** The Paths banner: two-way or one-way, what a tile costs and how much you have left. */
function showRoadBanner(problem) {
  const g = Object.keys(ROAD_COST)[0];
  const per = Math.round(1 / ROAD_COST[g]);
  const cost = `<b>1 ${GOOD[g].name} paves ${per} tiles</b> (${roadTilesAffordable(0)} left)`;
  const how = UI.oneWay
    ? 'Drag along paths to point them the way you drag. <b>One-way</b> traffic never meets head-on. Tap a path to turn its arrow.'
    : 'Drag to lay <b>paths</b>: bots go twice as fast on them, but slow down for oncoming traffic. Tap a path to remove it.';
  showBanner((problem ? `<span class="err">${problem}</span> ` : '') + `${how} ${cost}.`, null, 'Done');
  $('banner-seg').hidden = false;
  for (const btn of $('banner-seg').children) {
    btn.classList.toggle('on', (btn.dataset.v === '1') === !!UI.oneWay);
    btn.onclick = () => { UI.oneWay = btn.dataset.v === '1'; sfx('click'); showRoadBanner(); };
  }
}

/* ------------------------------------------------------------------ sheets */

function openSheet(kind, id, html) {
  UI.sheetKind = kind;
  UI.sheetFor = id;
  UI.demolishArm = 0;
  $('sheet-body').innerHTML = html;
  $('sheet').hidden = false;
  $('banner').hidden = true;
}

function closeSheet() {
  $('sheet').hidden = true;
  UI.sheetKind = null;
  UI.sheetFor = 0;
  R.selected = 0;
  R.selTile = -1;
  UI.selBot = 0;
}

function costHTML(cost, have) {
  return Object.keys(cost).map((g) => `<span class="${have && have[g] < cost[g] ? 'short' : ''}"><i class="gi ${g}"></i>${cost[g]}</span>`).join('');
}

function openBuildMenu() {
  const have = playerGoods(0);
  const sites = siteCount(0);
  const list = BUILD_MENU.filter((t) => !(S.mode === 'colony' && BDEFS[t].war));
  const html = `<div class="sheet-title"><h3>Build</h3></div>
    <p class="desc">Placing a site is free; workers carry the materials over from storage. ${sites}/${MAX_SITES} sites in progress.</p>
    <div class="build-grid">${list.map((t) => `<button class="bcard" data-t="${t}" ${sites >= MAX_SITES ? 'disabled' : ''}>
      <img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div><div class="bcost">${costHTML(BDEFS[t].cost, have)}</div>
      <div class="bhave">${ownedText(t)}</div></button>`).join('')}</div>`;
  openSheet('build', 0, html);
  for (const el of $('sheet-body').querySelectorAll('.bcard')) {
    el.onclick = () => { sfx('click'); enterPlaceMode(el.dataset.t); };
  }
}

/** How many of a building type the player has, for the build menu. */
function ownedCount(type) {
  let built = 0, sites = 0;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== 0 || b.type !== type) continue;
    if (b.built) built++; else sites++;
  }
  return { built, sites };
}

function ownedText(type) {
  const { built, sites } = ownedCount(type);
  if (type === 'ramp') return sites ? `${sites} being built` : '';
  if (!built && !sites) return 'None yet';
  return `You have ${built}` + (sites ? ` · ${sites} being built` : '');
}

function openBuildingSheet(b) {
  const def = BDEFS[b.type];
  const mine = b.owner === 0;
  R.selected = b.id; R.selTile = -1; UI.selBot = 0;
  const desc = !mine && b.type === 'lander' ? 'The rival\'s landing craft and main base. Capture it to win.' : def.desc;
  let html = `<div class="sheet-title"><img src="${iconFor(b.type, b.owner)}" alt=""><div><h3>${def.name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[b.owner]}"></span> ${mine ? 'Yours' : 'Rival'}</div></div></div>
    <p class="desc">${desc}</p><div class="status" id="sh-status"></div><div id="sh-dyn"></div>`;
  if (mine) {
    if (def.store && b.built) {
      html += `<div class="section-label">Storage</div><div class="seg" id="sh-smode">
        <button data-v="normal">Normal</button><button data-v="fill">Fill first</button><button data-v="empty">Empty out</button></div>
        <p class="hint" id="sh-smode-hint"></p>
        <div class="section-label">Goods kept here <span class="label-note">tap to switch off</span></div>
        <div class="goodlist" id="sh-accept">${GOODS.map((g) => `<button class="gtag toggle" data-g="${g}"><i class="gi ${g}"></i><span>${GOOD[g].name}</span> <b>0</b></button>`).join('')}</div>`;
    } else if (b.type !== 'lander') {
      html += `<div class="section-label">Priority</div><div class="seg" id="sh-prio">
        <button data-v="low">Low</button><button data-v="normal">Normal</button><button data-v="high">High</button></div>
        <p class="hint">${b.built ? 'High-priority buildings get workers and goods first; low ones last, and lose their worker first when workers run short.' : 'High-priority sites get their materials and a builder first.'}</p>`;
    }
    if (b.type === 'foundry' && b.built) {
      const versus = S.mode !== 'colony';
      const row = (k, label) => `<div class="order-row"><span>${label}<small id="sh-o-${k}">none queued</small></span>
        <button class="btn" data-k="${k}" data-d="1">+1</button><button class="btn" data-k="${k}" data-d="5">+5</button>
        <button class="btn ghost" data-k="${k}" data-d="0">Clear</button></div>`;
      html += `<div class="section-label">Order bots</div><div id="sh-orders">${row('worker', 'Workers')}${versus ? row('warbot', 'Warbots') : ''}</div>
        <p class="hint">The Foundry only builds the bots you order. Each one uses 1 Alloy and 1 Chip and takes ${def.work} s.${versus ? ' Mixed orders take turns.' : ''}</p>`;
    }
    if (def.missile && b.built) {
      html += `<p class="hint">To fire, tap <b>Army</b> and then a rival building within ${def.missile.range} tiles.</p>`;
    }
    html += '<div class="actions">';
    if (def.staff && b.built) html += `<button class="btn" id="sh-pause"></button>`;
    if (b.type !== 'lander') html += `<button class="btn danger" id="sh-demolish">${b.built ? 'Demolish' : 'Cancel site'}</button>`;
    html += '</div>';
  } else if (S.mode !== 'colony') {
    html += `<div class="section-label">Attack with warbots</div><div id="sh-attack"></div>
      <div class="stepper" id="sh-stepper"><button class="btn" id="sh-minus">−</button><span class="n" id="sh-n">0</span>
      <button class="btn" id="sh-plus">+</button><button class="btn primary" id="sh-send" style="flex:1">Send warbots</button></div>
      <div class="section-label">Missile strike</div><div id="sh-missile"></div>
      <button class="btn primary big" id="sh-fire">Fire missile</button>`;
  }
  openSheet('bld', b.id, html);
  if (mine) {
    if ($('sh-prio')) for (const btn of $('sh-prio').children) btn.onclick = () => { b.prio = btn.dataset.v === 'normal' ? undefined : btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-smode')) for (const btn of $('sh-smode').children) btn.onclick = () => { b.smode = btn.dataset.v === 'normal' ? undefined : btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-accept')) for (const btn of $('sh-accept').children) btn.onclick = () => {
      const g = btn.dataset.g;
      b.reject = b.reject || {};
      if (b.reject[g]) delete b.reject[g]; else b.reject[g] = true;
      if (!Object.keys(b.reject).length) delete b.reject;
      sfx('click');
      refreshSheet();
    };
    const seg = $('sh-mode');
    if (seg) for (const btn of seg.children) btn.onclick = () => { b.mode = btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-orders')) for (const btn of $('sh-orders').querySelectorAll('button')) btn.onclick = () => {
      const k = btn.dataset.k, d = +btn.dataset.d;
      b.orders = b.orders || { worker: 0, warbot: 0 };
      b.orders[k] = d === 0 ? 0 : clamp((b.orders[k] || 0) + d, 0, 99);
      if (!hasOrders(b)) delete b.orders;
      sfx('click');
      refreshSheet();
    };
    if ($('sh-pause')) $('sh-pause').onclick = () => { setPaused(b, !b.paused); sfx('click'); refreshSheet(); };
    if ($('sh-demolish')) $('sh-demolish').onclick = () => {
      if (!UI.demolishArm) {
        UI.demolishArm = 1;
        $('sh-demolish').textContent = BDEFS[b.type].mil && b.built ? 'Tap again: buildings outside your border will be lost' : 'Tap again to confirm';
        return;
      }
      demolish(b);
      sfx('boom');
      closeSheet();
    };
  } else if ($('sh-send')) {
    UI.attackN = attackAvailable(0, b);
    $('sh-minus').onclick = () => { UI.attackN = Math.max(1, UI.attackN - 1); refreshSheet(); };
    $('sh-plus').onclick = () => { UI.attackN = Math.min(attackAvailable(0, b), UI.attackN + 1); refreshSheet(); };
    $('sh-send').onclick = () => {
      const n = sendAttack(0, b, UI.attackN);
      if (n > 0) {
        sfx('alert');
        toast(`${n} warbot${n > 1 ? 's' : ''} sent to attack the ${def.name}.`, 'info');
        closeSheet();
      }
    };
    $('sh-fire').onclick = () => {
      if (fireMissile(0, b)) { toast(`Missile away: it will hit the ${def.name} in a few seconds.`, 'info'); refreshSheet(); }
      else sfx('error');
    };
  }
  refreshSheet();
}

function refreshBuildingSheet(b) {
  const def = BDEFS[b.type];
  const mine = b.owner === 0;
  const parts = [];
  $('sh-status').textContent = mine ? b.status || '' : (b.built ? '' : 'Construction site');
  if (!b.built) {
    parts.push(`<div class="bar"><div style="width:${Math.round(b.progress * 100)}%"></div></div>`);
    parts.push('<div class="section-label">Materials delivered</div><div class="goodlist">' +
      Object.keys(def.cost).map((g) => goodTag(g, `${b.stock[g] || 0}/${def.cost[g]}`, (b.stock[g] || 0) < def.cost[g])).join('') + '</div>');
  } else {
    parts.push(`<div class="kv"><span>Armor</span><span>${Math.ceil(Math.max(0, b.armor))} / ${def.armor}</span></div>
      <div class="bar armor"><div style="width:${Math.max(0, (b.armor / def.armor) * 100)}%"></div></div>`);
    if (mine && def.staff) {
      const op = getE(b.staff);
      parts.push(`<div class="kv"><span>Worker</span><span>${b.paused ? 'Paused' : op ? (op.inside === b.id ? 'Inside' : 'Out working') : b.staffInc ? 'On the way' : 'None yet'}</span></div>`);
    }
    if (def.gather) {
      const g = RES[def.gather].good;
      parts.push(`<div class="kv"><span>${RES[def.gather].name}s in reach</span><span>${reachableRes(b.x, b.y, def.radius, def.gather)}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag(g, `${b.stock[g] || 0}/${def.out[g]}`)}</span></div>`);
    }
    if (def.plant) parts.push(`<div class="kv"><span>Stalk groves in reach</span><span>${reachableRes(b.x, b.y, def.radius, R_STALK)}</span></div>`);
    if (def.farm) {
      const crops = reachableRes(b.x, b.y, def.radius, R_CROP), ripe = countResIn(b.x, b.y, def.radius, R_CROP, true, S.zone[tIdx(b.x, b.y)]);
      parts.push(`<div class="kv"><span>Fertile soil in reach</span><span>${fertileIn(b.x, b.y, def.radius)} tiles</span></div>`);
      parts.push(`<div class="kv"><span>Crops planted</span><span>${crops}${crops ? ` (${ripe} ripe)` : ''}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag('fuel', `${b.stock.fuel || 0}/${def.out.fuel}`)}</span></div>`);
    }
    if (def.pump) {
      parts.push(`<div class="kv"><span>Crude left in the seep</span><span>${oilAround(b.x, b.y)}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag('crude', `${b.stock.crude || 0}/${def.out.crude}`)}</span></div>`);
      if (mine && b.timer > 0 && b.status === 'Working') parts.push(`<div class="bar"><div style="width:${Math.round((b.timer / def.work) * 100)}%"></div></div>`);
    }
    if (def.inp && mine && !def.pump) {
      const ins = Object.keys(def.inp).map((g) => goodTag(g, `${b.stock[g] || 0}/${INPUT_CAP}`, !(b.stock[g] > 0))).join('');
      const outs = def.make ? Object.keys(def.make).map((g) => goodTag(g, `${b.stock[g] || 0}/${def.out[g]}`)).join('') : '';
      const recipe = Object.keys(def.inp).map((g) => GOOD[g].name).join(' + ') + ' → ' + (def.make ? Object.keys(def.make).map((g) => GOOD[g].name).join('') : 'a new bot');
      parts.push(`<div class="kv"><span>Recipe</span><span>${recipe}, ${def.work}s</span></div>`);
      parts.push(`<div class="section-label">Inputs</div><div class="goodlist">${ins}</div>`);
      if (outs) parts.push(`<div class="section-label">Output</div><div class="goodlist">${outs}</div>`);
      if (def.bots) {
        const k = nextBotKind(b);
        parts.push(`<div class="kv"><span>Next bot</span><span>${k === 'off' ? 'Nothing ordered' : k === 'worker' ? 'Worker' : 'Warbot'}</span></div>`);
      }
      if (b.timer > 0 && b.status === 'Working') parts.push(`<div class="bar"><div style="width:${Math.round((b.timer / def.work) * 100)}%"></div></div>`);
    }
    if (def.store && mine) {
      let idle = 0;
      for (const u of S.bots) if (!u.dead && u.inside === b.id && u.type === 'worker') idle++;
      parts.push(`<div class="kv"><span>Workers resting here</span><span>${idle}</span></div>`);
    }
    if (def.mil) parts.push(`<div class="kv"><span>${mine ? 'Warbots inside' : 'Defenders inside'}</span><span>${b.garrison.length} / ${def.garrison}</span></div>`);
    if (def.mil && mine && S.mode !== 'colony') parts.push(`<div class="kv"><span>Territory radius</span><span>${def.terr} tiles</span></div>`);
    if (def.ammo && mine && !def.missile) parts.push(`<div class="kv"><span>Ammo</span><span>${b.shots + (b.stock.crystal || 0) * SHOTS_PER_AMMO} shots</span></div>`);
    if (def.missile && mine) {
      parts.push(`<div class="kv"><span>Warheads loaded</span><span>${goodTag('warhead', `${b.stock.warhead || 0}/${def.ammoCap}`)}</span></div>`);
      parts.push(`<div class="kv"><span>Reload</span><span>${b.reload > 0 ? Math.ceil(b.reload) + 's' : 'Ready'}</span></div>`);
      parts.push(`<div class="kv"><span>Range</span><span>${def.missile.range} tiles</span></div>`);
    }
    if (def.charger && mine) {
      parts.push(`<div class="kv"><span>Charging now</span><span>${b.charging || 0} (${def.charger.slots} at full speed)</span></div>`);
      if (def.charger.fuel) {
        const pct = Math.round(Math.min(100, ((b.energy || 0) / FUEL_ENERGY) * 100));
        parts.push(`<div class="kv"><span>Fuel stocked</span><span>${goodTag('fuel', `${b.stock.fuel || 0}/${def.fuelCap}`, !(b.stock.fuel > 0))}</span></div>`);
        parts.push(`<div class="kv"><span>Fuel burning</span><span>${pct}% left</span></div><div class="bar battery"><div style="width:${pct}%;background:var(--g-fuel)"></div></div>`);
      } else {
        parts.push('<div class="kv"><span>Fuel</span><span>Not needed: the Lander charges for free</span></div>');
      }
    }
  }
  $('sh-dyn').innerHTML = parts.join('');
  if ($('sh-pause')) $('sh-pause').textContent = b.paused ? 'Resume' : 'Pause';
  if ($('sh-prio')) for (const btn of $('sh-prio').children) btn.classList.toggle('on', btn.dataset.v === (b.prio || 'normal'));
  if ($('sh-smode')) {
    const m = b.smode || 'normal';
    for (const btn of $('sh-smode').children) btn.classList.toggle('on', btn.dataset.v === m);
    $('sh-smode-hint').textContent = {
      normal: 'Finished goods go to whichever storage is closest.',
      fill: 'Workers bring finished goods here before any other storage, even if another is closer.',
      empty: 'Takes nothing new and sends what it holds to your other storage. Good before demolishing it.',
    }[m];
  }
  if ($('sh-accept')) for (const btn of $('sh-accept').children) {
    const g = btn.dataset.g;
    btn.classList.toggle('off', !!(b.reject && b.reject[g]) || b.smode === 'empty');
    btn.lastElementChild.textContent = b.stock[g] || 0;
  }
  if ($('sh-mode')) for (const btn of $('sh-mode').children) btn.classList.toggle('on', btn.dataset.v === b.mode);
  for (const k of ['worker', 'warbot']) {
    if (!$('sh-o-' + k)) continue;
    const n = (b.orders && b.orders[k]) || 0;
    $('sh-o-' + k).textContent = n ? `${n} queued` : 'none queued';
  }
  if ($('sh-fire')) {
    const silos = silosInRange(0, b), ready = silos.filter(siloReady);
    const minReload = silos.reduce((m, q) => (q.reload > 0 && q.stock.warhead > 0 ? Math.min(m, q.reload) : m), Infinity);
    $('sh-fire').disabled = !ready.length;
    $('sh-missile').innerHTML = `<p class="desc">${!silos.length
      ? `No Missile Silo within ${BDEFS.silo.missile.range} tiles. Build a Silo near the front and a Munitions Works to make Warheads.`
      : ready.length
        ? `${ready.length} silo${ready.length > 1 ? 's' : ''} ready. A missile wrecks smaller buildings and knocks Outposts and Landers down to almost no armor, ready for warbots to capture.`
        : minReload < Infinity ? `Silos in range are reloading (${Math.ceil(minReload)}s).` : 'Silos in range have no Warheads. Make them at a Munitions Works.'}</p>`;
  }
  if ($('sh-send')) {
    const avail = attackAvailable(0, b);
    UI.attackN = clamp(UI.attackN || avail, Math.min(1, avail), avail);
    $('sh-n').textContent = UI.attackN;
    $('sh-send').disabled = avail === 0;
    $('sh-attack').innerHTML = avail
      ? `<p class="desc">${avail} warbot${avail > 1 ? 's' : ''} can reach this from your garrisons (each garrison keeps one at home).</p>`
      : `<p class="desc">No warbots in range. Warbots attack from Outposts or your Lander within ${ATTACK_RANGE} tiles. Build an Outpost closer and let warbots gather there.</p>`;
  }
}

function botActivity(u) {
  const t = u.task;
  const nm = (id) => { const b = getE(id); return b ? BDEFS[b.type].name : 'a building'; };
  if (u.type === 'warbot') {
    if (u.fight) return 'Fighting!';
    if (!t) return u.inside ? 'Standing guard inside' : 'Waiting for orders';
    if (t.type === 'garrison') return `Marching to the ${nm(t.bld)}`;
    if (t.type === 'attack') return `Attacking the rival ${nm(t.target)}`;
    if (t.type === 'defend') return `Defending the ${nm(t.home)}`;
    if (t.type === 'hold') return t.phase === 'recharge' ? 'Battery flat: going to recharge' : t.target ? `Attacking the rival ${nm(t.target)}` : 'Holding the rally point';
    return 'On patrol';
  }
  if (t && t.type === 'charge') return u.inside ? 'Recharging its battery' : 'Going to recharge its battery';
  if (t && t.type === 'staff' && (t.phase === 'toCharge' || t.phase === 'charging')) return t.phase === 'charging' ? 'Recharging its battery' : 'Going to recharge its battery';
  if (!t) return u.carry ? `Looking for somewhere to store ${GOOD[u.carry].name}` : u.inside ? 'Resting in storage' : 'Waiting for a job';
  if (t.type === 'home') return 'Heading back to storage';
  if (t.type === 'haul') return t.phase === 'toSrc' ? `Fetching ${GOOD[t.good].name} from the ${nm(t.src)}` : `Delivering ${GOOD[t.good].name} to the ${nm(t.dst)}`;
  if (t.type === 'build') return t.phase === 'go' ? `Walking to build a ${nm(t.site)}` : `Constructing a ${nm(t.site)}`;
  if (t.type === 'staff') {
    const b = getE(t.bld), def = b ? BDEFS[b.type] : {};
    if (t.phase === 'go') return `Walking to its job at the ${nm(t.bld)}`;
    if (def.farm && (t.phase === 'toNode' || t.phase === 'work')) {
      return t.act === 'harvest' ? (t.phase === 'work' ? 'Harvesting an energy crop' : 'Heading out to harvest a crop') : (t.phase === 'work' ? 'Planting an energy crop' : 'Heading out to plant a crop');
    }
    if (t.phase === 'toNode') return def.plant ? 'Heading out to plant a grove' : `Heading out to gather ${def.gather ? GOOD[RES[def.gather].good].name : ''}`;
    if (t.phase === 'work') return def.plant ? 'Planting a stalk grove' : `Harvesting ${def.gather ? RES[def.gather].name.toLowerCase() : ''}`;
    if (t.phase === 'back') return u.carry ? `Bringing ${GOOD[u.carry].name} back` : `Walking back to the ${nm(t.bld)}`;
    return `Working at the ${nm(t.bld)}`;
  }
  return 'Busy';
}

function openBotSheet(u) {
  R.selected = 0; R.selTile = -1; UI.selBot = u.id;
  const html = `<div class="sheet-title"><div><h3>${u.type === 'warbot' ? 'Warbot' : 'Worker'}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[u.owner]}"></span> ${u.owner === 0 ? 'Yours' : 'Rival'}</div></div></div>
    <p class="desc">${u.type === 'warbot' ? 'Fights enemy bots and captures enemy buildings.' : 'Carries goods, builds construction sites and runs buildings.'}</p>
    <div class="status" id="sh-status"></div><div id="sh-dyn"></div>
    ${u.owner === 0 && u.type === 'warbot' ? '<button class="btn big" id="sh-recall" hidden>Call back this squad</button>' : ''}`;
  openSheet('bot', u.id, html);
  if ($('sh-recall')) $('sh-recall').onclick = () => {
    if (u.task && u.task.type === 'hold') { const n = recallRally(u.task.rally); toast(`${n} warbot${n > 1 ? 's' : ''} called back.`, 'info'); }
    closeSheet();
  };
  refreshSheet();
}

/** Army order: send warbots to hold the area around an open tile. */
function openMoveSheet(i, j) {
  R.selected = 0; R.selTile = tIdx(i, j); UI.selBot = 0;
  const html = `<div class="sheet-title"><div><h3>Send warbots here</h3></div></div>
    <p class="desc">They plant a rally flag and hold the area: they fight enemy bots that come close and attack enemy buildings within 3 tiles, until you tap the flag and call them back.</p>
    <div id="mv-info"></div>
    <div class="stepper"><button class="btn" id="mv-minus">−</button><span class="n" id="mv-n">0</span>
      <button class="btn" id="mv-plus">+</button><button class="btn primary" id="mv-send" style="flex:1">Send warbots</button></div>`;
  openSheet('move', tIdx(i, j), html);
  UI.moveN = Math.min(5, rallyAvailable(0, i, j));
  $('mv-minus').onclick = () => { UI.moveN = Math.max(1, UI.moveN - 1); refreshSheet(); };
  $('mv-plus').onclick = () => { UI.moveN = Math.min(rallyAvailable(0, i, j), UI.moveN + 1); refreshSheet(); };
  $('mv-send').onclick = () => {
    const res = sendToRally(0, i, j, UI.moveN);
    if (res.sent) { sfx('alert'); toast(`${res.sent} warbot${res.sent > 1 ? 's are' : ' is'} on the way. Tap the flag to call them back.`, 'info'); closeSheet(); }
    else sfx('error');
  };
  refreshSheet();
}

function openRallySheet(r) {
  R.selected = 0; R.selTile = tIdx(Math.floor(r.x), Math.floor(r.y)); UI.selBot = 0;
  const html = `<div class="sheet-title"><div><h3>Rally point</h3></div></div>
    <p class="desc">Warbots here hold the area until you call them back. Ones with a flat battery walk to the nearest garrison to recharge, then return.</p>
    <div id="rl-info"></div>
    <button class="btn big" id="rl-recall">Call them back</button>
    <div class="section-label">Send more</div>
    <div class="stepper"><button class="btn" id="mv-minus">−</button><span class="n" id="mv-n">0</span>
      <button class="btn" id="mv-plus">+</button><button class="btn primary" id="mv-send" style="flex:1">Send warbots</button></div>`;
  openSheet('rally', r.id, html);
  const i = Math.floor(r.x), j = Math.floor(r.y);
  UI.moveN = Math.min(3, rallyAvailable(0, i, j));
  $('rl-recall').onclick = () => { const n = recallRally(r.id); toast(`${n} warbot${n !== 1 ? 's' : ''} called back.`, 'info'); sfx('click'); closeSheet(); };
  $('mv-minus').onclick = () => { UI.moveN = Math.max(1, UI.moveN - 1); refreshSheet(); };
  $('mv-plus').onclick = () => { UI.moveN = Math.min(rallyAvailable(0, i, j), UI.moveN + 1); refreshSheet(); };
  $('mv-send').onclick = () => { const res = sendToRally(0, i, j, UI.moveN); if (res.sent) { sfx('alert'); refreshSheet(); } else sfx('error'); };
  refreshSheet();
}

/** Shared stepper refresh for the move and rally panels. */
function refreshMoveStepper(i, j) {
  const avail = rallyAvailable(0, i, j);
  UI.moveN = clamp(UI.moveN || avail, Math.min(1, avail), avail);
  $('mv-n').textContent = UI.moveN;
  $('mv-send').disabled = avail === 0;
  return avail;
}

function openResourceSheet(t) {
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const type = S.res[t], info = RES[type];
  const by = Object.keys(BDEFS).find((k) => BDEFS[k].gather === type);
  const desc = type === R_CROP ? 'Planted by a Bio Farm on fertile soil. Once ripe, its worker harvests it into Fuel and plants a new one.'
    : type === R_OIL ? 'Build an Oil Pump right on top of the seep to pump Crude (it also draws from seep tiles next to it). A Refinery turns Crude into Fuel.'
    : `Gives ${GOOD[info.good].name}. Gathered by a ${BDEFS[by].name} within ${BDEFS[by].radius} tiles.${type === R_STALK ? ' A Grove Planter can grow more.' : ' It runs out eventually, so expand to find more.'}`;
  const html = `<div class="sheet-title"><div><h3>${info.name}</h3></div></div>
    <p class="desc">${desc}</p>
    <div id="sh-dyn"></div>`;
  openSheet('res', t, html);
  refreshSheet();
}

function openSoilSheet(t) {
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const html = `<div class="sheet-title"><div><h3>Fertile soil</h3></div></div>
    <p class="desc">Dark, rich ground. A Bio Farm within ${BDEFS.farm.radius} tiles plants energy crops here and harvests them into Fuel for your Charging Stations. Paths and buildings on it leave less room to farm.</p>`;
  openSheet('soil', t, html);
}

/** Crude left in the oil seep tiles around (i, j) that an Oil Pump there would draw from. */
function oilAround(i, j) {
  let n = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (inMap(i + di, j + dj) && S.res[tIdx(i + di, j + dj)] === R_OIL) n += S.amt[tIdx(i + di, j + dj)];
  }
  return n;
}

function refreshSheet() {
  if (!UI.sheetKind || UI.sheetKind === 'build') return;
  if (UI.sheetKind === 'bld') {
    const b = getE(UI.sheetFor);
    if (!b) { closeSheet(); return; }
    refreshBuildingSheet(b);
  } else if (UI.sheetKind === 'bot') {
    const u = getE(UI.sheetFor);
    if (!u || u.inside) { closeSheet(); return; }
    $('sh-status').textContent = botActivity(u);
    const bat = Math.round(u.bat ?? 100);
    $('sh-dyn').innerHTML = `<div class="kv"><span>Health</span><span>${Math.ceil(u.hp)} / ${u.maxHp}</span></div>` +
      `<div class="kv"><span>Battery</span><span>${bat}%${bat < BATTERY.critical ? ' (flat: slow and weak)' : bat < BATTERY.low ? ' (low)' : ''}</span></div>` +
      `<div class="bar battery"><div style="width:${bat}%;background:${bat < BATTERY.critical ? '#ff4d4d' : bat < BATTERY.low ? '#ffb347' : '#7ee08a'}"></div></div>` +
      (u.carry ? `<div class="kv"><span>Carrying</span><span>${goodTag(u.carry, GOOD[u.carry].name)}</span></div>` : '');
    if ($('sh-recall')) $('sh-recall').hidden = !(u.task && u.task.type === 'hold');
  } else if (UI.sheetKind === 'move') {
    const t = UI.sheetFor, i = t % S.W, j = (t / S.W) | 0;
    const avail = refreshMoveStepper(i, j);
    $('mv-info').innerHTML = `<p class="desc">${avail
      ? `${avail} warbot${avail > 1 ? 's' : ''} available in your garrisons (each keeps one at home).`
      : S.zone[t] !== homeZone(0) ? 'Your warbots cannot walk there from your garrisons.' : 'No warbots available. Make some at the Bot Foundry; they gather in your Lander and Outposts.'}</p>`;
  } else if (UI.sheetKind === 'rally') {
    const r = rallyById(UI.sheetFor);
    if (!r) { closeSheet(); return; }
    const members = rallyMembers(r.id);
    const low = members.filter((u) => (u.bat ?? 100) < BATTERY.low).length;
    $('rl-info').innerHTML = `<div class="kv"><span>Warbots holding</span><span>${members.length}</span></div>` +
      (low ? `<div class="kv"><span>Low battery</span><span>${low}</span></div>` : '');
    refreshMoveStepper(Math.floor(r.x), Math.floor(r.y));
  } else if (UI.sheetKind === 'res') {
    const t = UI.sheetFor;
    if (!S.res[t]) { closeSheet(); return; }
    const r = S.res[t];
    const grow = (r === R_STALK || r === R_CROP) && S.grow[t] < 1 ? `<div class="kv"><span>${r === R_CROP ? 'Ripening' : 'Growing'}</span><span>${Math.round(S.grow[t] * 100)}%</span></div>` : '';
    $('sh-dyn').innerHTML = r === R_CROP ? (grow || '<div class="kv"><span>Ripe</span><span>Ready to harvest</span></div>')
      : `<div class="kv"><span>${r === R_OIL ? 'Crude left' : 'Harvests left'}</span><span>${S.amt[t]}</span></div>${grow}`;
  }
}

/* ------------------------------------------------------------------ HUD */

const OBJECTIVES = [
  { text: 'Tap <b>Build</b> and place a <b>Harvester</b> beside the teal stalk groves.', done: () => hasBuilt('harvester') },
  { text: 'Build a <b>Quarry</b> near the grey boulders to get Stone.', done: () => hasBuilt('quarry') },
  { text: 'Build an <b>Ore Mine</b> by the dark ore veins and a <b>Crystal Tap</b> by the violet crystals.', done: () => hasBuilt('mine') && hasBuilt('tap') },
  { text: 'Build a <b>Smelter</b>: it turns Ore and Fiber into Alloy.', done: () => hasBuilt('smelter') },
  { text: 'Build a <b>Chip Fab</b>: it turns Crystal and Alloy into Chips.', done: () => hasBuilt('fab') },
  { text: 'Build a <b>Bot Foundry</b> so you can make more workers.', done: () => hasBuilt('foundry') },
  { text: 'Tap your <b>Bot Foundry</b> and order some <b>Workers</b>: it only builds the bots you ask for.', done: () => S.players[0].stats.bots > START_WORKERS + START_WARBOTS || S.buildings.some((b) => !b.dead && b.owner === 0 && hasOrders(b)) },
  { text: 'Build an <b>Outpost</b> near your border to claim more land.', done: () => hasBuilt('outpost') },
  { text: 'Tap <b>Paths</b> and draw roads between busy buildings so workers move faster.', done: () => S.road.reduce((a, v) => a + (v ? 1 : 0), 0) >= 6 },
  { text: 'Charging Stations burn <b>Fuel</b>. Build a <b>Bio Farm</b> beside the dark fertile soil to grow it.', done: () => hasBuilt('farm') },
];

function hasBuilt(type) {
  for (const b of S.buildings) if (!b.dead && b.owner === 0 && b.built && b.type === type) return true;
  return false;
}

function objectiveText() {
  for (const o of OBJECTIVES) if (!o.done()) return o.text;
  if (S.mode === 'colony') {
    const pct = Math.round(landShare(0) * 100);
    const next = COLONY_MILESTONES[S.milestone];
    return next !== undefined
      ? `Colonize the planet: <b>${pct}%</b> claimed. Next milestone at ${Math.round(next * 100)}%.`
      : `<b>${pct}%</b> of the planet colonized. Every milestone reached!`;
  }
  return 'Gather warbots in Outposts near the rival, then tap the <b>rival Lander</b> and send them in to capture it.';
}

function updateHUD() {
  const goods = playerGoods(0);
  for (const g of GOODS) {
    const el = UI.goodEls[g];
    const v = goods[g];
    if (UI.lastGoods[g] !== undefined && v > UI.lastGoods[g]) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    UI.lastGoods[g] = v;
    el.lastChild.textContent = v;
  }
  let workers = 0, idle = 0, war = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0) continue;
    if (u.type === 'warbot') war++;
    else { workers++; if (isIdleWorker(u)) idle++; }
  }
  $('pop').innerHTML = `<span class="dot" style="background:#ece6da;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[0]}"></span>${workers} workers <span style="color:var(--muted)">(${idle} free)</span>` +
    (S.mode === 'colony' ? '' : ` <span class="dot" style="background:${PLAYER_COLORS[0]};border-radius:2px;transform:rotate(45deg)"></span>${war}`);
  $('clock').textContent = S.mode === 'colony' ? `${Math.round(landShare(0) * 100)}% land` : fmtTime(S.time);
  const obj = $('objective');
  obj.innerHTML = UI.objCollapsed ? 'Goal ▸' : objectiveText();
  obj.classList.toggle('small', UI.objCollapsed);
  if (UI.sheetKind === 'build') {
    // keep build-menu affordability current without rebuilding the buttons
    for (const el of $('sheet-body').querySelectorAll('.bcard')) {
      const cost = BDEFS[el.dataset.t].cost;
      el.querySelector('.bcost').innerHTML = costHTML(cost, goods);
      const have = el.querySelector('.bhave');
      const txt = ownedText(el.dataset.t);
      if (have.textContent !== txt) have.textContent = txt;
      have.classList.toggle('some', txt !== 'None yet' && txt !== '');
    }
  }
}

function toast(text, kind, x, y) {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || 'info');
  el.textContent = text;
  if (x !== undefined && (x || y)) el.onclick = () => centerOn(x + 0.5, y + 0.5);
  // Repeat messages (e.g. several buildings finishing at once) collapse into one line.
  const prev = box.lastElementChild;
  if (prev && prev.dataset.text === text) {
    prev.dataset.n = (+prev.dataset.n || 1) + 1;
    prev.textContent = `${text} ×${prev.dataset.n}`;
    return;
  }
  el.dataset.text = text;
  box.appendChild(el);
  while (box.children.length > 2) box.removeChild(box.firstChild);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, 3800);
}

function uiTick(dt) {
  AUDIO.suppress = !UI.inGame;
  if (!UI.inGame || !S) return;
  while (S.msgs.length) {
    const m = S.msgs.shift();
    toast(m.text, m.kind, m.x, m.y);
  }
  UI.hudT -= dt;
  if (UI.hudT <= 0) { UI.hudT = 0.25; updateHUD(); refreshSheet(); placeMinimap(); }
  if (S.winner >= 0 && !UI.overShown) showGameOver();
}

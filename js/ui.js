'use strict';
/*
 * Terrafall — HTML interface: menus, HUD, build menu, info sheets, objectives, messages.
 */

const UI = {
  inGame: false, paused: false, speed: 1, overShown: false,
  menu: { mode: 'versus', diff: 'normal', seed: randomSeed(), size: { ...DEFAULT_SIZE }, rough: DEFAULT_ROUGH, rich: DEFAULT_RICH, shape: 0 },
  sheetKind: null, sheetFor: 0, sheetT: 0, hudT: 0,
  icons: {}, attackN: 0, demolishArm: 0, lastPaint: null, placeType: null,
  goodEls: {}, lastGoods: {}, objCollapsed: false, selBot: 0,
  sel: [], groups: {}, lastGroup: { k: 0, at: 0 }, lastAlert: null, tipKey: '',
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
    el.setAttribute('aria-label', GOOD[g].name);
    el.dataset.g = g;
    el.innerHTML = `<i class="gi ${g}"></i><span>0</span>`;
    // Hover (mouse) or tap (touch) shows the good's name and what it's for.
    el.onpointerenter = (e) => { if (e.pointerType === 'mouse') showGoodTip(g, el, 0); };
    el.onpointerleave = (e) => { if (e.pointerType === 'mouse') hideGoodTip(); };
    // Tap (or click) opens the goods panel on this good: stock, rates, makers, users and shortfalls.
    el.onclick = () => { hideGoodTip(); sfx('click'); if (UI.sheetKind === 'goods' && UI.goodSel === g) closeSheet(); else { setMode('normal'); openGoodsSheet(g); } };
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
    try { localStorage.setItem('botfall.settings', JSON.stringify({ size: UI.menu.size, rough: UI.menu.rough, rich: UI.menu.rich, shape: UI.menu.shape, nuke: UI.menu.nuke })); } catch (e) { /* storage unavailable */ }
  };
  $('m-size').oninput = () => { UI.menu.size[UI.menu.mode] = +$('m-size').value; syncMenu(); saveSettings(); };
  $('m-rough').oninput = () => { UI.menu.rough = +$('m-rough').value; syncMenu(); saveSettings(); };
  $('m-shape').oninput = () => { UI.menu.shape = +$('m-shape').value; syncMenu(); saveSettings(); };
  $('m-nuke').oninput = () => { UI.menu.nuke = +$('m-nuke').value; syncMenu(); saveSettings(); };
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

  // Game over (missions swap in their own actions)
  $('o-new').onclick = () => { $('screen-over').hidden = true; if (UI.overNew) UI.overNew(); else { UI.menu.seed = randomSeed(); startNewGame(); } };
  $('o-menu').onclick = () => { $('screen-over').hidden = true; toMenu(); if (UI.overMenu) UI.overMenu(); };
  $('m-missions').onclick = () => { sfx('click'); openMissions(); };
  $('ms-close').onclick = () => { sfx('click'); if (UI.msSel != null) { UI.msSel = null; renderMissions(); } else $('screen-missions').hidden = true; };
  $('o-statsbtn').onclick = () => { sfx('click'); openStats(); };
  $('p-stats').onclick = () => { sfx('click'); openStats(); };
  $('st-close').onclick = () => { sfx('click'); $('screen-stats').hidden = true; };

  // HUD tools
  $('btn-build').onclick = () => { sfx('click'); if (UI.sheetKind === 'build') closeSheet(); else { setMode('normal'); openBuildMenu(); } };
  $('btn-road').onclick = () => { sfx('click'); setMode(R.mode === 'road' ? 'normal' : 'road'); };
  $('btn-attack').onclick = () => { sfx('click'); setMode(R.mode === 'attack' ? 'normal' : 'attack'); };
  $('btn-home').onclick = () => {
    const L = getE(S.players[0].lander);
    if (L) { centerOn(L.x + 0.5, L.y + 0.5); openBuildingSheet(L); }
  };
  $('btn-speed').onclick = (e) => { e.stopPropagation(); sfx('click'); toggleSpeedMenu(); };
  $('pop').onclick = () => { sfx('click'); if (UI.sheetKind === 'pop') closeSheet(); else { setMode('normal'); openPopSheet(); } };
  window.addEventListener('pointerdown', (e) => {
    if (!$('speed-menu').hidden && !$('speed-menu').contains(e.target) && e.target !== $('btn-speed')) $('speed-menu').hidden = true;
  });
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

  initKeyboard();
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
    : 'Race a rival colony across the planet. Build up, then capture its Command Base to win.';
  $('m-seed').textContent = 'Planet #' + UI.menu.seed;
  const size = UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode];
  $('m-size').value = size;
  $('m-rough').value = UI.menu.rough;
  $('m-shape').value = UI.menu.shape || 0;
  $('m-nuke').value = UI.menu.nuke || 0;
  $('m-nuke-v').textContent = UI.menu.nuke ? 'On: race for uranium' : 'Off';

  $('m-shape-v').textContent = SHAPE_PRESETS[UI.menu.shape || 0].name;
  $('m-rich').value = UI.menu.rich;
  const dims = mapDims({ size, shape: UI.menu.shape || 0 });
  $('m-size-v').textContent = `${SIZE_PRESETS[size].name} · ${dims.W}×${dims.H}`;
  $('m-rough-v').textContent = TERRAIN_PRESETS[UI.menu.rough].name;
  $('m-rich-v').textContent = RESOURCE_PRESETS[UI.menu.rich].name;
  $('m-continue').hidden = !hasSave();
}

/* ------------------------------------------------------------------ goods tooltip */

/** A small label under a goods counter: the good's name, how many you have and what it's for. */
function showGoodTip(g, el, ms) {
  let tip = $('good-tip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'good-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  clearTimeout(UI.tipTimer);
  tip.innerHTML = `<b>${GOOD[g].name}</b> <em>${el.lastChild.textContent}</em><span>${GOOD[g].desc}</span>`;
  tip.hidden = false;
  tip.dataset.g = g;
  const r = el.getBoundingClientRect(), w = tip.offsetWidth;
  tip.style.top = Math.round(r.bottom + 6) + 'px';
  tip.style.left = Math.round(clamp(r.left + r.width / 2 - w / 2, 8, window.innerWidth - w - 8)) + 'px';
  if (ms) UI.tipTimer = setTimeout(hideGoodTip, ms);
}

function hideGoodTip() {
  clearTimeout(UI.tipTimer);
  if ($('good-tip')) $('good-tip').hidden = true;
}

/* ------------------------------------------------------------------ keyboard (desktop) */

/*
 * B build (then a building's letter, or R for roads) · P paths (R roads, G bridges and tunnels, O one-way arrows,
 * L junctions, T traffic map) · A army · H base · F select every warbot · 1–9 control groups (Ctrl or
 * Shift + digit to save) · J jump to the latest alert · Esc back / clear selection / pause ·
 * Space pause · [ ] game speed · arrow keys pan · + and - zoom · M minimap · ? help
 */
const PAN_KEYS = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };

/** Build-menu hotkeys: with the build menu open, a building's letter starts placing it (and R lays roads). */
const BUILD_KEYS = {
  harvester: 'h', quarry: 'q', mine: 'm', tap: 'c', smelter: 's', fab: 'f', foundry: 'u', charger: 'e', farm: 'a',
  pump: 'p', refinery: 'v', kiln: 'k', tarworks: 't', roadworks: 'w', outpost: 'o', turret: 'g', repair: 'x',
  armory: 'i', munitions: 'n', silo: 'z', depot: 'd', grower: 'l', reactor: 'y', nukesilo: 'j',
};

/** Open Paths on one of its tools (roads, bridges, ramps, arrows, junctions). */
function openPaths(v) {
  if (R.mode !== 'road') setMode('road');
  UI.roadMode = v;
  showRoadBanner();
  sfx('click');
}

function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!UI.inGame) return;
    // Control groups: Ctrl (or Shift) + 1–9 saves the selected warbots, 1–9 selects them again
    // (press twice to jump to them).
    const digit = /^Digit([1-9])$/.exec(e.code || '');
    if (digit && !e.altKey && $('screen-pause').hidden) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.shiftKey) saveGroup(+digit[1]); else recallGroup(+digit[1]);
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); escapeKey(); return; }
    const overlay = !$('screen-pause').hidden || !$('screen-help').hidden || !$('screen-stats').hidden || !$('screen-over').hidden;
    if (k === ' ' || k === 'spacebar') {
      e.preventDefault();
      if (!$('screen-pause').hidden) $('p-resume').click(); else if (!overlay) $('btn-pause').click();
      return;
    }
    if (overlay) return;
    if (PAN_KEYS[k]) { e.preventDefault(); R.keys.add(k); return; }
    // In the build menu, a building's letter picks it.
    if (UI.sheetKind === 'build') {
      const type = Object.keys(BUILD_KEYS).find((t) => BUILD_KEYS[t] === k);
      const card = type && $('sheet-body').querySelector(`.bcard[data-t="${type}"]`);
      if (card && !card.disabled) { e.preventDefault(); card.click(); return; }
    }
    switch (k) {
      case 'b': $('btn-build').click(); break;
      case 'p': $('btn-road').click(); break;
      case 'r': openPaths('road'); break;
      case 'o': openPaths('arrows'); break;
      case 'g': openPaths('bridge'); break;
      case 'v': openPaths('ramp'); break;
      case 't': if (R.mode !== 'road') setMode('road'); R.traffic = !R.traffic; showRoadBanner(); sfx('click'); break;
      case 'l': openPaths('lights'); break;
      case 'a': if (!$('btn-attack').hidden) $('btn-attack').click(); break;
      case 'h': case 'home': $('btn-home').click(); break;
      case 'm': setMinimap(!MM.on); break;
      case 'f': selectBots(armyIds(0), false); if (UI.sel.length) toast(`${UI.sel.length} warbots selected: right-click to give orders.`, 'info'); break;
      case 'j': if (UI.lastAlert) { centerOn(UI.lastAlert.x + 0.5, UI.lastAlert.y + 0.5); sfx('click'); } break;
      case '[': stepSpeed(-1); break;
      case ']': stepSpeed(1); break;
      case '+': case '=': zoomBy(1.25); break;
      case '-': case '_': zoomBy(0.8); break;
      case '?': $('screen-help').hidden = false; UI.paused = true; break;
      default: return;
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => R.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => R.keys.clear());
}

/* ------------------------------------------------------------------ selecting and ordering warbots (mouse) */

const EDGE_SCROLL = 6; // pixels from the window edge where the map scrolls

/** Select these warbots (or add them to the selection). */
function selectBots(ids, add) {
  const mine = orderable(0, ids).map((u) => u.id);
  UI.sel = add ? [...new Set(UI.sel.concat(mine))] : mine;
  refreshSelection();
}

/** Drop dead or captured warbots from the selection and update the selection bar. */
function refreshSelection() {
  if (UI.sel.length) UI.sel = orderable(0, UI.sel).map((u) => u.id);
  UI.selSet = new Set(UI.sel);
  const bar = $('selbar');
  if (!UI.sel.length || !UI.inGame) { bar.hidden = true; return; }
  let inside = 0, empty = 0;
  for (const u of orderable(0, UI.sel)) { if (u.inside) inside++; if ((u.ammo ?? WARBOT_AMMO) <= 0) empty++; }
  const html = `<b>${UI.sel.length} warbot${UI.sel.length > 1 ? 's' : ''} selected</b>` +
    (inside ? ` <span class="muted">(${inside} in garrisons)</span>` : '') + (empty ? ` <span class="err">${empty} out of Ammo</span>` : '') +
    `<span class="hint">Right-click open ground to hold it, a rival building to attack, or your Outpost to station them. Esc clears.</span>
    <button class="btn small ghost" id="selbar-clear" aria-label="Clear selection">✕</button>`;
  if (bar.dataset.html !== html) {
    bar.dataset.html = html;
    bar.innerHTML = html;
    $('selbar-clear').onclick = () => { sfx('click'); selectBots([], false); };
  }
  bar.hidden = false;
}

/** A drag box (screen pixels) selects your warbots inside it; with Shift it adds to the selection. */
function onSelectBox(box, add) {
  const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1), y0 = Math.min(box.y0, box.y1), y1 = Math.max(box.y0, box.y1);
  const ids = [];
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0 || u.type !== 'warbot' || u.inside) continue;
    const p = worldToScreen(u.x, u.y);
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(u.id);
  }
  // A box round your own garrisons picks up their spare warbots too (each keeps one at home).
  for (const b of S.buildings) {
    if (b.dead || b.owner !== 0 || !b.garrison || b.garrison.length < 2) continue;
    const p = worldToScreen(b.x + 0.5, b.y + 0.5);
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(...b.garrison.slice(1));
  }
  selectBots(ids, add);
  if (ids.length) sfx('click');
}

/** Right-click: order the selected warbots to whatever is under the pointer. */
function onMapCommand(i, j, wx, wy) {
  if (!UI.inGame || UI.paused || !UI.sel.length || R.mode !== 'normal') return;
  const b = buildingAtTap(i, j, wx, wy);
  let n = 0, what = '';
  if (b && b.owner !== 0) { n = orderAttack(0, UI.sel, b); what = `attacking the ${BDEFS[b.type].name}`; }
  else if (b && BDEFS[b.type].mil && b.built) { n = orderStation(0, UI.sel, b); what = `heading to the ${BDEFS[b.type].name}`; }
  else if (inMap(i, j) && walkable(tIdx(i, j)) && !b) { n = orderMove(0, UI.sel, i, j); what = 'moving to hold that ground'; }
  else { sfx('error'); toast('Right-click open ground, a rival building or one of your garrisons.', 'warn'); return; }
  if (!n) {
    sfx('error');
    toast(b && b.owner === 0 ? 'That garrison is full.' : 'None of the selected warbots have Ammo: they reload in a garrison first.', 'warn');
    return;
  }
  sfx('alert');
  addFx('ring', (b ? b.x : i) + 0.5, (b ? b.y : j) + 0.5, { color: b && b.owner !== 0 ? '#ff5a6e' : '#7dffa0' });
  toast(`${n} warbot${n > 1 ? 's' : ''} ${what}.`, 'info');
  refreshSelection();
}

/** Control groups: Ctrl/Shift + digit saves the selection; the digit selects it again, twice to jump there. */
function saveGroup(k) {
  if (!UI.sel.length) { toast(`Select warbots first (drag a box round them), then Ctrl+${k} saves them as group ${k}.`, 'info'); return; }
  UI.groups[k] = UI.sel.slice();
  sfx('click');
  toast(`Group ${k}: ${UI.sel.length} warbot${UI.sel.length > 1 ? 's' : ''}. Press ${k} to select them again.`, 'info');
}

function recallGroup(k) {
  const ids = orderable(0, UI.groups[k] || []).map((u) => u.id);
  if (!ids.length) return;
  const twice = UI.lastGroup.k === k && performance.now() - UI.lastGroup.at < 450;
  UI.lastGroup = { k, at: performance.now() };
  selectBots(ids, false);
  sfx('click');
  if (twice) {
    let x = 0, y = 0;
    for (const u of orderable(0, ids)) { x += u.x; y += u.y; }
    centerOn(x / ids.length, y / ids.length);
  }
}

/** On a computer, resting the mouse on a building or bot shows what it is and what it's doing. */
function updateMapTip() {
  const tip = $('map-tip'), m = R.mouse;
  if (!m || !UI.inGame || UI.sheetKind || R.mode !== 'normal' || INPUT.gesture || performance.now() - m.at < 350) { tip.hidden = true; UI.tipKey = ''; return; }
  const w = screenToWorld(m.x, m.y), i = Math.floor(w.x), j = Math.floor(w.y);
  let html = '', key = '';
  const b = buildingAtTap(i, j, w.x, w.y);
  if (b) {
    const def = BDEFS[b.type];
    key = 'b' + b.id;
    html = `<b>${b.owner === 0 ? '' : 'Rival '}${def.name}</b>` + (b.owner === 0 && b.status ? `<em>${b.status}</em>` : '') +
      (def.mil && !(b.owner === 0 && b.status) ? `<em>${b.garrison.length} warbot${b.garrison.length === 1 ? '' : 's'} inside</em>` : '') +
      (b.armor < def.armor ? `<em>Armor ${Math.ceil(b.armor)}/${def.armor}</em>` : '');
  } else {
    let bot = null, bd = 0.3;
    for (const u of S.bots) {
      if (u.dead || u.inside) continue;
      const d = dist2(u.x, u.y, w.x, w.y);
      if (d < bd) { bd = d; bot = u; }
    }
    if (bot) {
      key = 'u' + bot.id;
      html = `<b>${bot.owner === 0 ? '' : 'Rival '}${BOTS[bot.type].name}</b>` + (bot.owner === 0 ? `<em>${botActivity(bot)}</em>` : '') +
        `<em>Health ${Math.ceil(bot.hp)}/${bot.maxHp}${bot.owner === 0 ? ` · battery ${Math.round(bot.bat ?? 100)}%` : ''}</em>`;
    } else if (inMap(i, j) && S.res[tIdx(i, j)]) {
      const t = tIdx(i, j);
      key = 'r' + t;
      html = `<b>${richRes(t) ? 'Rich ' + RES[S.res[t]].name.toLowerCase() : RES[S.res[t]].name}</b><em>${S.amt[t]} ${GOOD[RES[S.res[t]].good].name} left</em>`;
    }
  }
  if (!html) { tip.hidden = true; UI.tipKey = ''; return; }
  if (UI.tipKey !== key + html) { UI.tipKey = key + html; tip.innerHTML = html; }
  tip.hidden = false;
  tip.style.left = Math.round(Math.min(m.x + 16, window.innerWidth - tip.offsetWidth - 8)) + 'px';
  tip.style.top = Math.round(Math.min(m.y + 18, window.innerHeight - tip.offsetHeight - 8)) + 'px';
}

/* ------------------------------------------------------------------ game speed */

/** Game speeds on offer: two slower than normal for a calmer game, two faster for waiting on something. */
const SPEEDS = [0.75, 0.875, 1, 2, 3];

function setSpeed(v, quiet) {
  UI.speed = v;
  $('btn-speed').textContent = v + '×';
  $('btn-speed').classList.toggle('slow', v < 1);
  $('btn-speed').classList.toggle('fast', v > 1);
  if (!quiet) sfx('click');
  if (!$('speed-menu').hidden) toggleSpeedMenu(true);
}

/** Step to the next slower (-1) or faster (+1) speed. */
function stepSpeed(d) {
  const k = SPEEDS.indexOf(UI.speed);
  setSpeed(SPEEDS[clamp((k < 0 ? 2 : k) + d, 0, SPEEDS.length - 1)]);
  toast(`Game speed ${UI.speed}×`, 'info');
}

/** The speed menu under the speed chip in the top bar. */
function toggleSpeedMenu(refresh) {
  const m = $('speed-menu');
  if (!refresh && !m.hidden) { m.hidden = true; return; }
  m.innerHTML = SPEEDS.map((v) => `<button role="menuitemradio" aria-checked="${v === UI.speed}" class="${v === UI.speed ? 'on' : ''}" data-v="${v}">${v}×</button>`).join('');
  for (const b of m.children) b.onclick = () => { setSpeed(+b.dataset.v); m.hidden = true; };
  const r = $('btn-speed').getBoundingClientRect();
  m.hidden = false;
  m.style.top = Math.round(r.bottom + 6) + 'px';
  m.style.left = Math.round(clamp(r.left + r.width / 2 - m.offsetWidth / 2, 8, window.innerWidth - m.offsetWidth - 8)) + 'px';
}

/** Esc steps back: close a panel, leave a mode, close a screen, or open the pause menu. */
function escapeKey() {
  if (!$('speed-menu').hidden) { $('speed-menu').hidden = true; return; }
  if (!$('screen-help').hidden) { $('h-close').click(); return; }
  if (!$('screen-stats').hidden) { $('st-close').click(); return; }
  if (!$('screen-pause').hidden) { $('p-resume').click(); return; }
  if (!$('screen-over').hidden) return;
  if (UI.sheetKind) { closeSheet(); return; }
  if (R.mode === 'road' && !draftEmpty()) { draftReset(); showRoadBanner('Plan cleared.', true); return; }
  if (R.mode !== 'normal') { setMode('normal'); return; }
  if (UI.sel.length) { selectBots([], false); return; }
  $('btn-pause').click();
}

function zoomBy(f) {
  R.cam.z = clamp(R.cam.z * f, minZoom(), maxZoom());
  clampCam();
}

/** Held arrow / WASD keys pan the map (called every frame). */
function keyPan(dt) {
  if (!UI.inGame) return;
  let dx = 0, dy = 0;
  for (const k of R.keys) if (PAN_KEYS[k]) { dx += PAN_KEYS[k][0]; dy += PAN_KEYS[k][1]; }
  // Edge scrolling on a computer: the map moves when the mouse rests at the edge of the window.
  const m = R.mouse, E = EDGE_SCROLL;
  if (m && isWide() && !INPUT.gesture && document.hasFocus()) {
    if (m.x <= E) dx -= 1; else if (m.x >= window.innerWidth - 1 - E) dx += 1;
    if (m.y <= E) dy -= 1; else if (m.y >= window.innerHeight - 1 - E) dy += 1;
  }
  if (!dx && !dy) return;
  const sp = (Math.max(R.w, R.h) * 0.9 * dt) / R.cam.z;
  R.cam.x += dx * sp; R.cam.y += dy * sp;
  clampCam();
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
  document.documentElement.style.setProperty('--hud-top', top);
  document.documentElement.style.setProperty('--mm-w', MM.w + 'px');
}

/* ------------------------------------------------------------------ game flow */

function startNewGame() {
  clearSave();
  newGame({
    seed: UI.menu.seed, difficulty: UI.menu.diff, mode: UI.menu.mode,
    size: UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], rough: UI.menu.rough, rich: UI.menu.rich, shape: UI.menu.shape || 0,
    nuke: !!UI.menu.nuke,
  });
  enterGame();
  updateHUD();
  placeMinimap();
  postMsg(0, UI.menu.mode === 'colony'
    ? 'Your bots have landed. Build, expand and make this planet home.'
    : 'Your bots have landed. A rival colony landed to the north. Build up fast!', 0, 0, 'info');
  if (nukeOn()) postMsg(0, 'Nuclear race: a few uranium deposits glow green across the planet. Dig them with Ore Mines, enrich them at a Nuclear Reactor and build the bomb before the rival does.', 0, 0, 'warn');
}

function continueGame() {
  if (!loadGame()) { syncMenu(); return; }
  enterGame();
  postMsg(0, 'Welcome back.', 0, 0, 'info');
}

function enterGame() {
  bakeMap();
  UI.inGame = true; UI.paused = false; UI.overShown = false;
  UI.sel = []; UI.groups = {}; UI.lastAlert = null;
  setSpeed(1, true);
  $('screen-menu').hidden = true;
  $('hud').hidden = false;
  $('toasts').innerHTML = '';
  const colony = S.mode === 'colony';
  $('btn-attack').hidden = !warOn();
  for (const g of WAR_GOODS) UI.goodEls[g].hidden = !warOn();
  for (const g of NUKE_GOODS) UI.goodEls[g].hidden = !nukeOn();
  // More than seven goods don't fit one row on a phone: split them over two (widescreen: one row).
  const nGoods = GOODS.length - (warOn() ? 0 : WAR_GOODS.length) - (nukeOn() ? 0 : NUKE_GOODS.length);
  $('goods').style.setProperty('--goods-cols', nGoods > 7 ? Math.ceil(nGoods / 2) : nGoods);
  $('goods').classList.toggle('two-rows', nGoods > 7);
  $('bottombar').classList.toggle('three', !warOn());
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
  hideGoodTip();
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
  UI.overNew = null; UI.overMenu = null;
  $('o-new').textContent = 'New game'; $('o-menu').textContent = 'Main menu';
  $('o-code').hidden = true;
  if (S.mission) { showMissionOver(); return; }
  const won = S.winner === 0;
  sfx(won ? 'win' : 'lose');
  $('o-title').textContent = won ? 'Victory!' : 'Defeat';
  $('o-text').textContent = won
    ? 'Your warbots captured the rival Command Base. The planet is yours.'
    : 'The rival captured your Command Base. Regroup and try again.';
  const st = S.players[0].stats;
  $('o-stats').innerHTML = [
    ['Time', fmtTime(S.time)], ['Buildings completed', st.built], ['Bots built', st.bots - (st.startBots || 0)],
    ['Enemy buildings captured', st.captured], ['Bots lost', st.lost],
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  $('screen-over').hidden = false;
}

/* ------------------------------------------------------------------ missions */

function openMissions() {
  UI.msSel = null;
  $('screen-missions').hidden = false;
  renderMissions();
}

function missionMeta(def, diff) {
  const size = SIZE_PRESETS[def.size].name, terr = TERRAIN_PRESETS[def.rough].name;
  const limit = def.limit[diff] ? ` · ${def.limit[diff]} min limit` : '';
  return def.mode === 'colony' ? `Colony · ${size} · ${terr}${limit}` : `Versus · ${size} · ${terr} · ${DIFFICULTY[def.rival[diff]].label} rival${limit}`;
}

function renderMissions(msg) {
  const c = loadCampaign();
  const body = $('ms-body');
  if (UI.msSel == null) {
    body.innerHTML = `<p class="desc">Eight missions with their own goals. Finish one to unlock the next. Each has three difficulty levels.</p>
      <div class="ms-list">${MISSIONS.map((m, k) => {
        const done = c.done[m.id] || [];
        const marks = MISSION_DIFF_NAMES.map((n, d) => (done[d] ? `<span class="ms-done">${n} ✓</span>` : '')).filter(Boolean).join(' ');
        return `<button class="ms-item" data-k="${k}" ${k > c.unlocked ? 'disabled' : ''}><span class="ms-num">${k + 1}</span>
          <span class="ms-name">${m.name}</span><span class="ms-meta">${k > c.unlocked ? 'Locked' : marks || (m.mode === 'colony' ? 'Colony' : 'Versus')}</span></button>`;
      }).join('')}</div>
      <div class="section-label" style="margin-top:14px">Have an unlock code?</div>
      <div class="ms-code"><input id="ms-input" maxlength="7" placeholder="ABC-123" autocomplete="off" autocapitalize="characters"><button class="btn" id="ms-redeem">Unlock</button></div>
      <p class="hint" id="ms-msg">${msg || 'Finishing a mission shows the code for the next one, so you can unlock it on another device.'}</p>`;
    for (const el of body.querySelectorAll('.ms-item')) el.onclick = () => { sfx('click'); UI.msSel = +el.dataset.k; UI.msDiff = UI.msDiff ?? 1; renderMissions(); };
    $('ms-redeem').onclick = () => {
      const k = redeemCode($('ms-input').value);
      sfx(k >= 0 ? 'complete' : 'error');
      renderMissions(k >= 0 ? `Unlocked mission ${k + 1}: ${MISSIONS[k].name}.` : 'That code didn\'t match any mission.');
    };
    return;
  }
  const k = UI.msSel, def = MISSIONS[k], diff = UI.msDiff ?? 1;
  const done = c.done[def.id] || [];
  body.innerHTML = `<p class="hint" style="margin-top:6px">Mission ${k + 1} of ${MISSIONS.length}</p>
    <h3 style="margin:2px 0 6px;font-size:20px">${def.name}</h3>
    <p class="desc">${def.brief}</p>
    <div class="section-label" style="margin-top:12px">Difficulty</div>
    <div class="seg" id="ms-diff">${MISSION_DIFF_NAMES.map((n, d) => `<button data-d="${d}" class="${d === diff ? 'on' : ''}">${n}${done[d] ? ' ✓' : ''}</button>`).join('')}</div>
    <p class="hint">${missionMeta(def, diff)}</p>
    <div class="section-label" style="margin-top:12px">Goals</div>
    <ul class="ms-goals">${def.goals.map((g) => `<li>${goalText(g, diff)}</li>`).join('')}</ul>
    <button class="btn primary big" id="ms-start">Start mission</button>`;
  for (const btn of $('ms-diff').children) btn.onclick = () => { UI.msDiff = +btn.dataset.d; sfx('click'); renderMissions(); };
  $('ms-start').onclick = () => { audioUnlock(); startMission(k, diff); };
}

/** A goal's description without a game running (for the mission briefing). */
function goalText(g, diff) {
  const n = goalNeed(g, diff);
  switch (g.kind) {
    case 'built': return n > 1 ? `Build ${n} ${BDEFS[g.type].name}s` : `Build ${aOrAn(BDEFS[g.type].name)}`;
    case 'made': return `Make ${n} ${GOOD[g.good].name}`;
    case 'bots': return `Build ${n} new ${g.type ? BOTS[g.type].plural : 'bots'} at the Foundry`;
    case 'own': return `Have ${n} ${BOTS[g.type].plural}`;
    case 'paths': return `${['', 'Lay', 'Surface'][g.tier]} ${n} ${['', 'road', 'asphalt road'][g.tier]} tiles`;
    case 'oneway': return `Make ${n} road tiles one-way`;
    case 'land': return `Claim ${n}% of the land`;
    case 'outposts': return n > 1 ? `Capture ${n} rival Outposts` : 'Capture a rival Outpost';
    case 'capture': return 'Capture the rival Command Base';
  }
  return '';
}

function startMission(k, diff) {
  clearSave();
  $('screen-missions').hidden = true;
  newGame(missionOptions(k, diff));
  enterGame();
  updateHUD();
  placeMinimap();
  UI.objCollapsed = false;
  postMsg(0, `Mission ${k + 1}: ${MISSIONS[k].name}. ${MISSIONS[k].brief}`, 0, 0, 'info');
}

/** The goal banner during a mission: each goal with progress, and the clock if there's a limit. */
function missionObjectiveHTML() {
  const M = S.mission, def = MISSIONS[M.k];
  const states = def.goals.map((g) => goalState(g, M.diff));
  if (UI.objCollapsed) return `Mission ▸ ${states.filter((s) => s.done).length}/${states.length}`;
  const left = M.limit ? Math.max(0, M.limit - S.time) : 0;
  return `<b>${def.name}</b>${M.limit ? ` · ${fmtTime(left)} left` : ''}<ul class="obj-goals">${states.map((s) =>
    `<li class="${s.done ? 'done' : ''}">${s.done ? '✓' : '○'} ${s.text}${s.need > 1 && !s.done ? ` (${s.have}/${s.need})` : ''}</li>`).join('')}</ul>`;
}

function showMissionOver() {
  finishMission();
  const M = S.mission, def = MISSIONS[M.k];
  const won = M.result === 'won';
  sfx(won ? 'win' : 'lose');
  $('o-title').textContent = won ? 'Mission complete' : 'Mission failed';
  $('o-text').textContent = won
    ? `${def.name} (${MISSION_DIFF_NAMES[M.diff]}) done in ${fmtTime(S.time)}.`
    : M.why === 'time' ? `${def.name}: time ran out before every goal was met.`
      : M.why === 'lander' ? `${def.name}: the rival captured your Command Base.` : `${def.name}: the game ended before every goal was met.`;
  $('o-stats').innerHTML = def.goals.map((g) => { const s = goalState(g, M.diff); return `<span>${s.done ? '✓' : '✗'} ${s.text}</span><span>${s.need > 1 ? `${s.have}/${s.need}` : s.done ? 'Done' : '–'}</span>`; }).join('');
  if (won) {
    completeMission(M.k, M.diff);
    if (M.k + 1 < MISSIONS.length) {
      $('o-code').hidden = false;
      $('o-code').innerHTML = `Mission ${M.k + 2}, <b style="font-size:inherit;letter-spacing:0;color:var(--text)">${MISSIONS[M.k + 1].name}</b>, is unlocked. Its code, to unlock it on another device: <br><b>${missionCode(M.k + 1)}</b>`;
      $('o-new').textContent = 'Next mission';
      UI.overNew = () => startMission(M.k + 1, M.diff);
    } else {
      $('o-code').hidden = false;
      $('o-code').textContent = 'That was the last mission: the campaign is complete!';
      $('o-new').textContent = 'Play it again';
      UI.overNew = () => startMission(M.k, M.diff);
    }
  } else {
    $('o-new').textContent = 'Try again';
    UI.overNew = () => startMission(M.k, M.diff);
  }
  $('o-menu').textContent = 'Missions';
  UI.overMenu = () => { openMissions(); UI.msSel = won && M.k + 1 < MISSIONS.length ? M.k + 1 : M.k; UI.msDiff = M.diff; renderMissions(); };
  $('screen-over').hidden = false;
}

/* ------------------------------------------------------------------ statistics screen */

function openStats() {
  UI.stats = UI.stats || { good: 'alloy', type: null };
  $('screen-stats').hidden = false;
  renderStats();
}

function renderStats() {
  const H = S.hist || { t: [], p: [{}, {}] };
  const versus = S.mode !== 'colony';
  const P = S.players[0], st = P.stats;
  const made = Object.values(P.made || {}).reduce((a, v) => a + v, 0);
  const tiles = [['Time', fmtTime(S.time)], ['Buildings built', st.built], ['Bots built', st.bots - (st.startBots || 0)],
    ['Goods produced', made.toLocaleString()], versus ? ['Rival buildings taken', st.captured] : ['Land claimed', Math.round(landShare(0) * 100) + '%'],
    ['Bots lost', st.lost]];
  const players = versus ? [0, 1] : [0];
  const names = ['You', 'Rival'];
  const ser = (fn) => players.map((p) => ({ name: names[p], color: CHART.series[p], values: fn(H.p[p] || {}) }));
  const goodsList = GOODS.filter((g) => (warOn() || !WAR_GOODS.includes(g)) && (nukeOn() || !NUKE_GOODS.includes(g)));
  if (!goodsList.includes(UI.stats.good)) UI.stats.good = 'alloy';
  const use = usageByType(0);
  const rows = Object.keys(use).map((k) => ({ key: k, label: BDEFS[k].name, note: use[k].n > 1 ? '×' + use[k].n : '', value: Math.round((use[k].use / use[k].up) * 100) }))
    .sort((a, b) => b.value - a.value);
  if (!UI.stats.type || !use[UI.stats.type]) UI.stats.type = rows.length ? rows[0].key : null;
  const botsSer = ser((h) => (h.civ || []).map((v, k) => v + ((h.war || [])[k] || 0)));
  const landSer = ser((h) => h.land || []);
  const goodSer = ser((h) => (h.goods && h.goods[UI.stats.good]) || []);
  $('st-body').innerHTML = `
    <div class="stat-tiles">${tiles.map(([k, v]) => `<div class="stat-tile"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <div class="chart-block"><h3>Bots</h3><p class="sub">Every bot you own, workers and warbots together. Drag across a chart to read it.</p>${chartLegend(botsSer)}<canvas class="chart" id="ch-bots"></canvas></div>
    <div class="chart-block"><h3>Land claimed</h3><p class="sub">Share of the land bots can reach.</p>${chartLegend(landSer)}<canvas class="chart" id="ch-land"></canvas></div>
    <div class="chart-block"><h3>Goods on hand</h3><p class="sub">In storage plus finished goods waiting in buildings.</p>
      <div class="pick-row" id="st-goods">${goodsList.map((g) => `<button data-g="${g}" class="${g === UI.stats.good ? 'on' : ''}"><i class="gi ${g}"></i>${GOOD[g].name}</button>`).join('')}</div>
      ${chartLegend(goodSer)}<canvas class="chart" id="ch-goods"></canvas></div>
    <div class="chart-block"><h3>How busy your buildings were</h3><p class="sub">Share of the time each kind of building was working, over the whole game. Tap one to see it over time.</p>
      <div id="st-bars">${barChartHTML(rows, UI.stats.type)}</div></div>
    <div class="chart-block" id="st-use-block" ${UI.stats.type ? '' : 'hidden'}><h3 id="st-use-title"></h3><p class="sub">Average share of the time busy, per 15 seconds.</p><canvas class="chart" id="ch-use"></canvas></div>`;
  const xs = H.t;
  lineChart($('ch-bots'), { xs, series: botsSer });
  lineChart($('ch-land'), { xs, series: landSer, unit: '%' });
  lineChart($('ch-goods'), { xs, series: goodSer });
  const drawUse = () => {
    if (!UI.stats.type) return;
    $('st-use-title').textContent = `${BDEFS[UI.stats.type].name}: busy over time`;
    const vals = ((H.p[0] && H.p[0].use && H.p[0].use[UI.stats.type]) || []).slice();
    while (vals.length < xs.length) vals.unshift(null);
    lineChart($('ch-use'), { xs, series: [{ name: BDEFS[UI.stats.type].name, color: CHART.series[0], values: vals }], unit: '%', max: 100 });
  };
  drawUse();
  for (const btn of $('st-goods').children) btn.onclick = () => {
    UI.stats.good = btn.dataset.g; sfx('click');
    for (const b2 of $('st-goods').children) b2.classList.toggle('on', b2 === btn);
    lineChart($('ch-goods'), { xs, series: ser((h) => (h.goods && h.goods[UI.stats.good]) || []) });
  };
  for (const btn of $('st-bars').querySelectorAll('.hbar')) btn.onclick = () => {
    UI.stats.type = btn.dataset.k; sfx('click');
    for (const b2 of $('st-bars').querySelectorAll('.hbar')) b2.classList.toggle('on', b2 === btn);
    drawUse();
  };
}

/* ------------------------------------------------------------------ modes & banner */

function setMode(mode) {
  if (R.mode === 'road' && mode !== 'road') dropDraft(); // a plan that was never built costs nothing
  R.mode = mode;
  for (const m of ['road', 'place', 'attack', 'aim']) document.body.classList.toggle('mode-' + m, mode === m);
  if (mode !== 'aim') { R.aim = null; R.aimHover = null; UI.aimSilo = 0; }
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

/* ------------------------------------------------------------------ missile aiming */

/** Aim a Silo: zoom out to show its range on the ground, then tap a spot inside it. */
function startAim(silo) {
  setMode('aim');
  UI.aimSilo = silo.id;
  R.selected = silo.id;
  const range = BDEFS[silo.type].nukeSilo ? NUKE.range : BDEFS.silo.missile.range;
  showAimBanner();
  // Fit the whole range ring in the map area left between the top bar and the banner.
  const top = $('topbar').getBoundingClientRect().bottom + 8;
  const bottom = Math.min($('banner').getBoundingClientRect().top, $('bottombar').getBoundingClientRect().top) - 8;
  const avail = Math.max(120, Math.min(R.w - 16, bottom - top));
  R.cam.z = clamp(avail / (2 * range + 2), minZoom(), maxZoom());
  centerOn(silo.x + 0.5, silo.y + 0.5 + (R.h / 2 - (top + bottom) / 2) / R.cam.z);
}

function showAimBanner(problem) {
  const silo = getE(UI.aimSilo), md = BDEFS.silo.missile;
  if (!silo) { setMode('normal'); return; }
  let html = '', ok = null;
  if (problem) html = `<span class="err">${problem}</span> `;
  if (BDEFS[silo.type].nukeSilo) {
    html += R.aim
      ? `<b>Launch the nuclear missile here?</b> Everything within ${NUKE.radius} tiles is destroyed, yours included, and the ground stays scorched for ${Math.round(NUKE.scorch / 60)} minutes. It lands ${NUKE.flight} seconds after launch, and the rival sees it coming.`
      : `Tap where to strike, inside the red ring (${NUKE.range} tiles). The red circle shows the ${NUKE.radius}-tile blast.`;
    showBanner(html, R.aim ? 'Launch' : null, 'Cancel');
    return;
  }
  if (R.aim) {
    const t = missileTargetAt(0, R.aim.i, R.aim.j);
    html += t ? `Fire at the rival <b>${BDEFS[t.type].name}</b>? ${BDEFS[t.type].mil ? 'Its armor drops to almost nothing, ready for warbots to capture.' : 'A hit wrecks it.'}`
      : 'Fire at this spot? The blast hurts rival buildings and bots within ' + md.splash + ' tiles.';
    ok = 'Fire';
  } else {
    const w = silo.stock.warhead || 0;
    html += `Tap where to fire, inside the red ring (${md.range} tiles). A hit wrecks most buildings; the blast hurts everything rival within ${md.splash} tiles. <b>${w}</b> Missile${w === 1 ? '' : 's'} loaded.`;
  }
  showBanner(html, ok, 'Cancel');
}

/** A tap while aiming: the first picks the spot, a second tap on it (or Fire) launches. */
function aimTap(i, j) {
  const silo = getE(UI.aimSilo);
  if (!silo) { setMode('normal'); return; }
  if (!inMap(i, j)) return;
  const why = BDEFS[silo.type].nukeSilo ? nukeBlocked(silo, i, j) : missileBlocked(silo, i, j);
  if (why) { sfx('error'); R.aim = null; showAimBanner(why); return; }
  if (R.aim && R.aim.i === i && R.aim.j === j) { fireAimed(); return; }
  R.aim = { i, j };
  sfx('click');
  showAimBanner();
}

function fireAimed() {
  const silo = getE(UI.aimSilo);
  if (!silo || !R.aim) return;
  if (BDEFS[silo.type].nukeSilo) {
    if (fireNukeAt(silo, R.aim.i, R.aim.j)) { setMode('normal'); sfx('alert'); }
    else { sfx('error'); showAimBanner(nukeBlocked(silo, R.aim.i, R.aim.j)); }
    return;
  }
  const t = missileTargetAt(0, R.aim.i, R.aim.j);
  if (fireMissileAt(silo, R.aim.i, R.aim.j)) {
    toast(t ? `Missile away: it will hit the ${BDEFS[t.type].name} in a few seconds.` : 'Missile away.', 'info');
    setMode('normal');
  } else { sfx('error'); showAimBanner(missileBlocked(silo, R.aim.i, R.aim.j)); }
}

function showBanner(html, okLabel, cancelLabel) {
  $('banner').hidden = false;
  $('banner-seg').hidden = true;
  $('banner-traffic').hidden = true;
  $('banner-undo').hidden = true;
  $('banner-clear').hidden = true;
  $('banner-ok').disabled = false;
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
  if (R.mode === 'aim') { fireAimed(); return; }
  if (R.mode === 'road') { commitDraft(); return; }
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
      if (def.gather) {
        const un = type === 'mine' && nukeOn() ? reachableRes(i, j, def.radius, R_URANIUM) : 0;
        extra = ` <span class="ok">${reachableRes(i, j, def.radius, def.gather)} ${RES[def.gather].name.toLowerCase()}s${un ? ` and <b>${un} uranium deposit${un > 1 ? 's' : ''}</b>` : ''} in reach.</span>`;
      }
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
    if (UI.roadMode === 'lights') {
      // Each tap steps a junction along: traffic light, then overpass, then plain junction again.
      if (S.over[t]) { removeOverpass(t); markDirty(i, j); sfx('click'); showRoadBanner('Overpass taken down: its Cement and Alloy are back.', true); return; }
      if (S.lights[t]) {
        const why = placeOverpass(0, i, j);
        if (why) { removeLight(t); sfx('click'); showRoadBanner(`Light taken down. ${why}`, true); }
        else { sfx('place'); addFx('ring', i + 0.5, j + 0.5, { color: '#ffd166' }); showRoadBanner('Overpass built: traffic flows through without stopping.', true); }
        return;
      }
      const why = placeLight(0, i, j);
      if (why) { sfx('error'); showRoadBanner(why); } else { sfx('place'); addFx('ring', i + 0.5, j + 0.5, { color: '#7dffa0' }); showRoadBanner(); }
      return;
    }
    if (UI.roadMode === 'arrows') {
      // Turn the arrow: east, south, west, north, then back to two-way.
      if (S.road[t]) { setRoadDir(i, j, S.road[t] >= 5 ? 1 : S.road[t] + 1); sfx('click'); showRoadBanner(); }
      return;
    }
    if (!UI.draft) draftReset();
    if (UI.roadMode === 'ramp') {
      // Ramps: tap a highlighted cliff edge to plan one there, tap it again to drop it.
      const stroke = [];
      if (UI.draft.ramps.has(t)) draftOp(stroke, t, 'unramp');
      else {
        const chk = canPlace(0, 'ramp', i, j);
        if (!chk.ok) { sfx('error'); showRoadBanner(chk.reason); return; }
        draftOp(stroke, t, 'ramp');
      }
      UI.draft.strokes.push(stroke);
      sfx('click');
      showRoadBanner();
      return;
    }
    // Roads and Bridges: a tap adds a tile to the plan or drops it, or marks a road to take up.
    const stroke = [];
    const d = UI.draft;
    let note = '';
    if (d.addSet.has(t)) draftOp(stroke, t, 'unadd');
    else if (d.del.has(t)) draftOp(stroke, t, 'undel');
    else if (S.road[t] || S.plan[t] === 1) { draftOp(stroke, t, 'del'); note = S.plan[t] ? 'Planned tile marked to call off.' : 'Road marked to take up: its Cement comes back when you tap Build.'; }
    else if (crossTile(t) && UI.roadMode !== 'bridge') {
      sfx('error');
      showRoadBanner(`That's ${S.terrain[t] === T_WATER ? 'water' : 'rock'}. Pick <b>Bridges</b> to build a ${CROSS[S.terrain[t]].name.toLowerCase()} across it.`);
      return;
    } else if (canRoad(0, i, j)) {
      draftOp(stroke, t, 'add');
      if (crossTile(t)) note = `${CROSS[S.terrain[t]].name} tile: ${costText(CROSS[S.terrain[t]].cost)}.`;
      else if (S.res[t]) note = `Workers will clear the ${RES[S.res[t]].name.toLowerCase()} (${ROAD_CLEAR}× Cement).`;
    } else { sfx('error'); showRoadBanner('You can only build roads inside your border.'); return; }
    if (stroke.length) d.strokes.push(stroke);
    sfx('click');
    showRoadBanner(note, true);
    return;
  }
  if (R.mode === 'aim') { aimTap(i, j); return; }
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
  if (bot) {
    sfx('click');
    if (INPUT.mouse && bot.owner === 0 && bot.type === 'warbot') selectBots([bot.id], INPUT.shift);
    openBotSheet(bot);
    return;
  }
  if (INPUT.mouse && UI.sel.length && !INPUT.shift) selectBots([], false);
  if (inMap(i, j) && S.res[tIdx(i, j)]) { sfx('click'); openResourceSheet(tIdx(i, j)); return; }
  if (inMap(i, j) && S.fert[tIdx(i, j)] && S.terrain[tIdx(i, j)] === T_GROUND) { sfx('click'); openSoilSheet(tIdx(i, j)); return; }
  closeSheet();
}

/** With a mouse, placing a building previews it under the pointer; a click then places it. */
function onMapHover(i, j) {
  if (R.mode === 'aim') { R.aimHover = inMap(i, j) ? { i, j } : null; return; }
  if (R.mode !== 'place' || !R.overlay || !UI.placeType || !inMap(i, j)) return;
  R.ghost = { type: UI.placeType, x: i, y: j, ok: !!R.overlay.valid[tIdx(i, j)], hover: true };
}

function rallyAtTap(wx, wy) {
  for (const r of S.rallies) if (r.owner === 0 && dist2(r.x + 0.1, r.y - 0.35, wx, wy) < 0.45) return r;
  return null;
}

/*
 * Road planning. In Roads and Bridges, dragging and tapping only sketch a plan (UI.draft): new road
 * tiles to lay, and existing or planned tiles to take up. Nothing is paid and no bot moves until
 * Build is tapped, so a stray swipe costs nothing (Undo or Clear takes it back).
 */
function draftReset() { UI.draft = { add: [], addSet: new Set(), del: new Set(), ramps: new Set(), strokes: [] }; }
function draftEmpty() { return !UI.draft || (!UI.draft.add.length && !UI.draft.del.size && !UI.draft.ramps.size); }

function draftOp(stroke, t, op) {
  const d = UI.draft;
  if (op === 'add') { if (d.addSet.has(t)) return; d.add.push(t); d.addSet.add(t); }
  else if (op === 'unadd') { if (!d.addSet.has(t)) return; d.addSet.delete(t); d.add.splice(d.add.indexOf(t), 1); }
  else if (op === 'del') { if (d.del.has(t)) return; d.del.add(t); }
  else if (op === 'undel') { if (!d.del.has(t)) return; d.del.delete(t); }
  else if (op === 'ramp') { if (d.ramps.has(t)) return; d.ramps.add(t); }
  else if (op === 'unramp') { if (!d.ramps.has(t)) return; d.ramps.delete(t); }
  stroke.push({ t, op });
}

/** Take back the last drag or tap. */
function draftUndo() {
  const d = UI.draft;
  if (!d) return;
  let s;
  do s = d.strokes.pop(); while (s && !s.length); // skip drags that added nothing
  if (!s) return;
  const back = { add: 'unadd', unadd: 'add', del: 'undel', undel: 'del', ramp: 'unramp', unramp: 'ramp' };
  for (let k = s.length - 1; k >= 0; k--) draftOp([], s[k].t, back[s[k].op]);
}

/** What the plan costs (new tiles, less what taking up roads gives back) and how many tiles of each kind. */
function draftSummary() {
  const d = UI.draft, cost = {}, back = {};
  let add = 0, cross = 0, clear = 0;
  for (const t of d.add) {
    if (S.road[t] || S.plan[t]) continue;
    add++;
    if (crossTile(t)) cross++; else if (S.res[t]) clear++;
    const c = roadTileCost(t);
    for (const g in c) cost[g] = (cost[g] || 0) + c[g];
  }
  for (const t of d.del) {
    if (!S.road[t] && !S.plan[t]) continue;
    // Taking up a road returns its Cement (a bridge or tunnel, its Cement and Alloy); calling off a planned tile refunds what it cost.
    const c = S.plan[t] ? roadTileCost(t) : crossTile(t) ? CROSS[S.terrain[t]].cost : roadCost();
    for (const g in c) back[g] = (back[g] || 0) + c[g];
  }
  // Ramps are construction sites: their materials are delivered, but you need them in stock.
  for (const t of d.ramps) for (const g in BDEFS.ramp.cost) cost[g] = (cost[g] || 0) + BDEFS.ramp.cost[g];
  const net = {};
  for (const g in cost) net[g] = Math.max(0, cost[g] - (back[g] || 0));
  return { add, cross, clear, del: d.del.size, ramps: d.ramps.size, cost, back, net, can: canAffordRoad(0, net) };
}

/** Build the plan: take up the marked roads (their goods come back first), then plan the new tiles for workers to pave. */
function commitDraft() {
  if (draftEmpty()) return;
  const d = UI.draft;
  let removed = 0, laid = 0, ramps = 0, why = '';
  for (const t of d.del) if (S.road[t] || S.plan[t] === 1) { removeRoad(0, t % S.W, (t / S.W) | 0); removed++; }
  for (const t of d.ramps) {
    const r = placeSite(0, 'ramp', t % S.W, (t / S.W) | 0);
    if (r.ok) ramps++; else { why = r.reason; break; }
  }
  for (const t of d.add) {
    if (S.road[t] || S.plan[t]) continue;
    why = buildRoad(0, t % S.W, (t / S.W) | 0);
    if (why) break;
    laid++;
  }
  draftReset();
  // Built: Paths closes, straight back to the map (unless something went wrong, to fix it).
  if (!why) setMode('normal');
  if (why) { sfx('error'); toast(`Planned ${laid} tile${laid === 1 ? '' : 's'} before running short: ${why}`, 'warn'); }
  else { sfx('place'); toast((laid ? `Planned ${laid} road tile${laid === 1 ? '' : 's'}: free workers will pave them.` : '') + (ramps ? ` ${ramps} Ramp site${ramps === 1 ? '' : 's'} started.` : '') + (removed ? ` Took up ${removed} tile${removed === 1 ? '' : 's'}.` : ''), 'info'); }
  if (why) showRoadBanner();
}

/** Leaving Paths with a plan that was never built: it's dropped (nothing was spent). */
function dropDraft() {
  if (draftEmpty()) return;
  draftReset();
  toast('Road plan dropped: nothing was spent.', 'info');
}

/**
 * Dragging: in Roads and Bridges it sketches new road along the drag (round resources; water and
 * rock only with Bridges). In Arrows each road tile points the way the finger moved, at once.
 */
function onRoadPaint(i, j, first) {
  if (R.mode !== 'road' || UI.roadMode === 'lights' || UI.roadMode === 'ramp') return;
  if (!UI.draft) draftReset();
  if (first) { UI.paintSkipped = false; UI.paintCross = false; UI.stroke = []; UI.draft.strokes.push(UI.stroke); }
  const from = first || !UI.lastPaint ? { i, j } : UI.lastPaint;
  const line = tileLine(from.i, from.j, i, j);
  let prev = null;
  const arrows = UI.roadMode === 'arrows';
  for (const [x, y] of line) {
    if (!inMap(x, y)) break;
    const t = tIdx(x, y);
    if (arrows) {
      if (S.road[t] && prev) {
        const v = 2 + [[1, 0], [0, 1], [-1, 0], [0, -1]].findIndex(([dx, dy]) => dx === x - prev[0] && dy === y - prev[1]);
        if (v >= 2) { if (S.road[tIdx(prev[0], prev[1])]) setRoadDir(prev[0], prev[1], v); setRoadDir(x, y, v); }
      }
      prev = [x, y];
      continue;
    }
    if (S.road[t] || S.plan[t] || roadLike(t)) continue;
    // Dragging never bulldozes resources by accident: tap a resource tile to clear it for a road.
    if (S.res[t]) { UI.paintSkipped = true; continue; }
    // Bridges and tunnels are dear: only the Bridges tool sketches them.
    if (crossTile(t) && UI.roadMode !== 'bridge') { UI.paintCross = true; continue; }
    if (canRoad(0, x, y)) draftOp(UI.stroke, t, 'add');
  }
  UI.lastPaint = { i, j };
  if (!arrows) {
    showRoadBanner(UI.paintCross ? 'Roads stop at water and rock: pick <b>Bridges</b> to cross.'
      : UI.paintSkipped ? 'Dragging goes round resources: tap a boulder, grove, ore or crystal tile to clear it for a road.' : '', true);
  }
}

/**
 * The Paths banner, at the top of the screen so it never covers where you're drawing. Roads and
 * Bridges show the plan and what it costs, with Undo, Clear and Build.
 */
function showRoadBanner(problem, info) {
  const mode = ['arrows', 'lights', 'bridge', 'ramp'].includes(UI.roadMode) ? UI.roadMode : 'road';
  if (!UI.draft) draftReset();
  const have = playerGoods(0);
  let line, how;
  if (mode === 'ramp' && draftEmpty()) {
    line = `Tap a highlighted spot at the foot or top of a one-level cliff to plan a <b>Ramp</b> (${costText(BDEFS.ramp.cost)}). Nothing is spent until you tap <b>Build</b>.`;
    how = 'Workers cut a sloped road into the cliff; once it is done it is part of your road network, so haulers drive straight up it. A Ramp can\'t go where it would block the only way through a pass.';
  } else if (mode === 'arrows') {
    line = 'Drag along a road to make it <b>one-way</b> the way you drag. Tap a road to turn its arrow.';
    how = 'One-way traffic never meets head-on, so a loop of one-way roads (one lane out, one back) keeps busy routes flowing.';
  } else if (mode === 'lights') {
    let lights = 0, junctions = 0, overs = 0;
    for (const k in S.lights) if (S.lights[k].owner === 0) lights++;
    for (const k in S.over) if (S.over[k].owner === 0) overs++;
    const net = roadNet();
    for (let t = 0; t < S.W * S.H; t++) if (net.junc[t] && S.owner[t] === 0) junctions++;
    line = `Tap a <b>junction</b> for a traffic light (${costText(LIGHT_COST)}), tap the light for an <b>overpass</b> (${costText(OVERPASS_COST)}), tap again to clear it.`;
    how = `A light lets one direction through at a time; on an overpass nobody stops. You have ${lights} light${lights === 1 ? '' : 's'}, ${overs} overpass${overs === 1 ? '' : 'es'} and ${junctions} junction${junctions === 1 ? '' : 's'}.`;
  } else {
    const sm = draftSummary();
    if (draftEmpty()) {
      line = mode === 'bridge'
        ? `<b>Sketch</b> a road across water (bridge, ${costText(CROSS[T_WATER].cost)} a tile) or through rock (tunnel, ${costText(CROSS[T_ROCK].cost)}). Nothing is spent until you tap <b>Build</b>.`
        : '<b>Sketch</b> roads by dragging; tap a tile to add or drop it, or tap a road to take it up. Nothing is spent until you tap <b>Build</b>.';
    } else {
      const parts = [];
      if (sm.add) parts.push(`<b>${sm.add}</b> new tile${sm.add === 1 ? '' : 's'}` + (sm.cross ? ` (${sm.cross} bridge or tunnel)` : '') + (sm.clear ? ` (${sm.clear} through resources)` : ''));
      if (sm.del) parts.push(`<b>${sm.del}</b> to take up`);
      if (sm.ramps) parts.push(`<b>${sm.ramps}</b> Ramp${sm.ramps === 1 ? '' : 's'}`);
      const cost = Object.keys(sm.net).length && Object.values(sm.net).some((v) => v > 0) ? `costs <b>${costText(sm.net)}</b>` : 'costs nothing';
      line = `Plan: ${parts.join(', ')}; ${cost}` + (sm.can ? '.' : ` <span class="err">— not enough ${Object.keys(sm.net).filter((g) => !canAffordRoad(0, { [g]: sm.net[g] })).map((g) => GOOD[g].name).join(' or ')}.</span>`);
    }
    const waiting = planList(0).length;
    how = `<b>Haulers only drive on roads</b>, so every building needs a road to storage. 1 Cement paves ${Math.round(1 / roadCost().cement)} tiles (${ROAD_CLEAR}× through resources); you have ${have.cement || 0} Cement` +
      (mode === 'bridge' ? ` and ${have.alloy || 0} Alloy. Workers build bridges and tunnels out from the shore or rock face, and they join land on any level.` : '.') +
      ` After you tap Build, free workers pave the road a tile at a time${waiting ? ` (<b>${waiting}</b> tile${waiting === 1 ? '' : 's'} waiting now)` : ''}.`;
  }
  const text = (problem ? `<span class="${info ? 'ok' : 'err'}">${problem}</span> ` : '') + line +
    `<details class="how"><summary>How it works</summary>${how}</details>`;
  showBanner(text, null, 'Done');
  $('banner-seg').hidden = false;
  for (const btn of $('banner-seg').children) {
    btn.classList.toggle('on', btn.dataset.v === mode);
    btn.onclick = () => { UI.roadMode = btn.dataset.v; sfx('click'); showRoadBanner(); };
  }
  // Undo, Clear and Build for a plan.
  const drafting = !draftEmpty();
  $('banner-undo').hidden = !drafting;
  $('banner-clear').hidden = !drafting;
  $('banner-ok').hidden = !drafting;
  if (drafting) {
    const sm = draftSummary();
    $('banner-ok').textContent = sm.add ? `Build ${sm.add} tile${sm.add === 1 ? '' : 's'}` + (sm.ramps ? ` + ${sm.ramps} Ramp${sm.ramps === 1 ? '' : 's'}` : '')
      : sm.ramps ? `Build ${sm.ramps} Ramp${sm.ramps === 1 ? '' : 's'}` : 'Take up';
    $('banner-ok').disabled = !sm.can;
    $('banner-undo').onclick = () => { draftUndo(); sfx('click'); showRoadBanner(); };
    $('banner-clear').onclick = () => { draftReset(); sfx('click'); showRoadBanner(); };
  }
  const tb = $('banner-traffic');
  tb.hidden = false;
  tb.classList.toggle('on', !!R.traffic);
  tb.onclick = () => { R.traffic = !R.traffic; sfx('click'); showRoadBanner(); };
  if (R.traffic) $('banner-text').innerHTML += ` <span class="traffic-key">${trafficSummary()}</span>`;
}

/** Traffic map legend plus how busy the haulers and trucks are. */
function trafficSummary() {
  const n = { hauler: [0, 0], truck: [0, 0] };
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0 || !n[u.type]) continue;
    n[u.type][0]++;
    if (u.task && u.task.type === 'haul') n[u.type][1]++;
  }
  let jams = 0;
  if (HEAT.jam) for (let t = 0; t < S.W * S.H; t++) if (HEAT.jam[t] > TRAFFIC_JAM && S.owner[t] === 0) jams++;
  return `<b>Traffic map:</b> <i class="tk q"></i>quiet <i class="tk b"></i>busy <i class="tk p"></i>packed; pulsing rings mark jams (${jams} now). `
    + `Haulers ${n.hauler[1]} of ${n.hauler[0]} busy` + (n.truck[0] ? `, Freight Trucks ${n.truck[1]} of ${n.truck[0]}` : '') + '.';
}

/* ------------------------------------------------------------------ sheets */

function openSheet(kind, id, html) {
  UI.sheetKind = kind;
  UI.sheetFor = id;
  UI.demolishArm = 0;
  $('sheet-body').innerHTML = html;
  $('sheet').hidden = false;
  document.body.classList.add('sheet-open');
  $('banner').hidden = true;
}

function closeSheet() {
  R.routePreview = null;
  $('sheet').hidden = true;
  document.body.classList.remove('sheet-open');
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
  const list = BUILD_MENU.filter((t) => !(BDEFS[t].war && !warOn()) && !(BDEFS[t].nuke && !nukeOn()));
  const html = `<div class="sheet-title"><h3>Build</h3></div>
    <p class="desc">Placing a site is free; haulers bring the materials by road, so lay a road to it. ${sites}/${MAX_SITES} sites in progress.</p>
    <div class="build-grid"><button class="bcard roads" id="build-roads"><kbd>R</kbd><svg viewBox="0 0 24 24"><path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <div class="bname">Roads</div><div class="bhave">Plan roads, bridges and ramps</div></button>${list.map((t) => `<button class="bcard" data-t="${t}" ${sites >= MAX_SITES ? 'disabled' : ''}>
      ${BUILD_KEYS[t] ? `<kbd>${BUILD_KEYS[t].toUpperCase()}</kbd>` : ''}<img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div><div class="bcost">${costHTML(BDEFS[t].cost, have)}</div>
      <div class="bhave">${ownedText(t)}</div></button>`).join('')}</div>`;
  openSheet('build', 0, html);
  for (const el of $('sheet-body').querySelectorAll('.bcard[data-t]')) {
    el.onclick = () => { sfx('click'); enterPlaceMode(el.dataset.t); };
  }
  $('build-roads').onclick = () => openPaths('road');
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
  const desc = !mine && b.type === 'lander' ? 'The rival\'s fortified headquarters. Capture it to win.' : def.desc;
  let html = `<div class="sheet-title"><img src="${iconFor(b.type, b.owner)}" alt=""><div><h3>${def.name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[b.owner]}"></span> ${mine ? 'Yours' : 'Rival'}</div></div></div>
    <p class="desc">${desc}</p><div class="status" id="sh-status"></div><div id="sh-dyn"></div>${mine ? '<div id="sh-fix"></div>' : ''}`;
  if (mine) {
    if (def.store && b.built) {
      html += `<div class="section-label">Storage</div><div class="seg" id="sh-smode">
        <button data-v="normal">Normal</button><button data-v="fill">Fill first</button><button data-v="empty">Empty out</button></div>
        <p class="hint" id="sh-smode-hint"></p>
        <div class="section-label">Goods kept here <span class="label-note">tap to switch off</span></div>
        <div class="goodlist" id="sh-accept">${GOODS.filter((g) => nukeOn() || !NUKE_GOODS.includes(g)).map((g) => `<button class="gtag toggle" data-g="${g}"><i class="gi ${g}"></i><span>${GOOD[g].name}</span> <b>0</b></button>`).join('')}</div>`;
      if (b.type !== 'lander') {
        // The goods a front line runs on, plus any already ordered; the rest behind "More goods".
        const main = ['cement', 'fiber', 'stone', 'alloy', 'fuel'].concat(warOn() ? ['ammo'] : []);
        const goods = main.concat(GOODS.filter((g) => !main.includes(g))).filter((g) => (warOn() || !WAR_GOODS.includes(g)) && (nukeOn() || !NUKE_GOODS.includes(g)) && (UI.keepAll || main.includes(g) || (b.keep && b.keep[g])));
        html += `<div class="section-label">Supply orders <span class="label-note">stock it from home</span></div>
          <div class="keep-list" id="sh-keep">${goods.map((g) => `<div class="keep-cell" data-g="${g}"><span class="kname"><i class="gi ${g}"></i>${GOOD[g].name}</span><b class="n">–</b>
            <button class="btn" data-d="-5" aria-label="Less ${GOOD[g].name}">−5</button><button class="btn" data-d="5" aria-label="More ${GOOD[g].name}">+5</button></div>`).join('')}</div>
          <button class="btn small ghost" id="sh-keep-all">${UI.keepAll ? 'Fewer goods' : 'More goods'}</button>
          <p class="hint" id="sh-keep-hint"></p>`;
      }
    } else if (b.type !== 'lander') {
      html += `<div class="section-label">Priority</div><div class="seg" id="sh-prio">
        <button data-v="low">Low</button><button data-v="normal">Normal</button><button data-v="high">High</button></div>
        <p class="hint">${b.built ? 'High-priority buildings get workers and goods first; low ones last, and lose their worker first when workers run short.' : 'High-priority sites get their materials and a builder first. Once built, it goes back to Normal.'}</p>`;
    }
    if (def.mil && b.built && warOn()) {
      html += `<div class="section-label">Warbots</div>
        <div class="seg" id="sh-gprio"><button data-v="low">Low</button><button data-v="normal">Normal</button><button data-v="high">High</button></div>
        <p class="hint">Garrison priority: new warbots from the Foundry, and ones called back from a rally flag, fill High garrisons first and Low ones last.</p>
        <div class="stepper"><button class="btn" id="sh-st-minus" aria-label="Fewer">−</button><span class="n" id="sh-st-n">0</span>
        <button class="btn" id="sh-st-plus" aria-label="More">+</button><button class="btn primary" id="sh-st-send" style="flex:1">Station here</button></div>
        <p class="hint" id="sh-st-hint"></p>`;
    }
    if (b.type === 'foundry' && b.built) {
      const versus = warOn();
      const row = (k, label) => `<div class="order-row"><span>${label}<small id="sh-o-${k}">none queued</small></span>
        <button class="btn" data-k="${k}" data-d="1">+1</button><button class="btn" data-k="${k}" data-d="5">+5</button>
        <button class="btn ghost" data-k="${k}" data-d="0">Clear</button></div>`;
      const kinds = BOT_ORDER.filter((k) => versus || !BOTS[k].war);
      html += `<div class="section-label">Order bots</div><div id="sh-orders">${kinds.map((k) => row(k, BOTS[k].plural)).join('')}</div>
        <p class="hint">The Foundry only builds the bots you order. Each one uses 1 Alloy and 1 Chip and takes ${def.work} s (a Freight Truck twice that); mixed orders take turns.
        <b>Haulers</b> carry two goods at a time, <b>Freight Trucks</b> eight on the long runs to Depots, <b>Agribots</b> run Bio Farms and Grove Planters, and <b>Pavers</b> run the Roadworks.</p>`;
    }
    if (def.nukeSilo && b.built) {
      html += `<button class="btn primary big danger-glow" id="sh-aim">Aim nuclear missile</button>
        <p class="hint" id="sh-aim-hint"></p>`;
    }
    if (def.missile && b.built) {
      html += `<button class="btn primary big" id="sh-aim">Aim missile</button>
        <p class="hint" id="sh-aim-hint">Shows the Silo's ${def.missile.range}-tile range on the ground: tap any spot inside it to aim, then fire.</p>`;
    }
    const lg = limitGood(b);
    if (lg && b.built) {
      html += `<div class="section-label">Stock limit</div>
        <div class="limit-row"><span>Stop making ${GOOD[lg].name} at</span>
        <div class="stepper"><button class="btn" id="sh-lim-minus" aria-label="Lower the limit">−</button><span class="n" id="sh-lim"></span>
        <button class="btn" id="sh-lim-plus" aria-label="Raise the limit">+</button></div></div>
        <div class="limit-row"><span class="hint" id="sh-lim-hint"></span><button class="btn small" id="sh-lim-off"></button></div>`;
    }
    if (needsRoad(b) || (b.unlinked !== undefined && !def.store)) html += '<div id="sh-road"></div>';
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
    if ($('sh-prio')) for (const btn of $('sh-prio').children) btn.onclick = () => {
      b.prio = btn.dataset.v === 'normal' ? undefined : btn.dataset.v;
      if (b.built) delete b.sitePrio; else b.sitePrio = !!b.prio; // a site's priority ends when it's built
      sfx('click');
      refreshSheet();
    };
    if ($('sh-smode')) for (const btn of $('sh-smode').children) btn.onclick = () => { b.smode = btn.dataset.v === 'normal' ? undefined : btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-accept')) for (const btn of $('sh-accept').children) btn.onclick = () => {
      const g = btn.dataset.g;
      b.reject = b.reject || {};
      if (b.reject[g]) delete b.reject[g]; else b.reject[g] = true;
      if (!Object.keys(b.reject).length) delete b.reject;
      sfx('click');
      refreshSheet();
    };
    if ($('sh-keep-all')) $('sh-keep-all').onclick = () => { UI.keepAll = !UI.keepAll; sfx('click'); openBuildingSheet(b); };
    if ($('sh-keep')) for (const btn of $('sh-keep').querySelectorAll('button')) btn.onclick = () => {
      const g = btn.parentElement.dataset.g;
      setKeep(b, g, ((b.keep && b.keep[g]) || 0) + +btn.dataset.d);
      sfx('click');
      refreshSheet();
    };
    const seg = $('sh-mode');
    if (seg) for (const btn of seg.children) btn.onclick = () => { b.mode = btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-orders')) for (const btn of $('sh-orders').querySelectorAll('button')) btn.onclick = () => {
      const k = btn.dataset.k, d = +btn.dataset.d;
      b.orders = b.orders || {};
      b.orders[k] = d === 0 ? 0 : clamp((b.orders[k] || 0) + d, 0, 99);
      if (!hasOrders(b)) delete b.orders;
      sfx('click');
      refreshSheet();
    };
    if ($('sh-pause')) $('sh-pause').onclick = () => { setPaused(b, !b.paused); sfx('click'); refreshSheet(); };
    if ($('sh-aim')) $('sh-aim').onclick = () => { sfx('click'); startAim(b); };
    if ($('sh-gprio')) for (const btn of $('sh-gprio').children) btn.onclick = () => { b.gprio = btn.dataset.v === 'normal' ? undefined : btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-st-send')) {
      UI.stationN = Math.min(5, stationAvailable(0, b));
      $('sh-st-minus').onclick = () => { UI.stationN = Math.max(1, UI.stationN - 1); refreshSheet(); };
      $('sh-st-plus').onclick = () => { UI.stationN = Math.min(stationAvailable(0, b), UI.stationN + 1); refreshSheet(); };
      $('sh-st-send').onclick = () => {
        const n = stationWarbots(0, b, UI.stationN);
        if (n) { sfx('alert'); toast(`${n} warbot${n > 1 ? 's' : ''} on the way to the ${def.name}.`, 'info'); } else sfx('error');
        refreshSheet();
      };
    }
    if ($('sh-lim')) {
      const step = (d) => {
        const cur = stockLimit(b);
        const base = cur === Infinity ? (BDEFS[b.type].limit || 20) - d : cur;
        b.limit = clamp(Math.round((base + d) / 5) * 5, 5, 500);
        sfx('click');
        refreshSheet();
      };
      $('sh-lim-minus').onclick = () => step(-5);
      $('sh-lim-plus').onclick = () => step(5);
      $('sh-lim-off').onclick = () => {
        b.limit = stockLimit(b) === Infinity ? BDEFS[b.type].limit || 20 : -1;
        sfx('click');
        refreshSheet();
      };
    }
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

/** The building sheet's repair control: a Repair button (with its Cement cost) when it's damaged. */
function refreshFix(b) {
  const el = $('sh-fix'), def = BDEFS[b.type];
  let key, html = '';
  if (!b.built || b.armor >= def.armor - 0.05) { key = 'ok'; }
  else if (b.fixLeft > 0) {
    const w = getE(b.fixer);
    key = 'fixing' + (w && w.task && w.task.phase === 'work' ? 'w' : 'g') + Math.ceil(b.fixLeft);
    html = `<div class="kv"><span>Repair</span><span class="ok">${w && w.task && w.task.phase === 'work' ? `Worker repairing: ${Math.ceil(b.fixLeft)} armor to go` : 'A worker is on the way'}</span></div>`;
  } else {
    const n = repairCost(b), can = playerGoods(0).cement >= n;
    key = 'btn' + n + can + (S.time - (b.lastHit || -99) < 3);
    html = `<button class="btn primary big" id="sh-fixbtn" ${can ? '' : 'disabled'}>Repair: ${n} Cement</button>
      <p class="hint">${can ? 'A free worker comes and restores its armor.' : `Not enough Cement: repairing it takes ${n}.`}${S.time - (b.lastHit || -99) < 3 ? ' It is under attack right now.' : ''}</p>`;
  }
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.innerHTML = html;
  if ($('sh-fixbtn')) $('sh-fixbtn').onclick = () => {
    const why = requestRepair(0, b);
    if (why) { sfx('error'); toast(why, 'warn'); } else { sfx('click'); toast(`Repair ordered: a worker is coming to fix the ${def.name}.`, 'info'); }
    el.dataset.key = '';
    refreshSheet();
  };
}

/** The building sheet's road section: linked, or what it would take to link it (with a button). */
function refreshRoadLink(b) {
  const el = $('sh-road');
  R.routePreview = null;
  if (!needsRoad(b)) { el.innerHTML = ''; return; }
  if (!b.unlinked) {
    el.innerHTML = '<div class="kv"><span>Road</span><span class="ok">Linked to storage</span></div>';
    return;
  }
  const route = roadRouteTo(0, b);
  const what = b.built ? 'Haulers can\'t collect from it or bring it anything' : 'Haulers can\'t bring its materials';
  if (route && !route.length && route.pending) {
    R.routePreview = null;
    el.dataset.key = '';
    el.innerHTML = `<div class="road-warn paving"><b>Road being paved:</b> ${route.pending} tile${route.pending === 1 ? '' : 's'} to go. Free workers are on it; haulers start once it reaches storage.</div>`;
    return;
  }
  if (!route) {
    el.innerHTML = `<div class="road-warn"><b>No road to storage.</b> ${what}, and no road can reach it through your land. Expand your border or build a Ramp.</div>`;
    return;
  }
  R.routePreview = route;
  const can = canAffordRoad(0, route.goods);
  const key = route.join(',');
  if (el.dataset.key === key + can) return;
  el.dataset.key = key + can;
  const short = Object.keys(route.goods).filter((g) => !canAffordRoad(0, { [g]: route.goods[g] })).map((g) => GOOD[g].name);
  const cross = route.cross ? ` It crosses water or rock: ${route.cross} tile${route.cross === 1 ? '' : 's'} of bridge or tunnel.` : '';
  el.innerHTML = `<div class="road-warn"><b>No road to storage.</b> ${what}. The dashed tiles show the shortest road${route.pending ? ` (${route.pending} more already planned)` : ''}; free workers pave it once it's planned.${cross}
    <button class="btn primary" id="sh-layroad" ${can ? '' : 'disabled'}>Lay road: ${route.length} tile${route.length === 1 ? '' : 's'}, ${costText(route.goods)}</button>
    ${can ? '' : `<span class="err">Not enough ${short.join(' or ')}${short.includes('Cement') ? ': build a Cement Works' : ''}.</span>`}</div>`;
  $('sh-layroad').onclick = () => {
    let laid = 0, why = '';
    for (const t of roadRouteTo(0, b) || []) {
      why = buildRoad(0, t % S.W, (t / S.W) | 0);
      if (why) break;
      laid++;
    }
    if (why) { sfx('error'); toast(why, 'warn'); } else { sfx('place'); toast(`Planned ${laid} road tile${laid === 1 ? '' : 's'}: free workers will pave them.`, 'info'); }
    el.dataset.key = '';
    refreshSheet();
  };
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
      parts.push(`<div class="kv"><span>${def.crew ? BOTS[def.crew].name : 'Worker'}</span><span>${b.paused ? 'Paused' : op ? (op.inside === b.id ? 'Inside' : 'Out working') : b.staffInc ? 'On the way' : 'None yet'}</span></div>`);
    }
    if (def.roadworks) {
      // Everything on the road network joined to the Roadworks is in reach.
      let left = 0;
      const nets = buildingNets(b), net = roadNet();
      for (let t = 0; t < S.W * S.H; t++) if (S.road[t] && S.pave[t] < 2 && S.owner[t] === b.owner && nets.indexOf(net.comp[t]) >= 0) left++;
      parts.push(`<div class="kv"><span>Joined roads still to surface</span><span>${left} tiles</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Asphalt</span><span>${goodTag('asphalt', `${b.stock.asphalt || 0}/3`, !(b.stock.asphalt > 0) && !(b.charges > 0))} + ${b.charges || 0} tiles in the hopper</span></div>`);
    }
    if (def.ammoStock && mine && warOn()) {
      parts.push(`<div class="kv"><span>Ammo for warbots</span><span>${goodTag('ammo', `${b.stock.ammo || 0}/${def.ammoStock}`, !(b.stock.ammo > 0))}</span></div>`);
    }
    if (b.upT > 30 && tracksUse(def)) {
      const pct = Math.round(((b.useT || 0) / b.upT) * 100);
      parts.push(`<div class="kv"><span>Busy</span><span>${pct}% of the time</span></div>${sparkline(b.useHist)}`);
    }
    if (def.gather) {
      const g = RES[def.gather].good;
      parts.push(`<div class="kv"><span>${RES[def.gather].name}s in reach</span><span>${reachableRes(b.x, b.y, def.radius, def.gather)}</span></div>`);
      if (b.type === 'mine' && nukeOn()) parts.push(`<div class="kv"><span>Uranium deposits in reach</span><span>${reachableRes(b.x, b.y, def.radius, R_URANIUM)}</span></div>`);
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
        const need = (BOTS[k] && BOTS[k].parts) || 1;
        parts.push(`<div class="kv"><span>Next bot</span><span>${BOTS[k] ? BOTS[k].name + (need > 1 ? ` (part ${Math.min(need, (b.parts || 0) + 1)} of ${need})` : '') : 'Nothing ordered'}</span></div>`);
      }
      if (b.timer > 0 && b.status === 'Working') parts.push(`<div class="bar"><div style="width:${Math.round((b.timer / def.work) * 100)}%"></div></div>`);
    }
    if (def.store && mine) {
      let idle = 0;
      for (const u of S.bots) if (!u.dead && u.inside === b.id && u.type === 'worker') idle++;
      parts.push(`<div class="kv"><span>Workers resting here</span><span>${idle}</span></div>`);
    }
    if (def.mil) parts.push(`<div class="kv"><span>${mine ? 'Warbots inside' : 'Defenders inside'}</span><span>${b.garrison.length} / ${def.garrison}</span></div>`);
    if (def.mil && mine) parts.push(`<div class="kv"><span>Territory radius</span><span>${def.terr} tiles</span></div>`);
    if (def.ammo && mine && !def.missile) parts.push(`<div class="kv"><span>Ammo</span><span>${b.shots + (b.stock.crystal || 0) * SHOTS_PER_AMMO} shots</span></div>`);
    if (def.missile && mine) {
      parts.push(`<div class="kv"><span>Missiles loaded</span><span>${goodTag('warhead', `${b.stock.warhead || 0}/${def.ammoCap}`)}</span></div>`);
      parts.push(`<div class="kv"><span>Each hit</span><span>${def.missile.damage} damage, ${def.missile.splashDamage} to buildings within ${def.missile.splash} tiles</span></div>`);
      parts.push(`<div class="kv"><span>Reload</span><span>${b.reload > 0 ? Math.ceil(b.reload) + 's' : 'Ready'}</span></div>`);
      parts.push(`<div class="kv"><span>Range</span><span>${def.missile.range} tiles</span></div>`);
    }
    if (def.nukeSilo && mine) {
      parts.push(`<div class="section-label">Nuclear missile parts</div><div class="goodlist">${Object.keys(NUKE.parts).map((g) =>
        goodTag(g, `${b.armed ? NUKE.parts[g] : Math.min(b.stock[g] || 0, NUKE.parts[g])}/${NUKE.parts[g]}`, !b.armed && (b.stock[g] || 0) < NUKE.parts[g])).join(' ')}</div>`);
      if (!b.armed && b.timer > 0) parts.push(`<div class="bar"><div style="width:${Math.round((b.timer / NUKE.assemble) * 100)}%"></div></div>`);
      parts.push(`<div class="kv"><span>Nuclear missile</span><span>${b.armed ? '<b>Ready to launch</b>' : 'Not built yet'}</span></div>`);
      parts.push(`<div class="kv"><span>Range · blast</span><span>${NUKE.range} tiles · ${NUKE.radius} tiles</span></div>`);
    }
    if (def.repair && mine) {
      let inside = 0;
      for (const u of S.bots) if (!u.dead && u.inside === b.id) inside++;
      parts.push(`<div class="kv"><span>Robots being repaired</span><span>${inside} (${def.repair.slots} at full speed)</span></div>`);
      parts.push(`<div class="kv"><span>Alloy stocked</span><span>${goodTag('alloy', `${b.stock.alloy || 0}/${def.alloyCap}`, !(b.stock.alloy > 0))}</span></div>`);
      parts.push(`<div class="kv"><span>Repair left in the hopper</span><span>${Math.floor(b.repairPts || 0)} health</span></div>`);
    }
    if (def.charger && mine) {
      parts.push(`<div class="kv"><span>Charging now</span><span>${b.charging || 0} (${def.charger.slots} at full speed)</span></div>`);
      if (def.charger.fuel) {
        const pct = Math.round(Math.min(100, ((b.energy || 0) / FUEL_ENERGY) * 100));
        parts.push(`<div class="kv"><span>Fuel stocked</span><span>${goodTag('fuel', `${b.stock.fuel || 0}/${def.fuelCap}`, !(b.stock.fuel > 0))}</span></div>`);
        parts.push(`<div class="kv"><span>Fuel burning</span><span>${pct}% left</span></div><div class="bar battery"><div style="width:${pct}%;background:var(--g-fuel)"></div></div>`);
      }
    }
  }
  $('sh-dyn').innerHTML = parts.join('');
  if ($('sh-road')) refreshRoadLink(b);
  if ($('sh-fix')) refreshFix(b);
  if ($('sh-aim') && def.nukeSilo) {
    $('sh-aim').disabled = !b.armed;
    $('sh-aim-hint').textContent = b.armed ? `Shows its ${NUKE.range}-tile range: tap a spot inside it to see the ${NUKE.radius}-tile blast, then launch.` : 'Builds a nuclear missile once its parts are in.';
  } else if ($('sh-aim')) {
    const why = !(b.stock.warhead > 0) ? 'No Missiles loaded yet: haulers bring them from a Missile Factory.' : b.reload > 0 ? `Reloading: ready in ${Math.ceil(b.reload)}s.` : '';
    $('sh-aim').disabled = !!why;
    $('sh-aim-hint').textContent = why || `Shows the Silo's ${BDEFS.silo.missile.range}-tile range on the ground: tap any spot inside it to aim, then fire.`;
  }
  if ($('sh-gprio')) for (const btn of $('sh-gprio').children) btn.classList.toggle('on', btn.dataset.v === (b.gprio || 'normal'));
  if ($('sh-st-n')) {
    const avail = stationAvailable(0, b), coming = b.garInc || 0;
    UI.stationN = clamp(UI.stationN || 0, avail ? 1 : 0, avail);
    $('sh-st-n').textContent = UI.stationN;
    $('sh-st-send').disabled = !avail;
    $('sh-st-hint').textContent = (avail
      ? `Bring up to ${avail} warbot${avail > 1 ? 's' : ''} from your other garrisons (each keeps one at home). They stay here until you move them.`
      : !garrisonRoom(b) ? 'This garrison is full.' : 'No spare warbots in your other garrisons: each keeps one at home.')
      + (coming ? ` ${coming} on the way.` : '');
  }
  if ($('sh-lim')) {
    const lim = stockLimit(b), g = limitGood(b), have = goodTotal(0, g);
    $('sh-lim').textContent = lim === Infinity ? '∞' : lim;
    $('sh-lim-off').textContent = lim === Infinity ? 'Set a limit' : 'No limit';
    $('sh-lim-hint').textContent = lim === Infinity
      ? `No limit: it keeps going while it has inputs. You have ${have}.`
      : `You have ${have}. ${have >= lim ? 'Stopped: it starts again when you drop below the limit.' : 'It stops (and takes no more inputs) when you reach the limit.'}`;
  }
  if ($('sh-pause')) $('sh-pause').textContent = b.paused ? 'Resume' : 'Pause';
  if ($('sh-prio')) for (const btn of $('sh-prio').children) btn.classList.toggle('on', btn.dataset.v === (b.prio || 'normal'));
  if ($('sh-smode')) {
    const m = b.smode || 'normal';
    for (const btn of $('sh-smode').children) btn.classList.toggle('on', btn.dataset.v === m);
    $('sh-smode-hint').textContent = {
      normal: 'Finished goods go to whichever storage is closest.',
      fill: 'Haulers bring finished goods here before any other storage, even if another is closer.',
      empty: 'Takes nothing new and sends what it holds to your other storage. Good before demolishing it.',
    }[m];
  }
  if ($('sh-accept')) for (const btn of $('sh-accept').children) {
    const g = btn.dataset.g;
    btn.classList.toggle('off', !!(b.reject && b.reject[g]) || b.smode === 'empty');
    btn.lastElementChild.textContent = b.stock[g] || 0;
  }
  if ($('sh-keep')) {
    let want = 0, short = 0;
    for (const cell of $('sh-keep').children) {
      const g = cell.dataset.g, k = (b.keep && b.keep[g]) || 0, have = b.stock[g] || 0;
      cell.querySelector('.n').textContent = k ? `${Math.min(have, k)}/${k}` : '–';
      cell.classList.toggle('on', k > 0);
      cell.classList.toggle('short', k > 0 && have < k);
      if (k) { want++; if (have < k) short++; }
    }
    let trucks = 0;
    for (const u of S.bots) if (!u.dead && u.owner === 0 && BOTS[u.type].truck) trucks++;
    $('sh-keep-hint').textContent = !want
      ? 'Set how much of each good to keep here, and haulers and Freight Trucks bring it from your other storage. Buildings and roads near here then draw on it.'
      : `${short ? `Filling ${short} order${short > 1 ? 's' : ''}` : 'Fully stocked'}. ` + (trucks ? `${trucks} Freight Truck${trucks > 1 ? 's' : ''} take the runs; haulers help when they're busy.` : 'Haulers bring it two at a time: order Freight Trucks at the Bot Foundry to carry eight.');
  }
  if ($('sh-mode')) for (const btn of $('sh-mode').children) btn.classList.toggle('on', btn.dataset.v === b.mode);
  for (const k of BOT_ORDER) {
    if (!$('sh-o-' + k)) continue;
    const n = (b.orders && b.orders[k]) || 0;
    $('sh-o-' + k).textContent = n ? `${n} queued` : 'none queued';
  }
  if ($('sh-fire')) {
    const silos = silosInRange(0, b), ready = silos.filter(siloReady);
    const minReload = silos.reduce((m, q) => (q.reload > 0 && q.stock.warhead > 0 ? Math.min(m, q.reload) : m), Infinity);
    $('sh-fire').disabled = !ready.length;
    $('sh-missile').innerHTML = `<p class="desc">${!silos.length
      ? `No Missile Silo within ${BDEFS.silo.missile.range} tiles. Build a Silo near the front and a Missile Factory to make Missiles.`
      : ready.length
        ? `${ready.length} silo${ready.length > 1 ? 's' : ''} ready. A missile wrecks smaller buildings and knocks Outposts and Command Bases down to almost no armor, ready for warbots to capture.`
        : minReload < Infinity ? `Silos in range are reloading (${Math.ceil(minReload)}s).` : 'Silos in range have no Missiles. Build them at a Missile Factory (Alloy, Chips and Fuel).'}</p>`;
  }
  if ($('sh-send')) {
    const avail = attackAvailable(0, b);
    UI.attackN = clamp(UI.attackN || avail, Math.min(1, avail), avail);
    $('sh-n').textContent = UI.attackN;
    $('sh-send').disabled = avail === 0;
    $('sh-attack').innerHTML = avail
      ? `<p class="desc">${avail} armed warbot${avail > 1 ? 's' : ''} can reach this from your garrisons (each garrison keeps one at home).</p>`
      : `<p class="desc">No armed warbots in range. Warbots attack from Outposts or your Command Base within ${ATTACK_RANGE} tiles, and only ones with Ammo go. Build an Outpost closer, and an Ammo Plant to keep garrisons stocked.</p>`;
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
    if (def.roadworks && (t.phase === 'toNode' || t.phase === 'work')) return t.phase === 'work' ? 'Laying asphalt' : 'Heading to a path to surface';
    if (t.phase === 'toNode') return def.plant ? 'Heading out to plant a grove' : `Heading out to gather ${def.gather ? GOOD[RES[t.gtype || def.gather].good].name : ''}`;
    if (t.phase === 'work') return def.plant ? 'Planting a stalk grove' : `Harvesting ${def.gather ? RES[t.gtype || def.gather].name.toLowerCase() : ''}`;
    if (t.phase === 'back') return u.carry ? `Bringing ${GOOD[u.carry].name} back` : `Walking back to the ${nm(t.bld)}`;
    return `Working at the ${nm(t.bld)}`;
  }
  return 'Busy';
}

function openBotSheet(u) {
  R.selected = 0; R.selTile = -1; UI.selBot = u.id;
  const html = `<div class="sheet-title"><div><h3>${BOTS[u.type].name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[u.owner]}"></span> ${u.owner === 0 ? 'Yours' : 'Rival'}</div></div></div>
    <p class="desc">${BOTS[u.type].desc}</p>
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
  const desc = type === R_URANIUM ? 'Scarce and radioactive. An Ore Mine within 4 tiles digs it (before any ore); a Nuclear Reactor enriches it, and 12 Uranium make one nuclear missile. There are only a few deposits on the planet: whoever holds them wins the race.'
    : type === R_CROP ? 'Planted by a Bio Farm on fertile soil. Once ripe, its worker harvests it into Fuel and plants a new one.'
    : type === R_OIL ? 'Build an Oil Pump right on top of the seep to pump Crude (it also draws from seep tiles next to it). A Refinery turns Crude into Fuel.'
    : `Gives ${GOOD[info.good].name}. Gathered by a ${BDEFS[by].name} within ${BDEFS[by].radius} tiles.${type === R_STALK ? ' A Grove Planter can grow more.' : ' It runs out eventually, so expand to find more.'}`;
  const rich = richRes(t) ? '<p class="desc"><b>Rich deposit:</b> it holds far more than the ones near your base. The frontier pays.</p>' : '';
  const html = `<div class="sheet-title"><div><h3>${richRes(t) ? 'Rich ' + info.name.toLowerCase() : info.name}</h3></div></div>
    <p class="desc">${desc}</p>${rich}
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

/*
 * The goods panel: for each good, how much you have, how fast it's made and used, what makes and
 * uses it, and what's waiting for it. Tap a goods counter to open it; tap another good to switch.
 */
function openGoodsSheet(g) {
  UI.goodSel = g;
  const shown = GOODS.filter((k) => !UI.goodEls[k].hidden);
  openSheet('goods', 0, `<div class="sheet-title"><div><h3>Goods</h3></div></div>
    <div class="pick-row goods-pick" id="gs-pick">${shown.map((k) => `<button data-g="${k}"><i class="gi ${k}"></i>${GOOD[k].name}</button>`).join('')}</div>
    <div id="gs-body"></div>`);
  for (const btn of $('gs-pick').children) btn.onclick = () => { UI.goodSel = btn.dataset.g; sfx('click'); refreshGoodsSheet(true); };
  refreshGoodsSheet(true);
}

function refreshGoodsSheet(full) {
  const g = UI.goodSel, p = 0;
  for (const btn of $('gs-pick').children) btn.classList.toggle('on', btn.dataset.g === g);
  if (full) $('gs-pick').querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const rate = goodRates(p)[g], net = rate.made - rate.used;
  let stored = 0, waiting = 0;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p || !b.built) continue;
    const def = BDEFS[b.type];
    if (def.store) stored += b.stock[g] || 0;
    else if (def.out && def.out[g]) waiting += b.stock[g] || 0;
  }
  const total = goodTotal(p, g);
  // Who makes it, who uses it.
  const makers = {}, users = {};
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p) continue;
    const def = BDEFS[b.type];
    const makes = (def.make && def.make[g]) || (def.gather && gatherTypes(b.type).some((r) => RES[r].good === g)) || (def.farm && g === 'fuel');
    if (makes) {
      const m = makers[b.type] = makers[b.type] || { n: 0, working: 0, stopped: 0 };
      m.n++;
      if (b.built && b.working) m.working++;
      else if (b.built && /^Stopped/.test(b.status || '')) m.stopped++;
    }
    const uses = (def.inp && def.inp[g]) || (def.charger && def.charger.fuel && g === 'fuel') || (def.repair && g === 'alloy') ||
      (def.ammo === g) || (def.ammoStock && g === 'ammo') || (def.nukeSilo && NUKE.parts[g]) || (def.missile && g === 'warhead');
    if (uses && b.built) { const u = users[b.type] = users[b.type] || { n: 0 }; u.n++; }
  }
  // What's waiting for it right now.
  let wantN = 0, wantB = 0, sites = 0;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p) continue;
    for (const [k, n] of needsOf(b)) {
      if (k !== g || n <= 0) continue;
      if ((b.stock[g] || 0) > 0 && b.built) continue; // stocked up, just topping up
      wantN += n; wantB++;
      if (!b.built) sites++;
    }
  }
  const fmt = (v) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);
  const runOut = net < -0.05 && total > 0 ? total / -net : Infinity;
  const short = wantB > 0 && total <= 0;
  const status = short ? `<div class="gs-alert bad"><b>Shortfall:</b> ${wantB} building${wantB === 1 ? '' : 's'}${sites ? ` (${sites} construction site${sites === 1 ? '' : 's'})` : ''} waiting for ${GOOD[g].name}, and none in stock.</div>`
    : runOut < 5 ? `<div class="gs-alert warn"><b>Running low:</b> at this rate you run out in about ${Math.max(1, Math.round(runOut))} minute${Math.round(runOut) === 1 ? '' : 's'}.</div>`
      : net > 0.05 ? '<div class="gs-alert good">Growing: you make more than you use.</div>' : '';
  const list = (o, label) => Object.keys(o).length
    ? Object.keys(o).map((t) => `<span class="gtag">${o[t].n} ${o[t].n === 1 ? BDEFS[t].name : BDEFS[t].name + (BDEFS[t].name.endsWith('s') ? '' : 's')}${o[t].working !== undefined ? ` <small>${o[t].working} working${o[t].stopped ? `, ${o[t].stopped} at limit` : ''}</small>` : ''}</span>`).join('')
    : `<span class="hint">${label}</span>`;
  const extraUse = g === 'cement' ? ' Also construction and roads.' : (BDEFS.depot.cost[g] || ['fiber', 'alloy', 'chip', 'stone'].includes(g)) ? ' Also construction.' : '';
  $('gs-body').innerHTML = `<p class="desc">${GOOD[g].desc}</p>${status}
    <div class="gs-stats">
      <div><b>${fmt(total)}</b><span>on hand</span></div>
      <div><b class="up">+${fmt(rate.made)}</b><span>made / min</span></div>
      <div><b class="down">−${fmt(rate.used)}</b><span>used / min</span></div>
      <div><b class="${net > 0.05 ? 'up' : net < -0.05 ? 'down' : ''}">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</b><span>net / min</span></div>
    </div>
    <div class="kv"><span>In storage</span><span>${stored}</span></div>
    <div class="kv"><span>Waiting for pickup at buildings</span><span>${waiting}</span></div>
    <div class="kv"><span>Wanted right now</span><span>${wantN ? `${wantN} by ${wantB} building${wantB === 1 ? '' : 's'}` : 'Nothing waiting'}</span></div>
    <div class="section-label">Made by</div><div class="goodlist">${list(makers, g === 'cement' || g === 'alloy' ? 'Nothing yet.' : 'Nothing makes it yet.')}</div>
    <div class="section-label">Used by</div><div class="goodlist">${list(users, 'No buildings use it.')}</div>${extraUse ? `<p class="hint">${extraUse.trim()}</p>` : ''}
    <div class="section-label">On hand over time</div><canvas class="chart small" id="gs-chart"></canvas>
    <p class="hint">Rates are over the last two minutes. The Statistics screen in the pause menu shows the whole game.</p>`;
  const H = S.hist;
  if (H && H.t.length > 1 && H.p[0].goods && H.p[0].goods[g]) lineChart($('gs-chart'), { xs: H.t, series: [{ name: GOOD[g].name, color: GOOD[g].color, values: H.p[0].goods[g] }] });
}

/** Your robots by type: how many, and what they're doing. Opened from the population chip. */
function openPopSheet() {
  openSheet('pop', 0, `<div class="sheet-title"><div><h3>Your robots</h3></div></div>
    <p class="desc">Every robot you have, by type, and what they're doing right now. Order more at the Bot Foundry.</p>
    <div id="sh-pop"></div>`);
  refreshPopSheet();
}

function refreshPopSheet() {
  const n = {};
  const add = (type, key) => { n[type] = n[type] || { total: 0 }; n[type].total++; if (key) n[type][key] = (n[type][key] || 0) + 1; };
  let total = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0) continue;
    total++;
    const t = u.task, tt = t && t.type;
    if (u.type === 'warbot') {
      add(u.type, u.inside ? 'garrison' : 'field');
      if ((u.ammo ?? WARBOT_AMMO) <= 0) n.warbot.noAmmo = (n.warbot.noAmmo || 0) + 1;
    } else if (tt === 'charge' || (u.inside && insideCharger(u) && !tt && (u.bat ?? 100) < 99)) add(u.type, 'charging');
    else if (tt === 'haul') add(u.type, 'carrying');
    else if (tt === 'staff') add(u.type, 'running');
    else if (tt === 'build' || tt === 'pave' || tt === 'fix') add(u.type, 'building');
    else if (tt === 'repair') add(u.type, 'repairing');
    else add(u.type, 'free');
  }
  const part = (o, k, label) => (o[k] ? `${o[k]} ${label}` : '');
  const rows = BOT_ORDER.filter((k) => n[k] || warOn() || !BOTS[k].war).map((k) => {
    const o = n[k] || { total: 0 };
    const bits = k === 'warbot'
      ? [part(o, 'garrison', 'in garrisons'), part(o, 'field', 'in the field'), part(o, 'noAmmo', 'out of Ammo')]
      : [part(o, 'running', 'running buildings'), part(o, 'carrying', 'carrying goods'), part(o, 'building', 'building or paving'),
        part(o, 'charging', 'recharging'), part(o, 'repairing', 'being repaired'), part(o, 'free', 'free')];
    return `<div class="kv pop-row"><span><b>${o.total}</b> ${o.total === 1 ? BOTS[k].name : BOTS[k].plural}</span><span>${bits.filter(Boolean).join(' · ') || '–'}</span></div>`;
  });
  const cap = S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS;
  $('sh-pop').innerHTML = rows.join('') + `<div class="kv"><span>All robots</span><span><b>${total}</b> of ${cap} (the limit)</span></div>`;
}

function refreshSheet() {
  if (!UI.sheetKind || UI.sheetKind === 'build') return;
  if (UI.sheetKind === 'pop') { refreshPopSheet(); return; }
  if (UI.sheetKind === 'goods') { refreshGoodsSheet(false); return; }
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
      (u.type === 'warbot' ? `<div class="kv"><span>Ammo</span><span>${u.ammo ?? WARBOT_AMMO} / ${WARBOT_AMMO} shots${!u.ammo ? ' (out: can\'t fight until it reloads)' : ''}</span></div>` : '') +
      (u.carry ? `<div class="kv"><span>Carrying</span><span>${goodTag(u.carry, (u.carryN > 1 ? u.carryN + ' × ' : '') + GOOD[u.carry].name)}</span></div>` : '');
    if ($('sh-recall')) $('sh-recall').hidden = !(u.task && u.task.type === 'hold');
  } else if (UI.sheetKind === 'move') {
    const t = UI.sheetFor, i = t % S.W, j = (t / S.W) | 0;
    const avail = refreshMoveStepper(i, j);
    $('mv-info').innerHTML = `<p class="desc">${avail
      ? `${avail} armed warbot${avail > 1 ? 's' : ''} available in your garrisons (each keeps one at home).`
      : S.zone[t] !== homeZone(0) ? 'Your warbots cannot walk there from your garrisons.' : 'No armed warbots available. Make some at the Bot Foundry, and keep your garrisons stocked with Ammo: warbots without it can\'t fight.'}</p>`;
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
  { text: 'Tap <b>Build</b> and place a <b>Harvester</b> beside the teal stalk groves.', done: () => hasBuilt('harvester') || hasAny('harvester') },
  { text: '<b>Haulers only drive on roads.</b> Tap <b>Paths</b>, sketch a road from the ring round your Command Base to the Harvester site and tap <b>Build</b> (or tap the site and choose <b>Lay road</b>). Free workers pave it.', done: () => hasBuilt('harvester') || S.buildings.some((b) => !b.dead && b.owner === 0 && b.type === 'harvester' && !b.unlinked) },
  { text: 'Build a <b>Quarry</b> near the grey boulders to get Stone.', done: () => hasBuilt('quarry') },
  { text: 'Build a <b>Cement Works</b> near your Command Base: it bakes Stone into <b>Cement</b>, which nearly every building and every road is made of.', done: () => hasBuilt('kiln') },
  { text: 'Build an <b>Ore Mine</b> by the dark ore veins and a <b>Crystal Tap</b> by the violet crystals.', done: () => hasBuilt('mine') && hasBuilt('tap') },
  { text: 'Build a <b>Smelter</b>: it turns Ore and Fiber into Alloy.', done: () => hasBuilt('smelter') },
  { text: 'Build a <b>Chip Fab</b>: it turns Crystal and Alloy into Chips.', done: () => hasBuilt('fab') },
  { text: 'Build a <b>Bot Foundry</b> so you can make more workers.', done: () => hasBuilt('foundry') },
  { text: 'Tap your <b>Bot Foundry</b> and order some <b>Workers</b>: it only builds the bots you ask for.', done: () => S.players[0].stats.bots > S.players[0].stats.startBots || S.buildings.some((b) => !b.dead && b.owner === 0 && hasOrders(b)) },
  { text: 'Build an <b>Outpost</b> near your border to claim more land.', done: () => hasBuilt('outpost') },
  { text: 'Charging Stations burn <b>Fuel</b>. Build a <b>Bio Farm</b> beside the dark fertile soil to grow it (your Agribot runs it).', done: () => hasBuilt('farm') || hasBuilt('refinery') || playerGoods(0).fuel >= 20 },
  { text: 'Busy crossings jam up. In <b>Paths</b>, choose <b>Junctions</b> and put a traffic light on a junction where three or four roads meet.', done: () => Object.keys(S.lights).some((k) => S.lights[k].owner === 0) || !ownJunction() },
  { text: 'Warbots need <b>Ammo</b>. Build an <b>Ammo Plant</b>: haulers stock your Command Base and Outposts and warbots reload there.', done: () => S.mode === 'colony' || hasBuilt('armory') },
];

function ownJunction() {
  const net = roadNet();
  for (let t = 0; t < S.W * S.H; t++) if (net.junc[t] && S.owner[t] === 0) return true;
  return false;
}

function hasAny(type) {
  for (const b of S.buildings) if (!b.dead && b.owner === 0 && b.type === type) return true;
  return false;
}

function hasBuilt(type) {
  for (const b of S.buildings) if (!b.dead && b.owner === 0 && b.built && b.type === type) return true;
  return false;
}

function objectiveText() {
  const cut = S.buildings.filter((b) => !b.dead && b.owner === 0 && b.unlinked);
  const warn = cut.length && !(cut.length === 1 && cut[0].type === 'harvester' && !hasBuilt('harvester'))
    ? `<span class="err">${cut.length === 1 ? `Your ${BDEFS[cut[0].type].name}${cut[0].built ? '' : ' site'} has` : `${cut.length} buildings have`} no road to storage.</span> Tap ${cut.length === 1 ? 'it' : 'one'} and choose <b>Lay road</b>.<br>` : '';
  if (S.mission) return warn + missionObjectiveHTML();
  for (const o of OBJECTIVES) if (!o.done()) return warn + o.text;
  if (warn) return warn;
  if (S.mode === 'colony') {
    const pct = Math.round(landShare(0) * 100);
    const next = COLONY_MILESTONES[S.milestone];
    return next !== undefined
      ? `Colonize the planet: <b>${pct}%</b> claimed. Next milestone at ${Math.round(next * 100)}%.`
      : `<b>${pct}%</b> of the planet colonized. Every milestone reached!`;
  }
  return 'Gather warbots in Outposts near the rival, then tap the <b>rival Command Base</b> and send them in to capture it.';
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
  let workers = 0, idle = 0, war = 0, haulers = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0) continue;
    if (u.type === 'warbot') war++;
    else if (u.type === 'hauler' || u.type === 'truck') haulers++;
    else if (u.type === 'worker') { workers++; if (isIdleWorker(u)) idle++; }
  }
  $('pop').title = `${workers} workers (${idle} free), ${haulers} haulers and trucks` + (warOn() ? `, ${war} warbots` : '') + '. Tap for every robot by type.';
  $('pop').innerHTML = `<span class="dot" style="background:#ece6da;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[0]}"></span>${workers}<span class="wide"> workers</span> <span style="color:var(--muted)">(${idle} free)</span>` +
    ` <span class="dot" style="background:#ffb547;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[0]}"></span>${haulers}<span class="wide"> haulers</span>` +
    (warOn() ? ` <span class="dot" style="background:${PLAYER_COLORS[0]};border-radius:2px;transform:rotate(45deg)"></span>${war}` : '');
  $('clock').textContent = S.mode === 'colony' ? `${Math.round(landShare(0) * 100)}% land` : fmtTime(S.time);
  const obj = $('objective');
  obj.innerHTML = UI.objCollapsed && !S.mission ? 'Goal ▸' : objectiveText();
  obj.classList.toggle('small', UI.objCollapsed);
  if (UI.sheetKind === 'build') {
    // keep build-menu affordability current without rebuilding the buttons
    for (const el of $('sheet-body').querySelectorAll('.bcard[data-t]')) {
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
    if ((m.kind === 'bad' || m.kind === 'warn') && (m.x || m.y)) UI.lastAlert = { x: m.x, y: m.y };
  }
  updateMapTip();
  UI.hudT -= dt;
  if (UI.hudT <= 0) { UI.hudT = 0.25; updateHUD(); refreshSheet(); placeMinimap(); refreshSelection(); }
  if (S.winner >= 0 && !UI.overShown) showGameOver();
}

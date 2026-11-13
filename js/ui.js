'use strict';
/*
 * Terrafall — HTML interface: menus, HUD, build menu, info sheets, objectives, messages.
 */

/** Version of the remembered new-game settings: 2 brought new defaults for rival style, Nuclear race and Planet events. */
const SETTINGS_V = 2;

const UI = {
  inGame: false, paused: false, speed: 1, overShown: false,
  menu: { mode: 'versus', diff: 'normal', seed: randomSeed(), size: { ...DEFAULT_SIZE }, rough: DEFAULT_ROUGH, rich: DEFAULT_RICH, shape: 0, style: 1, nuke: 1, events: 0, wild: 1, unlimited: 0 },
  sheetKind: null, sheetFor: 0, sheetT: 0, hudT: 0,
  icons: {}, attackN: 0, demolishArm: 0, lastPaint: null, placeType: null,
  goodEls: {}, lastGoods: {}, objCollapsed: false, selBot: 0,
  sel: [], groups: {}, lastGroup: { k: 0, at: 0 }, lastAlert: null, tipKey: '', msgLog: [],
};

const $ = (id) => document.getElementById(id);

/**
 * Text made safe to write into a panel's HTML (or an attribute). Everything that comes out of the game
 * state or this device's storage goes through it: a save file is somebody else's text until proven otherwise.
 */
function esc(v) { return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c])); }

function randomSeed() { return 1 + Math.floor(Math.random() * 999998); }

/** v if it's an index into a table of presets, else def (a setting kept by another version, or damaged). */
function presetIndex(v, list, def) { return Number.isInteger(v) && v >= 0 && v < list.length ? v : def; }

/** Keep the new-game settings to what the menu offers, whatever this device had remembered. */
function cleanMenu() {
  const m = UI.menu, size = m.size && typeof m.size === 'object' ? m.size : {};
  m.mode = m.mode === 'colony' ? 'colony' : 'versus';
  m.diff = ownKey(DIFFICULTY, m.diff) ? m.diff : 'normal';
  m.size = { versus: presetIndex(size.versus, SIZE_PRESETS, DEFAULT_SIZE.versus), colony: presetIndex(size.colony, SIZE_PRESETS, DEFAULT_SIZE.colony) };
  m.rough = presetIndex(m.rough, TERRAIN_PRESETS, DEFAULT_ROUGH);
  m.rich = presetIndex(m.rich, RESOURCE_PRESETS, DEFAULT_RICH);
  m.shape = presetIndex(m.shape, SHAPE_PRESETS, 0);
  m.biome = presetIndex(m.biome, BIOME_ORDER, 0);
  m.style = presetIndex(m.style, [0].concat(PERSONALITY_ORDER), 1);
  m.players = m.players === 3 ? 3 : 2;
  for (const k of ['nuke', 'events', 'wild', 'unlimited']) m[k] = m[k] ? 1 : 0;
}

function iconFor(type, owner) {
  const key = type + '@' + (owner || 0);
  if (!UI.icons[key]) UI.icons[key] = buildingIcon(type, 96, owner || 0);
  return UI.icons[key];
}

function goodTag(g, text, short) {
  return `<span class="gtag${short ? ' short' : ''}"><i class="gi ${esc(g)}"></i>${esc(text)}</span>`;
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
  for (const btn of $('m-diff').children) btn.onclick = () => { UI.menu.diff = btn.dataset.v; syncMenu(); saveSettings(); sfx('click'); };
  for (const btn of $('m-players').children) btn.onclick = () => { UI.menu.players = +btn.dataset.v; syncMenu(); saveSettings(); sfx('click'); };
  $('m-reroll').onclick = () => { UI.menu.seed = randomSeed(); syncMenu(); sfx('click'); };
  $('m-saveplanet').onclick = () => { savePlanet(menuPlanet()); sfx('place'); toast(`Saved Planet #${UI.menu.seed}: pick it from Saved planets any time.`, 'good'); syncMenu(); };
  $('p-saveplanet').onclick = () => { if (!S) return; savePlanet(gamePlanet()); sfx('place'); toast(`Saved Planet #${S.seed}: start it again from Saved planets in the new-game menu.`, 'good'); };
  // Map settings sliders (remembered on this device; map size is remembered per mode).
  // Settings from before v2 drop their rival style, Nuclear race and Planet events, so the new defaults
  // (a Balanced rival, Nuclear race on, Planet events off) reach every device once.
  try {
    const saved = JSON.parse(localStorage.getItem('botfall.settings') || '{}') || {};
    if ((saved.v || 0) < SETTINGS_V) { delete saved.style; delete saved.nuke; delete saved.events; }
    for (const k of ['size', 'rough', 'rich', 'shape', 'nuke', 'biome', 'players', 'diff', 'style', 'events', 'wild', 'unlimited']) if (saved[k] !== undefined) UI.menu[k] = saved[k];
  } catch (e) { /* defaults */ }
  cleanMenu(); // (a remembered value this version doesn't offer falls back to the default)
  const saveSettings = () => {
    try { localStorage.setItem('botfall.settings', JSON.stringify({ v: SETTINGS_V, size: UI.menu.size, rough: UI.menu.rough, rich: UI.menu.rich, shape: UI.menu.shape, nuke: UI.menu.nuke, biome: UI.menu.biome, players: UI.menu.players, diff: UI.menu.diff, style: UI.menu.style, events: UI.menu.events, wild: UI.menu.wild, unlimited: UI.menu.unlimited })); } catch (e) { /* storage unavailable */ }
  };
  // Choices are buttons (all the options in view, easy to tap), and On/Off settings are switches.
  const choice = (id, labels, get, set) => {
    const el = $(id);
    el.innerHTML = '';
    labels.forEach((lab, v) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.v = v; b.textContent = lab; b.setAttribute('role', 'radio');
      b.onclick = () => { set(v); syncMenu(); saveSettings(); sfx('click'); };
      el.appendChild(b);
    });
    el._get = get;
  };
  choice('m-shape', SHAPE_PRESETS.map((p) => p.name), () => UI.menu.shape || 0, (v) => { UI.menu.shape = v; });
  choice('m-size', SIZE_PRESETS.map((p) => p.name), () => UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], (v) => { UI.menu.size[UI.menu.mode] = v; });
  choice('m-biome', BIOME_ORDER.map((k) => BIOMES[k].name), () => UI.menu.biome || 0, (v) => { UI.menu.biome = v; });
  choice('m-rough', TERRAIN_PRESETS.map((p) => p.name), () => UI.menu.rough, (v) => { UI.menu.rough = v; });
  choice('m-rich', RESOURCE_PRESETS.map((p) => p.name), () => UI.menu.rich, (v) => { UI.menu.rich = v; });
  choice('m-style', ['Random', ...PERSONALITY_ORDER.map((k) => PERSONALITIES[k].name)], () => Math.min(PERSONALITY_ORDER.length, UI.menu.style || 0), (v) => { UI.menu.style = v; });
  for (const [id, k] of [['m-nuke', 'nuke'], ['m-wild', 'wild'], ['m-events', 'events'], ['m-unlimited', 'unlimited']]) {
    $(id).onchange = () => { UI.menu[k] = $(id).checked ? 1 : 0; syncMenu(); saveSettings(); sfx('click'); };
  }
  $('m-daynight').onchange = () => { setTodEnabled($('m-daynight').checked); syncMenu(); sfx('click'); };
  // More settings opens and closes; it's remembered on this device.
  try { $('m-more').open = localStorage.getItem('botfall.moreOpen') === '1'; } catch (e) { /* storage unavailable */ }
  $('m-more').ontoggle = () => { try { localStorage.setItem('botfall.moreOpen', $('m-more').open ? '1' : '0'); } catch (e) { /* storage unavailable */ } };
  $('m-new').onclick = () => { audioUnlock(); startNewGame(); };
  $('m-continue').onclick = () => { audioUnlock(); continueGame(); };
  $('m-import').onclick = () => { audioUnlock(); $('m-import-msg').hidden = true; $('m-import-file').value = ''; $('m-import-file').click(); };
  $('m-import-file').onchange = () => { const f = $('m-import-file').files && $('m-import-file').files[0]; if (f) importSaveFile(f); };
  $('p-export').onclick = () => { sfx('click'); downloadSave(); };
  $('m-help').onclick = () => showHelp();
  $('h-close').onclick = () => { $('screen-help').hidden = true; UI.paused = !$('screen-pause').hidden; };

  // Pause menu
  $('btn-pause').onclick = () => { UI.paused = true; $('screen-pause').hidden = false; syncSaved(); sfx('click'); };
  $('p-resume').onclick = () => { UI.paused = false; $('screen-pause').hidden = true; };
  // The hidden rival boost: tap the clock three times quickly (or press ` on a keyboard).
  $('clock').addEventListener('click', () => {
    const now = performance.now();
    UI.clockTaps = (UI.clockTaps || []).filter((t) => now - t < 1200);
    UI.clockTaps.push(now);
    if (UI.clockTaps.length >= 3) { UI.clockTaps = []; openBoost(); }
  });
  $('bo-close').onclick = () => closeBoost();
  // Music and Effects volume (remembered on this device).
  const syncVol = () => {
    for (const [id, k] of [['p-music', 'music'], ['p-fx', 'fx']]) {
      $(id).value = Math.round(AUDIO[k] * 100);
      $(id + '-v').textContent = AUDIO[k] > 0 ? Math.round(AUDIO[k] * 100) + '%' : 'Off';
    }
  };
  $('p-music').oninput = () => { setVolume('music', $('p-music').value / 100); syncVol(); };
  $('p-fx').oninput = () => { setVolume('fx', $('p-fx').value / 100); syncVol(); };
  $('p-fx').onchange = () => sfx('place');
  const syncTod = () => { $('p-daynight').textContent = `Day and night: ${todEnabled() ? 'On' : 'Off'}`; };
  syncTod();
  $('p-daynight').onclick = () => { setTodEnabled(!todEnabled()); syncTod(); sfx('click'); };
  initFullscreen();
  syncVol();
  $('p-help').onclick = () => showHelp();
  $('p-quit').onclick = () => { if (!UI.saveHold) saveGame(); $('screen-pause').hidden = true; toMenu(); };

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
  $('objective').onclick = () => { UI.objCollapsed = !UI.objCollapsed; UI.objManual = true; UI.hudT = 0; };
  $('btn-msgs').onclick = () => { sfx('click'); if (UI.sheetKind === 'msgs') closeSheet(); else { setMode('normal'); openMsgSheet(); } };
  $('sheet-close').onclick = () => closeSheet();
  initSheetGrab();
  initSelBar();
  // A building panel's buttons do nothing once the building has changed hands under it: the panel is built again instead.
  $('sheet-body').addEventListener('click', (e) => { if (sheetStale()) { e.stopPropagation(); e.preventDefault(); refreshSheet(); } }, true);
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
  // A touch on the minimap stays on it (see initInput): one near its edge went to the close button beside it.
  $('mm-canvas').addEventListener('click', () => {});
  $('mm-hide').onclick = () => { setMinimap(false); sfx('click'); };
  $('mm-show').onclick = () => { setMinimap(true); sfx('click'); };
  try { MM.on = localStorage.getItem('botfall.minimap') !== '0'; } catch (e) { MM.on = true; }
  window.addEventListener('resize', () => { if (UI.inGame) { layoutMinimap(); placeMinimap(); if (UI.sheetKind) sheetMoved(); } });

  initKeyboard();
  initDialogs();
  initBack();
  // A long press on the interface brings up no browser menu under a finger (Save image, Share...); a mouse keeps its right-click off the map.
  document.addEventListener('contextmenu', (e) => { if ((e.pointerType ? e.pointerType !== 'mouse' : onTouch()) && !(e.target.closest && e.target.closest('input, textarea, a'))) e.preventDefault(); });
  // The illustrated manual is a page beside this one: the single-file build has none, so there the link is left out.
  if ($('h-manual')) $('h-manual').hidden = !!window.TOD_BUNDLE;
  document.addEventListener('visibilitychange', () => { if (document.hidden && UI.inGame) autoSave(); syncWakeLock(); });
  window.addEventListener('pagehide', () => { if (UI.inGame) autoSave(); });
  setInterval(() => { if (UI.inGame && !UI.paused) autoSave(); }, AUTOSAVE_EVERY * 1000);
  syncMenu();
}

/** A line under the map shape choice: what each shape plays like. */
const SHAPE_BLURB = [
  'Open ground with hills, cliffs and resource fields between the bases.',
  'A narrow planet with the bases far apart: built for long supply lines (trucks, Road Trains and rail).',
  'A belt of crags across the middle with one to three narrow channels winding through it, different every game: whoever holds them holds the map.',
  'Each base on its own island, with two or three medium islands between, a wide sea apart: cross by ship, or by long, dear bridges.',
  'The richest fields lie in a sunken crater in the middle, with one ramp down on each side.',
  'Each base on a high plateau ringed by cliffs, with only two slopes down: easy to hold, slow to break out of.',
  'Mesas standing over a canyon floor far below: cross between the clifftops on Viaducts.',
  'A chasm splits the planet, crossed only by a few natural rock arches: hold yours.',
  'A massif too steep to climb fills the middle, with a valley round it on each side: two long ways round.',
  'A barren, crag-strewn waste with a few rich oases joined by narrow passes: an expansion race.',
  'Four quarters split by ridges, meeting at a rich plaza; the two quarters no one holds are rich.',
  'Many small lakes, with roads weaving between them: bridges save long detours.',
];

function syncMenu() {
  for (const btn of $('m-mode').children) btn.classList.toggle('on', btn.dataset.v === UI.menu.mode);
  for (const btn of $('m-diff').children) btn.classList.toggle('on', btn.dataset.v === UI.menu.diff);
  $('m-diff-field').hidden = UI.menu.mode === 'colony';
  // Free-for-all (you and two rivals) on the map shapes with room for three.
  const ffaOk = !!SHAPE_PRESETS[UI.menu.shape || 0].ffa, three = UI.menu.mode === 'versus' && UI.menu.players === 3 && ffaOk;
  $('m-players-field').hidden = UI.menu.mode === 'colony';
  for (const btn of $('m-players').children) { btn.classList.toggle('on', +btn.dataset.v === (three ? 3 : 2)); btn.disabled = btn.dataset.v === '3' && !ffaOk; }
  $('m-players-note').hidden = ffaOk || UI.menu.players !== 3;
  $('m-players-note').textContent = `${SHAPE_PRESETS[UI.menu.shape || 0].name} maps are for two players only: pick Standard, Islands, Crater, Plateaus or Sky islands for a free-for-all.`;
  $('m-mode-desc').textContent = UI.menu.mode === 'colony'
    ? (UI.menu.wild ? 'No rival, but creatures nest in the wilds and raid what you build near them. Build supply chains, research upgrades and spread across the whole map.'
      : 'No rival. Settle the planet at your own pace: build supply chains, research upgrades and spread across the whole map.')
    : three ? 'Free-for-all: you and two rival colonies on a round planet. Capture a rival\'s Command Base and everything it built is yours. Last colony standing wins.'
      : 'Race a rival colony across the planet. Build up, then capture its Command Base to win.';
  $('m-seed').textContent = 'Planet #' + UI.menu.seed;
  renderPlanets();
  const size = UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], shape = UI.menu.shape || 0;
  for (const id of ['m-shape', 'm-size', 'm-biome', 'm-rough', 'm-rich', 'm-style']) {
    const el = $(id), v = el._get();
    for (const b of el.children) { const on = +b.dataset.v === v; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); }
  }
  $('m-shape-desc').textContent = SHAPE_BLURB[shape] || '';
  const dims = mapDims({ size, shape, players: three ? 3 : 2 });
  $('m-size-v').textContent = `${dims.W}×${dims.H} tiles`;
  // Rival style: 0 is a random personality for each rival, then each one in PERSONALITY_ORDER.
  const style = Math.min(PERSONALITY_ORDER.length, UI.menu.style || 0), P = style && PERSONALITIES[PERSONALITY_ORDER[style - 1]];
  $('m-style-desc').textContent = P ? `${P.name}: ${P.desc}.` : 'Each rival gets a personality at random: Balanced, Turtle, Raider, Rusher or Tycoon.';
  $('m-style-row').hidden = UI.menu.mode === 'colony';
  $('m-wild-row').hidden = UI.menu.mode !== 'colony';
  $('m-nuke').checked = !!UI.menu.nuke;
  $('m-wild').checked = !!UI.menu.wild;
  $('m-events').checked = !!UI.menu.events;
  $('m-unlimited').checked = !!UI.menu.unlimited;
  $('m-daynight').checked = todEnabled();
  // What More settings holds that isn't the default, so it's clear at a glance with it closed.
  const sum = [];
  if (UI.menu.biome) sum.push(BIOMES[BIOME_ORDER[UI.menu.biome]].name);
  if (UI.menu.rough !== DEFAULT_ROUGH) sum.push(TERRAIN_PRESETS[UI.menu.rough].name + ' terrain');
  if (UI.menu.rich !== DEFAULT_RICH) sum.push(RESOURCE_PRESETS[UI.menu.rich].name + ' resources');
  if (style !== 1 && UI.menu.mode !== 'colony') sum.push(P ? P.name + ' rival' : 'Random rivals');
  if (!UI.menu.nuke) sum.push('no Nuclear race');
  if (UI.menu.mode === 'colony' && !UI.menu.wild) sum.push('no wildlife');
  if (UI.menu.events) sum.push('Planet events');
  if (!todEnabled()) sum.push('always day');
  if (UI.menu.unlimited) sum.push('Unlimited resources');
  $('m-more-sum').textContent = sum.length ? sum.join(' · ') : 'Planet, biome, terrain, resources, rival style, options';
  $('m-continue').hidden = !hasSave();
}

/* ------------------------------------------------------------------ autosave */

/*
 * The game saves itself every AUTOSAVE_EVERY seconds while you play (and whenever you switch away
 * or close it), so a long game is never lost: Continue on the main menu picks it up. The pause menu
 * says when it last saved; if a save fails (storage full or blocked), you're told once.
 */
const AUTOSAVE_EVERY = 20;
function autoSave() {
  // (UI.saveHold: the game keeps failing, see `stage` in main.js. The last good save is left alone.)
  if (!S || UI.saveHold || S.winner >= 0 || S.players[0].ai) return;
  if (saveGame()) { UI.savedAt = Date.now(); UI.saveFailed = false; }
  else if (!UI.saveFailed) {
    UI.saveFailed = true;
    toast('Couldn\'t save the game: this browser\'s storage is full or blocked. Keep this tab open to keep playing.', 'warn');
  }
}

function syncSaved() {
  const el = $('p-saved');
  if (!el) return;
  const s = UI.savedAt ? Math.round((Date.now() - UI.savedAt) / 1000) : -1;
  el.textContent = UI.saveHold ? 'Saving is paused: something in the game keeps going wrong. Reload the page to carry on from your last save.'
    : UI.saveFailed ? 'Saving isn\'t working in this browser right now: keep this tab open.'
    : `Your game saves itself every ${AUTOSAVE_EVERY} seconds` + (s >= 0 ? ` (last saved ${s < 5 ? 'just now' : s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago'})` : '') + '. If it closes, tap Continue on the main menu.';
}

/* ------------------------------------------------------------------ a phone's Back button, and keeping the screen on */

/**
 * In a game the Back button (a phone's, or the browser's) steps back like Esc instead of leaving the page: it
 * closes what's on top (a screen, a panel, a mode, the selection), and with nothing open it brings up the pause
 * menu, where Save and quit is. A history entry is added on entering a game (armBack) and put back each time
 * Back takes it; leaving for the main menu removes it, so Back works as usual there. (The game was already
 * saved on the way out: this just stops a stray Back from ending the session.)
 */
function initBack() {
  window.addEventListener('popstate', () => {
    if (!UI.inGame) return;
    history.pushState({ terrafall: 1 }, '');
    escapeKey();
  });
}
function armBack() { try { if (!(history.state && history.state.terrafall)) history.pushState({ terrafall: 1 }, ''); } catch (e) { /* no history to add to (a sandboxed frame) */ } }
function disarmBack() { try { if (history.state && history.state.terrafall) history.back(); } catch (e) { /* as above */ } }

/**
 * The screen is kept awake while a game is running: a colony is watched for a minute at a time with no touch,
 * and a phone would dim and lock. Let go as soon as the game is paused, over, left or hidden (the browser drops
 * it when the page is hidden anyway). Looked at every quarter second from uiTick, and on leaving a game.
 */
function syncWakeLock() {
  const want = UI.inGame && !UI.paused && !document.hidden && !!S && S.winner < 0;
  if (want && !UI.wake && !UI.wakeAsked && navigator.wakeLock) {
    UI.wakeAsked = true;
    navigator.wakeLock.request('screen').then((w) => {
      UI.wake = w;
      w.addEventListener('release', () => { if (UI.wake === w) UI.wake = null; });
    }).catch(() => { /* not allowed just now (battery saver, no permission): tried again next time */ }).then(() => { UI.wakeAsked = false; });
  } else if (!want && UI.wake) { const w = UI.wake; UI.wake = null; w.release().catch(() => {}); }
}

/* ------------------------------------------------------------------ overlays as dialogs */

/** The overlay on top (Help over the pause menu, say), or null when none is showing. */
function topScreen() {
  let top = null, tz = -1;
  for (const el of document.querySelectorAll('.screen')) {
    if (el.hidden) continue;
    const z = +getComputedStyle(el).zIndex || 0;
    if (z >= tz) { top = el; tz = z; }
  }
  return top;
}

/**
 * The overlays (menu, pause, help, statistics, game over...) work as dialogs for the keyboard and for
 * screen readers: opening one moves the focus into it, Tab stays inside the one on top, and closing
 * it puts the focus back where it was.
 */
function initDialogs() {
  const stops = (scr) => [...scr.querySelectorAll('button, a[href], input, select, summary')].filter((el) => !el.disabled && el.tabIndex >= 0 && el.offsetParent);
  const watch = new MutationObserver((list) => {
    for (const m of list) {
      const scr = m.target, open = !scr.hidden, a = document.activeElement;
      if (open === !!scr._open) continue;
      scr._open = open;
      if (open) {
        scr._back = a && a !== document.body && !scr.contains(a) ? a : null;
        scr.focus({ preventScroll: true });
      } else if (!a || a === document.body || scr.contains(a)) {
        const b = scr._back;
        if (b && b.isConnected && b.offsetParent) b.focus({ preventScroll: true }); else if (a && a !== document.body) a.blur();
      }
    }
  });
  for (const scr of document.querySelectorAll('.screen')) { scr._open = !scr.hidden; watch.observe(scr, { attributes: true, attributeFilter: ['hidden'] }); }
  document.addEventListener('keydown', (e) => {
    const scr = e.key === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey ? topScreen() : null;
    if (!scr) return;
    const f = stops(scr), a = document.activeElement, first = f[0], last = f[f.length - 1];
    if (!f.length) { e.preventDefault(); return; }
    if (!scr.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey ? a === first || !f.includes(a) : a === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  }, true);
}

/* ------------------------------------------------------------------ rival boost (hidden) */

function openBoost() {
  if (!UI.inGame || !S) return;
  if ($('screen-boost').hidden) UI.boostWasPaused = UI.paused;
  UI.paused = true;
  $('screen-boost').hidden = false;
  $('bo-msg').textContent = '';
  renderBoost();
  sfx('click');
}

function closeBoost() {
  $('screen-boost').hidden = true;
  UI.paused = !!UI.boostWasPaused || !$('screen-pause').hidden;
}

function renderBoost() {
  const rivals = boostableRivals(), body = $('bo-body');
  if (!rivals.length) { body.innerHTML = '<p class="mode-desc">There\'s no rival colony in this game to help.</p>'; return; }
  body.innerHTML = rivals.map((P) => {
    const st = PERSONALITIES[P.style];
    return `<div class="boost-row" data-p="${esc(P.id)}"><div class="boost-head"><i class="dot" style="background:${PLAYER_COLORS[P.id]}"></i>` +
      `<b>${playerName(P.id)}</b>${st ? ' · ' + st.name : ''}<small>${P.boosts ? `boosted ${esc(P.boosts)}×` : ''}</small></div>` +
      `<div class="boost-btns"><button class="btn small" data-k="goods" title="${Object.entries(BOOST.goods).map(([g, n]) => n + ' ' + GOOD[g].name).join(', ')}">Supply drop</button>` +
      `<button class="btn small" data-k="warbots">+${BOOST.warbots} Warbots</button><button class="btn small" data-k="workers">+${BOOST.workers} Workers</button></div></div>`;
  }).join('');
  for (const btn of body.querySelectorAll('button')) {
    btn.onclick = () => {
      const p = +btn.closest('.boost-row').dataset.p, k = btn.dataset.k, n = boostRival(p, k);
      const what = k === 'goods' ? 'a supply drop' : `${n} ${k === 'warbots' ? 'armed Warbot' : 'Worker'}${n === 1 ? '' : 's'}`;
      const msg = n ? `You gave ${playerName(p, true)} ${what}.` : `${playerName(p)} is at its robot limit.`;
      $('bo-msg').textContent = msg;
      sfx(n ? 'place' : 'click');
      renderBoost();
    };
  }
}

/* ------------------------------------------------------------------ full screen */

/*
 * Chrome on a computer opens the installed app in an ordinary window: it ignores the manifest's
 * "fullscreen". So the game offers full screen itself: a button in the top bar (on a computer), one
 * in the pause menu, and Alt+Enter. The installed app on a computer goes full screen on your first
 * click, and remembers if you leave it. While full screen, Esc stays the game's key (hold it to leave).
 */
const FS_KEY = 'terrafall.fullscreen';
const FS_ICON = {
  on: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  off: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
function fsSupported() { return !!(document.fullscreenEnabled && document.documentElement.requestFullscreen); }
function isFullscreen() { return !!document.fullscreenElement; }
function fsPref() { try { return localStorage.getItem(FS_KEY); } catch (e) { return null; } }
function setFsPref(on) { try { localStorage.setItem(FS_KEY, on ? '1' : '0'); } catch (e) { /* storage unavailable */ } }

function setFullscreen(on) {
  if (!fsSupported()) return;
  setFsPref(on);
  if (on && !isFullscreen()) {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => {
      // Keep Esc for the game (close a panel, leave a mode): Chrome then asks you to hold Esc to leave.
      if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {});
    }).catch(() => {});
  } else if (!on && isFullscreen()) document.exitFullscreen().catch(() => {});
}
function toggleFullscreen() { setFullscreen(!isFullscreen()); }

function initFullscreen() {
  const ok = fsSupported(), computer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  $('btn-full').hidden = !(ok && computer);
  $('p-full').hidden = !ok;
  if (!ok) return;
  const sync = () => {
    const on = isFullscreen();
    $('btn-full').innerHTML = on ? FS_ICON.off : FS_ICON.on;
    $('btn-full').setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
    $('btn-full').title = (on ? 'Leave full screen' : 'Full screen') + ' (Alt+Enter)';
    $('p-full').textContent = `Full screen: ${on ? 'On' : 'Off'}`;
  };
  sync();
  $('btn-full').onclick = () => { toggleFullscreen(); sfx('click'); };
  $('p-full').onclick = () => { toggleFullscreen(); sfx('click'); };
  let go = null;
  document.addEventListener('fullscreenchange', () => {
    setFsPref(isFullscreen()); // held Esc (or the browser's own control) to leave: remember that
    if (go && isFullscreen()) { window.removeEventListener('click', go); window.removeEventListener('keyup', go); go = null; }
    if (!isFullscreen() && navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock();
    sync();
  });
  // The installed app on a computer: full screen from the first click (after it has done its job, so
  // the click isn't lost while the window grows), unless you left full screen last time.
  const app = matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches;
  if (app && computer && fsPref() !== '0') {
    go = () => { if (!isFullscreen()) setFullscreen(true); };
    window.addEventListener('click', go);
    window.addEventListener('keyup', go);
  }
}

/* ------------------------------------------------------------------ goods tooltip */

/** A small label under a goods counter: the good's name, how many you have and what it's for. */
function showGoodTip(g, el, ms) {
  let tip = $('good-tip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'good-tip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip); }
  clearTimeout(UI.tipTimer);
  tip.innerHTML = `<b>${GOOD[g].name}</b> <em>${esc(el.lastChild.textContent)}</em><span>${GOOD[g].desc}</span>`;
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
 * WASD or arrow keys pan · B build (then a building's key: a letter, or 1–7; or R for roads) · R or P opens and closes Paths (inside
 * it: R roads, G bridges and tunnels, V ramps, E pave, O one-way arrows, L junctions, T traffic map) · Q army · H base · F select every warbot · 1–9 control groups (Ctrl or
 * Shift + digit to save) · J jump to the latest alert · Esc back / clear selection / pause ·
 * Space pause · [ ] game speed · + and - zoom · M minimap · ? help
 */
const PAN_KEYS = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };

/**
 * Build-menu hotkeys. In the build menu a number picks a tab (BUILD_TAB_KEYS: 1 Gather, 2 Make, 3 Move,
 * 4 Defend, 5 All; Tab steps through them), then a building's letter on that tab starts placing it. Letters
 * are per tab, so there's room for every building without number or Fn keys. W, A, S and D always pan the
 * map, B closes the menu and R lays roads (the Move tab's Roads card), so no building uses those; the
 * Defend tab's Walls card is X, as in Paths. On the All tab each card shows its tab's number and letter.
 */
const BUILD_KEYS = {
  gather: { harvester: 'h', quarry: 'q', mine: 'm', tap: 'c', grower: 'g', farm: 'f', pump: 'p' },
  make: { kiln: 'k', smelter: 'm', fab: 'f', refinery: 'v', tarworks: 't', foundry: 'u', armory: 'i', munitions: 'n', reactor: 'y', lab: 'l', generator: 'g' },
  move: { charger: 'f', depot: 'e', roadworks: 'o', ropeway: 'y', viaduct: 'v', station: 'n', port: 'p', airfield: 'i', terminal: 'm' },
  defend: { outpost: 'o', turret: 't', bunker: 'u', keep: 'k', disruptor: 'z', mortar: 'm', flak: 'f', repair: 'e', silo: 'i', nukesilo: 'n' },
};
const BUILD_TAB_KEYS = { gather: '1', make: '2', move: '3', defend: '4', all: '5' };
/**
 * Keys for the buttons on a building's or robot's panel, by button id. While that panel is open they win over
 * the same letter's usual job (the key is shown on the button on a computer). Delete or Backspace demolishes,
 * pressed twice like the button.
 */
const SHEET_KEYS = {
  'sh-send': 'q', 'sh-bombard': 'q', 'sh-fire': 'f', 'sh-aim': 'f', 'sh-rgo': 'g', 'sh-crawl': 'g', 'sh-deploy': 'e',
  'sh-gate': 'g', 'sh-move': 'm', 'sh-pack': 'm', 'sh-pause': 'p', 'sh-fixbtn': 'e', 'sh-layroad': 'r', 'sh-pipe': 'k',
  'sh-recall': 'c', 'sh-unpost': 'c', 'rl-recall': 'c', 'sh-land': 'l', 'sh-st-send': 'v', 'nk-evac': 'v',
  'sh-bomb': 'z', 'sh-strike': 'q', 'sh-fsail': 'g', 'sh-fembark': 'e', 'sh-fland': 'l', 'sh-fhome': 'h', 'sh-found': 'p',
};
/** Mark the open panel's buttons with their keys (SHEET_KEYS), for the hints shown on a computer. */
function markSheetKeys() {
  for (const id in SHEET_KEYS) { const el = $(id); if (el && !el.dataset.key) el.dataset.key = SHEET_KEYS[id].toUpperCase(); }
  const d = $('sh-demolish'); if (d && !d.dataset.key) d.dataset.key = 'Del';
}
/** The open panel's button for key k, if it's showing and can be pressed. */
function sheetKeyButton(k) {
  if (!UI.sheetKind || UI.sheetKind === 'build') return null;
  if (k === 'delete' || k === 'backspace') { const d = $('sh-demolish'); return d && !d.disabled && d.offsetParent ? d : null; }
  for (const id in SHEET_KEYS) {
    if (SHEET_KEYS[id] !== k) continue;
    const el = $(id);
    if (el && !el.disabled && !el.hidden && el.offsetParent) return el;
  }
  return null;
}
/** A building's key and the build-menu tab it's on ({ tab, key }), or null. */
function buildKeyOf(t) {
  for (const g in BUILD_KEYS) if (BUILD_KEYS[g][t]) return { tab: g, key: BUILD_KEYS[g][t] };
  return null;
}

/**
 * Tapped a spot where a Ramp can't go: if it's beside a one-level cliff and the tile on the other
 * side can take one (your bots can reach it), that tile. Otherwise -1.
 */
function rampPartner(i, j) {
  if (!inMap(i, j)) return -1;
  const t = tIdx(i, j);
  if (S.terrain[t] !== T_GROUND) return -1;
  let best = -1;
  for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    if (S.terrain[u] !== T_GROUND || Math.abs(S.elev[u] - S.elev[t]) !== 1 || canStep(t, u)) continue;
    if (!canPlace(0, 'ramp', i + di, j + dj).ok) continue;
    if (best < 0 || UI.draft.ramps.has(u)) best = u;
  }
  return best;
}

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
    if (tag === 'TEXTAREA' || tag === 'SELECT') return;
    // A slider or switch keeps its own keys (arrows, Home, End); Esc and Space still reach the game from one.
    if (tag === 'INPUT' && !(/^(range|checkbox)$/.test(e.target.type) && (e.key === 'Escape' || e.key === ' '))) return;
    if (!UI.inGame) return;
    // Control groups: Ctrl (or Shift) + 1–9 saves the selected warbots, 1–9 selects them again
    // (press twice to jump to them).
    const digit = /^Digit([1-9])$/.exec(e.code || '');
    // In the build menu a plain number picks a tab instead (1 Gather, 2 Make, 3 Move, 4 Defend, 5 All).
    if (digit && UI.sheetKind === 'build' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      const g = Object.keys(BUILD_TAB_KEYS).find((t) => BUILD_TAB_KEYS[t] === digit[1]);
      const tab = g && $('build-tabs') && $('build-tabs').querySelector(`[data-g="${g}"]`);
      e.preventDefault();
      if (tab) tab.click();
      return;
    }
    // Tab (Shift+Tab back) steps through the build menu's tabs.
    if (e.key === 'Tab' && UI.sheetKind === 'build' && $('build-tabs') && !topScreen() && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const tabs = [...$('build-tabs').children], i = tabs.findIndex((b) => b.classList.contains('on'));
      tabs[(i + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length].click();
      return;
    }
    if (digit && !e.altKey && $('screen-pause').hidden) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.shiftKey) saveGroup(+digit[1]); else recallGroup(+digit[1]);
      return;
    }
    if (e.altKey && e.key === 'Enter' && fsSupported()) { e.preventDefault(); toggleFullscreen(); return; }
    // Ctrl+Z (Cmd+Z) in Paths is the banner's Undo: the last stroke of the plan, or the arrows a drag turned.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z' && R.mode === 'road' && !topScreen()) {
      e.preventDefault();
      if (!$('banner-undo').hidden) $('banner-undo').click();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); escapeKey(); return; }
    if (k === '`' && $('screen-over').hidden) { e.preventDefault(); if ($('screen-boost').hidden) openBoost(); else closeBoost(); return; }
    const overlay = !$('screen-pause').hidden || !$('screen-help').hidden || !$('screen-stats').hidden || !$('screen-over').hidden || !$('screen-boost').hidden;
    if (k === ' ' || k === 'spacebar') {
      e.preventDefault();
      if (!$('screen-pause').hidden) $('p-resume').click(); else if (!overlay) $('btn-pause').click();
      return;
    }
    if (overlay) return;
    // Enter confirms the banner's main button (Build here, Fire, Lay roads...).
    if (k === 'enter' && !$('banner').hidden && !$('banner-ok').hidden && !$('banner-ok').disabled) { e.preventDefault(); $('banner-ok').click(); return; }
    // A key on the open panel's buttons (SHEET_KEYS) presses that button.
    const sk = sheetKeyButton(k);
    if (sk) { e.preventDefault(); sk.click(); return; }
    // In the build menu, a building's letter on the tab that's showing picks it, R goes straight to
    // laying roads and X to Walls. W, A, S and D still pan the map (no building uses them).
    if (UI.sheetKind === 'build' && k === 'r') { e.preventDefault(); openPaths('road'); return; }
    if (UI.sheetKind === 'build' && k === 'x' && $('build-walls')) { e.preventDefault(); $('build-walls').click(); return; }
    // A letter that's no building's on this tab does what it does elsewhere (Q army, H base, M minimap...).
    if (UI.sheetKind === 'build' && /^[a-z]$/.test(k) && !PAN_KEYS[k] && k !== 'b') {
      const keys = BUILD_KEYS[UI.buildTab];
      const type = keys && Object.keys(keys).find((t) => keys[t] === k);
      const card = type && $('sheet-body').querySelector(`.bcard[data-t="${type}"]`);
      if (card && !card.hidden) { e.preventDefault(); if (card.disabled) sfx('error'); else card.click(); return; }
      if (!keys && Object.values(BUILD_KEYS).some((m) => Object.values(m).includes(k))) {
        e.preventDefault();
        toast(`On All, press the card's number first (its tab), then ${k.toUpperCase()}: 1 Gather, 2 Make, 3 Move, 4 Defend.`, 'info');
        return;
      }
    }
    // WASD and the arrow keys pan the map while held.
    if (PAN_KEYS[k]) { e.preventDefault(); R.keys.add(k); return; }
    switch (k) {
      case 'b': $('btn-build').click(); break;
      case 'p': $('btn-road').click(); break;
      // R opens and closes the Paths menu (like P); inside Paths it picks the Roads tool first.
      case 'r': if (R.mode === 'road' && UI.roadMode !== 'road') openPaths('road'); else $('btn-road').click(); break;
      case 'o': openPaths('arrows'); break;
      case 'g': openPaths('bridge'); break;
      case 'v': openPaths('ramp'); break;
      case 'e': openPaths('pave'); break;
      case 't': if (R.mode !== 'road') setMode('road'); R.traffic = !R.traffic; showRoadBanner(); sfx('click'); break;
      case 'l': openPaths('lights'); break;
      case 'x': if (warOn()) openPaths('wall'); break;
      case 'n': openPaths('rail'); break;
      case 'k': openPaths('pipe'); break;
      case 'q': if (!$('btn-attack').hidden) $('btn-attack').click(); break;
      case 'h': case 'home': $('btn-home').click(); break;
      case 'm': setMinimap(!MM.on); break;
      case 'c': if (warOn()) recallAllWarbots(); break;
      case 'f': selectBots(armyIds(0), false); if (UI.sel.length) toast(`${UI.sel.length} warbots selected: right-click to give orders.`, 'info'); break;
      case 'i': if ($('screen-stats').hidden) openStats(); break;
      case 'u': $('pop').click(); break;
      case 'y': if (UI.sheetKind === 'goods') closeSheet(); else { setMode('normal'); openGoodsSheet(UI.goodSel || 'cement'); } break;
      case 'j': if (UI.lastAlert) { centerOn(UI.lastAlert.x + 0.5, UI.lastAlert.y + 0.5); sfx('click'); } break;
      case '[': stepSpeed(-1); break;
      case ']': stepSpeed(1); break;
      case '+': case '=': zoomBy(1.25); break;
      case '-': case '_': zoomBy(0.8); break;
      case '?': showHelp(); break;
      default: return;
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => R.keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => R.keys.clear());
}

/* ------------------------------------------------------------------ selecting and ordering warbots */
/*
 * With a mouse: click or drag a box to select, right-click to order (onMapCommand). Under a finger: tap one of
 * your warbots or Rocket Trucks to select it (tap it again for all of its kind in view), and while the
 * selection bar is showing a tap on the map is the order a right-click would give, with a ring where it landed
 * and Undo on the bar for a few seconds. A drag is never an order: it moves the map as always. Army mode (send
 * a number of warbots from your garrisons to a target or a spot) is as it was, for either hand.
 */

const EDGE_SCROLL = 6; // pixels from the window edge where the map scrolls
const ORDER_UNDO = 4000; // ms an order given by a tap can be taken back for

/** Select these warbots (or add them to the selection). */
function selectBots(ids, add) {
  const mine = selectable(0, ids).map((u) => u.id);
  UI.sel = add ? [...new Set(UI.sel.concat(mine))] : mine;
  UI.undo = null; // (an order's Undo goes with the selection it was given to)
  refreshSelection();
}

/** The selection bar's parts, made once: what's selected and doing what, the mouse's hint, and a finger's buttons. */
function initSelBar() {
  $('selbar').innerHTML = `<div class="sel-top"><div class="sel-text"><b id="sel-title"></b> <span id="sel-notes"></span></div>
      <span class="sel-groups" id="sel-groups" aria-label="Groups: hold to keep the selection, tap to select it again"><button class="btn small" data-g="1">1</button><button class="btn small" data-g="2">2</button><button class="btn small" data-g="3">3</button></span>
      <button class="btn small ghost" id="selbar-clear" aria-label="Clear selection">✕</button></div>
    <span class="hint" id="sel-status"></span>
    <span class="hint sel-mouse">Right-click open ground to hold it, a rival building to attack, or your Outpost to station them. Esc clears.</span>
    <div class="sel-tools"><button class="btn small primary" id="sel-undo" hidden>Undo</button><button class="btn small" id="sel-view">All in view</button><button class="btn small" id="sel-army">Whole army</button><button class="btn small" id="sel-box">Box</button><button class="btn small" id="sel-info">Info</button></div>`;
  $('selbar-clear').onclick = () => { sfx('click'); selectBots([], false); };
  $('sel-undo').onclick = () => undoOrder();
  $('sel-view').onclick = () => { sfx('click'); selectBots(unitsInView(), false); if (!UI.sel.length) toast('None of your warbots are in view.', 'info'); };
  $('sel-army').onclick = () => { sfx('click'); selectBots(armyIds(0).concat(S.bots.filter((u) => !u.dead && u.owner === 0 && BOTS[u.type].siege).map((u) => u.id)), false); };
  $('sel-info').onclick = () => { sfx('click'); const us = selectable(0, UI.sel).filter((u) => !u.inside); if (us.length === 1) openBotSheet(us[0]); else openPopSheet(); };
  // Box: the next one-finger drag on the map draws a selection box (input.js), then it's off again. Tap Box again to call it off.
  $('sel-box').onclick = () => { sfx('click'); INPUT.boxArmed = !INPUT.boxArmed; refreshSelection(); };
  // The group chips 1, 2 and 3: hold one to keep the selection as that group, tap it to select the group again (twice to go to it).
  for (const chip of $('sel-groups').children) {
    const k = +chip.dataset.g;
    let hold = 0, kept = false;
    chip.addEventListener('pointerdown', () => { kept = false; hold = setTimeout(() => { kept = true; if (navigator.vibrate) navigator.vibrate(12); saveGroup(k); refreshSelection(); }, 500); });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) chip.addEventListener(t, () => clearTimeout(hold));
    chip.onclick = () => {
      if (kept) { kept = false; return; }
      // (With nothing selected the chips sit apart above the bottom bar, and move into the bar as it comes up: from
      // there one tap both selects the group and goes to it, and a second tap that lands where the chip was is no order.)
      const idle = !UI.sel.length;
      UI.chipAt = performance.now();
      if (selectable(0, UI.groups[k] || []).length) { recallGroup(k); if (idle) recallGroup(k); }
      else { sfx('error'); toast(UI.sel.length ? `Hold ${k} to keep these as group ${k}. Then a tap on ${k} selects them again, two taps go to them.` : `Group ${k} is empty.`, 'info'); }
    };
  }
}

/** Has the player warbots or Rocket Trucks out in the open? (Then a finger held on the map draws a selection box: see input.js.) */
function fieldUnits() {
  return UI.inGame && !UI.paused && S.bots.some((u) => !u.dead && u.owner === 0 && !u.inside && (u.type === 'warbot' || BOTS[u.type].siege));
}

/** Your warbots and Rocket Trucks out in the open on the screen now (optionally only warbots, or only trucks). */
function unitsInView(siege) {
  const ids = [];
  for (const u of S.bots) {
    if (u.dead || u.inside || u.owner !== 0 || (u.type !== 'warbot' && !BOTS[u.type].siege) || (siege !== undefined && !!BOTS[u.type].siege !== siege)) continue;
    const p = worldToScreen(u.x, u.y);
    if (p.x >= 0 && p.x <= R.w && p.y >= 0 && p.y <= R.h) ids.push(u.id);
  }
  return ids;
}

/** What the selected units are doing, in a line: one unit's activity, or the two commonest among several with their counts. */
function selStatus(units) {
  const n = {};
  for (const u of units) { const a = botActivity(u).replace(/ \((stationed at|belongs to)[^)]*\)$/, ''); n[a] = (n[a] || 0) + 1; }
  const top = Object.keys(n).sort((a, b) => n[b] - n[a]);
  return units.length === 1 ? top[0] : top.slice(0, 2).map((a) => `${n[a]} × ${a}`).join(' · ') + (top.length > 2 ? ' · …' : '');
}

/** Drop dead or captured warbots from the selection and update the selection bar. */
function refreshSelection() {
  if (UI.sel.length) UI.sel = selectable(0, UI.sel).map((u) => u.id);
  UI.selSet = new Set(UI.sel);
  const bar = $('selbar'), touch = onTouch(), on = UI.sel.length > 0 && UI.inGame;
  // Under a finger, with groups kept but nothing selected, the bar is just their chips (above the bottom bar).
  const sizes = [1, 2, 3].map((k) => selectable(0, UI.groups[k] || []).length), idle = !on && touch && UI.inGame && sizes.some((n) => n > 0);
  bar.hidden = !on && !idle;
  document.body.classList.toggle('sel-on', on && touch); // (on an upright phone the bar takes the bottom bar's place)
  bar.classList.toggle('touch', touch);
  bar.classList.toggle('idle', idle);
  if (!on) INPUT.boxArmed = false;
  $('sel-box').classList.toggle('on', INPUT.boxArmed);
  [...$('sel-groups').children].forEach((chip, k) => { const t = sizes[k] ? `${k + 1} · ${sizes[k]}` : `${k + 1}`; if (chip.textContent !== t) chip.textContent = t; chip.classList.toggle('some', sizes[k] > 0); });
  if (!on) { UI.undo = null; return; }
  let inside = 0, empty = 0;
  for (const u of orderable(0, UI.sel)) { if (u.inside) inside++; if ((u.ammo ?? WARBOT_AMMO) <= 0) empty++; }
  const nw = orderable(0, UI.sel).length, nr = UI.sel.length - nw;
  const undo = UI.undo && performance.now() < UI.undo.until ? UI.undo : (UI.undo = null);
  const set = (id, html) => { const el = $(id); if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; } };
  set('sel-title', `${[nw ? `${nw} warbot${nw > 1 ? 's' : ''}` : '', nr ? `${nr} Rocket Truck${nr > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ')} selected`);
  set('sel-notes', (inside ? `<span class="muted">(${inside} in garrisons)</span> ` : '') + (empty ? `<span class="err">${empty} out of Ammo</span>` : ''));
  set('sel-status', INPUT.boxArmed ? '<b>Box:</b> drag a finger round warbots (two fingers move the map)'
    : undo ? `<span class="ok">${esc(undo.text)}</span> Undo takes it back.` : (touch ? '<b>Tap the map</b> to send them · ' : '') + esc(selStatus(selectable(0, UI.sel))));
  $('sel-undo').hidden = !undo;
}

/** Your warbot or Rocket Truck out in the open nearest a tap, within a fingertip of it however far the map is zoomed out; or null. */
function unitAtTap(wx, wy) {
  const r = Math.max(0.55, 22 / R.cam.z);
  let best = null, bd = r * r;
  for (const u of S.bots) {
    if (u.dead || u.inside || u.owner !== 0 || (u.type !== 'warbot' && !BOTS[u.type].siege)) continue;
    const d = dist2(u.x, u.y, wx, wy);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

/** A finger's tap on your warbot or Rocket Truck selects it; a second tap on it within half a second takes all of its kind in view. */
function touchSelect(u) {
  const now = performance.now(), L = UI.lastSel;
  UI.lastSel = { id: u.id, at: now };
  sfx('click');
  selectBots(L && L.id === u.id && now - L.at < 500 ? unitsInView(!!BOTS[u.type].siege) : [u.id], false);
}

/** Is the selection bar on the screen (not hidden behind a panel or a mode's banner on a phone)? Only then are a finger's taps orders. */
function selBarShowing() { return UI.sel.length > 0 && !$('selbar').hidden && $('selbar').getClientRects().length > 0; }

/** What a unit is doing, in the terms of the order that would send it back to it (see undoOrder). */
function orderSnapshot(u) {
  const t = u.task, r = t && t.type === 'hold' ? rallyById(t.rally) : null;
  const was = u.inside ? ['in', u.inside] : !t ? ['free'] : t.type === 'garrison' ? ['in', t.bld] : t.type === 'attack' ? ['attack', t.target]
    : r ? ['hold', Math.floor(r.x), Math.floor(r.y)] : t.type === 'bombard' ? ['bombard', t.target] : t.type === 'park' ? ['park', t.i, t.j] : ['free'];
  return { id: u.id, post: u.post && typeof u.post === 'object' ? { ...u.post } : u.post, was, auto: !!(t && t.auto) };
}

/**
 * A finger's tap on the map with warbots selected: their order, the one a right-click gives (onMapCommand). What
 * each was doing is noted first, so Undo on the selection bar can send them back to it for ORDER_UNDO ms.
 */
function touchOrder(i, j, wx, wy) {
  const was = selectable(0, UI.sel).map(orderSnapshot);
  if (!onMapCommand(i, j, wx, wy)) return;
  UI.undo = { was, until: performance.now() + ORDER_UNDO, text: 'Order given.' };
  refreshSelection();
}

/** Undo on the selection bar: each unit of the last order goes back to what it was doing (its garrison, its flag, its target, its spot). */
function undoOrder() {
  const U = UI.undo;
  UI.undo = null;
  if (!U) return;
  let n = 0;
  for (const s of U.was) {
    const u = getE(s.id);
    if (!u || u.dead || u.owner !== 0) continue;
    const [k, a, b] = s.was, ids = [u.id];
    if (k === 'in') orderStation(0, ids, getE(a));
    else if (k === 'attack') orderAttack(0, ids, getE(a));
    else if (k === 'hold') orderMove(0, ids, a, b);
    else if (k === 'bombard') { orderBombard(0, ids, getE(a)); if (s.auto && u.task) u.task.auto = true; } // (a target it had picked for itself stays its own choice)
    else if (k === 'park') orderPark(0, ids, a, b);
    else if (BOTS[u.type].siege) { u.task = null; u.salvo = null; u.deployT = 0; u.path = null; }
    else if (!u.inside) { cancelTask(u); u.task = null; u.path = null; u.fight = 0; } // it was standing free: free again (it finds itself a garrison)
    u.post = s.post;
    n++;
  }
  sfx('click');
  toast(`Order taken back: ${n === 1 ? 'it goes' : `${n} go`} back to what ${n === 1 ? 'it was' : 'they were'} doing.`, 'info');
  refreshSelection();
}

/**
 * A drag box (screen pixels) selects your warbots inside it; with Shift it adds to the selection. `armed`: it
 * was drawn after Box on the selection bar. A finger's box drawn by holding and dragging that catches nothing
 * changes nothing (it was most likely meant to move the map).
 */
function onSelectBox(box, add, armed) {
  const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1), y0 = Math.min(box.y0, box.y1), y1 = Math.max(box.y0, box.y1);
  const ids = [];
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0 || (u.type !== 'warbot' && !BOTS[u.type].siege) || u.inside) continue;
    const p = worldToScreen(u.x, u.y);
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(u.id);
  }
  // A box round your own garrisons picks up their spare warbots too (each keeps its Keep at home).
  for (const b of S.buildings) {
    if (b.dead || b.owner !== 0 || !b.garrison || b.garrison.length < 2) continue;
    const p = worldToScreen(b.x + 0.5, b.y + 0.5);
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(...b.garrison.slice(1));
  }
  INPUT.boxArmed = false; // (Box on the selection bar is for one drag)
  if (!ids.length && !armed && onTouch()) { refreshSelection(); return; }
  selectBots(ids, add);
  if (ids.length) sfx('click'); else if (onTouch()) toast('No warbots of yours in that box.', 'info');
}

/** Right-click (or, under a finger, a tap with the selection bar showing): order the selected warbots to whatever is there. True if an order was given. */
function onMapCommand(i, j, wx, wy) {
  if (!UI.inGame || UI.paused || !UI.sel.length || R.mode !== 'normal') return;
  const b = buildingAtTap(i, j, wx, wy);
  let n = 0, what = '';
  // Your Ferry, off a shore: the selected warbots walk to the shore beside it and board.
  const ferry = S.bots.find((v) => !v.dead && v.owner === 0 && BOTS[v.type].ferry && !v.inside && dist2(v.x, v.y, wx, wy) < 0.9);
  if (ferry) {
    const r = orderBoardFerry(0, UI.sel, ferry);
    if (typeof r === 'string') { sfx('error'); toast(r, 'warn'); return; }
    sfx('order'); addFx('ring', ferry.x, ferry.y, { color: '#7dffa0' });
    toast(`${r} warbot${r === 1 ? '' : 's'} heading for the Ferry: they board once they're beside it.`, 'info');
    return true;
  }
  // Rocket Trucks in the selection: they bombard an enemy building, or drive to open ground (or beside a garrison) and wait there.
  let nr = 0;
  if (b && b.owner !== 0) nr = orderBombard(0, UI.sel, b);
  else if (b && BDEFS[b.type].mil && b.built) { const s = deploySpot(0, b.x, b.y); if (s >= 0) nr = orderPark(0, UI.sel, s % S.W, (s / S.W) | 0); }
  else if (inMap(i, j) && walkable(tIdx(i, j)) && !b) nr = orderPark(0, UI.sel, i, j);
  if (b && b.owner !== 0) { n = orderAttack(0, UI.sel, b); what = `attacking the ${BDEFS[b.type].name}`; }
  else if (b && BDEFS[b.type].mil && b.built) { n = orderStation(0, UI.sel, b); what = `heading to the ${BDEFS[b.type].name}`; }
  else if (inMap(i, j) && walkable(tIdx(i, j)) && !b) { n = orderMove(0, UI.sel, i, j); what = 'moving to hold that ground'; }
  else { sfx('error'); toast(`${onTouch() ? 'Tap' : 'Right-click'} open ground, a rival building or one of your garrisons.`, 'warn'); return; }
  if (nr && !n) {
    sfx('order');
    addFx('ring', (b ? b.x : i) + 0.5, (b ? b.y : j) + 0.5, { color: b && b.owner !== 0 ? '#ff5a6e' : '#7dffa0' });
    toast(`${nr} Rocket Truck${nr > 1 ? 's' : ''} ${b && b.owner !== 0 ? `bombarding the ${BDEFS[b.type].name}` : 'on the move'}.`, 'info');
    refreshSelection();
    return true;
  }
  if (!n) {
    sfx('error');
    toast(b && b.owner === 0 ? 'That garrison is full.' : 'None of the selected warbots have Ammo: they reload in a garrison first.', 'warn');
    return;
  }
  sfx('order');
  addFx('ring', (b ? b.x : i) + 0.5, (b ? b.y : j) + 0.5, { color: b && b.owner !== 0 ? '#ff5a6e' : '#7dffa0' });
  toast(`${n} warbot${n > 1 ? 's' : ''} ${what}.`, 'info');
  refreshSelection();
  return true;
}

/** Control groups: Ctrl/Shift + digit saves the selection; the digit selects it again, twice to jump there. */
function saveGroup(k) {
  if (!UI.sel.length) { toast(onTouch() ? `Select warbots first, then hold ${k} to keep them as group ${k}.` : `Select warbots first (drag a box round them), then Ctrl+${k} saves them as group ${k}.`, 'info'); return; }
  UI.groups[k] = UI.sel.slice();
  sfx('click');
  toast(`Group ${k}: ${UI.sel.length} warbot${UI.sel.length > 1 ? 's' : ''}. ${onTouch() ? `Tap ${k} on the bar` : `Press ${k}`} to select them again${onTouch() ? ' (twice to go to them)' : ''}.`, 'info');
}

function recallGroup(k) {
  const ids = selectable(0, UI.groups[k] || []).map((u) => u.id);
  if (!ids.length) return;
  const twice = UI.lastGroup.k === k && performance.now() - UI.lastGroup.at < 450;
  UI.lastGroup = { k, at: performance.now() };
  selectBots(ids, false);
  sfx('click');
  if (twice) {
    let x = 0, y = 0;
    for (const u of selectable(0, ids)) { x += u.x; y += u.y; } // (Rocket Trucks too: they're in the group)
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
    html = `<b>${b.owner === 0 ? '' : playerName(b.owner) + ' '}${def.name}</b>` + (b.owner === 0 && b.status ? `<em>${esc(b.status)}</em>` : '') +
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
      html = `<b>${bot.owner === 0 ? '' : playerName(bot.owner) + ' '}${BOTS[bot.type].name}</b>` + (bot.owner === 0 ? `<em>${esc(botActivity(bot))}</em>` : '') +
        `<em>Health ${Math.ceil(bot.hp)}/${esc(bot.maxHp)}${bot.owner === 0 ? ` · battery ${Math.round(bot.bat ?? 100)}%` : ''}</em>`;
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
  if (!$('screen-boost').hidden) { closeBoost(); return; }
  if (!$('screen-pause').hidden) { $('p-resume').click(); return; }
  if (!$('screen-over').hidden) return;
  if (UI.sheetKind) { closeSheet(); return; }
  // In Paths with a plan sketched, Esc takes back the last stroke (again for the one before); with none left it leaves Paths.
  if (R.mode === 'road' && !draftEmpty()) { draftUndo(); showRoadBanner(draftEmpty() ? 'Plan cleared.' : 'Last stroke taken back (Esc again for the one before; Clear drops the whole plan).', true); return; }
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
  // A panel bringing its subject into view (sheetMoved): the map glides there, unless a hand takes it over.
  const g = UI.glide;
  if (g) {
    const k = Math.min(1, dt * 12);
    R.cam.x += (g.x - R.cam.x) * k; R.cam.y += (g.y - R.cam.y) * k;
    clampCam();
    g.t -= dt;
    if (INPUT.gesture || R.keys.size || UI.mmDrag || g.t <= 0 || Math.hypot(g.x - R.cam.x, g.y - R.cam.y) * R.cam.z < 0.5) UI.glide = null;
  }
  paintScroll(dt);
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

/* ------------------------------------------------------------------ saved planets */

/*
 * Planets you liked, kept on this device (localStorage): a seed with the map settings that shape it
 * (map shape, size, terrain, resources, biome, players), newest first. Tap one in the new-game menu's
 * More settings to set the menu to it; × forgets it.
 */
const PLANETS_KEY = 'terrafall.planets', PLANETS_MAX = 40;
/** A saved planet this version can show and start: a number for a seed, and no setting the menu doesn't offer. */
function planetOk(p) {
  return !!p && typeof p === 'object' && Number.isFinite(p.seed) && (p.players == null || p.players === 2 || p.players === 3) &&
    [[p.shape, SHAPE_PRESETS], [p.size, SIZE_PRESETS], [p.rough, TERRAIN_PRESETS], [p.rich, RESOURCE_PRESETS], [p.biome, BIOME_ORDER]].every(([v, list]) => v == null || presetIndex(v, list, -1) >= 0);
}
function savedPlanets() {
  try { const l = JSON.parse(localStorage.getItem(PLANETS_KEY) || '[]'); return Array.isArray(l) ? l.filter(planetOk) : []; } catch (e) { return []; }
}
function writePlanets(list) { try { localStorage.setItem(PLANETS_KEY, JSON.stringify(list.slice(0, PLANETS_MAX))); } catch (e) { /* storage unavailable */ } }
const planetKey = (p) => [p.seed, p.shape, p.size, p.rough, p.rich, p.biome, p.players].join(':');
function savePlanet(p) { if (planetOk(p)) writePlanets([{ ...p, at: Date.now() }].concat(savedPlanets().filter((q) => planetKey(q) !== planetKey(p)))); }
/** The planet the new-game menu is set to. */
function menuPlanet() {
  return { seed: UI.menu.seed, shape: UI.menu.shape || 0, size: UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], rough: UI.menu.rough, rich: UI.menu.rich,
    biome: UI.menu.biome || 0, players: UI.menu.players === 3 ? 3 : 2 };
}
/** The planet being played. */
function gamePlanet() {
  const st = S.settings || {}; // (a very old save has none: the defaults stand in)
  return { seed: S.seed, shape: st.shape || 0, size: presetIndex(st.size, SIZE_PRESETS, DEFAULT_SIZE[S.mode === 'colony' ? 'colony' : 'versus']),
    rough: presetIndex(st.rough, TERRAIN_PRESETS, DEFAULT_ROUGH), rich: presetIndex(st.rich, RESOURCE_PRESETS, DEFAULT_RICH),
    biome: Math.max(0, BIOME_ORDER.indexOf(st.biome)), players: st.players === 3 ? 3 : 2 };
}
function planetLabel(p) {
  const bits = [SHAPE_PRESETS[p.shape] ? SHAPE_PRESETS[p.shape].name : 'Standard', SIZE_PRESETS[p.size] ? SIZE_PRESETS[p.size].name : '', BIOMES[BIOME_ORDER[p.biome || 0]].name];
  if (p.rough !== DEFAULT_ROUGH && TERRAIN_PRESETS[p.rough]) bits.push(TERRAIN_PRESETS[p.rough].name + ' terrain');
  if (p.rich !== DEFAULT_RICH && RESOURCE_PRESETS[p.rich]) bits.push(RESOURCE_PRESETS[p.rich].name + ' resources');
  if (p.players === 3) bits.push('3 players');
  return `<b>Planet #${esc(p.seed)}</b> · ${bits.filter(Boolean).join(' · ')}`;
}
function renderPlanets() {
  const el = $('m-planets');
  if (!el) return;
  const list = savedPlanets(), cur = planetKey(menuPlanet());
  el.hidden = !list.length;
  el.innerHTML = list.length ? '<span class="planets-title">Saved planets</span>' + list.map((p, k) =>
    `<div class="planet-row"><button class="btn small ghost use${planetKey(p) === cur ? ' on' : ''}" data-use="${k}">${planetLabel(p)}</button><button class="btn small ghost del" data-del="${k}" aria-label="Forget Planet #${esc(p.seed)}" title="Forget this planet">×</button></div>`).join('') : '';
  for (const b of el.querySelectorAll('[data-use]')) b.onclick = () => {
    const p = savedPlanets()[+b.dataset.use];
    if (!p) return;
    Object.assign(UI.menu, { seed: p.seed, shape: p.shape, rough: p.rough, rich: p.rich, biome: p.biome, players: p.players || 2 });
    UI.menu.size[UI.menu.mode] = p.size;
    cleanMenu(); // (a setting the planet was saved without takes its default)
    sfx('click'); syncMenu();
    toast(`Set to Planet #${p.seed}. Tap Start to play it.`, 'info');
  };
  for (const b of el.querySelectorAll('[data-del]')) b.onclick = () => {
    const list2 = savedPlanets(), p = list2[+b.dataset.del];
    list2.splice(+b.dataset.del, 1); writePlanets(list2);
    sfx('click'); renderPlanets();
    if (p) toast(`Forgot Planet #${p.seed}.`, 'info');
  };
}

/* ------------------------------------------------------------------ game flow */

function startNewGame() {
  clearSave();
  newGame({
    seed: UI.menu.seed, difficulty: UI.menu.diff, mode: UI.menu.mode,
    size: UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], rough: UI.menu.rough, rich: UI.menu.rich, shape: UI.menu.shape || 0,
    nuke: !!UI.menu.nuke, biome: BIOME_ORDER[UI.menu.biome || 0], players: UI.menu.players === 3 ? 3 : 2,
    style: UI.menu.style ? PERSONALITY_ORDER[UI.menu.style - 1] : 'random', events: !!UI.menu.events, wildlife: !!UI.menu.wild, unlimited: !!UI.menu.unlimited,
  });
  enterGame();
  updateHUD();
  placeMinimap();
  postMsg(0, UI.menu.mode === 'colony'
    ? 'Your bots have landed. Build, expand and make this planet home.'
    : S.players.length > 2 ? 'Your bots have landed. Two rival colonies landed too, one to the north-west (red) and one to the north-east (green). Build up fast!'
      : 'Your bots have landed. A rival colony landed to the north. Build up fast!', 0, 0, 'info');
  // Name each rival's personality, so you know what's coming.
  if (S.mode !== 'colony') for (const P of S.players) {
    const st = P.id !== 0 && P.ai && !P.absent && PERSONALITIES[P.style];
    if (st) postMsg(0, `${S.players.length > 2 ? 'The ' + playerName(P.id) : 'Your rival'} is ${st.noun}: it ${st.desc}.`, 0, 0, 'info');
  }
  if (S.wildlife) {
    // Pointed at the nest nearest home (J jumps there), the rest are red on the minimap.
    const L = getE(S.players[0].lander), nests = S.buildings.filter((b) => !b.dead && BDEFS[b.type].wild);
    const near = L && nests.length ? nests.reduce((a, b) => (dist2(b.x, b.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? b : a)) : null;
    postMsg(0, `${nests.length} creature nests sit out in the wilds (red on the minimap; the nearest is ${near ? dirText(L, near) : 'out there'}${near ? ': press J or tap here to look' : ''}). From about 7 minutes in they raid whatever you build near their nests. Pulse Turrets (with Crystal) and warbots keep them off; clear a nest with warbots to win the goods it hoards.`, near ? near.x : 0, near ? near.y : 0, 'warn');
  }
  if (S.posts && S.posts.length) {
    // Pointed at the post nearest home (J or a tap jumps there); the rest are gold on the minimap.
    const L = getE(S.players[0].lander), near = L ? S.posts.reduce((a, p) => (dist2(p.x, p.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? p : a)) : null;
    postMsg(0, `${S.posts.length} neutral Trade Posts (gold on the minimap${near ? ', nearest ' + dirText(L, near) : ''}): lay a road out and dock a Trade Terminal to trade.` + (S.mode !== 'colony' ? ' Hold the land round one to shut your rival out.' : ''), near ? near.x : 0, near ? near.y : 0, 'info');
  }
  if (nukeOn()) postMsg(0, `Nuclear race: a few uranium deposits glow green across the planet. Dig them with Ore Mines, enrich them at a Nuclear Reactor and build the bomb${S.mode === 'colony' ? ' (no rival here, so it is yours to try out)' : ` before ${S.players.length > 2 ? 'the rivals do' : 'the rival does'}`}.`, 0, 0, 'warn');
}

/* ------------------------------------------------------------------ save files: carry a game between devices */

/** This game as a save file's text: the save itself, with when it was made and what it is. */
function saveFileText() {
  return JSON.stringify({ terrafall: 1, savedAt: new Date().toISOString(), mode: S.mission ? 'mission' : S.mode, minutes: Math.floor(S.time / 60), game: serializeGame() });
}

/**
 * Offer this game as a file (terrafall-<mode>-<date>-<time>.json). In claude.ai the page asks the viewer to
 * confirm the download (the `downloads` capability); elsewhere it's an ordinary download.
 */
async function downloadSave() {
  if (!S) return;
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  const name = `terrafall-${S.mission ? 'mission' : S.mode}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  const text = saveFileText();
  if (!UI.saveHold) saveGame(); // the save on this device is up to date too
  const say = (m) => { $('p-saved').textContent = m; };
  let dl = null;
  try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: name, data: text }); say(`Save file ${name} downloaded: load it from the main menu (Load a save file) on any device.`); }
    catch (e) {
      const c = e && e.code;
      if (c === 'declined') say('Download cancelled.');
      else if (c === 'rate_limited') say('A download is already waiting for your OK.');
      else if (!plainDownload(name, text)) say('Downloads aren\'t possible here.');
    }
    return;
  }
  say(plainDownload(name, text) ? `Save file ${name} downloaded: load it from the main menu (Load a save file) on any device.` : 'Downloads aren\'t possible here.');
}

/** An ordinary browser download of `text` as `name`; false if this page can't. */
function plainDownload(name, text) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch (e) { return false; }
}

/** The save a loaded file replaced on this device: kept (the latest one only) in case the file was the wrong one. */
const SAVE_BACKUP_KEY = 'botfall.save.bak';

/** A line under the menu's Continue and Load buttons: why a save didn't load. */
function menuMsg(m) { $('m-import-msg').textContent = m; $('m-import-msg').hidden = false; }

/**
 * Start playing the game just loaded into S (a save file, or this device's save), without saving it yet.
 * If it can't be started, the menu comes back (`prev`, the demo that was running, until a new one is up) and it's false.
 */
function enterLoaded(prev) {
  try { enterGame(true); updateHUD(); return true; } catch (e) {
    console.error('Terrafall: a save loaded but could not be started.', e);
    S = prev;
    toMenu();
    return false;
  }
}

/**
 * Load a save file picked on the main menu: the game starts, and once it is running it becomes this
 * device's save too (the save it replaces is kept as a backup). A file that can't be read or started
 * changes nothing.
 */
function importSaveFile(file) {
  const r = new FileReader();
  r.onerror = () => menuMsg('That file couldn\'t be read.');
  r.onload = () => {
    let json = String(r.result || '');
    const prev = S, no = () => menuMsg('That isn\'t a Terrafall save file (or it\'s from a version this one can\'t read).');
    try {
      const o = JSON.parse(json);
      if (o && o.terrafall && typeof o.game === 'string') json = o.game; // a save file; a bare save works too
      deserializeGame(json);
    } catch (e) { S = prev; no(); return; }
    if (!enterLoaded(prev)) { no(); return; }
    try { const old = localStorage.getItem(SAVE_KEY); if (old) localStorage.setItem(SAVE_BACKUP_KEY, old); } catch (e) { /* storage unavailable or full: it still plays */ }
    saveGame();
    postMsg(0, 'Save file loaded. Welcome back.', 0, 0, 'info');
  };
  r.readAsText(file);
}

function continueGame() {
  const prev = S;
  if (!loadGame() || !enterLoaded(prev)) {
    syncMenu();
    menuMsg('Your saved game couldn\'t be loaded: it may be damaged, or from a newer version of the game. It stays on this device until you start a new game.');
    return;
  }
  saveGame();
  postMsg(0, 'Welcome back.', 0, 0, 'info');
}

/** Into the game in S: the HUD comes up and (unless `unsaved`: a save still being tried out) it's saved. */
function enterGame(unsaved) {
  bakeMap();
  UI.inGame = true; UI.paused = false; UI.overShown = false;
  UI.sel = []; UI.groups = {}; UI.lastAlert = null;
  UI.msgLog = []; $('btn-msgs').hidden = true;
  UI.objCollapsed = false; UI.objAuto = false; UI.objManual = false; UI.objStep = undefined;
  UI.saveHold = false;
  setSpeed(1, true);
  $('screen-menu').hidden = true;
  $('m-import-msg').hidden = true;
  $('hud').hidden = false;
  $('toasts').innerHTML = '';
  const colony = S.mode === 'colony';
  $('btn-attack').hidden = !warOn();
  for (const g of WAR_GOODS) UI.goodEls[g].hidden = !warOn();
  for (const g of NUKE_GOODS) UI.goodEls[g].hidden = !nukeOn();
  // More than seven goods don't fit one row on a phone: split them over two (widescreen: one row).
  const nGoods = GOODS.length - (warOn() ? 0 : WAR_GOODS.length) - (nukeOn() ? 0 : NUKE_GOODS.length);
  $('goods').style.setProperty('--goods-cols', nGoods > 7 ? Math.ceil(nGoods / 2) : nGoods);
  $('goods').style.setProperty('--goods-n', nGoods); // (a phone on its side has them in one row)
  $('goods').classList.toggle('two-rows', nGoods > 7);
  $('bottombar').classList.toggle('three', !warOn());
  closeSheet();
  setMode('normal');
  const L = getE(S.players[0].lander);
  R.cam.z = clamp(Math.min(R.w, R.h, 520) / 11, 26, 48); // (by the short side: a phone on its side started as close in as a tablet, five tiles of map high)
  if (L) centerOn(L.x + 0.5, L.y - 1);
  layoutMinimap();
  placeMinimap();
  armBack();
  if (!unsaved) saveGame();
}

function toMenu() {
  hideGoodTip();
  UI.inGame = false;
  UI.paused = false;
  disarmBack();
  syncWakeLock();
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
  helpForTouch();
  $('screen-help').hidden = false;
}

/**
 * How to play under a finger: the touch controls come first, on one screen, and the chapters after them are
 * folded under their headings (the whole text is some sixty phone screens long otherwise); style.css leaves out
 * the key names. Done once, the first time Help is opened on a touch screen. The illustrated manual then opens in
 * this tab (an installed app has no tabs to come back from; its own Back to the game link, or Back, returns).
 */
function helpForTouch() {
  if (UI.helpTouch || !onTouch()) return;
  UI.helpTouch = true;
  const body = document.querySelector('#screen-help .help-body');
  let sec = null;
  for (const el of [...body.children]) {
    if (el.id === 'h-touch') { el.hidden = false; continue; }
    if (el.tagName === 'H3' || !sec) {
      sec = document.createElement('details');
      sec.className = 'help-sec';
      const sum = document.createElement('summary');
      sum.textContent = el.tagName === 'H3' ? el.textContent : 'The game';
      sec.appendChild(sum);
      body.insertBefore(sec, el);
      if (el.tagName === 'H3') { el.remove(); continue; }
    }
    sec.appendChild(el);
  }
  if ($('h-manual')) $('h-manual').target = '_self';
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
    ? (S.players.length > 2 ? 'Both rival Command Bases are yours: the last colony standing. The planet is yours.' : 'Your warbots captured the rival Command Base. The planet is yours.')
    : `The ${S.players.length > 2 ? playerName(S.winner) : 'rival'} ${S.players[0].out ? 'captured your Command Base' : 'took the planet'}. Regroup and try again.`;
  const st = S.players[0].stats;
  $('o-stats').innerHTML = [
    ['Time', fmtTime(S.time)], ['Buildings completed', st.built], ['Bots built', st.bots - (st.startBots || 0)],
    ['Enemy buildings captured', st.captured], ['Bots lost', st.lost],
  ].map(([k, v]) => `<span>${k}</span><span>${esc(v)}</span>`).join('');
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
    body.innerHTML = `<p class="desc">Eight missions with their own goals, each with three difficulty levels. Play them in any order.</p>
      <div class="ms-list">${MISSIONS.map((m, k) => {
        const done = c.done[m.id] || [];
        const marks = MISSION_DIFF_NAMES.map((n, d) => (done[d] ? `<span class="ms-done">${n} ✓</span>` : '')).filter(Boolean).join(' ');
        return `<button class="ms-item" data-k="${k}"><span class="ms-num">${k + 1}</span>
          <span class="ms-name">${m.name}</span><span class="ms-meta">${marks || (m.mode === 'colony' ? 'Colony' : 'Versus')}</span></button>`;
      }).join('')}</div>${msg ? `<p class="hint">${msg}</p>` : ''}`;
    for (const el of body.querySelectorAll('.ms-item')) el.onclick = () => { sfx('click'); UI.msSel = +el.dataset.k; UI.msDiff = UI.msDiff ?? 1; renderMissions(); };
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
    case 'lights': return n > 1 ? `Put up ${n} traffic lights` : 'Put up a traffic light';
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
    `<li class="${s.done ? 'done' : ''}">${s.done ? '✓' : '○'} ${s.text}${s.need > 1 && !s.done ? ` (${esc(s.have)}/${s.need})` : ''}</li>`).join('')}</ul>`;
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
  $('o-stats').innerHTML = def.goals.map((g) => { const s = goalState(g, M.diff); return `<span>${s.done ? '✓' : '✗'} ${s.text}</span><span>${s.need > 1 ? `${esc(s.have)}/${s.need}` : s.done ? 'Done' : '–'}</span>`; }).join('');
  if (won) {
    completeMission(M.k, M.diff);
    if (M.k + 1 < MISSIONS.length) {
      $('o-code').hidden = false;
      $('o-code').innerHTML = `Next up: mission ${M.k + 2}, <b style="font-size:inherit;letter-spacing:0;color:var(--text)">${MISSIONS[M.k + 1].name}</b>.`;
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
  const H = S.hist || newHistory(S.players.length);
  const versus = S.mode !== 'colony';
  const P = S.players[0], st = P.stats;
  const made = Object.values(P.made || {}).reduce((a, v) => a + v, 0);
  const tiles = [['Time', fmtTime(S.time)], ['Buildings built', st.built], ['Bots built', st.bots - (st.startBots || 0)],
    ['Goods produced', made.toLocaleString()], versus ? ['Rival buildings taken', st.captured] : ['Land claimed', Math.round(landShare(0) * 100) + '%'],
    ['Bots lost', st.lost]];
  const players = versus ? S.players.map((P) => P.id) : [0];
  const ser = (fn) => players.map((p) => ({ name: playerName(p), color: CHART.series[p], values: fn(H.p[p] || {}) }));
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
    <div class="stat-tiles">${tiles.map(([k, v]) => `<div class="stat-tile"><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>
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
  for (const m of ['road', 'place', 'attack', 'aim', 'land', 'airdrop']) document.body.classList.toggle('mode-' + m, mode === m);
  document.body.classList.toggle('mode-on', mode !== 'normal'); // (any mode: on a phone its banner takes the bottom bar's place)
  if (mode !== 'aim') { R.aim = null; UI.aimSilo = 0; }
  if (mode !== 'aim' && mode !== 'land' && mode !== 'airdrop') R.aimHover = null;
  if (mode !== 'land') { R.landAt = null; UI.landFerry = 0; }
  if (mode !== 'airdrop') { R.dropAt = null; UI.dropPlane = 0; }
  R.ghost = null;
  R.overlay = null;
  R.ropeEnd = null;
  UI.ropeA = null;
  if (UI.pick) { UI.pick = 0; R.selected = 0; UI.selBot = 0; } // (a strike or bombardment target picked by a finger and not confirmed)
  UI.placeType = null;
  UI.moveFrom = 0;
  $('btn-road').classList.toggle('on', mode === 'road');
  $('btn-attack').classList.toggle('on', mode === 'attack');
  if (mode === 'normal') { $('banner').hidden = true; return; }
  closeSheet();
  if (mode === 'road') showRoadBanner();
  if (mode === 'attack') showArmyBanner();
}

/* ------------------------------------------------------------------ missile aiming */

/** Aim a Silo: zoom out to show its range on the ground, then tap a spot inside it. */
/* ------------------------------------------------------------------ Ports: ferry lines and beach landings */

/** "14 tiles north-east" from building a to building b. */
function dirText(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.round(Math.hypot(dx, dy));
  const ns = dy < -Math.abs(dx) * 0.4 ? 'north' : dy > Math.abs(dx) * 0.4 ? 'south' : '';
  const ew = dx > Math.abs(dy) * 0.4 ? 'east' : dx < -Math.abs(dy) * 0.4 ? 'west' : '';
  return `${d} tile${d === 1 ? '' : 's'} ${ns && ew ? ns + '-' + ew : ns || ew || 'away'}`;
}

/** A Ferry of yours tied up at Port b, free for a beach landing. */
function portFerry(b) { return S.bots.find((u) => !u.dead && u.owner === b.owner && BOTS[u.type].ferry && u.inside === b.id && !u.landing) || null; }

/** Which ships are tied up at Port b, and who serves its ferry line. */
function portShipsText(b) {
  const here = {};
  for (const u of S.bots) if (!u.dead && u.owner === b.owner && BOTS[u.type].sea && u.inside === b.id) here[u.type] = (here[u.type] || 0) + 1;
  const list = Object.keys(here).map((k) => `${here[k]} ${here[k] === 1 ? BOTS[k].name : BOTS[k].plural}`);
  return (list.length ? `Tied up here: ${list.join(', ')}.` : 'No ships tied up here.') +
    ' Container Ships and Tanker Ships fill this Port\'s supply orders from your other Ports on the same water, and a far Port sends its spare goods home by ship. Order ships at its shipyard (below).';
}

/** The Port panel's ship sections: ships here, its ferry line, and a beach landing. */
function portSection(b) {
  let html = '<div class="section-label">Ships</div><p class="hint" id="sh-port-ships"></p>';
  const other = b.ferryTo ? getE(b.ferryTo) : null;
  const ferries = S.bots.filter((u) => !u.dead && u.owner === b.owner && BOTS[u.type].ferry);
  html += '<div class="section-label">Ferry line</div><div id="sh-ferry">';
  if (other && !other.dead) {
    const mine = ferries.filter((u) => u.home === b.id || u.home === other.id);
    const served = mine.some((u) => !u.manual && !u.landing), away = !served && mine.length > 0; // (as ferryLines counts them)
    html += `<p class="hint">A ferry line runs to the Port ${dirText(b, other)}: your robots and trucks take the ferry whenever it's the shorter way.${served ? '' : away ? ' <b>Its Ferry is away under your orders</b>: nothing crosses until it is sent back to its line.' : ' <b>No Ferry serves it yet</b>: order one at a shipyard (a Port panel).'}</p><button class="btn" data-to="0">Stop the ferry line</button>`;
  } else {
    const ports = S.buildings.filter((o) => o !== b && !o.dead && o.built && o.owner === b.owner && BDEFS[o.type].port && seaLinked(b, o));
    html += ports.length ? `<p class="hint">Run a ferry between this Port and another: your robots and trucks take it whenever it's the shorter way (a Ferry from a Port's shipyard serves it).</p>${ports.map((o) => `<button class="btn" data-to="${esc(o.id)}">Ferry to the Port ${dirText(b, o)}</button>`).join('')}`
      : '<p class="hint">Build another Port on the same water to run a ferry line between them.</p>';
  }
  html += '</div>';
  const f = portFerry(b);
  html += '<div class="section-label">Beach landing</div>';
  html += f ? `<div class="stepper"><button class="btn" id="sh-land-minus" aria-label="Fewer warbots">−</button><span class="n" id="sh-land-n">3</span><button class="btn" id="sh-land-plus" aria-label="More warbots">+</button><button class="btn primary" id="sh-land" style="flex:1">Choose the beach</button></div>
    <p class="hint">The Ferry here takes up to ${FERRY_SEATS} armed warbots from your garrisons and lands them on any shore it can sail to, the rival's too. They hold the beach under a rally flag.</p>
    <button class="btn" id="sh-found">Found a Port on another shore</button><p class="hint">The Ferry loads ${costText(PORT_FOUND.cost)} here and up to ${PORT_FOUND.workers} idle Workers, and puts up a Port on an empty shore that claims the land ${PORT_FOUND.claim} tiles round it: a foothold on another island.</p>`
    : `<p class="hint">A Ferry tied up here can land up to ${FERRY_SEATS} warbots on any shore, the rival's too.</p>`;
  return html;
}

/** Beach landing: pick the shore tile on the map (a second tap there, or Land, sends them). */
function startLanding(f, n, kind) {
  setMode('land');
  UI.landFerry = f.id;
  UI.landN = n;
  UI.landKind = kind || 'warbots';
  R.landAt = null;
  showLandBanner();
}

function showLandBanner(problem) {
  const f = getE(UI.landFerry);
  if (!f || f.dead) { setMode('normal'); return; }
  if (UI.landKind === 'port') {
    showBanner((problem ? `<span class="err">${problem}</span> ` : '') + (R.landAt
      ? `Found a Port here? The Ferry loads ${costText(PORT_FOUND.cost)} at its Port (haulers bring it there) and up to ${PORT_FOUND.workers} idle Workers, sails, and puts it up: it claims the land ${PORT_FOUND.claim} tiles round it.`
      : 'Tap empty ground right at the water\'s edge, on a shore nobody else holds, for the new Port.'), R.landAt ? 'Found it' : null, 'Cancel');
    return;
  }
  const html = (problem ? `<span class="err">${problem}</span> ` : '') + (R.landAt
    ? `Land up to <b>${UI.landN}</b> warbot${UI.landN === 1 ? '' : 's'} here? The Ferry waits for them at its Port, then sails.`
    : `Tap a spot on the shore where the Ferry can land up to <b>${UI.landN}</b> warbot${UI.landN === 1 ? '' : 's'}: open ground right at the water's edge, the rival's shore too.`);
  showBanner(html, R.landAt ? 'Land' : null, 'Cancel');
}

function landTap(i, j) {
  const f = getE(UI.landFerry);
  if (!f) { setMode('normal'); return; }
  const why = UI.landKind === 'port' ? foundPortBlocked(0, f, i, j) : landingBlocked(0, f, i, j);
  if (why) { sfx('error'); R.landAt = null; showLandBanner(why); return; }
  if (R.landAt && R.landAt.i === i && R.landAt.j === j) { confirmLanding(); return; }
  R.landAt = { i, j };
  sfx('click');
  showLandBanner();
}

function confirmLanding() {
  const f = getE(UI.landFerry), at = R.landAt;
  if (!f || !at) return;
  const port = UI.landKind === 'port';
  const why = port ? orderFoundPort(0, f, at.i, at.j) : orderLanding(0, f, at.i, at.j, UI.landN);
  if (why) { sfx('error'); showLandBanner(why); return; }
  sfx('order');
  toast(port ? 'The Ferry is loading the Port kit and Workers: it sails once they\'re aboard.' : 'Beach landing ordered: the warbots head for the Ferry, and it sails once they\'re aboard.', 'good');
  setMode('normal');
}

/* ------------------------------------------------------------------ Airfields: Cargo Planes and air drops */

/** Your Cargo Planes based at Airfield b. */
function basePlanes(b) { return S.bots.filter((u) => !u.dead && u.owner === b.owner && BOTS[u.type].air && u.home === b.id); }

/** Your Strike Bombers, and the first that's parked, rearmed and free to fly a sortie (optionally: at `t`). */
function myBombers() { return S.bots.filter((u) => !u.dead && u.owner === 0 && BOTS[u.type].bomber); }
function readyBomber(t) { return myBombers().find((u) => !u.mission && !u.flight && !(u.rearmUntil > S.time) && planeBase(u) && u.inside === planeBase(u).id && (!t || !strikeBlocked(0, u, t))) || null; }

/** Pick a target for bomber u on the map. */
function startStrike(u) {
  closeSheet(); setMode('strike'); UI.bomber = u.id;
  showBanner(`Tap an enemy building, or an enemy vehicle or robot out in the open: the <b>Strike Bomber</b> loads ${BOMBER.ammo} Ammo, flies out and drops its bomb, then comes home to rearm. It reaches ${planeReach(u)} tiles from its Airfield.`, null, 'Cancel');
}

/** A Cargo Plane parked at Airfield b with nothing to do, or null. */
function freePlane(b) { return basePlanes(b).find((u) => !BOTS[u.type].bomber && u.inside === b.id && !u.mission && !u.flight) || null; }

/** What a plane is doing, in a few words. */
function planeStatus(u) {
  if (BOTS[u.type].bomber) {
    const M = u.mission, tg = M && getE(M.target), what = tg ? (BDEFS[tg.type] ? `the ${BDEFS[tg.type].name}` : `a ${BOTS[tg.type].name}`) : 'its target';
    if (u.flight) return M && M.phase === 'out' ? `flying out to bomb ${what}` : 'flying home';
    if (M && M.phase === 'load') return u.rearmUntil > S.time ? `rearming (${Math.ceil(u.rearmUntil - S.time)} s), then off to bomb ${what}` : M.noAmmo ? `waiting for ${BOMBER.ammo} Ammo at its Airfield` : M.noFuel ? 'waiting for Fuel' : `loading its bomb for ${what}`;
    return u.rearmUntil > S.time ? `rearming (${Math.ceil(u.rearmUntil - S.time)} s)` : 'ready on the ground';
  }
  const M = u.mission, load = (m) => (m.kind === 'outpost' ? 'a Drop Outpost' : m.kind === 'supply' ? 'supplies' : `${m.n} ${m.n === 1 ? BOTS[m.kind].name : BOTS[m.kind].plural}`);
  if (u.flight) return M && M.phase === 'out' ? `flying out with ${load(M)}` : 'flying home';
  if (M && M.phase === 'load') {
    if (M.noFuel) return 'waiting for Fuel to fly';
    if (M.kind === 'warbot' || M.kind === 'worker') return `boarding ${BOTS[M.kind].plural}: ${ferryAboard(u).length} of ${M.n} aboard`;
    return `loading ${load(M)}`;
  }
  return `parked, Fuel ${Math.round(u.bat ?? 100)}%`;
}

/** The Airfield panel's sections: its planes, air drops, and the places it supplies by air. */
function airfieldSection(b) {
  const planes = basePlanes(b), f = freePlane(b);
  let html = '<div class="section-label">Cargo Plane</div><p class="hint" id="sh-air-planes"></p>';
  if (warOn()) html += '<div class="section-label">Strike Bombers</div><div id="sh-air-bombers"></div>';
  html += '<div class="section-label">Air drop <span class="label-note">by parachute</span></div>';
  if (f) {
    html += `<div class="air-drops" id="sh-air">
      <button class="btn primary" data-k="outpost">Drop Outpost ${costInline(BDEFS.dropost.cost)}</button>
      ${warOn() ? '<button class="btn" data-k="warbot">Drop 2 Warbots</button>' : ''}<button class="btn" data-k="worker">Drop 2 Workers</button></div>
      <p class="hint">Then tap the spot. A Drop Outpost lands on any open ground nobody else holds (paid from storage now): it claims a little land, holds 2 warbots, stores goods, charges 2 bots and is supplied by air. Robots board here first (Warbots from your garrisons, idle Workers) and can be dropped anywhere, the enemy's land too. A full tank reaches ${planeReach(f)} tiles out and back.</p>`;
  } else html += `<p class="hint">${planes.some((u) => !BOTS[u.type].bomber) ? 'Its Cargo Plane is out on a flight.' : 'No Cargo Plane is based here yet: order one in the hangar below.'}</p>`;
  html += '<div class="section-label">Supplied by air</div><p class="hint" id="sh-air-places"></p>';
  return html;
}

function airPlacesText(b) {
  const list = S.buildings.filter((c) => !c.dead && c.built && c.owner === b.owner && c.airSupply && airSuppliable(c) && airBaseNear(c.owner, c.x, c.y) === b);
  const keep = airKeep(b), short = Object.keys(keep).filter((g) => keep[g] > 0).map((g) => `${keep[g]} ${GOOD[g].name}`);
  return (list.length ? `From here: ${list.map((c) => `the ${BDEFS[c.type].short || BDEFS[c.type].name} ${dirText(b, c)}`).join(', ')}. ` : 'Nothing yet: switch on Supply by air in a Depot\'s or Outpost\'s panel (a Drop Outpost has it on). ') +
    `A plane flies them what they're short of (their supply orders, Ammo for their warbots, a site's materials), ${BOTS.cargoplane.carry} goods a flight, taking them in turn (one that has run out of something first).` + (short.length ? ` This Airfield keeps ${short.join(', ')} for its planes and those places: haulers bring it.` : '');
}

/** The "Supply by air" switch for one of your Depots, Outposts and the like, once you have an Airfield. */
function airSupplySection(b) {
  if (!airSuppliable(b) || !b.built || b.owner !== 0 || !S.buildings.some((o) => !o.dead && o.built && o.owner === 0 && BDEFS[o.type].airfield)) return '';
  return '<div class="section-label">Supply by air</div><div class="seg" id="sh-airsup"><button data-v="1">On</button><button data-v="0">Off</button></div><p class="hint" id="sh-airsup-hint"></p>';
}

function airSupplyHint(b) {
  const base = airBaseNear(b.owner, b.x, b.y);
  if (!b.airSupply) return 'On: a Cargo Plane from your nearest Airfield keeps this place stocked by parachute (its supply orders, Ammo for its warbots), wherever it is. For a place no road reaches.';
  if (!base) return 'Waiting for a Cargo Plane: none is based at an Airfield yet (order one in an Airfield\'s hangar).';
  const coming = S.bots.some((u) => !u.dead && u.owner === b.owner && u.mission && u.mission.to === b.id);
  return `Supplied from the Airfield ${dirText(b, base)}, ${BOTS.cargoplane.carry} goods a flight.` + (coming ? ' A plane is on its way.' : '');
}

/** Air drop: pick the spot on the map (a second tap there, or Drop, sends the plane). */
function startAirdrop(u, kind) {
  setMode('airdrop');
  UI.dropPlane = u.id;
  UI.dropKind = kind;
  R.dropAt = null;
  showAirdropBanner();
}

function airdropWhat(kind) { return kind === 'outpost' ? 'a Drop Outpost' : `2 ${BOTS[kind].plural}`; }

function showAirdropBanner(problem) {
  const u = getE(UI.dropPlane);
  if (!u || u.dead) { setMode('normal'); return; }
  const html = (problem ? `<span class="err">${problem}</span> ` : '') + (R.dropAt
    ? `Drop ${airdropWhat(UI.dropKind)} here?` + (UI.dropKind === 'outpost' ? '' : ' They board the plane at the Airfield first.')
    : `Tap where to drop ${airdropWhat(UI.dropKind)}: ` + (UI.dropKind === 'outpost' ? 'open ground nobody else holds, as far as the plane can reach.' : 'open ground anywhere the plane can reach' + (UI.dropKind === 'warbot' ? ', the enemy\'s land too, or one of your garrisons.' : '.')));
  showBanner(html, R.dropAt ? 'Drop' : null, 'Cancel');
}

function airdropTap(i, j) {
  const u = getE(UI.dropPlane);
  if (!u) { setMode('normal'); return; }
  const why = airdropBlocked(0, u, UI.dropKind, i, j);
  if (why) { sfx('error'); R.dropAt = null; showAirdropBanner(why); return; }
  if (R.dropAt && R.dropAt.i === i && R.dropAt.j === j) { confirmAirdrop(); return; }
  R.dropAt = { i, j };
  sfx('click');
  showAirdropBanner();
}

function confirmAirdrop() {
  const u = getE(UI.dropPlane), at = R.dropAt;
  if (!u || !at) return;
  const why = orderAirdrop(0, u, UI.dropKind, at.i, at.j, BOTS[u.type].seats);
  if (why) { sfx('error'); showAirdropBanner(why); return; }
  sfx('order');
  toast(UI.dropKind === 'outpost' ? 'Drop Outpost loading: the plane takes off in a moment.' : `The ${BOTS[UI.dropKind].plural} head for the Airfield: the plane takes off once they're aboard.`, 'good');
  setMode('normal');
}

function startAim(silo) {
  setMode('aim');
  UI.aimSilo = silo.id;
  R.selected = silo.id;
  const range = BDEFS[silo.type].nukeSilo ? NUKE.range : BDEFS.silo.missile.range;
  showAimBanner();
  // Fit the whole range ring in the map area left between the top bar and the banner (or the tools, where they
  // lie across the bottom). Under a finger it never zooms out further than AIM_TILE px a tile: at the 9 px a
  // tile it took to fit the ring on a phone a fingertip covered twenty tiles. The ring then runs off the screen:
  // move the map to the target, tap to drop the crosshair, drag the crosshair to adjust, and Fire.
  const top = $('topbar').getBoundingClientRect().bottom + 8, bn = $('banner').getBoundingClientRect(), bb = $('bottombar').getBoundingClientRect();
  const bottom = Math.min(bn.height && bn.top > R.h / 2 ? bn.top : R.h, bb.height && bb.width > R.w / 2 ? bb.top : R.h) - 8;
  const avail = Math.max(120, Math.min(R.w - 16, bottom - top));
  R.cam.z = clamp(avail / (2 * range + 2), Math.max(minZoom(), onTouch() ? AIM_TILE : 0), maxZoom());
  centerOn(silo.x + 0.5, silo.y + 0.5 + (R.h / 2 - (top + bottom) / 2) / R.cam.z);
}
const AIM_TILE = 20;

/**
 * Under a finger a drag that starts on the aiming crosshair moves it, keeping the distance the finger had from
 * it (so it can be taken hold of from just below and stay in view); a drag anywhere else moves the map, as
 * always. Returns what to do with the finger's moves, or null when there is nothing to take hold of there.
 */
const AIM_GRAB = 56; // px round the crosshair that take hold of it
function mapGrab(x, y) {
  if (R.mode !== 'aim' || !R.aim) return null;
  const p = worldToScreen(R.aim.i + 0.5, R.aim.j + 0.5), dx = p.x - x, dy = p.y - y;
  if (Math.hypot(dx, dy) > AIM_GRAB) return null;
  return (mx, my) => {
    const w = screenToWorld(mx + dx, my + dy), i = Math.floor(w.x), j = Math.floor(w.y), silo = getE(UI.aimSilo);
    if (!silo || !inMap(i, j) || (R.aim.i === i && R.aim.j === j)) return;
    // Out of range or onto ground it can't strike: the crosshair waits at the last good spot and the banner says why.
    const why = BDEFS[silo.type].nukeSilo ? nukeBlocked(silo, i, j) : missileBlocked(silo, i, j);
    if (!why) R.aim = { i, j };
    showAimBanner(why || undefined);
  };
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
    showBanner(html + (R.aim && onTouch() ? ' Drag the crosshair to move it.' : ''), R.aim ? 'Launch' : null, 'Cancel');
    return;
  }
  if (R.aim) {
    const t = missileTargetAt(0, R.aim.i, R.aim.j);
    html += t ? `Fire at the ${playerName(t.owner)} <b>${BDEFS[t.type].name}</b>? ${BDEFS[t.type].mil ? 'Its armor drops to almost nothing, ready for warbots to capture.' : 'A hit wrecks it.'}`
      : 'Fire at this spot? The blast hurts rival buildings and bots within ' + md.splash + ' tiles.';
    if (onTouch()) html += ' Drag the crosshair to move it.';
    ok = 'Fire';
  } else {
    const w = silo.stock.warhead || 0;
    html += `Tap where to fire, inside the red ring (${md.range} tiles). A hit wrecks most buildings; the blast hurts everything rival within ${md.splash} tiles. <b>${esc(w)}</b> Missile${w === 1 ? '' : 's'} loaded.`;
  }
  showBanner(html, ok, 'Cancel');
}

/** A tap while aiming: the first picks the spot; Fire launches, and so does a second click on the spot with a mouse (not a second tap: a finger's double tap is too easily made). */
function aimTap(i, j) {
  const silo = getE(UI.aimSilo);
  if (!silo) { setMode('normal'); return; }
  if (!inMap(i, j)) return;
  const why = BDEFS[silo.type].nukeSilo ? nukeBlocked(silo, i, j) : missileBlocked(silo, i, j);
  if (why) { sfx('error'); R.aim = null; showAimBanner(why); return; }
  if (R.aim && R.aim.i === i && R.aim.j === j) { if (INPUT.mouse) fireAimed(); return; }
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

/** Under a finger: the target of a bomber's strike or a Rocket Truck's bombardment, picked by a tap and ringed, waiting for the banner's button (confirmBanner). */
function pickTarget(t, html, okLabel) {
  UI.pick = t.id;
  if (BDEFS[t.type]) { R.selected = t.id; UI.selBot = 0; } else { UI.selBot = t.id; R.selected = 0; }
  sfx('click');
  showBanner(html, okLabel, 'Cancel');
}

/** Send the bomber being given a target (UI.bomber) at t. */
function strikePicked(t) {
  const u = getE(UI.bomber), why = !u || u.dead ? 'That bomber is gone.' : !t || t.dead ? 'That target is gone: tap another.' : orderStrike(0, u, t);
  if (why) { sfx('error'); showBanner(`<span class="err">${why}</span>`, null, 'Cancel'); return; }
  sfx('order'); setMode('normal');
  toast(`Strike ordered on ${BDEFS[t.type] ? `the ${BDEFS[t.type].name}` : `a ${BOTS[t.type].name}`}: the bomber loads up and takes off.`, 'good');
}

function showBanner(html, okLabel, cancelLabel) {
  $('banner').hidden = false;
  $('banner-seg').hidden = true;
  $('banner-traffic').hidden = true;
  $('banner-undo').hidden = true;
  $('banner-clear').hidden = true;
  $('banner-ok').disabled = false;
  $('banner-ok').classList.remove('danger');
  $('banner').classList.remove('noplan');
  $('banner-select').hidden = true;
  $('banner-text').innerHTML = html;
  $('banner-ok').hidden = !okLabel;
  if (okLabel) $('banner-ok').textContent = okLabel;
  $('banner-cancel').textContent = cancelLabel || 'Cancel';
}

function enterPlaceMode(type, moveFrom) {
  closeSheet();
  setMode('place');
  UI.placeType = type;
  UI.moveFrom = moveFrom || 0;
  refreshOverlay(type);
  showBanner(type === 'ropeway' ? 'Tap a highlighted spot for the Ropeway\'s <b>near station</b>, where your roads are. Then tap the far end.'
    : type === 'viaduct' ? 'Tap a highlighted spot on a clifftop for the Viaduct\'s <b>near end</b>, where your roads are. Then tap the far end, across the valley.'
    : moveFrom ? `Tap a highlighted spot to move the <b>${BDEFS[type].name}</b> to. It's put together there for free (it takes its build time), and the old one keeps working until then.`
    : `Tap a highlighted spot to place a <b>${BDEFS[type].name}</b>.`, null, 'Cancel');
  if (!R.overlay.valid.some((v) => v)) {
    const near = BDEFS[type].gather ? ' near the right resource' : BDEFS[type].farm ? ' near fertile soil' : BDEFS[type].pump ? ' on an oil seep' : '';
    const how = DEFENCE_TYPES.has(type) ? `inside your border${near}. Defences only go on your own land: an Outpost or Keep extends it.` : `within ${BUILD_REACH} tiles of your buildings, roads or track${near}. Lay a road out toward where you want it.`;
    showBanner(`<span class="err">There is no valid spot for a ${BDEFS[type].name} ${how}</span>`, null, 'Close');
  }
}

/** The Army banner: what to tap, and Recall all when warbots are out in the field. */
function showArmyBanner() {
  const out = warbotsOut(0), k = S.players[0].keepW ?? 0, armed = UI.recallArm && performance.now() - UI.recallArm < RECALL_ARM;
  showBanner('<span class="ab-line">Tap a <b>rival building</b> to attack it with warbots or missiles, or tap open ground to send warbots there to <b>hold the area</b>.' +
    (out ? ` ${out} warbot${out > 1 ? 's are' : ' is'} out in the field: <b>Recall all</b> brings them home.` : '') + '</span>' +
    `<span class="keep-all">Every Outpost keeps <span class="seg">${[0, 1, 2, 5].map((v) => `<button data-k="${v}" class="${v === k ? 'on' : ''}">${v}</button>`).join('')}</span><span class="wide"> warbot${k === 1 ? '' : 's'}, sent from your Command Base</span></span>`,
    out ? (armed ? `Tap again: ${out} come home` : 'Recall all') : null, 'Cancel');
  $('banner-ok').classList.toggle('danger', !!(out && armed));
  // Under a finger: a way to the warbots themselves (with a mouse you click them, drag a box, or press F).
  $('banner-select').hidden = !(onTouch() && (armyIds(0).length || S.bots.some((u) => !u.dead && u.owner === 0 && BOTS[u.type].siege)));
  $('banner-select').onclick = () => { sfx('click'); setMode('normal'); $('sel-view').click(); if (!UI.sel.length) $('sel-army').click(); };
  for (const btn of $('banner-text').querySelectorAll('[data-k]')) btn.onclick = (e) => { e.stopPropagation(); setKeepAll(+btn.dataset.k); showArmyBanner(); };
}

/** Every Outpost keeps v warbots at home (each one's own setting is reset to follow this). */
function setKeepAll(v) {
  S.players[0].keepW = v;
  for (const b of S.buildings) if (!b.dead && b.owner === 0 && BDEFS[b.type].mil && b.type !== 'lander') delete b.keepW;
  sfx('click');
  toast(v === 0 ? 'Outposts keep no warbots now: your warbots stay at the Command Base unless you station some at an Outpost.'
    : `Every Outpost now keeps ${v} warbot${v === 1 ? '' : 's'}, sent from your Command Base (and replaced if lost).`, 'info');
}

/**
 * Recall all on the Army banner, under a finger: the first tap arms it (the button says how many come home), a
 * second within three seconds does it, like Demolish. It ends every attack and rally at once and sits where a
 * thumb rests. A mouse click, Enter and the C key recall straight away.
 */
const RECALL_ARM = 3000;
function recallAllTap() {
  if (!onTouch() || (UI.recallArm && performance.now() - UI.recallArm < RECALL_ARM)) { UI.recallArm = 0; recallAllWarbots(); return; }
  UI.recallArm = performance.now();
  sfx('click');
  showArmyBanner();
  setTimeout(() => { if (R.mode === 'attack' && UI.recallArm && performance.now() - UI.recallArm >= RECALL_ARM - 50) { UI.recallArm = 0; showArmyBanner(); } }, RECALL_ARM);
}

/** Bring every warbot in the field home to its garrison. */
function recallAllWarbots() {
  const n = recallAll(0);
  if (n) { sfx('order'); toast(`Recalled ${n} warbot${n > 1 ? 's' : ''}: they're heading back to their garrisons.`, 'info'); }
  else { sfx('error'); toast('No warbots are out in the field.', 'info'); }
  if (R.mode === 'attack') setMode('normal');
}

function confirmBanner() {
  if (R.mode === 'aim') { fireAimed(); return; }
  if (R.mode === 'strike' && UI.pick) { strikePicked(getE(UI.pick)); return; }
  if (R.mode === 'bombard' && UI.pick) {
    const u = getE(UI.rocket), b = getE(UI.pick);
    if (!u || u.dead || !b || !rocketTarget(u, b)) { sfx('error'); UI.pick = 0; showBanner('<span class="err">That target is gone.</span> Tap an enemy building.', null, 'Cancel'); return; }
    orderBombard(0, [u.id], b);
    toast(`The Rocket Truck is off to bombard the ${BDEFS[b.type].name}.`, 'info');
    sfx('order'); addFx('ring', b.x + 0.5, b.y + 0.5, { color: '#ff5a6e' });
    setMode('normal');
    return;
  }
  if (R.mode === 'land') { confirmLanding(); return; }
  if (R.mode === 'airdrop') { confirmAirdrop(); return; }
  if (R.mode === 'attack') { recallAllTap(); return; }
  if (R.mode === 'road') { commitDraft(); return; }
  if (R.mode === 'place' && (UI.placeType === 'ropeway' || UI.placeType === 'viaduct')) {
    const A = UI.ropeA, E = R.ropeEnd;
    if (!A || !E || !E.ok) return;
    const res = UI.placeType === 'viaduct' ? placeViaduct(0, A.i, A.j, E.i, E.j) : placeRopeway(0, A.i, A.j, E.i, E.j);
    if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
    settlePlans(); // a Viaduct is paid from storage: what's there now goes in at once
    sfx('place');
    addFx('ring', A.i + 0.5, A.j + 0.5, { color: PLAYER_COLORS[0] });
    setMode('normal');
    return;
  }
  if (R.mode !== 'place' || !R.ghost || !R.ghost.ok) return;
  const { type, x, y } = R.ghost;
  const from = UI.moveFrom ? getE(UI.moveFrom) : null;
  const res = from ? startMove(0, from, x, y) : placeSite(0, type, x, y);
  if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
  if (from) toast(`Moving the ${BDEFS[type].name}: workers put it together here (no goods needed), and the old one keeps working until it's ready.`, 'good');
  UI.moveFrom = 0;
  sfx('place');
  addFx('ring', x + 0.5, y + 0.5, { color: PLAYER_COLORS[0] });
  setMode('normal');
}

/* ------------------------------------------------------------------ map taps */

/** Placing a Ropeway: the first tap picks the near station, the second the far end (tap it again to build). */
function ropewayTap(i, j) {
  if (!UI.ropeA) {
    const chk = canPlace(0, 'ropeway', i, j);
    R.ghost = { type: 'ropeway', x: i, y: j, ok: chk.ok };
    if (!chk.ok) { sfx('error'); showBanner(`<span class="err">${chk.reason}</span>`, null, 'Cancel'); return; }
    UI.ropeA = { i, j };
    sfx('click');
    showBanner(`Now tap the <b>far end</b>: ${ROPE_MIN} to ${ROPE_MAX} tiles away, on ground no rival holds, across anything (cliffs, water, rock).`, null, 'Cancel');
    return;
  }
  const A = UI.ropeA;
  if (R.ropeEnd && R.ropeEnd.i === i && R.ropeEnd.j === j && R.ropeEnd.ok) { confirmBanner(); return; }
  const why = ropeEndBlocked(0, A.i, A.j, i, j);
  R.ropeEnd = { i, j, ok: !why };
  if (why) { sfx('error'); showBanner(`<span class="err">${why}</span> Tap another far end.`, null, 'Cancel'); return; }
  const len = Math.round(dist(A.i, A.j, i, j));
  const rise = S.elev[tIdx(i, j)] - S.elev[tIdx(A.i, A.j)];
  showBanner(`A <b>Ropeway</b> ${len} tiles long${rise ? `, ${Math.abs(rise)} level${Math.abs(rise) > 1 ? 's' : ''} ${rise > 0 ? 'up' : 'down'}` : ''}? ${costInline(BDEFS.ropeway.cost, playerGoods(0))}`, 'Build', 'Cancel');
}

/** Placing a Viaduct: the first tap picks the near end, the second the far end across the valley (tap it again to build). */
function viaductTap(i, j) {
  if (!UI.ropeA) {
    const chk = canPlace(0, 'viaduct', i, j);
    R.ghost = { type: 'viaduct', x: i, y: j, ok: chk.ok };
    if (!chk.ok) { sfx('error'); showBanner(`<span class="err">${chk.reason}</span>`, null, 'Cancel'); return; }
    UI.ropeA = { i, j };
    refreshOverlay('viaduct');
    sfx('click');
    const any = R.overlay.valid.some((v) => v);
    showBanner(any ? `Now tap the <b>far end</b> (highlighted): a clifftop in the same row or column, ${VIA_MIN} to ${VIA_MAX} tiles away, across ground lower than both ends.`
      : '<span class="err">No valley to span from here: a Viaduct needs a clifftop across lower ground, in a straight line.</span> Tap another near end.', null, 'Cancel');
    if (!any) { UI.ropeA = null; R.ghost = null; refreshOverlay('viaduct'); }
    return;
  }
  const A = UI.ropeA;
  if (R.ropeEnd && R.ropeEnd.i === i && R.ropeEnd.j === j && R.ropeEnd.ok) { confirmBanner(); return; }
  const why = viaductBlocked(0, A.i, A.j, i, j);
  R.ropeEnd = { i, j, ok: !why };
  if (why) { sfx('error'); showBanner(`<span class="err">${why}</span> Tap another far end.`, null, 'Cancel'); return; }
  const n = Math.abs(i - A.i) + Math.abs(j - A.j) - 1, cost = viaductCost(A.i, A.j, i, j);
  const rise = S.elev[tIdx(i, j)] - S.elev[tIdx(A.i, A.j)];
  showBanner(`A <b>Viaduct</b> spanning ${n} tile${n > 1 ? 's' : ''}${rise ? `, ${Math.abs(rise)} level${Math.abs(rise) > 1 ? 's' : ''} ${rise > 0 ? 'up' : 'down'} at the far end` : ''}? ${costInline(cost, playerGoods(0))} (${canPay(0, cost) ? 'paid now' : 'paid from storage as the goods come in'})`, 'Build', 'Cancel');
}

function buildingAtTap(i, j, wx, wy) {
  if (inMap(i, j) && S.bAt[tIdx(i, j)]) return getE(S.bAt[tIdx(i, j)]);
  for (const b of S.buildings) {
    if (!b.dead && b.type === 'lander' && dist2(b.x + 0.5, b.y + 0.5, wx, wy) < 1.1) return b;
  }
  return null;
}

function onMapTap(i, j, wx, wy) {
  if (!UI.inGame || UI.paused) return;
  // The first tap on the map folds the goal card away on a small screen (it has been read; the map is wanted now).
  if (!UI.objCollapsed && !UI.objManual && !S.mission && !isWide()) { UI.objCollapsed = true; UI.objAuto = true; UI.hudT = 0; }
  if (R.mode === 'strike') {
    const u = getE(UI.bomber);
    if (!u || u.dead) { setMode('normal'); return; }
    const b = buildingAtTap(i, j, wx, wy);
    let t = b && b.owner !== 0 ? b : null;
    if (!t) { let bd = 0.5; for (const v of S.bots) { if (v.dead || v.owner === 0 || v.inside || BOTS[v.type].air) continue; const d = dist2(v.x, v.y, wx, wy); if (d < bd) { bd = d; t = v; } } }
    if (!t) { sfx('error'); showBanner('<span class="err">Tap an enemy building, or an enemy vehicle or robot out in the open.</span>', null, 'Cancel'); return; }
    // Under a finger the target is picked first (ringed on the map) and the banner's Strike sends the bomber; a mouse click sends it at once.
    if (!INPUT.mouse) { pickTarget(t, `Strike ${BDEFS[t.type] ? `the ${playerName(t.owner)} <b>${BDEFS[t.type].name}</b>` : `this <b>${BOTS[t.type].name}</b>`}? The bomber loads up and takes off.`, 'Strike'); return; }
    strikePicked(t);
    return;
  }
  if (R.mode === 'fsail') {
    const f = getE(UI.ferry);
    if (!f || f.dead) { setMode('normal'); return; }
    const why = orderSail(0, f, i, j);
    if (why) { sfx('error'); showBanner(`<span class="err">${why}</span>`, null, 'Cancel'); return; }
    sfx('order'); setMode('normal'); openBotSheet(f);
    return;
  }
  // A Rocket Truck's orders from its panel: bombard the enemy building tapped, or drive to the spot tapped.
  if (R.mode === 'bombard' || R.mode === 'rgo') {
    const u = getE(UI.rocket);
    if (!u || u.dead) { setMode('normal'); return; }
    if (R.mode === 'bombard') {
      const b = buildingAtTap(i, j, wx, wy);
      if (!b || !rocketTarget(u, b)) { sfx('error'); showBanner('<span class="err">Tap an enemy building.</span> The truck drives to within ' + ROCKET.range + ' tiles of it and fires.', null, 'Cancel'); return; }
      if (!INPUT.mouse) { pickTarget(b, `Bombard the ${playerName(b.owner)} <b>${BDEFS[b.type].name}</b>? The truck drives to within ${ROCKET.range} tiles of it and fires.`, 'Bombard'); return; }
      orderBombard(0, [u.id], b);
      toast(`The Rocket Truck is off to bombard the ${BDEFS[b.type].name}.`, 'info');
    } else if (!orderPark(0, [u.id], i, j)) { sfx('error'); showBanner('<span class="err">It can\'t drive there.</span> Tap open ground.', null, 'Cancel'); return; }
    sfx('order');
    addFx('ring', i + 0.5, j + 0.5, { color: R.mode === 'bombard' ? '#ff5a6e' : '#7dffa0' });
    setMode('normal');
    return;
  }
  if (R.mode === 'crawl') {
    const u = getE(UI.crawler);
    if (!u || u.dead) { setMode('normal'); return; }
    const why = driveCrawler(u, i, j);
    if (why) { sfx('error'); showBanner(`<span class="err">${why}</span> Tap somewhere else.`, null, 'Cancel'); return; }
    sfx('order');
    addFx('ring', i + 0.5, j + 0.5, { color: PLAYER_COLORS[0] });
    setMode('normal');
    toast('The Crawler is on its way: it deploys when it gets there.', 'info');
    return;
  }
  if (R.mode === 'place') {
    if (!inMap(i, j)) return;
    const type = UI.placeType;
    if (type === 'ropeway') { ropewayTap(i, j); return; }
    if (type === 'viaduct') { viaductTap(i, j); return; }
    if (R.ghost && R.ghost.x === i && R.ghost.y === j && R.ghost.ok) { confirmBanner(); return; }
    const chk = canPlace(0, type, i, j);
    R.ghost = { type, x: i, y: j, ok: chk.ok };
    if (chk.ok) {
      let extra = '';
      const def = BDEFS[type];
      if (def.gather) {
        const un = type === 'mine' && nukeOn() ? reachableRes(i, j, def.radius, R_URANIUM) : 0;
        extra = ` <span class="ok">${reachableRes(i, j, def.radius, def.gather)} ${RES[def.gather].name.toLowerCase()}s${un ? ` and <b>${un} uranium deposit${un > 1 ? 's' : ''}</b>` : ''} in reach.</span>`;
        if (def.bedrock) { const f = rockFacesIn(i, j, def.radius); extra += f ? ` <span class="ok">${f} rock face${f > 1 ? 's' : ''} to cut Stone from when they're gone.</span>` : ' With none left it digs Stone out of the ground, slowly.'; }
      }
      if (def.farm) extra = ` <span class="ok">${fertileIn(i, j, def.radius)} fertile tiles in reach.</span>`;
      if (def.pump) extra = ` <span class="ok">${oilAround(i, j)} Crude in this seep.</span>`;
      if (def.burner) {
        let n = 0;
        for (const c of S.buildings) if (!c.dead && c.owner === 0 && BDEFS[c.type].work && dist2(c.x, c.y, i, j) <= def.burner.radius * def.burner.radius) n++;
        extra = n ? ` <span class="ok">It would power ${n} building${n === 1 ? '' : 's'} in reach.</span>` : ' <span class="err">Nothing in reach to power: put it among your factories.</span>';
      }
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
      // Ones you can't pay for yet are planned and go up once they're paid for (oldest plans first).
      const P = junPlanAt(t);
      if ((S.over[t] && S.over[t].owner !== 0) || (S.lights[t] && S.lights[t].owner !== 0) || (!S.over[t] && !S.lights[t] && S.road[t] && wayOwner(t) !== 0)) { sfx('error'); showRoadBanner('That junction isn\'t yours: you can only change junctions in your own land.'); return; }
      if (S.over[t]) { removeOverpass(t); markDirty(i, j); sfx('click'); showRoadBanner('Overpass taken down: its Cement and Alloy are back.', true); return; }
      if (P && P.kind === 'over') {
        cancelJunPlan(t);
        const lit = !!S.lights[t];
        if (lit) removeLight(t);
        sfx('click'); showRoadBanner(`Planned overpass called off (nothing was spent on it yet)${lit ? '; the light is taken down and its Alloy is back' : ''}.`, true);
        return;
      }
      if (S.lights[t] || P) {
        const why = placeOverpass(0, i, j);
        if (why) { if (S.lights[t]) removeLight(t); cancelJunPlan(t); sfx('click'); showRoadBanner(`Light taken down. ${why}`, true); }
        else if (S.over[t]) { sfx('place'); addFx('ring', i + 0.5, j + 0.5, { color: '#ffd166' }); showRoadBanner('Overpass built: traffic flows through without stopping.', true); }
        else { sfx('place'); showRoadBanner(`Overpass planned: it goes up once its ${costText(junPlanCost(t, junPlanAt(t)))} is paid for from storage (oldest plans first)${S.lights[t] ? '; the light keeps working meanwhile' : ''}.`, true); }
        return;
      }
      const why = placeLight(0, i, j);
      if (why) { sfx('error'); showRoadBanner(why); }
      else if (S.lights[t]) { sfx('place'); addFx('ring', i + 0.5, j + 0.5, { color: '#7dffa0' }); showRoadBanner(); }
      else { sfx('place'); showRoadBanner(`Traffic light planned: it goes up once its ${costText(LIGHT_COST)} is paid for from storage (oldest plans first).`, true); }
      return;
    }
    if (UI.roadMode === 'pave') {
      // Mark a road for asphalt, or clear its mark.
      if (!paveMarkable(t)) { sfx('error'); showRoadBanner('Mark your own roads (or planned roads) for asphalt.'); return; }
      setPaveMark(0, i, j, !S.paveMark[t]);
      sfx('click');
      showRoadBanner();
      return;
    }
    if (UI.roadMode === 'arrows') {
      // Turn the arrow: east, south, west, north, then back to two-way.
      if (S.road[t] && !roadOwnedBy(0, t)) { sfx('error'); showRoadBanner('That road isn\'t yours: you can only change your own roads.'); return; }
      if (S.road[t]) { if (!UI.draft) draftReset(); UI.draft.strokes.push([{ t, op: 'dir', from: S.road[t] }]); setRoadDir(i, j, S.road[t] >= 5 ? 1 : S.road[t] + 1); sfx('click'); showRoadBanner(); }
      return;
    }
    if (!UI.draft) draftReset();
    if (UI.roadMode === 'ramp') {
      // Ramps: tap a highlighted cliff edge to plan one there, tap it again to drop it.
      const stroke = [];
      let note = '';
      if (UI.draft.ramps.has(t)) draftOp(stroke, t, 'unramp');
      else {
        let at = t;
        const chk = canPlace(0, 'ramp', i, j);
        if (!chk.ok) {
          // The other side of the cliff (often ground your bots can't reach yet, below or above):
          // plan the Ramp on the side they can reach, cut toward the tile you tapped.
          const alt = rampPartner(i, j);
          if (alt < 0) { sfx('error'); showRoadBanner(chk.reason); return; }
          if (UI.draft.ramps.has(alt)) { draftOp(stroke, alt, 'unramp'); at = -1; }
          else {
            at = alt;
            note = S.elev[alt] > S.elev[t] ? 'Planned on the cliff top: workers cut the Ramp down from there to the ground you tapped.'
              : 'Planned at the foot of the cliff: workers cut the Ramp up from there to the ground you tapped.';
          }
        }
        if (at >= 0) draftOp(stroke, at, 'ramp');
      }
      UI.draft.strokes.push(stroke);
      sfx('click');
      showRoadBanner(note, !!note);
      return;
    }
    if (UI.roadMode === 'pipe') {
      // Pipes: tap an Oil Pump to pipe it to the nearest Refinery; tap a tile to add or drop pipe there,
      // or tap laid pipe to take it up.
      const stroke = [], bb = S.bAt[t] && getE(S.bAt[t]);
      if (bb && bb.owner === 0 && BDEFS[bb.type].pump) {
        const r = pipeToRefinery(0, bb);
        if (r.why) { sfx('error'); showRoadBanner(r.why); return; }
        for (const u of r.tiles) if (!UI.draft.pipe.has(u)) draftOp(stroke, u, 'pipe');
        UI.draft.strokes.push(stroke);
        sfx('click');
        showRoadBanner(`Pipe from the Oil Pump to the Refinery: ${r.tiles.length} tile${r.tiles.length === 1 ? '' : 's'}.`, true);
        return;
      }
      if (UI.draft.pipe.has(t)) draftOp(stroke, t, 'unpipe');
      else if (UI.draft.pipeDel.has(t)) draftOp(stroke, t, 'unpipedel');
      else if (S.pipe[t] === 1 || S.pipePlan[t] === 1) draftOp(stroke, t, 'pipedel');
      else { const why = pipeBlocked(0, t); if (why) { sfx('error'); showRoadBanner(why); return; } draftOp(stroke, t, 'pipe'); }
      UI.draft.strokes.push(stroke);
      sfx('click');
      showRoadBanner();
      return;
    }
    if (UI.roadMode === 'rail') {
      // Rail: a tap adds a tile of track or drops it; tapping laid track marks it to take up.
      const stroke = [];
      if (UI.draft.rail.has(t)) draftOp(stroke, t, 'unrail');
      else if (UI.draft.railDel.has(t)) draftOp(stroke, t, 'unraildel');
      else if (S.rail[t] && !roadOwnedBy(0, t)) { sfx('error'); showRoadBanner('That track isn\'t yours: you can only take up your own track.'); return; }
      else if (S.rail[t] || S.railPlan[t] === 1) draftOp(stroke, t, 'raildel');
      else if (S.bAt[t] && getE(S.bAt[t]).owner === 0 && BDEFS[getE(S.bAt[t]).type].station) { showRoadBanner('Drag from this station to another: the track is laid beside each of them, and trains run between them.'); return; }
      else { const why = railBlocked(0, t); if (why) { sfx('error'); showRoadBanner(why); return; } draftOp(stroke, t, 'rail'); }
      UI.draft.strokes.push(stroke);
      sfx('click');
      showRoadBanner();
      return;
    }
    if (UI.roadMode === 'wall') {
      // Walls: a tap plans a Wall (a Gate on a road), taps again make it a Gate, then drop it.
      const stroke = [], had = UI.draft.walls.get(t) || null;
      const first = wallKind(t);
      const next = !had ? first : had === 'wall' ? 'gate' : null;
      if (next && !wallFits(t, next)) {
        sfx('error');
        showRoadBanner(S.bAt[t] ? 'There is already a building here.' : canPlace(0, next, i, j, true).reason);
        return;
      }
      draftWall(stroke, t, next);
      UI.draft.strokes.push(stroke);
      sfx('click');
      showRoadBanner(next === 'gate' && first === 'wall' ? 'A Gate on open ground: your bots walk through it, enemies have to break it.' : '', true);
      return;
    }
    // Roads and Bridges: a tap adds a tile to the plan or drops it, or marks a road to take up.
    const stroke = [];
    const d = UI.draft;
    let note = '';
    if (d.addSet.has(t)) draftOp(stroke, t, 'unadd');
    else if (d.del.has(t)) draftOp(stroke, t, 'undel');
    else if (S.road[t] && !roadOwnedBy(0, t) && S.plan[t] !== 1) { sfx('error'); showRoadBanner('That road isn\'t yours: you can only take up your own roads.'); return; }
    else if (S.road[t] || S.plan[t] === 1) { draftOp(stroke, t, 'del'); note = S.plan[t] ? 'Planned tile marked to call off.' : 'Road marked to take up: its Cement comes back when you tap Build.'; }
    else if (canRoad(0, i, j) || draftBridge(t)) {
      // Away from the plan and the roads, the road runs there by itself (one leg, which Undo takes back);
      // beside them the tap adds just that tile.
      const leg = roadLegTo(t);
      for (const u of leg || [t]) draftOp(stroke, u, 'add');
      const cross = leg ? leg.filter(crossTile).length : 0, clear = leg ? leg.filter((u) => !crossTile(u) && S.res[u]).length : 0;
      if (leg) note = `The road runs there: ${leg.length} tiles${cross ? `, ${cross} of bridge or tunnel` : ''}${clear ? `, ${clear} through resources` : ''}. <b>Undo</b> takes this leg back.`;
      else if (crossTile(t)) note = `${CROSS[S.terrain[t]].name} tile: ${costText(crossCost(t))}${bridgeMul(t) > 1 ? ' (far from shore: bridges cost more out here)' : ''}.`;
      else if (S.res[t]) note = `Workers will clear the ${RES[S.res[t]].name.toLowerCase()} (${ROAD_CLEAR}× Cement).`;
    } else { sfx('error'); showRoadBanner(S.owner[t] >= 0 && S.owner[t] !== 0 ? 'A rival holds that ground: roads only run on yours or no-one\'s.' : crossTile(t) ? 'A bridge has to start from your shore, your road or the end of a bridge.' : 'Your bots can\'t reach there yet: it\'s across water or a cliff from your land.'); return; }
    if (stroke.length) d.strokes.push(stroke);
    sfx('click');
    showRoadBanner(note, true);
    planInView(t);
    return;
  }
  if (R.mode === 'aim') { aimTap(i, j); return; }
  if (R.mode === 'land') { landTap(i, j); return; }
  if (R.mode === 'airdrop') { airdropTap(i, j); return; }
  const rally = rallyAtTap(wx, wy);
  const b = buildingAtTap(i, j, wx, wy);
  if (R.mode === 'attack' && !rally) {
    if (b && b.owner !== 0) { setMode('normal'); openBuildingSheet(b); }
    else if (!b && inMap(i, j) && S.terrain[tIdx(i, j)] === T_GROUND) { setMode('normal'); openMoveSheet(i, j); }
    else { sfx('error'); showBanner(`<span class="err">Tap a rival building (${S.players.length > 2 ? 'red or green' : 'red'}) or open ground.</span>`, null, 'Cancel'); }
    return;
  }
  // Under a finger: with warbots selected and their bar showing, a tap on another of yours selects it and a tap
  // anywhere else is their order; with none selected, a tap on one of yours out in the open selects it.
  if (!INPUT.mouse && R.mode === 'normal') {
    const unit = unitAtTap(wx, wy);
    if (performance.now() - (UI.chipAt || 0) < 450) return; // (the second of two quick taps on a group chip that has just moved: see initSelBar)
    if (selBarShowing()) { if (unit) touchSelect(unit); else touchOrder(i, j, wx, wy); return; }
    if (unit && !b && !rally) { closeSheet(); touchSelect(unit); return; }
  }
  // Everything under the tap: a rally flag, a building, then robots, nearest first. Tapping the same spot
  // again steps on to the next (a Crawler parked on a Foundry, a worker at a site, two warbots together).
  const stack = tapStack(rally, b, wx, wy);
  if (stack.length) {
    const L = UI.lastTap;
    let k = 0;
    if (L && Math.hypot(L.wx - wx, L.wy - wy) < 0.7) {
      const cur = stack.findIndex((s) => UI.sheetKind === s.kind && UI.sheetFor === s.e.id);
      if (cur >= 0) k = (cur + 1) % stack.length;
    }
    UI.lastTap = { wx, wy };
    const s = stack[k];
    sfx('click');
    if (s.kind === 'rally') { setMode('normal'); openRallySheet(s.e); }
    else if (s.kind === 'bld') openBuildingSheet(s.e);
    else {
      const bot = s.e, mine = bot.owner === 0 && (bot.type === 'warbot' || BOTS[bot.type].siege);
      if (mine && !INPUT.mouse) { closeSheet(); touchSelect(bot); return; } // (a finger selects it: its panel is behind Info on the selection bar)
      if (mine) selectBots([bot.id], INPUT.shift);
      openBotSheet(bot);
    }
    if (stack.length > 1 && !UI.stackHint) { UI.stackHint = true; toast(`${stack.length} things are here: tap the same spot again for the next one.`, 'info'); }
    return;
  }
  UI.lastTap = null;
  if (INPUT.mouse && UI.sel.length && !INPUT.shift) selectBots([], false);
  if (inMap(i, j) && postAt(tIdx(i, j))) { sfx('click'); openPostSheet(postAt(tIdx(i, j))); return; }
  if (inMap(i, j) && S.res[tIdx(i, j)]) { sfx('click'); openResourceSheet(tIdx(i, j)); return; }
  if (inMap(i, j) && S.fert[tIdx(i, j)] && S.terrain[tIdx(i, j)] === T_GROUND) { sfx('click'); openSoilSheet(tIdx(i, j)); return; }
  if (inMap(i, j) && S.road[tIdx(i, j)] && wayOwner(tIdx(i, j)) === 0) { sfx('click'); openRoadSheet(tIdx(i, j)); return; }
  closeSheet();
}

/** With a mouse, placing a building previews it under the pointer; a click then places it. */
function onMapHover(i, j) {
  if (R.mode === 'aim' || R.mode === 'land' || R.mode === 'airdrop') { R.aimHover = inMap(i, j) ? { i, j } : null; return; }
  if (R.mode !== 'place' || !R.overlay || !UI.placeType || !inMap(i, j)) return;
  R.ghost = { type: UI.placeType, x: i, y: j, ok: !!R.overlay.valid[tIdx(i, j)], hover: true };
}

/**
 * What a tap at (wx, wy) could open, top of the pile first: the rally flag there, the building, then robots
 * out in the open within reach (bigger ones from further), nearest first. Each is { kind: sheet kind, e }.
 */
function tapStack(rally, b, wx, wy) {
  const out = [];
  if (rally) out.push({ kind: 'rally', e: rally });
  if (b) out.push({ kind: 'bld', e: b });
  const bots = [];
  for (const u of S.bots) {
    if (u.dead || u.inside) continue;
    const bt = BOTS[u.type], r2 = bt.crawler || bt.siege || bt.truck || bt.rail ? 0.6 : 0.3;
    const d = dist2(u.x, u.y, wx, wy);
    if (d < r2) bots.push([d, u]);
  }
  bots.sort((p, q) => p[0] - q[0]);
  for (const [, u] of bots) out.push({ kind: 'bot', e: u });
  return out;
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
function draftReset() { UI.draft = { add: [], addSet: new Set(), del: new Set(), ramps: new Set(), railRamps: new Set(), walls: new Map(), rail: new Set(), railDel: new Set(), pipe: new Set(), pipeDel: new Set(), strokes: [] }; }
function draftEmpty() { return !UI.draft || (!UI.draft.add.length && !UI.draft.del.size && !UI.draft.ramps.size && !UI.draft.walls.size && !UI.draft.rail.size && !UI.draft.railDel.size && !UI.draft.pipe.size && !UI.draft.pipeDel.size); }

/** A bridge sketched out past the border: water touching a tile already in the sketch. */
function draftBridge(t) {
  const d = UI.draft;
  return bridgeable(t) && !S.bAt[t] && !scorched(t) && bridgeHead(0, t % S.W, (t / S.W) | 0, (u) => d.addSet.has(u) && bridgeable(u));
}

/**
 * A tap in Roads or Bridges on open ground away from the plan and your roads: the run of new tiles that takes
 * the road there by the cheapest way from the nearest of them (roadSearch, as Lay road does: round resources,
 * up the Ramps there are, over water only where that's cheaper), so a long road is a few taps. In order from
 * that end to the tile tapped; null beside the plan or a road, or when there's no way through.
 */
function roadLegTo(t) {
  const d = UI.draft, W = S.W, i = t % W;
  const net = (u) => d.addSet.has(u) || S.plan[u] === 1 || (S.road[u] > 0 && roadOwnedBy(0, u));
  for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) if (u >= 0 && u < W * S.H && net(u)) return null;
  const res = roadSearch(0, [t], net);
  if (res.end < 0) return null;
  const leg = [];
  for (let k = res.end; k >= 0; k = res.prev[k]) if (!net(k) && !roadLike(k) && !S.plan[k]) leg.push(k);
  return leg.length > 1 ? leg : null;
}

/**
 * On a phone a plan's buttons make the Paths banner a row taller: when that leaves the tile just tapped under it
 * (a tap just above the banner ran the road there), the map glides up to show the end of the plan.
 */
function planInView(t) {
  if (isWide()) return;
  const r = $('banner').getBoundingClientRect(), z = R.cam.z, p = worldToScreen(t % S.W + 0.5, ((t / S.W) | 0) + 0.5), over = p.y + z - r.top;
  if (over > 0 && p.y < r.bottom && p.x > r.left - z && p.x < r.right + z) UI.glide = { x: R.cam.x, y: R.cam.y + over / z, t: 0.5 };
}

/**
 * May a drag that starts on tile (i, j) paint? In Arrows only one that starts on a road of yours: from anywhere
 * else it moves the map, as a one-finger drag does outside Paths (a habitual pan across your roads turned them
 * all one-way). Every other tool paints from wherever it starts.
 */
function roadPaintStarts(i, j) {
  return UI.roadMode !== 'arrows' || (inMap(i, j) && S.road[tIdx(i, j)] > 0 && roadOwnedBy(0, tIdx(i, j)));
}

/** Is a finger, not a mouse, at work? The last pointer used on the map says; before any, the kind of screen. */
function onTouch() { return INPUT.mouse === undefined ? matchMedia('(pointer: coarse)').matches : !INPUT.mouse; }

/**
 * Sketching in Paths with the finger (or the mouse) up near an edge of the map: the map scrolls that way and
 * the sketch carries on under the finger, so a long road is one stroke. Called every frame (keyPan).
 */
const PAINT_EDGE = 48; // pixels from the edge of the map where it starts, faster the nearer the edge
function paintScroll(dt) {
  const g = INPUT.gesture;
  if (!g || !g.painting || R.mode !== 'road') return;
  // The map's edges: the top bar above; below, the Paths banner where it's docked across the bottom, else the screen.
  const top = document.querySelector('.toprow').getBoundingClientRect().bottom, ban = $('banner').getBoundingClientRect();
  const bot = ban.width > R.w * 0.9 && ban.bottom > R.h - 2 ? ban.top : R.h, E = PAINT_EDGE;
  const dx = g.lx < E ? (g.lx - E) / E : g.lx > R.w - E ? (g.lx - (R.w - E)) / E : 0;
  const dy = g.ly < top + E ? (g.ly - top - E) / E : g.ly > bot - E ? (g.ly - (bot - E)) / E : 0;
  if (!dx && !dy) return;
  const sp = (Math.max(R.w, R.h) * 0.6 * dt) / R.cam.z, x0 = R.cam.x, y0 = R.cam.y;
  R.cam.x += clamp(dx, -1, 1) * sp; R.cam.y += clamp(dy, -1, 1) * sp;
  clampCam();
  if (R.cam.x === x0 && R.cam.y === y0) return;
  const w = screenToWorld(g.lx, g.ly);
  onRoadPaint(Math.floor(w.x), Math.floor(w.y), false);
}

/** What a wall line puts on tile t: a Gate on a road or track (or a planned one), a Wall anywhere else. */
function wallKind(t) { return S.road[t] || S.plan[t] || S.rail[t] || (S.railPlan && S.railPlan[t]) || (UI.draft && UI.draft.rail.has(t)) ? 'gate' : 'wall'; }

/** Could a Wall or Gate (`kind`) go on tile t? (What it costs is checked for the whole plan.) */
function wallFits(t, kind) { return !S.bAt[t] && canPlace(0, kind, t % S.W, (t / S.W) | 0, true).ok; }

/** Plan a Wall or Gate on tile t, or drop it (kind null), remembering the change for Undo. */
function draftWall(stroke, t, kind) {
  const d = UI.draft, from = d.walls.get(t) || null;
  if (from === kind) return;
  if (kind) d.walls.set(t, kind); else d.walls.delete(t);
  stroke.push({ t, op: 'setw', from, to: kind });
}

function draftOp(stroke, t, op) {
  const d = UI.draft;
  if (op === 'add') { if (d.addSet.has(t)) return; d.add.push(t); d.addSet.add(t); }
  else if (op === 'unadd') { if (!d.addSet.has(t)) return; d.addSet.delete(t); d.add.splice(d.add.indexOf(t), 1); }
  else if (op === 'del') { if (d.del.has(t)) return; d.del.add(t); }
  else if (op === 'undel') { if (!d.del.has(t)) return; d.del.delete(t); }
  else if (op === 'ramp') { if (d.ramps.has(t)) return; d.ramps.add(t); }
  else if (op === 'unramp') { if (!d.ramps.has(t)) return; d.ramps.delete(t); }
  else if (op === 'rail') { if (d.rail.has(t)) return; d.rail.add(t); }
  else if (op === 'unrail') { if (!d.rail.has(t)) return; d.rail.delete(t); }
  else if (op === 'raildel') { if (d.railDel.has(t)) return; d.railDel.add(t); }
  else if (op === 'unraildel') { if (!d.railDel.has(t)) return; d.railDel.delete(t); }
  else if (op === 'pipe') { if (d.pipe.has(t)) return; d.pipe.add(t); }
  else if (op === 'unpipe') { if (!d.pipe.has(t)) return; d.pipe.delete(t); }
  else if (op === 'pipedel') { if (d.pipeDel.has(t)) return; d.pipeDel.add(t); }
  else if (op === 'unpipedel') { if (!d.pipeDel.has(t)) return; d.pipeDel.delete(t); }
  stroke.push({ t, op });
}

/** Take back the last drag or tap. */
function draftUndo() {
  const d = UI.draft;
  if (!d) return;
  let s;
  do s = d.strokes.pop(); while (s && !s.length); // skip drags that added nothing
  if (!s) return;
  const back = { add: 'unadd', unadd: 'add', del: 'undel', undel: 'del', ramp: 'unramp', unramp: 'ramp', rail: 'unrail', unrail: 'rail', raildel: 'unraildel', unraildel: 'raildel', pipe: 'unpipe', unpipe: 'pipe', pipedel: 'unpipedel', unpipedel: 'pipedel' };
  for (let k = s.length - 1; k >= 0; k--) {
    if (s[k].op === 'setw') { if (s[k].from) d.walls.set(s[k].t, s[k].from); else d.walls.delete(s[k].t); continue; }
    if (s[k].op === 'dir') { if (roadOwnedBy(0, s[k].t)) setRoadDir(s[k].t % S.W, (s[k].t / S.W) | 0, s[k].from); continue; } // an arrow turned back
    draftOp([], s[k].t, back[s[k].op]);
  }
}

/** What the plan costs (new tiles, less what taking up roads gives back) and how many tiles of each kind. */
function draftSummary() {
  const d = UI.draft, cost = {}, back = {};
  let add = 0, cross = 0, clear = 0;
  for (const t of d.add) {
    if (S.road[t] || S.plan[t] || d.ramps.has(t)) continue; // (a planned Ramp is the road there)
    add++;
    if (crossTile(t)) cross++; else if (S.res[t]) clear++;
    const c = roadTileCost(t);
    for (const g in c) cost[g] = (cost[g] || 0) + c[g];
  }
  for (const t of d.del) {
    if (!S.road[t] && !S.plan[t]) continue;
    // Taking up a road returns its Cement (a bridge or tunnel, its Cement and Alloy); calling off a planned tile refunds what it cost.
    const c = S.plan[t] ? (S.owe[t] ? {} : roadTileCost(t)) : crossTile(t) ? crossCost(t) : roadCost(); // a tile still waiting for its goods gives nothing back
    for (const g in c) back[g] = (back[g] || 0) + c[g];
  }
  // Ramps are paid for from storage as the goods come in, like the rest of the plan.
  for (const t of d.ramps) for (const g in BDEFS.ramp.cost) cost[g] = (cost[g] || 0) + BDEFS.ramp.cost[g];
  // Walls and Gates are paid for from storage the moment you tap Build.
  let walls = 0, gates = 0;
  const wcost = {};
  for (const [, kind] of d.walls) {
    if (kind === 'gate') gates++; else walls++;
    for (const g in BDEFS[kind].cost) { cost[g] = (cost[g] || 0) + BDEFS[kind].cost[g]; wcost[g] = (wcost[g] || 0) + BDEFS[kind].cost[g]; }
  }
  // Track is paid for from storage when you tap Build too; taking it up gives its Cement and Alloy back.
  for (const t of d.rail) if (!S.rail[t]) { const rc = railCost(t); for (const g in rc) cost[g] = (cost[g] || 0) + rc[g]; }
  for (const t of d.railDel) if (S.rail[t]) { const rc = railCost(t); for (const g in rc) back[g] = (back[g] || 0) + rc[g]; }
  // Pipe too: paid when you tap Build (or as the goods come in); taken up, it gives its goods back.
  for (const t of d.pipe) if (!S.pipe[t]) { const pc = pipeCost(t); for (const g in pc) cost[g] = (cost[g] || 0) + pc[g]; }
  for (const t of d.pipeDel) if (S.pipe[t]) { const pc = pipeCost(t); for (const g in pc) back[g] = (back[g] || 0) + pc[g]; }
  const net = {};
  for (const g in cost) net[g] = Math.max(0, cost[g] - (back[g] || 0));
  // Anything you can't pay for yet waits for the goods (settlePlans): the plan can always be built.
  for (const g in net) net[g] = Math.round(net[g] * 100) / 100;
  return { add, cross, clear, del: d.del.size, ramps: d.ramps.size, walls, gates, rail: d.rail.size, railDel: d.railDel.size, pipe: d.pipe.size, pipeDel: d.pipeDel.size, cost, back, net, can: true,
    short: Object.keys(net).filter((g) => net[g] > 0 && !canAffordRoad(0, { [g]: net[g] })) };
}

/** Build the plan: take up the marked roads (their goods come back first), then plan the new tiles for workers to pave. */
function commitDraft() {
  if (draftEmpty()) return;
  const d = UI.draft;
  let removed = 0, laid = 0, ramps = 0, walls = 0, gates = 0, why = '', wallWhy = '';
  for (const t of d.del) if (S.road[t] || S.plan[t] === 1) { removeRoad(0, t % S.W, (t / S.W) | 0); removed++; }
  let rails = 0, railsUp = 0, railWhy = '';
  for (const t of d.railDel) if (S.rail[t] || S.railPlan[t] === 1) { takeUpRail(0, t); railsUp++; }
  // Ramps first, so the road or track planned over one waits for it. Like everything else in Paths
  // they're paid straight from storage (the cliff rarely has a road to it yet for haulers), and
  // they don't count against the construction-site limit.
  let rampWhy = '';
  for (const t of d.ramps) {
    const r = placeSite(0, 'ramp', t % S.W, (t / S.W) | 0, null, true);
    if (r.ok) ramps++; else if (!rampWhy) rampWhy = r.reason;
  }
  for (const [t, kind] of d.walls) {
    const r = placeSite(0, kind, t % S.W, (t / S.W) | 0);
    if (r.ok) { if (kind === 'gate') gates++; else walls++; } else if (!wallWhy) wallWhy = r.reason;
  }
  for (const t of d.add) {
    if (S.road[t] || S.plan[t] || d.ramps.has(t)) continue; // (a planned Ramp is the road there)
    why = buildRoad(0, t % S.W, (t / S.W) | 0, true);
    if (why) break;
    laid++;
  }
  for (const t of d.rail) { const w = queueRail(0, t); if (w) { railWhy = railWhy || w; } else rails++; }
  let pipes = 0, pipesUp = 0;
  for (const t of d.pipeDel) if (S.pipe[t] === 1 || S.pipePlan[t] === 1) { takeUpPipe(0, t); pipesUp++; }
  for (const t of d.pipe) if (!queuePipe(0, t)) pipes++;
  // Pay for what we can now, oldest plans first; the rest waits for the goods.
  settlePlans();
  const wp = plansWaiting(0), owedN = wp.tiles + wp.track + wp.pipes + wp.sites;
  draftReset();
  // Built: Paths closes, straight back to the map (unless something went wrong, to fix it).
  if (!why) setMode('normal');
  const wallText = walls || gates ? ` ${[walls ? `${walls} Wall${walls === 1 ? '' : 's'}` : '', gates ? `${gates} Gate${gates === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')} planned: free workers will build ${walls + gates === 1 ? 'it' : 'them'}.` : '';
  if (why) { sfx('error'); toast(`Planned ${laid} tile${laid === 1 ? '' : 's'} before running short: ${why}`, 'warn'); }
  else { sfx('place'); toast((laid ? `Planned ${laid} road tile${laid === 1 ? '' : 's'}: free workers will pave them.` : '') + (ramps ? ` ${ramps} Ramp site${ramps === 1 ? '' : 's'} started.` : '') + wallText + (removed ? ` Took up ${removed} tile${removed === 1 ? '' : 's'}.` : ''), 'info'); }
  if (wallWhy) toast(`Some of the wall couldn't go up: ${wallWhy}`, 'warn');
  if (rampWhy) toast(`A Ramp couldn't be planned: ${rampWhy} The road or track there won't climb the cliff until one is.`, 'warn');
  if (rails || railsUp) toast(`${rails ? `Planned ${rails} tile${rails === 1 ? '' : 's'} of track.` : ''}${railsUp ? ` Took up ${railsUp} tile${railsUp === 1 ? '' : 's'} of track.` : ''}`, 'info');
  if (pipes || pipesUp) toast(`${pipes ? `Laid ${pipes} tile${pipes === 1 ? '' : 's'} of pipe: Crude flows along it as soon as it's paid for.` : ''}${pipesUp ? ` Took up ${pipesUp} tile${pipesUp === 1 ? '' : 's'} of pipe.` : ''}`, 'info');
  if (owedN) toast(`Waiting for goods: ${costText(wp.owed)} more. It's paid from storage as the goods come in, oldest plans first, and built as it's paid for.`, 'info');
  if (railWhy) toast(`Some track couldn't go down: ${railWhy}`, 'warn');
  if (why) showRoadBanner();
}

/** Leaving Paths with a plan that was never built: it's dropped (nothing was spent). */
function dropDraft() {
  if (draftEmpty()) { if (UI.draft) UI.draft.strokes.length = 0; return; } // (arrows turned in Arrows stay turned: only their Undo goes)
  draftReset();
  toast('Road plan dropped: nothing was spent.', 'info');
}

/**
 * A road or track drag stepping from tile p to tile t up or down a cliff: plan a Ramp there, on
 * whichever side can take one (the side your bots can reach), preferring a tile with no road or
 * track on it yet so nothing is cut while it's built (paid straight from storage, like everything
 * planned in Paths). Returns 'ramp' (one is planned there), 'nope' (no room on either side), 'steep' (two
 * levels or more: no Ramp can climb it) or '' (no cliff between them).
 */
function dragCliff(stroke, p, t) {
  if (S.terrain[t] !== T_GROUND || S.terrain[p] !== T_GROUND) return '';
  const d = Math.abs(S.elev[t] - S.elev[p]);
  if (!d || canStep(p, t)) return '';
  if (d > 1) return 'steep';
  if (UI.draft.ramps.has(t) || UI.draft.ramps.has(p)) return 'ramp';
  const busy = (u) => (S.road[u] || S.plan[u] || (S.rail && S.rail[u]) ? 1 : 0);
  const ok = [t, p].filter((u) => canPlace(0, 'ramp', u % S.W, (u / S.W) | 0).ok).sort((a, b) => busy(a) - busy(b));
  if (!ok.length) return 'nope';
  draftOp(stroke, ok[0], 'ramp');
  return 'ramp';
}

/**
 * Dragging: in Roads and Bridges it sketches new road along the drag (round resources; water and
 * rock only with Bridges), planning a Ramp wherever it climbs a one-level cliff. In Arrows each
 * road tile points the way the finger moved, at once.
 */
function onRoadPaint(i, j, first) {
  if (R.mode !== 'road' || UI.roadMode === 'lights' || UI.roadMode === 'ramp') return;
  if (!UI.draft) draftReset();
  if (first) { UI.paintSkipped = false; UI.paintCross = false; UI.paintBridge = false; UI.paintTunnel = false; UI.paintCliff = false; UI.paintRamp = false; UI.paintSteep = false; UI.stroke = []; UI.dirShown = 0; UI.draft.strokes.push(UI.stroke); }
  const from = first || !UI.lastPaint ? { i, j } : UI.lastPaint;
  const line = tileLine(from.i, from.j, i, j);
  let prev = null;
  const arrows = UI.roadMode === 'arrows', pave = UI.roadMode === 'pave', wall = UI.roadMode === 'wall', rail = UI.roadMode === 'rail';
  if (UI.roadMode === 'pipe') { pipeDrag(i, j, first); return; }
  // Pave: the first road tile of a drag decides whether it marks roads or clears their marks.
  if (pave && first) UI.paveOn = !(inMap(i, j) && S.paveMark[tIdx(i, j)]);
  for (const [x, y] of line) {
    if (!inMap(x, y)) break;
    const t = tIdx(x, y);
    if (pave) { if (paveMarkable(t)) setPaveMark(0, x, y, UI.paveOn); continue; }
    if (rail) {
      // Climbing a one-level cliff with no Ramp: plan one for the track (see dragCliff).
      if (prev) {
        const c = dragCliff(UI.stroke, tIdx(prev[0], prev[1]), t);
        if (c === 'ramp') UI.paintRamp = true; else if (c === 'nope') UI.paintCliff = true; else if (c === 'steep') UI.paintSteep = true;
      }
      prev = [x, y];
      if (S.rail[t] || UI.draft.rail.has(t)) continue;
      const st = S.bAt[t] && getE(S.bAt[t]);
      if (st && st.owner === 0 && BDEFS[st.type].station) continue; // a drag from (or to) a station: the track starts (or ends) beside it
      if (!railBlocked(0, t)) {
        draftOp(UI.stroke, t, 'rail');
        // Over water the track is a rail bridge, through rock a rail tunnel: dearer, so the banner says so.
        if (crossTile(t)) { if (bridgeable(t)) UI.paintBridge = true; else UI.paintTunnel = true; }
      } else UI.paintSkipped = true;
      continue;
    }
    if (wall) {
      if (UI.draft.walls.has(t)) continue;
      const kind = wallKind(t);
      if (wallFits(t, kind)) draftWall(UI.stroke, t, kind); else if (!S.bAt[t]) UI.paintSkipped = true;
      continue;
    }
    if (arrows) {
      if (S.road[t] && prev) {
        const v = 2 + [[1, 0], [0, 1], [-1, 0], [0, -1]].findIndex(([dx, dy]) => dx === x - prev[0] && dy === y - prev[1]);
        // (Arrows turn at once, but each one is remembered in this drag's stroke, so Undo puts them back.)
        const turn = (u) => { if (S.road[u] && S.road[u] !== v && roadOwnedBy(0, u)) { UI.stroke.push({ t: u, op: 'dir', from: S.road[u] }); setRoadDir(u % S.W, (u / S.W) | 0, v); } };
        if (v >= 2 && roadOwnedBy(0, t)) { turn(tIdx(prev[0], prev[1])); turn(t); }
      }
      prev = [x, y];
      continue;
    }
    // Climbing a one-level cliff: plan a Ramp there (see dragCliff). The Ramp is a road when it's
    // done, so no road is laid on its own tile.
    const pt = prev ? tIdx(prev[0], prev[1]) : -1;
    prev = [x, y];
    if (pt >= 0) {
      const c = dragCliff(UI.stroke, pt, t);
      if (c === 'ramp') {
        UI.paintRamp = true;
        if (UI.draft.ramps.has(pt)) draftOp(UI.stroke, pt, 'unadd');
        if (UI.draft.ramps.has(t)) continue;
      } else if (c === 'nope') UI.paintCliff = true;
      else if (c === 'steep') UI.paintSteep = true;
    }
    if (S.road[t] || S.plan[t] || roadLike(t) || UI.draft.ramps.has(t)) continue;
    // Dragging never bulldozes resources by accident: tap a resource tile to clear it for a road.
    if (S.res[t]) { UI.paintSkipped = true; continue; }
    // A road dragged out over water (or a canyon) carries on as a bridge, and through rock as a tunnel.
    if (canRoad(0, x, y) || draftBridge(t)) {
      draftOp(UI.stroke, t, 'add');
      if (crossTile(t) && UI.roadMode !== 'bridge') { if (bridgeable(t)) UI.paintBridge = true; else UI.paintTunnel = true; }
    } else if (crossTile(t)) UI.paintCross = true;
  }
  UI.lastPaint = { i, j };
  if (pave) { showRoadBanner(); return; }
  if (wall) { showRoadBanner(UI.paintSkipped ? 'The wall skips tiles it can\'t go on (outside your border, resources, cliffs, or right beside your Command Base).' : '', true); return; }
  const what = rail ? 'Track' : 'A road';
  const cliffNote = UI.paintSteep ? `${what} can't climb a cliff two levels high, and no Ramp can: go round it to a one-level step (or bridge the valley with a Viaduct).`
    : UI.paintCliff ? `${what} climbs a level only over a <b>Ramp</b>, and there's no room for one where you crossed this cliff (resources, a building, or it would block the only way through): try a tile or two along it.`
      : '';
  if (rail) {
    const crossNote = [UI.paintBridge ? `Over the water it's a <b>rail bridge</b> (${costText(RAIL_BRIDGE_COST)} a tile).` : '', UI.paintTunnel ? `Through the rock it's a <b>rail tunnel</b> (${costText(RAIL_TUNNEL_COST)} a tile).` : ''].filter(Boolean).join(' ');
    showRoadBanner(cliffNote || [UI.paintRamp ? 'A <b>Ramp</b> is planned where the track climbs the cliff: workers build it, paid from storage, and the track on it goes down when it\'s done.' : '', crossNote,
      UI.paintSkipped ? 'Track skips tiles it can\'t go on: outside your border, resources or buildings.' : ''].filter(Boolean).join(' '), true);
    return;
  }
  if (arrows) {
    // Say what the drag has done once it has turned something (and each time it turns more), with Undo beside it.
    const n = new Set(UI.stroke.map((o) => o.t)).size;
    if (n && n !== UI.dirShown) showRoadBanner(`${n} road tile${n === 1 ? '' : 's'} made one-way: <b>Undo</b> puts ${n === 1 ? 'it' : 'them'} back.`, true);
    UI.dirShown = n;
  } else {
    showRoadBanner(cliffNote || (UI.paintRamp ? 'A <b>Ramp</b> is planned where the road climbs the cliff: workers cut it, paid from storage, and it carries the road up when it\'s done.'
      : UI.paintBridge || UI.paintTunnel ? [UI.paintBridge ? `The road crosses the water as a <b>bridge</b>: ${costText(CROSS[T_WATER].cost)} a tile, built out from the shore${navalMap() ? ' (more a tile out past ' + BRIDGE_NEAR + ' tiles from shore: a Port and ships are the way across wide water)' : ''}.` : '',
        UI.paintTunnel ? `The road goes through the rock as a <b>tunnel</b>: ${costText(CROSS[T_ROCK].cost)} a tile, dug in from the rock face.` : ''].filter(Boolean).join(' ')
      : UI.paintCross ? 'A road stops at your border: only a bridge can reach out past it, over water.'
        : UI.paintSkipped ? 'Dragging goes round resources: tap a boulder, grove, ore or crystal tile to clear it for a road.' : ''), true);
  }
}

/**
 * Pipes: a drag runs pipe from where it started to where the finger is now, finding its own way
 * (over roads and track, round buildings and water, inside your border): the route redraws as you move.
 * Starting or ending on a building runs the pipe up beside it.
 */
function pipeDrag(i, j, first) {
  const d = UI.draft;
  if (first) { UI.pipeFrom = inMap(i, j) ? tIdx(i, j) : -1; UI.pipeWhy = ''; } // (onRoadPaint started this drag's stroke)
  if (UI.pipeFrom < 0 || !inMap(i, j)) return;
  // Take back this drag's route so far, then find it again to the new end.
  for (let k = UI.stroke.length - 1; k >= 0; k--) draftOp([], UI.stroke[k].t, 'unpipe');
  UI.stroke.length = 0;
  const a = UI.pipeFrom, b = tIdx(i, j);
  let route = a === b ? (pipeBlocked(0, a) ? null : [a]) : pipeRoute(0, a, (t) => t === b, 400);
  UI.pipeWhy = route ? '' : pipeBlocked(0, b) || pipeBlocked(0, a) || 'No way to run pipe there: round buildings and water, on your own land or no-one\'s.';
  if (route && route.length > 1) {
    // Up to the buildings at either end, not under them.
    if (S.bAt[route[0]]) route = route.slice(1);
    if (route.length > 1 && S.bAt[route[route.length - 1]]) route = route.slice(0, -1);
  }
  if (route) for (const t of route) if (!S.pipe[t] && !d.pipe.has(t)) draftOp(UI.stroke, t, 'pipe');
  UI.lastPaint = { i, j };
  // Crossing water or rock: say so, with what it costs.
  const wet = UI.stroke.some((s) => bridgeable(s.t) && !S.road[s.t]), rock = UI.stroke.some((s) => S.terrain[s.t] === T_ROCK && !S.road[s.t] && !(S.rail && S.rail[s.t]));
  const cross = wet || rock ? `The pipe ${[wet ? 'crosses the water on stilts' : '', rock ? 'is bored through the rock' : ''].filter(Boolean).join(' and ')}: ${costText(PIPE_CROSS_COST)} a tile there.` : '';
  showRoadBanner(UI.pipeWhy || cross, !UI.pipeWhy);
}

/** Every Oil Pump of yours that isn't piped to a Refinery yet gets a pipe to the nearest one, in the plan. */
function pipeAllPumps() {
  if (!UI.draft) draftReset();
  const stroke = [];
  let n = 0, why = '';
  for (const b of S.buildings) {
    if (b.dead || b.owner !== 0 || !BDEFS[b.type].pump) continue;
    const r = pipeToRefinery(0, b);
    if (r.why) { if (!/already/.test(r.why)) why = r.why; continue; }
    for (const t of r.tiles) if (!UI.draft.pipe.has(t)) draftOp(stroke, t, 'pipe');
    n++;
  }
  UI.draft.strokes.push(stroke);
  sfx(n ? 'click' : 'error');
  showRoadBanner(n ? `Pipe planned for ${n} Oil Pump${n === 1 ? '' : 's'}: tap Build to lay it.` : why || 'Every Oil Pump is piped already.', !!n || !why);
}

/**
 * The Paths banner: at the top of the screen on a tablet or a computer, docked across the bottom in place of the
 * tools on an upright phone (style.css), so it never covers where you're drawing. Roads and Bridges show the plan
 * and what it costs, with Undo, Clear and Build.
 */
function showRoadBanner(problem, info) {
  const mode = ['arrows', 'lights', 'bridge', 'ramp', 'pave', 'wall', 'rail', 'pipe'].includes(UI.roadMode) ? UI.roadMode : 'road';
  if (!UI.draft) draftReset();
  const have = playerGoods(0);
  let line, how;
  const pipeHow = `Pipelines carry Crude, nothing else. Every second each line moves up to ${PIPE_RATE} Crude from its Oil Pumps to the Refineries (and Asphalt Plants) on it, then into any storage on it; storage on a line feeds its Refineries too. A pump on a pipeline never waits for a Tanker. Pipe goes anywhere inside your border: over roads and track, under buildings, up cliffs, across water on stilts and bored through rock (those tiles cost more, so a drag goes round a small pond); a pipe joins every building it runs beside or under. Raiders and missiles can break it: broken pipe is relaid as soon as it's paid for again.`;
  if (mode === 'pipe' && !UI.draft.pipe.size && !UI.draft.pipeDel.size) {
    let unpiped = 0;
    const joined = refineryPipes(0);
    for (const b of S.buildings) if (!b.dead && b.owner === 0 && BDEFS[b.type].pump && !buildingPipes(b).some((c) => joined.has(c))) unpiped++;
    line = `<b>Drag from an Oil Pump to a Refinery</b> and the pipe finds its own way there, over roads and track, across water and through rock (${costText(PIPE_COST)} a tile, ${costText(PIPE_CROSS_COST)} across water or rock; laid when you tap Build). Or tap a pump to pipe it to the nearest Refinery. Tap pipe to take it up.` +
      (unpiped ? ` <button class="btn" id="pipe-all">Pipe every Oil Pump (${unpiped})</button>` : '');
    how = pipeHow;
  } else if (mode === 'rail' && !UI.draft.rail.size && !UI.draft.railDel.size) {
    line = `<b>Lay railway track</b> by dragging (${costText(RAIL_COST)} a tile, laid when you tap Build if you have the goods, otherwise as they come in). Tap a tile to add or drop it, or tap track to take it up. Put a <b>Rail Station</b> (Build menu) at each end, before or after (drag from one station to the other and the track ends beside each), and order a <b>Freight Train</b> at a station's rail yard (tap the station).`;
    how = 'Freight Trains carry 56 goods between Rail Stations on the same track, fast and with no traffic to wait for, and never need charging. They keep a station\'s supply orders filled from the other stations on the line, and a far station sends its spare goods home to the station nearest your Command Base. Track goes on open ground you hold or no-one does. It climbs a level at a time over a Ramp (a natural slope, or one you build in Paths), like a road, with trains slowing on the grade; over water it\'s a rail bridge, through rock a rail tunnel (a drag carries straight on into both), and across a valley it runs over a Viaduct. It can cross a road: road traffic waits at the crossing while a train goes by.';
  } else if (mode === 'wall' && !UI.draft.walls.size) {
    line = `<b>Sketch a wall</b> by dragging (${costText(BDEFS.wall.cost)} a tile); where it crosses a road or track a <b>Gate</b> goes (${costText(BDEFS.gate.cost)}). Tap a planned Wall to make it a Gate, again to drop it. Nothing is spent until you tap <b>Build</b>.`;
    how = `Walls stop every bot. Enemy warbots go round if there is a short way, or stand and shoot their way through: a Wall takes ${BDEFS.wall.armor} hits (a Gate ${BDEFS.gate.armor}, a Missile does ${BDEFS.silo.missile.damage}), and every shot costs them Ammo, so turrets behind a wall pick them off while they work. ` +
      'Your own bots drive through your Gates, so leave one wherever your roads or workers need to cross. Walls are paid straight from storage (no Hauler or road needed): what you have goes in when you tap Build, the rest as it comes in, and free workers build them. Repair a damaged Wall from its panel.';
  } else if (mode === 'ramp' && draftEmpty()) {
    line = `Tap a highlighted spot at the top or foot of a one-level cliff to plan a <b>Ramp</b> (${costText(BDEFS.ramp.cost)}). To get down from high ground, plan it on the cliff top. You rarely need this tool: dragging a road or track up a cliff plans one for you. Nothing is spent until you tap <b>Build</b>.`;
    how = 'Workers cut a sloped road into the cliff; once it is done it is part of your road network, so haulers drive straight up it, and track can run over it. Ramps are paid straight from storage (as the goods come in) and don\'t count against the construction-site limit. A Ramp can\'t go on resources or a building, or where it would block the only way through a pass, and no Ramp can climb a cliff two levels high.';
  } else if (mode === 'pave') {
    const c = paveCounts(0);
    let works = 0;
    for (const b of S.buildings) if (!b.dead && b.owner === 0 && b.type === 'roadworks') works++;
    line = `Drag along roads to mark them for <b>asphalt</b>; drag over marked road to clear it. Marked: <b>${c.marked}</b> tile${c.marked === 1 ? '' : 's'}` +
      (c.marked ? ` (${c.fresh} asphalt, ${c.worn} worn, ${c.todo} to pave)` : '') + '.' +
      (works ? '' : ' <span class="err">Build a Roadworks to pave them.</span>');
    how = `Asphalt is the fastest surface (${PAVE[2].speed}× speed, and Freight Trucks need it to run flat out). A Roadworks' Paver lays it on the marked roads joined to it, nearest first, using 1 Asphalt for every ${ASPHALT_TILES} tiles. ` +
      'Asphalt <b>wears</b> as traffic drives over it, heavy Freight Trucks three times as fast: worn asphalt fades, cracks and slows bots a little, and worn right through it drops back to plain road. ' +
      'The Paver resurfaces marked roads once they are half worn, so a Roadworks near your busiest roads keeps them fast. Red outlines show worn asphalt. ' +
      `Marking is free; you have ${works} Roadworks.`;
  } else if (mode === 'arrows') {
    line = 'Drag along a road to make it <b>one-way</b> the way you drag (a drag that starts off your roads moves the map). Tap a road to turn its arrow. <b>Undo</b> puts arrows back.';
    how = 'One-way traffic never meets head-on, so a loop of one-way roads (one lane out, one back) keeps busy routes flowing.';
  } else if (mode === 'lights') {
    let lights = 0, junctions = 0, overs = 0;
    for (const k in S.lights) if (S.lights[k].owner === 0) lights++;
    for (const k in S.over) if (S.over[k].owner === 0) overs++;
    const net = roadNet();
    for (let t = 0; t < S.W * S.H; t++) if (net.junc[t] && wayOwner(t) === 0) junctions++;
    line = `Tap a <b>junction</b> for a traffic light (${costText(LIGHT_COST)}), tap the light for an <b>overpass</b> (${costText(OVERPASS_COST)}), tap again to clear it.`;
    const jp = plansWaiting(0).junctions;
    how = `A light lets one direction through at a time: it pays where two busy roads cross (50 to 85% more goods through), and costs a little on a quiet crossing. On an overpass nobody stops: best everywhere, and more than twice as much on a jammed crossing. Short of Alloy? Tap anyway: the light or overpass is planned (a dashed orange marker) and goes up once it's paid for from storage, oldest plans first${jp ? ` (<b>${jp}</b> waiting now)` : ''}. You have ${lights} light${lights === 1 ? '' : 's'}, ${overs} overpass${overs === 1 ? '' : 'es'} and ${junctions} junction${junctions === 1 ? '' : 's'}.`;
  } else {
    const sm = draftSummary();
    if (draftEmpty()) {
      line = mode === 'bridge'
        ? `<b>Sketch</b> a road across water (bridge, ${costText(CROSS[T_WATER].cost)} a tile${navalMap() ? ' near the shore, more further out' : ''}) or through rock (tunnel, ${costText(CROSS[T_ROCK].cost)}). Nothing is spent until you tap <b>Build</b>.`
        : `<b>Sketch</b> a road ${onTouch() ? 'with one finger (<b>two fingers move the map</b>)' : 'by dragging'}, or tap where it should go. Tap a road to take it up. Nothing is spent until <b>Build</b>.`;
    } else {
      const parts = [];
      if (sm.add) parts.push(`<b>${sm.add}</b> new tile${sm.add === 1 ? '' : 's'}` + (sm.cross ? ` (${sm.cross} bridge or tunnel)` : '') + (sm.clear ? ` (${sm.clear} through resources)` : ''));
      if (sm.del) parts.push(`<b>${sm.del}</b> to take up`);
      if (sm.ramps) parts.push(`<b>${sm.ramps}</b> Ramp${sm.ramps === 1 ? '' : 's'}`);
      if (sm.walls) parts.push(`<b>${sm.walls}</b> Wall${sm.walls === 1 ? '' : 's'}`);
      if (sm.gates) parts.push(`<b>${sm.gates}</b> Gate${sm.gates === 1 ? '' : 's'}`);
      if (sm.rail) parts.push(`<b>${sm.rail}</b> tile${sm.rail === 1 ? '' : 's'} of track`);
      if (sm.railDel) parts.push(`<b>${sm.railDel}</b> of track to take up`);
      if (sm.pipe) parts.push(`<b>${sm.pipe}</b> tile${sm.pipe === 1 ? '' : 's'} of pipe`);
      if (sm.pipeDel) parts.push(`<b>${sm.pipeDel}</b> of pipe to take up`);
      const cost = Object.keys(sm.net).length && Object.values(sm.net).some((v) => v > 0) ? `costs <b>${costText(sm.net)}</b>` : 'costs nothing';
      line = `Plan: ${parts.join(', ')}; ${cost}` + (!sm.short.length ? '.' : `. <span class="ok">Short of ${sm.short.map((g) => GOOD[g].name).join(' and ')} for now: what you can't pay for waits and is paid from storage as the goods come in, oldest plans first.</span>`);
    }
    const waiting = planList(0).length, wp = plansWaiting(0), owedN = wp.tiles + wp.track + wp.pipes + wp.sites;
    const owedText = owedN ? ` <b>Waiting for goods now:</b> ${[wp.tiles ? `${wp.tiles} road tile${wp.tiles === 1 ? '' : 's'}` : '', wp.track ? `${wp.track} of track` : '', wp.pipes ? `${wp.pipes} of pipe` : '', wp.sites ? `${wp.sites} site${wp.sites === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ')} (${costText(wp.owed)} to go).` : '';
    if (mode === 'pipe') how = pipeHow + owedText;
    else if (mode === 'wall') how = 'Walls and Gates are paid straight from storage, no Hauler needed: what you have now goes in when you tap Build, the rest as the goods come in (oldest plans first), and free workers put each piece up as far as its goods go. Enemy warbots have to go round or shoot through; your bots pass your Gates.' + owedText;
    else if (mode === 'rail') how = 'Track you can pay for goes down when you tap Build; the rest goes down as the goods come in (oldest plans first). Where the track climbs a one-level cliff, a Ramp is planned for it (paid from storage, no road needed) and the track on it goes down once workers finish the Ramp. Rail Stations stand beside the track (build them first if you like, and drag from one to the other); Freight Trains run between stations on the same stretch of track.' + owedText;
    else how = `<b>Haulers only drive on roads</b>, so every building needs a road to storage. A tap away from your roads and the plan runs the road there by the cheapest way (round resources and cliffs; <b>Undo</b> takes that leg back), a tap beside them adds one tile, and a tap on a planned tile drops it. Sketch up to the edge of the map and it scrolls${onTouch() ? '; two fingers move it and zoom' : ''}. 1 Cement paves ${Math.round(1 / roadCost().cement)} tiles (${ROAD_CLEAR}× through resources); you have ${esc(have.cement || 0)} Cement` +
      (mode === 'bridge' ? ` and ${esc(have.alloy || 0)} Alloy. Workers build bridges and tunnels out from the shore or rock face, and they join land on any level.` : `. Drag a road out over water and it carries on as a bridge (${costText(CROSS[T_WATER].cost)} a tile), and through rock as a tunnel (${costText(CROSS[T_ROCK].cost)}).`) +
      ` After you tap Build, free workers pave the road a tile at a time${waiting ? ` (<b>${waiting}</b> tile${waiting === 1 ? '' : 's'} waiting now)` : ''}. Short of Cement or Alloy? Plan it anyway: tiles you can't pay for yet wait (an orange outline) and are paid from storage as the goods come in, oldest plans first.` + owedText;
  }
  // (The line is cut to three lines where the banner is docked across the bottom of a phone: what went wrong, or
  // what a tap just did, leads. How it works opens over the map there, and stays open while you read it.)
  const text = `<span class="rb-line">${problem ? `<span class="${info ? 'ok' : 'err'}">${problem}</span> ` : ''}${line}</span>` +
    `<details class="how"${UI.howOpen === mode ? ' open' : ''}><summary>How it works</summary><div class="how-text">${how}</div></details>`;
  showBanner(text, null, 'Done');
  const det = $('banner-text').querySelector('details.how');
  det.ontoggle = () => { UI.howOpen = det.open ? mode : null; };
  if (UI.howOpen !== mode) UI.howOpen = null;
  $('banner-seg').hidden = false;
  for (const btn of $('banner-seg').children) {
    btn.classList.toggle('on', btn.dataset.v === mode);
    if (btn.dataset.v === 'wall') btn.hidden = !warOn();
    btn.onclick = () => { UI.roadMode = btn.dataset.v; sfx('click'); showRoadBanner(); };
  }
  // Undo, Clear and Build for a plan.
  const drafting = !draftEmpty(), turned = UI.draft.strokes.some((st) => st.some((o) => o.op === 'dir'));
  $('banner').classList.toggle('noplan', !drafting); // (a phone gives the plan's buttons a row only when there's a plan: Undo alone, for arrows, fits the tools' row)
  $('banner-undo').hidden = !drafting && !turned;
  $('banner-clear').hidden = !drafting;
  $('banner-ok').hidden = !drafting;
  // The tools are one row to swipe along on a phone: the one in use is brought into view when it changes (and
  // when Undo joins the row, which narrows it).
  const seg = mode + (drafting ? '' : turned ? '+' : '');
  if (UI.segShown !== seg) { UI.segShown = seg; const on = $('banner-seg').querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  $('banner-undo').onclick = () => { draftUndo(); sfx('click'); showRoadBanner(); };
  if (drafting) {
    const sm = draftSummary();
    const wl = sm.walls + sm.gates;
    $('banner-ok').textContent = sm.add ? `Build ${sm.add} tile${sm.add === 1 ? '' : 's'}` + (sm.ramps ? ` + ${sm.ramps} Ramp${sm.ramps === 1 ? '' : 's'}` : '') + (wl ? ` + ${wl} wall` : '')
      : sm.ramps ? `Build ${sm.ramps} Ramp${sm.ramps === 1 ? '' : 's'}` + (wl ? ` + ${wl} wall` : '')
      : wl ? `Build ${sm.walls ? `${sm.walls} Wall${sm.walls === 1 ? '' : 's'}` : ''}${sm.walls && sm.gates ? ' + ' : ''}${sm.gates ? `${sm.gates} Gate${sm.gates === 1 ? '' : 's'}` : ''}`
      : sm.rail ? `Build ${sm.rail} track tile${sm.rail === 1 ? '' : 's'}` : sm.pipe ? `Lay ${sm.pipe} pipe tile${sm.pipe === 1 ? '' : 's'}` : 'Take up';
    $('banner-ok').disabled = !sm.can;
    $('banner-clear').onclick = () => { draftReset(); sfx('click'); showRoadBanner(); };
  }
  if ($('pipe-all')) $('pipe-all').onclick = (e) => { e.stopPropagation(); pipeAllPumps(); };
  const tb = $('banner-traffic');
  tb.hidden = false;
  tb.classList.toggle('on', !!R.traffic);
  tb.onclick = () => { R.traffic = !R.traffic; sfx('click'); showRoadBanner(); };
  if (R.traffic) $('banner-text').innerHTML += ` <span class="traffic-key">${trafficSummary()}</span>`;
}

/** Traffic map legend plus how busy the haulers and trucks are. */
function trafficSummary() {
  const n = { hauler: [0, 0], truck: [0, 0], tanker: [0, 0] };
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0 || !n[u.type]) continue;
    n[u.type][0]++;
    if (u.task && u.task.type === 'haul') n[u.type][1]++;
  }
  let jams = 0;
  if (HEAT.jam) for (let t = 0; t < S.W * S.H; t++) if (HEAT.jam[t] > TRAFFIC_JAM && wayOwner(t) === 0) jams++;
  return `<b>Traffic map:</b> <i class="tk q"></i>quiet <i class="tk b"></i>busy <i class="tk p"></i>packed; pulsing rings mark jams (${jams} now). `
    + `Haulers ${n.hauler[1]} of ${n.hauler[0]} busy` + (n.truck[0] ? `, Freight Trucks ${n.truck[1]} of ${n.truck[0]}` : '') + (n.tanker[0] ? `, Tankers ${n.tanker[1]} of ${n.tanker[0]}` : '') + '.';
}

/* ------------------------------------------------------------------ sheets */

function openSheet(kind, id, html) {
  // (Built again for the same thing, a panel keeps its height and its place; a new one starts from the top.)
  const fresh = $('sheet').hidden || UI.sheetKind !== kind || UI.sheetFor !== id;
  UI.sheetKind = kind;
  UI.sheetFor = id;
  UI.demolishArm = 0;
  $('sheet-body').innerHTML = html;
  $('sheet').hidden = false;
  document.body.classList.add('sheet-open');
  document.body.classList.toggle('sheet-build', kind === 'build'); // (the Build list is wider on a very wide screen)
  $('banner').hidden = true;
  markSheetKeys();
  if (fresh) { $('sheet-body').scrollTop = 0; setSheetSize(SHEET_TALL[kind] ? 'full' : 'half'); }
}

/*
 * Panel heights where the panel is a sheet across the bottom (phones, upright tablets): half the screen, so the
 * map and what the panel is about stay in view above it; full; or just its title strip. The grab handle at the
 * top is dragged between them (further down closes the panel) or tapped to switch between half and full.
 */
const SHEET_TALL = { build: 1, goods: 1, pop: 1, msgs: 1 }; // lists and charts open at full height: nothing on the map to watch

function setSheetSize(size) {
  const s = $('sheet');
  UI.sheetSize = size;
  s.classList.toggle('full', size === 'full');
  s.classList.toggle('peek', size === 'peek');
  s.style.maxHeight = '';
  sheetMoved();
}

/** Where on the map the open panel's subject is (a building, a robot, a rally flag, a tile); null for a list. */
function sheetSpot() {
  const k = UI.sheetKind, id = UI.sheetFor;
  if (k === 'bld') { const b = getE(id); return b ? { x: b.x + 0.5, y: b.y + 0.5 } : null; }
  if (k === 'bot') { const u = getE(id); return u ? { x: u.x, y: u.y } : null; }
  if (k === 'rally') { const r = rallyById(id); return r ? { x: r.x, y: r.y } : null; }
  if (k === 'move' || k === 'res' || k === 'road' || k === 'soil' || k === 'post') return { x: (id % S.W) + 0.5, y: ((id / S.W) | 0) + 0.5 };
  return null;
}

/**
 * The bottom panel has opened, closed or changed height. The map may scroll up past its last row by as much
 * as the panel covers (R.lift, see clampCam), and what the panel is about is brought into view in the band
 * between the top bar and the panel, if it's hidden: a building tapped low on the screen isn't left under
 * its own panel. Nothing moves if it's in view already, or at full height. On a phone held on its side the panel
 * is a column down the right, and the subject is brought out from under it the same way; on a wide screen
 * (a computer) the panel takes a small part of the width and the map is left where it is.
 */
function sheetMoved() {
  const s = $('sheet'), open = !s.hidden, bottom = open && $('sheet-grab').getClientRects().length > 0, side = open && !bottom && !isWide();
  R.lift = bottom ? s.offsetHeight / R.h : 0;
  UI.glide = null;
  if (!(bottom || side) || (bottom && UI.sheetSize === 'full') || !S) return;
  const at = sheetSpot();
  if (!at) return;
  // The band it should sit in. Across the bottom: under the top bar, above the panel and its handle (under the
  // minimap too where that leaves room, else beside it). Down the side (a phone on its side): between the tools'
  // rail and the panel, under the top bar.
  const mm = $('minimap').hidden ? null : $('minimap').getBoundingClientRect();
  let top = $('topbar').getBoundingClientRect().bottom, bot = R.h, left = 0, right = R.w;
  if (side) { left = $('bottombar').getBoundingClientRect().right; right = s.getBoundingClientRect().left; }
  else {
    bot = R.h - s.offsetHeight - 22;
    if (mm && mm.bottom > top) { if (bot - mm.bottom >= 130) top = mm.bottom + 26; else right = mm.left; }
  }
  const p = worldToScreen(at.x, at.y), m = Math.max(4, Math.min(R.cam.z * 0.75, (bot - top) / 3, (right - left) / 3));
  const offX = p.x < left + m || p.x > right - m, offY = p.y < top + m || p.y > bot - m;
  if (!offX && !offY) return;
  UI.glide = { x: offX ? at.x - ((left + right) / 2 - R.w / 2) / R.cam.z : R.cam.x, y: offY ? at.y - ((top + bot) / 2 - R.h / 2) / R.cam.z : R.cam.y, t: 0.5 };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { centerOn(UI.glide.x, UI.glide.y); UI.glide = null; }
}

/**
 * The panel's grab handle: dragged, the panel follows the finger and settles at a height when it's let go;
 * tapped (or clicked, or pressed from the keyboard), half and full swap.
 */
function initSheetGrab() {
  const grab = $('sheet-grab'), s = $('sheet');
  let d = null, dragged = false;
  grab.addEventListener('pointerdown', (e) => { grab.setPointerCapture(e.pointerId); dragged = false; d = { y: e.clientY, h: s.offsetHeight }; });
  grab.addEventListener('pointermove', (e) => {
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!dragged && Math.abs(dy) < 8) return;
    dragged = true;
    s.style.maxHeight = clamp(d.h - dy, 24, R.h - document.querySelector('.toprow').getBoundingClientRect().bottom - 6) + 'px';
  });
  const end = (e) => {
    if (!d) return;
    const dy = e.clientY - d.y, h = d.h - dy, was = UI.sheetSize;
    d = null;
    if (!dragged) return; // a tap: the click that follows swaps half and full
    // Let go: down a stop (or two, from full to the title strip), up a stop (or two), or back where it was.
    if (e.type === 'pointercancel' || Math.abs(dy) <= 30) setSheetSize(was);
    else if (dy < 0) setSheetSize(was === 'peek' && h < R.h * 0.6 ? 'half' : 'full');
    else if (was === 'peek' || h < 44) closeSheet();
    else setSheetSize(was === 'full' && h > R.h * 0.3 ? 'half' : 'peek');
  };
  grab.addEventListener('pointerup', end);
  grab.addEventListener('pointercancel', end);
  grab.onclick = () => { if (dragged) { dragged = false; return; } sfx('click'); setSheetSize(UI.sheetSize === 'half' ? 'full' : 'half'); };
}

/** Is the open building panel out of date: the building gone, or in other hands than when the panel was built? */
function sheetStale() {
  if (UI.sheetKind !== 'bld') return false;
  const b = getE(UI.sheetFor);
  return !b || b.dead || (b.owner === 0) !== UI.sheetMine;
}

function closeSheet() {
  R.routePreview = null;
  R.lift = 0; UI.glide = null;
  $('sheet').hidden = true;
  document.body.classList.remove('sheet-open', 'sheet-build');
  UI.sheetKind = null;
  UI.sheetFor = 0;
  R.selected = 0;
  R.selTile = -1;
  UI.selBot = 0;
}

function costHTML(cost, have) {
  return Object.keys(cost).map((g) => `<span class="${have && have[g] < cost[g] ? 'short' : ''}"><i class="gi ${g}"></i>${Math.round(cost[g] * 100) / 100}</span>`).join('');
}

/** A cost written out in a sentence: each good's icon, amount and name ("15 Cement, 3 Alloy"), short ones in red. */
function costInline(cost, have) {
  return `<span class="cost-inline">${Object.keys(cost).map((g) => `<span class="${have && have[g] < cost[g] ? 'short' : ''}"><i class="gi ${g}"></i>${Math.round(cost[g] * 100) / 100} ${GOOD[g].name}</span>`).join(', ')}</span>`;
}

/**
 * The build menu: tabs across the top (the BUILD_GROUPS: Gather, Make, Move, Defend, then All), the
 * last one used remembered, each with its number key. Every card is in the page whichever tab is showing
 * (the others are just hidden); a letter picks a building on the tab that's showing (BUILD_KEYS).
 */
function openBuildMenu() {
  const have = playerGoods(0);
  const sites = siteCount(0);
  const list = BUILD_MENU.filter((t) => !(BDEFS[t].war && !warOn()) && !(BDEFS[t].nuke && !nukeOn()) && !(BDEFS[t].colony && (S.mode !== 'colony' || S.mission)) && !(BDEFS[t].naval && !navalMap()));
  const groupOf = (t) => (BUILD_GROUPS.find((g) => g.types.includes(t)) || BUILD_GROUPS[0]).key;
  const ordered = BUILD_GROUPS.flatMap((g) => g.types).filter((t) => list.includes(t));
  if (!UI.buildTab) { try { UI.buildTab = localStorage.getItem('botfall.buildTab') || 'all'; } catch (e) { UI.buildTab = 'all'; } }
  const groups = BUILD_GROUPS.filter((g) => ordered.some((t) => groupOf(t) === g.key));
  if (UI.buildTab !== 'all' && !groups.some((g) => g.key === UI.buildTab)) UI.buildTab = 'all';
  const tabs = `<div class="seg build-tabs" id="build-tabs">${groups.map((g) => `<button data-g="${g.key}"><kbd>${BUILD_TAB_KEYS[g.key]}</kbd>${g.name}<span class="n">${ordered.filter((t) => groupOf(t) === g.key).length}</span></button>`).join('')}<button data-g="all"><kbd>${BUILD_TAB_KEYS.all}</kbd>All</button></div>`;
  const kbd = (t) => { const k = buildKeyOf(t); return k ? `<kbd data-tab="${BUILD_TAB_KEYS[k.tab]}" data-key="${k.key.toUpperCase()}">${k.key.toUpperCase()}</kbd>` : ''; };
  const html = `<div class="sheet-title"><h3>Build</h3></div>
    <p class="desc">Placing a site is free; haulers bring the materials by road, so lay a road to it. <span id="build-sites">${sites}</span>/${MAX_SITES} sites in progress.</p>
    ${tabs}
    <div class="build-grid">${nextBuilds().filter((t) => list.includes(t)).map((t) => `<button class="bcard next" data-t="${t}" data-g="next" ${sites >= MAX_SITES ? 'disabled' : ''}>
      <img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div><div class="bcost">${costHTML(BDEFS[t].cost, have)}</div>
      <div class="bhave">${ownedText(t)}</div></button>`).join('')}<button class="bcard roads" id="build-roads" data-g="move"><kbd data-key="R">R</kbd><svg viewBox="0 0 24 24"><path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <div class="bname">Roads</div><div class="bhave">Plan roads, bridges and ramps</div></button>${warOn() ? `<button class="bcard walls" id="build-walls" data-g="defend"><kbd data-tab="${BUILD_TAB_KEYS.defend}" data-key="X">X</kbd><img src="${iconFor('wall')}" alt=""><div class="bname">Walls</div><div class="bcost">${costHTML(BDEFS.wall.cost, have)}</div>
      <div class="bhave">${wallCountText()}</div></button>` : ''}${ordered.map((t) => `<button class="bcard" data-t="${t}" data-g="${groupOf(t)}" ${sites >= MAX_SITES ? 'disabled' : ''}>
      ${kbd(t)}<img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div><div class="bcost">${costHTML(BDEFS[t].cost, have)}${t === 'viaduct' ? ' a tile' : ''}</div>
      <div class="bhave">${ownedText(t)}</div></button>`).join('')}</div>`;
  openSheet('build', 0, html);
  for (const el of $('sheet-body').querySelectorAll('.bcard[data-t]')) {
    el.onclick = () => { sfx('click'); enterPlaceMode(el.dataset.t); };
  }
  $('build-roads').onclick = () => openPaths('road');
  if ($('build-walls')) $('build-walls').onclick = () => openPaths('wall');
  const show = (g) => {
    UI.buildTab = g;
    try { localStorage.setItem('botfall.buildTab', g); } catch (e) { /* private mode: not remembered */ }
    for (const btn of $('build-tabs').children) btn.classList.toggle('on', btn.dataset.g === g);
    for (const el of $('sheet-body').querySelectorAll('.build-grid .bcard')) el.hidden = g !== 'all' && el.dataset.g !== g && el.dataset.g !== 'next';
    // On All, a card's key reads "2 K": its tab's number, then its letter.
    for (const el of $('sheet-body').querySelectorAll('.build-grid kbd[data-tab]')) el.textContent = g === 'all' ? `${el.dataset.tab} ${el.dataset.key}` : el.dataset.key;
  };
  for (const btn of $('build-tabs').children) btn.onclick = () => { sfx('click'); show(btn.dataset.g); };
  show(UI.buildTab);
}

/**
 * The Trade Terminal's contracts: each one's lot and what it pays today, with Take (or Stop) on it, and the
 * lot's progress. Rebuilt only when something shown changes, so its buttons stay pressable.
 */
function renderTrade(b) {
  const el = $('sh-trade');
  if (!el) return;
  const T = tradeState(0), have = spendable(0);
  const sig = JSON.stringify([T.round, T.pick, T.offers.map((o) => [o.left, tradePay(0, o, b)]), Object.keys(T.sat).map((g) => Math.round(T.sat[g] * 20))]);
  $('sh-trade-next').textContent = T.next > S.time ? `new ones in ${fmtTime(T.next - S.time)}` : '';
  const trainNear = S.bots.some((u) => !u.dead && u.owner === 0 && BOTS[u.type].train && botLinked(u, b));
  const railNear = S.bots.some((u) => !u.dead && u.owner === 0 && BOTS[u.type].rail) && S.buildings.some((s) => !s.dead && s.owner === 0 && s.built && BDEFS[s.type].station && !BDEFS[s.type].terminal && railLinked(s, b));
  const bonus = Math.round((terminalBonus(b) - 1) * 100);
  $('sh-trade-hint').innerHTML = (!trainNear && !railNear ? '<span class="err">No Road Train can reach it, and no Freight Train runs to it: order a Road Train at the Bot Foundry and lay a road here (or lay track beside it from a Rail Station).</span> ' : '') +
    `Only Road Trains and Freight Trains serve a Terminal: they bring a contract's lot (${TERMINAL.lot}) and take what it pays home. Rates are ${Math.round(TERMINAL.rate * 100)}% of what the goods are worth` +
    (bonus ? `, +${bonus}% for standing this far out` : `; one further than ${TERMINAL.minDist} tiles from your Command Base pays more`) + '. Each contract runs up to ' + TERMINAL.lots + ' times, and each lot of a good you sell pays a little less for a while.';
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  if (!T.offers.length) { el.innerHTML = '<p class="hint">Contracts arrive in a moment.</p>'; return; }
  el.innerHTML = T.offers.map((o, k) => {
    const on = T.pick === k, pay = tradePay(0, o, b), sat = T.sat[o.give] ?? 1;
    // Spelled out which way it goes: you send `lot` of one good and get `pay` of the other back.
    return `<div class="kv trade-row${on ? ' on' : ''}"><span>You give <b>${esc(o.lot)}</b> <i class="gi ${esc(o.give)}"></i>${GOOD[o.give].name} → you get <b>${esc(pay)}</b> <i class="gi ${esc(o.get)}"></i>${GOOD[o.get].name}` +
      `<small> ${o.left > 0 ? `${esc(o.left)} more time${o.left === 1 ? '' : 's'}` : 'filled'}${sat < 0.99 ? ` · ${GOOD[o.give].name} pays ${Math.round(sat * 100)}% for now (you sold a lot lately)` : ''} · you have ${Math.floor(have[o.give] || 0)} ${GOOD[o.give].name}</small></span>` +
      `<button class="btn small${on ? '' : ' primary'}" data-k="${k}" ${o.left > 0 ? '' : 'disabled'}>${o.left > 0 ? (on ? 'Stop' : 'Take') : 'Filled'}</button></div>`;
  }).join('');
  for (const btn of el.querySelectorAll('button[data-k]')) btn.onclick = () => {
    const k = +btn.dataset.k;
    pickContract(0, T.pick === k ? -1 : k);
    sfx('click');
    renderTrade(b);
    refreshSheet();
  };
}

/** A Port's shipyard or a Rail Station's rail yard: each kind it builds, how many are ordered, +1, +5 and Clear. */
function renderYard(b) {
  const el = $('sh-yard');
  if (!el) return;
  const kinds = BDEFS[b.type].yard.filter((k) => warOn() || !BOTS[k].war), now = nextYardKind(b);
  if (el.dataset.k !== kinds.join()) {
    el.dataset.k = kinds.join();
    el.innerHTML = kinds.map((k) => `<div class="order-row yard-row" data-k="${k}"><span>${BOTS[k].plural}<small id="sh-y-${k}"></small></span>
      <button class="btn" data-k="${k}" data-d="1">+1</button><button class="btn" data-k="${k}" data-d="5">+5</button><button class="btn ghost" data-k="${k}" data-d="0">Clear</button></div>`).join('');
    for (const btn of el.querySelectorAll('button')) btn.onclick = () => { orderAtYard(b, btn.dataset.k, +btn.dataset.d); sfx('click'); renderYard(b); };
  }
  for (const k of kinds) {
    const n = (b.yard && b.yard[k]) || 0, parts = (b.yardParts && b.yardParts[k]) || 0;
    $('sh-y-' + k).textContent = n ? `${n} ordered` + (parts ? ` · ${parts} of ${BOTS[k].parts} parts in` : '') : 'none ordered';
    el.querySelector(`.order-row[data-k="${k}"]`).classList.toggle('next', k === now);
  }
  $('sh-yard-status').textContent = b.yardStatus || (now ? '' : 'Nothing ordered');
  $('sh-yard-bar').hidden = !now;
  $('sh-yard-bar').firstElementChild.style.width = `${Math.round((b.yardFrac || 0) * 100)}%`;
}

/** "4 Walls, 1 Gate" for the build menu's Walls card. */
function wallCountText() {
  const w = ownedCount('wall'), g = ownedCount('gate');
  const nw = w.built + w.sites, ng = g.built + g.sites;
  if (!nw && !ng) return 'Walls and Gates';
  return [nw ? `${nw} Wall${nw === 1 ? '' : 's'}` : '', ng ? `${ng} Gate${ng === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ');
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
  let desc = !mine && b.type === 'lander' ? (S.players.length > 2 ? `The ${playerName(b.owner)}'s fortified headquarters. Capture it and everything the ${playerName(b.owner)} built is yours.` : 'The rival\'s fortified headquarters. Capture it to win.') : def.desc;
  const style = !mine && b.type === 'lander' && S.players[b.owner] && S.players[b.owner].ai && PERSONALITIES[S.players[b.owner].style];
  if (style && S.mode !== 'colony' && !S.mission) desc += ` <b>${style.name}:</b> it ${style.desc}.`;
  if (def.wild) {
    const n = S.bots.filter((u) => !u.dead && u.nest === b.id).length;
    desc += ` <b>Level ${esc(b.level || 1)} of 3</b>, ${n} creature${n === 1 ? '' : 's'} out and about. Hoarded: ${Object.keys(b.stock).filter((g) => b.stock[g] > 0).map((g) => `${esc(b.stock[g])} ${GOOD[g].name}`).join(', ') || 'nothing'}.`;
  }
  // With no road to storage yet, that warning and its Lay road button lead the panel: in view at half height.
  const roadFirst = mine && b.unlinked && needsRoad(b);
  let html = `<div class="sheet-title"><img src="${iconFor(b.type, b.owner)}" alt=""><div><h3>${def.name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[b.owner]}"></span> ${mine ? 'Yours' : playerName(b.owner)}</div></div></div>
    ${roadFirst ? '<div id="sh-road"></div>' : ''}<p class="desc">${desc}</p><div class="status" id="sh-status"></div><div id="sh-dyn"></div>${mine ? '<div id="sh-fix"></div>' : ''}`;
  if (mine) {
    if (def.airfield && b.built && b.owner === 0) html += airfieldSection(b); // its planes and air drops first
    if (def.yard && b.built && mine) html += `<div class="section-label">${def.port ? 'Shipyard' : def.airfield ? 'Hangar' : 'Rail yard'}</div><div class="status" id="sh-yard-status"></div><div class="bar" id="sh-yard-bar"><div></div></div><div id="sh-yard"></div>
      <p class="hint">${def.port ? 'Ships are built here' : def.airfield ? 'Planes are built here' : 'Freight Trains are built here'}, a round of parts (1 Alloy, 1 Chip) every ${YARD.work} s: ${def.yard.map((k) => `${BOTS[k].plural.toLowerCase().replace(/^./, (c) => c.toUpperCase())} ${BOTS[k].parts}`).join(', ')} rounds. Haulers bring the parts. ${def.port ? 'Each one puts to sea from this Port.' : def.airfield ? `The hangar holds ${Object.entries(AIRFIELD_HOLDS).map(([k, n]) => `${n} ${n === 1 ? BOTS[k].name : BOTS[k].plural}`).join(' and ')}.` : 'Each one rolls out onto this station\'s track, so the Bot Foundry never needs a railway.'}</p>`;
    if (def.terminal && b.built) html += '<div class="section-label">Contracts <span class="label-note" id="sh-trade-next"></span></div><div id="sh-trade"></div><p class="hint" id="sh-trade-hint"></p>';
    if (def.store && b.built && !def.terminal) {
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
      if (BDEFS[b.type].port && b.built && b.owner === 0) html += portSection(b);
    } else if (b.type !== 'lander' && !(b.built && BDEFS[b.type].barrier)) {
      html += `<div class="section-label">Priority</div><div class="seg" id="sh-prio">
        <button data-v="low">Low</button><button data-v="normal">Normal</button><button data-v="high">High</button></div>
        <p class="hint">${b.built ? 'High-priority buildings get workers and goods first; low ones last, and lose their worker first when workers run short.' : 'High-priority sites get their materials and a builder first. Once built, it goes back to Normal.'}</p>`;
    }
    html += airSupplySection(b);
    if (def.mil && b.built && warOn()) {
      html += `<div class="section-label">Warbots</div>
        <div class="seg" id="sh-gprio"><button data-v="low">Low</button><button data-v="normal">Normal</button><button data-v="high">High</button></div>
        <p class="hint">Garrison priority: new warbots from the Foundry, and ones called back from a rally flag, fill High garrisons first and Low ones last.</p>
        <div class="stepper"><button class="btn" id="sh-st-minus" aria-label="Fewer">−</button><span class="n" id="sh-st-n">0</span>
        <button class="btn" id="sh-st-plus" aria-label="More">+</button><button class="btn primary" id="sh-st-send" style="flex:1">Station here</button></div>
        <p class="hint" id="sh-st-hint"></p>` +
        (b.type === 'lander' ? '<p class="hint" id="sh-posted"></p>' : `<div class="kv"><span>Stationed here</span><span id="sh-posted"></span></div>
        <button class="btn small ghost" id="sh-unpost">Send them back to the Command Base</button>`) +
        (def.bunker ? '' : `<div class="section-label">Keep here</div>
        <div class="seg" id="sh-keepw"><button data-v="auto">Auto (${b.type === 'lander' ? 1 : esc(S.players[0].keepW ?? 0)})</button><button data-v="0">0</button><button data-v="1">1</button><button data-v="2">2</button><button data-v="5">5</button><button data-v="${def.garrison}">${def.garrison}</button></div>
        <p class="hint">${b.type === 'lander' ? 'Warbots the Command Base always keeps at home: attacks, rallies and stationing never take the last of them.'
          : 'Warbots stationed here: your Command Base sends them, and replaces any that are lost. Attacks and rally flags use them once the Command Base has none to spare, and they come back here when you call them back (or after defending it). <i>Auto</i> follows the setting for every Outpost in Army.'}</p>`);
    }
    if (def.lab && b.built) html += '<div class="section-label">Research</div><div id="sh-research"></div>';
    if (b.type === 'foundry' && b.built) {
      html += `<div class="section-label">Order bots</div>
        <div class="seg" id="sh-omode"><button data-v="turns">Take turns</button><button data-v="first">Top of the list first</button></div>
        <div id="sh-orders"></div>
        <p class="hint">The Foundry only builds the bots you order, from the top of this list down. <b>Take turns</b>: one of each type you've ordered in turn. <b>Top of the list first</b>: every bot of the top type you've ordered, then the next. Move a type up or down with the arrows. Each bot uses 1 Alloy and 1 Chip a round, ${def.work} s each (a Freight Truck or Tanker takes ${BOTS.truck.parts} rounds, a Road Train ${BOTS.roadtrain.parts}, a Crawler ${BOTS.crawler.parts}). Freight Trains are built at a Rail Station's rail yard, planes in an Airfield's hangar${navalMap() ? ', ships at a Port\'s shipyard' : ''}.
        <b>Haulers</b> carry two goods on the short runs. <b>Freight Trucks</b> carry eight on the long runs (12 tiles or more), from far mines and factories as well as storage. <b>Tankers</b> are the only vehicles that carry Crude and Fuel, ten at a time (they explode if they're destroyed full). <b>Road Trains</b> carry thirty between your Command Base and far Depots, best on asphalt. <b>Agribots</b> run Bio Farms and Grove Planters, and <b>Pavers</b> run the Roadworks.</p>`;
    }
    if (def.roadworks && b.built) {
      html += `<div class="section-label">Paves and maintains</div>
        <div class="seg" id="sh-pmode"><button data-v="marked">Marked roads</button><button data-v="all">Every joined road</button></div>
        <button class="btn" id="sh-pmark">Mark roads to pave</button>
        <p class="hint">Mark roads in Paths (Pave) and the Paver keeps just those surfaced, resurfacing them as traffic wears them down: put the Roadworks near the roads that matter. <i>Every joined road</i> paves everything it can reach.</p>`;
    }
    if (def.pump && b.built && b.owner === 0) {
      const pr = pipeToRefinery(0, b);
      if (!pr.why) html += `<button class="btn" id="sh-pipe">Pipe it to the Refinery: ${pr.tiles.length} tile${pr.tiles.length === 1 ? '' : 's'}, ${costText(pr.cost)}</button>
        <p class="hint">A pipeline sends its Crude straight to the Refinery, every second, so it never waits for a Tanker. It runs over roads and track; raiders can break it.</p>`;
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
    if (!roadFirst && (needsRoad(b) || (b.unlinked !== undefined && !def.store))) html += '<div id="sh-road"></div>';
    html += '<div class="actions">';
    if (pausable(b) && b.built) html += `<button class="btn" id="sh-pause"></button>`;
    if (b.owner === 0 && (movable(b) || b.moving)) html += `<button class="btn" id="sh-move">${b.moving ? 'Call off the move' : 'Move'}</button><p class="hint" id="sh-move-hint">${b.moving ? 'Its new site is going up: when it\'s finished, everything here moves over and this one comes down.' : 'Put it somewhere else: no goods needed, just its build time. It keeps working until the new one is ready.'}</p>`;
    if (b.owner === 0 && b.type === 'wall' && b.built) html += `<button class="btn" id="sh-gate">Make it a Gate</button><p class="hint">Your bots and trucks can pass through a Gate; enemies still have to break it down. It costs ${costText(gateUpgradeCost())} more, paid from storage.</p>`;
    if (BDEFS[b.type].mobile) html += '<button class="btn primary" id="sh-pack">Pack up to move</button>';
    else if (b.type !== 'lander') html += `<button class="btn danger" id="sh-demolish">${b.built ? 'Demolish' : 'Cancel site'}</button>`;
    html += '</div>';
  } else if (S.mode !== 'colony' || def.wild) {
    html += `<div class="section-label">Attack with warbots</div><div id="sh-attack"></div>
      <div class="stepper" id="sh-stepper"><button class="btn" id="sh-minus" aria-label="Fewer warbots">−</button><span class="n" id="sh-n">0</span>
      <button class="btn" id="sh-plus" aria-label="More warbots">+</button><button class="btn primary" id="sh-send" style="flex:1">Send warbots</button></div>
      <div class="section-label">Missile strike</div><div id="sh-missile"></div>
      <button class="btn primary big" id="sh-fire">Fire missile</button>${myBombers().length ? '<div class="section-label">Air strike</div><p class="hint" id="sh-bomb-hint"></p><button class="btn big" id="sh-bomb">Bomb it</button>' : ''}`;
  }
  openSheet('bld', b.id, html);
  UI.sheetMine = mine;
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
    if ($('sh-pmode')) for (const btn of $('sh-pmode').children) btn.onclick = () => { b.pmode = btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-pmark')) $('sh-pmark').onclick = () => openPaths('pave');
    if ($('sh-keep-all')) $('sh-keep-all').onclick = () => { UI.keepAll = !UI.keepAll; sfx('click'); openBuildingSheet(b); };
    if ($('sh-keep')) for (const btn of $('sh-keep').querySelectorAll('button')) btn.onclick = () => {
      const g = btn.parentElement.dataset.g;
      setKeep(b, g, ((b.keep && b.keep[g]) || 0) + +btn.dataset.d);
      sfx('click');
      refreshSheet();
    };
    const seg = $('sh-mode');
    if (seg) for (const btn of seg.children) btn.onclick = () => { b.mode = btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-orders')) renderFoundryOrders(b);
    if ($('sh-omode')) for (const btn of $('sh-omode').children) btn.onclick = () => { b.omode = btn.dataset.v === 'first' ? 'first' : undefined; sfx('click'); refreshSheet(); };
    if ($('sh-pause')) $('sh-pause').onclick = () => { setPaused(b, !b.paused); sfx('click'); refreshSheet(); };
    if ($('sh-move')) $('sh-move').onclick = () => {
      if (b.moving) { cancelMove(b); sfx('click'); toast(`Move called off: the ${def.name} stays where it is.`, 'info'); openBuildingSheet(b); return; }
      sfx('click'); enterPlaceMode(b.type, b.id);
    };
    if ($('sh-pack')) $('sh-pack').onclick = () => {
      const btn = $('sh-pack');
      if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Tap again: its land goes, and buildings only it covers are lost'; return; }
      const u = packCrawler(b);
      sfx('order');
      if (u) openBotSheet(u); else closeSheet();
    };
    if ($('sh-gate')) $('sh-gate').onclick = () => {
      const why = wallToGate(0, b);
      if (why) { sfx('error'); toast(why, 'warn'); return; }
      sfx('place'); toast('The Wall is now a Gate: your bots can pass through it.', 'good'); openBuildingSheet(b);
    };
    if ($('sh-aim')) $('sh-aim').onclick = () => { sfx('click'); startAim(b); };
    for (const btn of document.querySelectorAll('#sh-ferry button[data-to]')) btn.onclick = () => {
      const to = +btn.dataset.to ? getE(+btn.dataset.to) : null;
      const why = setFerryLine(b, to);
      if (why) { sfx('error'); toast(why, 'warn'); return; }
      sfx('click'); toast(to ? 'Ferry line set: your bots take the ferry when it\'s the shorter way.' : 'Ferry line stopped.', 'info'); openBuildingSheet(b);
    };
    if ($('sh-air')) for (const btn of $('sh-air').querySelectorAll('button[data-k]')) btn.onclick = () => { const f = freePlane(b); if (!f) return; sfx('click'); startAirdrop(f, btn.dataset.k); };
    if ($('sh-airsup')) for (const btn of $('sh-airsup').children) btn.onclick = () => { b.airSupply = btn.dataset.v === '1'; sfx('click'); refreshSheet(); };
    if ($('sh-land')) {
      UI.landN = clamp(UI.landN || 3, 1, FERRY_SEATS);
      $('sh-land-minus').onclick = () => { UI.landN = Math.max(1, UI.landN - 1); refreshSheet(); };
      $('sh-land-plus').onclick = () => { UI.landN = Math.min(FERRY_SEATS, UI.landN + 1); refreshSheet(); };
      $('sh-land').onclick = () => { const f = portFerry(b); if (!f) return; sfx('click'); startLanding(f, UI.landN); };
      if ($('sh-found')) $('sh-found').onclick = () => { const f = portFerry(b); if (!f) return; sfx('click'); startLanding(f, 0, 'port'); };
    }
    if ($('sh-pipe')) $('sh-pipe').onclick = () => {
      const r = pipeToRefinery(0, b);
      if (r.why) { sfx('error'); toast(r.why, 'warn'); return; }
      const n = pipeUp(0, r.tiles), owed = r.tiles.filter((t) => S.pipePlan[t] === 1).length;
      sfx('place');
      toast(`Pipe laid from the Oil Pump to the Refinery (${n} tile${n === 1 ? '' : 's'}).` + (owed ? ` ${owed} tile${owed === 1 ? '' : 's'} wait for goods, paid from storage as they come in.` : ''), 'good');
      $('sh-pipe').hidden = true;
    };
    if ($('sh-gprio')) for (const btn of $('sh-gprio').children) btn.onclick = () => { b.gprio = btn.dataset.v === 'normal' ? undefined : btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-keepw')) for (const btn of $('sh-keepw').children) btn.onclick = () => { b.keepW = btn.dataset.v === 'auto' ? undefined : +btn.dataset.v; b.stockT = 0; sfx('click'); refreshSheet(); };
    if ($('sh-unpost')) $('sh-unpost').onclick = () => {
      const n = unstation(0, b);
      if (n) { sfx('order'); toast(`${n} warbot${n > 1 ? 's' : ''} heading back to the Command Base. This ${def.name} now keeps none.`, 'info'); } else sfx('error');
      refreshSheet();
    };
    if ($('sh-st-send')) {
      UI.stationN = stationAvailable(0, b); // as many as it has room for and you can spare
      $('sh-st-minus').onclick = () => { UI.stationN = Math.max(1, UI.stationN - 1); refreshSheet(); };
      $('sh-st-plus').onclick = () => { UI.stationN = Math.min(stationAvailable(0, b), UI.stationN + 1); refreshSheet(); };
      $('sh-st-send').onclick = () => {
        const n = stationWarbots(0, b, UI.stationN);
        if (n) { sfx('order'); toast(`${n} warbot${n > 1 ? 's' : ''} on the way to the ${def.name}.`, 'info'); } else sfx('error');
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
      if (b.owner !== 0) return; // (captured while its panel was open: no longer yours to take down)
      if (!UI.demolishArm) {
        UI.demolishArm = 1;
        $('sh-demolish').textContent = BDEFS[b.type].mil && b.built ? 'Tap again: buildings outside your border will be lost' : 'Tap again to confirm';
        return;
      }
      // Say what went back to storage: half the building, and anything that was inside it.
      const def = BDEFS[b.type];
      const out = demolish(b);
      sfx('boom');
      closeSheet();
      if (!b.built || !out) return;
      const to = out.to && getE(out.to);
      toast(`${def.name} demolished: ` + (to ? `half its materials went to your ${BDEFS[to.type].name}` : 'with no other storage, its materials were lost') +
        (out.crates ? `, and the ${out.crates} good${out.crates === 1 ? '' : 's'} inside spilled out in crates for your haulers to collect.` : '.'), 'info', b.x, b.y);
    };
  } else if ($('sh-send')) {
    UI.attackN = attackAvailable(0, b);
    $('sh-minus').onclick = () => { UI.attackN = Math.max(1, UI.attackN - 1); refreshSheet(); };
    $('sh-plus').onclick = () => { UI.attackN = Math.min(attackAvailable(0, b), UI.attackN + 1); refreshSheet(); };
    $('sh-send').onclick = () => {
      const n = sendAttack(0, b, UI.attackN);
      if (n > 0) {
        sfx('order');
        toast(`${n} warbot${n > 1 ? 's' : ''} sent to attack the ${def.name}.`, 'info');
        closeSheet();
      }
    };
    $('sh-fire').onclick = () => {
      if (fireMissile(0, b)) { toast(`Missile away: it will hit the ${def.name} in a few seconds.`, 'info'); refreshSheet(); }
      else sfx('error');
    };
    if ($('sh-bomb')) $('sh-bomb').onclick = () => {
      const u = readyBomber(b);
      const why = u ? orderStrike(0, u, b) : 'No Strike Bomber is ready that can reach it.';
      if (why) { sfx('error'); toast(why, 'warn'); return; }
      sfx('order'); toast(`Strike ordered on the ${def.name}: a bomber loads up and takes off.`, 'good'); refreshSheet();
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
    el.innerHTML = `<div class="road-warn"><b>No road to storage.</b> ${what}, and no road can reach it. Lay a road to it (round cliffs, or with a Ramp).</div>`;
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
  if (mine && def.terminal && b.built) renderTrade(b);
  if (mine && def.yard && b.built) renderYard(b);
  const parts = [];
  if (mine && def.lab && $('sh-research')) refreshResearch();
  // (robots that ran in from enemy warbots: said on the building they are hiding in, see takeShelter)
  const hiding = mine ? S.bots.reduce((n, u) => n + (!u.dead && u.inside === b.id && u.task && u.task.type === 'shelter' ? 1 : 0), 0) : 0;
  $('sh-status').textContent = mine ? (b.status || '') + (hiding ? `${b.status ? ' · ' : ''}${hiding} robot${hiding === 1 ? '' : 's'} sheltering from enemy warbots` : '') : (b.built ? '' : 'Construction site');
  if (!b.built) {
    parts.push(`<div class="bar"><div style="width:${Math.round(b.progress * 100)}%"></div></div>`);
    parts.push('<div class="section-label">Materials delivered</div><div class="goodlist">' +
      Object.keys(siteCost(b)).map((g) => goodTag(g, `${b.stock[g] || 0}/${siteCost(b)[g]}`, (b.stock[g] || 0) < siteCost(b)[g])).join('') + '</div>');
  } else {
    parts.push(`<div class="kv"><span>Armor</span><span>${Math.ceil(Math.max(0, b.armor))} / ${def.armor}</span></div>
      <div class="bar armor"><div style="width:${Math.max(0, (b.armor / def.armor) * 100)}%"></div></div>`);
    if (mine && def.staff) {
      const op = getE(b.staff);
      parts.push(`<div class="kv"><span>${def.crew ? BOTS[def.crew].name : 'Worker'}</span><span>${b.paused ? 'Paused' : op ? (op.inside === b.id ? 'Inside' : 'Out working') : b.staffInc ? 'On the way' : 'None yet'}</span></div>`);
    }
    if (def.roadworks) {
      // Everything on the road network joined to the Roadworks is in reach (or just the marked roads).
      let fresh = 0, worn = 0, todo = 0;
      // (The owner's own networks, as buildingNets labels them: a rival's fort on the road doesn't join them.)
      const nets = buildingNets(b), comp = ownNet(b.owner), all = paveMode(b) === 'all';
      for (let t = 0; t < S.W * S.H; t++) {
        if (!S.road[t] || wayOwner(t) !== b.owner || !(all || S.paveMark[t]) || nets.indexOf(comp[t]) < 0) continue;
        if (S.pave[t] !== 2) todo++; else if (S.wear[t] >= REPAVE_AT) worn++; else fresh++;
      }
      parts.push(`<div class="kv"><span>${all ? 'Joined roads' : 'Marked roads joined to it'}</span><span>${fresh + worn + todo} tiles</span></div>
        <div class="kv"><span>Asphalt in good repair</span><span>${fresh}</span></div>
        <div class="kv"><span>To pave · worn, to resurface</span><span>${todo} · ${worn}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Asphalt</span><span>${goodTag('asphalt', `${b.stock.asphalt || 0}/3`, !(b.stock.asphalt > 0) && !(b.charges > 0))} + ${esc(b.charges || 0)} tiles in the hopper</span></div>`);
    }
    if (def.ammoStock && mine && warOn()) {
      parts.push(`<div class="kv"><span>Ammo for warbots</span><span>${goodTag('ammo', `${b.stock.ammo || 0}/${def.ammoStock}`, !(b.stock.ammo > 0))}</span></div>`);
    }
    if (b.upT > 30 && tracksUse(def)) {
      const pct = Math.round(((b.useT || 0) / b.upT) * 100);
      parts.push(`<div class="kv"><span>Busy</span><span>${pct}% of the time</span></div>${sparkline(b.useHist)}`);
    }
    if ((def.gather || def.farm) && mine && b.depleted) {
      parts.push(`<p class="desc err"><b>Nothing left to ${def.farm ? 'farm' : 'gather'} in reach.</b> Demolish it (below) for half its materials back; anything still in it goes to storage. Then build a new ${def.name} ${def.farm ? 'beside open fertile soil' : `by a fresh field of ${RES[def.gather].name.toLowerCase()}s`}.</p>`);
    }
    if (def.gather) {
      const g = RES[def.gather].good;
      parts.push(`<div class="kv"><span>${RES[def.gather].name}s in reach</span><span>${reachableRes(b.x, b.y, def.radius, def.gather)}</span></div>`);
      if (b.type === 'mine' && nukeOn()) parts.push(`<div class="kv"><span>Uranium deposits in reach</span><span>${reachableRes(b.x, b.y, def.radius, R_URANIUM)}</span></div>`);
      if (def.bedrock) parts.push(`<div class="kv"><span>Rock faces in reach</span><span>${rockFacesIn(b.x, b.y, def.radius)}</span></div>`);
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
      if (mine && pumpDry(b)) parts.push('<p class="desc err"><b>This seep has run dry.</b> Demolish the pump (below) for half its materials back; any Crude still in it goes to storage. Then build a new Oil Pump on another oil seep.</p>');
      parts.push(`<div class="kv"><span>Crude left in the seep</span><span>${oilAround(b.x, b.y)}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag('crude', `${b.stock.crude || 0}/${def.out.crude}`)}</span></div>`);
      if (mine) {
        const joined = refineryPipes(0), ns = buildingPipes(b);
        parts.push(`<div class="kv"><span>Pipeline</span><span>${ns.some((c) => joined.has(c)) ? 'to a Refinery' : b.piped ? 'to storage' : ns.length ? 'goes nowhere yet' : 'none: a Tanker collects'}</span></div>`);
      }
      if (mine && b.timer > 0 && /^Working/.test(b.status || '')) parts.push(`<div class="bar"><div style="width:${Math.round((b.timer / def.work) * 100)}%"></div></div>`);
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
        parts.push(`<div class="kv"><span>Next bot</span><span>${BOTS[k] ? BOTS[k].name + (need > 1 ? ` (part ${Math.min(need, foundryParts(b, k) + 1)} of ${need})` : '') : 'Nothing ordered'}</span></div>`);
      }
      if (b.timer > 0 && /^Working/.test(b.status || '')) parts.push(`<div class="bar"><div style="width:${Math.round((b.timer / def.work) * 100)}%"></div></div>`);
    }
    // Feed links: what it passes straight on to its neighbours, and what they pass to it.
    if (mine && b.built) {
      const linkText = (l, b2) => `${BDEFS[b2.type].name} (${l.goods.map((g) => GOOD[g].name).join(', ')})`;
      const feeds = feedTargets(b), by = feedersOf(b);
      if (feeds.length) parts.push(`<div class="kv"><span>Feeds by conveyor</span><span>${feeds.map((l) => linkText(l, l.c)).join('; ')}</span></div>`);
      if (by.length) parts.push(`<div class="kv"><span>Fed by conveyor</span><span>${by.map(({ from, link }) => linkText(link, from)).join('; ')}${beingFed(b) ? ', working a tenth faster' : ''}</span></div>`);
    }
    if (def.store && mine && !def.terminal) {
      let idle = 0;
      for (const u of S.bots) if (!u.dead && u.inside === b.id && u.type === 'worker') idle++;
      parts.push(`<div class="kv"><span>Workers resting here</span><span>${idle}</span></div>`);
    }
    if (def.mil) parts.push(`<div class="kv"><span>${mine ? 'Warbots inside' : 'Defenders inside'}</span><span>${b.garrison.length} / ${def.garrison}</span></div>`);
    if (def.mil && mine && !def.bunker) parts.push(`<div class="kv"><span>Territory radius</span><span>${def.terr} tiles</span></div>`);
    if (def.bunker) parts.push(`<div class="kv"><span>Fires at</span><span>enemy robots within ${def.range} tiles</span></div>`);
    if (def.keep) {
      const r2 = KEEP.aura * KEEP.aura, near = S.buildings.filter((c) => !c.dead && c.built && c.owner === b.owner && c !== b && dist2(c.x, c.y, b.x, b.y) <= r2);
      const walls = near.filter((c) => BDEFS[c.type].barrier && keepOver(c) === b).length, guns = near.filter((c) => ['turret', 'bunker', 'mortar', 'flak', 'disruptor'].includes(c.type)).length;
      parts.push(`<div class="kv"><span>Warbots fire at</span><span>enemy robots within ${KEEP.fire} tiles</span></div>`);
      parts.push(`<div class="kv"><span>Roof cannon</span><span>${def.range} tiles, ${goodTag('crystal', `${b.shots + (b.stock.crystal || 0) * shotsPer(b)} shots`, !(b.shots > 0 || b.stock.crystal > 0))}</span></div>`);
      parts.push(`<div class="kv"><span>Aura (${KEEP.aura} tiles)</span><span>${walls} Wall${walls === 1 ? '' : 's'} and Gate${walls === 1 ? '' : 's'} toughened, ${guns} defence${guns === 1 ? '' : 's'} sharpened</span></div>`);
    }
    if (def.disrupt && mine) {
      parts.push(`<div class="kv"><span>Fuel</span><span>${goodTag('fuel', `${b.stock.fuel || 0}/${def.ammoCap}`, !(b.stock.fuel > 0))} + ${esc(b.pulses || 0)} pulse${b.pulses === 1 ? '' : 's'} charged</span></div>`);
      parts.push(`<div class="kv"><span>Each pulse</span><span>drains ${def.disrupt.drain} battery from enemy robots within ${def.range} tiles, every ${def.disrupt.every}s</span></div>`);
    }
    if (def.mortar && mine) {
      parts.push(`<div class="kv"><span>Shells</span><span>${esc((b.shells || 0) + (b.stock.ammo || 0) * def.mortar.shells)} (${goodTag('ammo', `${b.stock.ammo || 0}/${def.ammoCap}`, !(b.stock.ammo > 0))})</span></div>`);
      parts.push(`<div class="kv"><span>Each shell</span><span>${def.mortar.damage} damage, ${def.mortar.splashDamage} within ${def.mortar.splash} tiles; ${def.minRange} to ${def.range} tiles out</span></div>`);
    }
    if (def.ammo && mine && !def.missile && !def.disrupt && !def.mortar) parts.push(`<div class="kv"><span>Ammo</span><span>${esc(b.shots + (b.stock.crystal || 0) * shotsPer(b))} shots</span></div>`);
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
      parts.push(`<div class="kv"><span>Charging now</span><span>${esc(b.charging || 0)} (${def.charger.slots} at full speed)</span></div>`);
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
  if ($('sh-keepw')) for (const btn of $('sh-keepw').children) btn.classList.toggle('on', btn.dataset.v === (b.keepW === undefined ? 'auto' : String(b.keepW)));
  if ($('sh-st-n')) {
    const avail = stationAvailable(0, b), coming = b.garInc || 0;
    UI.stationN = clamp(UI.stationN || 0, avail ? 1 : 0, avail);
    $('sh-st-n').textContent = UI.stationN;
    $('sh-st-send').disabled = !avail;
    $('sh-st-hint').textContent = `It holds ${BDEFS[b.type].garrison} warbots: ${b.garrison.length} inside${coming ? `, ${coming} on the way` : ''}. ` + (avail
      ? `Bring up to ${avail} more, from your Command Base first. They're stationed here: after a fight or a trip for repairs they come back here, until you send them elsewhere.`
      : !garrisonRoom(b) ? 'It\'s full.' : 'No spare warbots: your Command Base keeps its last one, and warbots stationed at other Outposts stay there (send some back to the Command Base first).');
  }
  if ($('sh-posted')) {
    if (b.type === 'lander') {
      let home = 0, out = 0;
      for (const u of S.bots) if (!u.dead && u.owner === 0 && u.type === 'warbot' && !postOf(u)) { if (u.inside === b.id) home++; else out++; }
      $('sh-posted').textContent = `${home} warbot${home === 1 ? '' : 's'} here${out ? `, ${out} more out or on the way (they belong here)` : ''}. Warbots not stationed at an Outpost belong to the Command Base.`;
    } else {
      let inside = 0, out = 0;
      for (const u of S.bots) if (!u.dead && u.owner === 0 && u.post === b.id) { if (u.inside === b.id) inside++; else out++; }
      $('sh-posted').textContent = inside + out ? `${inside + out} (${inside} inside${out ? `, ${out} out or on the way` : ''})` : 'None';
      if ($('sh-unpost')) $('sh-unpost').disabled = !(inside + out);
    }
  }
  if ($('sh-lim')) {
    const lim = stockLimit(b), g = limitGood(b), have = goodTotal(0, g);
    $('sh-lim').textContent = lim === Infinity ? '∞' : lim;
    $('sh-lim-off').textContent = lim === Infinity ? 'Set a limit' : 'No limit';
    $('sh-lim-hint').textContent = lim === Infinity
      ? `No limit: it keeps going while it has inputs. You have ${have}.`
      : `You have ${have}. ${have >= lim ? 'Stopped: it starts again when you drop below the limit.' : 'It stops (and takes no more inputs) when you reach the limit.'}`;
  }
  if ($('sh-pause')) $('sh-pause').textContent = def.staff ? (b.paused ? 'Resume' : 'Pause') : (b.paused ? 'Turn on' : 'Turn off');
  if ($('sh-prio')) for (const btn of $('sh-prio').children) btn.classList.toggle('on', btn.dataset.v === (b.prio || 'normal'));
  if ($('sh-pmode')) for (const btn of $('sh-pmode').children) btn.classList.toggle('on', btn.dataset.v === paveMode(b));
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
  if ($('sh-land-n')) $('sh-land-n').textContent = UI.landN || 3;
  if ($('sh-port-ships')) $('sh-port-ships').textContent = portShipsText(b);
  if ($('sh-air-planes')) { const ps = basePlanes(b).filter((u) => !BOTS[u.type].bomber); $('sh-air-planes').textContent = ps.length ? ps.map((u) => `Its plane is ${planeStatus(u)}.`).join(' ') : 'None based here: order one in the hangar below.'; }
  if ($('sh-air-bombers')) {
    const bs = basePlanes(b).filter((u) => BOTS[u.type].bomber), el = $('sh-air-bombers');
    const sig = bs.map((u) => u.id + ':' + planeStatus(u)).join('|');
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig;
      el.innerHTML = bs.length ? bs.map((u, k) => `<div class="kv trade-row"><span>Bomber ${k + 1}<small>${esc(planeStatus(u))}</small></span><button class="btn small primary" data-b="${esc(u.id)}" ${u.mission || u.flight ? 'disabled' : ''}>Strike</button></div>`).join('') +
        `<p class="hint">A sortie takes ${BOMBER.ammo} Ammo (this Airfield keeps some for them; haulers bring it) and Fuel; back on the ground a bomber needs ${BOMBER.rearm} s to rearm. Or open a rival building and tap <b>Bomb it</b>.</p>`
        : '<p class="hint">None based here: order Strike Bombers in the hangar below (two fit).</p>';
      for (const btn of el.querySelectorAll('button[data-b]')) btn.onclick = () => { const u = getE(+btn.dataset.b); if (u) { sfx('click'); startStrike(u); } };
    }
  }
  if ($('sh-air-places')) $('sh-air-places').textContent = airPlacesText(b);
  if ($('sh-airsup')) { for (const btn of $('sh-airsup').children) btn.classList.toggle('on', (btn.dataset.v === '1') === !!b.airSupply); $('sh-airsup-hint').textContent = airSupplyHint(b); }
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
    for (const u of S.bots) if (!u.dead && u.owner === 0 && BOTS[u.type].truck && !BOTS[u.type].train && !BOTS[u.type].tanker) trucks++; // Road Trains only run to far Depots
    $('sh-keep-hint').textContent = !want
      ? 'Set how much of each good to keep here, and haulers and Freight Trucks bring it from your other storage. Buildings and roads near here then draw on it.'
      : `${short ? `Filling ${short} order${short > 1 ? 's' : ''}` : 'Fully stocked'}. ` + (b.airSupply && !onHomeNet(b) ? `A Cargo Plane flies them in, ${BOTS.cargoplane.carry} goods a flight (see Supply by air).`
        : trucks ? `${trucks} Freight Truck${trucks > 1 ? 's' : ''} take the runs; haulers help when they're busy.` : 'Haulers bring it two at a time: order Freight Trucks at the Bot Foundry to carry eight.');
  }
  if ($('sh-mode')) for (const btn of $('sh-mode').children) btn.classList.toggle('on', btn.dataset.v === b.mode);
  if ($('sh-omode')) for (const btn of $('sh-omode').children) btn.classList.toggle('on', btn.dataset.v === (b.omode === 'first' ? 'first' : 'turns'));
  if ($('sh-orders')) {
    // The bot being built now (or next) is marked in the list.
    const next = hasOrders(b) ? nextBotKind(b) : null;
    for (const row of $('sh-orders').children) row.classList.toggle('next', row.dataset.k === next);
  }
  for (const k of BOT_ORDER) {
    if (!$('sh-o-' + k)) continue;
    const n = (b.orders && b.orders[k]) || 0;
    $('sh-o-' + k).textContent = n ? `${n} queued` : 'none queued';
  }
  if ($('sh-bomb')) {
    const u = readyBomber(b), any = myBombers();
    $('sh-bomb').disabled = !u;
    $('sh-bomb-hint').textContent = u ? `A Strike Bomber is ready: it drops one bomb (${BOMBER.damage} off the target, ${BOMBER.ammo} Ammo a sortie). Flak Guns can shoot it down.`
      : any.some((v) => v.mission || v.flight) ? 'Your bombers are out on sorties.' : any.some((v) => v.rearmUntil > S.time) ? 'Your bombers are rearming.' : 'Out of your bombers\' reach.';
  }
  if ($('sh-fire')) {
    const silos = silosInRange(0, b), ready = silos.filter(siloReady);
    const minReload = silos.reduce((m, q) => (q.reload > 0 && q.stock.warhead > 0 ? Math.min(m, q.reload) : m), Infinity);
    $('sh-fire').disabled = !ready.length;
    $('sh-missile').innerHTML = `<p class="desc">${!silos.length
      ? `No Missile Silo within ${BDEFS.silo.missile.range} tiles. Build a Silo near the front and a Missile Factory to make Missiles.`
      : ready.length
        ? `${ready.length} silo${ready.length > 1 ? 's' : ''} ready. A missile wrecks smaller buildings and knocks Outposts and Command Bases down to a third of their armor, ready for warbots to finish off.`
        : minReload < Infinity ? `Silos in range are reloading (${Math.ceil(minReload)}s).` : 'Silos in range have no Missiles. Build them at a Missile Factory (Alloy, Chips and Fuel).'}</p>`;
  }
  if ($('sh-send')) {
    const avail = attackAvailable(0, b);
    UI.attackN = clamp(UI.attackN || avail, Math.min(1, avail), avail);
    $('sh-n').textContent = UI.attackN;
    $('sh-send').disabled = avail === 0;
    $('sh-attack').innerHTML = avail
      ? `<p class="desc">${avail} armed warbot${avail > 1 ? 's' : ''} can reach this from your garrisons (each garrison keeps its Keep at home).</p>`
      : `<p class="desc">No armed warbots in range. Warbots attack from Outposts or your Command Base within ${ATTACK_RANGE} tiles, and only ones with Ammo go. Build an Outpost closer, and an Ammo Plant to keep garrisons stocked.</p>`;
  }
}

/**
 * The Research Lab's panel: the upgrade under way (with a progress bar and Cancel), and every
 * upgrade with its cost and a Research button. Rebuilt only when something changes, so a tap isn't
 * lost to the progress bar moving.
 */
function refreshResearch() {
  const el = $('sh-research'), P = S.players[0], r = P.research, have = spendable(0);
  const key = (r ? r.key : '-') + TECH_ORDER.map((k) => (tech(0, k) ? 'd' : canPay(0, TECHS[k].cost) ? 'y' : 'n')).join('');
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.innerHTML = (r
      ? `<div class="research-now"><div class="kv"><span>Researching <b>${TECHS[r.key].name}</b></span><button class="btn small ghost" id="sh-rcancel">Cancel</button></div><div class="bar"><div id="sh-rbar"></div></div></div>`
      : '<p class="hint">Pick an upgrade: its cost comes out of storage now, and a worker in the Lab researches it. Every upgrade lasts the whole game.</p>') +
      `<div class="tech-list">${TECH_ORDER.map((k) => {
        const d = TECHS[k], done = tech(0, k), now = r && r.key === k;
        return `<div class="tech${done ? ' done' : ''}${now ? ' now' : ''}"><div class="tech-head"><b>${d.name}</b><span>${done ? 'Done ✓' : `${d.time} s`}</span></div><p>${d.desc}</p>` +
          (done ? '' : `<div class="tech-foot"><span class="bcost">${costHTML(d.cost, have)}</span>${now ? '<span class="ok">Under way</span>'
            : `<button class="btn small${r ? '' : ' primary'}" data-k="${k}" ${r || !canPay(0, d.cost) ? 'disabled' : ''}>Research</button>`}</div>`) + '</div>';
      }).join('')}</div>`;
    for (const btn of el.querySelectorAll('button[data-k]')) btn.onclick = () => {
      const why = startResearch(0, btn.dataset.k);
      if (why) { sfx('error'); toast(why, 'warn'); } else { sfx('order'); toast(`Research started: ${TECHS[btn.dataset.k].name}.`, 'info'); }
      el.dataset.key = '';
      refreshSheet();
    };
    if ($('sh-rcancel')) $('sh-rcancel').onclick = () => { cancelResearch(0); sfx('click'); toast('Research called off: its cost is back in your Command Base.', 'info'); el.dataset.key = ''; refreshSheet(); };
  }
  if (r && $('sh-rbar')) $('sh-rbar').style.width = `${Math.min(100, (100 * r.t) / TECHS[r.key].time)}%`;
}

/**
 * The Foundry's order list: every bot type in its build order, each with arrows to move it up or down,
 * how many are queued, and +1, +5 and Clear.
 */
function renderFoundryOrders(b) {
  const el = $('sh-orders');
  if (!el) return;
  const versus = warOn(), shows = (k) => (versus || !BOTS[k].war) && !BOTS[k].sea && !BOTS[k].rail && !BOTS[k].air, kinds = foundryList(b).filter(shows); // ships, trains and planes come from yards
  el.innerHTML = kinds.map((k, i) => `<div class="order-row" data-k="${k}">
    <span class="order-move"><button class="btn ghost" data-k="${k}" data-m="-1" aria-label="Move ${BOTS[k].plural} up" ${i ? '' : 'disabled'}>▲</button><button class="btn ghost" data-k="${k}" data-m="1" aria-label="Move ${BOTS[k].plural} down" ${i < kinds.length - 1 ? '' : 'disabled'}>▼</button></span>
    <span>${BOTS[k].plural}<small id="sh-o-${k}">none queued</small></span>
    <button class="btn" data-k="${k}" data-d="1">+1</button><button class="btn" data-k="${k}" data-d="5">+5</button>
    <button class="btn ghost" data-k="${k}" data-d="0">Clear</button></div>`).join('');
  for (const btn of el.querySelectorAll('button')) btn.onclick = () => {
    const k = btn.dataset.k;
    if (btn.dataset.m) {
      moveFoundryOrder(b, k, +btn.dataset.m, shows);
      sfx('click');
      renderFoundryOrders(b);
      refreshSheet();
      return;
    }
    const d = +btn.dataset.d;
    b.orders = b.orders || {};
    b.orders[k] = d === 0 ? 0 : clamp((b.orders[k] || 0) + d, 0, 99);
    if (!hasOrders(b)) delete b.orders;
    sfx('click');
    refreshSheet();
  };
}

function botActivity(u) {
  const t = u.task;
  if (BOTS[u.type].air) { const b = getE(u.home); return `${planeStatus(u)[0].toUpperCase()}${planeStatus(u).slice(1)}` + (b && !b.dead ? ` (based at the Airfield ${dirText(getE(S.players[u.owner].lander) || b, b)} from the Command Base)` : ' (no Airfield yet)'); }
  const nm = (id) => { const b = getE(id); return b ? BDEFS[b.type].name : 'a building'; };
  if (BOTS[u.type].siege) {
    if (u.salvo) return `Firing at the ${nm(u.salvo.target)}!`;
    if (t && t.type === 'bombard') return u.deployT > 0 ? `Raising its rack to fire at the ${nm(t.target)}` : `Driving into reach of the ${nm(t.target)}`;
    if (t && t.type === 'rearm') return `Reloading ${ROCKET.ammo} Ammo at the ${nm(t.bld)}`;
    if (t && t.type === 'park') return 'Driving to its spot';
    return (u.rockets ?? ROCKET.salvo) ? `Loaded: waiting, and firing at any enemy building within ${ROCKET.range} tiles` : 'Out of rockets: no Ammo in reach to reload';
  }
  if (u.type === 'warbot') {
    const p = u.owner === 0 && usesPosts(0) ? postOf(u) : null;
    const where = u.owner !== 0 ? '' : p ? ` (stationed at the ${BDEFS[p.type].name})` : ' (belongs to the Command Base)';
    const what = (() => {
      if (u.fight) return 'Fighting!';
      if (!t) return u.inside ? 'Standing guard inside' : 'Waiting for orders: no garrison with room';
      if (t.type === 'garrison') return `Marching to the ${nm(t.bld)}`;
      if (t.wait > S.time) return 'Waiting to set off with its squad'; // (staggered departure: the task is kept, with the time it leaves)
      if (t.type === 'attack' && t.reload) return 'Out of Ammo: reloading nearby, then back to the attack';
      if (t.type === 'attack') return `Attacking the rival ${nm(t.target)}`;
      if (t.type === 'defend') return `Defending the ${nm(t.home)}`;
      if (t.type === 'hold') return t.phase === 'recharge' ? 'Battery flat: going to recharge' : t.target ? `Attacking the rival ${nm(t.target)}` : 'Holding the rally point';
      if (t.type === 'repair') return u.retreat ? 'Badly hurt: pulling out of the fight for repairs' + (u.resume ? ', then back to it' : '') : 'Going for repairs';
      if (t.type === 'topup') return 'Topping up its battery';
      if (t.type === 'loot') return t.phase === 'home' ? 'Carrying a crate of loot home' : 'Going to pick up loot';
      return 'On patrol';
    })();
    return what + where;
  }
  if (t && t.type === 'shelter') return u.inside ? `Sheltering in the ${nm(t.bld)} until the enemy warbots have gone` : `Enemy warbots close: running for shelter in the ${nm(t.bld)}`;
  if (t && t.type === 'charge') return u.inside ? 'Recharging its battery' : 'Going to recharge its battery';
  if (t && t.type === 'refuel') return 'Going to fill up with Fuel';
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
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[u.owner]}"></span> ${u.owner === 0 ? 'Yours' : playerName(u.owner)}</div></div></div>
    <p class="desc">${BOTS[u.type].desc}</p>
    <div class="status" id="sh-status"></div><div id="sh-dyn"></div>
    ${u.owner === 0 && u.type === 'warbot' ? '<button class="btn big" id="sh-recall" hidden>Call back this squad</button>' : ''}
    ${u.owner === 0 && BOTS[u.type].bomber ? '<button class="btn primary big" id="sh-strike">Pick a target</button>' : ''}
    ${u.owner === 0 && BOTS[u.type].ferry ? `<div class="actions"><button class="btn primary" id="sh-fsail">Sail somewhere</button><button class="btn" id="sh-fhome">Back to its line</button></div>
      <div class="actions"><button class="btn" id="sh-fembark">Take warbots aboard</button><button class="btn" id="sh-fland">Put them ashore</button></div>
      <button class="btn" id="sh-found">Found a Port on another shore</button>
      <p class="hint"><b>Sail somewhere</b>: it sails to the spot you tap (open water, or right up to a shore) and waits there for your orders. <b>Take warbots aboard</b> loads your warbots standing within ${Math.floor(FERRY_REACH)} tiles of it (with a mouse, select warbots and right-click the Ferry: they walk to the shore beside it and board). <b>Put them ashore</b> lands them on the shore beside it, and it heads home. <b>Found a Port</b>: it loads ${costText(PORT_FOUND.cost)} at its Port and up to ${PORT_FOUND.workers} Workers, and puts up a Port on an empty shore that claims the land round it.</p>` : ''}
    ${u.owner === 0 && BOTS[u.type].crawler ? '<div class="actions"><button class="btn primary" id="sh-crawl">Drive somewhere</button><button class="btn" id="sh-deploy">Deploy here</button></div>' : ''}
    ${u.owner === 0 && BOTS[u.type].siege ? `<div class="actions"><button class="btn primary" id="sh-bombard">Bombard a building</button><button class="btn" id="sh-rgo">Drive somewhere</button></div>
      <div class="section-label">While it waits</div><div class="seg" id="sh-stance"><button data-v="fire">Fire at will</button><button data-v="hold">Hold fire</button></div>
      <p class="hint">It stays where you put it (beside the Foundry when it's new). <b>Fire at will</b>: it shells any enemy building that comes in reach of that spot, without moving. <b>Hold fire</b>: it fires only when you tell it to. After reloading it goes back to its target, or to its spot. With a mouse, select it and right-click a rival building to bombard it, or open ground to move it there.</p>` : ''}`;
  openSheet('bot', u.id, html);
  if ($('sh-strike')) $('sh-strike').onclick = () => { const why = u.mission || u.flight ? 'It\'s already out on a sortie.' : ''; if (why) { sfx('error'); toast(why, 'warn'); return; } sfx('click'); startStrike(u); };
  if ($('sh-fsail')) {
    const done = (r, ok) => { if (typeof r === 'string' && r) { sfx('error'); toast(r, 'warn'); } else { sfx('order'); if (ok) toast(ok, 'info'); } refreshSheet(); };
    $('sh-fsail').onclick = () => { sfx('click'); closeSheet(); setMode('fsail'); UI.ferry = u.id; showBanner('Tap where the <b>Ferry</b> should sail: open water, a spot on the shore (it comes right up to it), or one of your Ports.', null, 'Cancel'); };
    $('sh-fhome').onclick = () => { ferryBack(u); done('', 'The Ferry is heading back to its Port and its line.'); };
    $('sh-fembark').onclick = () => { const r = embarkWarbots(0, u, null); done(r, typeof r === 'number' ? `${r} warbot${r === 1 ? '' : 's'} came aboard.` : ''); };
    $('sh-fland').onclick = () => { done(disembark(0, u), 'Put ashore: they hold the beach, and the Ferry heads home.'); };
    $('sh-found').onclick = () => { sfx('click'); startLanding(u, 0, 'port'); };
  }
  if ($('sh-crawl')) $('sh-crawl').onclick = () => { sfx('click'); UI.crawler = u.id; setMode('crawl'); UI.crawler = u.id; showBanner('Tap where the <b>Crawler</b> should go: it rolls there (no road needed, but it can\'t climb cliffs or cross water) and deploys when it arrives.', null, 'Cancel'); };
  if ($('sh-deploy')) $('sh-deploy').onclick = () => { const why = deployCrawler(u); if (why) { sfx('error'); toast(why, 'warn'); } else closeSheet(); };
  if ($('sh-bombard')) $('sh-bombard').onclick = () => { sfx('click'); closeSheet(); setMode('bombard'); UI.rocket = u.id; showBanner(`Tap an enemy building: the <b>Rocket Truck</b> drives to within ${ROCKET.range} tiles of it, parks and fires its ${ROCKET.salvo} rockets, then reloads and comes back for more.`, null, 'Cancel'); };
  if ($('sh-stance')) {
    const sync = () => { for (const btn of $('sh-stance').children) btn.classList.toggle('on', btn.dataset.v === (u.stance === 'hold' ? 'hold' : 'fire')); };
    for (const btn of $('sh-stance').children) btn.onclick = () => { u.stance = btn.dataset.v === 'hold' ? 'hold' : undefined; if (u.stance === 'hold' && u.task && u.task.auto) { u.task = null; u.salvo = null; u.deployT = 0; } sfx('click'); sync(); };
    sync();
  }
  if ($('sh-rgo')) $('sh-rgo').onclick = () => { sfx('click'); closeSheet(); setMode('rgo'); UI.rocket = u.id; showBanner('Tap where the <b>Rocket Truck</b> should wait: it stays there, and (unless it holds fire) shells any enemy building in reach of it.', null, 'Cancel'); };
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
    <div class="stepper"><button class="btn" id="mv-minus" aria-label="Fewer warbots">−</button><span class="n" id="mv-n">0</span>
      <button class="btn" id="mv-plus" aria-label="More warbots">+</button><button class="btn primary" id="mv-send" style="flex:1">Send warbots</button></div>`;
  openSheet('move', tIdx(i, j), html);
  UI.moveN = Math.min(5, rallyAvailable(0, i, j));
  $('mv-minus').onclick = () => { UI.moveN = Math.max(1, UI.moveN - 1); refreshSheet(); };
  $('mv-plus').onclick = () => { UI.moveN = Math.min(rallyAvailable(0, i, j), UI.moveN + 1); refreshSheet(); };
  $('mv-send').onclick = () => {
    const res = sendToRally(0, i, j, UI.moveN);
    if (res.sent) { sfx('order'); toast(`${res.sent} warbot${res.sent > 1 ? 's are' : ' is'} on the way. Tap the flag to call them back.`, 'info'); closeSheet(); }
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
    <div class="stepper"><button class="btn" id="mv-minus" aria-label="Fewer warbots">−</button><span class="n" id="mv-n">0</span>
      <button class="btn" id="mv-plus" aria-label="More warbots">+</button><button class="btn primary" id="mv-send" style="flex:1">Send warbots</button></div>`;
  openSheet('rally', r.id, html);
  const i = Math.floor(r.x), j = Math.floor(r.y);
  UI.moveN = Math.min(3, rallyAvailable(0, i, j));
  $('rl-recall').onclick = () => { const n = recallRally(r.id); toast(`${n} warbot${n !== 1 ? 's' : ''} called back.`, 'info'); sfx('click'); closeSheet(); };
  $('mv-minus').onclick = () => { UI.moveN = Math.max(1, UI.moveN - 1); refreshSheet(); };
  $('mv-plus').onclick = () => { UI.moveN = Math.min(rallyAvailable(0, i, j), UI.moveN + 1); refreshSheet(); };
  $('mv-send').onclick = () => { const res = sendToRally(0, i, j, UI.moveN); if (res.sent) { sfx('order'); refreshSheet(); } else sfx('error'); };
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

/** Can the player mark this tile for asphalt? Their own roads, and roads they've planned. */
function paveMarkable(t) {
  return S.road[t] ? wayOwner(t) === 0 : S.plan[t] === 1;
}

/** The player's roads marked for asphalt: how many, and how many are fresh, worn or still to pave. */
function paveCounts(owner) {
  const c = { marked: 0, fresh: 0, worn: 0, todo: 0 };
  for (let t = 0; t < S.W * S.H; t++) {
    if (!S.paveMark[t] || !(S.road[t] ? wayOwner(t) === owner : S.plan[t] === owner + 1)) continue;
    c.marked++;
    if (S.pave[t] !== 2) c.todo++;
    else if (S.wear[t] >= REPAVE_AT) c.worn++;
    else c.fresh++;
  }
  return c;
}

/** Tap one of your roads: its surface, how worn it is, and whether a Roadworks looks after it. */
function openRoadSheet(t) {
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const html = `<div class="sheet-title"><div><h3 id="rd-name"></h3></div></div><div id="sh-dyn"></div>
    <div class="actions"><button class="btn" id="rd-mark"></button><button class="btn ghost" id="rd-paths">Mark more roads</button></div>`;
  openSheet('road', t, html);
  $('rd-mark').onclick = () => { setPaveMark(0, t % S.W, (t / S.W) | 0, !S.paveMark[t]); sfx('click'); refreshSheet(); };
  $('rd-paths').onclick = () => openPaths('pave');
  refreshSheet();
}

function refreshRoadSheet(t) {
  if (!S.road[t]) { closeSheet(); return; }
  const asphalt = S.pave[t] === 2, w = Math.round(S.wear[t] / 10);
  const cross = crossTile(t) ? (S.terrain[t] === T_ROCK ? ' tunnel' : S.terrain[t] === T_CHASM ? ' sky bridge' : ' bridge') : '';
  $('rd-name').textContent = (asphalt ? 'Asphalt' : 'Concrete') + (cross || ' road');
  const speed = asphalt ? asphaltSpeed(S.wear[t]) : PAVE[1].speed;
  $('sh-dyn').innerHTML = `<div class="kv"><span>Speed</span><span>${Math.round(speed * 100) / 100}× off-road</span></div>` +
    (asphalt ? `<div class="kv"><span>Wear</span><span>${w}%${S.wear[t] >= REPAVE_AT ? ' (due for resurfacing)' : ''}</span></div>
      <div class="bar"><div style="width:${w}%;background:${w >= 75 ? '#ff4d4d' : w >= 50 ? '#ffb347' : '#7ee08a'}"></div></div>` : '') +
    `<p class="desc">${S.paveMark[t] ? 'Marked for asphalt: a Roadworks joined to it paves it and resurfaces it as it wears.'
      : asphalt ? 'Not marked: once it wears through it drops back to plain road. Mark it to have a Roadworks maintain it.'
      : 'Mark it for asphalt and a Roadworks joined to it will pave it (2¾× speed).'} Busy roads wear fastest, and Freight Trucks wear them three times as fast as other bots.</p>`;
  $('rd-mark').textContent = S.paveMark[t] ? 'Clear the asphalt mark' : 'Mark for asphalt';
}

/** A neutral Trade Post: what it is, who has docked there, and how to start trading. */
function openPostSheet(post) {
  const t = tIdx(post.x, post.y);
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const html = `<div class="sheet-title"><div><h3>Trade Post</h3><div class="sub">Neutral: nobody owns it</div></div></div>
    <p class="desc">An off-world exchange. Any colony can trade here: dock a <b>Trade Terminal</b> beside it (Build, Move, within ${TRADE_POST.dock} tiles of the pad) and lay a road or track out to the Terminal. Only Road Trains and Freight Trains serve it. A rival's land round the post keeps you out (no Terminal and no road on their ground), so an Outpost of yours beside it keeps them out. Further from your Command Base pays more.</p>
    <div id="sh-dyn"></div>
    <div class="btn-row"><button class="btn primary" id="sh-dock">Dock a Trade Terminal here</button></div>`;
  openSheet('post', t, html);
  $('sh-dock').onclick = () => { sfx('click'); enterPlaceMode('terminal'); };
  refreshSheet();
}

function openSoilSheet(t) {
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const html = `<div class="sheet-title"><div><h3>Fertile soil</h3></div></div>
    <p class="desc">Dark, rich ground. A Bio Farm within ${BDEFS.farm.radius} tiles plants energy crops here and harvests them into Fuel for your Fuel Stations. Paths and buildings on it leave less room to farm.</p>`;
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
  // The figures are rewritten when they change; the chart's canvas stays put (a drag across it reads it)
  // and is redrawn only for another good or a new sample.
  if (full) $('gs-body').innerHTML = `<div id="gs-info"></div><div class="section-label">On hand over time</div><canvas class="chart small" id="gs-chart"></canvas>
    <p class="hint">Rates are over the last two minutes. The Statistics screen in the pause menu shows the whole game.</p>`;
  const info = `<p class="desc">${GOOD[g].desc}</p>${status}
    <div class="gs-stats">
      <div><b>${fmt(total)}</b><span>on hand</span></div>
      <div><b class="up">+${fmt(rate.made)}</b><span>made / min</span></div>
      <div><b class="down">−${fmt(rate.used)}</b><span>used / min</span></div>
      <div><b class="${net > 0.05 ? 'up' : net < -0.05 ? 'down' : ''}">${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}</b><span>net / min</span></div>
    </div>
    <div class="kv"><span>In storage</span><span>${esc(stored)}</span></div>
    <div class="kv"><span>Waiting for pickup at buildings</span><span>${esc(waiting)}</span></div>
    <div class="kv"><span>Wanted right now</span><span>${wantN ? `${wantN} by ${wantB} building${wantB === 1 ? '' : 's'}` : 'Nothing waiting'}</span></div>
    <div class="section-label">Made by</div><div class="goodlist">${list(makers, g === 'cement' || g === 'alloy' ? 'Nothing yet.' : 'Nothing makes it yet.')}</div>
    <div class="section-label">Used by</div><div class="goodlist">${list(users, 'No buildings use it.')}</div>${extraUse ? `<p class="hint">${extraUse.trim()}</p>` : ''}`;
  const box = $('gs-info'), cv = $('gs-chart');
  if (box.dataset.html !== info) { box.dataset.html = info; box.innerHTML = info; }
  const H = S.hist, key = g + ':' + (H ? H.t.length + ':' + (H.t[H.t.length - 1] || 0) : '');
  if (cv.dataset.key === key) return;
  cv.dataset.key = key;
  if (H && H.t.length > 1 && H.p[0].goods && H.p[0].goods[g]) lineChart(cv, { xs: H.t, series: [{ name: GOOD[g].name, color: GOOD[g].color, values: H.p[0].goods[g] }] });
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
    } else if (tt === 'charge' || tt === 'refuel' || (u.inside && insideCharger(u) && !tt && (u.bat ?? 100) < 99)) add(u.type, 'charging');
    else if (tt === 'haul') add(u.type, 'carrying');
    else if (tt === 'staff') add(u.type, 'running');
    else if (tt === 'build' || tt === 'pave' || tt === 'fix') add(u.type, 'building');
    else if (tt === 'repair') add(u.type, 'repairing');
    else add(u.type, 'free');
  }
  const part = (o, k, label) => (o[k] ? `${o[k]} ${label}` : '');
  const rows = BOT_ORDER.filter((k) => n[k] || ((warOn() || !BOTS[k].war) && (navalMap() || !BOTS[k].naval))).map((k) => {
    const o = n[k] || { total: 0 };
    const bits = k === 'warbot'
      ? [part(o, 'garrison', 'in garrisons'), part(o, 'field', 'in the field'), part(o, 'noAmmo', 'out of Ammo')]
      : [part(o, 'running', 'running buildings'), part(o, 'carrying', 'carrying goods'), part(o, 'building', 'building or paving'),
        part(o, 'charging', 'recharging'), part(o, 'repairing', 'being repaired'), part(o, 'free', 'free')];
    return `<div class="kv pop-row"><span><b>${o.total}</b> ${o.total === 1 ? BOTS[k].name : BOTS[k].plural}</span><span>${bits.filter(Boolean).join(' · ') || '–'}</span></div>`;
  });
  const cap = S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS;
  let wb = '';
  if (warOn() && n.warbot) {
    const g = warbotGroups();
    wb = '<div class="section-label">Where your warbots are</div>' + WARBOT_PLACES.filter(([k]) => g[k].length).map(([k, label]) =>
      `<div class="kv pop-row"><span>${label}</span><span><b>${g[k].length}</b> <button class="btn small ghost" data-wb="${k}">Show</button></span></div>`).join('') +
      '<p class="hint">Show takes you to each in turn. Warbots stationed at an Outpost come back to it after a fight; every other one belongs to the Command Base.</p>';
  }
  // Rebuilt only when something shown changes, so a click on Show isn't lost between press and release.
  const el = $('sh-pop'), html = rows.join('') + `<div class="kv"><span>All robots</span><span><b>${total}</b> of ${cap} (the limit)</span></div>` + wb;
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
  for (const btn of el.querySelectorAll('[data-wb]')) btn.onclick = () => showWarbots(btn.dataset.wb);
}

const WARBOT_PLACES = [['base', 'At the Command Base'], ['posted', 'In Outposts and Bunkers'], ['home', 'Heading back to a garrison'], ['attack', 'Attacking'],
  ['hold', 'Holding a rally flag'], ['defend', 'Out guarding a garrison'], ['fix', 'Being repaired or recharging'], ['loot', 'Carrying loot home'],
  ['idle', 'Standing in the field (no garrison with room)']];

/** Your warbots sorted by where they are and what they're doing (WARBOT_PLACES). */
function warbotGroups() {
  const g = {};
  for (const [k] of WARBOT_PLACES) g[k] = [];
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0 || u.type !== 'warbot') continue;
    const tt = u.task && u.task.type, inB = u.inside ? getE(u.inside) : null;
    if (inB && inB.type === 'lander') g.base.push(u);
    else if (inB && BDEFS[inB.type].repair) g.fix.push(u);
    else if (inB) g.posted.push(u);
    else if (tt === 'attack') g.attack.push(u);
    else if (tt === 'hold') g.hold.push(u);
    else if (tt === 'defend') g.defend.push(u);
    else if (tt === 'repair' || tt === 'topup') g.fix.push(u);
    else if (tt === 'loot') g.loot.push(u);
    else if (tt === 'garrison') g.home.push(u);
    else g.idle.push(u);
  }
  return g;
}

/** Take the camera to the next of your warbots in group k (each tap, the next one) and open its panel. */
function showWarbots(k) {
  const list = warbotGroups()[k];
  if (!list || !list.length) return;
  UI.wbShow = UI.wbShow || {};
  const i = (UI.wbShow[k] || 0) % list.length;
  UI.wbShow[k] = i + 1;
  const u = list[i], inB = u.inside ? getE(u.inside) : null;
  closeSheet();
  if (inB) { centerOn(inB.x + 0.5, inB.y + 0.5); openBuildingSheet(inB); }
  else { centerOn(u.x, u.y); openBotSheet(u); }
  toast(`${WARBOT_PLACES.find((p) => p[0] === k)[1]}: warbot ${i + 1} of ${list.length}. Tap Show again in Your robots for the next.`, 'info');
}

function refreshSheet() {
  if (!UI.sheetKind || UI.sheetKind === 'build') return;
  markSheetKeys();
  if (UI.sheetKind === 'pop') { refreshPopSheet(); return; }
  if (UI.sheetKind === 'goods') { refreshGoodsSheet(false); return; }
  if (UI.sheetKind === 'road') { refreshRoadSheet(UI.sheetFor); return; }
  if (UI.sheetKind === 'bld') {
    const b = getE(UI.sheetFor);
    if (!b || b.dead) { closeSheet(); return; }
    // Captured (or won) while its panel was open: the panel is built again for its new owner.
    if (sheetStale()) { openBuildingSheet(b); return; }
    refreshBuildingSheet(b);
  } else if (UI.sheetKind === 'bot') {
    const u = getE(UI.sheetFor);
    if (!u || u.inside) { closeSheet(); return; }
    $('sh-status').textContent = botActivity(u);
    const bat = Math.round(u.bat ?? 100);
    $('sh-dyn').innerHTML = `<div class="kv"><span>Health</span><span>${Math.ceil(u.hp)} / ${esc(u.maxHp)}</span></div>` +
      `<div class="kv"><span>${BOTS[u.type].truck ? 'Fuel tank' : 'Battery'}</span><span>${bat}%${bat < BATTERY.critical ? (BOTS[u.type].truck ? ' (empty: crawling)' : ' (flat: slow and weak)') : bat < BATTERY.low ? ' (low)' : ''}</span></div>` +
      `<div class="bar battery"><div style="width:${bat}%;background:${bat < BATTERY.critical ? '#ff4d4d' : bat < BATTERY.low ? '#ffb347' : '#7ee08a'}"></div></div>` +
      (u.type === 'warbot' ? `<div class="kv"><span>Ammo</span><span>${esc(u.ammo ?? WARBOT_AMMO)} / ${WARBOT_AMMO} shots${!u.ammo ? ' (out: can\'t fight until it reloads)' : ''}</span></div>` : '') +
      (BOTS[u.type].siege ? `<div class="kv"><span>Rockets</span><span>${esc(u.rockets ?? ROCKET.salvo)} / ${ROCKET.salvo}${!(u.rockets ?? ROCKET.salvo) ? ` (reloads ${ROCKET.ammo} Ammo at a garrison or storage)` : ''}</span></div><div class="kv"><span>Reach</span><span>${ROCKET.min} to ${ROCKET.range} tiles</span></div>` : '') +
      (u.carry ? `<div class="kv"><span>Carrying</span><span>${goodTag(u.carry, (u.carryN > 1 ? u.carryN + ' × ' : '') + GOOD[u.carry].name)}</span></div>` : '') +
      (u.cargo && Object.keys(u.cargo).length ? `<div class="section-label">On board</div><div class="goodlist">${Object.keys(u.cargo).map((g) => goodTag(g, `${u.cargo[g]} ${GOOD[g].name}`)).join('')}</div>` : '');
    if ($('sh-recall')) $('sh-recall').hidden = !(u.task && u.task.type === 'hold');
  } else if (UI.sheetKind === 'move') {
    const t = UI.sheetFor, i = t % S.W, j = (t / S.W) | 0;
    const avail = refreshMoveStepper(i, j);
    $('mv-info').innerHTML = `<p class="desc">${avail
      ? `${avail} armed warbot${avail > 1 ? 's' : ''} available in your garrisons (each keeps its Keep at home).`
      : S.zone[t] !== homeZone(0) ? 'Your warbots cannot walk there from your garrisons.' : 'No armed warbots available. Make some at the Bot Foundry, and keep your garrisons stocked with Ammo: warbots without it can\'t fight.'}</p>`;
  } else if (UI.sheetKind === 'rally') {
    const r = rallyById(UI.sheetFor);
    if (!r) { closeSheet(); return; }
    const members = rallyMembers(r.id);
    const low = members.filter((u) => (u.bat ?? 100) < BATTERY.low).length;
    $('rl-info').innerHTML = `<div class="kv"><span>Warbots holding</span><span>${members.length}</span></div>` +
      (low ? `<div class="kv"><span>Low battery</span><span>${low}</span></div>` : '');
    refreshMoveStepper(Math.floor(r.x), Math.floor(r.y));
  } else if (UI.sheetKind === 'post') {
    const post = postAt(UI.sheetFor);
    if (!post) { closeSheet(); return; }
    const docks = S.buildings.filter((b) => !b.dead && BDEFS[b.type].terminal && nearPost(b.x, b.y) === post);
    const who = docks.map((b) => (b.owner === 0 ? 'You' : playerName(b.owner)) + (b.built ? '' : ' (building)')).join(', ') || 'Nobody yet';
    const L = getE(S.players[0].lander), holder = S.owner[UI.sheetFor];
    $('sh-dyn').innerHTML = `<div class="kv"><span>Docked here</span><span>${who}</span></div>` +
      (L ? `<div class="kv"><span>From your Command Base</span><span>${dirText(L, post)}</span></div>` : '') +
      (holder >= 0 ? `<div class="kv"><span>Land round it</span><span>${holder === 0 ? 'Yours' : playerName(holder) + '\'s'}</span></div>` : '');
    const mine = docks.some((b) => b.owner === 0);
    $('sh-dock').hidden = mine;
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

/* The opening goals, in order. `build`: the buildings a step asks for, pinned at the top of the Build list while it's the step (nextBuilds). */
const OBJECTIVES = [
  { text: 'Robots run on batteries, and your Command Base can\'t charge them. Tap <b>Build</b> and place a <b>Fuel Station</b> beside the road ring round your base: it runs on the Fuel you landed with.', build: ['charger'], done: () => hasBuilt('charger') || hasAny('charger') },
  { text: 'Tap <b>Build</b> and place a <b>Harvester</b> beside the teal stalk groves.', build: ['harvester'], done: () => hasBuilt('harvester') || hasAny('harvester') },
  { text: '<b>Haulers only drive on roads.</b> Tap <b>Paths</b>, sketch a road from the ring round your Command Base to the Harvester site and tap <b>Build</b> (or tap the site and choose <b>Lay road</b>). Free workers pave it.', done: () => hasBuilt('harvester') || S.buildings.some((b) => !b.dead && b.owner === 0 && b.type === 'harvester' && !b.unlinked) },
  { text: 'Build a <b>Quarry</b> near the grey boulders to get Stone.', build: ['quarry'], done: () => hasBuilt('quarry') },
  { text: 'Build a <b>Cement Works</b> near your Command Base: it bakes Stone into <b>Cement</b>, which nearly every building and every road is made of.', build: ['kiln'], done: () => hasBuilt('kiln') },
  { text: 'Build an <b>Ore Mine</b> by the dark ore veins and a <b>Crystal Tap</b> by the violet crystals.', build: ['mine', 'tap'], done: () => hasBuilt('mine') && hasBuilt('tap') },
  { text: 'Build a <b>Smelter</b>: it turns Ore and Fiber into Alloy.', build: ['smelter'], done: () => hasBuilt('smelter') },
  { text: 'Build a <b>Chip Fab</b>: it turns Crystal and Alloy into Chips.', build: ['fab'], done: () => hasBuilt('fab') },
  { text: 'Build a <b>Bot Foundry</b> so you can make more workers.', build: ['foundry'], done: () => hasBuilt('foundry') },
  { text: 'Tap your <b>Bot Foundry</b> and order some <b>Workers</b>: it only builds the bots you ask for.', done: () => S.players[0].stats.bots > S.players[0].stats.startBots || S.buildings.some((b) => !b.dead && b.owner === 0 && hasOrders(b)) },
  { text: 'Build an <b>Outpost</b> near your border to claim more land.', build: ['outpost'], done: () => hasBuilt('outpost') },
  { text: 'Fuel Stations burn <b>Fuel</b>. Build a <b>Bio Farm</b> beside the dark fertile soil to grow it (your Agribot runs it).', build: ['farm'], done: () => hasBuilt('farm') || hasBuilt('refinery') || playerGoods(0).fuel >= 20 },
  { text: 'Busy crossings jam up. In <b>Paths</b>, choose <b>Junctions</b> and put a traffic light on a junction where three or four roads meet.', done: () => Object.keys(S.lights).some((k) => S.lights[k].owner === 0) || !ownJunction() },
  { text: 'Warbots need <b>Ammo</b>. Build an <b>Ammo Plant</b>: haulers stock your Command Base and Outposts and warbots reload there.', build: ['armory'], done: () => S.mode === 'colony' || hasBuilt('armory') },
];

function ownJunction() {
  const net = roadNet();
  for (let t = 0; t < S.W * S.H; t++) if (net.junc[t] && wayOwner(t) === 0) return true;
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

/** The step the goal card is on (the first not done), or null: in a mission, or with every step done. */
function objectiveStep() {
  if (S.mission) return null;
  for (const o of OBJECTIVES) if (!o.done()) return o;
  return null;
}

/** The buildings the current step asks for that you haven't placed yet: the Build list pins them at the top. */
function nextBuilds() {
  const o = objectiveStep();
  return o && o.build ? o.build.filter((t) => !hasAny(t)) : [];
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
  return S.players.length > 2 ? 'Gather warbots in Outposts near a rival, then tap its <b>Command Base</b> and send them in. Take both rival Command Bases to win.'
    : 'Gather warbots in Outposts near the rival, then tap the <b>rival Command Base</b> and send them in to capture it.';
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
    else if (u.type === 'hauler' || u.type === 'truck' || u.type === 'tanker') haulers++;
    else if (u.type === 'worker') { workers++; if (isIdleWorker(u)) idle++; }
  }
  $('pop').title = `${workers} workers (${idle} free), ${haulers} haulers, trucks and Tankers` + (warOn() ? `, ${war} warbots` : '') + '. Tap for every robot by type.';
  $('pop').innerHTML = `<span class="dot" style="background:#ece6da;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[0]}"></span>${workers}<span class="wide"> workers</span> <span style="color:var(--muted)">(${idle} free)</span>` +
    ` <span class="dot" style="background:#ffb547;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[0]}"></span>${haulers}<span class="wide"> haulers</span>` +
    (warOn() ? ` <span class="dot" style="background:${PLAYER_COLORS[0]};border-radius:2px;transform:rotate(45deg)"></span>${war}` : '');
  // With day and night on, the time of day leads (a sun, a half-lit disc at dawn and dusk, a moon).
  const tn = todAt(S.time).name, tod = todEnabled() ? `<span class="tod-mark" style="color:${{ morning: '#ffb38a', day: '#ffd166', evening: '#ff8a4a', night: '#b8c8ff' }[tn]}">${tn === 'night' ? '☾' : '☀'}</span> ` : '';
  const ct = tod + (S.mode === 'colony' ? `${Math.round(landShare(0) * 100)}% land` : fmtTime(S.time));
  if ($('clock').innerHTML !== ct) $('clock').innerHTML = ct;
  $('clock').title = todEnabled() ? TOD_NAMES[todAt(S.time).name] : '';
  const obj = $('objective');
  // Where the screen is small the card folds away at the first tap on the map (onMapTap) and opens again for each
  // new step, unless you've folded or opened it yourself. Folded, it still says how many buildings have no road.
  const step = objectiveStep(), stepKey = step ? OBJECTIVES.indexOf(step) : -1;
  if (UI.objStep !== stepKey) { if (UI.objStep !== undefined && UI.objAuto && !UI.objManual) { UI.objCollapsed = false; UI.objAuto = false; } UI.objStep = stepKey; }
  const cut = UI.objCollapsed && !S.mission ? S.buildings.filter((b) => !b.dead && b.owner === 0 && b.unlinked).length : 0;
  obj.innerHTML = UI.objCollapsed && !S.mission ? 'Goal ▸' + (cut ? ` <span class="err">${cut} with no road</span>` : '') : objectiveText();
  obj.classList.toggle('small', UI.objCollapsed);
  // (The messages button sits beside the folded card on a small screen: the open card needs the whole width.)
  $('btn-msgs').hidden = !UI.msgLog.length || (!UI.objCollapsed && !isWide());
  updateEventCard();
  updateNukeCard();
  if (UI.sheetKind === 'build') {
    // keep build-menu affordability (and the site count: at the limit no card can be picked) current without rebuilding the buttons
    const sites = siteCount(0);
    if ($('build-sites')) $('build-sites').textContent = sites;
    for (const el of $('sheet-body').querySelectorAll('.bcard[data-t]')) {
      const cost = BDEFS[el.dataset.t].cost;
      el.disabled = sites >= MAX_SITES;
      el.querySelector('.bcost').innerHTML = costHTML(cost, goods) + (el.dataset.t === 'viaduct' ? ' a tile' : '');
      const have = el.querySelector('.bhave');
      const txt = ownedText(el.dataset.t);
      if (have.textContent !== txt) have.textContent = txt;
      have.classList.toggle('some', txt !== 'None yet' && txt !== '');
    }
  }
}

/**
 * The planet event card under the top bar: what's coming or under way, a countdown, and (for the
 * trader ship) the deal on offer with a Trade button. Rebuilt only when its content changes, so a
 * tap on Trade isn't lost to the countdown ticking.
 */
function updateEventCard() {
  const el = $('event-card'), E = S.events ? S.event : null;
  if (!E) { el.hidden = true; el.dataset.key = ''; return; }
  const def = EVENTS[E.type], soon = S.time < E.t0, o = E.offers && E.offers[0];
  const key = `${E.n}|${soon}|${o ? (o.done ? 'done' : 'open') : 'none'}|${!!E.started}`;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.className = 'event-card' + (E.type === 'trader' ? ' trader' : '');
    let html = `<div class="ev-head"><span class="ev-dot" style="background:${def.color};color:${def.color}"></span><b>${soon ? def.name + ' coming' : def.name}</b><span class="ev-time"></span></div>`;
    if (E.type !== 'trader') html += `<div class="ev-desc">${def.desc}</div>`;
    else if (!E.started) html += '';
    else if (!o) html += '<div class="ev-desc">It wants nothing you have spare.</div>';
    else if (o.done) html += `<div class="ev-desc">Deal done: ${esc(o.m)} ${GOOD[o.get].name} delivered to your Command Base.</div>`;
    else {
      html += `<div class="ev-deal"><span>Give <b>${esc(o.n)}</b> <i class="gi ${esc(o.give)}"></i> ${GOOD[o.give].name}, get <b>${esc(o.m)}</b> <i class="gi ${esc(o.get)}"></i> ${GOOD[o.get].name}</span>` +
        '<button class="btn small primary" id="ev-trade">Trade</button></div>';
    }
    el.innerHTML = html;
    const btn = $('ev-trade');
    if (btn) btn.onclick = () => {
      const why = acceptTrade(0);
      if (why) { sfx('error'); toast(why, 'bad'); } else sfx('complete');
      updateHUD();
    };
  }
  const left = Math.max(0, Math.ceil((soon ? E.t0 : E.t1) - S.time));
  el.querySelector('.ev-time').textContent = soon ? `in ${left}s` : `${left}s`;
  el.hidden = false;
}

/**
 * A nuclear missile heading for something of yours: where and when it lands, and an Evacuate button
 * that sends every robot in the blast ring out of it (garrisons too) until it has gone off.
 */
function updateNukeCard() {
  const el = $('nuke-card');
  const threats = S.missiles && S.missiles.some((m) => m.nuke) ? nukesThreatening(0) : [];
  if (!threats.length) { el.hidden = true; el.dataset.key = ''; return; }
  const m = threats.reduce((a, c) => (c.dur - c.t < a.dur - a.t ? c : a));
  const done = threats.every((n) => evacuating(0, n)), mine = m.owner === 0;
  const inRing = S.bots.filter((u) => !u.dead && u.owner === 0 && !BOTS[u.type].rail && !(u.task && u.task.type === 'flee') &&
    dist2(u.inside ? getE(u.inside).x + 0.5 : u.x, u.inside ? getE(u.inside).y + 0.5 : u.y, m.x1, m.y1) <= (NUKE.radius + EVAC_MARGIN) ** 2).length;
  const fleeing = S.bots.filter((u) => !u.dead && u.owner === 0 && u.task && u.task.type === 'flee').length;
  const key = `${done}|${mine}|${threats.length}`;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.classList.toggle('safe', done);
    el.innerHTML = `<div class="ev-head"><span class="ev-dot" style="background:#ff5a5a;color:#ff5a5a"></span><b>${mine ? 'Your nuclear missile' : 'Nuclear missile incoming'}</b><span class="ev-time"></span></div>` +
      `<div class="ev-deal"><span class="ev-desc nk-text"></span>${done ? '' : '<button class="btn small primary" id="nk-evac">Evacuate</button>'}</div>`;
    const btn = $('nk-evac');
    if (btn) btn.onclick = () => {
      const n = startEvac(0);
      sfx(n ? 'click' : 'error');
      toast(n ? `Evacuating: ${n} robot${n === 1 ? '' : 's'} leaving the blast ring.` : 'The blast ring is clear: robots will keep out until it lands.', 'warn', Math.floor(m.x1), Math.floor(m.y1));
      updateNukeCard();
    };
    el.onclick = (e) => { if (e.target.id !== 'nk-evac') centerOn(m.x1, m.y1); };
  }
  el.querySelector('.ev-time').textContent = `${Math.max(0, Math.ceil(m.dur - m.t))}s`;
  el.querySelector('.nk-text').textContent = done
    ? (fleeing ? `Evacuating: ${fleeing} robot${fleeing === 1 ? '' : 's'} clearing the red ring.` : 'The red ring is clear. Robots keep out until it lands.')
    : `${inRing} of your robots ${inRing === 1 ? 'is' : 'are'} in the red ring (garrisons too).`;
  el.hidden = false;
}

/**
 * A message at the top of the screen. It stays for a time that fits its length (3.8 s for a short one, up to 12),
 * lets taps through to the map under it, and has a Go chip when it's about a place. While a game is on it is
 * also kept (the last MSG_KEEP) for the list behind the messages button, beside the goal card.
 */
const MSG_KEEP = 20;
function toast(text, kind, x, y) {
  const box = $('toasts'), where = x !== undefined && (x || y);
  if (UI.inGame && S) {
    const last = UI.msgLog[UI.msgLog.length - 1];
    if (last && last.text === text) last.n++;
    else { UI.msgLog.push({ text, kind: kind || 'info', x: where ? x : -1, y: where ? y : -1, t: S.time, n: 1 }); if (UI.msgLog.length > MSG_KEEP) UI.msgLog.shift(); }
    if (UI.sheetKind === 'msgs') openMsgSheet();
  }
  // Repeat messages (e.g. several buildings finishing at once) collapse into one line.
  const prev = box.lastElementChild;
  if (prev && prev.dataset.text === text) {
    prev.dataset.n = (+prev.dataset.n || 1) + 1;
    prev.firstChild.textContent = `${text} ×${prev.dataset.n}`;
    return;
  }
  const el = document.createElement('div'), line = document.createElement('span');
  el.className = 'toast ' + (kind || 'info');
  line.textContent = text;
  el.appendChild(line);
  if (where) {
    const go = document.createElement('button');
    go.className = 'toast-go'; go.textContent = 'Go'; go.setAttribute('aria-label', 'Go there');
    go.onclick = () => centerOn(x + 0.5, y + 0.5);
    el.appendChild(go);
  }
  el.dataset.text = text;
  box.appendChild(el);
  while (box.children.length > 2) box.removeChild(box.firstChild);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, clamp(3800 + 60 * (text.length - 60), 3800, 12000));
}

/** The messages that have gone by, newest first, each with the game time it came at and Go if it has a place. */
function openMsgSheet() {
  const rows = UI.msgLog.slice().reverse().map((m, k) => `<div class="msg-row ${esc(m.kind)}"><span class="msg-t">${fmtTime(m.t)}</span><span>${esc(m.text)}${m.n > 1 ? ` ×${m.n}` : ''}</span>` +
    (m.x >= 0 ? `<button class="btn small" data-k="${UI.msgLog.length - 1 - k}">Go</button>` : '<span></span>') + '</div>').join('');
  openSheet('msgs', 0, `<div class="sheet-title"><div><h3>Messages</h3></div></div>
    <p class="desc">The last ${UI.msgLog.length} message${UI.msgLog.length === 1 ? '' : 's'}, newest first.</p><div class="msg-list">${rows}</div>`);
  for (const btn of $('sheet-body').querySelectorAll('.msg-row [data-k]')) btn.onclick = () => { const m = UI.msgLog[+btn.dataset.k]; sfx('click'); closeSheet(); if (m) centerOn(m.x + 0.5, m.y + 0.5); };
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
  if (UI.hudT <= 0) { UI.hudT = 0.25; updateHUD(); refreshSheet(); placeMinimap(); refreshSelection(); syncWakeLock(); }
  if (S.winner >= 0 && !UI.overShown) showGameOver();
}

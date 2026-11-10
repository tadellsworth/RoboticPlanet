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
  for (const btn of $('m-diff').children) btn.onclick = () => { UI.menu.diff = btn.dataset.v; syncMenu(); saveSettings(); sfx('click'); };
  for (const btn of $('m-players').children) btn.onclick = () => { UI.menu.players = +btn.dataset.v; syncMenu(); saveSettings(); sfx('click'); };
  $('m-reroll').onclick = () => { UI.menu.seed = randomSeed(); syncMenu(); sfx('click'); };
  // Map settings sliders (remembered on this device; map size is remembered per mode).
  // Settings from before v2 drop their rival style, Nuclear race and Planet events, so the new defaults
  // (a Balanced rival, Nuclear race on, Planet events off) reach every device once.
  try {
    const saved = JSON.parse(localStorage.getItem('botfall.settings') || '{}');
    if ((saved.v || 0) < SETTINGS_V) { delete saved.style; delete saved.nuke; delete saved.events; }
    Object.assign(UI.menu, saved);
  } catch (e) { /* defaults */ }
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
  document.addEventListener('visibilitychange', () => { if (document.hidden && UI.inGame) autoSave(); });
  window.addEventListener('pagehide', () => { if (UI.inGame) autoSave(); });
  setInterval(() => { if (UI.inGame && !UI.paused) autoSave(); }, AUTOSAVE_EVERY * 1000);
  syncMenu();
}

/** A line under the map shape choice: what each shape plays like. */
const SHAPE_BLURB = [
  'Open ground with hills, cliffs and resource fields between the bases.',
  'A narrow planet with the bases far apart: built for long supply lines (trucks, Road Trains and rail).',
  'A wall of crags across the middle with a single pass: whoever holds the pass holds the map.',
  'Each base on its own island, with a big island in the middle: the only way across is bridges.',
  'The richest fields lie in a sunken crater in the middle, with one ramp down on each side.',
  'Each base on a high plateau ringed by cliffs, with only two slopes down: easy to hold, slow to break out of.',
  'Mesas standing over a canyon floor far below: cross between the clifftops on Viaducts.',
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
  if (!S || S.winner >= 0 || S.players[0].ai) return;
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
  el.textContent = UI.saveFailed ? 'Saving isn\'t working in this browser right now: keep this tab open.'
    : `Your game saves itself every ${AUTOSAVE_EVERY} seconds` + (s >= 0 ? ` (last saved ${s < 5 ? 'just now' : s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago'})` : '') + '. If it closes, tap Continue on the main menu.';
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
    return `<div class="boost-row" data-p="${P.id}"><div class="boost-head"><i class="dot" style="background:${PLAYER_COLORS[P.id]}"></i>` +
      `<b>${playerName(P.id)}</b>${st ? ' · ' + st.name : ''}<small>${P.boosts ? `boosted ${P.boosts}×` : ''}</small></div>` +
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
 * WASD or arrow keys pan · B build (then a building's key: a letter, or 1–7; or R for roads) · R or P opens and closes Paths (inside
 * it: R roads, G bridges and tunnels, V ramps, E pave, O one-way arrows, L junctions, T traffic map) · Q army · H base · F select every warbot · 1–9 control groups (Ctrl or
 * Shift + digit to save) · J jump to the latest alert · Esc back / clear selection / pause ·
 * Space pause · [ ] game speed · + and - zoom · M minimap · ? help
 */
const PAN_KEYS = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };

/** Build-menu hotkeys: with the build menu open, a building's letter starts placing it (and R lays roads). */
// W, A, S and D always pan the map, even with the build menu open, so the buildings that would want
// those letters (and the ones added after the letters ran out) use number keys.
const BUILD_KEYS = {
  harvester: 'h', quarry: 'q', mine: 'm', tap: 'c', smelter: '1', fab: 'f', foundry: 'u', charger: 'e', farm: '2',
  pump: 'p', refinery: 'v', kiln: 'k', tarworks: 't', roadworks: '3', outpost: 'o', turret: 'g', repair: 'x',
  armory: 'i', munitions: 'n', silo: 'z', depot: '4', grower: 'l', reactor: 'y', nukesilo: 'j',
  ropeway: '5', station: '6', lab: '7', viaduct: '8', bunker: '9', disruptor: '0', mortar: '.',
};

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
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (!UI.inGame) return;
    // Control groups: Ctrl (or Shift) + 1–9 saves the selected warbots, 1–9 selects them again
    // (press twice to jump to them).
    const digit = /^Digit([1-9])$/.exec(e.code || '');
    // In the build menu a plain number picks the building on that key instead.
    if (digit && UI.sheetKind === 'build' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      const type = Object.keys(BUILD_KEYS).find((t) => BUILD_KEYS[t] === digit[1]);
      const card = type && $('sheet-body').querySelector(`.bcard[data-t="${type}"]`);
      if (card && !card.disabled) { e.preventDefault(); card.click(); }
      return;
    }
    if (digit && !e.altKey && $('screen-pause').hidden) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.shiftKey) saveGroup(+digit[1]); else recallGroup(+digit[1]);
      return;
    }
    if (e.altKey && e.key === 'Enter' && fsSupported()) { e.preventDefault(); toggleFullscreen(); return; }
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
    // In the build menu, a building's letter picks it, and R goes straight to laying roads. W, A, S
    // and D still pan the map (no building uses them).
    if (UI.sheetKind === 'build' && k === 'r') { e.preventDefault(); openPaths('road'); return; }
    if (UI.sheetKind === 'build') {
      const type = Object.keys(BUILD_KEYS).find((t) => BUILD_KEYS[t] === k);
      const card = type && $('sheet-body').querySelector(`.bcard[data-t="${type}"]`);
      if (card && !card.disabled) { e.preventDefault(); card.click(); return; }
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
      case 'q': if (!$('btn-attack').hidden) $('btn-attack').click(); break;
      case 'h': case 'home': $('btn-home').click(); break;
      case 'm': setMinimap(!MM.on); break;
      case 'c': if (warOn()) recallAllWarbots(); break;
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
  // A box round your own garrisons picks up their spare warbots too (each keeps its Keep at home).
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
  sfx('order');
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
    html = `<b>${b.owner === 0 ? '' : playerName(b.owner) + ' '}${def.name}</b>` + (b.owner === 0 && b.status ? `<em>${b.status}</em>` : '') +
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
      html = `<b>${bot.owner === 0 ? '' : playerName(bot.owner) + ' '}${BOTS[bot.type].name}</b>` + (bot.owner === 0 ? `<em>${botActivity(bot)}</em>` : '') +
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
  if (!$('screen-boost').hidden) { closeBoost(); return; }
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
  if (S.wildlife) postMsg(0, 'Creatures nest out in the wilds (red on the minimap). From about 7 minutes in they raid whatever you build near their nests. Pulse Turrets (with Crystal) and warbots keep them off; clear a nest with warbots to win the goods it hoards.', 0, 0, 'warn');
  if (nukeOn()) postMsg(0, `Nuclear race: a few uranium deposits glow green across the planet. Dig them with Ore Mines, enrich them at a Nuclear Reactor and build the bomb before ${S.players.length > 2 ? 'the rivals do' : 'the rival does'}.`, 0, 0, 'warn');
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
    ? (S.players.length > 2 ? 'Both rival Command Bases are yours: the last colony standing. The planet is yours.' : 'Your warbots captured the rival Command Base. The planet is yours.')
    : `The ${S.players.length > 2 ? playerName(S.winner) : 'rival'} ${S.players[0].out ? 'captured your Command Base' : 'took the planet'}. Regroup and try again.`;
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
  R.ropeEnd = null;
  UI.ropeA = null;
  UI.placeType = null;
  $('btn-road').classList.toggle('on', mode === 'road');
  $('btn-attack').classList.toggle('on', mode === 'attack');
  if (mode === 'normal') { $('banner').hidden = true; return; }
  closeSheet();
  if (mode === 'road') showRoadBanner();
  if (mode === 'attack') showArmyBanner();
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
    html += t ? `Fire at the ${playerName(t.owner)} <b>${BDEFS[t.type].name}</b>? ${BDEFS[t.type].mil ? 'Its armor drops to almost nothing, ready for warbots to capture.' : 'A hit wrecks it.'}`
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
  showBanner(type === 'ropeway' ? 'Tap a highlighted spot for the Ropeway\'s <b>near station</b>, where your roads are. Then tap the far end.'
    : type === 'viaduct' ? 'Tap a highlighted spot on a clifftop for the Viaduct\'s <b>near end</b>, where your roads are. Then tap the far end, across the valley.'
    : `Tap a highlighted spot to place a <b>${BDEFS[type].name}</b>.`, null, 'Cancel');
  if (!R.overlay.valid.some((v) => v)) {
    const near = BDEFS[type].gather ? ' near the right resource' : BDEFS[type].farm ? ' near fertile soil' : BDEFS[type].pump ? ' on an oil seep' : '';
    showBanner(`<span class="err">There is no valid spot for a ${BDEFS[type].name} in your territory${near}. Expand with an Outpost.</span>`, null, 'Close');
  }
}

/** The Army banner: what to tap, and Recall all when warbots are out in the field. */
function showArmyBanner() {
  const out = warbotsOut(0), k = S.players[0].keepW ?? 1;
  showBanner('Tap a <b>rival building</b> to attack it with warbots or missiles, or tap open ground to send warbots there to <b>hold the area</b>.' +
    (out ? ` ${out} warbot${out > 1 ? 's are' : ' is'} out in the field: <b>Recall all</b> brings them home.` : '') +
    `<span class="keep-all">Outposts keep <span class="seg">${[0, 1, 2].map((v) => `<button data-k="${v}" class="${v === k ? 'on' : ''}">${v}</button>`).join('')}</span> warbot${k === 1 ? '' : 's'} at home</span>`,
    out ? 'Recall all' : null, 'Cancel');
  for (const btn of $('banner-text').querySelectorAll('[data-k]')) btn.onclick = (e) => { e.stopPropagation(); setKeepAll(+btn.dataset.k); showArmyBanner(); };
}

/** Every Outpost keeps v warbots at home (each one's own setting is reset to follow this). */
function setKeepAll(v) {
  S.players[0].keepW = v;
  for (const b of S.buildings) if (!b.dead && b.owner === 0 && BDEFS[b.type].mil && b.type !== 'lander') delete b.keepW;
  sfx('click');
  toast(v === 0 ? 'Outposts keep no warbots at home now: every warbot can be sent out, and new ones wait at your Command Base.'
    : `Every Outpost now keeps ${v} warbot${v === 1 ? '' : 's'} at home.`, 'info');
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
  if (R.mode === 'attack') { recallAllWarbots(); return; }
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
  const res = placeSite(0, type, x, y);
  if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
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
    showBanner(`Now tap the <b>far end</b>: ${ROPE_MIN} to ${ROPE_MAX} tiles away, in your territory, across anything (cliffs, water, rock).`, null, 'Cancel');
    return;
  }
  const A = UI.ropeA;
  if (R.ropeEnd && R.ropeEnd.i === i && R.ropeEnd.j === j && R.ropeEnd.ok) { confirmBanner(); return; }
  const why = ropeEndBlocked(0, A.i, A.j, i, j);
  R.ropeEnd = { i, j, ok: !why };
  if (why) { sfx('error'); showBanner(`<span class="err">${why}</span> Tap another far end.`, null, 'Cancel'); return; }
  const len = Math.round(dist(A.i, A.j, i, j));
  const rise = S.elev[tIdx(i, j)] - S.elev[tIdx(A.i, A.j)];
  showBanner(`A <b>Ropeway</b> ${len} tiles long${rise ? `, ${Math.abs(rise)} level${Math.abs(rise) > 1 ? 's' : ''} ${rise > 0 ? 'up' : 'down'}` : ''}? ${costHTML(BDEFS.ropeway.cost, playerGoods(0))}`, 'Build', 'Cancel');
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
  showBanner(`A <b>Viaduct</b> spanning ${n} tile${n > 1 ? 's' : ''}${rise ? `, ${Math.abs(rise)} level${Math.abs(rise) > 1 ? 's' : ''} ${rise > 0 ? 'up' : 'down'} at the far end` : ''}? ${costHTML(cost, playerGoods(0))} (${canPay(0, cost) ? 'paid now' : 'paid from storage as the goods come in'})`, 'Build', 'Cancel');
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
      if ((S.over[t] && S.over[t].owner !== 0) || (S.lights[t] && S.lights[t].owner !== 0) || (!S.over[t] && !S.lights[t] && S.road[t] && S.owner[t] !== 0)) { sfx('error'); showRoadBanner('That junction isn\'t yours: you can only change junctions in your own land.'); return; }
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
      if (S.road[t] && !roadOwnedBy(0, t)) { sfx('error'); showRoadBanner('That road isn\'t yours: you can only change roads in your own land.'); return; }
      if (S.road[t]) { setRoadDir(i, j, S.road[t] >= 5 ? 1 : S.road[t] + 1); sfx('click'); showRoadBanner(); }
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
    if (UI.roadMode === 'rail') {
      // Rail: a tap adds a tile of track or drops it; tapping laid track marks it to take up.
      const stroke = [];
      if (UI.draft.rail.has(t)) draftOp(stroke, t, 'unrail');
      else if (UI.draft.railDel.has(t)) draftOp(stroke, t, 'unraildel');
      else if (S.rail[t] && !roadOwnedBy(0, t)) { sfx('error'); showRoadBanner('That track isn\'t yours: you can only take up track in your own land.'); return; }
      else if (S.rail[t] || S.railPlan[t] === 1) draftOp(stroke, t, 'raildel');
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
    else if (S.road[t] && !roadOwnedBy(0, t) && S.plan[t] !== 1) { sfx('error'); showRoadBanner('That road isn\'t yours: you can only take up roads in your own land.'); return; }
    else if (S.road[t] || S.plan[t] === 1) { draftOp(stroke, t, 'del'); note = S.plan[t] ? 'Planned tile marked to call off.' : 'Road marked to take up: its Cement comes back when you tap Build.'; }
    else if (crossTile(t) && UI.roadMode !== 'bridge') {
      sfx('error');
      showRoadBanner(`That's ${S.terrain[t] === T_WATER ? 'water' : S.terrain[t] === T_CHASM ? 'open sky' : 'rock'}. Pick <b>Bridges</b> to build a ${CROSS[S.terrain[t]].name.toLowerCase()} across it.`);
      return;
    } else if (canRoad(0, i, j) || draftBridge(t)) {
      draftOp(stroke, t, 'add');
      if (crossTile(t)) note = `${CROSS[S.terrain[t]].name} tile: ${costText(CROSS[S.terrain[t]].cost)}.`;
      else if (S.res[t]) note = `Workers will clear the ${RES[S.res[t]].name.toLowerCase()} (${ROAD_CLEAR}× Cement).`;
    } else { sfx('error'); showRoadBanner('You can only build roads inside your border. A bridge can reach out over the water beyond it, from your shore or the end of a bridge.'); return; }
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
    else { sfx('error'); showBanner(`<span class="err">Tap a rival building (${S.players.length > 2 ? 'red or green' : 'red'}) or open ground.</span>`, null, 'Cancel'); }
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
  if (inMap(i, j) && S.road[tIdx(i, j)] && S.owner[tIdx(i, j)] === 0) { sfx('click'); openRoadSheet(tIdx(i, j)); return; }
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
function draftReset() { UI.draft = { add: [], addSet: new Set(), del: new Set(), ramps: new Set(), railRamps: new Set(), walls: new Map(), rail: new Set(), railDel: new Set(), strokes: [] }; }
function draftEmpty() { return !UI.draft || (!UI.draft.add.length && !UI.draft.del.size && !UI.draft.ramps.size && !UI.draft.walls.size && !UI.draft.rail.size && !UI.draft.railDel.size); }

/** A bridge sketched out past the border: water touching a tile already in the sketch. */
function draftBridge(t) {
  const d = UI.draft;
  return bridgeable(t) && !S.bAt[t] && !scorched(t) && bridgeHead(0, t % S.W, (t / S.W) | 0, (u) => d.addSet.has(u) && bridgeable(u));
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
  stroke.push({ t, op });
}

/** Take back the last drag or tap. */
function draftUndo() {
  const d = UI.draft;
  if (!d) return;
  let s;
  do s = d.strokes.pop(); while (s && !s.length); // skip drags that added nothing
  if (!s) return;
  const back = { add: 'unadd', unadd: 'add', del: 'undel', undel: 'del', ramp: 'unramp', unramp: 'ramp', rail: 'unrail', unrail: 'rail', raildel: 'unraildel', unraildel: 'raildel' };
  for (let k = s.length - 1; k >= 0; k--) {
    if (s[k].op === 'setw') { if (s[k].from) d.walls.set(s[k].t, s[k].from); else d.walls.delete(s[k].t); continue; }
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
    const c = S.plan[t] ? (S.owe[t] ? {} : roadTileCost(t)) : crossTile(t) ? CROSS[S.terrain[t]].cost : roadCost(); // a tile still waiting for its goods gives nothing back
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
  const net = {};
  for (const g in cost) net[g] = Math.max(0, cost[g] - (back[g] || 0));
  // Anything you can't pay for yet waits for the goods (settlePlans): the plan can always be built.
  return { add, cross, clear, del: d.del.size, ramps: d.ramps.size, walls, gates, rail: d.rail.size, railDel: d.railDel.size, cost, back, net, can: true,
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
  // Pay for what we can now, oldest plans first; the rest waits for the goods.
  settlePlans();
  const wp = plansWaiting(0), owedN = wp.tiles + wp.track + wp.sites;
  draftReset();
  // Built: Paths closes, straight back to the map (unless something went wrong, to fix it).
  if (!why) setMode('normal');
  const wallText = walls || gates ? ` ${[walls ? `${walls} Wall${walls === 1 ? '' : 's'}` : '', gates ? `${gates} Gate${gates === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')} planned: free workers will build ${walls + gates === 1 ? 'it' : 'them'}.` : '';
  if (why) { sfx('error'); toast(`Planned ${laid} tile${laid === 1 ? '' : 's'} before running short: ${why}`, 'warn'); }
  else { sfx('place'); toast((laid ? `Planned ${laid} road tile${laid === 1 ? '' : 's'}: free workers will pave them.` : '') + (ramps ? ` ${ramps} Ramp site${ramps === 1 ? '' : 's'} started.` : '') + wallText + (removed ? ` Took up ${removed} tile${removed === 1 ? '' : 's'}.` : ''), 'info'); }
  if (wallWhy) toast(`Some of the wall couldn't go up: ${wallWhy}`, 'warn');
  if (rampWhy) toast(`A Ramp couldn't be planned: ${rampWhy} The road or track there won't climb the cliff until one is.`, 'warn');
  if (rails || railsUp) toast(`${rails ? `Planned ${rails} tile${rails === 1 ? '' : 's'} of track.` : ''}${railsUp ? ` Took up ${railsUp} tile${railsUp === 1 ? '' : 's'} of track.` : ''}`, 'info');
  if (owedN) toast(`Waiting for goods: ${costText(wp.owed)} more. It's paid from storage as the goods come in, oldest plans first, and built as it's paid for.`, 'info');
  if (railWhy) toast(`Some track couldn't go down: ${railWhy}`, 'warn');
  if (why) showRoadBanner();
}

/** Leaving Paths with a plan that was never built: it's dropped (nothing was spent). */
function dropDraft() {
  if (draftEmpty()) return;
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
  if (first) { UI.paintSkipped = false; UI.paintCross = false; UI.paintCliff = false; UI.paintRamp = false; UI.paintSteep = false; UI.stroke = []; UI.draft.strokes.push(UI.stroke); }
  const from = first || !UI.lastPaint ? { i, j } : UI.lastPaint;
  const line = tileLine(from.i, from.j, i, j);
  let prev = null;
  const arrows = UI.roadMode === 'arrows', pave = UI.roadMode === 'pave', wall = UI.roadMode === 'wall', rail = UI.roadMode === 'rail';
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
      if (!railBlocked(0, t)) draftOp(UI.stroke, t, 'rail'); else UI.paintSkipped = true;
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
        if (v >= 2 && roadOwnedBy(0, t)) { if (S.road[tIdx(prev[0], prev[1])] && roadOwnedBy(0, tIdx(prev[0], prev[1]))) setRoadDir(prev[0], prev[1], v); setRoadDir(x, y, v); }
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
    // Bridges and tunnels are dear: only the Bridges tool sketches them.
    if (crossTile(t) && UI.roadMode !== 'bridge') { UI.paintCross = true; continue; }
    if (canRoad(0, x, y) || draftBridge(t)) draftOp(UI.stroke, t, 'add');
  }
  UI.lastPaint = { i, j };
  if (pave) { showRoadBanner(); return; }
  if (wall) { showRoadBanner(UI.paintSkipped ? 'The wall skips tiles it can\'t go on (outside your border, resources, cliffs, or right beside your Command Base).' : '', true); return; }
  const what = rail ? 'Track' : 'A road';
  const cliffNote = UI.paintSteep ? `${what} can't climb a cliff two levels high, and no Ramp can: go round it to a one-level step (or bridge the valley with a Viaduct).`
    : UI.paintCliff ? `${what} climbs a level only over a <b>Ramp</b>, and there's no room for one where you crossed this cliff (resources, a building, or it would block the only way through): try a tile or two along it.`
      : '';
  if (rail) { showRoadBanner(cliffNote || (UI.paintRamp ? 'A <b>Ramp</b> is planned where the track climbs the cliff: workers build it, paid from storage, and the track on it goes down when it\'s done.' : UI.paintSkipped ? 'Track skips tiles it can\'t go on: outside your border, resources, rock or buildings.' : ''), true); return; }
  if (!arrows) {
    showRoadBanner(cliffNote || (UI.paintRamp ? 'A <b>Ramp</b> is planned where the road climbs the cliff: workers cut it, paid from storage, and it carries the road up when it\'s done.'
      : UI.paintCross ? 'Roads stop at water and rock: pick <b>Bridges</b> to cross.'
        : UI.paintSkipped ? 'Dragging goes round resources: tap a boulder, grove, ore or crystal tile to clear it for a road.' : ''), true);
  }
}

/**
 * The Paths banner, at the top of the screen so it never covers where you're drawing. Roads and
 * Bridges show the plan and what it costs, with Undo, Clear and Build.
 */
function showRoadBanner(problem, info) {
  const mode = ['arrows', 'lights', 'bridge', 'ramp', 'pave', 'wall', 'rail'].includes(UI.roadMode) ? UI.roadMode : 'road';
  if (!UI.draft) draftReset();
  const have = playerGoods(0);
  let line, how;
  if (mode === 'rail' && !UI.draft.rail.size && !UI.draft.railDel.size) {
    line = `<b>Lay railway track</b> by dragging (${costText(RAIL_COST)} a tile, laid when you tap Build if you have the goods, otherwise as they come in). Tap a tile to add or drop it, or tap track to take it up. Then put a <b>Rail Station</b> (Build menu) beside each end, and order a <b>Freight Train</b> at the Bot Foundry.`;
    how = 'Freight Trains carry 56 goods between Rail Stations on the same track, fast and with no traffic to wait for, and never need charging. They keep a station\'s supply orders filled from the other stations on the line, and a far station sends its spare goods home to the station nearest your Command Base. Track goes on open ground in your territory. It climbs a level at a time over a Ramp (a natural slope, or one you build in Paths), like a road, with trains slowing on the grade; over water it\'s a rail bridge, and across a valley it runs over a Viaduct. It can cross a road: road traffic waits at the crossing while a train goes by.';
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
    line = 'Drag along a road to make it <b>one-way</b> the way you drag. Tap a road to turn its arrow.';
    how = 'One-way traffic never meets head-on, so a loop of one-way roads (one lane out, one back) keeps busy routes flowing.';
  } else if (mode === 'lights') {
    let lights = 0, junctions = 0, overs = 0;
    for (const k in S.lights) if (S.lights[k].owner === 0) lights++;
    for (const k in S.over) if (S.over[k].owner === 0) overs++;
    const net = roadNet();
    for (let t = 0; t < S.W * S.H; t++) if (net.junc[t] && S.owner[t] === 0) junctions++;
    line = `Tap a <b>junction</b> for a traffic light (${costText(LIGHT_COST)}), tap the light for an <b>overpass</b> (${costText(OVERPASS_COST)}), tap again to clear it.`;
    const jp = plansWaiting(0).junctions;
    how = `A light lets one direction through at a time: it pays where two busy roads cross (50 to 85% more goods through), and costs a little on a quiet crossing. On an overpass nobody stops: best everywhere, and more than twice as much on a jammed crossing. Short of Alloy? Tap anyway: the light or overpass is planned (a dashed orange marker) and goes up once it's paid for from storage, oldest plans first${jp ? ` (<b>${jp}</b> waiting now)` : ''}. You have ${lights} light${lights === 1 ? '' : 's'}, ${overs} overpass${overs === 1 ? '' : 'es'} and ${junctions} junction${junctions === 1 ? '' : 's'}.`;
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
      if (sm.walls) parts.push(`<b>${sm.walls}</b> Wall${sm.walls === 1 ? '' : 's'}`);
      if (sm.gates) parts.push(`<b>${sm.gates}</b> Gate${sm.gates === 1 ? '' : 's'}`);
      if (sm.rail) parts.push(`<b>${sm.rail}</b> tile${sm.rail === 1 ? '' : 's'} of track`);
      if (sm.railDel) parts.push(`<b>${sm.railDel}</b> of track to take up`);
      const cost = Object.keys(sm.net).length && Object.values(sm.net).some((v) => v > 0) ? `costs <b>${costText(sm.net)}</b>` : 'costs nothing';
      line = `Plan: ${parts.join(', ')}; ${cost}` + (!sm.short.length ? '.' : `. <span class="ok">Short of ${sm.short.map((g) => GOOD[g].name).join(' and ')} for now: what you can't pay for waits and is paid from storage as the goods come in, oldest plans first.</span>`);
    }
    const waiting = planList(0).length, wp = plansWaiting(0), owedN = wp.tiles + wp.track + wp.sites;
    const owedText = owedN ? ` <b>Waiting for goods now:</b> ${[wp.tiles ? `${wp.tiles} road tile${wp.tiles === 1 ? '' : 's'}` : '', wp.track ? `${wp.track} of track` : '', wp.sites ? `${wp.sites} site${wp.sites === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ')} (${costText(wp.owed)} to go).` : '';
    if (mode === 'wall') how = 'Walls and Gates are paid straight from storage, no Hauler needed: what you have now goes in when you tap Build, the rest as the goods come in (oldest plans first), and free workers put each piece up as far as its goods go. Enemy warbots have to go round or shoot through; your bots pass your Gates.' + owedText;
    else if (mode === 'rail') how = 'Track you can pay for goes down when you tap Build; the rest goes down as the goods come in (oldest plans first). Where the track climbs a one-level cliff, a Ramp is planned for it (paid from storage, no road needed) and the track on it goes down once workers finish the Ramp. Rail Stations stand beside the track; Freight Trains run between stations on the same stretch of track.' + owedText;
    else how = `<b>Haulers only drive on roads</b>, so every building needs a road to storage. 1 Cement paves ${Math.round(1 / roadCost().cement)} tiles (${ROAD_CLEAR}× through resources); you have ${have.cement || 0} Cement` +
      (mode === 'bridge' ? ` and ${have.alloy || 0} Alloy. Workers build bridges and tunnels out from the shore or rock face, and they join land on any level.` : '.') +
      ` After you tap Build, free workers pave the road a tile at a time${waiting ? ` (<b>${waiting}</b> tile${waiting === 1 ? '' : 's'} waiting now)` : ''}. Short of Cement or Alloy? Plan it anyway: tiles you can't pay for yet wait (an orange outline) and are paid from storage as the goods come in, oldest plans first.` + owedText;
  }
  const text = (problem ? `<span class="${info ? 'ok' : 'err'}">${problem}</span> ` : '') + line +
    `<details class="how"><summary>How it works</summary>${how}</details>`;
  showBanner(text, null, 'Done');
  $('banner-seg').hidden = false;
  for (const btn of $('banner-seg').children) {
    btn.classList.toggle('on', btn.dataset.v === mode);
    if (btn.dataset.v === 'wall') btn.hidden = !warOn();
    btn.onclick = () => { UI.roadMode = btn.dataset.v; sfx('click'); showRoadBanner(); };
  }
  // Undo, Clear and Build for a plan.
  const drafting = !draftEmpty();
  $('banner-undo').hidden = !drafting;
  $('banner-clear').hidden = !drafting;
  $('banner-ok').hidden = !drafting;
  if (drafting) {
    const sm = draftSummary();
    const wl = sm.walls + sm.gates;
    $('banner-ok').textContent = sm.add ? `Build ${sm.add} tile${sm.add === 1 ? '' : 's'}` + (sm.ramps ? ` + ${sm.ramps} Ramp${sm.ramps === 1 ? '' : 's'}` : '') + (wl ? ` + ${wl} wall` : '')
      : sm.ramps ? `Build ${sm.ramps} Ramp${sm.ramps === 1 ? '' : 's'}` + (wl ? ` + ${wl} wall` : '')
      : wl ? `Build ${sm.walls ? `${sm.walls} Wall${sm.walls === 1 ? '' : 's'}` : ''}${sm.walls && sm.gates ? ' + ' : ''}${sm.gates ? `${sm.gates} Gate${sm.gates === 1 ? '' : 's'}` : ''}`
      : sm.rail ? `Build ${sm.rail} track tile${sm.rail === 1 ? '' : 's'}` : 'Take up';
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
  const n = { hauler: [0, 0], truck: [0, 0], tanker: [0, 0] };
  for (const u of S.bots) {
    if (u.dead || u.owner !== 0 || !n[u.type]) continue;
    n[u.type][0]++;
    if (u.task && u.task.type === 'haul') n[u.type][1]++;
  }
  let jams = 0;
  if (HEAT.jam) for (let t = 0; t < S.W * S.H; t++) if (HEAT.jam[t] > TRAFFIC_JAM && S.owner[t] === 0) jams++;
  return `<b>Traffic map:</b> <i class="tk q"></i>quiet <i class="tk b"></i>busy <i class="tk p"></i>packed; pulsing rings mark jams (${jams} now). `
    + `Haulers ${n.hauler[1]} of ${n.hauler[0]} busy` + (n.truck[0] ? `, Freight Trucks ${n.truck[1]} of ${n.truck[0]}` : '') + (n.tanker[0] ? `, Tankers ${n.tanker[1]} of ${n.tanker[0]}` : '') + '.';
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
  return Object.keys(cost).map((g) => `<span class="${have && have[g] < cost[g] ? 'short' : ''}"><i class="gi ${g}"></i>${Math.round(cost[g] * 100) / 100}</span>`).join('');
}

/**
 * The build menu: tabs across the top (All, and the BUILD_GROUPS: Gather, Make, Move, Defend), the
 * last one used remembered. Every card is in the page whichever tab is showing (the others are just
 * hidden), so a building's hotkey works from any tab.
 */
function openBuildMenu() {
  const have = playerGoods(0);
  const sites = siteCount(0);
  const list = BUILD_MENU.filter((t) => !(BDEFS[t].war && !warOn()) && !(BDEFS[t].nuke && !nukeOn()) && !(BDEFS[t].colony && (S.mode !== 'colony' || S.mission)));
  const groupOf = (t) => (BUILD_GROUPS.find((g) => g.types.includes(t)) || BUILD_GROUPS[0]).key;
  const ordered = BUILD_GROUPS.flatMap((g) => g.types).filter((t) => list.includes(t));
  if (!UI.buildTab) { try { UI.buildTab = localStorage.getItem('botfall.buildTab') || 'all'; } catch (e) { UI.buildTab = 'all'; } }
  const groups = BUILD_GROUPS.filter((g) => ordered.some((t) => groupOf(t) === g.key));
  if (UI.buildTab !== 'all' && !groups.some((g) => g.key === UI.buildTab)) UI.buildTab = 'all';
  const tabs = `<div class="seg build-tabs" id="build-tabs"><button data-g="all">All</button>${groups.map((g) => `<button data-g="${g.key}">${g.name}<span class="n">${ordered.filter((t) => groupOf(t) === g.key).length}</span></button>`).join('')}</div>`;
  const html = `<div class="sheet-title"><h3>Build</h3></div>
    <p class="desc">Placing a site is free; haulers bring the materials by road, so lay a road to it. ${sites}/${MAX_SITES} sites in progress.</p>
    ${tabs}
    <div class="build-grid"><button class="bcard roads" id="build-roads" data-g="move"><kbd>R</kbd><svg viewBox="0 0 24 24"><path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <div class="bname">Roads</div><div class="bhave">Plan roads, bridges and ramps</div></button>${warOn() ? `<button class="bcard walls" id="build-walls" data-g="defend"><img src="${iconFor('wall')}" alt=""><div class="bname">Walls</div><div class="bcost">${costHTML(BDEFS.wall.cost, have)}</div>
      <div class="bhave">${wallCountText()}</div></button>` : ''}${ordered.map((t) => `<button class="bcard" data-t="${t}" data-g="${groupOf(t)}" ${sites >= MAX_SITES ? 'disabled' : ''}>
      ${BUILD_KEYS[t] ? `<kbd>${BUILD_KEYS[t].toUpperCase()}</kbd>` : ''}<img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div><div class="bcost">${costHTML(BDEFS[t].cost, have)}${t === 'viaduct' ? ' a tile' : ''}</div>
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
    for (const el of $('sheet-body').querySelectorAll('.build-grid .bcard')) el.hidden = g !== 'all' && el.dataset.g !== g;
  };
  for (const btn of $('build-tabs').children) btn.onclick = () => { sfx('click'); show(btn.dataset.g); };
  show(UI.buildTab);
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
    desc += ` <b>Level ${b.level || 1} of 3</b>, ${n} creature${n === 1 ? '' : 's'} out and about. Hoarded: ${Object.keys(b.stock).filter((g) => b.stock[g] > 0).map((g) => `${b.stock[g]} ${GOOD[g].name}`).join(', ') || 'nothing'}.`;
  }
  let html = `<div class="sheet-title"><img src="${iconFor(b.type, b.owner)}" alt=""><div><h3>${def.name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[b.owner]}"></span> ${mine ? 'Yours' : playerName(b.owner)}</div></div></div>
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
    } else if (b.type !== 'lander' && !(b.built && BDEFS[b.type].barrier)) {
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
        <p class="hint" id="sh-st-hint"></p>` +
        (def.bunker ? '' : `<div class="section-label">Keep here</div>
        <div class="seg" id="sh-keepw"><button data-v="auto">Auto (${b.type === 'lander' ? 1 : S.players[0].keepW ?? 1})</button><button data-v="0">0</button><button data-v="1">1</button><button data-v="2">2</button><button data-v="4">4</button></div>
        <p class="hint">Warbots this garrison keeps at home: attacks and rallies leave them behind, and new warbots fill it up to this first. <b>0</b>: nothing is held back, and idle warbots don't come here (they wait at your Command Base). <i>Auto</i> follows the setting for all Outposts in Army.</p>`);
    }
    if (def.lab && b.built) html += '<div class="section-label">Research</div><div id="sh-research"></div>';
    if (b.type === 'foundry' && b.built) {
      const versus = warOn();
      const row = (k, label) => `<div class="order-row"><span>${label}<small id="sh-o-${k}">none queued</small></span>
        <button class="btn" data-k="${k}" data-d="1">+1</button><button class="btn" data-k="${k}" data-d="5">+5</button>
        <button class="btn ghost" data-k="${k}" data-d="0">Clear</button></div>`;
      const kinds = BOT_ORDER.filter((k) => versus || !BOTS[k].war);
      html += `<div class="section-label">Order bots</div><div id="sh-orders">${kinds.map((k) => row(k, BOTS[k].plural)).join('')}</div>
        <p class="hint">The Foundry only builds the bots you order. Each one uses 1 Alloy and 1 Chip a round, ${def.work} s each (a Freight Truck or Tanker takes ${BOTS.truck.parts} rounds, a Road Train ${BOTS.roadtrain.parts}, a Freight Train ${BOTS.freight.parts}, a Crawler ${BOTS.crawler.parts}); mixed orders take turns.
        <b>Haulers</b> carry two goods on the short runs. <b>Freight Trucks</b> carry eight on the long runs (12 tiles or more), from far mines and factories as well as storage. <b>Tankers</b> are the only vehicles that carry Crude and Fuel, ten at a time (they explode if they're destroyed full). <b>Road Trains</b> carry thirty between your Command Base and far Depots, best on asphalt. <b>Agribots</b> run Bio Farms and Grove Planters, and <b>Pavers</b> run the Roadworks.</p>`;
    }
    if (def.roadworks && b.built) {
      html += `<div class="section-label">Paves and maintains</div>
        <div class="seg" id="sh-pmode"><button data-v="marked">Marked roads</button><button data-v="all">Every joined road</button></div>
        <button class="btn" id="sh-pmark">Mark roads to pave</button>
        <p class="hint">Mark roads in Paths (Pave) and the Paver keeps just those surfaced, resurfacing them as traffic wears them down: put the Roadworks near the roads that matter. <i>Every joined road</i> paves everything it can reach.</p>`;
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
    if (BDEFS[b.type].mobile) html += '<button class="btn primary" id="sh-pack">Pack up to move</button>';
    else if (b.type !== 'lander') html += `<button class="btn danger" id="sh-demolish">${b.built ? 'Demolish' : 'Cancel site'}</button>`;
    html += '</div>';
  } else if (S.mode !== 'colony' || def.wild) {
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
    if ($('sh-orders')) for (const btn of $('sh-orders').querySelectorAll('button')) btn.onclick = () => {
      const k = btn.dataset.k, d = +btn.dataset.d;
      b.orders = b.orders || {};
      b.orders[k] = d === 0 ? 0 : clamp((b.orders[k] || 0) + d, 0, 99);
      if (!hasOrders(b)) delete b.orders;
      sfx('click');
      refreshSheet();
    };
    if ($('sh-pause')) $('sh-pause').onclick = () => { setPaused(b, !b.paused); sfx('click'); refreshSheet(); };
    if ($('sh-pack')) $('sh-pack').onclick = () => {
      const btn = $('sh-pack');
      if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Tap again: its land goes, and buildings only it covers are lost'; return; }
      const u = packCrawler(b);
      sfx('order');
      if (u) openBotSheet(u); else closeSheet();
    };
    if ($('sh-aim')) $('sh-aim').onclick = () => { sfx('click'); startAim(b); };
    if ($('sh-gprio')) for (const btn of $('sh-gprio').children) btn.onclick = () => { b.gprio = btn.dataset.v === 'normal' ? undefined : btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-keepw')) for (const btn of $('sh-keepw').children) btn.onclick = () => { b.keepW = btn.dataset.v === 'auto' ? undefined : +btn.dataset.v; sfx('click'); refreshSheet(); };
    if ($('sh-st-send')) {
      UI.stationN = Math.min(5, stationAvailable(0, b));
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
  if (mine && def.lab && $('sh-research')) refreshResearch();
  $('sh-status').textContent = mine ? b.status || '' : (b.built ? '' : 'Construction site');
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
      const nets = buildingNets(b), net = roadNet(), all = paveMode(b) === 'all';
      for (let t = 0; t < S.W * S.H; t++) {
        if (!S.road[t] || S.owner[t] !== b.owner || !(all || S.paveMark[t]) || nets.indexOf(net.comp[t]) < 0) continue;
        if (S.pave[t] !== 2) todo++; else if (S.wear[t] >= REPAVE_AT) worn++; else fresh++;
      }
      parts.push(`<div class="kv"><span>${all ? 'Joined roads' : 'Marked roads joined to it'}</span><span>${fresh + worn + todo} tiles</span></div>
        <div class="kv"><span>Asphalt in good repair</span><span>${fresh}</span></div>
        <div class="kv"><span>To pave · worn, to resurface</span><span>${todo} · ${worn}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Asphalt</span><span>${goodTag('asphalt', `${b.stock.asphalt || 0}/3`, !(b.stock.asphalt > 0) && !(b.charges > 0))} + ${b.charges || 0} tiles in the hopper</span></div>`);
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
        parts.push(`<div class="kv"><span>Next bot</span><span>${BOTS[k] ? BOTS[k].name + (need > 1 ? ` (part ${Math.min(need, foundryParts(b, k) + 1)} of ${need})` : '') : 'Nothing ordered'}</span></div>`);
      }
      if (b.timer > 0 && b.status === 'Working') parts.push(`<div class="bar"><div style="width:${Math.round((b.timer / def.work) * 100)}%"></div></div>`);
    }
    if (def.store && mine) {
      let idle = 0;
      for (const u of S.bots) if (!u.dead && u.inside === b.id && u.type === 'worker') idle++;
      parts.push(`<div class="kv"><span>Workers resting here</span><span>${idle}</span></div>`);
    }
    if (def.mil) parts.push(`<div class="kv"><span>${mine ? 'Warbots inside' : 'Defenders inside'}</span><span>${b.garrison.length} / ${def.garrison}</span></div>`);
    if (def.mil && mine && !def.bunker) parts.push(`<div class="kv"><span>Territory radius</span><span>${def.terr} tiles</span></div>`);
    if (def.bunker) parts.push(`<div class="kv"><span>Fires at</span><span>enemy robots within ${def.range} tiles</span></div>`);
    if (def.disrupt && mine) {
      parts.push(`<div class="kv"><span>Fuel</span><span>${goodTag('fuel', `${b.stock.fuel || 0}/${def.ammoCap}`, !(b.stock.fuel > 0))} + ${b.pulses || 0} pulse${b.pulses === 1 ? '' : 's'} charged</span></div>`);
      parts.push(`<div class="kv"><span>Each pulse</span><span>drains ${def.disrupt.drain} battery from enemy robots within ${def.range} tiles, every ${def.disrupt.every}s</span></div>`);
    }
    if (def.mortar && mine) {
      parts.push(`<div class="kv"><span>Shells</span><span>${(b.shells || 0) + (b.stock.ammo || 0) * def.mortar.shells} (${goodTag('ammo', `${b.stock.ammo || 0}/${def.ammoCap}`, !(b.stock.ammo > 0))})</span></div>`);
      parts.push(`<div class="kv"><span>Each shell</span><span>${def.mortar.damage} damage, ${def.mortar.splashDamage} within ${def.mortar.splash} tiles; ${def.minRange} to ${def.range} tiles out</span></div>`);
    }
    if (def.ammo && mine && !def.missile && !def.disrupt && !def.mortar) parts.push(`<div class="kv"><span>Ammo</span><span>${b.shots + (b.stock.crystal || 0) * shotsPer(b)} shots</span></div>`);
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
  if ($('sh-keepw')) for (const btn of $('sh-keepw').children) btn.classList.toggle('on', btn.dataset.v === (b.keepW === undefined ? 'auto' : String(b.keepW)));
  if ($('sh-st-n')) {
    const avail = stationAvailable(0, b), coming = b.garInc || 0;
    UI.stationN = clamp(UI.stationN || 0, avail ? 1 : 0, avail);
    $('sh-st-n').textContent = UI.stationN;
    $('sh-st-send').disabled = !avail;
    $('sh-st-hint').textContent = (avail
      ? `Bring up to ${avail} warbot${avail > 1 ? 's' : ''} from your other garrisons (each keeps its Keep at home). They stay here until you move them.`
      : !garrisonRoom(b) ? 'This garrison is full.' : 'No spare warbots in your other garrisons: each keeps its Keep at home (set it on the garrison, or for all Outposts in Army).')
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
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[u.owner]}"></span> ${u.owner === 0 ? 'Yours' : playerName(u.owner)}</div></div></div>
    <p class="desc">${BOTS[u.type].desc}</p>
    <div class="status" id="sh-status"></div><div id="sh-dyn"></div>
    ${u.owner === 0 && u.type === 'warbot' ? '<button class="btn big" id="sh-recall" hidden>Call back this squad</button>' : ''}
    ${u.owner === 0 && BOTS[u.type].crawler ? '<div class="actions"><button class="btn primary" id="sh-crawl">Drive somewhere</button><button class="btn" id="sh-deploy">Deploy here</button></div>' : ''}`;
  openSheet('bot', u.id, html);
  if ($('sh-crawl')) $('sh-crawl').onclick = () => { sfx('click'); UI.crawler = u.id; setMode('crawl'); UI.crawler = u.id; showBanner('Tap where the <b>Crawler</b> should go: it rolls there (no road needed, but it can\'t climb cliffs or cross water) and deploys when it arrives.', null, 'Cancel'); };
  if ($('sh-deploy')) $('sh-deploy').onclick = () => { const why = deployCrawler(u); if (why) { sfx('error'); toast(why, 'warn'); } else closeSheet(); };
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
    <div class="stepper"><button class="btn" id="mv-minus">−</button><span class="n" id="mv-n">0</span>
      <button class="btn" id="mv-plus">+</button><button class="btn primary" id="mv-send" style="flex:1">Send warbots</button></div>`;
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
  return S.owner[t] === 0 && (S.road[t] || S.plan[t] === 1);
}

/** The player's roads marked for asphalt: how many, and how many are fresh, worn or still to pave. */
function paveCounts(owner) {
  const c = { marked: 0, fresh: 0, worn: 0, todo: 0 };
  for (let t = 0; t < S.W * S.H; t++) {
    if (!S.paveMark[t] || S.owner[t] !== owner || !(S.road[t] || S.plan[t] === owner + 1)) continue;
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
  if (UI.sheetKind === 'road') { refreshRoadSheet(UI.sheetFor); return; }
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
  { text: 'Robots run on batteries, and your Command Base can\'t charge them. Tap <b>Build</b> and place a <b>Charging Station</b> beside the road ring round your base: it runs on the Fuel you landed with.', done: () => hasBuilt('charger') || hasAny('charger') },
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
  obj.innerHTML = UI.objCollapsed && !S.mission ? 'Goal ▸' : objectiveText();
  obj.classList.toggle('small', UI.objCollapsed);
  updateEventCard();
  updateNukeCard();
  if (UI.sheetKind === 'build') {
    // keep build-menu affordability current without rebuilding the buttons
    for (const el of $('sheet-body').querySelectorAll('.bcard[data-t]')) {
      const cost = BDEFS[el.dataset.t].cost;
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
    else if (o.done) html += `<div class="ev-desc">Deal done: ${o.m} ${GOOD[o.get].name} delivered to your Command Base.</div>`;
    else {
      html += `<div class="ev-deal"><span>Give <b>${o.n}</b> <i class="gi ${o.give}"></i> ${GOOD[o.give].name}, get <b>${o.m}</b> <i class="gi ${o.get}"></i> ${GOOD[o.get].name}</span>` +
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

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

  // The new-game menu (Home and Customise, the map type and biome pickers, the planet preview): initMenu.
  $('p-saveplanet').onclick = () => { if (!S) return; savePlanet(gamePlanet()); sfx('place'); toast(`Saved Planet #${S.seed}: start it again from Saved planets in the new-game menu.`, 'good'); };
  // Map settings (remembered on this device; map size is remembered per mode).
  // Settings from before v2 drop their rival style, Nuclear race and Planet events, so the new defaults
  // (a Balanced rival, Nuclear race on, Planet events off) reach every device once.
  try {
    const saved = JSON.parse(localStorage.getItem('botfall.settings') || '{}');
    if ((saved.v || 0) < SETTINGS_V) { delete saved.style; delete saved.nuke; delete saved.events; }
    Object.assign(UI.menu, saved);
  } catch (e) { /* defaults */ }
  checkMenuSettings();
  initMenu();
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
  const syncTod = () => { $('p-daynight').textContent = `Time of day: ${TOD_MODE_NAMES[todMode()]}`; };
  syncTod();
  // Cycle → Always day → Always night → Cycle.
  $('p-daynight').onclick = () => { setTodMode(TOD_MODES[(TOD_MODES.indexOf(todMode()) + 1) % TOD_MODES.length]); syncTod(); sfx('click'); };
  const syncWx = () => { $('p-weather').textContent = `Weather: ${weatherOn() ? 'On' : 'Off'}`; };
  syncWx();
  $('p-weather').onclick = () => { setWeatherOn(!weatherOn()); syncWx(); sfx('click'); };
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
  $('btn-attack').onclick = () => { sfx('click'); if (UI.sheetKind === 'army' || R.mode === 'attack') { setMode('normal'); closeSheet(); } else { setMode('normal'); openArmySheet(); } };
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

/* ------------------------------------------------------------------ new-game menu */

/*
 * The main menu has two views. Home (on load): Continue, Play (#m-new: a game with the settings
 * summed up under it), Customise game, and Missions, Load a save file and How to play. Customise
 * (#m-more; `$('m-more').open = true` opens it too): a preview of the very planet the settings make,
 * with its seed and saved planets, and the settings in three sections, Match, Planet and Rules, each
 * with one line describing the option under the mouse (or focused, or chosen). Play is the same
 * button there, as Start in a bar that stays in view. Map type and Biome open a picker of cards.
 * Everything is built from the data (SHAPE_PRESETS, MAP_GROUPS, BIOMES, BIOME_ORDER, the presets),
 * so new map types and biomes show up by themselves. Settings are remembered on this device
 * (botfall.settings: map type and biome as indices, shapeRnd / biomeRnd for Random).
 */

/** What each rival difficulty plays like (the Match section's line). */
const DIFF_INFO = {
  easy: 'Easy: a slow, forgiving rival that builds up and attacks late.',
  medium: 'Medium: between Easy and Normal. It attacks later, with smaller armies, and raids less.',
  normal: 'Normal: a fair fight. The rival expands, raids your roads and attacks in force.',
  hard: 'Hard: a fast rival that lands with extra goods and attacks early and often.',
};
const TOD_INFO = { cycle: 'Time of day: morning to night, 12 minutes round (looks only; kept on this device).', day: 'Time of day: always day (looks only; kept on this device).', night: 'Time of day: always night, every colony lit up (looks only; kept on this device).' };

/** Keep remembered settings inside what the data offers now (a map type or biome may have gone). */
function checkMenuSettings() {
  const m = UI.menu, ok = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
  if (!ok(m.shape, SHAPE_PRESETS.length)) m.shape = 0;
  if (!ok(m.biome || 0, BIOME_ORDER.length)) m.biome = 0;
  if (!ok(m.rough, TERRAIN_PRESETS.length)) m.rough = DEFAULT_ROUGH;
  if (!ok(m.rich, RESOURCE_PRESETS.length)) m.rich = DEFAULT_RICH;
  if (!m.size || typeof m.size !== 'object') m.size = { ...DEFAULT_SIZE };
  for (const k in DEFAULT_SIZE) if (!ok(m.size[k], SIZE_PRESETS.length)) m.size[k] = DEFAULT_SIZE[k];
  if (!DIFFICULTY[m.diff]) m.diff = 'normal';
}

/** Remember the new-game settings on this device. */
function saveSettings() {
  const m = UI.menu;
  try {
    localStorage.setItem('botfall.settings', JSON.stringify({ v: SETTINGS_V, size: m.size, rough: m.rough, rich: m.rich, shape: m.shape, nuke: m.nuke, biome: m.biome, players: m.players,
      diff: m.diff, style: m.style, events: m.events, wild: m.wild, unlimited: m.unlimited, shapeRnd: m.shapeRnd ? 1 : 0, biomeRnd: m.biomeRnd ? 1 : 0 }));
  } catch (e) { /* storage unavailable */ }
}

const menuSize = () => UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode];
const menuStyle = () => Math.min(PERSONALITY_ORDER.length, UI.menu.style || 0);
const biomeName = (k) => (BIOMES[BIOME_ORDER[k]] || BIOMES[BIOME_ORDER[0]]).name;
const mapGroupName = (g) => { const G = MAP_GROUPS.find((x) => x.key === g); return G ? G.name : ''; };
/** Is this a free-for-all (Versus, 3 players, on a map type with room for three, or Random)? */
function menuThree() {
  const m = UI.menu;
  return m.mode === 'versus' && m.players === 3 && (!!m.shapeRnd || !!SHAPE_PRESETS[m.shape || 0].ffa);
}
function modeInfo(mode, three) {
  return mode === 'colony'
    ? (UI.menu.wild ? 'Colony: no rival, but creatures nest in the wilds and raid what you build near them. Build, research and spread across the planet.'
      : 'Colony: no rival. Settle the planet at your own pace: build, research and spread across the planet.')
    : three ? 'Free-for-all: you and two rival colonies on a round planet. Take a rival\'s Command Base and all it built is yours; the last colony standing wins.'
      : 'Versus: race a rival colony across the planet. Build up, then capture its Command Base to win.';
}
function styleInfo(v) {
  const P = v && PERSONALITIES[PERSONALITY_ORDER[v - 1]];
  if (P) return `${P.name}: it ${P.desc}.`;
  const names = PERSONALITY_ORDER.map((k) => PERSONALITIES[k].name);
  return `Random: each rival gets a personality at random (${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}).`;
}
function terrainInfo(v) {
  const T = TERRAIN_PRESETS[v];
  return `${T.name} terrain: ${T.levels === 1 ? 'one level, no cliffs to get round' : `${T.levels} levels of ground, with cliffs between and slopes up them`}.`;
}
function resourceInfo(v) {
  const P = RESOURCE_PRESETS[v], pct = (x) => Math.round(x * 100) + '%';
  return v === DEFAULT_RICH ? `${P.name} resources: the usual fields of stone, ore, crystal and stalks.` : `${P.name} resources: ${pct(P.density)} as many fields, each holding ${pct(P.amount)} as much.`;
}

/** The setup in a line (and what isn't the default in a second one), under Play and in Start's bar. */
function menuSummary() {
  const m = UI.menu, colony = m.mode === 'colony', three = menuThree(), style = menuStyle();
  const main = [colony ? 'Colony' : three ? 'Free-for-all' : 'Versus'];
  if (!colony) main.push(`${DIFFICULTY[m.diff].label} rival${three ? 's' : ''}`);
  main.push(m.shapeRnd ? 'Random map' : SHAPE_PRESETS[m.shape || 0].name, m.biomeRnd ? 'Random biome' : biomeName(m.biome || 0), SIZE_PRESETS[menuSize()].name);
  const extra = [];
  if (!colony && style !== 1) extra.push(style ? PERSONALITIES[PERSONALITY_ORDER[style - 1]].name + ' style' : 'random rival styles');
  if (m.rough !== DEFAULT_ROUGH) extra.push(TERRAIN_PRESETS[m.rough].name + ' terrain');
  if (m.rich !== DEFAULT_RICH) extra.push(RESOURCE_PRESETS[m.rich].name + ' resources');
  if (!m.nuke) extra.push('no Nuclear race');
  if (colony && !m.wild) extra.push('no wildlife');
  if (m.events) extra.push('Planet events');
  if (todMode() !== 'cycle') extra.push(todMode() === 'day' ? 'always day' : 'always night');
  if (!weatherOn()) extra.push('no weather');
  if (m.unlimited) extra.push('Unlimited resources');
  return { main: main.join(' · '), extra: extra.join(' · ') };
}

/** Home or Customise. */
function showMenuView(v, focus) {
  const setup = v === 'setup';
  if ((UI.menuView === 'setup') === setup && UI.menuView) return;
  UI.menuView = setup ? 'setup' : 'home';
  $('m-more').hidden = !setup;
  $('m-home').hidden = setup;
  $('m-home-foot').hidden = setup;
  $('menu-card').classList.toggle('is-setup', setup);
  $('screen-menu').classList.toggle('is-setup', setup);
  $('m-new-label').textContent = setup ? 'Start' : 'Play';
  if (!setup) closePicker(false);
  else { $('m-body').scrollTop = 0; $('screen-menu').scrollTop = 0; }
  syncMenu();
  if (focus) (setup ? $('m-back') : $('m-customise')).focus();
}

function initMenu() {
  UI.menuHover = {};
  const pick = (fn) => () => { fn(); syncMenu(); saveSettings(); sfx('click'); };
  for (const btn of $('m-mode').children) btn.onclick = () => { UI.menu.mode = btn.dataset.v; syncMenu(); sfx('click'); };
  for (const btn of $('m-diff').children) { btn.dataset.info = DIFF_INFO[btn.dataset.v] || ''; btn.onclick = pick(() => { UI.menu.diff = btn.dataset.v; }); }
  for (const btn of $('m-players').children) btn.onclick = pick(() => { UI.menu.players = +btn.dataset.v; });
  // Choices are buttons (all the options in view). Terrain and Resources are level meters, a bar per step.
  const choice = (id, labels, get, set, info, meter) => {
    const el = $(id);
    el.innerHTML = '';
    labels.forEach((lab, v) => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.v = v; b.setAttribute('role', 'radio');
      if (meter) { b.innerHTML = `<i style="height:${Math.round(28 + (72 * v) / Math.max(1, labels.length - 1))}%"></i>`; b.setAttribute('aria-label', lab); b.title = lab; }
      else b.textContent = lab;
      if (info) b.dataset.info = info(v);
      b.onclick = pick(() => set(v));
      el.appendChild(b);
    });
    el._get = get;
  };
  choice('m-size', SIZE_PRESETS.map((p) => p.name), menuSize, (v) => { UI.menu.size[UI.menu.mode] = v; });
  choice('m-rough', TERRAIN_PRESETS.map((p) => p.name), () => UI.menu.rough, (v) => { UI.menu.rough = v; }, terrainInfo, true);
  choice('m-rich', RESOURCE_PRESETS.map((p) => p.name), () => UI.menu.rich, (v) => { UI.menu.rich = v; }, resourceInfo, true);
  // Rival style: 0 is a random personality for each rival, then each one in PERSONALITY_ORDER.
  choice('m-style', ['Random', ...PERSONALITY_ORDER.map((k) => PERSONALITIES[k].name)], menuStyle, (v) => { UI.menu.style = v; }, styleInfo);
  for (const [id, k] of [['m-nuke', 'nuke'], ['m-wild', 'wild'], ['m-events', 'events'], ['m-unlimited', 'unlimited']]) {
    $(id).onchange = () => { UI.menu[k] = $(id).checked ? 1 : 0; syncMenu(); saveSettings(); sfx('click'); };
  }
  for (const btn of $('m-daynight').children) { btn.dataset.info = TOD_INFO[btn.dataset.v]; btn.onclick = () => { setTodMode(btn.dataset.v); syncMenu(); sfx('click'); }; }
  $('m-weather').onchange = () => { setWeatherOn($('m-weather').checked); syncMenu(); sfx('click'); };
  $('m-reroll').onclick = () => { UI.menu.seed = randomSeed(); syncMenu(); sfx('click'); };
  $('m-saveplanet').onclick = () => {
    savePlanet(menuPlanet()); sfx('place'); toast(`Saved Planet #${UI.menu.seed}: pick it from Saved planets any time.`, 'good'); syncMenu();
    // (Toasts belong to the game screen: say it on the button too.)
    const b = $('m-saveplanet'); b.textContent = 'Saved ✓'; clearTimeout(UI.savedFlash); UI.savedFlash = setTimeout(() => { b.textContent = 'Save'; }, 1600);
  };
  // The two views. Tests and older code open Customise with $('m-more').open = true (it was a <details>).
  $('m-customise').onclick = () => { sfx('click'); showMenuView('setup', true); };
  $('m-back').onclick = () => { sfx('click'); showMenuView('home', true); };
  Object.defineProperty($('m-more'), 'open', { configurable: true, get: () => UI.menuView === 'setup', set: (v) => showMenuView(v ? 'setup' : 'home') });
  $('m-new').onclick = () => { audioUnlock(); startNewGame(); };
  // Map type and Biome open their pickers.
  $('m-shape').onclick = () => { sfx('click'); openPicker('shape'); };
  $('m-biome').onclick = () => { sfx('click'); openPicker('biome'); };
  $('m-picker-close').onclick = () => closePicker();
  // Tapping outside the sheet closes it (on click, so the tap can't land on the menu underneath).
  $('m-picker').addEventListener('click', (e) => { if (e.target === $('m-picker')) closePicker(); });
  $('m-picker').addEventListener('keydown', pickerKey);
  // Esc: close the picker, then go back from Customise to Home.
  window.addEventListener('keydown', (e) => {
    if (UI.inGame || e.key !== 'Escape' || $('screen-menu').hidden) return;
    if (UI.picker) { e.preventDefault(); closePicker(); return; }
    const over = !$('screen-help').hidden || !$('screen-missions').hidden || !$('screen-stats').hidden;
    if (!over && UI.menuView === 'setup') { e.preventDefault(); showMenuView('home', true); }
  });
  // One line per section about the option under the mouse, or focused, or else what's chosen.
  for (const sec of ['m-sec-match', 'm-sec-planet', 'm-sec-rules']) {
    const el = $(sec), show = (t) => { const k = t && t.closest && t.closest('[data-info]'); UI.menuHover[sec] = k && el.contains(k) ? k : null; syncInfo(); };
    el.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') show(e.target); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') show(el.contains(document.activeElement) && document.activeElement.matches(':focus-visible') ? document.activeElement : null); });
    el.addEventListener('focusin', (e) => show(e.target));
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) show(null); });
  }
  // The preview follows the size of its box.
  if (window.ResizeObserver) new ResizeObserver(() => { PV.drawn = ''; schedulePreview(true); }).observe($('m-pv'));
  showMenuView('home');
}

/** Each section's line: the hovered or focused option's, or else the choice's. */
function syncInfo() {
  const m = UI.menu, H = UI.menuHover || {}, three = menuThree();
  const line = (sec, def) => (H[sec] && H[sec].isConnected && !H[sec].closest('[hidden]') ? H[sec].dataset.info : def) || def;
  const P = SHAPE_PRESETS[m.shape || 0];
  $('m-mode-desc').textContent = line('m-sec-match', modeInfo(m.mode, three));
  $('m-planet-info').textContent = line('m-sec-planet', m.shapeRnd ? $('m-shape').dataset.info : `${P.name}: ${P.blurb || ''}`);
  $('m-rules-info').textContent = line('m-sec-rules', TOD_INFO[todMode()]);
}

/** Bring every control in the menu up to date with UI.menu (and the device's time of day and weather). */
function syncMenu() {
  if (typeof ensureBiomeArt === 'function') ensureBiomeArt(BIOME_ORDER[UI.menu.biome || 0]); // the chosen biome's swatch
  const m = UI.menu, colony = m.mode === 'colony', three = menuThree();
  const mark = (b, on) => { b.classList.toggle('on', on); if (b.getAttribute('role') === 'radio') b.setAttribute('aria-checked', on ? 'true' : 'false'); };
  for (const btn of $('m-mode').children) { mark(btn, btn.dataset.v === m.mode); btn.dataset.info = modeInfo(btn.dataset.v, false); }
  for (const btn of $('m-diff').children) mark(btn, btn.dataset.v === m.diff);
  $('m-diff-field').hidden = colony;
  // Free-for-all (you and two rivals) on the map types with room for three (Random picks one of those).
  const shape = m.shape || 0, SH = SHAPE_PRESETS[shape], ffaOk = !!m.shapeRnd || !!SH.ffa;
  $('m-players-field').hidden = colony;
  for (const btn of $('m-players').children) {
    mark(btn, +btn.dataset.v === (three ? 3 : 2));
    btn.disabled = btn.dataset.v === '3' && !ffaOk;
    btn.dataset.info = btn.dataset.v === '3' ? modeInfo('versus', true) + (ffaOk ? '' : ` (Not on ${SH.name}: pick a map type marked 3 players.)`) : 'You vs 1: you and one rival colony, landing at the far end of the planet.';
  }
  $('m-players-note').hidden = colony || ffaOk || m.players !== 3;
  $('m-players-note').textContent = `${SH.name} is for two players only: pick a map type marked “3 players” for a free-for-all.`;
  $('m-seed').textContent = 'Planet #' + m.seed;
  renderPlanets();
  for (const id of ['m-size', 'm-rough', 'm-rich', 'm-style']) {
    const el = $(id), v = el._get();
    for (const b of el.children) { mark(b, +b.dataset.v === v); b.classList.toggle('lit', +b.dataset.v <= v); }
  }
  // (Random map type: sizes as on a Standard map; the others differ a little.)
  const players = three ? 3 : 2, dShape = m.shapeRnd ? 0 : shape, dims = mapDims({ size: menuSize(), shape: dShape, players });
  for (const b of $('m-size').children) { const d = mapDims({ size: +b.dataset.v, shape: dShape, players }); b.dataset.info = `${SIZE_PRESETS[+b.dataset.v].name}: ${m.shapeRnd ? 'about ' : ''}${d.W}×${d.H} tiles${m.shapeRnd ? ' (map types differ a little)' : ''}.`; }
  $('m-size-v').textContent = `${m.shapeRnd ? '~' : ''}${dims.W}×${dims.H}`;
  $('m-pv-dims').textContent = m.shapeRnd ? 'Random map type' : `${dims.W}×${dims.H} tiles`;
  $('m-rough-v').textContent = TERRAIN_PRESETS[m.rough].name;
  $('m-rich-v').textContent = RESOURCE_PRESETS[m.rich].name;
  $('m-style-row').hidden = colony;
  $('m-wild-row').hidden = !colony;
  for (const [id, on] of [['m-nuke', m.nuke], ['m-wild', m.wild], ['m-events', m.events], ['m-unlimited', m.unlimited], ['m-weather', weatherOn()]]) {
    $(id).checked = !!on;
    $(id + '-row').classList.toggle('on', !!on);
  }
  for (const btn of $('m-daynight').children) mark(btn, btn.dataset.v === todMode());
  syncPickRows();
  // Random can't be saved as a planet: pick a map type and biome first.
  const rnd = !!(m.shapeRnd || m.biomeRnd);
  $('m-saveplanet').disabled = rnd;
  $('m-saveplanet').title = rnd ? 'Pick a map type and biome (not Random) to save this planet' : 'Keep this planet (with its map settings) to play again';
  const sum = menuSummary();
  $('m-more-sum').innerHTML = `<span class="sum-main">${sum.main}</span>` + (sum.extra ? `<span class="sum-extra"><span class="vh"> · </span>${sum.extra}</span>` : '');
  $('m-continue').hidden = !hasSave();
  syncInfo();
  schedulePreview();
}

/** The Map type and Biome rows: the choice, with a thumbnail (redrawn as art arrives). */
function syncPickRows() {
  const m = UI.menu, three = menuThree(), shape = m.shape || 0, SH = SHAPE_PRESETS[shape];
  const sRow = $('m-shape'), bRow = $('m-biome'), bk = BIOME_ORDER[m.biome || 0];
  sRow.querySelector('.m-pick-name').textContent = m.shapeRnd ? 'Random' : SH.name;
  sRow.querySelector('.m-pick-meta').textContent = m.shapeRnd ? (three ? 'any for 3 players' : 'any map type') : mapGroupName(SH.group);
  sRow.dataset.info = m.shapeRnd ? `Random map type: ${three ? 'one with room for three players' : 'any of them'}, picked when you land.` : `${SH.name}: ${SH.blurb || ''}`;
  sRow.setAttribute('aria-label', `Map type: ${m.shapeRnd ? 'Random' : SH.name}. Change`);
  drawThumbOnce(sRow.querySelector('canvas'), 'shape:' + (m.shapeRnd ? 'rnd' : shape), (cv) => drawShapeThumb(cv, m.shapeRnd ? null : SH));
  bRow.querySelector('.m-pick-name').textContent = m.biomeRnd ? 'Random' : biomeName(m.biome || 0);
  bRow.querySelector('.m-pick-meta').textContent = m.biomeRnd ? 'any biome' : '';
  bRow.dataset.info = m.biomeRnd ? 'Random biome: any of them, picked when you land.' : `${biomeName(m.biome || 0)}: ${(BIOMES[bk] && BIOMES[bk].desc) || ''}`;
  bRow.setAttribute('aria-label', `Biome: ${m.biomeRnd ? 'Random' : biomeName(m.biome || 0)}. Change`);
  drawThumbOnce(bRow.querySelector('canvas'), 'biome:' + (m.biomeRnd ? 'rnd' : bk) + ':' + artCount(), (cv) => drawBiomeSwatch(cv, m.biomeRnd ? null : bk));
}

/* ------------------------------------------------------------------ map type and biome pickers */

function openPicker(kind) {
  if (kind === 'biome' && typeof ensureBiomeArt === 'function') for (const b of BIOME_ORDER) ensureBiomeArt(b); // their swatches fill in as it arrives
  const m = UI.menu, body = $('m-picker-body'), three = m.mode === 'versus' && m.players === 3;
  UI.picker = { kind, opener: document.activeElement };
  $('m-picker-title').textContent = kind === 'shape' ? 'Map type' : 'Biome';
  $('m-picker').classList.toggle('bio', kind === 'biome');
  const card = (v, on, inner, cls, tip) => `<button type="button" class="pcard${cls ? ' ' + cls : ''}" data-v="${v}"${on ? ' aria-current="true"' : ''}${tip ? ` title="${tip.replace(/"/g, '&quot;')}"` : ''}>${inner}</button>`;
  let h = '';
  if (kind === 'shape') {
    const text = (name, badges, blurb) => `<canvas class="pc-thumb" aria-hidden="true"></canvas><span class="pc-text"><span class="pc-name">${name}</span>${badges ? `<span class="pc-badges">${badges}</span>` : ''}<span class="pc-blurb">${blurb}</span></span>`;
    h += `<div class="pgrid">${card('rnd', m.shapeRnd, text('Random', '', three ? 'One of the map types with room for three, picked when you land.' : 'Any map type, picked when you land.'), 'rnd')}</div>`;
    const groups = MAP_GROUPS.map((g) => ({ ...g, list: [] })), other = { key: '', name: 'More', list: [] };
    SHAPE_PRESETS.forEach((P, i) => (groups.find((g) => g.key === P.group) || other).list.push(i));
    for (const g of groups.concat(other)) {
      if (!g.list.length) continue;
      h += `<section class="pgroup" aria-label="${g.name}"><h3>${g.name}</h3><div class="pgrid">` + g.list.map((i) => {
        const P = SHAPE_PRESETS[i], badges = (P.ffa ? '<span class="badge ffa">3 players</span>' : '') + (P.naval ? '<span class="badge naval">Naval</span>' : '');
        return card(i, !m.shapeRnd && i === (m.shape || 0), text(P.name, badges, P.blurb || ''), '', P.blurb);
      }).join('') + '</div></section>';
    }
  } else {
    const inner = (name, desc) => `<canvas class="pc-swatch" aria-hidden="true"></canvas><span class="pc-name">${name}</span><span class="pc-blurb">${desc}</span>`;
    h += '<div class="pgrid">' + card('rnd', m.biomeRnd, inner('Random', 'Any biome, picked when you land.'), 'rnd')
      + BIOME_ORDER.map((k, i) => card(i, !m.biomeRnd && i === (m.biome || 0), inner(BIOMES[k].name, BIOMES[k].desc || ''), '', BIOMES[k].desc)).join('') + '</div>';
  }
  body.innerHTML = h;
  for (const b of body.querySelectorAll('.pcard')) {
    b.setAttribute('aria-pressed', b.hasAttribute('aria-current') ? 'true' : 'false');
    b.onclick = () => choosePicked(kind, b.dataset.v);
  }
  $('m-picker').hidden = false;
  body.scrollTop = 0;
  drawPickerArt();
  const cur = body.querySelector('[aria-current]') || body.querySelector('.pcard');
  cur.focus({ preventScroll: true });
  cur.scrollIntoView({ block: 'nearest' });
}

/** Thumbnails and swatches for the open picker (again when art arrives). */
function drawPickerArt() {
  if (!UI.picker) return;
  for (const b of $('m-picker-body').querySelectorAll('.pcard')) {
    const cv = b.querySelector('canvas'), v = b.dataset.v;
    if (UI.picker.kind === 'shape') drawShapeThumb(cv, v === 'rnd' ? null : SHAPE_PRESETS[+v]);
    else drawBiomeSwatch(cv, v === 'rnd' ? null : BIOME_ORDER[+v]);
  }
}

function choosePicked(kind, v) {
  const m = UI.menu, rnd = v === 'rnd';
  if (kind === 'shape') { m.shapeRnd = rnd ? 1 : 0; if (!rnd) m.shape = +v; } else { m.biomeRnd = rnd ? 1 : 0; if (!rnd) m.biome = +v; }
  sfx('click');
  closePicker();
  syncMenu();
  saveSettings();
}

function closePicker(restore = true) {
  if (!UI.picker) { $('m-picker').hidden = true; return; }
  const opener = UI.picker.opener;
  UI.picker = null;
  $('m-picker').hidden = true;
  $('m-picker-body').innerHTML = '';
  if (restore && opener && opener.isConnected && opener.focus) opener.focus();
}

/** Keys in a picker: arrows move between cards (up and down by rows), Home / End, Tab stays inside. */
function pickerKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePicker(); return; }
  const cards = [...$('m-picker-body').querySelectorAll('.pcard')];
  if (e.key === 'Tab') {
    const all = [$('m-picker-close'), ...cards], i = all.indexOf(document.activeElement);
    if (e.shiftKey ? i <= 0 : i === all.length - 1) { e.preventDefault(); all[e.shiftKey ? all.length - 1 : 0].focus(); }
    return;
  }
  const i = cards.indexOf(document.activeElement);
  if (i < 0) return;
  let j = -1;
  if (e.key === 'ArrowRight') j = Math.min(cards.length - 1, i + 1);
  else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1);
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = cards.length - 1;
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    // The nearest card in the next row up or down, closest across.
    const r = cards[i].getBoundingClientRect(), cx = r.left + r.width / 2, down = e.key === 'ArrowDown';
    let best = -1, bestRow = Infinity, bestDx = Infinity;
    cards.forEach((c, k) => {
      const q = c.getBoundingClientRect(), dy = down ? q.top - r.top : r.top - q.top;
      if (dy < 4) return;
      const dx = Math.abs(q.left + q.width / 2 - cx);
      if (dy < bestRow - 4 || (Math.abs(dy - bestRow) <= 4 && dx < bestDx)) { best = k; bestRow = dy; bestDx = dx; }
    });
    j = best;
  }
  if (j >= 0) { e.preventDefault(); cards[j].focus({ preventScroll: true }); cards[j].scrollIntoView({ block: 'nearest' }); }
}

/** Random map type and biome: a concrete pick for the game about to start (3 players: map types with room for three). */
function resolveRandom() {
  const m = UI.menu, out = { shape: m.shape || 0, biome: m.biome || 0 };
  if (m.shapeRnd) {
    const pool = SHAPE_PRESETS.map((_, i) => i).filter((i) => !(m.mode === 'versus' && m.players === 3) || SHAPE_PRESETS[i].ffa);
    out.shape = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 0;
  }
  if (m.biomeRnd) out.biome = Math.floor(Math.random() * BIOME_ORDER.length);
  return out;
}

/* ------------------------------------------------------------------ menu thumbnails */

/** Size a canvas to its box at the screen's pixel density; returns its context (in CSS pixels) and size. */
function fitCanvas(cv) {
  const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight), dpr = Math.min(3, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h, dpr };
}
const artCount = () => (typeof artLoaded === 'number' ? artLoaded : 0);
/** Draw a menu thumbnail only when what it shows (or its size) changed. */
function drawThumbOnce(cv, key, draw) {
  if (!cv.clientWidth) return;
  const k = key + '@' + cv.clientWidth + 'x' + cv.clientHeight;
  if (cv._k === k) return;
  cv._k = k;
  draw(cv);
}
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

const THUMB = {
  space: '#0d0f15', ground: '#b07650', hi: '#cd9563', lo: '#8a5636', water: '#1f566b', waterHi: '#3b8799', rock: '#4b3329', rockHi: '#6c4a3a',
  floor: '#1c1411', ramp: '#e6cc96', sand: '#ecd29a', green: '#5bd27d', lava: '#ff7a2e', lavaHi: '#ffd166',
  res: ['#3fd8a6', '#ff8a3d', '#b98cff', '#c9c1b4'],
};

/**
 * A map type drawn as a little schematic from its flags (islands, rift, crater...), with the two bases
 * (yours cyan at the bottom, the rival's red at the top). Unknown flags get plain open ground; null is Random.
 */
function drawShapeThumb(cv, P) {
  const { ctx, w, h } = fitCanvas(cv);
  const r0 = Math.min(6, w * 0.08);
  if (!P) {
    // Random: stacked map cards with a question mark.
    ctx.fillStyle = THUMB.space; roundRect(ctx, 0, 0, w, h, r0); ctx.fill();
    const s = Math.min(w, h);
    for (const [dx, dy, a, c] of [[-0.16, 0.06, -0.22, THUMB.water], [0.16, 0.04, 0.2, THUMB.lo], [0, 0, 0, THUMB.ground]]) {
      ctx.save(); ctx.translate(w / 2 + dx * s, h / 2 + dy * s); ctx.rotate(a);
      ctx.fillStyle = c; roundRect(ctx, -s * 0.24, -s * 0.32, s * 0.48, s * 0.64, s * 0.06); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(s * 0.38)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4; ctx.fillText('?', w / 2, h / 2 + s * 0.02); ctx.shadowBlur = 0;
    return;
  }
  const i = SHAPE_PRESETS.indexOf(P), d = mapDims({ size: 1, shape: Math.max(0, i), players: 2 });
  let s = strHash(P.name);
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  // The map's own proportions (Long haul is tall and narrow), inside the thumbnail.
  const pad = Math.max(2, Math.min(w, h) * 0.05), a = d.W / d.H;
  let mh = h - pad * 2, mw = mh * a;
  if (mw > w - pad * 2) { mw = w - pad * 2; mh = mw / a; }
  const x0 = (w - mw) / 2, y0 = (h - mh) / 2, X = (u) => x0 + u * mw, Y = (v) => y0 + v * mh, U = Math.min(mw, mh);
  ctx.fillStyle = THUMB.space; roundRect(ctx, 0, 0, w, h, r0); ctx.fill();
  ctx.save();
  roundRect(ctx, x0, y0, mw, mh, Math.min(4, U * 0.06)); ctx.clip();
  // A wobbly blob, mirrored through the centre when `sym` (the map is point-symmetric).
  const blob = (u, v, rx, ry, fill, stroke, sym) => {
    for (const [uu, vv] of sym ? [[u, v], [1 - u, 1 - v]] : [[u, v]]) {
      ctx.beginPath();
      const n = 14, ph = rnd() * 6;
      for (let k = 0; k <= n; k++) {
        const t = (k / n) * Math.PI * 2, f = 1 + 0.14 * Math.sin(t * 3 + ph) + 0.08 * Math.sin(t * 5 + ph * 2);
        const px = X(uu) + Math.cos(t) * rx * mw * f, py = Y(vv) + Math.sin(t) * ry * mh * f;
        if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, U * 0.025); ctx.stroke(); }
    }
  };
  const line = (pts, col, lw, dash) => {
    ctx.beginPath(); pts.forEach(([u, v], k) => (k ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash(dash || []); ctx.stroke(); ctx.setLineDash([]);
  };
  const jag = (v0, v1, n, amp) => Array.from({ length: n + 1 }, (_, k) => [k / n, v0 + (v1 - v0) * (k / n) + (k % 2 ? amp : -amp) * (0.5 + rnd() * 0.5)]);
  // Ground with a few rises and hollows.
  ctx.fillStyle = THUMB.ground; ctx.fillRect(x0, y0, mw, mh);
  ctx.globalAlpha = 0.5;
  for (let k = 0; k < 4; k++) blob(0.15 + rnd() * 0.7, 0.55 + rnd() * 0.35, 0.12 + rnd() * 0.12, 0.06 + rnd() * 0.06, k % 2 ? THUMB.hi : THUMB.lo, null, true);
  ctx.globalAlpha = 1;
  let crags = 2;
  if (P.sky) {
    ctx.fillStyle = THUMB.floor; ctx.fillRect(x0, y0, mw, mh);
    const mesa = (u, v, rx, ry) => { for (const [uu, vv] of [[u, v], [1 - u, 1 - v]]) { ctx.save(); ctx.translate(U * 0.025, U * 0.04); blob(uu, vv, rx, ry, 'rgba(0,0,0,0.55)'); ctx.restore(); blob(uu, vv, rx, ry, THUMB.hi, THUMB.rockHi); } };
    mesa(0.5, 0.86, 0.3, 0.1);
    for (let k = 0; k < 4; k++) mesa(0.15 + rnd() * 0.7, 0.52 + k * 0.08, 0.07 + rnd() * 0.05, 0.04 + rnd() * 0.02);
    crags = 0;
  } else if (P.islands || P.tidal) {
    ctx.fillStyle = THUMB.water; ctx.fillRect(x0, y0, mw, mh);
    const isle = (u, v, rx, ry) => { blob(u, v, rx * 1.12, ry * 1.18, THUMB.waterHi, null, true); s -= 2; blob(u, v, rx, ry, THUMB.ground, null, true); };
    const home = P.tidal ? [0.5, 0.84, 0.34, 0.13] : [0.5, 0.87, 0.36, 0.1];
    const mids = P.tidal ? [[0.3, 0.6, 0.13, 0.07], [0.72, 0.62, 0.11, 0.06]] : [[0.28, 0.6, 0.14, 0.06], [0.74, 0.62, 0.1, 0.05]];
    if (P.tidal) for (const [u, v] of mids) { line([[0.5, home[1] - home[3]], [u, v]], THUMB.sand, Math.max(1.2, U * 0.04), [U * 0.06, U * 0.05]); line([[0.5, 1 - home[1] + home[3]], [1 - u, 1 - v]], THUMB.sand, Math.max(1.2, U * 0.04), [U * 0.06, U * 0.05]); }
    isle(...home);
    for (const q of mids) isle(...q);
    if (!P.tidal) isle(0.12 + rnd() * 0.1, 0.72, 0.035, 0.022);
    crags = 0;
  }
  if (P.lakes) for (let k = 0; k < 4; k++) { const u = 0.12 + rnd() * 0.76, v = 0.52 + rnd() * 0.3; blob(u, v, 0.07 + rnd() * 0.05, 0.035 + rnd() * 0.025, THUMB.water, THUMB.waterHi, true); }
  if (P.oases) {
    ctx.fillStyle = 'rgba(70,38,22,0.45)'; ctx.fillRect(x0, y0, mw, mh);
    for (let k = 0; k < 5; k++) blob(0.1 + rnd() * 0.8, 0.5 + rnd() * 0.45, 0.05, 0.03, THUMB.rock, null, true);
    for (const [u, v] of [[0.25, 0.62], [0.7, 0.58], [0.5, 0.5]]) { blob(u, v, 0.09, 0.05, 'rgba(91,210,125,0.35)', null, true); blob(u, v, 0.045, 0.025, THUMB.green, null, true); }
    crags = 0;
  }
  if (P.choke) {
    const band = [...jag(0.43, 0.43, 8, 0.02), ...jag(0.57, 0.57, 8, 0.02).reverse()];
    ctx.beginPath(); band.forEach(([u, v], k) => (k ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v)))); ctx.closePath(); ctx.fillStyle = THUMB.rock; ctx.fill();
    for (const u of [0.3, 0.68]) line([[u, 0.41], [u + 0.04, 0.47], [u - 0.03, 0.53], [u + 0.01, 0.59]], THUMB.ground, Math.max(2, U * 0.07));
    crags = 0;
  }
  if (P.rift) {
    const top = jag(0.45, 0.47, 9, 0.025), bot = jag(0.55, 0.53, 9, 0.025);
    ctx.beginPath(); [...top, ...bot.reverse()].forEach(([u, v], k) => (k ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v)))); ctx.closePath();
    ctx.fillStyle = THUMB.floor; ctx.fill(); ctx.strokeStyle = THUMB.rockHi; ctx.lineWidth = Math.max(1, U * 0.02); ctx.stroke();
    for (const u of [0.22, 0.78]) line([[u, 0.42], [u, 0.58]], THUMB.hi, Math.max(2, U * 0.06));
    crags = 0;
  }
  if (P.fault) {
    const pts = jag(0.4, 0.6, 10, 0.035);
    ctx.beginPath(); ctx.moveTo(X(0), Y(0)); pts.forEach(([u, v]) => ctx.lineTo(X(u), Y(v))); ctx.lineTo(X(1), Y(0)); ctx.closePath(); ctx.fillStyle = 'rgba(60,30,18,0.3)'; ctx.fill();
    line(pts, '#2a1a14', Math.max(1.5, U * 0.04)); line(pts.map(([u, v]) => [u, v + 0.012]), THUMB.hi, Math.max(0.8, U * 0.015));
  }
  if (P.delta) {
    const lw = Math.max(1.5, U * 0.06);
    line([[0, 0.48], [0.18, 0.5], [0.36, 0.47], [0.5, 0.5]], THUMB.water, lw * 1.4);
    for (const [v1, v2] of [[0.36, 0.3], [0.46, 0.44], [0.56, 0.6], [0.66, 0.72]]) line([[0.5, 0.5], [0.7, (0.5 + v1) / 2 + 0.02], [0.86, v1], [1, v2]], THUMB.water, lw * 0.8);
    blob(0.85, 0.5, 0.08, 0.12, 'rgba(91,210,125,0.25)');
    crags = 1;
  }
  if (P.crater) {
    ctx.beginPath(); ctx.ellipse(X(0.5), Y(0.5), U * 0.36, U * 0.36 * 0.92, 0, 0, Math.PI * 2); ctx.fillStyle = THUMB.hi; ctx.fill();
    ctx.beginPath(); ctx.ellipse(X(0.5), Y(0.5), U * 0.28, U * 0.28 * 0.92, 0, 0, Math.PI * 2); ctx.fillStyle = THUMB.lo; ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,10,0.55)'; ctx.lineWidth = Math.max(1, U * 0.025); ctx.stroke();
    for (const v of [-1, 1]) { ctx.fillStyle = THUMB.ramp; ctx.fillRect(X(0.5) - U * 0.04, Y(0.5) + v * U * 0.3 - U * 0.04, U * 0.08, U * 0.08); }
    for (let k = 0; k < 5; k++) { ctx.fillStyle = THUMB.res[k % 3 + 1]; ctx.beginPath(); ctx.arc(X(0.5) + (rnd() - 0.5) * U * 0.3, Y(0.5) + (rnd() - 0.5) * U * 0.3, Math.max(1, U * 0.035), 0, 7); ctx.fill(); }
    crags = 0;
  }
  if (P.plateau) {
    for (const v of [0.84, 0.16]) {
      const bx = X(0.5) - mw * 0.3, by = Y(v) - mh * 0.12, bw = mw * 0.6, bh = mh * 0.24;
      ctx.fillStyle = 'rgba(40,20,10,0.6)'; roundRect(ctx, bx + U * 0.03, by + U * 0.05, bw, bh, U * 0.05); ctx.fill();
      ctx.fillStyle = THUMB.hi; roundRect(ctx, bx, by, bw, bh, U * 0.05); ctx.fill();
      ctx.fillStyle = THUMB.ramp; ctx.fillRect(bx - U * 0.03, by + bh * 0.4, U * 0.06, bh * 0.2); ctx.fillRect(bx + bw - U * 0.03, by + bh * 0.4, U * 0.06, bh * 0.2);
    }
  }
  if (P.ring) { blob(0.5, 0.5, 0.3, 0.2, THUMB.rock, THUMB.rockHi); blob(0.47, 0.47, 0.14, 0.08, THUMB.rockHi); crags = 0; }
  if (P.cross) {
    const lw = Math.max(2, U * 0.08);
    line([[0.1, 0.5], [0.9, 0.5]], THUMB.rock, lw); line([[0.5, 0.1], [0.5, 0.9]], THUMB.rock, lw);
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.13, 0, 7); ctx.fillStyle = THUMB.hi; ctx.fill();
    for (let k = 0; k < 4; k++) { ctx.fillStyle = THUMB.res[k % 3 + 1]; ctx.beginPath(); ctx.arc(X(0.5) + Math.cos(k * 1.6) * U * 0.06, Y(0.5) + Math.sin(k * 1.6) * U * 0.06, Math.max(1, U * 0.03), 0, 7); ctx.fill(); }
    crags = 0;
  }
  if (P.volcano) {
    for (const [r, c] of [[0.3, '#3a2620'], [0.22, '#5a3a2c'], [0.13, '#7a4a34']]) { ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * r, 0, 7); ctx.fillStyle = c; ctx.fill(); }
    ctx.shadowColor = THUMB.lava; ctx.shadowBlur = U * 0.12;
    for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2 + rnd() * 0.4, r1 = 0.07, r2 = 0.24 + rnd() * 0.12; line([[0.5 + (Math.cos(t) * r1 * U) / mw, 0.5 + (Math.sin(t) * r1 * U) / mh], [0.5 + (Math.cos(t + 0.15) * (r1 + r2) * 0.5 * U) / mw, 0.5 + (Math.sin(t + 0.15) * (r1 + r2) * 0.5 * U) / mh], [0.5 + (Math.cos(t) * r2 * U) / mw, 0.5 + (Math.sin(t) * r2 * U) / mh]], THUMB.lava, Math.max(1, U * 0.03)); }
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.06, 0, 7); ctx.fillStyle = THUMB.lavaHi; ctx.fill();
    ctx.shadowBlur = 0;
    crags = 0;
  }
  if (P.maze) {
    // A labyrinth carved from a grid (the same every time for this map type).
    const cw = 5, ch = Math.max(5, Math.round(cw / a)), seen = new Uint8Array(cw * ch), walls = [];
    const open = new Set(), stack = [Math.floor(cw / 2) + (ch - 1) * cw];
    seen[stack[0]] = 1;
    while (stack.length) {
      const c = stack[stack.length - 1], cx = c % cw, cy = (c / cw) | 0;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [cx + dx, cy + dy]).filter(([x, y]) => x >= 0 && y >= 0 && x < cw && y < ch && !seen[y * cw + x]);
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny] = nb[Math.floor(rnd() * nb.length)], n = ny * cw + nx;
      seen[n] = 1; open.add(Math.min(c, n) + ':' + Math.max(c, n)); stack.push(n);
    }
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const c = y * cw + x;
      if (x < cw - 1 && !open.has(c + ':' + (c + 1))) walls.push([[(x + 1) / cw, y / ch], [(x + 1) / cw, (y + 1) / ch]]);
      if (y < ch - 1 && !open.has(c + ':' + (c + cw))) walls.push([[x / cw, (y + 1) / ch], [(x + 1) / cw, (y + 1) / ch]]);
    }
    for (const wl of walls) line(wl, THUMB.rock, Math.max(1.5, (U / cw) * 0.35));
    crags = 0;
  }
  for (let k = 0; k < crags; k++) blob(0.15 + rnd() * 0.7, 0.55 + rnd() * 0.2, 0.06, 0.035, THUMB.rock, THUMB.rockHi, true);
  // A few resource fields, and the bases.
  if (!P.maze && !P.sky) for (let k = 0; k < 3; k++) { const u = 0.15 + rnd() * 0.7, v = 0.6 + rnd() * 0.12; ctx.fillStyle = THUMB.res[k % 4]; for (const [uu, vv] of [[u, v], [1 - u, 1 - v]]) { ctx.beginPath(); ctx.arc(X(uu), Y(vv), Math.max(1, U * 0.03), 0, 7); ctx.fill(); } }
  const bs = Math.max(3, U * 0.1);
  for (const [v, c] of [[0.88, PLAYER_COLORS[0]], [0.12, PLAYER_COLORS[1]]]) {
    ctx.fillStyle = c; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, bs * 0.18);
    roundRect(ctx, X(0.5) - bs / 2, Y(v) - bs / 2, bs, bs, bs * 0.25); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; roundRect(ctx, x0 + 0.5, y0 + 0.5, mw - 1, mh - 1, Math.min(4, U * 0.06)); ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The biome's ground texture: its own art, or the desert's recoloured to its palette (render.js), or null. */
function biomeGround(b) {
  const own = b === 'desert' ? ART.ground : ART['ground-' + b];
  if (own || !biomeLook(b) || typeof biomeTexture !== 'function') return own || null;
  try { return biomeTexture(b, 'ground'); } catch (e) { return null; }
}
function biomeLook(b) { return typeof BIOME_LOOK === 'object' && BIOME_LOOK[b] ? BIOME_LOOK[b] : null; }

/**
 * A swatch of a biome: its ground texture with a few of its plants standing on it. Biomes whose art
 * isn't in yet fall back to their palette (or a neutral one). null is Random: slices of every biome.
 */
function drawBiomeSwatch(cv, b) {
  const { ctx, w, h } = fitCanvas(cv);
  if (!b) {
    const n = BIOME_ORDER.length;
    BIOME_ORDER.forEach((k, i) => {
      ctx.save(); ctx.beginPath();
      const x0 = (i / n) * (w + h * 0.5) - h * 0.25, x1 = ((i + 1) / n) * (w + h * 0.5) - h * 0.25;
      ctx.moveTo(x0 + h * 0.25, 0); ctx.lineTo(x1 + h * 0.25 + 0.6, 0); ctx.lineTo(x1 - h * 0.25 + 0.6, h); ctx.lineTo(x0 - h * 0.25, h); ctx.closePath(); ctx.clip();
      swatchGround(ctx, w, h, k);
      ctx.restore();
    });
    ctx.fillStyle = 'rgba(8,10,14,0.45)'; ctx.fillRect(0, 0, w, h);
    const s = Math.min(w, h);
    ctx.fillStyle = '#fff'; ctx.font = `800 ${Math.round(s * 0.5)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 5; ctx.fillText('?', w / 2, h / 2 + s * 0.03); ctx.shadowBlur = 0;
    return;
  }
  swatchGround(ctx, w, h, b);
  // Plants: a big one, a middling one and a small one, the way they'd stand on the ground.
  const s = Math.min(w * 0.62, h);
  const spots = w / h > 1.4 ? [[0.22, 0.6, 0.95, 1], [0.58, 0.42, 0.8, 3], [0.84, 0.72, 0.6, 6]] : [[0.32, 0.4, 0.95, 1], [0.72, 0.68, 0.7, 3]];
  for (const [u, v, f, n] of spots) {
    const A = ART[`plant-${b}-${n}`] || ART[`plant-${b}-1`];
    if (!A || !A.img) continue;
    const z = s * f * 1.15;
    ctx.drawImage(A.img, u * w - z / 2, v * h - z / 2, z, z);
  }
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
function swatchGround(ctx, w, h, b) {
  const G = biomeGround(b), look = biomeLook(b);
  if (G && G.img && G.img.width) {
    const pat = ctx.createPattern(G.img, 'repeat'), k = Math.max(0.18, Math.min(0.5, (h * 1.6) / G.img.width));
    if (pat && pat.setTransform && window.DOMMatrix) pat.setTransform(new DOMMatrix().scale(k));
    ctx.fillStyle = pat || '#777'; ctx.fillRect(0, 0, w, h);
    return;
  }
  const lv = look && look.level, g = ctx.createLinearGradient(0, 0, w, h);
  if (lv && lv.length) { g.addColorStop(0, lv[Math.min(1, lv.length - 1)][0]); g.addColorStop(1, lv[Math.min(3, lv.length - 1)][1]); }
  else if (look && look.mm && look.mm.ground) { const [r, gg, bb] = look.mm.ground; g.addColorStop(0, `rgb(${r * 0.8},${gg * 0.8},${bb * 0.8})`); g.addColorStop(1, `rgb(${r},${gg},${bb})`); }
  else { g.addColorStop(0, '#5a606c'); g.addColorStop(1, '#7c8390'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/** Art arrives over the first seconds: redraw the menu's biome swatches as it does. */
function menuArtTick() {
  const n = artCount(), now = performance.now();
  if (n === UI.menuArtN || now - (UI.menuArtT || 0) < 300) return;
  UI.menuArtN = n; UI.menuArtT = now;
  if ($('screen-menu').hidden) return;
  if (UI.menuView === 'setup') syncPickRows();
  if (UI.picker && UI.picker.kind === 'biome') drawPickerArt();
}

/* ------------------------------------------------------------------ planet preview */

/*
 * Customise shows the very planet the settings make: generateMap (world.js) is a pure function of
 * the seed and map settings, so it's run here on its own, away from S (the live game behind the
 * menu, and the render state, are never touched). It runs ~250 ms after the last change, maps are
 * kept per settings, and if it ever fails the map type's schematic thumbnail stands in.
 */
const PV = { timer: 0, maps: new Map(), drawn: '', failed: false };

/** The settings newGame would make of the menu (Random biome: drawn as the Red desert). */
function previewSettings() {
  const m = UI.menu, mode = m.mode === 'colony' ? 'colony' : 'versus';
  const st = { size: clamp(menuSize(), 0, SIZE_PRESETS.length - 1), rough: clamp(m.rough ?? DEFAULT_ROUGH, 0, TERRAIN_PRESETS.length - 1), rich: clamp(m.rich ?? DEFAULT_RICH, 0, RESOURCE_PRESETS.length - 1) };
  st.shape = clamp(m.shape || 0, 0, SHAPE_PRESETS.length - 1);
  st.players = mode === 'versus' && m.players === 3 && SHAPE_PRESETS[st.shape].ffa ? 3 : 2;
  st.nuke = !!m.nuke;
  st.biome = m.biomeRnd ? 'desert' : BIOME_ORDER[m.biome || 0] || 'desert';
  return { seed: m.seed >>> 0, mode, st };
}
function previewKey() {
  const p = previewSettings(), s = p.st;
  return UI.menu.shapeRnd ? 'rnd' : [p.seed, p.mode, s.shape, s.size, s.rough, s.rich, s.players, s.nuke ? 1 : 0, s.biome].join(':');
}

function schedulePreview(now) {
  if (UI.menuView !== 'setup' || $('screen-menu').hidden) return;
  const key = previewKey();
  if (key === PV.drawn) return;
  clearTimeout(PV.timer);
  $('m-pv').classList.add('busy');
  PV.timer = setTimeout(drawPreview, now || !PV.drawn ? 0 : 250);
}

function drawPreview() {
  const cv = $('m-preview');
  if (!cv.clientWidth || UI.menuView !== 'setup') return;
  const key = previewKey(), p = previewSettings();
  PV.drawn = key;
  $('m-pv').classList.remove('busy');
  $('m-pv-random').hidden = !UI.menu.shapeRnd;
  if (UI.menu.shapeRnd) { const { ctx, w, h } = fitCanvas(cv); ctx.fillStyle = THUMB.space; ctx.fillRect(0, 0, w, h); return; }
  let m = PV.maps.get(key);
  if (!m && !PV.failed) {
    try {
      const { W, H } = mapDims(p.st);
      m = generateMap(p.seed, W, H, { ...p.st });
      m.W = W; m.H = H;
      PV.maps.set(key, m);
      if (PV.maps.size > 24) PV.maps.delete(PV.maps.keys().next().value);
    } catch (e) { PV.failed = true; m = null; console.warn('Terrafall: the planet preview fell back to a sketch.', e); }
  }
  if (!m) { drawShapeThumb(cv, SHAPE_PRESETS[p.st.shape]); return; }
  renderPreview(cv, m, p);
}

/** A minimap-style picture of a generated map: levels, cliffs, water, rock, resources and the bases. */
function renderPreview(cv, m, p) {
  const { ctx, w, h, dpr } = fitCanvas(cv);
  const W = m.W, H = m.H, pad = 8, k = Math.min((w - pad * 2) / W, (h - pad * 2) / H);
  const mw = W * k, mh = H * k, x0 = Math.round((w - mw) / 2), y0 = Math.round((h - mh) / 2);
  // Colours: the biome's minimap palette (render.js), the resources' as on the minimap.
  const look = biomeLook(p.st.biome) || biomeLook('desert'), mm = (look && look.mm) || {};
  const C = { ground: mm.ground || [169, 113, 74], water: mm.water || [28, 75, 93], rock: mm.rock || [74, 51, 41], ramp: mm.ramp || [235, 205, 150],
    chasm: [18, 12, 10], fertile: [92, 98, 40] };
  if (!look || !look.mm) { const G = biomeGround(p.st.biome); const c = G && typeof avgColor === 'function' ? avgColor(G) : null; if (c) C.ground = c; }
  const resCol = (r) => (typeof MM_COLORS === 'object' && MM_COLORS[r]) || [220, 220, 220];
  // Paint the tiles at about one image pixel per screen pixel, s by s each.
  const s = clamp(Math.round(k * dpr), 2, 8), IW = W * s, IH = H * s;
  const off = document.createElement('canvas'); off.width = IW; off.height = IH;
  const oc = off.getContext('2d'), img = oc.createImageData(IW, IH), px = img.data;
  const T = m.terrain, E = m.elev, Rs = m.res, Rp = m.ramp, F = m.fert;
  const isG = (t) => T[t] === T_GROUND;
  const put = (x, y, c, f) => { const o = (y * IW + x) * 4; px[o] = Math.min(255, c[0] * f); px[o + 1] = Math.min(255, c[1] * f); px[o + 2] = Math.min(255, c[2] * f); px[o + 3] = 255; };
  const edge = Math.max(1, Math.round(s / 4)), rr = (s * 0.42) ** 2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const t = j * W + i, terr = T[t], n = 0.96 + 0.08 * hash2(i, j, 91);
    let c, f = n;
    if (terr === T_WATER) c = C.water;
    else if (typeof T_CHASM !== 'undefined' && terr === T_CHASM) c = C.chasm;
    else if (terr === T_ROCK) c = C.rock;
    else if (Rp[t]) c = C.ramp;
    else { c = F && F[t] ? C.fertile : C.ground; f = n * (0.8 + 0.09 * E[t]); }
    const r = terr === T_GROUND && Rs[t] ? resCol(Rs[t]) : null;
    // Cliff edges: a dark lip where the ground drops to the tile below or beside, a light one where it rises.
    const below = j < H - 1 ? t + W : -1, right = i < W - 1 ? t + 1 : -1, above = j > 0 ? t - W : -1;
    const dropB = terr === T_GROUND && below >= 0 && isG(below) && E[below] < E[t] && !Rp[t] && !Rp[below];
    const dropR = terr === T_GROUND && right >= 0 && isG(right) && E[right] < E[t] && !Rp[t] && !Rp[right];
    const riseA = terr === T_GROUND && above >= 0 && isG(above) && E[above] < E[t];
    const shore = terr === T_WATER && ((below >= 0 && T[below] !== T_WATER) || (above >= 0 && T[above] !== T_WATER) || (right >= 0 && T[right] !== T_WATER) || (i > 0 && T[t - 1] !== T_WATER));
    const rockTop = terr === T_ROCK && above >= 0 && T[above] !== T_ROCK;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      let ff = f;
      if (dropB && y >= s - edge) ff *= 0.55;
      else if (dropR && x >= s - edge) ff *= 0.7;
      else if (riseA && y < edge) ff *= 1.12;
      if (shore) ff *= 1.18;
      if (rockTop && y < edge) ff *= 1.3;
      if (r && (x + 0.5 - s / 2) ** 2 + (y + 0.5 - s / 2) ** 2 <= rr) put(i * s + x, j * s + y, r, 1);
      else put(i * s + x, j * s + y, c, ff);
    }
  }
  oc.putImageData(img, 0, 0);
  // The planet on its dark panel, with a soft shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#000'; roundRect(ctx, x0, y0, mw, mh, 6); ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, x0, y0, mw, mh, 6); ctx.clip();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, x0, y0, mw, mh);
  // The bases: each colony's Command Base with the ring of land it holds.
  const n = p.mode === 'colony' ? 1 : p.st.players;
  for (let q = n - 1; q >= 0; q--) {
    const b = m.bases[q];
    if (!b) continue;
    const cx = x0 + (b.x + 0.5) * k, cy = y0 + (b.y + 0.5) * k, col = PLAYER_COLORS[q] || '#fff', bs = Math.max(7, k * 2.2);
    ctx.beginPath(); ctx.arc(cx, cy, k * 8, 0, Math.PI * 2);
    ctx.fillStyle = col + '24'; ctx.fill();
    ctx.setLineDash([4, 3]); ctx.strokeStyle = col + 'cc'; ctx.lineWidth = 1.2; ctx.stroke(); ctx.setLineDash([]);
    ctx.shadowColor = col; ctx.shadowBlur = 8;
    ctx.fillStyle = col; roundRect(ctx, cx - bs / 2, cy - bs / 2, bs, bs, bs * 0.25); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; roundRect(ctx, x0 + 0.5, y0 + 0.5, mw - 1, mh - 1, 6); ctx.stroke();
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
  defend: { outpost: 'o', turret: 't', minigun: 'g', bunker: 'u', keep: 'k', disruptor: 'z', mortar: 'm', flak: 'f', repair: 'e', silo: 'i', nukesilo: 'n' },
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
  // The Army panel (Q): its orders, the group size, and its Air tab.
  'ar-attack': 'q', 'ar-hold': 'g', 'ar-station': 'v', 'ar-recall': 'c', 'ar-select': 'f', 'ar-n2': '1', 'ar-n4': '2', 'ar-n8': '3', 'ar-nall': '4',
  'ar-tab-army': 'z', 'ar-tab-air': 'x', 'ar-strike': 'e',
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
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
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
    // In the Army panel a plain 1-4 picks the group size (2, 4, 8, All).
    if (digit && UI.sheetKind === 'army' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && +digit[1] <= 4) {
      const btn = $(['ar-n2', 'ar-n4', 'ar-n8', 'ar-nall'][+digit[1] - 1]);
      e.preventDefault();
      if (btn && btn.offsetParent) btn.click();
      return;
    }
    // Tab (Shift+Tab back) steps through the build menu's tabs.
    if (e.key === 'Tab' && UI.sheetKind === 'build' && $('build-tabs') && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
  const mine = selectable(0, ids).map((u) => u.id);
  UI.sel = add ? [...new Set(UI.sel.concat(mine))] : mine;
  refreshSelection();
}

/** Drop dead or captured warbots from the selection and update the selection bar. */
function refreshSelection() {
  if (UI.sel.length) UI.sel = selectable(0, UI.sel).map((u) => u.id);
  UI.selSet = new Set(UI.sel);
  const bar = $('selbar');
  if (!UI.sel.length || !UI.inGame) { bar.hidden = true; return; }
  let inside = 0, empty = 0;
  for (const u of orderable(0, UI.sel)) { if (u.inside) inside++; if ((u.ammo ?? WARBOT_AMMO) <= 0) empty++; }
  const nw = orderable(0, UI.sel).length, nr = UI.sel.length - nw;
  const html = `<b>${[nw ? `${nw} warbot${nw > 1 ? 's' : ''}` : '', nr ? `${nr} Howitzer${nr > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ')} selected</b>` +
    (inside ? ` <span class="muted">(${inside} in garrisons)</span>` : '') + (empty ? ` <span class="err">${empty} out of Ammo</span>` : '') +
    `<span class="hint">Right-click open ground to hold it, a rival building or robot to attack, or your Outpost to station them. Esc clears.</span>
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
  selectBots(ids, add);
  if (ids.length) sfx('click');
}

/** Right-click: order the selected warbots to whatever is under the pointer. */
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
    return;
  }
  // Howitzers in the selection: they shell an enemy building, or drive to open ground (or beside a garrison) and wait there.
  let nr = 0;
  if (b && b.owner !== 0) nr = orderBombard(0, UI.sel, b);
  else if (b && BDEFS[b.type].mil && b.built) { const s = deploySpot(0, b.x, b.y); if (s >= 0) nr = orderPark(0, UI.sel, s % S.W, (s / S.W) | 0); }
  else if (inMap(i, j) && walkable(tIdx(i, j)) && !b) nr = orderPark(0, UI.sel, i, j);
  const foe = !b ? enemyBotAtTap(i, j) : null;
  if (foe) { n = orderHunt(0, UI.sel, foe); what = `going after the rival's ${BOTS[foe.type].name}`; }
  else if (b && b.owner !== 0) { n = orderAttack(0, UI.sel, b); what = `attacking the ${BDEFS[b.type].name}`; }
  else if (b && BDEFS[b.type].mil && b.built) { n = orderStation(0, UI.sel, b); what = `heading to the ${BDEFS[b.type].name}`; }
  else if (inMap(i, j) && walkable(tIdx(i, j)) && !b) { n = orderMove(0, UI.sel, i, j); what = 'moving to hold that ground'; }
  else { sfx('error'); toast('Right-click open ground, a rival building or one of your garrisons.', 'warn'); return; }
  if (nr && !n) {
    sfx('order');
    addFx('ring', (b ? b.x : i) + 0.5, (b ? b.y : j) + 0.5, { color: b && b.owner !== 0 ? '#ff5a6e' : '#7dffa0' });
    toast(`${nr} Howitzer${nr > 1 ? 's' : ''} ${b && b.owner !== 0 ? `shelling the ${BDEFS[b.type].name}` : 'on the move'}.`, 'info');
    refreshSelection();
    return;
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
}

/** Control groups: Ctrl/Shift + digit saves the selection; the digit selects it again, twice to jump there. */
function saveGroup(k) {
  if (!UI.sel.length) { toast(`Select warbots first (drag a box round them), then Ctrl+${k} saves them as group ${k}.`, 'info'); return; }
  UI.groups[k] = UI.sel.slice();
  sfx('click');
  toast(`Group ${k}: ${UI.sel.length} warbot${UI.sel.length > 1 ? 's' : ''}. Press ${k} to select them again.`, 'info');
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

/* ------------------------------------------------------------------ saved planets */

/*
 * Planets you liked, kept on this device (localStorage): a seed with the map settings that shape it
 * (map type, size, terrain, resources, biome, players), newest first. Tap one under the planet preview
 * in the new-game menu's Customise view to set the menu to it; × forgets it.
 */
const PLANETS_KEY = 'terrafall.planets', PLANETS_MAX = 40;
function savedPlanets() {
  try { const l = JSON.parse(localStorage.getItem(PLANETS_KEY) || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; }
}
function writePlanets(list) { try { localStorage.setItem(PLANETS_KEY, JSON.stringify(list.slice(0, PLANETS_MAX))); } catch (e) { /* storage unavailable */ } }
const planetKey = (p) => [p.seed, p.shape, p.size, p.rough, p.rich, p.biome, p.players].join(':');
function savePlanet(p) { writePlanets([{ ...p, at: Date.now() }].concat(savedPlanets().filter((q) => planetKey(q) !== planetKey(p)))); }
/** The planet the new-game menu is set to. */
function menuPlanet() {
  return { seed: UI.menu.seed, shape: UI.menu.shape || 0, size: UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], rough: UI.menu.rough, rich: UI.menu.rich,
    biome: UI.menu.biome || 0, players: UI.menu.players === 3 ? 3 : 2 };
}
/** The planet being played. */
function gamePlanet() {
  const st = S.settings;
  return { seed: S.seed, shape: st.shape || 0, size: st.size, rough: st.rough, rich: st.rich, biome: Math.max(0, BIOME_ORDER.indexOf(st.biome)), players: st.players || 2 };
}
function planetLabel(p) {
  const bits = [SHAPE_PRESETS[p.shape] ? SHAPE_PRESETS[p.shape].name : 'Standard', SIZE_PRESETS[p.size] ? SIZE_PRESETS[p.size].name : '', biomeName(p.biome || 0)];
  if (p.rough !== DEFAULT_ROUGH && TERRAIN_PRESETS[p.rough]) bits.push(TERRAIN_PRESETS[p.rough].name + ' terrain');
  if (p.rich !== DEFAULT_RICH && RESOURCE_PRESETS[p.rich]) bits.push(RESOURCE_PRESETS[p.rich].name + ' resources');
  if (p.players === 3) bits.push('3 players');
  return `<b>Planet #${p.seed}</b><span> · ${bits.filter(Boolean).join(' · ')}</span>`;
}
function renderPlanets() {
  const el = $('m-planets');
  if (!el) return;
  const list = savedPlanets(), cur = UI.menu.shapeRnd || UI.menu.biomeRnd ? '' : planetKey(menuPlanet());
  el.hidden = !list.length;
  el.innerHTML = list.length ? `<span class="planets-title">Saved planets <small>${list.length}</small></span>` + list.map((p, k) =>
    `<div class="planet-row"><button class="btn small ghost use${planetKey(p) === cur ? ' on' : ''}" data-use="${k}" title="${planetLabel(p).replace(/<[^>]+>/g, '')}">${planetLabel(p)}</button><button class="btn small ghost del" data-del="${k}" aria-label="Forget Planet #${p.seed}" title="Forget this planet">×</button></div>`).join('') : '';
  for (const b of el.querySelectorAll('[data-use]')) b.onclick = () => {
    const p = savedPlanets()[+b.dataset.use];
    if (!p) return;
    Object.assign(UI.menu, { seed: p.seed, shape: p.shape, rough: p.rough, rich: p.rich, biome: p.biome, players: p.players || 2, shapeRnd: 0, biomeRnd: 0 });
    UI.menu.size[UI.menu.mode] = p.size;
    checkMenuSettings();
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
  closePicker(false);
  // Random map type or biome: picked now (see resolveRandom); the menu keeps Random for next time.
  const pick = resolveRandom();
  newGame({
    seed: UI.menu.seed, difficulty: UI.menu.diff, mode: UI.menu.mode,
    size: UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], rough: UI.menu.rough, rich: UI.menu.rich, shape: pick.shape,
    nuke: !!UI.menu.nuke, biome: BIOME_ORDER[pick.biome], players: UI.menu.players === 3 ? 3 : 2,
    style: UI.menu.style ? PERSONALITY_ORDER[UI.menu.style - 1] : 'random', events: !!UI.menu.events, wildlife: !!UI.menu.wild, unlimited: !!UI.menu.unlimited,
  });
  enterGame();
  updateHUD();
  placeMinimap();
  postMsg(0, UI.menu.mode === 'colony'
    ? 'Your bots have landed. Build, expand and make this planet home.'
    : S.players.length > 2 ? 'Your bots have landed. Two rival colonies landed too, one to the north-west (red) and one to the north-east (green). Build up fast!'
      : 'Your bots have landed. A rival colony landed to the north. Build up fast!', 0, 0, 'info');
  if (UI.menu.shapeRnd || UI.menu.biomeRnd) postMsg(0, `Random pick: ${[UI.menu.shapeRnd ? SHAPE_PRESETS[pick.shape].name : '', UI.menu.biomeRnd ? biomeName(pick.biome) : ''].filter(Boolean).join(', ')}.`, 0, 0, 'info');
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
  saveGame(); // the save on this device is up to date too
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

/** Load a save file picked on the main menu: it becomes this device's save too, and the game starts. */
function importSaveFile(file) {
  const msg = (m) => { $('m-import-msg').textContent = m; $('m-import-msg').hidden = false; };
  const r = new FileReader();
  r.onerror = () => msg('That file couldn\'t be read.');
  r.onload = () => {
    let json = String(r.result || '');
    const prev = S;
    try {
      const o = JSON.parse(json);
      if (o && o.terrafall && typeof o.game === 'string') json = o.game; // a save file; a bare save works too
      deserializeGame(json);
    } catch (e) { S = prev; msg('That isn\'t a Terrafall save file (or it\'s from a version this one can\'t read).'); return; }
    try { localStorage.setItem(SAVE_KEY, json); } catch (e) { /* storage unavailable: it still plays */ }
    enterGame();
    postMsg(0, 'Save file loaded. Welcome back.', 0, 0, 'info');
  };
  r.readAsText(file);
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
  showMenuView('home');
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
  for (const m of ['road', 'place', 'attack', 'aim', 'land', 'airdrop']) document.body.classList.toggle('mode-' + m, mode === m);
  if (mode !== 'aim') { R.aim = null; UI.aimSilo = 0; }
  if (mode !== 'aim' && mode !== 'land' && mode !== 'airdrop') R.aimHover = null;
  if (mode !== 'land') { R.landAt = null; UI.landFerry = 0; }
  if (mode !== 'airdrop') { R.dropAt = null; UI.dropPlane = 0; }
  if (mode !== 'attack') UI.armyCmd = null;
  R.ghost = null;
  R.overlay = null;
  R.ropeEnd = null;
  UI.ropeA = null;
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
    const served = ferries.some((u) => u.home === b.id || u.home === other.id);
    html += `<p class="hint">A ferry line runs to the Port ${dirText(b, other)}: your robots and trucks take the ferry whenever it's the shorter way.${served ? '' : ' <b>No Ferry serves it yet</b>: order one at a shipyard (a Port panel).'}</p><button class="btn" data-to="0">Stop the ferry line</button>`;
  } else {
    const ports = S.buildings.filter((o) => o !== b && !o.dead && o.built && o.owner === b.owner && BDEFS[o.type].port && seaLinked(b, o));
    html += ports.length ? `<p class="hint">Run a ferry between this Port and another: your robots and trucks take it whenever it's the shorter way (a Ferry from a Port's shipyard serves it).</p>${ports.map((o) => `<button class="btn" data-to="${o.id}">Ferry to the Port ${dirText(b, o)}</button>`).join('')}`
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
function showArmyBanner(note) {
  if (UI.armyCmd) { showArmyCmdBanner(note); return; }
  const out = warbotsOut(0), k = S.players[0].keepW ?? 0;
  showBanner('Tap a <b>rival building</b> to attack it with warbots or missiles, or tap open ground to send warbots there to <b>hold the area</b>.' +
    (out ? ` ${out} warbot${out > 1 ? 's are' : ' is'} out in the field: <b>Recall all</b> brings them home.` : '') +
    `<span class="keep-all">Every Outpost keeps <span class="seg">${[0, 1, 2, 5].map((v) => `<button data-k="${v}" class="${v === k ? 'on' : ''}">${v}</button>`).join('')}</span> warbot${k === 1 ? '' : 's'}, sent from your Command Base</span>`,
    out ? 'Recall all' : null, 'Cancel');
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

/** Bring every warbot in the field home to its garrison. */
function recallAllWarbots() {
  const n = recallAll(0);
  if (n) { sfx('order'); toast(`Recalled ${n} warbot${n > 1 ? 's' : ''}: they're heading back to their garrisons.`, 'info'); }
  else { sfx('error'); toast('No warbots are out in the field.', 'info'); }
  if (R.mode === 'attack') setMode('normal');
}

function confirmBanner() {
  if (R.mode === 'aim') { fireAimed(); return; }
  if (R.mode === 'land') { confirmLanding(); return; }
  if (R.mode === 'airdrop') { confirmAirdrop(); return; }
  if (R.mode === 'attack') { if (UI.armyCmd) { setMode('normal'); openArmySheet(); } else recallAllWarbots(); return; }
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
  if (R.mode === 'strike') {
    const u = getE(UI.bomber);
    if (!u || u.dead) { setMode('normal'); return; }
    const b = buildingAtTap(i, j, wx, wy);
    let t = b && b.owner !== 0 ? b : null;
    if (!t) { let bd = 0.5; for (const v of S.bots) { if (v.dead || v.owner === 0 || v.inside || BOTS[v.type].air) continue; const d = dist2(v.x, v.y, wx, wy); if (d < bd) { bd = d; t = v; } } }
    const why = t ? orderStrike(0, u, t) : 'Tap an enemy building, or an enemy vehicle or robot out in the open.';
    if (why) { sfx('error'); showBanner(`<span class="err">${why}</span>`, null, 'Cancel'); return; }
    sfx('order'); setMode('normal');
    toast(`Strike ordered on ${BDEFS[t.type] ? `the ${BDEFS[t.type].name}` : `a ${BOTS[t.type].name}`}: the bomber loads up and takes off.`, 'good');
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
  // A Howitzer's orders from its panel: shell the enemy building tapped, or drive to the spot tapped.
  if (R.mode === 'bombard' || R.mode === 'rgo') {
    const u = getE(UI.rocket);
    if (!u || u.dead) { setMode('normal'); return; }
    if (R.mode === 'bombard') {
      const b = buildingAtTap(i, j, wx, wy);
      if (!b || !rocketTarget(u, b)) { sfx('error'); showBanner('<span class="err">Tap an enemy building.</span> The Howitzer drives to within ' + ROCKET.range + ' tiles of it, digs in and shells it.', null, 'Cancel'); return; }
      orderBombard(0, [u.id], b);
      toast(`The Howitzer is off to shell the ${BDEFS[b.type].name}.`, 'info');
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
      if (S.road[t] && !roadOwnedBy(0, t)) { sfx('error'); showRoadBanner('That road isn\'t yours: you can only change your own roads, or ones on land you hold.'); return; }
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
      else if (S.rail[t] && !roadOwnedBy(0, t)) { sfx('error'); showRoadBanner('That track isn\'t yours: you can only take up your own track, or track on land you hold.'); return; }
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
    else if (S.road[t] && !roadOwnedBy(0, t) && S.plan[t] !== 1) { sfx('error'); showRoadBanner('That road isn\'t yours: you can only take up your own roads, or ones on land you hold.'); return; }
    else if (S.road[t] || S.plan[t] === 1) { draftOp(stroke, t, 'del'); note = S.plan[t] ? 'Planned tile marked to call off.' : 'Road marked to take up: its Cement comes back when you tap Build.'; }
    else if (canRoad(0, i, j) || draftBridge(t)) {
      draftOp(stroke, t, 'add');
      if (crossTile(t)) note = `${CROSS[S.terrain[t]].name} tile: ${costText(crossCost(t))}${bridgeMul(t) > 1 ? ' (far from shore: bridges cost more out here)' : ''}.`;
      else if (S.res[t]) note = `Workers will clear the ${RES[S.res[t]].name.toLowerCase()} (${ROAD_CLEAR}× Cement).`;
    } else { sfx('error'); showRoadBanner(S.owner[t] >= 0 && S.owner[t] !== 0 ? 'A rival holds that ground: roads only run on yours or no-one\'s.' : crossTile(t) ? 'A bridge has to start from your shore, your road or the end of a bridge.' : 'Your bots can\'t reach there yet: it\'s across water or a cliff from your land.'); return; }
    if (stroke.length) d.strokes.push(stroke);
    sfx('click');
    showRoadBanner(note, true);
    return;
  }
  if (R.mode === 'aim') { aimTap(i, j); return; }
  if (R.mode === 'land') { landTap(i, j); return; }
  if (R.mode === 'airdrop') { airdropTap(i, j); return; }
  const rally = rallyAtTap(wx, wy);
  const b = buildingAtTap(i, j, wx, wy);
  if (R.mode === 'attack' && UI.armyCmd) { armyTap(UI.armyCmd, i, j, b); return; }
  if (R.mode === 'attack' && !rally) {
    if (b && b.owner !== 0) { setMode('normal'); openBuildingSheet(b); }
    else if (!b && inMap(i, j) && S.terrain[tIdx(i, j)] === T_GROUND) { setMode('normal'); openMoveSheet(i, j); }
    else { sfx('error'); showBanner(`<span class="err">Tap a rival building (${S.players.length > 2 ? 'red or green' : 'red'}) or open ground.</span>`, null, 'Cancel'); }
    return;
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
      const bot = s.e;
      if (INPUT.mouse && bot.owner === 0 && (bot.type === 'warbot' || BOTS[bot.type].siege)) selectBots([bot.id], INPUT.shift);
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
  if (first) { UI.paintSkipped = false; UI.paintCross = false; UI.paintBridge = false; UI.paintTunnel = false; UI.paintCliff = false; UI.paintRamp = false; UI.paintSteep = false; UI.stroke = []; UI.draft.strokes.push(UI.stroke); }
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
  if (!arrows) {
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
 * The Paths banner, at the top of the screen so it never covers where you're drawing. Roads and
 * Bridges show the plan and what it costs, with Undo, Clear and Build.
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
    line = 'Drag along a road to make it <b>one-way</b> the way you drag. Tap a road to turn its arrow.';
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
    else how = `<b>Haulers only drive on roads</b>, so every building needs a road to storage. 1 Cement paves ${Math.round(1 / roadCost().cement)} tiles (${ROAD_CLEAR}× through resources); you have ${have.cement || 0} Cement` +
      (mode === 'bridge' ? ` and ${have.alloy || 0} Alloy. Workers build bridges and tunnels out from the shore or rock face, and they join land on any level.` : `. Drag a road out over water and it carries on as a bridge (${costText(CROSS[T_WATER].cost)} a tile), and through rock as a tunnel (${costText(CROSS[T_ROCK].cost)}).`) +
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
      : sm.rail ? `Build ${sm.rail} track tile${sm.rail === 1 ? '' : 's'}` : sm.pipe ? `Lay ${sm.pipe} pipe tile${sm.pipe === 1 ? '' : 's'}` : 'Take up';
    $('banner-ok').disabled = !sm.can;
    $('banner-undo').onclick = () => { draftUndo(); sfx('click'); showRoadBanner(); };
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
  UI.sheetKind = kind;
  UI.sheetFor = id;
  UI.demolishArm = 0;
  $('sheet-body').innerHTML = html;
  $('sheet').hidden = false;
  document.body.classList.add('sheet-open');
  $('banner').hidden = true;
  markSheetKeys();
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
    <p class="desc">Placing a site is free; haulers bring the materials by road, so lay a road to it. ${sites}/${MAX_SITES} sites in progress.</p>
    ${tabs}
    <div class="build-grid"><button class="bcard roads" id="build-roads" data-g="move"><kbd data-key="R">R</kbd><svg viewBox="0 0 24 24"><path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
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
    for (const el of $('sheet-body').querySelectorAll('.build-grid .bcard')) el.hidden = g !== 'all' && el.dataset.g !== g;
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
    `Only Road Trains and Freight Trains serve a Terminal: they bring a contract's lot and take what it pays home. Rates are ${Math.round(TERMINAL.rate * 100)}% of what the goods are worth` +
    (bonus ? `, +${bonus}% for standing this far out` : `; one further than ${TERMINAL.minDist} tiles from your Command Base pays more`) + '. Each contract runs up to ' + TERMINAL.lots + ' times, and each lot of a good you sell pays a little less for a while.';
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  if (!T.offers.length) { el.innerHTML = '<p class="hint">Contracts arrive in a moment.</p>'; return; }
  el.innerHTML = T.offers.map((o, k) => {
    const on = T.pick === k, pay = tradePay(0, o, b), sat = T.sat[o.give] ?? 1;
    // Spelled out which way it goes: you send `lot` of one good and get `pay` of the other back.
    return `<div class="kv trade-row${on ? ' on' : ''}"><span>You give <b>${o.lot}</b> <i class="gi ${o.give}"></i>${GOOD[o.give].name} → you get <b>${pay}</b> <i class="gi ${o.get}"></i>${GOOD[o.get].name}` +
      `<small> ${o.left > 0 ? `${o.left} more time${o.left === 1 ? '' : 's'}` : 'filled'}${sat < 0.99 ? ` · ${GOOD[o.give].name} pays ${Math.round(sat * 100)}% for now (you sold a lot lately)` : ''} · you have ${Math.floor(have[o.give] || 0)} ${GOOD[o.give].name}</small></span>` +
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
    desc += ` <b>Level ${b.level || 1} of 3</b>, ${n} creature${n === 1 ? '' : 's'} out and about. Hoarded: ${Object.keys(b.stock).filter((g) => b.stock[g] > 0).map((g) => `${b.stock[g]} ${GOOD[g].name}`).join(', ') || 'nothing'}.`;
  }
  let html = `<div class="sheet-title"><img src="${iconFor(b.type, b.owner)}" alt=""><div><h3>${def.name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[b.owner]}"></span> ${mine ? 'Yours' : playerName(b.owner)}</div></div></div>
    <p class="desc">${desc}</p><div class="status" id="sh-status"></div><div id="sh-dyn"></div>${mine ? '<div id="sh-fix"></div>' : ''}`;
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
    }
    // Priority for everything but the Command Base and finished Walls/Gates (storage too: an Airfield's or a
    // Depot's deliveries come first or last by it).
    if (b.type !== 'lander' && !(b.built && BDEFS[b.type].barrier)) {
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
        (b.type === 'outpost' || b.type === 'keep' ? `<div class="section-label">Rally point</div>
        <button class="btn" id="sh-rallypost"></button>
        <p class="hint">Every new warbot from the Bot Foundry is stationed here instead of at the Command Base, and comes back here after its orders. Ones that don't fit wait beside it. One Outpost or Keep at a time.</p>` : '') +
        (def.bunker ? '' : `<div class="section-label">Keep here</div>
        <div class="seg" id="sh-keepw"><button data-v="auto">Auto (${b.type === 'lander' ? 1 : S.players[0].keepW ?? 0})</button><button data-v="0">0</button><button data-v="1">1</button><button data-v="2">2</button><button data-v="5">5</button><button data-v="${def.garrison}">${def.garrison}</button></div>
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
    if (needsRoad(b) || (b.unlinked !== undefined && !def.store)) html += '<div id="sh-road"></div>';
    html += '<div class="actions">';
    if (pausable(b) && b.built) html += `<button class="btn" id="sh-pause"></button>`;
    if (b.owner === 0 && (movable(b) || b.moving)) html += `<button class="btn" id="sh-move">${b.moving ? 'Call off the move' : 'Move'}</button><p class="hint" id="sh-move-hint">${b.moving ? 'Its new site is going up: when it\'s finished, everything here moves over and this one comes down.' : 'Put it somewhere else: no goods needed, just its build time. It keeps working until the new one is ready.'}</p>`;
    if (b.owner === 0 && b.type === 'wall' && b.built) html += `<button class="btn" id="sh-gate">Make it a Gate</button><p class="hint">Your bots and trucks can pass through a Gate; enemies still have to break it down. It costs ${costText(gateUpgradeCost())} more, paid from storage.</p>`;
    if (BDEFS[b.type].mobile) html += '<button class="btn primary" id="sh-pack">Pack up to move</button>';
    else if (b.type !== 'lander') html += `<button class="btn danger" id="sh-demolish">${b.built ? 'Demolish' : 'Cancel site'}</button>`;
    html += '</div>';
  } else if (S.mode !== 'colony' || def.wild) {
    html += `<div class="section-label">Attack with warbots</div><div id="sh-attack"></div>
      <div class="stepper" id="sh-stepper"><button class="btn" id="sh-minus">−</button><span class="n" id="sh-n">0</span>
      <button class="btn" id="sh-plus">+</button><button class="btn primary" id="sh-send" style="flex:1">Send warbots</button></div>
      <div class="section-label">Missile strike</div><div id="sh-missile"></div>
      <button class="btn primary big" id="sh-fire">Fire missile</button>${myBombers().length ? '<div class="section-label">Air strike</div><p class="hint" id="sh-bomb-hint"></p><button class="btn big" id="sh-bomb">Bomb it</button>' : ''}`;
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
    if ($('sh-rallypost')) $('sh-rallypost').onclick = () => {
      const P = S.players[0], on = P.rallyPost === b.id;
      P.rallyPost = on ? 0 : b.id;
      toast(on ? 'No rally point: new warbots go to the Command Base again.' : `New warbots will gather at this ${BDEFS[b.type].name}.`, 'info');
      sfx('click'); refreshSheet();
    };
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
  const gun = mine && b.underFire && !BDEFS[b.type].war ? gunOver(0, b.x, b.y) : null;
  $('sh-status').textContent = gun ? `Under enemy fire: an enemy ${BDEFS[gun.type].name} covers it, so your robots keep clear until the gun is destroyed or runs dry.`
    : mine ? b.status || '' : (b.built ? '' : 'Construction site');
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
        if (!S.road[t] || wayOwner(t) !== b.owner || !(all || S.paveMark[t]) || nets.indexOf(net.comp[t]) < 0) continue;
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
      const walls = near.filter((c) => BDEFS[c.type].barrier && keepOver(c) === b).length, guns = near.filter((c) => ['turret', 'minigun', 'bunker', 'mortar', 'flak', 'disruptor'].includes(c.type)).length;
      parts.push(`<div class="kv"><span>Warbots fire at</span><span>enemy robots within ${KEEP.fire} tiles</span></div>`);
      parts.push(`<div class="kv"><span>Roof cannon</span><span>${def.range} tiles, ${goodTag('crystal', `${b.shots + (b.stock.crystal || 0) * shotsPer(b)} shots`, !(b.shots > 0 || b.stock.crystal > 0))}</span></div>`);
      parts.push(`<div class="kv"><span>Aura (${KEEP.aura} tiles)</span><span>${walls} Wall${walls === 1 ? '' : 's'} and Gate${walls === 1 ? '' : 's'} toughened, ${guns} defence${guns === 1 ? '' : 's'} sharpened</span></div>`);
    }
    if (def.disrupt && mine) {
      parts.push(`<div class="kv"><span>Fuel</span><span>${goodTag('fuel', `${b.stock.fuel || 0}/${def.ammoCap}`, !(b.stock.fuel > 0))} + ${b.pulses || 0} pulse${b.pulses === 1 ? '' : 's'} charged</span></div>`);
      parts.push(`<div class="kv"><span>Each pulse</span><span>drains ${def.disrupt.drain} battery from enemy robots within ${def.range} tiles, every ${def.disrupt.every}s</span></div>`);
    }
    if (def.mortar && mine) {
      parts.push(`<div class="kv"><span>Shells</span><span>${(b.shells || 0) + (b.stock.ammo || 0) * def.mortar.shells} (${goodTag('ammo', `${b.stock.ammo || 0}/${def.ammoCap}`, !(b.stock.ammo > 0))})</span></div>`);
      parts.push(`<div class="kv"><span>Each shell</span><span>${def.mortar.damage} damage, ${def.mortar.splashDamage} within ${def.mortar.splash} tiles; ${def.minRange} to ${def.range} tiles out</span></div>`);
    }
    if (def.minigun && mine) {
      parts.push(`<div class="kv"><span>Rounds</span><span>${(b.rounds || 0) + (b.stock.ammo || 0) * def.minigun.rounds} (${goodTag('ammo', `${b.stock.ammo || 0}/${def.ammoCap}`, !(b.stock.ammo > 0))})</span></div>`);
      parts.push(`<div class="kv"><span>Fire</span><span>${def.minigun.rate} rounds a second, ${def.minigun.damage} damage each, out to ${def.range} tiles; pins what it hits</span></div>`);
    }
    if (def.ammo && mine && !def.missile && !def.disrupt && !def.mortar && !def.minigun && !def.flak) parts.push(`<div class="kv"><span>Ammo</span><span>${b.shots + (b.stock.crystal || 0) * shotsPer(b)} shots</span></div>`);
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
  if ($('sh-rallypost')) { const on = S.players[0].rallyPost === b.id; $('sh-rallypost').textContent = on ? '⚑ Rally point for new warbots (tap to clear)' : 'Make this the rally point for new warbots'; $('sh-rallypost').classList.toggle('primary', on); }
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
      el.innerHTML = bs.length ? bs.map((u, k) => `<div class="kv trade-row"><span>Bomber ${k + 1}<small>${planeStatus(u)}</small></span><button class="btn small primary" data-b="${u.id}" ${u.mission || u.flight ? 'disabled' : ''}>Strike</button></div>`).join('') +
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
  refreshBombButton(b);
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
    if (u.packing) return 'Packing up to move';
    if (rocketSupplyComing(u)) return u.rockets ? `Shelling, a hauler on its way with Ammo (${u.rockets} shells left)` : 'Out of shells: a hauler is on its way with Ammo';
    if (t && t.type === 'bombard') return rocketDug(u) ? `Dug in, shelling the ${nm(t.target)} (reloading between shots)` : u.deployT > 0 ? `Digging in to shell the ${nm(t.target)} (${Math.ceil(ROCKET.deploy - u.deployT)}s)` : `Driving into reach of the ${nm(t.target)}`;
    if (t && t.type === 'rearm') return `Reloading Ammo at the ${nm(t.bld)}`;
    if (t && t.type === 'park') return 'Driving to its spot';
    return (u.rockets ?? ROCKET.mag) ? `${rocketDug(u) ? 'Dug in' : 'Loaded'}: waiting, and shelling any enemy building within ${ROCKET.range} tiles` : 'Out of shells: no Ammo in reach to reload';
  }
  if (u.type === 'warbot') {
    const p = u.owner === 0 && usesPosts(0) ? postOf(u) : null;
    const where = u.owner !== 0 ? '' : p ? ` (stationed at the ${BDEFS[p.type].name})` : ' (belongs to the Command Base)';
    const what = (() => {
      if (u.fight) return 'Fighting!';
      if (!t) return u.inside ? 'Standing guard inside' : 'Waiting for orders: no garrison with room';
      if (t.type === 'garrison') return `Marching to the ${nm(t.bld)}`;
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

/** The Bomb it button on an enemy building's or unit's panel: enabled when a Strike Bomber is ready that can reach t. */
function refreshBombButton(t) {
  if (!$('sh-bomb')) return;
  const u = readyBomber(t), any = myBombers(), bot = !BDEFS[t.type];
  $('sh-bomb').disabled = !u;
  $('sh-bomb-hint').textContent = u ? (bot ? `A Strike Bomber is ready: it flies out, leads it if it's moving and drops one bomb (a direct hit does ${BOMBER.botDamage * 2}, ${BOMBER.ammo} Ammo a sortie). Flak Guns can shoot it down.`
      : `A Strike Bomber is ready: it drops one bomb (${BOMBER.damage} off the target, ${BOMBER.ammo} Ammo a sortie). Flak Guns can shoot it down.`)
    : bot && (t.inside || t.dropping) ? 'It\'s under cover: bombers only hit vehicles and robots out in the open.'
      : any.some((v) => v.mission || v.flight) ? 'Your bombers are out on sorties.' : any.some((v) => v.rearmUntil > S.time) ? 'Your bombers are rearming.' : 'Out of your bombers\' reach.';
}

function openBotSheet(u) {
  R.selected = 0; R.selTile = -1; UI.selBot = u.id;
  const html = `<div class="sheet-title"><div><h3>${BOTS[u.type].name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[u.owner]}"></span> ${u.owner === 0 ? 'Yours' : playerName(u.owner)}</div></div></div>
    <p class="desc">${BOTS[u.type].desc}</p>
    <div class="status" id="sh-status"></div><div id="sh-dyn"></div>
    ${u.owner === 0 && u.type === 'warbot' ? '<button class="btn big" id="sh-recall" hidden>Call back this squad</button>' : ''}
    ${u.owner === 0 && BOTS[u.type].bomber ? '<button class="btn primary big" id="sh-strike">Pick a target</button>' : ''}
    ${u.owner !== 0 && u.owner >= 0 && !BOTS[u.type].wild && !BOTS[u.type].air && myBombers().length ? '<div class="section-label">Air strike</div><p class="hint" id="sh-bomb-hint"></p><button class="btn big" id="sh-bomb">Bomb it</button>' : ''}
    ${u.owner === 0 && BOTS[u.type].ferry ? `<div class="actions"><button class="btn primary" id="sh-fsail">Sail somewhere</button><button class="btn" id="sh-fhome">Back to its line</button></div>
      <div class="actions"><button class="btn" id="sh-fembark">Take warbots aboard</button><button class="btn" id="sh-fland">Put them ashore</button></div>
      <button class="btn" id="sh-found">Found a Port on another shore</button>
      <p class="hint"><b>Sail somewhere</b>: it sails to the spot you tap (open water, or right up to a shore) and waits there for your orders. <b>Take warbots aboard</b> loads your warbots standing within ${Math.floor(FERRY_REACH)} tiles of it (with a mouse, select warbots and right-click the Ferry: they walk to the shore beside it and board). <b>Put them ashore</b> lands them on the shore beside it, and it heads home. <b>Found a Port</b>: it loads ${costText(PORT_FOUND.cost)} at its Port and up to ${PORT_FOUND.workers} Workers, and puts up a Port on an empty shore that claims the land round it.</p>` : ''}
    ${u.owner === 0 && BOTS[u.type].crawler ? '<div class="actions"><button class="btn primary" id="sh-crawl">Drive somewhere</button><button class="btn" id="sh-deploy">Deploy here</button></div>' : ''}
    ${u.owner === 0 && BOTS[u.type].siege ? `<div class="actions"><button class="btn primary" id="sh-bombard">Bombard a building</button><button class="btn" id="sh-rgo">Drive somewhere</button></div>
      <div class="section-label">While it waits</div><div class="seg" id="sh-stance"><button data-v="fire">Fire at will</button><button data-v="hold">Hold fire</button></div>
      <p class="hint">It stays where you put it (beside the Foundry when it's new). <b>Fire at will</b>: it shells any enemy building that comes in reach of that spot, without moving. <b>Hold fire</b>: it fires only when you tell it to. After reloading it goes back to its target, or to its spot. With a mouse, select it and right-click a rival building to bombard it, or open ground to move it there.</p>` : ''}`;
  openSheet('bot', u.id, html);
  if ($('sh-bomb')) $('sh-bomb').onclick = () => {
    const v = readyBomber(u);
    const why = v ? orderStrike(0, v, u) : 'No Strike Bomber is ready that can reach it.';
    if (why) { sfx('error'); toast(why, 'warn'); return; }
    sfx('order'); toast(`Strike ordered on the ${BOTS[u.type].name}: a bomber loads up, takes off and hunts it down.`, 'good'); refreshSheet();
  };
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
  if ($('sh-bombard')) $('sh-bombard').onclick = () => { sfx('click'); closeSheet(); setMode('bombard'); UI.rocket = u.id; showBanner(`Tap an enemy building: the <b>Howitzer</b> drives to within ${ROCKET.range} tiles of it, digs in and shells it, one heavy shell after another, until it's rubble.`, null, 'Cancel'); };
  if ($('sh-stance')) {
    const sync = () => { for (const btn of $('sh-stance').children) btn.classList.toggle('on', btn.dataset.v === (u.stance === 'hold' ? 'hold' : 'fire')); };
    for (const btn of $('sh-stance').children) btn.onclick = () => { u.stance = btn.dataset.v === 'hold' ? 'hold' : undefined; if (u.stance === 'hold' && u.task && u.task.auto) { u.task = null; u.salvo = null; } sfx('click'); sync(); };
    sync();
  }
  if ($('sh-rgo')) $('sh-rgo').onclick = () => { sfx('click'); closeSheet(); setMode('rgo'); UI.rocket = u.id; showBanner('Tap where the <b>Howitzer</b> should wait: it stays there, and (unless it holds fire) shells any enemy building in reach of it.', null, 'Cancel'); };
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
/* ------------------------------------------------------------------ the Army panel (Q) and its Air tab */

/**
 * The Army panel: your warbots and Howitzers at a glance and orders for them. Pick a group size, then an
 * order (Attack a rival building, Hold ground, Station at a garrison of yours) and tap the map: each tap sends
 * another group, until Done. Groups out in the field and every Howitzer are listed with their own orders.
 * The Air tab (with an Airfield): each Airfield's hangar, every Strike Bomber (Strike) and Cargo Plane (air drops).
 */
function openArmySheet(tab) {
  if (tab) UI.armyTab = tab;
  if (UI.armyTab === 'air' && !myAirfields().length) UI.armyTab = 'army';
  UI.armyTab = UI.armyTab || 'army';
  UI.armyN = UI.armyN || 4;
  openSheet('army', 0, `<div class="sheet-title"><div><h3>${UI.armyTab === 'air' ? 'Air' : 'Army'}</h3></div></div>
    <div class="seg" id="ar-tabs"><button id="ar-tab-army" data-t="army">Army</button><button id="ar-tab-air" data-t="air">Air</button></div>
    <div id="ar-body"></div>`);
  for (const btn of $('ar-tabs').children) btn.onclick = () => { sfx('click'); openArmySheet(btn.dataset.t); };
  $('ar-body').onclick = (e) => { const btn = e.target.closest('button'); if (btn && !btn.disabled) armyButton(btn); };
  UI.armySig = '';
  refreshArmySheet();
}

function myAirfields() { return S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && BDEFS[b.type].airfield); }

/** How many of `avail` warbots a group of the chosen size takes. */
function armyCount(avail) { return UI.armyN === 'all' ? avail : Math.min(avail, UI.armyN || 4); }
function armyNText() { return UI.armyN === 'all' ? 'every spare warbot' : `${UI.armyN} warbots`; }

function refreshArmySheet() {
  const air = myAirfields().length > 0;
  $('ar-tab-air').hidden = !air;
  $('ar-tabs').hidden = !air; // (just the Army until there's an Airfield)
  for (const btn of $('ar-tabs').children) btn.classList.toggle('on', btn.dataset.t === UI.armyTab);
  if (UI.armyTab === 'air' && air) refreshAirTab(); else refreshArmyTab();
  markSheetKeys();
}

function refreshArmyTab() {
  const g = warbotGroups(), mine = S.bots.filter((u) => !u.dead && u.owner === 0);
  const wb = mine.filter((u) => u.type === 'warbot'), noAmmo = wb.filter((u) => (u.ammo ?? WARBOT_AMMO) <= 0).length;
  const field = g.attack.length + g.hold.length + g.defend.length + g.idle.length + g.loot.length;
  const rockets = mine.filter((u) => BOTS[u.type].siege);
  // The groups out in the field: each rally flag, and each building under attack.
  const flags = S.rallies.filter((r) => r.owner === 0).map((r) => ({ r, n: rallyMembers(r.id).length })).filter((f) => f.n > 0);
  const atk = new Map();
  for (const u of g.attack) { const t = getE(u.task.target); if (t && !t.dead) atk.set(t.id, (atk.get(t.id) || 0) + 1); }
  const sig = JSON.stringify([UI.armyN, wb.length, g.base.length, g.posted.length, field, noAmmo, flags.map((f) => [f.r.id, f.n]), [...atk], rockets.map((u) => [u.id, botActivity(u)]), S.players[0].keepW ?? 0, !!INPUT.mouse]);
  if (sig === UI.armySig) return;
  UI.armySig = sig;
  const L = getE(S.players[0].lander), where = (x, y) => (L ? dirText(L, { x: Math.floor(x), y: Math.floor(y) }) : '');
  const k = S.players[0].keepW ?? 0;
  let h = `<div class="kv"><span>Warbots</span><span><b>${wb.length}</b>: ${g.base.length} at the Command Base, ${g.posted.length} in garrisons, ${field} in the field${noAmmo ? `, <span class="err">${noAmmo} out of Ammo</span>` : ''}</span></div>`;
  if (rockets.length) h += `<div class="kv"><span>Howitzers</span><span><b>${rockets.length}</b></span></div>`;
  h += `<div class="section-label">Orders <span class="label-note">group size</span></div>
    <div class="seg" id="ar-size">${[2, 4, 8, 'all'].map((n) => `<button id="ar-n${n}" data-act="size" data-n="${n}" class="${UI.armyN === n ? 'on' : ''}">${n === 'all' ? 'All' : n}</button>`).join('')}</div>
    <div class="army-cmds">
      <button class="btn primary" id="ar-attack" data-act="cmd" data-c="attack">Attack</button>
      <button class="btn" id="ar-hold" data-act="cmd" data-c="hold">Hold ground</button>
      <button class="btn" id="ar-station" data-act="cmd" data-c="station">Station</button>
      <button class="btn" id="ar-recall" data-act="recall"${field ? '' : ' disabled'}>Recall all</button>
      ${INPUT.mouse ? '<button class="btn ghost" id="ar-select" data-act="select">Select all warbots</button>' : ''}
    </div>
    <p class="hint"><b>Attack</b>: tap a rival building and a group of ${armyNText()} goes for it. <b>Hold ground</b>: tap open ground and they plant a rally flag and hold it. <b>Station</b>: tap an Outpost, Keep or Bunker of yours and they move in for good. Each tap sends another group, until you tap Done. Warbots come from your garrisons in reach (each keeps its own).</p>`;
  if (flags.length || atk.size) {
    h += '<div class="section-label">In the field</div>';
    for (const f of flags) h += `<div class="kv army-row"><span><b>${f.n}</b> holding a flag ${where(f.r.x, f.r.y)}</span><span><button class="btn small ghost" data-act="showflag" data-id="${f.r.id}">Show</button><button class="btn small" data-act="more" data-id="${f.r.id}">+${UI.armyN === 'all' ? 'All' : UI.armyN}</button><button class="btn small ghost" data-act="recallflag" data-id="${f.r.id}">Recall</button></span></div>`;
    for (const [id, n] of atk) { const t = getE(id); h += `<div class="kv army-row"><span><b>${n}</b> attacking the ${BDEFS[t.type].name} ${where(t.x, t.y)}</span><span><button class="btn small ghost" data-act="showbld" data-id="${id}">Show</button><button class="btn small ghost" data-act="callback" data-id="${id}">Call back</button></span></div>`; }
  }
  if (rockets.length) {
    h += '<div class="section-label">Howitzers</div>';
    for (const u of rockets) h += `<div class="kv army-row"><span>${botActivity(u)}</span><span><button class="btn small" data-act="bombard" data-id="${u.id}">Bombard</button><button class="btn small ghost" data-act="rgo" data-id="${u.id}">Drive</button><button class="btn small ghost" data-act="showbot" data-id="${u.id}">Show</button></span></div>`;
  }
  h += `<div class="section-label">Every Outpost keeps</div><div class="seg" id="ar-keep">${[0, 1, 2, 5].map((v) => `<button data-act="keep" data-k="${v}" class="${v === k ? 'on' : ''}">${v}</button>`).join('')}</div>
    <p class="hint">Warbots each Outpost keeps at home, sent from your Command Base (and replaced if lost). Set one Outpost on its own in its panel.</p>`;
  $('ar-body').innerHTML = h;
}

function refreshAirTab() {
  const fields = myAirfields(), planes = S.bots.filter((u) => !u.dead && u.owner === 0 && BOTS[u.type].air);
  const bombers = planes.filter((u) => BOTS[u.type].bomber), cargo = planes.filter((u) => !BOTS[u.type].bomber);
  const kinds = BDEFS.airfield.yard.filter((kk) => warOn() || !BOTS[kk].war);
  const sig = JSON.stringify([fields.map((b) => [b.id, b.yard]), planes.map((u) => [u.id, planeStatus(u), !!(u.inside && !u.mission && !u.flight)]), !!readyBomber()]);
  if (sig === UI.armySig) return;
  UI.armySig = sig;
  const L = getE(S.players[0].lander);
  let h = '';
  if (warOn() && bombers.length) h += `<button class="btn primary big" id="ar-strike" data-act="strikeany"${readyBomber() ? '' : ' disabled'}>Strike: tap a target</button>`;
  h += '<div class="section-label">Airfields</div>';
  for (const b of fields) {
    const n = basePlanes(b).length, ord = kinds.filter((kk) => b.yard && b.yard[kk] > 0).map((kk) => `${b.yard[kk]} ${b.yard[kk] === 1 ? BOTS[kk].name : BOTS[kk].plural}`);
    h += `<div class="kv army-row"><span>${L ? `${dirText(L, b)} from the Command Base` : 'Airfield'}: ${n} plane${n === 1 ? '' : 's'}${ord.length ? `; ordered ${ord.join(', ')}` : ''}</span><span>${kinds.map((kk) => `<button class="btn small" data-act="yard" data-id="${b.id}" data-k="${kk}">+ ${BOTS[kk].name}</button>`).join('')}<button class="btn small ghost" data-act="showbld" data-id="${b.id}">Open</button></span></div>`;
  }
  if (warOn()) {
    h += '<div class="section-label">Strike Bombers</div>';
    h += bombers.length ? bombers.map((u) => `<div class="kv army-row"><span>${planeStatus(u)}</span><span><button class="btn small" data-act="strike" data-id="${u.id}"${!u.mission && !u.flight && planeBase(u) && u.inside === planeBase(u).id ? '' : ' disabled'}>Strike</button><button class="btn small ghost" data-act="showbot" data-id="${u.id}">Show</button></span></div>`).join('')
      : '<p class="hint">None yet: order one in an Airfield\'s hangar (+ Strike Bomber above). It bombs any enemy building but a Keep or Command Base, or a vehicle or robot out in the open.</p>';
  }
  h += '<div class="section-label">Cargo Planes <span class="label-note">air drops by parachute</span></div>';
  h += cargo.length ? cargo.map((u) => {
    const free = u.inside && !u.mission && !u.flight && planeBase(u) && u.inside === planeBase(u).id;
    return `<div class="kv army-row"><span>${planeStatus(u)}</span><span>${free ? `<button class="btn small" data-act="drop" data-id="${u.id}" data-k="outpost">Drop Outpost</button>${warOn() ? `<button class="btn small" data-act="drop" data-id="${u.id}" data-k="warbot">2 Warbots</button>` : ''}<button class="btn small" data-act="drop" data-id="${u.id}" data-k="worker">2 Workers</button>` : ''}<button class="btn small ghost" data-act="showbot" data-id="${u.id}">Show</button></span></div>`;
  }).join('') : '<p class="hint">None yet: order one in an Airfield\'s hangar (+ Cargo Plane above). It flies goods to places you switch to Supply by air, and drops an Outpost, Warbots or Workers anywhere it can reach.</p>';
  $('ar-body').innerHTML = h;
}

/** A button on the Army panel. */
function armyButton(btn) {
  const act = btn.dataset.act, id = +btn.dataset.id, e = id ? getE(id) : null;
  sfx('click');
  switch (act) {
    case 'size': UI.armyN = btn.dataset.n === 'all' ? 'all' : +btn.dataset.n; UI.armySig = ''; refreshArmySheet(); return;
    case 'cmd': armyCmd(btn.dataset.c); return;
    case 'recall': recallAllWarbots(); UI.armySig = ''; refreshArmySheet(); return;
    case 'select': selectBots(armyIds(0), false); closeSheet(); if (UI.sel.length) toast(`${UI.sel.length} warbots selected: right-click to give orders.`, 'info'); return;
    case 'keep': setKeepAll(+btn.dataset.k); UI.armySig = ''; refreshArmySheet(); return;
    case 'showflag': if (e) { centerOn(e.x, e.y); openRallySheet(e); } return;
    case 'showbld': if (e) { centerOn(e.x + 0.5, e.y + 0.5); openBuildingSheet(e); } return;
    case 'showbot': if (e) { const inB = e.inside ? getE(e.inside) : null; centerOn(inB ? inB.x + 0.5 : e.x, inB ? inB.y + 0.5 : e.y); openBotSheet(e); } return;
    case 'more': if (e) { const i = Math.floor(e.x), j = Math.floor(e.y), res = sendToRally(0, i, j, armyCount(rallyAvailable(0, i, j))); if (res.sent) { sfx('order'); toast(`${res.sent} more warbot${res.sent > 1 ? 's are' : ' is'} on the way to the flag.`, 'info'); } else { sfx('error'); toast('No spare warbots in reach of that flag.', 'warn'); } UI.armySig = ''; } return;
    case 'recallflag': if (e) { const n = recallRally(id); toast(`${n} warbot${n !== 1 ? 's' : ''} called back.`, 'info'); UI.armySig = ''; } return;
    case 'callback': { let n = 0; for (const u of S.bots) if (!u.dead && u.owner === 0 && u.type === 'warbot' && u.task && u.task.type === 'attack' && u.task.target === id) { u.task = null; u.path = null; n++; } toast(`${n} warbot${n !== 1 ? 's' : ''} called back to their garrisons.`, 'info'); UI.armySig = ''; return; }
    case 'bombard': if (e) { closeSheet(); setMode('bombard'); UI.rocket = id; showBanner(`Tap an enemy building: the <b>Howitzer</b> drives to within ${ROCKET.range} tiles of it, digs in and shells it, one heavy shell after another, until it's rubble.`, null, 'Cancel'); } return;
    case 'rgo': if (e) { closeSheet(); setMode('rgo'); UI.rocket = id; showBanner('Tap where the <b>Howitzer</b> should wait: it stays there, and (unless it holds fire) shells any enemy building in reach of it.', null, 'Cancel'); } return;
    case 'strikeany': { const u = readyBomber(); if (u) startStrike(u); else { sfx('error'); toast('No Strike Bomber is ready on the ground.', 'warn'); } return; }
    case 'strike': if (e) startStrike(e); return;
    case 'drop': if (e) { closeSheet(); startAirdrop(e, btn.dataset.k); } return;
    case 'yard': if (e) { orderAtYard(e, btn.dataset.k, 1); toast(`${BOTS[btn.dataset.k].name} ordered: the Airfield's hangar builds it from Alloy and Chips.`, 'info'); UI.armySig = ''; refreshArmySheet(); } return;
  }
}

/** Start an Army order: the next taps on the map pick its targets. */
function armyCmd(cmd) {
  closeSheet();
  setMode('attack');
  UI.armyCmd = cmd;
  showArmyCmdBanner();
}

function showArmyCmdBanner(note) {
  const what = { attack: 'Tap a <b>rival building or robot</b> to attack it', hold: 'Tap <b>open ground</b> to hold it', station: 'Tap an <b>Outpost, Keep or Bunker</b> of yours to station them there' }[UI.armyCmd];
  showBanner((note ? note + ' ' : '') + `${what} with ${armyNText()}. Tap again to send another group.`, 'Army', 'Done');
}

/** A tap on the map while an Army order is picking its target. */
/** The rival robot nearest the tap at tile (i, j), within a tile of it (out in the open, not in a building), or null. */
function enemyBotAtTap(i, j) {
  let best = null, bd = 1.3 * 1.3;
  for (const u of S.bots) {
    if (u.dead || u.inside || u.owner === 0 || u.owner < 0 || u.dropping || (BOTS[u.type].air && u.flight)) continue;
    const d = dist2(u.x, u.y, i + 0.5, j + 0.5);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function armyTap(cmd, i, j, b) {
  const fail = (why) => { sfx('error'); showArmyCmdBanner(`<span class="err">${why}</span>`); };
  if (cmd === 'attack') {
    // A rival robot (nearest the tap, if there's one there): hunt it down.
    const foe = !b || b.owner === 0 ? enemyBotAtTap(i, j) : null;
    if (foe) {
      const res = sendHunt(0, foe, armyCount(rallyAvailable(0, Math.floor(foe.x), Math.floor(foe.y))));
      if (!res.sent) return fail('No armed warbots can get there: they need Ammo, and a way to walk there.');
      sfx('order'); showArmyCmdBanner(`${res.sent} warbot${res.sent > 1 ? 's are' : ' is'} going after the rival's ${BOTS[foe.type].name}.`);
      return;
    }
    if (!b || b.owner === 0 || b.owner < 0 || b.dead) return fail(`Tap a rival building or robot (${S.players.length > 2 ? 'red or green' : 'red'}).`);
    let n = armyCount(attackAvailable(0, b)), sent = n > 0 ? sendAttack(0, b, n) : 0;
    // No garrison near enough to attack from: a rally flag beside it (they attack what stands there).
    if (!sent) {
      for (const [di, dj] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const ii = b.x + di, jj = b.y + dj;
        if (!inMap(ii, jj) || !walkable(tIdx(ii, jj)) || S.bAt[tIdx(ii, jj)]) continue;
        n = armyCount(rallyAvailable(0, ii, jj));
        if (n > 0) sent = sendToRally(0, ii, jj, n).sent;
        break;
      }
    }
    if (!sent) return fail('No armed warbots can get there: they need Ammo, and a way to walk there.');
    sfx('order'); showArmyCmdBanner(`${sent} warbot${sent > 1 ? 's are' : ' is'} going for the ${BDEFS[b.type].name}.`);
    return;
  }
  if (cmd === 'hold') {
    if (b || !inMap(i, j) || !walkable(tIdx(i, j))) return fail('Tap open ground your warbots can walk to.');
    const res = sendToRally(0, i, j, armyCount(rallyAvailable(0, i, j)));
    if (!res.sent) return fail('No spare armed warbots can get there.');
    sfx('order'); showArmyCmdBanner(`${res.sent} warbot${res.sent > 1 ? 's are' : ' is'} on the way to hold it.`);
    return;
  }
  if (cmd === 'station') {
    if (!b || b.owner !== 0 || !b.built || !BDEFS[b.type].mil || b.type === 'lander') return fail('Tap one of your finished Outposts, Keeps or Bunkers.');
    const n = stationWarbots(0, b, armyCount(stationAvailable(0, b)));
    if (!n) return fail(garrisonRoom(b) ? 'No spare warbots to send there.' : `The ${BDEFS[b.type].name} is full.`);
    sfx('order'); showArmyCmdBanner(`${n} warbot${n > 1 ? 's are' : ' is'} moving into the ${BDEFS[b.type].name}.`);
  }
}

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
  $('sh-pop').innerHTML = rows.join('') + `<div class="kv"><span>All robots</span><span><b>${total}</b> of ${cap} (the limit)</span></div>` + wb;
  for (const btn of $('sh-pop').querySelectorAll('[data-wb]')) btn.onclick = () => showWarbots(btn.dataset.wb);
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
  if (UI.sheetKind === 'army') { refreshArmySheet(); return; }
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
    refreshBombButton(u);
    const bat = Math.round(u.bat ?? 100);
    $('sh-dyn').innerHTML = `<div class="kv"><span>Health</span><span>${Math.ceil(u.hp)} / ${u.maxHp}</span></div>` +
      `<div class="kv"><span>${BOTS[u.type].truck ? 'Fuel tank' : 'Battery'}</span><span>${bat}%${bat < BATTERY.critical ? (BOTS[u.type].truck ? ' (empty: crawling)' : ' (flat: slow and weak)') : bat < BATTERY.low ? ' (low)' : ''}</span></div>` +
      `<div class="bar battery"><div style="width:${bat}%;background:${bat < BATTERY.critical ? '#ff4d4d' : bat < BATTERY.low ? '#ffb347' : '#7ee08a'}"></div></div>` +
      (u.type === 'warbot' ? `<div class="kv"><span>Ammo</span><span>${u.ammo ?? WARBOT_AMMO} / ${WARBOT_AMMO} shots${!u.ammo ? ' (out: can\'t fight until it reloads)' : ''}</span></div>` : '') +
      (BOTS[u.type].siege ? `<div class="kv"><span>Shells</span><span>${u.rockets ?? ROCKET.mag} / ${ROCKET.mag}${!(u.rockets ?? ROCKET.mag) ? ` (haulers bring Ammo while it's dug in on your ground near a road; or it reloads ${ROCKET.ammo} Ammo at a garrison or storage)` : ''}</span></div><div class="kv"><span>Each shell</span><span>${ROCKET.damage} damage, ${ROCKET.damage * ROCKET.fortMul} to defences; one every ${ROCKET.cycle}s</span></div><div class="kv"><span>Reach</span><span>${ROCKET.min} to ${ROCKET.range} tiles</span></div>` : '') +
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

const OBJECTIVES = [
  { text: 'Robots run on batteries, and your Command Base can\'t charge them. Tap <b>Build</b> and place a <b>Fuel Station</b> beside the road ring round your base: it runs on the Fuel you landed with.', done: () => hasBuilt('charger') || hasAny('charger') },
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
  { text: 'Fuel Stations burn <b>Fuel</b>. Build a <b>Bio Farm</b> beside the dark fertile soil to grow it (your Agribot runs it).', done: () => hasBuilt('farm') || hasBuilt('refinery') || playerGoods(0).fuel >= 20 },
  { text: 'Busy crossings jam up. In <b>Paths</b>, choose <b>Junctions</b> and put a traffic light on a junction where three or four roads meet.', done: () => Object.keys(S.lights).some((k) => S.lights[k].owner === 0) || !ownJunction() },
  { text: 'Warbots need <b>Ammo</b>. Build an <b>Ammo Plant</b>: haulers stock your Command Base and Outposts and warbots reload there.', done: () => S.mode === 'colony' || hasBuilt('armory') },
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
  const tn = todName(), tod = todEnabled() ? `<span class="tod-mark" style="color:${{ morning: '#ffb38a', day: '#ffd166', evening: '#ff8a4a', night: '#b8c8ff' }[tn]}">${tn === 'night' ? '☾' : '☀'}</span> ` : '';
  const ct = tod + (S.mode === 'colony' ? `${Math.round(landShare(0) * 100)}% land` : fmtTime(S.time));
  if ($('clock').innerHTML !== ct) $('clock').innerHTML = ct;
  $('clock').title = todEnabled() ? TOD_NAMES[todName()] + (todMode() === 'night' ? ' (always)' : '') : '';
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
  // At most 2 at once (3 with a building lost): the oldest go first, but a "lost" toast (a building of
  // yours destroyed) outlasts the others and isn't pushed out by them.
  const lost = kind === 'lost';
  while (box.children.length > (box.querySelector('.toast.lost') ? 3 : 2)) {
    const old = [...box.children].find((c) => !c.classList.contains('lost') && c !== el) || box.firstChild;
    box.removeChild(old);
  }
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, lost ? 8000 : 3800);
}

function uiTick(dt) {
  AUDIO.suppress = !UI.inGame;
  if (!UI.inGame) menuArtTick();
  if (!UI.inGame || !S) return;
  while (S.msgs.length) {
    const m = S.msgs.shift();
    toast(m.text, m.kind, m.x, m.y);
    if ((m.kind === 'bad' || m.kind === 'warn' || m.kind === 'lost') && (m.x || m.y)) UI.lastAlert = { x: m.x, y: m.y };
    if (m.kind === 'lost') sfx('alert');
  }
  updateMapTip();
  UI.hudT -= dt;
  if (UI.hudT <= 0) { UI.hudT = 0.25; updateHUD(); refreshSheet(); placeMinimap(); refreshSelection(); }
  if (S.winner >= 0 && !UI.overShown) showGameOver();
}

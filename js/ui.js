'use strict';
/*
 * Terrafall — HTML interface: menus, HUD, build menu, info sheets, objectives, messages.
 */

/** Version of the remembered new-game settings: 2 brought new defaults for the rival doctrine, Nuclear race and Planetary events. */
const SETTINGS_V = 3;

const UI = {
  inGame: false, paused: false, speed: 1, overShown: false,
  menu: { mode: 'versus', diff: 'normal', seed: randomSeed(), size: { ...DEFAULT_SIZE }, rough: DEFAULT_ROUGH, rich: DEFAULT_RICH, shape: 0, style: 1, styles: [null, null, null, null], nuke: 1, events: 0, wild: 1, unlimited: 0, victory: 'capture' },
  sheetKind: null, sheetFor: 0, sheetT: 0, hudT: 0,
  icons: {}, attackN: 0, demolishArm: 0, lastPaint: null, placeType: null,
  goodEls: {}, lastGoods: {}, objCollapsed: false, selBot: 0,
  sel: [], groups: {}, lastGroup: { k: 0, at: 0 }, lastAlert: null, tipKey: '', msgLog: [],
};

const $ = (id) => document.getElementById(id);

/**
 * Do order `name` (orders.js) for the player at this screen, with plain arguments (ids, numbers, strings, lists of
 * them). In a single-player game it's done at once; in multiplayer it goes to every device and is done on each at
 * the same tick (lockstep.js). cb(what it gave back) runs once it's done here: everything the screen says about how
 * it went goes there, worked out from things noted when the order was given (not live objects, which may be gone).
 */
function act(name, args, cb) {
  if (typeof MP !== 'undefined' && MP.on) { MP.order(name, args || [], cb); return; }
  const r = applyOrder(ME, name, args || []);
  if (cb) cb(r);
}

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
  // Settings from before v2 drop their rival doctrine, Nuclear race and Planetary events, so the new defaults
  // (a Steward, the balanced rival, Nuclear race on, Planetary events off) reach every device once. From before v3 (resources
  // lowered a notch): Normal stays Normal (the new, leaner default), and the others keep what they gave
  // (Scarce is now Sparse, Sparse Normal, Rich Abundant).
  try {
    let saved = JSON.parse(localStorage.getItem('botfall.settings') || '{}');
    if (!saved || typeof saved !== 'object') saved = {}; // (damaged: the defaults)
    if ((saved.v || 0) < 2) { delete saved.style; delete saved.nuke; delete saved.events; }
    if ((saved.v || 0) < 3 && Number.isInteger(saved.rich)) saved.rich = [1, 2, 2, 4, 4][saved.rich] ?? DEFAULT_RICH;
    // (only what saveSettings writes: a stored mode or seed isn't a remembered setting)
    for (const k of ['size', 'rough', 'rich', 'shape', 'nuke', 'biome', 'players', 'diff', 'style', 'styles', 'events', 'wild', 'unlimited', 'victory', 'shapeRnd', 'biomeRnd']) if (saved[k] !== undefined) UI.menu[k] = saved[k];
  } catch (e) { /* defaults */ }
  checkMenuSettings();
  initMenu();
  initMulti();
  $('m-continue').onclick = () => { audioUnlock(); continueGame(); };
  $('m-import').onclick = () => { audioUnlock(); $('m-import-msg').hidden = true; $('m-import-file').value = ''; $('m-import-file').click(); };
  $('m-import-file').onchange = () => { const f = $('m-import-file').files && $('m-import-file').files[0]; if (f) importSaveFile(f); };
  $('p-export').onclick = () => { sfx('click'); downloadSave(); };
  $('m-help').onclick = () => showHelp();
  $('h-close').onclick = () => { $('screen-help').hidden = true; UI.paused = !$('screen-pause').hidden; };
  // The illustrated manual is a page beside this one: the single-file build has none, so there the link is left out.
  if ($('h-manual')) $('h-manual').hidden = !!window.TOD_BUNDLE;
  // The How to play shows one section at a time: the contents first, then a section with a bar above it that stays
  // put (Contents, a picker, previous and next) and Previous / Next buttons at its end (see helpPage).
  helpMarkKeys(); // (before the pager is built: it rewrites the Help text once)
  helpPagerInit();
  initLore();
  $('screen-help').addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-jump]');
    if (!a) return;
    e.preventDefault();
    helpPage(a.dataset.jump);
  });

  // Pause menu
  // (in a multiplayer game the menu doesn't stop the game: Pause for everyone does, see mpui.js)
  // The briefing: a tap anywhere, or any key, starts the game (capture: before the game's own keys see it).
  // (on click: the press and the release both land on the card, so nothing behind it gets a tap)
  $('briefing').addEventListener('pointerdown', (e) => e.stopPropagation());
  $('briefing').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); closeBriefing(); });
  window.addEventListener('keydown', (e) => { if (UI.briefing && !e.repeat) { e.preventDefault(); e.stopPropagation(); closeBriefing(); } }, true);
  $('btn-pause').onclick = () => { UI.paused = !MP.on; UI.mpQuitArm = false; mpSyncPauseMenu(); $('screen-pause').hidden = false; syncSaved(); sfx('click'); };
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
  $('p-quit').onclick = () => {
    if (MP.on) {
      if (!UI.mpQuitArm) { UI.mpQuitArm = true; mpSyncPauseMenu(); return; }
      mpQuit();
    } else if (!UI.saveHold) saveGame(); // (UI.saveHold: the game keeps failing, see `stage` in main.js; the last good save is left alone)
    $('screen-pause').hidden = true;
    toMenu();
  };

  // Game over (missions swap in their own actions)
  $('o-new').onclick = () => { $('screen-over').hidden = true; if (MP.on) mpQuit(); if (UI.overNew) UI.overNew(); else { UI.menu.seed = randomSeed(); startNewGame(); } };
  $('o-menu').onclick = () => { $('screen-over').hidden = true; if (MP.on) mpQuit(); toMenu(); if (UI.overMenu) UI.overMenu(); };
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
    const L = getE(S.players[ME].lander);
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
  initSelBar();
  initSheetGrab();
  $('mm-hide').onclick = () => { setMinimap(false); sfx('click'); };
  $('mm-show').onclick = () => { setMinimap(true); sfx('click'); };
  try { MM.on = localStorage.getItem('botfall.minimap') !== '0'; } catch (e) { MM.on = true; }
  window.addEventListener('resize', () => { if (UI.inGame) { layoutMinimap(); placeMinimap(); if (UI.sheetKind) sheetMoved(); } });

  initKeyboard();
  initBack();
  initDialogs();
  // A long press on the interface brings up no browser menu under a finger (Save image, Share...); a mouse keeps its right-click off the map.
  document.addEventListener('contextmenu', (e) => { if ((e.pointerType ? e.pointerType !== 'mouse' : onTouch()) && !(e.target.closest && e.target.closest('input, textarea, a'))) e.preventDefault(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && UI.inGame) autoSave(); syncWakeLock(); });
  window.addEventListener('pagehide', () => { if (UI.inGame) autoSave(); });
  setInterval(() => { if (UI.inGame && !UI.paused) autoSave(); }, AUTOSAVE_EVERY * 1000);
  syncMenu();
}

/* ------------------------------------------------------------------ a phone's Back button, and keeping the screen on */

/**
 * In a game the Back button (a phone's, or the browser's) steps back like Esc instead of leaving the page: it
 * closes what's on top (the start-of-game card, a screen, a panel, a mode, the selection), and with nothing open it
 * brings up the pause menu, where Save and quit is. A history entry is added on entering a game (armBack) and put
 * back each time Back takes it; leaving for the main menu removes it, so Back works as usual there.
 */
function initBack() {
  window.addEventListener('popstate', () => {
    if (!UI.inGame) return;
    history.pushState({ terrafall: 1 }, '');
    if (UI.briefing) closeBriefing(); else escapeKey();
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

/* ------------------------------------------------------------------ new-game menu */

/*
 * The main menu has two views. Home (on load): Continue, Play (#m-new: a game with the settings
 * summed up under it), Custom Game, then Multiplayer, and Missions, Load a save file and How to play. Customise
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
  if (!Object.prototype.hasOwnProperty.call(DIFFICULTY, m.diff)) m.diff = 'normal';
  if (!Object.prototype.hasOwnProperty.call(VICTORY, m.victory)) m.victory = 'capture';
  // (a value another version or a damaged store left: one the menu can't show stopped the game booting)
  m.mode = m.mode === 'colony' ? 'colony' : 'versus';
  m.players = ok(m.players, 5) && m.players >= 2 ? m.players : 2;
  m.style = ok(m.style, PERSONALITY_ORDER.length + 1) ? m.style : 1;
  // Each computer player's own doctrine (null: as the Rival doctrine chips say), by player slot 0 to 3. (A list of three
  // is how an earlier build kept them, for players 1 to 3.)
  const st = Array.isArray(m.styles) ? (m.styles.length === 3 ? [null, ...m.styles] : m.styles) : [];
  m.styles = [0, 1, 2, 3].map((p) => (ok(st[p], PERSONALITY_ORDER.length + 1) ? st[p] : null));
  for (const k of ['nuke', 'events', 'wild', 'unlimited', 'shapeRnd', 'biomeRnd']) m[k] = m[k] ? 1 : 0;
}

/** Remember the new-game settings on this device. */
function saveSettings() {
  const m = UI.menu;
  try {
    localStorage.setItem('botfall.settings', JSON.stringify({ v: SETTINGS_V, size: m.size, rough: m.rough, rich: m.rich, shape: m.shape, nuke: m.nuke, biome: m.biome, players: m.players,
      diff: m.diff, style: m.style, styles: m.styles, events: m.events, wild: m.wild, unlimited: m.unlimited, victory: m.victory, shapeRnd: m.shapeRnd ? 1 : 0, biomeRnd: m.biomeRnd ? 1 : 0 }));
  } catch (e) { /* storage unavailable */ }
}

const menuSize = () => UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode];
const menuStyle = () => Math.min(PERSONALITY_ORDER.length, UI.menu.style || 0);
/**
 * Doctrines on the menu are numbers: 0 Random, then 1 to 5 in PERSONALITY_ORDER (the Steward first). UI.menu.style is
 * the Rival doctrine chips' (every computer player's); UI.menu.styles[p] is player p's own (null: the chips'), kept by
 * colony (player slot, so by colour): in Custom Game the computer plays players 1 to 3 (Each rival, three or four
 * players); in the multiplayer lobby the host picks one for each place the computer takes, which in a team game can be
 * any of the four. A choice stays with its colony when the seating changes.
 */
const docKeyOf = (v) => (v >= 1 && v <= PERSONALITY_ORDER.length ? PERSONALITY_ORDER[v - 1] : 'random');
const docNameOf = (v) => (v >= 1 && v <= PERSONALITY_ORDER.length ? PERSONALITIES[PERSONALITY_ORDER[v - 1]].name : 'Random');
/** Player p's doctrine (0 Random, 1 to 5). */
function menuSlotStyle(p) { const v = (UI.menu.styles || [])[p]; return v === null || v === undefined ? menuStyle() : v; }
/**
 * The places the computer plays, by player slot (a doctrine each): in Custom Game players 1 to 3; in multiplayer the
 * ones nobody in the lobby takes, as the lobby lists them and the game seats them (mpCpuSlots).
 */
function menuCpuSlots() {
  if (UI.menu.mode === 'colony') return [];
  if (UI.mpSetup && typeof mpCpuSlots === 'function') return mpCpuSlots(menuPlayers(), menuTeams() ? mpTeamSeats() : null);
  return Array.from({ length: menuPlayers() - 1 }, (_, k) => k + 1);
}
/** The doctrine every computer player has (0 to 5), or -1 when they differ. */
function menuDocAll() {
  const slots = menuCpuSlots();
  if (!slots.length) return menuStyle();
  const v = menuSlotStyle(slots[0]);
  return slots.every((p) => menuSlotStyle(p) === v) ? v : -1;
}
/** Player p (a computer player), as the setup names it: its callsign ('VERMILION'), or 'Your ally VERMILION' in a team game. */
function seatName(p) { return menuTeams() && !UI.mpSetup && p === 1 ? `Your ally ${callsign(1)}` : callsign(p); }
/** The doctrines for newGame: one for each computer player, in player order (Custom Game: players 1 to 3). */
function menuStyleKeys() { return [1, 2, 3].map((p) => docKeyOf(menuSlotStyle(p))); }
/** A doctrine's description, in depth: the name in bold, its voice, how it plays and its weak spot. */
function docHTML(k) {
  if (k === 'random') return `<b>Random:</b> ${DOCTRINE_RANDOM}`;
  const P = PERSONALITIES[isDoctrine(k) ? k : 'balanced'];
  return `<b>${docLabel(k)}:</b> <i>“${P.quote}”</i> ${P.play} <b>Weak spot:</b> ${P.weak}`;
}
/** ...and in a sentence: the name and what it does ("Warden (turtle): it walls its base in ..."). */
function docShortHTML(k) {
  if (k === 'random') return `<b>Random:</b> ${DOCTRINE_RANDOM_TAG}, picked from the planet's seed.`;
  const P = PERSONALITIES[isDoctrine(k) ? k : 'balanced'];
  return `<b>${docLabel(k)}:</b> it ${P.desc}.`;
}
/**
 * Can this device point at things (a mouse or trackpad)? Then the doctrine lines follow the pointer and keep their
 * height; on a touch screen they follow taps, show a short line first and grow only when asked (How it plays).
 */
function canHover() { return !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches); }
const biomeName = (k) => (BIOMES[BIOME_ORDER[k]] || BIOMES[BIOME_ORDER[0]]).name;
/** Can the menu's biome have the Murmur? Not Lunar (Random might still pick it: then there are none). */
function menuMurmur() { return UI.menu.biomeRnd || murmurGround(BIOME_ORDER[UI.menu.biome || 0]); }
const mapGroupName = (g) => { const G = MAP_GROUPS.find((x) => x.key === g); return G ? G.name : ''; };
/**
 * How many players the menu is set to (Versus): you and one to three rivals, as many as the map type
 * has room for (Random picks a map type with room for them all).
 */
function menuPlayers() {
  const m = UI.menu, want = clamp(Math.round(m.players) || 2, 2, 4);
  if (m.mode !== 'versus') return 2;
  return m.shapeRnd ? want : clamp(want, minPlayers(m.shape || 0), maxPlayers(m.shape || 0));
}
/** A team game: four colonies, two against two (the Teams choice, with four players)? */
function menuTeams() { return UI.menu.mode === 'versus' && !!UI.menu.teams && menuPlayers() === 4; }
/** Is this a free-for-all (Versus, three or four players)? */
function menuThree() { return menuPlayers() > 2; }
/** The Crossroads map type (four quarters: three or four players get one corner quarter each). */
const crossIdx = () => Math.max(0, SHAPE_PRESETS.findIndex((P) => P.cross));
function modeInfo(mode, n) {
  const m = UI.menu, SH = SHAPE_PRESETS[m.shape || 0], quad = !m.shapeRnd && !!(SH.cross || SH.quad4), onCross = n === 4 || quad;
  const where = m.shapeRnd ? 'a square planet' : quad ? SH.name : 'a square planet';
  const win = 'Take a rival\'s Command Base and all it built is yours; the last colony standing wins.';
  return mode === 'colony'
    ? (UI.menu.wild && menuMurmur() ? 'Colony: no rival, but the Murmur burrow in the wilds and raid what you build near them. Build, research and spread across the planet.'
      : 'Colony: no rival. Settle the planet at your own pace: build, research and spread across the planet.')
    : n === 4 ? `Free-for-all · 4: you and three rival colonies (red, green and purple) on ${where}, one in each corner quarter. ${win}`
      : n === 3 && onCross ? `Free-for-all · 3: you and two rival colonies on ${where}, each in a corner quarter; the quarter beside you is free and rich. ${win}`
        : n === 3 ? `Free-for-all: you and two rival colonies${m.shapeRnd ? '' : ' on a round planet'}. ${win}`
          : 'Versus: race a rival colony across the planet. Build up, then capture its Command Base (or hold most of the land: see Victory) to win.';
}
function terrainInfo(v) {
  const T = TERRAIN_PRESETS[v];
  return `${T.name} terrain: ${T.levels === 1 ? 'one level, no cliffs to get round' : `${T.levels} levels of ground, with cliffs between and slopes up them`}.`;
}
function resourceInfo(v) {
  const P = RESOURCE_PRESETS[v], N = RESOURCE_PRESETS[DEFAULT_RICH], pct = (x) => Math.round(x * 100) + '%';
  return v === DEFAULT_RICH ? `${P.name} resources: enough stone, ore, crystal and stalks near home to get going; spread out for more.` : `${P.name} resources: ${pct(P.density / N.density)} as many fields as Normal, each holding ${pct(P.amount / N.amount)} as much.`;
}

/** The setup in a line (and what isn't the default in a second one), under Play and in Start's bar. */
function menuSummary() {
  const m = UI.menu, colony = m.mode === 'colony', three = menuThree();
  const main = [colony ? 'Colony' : menuTeams() ? 'Teams · 2 vs 2' : three ? `Free-for-all · ${menuPlayers()}` : 'Versus'];
  if (!colony) main.push(`${DIFFICULTY[m.diff].label} rival${three ? 's' : ''}`);
  if (!colony && !menuTeams() && m.victory && m.victory !== 'capture') main.push(VICTORY[m.victory].name);
  main.push(m.shapeRnd ? 'Random map' : SHAPE_PRESETS[m.shape || 0].name, m.biomeRnd ? 'Random biome' : biomeName(m.biome || 0), SIZE_PRESETS[menuSize()].name);
  const extra = [];
  if (!colony) {
    // The rivals' doctrines, unless every one is a Steward (the usual).
    const all = menuDocAll(), slots = menuCpuSlots(), n = slots.length;
    if (all === 0) extra.push(n > 1 ? 'Random doctrines' : 'Random doctrine');
    else if (all > 1) extra.push(`${docNameOf(all)} rival${n > 1 ? 's' : ''}`);
    else if (all < 0) extra.push((innerWidth < 600 ? '' : 'Doctrines: ') + slots.map((p) => docNameOf(menuSlotStyle(p))).join(', ')); // (a phone: the names alone, so they fit)
  }
  if (m.rough !== DEFAULT_ROUGH) extra.push(TERRAIN_PRESETS[m.rough].name + ' terrain');
  if (m.rich !== DEFAULT_RICH) extra.push(RESOURCE_PRESETS[m.rich].name + ' resources');
  if (!m.nuke) extra.push('no Nuclear race');
  if (colony && (!m.wild || !menuMurmur())) extra.push('no Murmur');
  if (m.events) extra.push('Planetary events');
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
  $('m-new-label').textContent = UI.mpSetup ? 'Done' : setup ? 'Start' : 'Play';
  $('m-setup-title').textContent = UI.mpSetup ? 'Multiplayer game' : 'Custom Game';
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
  for (const btn of $('m-teams').children) btn.onclick = pick(() => { UI.menu.teams = +btn.dataset.v; });
  for (const btn of $('m-victory').children) { btn.dataset.info = VICTORY[btn.dataset.v].info; btn.onclick = pick(() => { UI.menu.victory = btn.dataset.v; }); }
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
  // Rival doctrine: 0 is Random (a different one for each computer player), then each one in PERSONALITY_ORDER. A chip
  // sets every computer player's; with three or four players each also has its own (Each rival, below). Each option
  // says in depth how that rival plays, in the line under them: under the mouse or on focus, or once tapped. On a touch
  // screen, while the rivals have doctrines of their own, the first tap on a chip only shows how it plays (it would
  // wipe them): a second tap gives it to them all.
  const docNames = ['Random', ...PERSONALITY_ORDER.map((k) => PERSONALITIES[k].name)];
  choice('m-style', docNames, menuDocAll, (v) => {
    UI.docOpen = true; UI.docLast = null;
    if (!canHover() && menuDocAll() === -1 && UI.docPeek !== v) { UI.docPeek = v; return; }
    UI.docPeek = null; UI.menu.style = v; UI.menu.styles = [null, null, null, null];
  }, (v) => docInfo(docKeyOf(v)));
  for (const b of $('m-style').children) b.dataset.doc = docKeyOf(+b.dataset.v);
  // Each rival: the k-th dropdown is player k + 1's (red, green, purple).
  $('m-seats').innerHTML = [0, 1, 2].map((k) => `<label class="m-seat" data-k="${k}"><i class="dot" style="background:${PLAYER_COLORS[k + 1]}"></i>` +
    `<select data-k="${k}">${docNames.map((n, v) => `<option value="${v}">${n}</option>`).join('')}</select></label>`).join('');
  for (const sel of $('m-seats').querySelectorAll('select')) {
    sel.onchange = () => { const p = +sel.dataset.k + 1; UI.menu.styles[p] = +sel.value; UI.docLast = p; UI.docPeek = null; UI.docOpen = true; syncMenu(); saveSettings(); sfx('click'); };
  }
  // The doctrine line's own buttons (a touch screen): How it plays opens the whole of it, Less closes it again.
  $('m-style-note').addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-docmore]'); if (b) { UI.docOpen = b.dataset.docmore === '1'; sfx('click'); syncInfo(); } });
  // The Murmur's switch can't be turned on on Lunar: a tap on it still says why (in the Rules line).
  $('m-wild-row').addEventListener('click', () => { if ($('m-wild').disabled) { UI.menuHover['m-sec-rules'] = $('m-wild-row'); syncInfo(); } });
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
  $('m-back').onclick = () => { sfx('click'); if (UI.mpSetup) mpSetupDone(); else showMenuView('home', true); };
  Object.defineProperty($('m-more'), 'open', { configurable: true, get: () => UI.menuView === 'setup', set: (v) => showMenuView(v ? 'setup' : 'home') });
  $('m-new').onclick = () => { audioUnlock(); if (UI.mpSetup) mpSetupDone(); else startNewGame(); };
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
    if (!$('screen-lore').hidden) { e.preventDefault(); closeLore(); return; }
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
  // The preview follows the size of its box (and the info lines are measured again at the new width).
  if (window.ResizeObserver) new ResizeObserver(() => { PV.drawn = ''; schedulePreview(true); sizeInfoLines(); }).observe($('m-pv'));
  showMenuView('home');
}

/** Each section's line: the hovered or focused option's, or else the choice's. */
function syncInfo() {
  const m = UI.menu, H = { ...(UI.menuHover || {}) }, three = menuThree();
  const live = (el) => el && el.isConnected && !el.closest('[hidden]');
  // A doctrine (a chip, or a rival's own) speaks in its own line, under the doctrines; the Match line stays put. Under
  // the mouse, or focused from the keyboard: on a touch screen a tap focuses it too, and there the taps decide what the
  // line says (see docNoteDefault).
  const isDoc = live(H['m-sec-match']) && !!H['m-sec-match'].dataset.doc;
  const doc = isDoc && (canHover() || H['m-sec-match'].matches(':focus-visible')) ? H['m-sec-match'].dataset.doc : null;
  if (isDoc) H['m-sec-match'] = null;
  const line = (sec, def) => (live(H[sec]) ? H[sec].dataset.info : def) || def;
  const P = SHAPE_PRESETS[m.shape || 0];
  $('m-mode-desc').textContent = line('m-sec-match', modeInfo(m.mode, menuPlayers()));
  const note = $('m-style-note'), html = doc ? docHTML(doc) : docNoteDefault();
  if (note.innerHTML !== html) note.innerHTML = html;
  $('m-planet-info').textContent = line('m-sec-planet', m.shapeRnd ? $('m-shape').dataset.info : `${P.name}: ${P.blurb || ''}`);
  // (Colony on Lunar: the Rules line says why the Murmur's switch is off, a touch screen having no hover to ask with)
  $('m-rules-info').textContent = line('m-sec-rules', m.mode === 'colony' && !menuMurmur() ? $('m-wild-row').dataset.info : TOD_INFO[todMode()]);
  sizeInfoLines();
}

/**
 * The doctrine line when no doctrine is under the mouse: the chip being looked at (a first tap on a touch screen), the
 * one last picked for a rival of its own, the one every computer player has, or else (each its own) who has which. With
 * a mouse it is said in full; on a touch screen in a sentence until a tap (or How it plays) opens the whole of it.
 */
function docNoteDefault() {
  const slots = menuCpuSlots(), all = menuDocAll(), touch = !canHover(), mps = !!UI.mpSetup;
  const who = mps || menuTeams() ? 'computer' : 'rival';
  const more = (open) => ` <button type="button" class="m-docmore" data-docmore="${open ? 1 : 0}">${open ? 'How it plays' : 'Less'}</button>`;
  let k = null, hint = '';
  if (UI.docPeek != null && all === -1) { k = docKeyOf(UI.docPeek); hint = ` <b>Tap ${docNameOf(UI.docPeek)} again</b> to give it to every ${who}.`; }
  else if (UI.docLast != null && slots.includes(UI.docLast) && !$('m-seats-row').hidden) k = docKeyOf(menuSlotStyle(UI.docLast));
  else if (all >= 0) k = docKeyOf(all);
  if (k) return touch && !UI.docOpen ? docShortHTML(k) + more(true) : docHTML(k) + hint + (touch ? more(false) : '');
  const v = slots.map((p) => menuSlotStyle(p));
  return `<b>Each ${who} has its own doctrine${mps ? ' (set them in the lobby)' : ''}:</b> ` + slots.map((p, i) => `${seatName(p)}: ${v[i] ? docLabel(docKeyOf(v[i])) : 'Random'}`).join(' · ') +
    (v.includes(0) ? `. Random deals one no other ${who} has.` : '.') + (touch ? ' Tap a doctrine above to read how it plays.' : ' Point at a doctrine to see how it plays.');
}

/**
 * Each section's info line keeps the height of the longest text it can show (any option's, hovered or chosen), so
 * running the mouse over the options doesn't make the menu grow and shrink. Measured again when the texts or the
 * width change. (The doctrine line likewise: every doctrine's description, and the one it shows now.)
 */
function sizeInfoLines() {
  const lines = [['m-sec-match', 'm-mode-desc'], ['m-sec-planet', 'm-planet-info'], ['m-sec-rules', 'm-rules-info'], [null, 'm-style-note']];
  for (const [sec, id] of lines) {
    const el = $(id), box = sec && $(sec);
    if (!el || (sec && !box) || !el.offsetWidth) continue;
    const html = !sec;
    // (On a touch screen the doctrine line changes only with a tap, and grows when asked: no height held for it.)
    if (html && !canHover()) { el.style.minHeight = ''; el.dataset.sizedFor = ''; continue; }
    const texts = html ? ['random', ...PERSONALITY_ORDER].map(docHTML)
      : [...box.querySelectorAll('[data-info]')].filter((k) => !k.closest('[hidden]') && !k.dataset.doc).map((k) => k.dataset.info || '');
    texts.push(html ? el.innerHTML : el.textContent);
    const key = el.offsetWidth + '|' + texts.join('\u0001');
    if (el.dataset.sizedFor === key) continue;
    const probe = el.cloneNode(false);
    probe.removeAttribute('id'); probe.removeAttribute('aria-live');
    probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;min-height:0;width:${el.offsetWidth}px`;
    el.parentNode.appendChild(probe);
    let h = 0;
    for (const t of texts) { if (html) probe.innerHTML = t; else probe.textContent = t; h = Math.max(h, probe.offsetHeight); }
    probe.remove();
    el.style.minHeight = h + 'px';
    el.dataset.sizedFor = key;
  }
}

/** Bring every control in the menu up to date with UI.menu (and the device's time of day and weather). */
function syncMenu() {
  if (typeof ensureBiomeArt === 'function') ensureBiomeArt(BIOME_ORDER[UI.menu.biome || 0]); // the chosen biome's swatch
  const m = UI.menu, colony = m.mode === 'colony', three = menuThree();
  const mark = (b, on) => { b.classList.toggle('on', on); if (b.getAttribute('role') === 'radio') b.setAttribute('aria-checked', on ? 'true' : 'false'); };
  for (const btn of $('m-mode').children) { mark(btn, btn.dataset.v === m.mode); btn.dataset.info = modeInfo(btn.dataset.v, false); }
  // Multiplayer settings (the host, from the lobby): Versus only; Players counts everyone, people first, computer rivals after.
  const mps = !!UI.mpSetup;
  $('m-mode').closest('.m-row').hidden = mps;
  $('m-unlimited-row').hidden = mps;
  $('m-l-diff').textContent = mps ? 'Computer rivals' : 'Rival';
  for (const btn of $('m-diff').children) mark(btn, btn.dataset.v === m.diff);
  $('m-diff-field').hidden = colony;
  for (const btn of $('m-victory').children) mark(btn, btn.dataset.v === (m.victory || 'capture'));
  // Teams (four colonies, two against two, Capture only): the Victory choice gives way to it.
  const teams = menuTeams();
  $('m-teams-field').hidden = colony || menuPlayers() !== 4;
  for (const btn of $('m-teams').children) { mark(btn, +btn.dataset.v === (teams ? 1 : 0)); btn.dataset.info = +btn.dataset.v ? '2 vs 2: you and the colony beside you against the other two. Take both of their Command Bases to win.' : 'Every colony for itself: the last one standing wins.'; }
  $('m-victory-field').hidden = colony || teams;
  $('m-victory-note').hidden = colony || teams;
  $('m-victory-note').textContent = (VICTORY[m.victory] || VICTORY.capture).note;
  // Free-for-all: you and two rivals on the map types with room for three, or three rivals on
  // Crossroads (Random picks a map type with room for them all).
  const shape = m.shape || 0, SH = SHAPE_PRESETS[shape], room = m.shapeRnd ? 4 : maxPlayers(shape), want = clamp(Math.round(m.players) || 2, 2, 4);
  $('m-players-field').hidden = colony;
  for (const btn of $('m-players').children) {
    const v = +btn.dataset.v;
    mark(btn, v === menuPlayers());
    if (!btn.dataset.lbl) btn.dataset.lbl = btn.textContent;
    btn.textContent = mps ? String(v) : btn.dataset.lbl; // (multiplayer: how many colonies, people and computers together)
    btn.disabled = v > room || (!m.shapeRnd && v < minPlayers(shape));
    btn.dataset.info = v === 2 ? 'You vs 1: you and one rival colony, landing at the far end of the planet.'
      : modeInfo('versus', v) + (v <= room ? (m.shapeRnd || v >= minPlayers(shape) ? '' : ` (Not on ${SH.name}: it is for ${minPlayers(shape)} or more.)`)
        : v === 4 ? ` (Not on ${SH.name}: it has room for ${room === 3 ? 'three' : 'two'}. Pick a map type marked “3–4 players”.)` : ` (Not on ${SH.name}: pick a map type marked “3 players” or “3–4 players”.)`);
    if (mps) btn.dataset.info = `${v} colonies: the people in the lobby take the first, computer rivals the rest (more people than this, and they all play).` + (v <= room ? '' : ` (${SH.name} has room for ${room}.)`);
  }
  const few = !m.shapeRnd && want < minPlayers(shape);
  $('m-players-note').hidden = colony || (want <= room && !few);
  $('m-players-note').textContent = few ? `${SH.name} is made for ${minPlayers(shape) === room ? ['', '', 'two', 'three', 'four'][room] : 'three or four'} players: you'll play with ${minPlayers(shape) - 1} rivals.`
    : want === 4 ? `${SH.name} has room for ${room === 3 ? 'three players' : 'two players only'}: pick a map type marked “3–4 players” for four.`
    : `${SH.name} is for two players only: pick a map type marked “3 players” or “3–4 players” for a free-for-all.`;
  $('m-seed').textContent = 'Planet #' + m.seed;
  renderPlanets();
  if (menuDocAll() !== -1) UI.docPeek = null; // (a chip looked at before a tap gives it to them all: only while they differ)
  for (const id of ['m-size', 'm-rough', 'm-rich', 'm-style']) {
    const el = $(id), v = el._get();
    for (const b of el.children) { mark(b, +b.dataset.v === v); b.classList.toggle('lit', +b.dataset.v <= v); }
  }
  for (const b of $('m-style').children) b.classList.toggle('peek', UI.docPeek === +b.dataset.v);
  // (Random map type: sizes as on a Standard map; the others differ a little.)
  const players = menuPlayers(), dShape = m.shapeRnd ? (players === 4 ? crossIdx() : 0) : shape, dims = mapDims({ size: menuSize(), shape: dShape, players });
  for (const b of $('m-size').children) { const d = mapDims({ size: +b.dataset.v, shape: dShape, players }); b.dataset.info = `${SIZE_PRESETS[+b.dataset.v].name}: ${m.shapeRnd ? 'about ' : ''}${d.W}×${d.H} tiles${m.shapeRnd ? ' (map types differ a little)' : ''}.`; }
  $('m-size-v').textContent = `${m.shapeRnd ? '~' : ''}${dims.W}×${dims.H}`;
  $('m-pv-dims').textContent = m.shapeRnd ? 'Random map type' : `${dims.W}×${dims.H} tiles`;
  $('m-rough-v').textContent = TERRAIN_PRESETS[m.rough].name;
  $('m-rich-v').textContent = RESOURCE_PRESETS[m.rich].name;
  $('m-style-row').hidden = colony;
  $('m-style-note').hidden = colony;
  $('m-l-style').textContent = mps ? 'Computer doctrine' : 'Rival doctrine';
  // Each rival (Custom Game with three or four players): a doctrine for each computer player. (In multiplayer the host
  // sets them in the lobby, where it's clear which places the computer takes.)
  const cpus = menuCpuSlots();
  $('m-seats-row').hidden = colony || mps || cpus.length < 2;
  $('m-l-seats').textContent = menuTeams() ? 'Each computer' : 'Each rival';
  for (const lab of $('m-seats').children) {
    const p = +lab.dataset.k + 1, v = menuSlotStyle(p), sel = lab.querySelector('select');
    lab.hidden = !cpus.includes(p);
    if (sel.value !== String(v)) sel.value = String(v);
    sel.setAttribute('aria-label', `${seatName(p)}: doctrine`);
    lab.dataset.doc = docKeyOf(v);
    lab.dataset.info = docInfo(docKeyOf(v));
  }
  $('m-wild-row').hidden = !colony;
  // The Murmur: none on Lunar (Argos, the moon, is silent ground), so there the switch is off and can't be turned on
  // (the setting itself is kept for the next biome).
  const silent = !menuMurmur();
  $('m-wild').disabled = silent;
  $('m-wild-row').classList.toggle('na', silent);
  $('m-wild-row').dataset.info = silent ? 'The Murmur: none on Argos, the moon (no nests, no raids).'
    : 'The Murmur (Colony): native creatures burrow in the wilds and raid what you build near their nests. None on Argos, the moon.';
  for (const [id, on] of [['m-nuke', m.nuke], ['m-wild', m.wild && !silent], ['m-events', m.events], ['m-unlimited', m.unlimited], ['m-weather', weatherOn()]]) {
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
  const np = menuPlayers();
  sRow.querySelector('.m-pick-meta').textContent = m.shapeRnd ? (np === 4 ? 'any for 4 players' : three ? 'any for 3 players' : 'any map type') : mapGroupName(SH.group);
  sRow.dataset.info = m.shapeRnd ? `Random map type: ${np === 4 ? 'one with room for four players' : three ? 'one with room for three players' : 'any made for two'}, picked when you land.` : `${SH.name}: ${SH.blurb || ''}`;
  sRow.setAttribute('aria-label', `Map type: ${m.shapeRnd ? 'Random' : SH.name}. Change`);
  drawThumbOnce(sRow.querySelector('canvas'), 'shape:' + (m.shapeRnd ? 'rnd' : shape), (cv) => drawShapeThumb(cv, m.shapeRnd ? null : SH));
  bRow.querySelector('.m-pick-name').textContent = m.biomeRnd ? 'Random' : biomeName(m.biome || 0);
  bRow.querySelector('.m-pick-meta').textContent = m.biomeRnd ? 'any biome' : (BIOMES[bk] && BIOMES[bk].kind) || '';
  bRow.dataset.info = m.biomeRnd ? 'Random biome: any of them, picked when you land.' : `${biomeName(m.biome || 0)} (${((BIOMES[bk] && BIOMES[bk].kind) || '').toLowerCase()}): ${(BIOMES[bk] && BIOMES[bk].desc) || ''}`;
  bRow.setAttribute('aria-label', `Biome: ${m.biomeRnd ? 'Random' : biomeName(m.biome || 0)}. Change`);
  drawThumbOnce(bRow.querySelector('canvas'), 'biome:' + (m.biomeRnd ? 'rnd' : bk) + ':' + artCount(), (cv) => drawBiomeSwatch(cv, m.biomeRnd ? null : bk));
}

/* ------------------------------------------------------------------ map type and biome pickers */

function openPicker(kind) {
  if (kind === 'biome' && typeof ensureBiomeArt === 'function') for (const b of BIOME_ORDER) ensureBiomeArt(b); // their swatches fill in as it arrives
  const m = UI.menu, body = $('m-picker-body'), want = m.mode === 'versus' ? clamp(Math.round(m.players) || 2, 2, 4) : 2;
  UI.picker = { kind, opener: document.activeElement };
  $('m-picker-title').textContent = kind === 'shape' ? 'Map type' : 'Biome';
  $('m-picker').classList.toggle('bio', kind === 'biome');
  const card = (v, on, inner, cls, tip) => `<button type="button" class="pcard${cls ? ' ' + cls : ''}" data-v="${v}"${on ? ' aria-current="true"' : ''}${tip ? ` title="${tip.replace(/"/g, '&quot;')}"` : ''}>${inner}</button>`;
  let h = '';
  if (kind === 'shape') {
    const text = (name, badges, blurb) => `<canvas class="pc-thumb" aria-hidden="true"></canvas><span class="pc-text"><span class="pc-name">${name}</span>${badges ? `<span class="pc-badges">${badges}</span>` : ''}<span class="pc-blurb">${blurb}</span></span>`;
    h += `<div class="pgrid">${card('rnd', m.shapeRnd, text('Random', '', want > 2 ? `One of the map types with room for ${want === 4 ? 'four' : 'three'}, picked when you land.` : 'Any map type, picked when you land.'), 'rnd')}</div>`;
    const groups = MAP_GROUPS.map((g) => ({ ...g, list: [] })), other = { key: '', name: 'More', list: [] };
    SHAPE_PRESETS.forEach((P, i) => (groups.find((g) => g.key === P.group) || other).list.push(i));
    for (const g of groups.concat(other)) {
      if (!g.list.length) continue;
      h += `<section class="pgroup" aria-label="${g.name}"><h3>${g.name}</h3><div class="pgrid">` + g.list.map((i) => {
        const P = SHAPE_PRESETS[i], badges = (maxPlayers(i) > 2 ? `<span class="badge ffa">${minPlayers(i) === maxPlayers(i) ? maxPlayers(i) : `${Math.max(3, minPlayers(i))}–${maxPlayers(i)}`.replace('3–3', '3')} players${minPlayers(i) > 2 ? ' only' : ''}</span>` : '') + (P.naval ? '<span class="badge naval">Naval</span>' : '');
        return card(i, !m.shapeRnd && i === (m.shape || 0), text(P.name, badges, P.blurb || ''), '', P.blurb);
      }).join('') + '</div></section>';
    }
  } else {
    const inner = (name, desc) => `<canvas class="pc-swatch" aria-hidden="true"></canvas><span class="pc-name">${name}</span><span class="pc-blurb">${desc}</span>`;
    h += '<div class="pgrid">' + card('rnd', m.biomeRnd, inner('Random', 'Any biome, picked when you land.'), 'rnd')
      + BIOME_ORDER.map((k, i) => card(i, !m.biomeRnd && i === (m.biome || 0), inner(BIOMES[k].name, `<b>${BIOMES[k].kind}.</b> ${BIOMES[k].desc || ''}`), '', `${BIOMES[k].kind}: ${BIOMES[k].desc}`)).join('') + '</div>';
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
    const want = m.mode === 'versus' ? clamp(Math.round(m.players) || 2, 2, 4) : 2;
    const pool = SHAPE_PRESETS.map((_, i) => i).filter((i) => maxPlayers(i) >= want && minPlayers(i) <= want);
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
  const i = SHAPE_PRESETS.indexOf(P), d = mapDims({ size: 1, shape: Math.max(0, i), players: P.minPlayers || 2 });
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
  // The maps made for three or four: their own layouts, with a base marker for each colony.
  let marks = null;
  const disc = (fill) => { ctx.fillStyle = THUMB.space; ctx.fillRect(x0, y0, mw, mh); ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.48, 0, 7); ctx.fillStyle = fill; ctx.fill(); };
  const polar = (a, r) => [0.5 + (Math.cos(a) * r * U) / mw, 0.5 + (Math.sin(a) * r * U) / mh];
  const third = (k) => Math.PI / 2 + (k * 2 * Math.PI) / 3; // (the bases: down, then round)
  if (P.wheel) {
    disc(THUMB.ground);
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.4, 0, 7); ctx.strokeStyle = THUMB.hi; ctx.lineWidth = Math.max(1, U * 0.05); ctx.stroke();
    for (let k = 0; k < 3; k++) line([polar(third(k) + Math.PI / 3, 0.12), polar(third(k) + Math.PI / 3, 0.36)], THUMB.rock, Math.max(2, U * 0.07));
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.13, 0, 7); ctx.fillStyle = THUMB.hi; ctx.fill(); ctx.strokeStyle = 'rgba(40,20,10,0.55)'; ctx.lineWidth = Math.max(1, U * 0.02); ctx.stroke();
    for (let k = 0; k < 3; k++) { const [u, v] = polar(third(k), 0.14); ctx.fillStyle = THUMB.ramp; ctx.fillRect(X(u) - U * 0.025, Y(v) - U * 0.025, U * 0.05, U * 0.05); }
    for (let k = 0; k < 4; k++) { ctx.fillStyle = THUMB.res[k % 3 + 1]; const [u, v] = polar(k * 1.6, 0.06); ctx.beginPath(); ctx.arc(X(u), Y(v), Math.max(1, U * 0.025), 0, 7); ctx.fill(); }
    marks = [0, 1, 2].map((k) => polar(third(k), 0.33)); crags = 0;
  } else if (P.mesas) {
    disc(THUMB.lo);
    for (let k = 0; k < 3; k++) {
      const a0 = third(k) - Math.PI / 3 + 0.2, a1 = third(k) + Math.PI / 3 - 0.2;
      ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.45, a0, a1); ctx.arc(X(0.5), Y(0.5), U * 0.2, a1, a0, true); ctx.closePath();
      ctx.save(); ctx.translate(U * 0.02, U * 0.03); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill(); ctx.restore();
      ctx.fillStyle = THUMB.hi; ctx.fill(); ctx.strokeStyle = THUMB.rockHi; ctx.lineWidth = Math.max(1, U * 0.015); ctx.stroke();
      const [u, v] = polar(third(k), 0.19); ctx.fillStyle = THUMB.ramp; ctx.fillRect(X(u) - U * 0.025, Y(v) - U * 0.025, U * 0.05, U * 0.05);
    }
    for (let k = 0; k < 5; k++) { ctx.fillStyle = THUMB.res[k % 3 + 1]; const [u, v] = polar(k * 1.3, 0.08); ctx.beginPath(); ctx.arc(X(u), Y(v), Math.max(1, U * 0.028), 0, 7); ctx.fill(); }
    marks = [0, 1, 2].map((k) => polar(third(k), 0.33)); crags = 0;
  } else if (P.pinwheel) {
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let r = 0.1; r <= 0.43; r += 0.03) { const f = Math.max(0, Math.min(1, (0.3 - r) / 0.2)); pts.push(polar(Math.PI + (k * Math.PI) / 2 - 1.2 * f * f * (3 - 2 * f), r)); }
      line(pts, THUMB.rock, Math.max(2, U * 0.07));
    }
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.09, 0, 7); ctx.fillStyle = THUMB.hi; ctx.fill();
    marks = [[0.22, 0.78], [0.22, 0.22], [0.78, 0.22], [0.78, 0.78]]; crags = 0;
  } else if (P.isles4) {
    ctx.fillStyle = THUMB.water; ctx.fillRect(x0, y0, mw, mh);
    const isle = (u, v, r) => { blob(u, v, r * 1.12, r * 1.12, THUMB.waterHi); s -= 2; blob(u, v, r, r, THUMB.ground); };
    line([[0.22, 0.65], [0.22, 0.35]], THUMB.sand, Math.max(1.2, U * 0.04), [U * 0.05, U * 0.04]); line([[0.78, 0.65], [0.78, 0.35]], THUMB.sand, Math.max(1.2, U * 0.04), [U * 0.05, U * 0.04]);
    for (const [u, v] of [[0.22, 0.78], [0.22, 0.22], [0.78, 0.22], [0.78, 0.78]]) isle(u, v, 0.15);
    isle(0.5, 0.5, 0.1);
    for (const [u, v] of [[0.5, 0.77], [0.23, 0.5], [0.5, 0.23], [0.77, 0.5]]) isle(u, v, 0.045);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = THUMB.res[k + 1]; const [u, v] = polar(k * 2.1, 0.05); ctx.beginPath(); ctx.arc(X(u), Y(v), Math.max(1, U * 0.025), 0, 7); ctx.fill(); }
    marks = [[0.22, 0.78], [0.22, 0.22], [0.78, 0.22], [0.78, 0.78]]; crags = 0;
  } else if (P.twin) {
    const lw = Math.max(3, U * 0.1);
    line([[0.5, 0], [0.5, 0.26]], THUMB.rock, lw); line([[0.5, 0.36], [0.5, 0.64]], THUMB.rock, lw); line([[0.5, 0.74], [0.5, 1]], THUMB.rock, lw);
    for (const v of [0.31, 0.69]) for (const u of [0.42, 0.58]) { ctx.fillStyle = THUMB.res[v < 0.5 === u < 0.5 ? 1 : 2]; ctx.beginPath(); ctx.arc(X(u), Y(v), Math.max(1, U * 0.03), 0, 7); ctx.fill(); }
    marks = [[0.22, 0.78], [0.22, 0.22], [0.78, 0.22], [0.78, 0.78]]; crags = 1;
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
  if (!P.maze && !P.sky && !marks) for (let k = 0; k < 3; k++) { const u = 0.15 + rnd() * 0.7, v = 0.6 + rnd() * 0.12; ctx.fillStyle = THUMB.res[k % 4]; for (const [uu, vv] of [[u, v], [1 - u, 1 - v]]) { ctx.beginPath(); ctx.arc(X(uu), Y(vv), Math.max(1, U * 0.03), 0, 7); ctx.fill(); } }
  const bs = Math.max(3, U * (marks ? 0.085 : 0.1));
  for (const [k, [u, v]] of (marks || [[0.5, 0.88], [0.5, 0.12]]).entries()) {
    ctx.fillStyle = marks ? PLAYER_COLORS[k] : k ? PLAYER_COLORS[1] : PLAYER_COLORS[ME]; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, bs * 0.18);
    roundRect(ctx, X(u) - bs / 2, Y(v) - bs / 2, bs, bs, bs * 0.25); ctx.fill(); ctx.stroke();
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

/** The settings newGame would make of the menu (Random biome: drawn as the Rust, the red desert). */
function previewSettings() {
  const m = UI.menu, mode = m.mode === 'colony' ? 'colony' : 'versus';
  const st = { size: clamp(menuSize(), 0, SIZE_PRESETS.length - 1), rough: clamp(m.rough ?? DEFAULT_ROUGH, 0, TERRAIN_PRESETS.length - 1), rich: clamp(m.rich ?? DEFAULT_RICH, 0, RESOURCE_PRESETS.length - 1) };
  st.shape = clamp(m.shape || 0, 0, SHAPE_PRESETS.length - 1);
  st.players = playerCount(mode, st.shape, m.players);
  st.nuke = !!m.nuke;
  if (mode === 'versus' && m.teams && st.players === 4) st.teams = true; // (Four Isles: the allies' sandbars)
  st.biome = m.biomeRnd ? 'desert' : BIOME_ORDER[m.biome || 0] || 'desert';
  return { seed: m.seed >>> 0, mode, st };
}
function previewKey() {
  const p = previewSettings(), s = p.st;
  return UI.menu.shapeRnd ? 'rnd' : [p.seed, p.mode, s.shape, s.size, s.rough, s.rich, s.players, s.nuke ? 1 : 0, s.biome, s.teams ? 1 : 0].join(':');
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
  // (UI.saveHold: the game keeps failing, see `stage` in main.js. The last good save is left alone.)
  if (!S || UI.saveHold || S.winner >= 0 || S.players[ME].ai) return;
  if (saveGame()) { UI.savedAt = Date.now(); UI.saveFailed = false; }
  else if (!UI.saveFailed) {
    UI.saveFailed = true;
    toast('Couldn\'t save the game: this browser\'s storage is full or blocked. Keep this tab open to keep playing.', 'warn');
  }
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
 * The overlays (menu, pause, help, statistics, game over...) work as dialogs for the keyboard and for screen
 * readers: opening one moves the focus into it, Tab stays inside the one on top, and closing it puts the focus
 * back where it was. (Tab reached the buttons behind the pause menu.)
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
    if (a && a.closest && a.closest('[aria-modal="true"]:not(.screen)')) return; // (a dialog of its own, such as the menu's pickers, keeps its Tab)
    if (!f.length) { e.preventDefault(); return; }
    if (!scr.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey ? a === first || !f.includes(a) : a === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  }, true);
}

function syncSaved() {
  const el = $('p-saved');
  if (!el) return;
  const s = UI.savedAt ? Math.round((Date.now() - UI.savedAt) / 1000) : -1;
  el.textContent = UI.saveHold ? 'Saving is paused: something in the game keeps going wrong. Reload the page to carry on from your last save.'
    : UI.saveFailed ? 'Saving isn\'t working in this browser right now: keep this tab open.'
    : `Your game saves itself every ${AUTOSAVE_EVERY} seconds` + (s >= 0 ? ` (last saved ${s < 5 ? 'just now' : s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago'})` : '') + '. If it closes, tap Continue on the main menu.';
}

/* ------------------------------------------------------------------ boosts (hidden) */

function openBoost() {
  if (typeof MP !== 'undefined' && MP.on) return; // (single player only: in multiplayer it would change only this device's game)
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
  const rivals = boostableRivals(), body = $('bo-body'), me = S.players[ME], home = getE(me.lander);
  // A row of boosts for you or one rival: a supply drop, armed warbots, workers, haulers.
  const row = (P, label, extra) => `<div class="boost-row${P.id === ME ? ' boost-you' : ''}" data-p="${P.id}"><div class="boost-head"><i class="dot" style="background:${PLAYER_COLORS[P.id]}"></i>` +
    `<b>${label}</b>${extra}<small>${P.boosts ? `boosted ${P.boosts}×` : ''}</small></div>` +
    `<div class="boost-btns"><button class="btn small" data-k="goods" title="${Object.entries(BOOST.goods).map(([g, n]) => n + ' ' + GOOD[g].name).join(', ')}">Supply drop</button>` +
    (warOn() ? `<button class="btn small" data-k="warbots">+${BOOST.warbots} Warbots</button>` : '') +
    `<button class="btn small" data-k="workers">+${BOOST.workers} Workers</button><button class="btn small" data-k="haulers">+${BOOST.haulers} Haulers</button></div></div>`;
  let html = home && !home.dead ? row(me, 'You', '') : '';
  html += rivals.length ? rivals.map((P) => row(P, playerName(P.id), isDoctrine(P.style) ? ' · ' + docLabel(P.style) : '')).join('')
    : '<p class="mode-desc">There\'s no rival colony in this game.</p>';
  // Unit types every rival can be stopped making, for the rest of this game.
  if (rivals.length) {
    html += `<div class="boost-row ban-row"><div class="boost-head"><b>Rivals can't build</b><small>for the rest of this game</small></div><div class="ban-chips">` +
      BANNABLE.filter((k) => !BOTS_OFF.has(k)).map((k) => { const on = !!(S.ban && S.ban[k]); return `<button class="btn small ban-chip${on ? ' on' : ''}" data-ban="${k}" aria-pressed="${on}">${on ? '⊘ ' : ''}${BOTS[k].plural}</button>`; }).join('') +
      '</div><p class="hint">Tap one to stop every rival making it, and again to allow it. Ones they already have carry on; any they had queued are called off.</p></div>';
  }
  body.innerHTML = html;
  for (const btn of body.querySelectorAll('.boost-btns button')) {
    btn.onclick = () => {
      const p = +btn.closest('.boost-row').dataset.p, k = btn.dataset.k, n = boostRival(p, k);
      const what = k === 'goods' ? 'a supply drop' : `${n} ${{ warbots: 'armed Warbot', workers: 'Worker', haulers: 'Hauler' }[k]}${n === 1 ? '' : 's'}`;
      const msg = !n ? `${p === ME ? 'You are' : playerName(p) + ' is'} at the robot limit.` : p === ME ? `You got ${what}.` : `You gave ${playerName(p, true)} ${what}.`;
      $('bo-msg').textContent = msg;
      sfx(n ? 'place' : 'click');
      renderBoost();
    };
  }
  for (const btn of body.querySelectorAll('.ban-chip')) {
    btn.onclick = () => {
      const k = btn.dataset.ban, on = !(S.ban && S.ban[k]);
      setBan(k, on);
      $('bo-msg').textContent = on ? `The rivals can't build ${BOTS[k].plural} for the rest of this game.` : `The rivals can build ${BOTS[k].plural} again.`;
      sfx('click');
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
 * Shift + digit to save) · Shift+F a Bot Foundry's Order bots list · J jump to the latest alert · Esc back / clear selection / pause ·
 * Space pause · [ ] game speed · + and - zoom · M minimap · ? help
 */
/**
 * Shift+F, from anywhere on a computer: a Bot Foundry's panel, scrolled to its Order bots list, without moving the map.
 * Pressed again while a Foundry's panel is open, the next one's (oldest first), when there are several.
 */
function openFoundryOrders() {
  const all = S.buildings.filter((b) => !b.dead && b.owner === ME && b.type === 'foundry');
  const ready = all.filter((b) => b.built).sort((a, b) => a.id - b.id);
  if (!ready.length) {
    sfx('error');
    toast(all.length ? 'Your Bot Foundry is still being built.' : 'You have no Bot Foundry yet: Build (B) → Make (2) → Bot Foundry (U).', 'warn');
    return;
  }
  const at = UI.sheetKind === 'bld' ? ready.findIndex((b) => b.id === UI.sheetFor) : -1;
  const f = ready[(at + 1) % ready.length];
  setMode('normal');
  openBuildingSheet(f);
  sfx('click');
  const list = $('sh-omode');
  if (list && list.previousElementSibling) list.previousElementSibling.scrollIntoView({ block: 'start' });
  if (ready.length > 1) toast(`Bot Foundry ${ready.indexOf(f) + 1} of ${ready.length}: Shift+F again for the next.`, 'info');
}

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
 * the same letter's usual job (the key is shown on the button on a computer). Delete or Backspace dismantles,
 * pressed twice like the button.
 */
const SHEET_KEYS = {
  'sh-send': 'q', 'sh-bombard': 'q', 'sh-fire': 'f', 'sh-aim': 'f', 'sh-rgo': 'g', 'sh-crawl': 'g', 'sh-deploy': 'e',
  'sh-gate': 'g', 'sh-move': 'm', 'sh-pack': 'm', 'sh-pause': 'p', 'sh-fixbtn': 'e', 'sh-layroad': 'r', 'sh-pipe': 'k',
  'sh-recall': 'c', 'sh-unpost': 'c', 'rl-recall': 'c', 'sh-land': 'l', 'sh-st-send': 'v', 'nk-evac': 'v',
  'sh-bomb': 'z', 'sh-strike': 'q', 'sh-fsail': 'g', 'sh-fembark': 'e', 'sh-fland': 'l', 'sh-fhome': 'h', 'sh-found': 'p', 'sh-fout': 'o', 'sh-tarmor': 'r',
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
    if (!canPlace(ME, 'ramp', i + di, j + dj).ok) continue;
    if (best < 0 || UI.draft.ramps.has(u)) best = u;
  }
  return best;
}

/** Route to on or off (Roads, Bridges and Rail; from anywhere else it opens Roads with it on). */
function toggleRoute() {
  const was = R.mode === 'road';
  if (!was) setMode('road');
  if (!['road', 'bridge', 'rail'].includes(UI.roadMode)) { UI.roadMode = 'road'; UI.route = true; }
  else UI.route = was ? !UI.route : true;
  UI.routeGhost = null; UI.routePrev = null;
  sfx('click');
  showRoadBanner();
}

/** Paths on the Roads tool, ready to drag roads (Route to off), whatever tool was used last. */
function openRoadDraw() {
  UI.route = false; UI.routeGhost = null; UI.routePrev = null;
  openPaths('road');
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
    // Control groups: Cmd/Ctrl (or Shift, or Option/Alt) + 1–9 saves the selected warbots and Howitzers as
    // a group, 1–9 selects it again (press twice to jump to it). Option/Alt and Shift always reach the game;
    // a browser tab on a Mac may keep Cmd+1–9 for itself (it switches tabs).
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
    if (e.key === 'Tab' && UI.sheetKind === 'build' && $('build-tabs') && !topScreen() && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      const tabs = [...$('build-tabs').children], i = tabs.findIndex((b) => b.classList.contains('on'));
      tabs[(i + (e.shiftKey ? tabs.length - 1 : 1)) % tabs.length].click();
      return;
    }
    if (digit && $('screen-pause').hidden) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) saveGroup(+digit[1]); else recallGroup(+digit[1]);
      return;
    }
    if (e.altKey && e.key === 'Enter' && fsSupported()) { e.preventDefault(); toggleFullscreen(); return; }
    // Ctrl+Z (Cmd+Z) in Paths is the banner's Undo: the last stroke of the plan, or the arrows a drag turned.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'z' && R.mode === 'road' && $('screen-pause').hidden && $('screen-help').hidden) {
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
    // Shift+F, from anywhere: the Bot Foundry's Order bots list (again: the next Foundry).
    if (k === 'f' && e.shiftKey) { e.preventDefault(); openFoundryOrders(); return; }
    // Enter confirms the banner's main button (Build here, Fire, Lay roads...).
    if (k === 'enter' && !$('banner').hidden && !$('banner-ok').hidden && !$('banner-ok').disabled) { e.preventDefault(); $('banner-ok').click(); return; }
    // A key on the open panel's buttons (SHEET_KEYS) presses that button.
    const sk = sheetKeyButton(k);
    if (sk) { e.preventDefault(); sk.click(); return; }
    // In the build menu, a building's letter on the tab that's showing picks it, R goes straight to
    // laying roads and X to Walls. W, A, S and D still pan the map (no building uses them).
    if (UI.sheetKind === 'build' && k === 'r') { e.preventDefault(); openRoadDraw(); return; }
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
      // R always means the road drag tool: from anywhere it opens Paths on Roads (drawing, not Route to,
      // whatever tool was used last); on that tool already, it closes Paths. (P opens the last tool used.)
      case 'r': if (R.mode === 'road' && UI.roadMode === 'road' && !UI.route) $('btn-road').click(); else openRoadDraw(); break;
      case 'o': openPaths('arrows'); break;
      case 'g': openPaths('bridge'); break;
      case 'v': openPaths('ramp'); break;
      case 'e': openPaths('pave'); break;
      case 't': if (R.mode !== 'road') setMode('road'); R.traffic = !R.traffic; showRoadBanner(); sfx('click'); break;
      case 'l': openPaths('lights'); break;
      case 'x': if (warOn()) openPaths('wall'); break;
      case 'n': openPaths('rail'); break;
      case 'k': openPaths('pipe'); break;
      case 'z': toggleRoute(); break;
      case 'q': if (!$('btn-attack').hidden) $('btn-attack').click(); break;
      case 'h': case 'home': $('btn-home').click(); break;
      case 'm': setMinimap(!MM.on); break;
      case 'c': if (warOn()) recallAllWarbots(); break;
      case 'f': selectBots(armyIds(ME), false); if (UI.sel.length) toast(`${UI.sel.length} warbots selected: right-click to give orders.`, 'info'); break;
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
 * your warbots or Howitzers to select it (tap it again for all of its kind in view), and while the selection bar
 * is showing a tap on the map is the order a right-click would give, with a ring where it landed and Undo on the
 * bar for a few seconds. A drag is never an order: it moves the map as always. The Army panel (send a number of
 * warbots from your garrisons to a target or a spot) is as it was, for either hand.
 */

const EDGE_SCROLL = 6; // pixels from the window edge where the map scrolls
const ORDER_UNDO = 4000; // ms an order given by a tap can be taken back for

/** Select these warbots (or add them to the selection). */
function selectBots(ids, add) {
  const mine = selectable(ME, ids).map((u) => u.id);
  UI.sel = add ? [...new Set(UI.sel.concat(mine))] : mine;
  UI.undo = null; // (an order's Undo goes with the selection it was given to)
  refreshSelection();
}

/** Is a finger, not a mouse, at work? The last pointer used on the map says; before any, the kind of screen. */
function onTouch() { return INPUT.mouse === undefined ? matchMedia('(pointer: coarse)').matches : !INPUT.mouse; }

/** The selection bar's parts, made once: what's selected and doing what, the mouse's hint, and a finger's buttons. */
function initSelBar() {
  $('selbar').innerHTML = `<div class="sel-top"><div class="sel-text"><b id="sel-title"></b> <span id="sel-notes"></span></div>
      <button class="btn small ghost" id="selbar-clear" aria-label="Clear selection">✕</button></div>
    <span class="hint" id="sel-status"></span>
    <span class="hint sel-mouse">Right-click open ground to hold it, a rival building or robot to attack, your Outpost to station them, or a Repair Station to get them fixed. Esc clears.</span>
    <div class="sel-tools"><button class="btn small primary" id="sel-undo" hidden>Undo</button><button class="btn small" id="sel-view">All in view</button><button class="btn small" id="sel-army">Whole army</button><button class="btn small" id="sel-box">Box</button><button class="btn small" id="sel-info">Info</button><button class="btn small ghost" id="selbar-group" title="Save them as a control group (or ⌘/Ctrl/⌥ + 1–9)"></button></div>`;
  $('selbar-clear').onclick = () => { sfx('click'); selectBots([], false); };
  $('selbar-group').onclick = () => saveGroup(nextGroupNo());
  $('sel-undo').onclick = () => undoOrder();
  $('sel-view').onclick = () => { sfx('click'); selectBots(unitsInView(), false); if (!UI.sel.length) toast('None of your warbots are in view.', 'info'); };
  $('sel-army').onclick = () => { sfx('click'); selectBots(armyIds(ME).concat(S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].siege).map((u) => u.id)), false); };
  $('sel-info').onclick = () => { sfx('click'); const us = selectable(ME, UI.sel).filter((u) => !u.inside); if (us.length === 1) openBotSheet(us[0]); else openPopSheet(); };
  // Box: the next one-finger drag on the map draws a selection box (input.js), then it's off again. Tap Box again to call it off.
  $('sel-box').onclick = () => { sfx('click'); INPUT.boxArmed = !INPUT.boxArmed; refreshSelection(); };
}

/** Has the player warbots or Howitzers out in the open? (Then a finger held on the map draws a selection box: see input.js.) */
function fieldUnits() {
  return UI.inGame && !UI.paused && S.bots.some((u) => !u.dead && u.owner === ME && !u.inside && (isArmy(u) || BOTS[u.type].siege));
}

/** Your warbots and Howitzers out in the open on the screen now (optionally only warbots, or only Howitzers). */
function unitsInView(siege) {
  const ids = [];
  for (const u of S.bots) {
    if (u.dead || u.inside || u.owner !== ME || (!isArmy(u) && !BOTS[u.type].siege) || (siege !== undefined && !!BOTS[u.type].siege !== siege)) continue;
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

/** Your warbot or Howitzer out in the open nearest a tap, within a fingertip of it however far the map is zoomed out; or null. */
function unitAtTap(wx, wy) {
  const r = Math.max(0.55, 22 / R.cam.z);
  let best = null, bd = r * r;
  for (const u of S.bots) {
    if (u.dead || u.inside || u.owner !== ME || (!isArmy(u) && !BOTS[u.type].siege)) continue;
    const d = dist2(u.x, u.y, wx, wy);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

/** A finger's tap on your warbot or Howitzer selects it; a second tap on it within half a second takes all of its kind in view. */
function touchSelect(u) {
  const now = performance.now(), L = UI.lastSel;
  UI.lastSel = { id: u.id, at: now };
  sfx('click');
  selectBots(L && L.id === u.id && now - L.at < 500 ? unitsInView(!!BOTS[u.type].siege) : [u.id], false);
}

/** Is the selection bar on the screen (not hidden behind a panel or a mode's banner on a phone)? Only then are a finger's taps orders. */
function selBarShowing() { return UI.sel.length > 0 && !$('selbar').hidden && $('selbar').getClientRects().length > 0; }

/**
 * What a robot is doing, in the terms of the order that would send it back to it (ORDERS.undoCommand): its id,
 * 'in' a garrison, 'attack' or 'bombard' a building, 'hold' or 'park' at a tile, or 'free'; where it's posted; and
 * whether a Howitzer's target was its own pick.
 */
function orderSnapshot(u) {
  const t = u.task, r = t && t.type === 'hold' ? rallyById(t.rally) : null;
  const was = u.inside ? ['in', u.inside] : !t ? ['free'] : t.type === 'garrison' ? ['in', t.bld] : t.type === 'attack' ? ['attack', t.target]
    : r ? ['hold', Math.floor(r.x), Math.floor(r.y)] : t.type === 'bombard' ? ['bombard', t.target] : t.type === 'park' ? ['park', t.i, t.j] : ['free'];
  const post = u.post && typeof u.post === 'object' ? { i: u.post.i, j: u.post.j } : u.post ?? null;
  return [u.id, was[0], was[1] || 0, was[2] || 0, post, !!(t && t.auto)];
}

/**
 * A finger's tap on the map with warbots selected: their order, the one a right-click gives (onMapCommand). What
 * each was doing is noted first, so Undo on the selection bar can send them back to it for ORDER_UNDO ms.
 */
function touchOrder(i, j, wx, wy) {
  const was = selectable(ME, UI.sel).map(orderSnapshot);
  onMapCommand(i, j, wx, wy, () => { UI.undo = { was, until: performance.now() + ORDER_UNDO, text: 'Order given.' }; refreshSelection(); });
}

/** Undo on the selection bar: each robot of the last order goes back to what it was doing (its garrison, its flag, its target, its spot). */
function undoOrder() {
  const U = UI.undo;
  UI.undo = null;
  if (!U) return;
  act('undoCommand', [U.was], (n) => {
    sfx('click');
    toast(`Order taken back: ${n === 1 ? 'it goes' : `${n} go`} back to what ${n === 1 ? 'it was' : 'they were'} doing.`, 'info');
    refreshSelection();
  });
}

/** The group number a Save as group button would use: the selection's own group if it's one already, else the first free one. */
function nextGroupNo() {
  const G = S && S.groups ? S.groups : {};
  for (let k = 1; k <= 9; k++) if (G[k] && G[k].length && G[k].length === UI.sel.length && UI.sel.every((id) => G[k].includes(id))) return k;
  for (let k = 1; k <= 9; k++) if (!G[k] || !selectable(ME, G[k]).length) return k;
  return 9;
}

/** Drop dead or captured warbots from the selection and update the selection bar. */
function refreshSelection() {
  if (UI.sel.length) UI.sel = selectable(ME, UI.sel).map((u) => u.id);
  UI.selSet = new Set(UI.sel);
  const bar = $('selbar'), touch = onTouch(), on = UI.sel.length > 0 && UI.inGame;
  bar.hidden = !on;
  document.body.classList.toggle('sel-on', on && touch); // (on an upright phone the bar takes the bottom bar's place)
  bar.classList.toggle('touch', touch);
  if (!on) { UI.undo = null; INPUT.boxArmed = false; refreshGroupBar(); return; }
  // (its parts are made once, by initSelBar: made again if one isn't there, so a bar that lost a part can't stop this)
  if (!['sel-title', 'sel-notes', 'sel-status', 'sel-box', 'sel-undo', 'selbar-group'].every((id) => $(id)) || !bar.querySelector('.sel-mouse')) initSelBar();
  $('sel-box').classList.toggle('on', INPUT.boxArmed);
  let inside = 0, empty = 0;
  for (const u of orderable(ME, UI.sel)) { if (u.inside) inside++; if (!botArmed(u)) empty++; }
  const undo = UI.undo && performance.now() < UI.undo.until ? UI.undo : (UI.undo = null);
  const set = (id, html) => { const el = $(id); if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; } };
  set('sel-title', `${groupWords(UI.sel)} selected`);
  set('sel-notes', (inside ? `<span class="muted">(${inside} in garrisons)</span> ` : '') + (empty ? `<span class="err">${empty} out of Ammo or Fuel</span>` : ''));
  set('sel-status', INPUT.boxArmed ? '<b>Box:</b> drag a finger round warbots (two fingers move the map)'
    : undo ? `<span class="ok">${esc(undo.text)}</span> Undo takes it back.` : (touch ? '<b>Tap the map</b> to send them · ' : '') + esc(selStatus(selectable(ME, UI.sel))));
  set('selbar-group', `Save as group ${nextGroupNo()}`);
  $('sel-undo').hidden = !undo;
  refreshGroupBar();
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
    if (u.dead || u.owner !== ME || (!isArmy(u) && !BOTS[u.type].siege) || u.inside) continue;
    const p = worldToScreen(u.x, u.y);
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(u.id);
  }
  // A box round your own garrisons picks up their spare warbots too (each keeps its Keep at home).
  for (const b of S.buildings) {
    if (b.dead || b.owner !== ME || !b.garrison || b.garrison.length < 2) continue;
    const p = worldToScreen(b.x + 0.5, b.y + 0.5);
    if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(...b.garrison.slice(1));
  }
  INPUT.boxArmed = false; // (Box on the selection bar is for one drag)
  if (!ids.length && !armed && onTouch()) { refreshSelection(); return; }
  selectBots(ids, add);
  if (ids.length) sfx('click'); else if (onTouch()) toast('No warbots of yours in that box.', 'info');
}

/**
 * Right-click (or, under a finger, a tap with the selection bar showing): order the selected warbots to whatever is
 * under the pointer. done() runs once an order has gone to them.
 */
function onMapCommand(i, j, wx, wy, done) {
  if (!UI.inGame || UI.paused || R.mode !== 'normal') return;
  // Your Ferry, its panel open (nothing else picked): right-click open water, a spot on the shore or one of your Ports to sail it there.
  const fpick = !UI.sel.length && UI.sheetKind === 'bot' ? getE(UI.sheetFor) : null;
  if (fpick && !fpick.dead && fpick.owner === ME && BOTS[fpick.type].ferry) {
    act('sail', [fpick.id, i, j], (why) => {
      if (why) { sfx('error'); toast(why, 'warn'); return; }
      sfx('order'); addFx('ring', i + 0.5, j + 0.5, { color: '#7dffa0' });
      refreshSheet();
    });
    return;
  }
  if (!UI.sel.length) return;
  const b = buildingAtTap(i, j, wx, wy);
  // Your Ferry, off a shore: the selected warbots walk to the shore beside it and board.
  const ferry = S.bots.find((v) => !v.dead && v.owner === ME && BOTS[v.type].ferry && !v.inside && dist2(v.x, v.y, wx, wy) < 0.9);
  if (ferry) {
    const fx = ferry.x, fy = ferry.y;
    act('command', [UI.sel.slice(), { ferry: ferry.id }], (r) => {
      if (!r || r.why) { sfx('error'); toast((r && r.why) || 'That Ferry is gone.', 'warn'); return; }
      sfx('order'); addFx('ring', fx, fy, { color: '#7dffa0' });
      toast(`${r.n} warbot${r.n === 1 ? '' : 's'} heading for the Ferry: they board once they're beside it.`, 'info');
      if (done) done();
    });
    return;
  }
  // Howitzers in the selection shell an enemy building, or drive to open ground (or beside a garrison) and wait there;
  // the damaged go to your Repair Station; warbots go after an enemy robot, attack a building, station in a garrison or
  // hold the ground (ORDERS.command).
  const foe = !b ? enemyBotAtTap(i, j) : null;
  const spec = foe ? { foe: foe.id } : b ? { b: b.id } : { i, j };
  const theirs = !!b && foes(b.owner, ME), mine = !!b && b.owner === ME, bName = b ? BDEFS[b.type].name : '', foeName = foe ? BOTS[foe.type].name : '';
  const rx = (b ? b.x : i) + 0.5, ry = (b ? b.y : j) + 0.5;
  act('command', [UI.sel.slice(), spec], (r) => {
    const where = `${onTouch() ? 'Tap' : 'Right-click'} open ground, a rival building or one of your garrisons.`;
    if (!r || r.why) { sfx('error'); toast((r && r.why) || where, 'warn'); return; }
    if (r.kind === 'repair') {
      sfx('order'); addFx('ring', rx, ry, { color: '#7dffa0' });
      toast(`${r.n} robot${r.n === 1 ? '' : 's'} heading to the Repair Station.`, 'info');
      if (done) done();
      refreshSelection();
      return;
    }
    if (r.kind === 'none') { sfx('error'); toast(where, 'warn'); return; }
    const n = r.n, nr = r.nr;
    const what = r.kind === 'hunt' ? `going after the rival's ${foeName}` : r.kind === 'attack' ? `attacking the ${bName}` : r.kind === 'station' ? `heading to the ${bName}` : 'moving to hold that ground';
    if (nr && !n) {
      sfx('order');
      addFx('ring', rx, ry, { color: theirs ? '#ff5a6e' : '#7dffa0' });
      toast(`${nr} Howitzer${nr > 1 ? 's' : ''} ${theirs ? `shelling the ${bName}` : 'on the move'}.`, 'info');
      if (done) done();
      refreshSelection();
      return;
    }
    if (!n) {
      sfx('error');
      toast(mine ? 'That garrison is full.' : 'None of the selected warbots have Ammo: they reload in a garrison first.', 'warn');
      return;
    }
    sfx('order');
    addFx('ring', rx, ry, { color: theirs ? '#ff5a6e' : '#7dffa0' });
    toast(`${n} warbot${n > 1 ? 's' : ''} ${what}.`, 'info');
    if (done) done();
    refreshSelection();
  });
}

/** Control groups: Ctrl/Shift + digit saves the selection; the digit selects it again, twice to jump there. */
/** Control groups (kept with the game, so they're there after Continue): group number → robot ids. */
function ctrlGroups() { if (!S.groups) S.groups = {}; return S.groups; }

/** What a list of selected robots is, in words ("2 Howitzers", "5 warbots and 1 Howitzer"). */
function groupWords(ids) {
  const us = selectable(ME, ids), n = {};
  for (const u of us) n[u.type] = (n[u.type] || 0) + 1;
  const words = Object.keys(n).map((k) => `${n[k]} ${k === 'warbot' ? (n[k] > 1 ? 'warbots' : 'warbot') : n[k] > 1 ? BOTS[k].plural : BOTS[k].name}`);
  return words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words.join('');
}

function saveGroup(k) {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  if (!UI.sel.length) { toast(onTouch() ? `Select ${BOTS_OFF.has('rocket') ? 'warbots' : 'warbots or Howitzers'} first (tap one), then Save as group.` : `Select ${BOTS_OFF.has('rocket') ? 'warbots' : 'warbots or Howitzers'} first (drag a box round them), then ${mac ? '⌘ or ⌥' : 'Ctrl'}+${k} saves them as group ${k}.`, 'info'); return; }
  const G = ctrlGroups();
  // A robot is in one group at a time: putting it in this one takes it out of any other.
  for (const g in G) G[g] = G[g].filter((id) => !UI.sel.includes(id));
  G[k] = UI.sel.slice();
  sfx('click');
  toast(`Group ${k}: ${groupWords(G[k])}. ${onTouch() ? `Tap its chip ${k}` : `Press ${k}`} to select them again (twice to go to them).`, 'info');
  refreshGroupBar();
}

function recallGroup(k) {
  const ids = selectable(ME, ctrlGroups()[k] || []).map((u) => u.id);
  if (!ids.length) return;
  const twice = UI.lastGroup.k === k && performance.now() - UI.lastGroup.at < 450;
  UI.lastGroup = { k, at: performance.now() };
  selectBots(ids, false);
  sfx('click');
  if (twice) {
    const us = selectable(ME, ids);
    let x = 0, y = 0;
    for (const u of us) { const h = u.inside ? getE(u.inside) : null; x += h ? h.x + 0.5 : u.x; y += h ? h.y + 0.5 : u.y; }
    centerOn(x / us.length, y / us.length);
  }
}

/** The group of each robot in a control group (for the number shown by it on the map). */
function groupOf(id) {
  const G = S && S.groups;
  if (!G) return 0;
  for (const g in G) if (G[g].includes(id)) return +g;
  return 0;
}

/**
 * The control-group bar (computers and touch alike): a chip for each group that has anyone left in it;
 * tap to select it, tap again to go to it.
 */
function refreshGroupBar() {
  let bar = $('groupbar');
  if (!bar) { bar = document.createElement('div'); bar.id = 'groupbar'; bar.className = 'groupbar'; document.body.appendChild(bar); }
  const G = UI.inGame && S ? ctrlGroups() : {};
  const chips = [];
  for (let k = 1; k <= 9; k++) {
    const ids = G[k] ? selectable(ME, G[k]).map((u) => u.id) : [];
    if (G[k] && ids.length !== G[k].length) G[k] = ids; // the lost are dropped
    if (!ids.length) continue;
    const on = UI.sel.length && ids.every((id) => UI.selSet && UI.selSet.has(id));
    chips.push(`<button class="gchip${on ? ' on' : ''}" data-g="${k}" title="Group ${k}: ${groupWords(ids)} (press ${k}; twice to go to them)"><kbd>${k}</kbd>${groupWords(ids).replace(' and ', ' + ')}</button>`);
  }
  const html = chips.join('');
  if (bar.dataset.html !== html) {
    bar.dataset.html = html;
    bar.innerHTML = html;
    for (const b of bar.querySelectorAll('[data-g]')) b.onclick = () => recallGroup(+b.dataset.g);
  }
  bar.hidden = !chips.length || !UI.inGame;
  // Above the selection bar when that's showing (wherever it sits: on an upright phone it's docked at the bottom).
  const sb = $('selbar'), sr = sb && !sb.hidden ? sb.getBoundingClientRect() : null;
  bar.style.bottom = sr && sr.height ? `${Math.round(window.innerHeight - sr.top + 8)}px` : '';
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
    html = `<b>${b.owner === ME ? '' : playerName(b.owner) + ' '}${def.name}</b>` + (b.owner === ME && b.status ? `<em>${b.status}</em>` : '') +
      (def.mil && !(b.owner === ME && b.status) ? `<em>${b.garrison.length} warbot${b.garrison.length === 1 ? '' : 's'} inside</em>` : '') +
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
      html = `<b>${bot.owner === ME ? '' : playerName(bot.owner) + ' '}${BOTS[bot.type].name}</b>` + (bot.owner === ME ? `<em>${botActivity(bot)}</em>` : '') +
        `<em>Health ${Math.ceil(bot.hp)}/${bot.maxHp}${bot.owner === ME ? ` · battery ${Math.round(bot.bat ?? 100)}%` : ''}</em>`;
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
  if (MP.on) return;
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
 * (map type, size, terrain, resources, biome, players), newest first. Tap one under the planet preview
 * in the new-game menu's Customise view to set the menu to it; × forgets it.
 */
const PLANETS_KEY = 'terrafall.planets', PLANETS_MAX = 40;
/** A saved planet this version can show and start: a number for a seed, and no setting the menu doesn't offer. */
function planetOk(p) {
  const fits = (v, list) => v == null || (Number.isInteger(v) && v >= 0 && v < list.length);
  return !!p && typeof p === 'object' && Number.isFinite(p.seed) && (p.players == null || (Number.isInteger(p.players) && p.players >= 2 && p.players <= 4)) &&
    fits(p.shape, SHAPE_PRESETS) && fits(p.size, SIZE_PRESETS) && fits(p.rough, TERRAIN_PRESETS) && fits(p.rich, RESOURCE_PRESETS) && fits(p.biome, BIOME_ORDER);
}
function savedPlanets() {
  let l;
  try { l = JSON.parse(localStorage.getItem(PLANETS_KEY) || '[]'); } catch (e) { return []; }
  if (!Array.isArray(l)) return [];
  l = l.filter(planetOk); // (one damaged or from another version is left out: it stopped the game booting, or ran as markup)
  // Planets saved before resources were lowered a notch: the setting that makes the same planet now.
  if (l.some((p) => p && !p.rv)) { for (const p of l) if (p && !p.rv) { p.rich = resLevelUp(p.rich); p.rv = RES_V; } writePlanets(l); }
  return l;
}
function writePlanets(list) { try { localStorage.setItem(PLANETS_KEY, JSON.stringify(list.slice(0, PLANETS_MAX))); } catch (e) { /* storage unavailable */ } }
const planetKey = (p) => [p.seed, p.shape, p.size, p.rough, p.rich, p.biome, p.players].join(':');
function savePlanet(p) { if (planetOk(p)) writePlanets([{ ...p, rv: RES_V, at: Date.now() }].concat(savedPlanets().filter((q) => planetKey(q) !== planetKey(p)))); }
/** The planet the new-game menu is set to. */
function menuPlanet() {
  return { seed: UI.menu.seed, shape: UI.menu.shape || 0, size: UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], rough: UI.menu.rough, rich: UI.menu.rich,
    biome: UI.menu.biome || 0, players: menuPlayers() };
}
/** The planet being played. */
function gamePlanet() {
  const st = S.settings || {}; // (a very old save has none)
  return { seed: S.seed, shape: st.shape || 0, size: st.size, rough: st.rough, rich: st.rich, biome: Math.max(0, BIOME_ORDER.indexOf(st.biome)), players: st.players || 2 };
}
function planetLabel(p) {
  const bits = [SHAPE_PRESETS[p.shape] ? SHAPE_PRESETS[p.shape].name : 'Standard', SIZE_PRESETS[p.size] ? SIZE_PRESETS[p.size].name : '', biomeName(p.biome || 0)];
  if (p.rough !== DEFAULT_ROUGH && TERRAIN_PRESETS[p.rough]) bits.push(TERRAIN_PRESETS[p.rough].name + ' terrain');
  if (p.rich !== DEFAULT_RICH && RESOURCE_PRESETS[p.rich]) bits.push(RESOURCE_PRESETS[p.rich].name + ' resources');
  if (p.players > 2) bits.push(`${p.players} players`);
  return `<b>Planet #${esc(p.seed)}</b><span> · ${bits.filter(Boolean).join(' · ')}</span>`;
}
function renderPlanets() {
  const el = $('m-planets');
  if (!el) return;
  const list = savedPlanets(), cur = UI.menu.shapeRnd || UI.menu.biomeRnd ? '' : planetKey(menuPlanet());
  el.hidden = !list.length;
  el.innerHTML = list.length ? `<span class="planets-title">Saved planets <small>${list.length}</small></span>` + list.map((p, k) =>
    `<div class="planet-row"><button class="btn small ghost use${planetKey(p) === cur ? ' on' : ''}" data-use="${k}" title="${planetLabel(p).replace(/<[^>]+>/g, '')}">${planetLabel(p)}</button><button class="btn small ghost del" data-del="${k}" aria-label="Forget Planet #${esc(p.seed)}" title="Forget this planet">×</button></div>`).join('') : '';
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

/** Where the rivals landed, from your Command Base: "Two rival colonies landed too: VERMILION (red) to the north, ..." */
function rivalsLanded() {
  const L0 = getE(S.players[ME].lander), rivals = S.players.filter((P) => foes(P.id, ME) && !P.absent);
  const at = (P) => { const L = getE(P.lander); return `${P.name || callsign(P.id, true)} ${L0 && L ? 'to the ' + dirText(L0, L).replace(/^\d+ tiles? /, '') : ''}`.trim(); };
  const where = rivals.map(at);
  const list = where.length > 1 ? where.slice(0, -1).join(', ') + ' and ' + where[where.length - 1] : where[0] || '';
  // (teams: your ally landed beside you)
  const ally = S.teams ? S.players.find((P) => allies(P.id, ME) && !P.absent) : null;
  return `${['', 'A rival colony', 'Two rival colonies', 'Three rival colonies'][rivals.length]} landed too: ${list}.` + (ally ? ` Your ally, ${at(ally)}, fights on your side.` : '');
}

/** The rivals' colours, for a hint on the map: 'red', 'red or green', 'red, green or purple'. */
function rivalColours() {
  const c = S.players.filter((P) => foes(P.id, ME) && !P.absent).map((P) => (RIVAL_NAMES[P.id] || 'red').toLowerCase());
  return c.length > 1 ? c.slice(0, -1).join(', ') + ' or ' + c[c.length - 1] : c[0] || 'red';
}

/** The briefing names each computer player's doctrine, so you know what's coming: "VERMILION (red) is a Warden (turtle): ...". */
function doctrineLines() {
  if (S.mode === 'colony') return;
  for (const P of S.players) {
    const st = P.id !== ME && P.ai && !P.absent && !P.out && isDoctrine(P.style) && PERSONALITIES[P.style];
    const who = allies(P.id, ME) ? `Your ally ${callsign(P.id, true)}` : S.players.length > 2 ? callsign(P.id, true) : `Your rival, ${callsign(P.id, true)},`;
    if (st) postMsg(ME, `${who} is ${st.noun} (${st.plain}): it ${st.desc}.`, 0, 0, 'info');
  }
}

function startNewGame() {
  clearSave();
  closePicker(false);
  // Random map type or biome: picked now (see resolveRandom); the menu keeps Random for next time.
  const pick = resolveRandom();
  newGame({
    seed: UI.menu.seed, difficulty: UI.menu.diff, mode: UI.menu.mode,
    size: UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], rough: UI.menu.rough, rich: UI.menu.rich, shape: pick.shape,
    nuke: !!UI.menu.nuke, biome: BIOME_ORDER[pick.biome], players: clamp(Math.round(UI.menu.players) || 2, 2, 4),
    style: docKeyOf(menuStyle()), styles: menuStyleKeys(), events: !!UI.menu.events, wildlife: !!UI.menu.wild, unlimited: !!UI.menu.unlimited,
    victory: UI.menu.victory, teams: menuTeams(),
  });
  enterGame();
  updateHUD();
  placeMinimap();
  postMsg(ME, UI.menu.mode === 'colony'
    ? (BIOMES[S.settings.biome] && BIOMES[S.settings.biome].silent ? `Your bots have landed on ${regionName(S.settings.biome)}. Build, expand and make this moon home.`
      : `Your bots have landed in ${regionName(S.settings.biome)}. Build, expand and make this planet home.`)
    : S.players.length > 2 ? `Your bots have landed. ${rivalsLanded()} Build up fast!`
      : `Your bots have landed. A rival colony, ${callsign(1, true)}, landed to the north. Build up fast!`, 0, 0, 'info');
  if (UI.menu.shapeRnd || UI.menu.biomeRnd) postMsg(ME, `Random pick: ${[UI.menu.shapeRnd ? SHAPE_PRESETS[pick.shape].name : '', UI.menu.biomeRnd ? biomeName(pick.biome) : ''].filter(Boolean).join(', ')}.`, 0, 0, 'info');
  doctrineLines();
  if (S.wildlife) {
    // Pointed at the nest nearest home (J jumps there), the rest are red on the minimap.
    const L = getE(S.players[ME].lander), nests = S.buildings.filter((b) => !b.dead && BDEFS[b.type].wild);
    const near = L && nests.length ? nests.reduce((a, b) => (dist2(b.x, b.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? b : a)) : null;
    postMsg(ME, `The Murmur live here: ${nests.length} nests sit out in the wilds (red on the minimap; the nearest is ${near ? dirText(L, near) : 'out there'}${near ? ': press J or tap here to look' : ''}). From about 7 minutes in they raid whatever you build near their nests. Pulse Turrets (with Crystal) and warbots keep them off; clear a nest with warbots to win the goods it hoards.`, near ? near.x : 0, near ? near.y : 0, 'warn');
  } else if (UI.menu.mode === 'colony' && UI.menu.wild && !murmurGround(S.settings.biome)) postMsg(ME, 'Argos is silent ground: no Murmur live on the moon.', 0, 0, 'info');
  if (S.posts && S.posts.length) {
    // Pointed at the post nearest home (J or a tap jumps there); the rest are gold on the minimap.
    const L = getE(S.players[ME].lander), near = L ? S.posts.reduce((a, p) => (dist2(p.x, p.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? p : a)) : null;
    postMsg(ME, `${S.posts.length} neutral Trade Posts (gold on the minimap${near ? ', nearest ' + dirText(L, near) : ''}): lay a road out and dock a Trade Terminal to trade.` + (S.mode !== 'colony' ? ` Hold the land round one to shut ${S.players.length > 2 ? 'the rivals' : 'your rival'} out.` : ''), near ? near.x : 0, near ? near.y : 0, 'info');
  }
  if (S.victory === 'uplinks' && S.uplinks) {
    const L = getE(S.players[ME].lander), near = L ? S.uplinks.reduce((a, u) => (dist2(u.x, u.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? u : a)) : null;
    postMsg(ME, `Uplinks: ${S.uplinks.length} neutral Uplink towers stand across the planet (ringed dots on the minimap${near ? ', nearest ' + dirText(L, near) : ''}). One is yours while it stands in your land: build an Outpost or a Keep near it. They come online ${UPLINK.online / 60} minutes in: from then on, hold ${uplinkGoal()} and your clock runs, and a total of ${UPLINK.hold / 60} minutes wins. Enemy warbots right beside an Uplink jam it.`, near ? near.x : 0, near ? near.y : 0, 'info');
  }
  if (S.victory === 'domination') postMsg(ME, `Domination: hold ${Math.round(domShare() * 100)}% of the land anyone holds (and ${Math.round(DOM.min * 100)}% of the planet) for ${DOM.hold / 60} minutes straight to win. The card at the top shows where everyone stands. Outposts and Keeps claim the most land.`, 0, 0, 'info');
  if (nukeOn()) postMsg(ME, `Nuclear race: a few uranium deposits glow green across the planet. Dig them with Ore Mines, enrich them at a Nuclear Reactor and build the bomb${S.mode === 'colony' ? ' (no rival here, so it is yours to try out)' : ` before ${S.players.length > 2 ? 'the rivals do' : 'the rival does'}`}.`, 0, 0, 'warn');
  $('br-title').textContent = 'Before you start';
  showBriefing(landingLog());
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

/** A line under the main menu's buttons: why a save didn't load. */
function menuMsg(m) { $('m-import-msg').textContent = m; $('m-import-msg').hidden = false; }

/**
 * Start playing the game just loaded into S (a save file, or this device's save), without saving it yet.
 * If it can't be started, the menu comes back and it's false.
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
 * Load a save file picked on the main menu: the game starts, and once it is running it becomes this device's
 * save too (the save it replaces is kept as a backup, SAVE_BACKUP_KEY). A file that can't be read, checked
 * (checkSave) or started changes nothing.
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
    postMsg(ME, 'Save file loaded. Welcome back.', 0, 0, 'info');
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
  postMsg(ME, 'Welcome back.', 0, 0, 'info');
}

/** Into the game in S: the HUD comes up and (unless `unsaved`: a save still being tried out) it's saved. */
function enterGame(unsaved) {
  bakeMap();
  UI.inGame = true; UI.paused = false; UI.overShown = false;
  UI.sel = []; UI.groups = {}; UI.lastAlert = null;
  UI.msgLog = []; $('btn-msgs').hidden = true;
  UI.objAuto = false; UI.objManual = false; UI.objStep = undefined;
  UI.saveHold = false;
  setSpeed(1, true);
  $('btn-speed').hidden = MP.on; // (a multiplayer game runs at one speed for everyone)
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
  const L = getE(S.players[ME].lander);
  R.cam.z = clamp(Math.min(R.w, R.h, 520) / 11, 26, 48); // (by the short side: a phone on its side started as close in as a tablet, five tiles of map high)
  if (L) centerOn(L.x + 0.5, L.y - 1);
  layoutMinimap();
  placeMinimap();
  armBack();
  if (!unsaved) saveGame();
}

function toMenu() {
  if (MP.on || MPJ.on) mpQuit();
  ME = 0;
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
  showMenuView('home');
  syncMenu();
  syncRejoin();
  startDemo();
}

function showHelp() {
  UI.paused = UI.inGame;
  helpForTouch();
  $('screen-help').hidden = false;
  helpPage('hs-top');
}

/**
 * The paged screens, How to play and Lore: one section at a time, with a bar above the text that stays put (Contents
 * when the screen has a contents page, a picker for any section, ‹ ›) and Previous / Next buttons at the section's
 * end. `top`: the contents page's id, or null (Lore: it opens on its first section, which links to the rest).
 */
const HELP_PAGER = { scr: 'screen-help', top: 'hs-top', nav: 'help-nav', toc: 'hn-toc', pick: 'hn-pick', prev: 'hn-prev', next: 'hn-next', foot: 'help-pager', fprev: 'hp-prev', fnext: 'hp-next' };
const LORE_PAGER = { scr: 'screen-lore', top: null, nav: 'lore-nav', pick: 'ln-pick', prev: 'ln-prev', next: 'ln-next', foot: 'lore-pager', fprev: 'lp-prev', fnext: 'lp-next' };

/** A paged screen's sections, in order, and a section's name (its heading). */
function pagerSections(P) { return [...$(P.scr).querySelectorAll('.help-body > section[id]')]; }
function pagerTitle(s) { return (s.querySelector('h3') || s).textContent.trim(); }

/** Build a paged screen's bar (above the text, outside its scroll) and its Previous / Next footer, once. */
function pagerInit(P) {
  const card = $(P.scr).querySelector('.help-card'), body = card.querySelector('.help-body');
  const nav = document.createElement('div');
  nav.className = 'help-nav'; nav.id = P.nav; nav.hidden = !!P.top;
  nav.innerHTML = (P.top ? `<button type="button" class="btn small" id="${P.toc}">Contents</button>` : '') +
    `<select id="${P.pick}" aria-label="Go to a section"></select>` +
    `<button type="button" class="btn small pn-prev" id="${P.prev}" aria-label="Previous section">‹</button>` +
    `<button type="button" class="btn small pn-next" id="${P.next}" aria-label="Next section">›</button>`;
  for (const s of pagerSections(P)) { const o = document.createElement('option'); o.value = s.id; o.textContent = pagerTitle(s); nav.querySelector('select').appendChild(o); }
  card.insertBefore(nav, body);
  const foot = document.createElement('div');
  foot.className = 'help-pager'; foot.id = P.foot; foot.hidden = !!P.top;
  foot.innerHTML = `<button type="button" class="btn fp-prev" id="${P.fprev}"></button><button type="button" class="btn fp-next" id="${P.fnext}"></button>`;
  body.appendChild(foot);
  const step = (d) => { const secs = pagerSections(P), k = secs.findIndex((s) => !s.hidden), t = secs[k + d]; pagerShow(P, t ? t.id : P.top || secs[0].id); };
  if (P.top) $(P.toc).onclick = () => pagerShow(P, P.top);
  $(P.pick).onchange = () => pagerShow(P, $(P.pick).value);
  $(P.prev).onclick = $(P.fprev).onclick = () => step(-1);
  $(P.next).onclick = $(P.fnext).onclick = () => step(1);
}

/** Show one page of a paged screen: its contents page (P.top), or one section; back at the top of it. */
function pagerShow(P, id) {
  const secs = pagerSections(P), k = secs.findIndex((s) => s.id === id), body = $(P.scr).querySelector('.help-body');
  if (P.top && $(P.top)) $(P.top).hidden = k >= 0;
  secs.forEach((s, i) => { s.hidden = i !== k; });
  $(P.nav).hidden = k < 0;
  $(P.foot).hidden = k < 0;
  if (k >= 0) {
    const first = k === 0 && !P.top; // (with a contents page, back from the first section is the contents)
    $(P.pick).value = id;
    $(P.prev).disabled = first;
    $(P.next).disabled = k === secs.length - 1;
    $(P.fprev).hidden = first;
    if (!first) $(P.fprev).textContent = k > 0 ? `‹ ${pagerTitle(secs[k - 1])}` : '‹ Contents';
    $(P.fnext).hidden = k === secs.length - 1;
    if (k < secs.length - 1) $(P.fnext).textContent = `${pagerTitle(secs[k + 1])} ›`;
  }
  body.scrollTop = 0;
}

function helpPagerInit() { pagerInit(HELP_PAGER); }
/** Show one page of the How to play: 'hs-top' is the contents, any other id one section. */
function helpPage(id) { pagerShow(HELP_PAGER, id); }

/* ------------------------------------------------------------------ the Lore guide (main menu) */

/**
 * The Lore guide (#screen-lore): the colony's archive of the story (LORE.md), a page at a time like the How to play.
 * Its pictures are fetched the first time it opens (data-src), all at once, so the service worker keeps them for
 * offline play from then on. A phone's Back button closes it: opening adds an entry to the history, closing takes it back.
 */
function openLore() {
  const scr = $('screen-lore');
  for (const img of scr.querySelectorAll('img[data-src]')) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
  scr.hidden = false;
  pagerShow(LORE_PAGER, pagerSections(LORE_PAGER)[0].id);
  try { history.pushState({ lore: 1 }, ''); } catch (e) { /* no history to add to (a sandboxed frame) */ }
}

function closeLore(fromBack) {
  if ($('screen-lore').hidden) return;
  $('screen-lore').hidden = true;
  if (!fromBack) try { if (history.state && history.state.lore) history.back(); } catch (e) { /* as above */ }
}

function initLore() {
  pagerInit(LORE_PAGER);
  $('m-lore').onclick = () => { sfx('click'); openLore(); };
  $('lr-close').onclick = () => { sfx('click'); closeLore(); };
  // The first page's list of contents, and links between pages.
  $('screen-lore').addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('[data-lore]');
    if (!a) return;
    e.preventDefault();
    pagerShow(LORE_PAGER, a.dataset.lore);
  });
  // ← and → turn the pages (a picker keeps its own arrows); Esc closes it (initMenu).
  $('screen-lore').addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || (e.target && e.target.tagName === 'SELECT')) return;
    const b = e.key === 'ArrowRight' ? $(LORE_PAGER.next) : e.key === 'ArrowLeft' ? $(LORE_PAGER.prev) : null;
    if (!b) return;
    e.preventDefault();
    if (!b.disabled) b.click();
  });
  window.addEventListener('popstate', () => { if (!UI.inGame) closeLore(true); });
}

/**
 * How to play under a finger: the Touch controls card heads the contents page, so the controls are on one screen
 * (the rest is the whole game, chapter by chapter, behind the contents). Brackets that only name keys ("(Q)",
 * "(or press Y)", "; T)") are marked once, at start-up before the pager is built (helpMarkKeys), so style.css can
 * leave them out on a touch screen along with the mouse and keyboard paragraphs.
 */
function helpMarkKeys() {
  const body = document.querySelector('#screen-help .help-body'), K = '<kbd>[^<]*</kbd>';
  body.innerHTML = body.innerHTML
    .replace(new RegExp(` ?\\((?:or press |press |or )?${K}(?:\\s*(?:–|-|\\+|/|,|or|and)?\\s*${K})*\\)`, 'g'), '<span class="keys">$&</span>')
    .replace(new RegExp(`; ${K}(?:\\s*${K})*(?=\\))`, 'g'), '<span class="keys">$&</span>')
    .replace(new RegExp(`, (?:${K}\\s*)+(?=;)`, 'g'), '<span class="keys">$&</span>');
}
function helpForTouch() {
  $('h-touch').hidden = !onTouch();
}

function showGameOver() {
  UI.overShown = true;
  clearSave();
  UI.overNew = null; UI.overMenu = null;
  $('o-new').textContent = 'New game'; $('o-menu').textContent = 'Main menu';
  $('o-code').hidden = true;
  $('o-log').hidden = true;
  if (S.mission) { showMissionOver(); return; }
  const won = S.winner === ME || allies(S.winner, ME), how = S.endHow || 'capture', many = S.players.length > 2;
  const The = S.players[S.winner] ? playerName(S.winner) : 'The rival'; // (its callsign; a person, in multiplayer: by name)
  // The narrator's last line (LORE.md): the region secured, or the command core lost.
  // (lost while the colony stands: on the Uplinks another colony speaks for the planet; else, settlement priority)
  $('o-log').textContent = won ? NARRATOR[how === 'domination' || how === 'uplinks' ? how : 'victory'] : NARRATOR[S.players[ME].out ? 'defeat' : how === 'uplinks' ? 'uplinksLost' : 'outranked'];
  $('o-log').hidden = false;
  sfx(won ? 'win' : 'lose');
  $('o-title').textContent = won ? (how === 'domination' ? 'Domination!' : how === 'uplinks' ? 'Uplinks held!' : 'Victory!') : 'Defeat';
  $('o-text').textContent = won
    ? (how === 'domination' ? `You held most of the planet's land for ${DOM.hold / 60} minutes. The planet is yours.`
      : how === 'uplinks' ? `You led on the Uplinks for ${UPLINK.hold / 60} minutes. The planet is yours.`
      : how === 'surrender' ? (many ? 'The last rival surrendered: the planet is yours.' : `${playerName(S.players.findIndex((P, k) => k !== ME))} surrendered. The planet is yours.`)
      : how === 'nuke' ? (many ? 'Your nuclear missile destroyed the last rival Command Base. The planet is yours.' : `Your nuclear missile destroyed ${playerName(S.players.findIndex((P, k) => k !== ME))}'s Command Base. The planet is yours.`)
        : many ? `${S.players.length > 3 ? 'All three' : 'Both'} rival Command Bases are yours: the last colony standing. The planet is yours.` : `Your warbots captured ${playerName(S.players.findIndex((P, k) => k !== ME))}'s Command Base. The planet is yours.`)
    : how === 'domination' ? `${The} held most of the planet's land for ${DOM.hold / 60} minutes. Regroup and try again.`
      : how === 'uplinks' ? `${The} led on the Uplinks for ${UPLINK.hold / 60} minutes. Regroup and try again.`
      : `${The} ${S.players[ME].out ? (how === 'nuke' ? 'destroyed your Command Base with a nuclear missile' : 'captured your Command Base') : 'took the planet'}. Regroup and try again.`;
  if (S.teams) $('o-text').textContent = won ? `Your team took ${how === 'surrender' ? 'the planet (the last of them surrendered)' : 'both rival Command Bases'}: the planet is yours${S.players[ME].out ? ', though your own colony fell on the way' : ''}.`
    : `The rival team ${S.players[ME].out ? (how === 'nuke' ? 'destroyed your Command Base with a nuclear missile' : 'captured your Command Base') : 'took the planet'}. Regroup and try again.`;
  const st = S.players[ME].stats;
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

/** The planet and rules of a mission at difficulty diff, in a line: mode, map type, size, terrain, rival, extras, clock. */
function missionMeta(def, diff) {
  const size = SIZE_PRESETS[def.size].name, terr = TERRAIN_PRESETS[def.rough].name, shape = (SHAPE_PRESETS[def.shape || 0] || SHAPE_PRESETS[0]).name;
  const limit = def.limit[diff] ? ` · ${def.limit[diff]} min limit` : '';
  // What the mission switches on that missions otherwise leave out.
  const extras = [def.mode === 'colony' && def.war && 'Warbots', def.wildlife && 'The Murmur', def.events && 'Planet events', def.nuke && 'Nuclear race', def.lab && 'Research Lab'].filter(Boolean);
  const more = extras.length ? ` · ${extras.join(', ')}` : '';
  if (def.mode === 'colony') return `Colony · ${shape} · ${size} · ${terr}${more}${limit}`;
  const n = playerCount('versus', def.shape || 0, def.players) - 1, style = isDoctrine(def.style) ? ` ${PERSONALITIES[def.style].name}` : '';
  const rival = `${n > 1 ? n + ' ' : ''}${DIFFICULTY[def.rival[diff]].label}${style} rival${n > 1 ? 's' : ''}${def.passive && def.passive[diff] ? ' (passive)' : ''}`;
  return `Versus · ${shape} · ${size} · ${terr} · ${rival}${more}${limit}`;
}

function renderMissions(msg) {
  const c = loadCampaign();
  const body = $('ms-body');
  $('ms-foot').hidden = UI.msSel == null; // (Start sits below the scrolling part, so it's on screen however long the brief)
  if (UI.msSel == null) {
    // (The next to play: the first not yet finished at any difficulty. In order, they teach the whole game.)
    const next = MISSIONS.findIndex((m) => !(c.done[m.id] || []).some(Boolean));
    let chapter = '';
    body.innerHTML = `<p class="desc">${MISSIONS.length} missions, each with its own goals and three difficulty levels. Play them in order to learn the game, or pick any.</p>
      <div class="ms-list">${MISSIONS.map((m, k) => {
        const done = c.done[m.id] || [];
        const marks = MISSION_DIFF_NAMES.map((n, d) => (done[d] ? `<span class="ms-done">${n} ✓</span>` : '')).filter(Boolean).join(' ');
        const head = m.chapter && m.chapter !== chapter ? `<div class="section-label ms-chapter">${(chapter = m.chapter)}</div>` : '';
        return `${head}<button class="ms-item${k === next ? ' next' : ''}" data-k="${k}"><span class="ms-num">${k + 1}</span>
          <span class="ms-name">${m.name}</span><span class="ms-meta">${marks || (k === next ? '<b class="ms-up">Next up</b> · ' : '') + (m.mode === 'colony' ? 'Colony' : 'Versus')}</span></button>`;
      }).join('')}</div>${msg ? `<p class="hint">${msg}</p>` : ''}`;
    for (const el of body.querySelectorAll('.ms-item')) el.onclick = () => { sfx('click'); UI.msSel = +el.dataset.k; UI.msDiff = UI.msDiff ?? 1; renderMissions(); };
    return;
  }
  const k = UI.msSel, def = MISSIONS[k], diff = UI.msDiff ?? 1;
  const done = c.done[def.id] || [];
  body.innerHTML = `<p class="hint" style="margin-top:6px">Mission ${k + 1} of ${MISSIONS.length}</p>
    <h3 style="margin:2px 0 6px;font-size:20px">${def.name}</h3>${def.chapter ? `<p class="hint" style="margin:0 0 4px">${def.chapter}</p>` : ''}
    <p class="desc">${def.brief}</p>
    <div class="section-label" style="margin-top:12px">Difficulty</div>
    <div class="seg" id="ms-diff">${MISSION_DIFF_NAMES.map((n, d) => `<button data-d="${d}" class="${d === diff ? 'on' : ''}">${n}${done[d] ? ' ✓' : ''}</button>`).join('')}</div>
    <p class="hint">${missionMeta(def, diff)}</p>
    <div class="section-label" style="margin-top:12px">Goals</div>
    <ul class="ms-goals">${def.goals.map((g) => `<li>${goalText(g, diff)}</li>`).join('')}</ul>`;
  for (const btn of $('ms-diff').children) btn.onclick = () => { UI.msDiff = +btn.dataset.d; sfx('click'); renderMissions(); };
  $('ms-start').onclick = () => { audioUnlock(); startMission(k, diff); };
}

/** A goal's description without a game running (for the mission briefing). */
function goalText(g, diff) { return goalLabel(g, goalNeed(g, diff)); }

function startMission(k, diff) {
  clearSave();
  $('screen-missions').hidden = true;
  newGame(missionOptions(k, diff));
  enterGame();
  updateHUD();
  placeMinimap();
  UI.objCollapsed = false;
  UI.msDone = null;
  // The briefing card: the brief, the mission's own pointers, and how to start on the first goal.
  const def = MISSIONS[k];
  $('br-title').textContent = `Mission ${k + 1}: ${def.name}`;
  S.msgs.length = 0;
  // (The card shows plain text: a <b> in the brief or an intro line would show as typed.)
  postMsg(ME, plainHint(def.brief), 0, 0, 'info');
  for (const line of def.intro || []) postMsg(ME, plainHint(line), 0, 0, 'info');
  const g0 = def.goals[0];
  if (g0 && g0.hint) postMsg(ME, `First: ${goalText(g0, diff)}. ${plainHint(g0.hint)}`, 0, 0, 'good');
  showBriefing();
}

/** A hint as plain text (for messages, which show text, not markup). */
function plainHint(h) { return String(h || '').replace(/<[^>]+>/g, ''); }

/**
 * The hint for goal i (the next to do): its own, or, for a building whose site is already going up, to wait for it; for
 * capturing the rival Command Base while other goals are open, to finish them first (the capture lock).
 */
function missionHint(def, M, states, i) {
  const g = def.goals[i];
  if (!g) return '';
  if (g.kind === 'capture' && def.goals.some((x, k) => x.kind !== 'capture' && !states[k].done)) return '<b>Finish your other goals first:</b> until then the rival Command Base holds at 1 armor.';
  const sites = goalSites(g, M.diff), name = sites.length && BDEFS[g.type].name, noRoad = sites.some(siteNeedsRoad);
  if (sites.length && !noRoad && g.wait) return g.wait;
  if (noRoad) return `Your <b>${name}</b> site has no road to storage, so Haulers can't bring its materials: tap it → <b>Lay road</b> (<kbd>R</kbd>).`;
  if (sites.length > 1) return `Your ${sites.length} <b>${name}</b> sites are going up: Haulers bring their materials, then Workers build them. Tap one to see how it's doing; <b>1×</b> (<kbd>]</kbd>) speeds time up.`;
  if (sites.length) return `Your <b>${name}</b> is going up: Haulers bring its materials, then a Worker builds it. Tap it to see how it's doing; <b>1×</b> (<kbd>]</kbd>) speeds time up.`;
  return g.hint || '';
}

/** The mission goal to do next: the first not done yet (or -1). */
function missionGoalNow(states) { return states.findIndex((s) => !s.done); }

/**
 * Tutorial pointers while a mission runs (a few times a second, from uiTick): the buttons the next goal needs light
 * up (its `ui` selector), and each goal met is ticked off with a message and the next one's hint.
 */
function missionCoach() {
  const M = S && S.mission, def = M && missionDef(M);
  let sel = '';
  if (def && !M.result && S.winner < 0) {
    const states = missionStates(M), now = missionGoalNow(states);
    if (UI.msDone && UI.msDone.length === states.length) {
      for (let i = 0; i < states.length; i++) {
        if (!states[i].done || UI.msDone[i]) continue;
        sfx('complete');
        const h = now >= 0 ? missionHint(def, M, states, now) : '';
        toast(`✓ ${states[i].text}.${h ? ' Next: ' + plainHint(h) : ''}`, 'good');
      }
    }
    UI.msDone = states.map((x) => x.done);
    if (now >= 0) {
      // (Its site already going up: nothing to press but the goal's own buttons on the site's panel, if any; with no
      // road to it, its Lay road. See missionHint.)
      const g = def.goals[now], sites = goalSites(g, M.diff), lone = sites.find(siteNeedsRoad);
      const onSite = (g.ui || '').split(',').filter((p) => /#sh-/.test(p) && !/#sh-layroad/.test(p)).join(',');
      const c = lone ? coachTarget({ ui: '#sh-layroad', site: lone }) : sites.length ? coachTarget({ ...g, ui: onSite, site: sites[0] }) : coachTarget(g);
      sel = c.sel;
      // A panel button whose panel isn't open: a ring pulses on the building to tap (every 1.5 s of game time).
      // (A later time than now is from an earlier game this session: ring again at once.)
      if (c.ring && (S.time - (UI.coachRingT ?? -9) >= 1.5 || S.time < UI.coachRingT)) {
        UI.coachRingT = S.time;
        addFx('ring', c.ring.x + 0.5, c.ring.y + 0.5, { color: '#38d4ff', r: 1.6, life: 1.1 });
      }
    }
  }
  if (sel !== UI.glowSel) { for (const el of document.querySelectorAll('.tut-glow')) el.classList.remove('tut-glow'); UI.glowSel = sel; }
  // (Panels and menus rebuild their buttons, so the light goes back on each time.)
  if (sel) { try { for (const el of document.querySelectorAll(sel)) el.classList.add('tut-glow'); } catch (e) { UI.glowSel = ''; } }
  coachScroll(sel);
}

/**
 * A lit button below the fold of an open panel (Order bots, low on the Bot Foundry's, say) is scrolled into sight, once
 * for each goal and panel: after that the panel scrolls as the player likes.
 */
function coachScroll(sel) {
  const box = $('sheet');
  if (!sel || box.hidden) { if (box.hidden) UI.coachScrolled = null; return; }
  const key = `${sel}|${UI.sheetKind}|${UI.sheetFor}`;
  if (UI.coachScrolled === key) return;
  const lit = [...box.querySelectorAll('.tut-glow')].filter((el) => el.getClientRects().length);
  if (!lit.length) return;
  UI.coachScrolled = key;
  const r0 = box.getBoundingClientRect(), seen = (el) => { const r = el.getBoundingClientRect(); return r.top >= r0.top && r.bottom <= Math.min(r0.bottom, innerHeight); };
  if (!lit.some(seen)) lit[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/** Where a goal's `ui` selector looks for the button that opens it (when the button itself isn't on screen). */
const COACH_OPENERS = [[/\.bcard|#build-tabs/, '#btn-build'], [/#banner-/, '#btn-road'], [/#ar-/, '#btn-attack']];

/**
 * What to light up for goal g: its `ui` buttons if any is on screen; else the buttons that open the way to them (Build
 * for a card or tab of the build menu, Paths for the Paths banner, Army for the Army menu). A panel button (#sh-…)
 * that isn't on screen also gives `ring`: the building to tap (see coachBuilding). { sel, ring }
 */
function coachTarget(g) {
  const sel = g.ui || '';
  if (!sel) return { sel: '', ring: null };
  // (Placing the building the goal's card is for: what's left is a spot on the map, then Build here once it shows.
  // Build, the tab and the card are done with: lit, they'd call the player back to the menu.)
  if (R.mode === 'place' && sel.split(',').some((p) => (p.match(/\.bcard\[data-t=['"]?(\w+)/) || [])[1] === UI.placeType)) {
    const rest = sel.split(',').filter((p) => !/\.bcard|#build-tabs|#btn-build|#banner-ok/.test(p));
    return { sel: [...rest, '#banner-ok'].join(','), ring: null };
  }
  const c = coachTargetAll(g, sel);
  let left = coachLeft(c.sel);
  // (In Paths with a sketch drawn, for a goal done there: its Build makes the sketch real.)
  if (R.mode === 'road' && /#btn-road|#banner-/.test(sel) && !/#banner-ok/.test(left) && !$('banner-ok').hidden) left = left ? `${left}, #banner-ok` : '#banner-ok';
  return { sel: left, ring: c.ring };
}

/**
 * A selector less the steps already taken: the button that opened the menu or mode on screen (Build while the Build
 * menu is open, Paths in Paths, Army in its menu or in attack mode: tapped again, it would close them) and a Build tab
 * already picked.
 */
function coachLeft(sel) {
  return sel.split(',').filter((p) => {
    const q = p.trim(), tab = q.match(/^#build-tabs \[data-g=['"]?(\w+)/);
    if (q === '#btn-build') return UI.sheetKind !== 'build';
    if (q === '#btn-road') return R.mode !== 'road';
    if (q === '#btn-attack') return UI.sheetKind !== 'army' && R.mode !== 'attack';
    if (tab && UI.sheetKind === 'build' && $('build-tabs')) { const b = $('build-tabs').querySelector(`[data-g="${tab[1]}"]`); return !(b && b.classList.contains('on')); }
    return true;
  }).join(',');
}

function coachTargetAll(g, sel) {
  let els;
  try { els = [...document.querySelectorAll(sel)]; } catch (e) { return { sel: '', ring: null }; }
  // (The panel open is another building's, say the Quarry's when the goal means the spent Ore Mine's Dismantle: its
  // buttons don't light. The rest of the selector does, and the building the goal means gets the ring.)
  const shown = UI.sheetKind === 'bld' && getE(UI.sheetFor), want = shown && /#sh-/.test(sel) ? coachBuilding(g) : null;
  if (want && want.type !== shown.type) {
    const rest = sel.split(',').filter((p) => !/#sh-/.test(p)).join(',');
    return { sel: rest ? coachTarget({ ...g, ui: rest }).sel : '', ring: want };
  }
  if (els.some((el) => el.getClientRects().length > 0)) return { sel, ring: null };
  const open = [];
  let panel = false;
  for (const part of sel.split(',')) {
    for (const [re, opener] of COACH_OPENERS) if (re.test(part) && !open.includes(opener)) open.push(opener);
    // (A card on another tab of the open build menu: that tab.)
    const card = part.match(/\.bcard\[data-t=['"]?(\w+)/), grp = card && BUILD_GROUPS.find((gr) => gr.types.includes(card[1]));
    if (grp && !open.includes(`#build-tabs [data-g="${grp.key}"]`)) open.push(`#build-tabs [data-g="${grp.key}"]`);
    if (/#sh-/.test(part)) panel = true;
  }
  return { sel: open.join(', ') || sel, ring: panel ? coachBuilding(g) : null };
}

/**
 * The building a goal's panel button is on: the goal's `site` (that building) or `at` (a building type) if it gives one, else the building named
 * first in its hint ("Tap the Cement Works → Move"; a short name like "the Foundry" or "the Lab" counts too), yours
 * first, then anyone's (a rival Command Base to bomb). The first of that type, or null.
 */
function coachBuilding(g) {
  if (g.site) return g.site.dead ? null : g.site; // (a given building: see missionCoach)
  const live = S.buildings.filter((b) => !b.dead && BDEFS[b.type]);
  if (g.at) return live.find((b) => b.owner === ME && b.type === g.at) || live.find((b) => b.type === g.at) || null;
  const hint = plainHint(g.hint);
  if (!hint) return null;
  // Full names first ("the Bot Foundry"), then short ones after "the" or "a" ("the Foundry": not the verb in "Tap the").
  for (const short of [false, true]) for (const mineOnly of [true, false]) {
    let best = null, at = Infinity;
    for (const b of live) {
      if (mineOnly && b.owner !== ME) continue;
      const name = BDEFS[b.type].name, last = name.split(' ').pop();
      const k = !short ? hint.indexOf(name) : last !== name && /^[A-Z][a-z]{2,}$/.test(last) ? hint.search(new RegExp(`\\b(the|a|an|your) ${last}\\b`)) : -1;
      if (k >= 0 && k < at) { at = k; best = b; }
    }
    if (best) return best;
  }
  return null;
}

/** The goal banner during a mission: each goal with progress, and the clock if there's a limit. */
function missionObjectiveHTML() {
  const M = S.mission, def = missionDef(M);
  const states = missionStates(M);
  if (UI.objCollapsed) return `Mission ▸ ${states.filter((s) => s.done).length}/${states.length}`;
  const left = M.limit ? Math.max(0, M.limit - S.time) : 0, now = missionGoalNow(states);
  // (The capture lock: the rival Command Base holds at 1 armor until the other goals are done. See captureLocked.)
  const hint = now >= 0 && missionHint(def, M, states, now);
  return `<b>${def.name}</b>${M.limit ? ` · ${fmtTime(left)} left` : ''}<ul class="obj-goals">${states.map((s, i) =>
    `<li class="${s.done ? 'done' : i === now ? 'now' : ''}">${s.done ? '✓' : i === now ? '▸' : '○'} ${s.text}${s.need > 1 && !s.done ? ` (${s.have}/${s.need})` : ''}</li>`).join('')}</ul>${hint ? `<div class="obj-hint">${hint}</div>` : ''}`;
}

function showMissionOver() {
  finishMission();
  const M = S.mission, def = missionDef(M), states = missionStates(M), k = Math.max(0, MISSIONS.indexOf(def));
  const won = M.result === 'won';
  sfx(won ? 'win' : 'lose');
  $('o-title').textContent = won ? 'Mission complete' : 'Mission failed';
  $('o-text').textContent = won
    ? `${def.name} (${MISSION_DIFF_NAMES[M.diff]}) done in ${fmtTime(S.time)}.`
    : M.why === 'time' ? `${def.name}: time ran out before every goal was met.`
      : M.why === 'lander' ? `${def.name}: the rival captured your Command Base.` : `${def.name}: the game ended before every goal was met.`;
  $('o-stats').innerHTML = states.map((s) => { return `<span>${s.done ? '✓' : '✗'} ${s.text}</span><span>${s.need > 1 ? `${s.have}/${s.need}` : s.done ? 'Done' : '–'}</span>`; }).join('');
  if (won) {
    completeMission(k, M.diff);
    if (k + 1 < MISSIONS.length) {
      $('o-code').hidden = false;
      $('o-code').innerHTML = `Next up: mission ${k + 2}, <b style="font-size:inherit;letter-spacing:0;color:var(--text)">${MISSIONS[k + 1].name}</b>.`;
      $('o-new').textContent = 'Next mission';
      UI.overNew = () => startMission(k + 1, M.diff);
    } else {
      $('o-code').hidden = false;
      $('o-code').textContent = 'That was the last mission: the campaign is complete!';
      $('o-new').textContent = 'Play it again';
      UI.overNew = () => startMission(k, M.diff);
    }
  } else {
    $('o-new').textContent = 'Try again';
    UI.overNew = () => startMission(k, M.diff);
  }
  $('o-menu').textContent = 'Missions';
  UI.overMenu = () => { openMissions(); UI.msSel = won && k + 1 < MISSIONS.length ? k + 1 : k; UI.msDiff = M.diff; renderMissions(); };
  $('screen-over').hidden = false;
}

/* ------------------------------------------------------------------ statistics screen */

function openStats() {
  UI.stats = UI.stats || { good: 'alloy', type: null };
  UI.stats.econ = UI.stats.econ || 'output';
  UI.stats.mil = UI.stats.mil || 'army';
  $('screen-stats').hidden = false;
  renderStats();
}

function renderStats() {
  const H = S.hist || newHistory(S.players.length);
  const versus = S.mode !== 'colony';
  const P = S.players[ME], st = P.stats;
  const made = Object.values(P.made || {}).reduce((a, v) => a + v, 0);
  const tiles = [['Time', fmtTime(S.time)], ['Buildings built', st.built], ['Bots built', st.bots - (st.startBots || 0)],
    ['Goods produced', made.toLocaleString()], versus ? ['Rival buildings taken', st.captured] : ['Land claimed', Math.floor(landShare(ME) * 100) + '%'],
    ['Bots lost', st.lost]];
  const players = versus ? S.players.map((P) => P.id) : [0];
  const ser = (fn) => players.map((p) => ({ name: playerName(p), color: CHART.series[p], values: fn(H.p[p] || {}) }));
  const goodsList = GOODS.filter((g) => (warOn() || !WAR_GOODS.includes(g)) && (nukeOn() || !NUKE_GOODS.includes(g)));
  if (!goodsList.includes(UI.stats.good)) UI.stats.good = 'alloy';
  const use = usageByType(ME);
  const rows = Object.keys(use).map((k) => ({ key: k, label: BDEFS[k].name, note: use[k].n > 1 ? '×' + use[k].n : '', value: Math.round((use[k].use / use[k].up) * 100) }))
    .sort((a, b) => b.value - a.value);
  const botsSer = ser((h) => (h.civ || []).map((v, k) => v + ((h.war || [])[k] || 0)));
  // Economy and Military over time (series a save from before them lacks are padded at the start).
  const pad = (vals) => { const v = vals.slice(); while (v.length < H.t.length) v.unshift(null); return v; };
  const ECON = {
    output: { label: 'Output', sub: 'Goods made a minute: everything your colony gathers and makes.', fn: (h) => (h.made || []).map((v, k, a) => (k && v !== null && a[k - 1] !== null && H.t[k] > H.t[k - 1] ? Math.max(0, Math.round(((v - a[k - 1]) / (H.t[k] - H.t[k - 1])) * 60)) : null)) },
    blds: { label: 'Buildings', sub: 'Finished buildings that gather, make, store and move goods (not forts or guns).', fn: (h) => h.econ || [] },
    bots: { label: 'Workers and vehicles', sub: 'Every robot and vehicle that isn\'t a fighter: Workers, Haulers, trucks, trains, ships, planes.', fn: (h) => h.civ || [] },
  };
  const MIL = {
    army: { label: 'Army', sub: 'Warbots and the other fighters: Bulwarks, Torches, Strike Bombers.', fn: (h) => h.war || [] },
    def: { label: 'Defences', sub: 'Forts and guns: Outposts, Bunkers, Keeps, turrets, Mortar Pits, Silos and the rest.', fn: (h) => h.def || [] },
  };
  const war = warOn();
  if (!ECON[UI.stats.econ]) UI.stats.econ = 'output';
  if (!MIL[UI.stats.mil]) UI.stats.mil = 'army';
  const econSer = () => ser((h) => pad(ECON[UI.stats.econ].fn(h)));
  const milSer = () => ser((h) => pad(MIL[UI.stats.mil].fn(h)));
  const landSer = ser((h) => h.land || []);
  const goodSer = ser((h) => (h.goods && h.goods[UI.stats.good]) || []);
  $('st-body').innerHTML = `
    <div class="stat-tiles">${tiles.map(([k, v]) => `<div class="stat-tile"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <div class="chart-block"><h3>Bots</h3><p class="sub">Every bot you own, workers and warbots together. Drag across a chart to read it.</p>${chartLegend(botsSer)}<canvas class="chart" id="ch-bots"></canvas></div>
    <div class="chart-block"><h3>Land claimed</h3><p class="sub">Share of the land bots can reach.</p>${chartLegend(landSer)}<canvas class="chart" id="ch-land"></canvas></div>
    <div class="chart-block"><h3>Goods on hand</h3><p class="sub">In storage plus finished goods waiting in buildings.</p>
      <div class="pick-row" id="st-goods">${goodsList.map((g) => `<button data-g="${g}" class="${g === UI.stats.good ? 'on' : ''}"><i class="gi ${g}"></i>${GOOD[g].name}</button>`).join('')}</div>
      ${chartLegend(goodSer)}<canvas class="chart" id="ch-goods"></canvas></div>
    <div class="chart-block"><h3>Economy size</h3><p class="sub" id="st-econ-sub">${ECON[UI.stats.econ].sub}</p>
      <div class="pick-row" id="st-econ">${Object.keys(ECON).map((k) => `<button data-k="${k}" class="${k === UI.stats.econ ? 'on' : ''}">${ECON[k].label}</button>`).join('')}</div>
      ${chartLegend(econSer())}<canvas class="chart" id="ch-econ"></canvas></div>
    ${war ? `<div class="chart-block"><h3>Military size</h3><p class="sub" id="st-mil-sub">${MIL[UI.stats.mil].sub}</p>
      <div class="pick-row" id="st-mil">${Object.keys(MIL).map((k) => `<button data-k="${k}" class="${k === UI.stats.mil ? 'on' : ''}">${MIL[k].label}</button>`).join('')}</div>
      ${chartLegend(milSer())}<canvas class="chart" id="ch-mil"></canvas></div>` : ''}
    <div class="chart-block"><h3>How busy your buildings were</h3><p class="sub">Share of the time each kind of building was working, over the whole game.</p>
      <div id="st-bars">${barChartHTML(rows, null)}</div></div>`;
  const xs = H.t;
  lineChart($('ch-bots'), { xs, series: botsSer });
  lineChart($('ch-land'), { xs, series: landSer, unit: '%' });
  lineChart($('ch-goods'), { xs, series: goodSer });
  lineChart($('ch-econ'), { xs, series: econSer() });
  if (war) lineChart($('ch-mil'), { xs, series: milSer() });
  // The Economy and Military pickers: which measure each graph shows.
  for (const btn of $('st-econ').children) btn.onclick = () => {
    UI.stats.econ = btn.dataset.k; sfx('click');
    for (const b2 of $('st-econ').children) b2.classList.toggle('on', b2 === btn);
    $('st-econ-sub').textContent = ECON[UI.stats.econ].sub;
    lineChart($('ch-econ'), { xs, series: econSer() });
  };
  if (war) for (const btn of $('st-mil').children) btn.onclick = () => {
    UI.stats.mil = btn.dataset.k; sfx('click');
    for (const b2 of $('st-mil').children) b2.classList.toggle('on', b2 === btn);
    $('st-mil-sub').textContent = MIL[UI.stats.mil].sub;
    lineChart($('ch-mil'), { xs, series: milSer() });
  };
  for (const btn of $('st-goods').children) btn.onclick = () => {
    UI.stats.good = btn.dataset.g; sfx('click');
    for (const b2 of $('st-goods').children) b2.classList.toggle('on', b2 === btn);
    lineChart($('ch-goods'), { xs, series: ser((h) => (h.goods && h.goods[UI.stats.good]) || []) });
  };
}

/* ------------------------------------------------------------------ modes & banner */

function setMode(mode) {
  if (R.mode === 'road' && mode !== 'road') { dropDraft(); UI.routeGhost = null; } // a plan that was never built costs nothing
  R.mode = mode;
  for (const m of ['road', 'place', 'attack', 'aim', 'land', 'airdrop']) document.body.classList.toggle('mode-' + m, mode === m);
  document.body.classList.toggle('mode-on', mode !== 'normal'); // (any mode: on an upright phone its banner takes the bottom bar's place)
  if (mode !== 'aim') { R.aim = null; UI.aimSilo = 0; }
  if (mode !== 'aim' && mode !== 'land' && mode !== 'airdrop') R.aimHover = null;
  if (mode !== 'land') { R.landAt = null; UI.landFerry = 0; }
  if (mode !== 'airdrop') { R.dropAt = null; UI.dropPlane = 0; }
  if (mode !== 'attack') UI.armyCmd = null;
  R.ghost = null;
  R.overlay = null;
  R.ropeEnd = null;
  UI.ropeA = null;
  if (UI.pick) { UI.pick = 0; R.selected = 0; UI.selBot = 0; } // (a strike or shelling target picked by a finger and not confirmed)
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

/** Fill el with a button for each of your vehicles inside building b that pick() takes, opening its panel. */
function hereButtons(el, b, pick) {
  if (!el) return;
  const here = b.owner === ME ? S.bots.filter((u) => !u.dead && u.owner === ME && u.inside === b.id && pick(u)) : [];
  const key = here.map((u) => u.id).join(',');
  if (el.dataset.here === key) return;
  el.dataset.here = key;
  el.innerHTML = here.map((u) => `<button class="btn small" data-bot="${u.id}">${BOTS[u.type].name}${u.armored ? ' (armored)' : ''} ›</button>`).join('');
  for (const btn of el.querySelectorAll('button')) btn.onclick = () => { const u = getE(+btn.dataset.bot); if (u && !u.dead) { sfx('click'); openBotSheet(u); } };
}

/** The Port panel's ship sections: ships here, its ferry line, and a beach landing. */
function portSection(b) {
  let html = '<div class="section-label">Ships</div><div class="actions" id="sh-port-shipbtns"></div><p class="hint" id="sh-port-ships"></p>';
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
  const why = UI.landKind === 'port' ? foundPortBlocked(ME, f, i, j) : landingBlocked(ME, f, i, j);
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
  act(port ? 'foundPort' : 'landing', port ? [f.id, at.i, at.j] : [f.id, at.i, at.j, UI.landN], (why) => {
    if (why) { sfx('error'); showLandBanner(why); return; }
    sfx('order');
    toast(port ? 'The Ferry is loading the Port kit and Workers: it sails once they\'re aboard.' : 'Beach landing ordered: the warbots head for the Ferry, and it sails once they\'re aboard.', 'good');
    setMode('normal');
  });
}

/* ------------------------------------------------------------------ Airfields: Cargo Planes and air drops */

/** Your Cargo Planes based at Airfield b. */
function basePlanes(b) { return S.bots.filter((u) => !u.dead && u.owner === b.owner && BOTS[u.type].air && u.home === b.id); }

/** Your Strike Bombers, and the first that's parked, rearmed and free to fly a sortie (optionally: at `t`). */
function myBombers() { return S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].bomber); }
function readyBomber(t) { return myBombers().find((u) => !u.mission && !u.flight && !(u.rearmUntil > S.time) && planeBase(u) && u.inside === planeBase(u).id && (!t || !strikeBlocked(ME, u, t))) || null; }

/** Pick a target for bomber u on the map. */
function startStrike(u) {
  closeSheet(); setMode('strike'); UI.bomber = u.id;
  showBanner(`Tap an enemy building, or an enemy vehicle or robot out in the open: the <b>Strike Bomber</b> loads ${BOMBER.ammo} Ammo and ${BOMBER.fuel} Fuel (on top of its tank), flies out and drops its bomb, then comes home to rearm. It reaches ${planeReach(u)} tiles from its Airfield.`, null, 'Cancel');
}

/** A Cargo Plane parked at Airfield b with nothing to do, or null. */
function freePlane(b) { return basePlanes(b).find((u) => !BOTS[u.type].bomber && u.inside === b.id && !u.mission && !u.flight) || null; }

/** What a plane is doing, in a few words. */
function planeStatus(u) {
  if (BOTS[u.type].bomber) {
    const M = u.mission, tg = M && getE(M.target), what = tg ? (BDEFS[tg.type] ? `the ${BDEFS[tg.type].name}` : `a ${BOTS[tg.type].name}`) : 'its target';
    if (u.flight) return M && M.phase === 'out' ? `flying out to bomb ${what}` : 'flying home';
    if (M && M.phase === 'load') return u.rearmUntil > S.time ? `rearming (${Math.ceil(u.rearmUntil - S.time)} s), then off to bomb ${what}` : M.noAmmo ? `waiting for ${BOMBER.ammo} Ammo at its Airfield` : M.noFuel ? `waiting for ${M.noFuel} Fuel at its Airfield (a sortie takes ${BOMBER.fuel} on top of its tank)` : `loading its bomb for ${what}`;
    return u.rearmUntil > S.time ? `rearming (${Math.ceil(u.rearmUntil - S.time)} s)` : 'ready on the ground';
  }
  const M = u.mission, load = (m) => (m.kind === 'outpost' ? 'a Drop Outpost' : m.kind === 'supply' ? 'supplies' : `${m.n} ${m.n === 1 ? BOTS[m.kind].name : BOTS[m.kind].plural}`);
  if (u.flight) return M && M.phase === 'out' ? `flying out with ${load(M)}` : 'flying home';
  if (M && M.phase === 'load') {
    if (M.noFuel) return `waiting for ${M.noFuel} more Fuel at its Airfield to fly`;
    if (M.kind === 'warbot' || M.kind === 'worker') return `boarding ${BOTS[M.kind].plural}: ${ferryAboard(u).length} of ${M.n} aboard`;
    return `loading ${load(M)}`;
  }
  return `parked, Fuel ${Math.round(u.bat ?? 100)}%`;
}

/** A plane's fuel gauge (its tank, 0–100), as in its panel: a bar in the Fuel colour. */
function fuelGauge(u) {
  const pct = Math.round(clamp(u.bat ?? 100, 0, 100));
  return `<div class="bar battery"><div style="width:${pct}%;background:${pct < BATTERY.critical ? '#ff4d4d' : 'var(--g-fuel)'}"></div></div>`;
}

/**
 * Airfield b's Fuel: what it holds against what it keeps for its planes (AIRFIELD_FUEL), and about how many flights
 * that covers (typicalFlight: a round trip of AIR_TYPICAL tiles each way, a bomber's sortie charge on top).
 */
function airFuelText(b) {
  const have = Math.floor((b.stock.fuel || 0) - (b.res.fuel || 0)), planes = basePlanes(b);
  if (!planes.length) return `${have} Fuel here. Once a plane is based here it keeps ${AIRFIELD_FUEL} for it, and Tankers bring it.`;
  const per = (bomber) => { const ps = planes.filter((u) => !!BOTS[u.type].bomber === bomber); return ps.length ? ps.reduce((a, u) => a + typicalFlight(u), 0) / ps.length : 0; };
  const cargo = per(false), bomb = per(true), n = (f) => Math.floor(have / f + 1e-9);
  const covers = [cargo && `${n(cargo)} Cargo Plane flight${n(cargo) === 1 ? '' : 's'}`, bomb && `${n(bomb)} bomber sortie${n(bomb) === 1 ? '' : 's'}`].filter(Boolean).join(' or ');
  return `${have} of the ${AIRFIELD_FUEL} Fuel it keeps for its planes (Tankers bring it): about ${covers}, ${AIR_TYPICAL} tiles out and back.` +
    (cargo ? ` A Cargo Plane takes about ${Math.round(cargo)} Fuel a flight like that (one Fuel fills ${planeFill({ type: 'cargoplane' })}% of its tank).` : '') +
    (bomb ? ` A bomber sortie takes ${BOMBER.fuel} Fuel on top of its tank, and it can't take off without it.` : '');
}

/** The Airfield panel's sections: its Fuel, its planes, air drops, and the places it supplies by air. */
function airfieldSection(b) {
  const planes = basePlanes(b), f = freePlane(b);
  let html = '<div class="section-label">Fuel</div><div class="bar battery" id="sh-air-fbar"><div></div></div><p class="hint" id="sh-air-fuel"></p>';
  html += '<div class="section-label">Cargo Plane</div><p class="hint" id="sh-air-planes"></p><div id="sh-air-pgauge"></div>';
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
  if (!airSuppliable(b) || !b.built || b.owner !== ME || !S.buildings.some((o) => !o.dead && o.built && o.owner === ME && BDEFS[o.type].airfield)) return '';
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
  const why = airdropBlocked(ME, u, UI.dropKind, i, j);
  if (why) { sfx('error'); R.dropAt = null; showAirdropBanner(why); return; }
  if (R.dropAt && R.dropAt.i === i && R.dropAt.j === j) { confirmAirdrop(); return; }
  R.dropAt = { i, j };
  sfx('click');
  showAirdropBanner();
}

function confirmAirdrop() {
  const u = getE(UI.dropPlane), at = R.dropAt;
  if (!u || !at) return;
  const kind = UI.dropKind;
  act('airdrop', [u.id, kind, at.i, at.j], (why) => {
    if (why) { sfx('error'); showAirdropBanner(why); return; }
    sfx('order');
    toast(kind === 'outpost' ? 'Drop Outpost loading: the plane takes off in a moment.' : `The ${BOTS[kind].plural} head for the Airfield: the plane takes off once they're aboard.`, 'good');
    setMode('normal');
  });
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
    const t = missileTargetAt(ME, R.aim.i, R.aim.j);
    html += t ? `Fire at the ${playerName(t.owner)} <b>${BDEFS[t.type].name}</b>? ${BDEFS[t.type].mil ? 'Its armor drops to almost nothing, ready for warbots to capture.' : 'A hit wrecks it.'}`
      : 'Fire at this spot? The blast hurts rival buildings and bots within ' + md.splash + ' tiles.';
    if (onTouch()) html += ' Drag the crosshair to move it.';
    ok = 'Fire';
  } else {
    const w = silo.stock.warhead || 0;
    html += `Tap where to fire, inside the red ring (${md.range} tiles). A hit wrecks most buildings; the blast hurts everything rival within ${md.splash} tiles. <b>${w}</b> Missile${w === 1 ? '' : 's'} loaded.`;
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
  const { i, j } = R.aim, sid = silo.id;
  if (BDEFS[silo.type].nukeSilo) {
    act('nukeAt', [sid, i, j], (ok) => {
      if (ok) { setMode('normal'); sfx('alert'); return; }
      const s = getE(sid);
      sfx('error'); showAimBanner(s ? nukeBlocked(s, i, j) : 'That Silo is gone.');
    });
    return;
  }
  const t = missileTargetAt(ME, i, j), tName = t ? BDEFS[t.type].name : '';
  act('missileAt', [sid, i, j], (ok) => {
    if (ok) {
      toast(tName ? `Missile away: it will hit the ${tName} in a few seconds.` : 'Missile away.', 'info');
      setMode('normal');
      return;
    }
    const s = getE(sid);
    sfx('error'); showAimBanner(s ? missileBlocked(s, i, j) : 'That Silo is gone.');
  });
}

/** Under a finger: the target of a bomber's strike or a Howitzer's shelling, picked by a tap and ringed, waiting for the banner's button (confirmBanner). */
function pickTarget(t, html, okLabel) {
  UI.pick = t.id;
  if (BDEFS[t.type]) { R.selected = t.id; UI.selBot = 0; } else { UI.selBot = t.id; R.selected = 0; }
  sfx('click');
  showBanner(html, okLabel, 'Cancel');
}

/** Send the bomber being given a target (UI.bomber) at t. */
function strikePicked(t) {
  const u = getE(UI.bomber);
  if (!u || u.dead) { sfx('error'); showBanner('<span class="err">That bomber is gone.</span>', null, 'Cancel'); return; }
  if (!t || t.dead) { sfx('error'); UI.pick = 0; showBanner('<span class="err">That target is gone: tap another.</span>', null, 'Cancel'); return; }
  const tName = BDEFS[t.type] ? `the ${BDEFS[t.type].name}` : `a ${BOTS[t.type].name}`;
  act('strike', [u.id, t.id], (why) => {
    if (why) { sfx('error'); showBanner(`<span class="err">${why}</span>`, null, 'Cancel'); return; }
    sfx('order'); setMode('normal');
    toast(`Strike ordered on ${tName}: the bomber loads up and takes off.`, 'good');
  });
}

function showBanner(html, okLabel, cancelLabel) {
  $('banner').hidden = false;
  $('banner-seg').hidden = true;
  $('banner-traffic').hidden = true;
  $('banner-route').hidden = true;
  $('banner-undo').hidden = true;
  $('banner-clear').hidden = true;
  $('banner-ok').disabled = false;
  $('banner').classList.remove('noplan');
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
    : `Tap a highlighted spot to place ${/^[AEIOU]/i.test(BDEFS[type].name) ? 'an' : 'a'} <b>${BDEFS[type].name}</b>.`, null, 'Cancel');
  if (!R.overlay.valid.some((v) => v)) {
    const near = BDEFS[type].gather ? ' near the right resource' : BDEFS[type].farm ? ' near fertile soil' : BDEFS[type].pump ? ' on an oil seep' : '';
    const how = DEFENCE_TYPES.has(type) ? `inside your border${near}. Defences only go on your own land: an Outpost or Keep extends it.` : `within ${BUILD_REACH} tiles of your buildings, roads or track${near}. Lay a road out toward where you want it.`;
    showBanner(`<span class="err">There is no valid spot for ${aOrAn(BDEFS[type].name)} ${how}</span>`, null, 'Close');
  }
}

/** The Army banner: what to tap, and Recall all when warbots are out in the field. */
function showArmyBanner(note) {
  if (UI.armyCmd) { showArmyCmdBanner(note); return; }
  const out = warbotsOut(ME), k = S.players[ME].keepW ?? 0;
  showBanner('Tap a <b>rival building</b> to attack it with warbots or missiles, or tap open ground to send warbots there to <b>hold the area</b>.' +
    (out ? ` ${out} warbot${out > 1 ? 's are' : ' is'} out in the field: <b>Recall all</b> brings them home.` : '') +
    `<span class="keep-all">Every Outpost keeps <span class="seg">${[0, 1, 2, 5].map((v) => `<button data-k="${v}" class="${v === k ? 'on' : ''}">${v}</button>`).join('')}</span> warbot${k === 1 ? '' : 's'}, sent from your Command Base</span>`,
    out ? (recallArmed() ? `Tap again: ${out} come home` : 'Recall all') : null, 'Cancel');
  $('banner-ok').classList.toggle('danger', !!(out && recallArmed()));
  for (const btn of $('banner-text').querySelectorAll('[data-k]')) btn.onclick = (e) => { e.stopPropagation(); setKeepAll(+btn.dataset.k); showArmyBanner(); };
}

/** Every Outpost keeps v warbots at home (each one's own setting is reset to follow this). */
function setKeepAll(v) {
  act('keepWAll', [v]);
  sfx('click');
  toast(v === 0 ? 'Outposts keep no warbots now: your warbots stay at the Command Base unless you station some at an Outpost.'
    : `Every Outpost now keeps ${v} warbot${v === 1 ? '' : 's'}, sent from your Command Base (and replaced if lost).`, 'info');
}

/**
 * Recall all (the Army panel, or the Army banner), under a finger: the first tap arms it (the button says how many
 * come home), a second within three seconds does it, like Demolish. It ends every attack and rally at once and
 * sits where a thumb rests. A mouse click, Enter and the C key recall straight away.
 */
const RECALL_ARM = 3000;
function recallArmed() { return !!UI.recallArm && performance.now() - UI.recallArm < RECALL_ARM; }
function recallAllTap() {
  const refresh = () => { if (UI.sheetKind === 'army') { UI.armySig = ''; refreshArmySheet(); } if (R.mode === 'attack' && !UI.armyCmd) showArmyBanner(); };
  if (!onTouch() || recallArmed()) { UI.recallArm = 0; recallAllWarbots(); refresh(); return; }
  UI.recallArm = performance.now();
  sfx('click');
  refresh();
  setTimeout(() => { if (UI.recallArm && !recallArmed()) { UI.recallArm = 0; refresh(); } }, RECALL_ARM);
}

/** Bring every warbot in the field home to its garrison. */
function recallAllWarbots() {
  act('recallAll', [], (n) => {
    if (n) { sfx('order'); toast(`Recalled ${n} warbot${n > 1 ? 's' : ''}: they're heading back to their garrisons.`, 'info'); }
    else { sfx('error'); toast('No warbots are out in the field.', 'info'); }
  });
  if (R.mode === 'attack') setMode('normal');
}

function confirmBanner() {
  if (R.mode === 'aim') { fireAimed(); return; }
  if (R.mode === 'strike' && UI.pick) { strikePicked(getE(UI.pick)); return; }
  if (R.mode === 'bombard' && UI.pick) {
    const u = getE(UI.rocket), b = getE(UI.pick);
    if (!u || u.dead || !b || !rocketTarget(u, b)) { sfx('error'); UI.pick = 0; showBanner('<span class="err">That target is gone.</span> Tap an enemy building.', null, 'Cancel'); return; }
    act('bombard', [[u.id], b.id]);
    toast(`The Howitzer is off to shell the ${BDEFS[b.type].name}.`, 'info');
    sfx('order'); addFx('ring', b.x + 0.5, b.y + 0.5, { color: '#ff5a6e' });
    setMode('normal');
    return;
  }
  if (R.mode === 'land') { confirmLanding(); return; }
  if (R.mode === 'airdrop') { confirmAirdrop(); return; }
  if (R.mode === 'attack') { if (UI.armyCmd) { setMode('normal'); openArmySheet(); } else recallAllTap(); return; }
  if (R.mode === 'road') { commitDraft(); return; }
  if (R.mode === 'place' && (UI.placeType === 'ropeway' || UI.placeType === 'viaduct')) {
    const A = UI.ropeA, E = R.ropeEnd;
    if (!A || !E || !E.ok) return;
    act('link', [UI.placeType === 'viaduct' ? 'viaduct' : 'ropeway', A.i, A.j, E.i, E.j], (res) => {
      if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
      sfx('place');
      addFx('ring', A.i + 0.5, A.j + 0.5, { color: PLAYER_COLORS[ME] });
      setMode('normal');
    });
    return;
  }
  if (R.mode !== 'place' || !R.ghost || !R.ghost.ok) return;
  const { type, x, y } = R.ghost;
  const from = UI.moveFrom ? getE(UI.moveFrom) : null;
  act(from ? 'moveBuilding' : 'place', from ? [from.id, x, y] : [type, x, y], (res) => {
    if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
    if (from) toast(`Moving the ${BDEFS[type].name}: workers put it together here (no goods needed), and the old one keeps working until it's ready.`, 'good');
    UI.moveFrom = 0;
    sfx('place');
    addFx('ring', x + 0.5, y + 0.5, { color: PLAYER_COLORS[ME] });
    setMode('normal');
  });
}

/* ------------------------------------------------------------------ map taps */

/** Placing a Ropeway: the first tap picks the near station, the second the far end (tap it again to build). */
function ropewayTap(i, j) {
  if (!UI.ropeA) {
    const chk = canPlace(ME, 'ropeway', i, j);
    R.ghost = { type: 'ropeway', x: i, y: j, ok: chk.ok };
    if (!chk.ok) { sfx('error'); showBanner(`<span class="err">${chk.reason}</span>`, null, 'Cancel'); return; }
    UI.ropeA = { i, j };
    sfx('click');
    showBanner(`Now tap the <b>far end</b>: ${ROPE_MIN} to ${ROPE_MAX} tiles away, on ground no rival holds, across anything (cliffs, water, rock).`, null, 'Cancel');
    return;
  }
  const A = UI.ropeA;
  if (R.ropeEnd && R.ropeEnd.i === i && R.ropeEnd.j === j && R.ropeEnd.ok) { confirmBanner(); return; }
  const why = ropeEndBlocked(ME, A.i, A.j, i, j);
  R.ropeEnd = { i, j, ok: !why };
  if (why) { sfx('error'); showBanner(`<span class="err">${why}</span> Tap another far end.`, null, 'Cancel'); return; }
  const len = Math.round(dist(A.i, A.j, i, j));
  const rise = S.elev[tIdx(i, j)] - S.elev[tIdx(A.i, A.j)];
  showBanner(`A <b>Ropeway</b> ${len} tiles long${rise ? `, ${Math.abs(rise)} level${Math.abs(rise) > 1 ? 's' : ''} ${rise > 0 ? 'up' : 'down'}` : ''}? ${costInline(BDEFS.ropeway.cost, playerGoods(ME))}`, 'Build', 'Cancel');
}

/** Placing a Viaduct: the first tap picks the near end, the second the far end across the valley (tap it again to build). */
function viaductTap(i, j) {
  if (!UI.ropeA) {
    const chk = canPlace(ME, 'viaduct', i, j);
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
  const why = viaductBlocked(ME, A.i, A.j, i, j);
  R.ropeEnd = { i, j, ok: !why };
  if (why) { sfx('error'); showBanner(`<span class="err">${why}</span> Tap another far end.`, null, 'Cancel'); return; }
  const n = Math.abs(i - A.i) + Math.abs(j - A.j) - 1, cost = viaductCost(A.i, A.j, i, j);
  const rise = S.elev[tIdx(i, j)] - S.elev[tIdx(A.i, A.j)];
  showBanner(`A <b>Viaduct</b> spanning ${n} tile${n > 1 ? 's' : ''}${rise ? `, ${Math.abs(rise)} level${Math.abs(rise) > 1 ? 's' : ''} ${rise > 0 ? 'up' : 'down'} at the far end` : ''}? ${costInline(cost, playerGoods(ME))} (${canPay(ME, cost) ? 'paid now' : 'paid from storage as the goods come in'})`, 'Build', 'Cancel');
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
    let t = b && foes(b.owner, ME) ? b : null;
    if (!t) { let bd = 0.5; for (const v of S.bots) { if (v.dead || !foes(v.owner, ME) || v.inside || BOTS[v.type].air) continue; const d = dist2(v.x, v.y, wx, wy); if (d < bd) { bd = d; t = v; } } }
    if (!t) { sfx('error'); showBanner('<span class="err">Tap an enemy building, or an enemy vehicle or robot out in the open.</span>', null, 'Cancel'); return; }
    // Under a finger the target is picked first (ringed on the map) and the banner's Strike sends the bomber; a mouse click sends it at once.
    if (!INPUT.mouse) { pickTarget(t, `Strike ${BDEFS[t.type] ? `the ${playerName(t.owner)} <b>${BDEFS[t.type].name}</b>` : `this <b>${BOTS[t.type].name}</b>`}? The bomber loads up and takes off.`, 'Strike'); return; }
    strikePicked(t);
    return;
  }
  if (R.mode === 'fsail') {
    const f = getE(UI.ferry);
    if (!f || f.dead) { setMode('normal'); return; }
    act('sail', [f.id, i, j], (why) => {
      if (why) { sfx('error'); showBanner(`<span class="err">${why}</span>`, null, 'Cancel'); return; }
      sfx('order'); setMode('normal'); if (!f.dead) openBotSheet(f);
    });
    return;
  }
  // A Howitzer's orders from its panel: shell the enemy building tapped, or drive to the spot tapped.
  if (R.mode === 'bombard' || R.mode === 'rgo') {
    const u = getE(UI.rocket);
    if (!u || u.dead) { setMode('normal'); return; }
    if (R.mode === 'bombard') {
      const b = buildingAtTap(i, j, wx, wy);
      if (!b || !rocketTarget(u, b)) { sfx('error'); showBanner('<span class="err">Tap an enemy building.</span> The Howitzer drives to within ' + ROCKET.range + ' tiles of it, digs in and shells it.', null, 'Cancel'); return; }
      if (!INPUT.mouse) { pickTarget(b, `Shell the ${playerName(b.owner)} <b>${BDEFS[b.type].name}</b>? The Howitzer drives to within ${ROCKET.range} tiles of it, digs in and shells it.`, 'Bombard'); return; }
      act('bombard', [[u.id], b.id]);
      toast(`The Howitzer is off to shell the ${BDEFS[b.type].name}.`, 'info');
      sfx('order');
      addFx('ring', i + 0.5, j + 0.5, { color: '#ff5a6e' });
      setMode('normal');
      return;
    }
    act('park', [[u.id], i, j], (n) => {
      if (!n) { sfx('error'); showBanner('<span class="err">It can\'t drive there.</span> Tap open ground.', null, 'Cancel'); return; }
      sfx('order');
      addFx('ring', i + 0.5, j + 0.5, { color: '#7dffa0' });
      setMode('normal');
    });
    return;
  }
  if (R.mode === 'crawl') {
    const u = getE(UI.crawler);
    if (!u || u.dead) { setMode('normal'); return; }
    act('crawl', [u.id, i, j], (why) => {
      if (why) { sfx('error'); showBanner(`<span class="err">${why}</span> Tap somewhere else.`, null, 'Cancel'); return; }
      sfx('order');
      addFx('ring', i + 0.5, j + 0.5, { color: PLAYER_COLORS[ME] });
      setMode('normal');
      toast('The Crawler is on its way: it deploys when it gets there.', 'info');
    });
    return;
  }
  if (R.mode === 'place') {
    if (!inMap(i, j)) return;
    const type = UI.placeType;
    if (type === 'ropeway') { ropewayTap(i, j); return; }
    if (type === 'viaduct') { viaductTap(i, j); return; }
    if (R.ghost && R.ghost.x === i && R.ghost.y === j && R.ghost.ok) { confirmBanner(); return; }
    const chk = canPlace(ME, type, i, j);
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
        for (const c of S.buildings) if (!c.dead && c.owner === ME && BDEFS[c.type].work && dist2(c.x, c.y, i, j) <= def.burner.radius * def.burner.radius) n++;
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
      act('junction', [i, j], (r) => {
        switch (r.what) {
          case 'notYours': sfx('error'); showRoadBanner('That junction isn\'t yours: you can only change junctions in your own land.'); return;
          case 'overDown': sfx('click'); showRoadBanner('Overpass taken down: its Cement and Alloy are back.', true); return;
          case 'overOff': sfx('click'); showRoadBanner(`Planned overpass called off (nothing was spent on it yet)${r.lit ? '; the light is taken down and its Alloy is back' : ''}.`, true); return;
          case 'lightDown': sfx('click'); showRoadBanner(`Light taken down. ${r.why}`, true); return;
          case 'overUp': sfx('place'); addFx('ring', i + 0.5, j + 0.5, { color: '#ffd166' }); showRoadBanner('Overpass built: traffic flows through without stopping.', true); return;
          case 'overPlanned': { const P = junPlanAt(t); sfx('place'); showRoadBanner(`Overpass planned: it goes up once its ${P ? costText(junPlanCost(t, P)) : 'cost'} is paid for from storage (oldest plans first)${r.lit ? '; the light keeps working meanwhile' : ''}.`, true); return; }
          case 'error': sfx('error'); showRoadBanner(r.why); return;
          case 'lightUp': sfx('place'); addFx('ring', i + 0.5, j + 0.5, { color: '#7dffa0' }); showRoadBanner(); return;
          case 'lightPlanned': sfx('place'); showRoadBanner(`Traffic light planned: it goes up once its ${costText(LIGHT_COST)} is paid for from storage (oldest plans first).`, true); return;
          default: return;
        }
      });
      return;
    }
    if (UI.roadMode === 'pave') {
      // Mark a road for asphalt, or clear its mark.
      if (!paveMarkable(t)) { sfx('error'); showRoadBanner('Mark your own roads (or planned roads) for asphalt.'); return; }
      act('paveMark', [i, j, !S.paveMark[t]], () => showRoadBanner());
      sfx('click');
      return;
    }
    if (UI.roadMode === 'arrows') {
      // Turn the arrow: east, south, west, north, then back to two-way.
      if (S.road[t] && !roadOwnedBy(ME, t)) { sfx('error'); showRoadBanner('That road isn\'t yours: you can only change your own roads, or ones on land you hold.'); return; }
      // (Remembered as a stroke of the plan, so Undo turns it back.)
      if (S.road[t]) { if (!UI.draft) draftReset(); UI.draft.strokes.push([{ t, op: 'dir', from: S.road[t] }]); act('roadDir', [i, j, S.road[t] >= 5 ? 1 : S.road[t] + 1], () => showRoadBanner()); sfx('click'); }
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
        const chk = canPlace(ME, 'ramp', i, j);
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
      // Pipes: tap an Oil Pump to pipe it to the nearest Refinery, or something that burns Fuel to pipe it to
      // the nearest Fuel; tap a tile to add or drop pipe there, or tap laid pipe to take it up.
      const stroke = [], bb = S.bAt[t] && getE(S.bAt[t]);
      const fuelTap = bb && bb.owner === ME && bb.built && fuelUser(BDEFS[bb.type]);
      if (bb && bb.owner === ME && (BDEFS[bb.type].pump || fuelTap)) {
        const r = fuelTap ? pipeToFuel(ME, bb) : pipeToRefinery(ME, bb);
        if (r.why) { sfx('error'); showRoadBanner(r.why); return; }
        for (const u of r.tiles) if (!UI.draft.pipe.has(u)) draftOp(stroke, u, 'pipe');
        UI.draft.strokes.push(stroke);
        sfx('click');
        showRoadBanner(`Pipe ${fuelTap ? `Fuel to the ${BDEFS[bb.type].name}` : 'from the Oil Pump to the Refinery'}: ${r.tiles.length} tile${r.tiles.length === 1 ? '' : 's'}.`, true);
        return;
      }
      if (UI.draft.pipe.has(t)) draftOp(stroke, t, 'unpipe');
      else if (UI.draft.pipeDel.has(t)) draftOp(stroke, t, 'unpipedel');
      else if (S.pipe[t] === ME + 1 || S.pipePlan[t] === ME + 1) draftOp(stroke, t, 'pipedel');
      else { const why = pipeBlocked(ME, t); if (why) { sfx('error'); showRoadBanner(why); return; } draftOp(stroke, t, 'pipe'); }
      UI.draft.strokes.push(stroke);
      sfx('click');
      showRoadBanner();
      return;
    }
    if (routeOn()) { routeTap(i, j); return; }
    if (UI.roadMode === 'rail') {
      // Rail: a tap adds a tile of track or drops it; tapping laid track marks it to take up.
      const stroke = [];
      if (UI.draft.rail.has(t)) draftOp(stroke, t, 'unrail');
      else if (UI.draft.railDel.has(t)) draftOp(stroke, t, 'unraildel');
      else if (S.rail[t] && !roadOwnedBy(ME, t)) { sfx('error'); showRoadBanner('That track isn\'t yours: you can only take up your own track, or track on land you hold.'); return; }
      else if (S.rail[t] || S.railPlan[t] === ME + 1) draftOp(stroke, t, 'raildel');
      else if (S.bAt[t] && getE(S.bAt[t]).owner === ME && BDEFS[getE(S.bAt[t]).type].station) { showRoadBanner('Drag from this station to another: the track is laid beside each of them, and trains run between them.'); return; }
      else { const why = railBlocked(ME, t); if (why) { sfx('error'); showRoadBanner(why); return; } draftOp(stroke, t, 'rail'); }
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
        showRoadBanner(S.bAt[t] ? 'There is already a building here.' : canPlace(ME, next, i, j, true).reason);
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
    else if (S.road[t] && !roadOwnedBy(ME, t) && S.plan[t] !== 1) { sfx('error'); showRoadBanner('That road isn\'t yours: you can only take up your own roads, or ones on land you hold.'); return; }
    else if (S.road[t] || S.plan[t] === ME + 1) { draftOp(stroke, t, 'del'); note = S.plan[t] ? 'Planned tile marked to call off.' : 'Road marked to take up: its Cement comes back when you tap Build.'; }
    else if (canRoad(ME, i, j) || draftBridge(t)) {
      draftOp(stroke, t, 'add');
      if (crossTile(t)) note = `${CROSS[S.terrain[t]].name} tile: ${costText(crossCost(t))}${bridgeMul(t) > 1 ? ' (far from shore: bridges cost more out here)' : ''}.`;
      else if (roadClears(t)) note = `Workers will clear the ${RES[S.res[t]].name.toLowerCase()} (${ROAD_CLEAR}× Cement).`;
      else if (S.res[t] === R_OIL) note = 'The oil seep stays underground, under the road: take the road up later and you can still pump it.';
    } else { sfx('error'); showRoadBanner(S.owner[t] >= 0 && S.owner[t] !== ME ? 'A rival holds that ground: roads only run on yours or no-one\'s.' : crossTile(t) ? 'A bridge has to start from your shore, your road or the end of a bridge.' : 'Your bots can\'t reach there yet: it\'s across water or a cliff from your land.'); return; }
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
  if (R.mode === 'attack' && UI.armyCmd) { armyTap(UI.armyCmd, i, j, b); return; }
  if (R.mode === 'attack' && !rally) {
    if (b && b.owner !== ME) { setMode('normal'); openBuildingSheet(b); }
    else if (!b && inMap(i, j) && S.terrain[tIdx(i, j)] === T_GROUND) { setMode('normal'); openMoveSheet(i, j); }
    else { sfx('error'); showBanner(`<span class="err">Tap a rival building (${rivalColours()}) or open ground.</span>`, null, 'Cancel'); }
    return;
  }
  // Under a finger: with warbots selected and their bar showing, a tap on another of yours selects it and a tap
  // anywhere else is their order; with none selected, a tap on one of yours out in the open selects it.
  if (!INPUT.mouse && R.mode === 'normal') {
    const unit = unitAtTap(wx, wy);
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
      const bot = s.e, mine = bot.owner === ME && (isArmy(bot) || BOTS[bot.type].siege);
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
  if (inMap(i, j) && uplinkAt(tIdx(i, j))) { sfx('click'); openUplinkSheet(uplinkAt(tIdx(i, j))); return; }
  if (inMap(i, j) && S.res[tIdx(i, j)]) { sfx('click'); openResourceSheet(tIdx(i, j)); return; }
  if (inMap(i, j) && S.fert[tIdx(i, j)] && S.terrain[tIdx(i, j)] === T_GROUND) { sfx('click'); openSoilSheet(tIdx(i, j)); return; }
  if (inMap(i, j) && S.road[tIdx(i, j)] && wayOwner(tIdx(i, j)) === 0) { sfx('click'); openRoadSheet(tIdx(i, j)); return; }
  closeSheet();
}

/** With a mouse, placing a building previews it under the pointer; a click then places it. */
function onMapHover(i, j) {
  UI.hoverTile = inMap(i, j) ? tIdx(i, j) : -1;
  if (R.mode === 'road' && routeOn()) { routeHover(i, j); return; }
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
  for (const r of S.rallies) if (r.owner === ME && dist2(r.x + 0.1, r.y - 0.35, wx, wy) < 0.45) return r;
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
  return bridgeable(t) && !S.bAt[t] && !scorched(t) && bridgeHead(ME, t % S.W, (t / S.W) | 0, (u) => d.addSet.has(u) && bridgeable(u));
}

/** What a wall line puts on tile t: a Gate on a road or track (or a planned one), a Wall anywhere else. */
function wallKind(t) { return S.road[t] || S.plan[t] || S.rail[t] || (S.railPlan && S.railPlan[t]) || (UI.draft && UI.draft.rail.has(t)) ? 'gate' : 'wall'; }

/** Could a Wall or Gate (`kind`) go on tile t? (What it costs is checked for the whole plan.) */
function wallFits(t, kind) { return !S.bAt[t] && canPlace(ME, kind, t % S.W, (t / S.W) | 0, true).ok; }

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
    if (s[k].op === 'dir') { act('roadDir', [s[k].t % S.W, (s[k].t / S.W) | 0, s[k].from]); continue; } // an arrow turned back
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
    if (crossTile(t)) cross++; else if (roadClears(t)) clear++;
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
    short: Object.keys(net).filter((g) => net[g] > 0 && !canAffordRoad(ME, { [g]: net[g] })) };
}

/** Build the plan: take up the marked roads (their goods come back first), then plan the new tiles for workers to pave. */
function commitDraft() {
  if (draftEmpty()) return;
  const d = UI.draft;
  // The whole plan goes as one order (ORDERS.paths): take up, then Ramps first (so the road or track planned over one
  // waits for it), Walls and Gates, road, track and pipe; it's paid for from storage as far as it goes, oldest plans first.
  const plan = { del: [...d.del], railDel: [...d.railDel], ramps: [...d.ramps], walls: [...d.walls], add: [...d.add], rail: [...d.rail], pipeDel: [...d.pipeDel], pipe: [...d.pipe] };
  draftReset();
  act('paths', [plan], (r) => draftDone(r));
}

/** What the plan made in Paths came to (ORDERS.paths' counts): the messages, and back to the map if it all went down. */
function draftDone(r) {
  const { removed, laid, ramps, walls, gates, why, wallWhy, rampWhy, rails, railsUp, railWhy, pipes, pipesUp } = r;
  const wp = plansWaiting(ME), owedN = wp.tiles + wp.track + wp.pipes + wp.sites;
  // Built: Paths closes, straight back to the map (unless something went wrong, to fix it).
  if (!why && R.mode === 'road') setMode('normal');
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
  const ok = [t, p].filter((u) => canPlace(ME, 'ramp', u % S.W, (u / S.W) | 0).ok).sort((a, b) => busy(a) - busy(b));
  if (!ok.length) return 'nope';
  draftOp(stroke, ok[0], 'ramp');
  return 'ramp';
}

/**
 * Dragging: in Roads and Bridges it sketches new road along the drag (round resources; water and
 * rock only with Bridges), planning a Ramp wherever it climbs a one-level cliff. In Arrows each
 * road tile points the way the finger moved, at once. A drag that starts on planned road (or track) of yours and
 * goes on along it calls that plan off instead, tile by tile (see paintErase); one that leaves it for open ground
 * carries the road on from there as before.
 */
function onRoadPaint(i, j, first) {
  if (R.mode !== 'road' || UI.roadMode === 'lights' || UI.roadMode === 'ramp') return;
  if (!UI.draft) draftReset();
  if (first) {
    paintFlagsReset(); UI.stroke = []; UI.dirShown = 0; UI.draft.strokes.push(UI.stroke); UI.routeGhost = null;
    const t0 = inMap(i, j) ? tIdx(i, j) : -1;
    UI.paintStart = t0; UI.paintErase = t0 >= 0 && !routeOn() && planErasable(t0) ? null : false; UI.paintErased = 0;
  }
  const from = first || !UI.lastPaint ? { i, j } : UI.lastPaint;
  const line = tileLine(from.i, from.j, i, j);
  if (UI.roadMode === 'pipe') { pipeDrag(i, j, first); return; }
  if (routeOn()) { routeDrag(i, j, first); return; }
  // Pave: the first road tile of a drag decides whether it marks roads or clears their marks.
  if (UI.roadMode === 'pave' && first) UI.paveOn = !(inMap(i, j) && S.paveMark[tIdx(i, j)]);
  paintTiles(line);
  UI.lastPaint = { i, j };
  paintBanner();
}

/** A planned tile of yours the current tool (Roads, Bridges or Rail) can call off with a drag: in this sketch, or waiting for workers. */
function planErasable(t) {
  const d = UI.draft, m = UI.roadMode;
  if (m === 'rail') return d.rail.has(t) || (S.railPlan[t] === ME + 1 && !S.rail[t]);
  if (m !== 'road' && m !== 'bridge') return false;
  return d.addSet.has(t) || (S.plan[t] === ME + 1 && !S.road[t]);
}

/** Call off the planned tile t in the current stroke (a tile only sketched just drops out; one waiting for workers is marked to call off). */
function eraseTile(t) {
  const d = UI.draft, rail = UI.roadMode === 'rail';
  if (rail) {
    if (d.rail.has(t)) draftOp(UI.stroke, t, 'unrail');
    else if (S.railPlan[t] === ME + 1 && !S.rail[t] && !d.railDel.has(t)) draftOp(UI.stroke, t, 'raildel');
    else return;
  } else if (d.addSet.has(t)) draftOp(UI.stroke, t, 'unadd');
  else if (S.plan[t] === ME + 1 && !S.road[t] && !d.del.has(t)) draftOp(UI.stroke, t, 'del');
  else return;
  UI.paintErased++;
}

function paintFlagsReset() { UI.paintSkipped = false; UI.paintCross = false; UI.paintBridge = false; UI.paintTunnel = false; UI.paintCliff = false; UI.paintRamp = false; UI.paintSteep = false; }

/**
 * Sketch the current tool along `line` (tiles [x, y], each next to the one before) into UI.stroke.
 * clear: a road may go through resources (Route to), which workers clear; a drag goes round them.
 */
function paintTiles(line, clear) {
  let prev = null;
  const arrows = UI.roadMode === 'arrows', pave = UI.roadMode === 'pave', wall = UI.roadMode === 'wall', rail = UI.roadMode === 'rail';
  for (const [x, y] of line) {
    if (!inMap(x, y)) break;
    const t = tIdx(x, y);
    // Started on planned road: the first step decides. Along more of it, the drag calls the plan off (the tile it
    // started on too); out onto anything else, it draws as usual.
    if (UI.paintErase === null && t !== UI.paintStart) { UI.paintErase = planErasable(t); if (UI.paintErase) eraseTile(UI.paintStart); }
    if (UI.paintErase) { eraseTile(t); prev = [x, y]; continue; }
    if (UI.paintErase === null) { prev = [x, y]; continue; } // (still on the planned tile it started on: nothing to draw there)
    if (pave) { if (paveMarkable(t) && !!S.paveMark[t] !== !!UI.paveOn) act('paveMark', [x, y, !!UI.paveOn]); continue; }
    if (rail) {
      // Climbing a one-level cliff with no Ramp: plan one for the track (see dragCliff).
      if (prev) {
        const c = dragCliff(UI.stroke, tIdx(prev[0], prev[1]), t);
        if (c === 'ramp') UI.paintRamp = true; else if (c === 'nope') UI.paintCliff = true; else if (c === 'steep') UI.paintSteep = true;
      }
      prev = [x, y];
      if (S.rail[t] || UI.draft.rail.has(t)) continue;
      const st = S.bAt[t] && getE(S.bAt[t]);
      if (st && st.owner === ME && BDEFS[st.type].station) continue; // a drag from (or to) a station: the track starts (or ends) beside it
      if (!railBlocked(ME, t)) {
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
        const turn = (u) => { if (S.road[u] && S.road[u] !== v && roadOwnedBy(ME, u)) { UI.stroke.push({ t: u, op: 'dir', from: S.road[u] }); act('roadDir', [u % S.W, (u / S.W) | 0, v]); } };
        if (v >= 2 && roadOwnedBy(ME, t)) { turn(tIdx(prev[0], prev[1])); turn(t); }
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
    if (S.res[t] && !clear) { UI.paintSkipped = true; continue; }
    // A road dragged out over water (or a canyon) carries on as a bridge, and through rock as a tunnel.
    if (canRoad(ME, x, y) || draftBridge(t)) {
      draftOp(UI.stroke, t, 'add');
      if (crossTile(t) && UI.roadMode !== 'bridge') { if (bridgeable(t)) UI.paintBridge = true; else UI.paintTunnel = true; }
    } else if (crossTile(t)) UI.paintCross = true;
  }
}

/** The banner after a drag (or a route): what was planned, and anything the sketch had to go round. */
function paintBanner(lead) {
  const pave = UI.roadMode === 'pave', wall = UI.roadMode === 'wall', rail = UI.roadMode === 'rail', arrows = UI.roadMode === 'arrows';
  lead = lead ? lead + ' ' : '';
  if (pave) { showRoadBanner(); return; }
  if (UI.paintErase) {
    const n = UI.paintErased || 0, what = rail ? 'track' : 'road';
    showRoadBanner(n ? `${n} planned ${what} tile${n === 1 ? '' : 's'} called off along the drag (ones only sketched drop out; ones waiting for workers go when you tap <b>Build</b>, their cost back). <b>Undo</b> puts ${n === 1 ? 'it' : 'them'} back.` : '', true);
    return;
  }
  if (wall) { showRoadBanner(UI.paintSkipped ? 'The wall skips tiles it can\'t go on (outside your border, resources, cliffs, or right beside your Command Base).' : '', true); return; }
  const what = rail ? 'Track' : 'A road';
  const cliffNote = UI.paintSteep ? `${what} can't climb a cliff two levels high, and no Ramp can: go round it to a one-level step (or bridge the valley with a Viaduct).`
    : UI.paintCliff ? `${what} climbs a level only over a <b>Ramp</b>, and there's no room for one where you crossed this cliff (resources, a building, or it would block the only way through): try a tile or two along it.`
      : '';
  if (rail) {
    const crossNote = [UI.paintBridge ? `Over the water it's a <b>rail bridge</b> (${costText(RAIL_BRIDGE_COST)} a tile).` : '', UI.paintTunnel ? `Through the rock it's a <b>rail tunnel</b> (${costText(RAIL_TUNNEL_COST)} a tile).` : ''].filter(Boolean).join(' ');
    showRoadBanner(lead + (cliffNote || [UI.paintRamp ? 'A <b>Ramp</b> is planned where the track climbs the cliff: workers build it, paid from storage, and the track on it goes down when it\'s done.' : '', crossNote,
      UI.paintSkipped ? 'Track skips tiles it can\'t go on: outside your border, resources or buildings.' : ''].filter(Boolean).join(' ')), true);
    return;
  }
  if (arrows) {
    // Say what the drag has done once it has turned something (and each time it turns more), with Undo beside it.
    const n = new Set(UI.stroke.map((o) => o.t)).size;
    if (n && n !== UI.dirShown) showRoadBanner(`${n} road tile${n === 1 ? '' : 's'} made one-way: <b>Undo</b> puts ${n === 1 ? 'it' : 'them'} back.`, true);
    UI.dirShown = n;
  } else {
    showRoadBanner(lead + (cliffNote || (UI.paintRamp ? 'A <b>Ramp</b> is planned where the road climbs the cliff: workers cut it, paid from storage, and it carries the road up when it\'s done.'
      : UI.paintBridge || UI.paintTunnel ? [UI.paintBridge ? `The road crosses the water as a <b>bridge</b>: ${costText(CROSS[T_WATER].cost)} a tile, built out from the shore${navalMap() ? ' (more a tile out past ' + BRIDGE_NEAR + ' tiles from shore: a Port and ships are the way across wide water)' : ''}.` : '',
        UI.paintTunnel ? `The road goes through the rock as a <b>tunnel</b>: ${costText(CROSS[T_ROCK].cost)} a tile, dug in from the rock face.` : ''].filter(Boolean).join(' ')
      : UI.paintCross ? 'A road stops at your border: only a bridge can reach out past it, over water.'
        : UI.paintSkipped ? 'Dragging goes round resources: tap a boulder, grove, ore or crystal tile to clear it for a road.' : '')), true);
  }
}

/**
 * May a drag that starts on tile (i, j) paint? In Arrows only one that starts on a road of yours: from anywhere
 * else it moves the map, as a one-finger drag does outside Paths (a habitual pan across your roads turned them
 * all one-way). Every other tool paints from wherever it starts.
 */
function roadPaintStarts(i, j) {
  return UI.roadMode !== 'arrows' || (inMap(i, j) && S.road[tIdx(i, j)] > 0 && roadOwnedBy(ME, tIdx(i, j)));
}

/**
 * On a phone a plan's buttons make the Paths banner a row taller: when that leaves the tile just tapped under it
 * (a tap just above the banner), the map glides up to show it.
 */
function planInView(t) {
  if (isWide() || R.mode !== 'road') return;
  const r = $('banner').getBoundingClientRect(), z = R.cam.z, p = worldToScreen(t % S.W + 0.5, ((t / S.W) | 0) + 0.5), over = p.y + z - r.top;
  if (over > 0 && p.y < r.bottom && p.x > r.left - z && p.x < r.right + z) UI.glide = { x: R.cam.x, y: R.cam.y + over / z, t: 0.5 };
}

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

/* ------------------------------------------------------------------ Route to (Roads and Track) */

/** Is Route to on for the current Paths tool (Roads, Bridges or Rail)? */
function routeOn() { return !!UI.route && (UI.roadMode === 'road' || UI.roadMode === 'bridge' || UI.roadMode === 'rail'); }

/** Take a stroke's ops back out of the plan (newest first) and empty it. */
function strokeBack(stroke) {
  const back = { add: 'unadd', unadd: 'add', del: 'undel', undel: 'del', ramp: 'unramp', unramp: 'ramp', rail: 'unrail', unrail: 'rail', raildel: 'unraildel', unraildel: 'raildel', pipe: 'unpipe', unpipe: 'pipe', pipedel: 'unpipedel', unpipedel: 'pipedel' };
  for (let k = stroke.length - 1; k >= 0; k--) draftOp([], stroke[k].t, back[stroke[k].op]);
  stroke.length = 0;
}

/** Tiles already in the plan that a route can run along (they count as laid). */
function routeHave(rail) {
  const d = UI.draft;
  return rail ? (t) => d.rail.has(t) : (t) => d.addSet.has(t) || d.ramps.has(t);
}

/** Where a tapped route starts from: your road network (or track and Rail Stations), with what's planned. */
function routeSeeds(rail) {
  const d = UI.draft, out = [];
  for (let t = 0; t < S.W * S.H; t++) {
    if (rail ? (S.rail[t] && wayOwner(t) === ME) || S.railPlan[t] === ME + 1 || d.rail.has(t)
      : (S.road[t] && wayOwner(t) === ME) || S.plan[t] === ME + 1 || d.addSet.has(t) || d.ramps.has(t)) out.push(t);
  }
  for (const b of S.buildings) {
    if (b.dead || b.owner !== ME) continue;
    if (rail ? BDEFS[b.type].station : b.type === 'lander') out.push(tIdx(b.x, b.y)); // (the route starts beside it)
  }
  return out;
}

/**
 * The search from your whole network (Route to by tap or hover), kept while nothing it depends on has
 * changed (roads, track, plans, land, buildings, this plan), so moving the pointer only reads it.
 */
function routeTreeNow(rail) {
  const d = UI.draft;
  const key = [rail ? 1 : 0, S.roadVer, S.railVer, S.planVer, S.territoryVer, S.buildings.length, d.add.length, d.ramps.size, d.rail.size, d.del.size, d.railDel.size, Math.floor(S.time / 30)].join(':');
  if (UI.routeTreeKey === key && UI.routeTreeCache) return UI.routeTreeCache;
  const seeds = routeSeeds(rail);
  const T = seeds.length ? routeTree(ME, rail ? 'rail' : 'road', seeds, routeHave(rail)) : { why: 'You have no track or Rail Station yet: drag from where the track should start to where it should go.' };
  T.nSeeds = seeds.length;
  UI.routeTreeKey = key; UI.routeTreeCache = T;
  return T;
}

/** The route from your network to tile t (Route to by tap or hover): { tiles } or { why }. */
function routeToTile(t, rail) {
  const T = routeTreeNow(rail);
  return T.why ? T : routeFromTree(T, t, T.nSeeds);
}

/** Plan a found route's tiles (a Viaduct's two ends aren't neighbours: the deck between is already there). */
function paintRoute(tiles) {
  let run = [];
  for (let k = 0; k < tiles.length; k++) {
    const t = tiles[k], x = t % S.W, y = (t / S.W) | 0;
    if (run.length) { const [px, py] = run[run.length - 1]; if (Math.abs(px - x) + Math.abs(py - y) !== 1) { paintTiles(run, true); run = []; } }
    run.push([x, y]);
  }
  if (run.length) paintTiles(run, true);
}

/** What the route came to, for the banner. */
function routeNote(r, rail) {
  const n = rail ? UI.stroke.filter((s) => s.op === 'rail').length : UI.stroke.filter((s) => s.op === 'add').length;
  const ramps = UI.stroke.filter((s) => s.op === 'ramp').length;
  const along = r.tiles.length - n - ramps;
  if (!n && !ramps) return `<b>Route:</b> your ${rail ? 'track' : 'roads'} already ${rail ? 'run' : 'go'} there.`;
  return `<b>Route:</b> ${n} new ${rail ? 'track' : 'road'} tile${n === 1 ? '' : 's'}${ramps ? ` and ${ramps} Ramp${ramps === 1 ? '' : 's'}` : ''}` +
    (along > 1 ? `, joining ${along} tiles of your ${rail ? 'track' : 'roads'}` : '') + '. Tap Build to keep it, or tap somewhere else to try another spot.';
}

/** Route to, by tap: the cheapest way there from your network replaces the last route you tried. */
function routeTap(i, j) {
  const d = UI.draft, rail = UI.roadMode === 'rail';
  if (UI.routePrev && d.strokes[d.strokes.length - 1] === UI.routePrev) { strokeBack(UI.routePrev); d.strokes.pop(); }
  UI.routePrev = null;
  UI.routeGhost = null;
  const r = routeToTile(tIdx(i, j), rail);
  if (!r.tiles) { sfx('error'); showRoadBanner(r.why); return; }
  paintFlagsReset();
  UI.stroke = []; d.strokes.push(UI.stroke);
  paintRoute(r.tiles);
  UI.routePrev = UI.stroke;
  UI.routeEnd = tIdx(i, j);
  sfx('click');
  paintBanner(routeNote(r, rail));
  planInView(tIdx(i, j));
}

/** Route to, by drag: from where the drag started to the finger, found again as it moves. */
function routeDrag(i, j, first) {
  if (first) { UI.routeFrom = inMap(i, j) ? tIdx(i, j) : -1; UI.routeTo = -1; UI.routePrev = null; }
  if (UI.routeFrom < 0 || !inMap(i, j)) return;
  const to = tIdx(i, j), rail = UI.roadMode === 'rail';
  if (to === UI.routeTo) return;
  UI.routeTo = to;
  strokeBack(UI.stroke);
  paintFlagsReset();
  if (to === UI.routeFrom) { showRoadBanner('<b>Route to:</b> drag on to where it should go.', true); return; }
  const r = pathRoute(ME, rail ? 'rail' : 'road', [UI.routeFrom], to, routeHave(rail));
  UI.routeEnd = to;
  if (!r.tiles) { showRoadBanner(r.why); return; }
  paintRoute(r.tiles);
  paintBanner(routeNote(r, rail));
}

/** With a mouse, Route to previews the way to the pointer (a dashed line); a click plans it. */
function routeHover(i, j) {
  if (!inMap(i, j)) { UI.routeGhost = null; return; }
  const t = tIdx(i, j), rail = UI.roadMode === 'rail';
  if (UI.routeGhost && UI.routeGhost.to === t && UI.routeGhost.rail === rail) return;
  const r = routeToTile(t, rail);
  UI.routeGhost = { to: t, rail, tiles: r.tiles || null };
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
  let route = a === b ? (pipeBlocked(ME, a) ? null : [a]) : pipeRoute(ME, a, (t) => t === b, 400);
  UI.pipeWhy = route ? '' : pipeBlocked(ME, b) || pipeBlocked(ME, a) || 'No way to run pipe there: round buildings and water, on your own land or no-one\'s.';
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
    if (b.dead || b.owner !== ME || !BDEFS[b.type].pump) continue;
    const r = pipeToRefinery(ME, b);
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
  const have = playerGoods(ME);
  let line, how;
  const pipeHow = `Pipelines carry Crude and Fuel. Every second each line moves up to ${PIPE_RATE} Crude from its Oil Pumps to the Refineries (and Asphalt Plants) on it, then into any storage on it; storage on a line feeds its Refineries too. And up to ${PIPE_RATE} Fuel from its Refineries and Bio Farms to what burns Fuel on it (Fuel Stations, Generators, Flame Towers, the Missile Factory), then into storage; storage on a line feeds them too. A pump on a pipeline never waits for a Tanker, and nothing on a line with Fuel to give waits for one to bring it. Pipe goes anywhere inside your border: over roads and track, under buildings, up cliffs, across water on stilts and bored through rock (those tiles cost more, so a drag goes round a small pond); a pipe joins every building it runs beside or under. Raiders and missiles can break it: broken pipe is relaid as soon as it's paid for again.`;
  if (mode === 'pipe' && !UI.draft.pipe.size && !UI.draft.pipeDel.size) {
    let unpiped = 0;
    const joined = refineryPipes(ME);
    for (const b of S.buildings) if (!b.dead && b.owner === ME && BDEFS[b.type].pump && !buildingPipes(b).some((c) => joined.has(c))) unpiped++;
    line = `<b>Drag from an Oil Pump to a Refinery</b> (or from storage or a Refinery to a Fuel Station or Generator) and the pipe finds its own way there, over roads and track, across water and through rock (${costText(PIPE_COST)} a tile, ${costText(PIPE_CROSS_COST)} across water or rock; laid when you tap Build). Or tap a pump to pipe it to the nearest Refinery, or a Fuel Station or Generator to pipe Fuel to it. Tap pipe to take it up.` +
      (unpiped ? ` <button class="btn" id="pipe-all">Pipe every Oil Pump (${unpiped})</button>` : '');
    how = pipeHow;
  } else if (mode === 'rail' && routeOn() && !UI.draft.rail.size && !UI.draft.railDel.size) {
    line = `<b>Route to:</b> tap where the track should go and the best way there from your track (or a Rail Station) is planned: round buildings and fields, up one-level cliffs over a Ramp, with few bends.${INPUT.mouse ? ' The dashed line shows the way to the pointer.' : ''} Or drag from a start to the end. Tap another spot to try again; nothing is spent until you tap <b>Build</b>.`;
    how = 'Route to finds the cheapest way for track on ground you hold or no-one does, using track you already have where it helps; a Ramp is planned at each one-level cliff it climbs (it costs as much as several tiles of track, so it goes round small rises). It won\'t climb a cliff two levels high: a Viaduct crosses those. Put a Rail Station at each end and order a Freight Train at its rail yard.';
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
    const c = paveCounts(ME);
    let works = 0;
    for (const b of S.buildings) if (!b.dead && b.owner === ME && b.type === 'roadworks') works++;
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
    for (const k in S.lights) if (S.lights[k].owner === ME) lights++;
    for (const k in S.over) if (S.over[k].owner === ME) overs++;
    const net = roadNet();
    for (let t = 0; t < S.W * S.H; t++) if (net.junc[t] && wayOwner(t) === ME) junctions++;
    line = `Tap a <b>junction</b> for a traffic light (${costText(LIGHT_COST)}), tap the light for an <b>overpass</b> (${costText(OVERPASS_COST)}), tap again to clear it.`;
    const jp = plansWaiting(ME).junctions;
    how = `A light lets one direction through at a time: it pays where two busy roads cross (50 to 85% more goods through), and costs a little on a quiet crossing. On an overpass nobody stops: best everywhere, and more than twice as much on a jammed crossing. Short of Alloy? Tap anyway: the light or overpass is planned (a dashed orange marker) and goes up once it's paid for from storage, oldest plans first${jp ? ` (<b>${jp}</b> waiting now)` : ''}. You have ${lights} light${lights === 1 ? '' : 's'}, ${overs} overpass${overs === 1 ? '' : 'es'} and ${junctions} junction${junctions === 1 ? '' : 's'}.`;
  } else {
    const sm = draftSummary();
    if (draftEmpty() && routeOn()) {
      line = `<b>Route to:</b> tap a spot and the cheapest road there from your road network is planned: round fields where it can, up one-level cliffs with a Ramp, over water as a bridge (or through rock as a tunnel) only when that saves a long way round.${INPUT.mouse ? ' The dashed line shows the way to the pointer.' : ''} Or drag from a start to the end. Tap another spot to try again; nothing is spent until you tap <b>Build</b>.`;
    } else if (draftEmpty()) {
      // (On a touch screen a one-finger drag sketches here, so say how to move the map.)
      const fingers = !INPUT.mouse && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? ' Two fingers move the map.' : '';
      line = mode === 'bridge'
        ? `<b>Sketch</b> a road across water (bridge, ${costText(CROSS[T_WATER].cost)} a tile${navalMap() ? ' near the shore, more further out' : ''}) or through rock (tunnel, ${costText(CROSS[T_ROCK].cost)}). Nothing is spent until you tap <b>Build</b>.${fingers}`
        : `<b>Sketch</b> roads by dragging; tap a tile to add or drop it, or tap a road to take it up. Nothing is spent until you tap <b>Build</b>.${fingers}`;
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
    const waiting = planList(ME).length, wp = plansWaiting(ME), owedN = wp.tiles + wp.track + wp.pipes + wp.sites;
    const owedText = owedN ? ` <b>Waiting for goods now:</b> ${[wp.tiles ? `${wp.tiles} road tile${wp.tiles === 1 ? '' : 's'}` : '', wp.track ? `${wp.track} of track` : '', wp.pipes ? `${wp.pipes} of pipe` : '', wp.sites ? `${wp.sites} site${wp.sites === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ')} (${costText(wp.owed)} to go).` : '';
    if (mode === 'pipe') how = pipeHow + owedText;
    else if (mode === 'wall') how = 'Walls and Gates are paid straight from storage, no Hauler needed: what you have now goes in when you tap Build, the rest as the goods come in (oldest plans first), and free workers put each piece up as far as its goods go. Enemy warbots have to go round or shoot through; your bots pass your Gates.' + owedText;
    else if (mode === 'rail') how = 'Track you can pay for goes down when you tap Build; the rest goes down as the goods come in (oldest plans first). Where the track climbs a one-level cliff, a Ramp is planned for it (paid from storage, no road needed) and the track on it goes down once workers finish the Ramp. Rail Stations stand beside the track (build them first if you like, and drag from one to the other); Freight Trains run between stations on the same stretch of track.' + owedText;
    else how = `<b>Haulers only drive on roads</b>, so every building needs a road to storage. 1 Cement paves ${Math.round(1 / roadCost().cement)} tiles (${ROAD_CLEAR}× through resources); you have ${have.cement || 0} Cement` +
      (mode === 'bridge' ? ` and ${have.alloy || 0} Alloy. Workers build bridges and tunnels out from the shore or rock face, and they join land on any level.` : `. Drag a road out over water and it carries on as a bridge (${costText(CROSS[T_WATER].cost)} a tile), and through rock as a tunnel (${costText(CROSS[T_ROCK].cost)}).`) +
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
  // The tools are one row to swipe along on a phone: the one in use is brought into view when it changes.
  if (UI.segShown !== mode) { UI.segShown = mode; const on = $('banner-seg').querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
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
  $('banner-undo').onclick = () => { draftUndo(); sfx('click'); showRoadBanner(); };
  if ($('pipe-all')) $('pipe-all').onclick = (e) => { e.stopPropagation(); pipeAllPumps(); };
  const tb = $('banner-traffic');
  tb.hidden = false;
  tb.classList.toggle('on', !!R.traffic);
  tb.onclick = () => { R.traffic = !R.traffic; sfx('click'); showRoadBanner(); };
  // Route to: on Roads, Bridges and Rail.
  const rb = $('banner-route');
  rb.hidden = !['road', 'bridge', 'rail'].includes(mode);
  rb.classList.toggle('on', routeOn());
  // (UI.roadMode = mode: in a new game no tool has been picked yet, and Route to stayed off however often it was tapped)
  rb.onclick = () => { UI.roadMode = mode; UI.route = !UI.route; UI.routeGhost = null; UI.routePrev = null; sfx('click'); showRoadBanner(); };
  if (R.traffic) $('banner-text').innerHTML += ` <span class="traffic-key">${trafficSummary()}</span>`;
  // In a mission, the next goal's hint (the goal list is hidden while Paths is open).
  const M = S && S.mission, def = M && !M.result && missionDef(M);
  if (def) {
    const states = missionStates(M), now = missionGoalNow(states);
    const h = now >= 0 && missionHint(def, M, states, now);
    if (h) $('banner-text').innerHTML += `<div class="obj-hint ban-hint"><b>${states[now].text}:</b> ${h}</div>`;
  }
}

/** A Rail Station's place on its line, what it stocks automatically, and its conveyors (panel text). */
function railStatusText(b) {
  const linked = S.buildings.filter((s) => s !== b && !s.dead && s.owner === b.owner && s.built && BDEFS[s.type].station && !BDEFS[s.type].terminal && railLinked(s, b));
  const trains = S.bots.filter((u) => !u.dead && u.owner === b.owner && BOTS[u.type].rail && trainAt(u, b)).length;
  const auto = b.auto ? Object.entries(b.auto).map(([g, n]) => goodTag(g, `${Math.min(b.stock[g] || 0, n)}/${n} ${GOOD[g].name}`, (b.stock[g] || 0) < n / 3)).join(' ') : '';
  const conv = stationLinks(b);
  const role = !linked.length ? 'No other station on its track yet.'
    : !trains ? `On a line with ${linked.length} other station${linked.length > 1 ? 's' : ''}, but no Freight Train runs on it: order one at a rail yard.`
      : farStation(b) ? `A far station: ${trains} train${trains > 1 ? 's' : ''} on its line bring${trains > 1 ? '' : 's'} what it stocks, and take${trains > 1 ? '' : 's'} its spare goods home.`
        : 'The home station of its line (nearest your Command Base): it keeps what the far stations want, ready to load.';
  const served = S.buildings.filter((c) => !c.dead && c.railBy === b.id).length;
  return role + (served ? ` It serves ${served} building${served > 1 ? 's' : ''} round it.` : '') +
    (b.autoOff ? ' Auto supply is off.' : auto ? `<div class="goodlist">${auto}</div>` : '') +
    (conv.length ? `<div class="kv"><span>Conveyors</span><span>${conv.map((l) => BDEFS[l.c.type].name).join(', ')}</span></div>` : '');
}

/** A Depot's automatic stock (see railPlan): whether it stocks itself, and what it keeps for the buildings round it. */
function depotAutoText(b) {
  const P = S.players[b.owner], hub = getE(P.lander);
  if (!hub || hub.dead || !farApart(b, hub)) return `Near your Command Base: it stocks nothing by itself (a Depot ${TRUCK_MIN_DIST} or more tiles out does).`;
  if (b.autoOff) return 'Auto supply is off: only the supply orders below stock it.';
  if (!roadTrainFor(b.owner, b) || !truckLinked(b, hub)) return 'Once a Road Train can drive here from your Command Base (order one at the Bot Foundry), this Depot keeps what the buildings round it need, and the Road Train brings it.';
  if (!b.auto) return `Nothing round it needs a Road Train load yet (${TRAIN_MIN_LOAD} goods or more): Freight Trucks and Haulers serve the buildings here as usual.`;
  const served = S.buildings.filter((c) => !c.dead && c.railBy === b.id && needsOf(c).some(([g]) => b.auto[g])).length;
  const list = Object.entries(b.auto).map(([g, n]) => goodTag(g, `${Math.min(b.stock[g] || 0, n)}/${n} ${GOOD[g].name}`, (b.stock[g] || 0) < n / 3)).join(' ');
  return `It keeps what the ${served} building${served === 1 ? '' : 's'} round it need${served === 1 ? 's' : ''}, brought by Road Train, several goods a trip:<div class="goodlist">${list}</div>`;
}

/** Traffic map legend plus how busy the haulers and trucks are. */
function trafficSummary() {
  const n = { hauler: [0, 0], truck: [0, 0], tanker: [0, 0] };
  for (const u of S.bots) {
    if (u.dead || u.owner !== ME || !n[u.type]) continue;
    n[u.type][0]++;
    if (u.task && u.task.type === 'haul') n[u.type][1]++;
  }
  let jams = 0;
  if (HEAT.jam) for (let t = 0; t < S.W * S.H; t++) if (HEAT.jam[t] > TRAFFIC_JAM && wayOwner(t) === ME) jams++;
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
  if (k === 'bot') { const u = getE(id); if (!u) return null; const h = u.inside ? getE(u.inside) : null; return h ? { x: h.x + 0.5, y: h.y + 0.5 } : { x: u.x, y: u.y }; }
  if (k === 'rally') { const r = rallyById(id); return r ? { x: r.x, y: r.y } : null; }
  if (k === 'move' || k === 'res' || k === 'road' || k === 'soil' || k === 'post' || k === 'uplink') return { x: (id % S.W) + 0.5, y: ((id / S.W) | 0) + 0.5 };
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
  const have = playerGoods(ME);
  const sites = siteCount(ME);
  const list = BUILD_MENU.filter((t) => !(BDEFS[t].war && !warOn()) && !(BDEFS[t].nuke && !nukeOn()) && !(BDEFS[t].colony && !labOn()) && !(BDEFS[t].naval && !navalMap()));
  const groupOf = (t) => (BUILD_GROUPS.find((g) => g.types.includes(t)) || BUILD_GROUPS[0]).key;
  const ordered = BUILD_GROUPS.flatMap((g) => g.types).filter((t) => list.includes(t));
  if (!UI.buildTab) { try { UI.buildTab = localStorage.getItem('botfall.buildTab') || 'all'; } catch (e) { UI.buildTab = 'all'; } }
  const groups = BUILD_GROUPS.filter((g) => ordered.some((t) => groupOf(t) === g.key));
  if (UI.buildTab !== 'all' && !groups.some((g) => g.key === UI.buildTab)) UI.buildTab = 'all';
  const tabs = `<div class="seg build-tabs" id="build-tabs">${groups.map((g) => `<button data-g="${g.key}"><kbd>${BUILD_TAB_KEYS[g.key]}</kbd>${g.name}<span class="n">${ordered.filter((t) => groupOf(t) === g.key).length}</span></button>`).join('')}<button data-g="all"><kbd>${BUILD_TAB_KEYS.all}</kbd>All</button></div>`;
  const kbd = (t) => { const k = buildKeyOf(t); return k ? `<kbd data-tab="${BUILD_TAB_KEYS[k.tab]}" data-key="${k.key.toUpperCase()}">${k.key.toUpperCase()}</kbd>` : ''; };
  const html = `<div class="sheet-title"><h3>Build</h3></div>
    <p class="desc">Placing a site is free; haulers bring the materials by road, so lay a road to it. <span id="build-sites">${sites}/${MAX_SITES}</span> sites in progress.</p>
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
  $('build-roads').onclick = () => openRoadDraw();
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
  const T = tradeState(ME), have = spendable(ME);
  const sig = JSON.stringify([T.round, T.pick, T.offers.map((o) => [o.left, tradePay(ME, o, b)]), Object.keys(T.sat).map((g) => Math.round(T.sat[g] * 20))]);
  $('sh-trade-next').textContent = T.next > S.time ? `new ones in ${fmtTime(T.next - S.time)}` : '';
  const trainNear = S.bots.some((u) => !u.dead && u.owner === ME && BOTS[u.type].train && botLinked(u, b));
  const railNear = S.bots.some((u) => !u.dead && u.owner === ME && BOTS[u.type].rail) && S.buildings.some((s) => !s.dead && s.owner === ME && s.built && BDEFS[s.type].station && !BDEFS[s.type].terminal && railLinked(s, b));
  const bonus = Math.round((terminalBonus(b) - 1) * 100);
  // Fuel a contract paid (a liquid) goes home by Tanker, or by a pipeline to storage: say so when none can take it.
  const fuelHere = Math.floor(terminalSpare(b, 'fuel')), fuelPick = T.pick >= 0 && T.offers[T.pick] && T.offers[T.pick].steep;
  const tankerNear = S.bots.some((u) => !u.dead && u.owner === ME && BOTS[u.type].tanker && botLinked(u, b));
  $('sh-trade-hint').innerHTML = (!trainNear && !railNear ? '<span class="err">No Road Train can reach it, and no Freight Train runs to it: order a Road Train at the Bot Foundry and lay a road here (or lay track beside it from a Rail Station).</span> ' : '') +
    ((fuelHere >= 1 || fuelPick) && !tankerNear && !b.pipedFuel ? '<span class="err">No Tanker can reach it to take its Fuel home: order one at the Bot Foundry (or pipe the Terminal to storage).</span> ' : '') +
    (fuelHere >= 1 ? `${fuelHere} Fuel waits here for ${b.pipedFuel ? 'the pipeline' : 'a Tanker'}. ` : '') +
    `Only Road Trains and Freight Trains serve a Terminal: they bring a contract's lot and take what it pays home (Fuel goes by Tanker, or by pipeline to storage). Rates are ${Math.round(TERMINAL.rate * 100)}% of what the goods are worth` +
    (bonus ? `, +${bonus}% for standing this far out` : `; one further than ${TERMINAL.minDist} tiles from your Command Base pays more`) + '. Each contract runs up to ' + TERMINAL.lots + ' times, and each lot of a good you sell pays a little less for a while. ' +
    `The last contract always brings Fuel, at a steep ${Math.round(TERMINAL.fuelRate * 100)}%: for a colony with no oil and poor soil.`;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  if (!T.offers.length) { el.innerHTML = '<p class="hint">Contracts arrive in a moment.</p>'; return; }
  el.innerHTML = T.offers.map((o, k) => {
    const on = T.pick === k, pay = tradePay(ME, o, b), sat = T.sat[o.give] ?? 1;
    // Spelled out which way it goes: you send `lot` of one good and get `pay` of the other back.
    return `<div class="kv trade-row${on ? ' on' : ''}"><span>You give <b>${o.lot}</b> <i class="gi ${o.give}"></i>${GOOD[o.give].name} → you get <b>${pay}</b> <i class="gi ${o.get}"></i>${GOOD[o.get].name}` +
      `<small> ${o.steep ? 'Always on offer, at a steep price (half the usual rate); a Tanker takes the Fuel home · ' : ''}${o.left > 0 ? `${o.left} more time${o.left === 1 ? '' : 's'}` : 'filled'}${sat < 0.99 ? ` · ${GOOD[o.give].name} pays ${Math.round(sat * 100)}% for now (you sold a lot lately)` : ''} · you have ${Math.floor(have[o.give] || 0)} ${GOOD[o.give].name}</small></span>` +
      `<button class="btn small${on ? '' : ' primary'}" data-k="${k}" ${o.left > 0 ? '' : 'disabled'}>${o.left > 0 ? (on ? 'Stop' : 'Take') : 'Filled'}</button></div>`;
  }).join('');
  for (const btn of el.querySelectorAll('button[data-k]')) btn.onclick = () => {
    const k = +btn.dataset.k;
    act('contract', [T.pick === k ? -1 : k], () => { renderTrade(b); refreshSheet(); });
    sfx('click');
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
    for (const btn of el.querySelectorAll('button')) btn.onclick = () => { act('yard', [b.id, btn.dataset.k, +btn.dataset.d], () => renderYard(b)); sfx('click'); };
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
    if (b.dead || b.owner !== ME || b.type !== type) continue;
    if (b.built) built++; else sites++;
  }
  return { built, sites };
}

/**
 * The open build menu, kept current (with the HUD, every quarter second): its cards grey out when the site limit is
 * reached and come back as soon as a site finishes, costs turn red and back as goods come and go, and the counts
 * of what you have and are building move on. (It used to be fixed when opened, so the cards stayed grey until
 * you closed and reopened it.)
 */
function refreshBuildMenu() {
  const body = $('sheet-body');
  if (!body || !S) return;
  const sites = siteCount(ME), full = sites >= MAX_SITES, have = playerGoods(ME);
  if ($('build-sites')) $('build-sites').textContent = `${sites}/${MAX_SITES}`;
  for (const el of body.querySelectorAll('.build-grid .bcard[data-t]')) {
    const t = el.dataset.t, cost = BDEFS[t].cost;
    if (el.disabled !== full) el.disabled = full;
    const spans = el.querySelectorAll('.bcost > span');
    Object.keys(cost).forEach((g, i) => { if (spans[i]) spans[i].classList.toggle('short', have[g] < cost[g]); });
    const h = el.querySelector('.bhave'), txt = ownedText(t);
    if (h && h.textContent !== txt) h.textContent = txt;
  }
}

/** What a garrison is made of, by kind, in the usual order: "4 Warbots, 1 Bulwark, 1 Torch". */
function garrisonMix(b) {
  const n = {};
  for (const id of b.garrison) { const u = getE(id); if (u && !u.dead) n[u.type] = (n[u.type] || 0) + 1; }
  return BOT_ORDER.filter((t) => n[t]).concat(Object.keys(n).filter((t) => !BOT_ORDER.includes(t)))
    .map((t) => `${n[t]} ${n[t] === 1 ? BOTS[t].name : BOTS[t].plural || BOTS[t].name}`).join(', ');
}

function ownedText(type) {
  const { built, sites } = ownedCount(type);
  if (type === 'ramp') return sites ? `${sites} being built` : '';
  if (!built && !sites) return 'None yet';
  return `You have ${built}` + (sites ? ` · ${sites} being built` : '');
}

/**
 * The line of flavour at the foot of a panel (FLAVOR in defs.js: LORE.md's voice), one subdued line below everything
 * useful, so it never pushes a button down. (The Command Base's, its Arrival clock, sits under its name instead: see
 * openBuildingSheet.)
 */
function flavorLine(k) { return FLAVOR[k] && k !== 'lander' ? `<p class="flavor">${FLAVOR[k]}</p>` : ''; }

function openBuildingSheet(b) {
  const def = BDEFS[b.type];
  const mine = b.owner === ME;
  R.selected = b.id; R.selTile = -1; UI.selBot = 0;
  let desc = !mine && b.type === 'lander' ? (S.players.length > 2 ? `${playerName(b.owner)}'s fortified headquarters. Capture it and everything ${playerName(b.owner)} built is yours.` : `${playerName(b.owner)}'s fortified headquarters. Capture it to win.`) : def.desc;
  const style = !mine && b.type === 'lander' && S.players[b.owner] && S.players[b.owner].ai && isDoctrine(S.players[b.owner].style) && S.players[b.owner].style;
  if (style && S.mode !== 'colony' && !S.mission) desc += ` <b>${docLabel(style)}:</b> it ${PERSONALITIES[style].desc}.`;
  if (!mine && b.type === 'lander' && S.mission && captureLocked(b, ME)) desc += ' <b>Finish your other goals first:</b> until then it holds at 1 armor.';
  if (def.wild) {
    const n = S.bots.filter((u) => !u.dead && u.nest === b.id).length;
    desc += ` <b>Level ${b.level || 1} of 3</b>, ${n} of the Murmur out and about. Hoarded: ${Object.keys(b.stock).filter((g) => b.stock[g] > 0).map((g) => `${b.stock[g]} ${GOOD[g].name}`).join(', ') || 'nothing'}.`;
  }
  // With no road to storage yet, that warning and its Lay road button lead the panel: in view at half height.
  const roadFirst = mine && b.unlinked && needsRoad(b);
  let html = `<div class="sheet-title"><img src="${iconFor(b.type, b.owner)}" alt=""><div><h3>${def.name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[b.owner]}"></span> ${mine ? 'Yours' : playerName(b.owner)}</div>${b.type === 'lander' ? `<div class="flavor clock">${ARRIVAL_CLOCK}</div>` : ''}</div></div>
    ${roadFirst ? '<div id="sh-road"></div>' : ''}<p class="desc">${desc}</p><div class="status" id="sh-status"></div><div id="sh-dyn"></div>${mine ? '<div id="sh-fix"></div>' : ''}`;
  if (mine) {
    if (def.airfield && b.built && b.owner === ME) html += airfieldSection(b); // its planes and air drops first
    if (def.yard && b.built && mine) html += `<div class="section-label">${def.port ? 'Shipyard' : def.airfield ? 'Hangar' : 'Rail yard'}</div><div class="status" id="sh-yard-status"></div><div class="bar" id="sh-yard-bar"><div></div></div><div id="sh-yard"></div>${def.station ? '<div class="actions" id="sh-yard-here"></div>' : ''}
      <p class="hint">${def.port ? 'Ships are built here' : def.airfield ? 'Planes are built here' : 'Freight Trains are built here'}, a round of parts (1 Alloy, 1 Chip) every ${YARD.work} s: ${def.yard.map((k) => `${BOTS[k].plural.toLowerCase().replace(/^./, (c) => c.toUpperCase())} ${BOTS[k].parts}`).join(', ')} rounds. Haulers bring the parts. ${def.port ? 'Each one puts to sea from this Port.' : def.airfield ? `The hangar holds ${Object.entries(AIRFIELD_HOLDS).map(([k, n]) => `${n} ${n === 1 ? BOTS[k].name : BOTS[k].plural}`).join(' and ')}.` : 'Each one rolls out onto this station\'s track, so the Bot Foundry never needs a railway.'}</p>`;
    if (def.terminal && b.built) html += '<div class="section-label">Contracts <span class="label-note" id="sh-trade-next"></span></div><div id="sh-trade"></div><p class="hint" id="sh-trade-hint"></p>';
    // A Rail Station: its line, what it stocks automatically, and its conveyors.
    if (def.station && !def.terminal && b.built && mine) {
      html += `<div class="section-label">Railway</div><div class="status" id="sh-rail-status"></div>
        <div class="seg" id="sh-auto"><button data-v="1">Auto supply</button><button data-v="0">Off</button></div>
        <p class="hint" id="sh-rail-hint"></p>`;
    }
    // A Depot: what it stocks automatically for a Road Train to bring.
    if (b.type === 'depot' && b.built && mine) {
      html += `<div class="section-label">Road Train supply</div><div class="status" id="sh-dauto-status"></div>
        <div class="seg" id="sh-auto"><button data-v="1">Auto supply</button><button data-v="0">Off</button></div>
        <p class="hint" id="sh-dauto-hint"></p>`;
    }
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
      if (BDEFS[b.type].port && b.built && b.owner === ME) html += portSection(b);
    }
    // Call a worker: one of yours with a building that needs a worker and has none (a mine no one comes to).
    if (b.owner === ME && b.built && BDEFS[b.type].staff && !BDEFS[b.type].crew && !b.staff) {
      html += `<button class="btn" id="sh-callw">Call a worker</button><p class="hint" id="sh-callw-hint">Send the nearest worker here now, even one busy elsewhere, so this keeps working.</p>`;
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
        <div class="seg" id="sh-keepw"><button data-v="auto">Auto (${b.type === 'lander' ? 1 : S.players[ME].keepW ?? 0})</button><button data-v="0">0</button><button data-v="1">1</button><button data-v="2">2</button><button data-v="5">5</button><button data-v="${def.garrison}">${def.garrison}</button></div>
        <p class="hint">${b.type === 'lander' ? 'Warbots the Command Base always keeps at home: attacks, rallies and stationing never take the last of them.'
          : 'Warbots stationed here: your Command Base sends them, and replaces any that are lost. Attacks and rally flags use them once the Command Base has none to spare, and they come back here when you call them back (or after defending it). <i>Auto</i> follows the setting for every Outpost in Army.'}</p>`) +
        // Whether its warbots go out by themselves against enemies close by (a Bunker's and a Keep's fire from cover instead).
        (def.bunker || def.keep ? '' : `<div class="section-label">When enemies come near</div>
        <div class="seg" id="sh-hold"><button data-v="0">Go out and fight</button><button data-v="1">Hold inside</button></div>
        <p class="hint" id="sh-hold-hint"></p>
        <button class="btn" id="sh-sortie">Send them out to fight</button>`);
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
    if (def.pump && b.built && b.owner === ME) {
      const pr = pipeToRefinery(ME, b);
      if (!pr.why) html += `<button class="btn" id="sh-pipe">Pipe it to the Refinery: ${pr.tiles.length} tile${pr.tiles.length === 1 ? '' : 's'}, ${costText(pr.cost)}</button>
        <p class="hint">A pipeline sends its Crude straight to the Refinery, every second, so it never waits for a Tanker. It runs over roads and track; raiders can break it.</p>`;
    }
    if (fuelUser(def) && b.built && b.owner === ME) {
      const pr = pipeToFuel(ME, b);
      if (!pr.why && pr.tiles.length <= 40) html += `<button class="btn" id="sh-pipefuel">Pipe Fuel to it: ${pr.tiles.length} tile${pr.tiles.length === 1 ? '' : 's'}, ${costText(pr.cost)}</button>
        <p class="hint">A pipeline from storage, a Refinery or a Bio Farm keeps it topped up with Fuel every second, with no Tanker trips. It runs over roads and track; raiders can break it.</p>`;
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
    if (b.owner === ME && (movable(b) || b.moving)) html += `<button class="btn" id="sh-move">${b.moving ? 'Cancel move' : 'Move'}</button><p class="hint" id="sh-move-hint">${b.moving ? 'Its new site is going up: when it\'s finished, everything here moves over and this one comes down.' : 'Put it somewhere else: no goods needed, just its build time. It keeps working until the new one is ready.'}</p>`;
    if (b.owner === ME && b.type === 'wall' && b.built) html += `<button class="btn" id="sh-gate">Make it a Gate</button><p class="hint">Your bots and trucks can pass through a Gate; enemies still have to break it down. It costs ${costText(gateUpgradeCost())} more, paid from storage.</p>`;
    if (BDEFS[b.type].mobile) html += '<button class="btn primary" id="sh-pack">Pack up to move</button>';
    else if (b.type !== 'lander') html += `<button class="btn danger" id="sh-demolish">${b.built ? 'Dismantle' : 'Cancel site'}</button>`;
    html += '</div>';
  } else if ((S.mode !== 'colony' || def.wild) && foes(b.owner, ME)) {
    html += `<div class="section-label">Attack with warbots</div><div id="sh-attack"></div>
      <div class="stepper" id="sh-stepper"><button class="btn" id="sh-minus">−</button><span class="n" id="sh-n">0</span>
      <button class="btn" id="sh-plus">+</button><button class="btn primary" id="sh-send" style="flex:1">Send warbots</button></div>
      <div class="section-label">Missile strike</div><div id="sh-missile"></div>
      <button class="btn primary big" id="sh-fire">Fire missile</button>${myBombers().length ? '<div class="section-label">Air strike</div><p class="hint" id="sh-bomb-hint"></p><button class="btn big" id="sh-bomb">Bomb it</button>' : ''}`;
  }
  html += flavorLine(b.type);
  openSheet('bld', b.id, html);
  UI.sheetMine = mine;
  if (mine) {
    // (each setting is an order: refreshSheet once it's done)
    const set = (name, ...args) => { act(name, [b.id, ...args], () => refreshSheet()); sfx('click'); };
    if ($('sh-prio')) for (const btn of $('sh-prio').children) btn.onclick = () => set('prio', btn.dataset.v);
    if ($('sh-smode')) for (const btn of $('sh-smode').children) btn.onclick = () => set('smode', btn.dataset.v);
    if ($('sh-accept')) for (const btn of $('sh-accept').children) btn.onclick = () => set('accept', btn.dataset.g);
    if ($('sh-pmode')) for (const btn of $('sh-pmode').children) btn.onclick = () => set('pmode', btn.dataset.v);
    if ($('sh-pmark')) $('sh-pmark').onclick = () => openPaths('pave');
    if ($('sh-keep-all')) $('sh-keep-all').onclick = () => { UI.keepAll = !UI.keepAll; sfx('click'); openBuildingSheet(b); };
    if ($('sh-auto')) for (const btn of $('sh-auto').children) btn.onclick = () => set('autoSupply', btn.dataset.v === '1');
    if ($('sh-keep')) for (const btn of $('sh-keep').querySelectorAll('button')) btn.onclick = () => set('keep', btn.parentElement.dataset.g, +btn.dataset.d);
    const seg = $('sh-mode');
    if (seg) for (const btn of seg.children) btn.onclick = () => set('fmode', btn.dataset.v);
    if ($('sh-orders')) renderFoundryOrders(b);
    if ($('sh-omode')) for (const btn of $('sh-omode').children) btn.onclick = () => set('omode', btn.dataset.v);
    if ($('sh-pause')) $('sh-pause').onclick = () => set('pause', !b.paused);
    if ($('sh-move')) $('sh-move').onclick = () => {
      if (b.moving) { act('cancelMove', [b.id], () => { toast(`Move cancelled: the ${def.name} stays where it is.`, 'info'); if (!b.dead) openBuildingSheet(b); }); sfx('click'); return; }
      sfx('click'); enterPlaceMode(b.type, b.id);
    };
    if ($('sh-pack')) $('sh-pack').onclick = () => {
      const btn = $('sh-pack');
      if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Tap again: its land goes, and buildings only it covers are lost'; return; }
      sfx('order');
      act('pack', [b.id], (uid) => { const u = uid ? getE(uid) : null; if (u) openBotSheet(u); else closeSheet(); });
    };
    if ($('sh-gate')) $('sh-gate').onclick = () => act('gate', [b.id], (why) => {
      if (why) { sfx('error'); toast(why, 'warn'); return; }
      sfx('place'); toast('The Wall is now a Gate: your bots can pass through it.', 'good'); if (!b.dead) openBuildingSheet(b);
    });
    if ($('sh-aim')) $('sh-aim').onclick = () => { sfx('click'); startAim(b); };
    for (const btn of document.querySelectorAll('#sh-ferry button[data-to]')) btn.onclick = () => {
      const to = +btn.dataset.to;
      act('ferryLine', [b.id, to], (why) => {
        if (why) { sfx('error'); toast(why, 'warn'); return; }
        sfx('click'); toast(to ? 'Ferry line set: your bots take the ferry when it\'s the shorter way.' : 'Ferry line stopped.', 'info'); if (!b.dead) openBuildingSheet(b);
      });
    };
    if ($('sh-air')) for (const btn of $('sh-air').querySelectorAll('button[data-k]')) btn.onclick = () => { const f = freePlane(b); if (!f) return; sfx('click'); startAirdrop(f, btn.dataset.k); };
    if ($('sh-airsup')) for (const btn of $('sh-airsup').children) btn.onclick = () => set('airSupply', btn.dataset.v === '1');
    if ($('sh-land')) {
      UI.landN = clamp(UI.landN || 3, 1, FERRY_SEATS);
      $('sh-land-minus').onclick = () => { UI.landN = Math.max(1, UI.landN - 1); refreshSheet(); };
      $('sh-land-plus').onclick = () => { UI.landN = Math.min(FERRY_SEATS, UI.landN + 1); refreshSheet(); };
      $('sh-land').onclick = () => { const f = portFerry(b); if (!f) return; sfx('click'); startLanding(f, UI.landN); };
      if ($('sh-found')) $('sh-found').onclick = () => { const f = portFerry(b); if (!f) return; sfx('click'); startLanding(f, 0, 'port'); };
    }
    if ($('sh-pipe')) $('sh-pipe').onclick = () => {
      $('sh-pipe').hidden = true;
      act('pipeToRefinery', [b.id], (r) => {
        if (r.why) { sfx('error'); toast(r.why, 'warn'); refreshSheet(); return; }
        const { n, owed } = r;
        sfx('place');
        toast(`Pipe laid from the Oil Pump to the Refinery (${n} tile${n === 1 ? '' : 's'}).` + (owed ? ` ${owed} tile${owed === 1 ? '' : 's'} wait for goods, paid from storage as they come in.` : ''), 'good');
      });
    };
    if ($('sh-pipefuel')) $('sh-pipefuel').onclick = () => {
      $('sh-pipefuel').hidden = true;
      act('pipeToFuel', [b.id], (r) => {
        if (r.why) { sfx('error'); toast(r.why, 'warn'); refreshSheet(); return; }
        const { n, owed } = r;
        sfx('place');
        toast(`Pipe laid to carry Fuel to the ${BDEFS[b.type].name} (${n} tile${n === 1 ? '' : 's'}).` + (owed ? ` ${owed} tile${owed === 1 ? '' : 's'} wait for goods, paid from storage as they come in.` : ''), 'good');
      });
    };
    if ($('sh-gprio')) for (const btn of $('sh-gprio').children) btn.onclick = () => set('gprio', btn.dataset.v);
    if ($('sh-keepw')) for (const btn of $('sh-keepw').children) btn.onclick = () => set('keepW', btn.dataset.v === 'auto' ? null : +btn.dataset.v);
    if ($('sh-hold')) for (const btn of $('sh-hold').children) btn.onclick = () => set('hold', btn.dataset.v === '1');
    if ($('sh-sortie')) $('sh-sortie').onclick = () => {
      sfx('click');
      act('sortie', [b.id], (n) => {
        toast(n ? `${n} warbot${n === 1 ? '' : 's'} going out to fight: they come back in once it's clear.` : 'No warbots with Ammo inside to send out.', n ? 'good' : 'warn');
        refreshSheet();
      });
    };
    if ($('sh-callw')) $('sh-callw').onclick = () => act('callWorker', [b.id], (r) => {
      const u = r.uid ? getE(r.uid) : null;
      if (u) { sfx('order'); toast(r.already ? 'A worker is already on the way.' : 'A worker is on the way.', 'info'); addFx('ring', u.x, u.y, { color: '#ffe45a' }); }
      else { sfx('error'); toast(r.why, 'warn'); }
      refreshSheet();
    });
    if ($('sh-rallypost')) $('sh-rallypost').onclick = () => {
      const bName = BDEFS[b.type].name;
      act('rallyPost', [b.id], (on) => {
        toast(!on ? 'No rally point: new warbots go to the Command Base again.' : `New warbots will gather at this ${bName}.`, 'info');
        refreshSheet();
      });
      sfx('click');
    };
    if ($('sh-unpost')) $('sh-unpost').onclick = () => act('unstation', [b.id], (n) => {
      if (n) { sfx('order'); toast(`${n} warbot${n > 1 ? 's' : ''} heading back to the Command Base. This ${def.name} now keeps none.`, 'info'); } else sfx('error');
      refreshSheet();
    });
    if ($('sh-st-send')) {
      UI.stationN = stationAvailable(ME, b); // as many as it has room for and you can spare
      $('sh-st-minus').onclick = () => { UI.stationN = Math.max(1, UI.stationN - 1); refreshSheet(); };
      $('sh-st-plus').onclick = () => { UI.stationN = Math.min(stationAvailable(ME, b), UI.stationN + 1); refreshSheet(); };
      $('sh-st-send').onclick = () => act('station', [b.id, UI.stationN], (n) => {
        if (n) { sfx('order'); toast(`${n} warbot${n > 1 ? 's' : ''} on the way to the ${def.name}.`, 'info'); } else sfx('error');
        refreshSheet();
      });
    }
    if ($('sh-lim')) {
      $('sh-lim-minus').onclick = () => set('limit', -5);
      $('sh-lim-plus').onclick = () => set('limit', 5);
      $('sh-lim-off').onclick = () => set('limit', 0);
    }
    if ($('sh-demolish')) $('sh-demolish').onclick = () => {
      if (!UI.demolishArm) {
        UI.demolishArm = 1;
        $('sh-demolish').textContent = BDEFS[b.type].mil && b.built ? 'Tap again: buildings outside your border will be lost' : 'Tap again to confirm';
        return;
      }
      // Say what's left in crates: all its materials, and anything that was inside it.
      const def = BDEFS[b.type], built = b.built, bx = b.x, by = b.y;
      sfx('collapse');
      closeSheet();
      act('demolish', [b.id], (out) => {
        if (!out) return;
        const mats = Object.keys(out.cost).length ? costText(out.cost) : '';
        if (built) toast(`${def.name} dismantled: ` + (mats ? `its materials (${mats})` : 'it') + (out.inside ? ` and the ${out.inside} good${out.inside === 1 ? '' : 's'} inside` : '') +
          ` ${mats || out.inside ? 'are left in crates for your haulers to bring back' : 'is gone'}.`, 'info', bx, by);
        else if (out.crates) toast(`${def.name} site cancelled: the ${out.crates} good${out.crates === 1 ? '' : 's'} delivered for it ${out.crates === 1 ? 'is' : 'are'} left in crates for your haulers to bring back.`, 'info', bx, by);
      });
    };
  } else if ($('sh-send')) {
    UI.attackN = attackAvailable(ME, b);
    $('sh-minus').onclick = () => { UI.attackN = Math.max(1, UI.attackN - 1); refreshSheet(); };
    $('sh-plus').onclick = () => { UI.attackN = Math.min(attackAvailable(ME, b), UI.attackN + 1); refreshSheet(); };
    $('sh-send').onclick = () => act('sendAttack', [b.id, UI.attackN], (n) => {
      if (n > 0) {
        sfx('order');
        toast(`${n} warbot${n > 1 ? 's' : ''} sent to attack the ${def.name}.`, 'info');
        closeSheet();
      }
    });
    $('sh-fire').onclick = () => act('fireMissile', [b.id], (ok) => {
      if (ok) { toast(`Missile away: it will hit the ${def.name} in a few seconds.`, 'info'); refreshSheet(); }
      else sfx('error');
    });
    if ($('sh-bomb')) $('sh-bomb').onclick = () => {
      const u = readyBomber(b);
      if (!u) { sfx('error'); toast('No Strike Bomber is ready that can reach it.', 'warn'); return; }
      act('strike', [u.id, b.id], (why) => {
        if (why) { sfx('error'); toast(why, 'warn'); return; }
        sfx('order'); toast(`Strike ordered on the ${def.name}: a bomber loads up and takes off.`, 'good'); refreshSheet();
      });
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
    const n = repairCost(b), can = playerGoods(ME).cement >= n;
    key = 'btn' + n + can + (S.time - (b.lastHit || -99) < 3);
    html = `<button class="btn primary big" id="sh-fixbtn" ${can ? '' : 'disabled'}>Repair: ${n} Cement</button>
      <p class="hint">${can ? 'A free worker comes and restores its armor.' : `Not enough Cement: repairing it takes ${n}.`}${S.time - (b.lastHit || -99) < 3 ? ' It is under attack right now.' : ''}</p>`;
  }
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.innerHTML = html;
  if ($('sh-fixbtn')) $('sh-fixbtn').onclick = () => act('repair', [b.id], (why) => {
    if (why) { sfx('error'); toast(why, 'warn'); } else { sfx('click'); toast(`Repair ordered: a worker is coming to fix the ${def.name}.`, 'info'); }
    el.dataset.key = '';
    refreshSheet();
  });
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
  const route = roadRouteTo(ME, b);
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
  const can = canAffordRoad(ME, route.goods);
  const key = route.join(',');
  if (el.dataset.key === key + can) return;
  el.dataset.key = key + can;
  const short = Object.keys(route.goods).filter((g) => !canAffordRoad(ME, { [g]: route.goods[g] })).map((g) => GOOD[g].name);
  const cross = route.cross ? ` It crosses water or rock: ${route.cross} tile${route.cross === 1 ? '' : 's'} of bridge or tunnel.` : '';
  el.innerHTML = `<div class="road-warn"><b>No road to storage.</b> ${what}. The dashed tiles show the shortest road${route.pending ? ` (${route.pending} more already planned)` : ''}; free workers pave it once it's planned.${cross}
    <button class="btn primary" id="sh-layroad" ${can ? '' : 'disabled'}>Lay road: ${route.length} tile${route.length === 1 ? '' : 's'}, ${costText(route.goods)}</button>
    ${can ? '' : `<span class="err">Not enough ${short.join(' or ')}${short.includes('Cement') ? ': build a Cement Works' : ''}.</span>`}</div>`;
  $('sh-layroad').onclick = () => act('layRoad', [b.id], ({ laid, why }) => {
    if (why) { sfx('error'); toast(why, 'warn'); } else { sfx('place'); toast(`Planned ${laid} road tile${laid === 1 ? '' : 's'}: free workers will pave them.`, 'info'); }
    el.dataset.key = '';
    refreshSheet();
  });
}

function refreshBuildingSheet(b) {
  const def = BDEFS[b.type];
  const mine = b.owner === ME;
  if (mine && def.terminal && b.built) renderTrade(b);
  if (mine && def.yard && b.built) renderYard(b);
  const parts = [];
  if (mine && def.lab && $('sh-research')) refreshResearch();
  const gun = mine && b.underFire && !BDEFS[b.type].war ? gunOver(ME, b.x, b.y) : null;
  const foes = mine && !gun && !BDEFS[b.type].war && !(def.staff && b.staff) && foesAt(b); // (a staffed building says so itself)
  $('sh-status').textContent = gun ? `Under enemy fire: an enemy ${BDEFS[gun.type].name} covers it, so your robots keep clear until the gun is destroyed or runs dry.`
    : foes ? `${S.wildlife ? 'The Murmur are' : 'Enemy warbots'} about: your workers and haulers keep clear of it until they've gone${S.wildlife ? '' : ' (send warbots to drive them off)'}.`
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
      const nets = buildingNets(b), net = roadNet(b.owner), all = paveMode(b) === 'all';
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
      parts.push(`<p class="desc err"><b>Nothing left to ${def.farm ? 'farm' : 'gather'} in reach.</b> Dismantle it (below): its materials and anything still in it are left in crates for your haulers to bring back. Then build a new ${def.name} ${def.farm ? 'beside open fertile soil' : `by a fresh field of ${RES[def.gather].name.toLowerCase()}s`}.</p>`);
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
      if (mine && pumpDry(b)) parts.push('<p class="desc err"><b>This seep has run dry.</b> Dismantle the pump (below): its materials and any Crude still in it are left in crates for your haulers to bring back. Then build a new Oil Pump on another oil seep.</p>');
      parts.push(`<div class="kv"><span>Crude left in the seep</span><span>${oilAround(b.x, b.y)}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag('crude', `${b.stock.crude || 0}/${def.out.crude}`)}</span></div>`);
      if (mine) {
        const joined = refineryPipes(ME), ns = buildingPipes(b);
        parts.push(`<div class="kv"><span>Pipeline</span><span>${ns.some((c) => joined.has(c)) ? 'to a Refinery' : b.piped ? 'to storage' : ns.length ? 'goes nowhere yet' : 'none: a Tanker collects'}</span></div>`);
      }
      if (mine && b.timer > 0 && /^Working/.test(b.status || '')) parts.push(`<div class="bar"><div style="width:${Math.round((b.timer / def.work) * 100)}%"></div></div>`);
    }
    if (mine && b.built && fuelUser(def)) {
      const fp = fuelPipes(ME), ns = buildingPipes(b);
      parts.push(`<div class="kv"><span>Fuel comes</span><span>${b.fuelByPipe ? 'by pipe' : ns.some((c) => fp.has(c)) ? 'by pipe (none to give just now)' : 'by Tanker'}</span></div>`);
    } else if (mine && b.built && fuelMaker(def) && buildingPipes(b).length) {
      parts.push(`<div class="kv"><span>Fuel goes</span><span>${b.pipedFuel ? 'by pipe, to storage and what burns it' : 'by pipe to what burns it; a Tanker takes the rest'}</span></div>`);
    }
    if (def.inp && mine && !def.pump) {
      const ins = Object.keys(def.inp).map((g) => goodTag(g, `${b.stock[g] || 0}/${def.hopper || INPUT_CAP}`, !(b.stock[g] > 0))).join(''); // (what it keeps on hand: a Smelter keeps 6)
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
      const sb = !def.store && stationBeside(b);
      if (sb && stationLinks(sb).some((l) => l.c === b)) parts.push(`<div class="kv"><span>Rail Station</span><span>joined by conveyor: it hands this its goods${def.out ? ' and takes its output' : ''}</span></div>`);
      else if (b.railBy) {
        const sv = getE(b.railBy);
        if (sv && sv.type === 'depot') parts.push(`<div class="kv"><span>Supplied by Road Train</span><span>through the Depot ${dirText(b, sv)}</span></div>`);
        else parts.push(`<div class="kv"><span>Supplied by rail</span><span>from the Rail Station ${dirText(b, sv || b)}</span></div>`);
      }
    }
    if (def.store && mine && !def.terminal) {
      let idle = 0;
      for (const u of S.bots) if (!u.dead && u.inside === b.id && u.type === 'worker') idle++;
      parts.push(`<div class="kv"><span>Workers resting here</span><span>${idle}</span></div>`);
    }
    if (def.mil) {
      parts.push(`<div class="kv"><span>${mine ? 'Warbots inside' : 'Defenders inside'}</span><span>${b.garrison.length} / ${def.garrison}</span></div>`);
      if (b.garrison.length) parts.push(`<div class="kv"><span>Made up of</span><span>${garrisonMix(b)}</span></div>`);
    }
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
  if ($('sh-rallypost')) { const on = S.players[ME].rallyPost === b.id; $('sh-rallypost').textContent = on ? '⚑ Rally point for new warbots (tap to clear)' : 'Make this the rally point for new warbots'; $('sh-rallypost').classList.toggle('primary', on); }
  if ($('sh-keepw')) for (const btn of $('sh-keepw').children) btn.classList.toggle('on', btn.dataset.v === (b.keepW === undefined ? 'auto' : String(b.keepW)));
  if ($('sh-hold')) {
    for (const btn of $('sh-hold').children) btn.classList.toggle('on', (btn.dataset.v === '1') === !!b.hold);
    $('sh-hold-hint').textContent = b.hold
      ? 'Holding: its warbots stay inside whatever comes near, until you send them out with the button below (if it falls, they scramble out). Attack orders and rally flags can still take them.'
      : `Its warbots go out by themselves to fight ${S.wildlife ? 'enemy warbots and the Murmur' : 'enemy warbots'} that come near, and come back in once it's clear (every one of them when it's about to fall).`;
    const armed = armedIn(b), foe = sortieTarget(b), sb = $('sh-sortie');
    sb.disabled = !armed || !foe;
    sb.textContent = !armed ? 'Send them out to fight (no armed warbots inside)' : !foe ? 'Send them out to fight (no enemies near it)' : `Send ${armed} out to fight`;
  }
  if ($('sh-st-n')) {
    const avail = stationAvailable(ME, b), coming = b.garInc || 0;
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
      for (const u of S.bots) if (!u.dead && u.owner === ME && isArmy(u) && !postOf(u)) { if (u.inside === b.id) home++; else out++; }
      $('sh-posted').textContent = `${home} warbot${home === 1 ? '' : 's'} here${out ? `, ${out} more out or on the way (they belong here)` : ''}. Warbots not stationed at an Outpost belong to the Command Base.`;
    } else {
      let inside = 0, out = 0;
      for (const u of S.bots) if (!u.dead && u.owner === ME && u.post === b.id) { if (u.inside === b.id) inside++; else out++; }
      $('sh-posted').textContent = inside + out ? `${inside + out} (${inside} inside${out ? `, ${out} out or on the way` : ''})` : 'None';
      if ($('sh-unpost')) $('sh-unpost').disabled = !(inside + out);
    }
  }
  if ($('sh-lim')) {
    const lim = stockLimit(b), g = limitGood(b), have = goodTotal(ME, g);
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
      empty: 'Takes nothing new and sends what it holds to your other storage. Good before dismantling it.',
    }[m];
  }
  if ($('sh-accept')) for (const btn of $('sh-accept').children) {
    const g = btn.dataset.g;
    btn.classList.toggle('off', !!(b.reject && b.reject[g]) || b.smode === 'empty');
    btn.lastElementChild.textContent = b.stock[g] || 0;
  }
  if ($('sh-land-n')) $('sh-land-n').textContent = UI.landN || 3;
  if ($('sh-port-ships')) $('sh-port-ships').textContent = portShipsText(b);
  // Your ships tied up here, and trains stopped at a Rail Station, one button each: tap to take charge of it (it
  // can't be tapped on the map while it's inside).
  hereButtons($('sh-port-shipbtns'), b, (u) => BOTS[u.type].sea);
  hereButtons($('sh-yard-here'), b, (u) => BOTS[u.type].rail);
  if ($('sh-air-fuel')) {
    $('sh-air-fuel').textContent = airFuelText(b);
    $('sh-air-fbar').firstElementChild.style.width = `${Math.round(clamp(((b.stock.fuel || 0) - (b.res.fuel || 0)) / AIRFIELD_FUEL, 0, 1) * 100)}%`;
    $('sh-air-fbar').firstElementChild.style.background = 'var(--g-fuel)';
  }
  if ($('sh-air-planes')) {
    const ps = basePlanes(b).filter((u) => !BOTS[u.type].bomber);
    $('sh-air-planes').textContent = ps.length ? ps.map((u) => `Its plane is ${planeStatus(u)}.` + (/Fuel/.test(planeStatus(u)) ? '' : ` Fuel tank ${Math.round(u.bat ?? 100)}%.`)).join(' ') : 'None based here: order one in the hangar below.';
    $('sh-air-pgauge').innerHTML = ps.map(fuelGauge).join('');
  }
  if ($('sh-air-bombers')) {
    const bs = basePlanes(b).filter((u) => BOTS[u.type].bomber), el = $('sh-air-bombers');
    const sig = bs.map((u) => u.id + ':' + planeStatus(u) + ':' + Math.round(u.bat ?? 100)).join('|');
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig;
      el.innerHTML = bs.length ? bs.map((u, k) => `<div class="kv trade-row"><span>Bomber ${k + 1}<small>${planeStatus(u)} · Fuel tank ${Math.round(u.bat ?? 100)}%</small>${fuelGauge(u)}</span><button class="btn small primary" data-b="${u.id}" ${u.mission || u.flight ? 'disabled' : ''}>Strike</button></div>`).join('') +
        `<p class="hint">A sortie takes ${BOMBER.ammo} Ammo (this Airfield keeps some for them; haulers bring it) and ${BOMBER.fuel} Fuel on top of what its tank needs (Tankers bring it): it can't take off without both. Back on the ground a bomber needs ${BOMBER.rearm} s to rearm. Or open a rival building and tap <b>Bomb it</b>.</p>`
        : '<p class="hint">None based here: order Strike Bombers in the hangar below (two fit).</p>';
      for (const btn of el.querySelectorAll('button[data-b]')) btn.onclick = () => { const u = getE(+btn.dataset.b); if (u) { sfx('click'); startStrike(u); } };
    }
  }
  if ($('sh-air-places')) $('sh-air-places').textContent = airPlacesText(b);
  if ($('sh-airsup')) { for (const btn of $('sh-airsup').children) btn.classList.toggle('on', (btn.dataset.v === '1') === !!b.airSupply); $('sh-airsup-hint').textContent = airSupplyHint(b); }
  if ($('sh-dauto-status')) {
    for (const btn of $('sh-auto').children) btn.classList.toggle('on', (btn.dataset.v === '1') === !b.autoOff);
    $('sh-dauto-status').innerHTML = depotAutoText(b);
    $('sh-dauto-hint').textContent = `Auto supply: a Depot ${TRUCK_MIN_DIST} or more tiles from your Command Base keeps what the factories, garrisons and building sites round it need (twice what a factory holds, what a site still lacks, never what they make), and a Road Train brings it from home once that makes a load (${TRAIN_MIN_LOAD} or more), several goods a trip, taking the Depot's spare goods home. Haulers do the short hop to each building. Supply orders you set below come on top.`;
  }
  if ($('sh-rail-status')) {
    for (const btn of $('sh-auto').children) btn.classList.toggle('on', (btn.dataset.v === '1') === !b.autoOff);
    $('sh-rail-status').innerHTML = railStatusText(b);
    $('sh-rail-hint').textContent = 'Auto supply: a far station stocks what the buildings round it need, and the station nearest your Command Base keeps what the far stations want, so Freight Trains run the line on their own, several goods a trip. Buildings, a Command Base or a Depot touching a station are joined to it by conveyor: no Hauler needed. Supply orders you set below come on top.';
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
    for (const u of S.bots) if (!u.dead && u.owner === ME && BOTS[u.type].truck && !BOTS[u.type].train && !BOTS[u.type].tanker) trucks++; // Road Trains only run to far Depots
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
    const silos = silosInRange(ME, b), ready = silos.filter(siloReady);
    const minReload = silos.reduce((m, q) => (q.reload > 0 && q.stock.warhead > 0 ? Math.min(m, q.reload) : m), Infinity);
    $('sh-fire').disabled = !ready.length;
    $('sh-missile').innerHTML = `<p class="desc">${!silos.length
      ? `No Missile Silo within ${BDEFS.silo.missile.range} tiles. Build a Silo near the front and a Missile Factory to make Missiles.`
      : ready.length
        ? `${ready.length} silo${ready.length > 1 ? 's' : ''} ready. A missile wrecks smaller buildings and knocks Outposts and Command Bases down to a third of their armor, ready for warbots to finish off.`
        : minReload < Infinity ? `Silos in range are reloading (${Math.ceil(minReload)}s).` : 'Silos in range have no Missiles. Build them at a Missile Factory (Alloy, Chips and Fuel).'}</p>`;
  }
  if ($('sh-send')) {
    const avail = attackAvailable(ME, b);
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
  const el = $('sh-research'), P = S.players[ME], r = P.research, have = spendable(ME);
  const key = (r ? r.key : '-') + TECH_ORDER.map((k) => (tech(ME, k) ? 'd' : canPay(ME, TECHS[k].cost) ? 'y' : 'n')).join('');
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.innerHTML = (r
      ? `<div class="research-now"><div class="kv"><span>Researching <b>${TECHS[r.key].name}</b></span><button class="btn small ghost" id="sh-rcancel">Cancel</button></div><div class="bar"><div id="sh-rbar"></div></div></div>`
      : '<p class="hint">Pick an upgrade: its cost comes out of storage now, and a worker in the Lab researches it. Every upgrade lasts the whole game.</p>') +
      `<div class="tech-list">${TECH_ORDER.map((k) => {
        const d = TECHS[k], done = tech(ME, k), now = r && r.key === k;
        return `<div class="tech${done ? ' done' : ''}${now ? ' now' : ''}"><div class="tech-head"><b>${d.name}</b><span>${done ? 'Done ✓' : `${d.time} s`}</span></div><p>${d.desc}</p>` +
          (done ? '' : `<div class="tech-foot"><span class="bcost">${costHTML(d.cost, have)}</span>${now ? '<span class="ok">Under way</span>'
            : `<button class="btn small${r ? '' : ' primary'}" data-k="${k}" ${r || !canPay(ME, d.cost) ? 'disabled' : ''}>Research</button>`}</div>`) + '</div>';
      }).join('')}</div>`;
    for (const btn of el.querySelectorAll('button[data-k]')) btn.onclick = () => act('research', [btn.dataset.k], (why) => {
      if (why) { sfx('error'); toast(why, 'warn'); } else { sfx('order'); toast(`Research started: ${TECHS[btn.dataset.k].name}.`, 'info'); }
      el.dataset.key = '';
      refreshSheet();
    });
    if ($('sh-rcancel')) $('sh-rcancel').onclick = () => {
      act('cancelResearch', [], () => { el.dataset.key = ''; refreshSheet(); });
      sfx('click'); toast('Research called off: its cost is back in your Command Base.', 'info');
    };
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
  const versus = warOn(), shows = (k) => (versus || !BOTS[k].war) && !BOTS[k].sea && !BOTS[k].rail && !BOTS[k].air && !BOTS_OFF.has(k), kinds = foundryList(b).filter(shows); // ships, trains and planes come from yards (and switched-off types from nowhere)
  el.innerHTML = kinds.map((k, i) => `<div class="order-row" data-k="${k}">
    <span class="order-move"><button class="btn ghost" data-k="${k}" data-m="-1" aria-label="Move ${BOTS[k].plural} up" ${i ? '' : 'disabled'}>▲</button><button class="btn ghost" data-k="${k}" data-m="1" aria-label="Move ${BOTS[k].plural} down" ${i < kinds.length - 1 ? '' : 'disabled'}>▼</button></span>
    <span>${BOTS[k].plural}<small id="sh-o-${k}">none queued</small></span>
    <button class="btn" data-k="${k}" data-d="1">+1</button><button class="btn" data-k="${k}" data-d="5">+5</button>
    <button class="btn ghost" data-k="${k}" data-d="0">Clear</button></div>`).join('');
  for (const btn of el.querySelectorAll('button')) btn.onclick = () => {
    const k = btn.dataset.k;
    if (btn.dataset.m) {
      act('foundryMove', [b.id, k, +btn.dataset.m, kinds], () => { renderFoundryOrders(b); refreshSheet(); });
      sfx('click');
      return;
    }
    act('foundryOrder', [b.id, k, +btn.dataset.d], () => refreshSheet());
    sfx('click');
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
  if (isArmy(u)) {
    const p = u.owner === ME && usesPosts(ME) ? postOf(u) : null;
    const where = u.owner !== ME ? '' : p ? ` (stationed at the ${BDEFS[p.type].name})` : ' (belongs to the Command Base)';
    const what = (() => {
      if (u.fight) return 'Fighting!';
      if (!t) return u.inside ? 'Standing guard inside' : 'Waiting for orders: no garrison with room';
      if (t.type === 'garrison') return `Marching to the ${nm(t.bld)}`;
      if (t.wait > S.time) return 'Waiting to set off with its squad'; // (staggered departure: paceSquad)
      if (t.type === 'attack' && t.reload) return u.type === 'torch' ? 'Tank empty: refilling it, then back to the attack' : 'Out of Ammo: reloading, then back to the attack';
      if (t.type === 'attack') return `Attacking the rival ${nm(t.target)}`;
      if (t.type === 'defend' && t.ax !== undefined) return `Defending a building near the ${nm(t.home)}`; // (area defence: garrisonDefense)
      if (t.type === 'defend') return `Defending the ${nm(t.home)}`;
      if (t.type === 'hold') return t.phase === 'recharge' ? 'Battery flat: going to recharge' : t.target ? `Attacking the rival ${nm(t.target)}` : 'Holding the rally point';
      if (t.type === 'repair') return u.retreat ? 'Badly hurt: pulling out of the fight for repairs' + (u.resume ? ', then back to it' : '') : 'Going for repairs';
      if (t.type === 'topup') return 'Topping up its battery';
      if (t.type === 'refill') return `Tank empty: going to refill it with Fuel at the ${nm(t.bld)}` + (u.resume ? ', then back to it' : '');
      if (t.type === 'loot') return t.phase === 'home' ? 'Carrying a crate of loot home' : 'Going to pick up loot';
      return 'On patrol';
    })();
    return what + where;
  }
  if (BOTS[u.type].rail && u.armorOrder) {
    const st = u.inside ? getE(u.inside) : null;
    if (st && BDEFS[st.type].station) return `Having its armor fitted at the ${BDEFS[st.type].name}`;
    if (!t) return 'Heading to a Rail Station to have its armor fitted';
  }
  if (u.shyUntil > S.time && gunShy(u) && !(t && t.type === 'staff')) {
    const who = u.shyOf === 'wild' ? 'the Murmur' : 'enemy warbots';
    return t && t.type === 'home' ? `Keeping clear of ${who}: taking cover in storage` : `Keeping clear of ${who}: waiting for them to go`;
  }
  if (t && t.type === 'charge') return u.inside ? 'Recharging its battery' : 'Going to recharge its battery';
  if (t && t.type === 'refuel') return 'Going to fill up with Fuel';
  if (t && t.type === 'staff' && (t.phase === 'toCharge' || t.phase === 'charging')) return t.phase === 'charging' ? 'Recharging its battery' : 'Going to recharge its battery';
  if (!t) return u.carry ? `Looking for somewhere to store ${GOOD[u.carry].name}` : u.inside ? 'Resting in storage' : 'Waiting for a job';
  if (t.type === 'home') return 'Heading back to storage';
  if (t.type === 'haul') return t.phase === 'toSrc' ? `Fetching ${GOOD[t.good].name} from the ${nm(t.src)}` : `Delivering ${GOOD[t.good].name} to the ${nm(t.dst)}`;
  if (t.type === 'build') { const a = getE(t.site) ? aOrAn(nm(t.site)) : 'a building'; return t.phase === 'go' ? `Walking to build ${a}` : `Constructing ${a}`; }
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
  $('sh-bomb-hint').textContent = u ? (bot ? `A Strike Bomber is ready: it flies out, leads it if it's moving and drops one bomb (a direct hit does ${BOMBER.botDamage * 2}; ${BOMBER.ammo} Ammo and ${BOMBER.fuel} Fuel a sortie). Flak Guns can shoot it down.`
      : `A Strike Bomber is ready: it drops one bomb (${BOMBER.damage} off the target; ${BOMBER.ammo} Ammo and ${BOMBER.fuel} Fuel a sortie). Flak Guns can shoot it down.`)
    : bot && (t.inside || t.dropping) ? 'It\'s under cover: bombers only hit vehicles and robots out in the open.'
      : any.some((v) => v.mission || v.flight) ? 'Your bombers are out on sorties.' : any.some((v) => v.rearmUntil > S.time) ? 'Your bombers are rearming.' : 'Out of your bombers\' reach.';
}

/** The Armor section of one of your Freight Trains' panels (see TRAIN_ARMOR). */
function refreshTrainArmor(u) {
  const A = TRAIN_ARMOR, btn = $('sh-tarmor'), hint = $('sh-tarmor-hint'), less = Math.round((1 - A.takes) * 100);
  if (u.armored) {
    btn.hidden = true;
    hint.innerHTML = `<b>Armored.</b> Its plating gives it ${A.hp} more hit points and it takes ${less}% less damage. A pulse cannon on the locomotive shoots enemy robots and vehicles within ${A.pulse.range} tiles, and a flak gun on the last wagon enemy aircraft within ${A.flak.range}. Both run off the engine: no ammo to bring.`;
    return;
  }
  if (u.armorOrder) {
    btn.hidden = true;
    const st = u.inside ? getE(u.inside) : null;
    hint.textContent = st && BDEFS[st.type].station ? `Being fitted at the ${BDEFS[st.type].name}: ${Math.max(1, Math.ceil(A.fit - (u.armorOrder.t || 0)))}s to go.`
      : 'Paid for: it finishes its run and stops at a Rail Station, where the yard fits the armor and guns.';
    return;
  }
  const have = playerGoods(ME), ok = Object.keys(A.cost).every((g) => (have[g] || 0) >= A.cost[g]);
  btn.hidden = false;
  btn.disabled = !ok;
  btn.textContent = `Armor this train (${costText(A.cost)})`;
  hint.textContent = `Plating and two guns, paid from storage and fitted at a Rail Station (it stops there about ${A.fit}s): ${A.hp} more hit points and ${less}% less damage, a pulse cannon for enemy robots and vehicles, and a flak gun for aircraft.` + (ok ? '' : ' Not enough in storage yet.');
}

/** Does bot u run on a fuel tank, filled with Fuel (trucks, ships and planes), rather than a battery? */
function tankOf(u) { const bt = BOTS[u.type]; return !!(bt.truck || bt.sea || bt.air); }

/** A Bulwark's shield in its robot panel: strength and a purple bar, or how long until it's back after failing. */
function shieldRows(u) {
  const sh = Math.max(0, u.sh ?? BULWARK.shield), down = u.shDown && u.shDown > S.time;
  return `<div class="kv"><span>Shield</span><span>${down ? `down: back in ${Math.ceil(u.shDown - S.time)}s` : `${Math.round(sh)} / ${BULWARK.shield}${sh < BULWARK.shield && S.time - (u.shHit ?? -99) <= BULWARK.wait ? ' (taking fire)' : sh < BULWARK.shield ? ' (recharging)' : ''}`}</span></div>` +
    `<div class="bar battery"><div style="width:${down ? 0 : Math.round(100 * sh / BULWARK.shield)}%;background:#b77bff"></div></div>`;
}

function openBotSheet(u) {
  R.selected = 0; R.selTile = -1; UI.selBot = u.id;
  const html = `<div class="sheet-title"><div><h3>${BOTS[u.type].name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[u.owner]}"></span> ${u.owner === ME ? 'Yours' : playerName(u.owner)}</div></div></div>
    <p class="desc">${BOTS[u.type].desc}</p>
    <div class="status" id="sh-status"></div><div id="sh-dyn"></div>
    ${u.owner === ME && isArmy(u) ? '<button class="btn big" id="sh-recall" hidden>Call back this squad</button>' : ''}
    ${u.owner === ME && BOTS[u.type].bomber ? '<button class="btn primary big" id="sh-strike">Pick a target</button>' : ''}
    ${foes(u.owner, ME) && u.owner >= 0 && !BOTS[u.type].wild && !BOTS[u.type].air && myBombers().length ? '<div class="section-label">Air strike</div><p class="hint" id="sh-bomb-hint"></p><button class="btn big" id="sh-bomb">Bomb it</button>' : ''}
    ${u.owner === ME && BOTS[u.type].ferry ? `<button class="btn big" id="sh-fout"${u.inside && !u.landing ? '' : ' hidden'}>Sail out of the Port</button>
      <div class="actions"><button class="btn primary" id="sh-fsail">Sail somewhere</button><button class="btn" id="sh-fhome">Back to its line</button></div>
      <div class="actions"><button class="btn" id="sh-fembark">Take warbots aboard</button><button class="btn" id="sh-fland">Put them ashore</button></div>
      <button class="btn" id="sh-found">Found a Port on another shore</button>
      <p class="hint"><b>Sail out of the Port</b>: tied up, it sails out to wait just off the Port, where you can tap it on the map. <b>Sail somewhere</b>: it sails to the spot you tap (open water, or right up to a shore) and waits there for your orders; with a mouse, right-click the water while its panel is open. <b>Take warbots aboard</b> loads your warbots standing within ${Math.floor(FERRY_REACH)} tiles of it (with a mouse, select warbots and right-click the Ferry: they walk to the shore beside it and board). <b>Put them ashore</b> lands them on the shore beside it, and it heads home. <b>Found a Port</b>: it loads ${costText(PORT_FOUND.cost)} at its Port and up to ${PORT_FOUND.workers} Workers, and puts up a Port on an empty shore that claims the land round it.</p>` : ''}
    ${u.owner === ME && BOTS[u.type].rail ? '<div class="section-label">Armor</div><p class="hint" id="sh-tarmor-hint"></p><button class="btn big" id="sh-tarmor">Armor this train</button>' : ''}
    ${u.owner === ME && BOTS[u.type].crawler ? '<div class="actions"><button class="btn primary" id="sh-crawl">Drive somewhere</button><button class="btn" id="sh-deploy">Deploy here</button></div>' : ''}
    ${u.owner === ME && BOTS[u.type].siege ? `<div class="actions"><button class="btn primary" id="sh-bombard">Bombard a building</button><button class="btn" id="sh-rgo">Drive somewhere</button></div>
      <div class="section-label">While it waits</div><div class="seg" id="sh-stance"><button data-v="fire">Fire at will</button><button data-v="hold">Hold fire</button></div>
      <p class="hint">It stays where you put it (beside the Foundry when it's new). <b>Fire at will</b>: it shells any enemy building that comes in reach of that spot, without moving. <b>Hold fire</b>: it fires only when you tell it to. After reloading it goes back to its target, or to its spot. With a mouse, select it and right-click a rival building to bombard it, or open ground to move it there.</p>` : ''}`;
  openSheet('bot', u.id, html + flavorLine(u.type));
  if ($('sh-tarmor')) $('sh-tarmor').onclick = () => act('trainArmor', [u.id], (r) => {
    if (r) { sfx('error'); toast(r, 'warn'); } else { sfx('order'); toast('Armor paid for: the train finishes its run, stops at a Rail Station and the yard fits the plating and guns.', 'info'); }
    refreshSheet();
  });
  if ($('sh-bomb')) $('sh-bomb').onclick = () => {
    const v = readyBomber(u);
    if (!v) { sfx('error'); toast('No Strike Bomber is ready that can reach it.', 'warn'); return; }
    act('strike', [v.id, u.id], (why) => {
      if (why) { sfx('error'); toast(why, 'warn'); return; }
      sfx('order'); toast(`Strike ordered on the ${BOTS[u.type].name}: a bomber loads up, takes off and hunts it down.`, 'good'); refreshSheet();
    });
  };
  if ($('sh-strike')) $('sh-strike').onclick = () => { const why = u.mission || u.flight ? 'It\'s already out on a sortie.' : ''; if (why) { sfx('error'); toast(why, 'warn'); return; } sfx('click'); startStrike(u); };
  if ($('sh-fsail')) {
    const done = (r, ok) => { if (typeof r === 'string' && r) { sfx('error'); toast(r, 'warn'); } else { sfx('order'); if (ok) toast(ok, 'info'); } refreshSheet(); };
    $('sh-fsail').onclick = () => { sfx('click'); closeSheet(); setMode('fsail'); UI.ferry = u.id; showBanner('Tap where the <b>Ferry</b> should sail: open water, a spot on the shore (it comes right up to it), or one of your Ports.', null, 'Cancel'); };
    $('sh-fhome').onclick = () => act('ferryBack', [u.id], () => done('', 'The Ferry is heading back to its Port and its line.'));
    $('sh-fout').onclick = () => act('sailOut', [u.id], (r) => done(r, 'The Ferry is sailing out to wait just off the Port: tap it on the map (or right-click the water with its panel open) to send it somewhere.'));
    $('sh-fembark').onclick = () => act('embark', [u.id], (r) => done(r, typeof r === 'number' ? `${r} warbot${r === 1 ? '' : 's'} came aboard.` : ''));
    $('sh-fland').onclick = () => act('disembark', [u.id], (r) => done(r, 'Put ashore: they hold the beach, and the Ferry heads home.'));
    $('sh-found').onclick = () => { sfx('click'); startLanding(u, 0, 'port'); };
  }
  if ($('sh-crawl')) $('sh-crawl').onclick = () => { sfx('click'); UI.crawler = u.id; setMode('crawl'); UI.crawler = u.id; showBanner('Tap where the <b>Crawler</b> should go: it rolls there (no road needed, but it can\'t climb cliffs or cross water) and deploys when it arrives.', null, 'Cancel'); };
  if ($('sh-deploy')) $('sh-deploy').onclick = () => act('deploy', [u.id], (why) => { if (why) { sfx('error'); toast(why, 'warn'); } else closeSheet(); });
  if ($('sh-bombard')) $('sh-bombard').onclick = () => { sfx('click'); closeSheet(); setMode('bombard'); UI.rocket = u.id; showBanner(`Tap an enemy building: the <b>Howitzer</b> drives to within ${ROCKET.range} tiles of it, digs in and shells it, one heavy shell after another, until it's rubble.`, null, 'Cancel'); };
  if ($('sh-stance')) {
    const sync = () => { for (const btn of $('sh-stance').children) btn.classList.toggle('on', btn.dataset.v === (u.stance === 'hold' ? 'hold' : 'fire')); };
    for (const btn of $('sh-stance').children) btn.onclick = () => { act('stance', [u.id, btn.dataset.v === 'hold'], () => sync()); sfx('click'); };
    sync();
  }
  if ($('sh-rgo')) $('sh-rgo').onclick = () => { sfx('click'); closeSheet(); setMode('rgo'); UI.rocket = u.id; showBanner('Tap where the <b>Howitzer</b> should wait: it stays there, and (unless it holds fire) shells any enemy building in reach of it.', null, 'Cancel'); };
  if ($('sh-recall')) $('sh-recall').onclick = () => {
    if (u.task && u.task.type === 'hold') act('recallRally', [u.task.rally], (n) => toast(`${n} warbot${n > 1 ? 's' : ''} called back.`, 'info'));
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
  UI.moveN = Math.min(5, rallyAvailable(ME, i, j));
  $('mv-minus').onclick = () => { UI.moveN = Math.max(1, UI.moveN - 1); refreshSheet(); };
  $('mv-plus').onclick = () => { UI.moveN = Math.min(rallyAvailable(ME, i, j), UI.moveN + 1); refreshSheet(); };
  $('mv-send').onclick = () => act('rally', [i, j, UI.moveN], (res) => {
    if (res.sent) { sfx('order'); toast(`${res.sent} warbot${res.sent > 1 ? 's are' : ' is'} on the way. Tap the flag to call them back.`, 'info'); closeSheet(); }
    else sfx('error');
  });
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
  UI.moveN = Math.min(3, rallyAvailable(ME, i, j));
  $('rl-recall').onclick = () => { act('recallRally', [r.id], (n) => toast(`${n} warbot${n !== 1 ? 's' : ''} called back.`, 'info')); sfx('click'); closeSheet(); };
  $('mv-minus').onclick = () => { UI.moveN = Math.max(1, UI.moveN - 1); refreshSheet(); };
  $('mv-plus').onclick = () => { UI.moveN = Math.min(rallyAvailable(ME, i, j), UI.moveN + 1); refreshSheet(); };
  $('mv-send').onclick = () => act('rally', [i, j, UI.moveN], (res) => { if (res.sent) { sfx('order'); refreshSheet(); } else sfx('error'); });
  refreshSheet();
}

/** Shared stepper refresh for the move and rally panels. */
function refreshMoveStepper(i, j) {
  const avail = rallyAvailable(ME, i, j);
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
  return S.road[t] ? wayOwner(t) === ME : S.plan[t] === ME + 1;
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
  $('rd-mark').onclick = () => { act('paveMark', [t % S.W, (t / S.W) | 0, !S.paveMark[t]], () => refreshSheet()); sfx('click'); };
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
    <div class="btn-row"><button class="btn primary" id="sh-dock">Dock a Trade Terminal here</button></div>${flavorLine('post')}`;
  openSheet('post', t, html);
  $('sh-dock').onclick = () => { sfx('click'); enterPlaceMode('terminal'); };
  refreshSheet();
}

/** A neutral Uplink's panel: whose it is, whether it's jammed, and how to take it. */
function openUplinkSheet(u) {
  const t = tIdx(u.x, u.y);
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const html = `<div class="sheet-title"><div><h3>Uplink</h3><div class="sub">A neutral relay tower</div></div></div>
    <p class="desc">It belongs to whoever's land it stands in: build an Outpost or a Keep near it (a Drop Outpost will do, or a Port across the water) and it's yours while your land covers it. Armed enemy warbots within ${UPLINK.jam} tiles of it jam it: then it counts for no one. Once they're online (${UPLINK.online / 60} minutes in), hold ${uplinkGoal()} and your clock runs; a total of ${UPLINK.hold / 60} minutes wins.</p>
    <div id="sh-dyn"></div>
    <div class="btn-row"><button class="btn" id="sh-up-guard">Hold it with warbots</button></div>${flavorLine('uplink')}`;
  openSheet('uplink', t, html);
  $('sh-up-guard').onclick = () => { sfx('click'); closeSheet(); setMode('attack'); UI.armyCmd = 'hold'; showArmyCmdBanner('Tap the ground beside the Uplink.'); };
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
  // The figures are rewritten when they change; the chart's canvas stays put (a drag across it reads it) and is
  // redrawn only for another good or a new sample.
  if (full || !$('gs-info')) $('gs-body').innerHTML = `<div id="gs-info"></div><div class="section-label">On hand over time</div><canvas class="chart small" id="gs-chart"></canvas>
    <p class="hint">Rates are over the last two minutes. The Statistics screen in the pause menu shows the whole game.</p>`;
  const info = `<p class="desc">${GOOD[g].desc}</p>${status}
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
    <div class="section-label">Used by</div><div class="goodlist">${list(users, 'No buildings use it.')}</div>${extraUse ? `<p class="hint">${extraUse.trim()}</p>` : ''}`;
  const box = $('gs-info'), cv = $('gs-chart');
  if (box.dataset.html !== info) { box.dataset.html = info; box.innerHTML = info; }
  const H = S.hist, key = g + ':' + (H ? H.t.length + ':' + (H.t[H.t.length - 1] || 0) : '');
  if (cv.dataset.key === key) return;
  cv.dataset.key = key;
  if (H && H.t.length > 1 && H.p[0].goods && H.p[0].goods[g]) lineChart(cv, { xs: H.t, series: [{ name: GOOD[g].name, color: GOOD[g].color, values: H.p[0].goods[g] }] });
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

function myAirfields() { return S.buildings.filter((b) => !b.dead && b.owner === ME && b.built && BDEFS[b.type].airfield); }

/** How many of `avail` warbots a group of the chosen size takes. */
function armyCount(avail) { return UI.armyN === 'all' ? avail : Math.min(avail, UI.armyN || 4); }
/** How many warbots the Army sheet's size picks, for an order (-1: every spare one; see armyN in orders.js). */
function armyWant() { return UI.armyN === 'all' ? -1 : UI.armyN || 4; }
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
  const g = warbotGroups(), mine = S.bots.filter((u) => !u.dead && u.owner === ME);
  const wb = mine.filter(isArmy), noAmmo = wb.filter((u) => !botArmed(u)).length;
  const nB = wb.filter((u) => u.type === 'bulwark').length, nT = wb.filter((u) => u.type === 'torch').length;
  const field = g.attack.length + g.hold.length + g.defend.length + g.idle.length + g.loot.length;
  const rockets = mine.filter((u) => BOTS[u.type].siege);
  // The groups out in the field: each rally flag, and each building under attack.
  const flags = S.rallies.filter((r) => r.owner === ME).map((r) => ({ r, n: rallyMembers(r.id).length })).filter((f) => f.n > 0);
  const atk = new Map();
  for (const u of g.attack) { const t = getE(u.task.target); if (t && !t.dead) atk.set(t.id, (atk.get(t.id) || 0) + 1); }
  const sig = JSON.stringify([UI.armyN, wb.length, g.base.length, g.posted.length, field, noAmmo, flags.map((f) => [f.r.id, f.n]), [...atk], rockets.map((u) => [u.id, botActivity(u), Math.round(u.x / 3), Math.round(u.y / 3)]), S.players[ME].keepW ?? 0, !!INPUT.mouse, recallArmed()]);
  if (sig === UI.armySig) return;
  UI.armySig = sig;
  const L = getE(S.players[ME].lander), where = (x, y) => (L ? dirText(L, { x: Math.floor(x), y: Math.floor(y) }) : '');
  const k = S.players[ME].keepW ?? 0;
  let h = `<div class="kv"><span>Warbots</span><span><b>${wb.length}</b>${nB || nT ? ` (${[nB ? `${nB} ${nB > 1 ? 'Bulwarks' : 'Bulwark'}` : '', nT ? `${nT} ${nT > 1 ? 'Torches' : 'Torch'}` : ''].filter(Boolean).join(', ')})` : ''}: ${g.base.length} at the Command Base, ${g.posted.length} in garrisons, ${field} in the field${noAmmo ? `, <span class="err">${noAmmo} out of Ammo${nT ? ' or Fuel' : ''}</span>` : ''}</span></div>`;
  if (rockets.length) h += `<div class="kv"><span>Howitzers</span><span><b>${rockets.length}</b></span></div>`;
  h += `<div class="section-label">Orders <span class="label-note">group size</span></div>
    <div class="seg" id="ar-size">${[2, 4, 8, 'all'].map((n) => `<button id="ar-n${n}" data-act="size" data-n="${n}" class="${UI.armyN === n ? 'on' : ''}">${n === 'all' ? 'All' : n}</button>`).join('')}</div>
    <div class="army-cmds">
      <button class="btn primary" id="ar-attack" data-act="cmd" data-c="attack">Attack</button>
      <button class="btn" id="ar-hold" data-act="cmd" data-c="hold">Hold ground</button>
      <button class="btn" id="ar-station" data-act="cmd" data-c="station">Station</button>
      <button class="btn${field && recallArmed() ? ' danger' : ''}" id="ar-recall" data-act="recall"${field ? '' : ' disabled'}>${field && recallArmed() ? `Tap again: ${field} come home` : 'Recall all'}</button>
      <button class="btn ghost" id="ar-select" data-act="select">Select all warbots</button>
    </div>
    <p class="hint"><b>Attack</b>: tap a rival building and a group of ${armyNText()} goes for it. <b>Hold ground</b>: tap open ground and they plant a rally flag and hold it. <b>Station</b>: tap an Outpost, Keep or Bunker of yours and they move in for good. Each tap sends another group, until you tap Done. Warbots come from your garrisons in reach (each keeps its own).</p>`;
  if (flags.length || atk.size) {
    h += '<div class="section-label">In the field</div>';
    for (const f of flags) h += `<div class="kv army-row"><span><b>${f.n}</b> holding a flag ${where(f.r.x, f.r.y)}</span><span><button class="btn small ghost" data-act="showflag" data-id="${f.r.id}">Show</button><button class="btn small" data-act="more" data-id="${f.r.id}">+${UI.armyN === 'all' ? 'All' : UI.armyN}</button><button class="btn small ghost" data-act="recallflag" data-id="${f.r.id}">Recall</button></span></div>`;
    for (const [id, n] of atk) { const t = getE(id); h += `<div class="kv army-row"><span><b>${n}</b> attacking the ${BDEFS[t.type].name} ${where(t.x, t.y)}</span><span><button class="btn small ghost" data-act="showbld" data-id="${id}">Show</button><button class="btn small ghost" data-act="callback" data-id="${id}">Call back</button></span></div>`; }
  }
  if (rockets.length) {
    // Each one by number and where it is (they're easy to lose: Find takes you to it and picks it out).
    h += `<div class="section-label">Howitzers <span class="label-note">Find takes you to one</span></div>`;
    rockets.forEach((u, k) => {
      h += `<div class="kv army-row"><span><b>Howitzer ${k + 1}</b>${L ? `, ${where(u.x, u.y)}` : ''}: ${botActivity(u)}</span><span><button class="btn small primary" data-act="findbot" data-id="${u.id}">Find</button><button class="btn small" data-act="bombard" data-id="${u.id}">Bombard</button><button class="btn small ghost" data-act="rgo" data-id="${u.id}">Drive</button></span></div>`;
    });
    h += `<div class="army-cmds"><button class="btn ghost" id="ar-select-rockets" data-act="selectrockets">Select all Howitzers</button></div>`;
  }
  h += `<div class="section-label">Every Outpost keeps</div><div class="seg" id="ar-keep">${[0, 1, 2, 5].map((v) => `<button data-act="keep" data-k="${v}" class="${v === k ? 'on' : ''}">${v}</button>`).join('')}</div>
    <p class="hint">Warbots each Outpost keeps at home, sent from your Command Base (and replaced if lost). Set one Outpost on its own in its panel.</p>`;
  $('ar-body').innerHTML = h;
}

function refreshAirTab() {
  const fields = myAirfields(), planes = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].air);
  const bombers = planes.filter((u) => BOTS[u.type].bomber), cargo = planes.filter((u) => !BOTS[u.type].bomber);
  const kinds = BDEFS.airfield.yard.filter((kk) => warOn() || !BOTS[kk].war);
  const sig = JSON.stringify([fields.map((b) => [b.id, b.yard]), planes.map((u) => [u.id, planeStatus(u), !!(u.inside && !u.mission && !u.flight)]), !!readyBomber()]);
  if (sig === UI.armySig) return;
  UI.armySig = sig;
  const L = getE(S.players[ME].lander);
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
  const what = btn.dataset.act, id = +btn.dataset.id, e = id ? getE(id) : null;
  sfx('click');
  switch (what) {
    case 'size': UI.armyN = btn.dataset.n === 'all' ? 'all' : +btn.dataset.n; UI.armySig = ''; refreshArmySheet(); return;
    case 'cmd': armyCmd(btn.dataset.c); return;
    case 'recall': recallAllTap(); return;
    case 'select': selectBots(armyIds(ME), false); closeSheet(); if (UI.sel.length) toast(`${UI.sel.length} warbots selected: ${onTouch() ? 'tap the map' : 'right-click'} to give orders.`, 'info'); return;
    case 'keep': setKeepAll(+btn.dataset.k); UI.armySig = ''; refreshArmySheet(); return;
    case 'showflag': if (e) { centerOn(e.x, e.y); openRallySheet(e); } return;
    case 'showbld': if (e) { centerOn(e.x + 0.5, e.y + 0.5); openBuildingSheet(e); } return;
    case 'showbot': if (e) { const inB = e.inside ? getE(e.inside) : null; centerOn(inB ? inB.x + 0.5 : e.x, inB ? inB.y + 0.5 : e.y); openBotSheet(e); } return;
    case 'findbot': if (e) findBot(e); return;
    case 'selectrockets': { const ids = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].siege).map((u) => u.id); closeSheet(); selectBots(ids, false); if (UI.sel.length) toast(`${UI.sel.length} Howitzer${UI.sel.length > 1 ? 's' : ''} selected: ${onTouch() ? 'tap' : 'right-click'} an enemy building to shell it, or open ground to drive there.`, 'info'); return; }
    case 'more': if (e) act('rally', [Math.floor(e.x), Math.floor(e.y), armyWant()], (res) => { if (res.sent) { sfx('order'); toast(`${res.sent} more warbot${res.sent > 1 ? 's are' : ' is'} on the way to the flag.`, 'info'); } else { sfx('error'); toast('No spare warbots in reach of that flag.', 'warn'); } UI.armySig = ''; }); return;
    case 'recallflag': if (e) act('recallRally', [id], (n) => { toast(`${n} warbot${n !== 1 ? 's' : ''} called back.`, 'info'); UI.armySig = ''; }); return;
    case 'callback': act('callBack', [id], (n) => { toast(`${n} warbot${n !== 1 ? 's' : ''} called back to their garrisons.`, 'info'); UI.armySig = ''; }); return;
    case 'bombard': if (e) { closeSheet(); setMode('bombard'); UI.rocket = id; showBanner(`Tap an enemy building: the <b>Howitzer</b> drives to within ${ROCKET.range} tiles of it, digs in and shells it, one heavy shell after another, until it's rubble.`, null, 'Cancel'); } return;
    case 'rgo': if (e) { closeSheet(); setMode('rgo'); UI.rocket = id; showBanner('Tap where the <b>Howitzer</b> should wait: it stays there, and (unless it holds fire) shells any enemy building in reach of it.', null, 'Cancel'); } return;
    case 'strikeany': { const u = readyBomber(); if (u) startStrike(u); else { sfx('error'); toast('No Strike Bomber is ready on the ground.', 'warn'); } return; }
    case 'strike': if (e) startStrike(e); return;
    case 'drop': if (e) { closeSheet(); startAirdrop(e, btn.dataset.k); } return;
    case 'yard': if (e) { act('yard', [e.id, btn.dataset.k, 1]); toast(`${BOTS[btn.dataset.k].name} ordered: the Airfield's hangar builds it from Alloy and Chips.`, 'info'); UI.armySig = ''; refreshArmySheet(); } return;
  }
}

/**
 * Take the view to one of your robots (a Howitzer, say) and pick it out: rings pulse round it, and it's selected
 * (with a mouse: right-click to give it orders) or its panel opens.
 */
function findBot(u) {
  const inB = u.inside ? getE(u.inside) : null, x = inB ? inB.x + 0.5 : u.x, y = inB ? inB.y + 0.5 : u.y;
  closeSheet();
  if (R.cam.z < 30) R.cam.z = 30;
  centerOn(x, y);
  for (const t of [0, -0.35, -0.7]) addFx('ring', x, y, { color: '#7dffa0', r: 1.4, life: 0.9, t });
  if (INPUT.mouse) selectBots([u.id], false);
  else openBotSheet(u);
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
    if (u.dead || u.inside || !foes(u.owner, ME) || u.owner < 0 || u.dropping || (BOTS[u.type].air && u.flight)) continue;
    const d = dist2(u.x, u.y, i + 0.5, j + 0.5);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

function armyTap(cmd, i, j, b) {
  const fail = (why) => { sfx('error'); showArmyCmdBanner(`<span class="err">${why}</span>`); };
  if (cmd === 'attack') {
    // A rival robot (nearest the tap, if there's one there): hunt it down.
    const foe = !b || !foes(b.owner, ME) ? enemyBotAtTap(i, j) : null;
    if (foe) {
      const name = BOTS[foe.type].name;
      act('hunt', [foe.id, armyWant()], (res) => {
        if (!res.sent) return fail('No armed warbots can get there: they need Ammo, and a way to walk there.');
        sfx('order'); showArmyCmdBanner(`${res.sent} warbot${res.sent > 1 ? 's are' : ' is'} going after the rival's ${name}.`);
      });
      return;
    }
    if (!b || !foes(b.owner, ME) || b.owner < 0 || b.dead) return fail(`Tap a rival building or robot (${rivalColours()}).`);
    const name = BDEFS[b.type].name;
    act('assault', [b.id, armyWant()], (sent) => {
      if (!sent) return fail('No armed warbots can get there: they need Ammo, and a way to walk there.');
      sfx('order'); showArmyCmdBanner(`${sent} warbot${sent > 1 ? 's are' : ' is'} going for the ${name}.`);
    });
    return;
  }
  if (cmd === 'hold') {
    if (b || !inMap(i, j) || !walkable(tIdx(i, j))) return fail('Tap open ground your warbots can walk to.');
    act('rally', [i, j, armyWant()], (res) => {
      if (!res.sent) return fail('No spare armed warbots can get there.');
      sfx('order'); showArmyCmdBanner(`${res.sent} warbot${res.sent > 1 ? 's are' : ' is'} on the way to hold it.`);
    });
    return;
  }
  if (cmd === 'station') {
    if (!b || b.owner !== ME || !b.built || !BDEFS[b.type].mil || b.type === 'lander') return fail('Tap one of your finished Outposts, Keeps or Bunkers.');
    const name = BDEFS[b.type].name;
    act('station', [b.id, armyWant()], (n) => {
      if (!n) return fail(!b.dead && garrisonRoom(b) ? 'No spare warbots to send there.' : `The ${name} is full.`);
      sfx('order'); showArmyCmdBanner(`${n} warbot${n > 1 ? 's are' : ' is'} moving into the ${name}.`);
    });
  }
}

function openPopSheet() {
  openSheet('pop', 0, `<div class="sheet-title"><div><h3>Your robots</h3></div></div>
    <p class="desc">Every robot you have, by type, and what they're doing right now. Order more at the Bot Foundry.</p>
    <div id="sh-pop"></div>`);
  refreshPopSheet();
}

/** What worker (or other civilian bot) u is doing, as a key: running, carrying, building, charging, repairing or free. */
/** What bot u is up to, for the Workers view's colours (a WORKER_VIEW key). */
function workerViewKind(u) {
  const t = u.task, tt = t && t.type;
  if (tt === 'charge' || tt === 'refuel' || (u.inside && insideCharger(u) && !tt && (u.bat ?? 100) < 99)) return 'charging';
  if (tt === 'haul') return 'carrying';
  if (tt === 'staff') return 'running';
  if (tt === 'build' || tt === 'pave' || tt === 'fix') return 'building';
  if (tt === 'repair') return 'repairing';
  return 'free';
}
const WORKER_VIEW = { running: ['#5dd88a', 'running buildings'], building: ['#ffb24a', 'building or paving'], carrying: ['#6ec8ff', 'carrying goods'],
  charging: ['#c79bff', 'recharging'], repairing: ['#ff7a8a', 'being repaired'], free: ['#ffe45a', 'free'] };

function refreshPopSheet() {
  const n = {};
  const add = (type, key) => { n[type] = n[type] || { total: 0 }; n[type].total++; if (key) n[type][key] = (n[type][key] || 0) + 1; };
  let total = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== ME) continue;
    total++;
    const t = u.task, tt = t && t.type;
    if (isArmy(u)) {
      add(u.type, u.inside ? 'garrison' : 'field');
      if (!botArmed(u)) add(u.type, 'noAmmo'), n[u.type].total--;
    } else if (tt === 'charge' || tt === 'refuel' || (u.inside && insideCharger(u) && !tt && (u.bat ?? 100) < 99)) add(u.type, 'charging');
    else if (tt === 'haul') add(u.type, 'carrying');
    else if (tt === 'staff') add(u.type, 'running');
    else if (tt === 'build' || tt === 'pave' || tt === 'fix') add(u.type, 'building');
    else if (tt === 'repair') add(u.type, 'repairing');
    else add(u.type, 'free');
  }
  const part = (o, k, label) => (o[k] ? `${o[k]} ${label}` : '');
  const rows = BOT_ORDER.filter((k) => n[k] || (!BOTS_OFF.has(k) && (warOn() || !BOTS[k].war) && (navalMap() || !BOTS[k].naval))).map((k) => {
    const o = n[k] || { total: 0 };
    const bits = BOTS[k].army
      ? [part(o, 'garrison', 'in garrisons'), part(o, 'field', 'in the field'), part(o, 'noAmmo', BOTS[k].flame ? 'out of Fuel' : 'out of Ammo')]
      : [part(o, 'running', 'running buildings'), part(o, 'carrying', 'carrying goods'), part(o, 'building', 'building or paving'),
        part(o, 'charging', 'recharging'), part(o, 'repairing', 'being repaired'), part(o, 'free', 'free')];
    return `<div class="kv pop-row"><span><b>${o.total}</b> ${o.total === 1 ? BOTS[k].name : BOTS[k].plural}</span><span>${bits.filter(Boolean).join(' · ') || '–'}</span></div>`;
  });
  const cap = S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS;
  let wb = '';
  if (warOn() && (n.warbot || n.bulwark || n.torch)) {
    const g = warbotGroups();
    wb = '<div class="section-label">Where your warbots are</div>' + WARBOT_PLACES.filter(([k]) => g[k].length).map(([k, label]) =>
      `<div class="kv pop-row"><span>${label}</span><span><b>${g[k].length}</b> <button class="btn small ghost" data-wb="${k}">Show</button></span></div>`).join('') +
      '<p class="hint">Show takes you to each in turn. Warbots stationed at an Outpost come back to it after a fight; every other one belongs to the Command Base.</p>';
  }
  const wv = `<div class="section-label">Where your workers are</div>
    <button class="btn${R.workerView ? ' primary' : ''}" id="sh-wview">${R.workerView ? 'Hide workers on the map' : 'Show workers on the map'}</button>
    <p class="hint">Rings every Worker on the map (and dots it on the minimap) in the colour of what it's doing, with a line to where it's going: ${Object.values(WORKER_VIEW).map(([c, l]) => `<span style="color:${c}">●</span> ${l}`).join(', ')}. Workers inside a building show as a count on it.</p>`;
  // Rebuilt only when something shown changes: rebuilt four times a second, a click on Show or the workers
  // button was lost when the button under it was replaced between press and release.
  const el = $('sh-pop'), html = rows.join('') + `<div class="kv"><span>All robots</span><span><b>${total}</b> of ${cap} (the limit)</span></div>` + wv + wb;
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
  $('sh-wview').onclick = () => { R.workerView = !R.workerView; sfx('click'); refreshPopSheet(); };
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
    if (u.dead || u.owner !== ME || !isArmy(u)) continue;
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
  if (!UI.sheetKind) return;
  if (UI.sheetKind === 'build') { refreshBuildMenu(); return; }
  markSheetKeys();
  if (UI.sheetKind === 'pop') { refreshPopSheet(); return; }
  if (UI.sheetKind === 'army') { refreshArmySheet(); return; }
  if (UI.sheetKind === 'goods') { refreshGoodsSheet(false); return; }
  if (UI.sheetKind === 'road') { refreshRoadSheet(UI.sheetFor); return; }
  if (UI.sheetKind === 'bld') {
    const b = getE(UI.sheetFor);
    if (!b || b.dead) { closeSheet(); return; }
    // Captured (or won back) while its panel was open: the panel is built again for its new owner.
    if ((b.owner === ME) !== UI.sheetMine) { openBuildingSheet(b); return; }
    refreshBuildingSheet(b);
  } else if (UI.sheetKind === 'bot') {
    const u = getE(UI.sheetFor);
    if (!u || (u.inside && !BOTS[u.type].sea && !BOTS[u.type].rail)) { closeSheet(); return; } // (a ship tied up at a Port, or a train at a station, keeps its panel)
    $('sh-status').textContent = botActivity(u);
    refreshBombButton(u);
    const bat = Math.round(u.bat ?? 100);
    $('sh-dyn').innerHTML = `<div class="kv"><span>Health</span><span>${Math.ceil(u.hp)} / ${u.maxHp}</span></div>` +
      `<div class="kv"><span>${tankOf(u) ? 'Fuel tank' : 'Battery'}</span><span>${bat}%${bat < BATTERY.critical ? (tankOf(u) ? ' (empty: crawling)' : ' (flat: slow and weak)') : bat < BATTERY.low ? ' (low)' : ''}</span></div>` +
      `<div class="bar battery"><div style="width:${bat}%;background:${bat < BATTERY.critical ? '#ff4d4d' : bat < BATTERY.low ? '#ffb347' : '#7ee08a'}"></div></div>` +
      (BOTS[u.type].air ? `<div class="kv"><span>Fuel</span><span>fills up at its Airfield, one Fuel ${planeFill(u)}% of the tank (${tankFuel(u, 100)} to fill it now)${BOTS[u.type].bomber ? `; each sortie takes ${BOMBER.fuel} Fuel on top` : ''}; a full tank reaches ${planeReach(u)} tiles out and back</span></div>` : '') +
      (BOTS[u.type].shield ? shieldRows(u) : '') +
      (BOTS[u.type].flame ? `<div class="kv"><span>Flame tank</span><span>${Math.round(u.gel ?? TORCH.tank)} / ${TORCH.tank} seconds of fire${(u.gel ?? TORCH.tank) <= 0.05 ? ' (empty: going to refill with Fuel)' : ''}</span></div>` +
        `<div class="bar battery"><div style="width:${Math.round(100 * (u.gel ?? TORCH.tank) / TORCH.tank)}%;background:#ff8a2a"></div></div>` : '') +
      (u.type === 'warbot' ? `<div class="kv"><span>Ammo</span><span>${u.ammo ?? WARBOT_AMMO} / ${WARBOT_AMMO} shots${!u.ammo ? ' (out: can\'t fight until it reloads)' : ''}</span></div>` : '') +
      (BOTS[u.type].siege ? `<div class="kv"><span>Shells</span><span>${u.rockets ?? ROCKET.mag} / ${ROCKET.mag}${!(u.rockets ?? ROCKET.mag) ? ` (haulers bring Ammo while it's dug in on your ground near a road; or it reloads ${ROCKET.ammo} Ammo at a garrison or storage)` : ''}</span></div><div class="kv"><span>Each shell</span><span>${ROCKET.damage} damage, ${ROCKET.damage * ROCKET.fortMul} to defences; one every ${ROCKET.cycle}s</span></div><div class="kv"><span>Reach</span><span>${ROCKET.min} to ${ROCKET.range} tiles</span></div>` : '') +
      (u.carry ? `<div class="kv"><span>Carrying</span><span>${cargoList(u).map(([g, n]) => goodTag(g, (n > 1 ? n + ' × ' : '') + GOOD[g].name)).join(' ')}</span></div>` : '') +
      (u.cargo && Object.keys(u.cargo).length ? `<div class="section-label">On board</div><div class="goodlist">${Object.keys(u.cargo).map((g) => goodTag(g, `${u.cargo[g]} ${GOOD[g].name}`)).join('')}</div>` : '');
    if ($('sh-recall')) $('sh-recall').hidden = !(u.task && u.task.type === 'hold');
    if ($('sh-fout')) $('sh-fout').hidden = !u.inside || !!u.landing;
    if ($('sh-tarmor')) refreshTrainArmor(u);
  } else if (UI.sheetKind === 'move') {
    const t = UI.sheetFor, i = t % S.W, j = (t / S.W) | 0;
    const avail = refreshMoveStepper(i, j);
    $('mv-info').innerHTML = `<p class="desc">${avail
      ? `${avail} armed warbot${avail > 1 ? 's' : ''} available in your garrisons (each keeps its Keep at home).`
      : S.zone[t] !== homeZone(ME) ? 'Your warbots cannot walk there from your garrisons.' : 'No armed warbots available. Make some at the Bot Foundry, and keep your garrisons stocked with Ammo: warbots without it can\'t fight.'}</p>`;
  } else if (UI.sheetKind === 'rally') {
    const r = rallyById(UI.sheetFor);
    if (!r) { closeSheet(); return; }
    const members = rallyMembers(r.id);
    const low = members.filter((u) => (u.bat ?? 100) < BATTERY.low).length;
    $('rl-info').innerHTML = `<div class="kv"><span>Warbots holding</span><span>${members.length}</span></div>` +
      (low ? `<div class="kv"><span>Low battery</span><span>${low}</span></div>` : '');
    refreshMoveStepper(Math.floor(r.x), Math.floor(r.y));
  } else if (UI.sheetKind === 'uplink') {
    const u = uplinkAt(UI.sheetFor);
    if (!u) { closeSheet(); return; }
    const L = getE(S.players[ME].lander);
    $('sh-dyn').innerHTML = `<div class="kv"><span>Held by</span><span>${u.owner < 0 ? 'No one' : u.owner === ME ? 'You' : playerName(u.owner)}</span></div>` +
      (u.jam ? `<div class="kv"><span>Jammed</span><span class="err">${u.jam - 1 === 0 ? 'by your warbots' : 'by ' + playerName(u.jam - 1, true) + '\'s warbots'}</span></div>` : '') +
      (S.time < UPLINK.online ? `<div class="kv"><span>Online in</span><span>${fmtClock(UPLINK.online - S.time)}</span></div>` : '') +
      (L ? `<div class="kv"><span>From your Command Base</span><span>${dirText(L, u)}</span></div>` : '');
  } else if (UI.sheetKind === 'post') {
    const post = postAt(UI.sheetFor);
    if (!post) { closeSheet(); return; }
    const docks = S.buildings.filter((b) => !b.dead && BDEFS[b.type].terminal && nearPost(b.x, b.y) === post);
    const who = docks.map((b) => (b.owner === ME ? 'You' : playerName(b.owner)) + (b.built ? '' : ' (building)')).join(', ') || 'Nobody yet';
    const L = getE(S.players[ME].lander), holder = S.owner[UI.sheetFor];
    $('sh-dyn').innerHTML = `<div class="kv"><span>Docked here</span><span>${who}</span></div>` +
      (L ? `<div class="kv"><span>From your Command Base</span><span>${dirText(L, post)}</span></div>` : '') +
      (holder >= 0 ? `<div class="kv"><span>Land round it</span><span>${holder === 0 ? 'Yours' : playerName(holder) + '\'s'}</span></div>` : '');
    const mine = docks.some((b) => b.owner === ME);
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
  { text: 'Robots run on batteries, and your Command Base can\'t charge them. Tap <b>Build</b> and place a <b>Fuel Station</b> beside the road ring round your base: it runs on the Fuel you landed with.', build: ['charger'], done: () => hasBuilt('charger') || hasAny('charger') },
  { text: 'Tap <b>Build</b> and place a <b>Harvester</b> beside the teal stalk groves.', build: ['harvester'], done: () => hasBuilt('harvester') || hasAny('harvester') },
  { text: '<b>Haulers only drive on roads.</b> Tap <b>Paths</b>, sketch a road from the ring round your Command Base to the Harvester site and tap <b>Build</b> (or tap the site and choose <b>Lay road</b>). Free workers pave it.', done: () => hasBuilt('harvester') || S.buildings.some((b) => !b.dead && b.owner === ME && b.type === 'harvester' && !b.unlinked) },
  { text: 'Build a <b>Quarry</b> near the grey boulders to get Stone.', build: ['quarry'], done: () => hasBuilt('quarry') },
  { text: 'Build a <b>Cement Works</b> near your Command Base: it bakes Stone into <b>Cement</b>, which nearly every building and every road is made of.', build: ['kiln'], done: () => hasBuilt('kiln') },
  { text: 'Build an <b>Ore Mine</b> by the dark ore veins and a <b>Crystal Tap</b> by the violet crystals.', build: ['mine', 'tap'], done: () => hasBuilt('mine') && hasBuilt('tap') },
  { text: 'Build a <b>Smelter</b>: it turns Ore and Fiber into Alloy.', build: ['smelter'], done: () => hasBuilt('smelter') },
  { text: 'Build a <b>Chip Fab</b>: it turns Crystal and Alloy into Chips.', build: ['fab'], done: () => hasBuilt('fab') },
  { text: 'Build a <b>Bot Foundry</b> so you can make more workers.', build: ['foundry'], done: () => hasBuilt('foundry') },
  { text: 'Tap your <b>Bot Foundry</b> and order some <b>Workers</b>: it only builds the bots you ask for.', done: () => S.players[ME].stats.bots > S.players[ME].stats.startBots || S.buildings.some((b) => !b.dead && b.owner === ME && hasOrders(b)) },
  { text: 'Build an <b>Outpost</b> near your border to claim more land.', build: ['outpost'], done: () => hasBuilt('outpost') },
  { text: 'Fuel Stations burn <b>Fuel</b>. Build a <b>Bio Farm</b> beside the dark fertile soil to grow it (your Agribot runs it).', build: ['farm'], done: () => hasBuilt('farm') || hasBuilt('refinery') || playerGoods(ME).fuel >= 20 },
  { text: 'Busy crossings jam up. In <b>Paths</b>, choose <b>Junctions</b> and put a traffic light on a junction where three or four roads meet.', done: () => Object.keys(S.lights).some((k) => S.lights[k].owner === ME) || !ownJunction() },
  { text: 'Warbots need <b>Ammo</b>. Build an <b>Ammo Plant</b>: haulers stock your Command Base and Outposts and warbots reload there.', build: ['armory'], done: () => S.mode === 'colony' || hasBuilt('armory') },
];

function ownJunction() {
  const net = roadNet();
  for (let t = 0; t < S.W * S.H; t++) if (net.junc[t] && wayOwner(t) === ME) return true;
  return false;
}

function hasAny(type) {
  for (const b of S.buildings) if (!b.dead && b.owner === ME && b.type === type) return true;
  return false;
}

function hasBuilt(type) {
  for (const b of S.buildings) if (!b.dead && b.owner === ME && b.built && b.type === type) return true;
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
  const cut = S.buildings.filter((b) => !b.dead && b.owner === ME && b.unlinked);
  const warn = cut.length && !(cut.length === 1 && cut[0].type === 'harvester' && !hasBuilt('harvester'))
    ? `<span class="err">${cut.length === 1 ? `Your ${BDEFS[cut[0].type].name}${cut[0].built ? '' : ' site'} has` : `${cut.length} buildings have`} no road to storage.</span> Tap ${cut.length === 1 ? 'it' : 'one'} and choose <b>Lay road</b>.<br>` : '';
  if (S.mission) return warn + missionObjectiveHTML();
  for (const o of OBJECTIVES) if (!o.done()) return warn + o.text;
  if (warn) return warn;
  if (S.mode === 'colony') {
    const pct = Math.floor(landShare(ME) * 100);
    const next = COLONY_MILESTONES[S.milestone];
    return next !== undefined
      ? `Colonize the planet: <b>${pct}%</b> claimed. Next milestone at ${Math.round(next * 100)}%.`
      : `<b>${pct}%</b> of the planet colonized. Every milestone reached!`;
  }
  return S.players.length > 2 ? 'Gather warbots in Outposts near a rival, then tap its <b>Command Base</b> and send them in. Take every rival Command Base to win.'
    : 'Gather warbots in Outposts near the rival, then tap the <b>rival Command Base</b> and send them in to capture it.';
}

function updateHUD() {
  const goods = playerGoods(ME);
  for (const g of GOODS) {
    const el = UI.goodEls[g];
    const v = goods[g];
    if (UI.lastGoods[g] !== undefined && v > UI.lastGoods[g]) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    UI.lastGoods[g] = v;
    el.lastChild.textContent = v;
  }
  let workers = 0, idle = 0, war = 0, haulers = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== ME) continue;
    if (isArmy(u)) war++;
    else if (u.type === 'hauler' || u.type === 'truck' || u.type === 'tanker') haulers++;
    else if (u.type === 'worker') { workers++; if (isIdleWorker(u)) idle++; }
  }
  $('pop').title = `${workers} workers (${idle} free), ${haulers} haulers, trucks and Tankers` + (warOn() ? `, ${war} warbots` : '') + '. Tap for every robot by type.';
  $('pop').innerHTML = `<span class="dot" style="background:#ece6da;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[ME]}"></span>${workers}<span class="wide"> workers</span> <span style="color:var(--muted)">(${idle} free)</span>` +
    ` <span class="dot" style="background:#ffb547;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[ME]}"></span>${haulers}<span class="wide"> haulers</span>` +
    (warOn() ? ` <span class="dot" style="background:${PLAYER_COLORS[ME]};border-radius:2px;transform:rotate(45deg)"></span>${war}` : '');
  // With day and night on, the time of day leads (a sun, a half-lit disc at dawn and dusk, a moon).
  const tn = todName(), tod = todEnabled() ? `<span class="tod-mark" style="color:${{ morning: '#ffb38a', day: '#ffd166', evening: '#ff8a4a', night: '#b8c8ff' }[tn]}">${tn === 'night' ? '☾' : '☀'}</span> ` : '';
  const ct = tod + (S.mode === 'colony' ? `${Math.floor(landShare(ME) * 100)}% land` : fmtTime(S.time));
  if ($('clock').innerHTML !== ct) $('clock').innerHTML = ct;
  $('clock').title = todEnabled() ? TOD_NAMES[todName()] + (todMode() === 'night' ? ' (always)' : '') : '';
  updateWinCard(); // (first: folded under the Goal chip, it leaves a summary there)
  const obj = $('objective');
  // Where the screen is small the card folds away at the first tap on the map (onMapTap) and opens again for each
  // new step, unless you've folded or opened it yourself. Folded, it still says how many buildings have no road.
  const step = objectiveStep(), stepKey = step ? OBJECTIVES.indexOf(step) : -1;
  if (UI.objStep !== stepKey) { if (UI.objStep !== undefined && UI.objAuto && !UI.objManual) { UI.objCollapsed = false; UI.objAuto = false; } UI.objStep = stepKey; }
  const cut = UI.objCollapsed && !S.mission ? S.buildings.filter((b) => !b.dead && b.owner === ME && b.unlinked).length : 0;
  obj.innerHTML = UI.objCollapsed && !S.mission ? 'Goal ▸' + (UI.winMini || '') + (cut ? ` <span class="err">${cut} with no road</span>` : '') : objectiveText();
  obj.classList.toggle('small', UI.objCollapsed);
  // (The messages button sits beside the folded card on a small screen: the open card needs the whole width.)
  $('btn-msgs').hidden = !UI.msgLog.length || (!UI.objCollapsed && !isWide());
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
  const def = EVENTS[E.type], soon = S.time < E.t0, o = E.offers && E.offers[ME]; // (this device's own deal, as Trade takes it)
  const key = `${E.n}|${soon}|${o ? (o.done ? 'done' : 'open') : 'none'}|${!!E.started}`;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.className = 'event-card' + (E.type === 'trader' ? ' trader' : '');
    const name = def.html || def.name; // (the Wren in italics)
    let html = `<div class="ev-head"><span class="ev-dot" style="background:${def.color};color:${def.color}"></span><b>${soon ? name + ' coming' : name}</b><span class="ev-time"></span></div>`;
    if (E.type !== 'trader') html += `<div class="ev-desc">${def.desc}</div>`;
    else if (!E.started) html += '';
    else if (!o) html += '<div class="ev-desc">It wants nothing you have spare.</div>';
    else if (o.done) html += `<div class="ev-desc">Deal done: ${o.m} ${GOOD[o.get].name} delivered to your Command Base.</div>`;
    else {
      html += `<div class="ev-deal"><span>Give <b>${o.n}</b> <i class="gi ${o.give}"></i> ${GOOD[o.give].name}, get <b>${o.m}</b> <i class="gi ${o.get}"></i> ${GOOD[o.get].name}</span>` +
        '<button class="btn small primary" id="ev-trade">Trade</button></div>';
    }
    // The Wren's cargo list, 31 years out of date (LORE.md): goods for a colony that hasn't come.
    if (E.type === 'trader' && E.started) html += `<div class="ev-cargo">Cargo list, 31 years old: ${wrenCargo(E.n)}.</div>`;
    el.innerHTML = html;
    const btn = $('ev-trade');
    if (btn) btn.onclick = () => act('trade', [], (why) => {
      if (why) { sfx('error'); toast(why, 'bad'); } else sfx('complete');
      updateHUD();
    });
  }
  const left = Math.max(0, Math.ceil((soon ? E.t0 : E.t1) - S.time));
  el.querySelector('.ev-time').textContent = soon ? `in ${left}s` : `${left}s`;
  el.hidden = false;
}

/**
 * How the game is won, if not by capture. Domination: a bar of the land each colony holds (its share of all the
 * land anyone holds), a mark where Domination starts, and whoever holds that much, with the time left. Tap it
 * to look at the leader's Command Base.
 */
function updateWinCard() {
  UI.winMini = '';
  if (S.victory === 'uplinks') { updateUplinkCard(); return; }
  const el = $('win-card'), D = S.victory === 'domination' ? S.dom : null;
  if (!D || !D.held || S.winner >= 0) { el.hidden = true; return; }
  const live = S.players.filter((P) => !P.absent && !P.out), pct = (p) => Math.min(1, (D.land[p] || 0) / D.held);
  const left = D.lead >= 0 ? Math.max(0, DOM.hold - D.t) : 0, clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const share = domShare();
  const head = D.lead < 0 ? `Domination: hold ${Math.round(share * 100)}% of the land`
    : D.lead === ME ? 'You hold most of the land' : `${playerName(D.lead)} holds most of the land`;
  const key = `${D.lead}`;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.innerHTML = '<div class="ev-head"><span class="ev-dot"></span><b class="wc-head"></b><span class="ev-time"></span></div><div class="win-rows"></div><div class="win-note"></div>';
    el.onclick = () => { const L = getE(S.players[Math.max(0, D.lead)].lander); if (L) centerOn(L.x + 0.5, L.y + 0.5); };
  }
  el.classList.toggle('mine', D.lead === ME);
  el.classList.toggle('theirs', D.lead >= 0 && D.lead !== ME);
  const dot = el.querySelector('.ev-dot'), col = D.lead >= 0 ? PLAYER_COLORS[D.lead] : '#7fc8ff';
  dot.style.background = col; dot.style.color = col;
  el.querySelector('.wc-head').textContent = head;
  el.querySelector('.ev-time').textContent = D.lead >= 0 ? clock : '';
  el.querySelector('.win-rows').innerHTML = live.map((P) => `<span class="wn">${playerName(P.id)}</span><span class="win-bar" style="--c:${PLAYER_COLORS[P.id]}"><i style="width:${(pct(P.id) * 100).toFixed(1)}%"></i><b style="left:${share * 100}%"></b></span><span class="wp">${Math.round(pct(P.id) * 100)}%</span>`).join('');
  el.querySelector('.win-note').textContent = `${Math.round((D.held / Math.max(1, D.ground)) * 100)}% of the planet is held: hold ${Math.round(share * 100)}% of that (and ${Math.round(DOM.min * 100)}% of the planet) for ${DOM.hold / 60} minutes to win.`;
  // Folded under the Goal chip (tap it): the card hides, and the chip shows your share (and the count, if one runs).
  UI.winMini = ` <span class="win-mini"><i style="background:${PLAYER_COLORS[ME]}"></i>${Math.round(pct(ME) * 100)}%${D.lead >= 0 ? ` <i style="background:${col}"></i>${clock}` : ''}</span>`;
  el.hidden = !!UI.objCollapsed;
}

/**
 * Uplinks: a dot for each Uplink in its holder's colour (red while jammed), and a bar per colony of the time it
 * has held most of them (of UPLINK.hold), with whoever's clock is running. Tap it to cycle the view round them.
 */
function updateUplinkCard() {
  const el = $('win-card'), U = S.uplinks;
  if (!U || !U.length || S.winner >= 0) { el.hidden = true; return; }
  const clock = S.upClock || S.players.map(() => 0), lead = S.upLead ?? -1, need = uplinksNeeded(), held = S.upHeld || S.players.map(() => 0);
  const live = S.players.filter((P) => !P.absent && !P.out);
  if (el.dataset.key !== 'up') {
    el.dataset.key = 'up';
    el.innerHTML = '<div class="ev-head"><span class="ev-dot"></span><b class="wc-head"></b><span class="ev-time"></span></div><div class="up-dots"></div><div class="win-rows"></div><div class="win-note"></div>';
    el.onclick = () => { const L = S.uplinks; if (!L || !L.length) return; UI.upCycle = ((UI.upCycle ?? -1) + 1) % L.length; const u = L[UI.upCycle]; centerOn(u.x + 0.5, u.y + 0.5); };
  }
  const pre = S.time < UPLINK.online; // not online yet: no clock runs
  el.classList.toggle('mine', lead === ME);
  el.classList.toggle('theirs', lead >= 0 && lead !== ME);
  const dot = el.querySelector('.ev-dot'), col = lead >= 0 ? PLAYER_COLORS[lead] : '#dfefff';
  dot.style.background = col; dot.style.color = col;
  el.querySelector('.wc-head').textContent = pre ? 'Uplinks come online in' : lead < 0 ? `Uplinks: hold ${need} of ${U.length}${U.length % 2 ? '' : ' (the most)'}` : lead === ME ? `You hold ${held[ME]} of ${U.length} Uplinks` : `${playerName(lead)} holds ${held[lead]} of ${U.length}`;
  el.querySelector('.ev-time').textContent = pre ? fmtClock(UPLINK.online - S.time) : lead >= 0 ? fmtClock(UPLINK.hold - clock[lead]) : '';
  el.querySelector('.up-dots').innerHTML = U.map((u) => `<i title="Uplink ${u.id}" style="--c:${u.jam ? '#ff4030' : u.owner >= 0 ? PLAYER_COLORS[u.owner] : 'transparent'}" class="${u.jam ? 'jam' : u.owner < 0 ? 'free' : ''}"></i>`).join('');
  el.querySelector('.win-rows').innerHTML = live.map((P) => `<span class="wn">${playerName(P.id)}</span><span class="win-bar" style="--c:${PLAYER_COLORS[P.id]}"><i style="width:${Math.min(100, ((clock[P.id] || 0) / UPLINK.hold) * 100).toFixed(1)}%"></i></span><span class="wp">${fmtClock(UPLINK.hold - (clock[P.id] || 0))}</span>`).join('');
  el.querySelector('.win-note').textContent = pre ? `Claim them now: an Uplink is yours while your land covers it. Once they're online, hold ${uplinkGoal()} and your clock runs; ${UPLINK.hold / 60} minutes in all wins. Tap to look at each.`
    : `Bars: time held so far, of ${UPLINK.hold / 60} minutes. An Uplink is yours while your land covers it; enemy warbots beside it jam it. Tap to look at each.`;
  // Folded under the Goal chip (tap it): the card hides, and the chip shows a dot per Uplink and the time.
  UI.winMini = ` <span class="win-mini">${U.map((u) => `<i class="${u.owner < 0 && !u.jam ? 'free' : ''}" style="background:${u.jam ? '#ff4030' : u.owner >= 0 ? PLAYER_COLORS[u.owner] : 'transparent'}"></i>`).join('')}` +
    `${pre ? ' ' + fmtClock(UPLINK.online - S.time) : lead >= 0 ? ' ' + fmtClock(UPLINK.hold - clock[lead]) : ''}</span>`;
  el.hidden = !!UI.objCollapsed;
}

/**
 * A nuclear missile heading for something of yours: where and when it lands, and an Evacuate button
 * that sends every robot in the blast ring out of it (garrisons too) until it has gone off.
 */
function updateNukeCard() {
  const el = $('nuke-card');
  const threats = S.missiles && S.missiles.some((m) => m.nuke) ? nukesThreatening(ME) : [];
  if (!threats.length) { el.hidden = true; el.dataset.key = ''; return; }
  const m = threats.reduce((a, c) => (c.dur - c.t < a.dur - a.t ? c : a));
  const done = threats.every((n) => evacuating(ME, n)), mine = m.owner === ME;
  const inRing = S.bots.filter((u) => !u.dead && u.owner === ME && !BOTS[u.type].rail && !(u.task && u.task.type === 'flee') &&
    dist2(u.inside ? getE(u.inside).x + 0.5 : u.x, u.inside ? getE(u.inside).y + 0.5 : u.y, m.x1, m.y1) <= (NUKE.radius + EVAC_MARGIN) ** 2).length;
  const fleeing = S.bots.filter((u) => !u.dead && u.owner === ME && u.task && u.task.type === 'flee').length;
  const key = `${done}|${mine}|${threats.length}`;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    el.classList.toggle('safe', done);
    el.innerHTML = `<div class="ev-head"><span class="ev-dot" style="background:#ff5a5a;color:#ff5a5a"></span><b>${mine ? 'Your nuclear missile' : 'Nuclear missile incoming'}</b><span class="ev-time"></span></div>` +
      `<div class="ev-deal"><span class="ev-desc nk-text"></span>${done ? '' : '<button class="btn small primary" id="nk-evac">Evacuate</button>'}</div>`;
    const btn = $('nk-evac');
    if (btn) btn.onclick = () => {
      const mx = Math.floor(m.x1), my = Math.floor(m.y1);
      act('evac', [], (n) => {
        sfx(n ? 'click' : 'error');
        toast(n ? `Evacuating: ${n} robot${n === 1 ? '' : 's'} leaving the blast ring.` : 'The blast ring is clear: robots will keep out until it lands.', 'warn', mx, my);
        updateNukeCard();
      });
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
 * A message at the top of the screen. It stays for a time that fits its length (3.8 s for a short one, up to 12;
 * a building lost, 8 at least), lets taps through to the map under it, and has a Go chip when it's about a place.
 * While a game is on it is also kept (the last MSG_KEEP) for the list behind the messages button, by the goal card.
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
  // A story line (the narrator's, a rival's voice) sits beside the warnings, never in their place: it doesn't count
  // towards the limit below and pushes none of them out. It goes in under a newest one that is a warning (a narrow
  // phone on its side shows only the newest), and it gives way only to a newer story line (one at a time, but the lines
  // of one moment, such as a surrender's last words and the narrator after them, stay together).
  const lore = kind === 'narr' || kind === 'voice', last = box.lastElementChild, story = (c) => c.classList.contains('narr') || c.classList.contains('voice');
  el.dataset.batch = UI.toastBatch || 0;
  if (lore) for (const c of [...box.children]) if (story(c) && c.dataset.batch !== el.dataset.batch) c.remove();
  if (lore && last && /\b(bad|lost|warn)\b/.test(last.className) && !last.classList.contains('out')) box.insertBefore(el, last);
  else box.appendChild(el);
  // At most 2 at once (3 with a building lost), story lines aside: the oldest go first, but a "lost" toast (a building
  // of yours destroyed) outlasts the others and isn't pushed out by them.
  const lost = kind === 'lost', plain = () => [...box.children].filter((c) => !story(c));
  while (plain().length > (box.querySelector('.toast.lost') ? 3 : 2)) {
    const old = plain().find((c) => !c.classList.contains('lost') && c !== el) || plain()[0];
    box.removeChild(old);
  }
  const ms = clamp(3800 + 60 * (text.length - 60), 3800, 12000);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, lost ? Math.max(8000, ms) : ms);
}

/** The messages that have gone by, newest first, each with the game time it came at and Go if it has a place. */
function openMsgSheet() {
  const rows = UI.msgLog.slice().reverse().map((m, k) => `<div class="msg-row ${esc(m.kind)}"><span class="msg-t">${fmtTime(m.t)}</span><span>${esc(m.text)}${m.n > 1 ? ` ×${m.n}` : ''}</span>` +
    (m.x >= 0 ? `<button class="btn small" data-k="${UI.msgLog.length - 1 - k}">Go</button>` : '<span></span>') + '</div>').join('');
  openSheet('msgs', 0, `<div class="sheet-title"><div><h3>Messages</h3></div></div>
    <p class="desc">The last ${UI.msgLog.length} message${UI.msgLog.length === 1 ? '' : 's'}, newest first.</p><div class="msg-list">${rows}</div>`);
  for (const btn of $('sheet-body').querySelectorAll('.msg-row [data-k]')) btn.onclick = () => { const m = UI.msgLog[+btn.dataset.k]; sfx('click'); closeSheet(); if (m) centerOn(m.x + 0.5, m.y + 0.5); };
}

/**
 * The start of a game: everything it has to tell you (who landed where, the rivals' doctrines, the map, the Uplinks, a
 * Nuclear race...) in one card instead of a stack of pop-ups, with the game paused behind it. A tap anywhere (or a key)
 * starts the game; otherwise the card closes by itself once there's been time to read it. (Multiplayer can't pause for
 * one player: there it's just the card.)
 */
/**
 * The narrator's first words, for the briefing card of a free game or a multiplayer one (missions keep their own):
 * the terrafall, and the region it came down in (LORE.md's name for the biome).
 */
function landingLog() { return S && !S.mission ? `${NARRATOR.start} Landing site: ${regionName(S.settings.biome)}.` : ''; }

function showBriefing(log) {
  // (Not under test automation, whose scripts expect the game to start at once, unless a test asks for it.)
  if (typeof navigator !== 'undefined' && navigator.webdriver && !window.BOTFALL_BRIEF) return;
  const items = S.msgs.splice(0);
  if (!items.length) return;
  $('br-narr').textContent = log || '';
  $('br-narr').hidden = !log;
  // (who landed where first, then the rest as they came: the map, the rivals, the Trade Posts, the rules)
  const first = items.findIndex((m) => / have landed/.test(m.text));
  if (first > 0) items.unshift(items.splice(first, 1)[0]);
  const list = $('br-list');
  list.innerHTML = '';
  for (const m of items) { const li = document.createElement('li'); li.className = m.kind || 'info'; li.textContent = m.text; list.appendChild(li); }
  const chars = items.reduce((n, m) => n + m.text.length, (log || '').length);
  UI.briefing = { t0: performance.now(), dur: clamp(4 + chars / 40, 6, 24), paused: !MP.on };
  if (UI.briefing.paused) UI.paused = true;
  $('br-state').textContent = MP.on ? '' : 'Paused';
  $('br-hint').textContent = MP.on ? 'Tap to close' : 'Tap anywhere to start';
  $('br-fill').style.width = '100%';
  $('briefing').hidden = false;
}
function closeBriefing() {
  const b = UI.briefing;
  if (!b) return;
  UI.briefing = null;
  $('briefing').hidden = true;
  if (b.paused && UI.inGame) UI.paused = false;
}
function briefingTick() {
  if (!UI.briefing) return;
  if (!UI.inGame) { closeBriefing(); return; }
  const f = (performance.now() - UI.briefing.t0) / 1000 / UI.briefing.dur;
  if (f >= 1) { closeBriefing(); return; }
  $('br-fill').style.width = ((1 - f) * 100).toFixed(1) + '%';
}

/**
 * The narrator at the first nightfall (the street lights come on), once a game, in the first day of it (so a game
 * loaded later, or caught up after a resync, never says it again); not with the day/night cycle off.
 */
function nightfallLine() {
  if (S.mission || S.time < 30 || S.time > 720 || !todEnabled() || (S.lore && S.lore['n.night.' + ME] !== undefined)) return;
  if (todNow().lights >= 0.9) narrate(ME, 'night');
}

function uiTick(dt) {
  briefingTick();
  netTick();
  mpBannerTick();
  AUDIO.suppress = !UI.inGame;
  if (!UI.inGame) menuArtTick();
  if (!UI.inGame || !S) return;
  if (S.msgs.length) UI.toastBatch = (UI.toastBatch || 0) + 1; // (the messages of one moment: see toast)
  while (S.msgs.length) {
    const m = S.msgs.shift();
    toast(m.text, m.kind, m.x, m.y);
    if ((m.kind === 'bad' || m.kind === 'warn' || m.kind === 'lost') && (m.x || m.y)) UI.lastAlert = { x: m.x, y: m.y };
    if (m.kind === 'lost') sfx('alert');
  }
  updateMapTip();
  UI.hudT -= dt;
  if (UI.hudT <= 0) { UI.hudT = 0.25; updateHUD(); refreshSheet(); placeMinimap(); refreshSelection(); missionCoach(); syncWakeLock(); nightfallLine(); }
  if (S.winner >= 0 && !UI.overShown) showGameOver();
}
